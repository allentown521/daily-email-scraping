import { defineContentScript } from "#imports";

import "~/assets/styles/globals.css";
import { Message, sendMessage } from "@/lib/messaging";
import { isPurchasedOrTrial, scraperEnabled } from "@/lib/utils";

const PH_API = "https://api.producthunt.com/v2/api/graphql";
const PH_TOKEN = "aqMQYJJIxIfqFMJ2zloSnVy6j0j0ENymNK6o5PwTkvI";

interface PostsResponse {
  errors?: Array<{ message: string }>;
  data?: {
    posts?: {
      edges: Array<{ node: { website: string } }>;
      pageInfo: {
        hasNextPage: boolean;
        endCursor: string | null;
      };
    };
  };
}

/**
 * 通过 Product Hunt GraphQL API 获取指定日期的所有产品 r/{id} 链接
 */
async function fetchProductUrls(
  year: number,
  month: number,
  day: number,
): Promise<string[]> {
  const postedAfter = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T00:00:00Z`;
  const postedBefore = `${year}-${String(month).padStart(2, "0")}-${String(day + 1).padStart(2, "0")}T00:00:00Z`;

  const allUrls: string[] = [];
  let cursor: string | null = null;
  const pageSize = 50;

  for (let page = 0; page < 100; page++) {
    const afterArg = cursor ? `, after: "${cursor}"` : "";
    const query = `
      query GetDailyPosts {
        posts(first: ${pageSize}, postedAfter: "${postedAfter}", postedBefore: "${postedBefore}", order: RANKING${afterArg}) {
          edges {
            node {
              ... on Post {
                website
              }
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    `;

    const response = await fetch(PH_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${PH_TOKEN}`,
      },
      body: JSON.stringify({ query }),
    });

    // 429 Too Many Requests：等待 5s 重试，最多 3 次
    if (response.status === 429) {
      console.warn(
        `GraphQL API rate limited (429) on page ${page + 1}, retrying in 5s...`,
      );
      await new Promise((r) => setTimeout(r, 5000));
      // 回退循环变量，重新请求当前页
      page--;
      continue;
    }

    if (!response.ok) {
      throw new Error(`GraphQL API responded with ${response.status}`);
    }

    const json: PostsResponse = (await response.json()) as PostsResponse;
    if (json.errors) {
      throw new Error(
        `GraphQL errors: ${json.errors.map((e) => e.message).join(", ")}`,
      );
    }

    const data = json.data?.posts;
    if (!data) break;

    for (const edge of data.edges) {
      // `website` 已经是 Product Hunt 的 /r/{token} 跳转链接（token 为字母数字，
      // 例如 r/U23MKZQPSZUKGY），不能用数字型的 node.id 拼接，否则跳转会失败。
      // 去掉 utm_* 跟踪参数，保留 path 中的 token 即可。
      const redirectUrl = edge.node.website?.split("?")[0];
      if (redirectUrl) allUrls.push(redirectUrl);
    }

    if (!data.pageInfo.hasNextPage) break;
    cursor = data.pageInfo.endCursor;
    // 每次翻页请求后等待 1s，避免频繁调用 API
    await new Promise((r) => setTimeout(r, 1000));
  }

  return allUrls;
}

export default defineContentScript({
  matches: ["https://www.producthunt.com/leaderboard/daily/*/*/*/*"],
  cssInjectionMode: "ui",
  runAt: "document_end",

  async main(ctx) {
    console.log("Content script is running on producthunt.");
    if (!(await scraperEnabled())) return;
    if (!(await isPurchasedOrTrial())) return;

    const urls: string[] = [];
    // 保存 scrapeAllProducts 中经 301 解析出的真实官网地址，供“重新打开”使用
    const resolvedUrls: string[] = [];

    // 从 URL 中提取年月日: /leaderboard/daily/2026/7/14/all
    const pathParts = location.pathname.split("/");
    const year = Number(pathParts[3]);
    const month = Number(pathParts[4]);
    const day = Number(pathParts[5]);

    // 创建持续显示的状态面板
    let statusPanel: HTMLDivElement | null = null;
    const statusPanelId = "producthunt-status-panel-" + Date.now();

    const createStatusPanel = () => {
      if (
        statusPanel &&
        statusPanel.parentNode &&
        document.body.contains(statusPanel)
      ) {
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
          console.log(
            "Status panel created and attached to body with ID:",
            statusPanelId,
          );

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
          setTimeout(addToBody, 100);
        }
      };

      addToBody();
      return panel;
    };

    const updateStatus = (
      status: string,
      itemCount: number,
      progress: string,
      extra = "",
    ) => {
      const panel = createStatusPanel();

      setTimeout(() => {
        if (!document.body.contains(panel)) {
          console.log(
            "Panel still not in DOM after creation, forcing re-add...",
          );
          document.body.appendChild(panel);
        }
      }, 50);

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

      panel.style.borderLeftColor = borderColor + " !important";

      const statusLabel =
        status === "running"
          ? "Fetching"
          : status === "paused"
            ? "Paused"
            : status === "completed"
              ? "Completed"
              : "Error";

      const reopenButton =
        status === "completed"
          ? `<button id="reopen-all-products-btn" style="margin-top: 12px; width: 100%; padding: 8px 12px; background: #2196F3; color: white; border: none; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; pointer-events: auto !important;">Reopen All products</button>`
          : "";

      panel.innerHTML = `
        <div style="display: flex; align-items: center; margin-bottom: 12px;">
          <span style="font-size: 24px; margin-right: 10px;">${icon}</span>
          <strong style="font-size: 16px; color: ${borderColor};">
            ${statusLabel}
          </strong>
        </div>
        <div style="font-size: 13px; color: #ccc; line-height: 1.6;">
          <div>📦 Collected: <strong style="color: white; font-size: 15px;">${itemCount}</strong> products</div>
          <div>📊 Progress: <strong style="color: white;">${progress}</strong></div>
          ${
            extra
              ? `<div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #444;">${extra}</div>`
              : ""
          }
        </div>
        ${reopenButton}
      `;

      if (status === "completed") {
        const reopenBtn = panel.querySelector(
          "#reopen-all-products-btn",
        ) as HTMLButtonElement | null;
        if (reopenBtn) {
          reopenBtn.onclick = () => {
            reopenAllProducts();
          };
        }
      }

      console.log(
        `Status updated: ${status}, items: ${itemCount}, progress: ${progress}`,
      );
    };

    const removeStatusPanel = () => {
      if (statusPanel && statusPanel.parentNode) {
        statusPanel.parentNode.removeChild(statusPanel);
        statusPanel = null;
        console.log("Status panel removed");
      }
    };

    const openAllProductTabs = async (
      label: string,
      targetUrls: string[] = urls,
    ) => {
      updateStatus("running", targetUrls.length, "100%", `🔄 ${label}...`);

      let openedCount = 0;
      for (const url of targetUrls) {
        await sendMessage(Message.SCRAPE_EMAILS, url);
        openedCount++;

        updateStatus(
          "running",
          targetUrls.length,
          "100%",
          `🔄 ${label}...<br>📂 Opened: ${openedCount}/${targetUrls.length}`,
        );

        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      console.log(`All ${targetUrls.length} tabs have been opened.`);

      updateStatus(
        "completed",
        targetUrls.length,
        "100%",
        `✅ Completed!<br>📂 Opened: ${openedCount}/${targetUrls.length} pages`,
      );
    };

    // 抓取所有产品的邮件：
    // - RESOLVE_REDIRECT 串行（每 2s 一个），避免频繁打 Product Hunt 触发 Cloudflare 拦截
    // - SCRAPE_EMAILS 最多 5 个并行抓取，不阻塞解析流程
    const scrapeAllProducts = async () => {
      updateStatus("running", urls.length, "0%", "Scraping emails...");

      const RESOLVE_INTERVAL_MS = 2000;
      const SCRAPE_CONCURRENCY = 5;
      let resolved = 0;
      let scraped = 0;

      // 解析成功后的真实网址队列，由 worker 消费
      const scrapeQueue: string[] = [];
      let queueDone = false;

      // 启动抓取 worker 池
      const scrapeWorker = async () => {
        while (true) {
          const targetUrl = scrapeQueue.shift();
          if (!targetUrl) {
            if (queueDone) break;
            await new Promise((r) => setTimeout(r, 100));
            continue;
          }
          try {
            await sendMessage(Message.SCRAPE_EMAILS, targetUrl);
          } catch (error) {
            console.error(`Error scraping ${targetUrl}:`, error);
          }
          scraped++;
          updateStatus(
            "running",
            urls.length,
            "100%",
            `🔄 Scraping emails...<br>📧 Resolved: ${resolved}/${urls.length}<br>📨 Scraped: ${scraped}/${urls.length}`,
          );
        }
      };
      const workers = Array.from({ length: SCRAPE_CONCURRENCY }, () =>
        scrapeWorker(),
      );

      // 串行解析，每 2s 一个
      for (const url of urls) {
        try {
          await new Promise((r) => setTimeout(r, RESOLVE_INTERVAL_MS));
          const finalUrl = await sendMessage(Message.RESOLVE_REDIRECT, url);
          if (finalUrl) {
            resolvedUrls.push(finalUrl);
            scrapeQueue.push(finalUrl);
          } else {
            // 解析失败：兜底只打开标签页，不抓取、也不记入 resolvedUrls
            await sendMessage(Message.OPEN_TAB, url);
          }
        } catch (error) {
          console.error(`Error resolving ${url}:`, error);
        }
        resolved++;
        updateStatus(
          "running",
          urls.length,
          "100%",
          `🔄 Resolving URLs...<br>📧 Resolved: ${resolved}/${urls.length}`,
        );
      }

      // 解析全部完成，通知 worker 结束
      queueDone = true;
      await Promise.all(workers);

      console.log(`Scraped emails for ${urls.length} products.`);

      updateStatus(
        "completed",
        urls.length,
        "100%",
        `✅ Completed!<br>📂 Opened: ${resolved}/${urls.length} pages`,
      );
    };

    // 重新打开所有产品页面：优先打开 301 解析出的真实官网地址，
    // 若尚未抓取（resolvedUrls 为空）则退回原始 website 链接，不重新抓取。
    const reopenAllProducts = async () => {
      const urlsToReopen = resolvedUrls.length > 0 ? resolvedUrls : urls;
      await openAllProductTabs("Reopening product pages", urlsToReopen);
    };

    // ====== 主流程：通过 API 获取产品 URL ======
    updateStatus("running", 0, "0%", "Fetching product list via API...");

    let fetchedUrls: string[];
    try {
      fetchedUrls = await fetchProductUrls(year, month, day);
    } catch (error) {
      console.error("Failed to fetch products from API:", error);
      updateStatus(
        "error",
        0,
        "0%",
        `❌ API error: ${error instanceof Error ? error.message : String(error)}`,
      );
      return;
    }

    // 直接使用 API 返回的 URL
    for (const url of fetchedUrls) {
      urls.push(url);
    }

    console.log(
      `API returned ${urls.length} products for ${year}/${month}/${day}`,
    );

    if (urls.length === 0) {
      updateStatus("error", 0, "0%", "No products found for this date");
      return;
    }

    // 先抓取邮件（r/{id} 会自动 301 跳转到产品官网）
    await scrapeAllProducts();
  },
});
