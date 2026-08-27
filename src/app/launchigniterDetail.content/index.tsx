import { defineContentScript } from "#imports";

import "~/assets/styles/globals.css";
import { Message, sendMessage } from "@/lib/messaging";
import { isPurchasedOrTrial, scraperEnabled } from "@/lib/utils";

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

// 与列表脚本(launchigniter.content)共用的进度键。
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
  matches: ["https://launchigniter.com/launch/*"],
  cssInjectionMode: "ui",
  runAt: "document_end",

  async main(ctx) {
    console.log("Content script is running on launchigniter detail.");
    if (!(await scraperEnabled())) {
      return;
    }
    if (!(await isPurchasedOrTrial())) {
      return;
    }

    // 创建状态面板
    const statusPanelId = `launchigniter-detail-status-${Date.now()}`;
    const panel = document.createElement("div");
    panel.id = statusPanelId;
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
    document.body.appendChild(panel);

    const updateStatus = (extra = "") => {
      panel.innerHTML = `
        <div style="display: flex; align-items: center; margin-bottom: 12px;">
          <span style="font-size: 24px; margin-right: 10px;">🔄</span>
          <strong style="font-size: 16px; color: #4CAF50;">Processing</strong>
        </div>
        <div style="font-size: 13px; color: #ccc; line-height: 1.6;">
          ${extra ? `<div>${extra}</div>` : ""}
        </div>
      `;
    };

    // 找到 href 忽略大小写包含 "visit" 的链接
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
      updateStatus(`Scraping emails from: ${visitUrl}`);
      try {
        await sendMessage(Message.SCRAPE_EMAILS, visitUrl);
      } catch (error) {
        console.error("Error scraping emails:", error);
      }
    } else {
      console.warn("No 'Visit' link found on the detail page.");
      updateStatus("No 'Visit' link found.");
    }

    updateStatus("Waiting 2s then going Back...");
    await sleep(2000);

    // 返回前先把当前 item 标记为完成，整页刷新回到列表后能接着下一个继续
    writeIndex(readIndex() + 1);

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

    // SPA 中部分 Back 按钮的 click handler 依赖可信事件(isTrusted)，
    // .click() 不会导航。轮询检测若仍在详情页则用 history.back() 兜底。
    const isDetailPage = () =>
      window.location.pathname.startsWith("/launch/");
    (async () => {
      for (let i = 0; i < 6; i++) {
        await sleep(500);
        if (!isDetailPage()) return; // 已返回
      }
      console.warn("Back click didn't navigate; calling history.back().");
      window.history.back();
    })();

    setTimeout(() => {
      panel.remove();
    }, 5000);
  },
});
