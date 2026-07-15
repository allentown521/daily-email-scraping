import { StorageKey, getStorage } from "@/lib/storage";
import { betterAuth } from "@/lib/supabase";
import { changeLog } from "@/utils/notify";
import { scrapeEmails } from "~/lib/email-scraper";
import { Message, onMessage } from "~/lib/messaging";
import { browser, defineBackground, storage } from "#imports";

const main = () => {
  console.log(
    "Background service worker is running! Edit `src/app/background` and save to reload.",
  );

  // Enable side panel to open on toolbar icon click
  if (chrome.sidePanel) {
    chrome.sidePanel
      .setPanelBehavior({ openPanelOnActionClick: true })
      .catch(console.error);
  }
};

onMessage(Message.USER, () => {
  const storage = getStorage(StorageKey.USER);
  return storage.getValue();
});

onMessage(Message.AUTH_SUCCESS, (meessage) => {
  const intervalId = setInterval(async () => {
    const { data: session, error } = await betterAuth.getSession();
    if (!error && session?.user) {
      clearInterval(intervalId);

      // 查询当前扩展打开的options.html页面
      const optionsPages = await browser.tabs.query({
        url: browser.runtime.getURL("/options.html"),
      });

      // 如果找到页面则更新，否则创建新页面
      if (optionsPages.length > 0 && optionsPages[0]?.id) {
        await browser.tabs.update(optionsPages[0].id, {
          url: "options.html",
          active: true,
        });
      } else {
        await browser.tabs.create({
          url: "options.html",
          active: true,
        });
      }

      browser.tabs.remove(meessage.data);
    }
  }, 3000);
});

browser.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name.startsWith("closeTab_")) {
    const tabId = Number.parseInt(alarm.name.split("_")[1] || "");
    if (tabId && !Number.isNaN(tabId)) {
      browser.tabs.remove(tabId);
    }
  }
});

browser.runtime.onInstalled.addListener(async ({ reason }) => {
  // new install
  if (reason === "install") {
    if (!(await storage.getItem("sync:hasInstructionsShown"))) {
      browser.tabs.create({
        url: browser.runtime.getURL("/help.html"),
        active: true,
      });
      storage.setItem("sync:hasInstructionsShown", true);
    }
  } else if (reason === "update") {
    const newVersion = chrome.runtime.getManifest().version;

    if (newVersion === changeLog.notifyVersion) {
      chrome.notifications.create(`update_${newVersion}`, {
        type: "basic",
        iconUrl: chrome.runtime.getURL("icons/128.png"), // wit 构建时通过icon.png生成的
        title: "Product Hunt Email Scraper ChangeLog",
        message: changeLog.changeLog.join("\n"),
      });
    }

    console.log("extension updated");
  }
});

onMessage(Message.OPEN_TAB, (meessage) => {
  browser.tabs.create({ url: meessage.data, active: false }).then((tab) => {
    const alarmName = `closeTab_${tab.id}`;
    browser.alarms.create(alarmName, { delayInMinutes: 2 });
  });
});

onMessage(Message.OPEN_TAB_AND_RETURN, async () => {
  // 获取当前活跃标签页
  const [currentTab] = await browser.tabs.query({
    active: true,
    currentWindow: true,
  });
  if (currentTab?.id) {
    // 等待一段时间后返回原标签页（假设页面已经跳转）
    setTimeout(() => {
      browser.tabs.update(currentTab.id, { active: true });
    }, 3000);
  }
  return null;
});

onMessage(Message.RESOLVE_REDIRECT, async (message) => {
  const MAX_RETRIES = 3;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      // 在后台打开链接，让浏览器自动完成跳转，
      // 返回跳转后的最终 URL（例如 Product Hunt 的 /r/{token} → 产品官网）。
      const tab = await browser.tabs.create({
        url: message.data,
        active: false,
      });
      if (!tab.id) {
        if (attempt < MAX_RETRIES) {
          await new Promise((r) => setTimeout(r, 1000));
        }
        continue;
      }

      const tabId = tab.id;
      const finalUrl = await new Promise<string | null>((resolve) => {
        let settled = false;
        const finish = (url: string | null) => {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          browser.tabs.onUpdated.removeListener(listener);
          browser.tabs.remove(tabId).catch(() => {});
          resolve(url);
        };

        // Product Hunt 的 /r/{token} 由 Cloudflare 保护：标签页会先停在
        // producthunt.com/r/... 的中转页上，随后才真正跳转到外部官网。
        // 因此必须以"URL 真正离开 producthunt.com/r/"作为完成条件，
        // 而不能在第一次 status=complete（仍是 PH 中转页）时就取值，否则
        // 拿到的是 PH 中转页地址，SCRAPE_EMAILS 用 fetch 直接 403，抓不到邮件。
        // 没真正跳转成功就返回 null，让 content script 退回原始 /r/ 链接、
        // 走 email-scraper 自带的浏览器标签兜底逻辑。
        const isResolved = (u?: string | null) =>
          !!u && !u.startsWith("https://www.producthunt.com/r/");

        const timeout = setTimeout(() => finish(null), 25000);

        const listener = (
          tid: number,
          changeInfo: { status?: string; url?: string },
        ) => {
          if (tid !== tabId) return;

          // 优先用 URL 变化事件判断（跳转发生时 url 会变）
          if (changeInfo.url) {
            if (isResolved(changeInfo.url)) finish(changeInfo.url);
            return;
          }

          // 否则在 complete 时读取当前真实地址再判断
          if (changeInfo.status === "complete") {
            browser.tabs
              .get(tabId)
              .then((t) => t?.url)
              .catch(() => undefined)
              .then((u) => {
                if (isResolved(u)) finish(u ?? null);
              });
          }
        };

        browser.tabs.onUpdated.addListener(listener);
      });

      // 返回非空结果或耗尽重试次数才退出循环
      if (finalUrl) return finalUrl;
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    } catch (error) {
      console.error(
        `Error resolving redirect (attempt ${attempt}/${MAX_RETRIES}):`,
        error,
      );
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  }

  return null;
});

onMessage(Message.SCRAPE_EMAILS, async (message) => {
  try {
    const emails = await scrapeEmails(message.data);

    // Store emails in local storage with deduplication
    const emailStorage = getStorage(StorageKey.COLLECTED_EMAILS);
    const existingEmails = await emailStorage.getValue();

    // Create a set of existing emails for deduplication
    const existingEmailSet = new Set(
      (existingEmails || []).map((e) => e.email.toLowerCase()),
    );

    const allCollectedEmails = [...(existingEmails || [])];

    for (const email of emails) {
      const normalizedEmail = email.email.toLowerCase();
      if (!existingEmailSet.has(normalizedEmail)) {
        existingEmailSet.add(normalizedEmail);
        allCollectedEmails.push(email);
      }
    }

    await emailStorage.setValue(allCollectedEmails);
    return emails;
  } catch (error) {
    console.error("Error scraping emails:", error);
    return [];
  }
});

onMessage(Message.FETCH_EMAILS_FROM_URLS, async (message) => {
  try {
    const urls: string[] = message.data;
    const emailStorage = getStorage(StorageKey.COLLECTED_EMAILS);
    const existingEmails = await emailStorage.getValue();

    // Create a set of existing emails for deduplication
    const existingEmailSet = new Set(
      (existingEmails || []).map((e) => e.email.toLowerCase()),
    );

    const allCollectedEmails = [...(existingEmails || [])];
    let processedCount = 0;

    for (const url of urls) {
      try {
        const emails = await scrapeEmails(url);

        for (const email of emails) {
          const normalizedEmail = email.email.toLowerCase();
          if (!existingEmailSet.has(normalizedEmail)) {
            existingEmailSet.add(normalizedEmail);
            allCollectedEmails.push(email);
          }
        }

        processedCount++;

        // Report progress back to content script
        await browser.runtime.sendMessage({
          type: Message.EMAIL_PROCESSING_PROGRESS,
          data: {
            processed: processedCount,
            total: urls.length,
          },
        });
      } catch (error) {
        console.error(`Error scraping ${url}:`, error);
      }
    }

    // Save deduplicated emails
    await emailStorage.setValue(allCollectedEmails);

    return {
      emails: allCollectedEmails,
      processed: processedCount,
    };
  } catch (error) {
    console.error("Error fetching emails from URLs:", error);
    return { emails: [], processed: 0 };
  }
});

export default defineBackground(main);
