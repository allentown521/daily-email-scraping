import { defineContentScript } from "#imports";

import "~/assets/styles/globals.css";
import { Message, sendMessage } from "@/lib/messaging";
import { isPurchasedOrTrial, scraperEnabled } from "@/lib/utils";

export default defineContentScript({
  matches: ["https://www.foundrlist.com/"],
  cssInjectionMode: "ui",
  runAt: "document_end",

  async main(ctx) {
    console.log("Content script is running on foundrlist.");
    if (!(await scraperEnabled())) {
      return;
    }
    if (!(await isPurchasedOrTrial())) {
      return;
    }
    const urls = [];
    let clickCount = 0;
    const maxClicks = 200; // 安全上限，防止无限循环

    // 查找页面中包含 "show more" 或 "show last" 文本的按钮（如 "Show 20 more" / "Show last"）
    const findShowMoreButton = () => {
      const buttons = Array.from(document.querySelectorAll("button"));
      return buttons.find((b) => {
        const text = (b.textContent || "").toLowerCase();
        return (
          (text.includes("show") && text.includes("more")) ||
          text.includes("show last")
        );
      });
    };

    // 收集页面中的产品/启动项目 URL
    const collectUrls = () => {
      document.querySelectorAll("a").forEach((a) => {
        const href = a.getAttribute("href");
        if (href?.includes("utm_source=foundrlist")) {
          if (!urls.includes(href)) {
            urls.push(href);
          }
        }
      });
    };

    // 创建持续显示的状态面板
    let statusPanel = null;
    const statusPanelId = "foundrlist-status-panel-" + Date.now();

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

    const updateStatus = (status, itemCount, scrollProgress, extra = "") => {
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
        paused: "#ff6b6b",
        completed: "#2196F3",
        error: "#f44336",
      };

      const statusIcons = {
        running: "🔄",
        paused: "⏸️",
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
                ? "Scrolling"
                : status === "paused"
                  ? "Paused"
                  : status === "completed"
                    ? "Completed"
                    : "Error"
            }
          </strong>
        </div>
        <div style="font-size: 13px; color: #ccc; line-height: 1.6;">
          <div>📦 Collected: <strong style="color: white; font-size: 15px;">${itemCount}</strong> projects</div>
          <div>📊 Progress: <strong style="color: white;">${scrollProgress}</strong></div>
          ${
            extra
              ? `<div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #444;">${extra}</div>`
              : ""
          }
        </div>
      `;

      console.log(
        `Status updated: ${status}, items: ${itemCount}, progress: ${scrollProgress}`,
      );
    };

    const removeStatusPanel = () => {
      if (statusPanel && statusPanel.parentNode) {
        statusPanel.parentNode.removeChild(statusPanel);
        statusPanel = null;
        console.log("Status panel removed");
      }
    };

    // 初始化状态面板
    updateStatus("running", 0, "0%", "Starting scroll task...");

    // 检查页面可见性并提醒
    const checkVisibility = () => {
      if (document.hidden) {
        updateStatus(
          "paused",
          urls.length,
          "Loading...",
          "⚠️ Keep this tab in foreground<br>Will resume automatically when you return",
        );
        return false;
      }
      return true;
    };

    // 先收集首页已有的 URL
    collectUrls();
    updateStatus("running", urls.length, "0%", "Looking for Show more button...");

    // 循环查找 "Show more" 按钮：找到就点击并等待 3 秒，找不到说明数据已全部加载
    while (clickCount < maxClicks) {
      // 检查页面是否在前台
      if (!checkVisibility()) {
        console.log("Page is in background, pausing");
        // 等待页面重新可见
        while (document.hidden) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
        console.log("Page is now visible, resuming");
        updateStatus("running", urls.length, "Loading...", "✨ Resuming...");
      }

      // 查找包含 "show more" 文本的按钮
      const showMoreButton = findShowMoreButton();

      // 没有找到该按钮，说明数据已全部加载完成
      if (!showMoreButton) {
        console.log(
          "Show more button not found, data loading completed.",
        );
        updateStatus(
          "running",
          urls.length,
          "100%",
          "✅ All data loaded, ready to scrape",
        );
        break;
      }

      clickCount++;

      // 点击按钮加载更多数据
      console.log(`Clicking Show more button (attempt ${clickCount})`);
      showMoreButton.click();

      // 等待 3 秒让数据加载完成
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // 收集新加载的 URL
      collectUrls();

      // 读取按钮上剩余的条目数（如 "99 left"）
      const leftMatch = (showMoreButton.textContent || "").match(
        /(\d+)\s+left/i,
      );
      const leftText = leftMatch ? `${leftMatch[1]} left` : "";

      updateStatus(
        "running",
        urls.length,
        "Loading...",
        `🔘 Clicked Show more ${clickCount} times${
          leftText ? `<br>📉 ${leftText}` : ""
        }`,
      );
    }

    console.log(`Data loading completed. Total URLs collected: ${urls.length}`);

    // 开始打开标签页
    updateStatus(
      "completed",
      urls.length,
      "100%",
      "🔄 Scraping product pages...",
    );

    let openedTabsCount = 0;
    for (const url of urls) {
      await sendMessage(/* Message.OPEN_TAB */ Message.SCRAPE_EMAILS, url);
      openedTabsCount++;

      // 实时显示已打开的网页数
      updateStatus(
        "running",
        urls.length,
        "100%",
        `🔄 Scraping pages...<br>📂 Opened: ${openedTabsCount}/${urls.length}`,
      );

      await new Promise((resolve) => setTimeout(resolve, 3000));
    }

    console.log(`All ${urls.length} tabs have been opened.`);

    updateStatus(
      "completed",
      urls.length,
      "100%",
      `✅ Completed!<br>📂 Scraped: ${openedTabsCount}/${urls.length} pages`,
    );

    // 5秒后移除状态面板
    /*     setTimeout(() => {
      removeStatusPanel();
    }, 5000); */
  },
});
