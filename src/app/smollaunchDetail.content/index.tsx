import { defineContentScript } from "#imports";

import "~/assets/styles/globals.css";
import { Message, sendMessage } from "@/lib/messaging";
import { scraperEnabled } from "@/lib/utils";

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
  matches: ["https://smollaunch.com/products/*"],
  cssInjectionMode: "ui",
  runAt: "document_end",

  async main(ctx) {
    console.log("Content script is running on smollaunch detail.");
    if (!(await scraperEnabled())) {
      return;
    }

    const urls: string[] = [];

    for (const a of document.querySelectorAll("a")) {
      // 真实官网链接的文案是 "Visit Website"
      const text = ((a as HTMLElement).innerText || a.textContent || "")
        .trim()
        .toLowerCase();

      if (!text.includes("visit")) {
        continue;
      }

      // 跳过站内链接与赞助广告（广告位 rel 带 sponsored）
      const rel = a.getAttribute("rel") ?? "";
      if (rel.includes("sponsored")) {
        continue;
      }

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

      if (url.protocol !== "http:" && url.protocol !== "https:") {
        continue;
      }

      if (url.hostname === "smollaunch.com") {
        continue;
      }

      if (url.hostname.endsWith(".smollaunch.com")) {
        continue;
      }

      if (!urls.includes(url.href)) {
        urls.push(url.href);
      }
    }

    console.log(`Total "visit" URLs collected: ${urls.length}`);

    if (urls.length === 0) {
      return;
    }

    const panel = document.createElement("div");
    panel.id = `smollaunch-detail-status-${Date.now()}`;
    panel.style.cssText = PANEL_STYLE;
    document.body.appendChild(panel);

    const updateStatus = (processed: number, total: number) => {
      panel.innerHTML = `
        <div style="display: flex; align-items: center; margin-bottom: 12px;">
          <span style="font-size: 24px; margin-right: 10px;">🔄</span>
          <strong style="font-size: 16px; color: #4CAF50;">Processing</strong>
        </div>
        <div style="font-size: 13px; color: #ccc; line-height: 1.6;">
          <div>📂 Processed: <strong style="color: white; font-size: 15px;">${processed}/${total}</strong></div>
        </div>
      `;
    };

    let processedCount = 0;
    for (const url of urls) {
      try {
        await sendMessage(Message.SCRAPE_EMAILS, url);
        processedCount++;
        updateStatus(processedCount, urls.length);
      } catch (error) {
        console.error(`Error scraping ${url}:`, error);
      }
      await sleep(2000);
    }

    panel.innerHTML = `
      <div style="display: flex; align-items: center; margin-bottom: 12px;">
        <span style="font-size: 24px; margin-right: 10px;">✅</span>
        <strong style="font-size: 16px; color: #2196F3;">Completed</strong>
      </div>
      <div style="font-size: 13px; color: #ccc; line-height: 1.6;">
        <div>📂 Processed: <strong style="color: white; font-size: 15px;">${processedCount}/${urls.length}</strong></div>
      </div>
    `;

    setTimeout(() => {
      panel.remove();
    }, 5000);
  },
});
