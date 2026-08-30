import { defineContentScript } from "#imports";

import "~/assets/styles/globals.css";
import { Message, sendMessage } from "@/lib/messaging";
import { isPurchasedOrTrial, scraperEnabled } from "@/lib/utils";

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

// 共享进度键。列表脚本(SPA 编排器)与详情脚本(整页加载兜底)共用，
// 这样即使发生整页刷新也能在正确的位置继续。
const PROGRESS_KEY = "launchigniter_progress_index";

const readIndex = (): number => {
  try {
    const v = sessionStorage.getItem(PROGRESS_KEY);
    const n = v ? Number.parseInt(v, 10) : 0;
    return Number.isNaN(n) ? 0 : n;
  } catch {
    return 0;
  }
};

const writeIndex = (i: number) => {
  try {
    sessionStorage.setItem(PROGRESS_KEY, String(i));
  } catch {
    /* ignore */
  }
};

export default defineContentScript({
  matches: ["https://launchigniter.com/"],
  cssInjectionMode: "ui",
  runAt: "document_end",

  async main(ctx) {
    console.log("Content script is running on launchigniter.");
    if (!(await scraperEnabled())) {
      return;
    }
    if (!(await isPurchasedOrTrial())) {
      return;
    }
    // 创建持续显示的状态面板
    let statusPanel: HTMLDivElement | null = null;
    const statusPanelId = `launchigniter-status-panel-${Date.now()}`;

    const createStatusPanel = () => {
      // 检查是否已存在且在 DOM 中
      if (statusPanel?.parentNode && document.body.contains(statusPanel)) {
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
            for (const mutation of mutations) {
              if (mutation.type === "childList") {
                for (const removedNode of mutation.removedNodes) {
                  if (removedNode === panel) {
                    console.log("Panel was removed, re-adding...");
                    setTimeout(() => {
                      if (document.body && !document.body.contains(panel)) {
                        document.body.appendChild(panel);
                      }
                    }, 100);
                  }
                }
              }
            }
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

    const updateStatus = (
      status: "running" | "completed" | "error",
      itemCount: number,
      extra = "",
    ) => {
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
      } as const;

      const statusIcons = {
        running: "🔄",
        completed: "✅",
        error: "❌",
      } as const;

      const borderColor = statusColors[status] || "#4CAF50";
      const icon = statusIcons[status] || "🔄";

      panel.style.borderLeftColor = `${borderColor} !important`;
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
      if (statusPanel?.parentNode) {
        statusPanel.parentNode.removeChild(statusPanel);
        statusPanel = null;
        console.log("Status panel removed");
      }
    };

    // 初始化状态面板
    updateStatus("running", 0, "Starting launchigniter walk-through...");

    // 列表页现在是首页 "/"（也兼容旧的 /weekly-launches/*）
    const isListPage = () =>
      window.location.pathname === "/" ||
      window.location.pathname.startsWith("/weekly-launches/");
    const isDetailPage = () => window.location.pathname.startsWith("/launch/");

    let currentIndex = readIndex();
    let totalItems = 0;
    let done = false;
    let phase = "init" as string; // 状态机阶段: init | clicked | detail
    let lastClickTime = 0;

    // 详情页处理：找到包含 visit 的 href -> 抓取邮箱 -> 等 2s -> 点击 Back 返回
    const handleDetail = async () => {
      updateStatus("running", totalItems, "Loading detail page...");

      // 等待 "Visit" 链接渲染出来(页面是客户端流式渲染的)
      let visitUrl: string | null = null;
      for (let attempt = 0; attempt < 15 && !visitUrl; attempt++) {
        await sleep(500);
        for (const a of document.querySelectorAll("a")) {
          const href = a.getAttribute("href");
          const text = (a.innerText || "").trim().toLowerCase();
          if (href && text.includes("visit")) {
            visitUrl = href;
            break;
          }
        }
      }

      if (visitUrl) {
        updateStatus(
          "running",
          totalItems,
          `Scraping emails from: ${visitUrl}`,
        );
        try {
          await sendMessage(Message.SCRAPE_EMAILS, visitUrl);
        } catch (error) {
          console.error("Error scraping emails:", error);
        }
      } else {
        console.warn("No 'Visit' link found on the detail page.");
      }

      updateStatus("running", totalItems, "Waiting 2s then going Back...");
      await sleep(2000);

      const backBtn = Array.from(
        document.querySelectorAll("button, a, div"),
      ).find(
        (el) =>
          ((el as HTMLElement).innerText || "").trim().toLowerCase() === "back",
      ) as HTMLElement | undefined;
      if (backBtn) {
        console.log("Clicking Back button.");
        backBtn.click();
      } else {
        console.warn("No Back button found; calling history.back().");
        window.history.back();
      }

      // SPA 中有些 Back 按钮的 click handler 依赖可信事件(isTrusted)，
      // 用 .click() 触发不会导航。点完后等 2s，若仍在详情页则用 history.back() 兜底。
      await sleep(2000);
      if (isDetailPage()) {
        console.warn("Back click didn't navigate; calling history.back().");
        window.history.back();
      }
    };

    // 列表页处理：点击下一个 div.cursor-pointer 进入详情
    const handleList = async () => {
      const items = Array.from(document.querySelectorAll("div.cursor-pointer"));
      totalItems = items.length;
      console.log(`Total items: ${totalItems}`);
      if (totalItems === 0) return; // 列表还没渲染好，由循环重试

      if (currentIndex >= totalItems) {
        if (!done) {
          done = true;
          updateStatus(
            "completed",
            totalItems,
            `✅ All ${totalItems} items processed`,
          );
        }
        return;
      }

      done = false;
      updateStatus(
        "running",
        totalItems,
        `Opening item ${currentIndex + 1}/${totalItems}`,
      );
      console.log(`Opening item ${currentIndex + 1}/${totalItems}`);
      (items[currentIndex] as HTMLElement).click();
      phase = "clicked";
      lastClickTime = Date.now();
      writeIndex(currentIndex); // 整页刷新时也能从这里继续
    };

    if (isListPage()) {
      await sleep(1500); // 等待列表渲染
      await handleList();
    }

    // 该内容脚本存活在 SPA 内部，因此能在列表页与详情页之间做客户端导航时存活。
    // 下面的循环监听这些路由变化并驱动整个流程。
    while (!done) {
      // 用快照避免 TypeScript 对 phase 的控制流窄化误判
      const p = phase;
      if (p === "clicked" && isDetailPage()) {
        // 刚进入详情页 -> 抓取邮箱并返回
        phase = "detail";
        await handleDetail();
      } else if (p === "detail" && isListPage()) {
        // 返回到了列表页 -> 前进到下一个 item
        phase = "init";
        currentIndex++;
        writeIndex(currentIndex);
        await handleList();
      } else if (
        p === "clicked" &&
        isListPage() &&
        Date.now() - lastClickTime > 8000
      ) {
        // 点击没有产生跳转(比如非产品卡片)，跳过它
        currentIndex++;
        writeIndex(currentIndex);
        await handleList();
      } else if (p === "init" && isListPage()) {
        await handleList();
      }
      await sleep(800);
    }

    setTimeout(() => {
      removeStatusPanel();
    }, 5000);
  },
});
