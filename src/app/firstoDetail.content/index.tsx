import { defineContentScript } from "#imports";

import "~/assets/styles/globals.css";
import { Message, sendMessage } from "@/lib/messaging";
import { scraperEnabled } from "@/lib/utils";

export default defineContentScript({
  matches: ["https://firsto.co/projects/*"],
  cssInjectionMode: "ui",
  runAt: "document_end",

  async main(ctx) {
    console.log("Content script is running on firsto detail.");
    if (!(await scraperEnabled())) {
      return;
    }

    const urls = [];

    document.querySelectorAll("a").forEach((a) => {
      const href = a.getAttribute("href");
      const dataUmamiEvent = a.getAttribute("data-umami-event");
      if (
        href &&
        dataUmamiEvent &&
        href.startsWith("https") &&
        !href.includes("firsto") &&
        !href.includes("open-launch")
      ) {
        urls.push(href);
      }
    });

    console.log(`Total URLs collected: ${urls.length}`);

    if (urls.length === 0) {
      return;
    }

    // 创建状态面板
    const statusPanelId = "firsto-detail-status-" + Date.now();
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

    const updateStatus = (processed: number, total: number) => {
      panel.innerHTML = `
        <div style="display: flex; align-items: center; margin-bottom: 12px;">
          <span style="font-size: 24px; margin-right: 10px;">🔄</span>
          <strong style="font-size: 16px; color: #4CAF50;">Processing</strong>
        </div>
        <div style="font-size: 13px; color: #ccc; line-height: 1.6;">
          <div>📂 Opened: <strong style="color: white; font-size: 15px;">${processed}/${total}</strong></div>
        </div>
      `;
    };

    // 处理每个 URL
    let processedCount = 0;
    for (const url of urls) {
      try {
        await sendMessage(Message.SCRAPE_EMAILS, url);
        processedCount++;
        updateStatus(processedCount, urls.length);
      } catch (error) {
        console.error(`Error scraping ${url}:`, error);
      }
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    // 完成
    panel.innerHTML = `
      <div style="display: flex; align-items: center; margin-bottom: 12px;">
        <span style="font-size: 24px; margin-right: 10px;">✅</span>
        <strong style="font-size: 16px; color: #2196F3;">Completed</strong>
      </div>
      <div style="font-size: 13px; color: #ccc; line-height: 1.6;">
        <div>📂 Processed: <strong style="color: white; font-size: 15px;">${processedCount}/${urls.length}</strong></div>
      </div>
    `;

    // 5秒后移除
    setTimeout(() => {
      panel.remove();
    }, 5000);
  },
});
