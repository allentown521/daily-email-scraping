import { defineContentScript } from "#imports";

import "~/assets/styles/globals.css";
import { Message, sendMessage } from "@/lib/messaging";
import { isPurchasedOrTrial, scraperEnabled } from "@/lib/utils";

export default defineContentScript({
  matches: ["https://startupfa.me/"],
  cssInjectionMode: "ui",
  runAt: "document_end",

  async main(ctx) {
    console.log("Content script is running on startupfa.");
    if (!(await scraperEnabled())) {
      return;
    }
    if (!(await isPurchasedOrTrial())) {
      return;
    }

    // 创建持续显示的状态面板
    let statusPanel = null;
    const statusPanelId = "startupfa-status-panel-" + Date.now();

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

    // Find the "Recently added" section
    const sections = document.querySelectorAll("section");
    let highlightsSection = null;

    for (const section of sections) {
      const h2 = section.querySelector("h2");
      if (h2 && h2.textContent.includes("Recently added")) {
        highlightsSection = section;
        break;
      }
    }

    if (!highlightsSection) {
      console.warn("Recently added section not found");
      updateStatus("error", 0, "Recently added section not found");
      setTimeout(() => {
        removeStatusPanel();
      }, 3000);
      return;
    }

    // Query for all <a> tags within the section
    const links = highlightsSection.querySelectorAll("a");
    const externalLinks: string[] = [];

    for (const link of links) {
      const href = link.getAttribute("href");
      if (href) {
        externalLinks.push(`https://startupfa.me${href}`);
      }
    }

    console.log(
      `Found ${externalLinks.length} external links in Recently added`,
    );

    // 更新为准备获取邮件状态
    updateStatus(
      "running",
      externalLinks.length,
      `🎉 Collection completed!<br>Scraping emails from ${externalLinks.length} products...`,
    );

    await new Promise((resolve) => setTimeout(resolve, 1000));

    let scrapedCount = 0;
    for (const url of externalLinks) {
      scrapedCount++;
      updateStatus(
        "running",
        externalLinks.length,
        `🔄 Scraping...<br>📧 Scraped: <strong style="color: #4CAF50;">${scrapedCount}</strong> / ${externalLinks.length}`,
      );
      console.log(`Scraping emails from: ${url}`);
      await sendMessage(Message.OPEN_TAB, url);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    console.log(
      `Email scraping completed for ${externalLinks.length} products.`,
    );

    // 最后更新为完成状态
    updateStatus(
      "completed",
      externalLinks.length,
      `🎉 Task completed!<br>📧 Scraped ${externalLinks.length} products`,
    );

    // 5秒后移除状态面板
    setTimeout(() => {
      removeStatusPanel();
    }, 5000);
  },
});
