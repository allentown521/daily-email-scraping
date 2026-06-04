import { defineContentScript } from "#imports";

import "~/assets/styles/globals.css";
import { Message, sendMessage } from "@/lib/messaging";
import { scraperEnabled } from "@/lib/utils";

export default defineContentScript({
  matches: ["https://peerpush.net/p/*"],
  cssInjectionMode: "ui",
  runAt: "document_end",

  async main(ctx) {
    console.log("Content script is running on peerpush detail.");
    if (!(await scraperEnabled())) {
      return;
    }

    const visitSiteUrls = [];

    for (const a of document.querySelectorAll("a")) {
      if (a.innerText.trim() === "Visit site") {
        const href = a.getAttribute("href");
        if (href) {
          visitSiteUrls.push(href);
        }
      }
    }

    console.log(`Total "Visit site" URLs collected: ${visitSiteUrls.length}`);

    if (visitSiteUrls.length === 0) {
      return;
    }

    const statusPanelId = `peerpush-detail-status-${Date.now()}`;
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

    let processedCount = 0;
    for (const url of visitSiteUrls) {
      try {
        await sendMessage(Message.SCRAPE_EMAILS, url);
        processedCount++;
        updateStatus(processedCount, visitSiteUrls.length);
      } catch (error) {
        console.error(`Error scraping ${url}:`, error);
      }
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    panel.innerHTML = `
      <div style="display: flex; align-items: center; margin-bottom: 12px;">
        <span style="font-size: 24px; margin-right: 10px;">✅</span>
        <strong style="font-size: 16px; color: #2196F3;">Completed</strong>
      </div>
      <div style="font-size: 13px; color: #ccc; line-height: 1.6;">
        <div>📂 Processed: <strong style="color: white; font-size: 15px;">${processedCount}/${visitSiteUrls.length}</strong></div>
      </div>
    `;

    setTimeout(() => {
      panel.remove();
    }, 5000);
  },
});
