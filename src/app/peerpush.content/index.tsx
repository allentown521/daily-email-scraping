import { defineContentScript } from "#imports";

import "~/assets/styles/globals.css";
import { Message, sendMessage } from "@/lib/messaging";
import { isPurchasedOrTrial, scraperEnabled } from "@/lib/utils";

export default defineContentScript({
  matches: ["https://peerpush.com/*"],
  cssInjectionMode: "ui",
  runAt: "document_end",

  async main(ctx) {
    console.log("Content script is running on peerpush.");
    if (!(await scraperEnabled())) {
      return;
    }
    if (!(await isPurchasedOrTrial())) {
      return;
    }

    // 创建持续显示的状态面板
    let statusPanel: HTMLDivElement | null = null;
    const statusPanelId = `peerpush-status-panel-${Date.now()}`;

    const createStatusPanel = () => {
      if (statusPanel?.parentNode && document.body.contains(statusPanel)) {
        return statusPanel;
      }

      const existingPanel = document.getElementById(statusPanelId);
      if (existingPanel) {
        existingPanel.remove();
      }

      const panel = document.createElement("div");
      statusPanel = panel;
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

      const addToBody = () => {
        if (document.body) {
          document.body.appendChild(panel);
          const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
              if (mutation.type === "childList") {
                for (const removedNode of mutation.removedNodes) {
                  if (removedNode === panel) {
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
      const panel = createStatusPanel();

      setTimeout(() => {
        if (!document.body.contains(panel)) {
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
                ? "Processing"
                : status === "completed"
                  ? "Completed"
                  : "Error"
            }
          </strong>
        </div>
        <div style="font-size: 13px; color: #ccc; line-height: 1.6;">
          <div>📦 Products: <strong style="color: white; font-size: 15px;">${itemCount}</strong></div>
          ${
            extra
              ? `<div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #444;">${extra}</div>`
              : ""
          }
        </div>
      `;
    };

    const removeStatusPanel = () => {
      if (statusPanel?.parentNode) {
        statusPanel.parentNode.removeChild(statusPanel);
        statusPanel = null;
      }
    };

    // 初始化状态面板
    updateStatus("running", 0, "Fetching today's products from peerpush API...");

    // peerpush 首页会调用这个 tRPC 接口返回当天 race 的所有产品，
    // 其中 product.publicFeed 的 result.data.json.items[] 里含 websiteUrl(产品官网)。
    // 这里只请求 product.publicFeed 一个 procedure，响应是数组，取第一项。
    const API_URL =
      "https://peerpush.com/api/trpc/product.publicFeed?batch=1&input=%7B%220%22%3A%7B%22json%22%3A%7B%22view%22%3A%22race%22%2C%22racePeriod%22%3A%22day%22%7D%7D%7D";

    let items: Array<{ websiteUrl?: string }> = [];
    try {
      const res = await fetch(API_URL, {
        headers: { Accept: "application/json" },
      });
      const data = (await res.json()) as Array<{
        result?: { data?: { json?: { items?: Array<{ websiteUrl?: string }> } } };
      }>;
      // 顶层是数组；遍历找到含 items 数组的那一项(通常是 publicFeed)，不硬编码 index
      for (const entry of data) {
        const d = entry?.result?.data?.json;
        if (d && Array.isArray(d.items)) {
          items = d.items;
          break;
        }
      }
    } catch (error) {
      console.error("Failed to fetch peerpush API:", error);
      updateStatus("error", 0, "Failed to fetch API.");
      setTimeout(() => removeStatusPanel(), 5000);
      return;
    }

    const urls = items
      .map((it) => it?.websiteUrl)
      .filter((u): u is string => typeof u === "string" && u.length > 0);

    const total = urls.length;
    console.log(`Total products with websiteUrl: ${total}`);

    if (total === 0) {
      updateStatus("error", 0, "No websiteUrl found in API response.");
      setTimeout(() => removeStatusPanel(), 5000);
      return;
    }

    updateStatus("running", total, `🔄 Scraping emails from ${total} websites...`);

    let processed = 0;
    for (const url of urls) {
      try {
        await sendMessage(Message.SCRAPE_EMAILS, url);
        processed++;
        updateStatus(
          "running",
          total,
          `🔄 Processing...<br>📂 Done: ${processed}/${total}`,
        );
        console.log(`Scraped (${processed}/${total}): ${url}`);
      } catch (error) {
        console.error(`Error scraping ${url}:`, error);
      }
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    console.log(`All ${total} websites processed.`);

    updateStatus(
      "completed",
      total,
      `✅ Completed!<br>📂 Processed: ${processed}/${total} websites`,
    );

    setTimeout(() => {
      removeStatusPanel();
    }, 5000);
  },
});
