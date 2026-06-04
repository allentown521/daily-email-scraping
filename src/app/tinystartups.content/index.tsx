import { defineContentScript } from "#imports";

import "~/assets/styles/globals.css";
import { Message, sendMessage } from "@/lib/messaging";
import { isPurchasedOrTrial, scraperEnabled } from "@/lib/utils";

export default defineContentScript({
  matches: ["https://www.tinystartups.com/"],
  cssInjectionMode: "ui",
  runAt: "document_end",

  async main(ctx) {
    console.log("Content script is running on tinystartups.");
    if (!(await scraperEnabled())) {
      return;
    }
    if (!(await isPurchasedOrTrial())) {
      return;
    }

    // 创建持续显示的状态面板
    let statusPanel = null;
    const statusPanelId = "tinystartups-status-panel-" + Date.now();

    const createStatusPanel = () => {
      // 检查是否已存在且在 DOM 中
      if (
        statusPanel &&
        statusPanel.parentNode &&
        document.body.contains(statusPanel)
      ) {
        return statusPanel;
      }

      // 移除可能存在的旧面板
      const existingPanel = document.getElementById(statusPanelId);
      if (existingPanel) {
        existingPanel.remove();
      }

      const panel = document.createElement("div");
      statusPanel = panel;
      panel.id = statusPanelId; // 设置唯一 ID
      panel.style.cssText = `
        position: fixed !important;
        top: 20px !important;
        right: 20px !important;
        background: rgba(0, 0, 0, 0.85) !important;
        color: white !important;
        padding: 20px !important;
        border-radius: 12px !important;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
        font-size: 14px !important;
        z-index: 999999 !important;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3) !important;
        min-width: 280px !important;
        line-height: 1.4 !important;
        border-left: 4px solid #4CAF50 !important;
        pointer-events: none !important;
        user-select: none !important;
      `;

      // 强制添加到 document.body
      const addToBody = () => {
        if (document.body) {
          document.body.appendChild(panel);
          console.log(
            "Status panel created and attached to body with ID:",
            statusPanelId,
          );

          // 添加一个 MutationObserver 来监控面板是否被意外移除
          const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
              if (mutation.type === "childList") {
                mutation.removedNodes.forEach((removedNode) => {
                  if (removedNode === panel) {
                    console.log("Panel was removed, re-adding...");
                    setTimeout(() => {
                      if (document.body && !document.body.contains(panel)) {
                        document.body.appendChild(panel);
                      }
                    }, 100);
                  }
                });
              }
            });
          });

          observer.observe(document.body, { childList: true, subtree: true });
        } else {
          // 如果 body 还没准备好，等待一下再试
          setTimeout(addToBody, 100);
        }
      };

      addToBody();
      return panel;
    };

    const updateStatus = (status, itemCount, extra = "") => {
      // 总是重新创建面板以确保显示
      const panel = createStatusPanel();

      // 再次确认面板在 DOM 中
      setTimeout(() => {
        if (!document.body.contains(panel)) {
          console.log(
            "Panel still not in DOM after creation, forcing re-add...",
          );
          document.body.appendChild(panel);
        }
      }, 50);

      const statusColors = {
        running: "#4CAF50",
        completed: "#2196F3",
        error: "#f44336",
      };

      const statusIcons = {
        running: "🔄",
        completed: "✅",
        error: "❌",
      };

      const borderColor = statusColors[status] || "#4CAF50";
      const icon = statusIcons[status] || "🔄";

      panel.style.borderLeftColor = borderColor + " !important";
      panel.innerHTML = `
        <div style="display: flex; align-items: center; margin-bottom: 12px;">
          <span style="font-size: 24px; margin-right: 10px;">${icon}</span>
          <strong style="font-size: 16px; color: ${borderColor};">
            ${
              status === "running"
                ? "Collecting"
                : status === "completed"
                  ? "Completed"
                  : "Error"
            }
          </strong>
        </div>
        <div style="font-size: 13px; color: #ccc; line-height: 1.6;">
          <div>📦 Collected: <strong style="color: white; font-size: 15px;">${itemCount}</strong> links</div>
          ${
            extra
              ? `<div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #444;">${extra}</div>`
              : ""
          }
        </div>
      `;

      console.log(`Status updated: ${status}, items: ${itemCount}`);
    };

    const removeStatusPanel = () => {
      if (statusPanel && statusPanel.parentNode) {
        statusPanel.parentNode.removeChild(statusPanel);
        statusPanel = null;
        console.log("Status panel removed");
      }
    };

    // 初始化状态面板
    updateStatus("running", 0, "Starting to collect links...");
    await new Promise((resolve) => setTimeout(resolve, 5000));
    const articles = document.querySelectorAll("article");

    console.log(`Total URLs collected: ${articles.length}`);

    // 更新为准备获取邮件状态
    updateStatus(
      "running",
      articles.length,
      `🎉 Collection completed!<br>Scraping emails from ${articles.length} products...`,
    );

    await new Promise((resolve) => setTimeout(resolve, 1000));
    let scrapedCount = 0;
    for (const article of articles) {
      if (article) {
        console.log(`正在点击第 ${scrapedCount + 1} 个 article 中的元素...`);

        // 在当前 article 内部查找你想点击的标签，比如 'button' 或 '.click-me'
        const target = article.querySelector("button");
        if (target) {
          scrapedCount++;

          target.click();
          setTimeout(async () => {
            const links = document.querySelectorAll("a");
            for (const link of links) {
              const href = link.getAttribute("href");
              if (
                href?.includes("tinystartups") &&
                link.innerHTML.includes("Visit Website")
              ) {
                // 更新状态，显示已刮取的邮件数量
                updateStatus(
                  "running",
                  articles.length,
                  `🔄 Scraping...<br>📧 Scraped: <strong style="color: #4CAF50;">${scrapedCount}</strong> / ${articles.length}`,
                );
                console.log(`正在刮取第 ${scrapedCount} 个网站的邮件...`);
                await sendMessage(Message.SCRAPE_EMAILS, href);
                break;
              }
            }
          }, 1000);

          // 等待一段时间，让浏览器完成操作
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      } else {
        console.warn(`第 ${scrapedCount + 1} 个 article 中未找到目标元素`);
      }
    }

    console.log(`Email scraping completed for ${articles.length} products.`);

    // 最后更新为完成状态
    updateStatus(
      "completed",
      articles.length,
      `🎉 Task completed!<br>📧 Scraped ${articles.length} products`,
    );

    // 5秒后移除状态面板
    setTimeout(() => {
      removeStatusPanel();
    }, 5000);
  },
});
