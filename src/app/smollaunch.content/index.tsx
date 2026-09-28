import { defineContentScript } from "#imports";

import "~/assets/styles/globals.css";
import { Message, sendMessage } from "@/lib/messaging";
import { isPurchasedOrTrial, scraperEnabled } from "@/lib/utils";

const PRODUCT_PATH = "/products/";

const PANEL_STYLE = `
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

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export default defineContentScript({
  matches: ["https://smollaunch.com/", "https://smollaunch.com/launches/*"],
  cssInjectionMode: "ui",
  runAt: "document_end",

  async main(ctx) {
    console.log("Content script is running on smollaunch.");
    if (!(await scraperEnabled())) {
      return;
    }
    if (!(await isPurchasedOrTrial())) {
      return;
    }

    const urls: string[] = [];

    // 创建持续显示的状态面板
    const statusPanelId = `smollaunch-status-panel-${Date.now()}`;
    const panel = document.createElement("div");
    panel.id = statusPanelId;
    panel.style.cssText = PANEL_STYLE;
    document.body.appendChild(panel);

    const updateStatus = (
      status: string,
      itemCount: number,
      extra = "",
    ): void => {
      const statusColors: Record<string, string> = {
        running: "#4CAF50",
        paused: "#ff6b6b",
        completed: "#2196F3",
        error: "#f44336",
      };
      const statusIcons: Record<string, string> = {
        running: "🔄",
        paused: "⏸️",
        completed: "✅",
        error: "❌",
      };

      const borderColor = statusColors[status] || "#4CAF50";
      const icon = statusIcons[status] || "🔄";

      panel.style.borderLeftColor = `${borderColor} !important`;
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
          ${
            extra
              ? `<div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #444;">${extra}</div>`
              : ""
          }
        </div>
      `;

      console.log(`Status updated: ${status}, items: ${itemCount}`);
    };

    updateStatus("running", 0, "Starting to collect products...");

    // 收集页面上的 /products/{slug} 链接
    const collectUrls = () => {
      for (const a of document.querySelectorAll("a")) {
        const href = a.getAttribute("href");
        if (!href) {
          continue;
        }

        let url: URL;
        try {
          url = new URL(href, window.location.origin);
        } catch {
          continue;
        }

        // 只要产品详情页，排除 /products 列表页本身
        if (!url.pathname.startsWith(PRODUCT_PATH)) {
          continue;
        }
        if (url.pathname.length <= PRODUCT_PATH.length) {
          continue;
        }

        url.search = "";
        url.hash = "";
        const productUrl = url.href;

        if (!urls.includes(productUrl)) {
          urls.push(productUrl);
        }
      }
    };

    // 渐进式缓慢滚动，模拟人类滚动行为，触发懒加载
    const maxScrollAttempts = 80;
    const maxNoChangeCount = 5;
    let pageCount = 0;
    let noChangeCount = 0;
    let previousHeight = 0;
    let currentHeight = document.body.scrollHeight;
    let previousProductCount = 0;

    // 页面切到后台时暂停滚动，回到前台自动继续
    const checkVisibility = () => {
      if (document.hidden) {
        updateStatus(
          "paused",
          urls.length,
          "⚠️ Keep this tab in foreground<br>Will resume automatically when you return",
        );
        return false;
      }
      return true;
    };

    while (pageCount < maxScrollAttempts && noChangeCount < maxNoChangeCount) {
      if (!checkVisibility()) {
        console.log("Page is in background, pausing scrolling");
        // 等待页面重新可见，但不增加 pageCount
        while (document.hidden) {
          await sleep(1000);
        }
        console.log("Page is now visible, resuming scrolling");
        updateStatus("running", urls.length, "✨ Resuming scroll...");
      }

      pageCount++;

      previousHeight = currentHeight;

      // 每次只滚动 0.5~1 屏，而不是直接跳到底部
      const viewportHeight = window.innerHeight;
      const scrollPosition = window.scrollY;
      const randomFactor = 0.5 + Math.random() * 0.5; // 0.5-1.0 之间的随机数
      const scrollStep = viewportHeight * randomFactor;

      // 计算目标滚动位置，但底部留一点空间以触发加载
      const scrollTarget = Math.min(
        scrollPosition + scrollStep,
        document.body.scrollHeight - viewportHeight * 0.2,
      );

      window.scrollTo({
        top: scrollTarget,
        behavior: "smooth",
      });

      // 等待页面响应和加载，随机等待 5-7 秒
      await sleep(5000 + Math.random() * 2000);

      currentHeight = document.body.scrollHeight;

      collectUrls();

      // 只有高度和产品数量都没变化时才计数
      if (
        previousHeight === currentHeight &&
        previousProductCount === urls.length
      ) {
        noChangeCount++;
        console.log(
          `No changes detected ${noChangeCount}/${maxNoChangeCount} times (height: ${currentHeight}, products: ${urls.length})`,
        );
      } else {
        noChangeCount = 0;
        previousProductCount = urls.length;
      }

      console.log(
        `Scrolling attempt ${pageCount}/${maxScrollAttempts}, position: ${Math.round(
          window.scrollY,
        )}/${document.body.scrollHeight}, collecting URLs... length: ${
          urls.length
        }`,
      );

      updateStatus(
        "running",
        urls.length,
        `📍 Position: ${Math.round(window.scrollY)}/${
          document.body.scrollHeight
        }px<br>📊 Progress: ${Math.round(
          (pageCount / maxScrollAttempts) * 100,
        )}%`,
      );
    }

    collectUrls();

    console.log(`Total product URLs collected: ${urls.length}`);

    if (urls.length === 0) {
      updateStatus("completed", 0, "⚠️ No product links found on this page.");
      setTimeout(() => panel.remove(), 5000);
      return;
    }

    // 依次打开产品详情页，由 smollaunchDetail 脚本抓取真实官网的邮箱
    updateStatus("running", urls.length, "🔄 Opening product pages...");

    let openedTabsCount = 0;
    for (const url of urls) {
      await sendMessage(Message.OPEN_TAB, url);
      openedTabsCount++;

      updateStatus(
        "running",
        urls.length,
        `🔄 Opening pages...<br>📂 Opened: ${openedTabsCount}/${urls.length}`,
      );

      await sleep(3000);
    }

    console.log(`All ${urls.length} tabs have been opened.`);

    updateStatus(
      "completed",
      urls.length,
      `✅ Completed!<br>📂 Opened: ${openedTabsCount}/${urls.length} pages`,
    );

    setTimeout(() => {
      panel.remove();
    }, 5000);
  },
});
