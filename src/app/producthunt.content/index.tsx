import { defineContentScript } from "#imports";

import "~/assets/styles/globals.css";
import { Message, sendMessage } from "@/lib/messaging";
import { isPurchasedOrTrial, scraperEnabled } from "@/lib/utils";

export default defineContentScript({
  matches: ["https://www.producthunt.com/leaderboard/daily/*/*/*/*"],
  cssInjectionMode: "ui",
  runAt: "document_end",

  async main(ctx) {
    console.log("Content script is running on producthunt.");
    if (!(await scraperEnabled())) {
      return;
    }
    if (!(await isPurchasedOrTrial())) {
      return;
    }
    const urls = [];
    let pageCount = 0;
    let previousHeight = 0;
    let currentHeight = document.body.scrollHeight;
    let noChangeCount = 0;
    const maxNoChangeCount = 5;
    const maxScrollAttempts = 500;

    // 记录已经看到的产品数量
    let previousProductCount = 0;

    // 创建持续显示的状态面板
    let statusPanel = null;
    const statusPanelId = "producthunt-status-panel-" + Date.now();

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
          <div>📦 Collected: <strong style="color: white; font-size: 15px;">${itemCount}</strong> products</div>
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
          `${Math.round((pageCount / maxScrollAttempts) * 100)}%`,
          "⚠️ Keep this tab in foreground<br>Will resume automatically when you return",
        );
        return false;
      }
      return true;
    };

    while (pageCount < maxScrollAttempts && noChangeCount < maxNoChangeCount) {
      // 检查页面是否在前台
      if (!checkVisibility()) {
        console.log("Page is in background, pausing scrolling");
        // 等待页面重新可见，但不增加 pageCount
        while (document.hidden) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
        console.log("Page is now visible, resuming scrolling");
        updateStatus(
          "running",
          urls.length,
          `${Math.round((pageCount / maxScrollAttempts) * 100)}%`,
          "✨ Resuming scroll...",
        );
      }

      pageCount++;

      previousHeight = currentHeight;

      const viewportHeight = window.innerHeight;
      const scrollPosition = window.scrollY;
      const randomFactor = 0.5 + Math.random() * 0.5;
      const scrollStep = viewportHeight * randomFactor;

      const scrollTarget = Math.min(
        scrollPosition + scrollStep,
        document.body.scrollHeight - viewportHeight * 0.2,
      );

      console.log(`Scrolling to ${scrollTarget}`);

      // 执行滚动
      window.scrollTo({
        top: scrollTarget,
        behavior: "smooth",
      });

      // 等待页面响应和加载
      const waitTime = 5000 + Math.random() * 2000;
      await new Promise((resolve) => setTimeout(resolve, waitTime));

      currentHeight = document.body.scrollHeight;

      // 检查页面内容是否有变化并收集URL
      const html = document.documentElement.innerHTML;
      const regex = /post-item-(\d+)/g;
      let match;
      const currentProducts = [];

      while ((match = regex.exec(html)) !== null) {
        const productId = match[1];

        if (!currentProducts.includes(productId)) {
          currentProducts.push(productId);
        }

        const url = `https://www.producthunt.com/r/p/${productId}`;
        if (!urls.includes(url)) {
          urls.push(url);
        }
      }

      // 检查高度和产品数量是否变化
      if (
        previousHeight === currentHeight &&
        previousProductCount === currentProducts.length
      ) {
        noChangeCount++;
        console.log(
          `No changes detected ${noChangeCount}/${maxNoChangeCount} times (height: ${currentHeight}, products: ${currentProducts.length})`,
        );
      } else {
        noChangeCount = 0;
        previousProductCount = currentProducts.length;
      }

      console.log(
        `Scrolling attempt ${pageCount}/${maxScrollAttempts}, position: ${Math.round(
          window.scrollY,
        )}/${document.body.scrollHeight}, URLs: ${urls.length}`,
      );

      // 更新状态面板
      updateStatus(
        "running",
        urls.length,
        `${Math.round((pageCount / maxScrollAttempts) * 100)}%`,
        `📍 Position: ${Math.round(window.scrollY)}/${
          document.body.scrollHeight
        }px`,
      );
    }

    console.log(`Scrolling completed. Total URLs collected: ${urls.length}`);

    // 更新为完成状态
    updateStatus(
      "completed",
      urls.length,
      "100%",
      `🎉 Scroll completed!<br>Preparing to open ${urls.length} tabs...`,
    );

    await new Promise((resolve) => setTimeout(resolve, 1000));

    let openedTabsCount = 0;
    for (const url of urls) {
      await sendMessage(Message.OPEN_TAB, `${url}`);
      openedTabsCount++;

      // 更新状态，显示正在打开的标签页数量
      updateStatus(
        "running",
        urls.length,
        "100%",
        `🔄 Scraping...<br>📂 Opened: <strong style="color: #4CAF50;">${openedTabsCount}</strong> / ${urls.length}`,
      );

      await new Promise((resolve) => setTimeout(resolve, 3000));
    }

    console.log(`All ${urls.length} tabs have been opened.`);

    // 最后更新状态
    updateStatus(
      "completed",
      urls.length,
      "100%",
      `🎉 Task completed!<br>📂 Opened ${urls.length} tabs`,
    );

    // 5秒后移除状态面板
    /*     setTimeout(() => {
      removeStatusPanel();
    }, 5000); */
  },
});
