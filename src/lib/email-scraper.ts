import { StorageKey, getStorage } from "~/lib/storage";

export interface ScrapedEmail {
  email: string;
  // 站点/产品名：优先 og:site_name，其次 <title> 中提取的品牌片段，最后退化到域名主标签
  name: string;
  foundOn: string;
  timestamp: number;
  source:
    | "mailto"
    | "text-regex"
    | "contact-page"
    | "about-page"
    | "team-page"
    | "support-page"
    | "help-page"
    | "privacy-page";
}

interface CandidateLink {
  url: string;
  score: number;
  type: string;
}

const EMAIL_REGEX = /\b[a-zA-Z0-9._+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g;
const MAILTO_REGEX = /mailto:([^"'?\s>]+)/gi;
const TEST_DOMAINS = new Set([
  "example.com",
  "example.org",
  "example.net",
  "email.com",
  "work.com",
  "company.com",
  "test.com",
  "testing.com",
  "demo.com",
  "localhost.com",
  "test.net",
  "test.org",
  "sample.com",
  "temp.com",
  "dummy.com",
  "fake.com",
  "invalid.com",
  "test.co.uk",
  "example.co.uk",
  "mail.com",
  "stripe.com",
  "supabase.com",
  "producthunt.com",
  "n8n.io",
  "google.com",
  "vercel.com",
  "your-domain.com",
  "domain.com",
  "zohomarketplace.com",
  "frogybit.io",
  "fiverr.com",
  "microsoft.com",
  "github.com",
  "slack.com",
  "lovable.dev",
  "setapp.com",
  "creem.io",
  "cloudflare.com",
  "finalizo.com",
  "nebulacraftdesign.com",
  "anthropic.com",
  "manus.ai",
  "yourcompany.com",
  "apple.com",
  "perco.app",
  "resend.com",
  "thingstohave.app",
  "dodopayments.com",
  "gomailmerge.com",
  "luneyapp.com",
  "recounts.net",
  "datatilsynet.dk",
  "duck.com",
  "figma.com",
  "upstash.com",
  "mintlify.com",
  "prisma.io",
  "bitwarden.com",
  "netcup.com",
]);

const EMAIL_PREFIX_BLOCKLIST = new Set([
  "suffix",
  "private",
  "privacy",
  "example",
  "legal",
  "security",
  "refund",
  "noreply",
  "no-reply",
  "donotreply",
  "do-not-reply",
  "postmaster",
  "abuse",
  "webmaster",
  "billing",
  "invoice",
  "finance",
  "compliance",
  "refunds",
  "purchasing",
]);

const INCLUDE_TEST_DOMAINS = new Set([
  "sentry.wixpress.com",
  "sentry.io",
  "atlassian.net",
  "facebook.com",
]);

const FILE_EXTENSIONS = new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "bmp",
  "svg",
  "webp",
  "ico",
  "pdf",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "ppt",
  "pptx",
  "zip",
  "rar",
  "7z",
  "tar",
  "gz",
  "exe",
  "dmg",
  "apk",
  "mp3",
  "mp4",
  "avi",
  "mov",
  "mkv",
  "wav",
  "flac",
  "js",
  "ts",
  "jsx",
  "tsx",
  "py",
  "java",
  "go",
  "rs",
  "html",
  "css",
  "json",
  "xml",
  "yaml",
  "toml",
  "ini",
  "avif",
]);
const OBFUSCATION_PATTERNS = [
  { pattern: /\[at\]/gi, replacement: "@" },
  { pattern: /\(at\)/gi, replacement: "@" },
  { pattern: /\s+at\s+/gi, replacement: "@" },
  { pattern: /\[dot\]/gi, replacement: "." },
  { pattern: /\(dot\)/gi, replacement: "." },
  { pattern: /\s+dot\s+/gi, replacement: "." },
];

// 路径边界：/ - _ 之后、常见页面后缀（.html/.php/.aspx 等）、或路径结尾。
// 加后缀支持是因为 /contact.html、/contact.php 这类路径以前完全匹配不上。
const PATH_SEP = String.raw`(?:[\/\-_]|\.(?:html?|htm|php|aspx?|jsp|do)$|$)`;

const CANDIDATE_PATTERNS: Record<string, { pattern: RegExp; score: number }> = {
  contact: {
    pattern: new RegExp(String.raw`\/contact${PATH_SEP}`, "i"),
    score: 100,
  },
  "contact-us": { pattern: /\/contact[-_]?us/i, score: 95 },
  // 欧陆语言站点的联系页：德/意/西/葡语
  "multi-lang": {
    pattern: new RegExp(
      String.raw`\/(?:kontakt|contatt[oi]|contact[ao](?:nos)?|nous-contacter)${PATH_SEP}`,
      "i",
    ),
    score: 90,
  },
  support: {
    pattern: new RegExp(String.raw`\/support${PATH_SEP}`, "i"),
    score: 88,
  },
  "get-in-touch": {
    pattern: new RegExp(String.raw`\/get[-_]?in[-_]?touch${PATH_SEP}`, "i"),
    score: 85,
  },
  about: {
    pattern: new RegExp(String.raw`\/about${PATH_SEP}`, "i"),
    score: 85,
  },
  "about-us": { pattern: /\/about[-_]?us/i, score: 80 },
  privacy: {
    pattern: new RegExp(String.raw`\/privacy${PATH_SEP}`, "i"),
    score: 75,
  },
  terms: {
    pattern: new RegExp(String.raw`\/terms${PATH_SEP}`, "i"),
    score: 75,
  },
  help: { pattern: new RegExp(String.raw`\/help${PATH_SEP}`, "i"), score: 65 },
  legal: {
    pattern: new RegExp(String.raw`\/legal${PATH_SEP}`, "i"),
    score: 45,
  },
  impressum: {
    pattern: new RegExp(String.raw`\/impressum${PATH_SEP}`, "i"),
    score: 45,
  },
  imprint: {
    pattern: new RegExp(String.raw`\/imprint${PATH_SEP}`, "i"),
    score: 45,
  },
  team: { pattern: new RegExp(String.raw`\/team${PATH_SEP}`, "i"), score: 30 },
};

// 锚文本（链接文字）兜底：很多站点的联系页路径里没有 contact
// （如 /company、/hello、/connect），但链接文字写着 "Contact"，按路径会漏掉。
const ANCHOR_PATTERNS: { pattern: RegExp; score: number; type: string }[] = [
  { pattern: /^contact(?: us)?$/i, score: 88, type: "contact" },
  { pattern: /^get in touch$/i, score: 85, type: "get-in-touch" },
  { pattern: /^(?:e-?mail|mail|write)(?: us)?$/i, score: 85, type: "contact" },
  { pattern: /^support$/i, score: 70, type: "support" },
  { pattern: /^about(?: us)?$/i, score: 65, type: "about" },
  { pattern: /^help$/i, score: 50, type: "help" },
  { pattern: /^(?:our )?team$/i, score: 45, type: "team" },
];

// 判断 fetch 拿到的内容是否需要升级为浏览器渲染。
// 以空壳特征（SPA 挂载点）为主，长度只用来兜住空响应/错误页——
// 阈值定得低是为了不误伤 3-5KB 的精简静态页（如手写 contact.html）。
const SKELETON_MIN_LENGTH = 2000;

function isSkeleton(html: string): boolean {
  const skeletonSignals = [
    /<div\s+id=["']root["']\s*><\/div>/,
    /<div\s+id=["']app["']\s*><\/div>/,
  ];
  return (
    html.length < 10000 || skeletonSignals.some((signal) => signal.test(html))
  );
}

export async function fetchWithBrowserTab(url: string): Promise<string> {
  try {
    const { browser } = await import("wxt/browser");
    const tab = await browser.tabs.create({ url, active: false });
    if (!tab.id) throw new Error("Failed to create tab");

    const tabId = tab.id;
    return new Promise<string>((resolve) => {
      let settled = false;
      const timeout = setTimeout(() => finish(""), 15000);

      // 唯一出口：成功、异常、超时都必须移除 listener。
      // 原实现里超时分支只删了 tab，listener 会一直挂在 service worker 上，
      // 批量跑上千个站会累积成上千个监听器，越到后面越慢。
      function finish(html: string) {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        browser.tabs.onUpdated.removeListener(listener);
        browser.tabs.remove(tabId).catch(() => {});
        resolve(html);
      }

      async function listener(tid: number, changeInfo: { status?: string }) {
        if (tid !== tabId || changeInfo.status !== "complete") return;
        try {
          const results = await browser.scripting.executeScript({
            target: { tabId },
            func: () => document.documentElement.outerHTML,
          });
          finish((results?.[0]?.result as string) || "");
        } catch (error) {
          console.error("Failed to get HTML:", error);
          finish("");
        }
      }

      browser.tabs.onUpdated.addListener(listener);
    });
  } catch (error) {
    console.error("Error fetching with browser tab:", error);
    return "";
  }
}

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.5",
  "Accept-Encoding": "gzip, deflate",
  DNT: "1",
  Connection: "keep-alive",
  "Upgrade-Insecure-Requests": "1",
};

interface FetchResult {
  html: string;
  // 是否已尝试过浏览器渲染兜底（无论成败），用于避免上层重复开 tab
  browserTried: boolean;
  // 底层 HTTP 状态码（网络异常时为 0），用于决定是否写入页面缓存
  status: number;
}

async function attemptFetch(
  url: string,
  timeoutMs: number,
): Promise<FetchResult> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: HEADERS,
      // 绕过 HTTP 缓存直连服务器拉全量最新内容：缓存协商（304）回填的
      // 副本可能过期或不完整。批量抓取一次性读取，内容完整性优先于流量。
      cache: "reload",
    });
    clearTimeout(id);

    // 资源不存在：浏览器渲染同样拿不到内容，直接放弃，省去一次 tab 开销。
    // （失效的候选链接很常见，否则每个都要白等一次浏览器渲染）
    if (response.status === 404 || response.status === 410) {
      return { html: "", browserTried: false, status: response.status };
    }

    // 其余状态码不拦截（304 的 body 为空、403/429 反爬常返回错误页），
    // 统一交给下方 isSkeleton 判断——空/过小内容自动升级为浏览器渲染兜底
    const html = await response.text();
    if (isSkeleton(html)) {
      const browserHtml = await fetchWithBrowserTab(url);
      if (browserHtml)
        return { html: browserHtml, browserTried: true, status: 200 };
      // tab 也拿不到内容：标记已尝试过，避免上层重复开 tab；
      // 保留原骨架 html——SPA 的骨架里可能仍有可提取的导航链接
      return { html, browserTried: true, status: 200 };
    }
    return { html, browserTried: false, status: 200 };
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

// 网络异常重试：最多重试 3 次，间隔分别是 1s / 2s / 3s（即最多 4 次请求）。
// 只对「抛出异常」的失败生效（超时、DNS 失败、连接重置、TLS 中断）——
// 这类网络层问题有概率在下一次尝试里自愈；404 之类的正常响应不会重试。
const RETRY_DELAYS_MS = [500, 1000, 2000];

async function fetchWithTimeout(
  url: string,
  timeout = 20000,
): Promise<FetchResult> {
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      return await attemptFetch(url, timeout);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      const delay = RETRY_DELAYS_MS[attempt];

      // 重试次数用尽
      if (delay === undefined) {
        console.error(
          `Failed to fetch ${url} after ${RETRY_DELAYS_MS.length} retries:`,
          errorMsg,
        );
        return { html: "", browserTried: false, status: 0 };
      }

      console.warn(
        `Failed to fetch ${url} (attempt ${attempt + 1}/${RETRY_DELAYS_MS.length + 1}): ${errorMsg}, retrying in ${delay}ms...`,
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  return { html: "", browserTried: false, status: 0 };
}

function normalizeEmail(email: string): string {
  let normalized = email.toLowerCase().trim();

  // 解码脏字符：JS/JSON 的 \uXXXX 转义（\u003e => >）与 HTML 实体（&gt; / &#62; / &#x3e; 等），
  // 否则它们会作为前缀混进邮箱（如 \u003esupport@x.com）。解码后交给下方首尾去特殊字符规则剥掉。
  normalized = normalized
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, h) =>
      String.fromCharCode(Number.parseInt(h, 16)),
    )
    .replace(/&(#x?[0-9a-fA-F]+|amp|lt|gt|quot|apos);/gi, (entity) => {
      const named: Record<string, string> = {
        "&amp;": "&",
        "&lt;": "<",
        "&gt;": ">",
        "&quot;": '"',
        "&apos;": "'",
      };
      const lower = entity.toLowerCase();
      if (named[lower]) return named[lower];
      const num = /^&#(x?)([0-9a-fA-F]+);$/.exec(lower);
      if (num) {
        const code = Number.parseInt(num[2] ?? "", num[1] ? 16 : 10);
        return Number.isFinite(code) && code > 0 && code <= 0x10ffff
          ? String.fromCodePoint(code)
          : entity;
      }
      return entity;
    })
    // URL 编码的 @（mailto 链接常被写成 support%40x.com），还原成 @ 以免漏抓
    .replace(/%40/gi, "@")
    // 部分站点把 ">" 转义成裸 u003e（无反斜杠）粘在邮箱前，如 u003esupport@x.com
    .replace(/^(?:u003e)+/i, "");

  // Remove trailing/leading special characters
  normalized = normalized.replace(/^[^a-z0-9]+|[^a-z0-9]+$/gi, "");

  // Apply obfuscation patterns
  for (const { pattern, replacement } of OBFUSCATION_PATTERNS) {
    normalized = normalized.replace(pattern, replacement);
  }

  return normalized;
}

function validateEmail(email: string): boolean {
  const normalized = normalizeEmail(email);
  const emailRegex =
    /^[a-zA-Z0-9][a-zA-Z0-9._+-]*@[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;

  if (
    !emailRegex.test(normalized) ||
    normalized.length >= 255 ||
    normalized.includes("..")
  ) {
    return false;
  }

  const domain = normalized.split("@")[1]?.toLowerCase();
  if (!domain) return false;

  // Filter out blocked email prefixes (local part before @)
  const localPart = normalized.split("@")[0]?.toLowerCase();
  if (localPart && EMAIL_PREFIX_BLOCKLIST.has(localPart)) {
    return false;
  }

  // Filter out test domains
  if (
    TEST_DOMAINS.has(domain) ||
    [...INCLUDE_TEST_DOMAINS].some((item) => domain.includes(item))
  ) {
    return false;
  }

  // Filter out file extensions (e.g., @1x.png, @icon.svg)
  const topLevelDomain = domain.split(".").pop();
  if (topLevelDomain && FILE_EXTENSIONS.has(topLevelDomain)) {
    return false;
  }

  return true;
}

function extractEmailsFromText(text: string): string[] {
  const emails = new Set<string>();

  // Extract from mailto links
  const mailtoRegex = /mailto:([^"'?\s>]+)/gi;
  const mailtoMatches = text.matchAll(mailtoRegex);
  for (const match of mailtoMatches) {
    const email = normalizeEmail(match[1] || "");
    if (validateEmail(email)) {
      emails.add(email);
    }
  }

  // Extract from text regex
  const textMatches = text.match(EMAIL_REGEX) || [];
  for (const emailMatch of textMatches) {
    const email = normalizeEmail(emailMatch);
    if (validateEmail(email)) {
      emails.add(email);
    }
  }

  return Array.from(emails);
}

export { extractEmailsFromText, normalizeEmail, validateEmail };

// ---------- Reacher 校验结果缓存 ----------
// 后台是 service worker，进程会被浏览器回收重启，所以缓存只放扩展存储：
// email -> { reachable, reasons, cachedAt }，有效期 1 天。
// 只缓存「通过校验」的邮箱：校验不通过的不入缓存，下次遇到会重新请求 API。
// 注：字段名沿用旧缓存 "reachable"，其语义是「通过清洗规则、应入库发送」。
const REACHER_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 1 天

export interface ReacherCacheEntry {
  reachable: boolean;
  // 命中的丢弃原因，保留时为空数组
  reasons: string[];
  // 首条 MX 记录（JSON 字符串），缓存命中时一并打印，便于排查投递域
  firstMx?: string;
  cachedAt: number;
}

export type ReacherCacheMap = Record<string, ReacherCacheEntry>;

// Reacher API 返回的校验结果（只取清洗策略用到的字段）
interface ReacherResponse {
  is_reachable?: string;
  syntax?: { is_valid_syntax?: boolean };
  mx?: {
    accepts_mail?: boolean;
    // Reacher 返回的 MX 记录列表，每条含 exchange/priority 等，便于排查投递域
    records?: Array<{ exchange?: string; priority?: number; [key: string]: unknown }>;
  };
  smtp?: {
    is_deliverable?: boolean;
    is_disabled?: boolean;
    has_full_inbox?: boolean;
    is_catch_all?: boolean;
  };
  misc?: {
    is_disposable?: boolean;
    is_role_account?: boolean;
  };
}

const reacherCacheItem = getStorage(StorageKey.REACHER_CACHE);

// 读缓存只做加速，任何异常/脏数据都按「未命中」处理，绝不能影响校验结果：
// 缓存不可用时照常请求 API。
async function readReacherCache(
  email: string,
): Promise<ReacherCacheEntry | null> {
  try {
    const entry = (await reacherCacheItem.getValue())?.[email];
    if (
      !entry ||
      typeof entry.reachable !== "boolean" ||
      typeof entry.cachedAt !== "number" ||
      !Array.isArray(entry.reasons)
    ) {
      return null;
    }
    if (Date.now() - entry.cachedAt >= REACHER_CACHE_TTL_MS) return null;
    return entry;
  } catch (error) {
    console.warn("[verifyEmail] Cache read failed, fallback to API:", error);
    return null;
  }
}

async function writeReacherCache(
  email: string,
  reachable: boolean,
  reasons: string[],
  firstMx?: string,
): Promise<void> {
  try {
    const now = Date.now();
    const cache: ReacherCacheMap = {};
    // 顺手清掉过期项，避免缓存无限膨胀
    for (const [key, value] of Object.entries(
      (await reacherCacheItem.getValue()) ?? {},
    )) {
      if (now - value.cachedAt < REACHER_CACHE_TTL_MS) cache[key] = value;
    }
    cache[email] = { reachable, reasons, firstMx, cachedAt: now };
    await reacherCacheItem.setValue(cache);
  } catch (error) {
    console.error("[verifyEmail] Failed to persist cache:", error);
  }
}

// ---------- 网页抓取结果缓存（按 URL 单键，存「解析结果」而非原始 HTML）----------
// 后台是 service worker，进程会被浏览器回收重启，所以缓存只放扩展存储。
// 每个 URL 一个独立 key（local:page_cache_v1:<归一化URL>），好处：
//   1) O(单条) 读写，不像单 key 大 JSON 那样每次都反序列化全量；
//   2) 存的是「解析结果」{ emails, candidates, name, browserTried, status, cachedAt }，
//      体积只有几百字节（原始 HTML 常达上百 KB），5k 请求/天 × 3 天也才几 MB，
//      在 10MB 的 storage.local 配额内稳稳放下。
// 只缓存 HTTP 200 的成功抓取（无论是否匹配到邮箱）；请求失败的 URL 不入库，
// 下次重跑会重新请求。读/写任何异常都按「未命中/跳过」处理，绝不影响抓取正确性。
const PAGE_CACHE_TTL_MS = 3 * 24 * 60 * 60 * 1000; // 3 天
const PAGE_CACHE_PREFIX = "local:page_cache_v1:";

export interface PageCacheEntry {
  // 该 URL 上直接提取到的邮箱（含 mailto/text）
  emails: string[];
  // 仅首页：从该页发现的候选链接（contact/about/team…），用于跳过重新解析 HTML
  candidates: string[];
  // 该页解析出的产品/站点名（首页才有意义）
  name: string;
  // 是否已尝试过浏览器渲染兜底，避免缓存命中后重复开 tab
  browserTried: boolean;
  status: number;
  cachedAt: number;
}

// 把 URL 归一化成一个稳定的缓存键：小写 scheme+host、去尾部斜杠、去 fragment。
// 让「同一页面」在多次运行的抓取里命中同一条缓存。
function normalizeUrlKey(rawUrl: string): string {
  try {
    const u = new URL(rawUrl);
    const host = u.hostname.toLowerCase();
    let path = u.pathname;
    if (path.length > 1) path = path.replace(/\/+$/, "");
    return `${u.protocol.toLowerCase()}//${host}${path}${u.search}`;
  } catch {
    return rawUrl.trim().toLowerCase();
  }
}

function pageCacheStorageKey(url: string): string {
  return PAGE_CACHE_PREFIX + normalizeUrlKey(url);
}

// 读缓存只做加速：任何异常/脏数据/过期都按「未命中」处理，回落到真实请求。
async function readPageCache(url: string): Promise<PageCacheEntry | null> {
  try {
    const { browser } = await import("wxt/browser");
    const key = pageCacheStorageKey(url);
    const result = await browser.storage.local.get(key);
    const entry = (result as Record<string, PageCacheEntry>)[key];
    if (
      !entry ||
      !Array.isArray(entry.emails) ||
      !Array.isArray(entry.candidates) ||
      typeof entry.cachedAt !== "number"
    ) {
      return null;
    }
    if (Date.now() - entry.cachedAt >= PAGE_CACHE_TTL_MS) return null;
    return entry;
  } catch (error) {
    console.warn("[pageCache] Read failed, fallback to fetch:", error);
    return null;
  }
}

// 只缓存 HTTP 200 的成功抓取；非 200 / 异常都不落盘，下次重跑会重新请求。
async function writePageCache(
  url: string,
  data: Omit<PageCacheEntry, "cachedAt">,
): Promise<void> {
  if (data.status !== 200) return;
  try {
    const { browser } = await import("wxt/browser");
    const key = pageCacheStorageKey(url);
    const entry: PageCacheEntry = { ...data, cachedAt: Date.now() };
    await browser.storage.local.set({ [key]: entry });
  } catch (error) {
    // 配额超限等写入失败不应影响抓取，仅记录
    console.error("[pageCache] Failed to persist cache:", error);
  }
}

// 清空全部页面缓存：按前缀批量删除（供 UI 的 Clear Page Cache 按钮调用）。
export async function clearPageCache(): Promise<void> {
  try {
    const { browser } = await import("wxt/browser");
    const all = await browser.storage.local.get();
    const keys = Object.keys(all).filter((k) =>
      k.startsWith(PAGE_CACHE_PREFIX),
    );
    if (keys.length > 0) await browser.storage.local.remove(keys);
  } catch (error) {
    console.error("[pageCache] Failed to clear cache:", error);
  }
}

/**
 * 根据 Reacher 校验结果判断邮箱是否应入库发送。
 * 命中「丢弃条件」任意一项即剔除；其余一律保留（包括 safe、角色公共邮箱）。
 * catch-all（全域接收）属于无法确认真实收件人，按无效处理、不入库。
 * 只在拿到 API 有效响应时写缓存，缓存只加速、不影响结果。
 * @returns keep 是否保留；reasons 命中的丢弃原因（为空表示保留）
 */
function evaluateEmail(data: ReacherResponse): {
  keep: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];
  if (data.is_reachable === "invalid")
    reasons.push(`is_reachable=${data.is_reachable}`);
  if (data.syntax?.is_valid_syntax === false)
    reasons.push("syntax.is_valid_syntax=false");
  if (data.mx?.accepts_mail === false) reasons.push("mx.accepts_mail=false");
  if (data.smtp?.is_deliverable === false)
    reasons.push("smtp.is_deliverable=false");
  if (data.smtp?.is_disabled === true) reasons.push("smtp.is_disabled=true");
  if (data.smtp?.has_full_inbox === true)
    reasons.push("smtp.has_full_inbox=true");
  // 全域接收：不能确认真实收件人，视为无效
  // if (data.smtp?.is_catch_all === true) reasons.push("smtp.is_catch_all=true");
  if (data.misc?.is_disposable === true)
    reasons.push("misc.is_disposable=true");
  return { keep: reasons.length === 0, reasons };
}

// ---------- 验证节流（仅作用于真实的 Reacher API 请求）----------
// 两次真实请求之间加延时：跨域名 0.5~1s 随机，同域名（被验证邮箱的域名）3~5s 随机，
// 带抖动。缓存命中（未打 API）不加延时，否则重跑会无谓变慢。
let lastVerifyDomain: string | null = null;
let lastVerifyRequestAt = 0;

// 轻量互斥锁：串行化「读状态→sleep→写状态」，避免多个产品并行抓取时
// 并发的 verifyEmail 竞争共享的 lastVerify* 状态，导致同域名间隔失效。
let throttleLocked = false;
const throttleWaiters: (() => void)[] = [];

async function withThrottleLock<T>(fn: () => Promise<T>): Promise<T> {
  while (throttleLocked) {
    await new Promise<void>((resolve) => throttleWaiters.push(resolve));
  }
  throttleLocked = true;
  try {
    return await fn();
  } finally {
    throttleLocked = false;
    const next = throttleWaiters.shift();
    if (next) next();
  }
}

// 取被验证邮箱的域名（@ 之后部分），用于「同域名」判定
function getEmailDomainForThrottle(email: string): string {
  const at = email.lastIndexOf("@");
  return at >= 0 ? email.slice(at + 1).trim().toLowerCase() : "";
}

function randomIntInRange(min: number, max: number): number {
  return Math.floor(min + Math.random() * (max - min));
}

// 在真正发起 Reacher 请求前调用：按与上次请求的域名关系计算并等待间隔
async function applyVerifyThrottle(email: string): Promise<void> {
  await withThrottleLock(async () => {
    const domain = getEmailDomainForThrottle(email);
    const gapMs =
      lastVerifyDomain !== null && domain !== "" && domain === lastVerifyDomain
        ? randomIntInRange(3000, 5000) // 同域名：3~5s
        : randomIntInRange(500, 1000); // 跨域名：0.5~1s
    const elapsed = Date.now() - lastVerifyRequestAt;
    const wait = Math.max(0, gapMs - elapsed);
    if (wait > 0) {
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
    lastVerifyDomain = domain;
    lastVerifyRequestAt = Date.now();
  });
}

/**
 * Verifies an email address by checking its reachability via the Reacher API.
 * Returns `true` if the email is reachable or the API call fails (fail-open policy),
 * and `false` only when the API explicitly reports the email as "invalid".
 *
 * 只把「通过校验」的邮箱写入缓存（有效期 1 天）；校验不通过的不缓存，
 * 下次遇到会重新请求 API。API 失败/超时同样不落盘（fail-open）。
 * @param email - The email address to verify
 * @returns `true` if the email is not invalid or the API call fails; `false` if the email is confirmed invalid
 */
async function verifyEmail(email: string): Promise<boolean> {
  const cacheKey = normalizeEmail(email) || email.trim().toLowerCase();

  const cached = await readReacherCache(cacheKey);
  if (cached) {
    const reasonText =
      cached.reasons.length > 0
        ? cached.reasons.join(", ")
        : "无（未命中丢弃规则）";
    const mxInfo = cached.firstMx ?? "无（mx 未返回 records）";
    const message = `[verifyEmail] ${cacheKey}: ${cached.reachable ? "keep" : "drop"} | 原因: ${reasonText} | 首条MX: ${mxInfo}`;
    if (cached.reachable) {
      console.log(message);
    } else {
      console.warn(message);
    }
    return cached.reachable;
  }

  // 缓存未命中：真正要打 Reacher API，先按域名节流（同域名 3~5s，跨域名 0.5~1s）
  await applyVerifyThrottle(email);

  try {
    const response = await fetch(
      "https://api.reacher.focusapps.app/v1/check_email",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to_email: email }),
      },
    );
    // 非 2xx 视为本次请求失败：不写缓存，按 fail-open 放行
    if (!response.ok) {
      console.warn(
        `[verifyEmail] API returned ${response.status} for ${cacheKey}, skip cache`,
      );
      return true;
    }
    const data = (await response.json()) as ReacherResponse;
    const { keep, reasons } = evaluateEmail(data);
    // 与检查结果一并打印首条 MX 记录，便于排查投递域/邮件服务商
    const firstMx = data.mx?.records?.[0];
    const mxInfo = firstMx
      ? JSON.stringify(firstMx)
      : "无（mx 未返回 records）";
    console.log(
      `[verifyEmail] ${cacheKey}: ${keep ? "keep" : "drop"} | 原因: ${reasons.join(", ") || "无"} | 首条MX: ${mxInfo}`,
    );
    if (keep) {
      // 只缓存通过校验的邮箱
      await writeReacherCache(cacheKey, true, reasons, mxInfo);
    }
    return keep;
  } catch (error) {
    // API call failed, fail open
    console.error(`[verifyEmail] API call failed for email: ${email}`, error);
    return true;
  }

}

function findCandidateLinks(html: string, baseUrl: string): CandidateLink[] {
  const candidates: CandidateLink[] = [];
  const hrefRegex = /href=["']([^"']+)["']/gi;
  const baseUrlObj = new URL(baseUrl);
  const seen = new Set<string>();
  // 一次性建立 href → 链接文字 的索引，避免对每个 href 重复扫描整份 HTML
  const anchorTexts = buildAnchorTextMap(html);

  const matches = html.matchAll(hrefRegex);
  for (const match of matches) {
    const href = match[1];
    if (!href) continue;

    // Skip non-http/https links
    if (
      href.startsWith("#") ||
      href.startsWith("javascript:") ||
      href.startsWith("tel:") ||
      href.startsWith("mailto:")
    ) {
      continue;
    }

    try {
      const candidateUrl = new URL(href, baseUrl);

      // Only consider same-domain links
      if (candidateUrl.hostname !== baseUrlObj.hostname) {
        continue;
      }

      const pathname = candidateUrl.pathname;
      if (seen.has(pathname)) continue;
      seen.add(pathname);

      // 1) 按路径匹配
      let pathScore = 0;
      let pathType = "";
      for (const [type, { pattern, score }] of Object.entries(
        CANDIDATE_PATTERNS,
      )) {
        if (pattern.test(pathname)) {
          pathScore = score;
          pathType = type;
          break;
        }
      }

      // 2) 按链接文字匹配。路径命中后照样继续匹配文字：
      //    两者都命中说明互相印证、可信度更高（加分）；
      //    路径看不出名的（如 /company）则靠文字兜底。
      let anchorScore = 0;
      let anchorType = "";
      const anchorText = anchorTexts.get(href) ?? "";
      if (anchorText) {
        for (const { pattern, score, type } of ANCHOR_PATTERNS) {
          if (pattern.test(anchorText)) {
            anchorScore = score;
            anchorType = type;
            break;
          }
        }
      }

      // 两个信号都没命中则跳过；取两者较高分
      if (pathScore === 0 && anchorScore === 0) continue;
      const finalScore = Math.max(pathScore, anchorScore);
      const finalType = pathScore >= anchorScore ? pathType : anchorType;

      candidates.push({
        url: candidateUrl.toString(),
        score: finalScore,
        type: finalType,
      });
    } catch {
      // Skip invalid URLs
    }
  }

  // Sort by score descending, return top 20
  return candidates.sort((a, b) => b.score - a.score).slice(0, 20);
}

// 扫描整份 HTML，一次性建立 href → 链接文字 的索引。
// 文字过长（>40）说明不是导航链接，直接丢弃。
function buildAnchorTextMap(html: string): Map<string, string> {
  const map = new Map<string, string>();
  const regex = /<a\s[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a\s*>/gi;

  for (const match of html.matchAll(regex)) {
    const href = match[1];
    if (!href || map.has(href)) continue;

    const text = (match[2] || "")
      .replace(/<[^>]*>/g, "")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/\s+/g, " ")
      .trim();

    if (text && text.length <= 40) {
      map.set(href, text);
    }
  }

  return map;
}

// ---------- 产品名称提取 ----------
// 冷邮件需要"Hi {{name}} 团队"这类变量，所以顺手把站点名抓下来。
// 背景页是 service worker，没有 DOM，只能用正则解析 head。

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

// 常见「页面名」词汇：我们常在二级页面抓取（/privacy、/terms、/contact…），
// 这类页面的标题里全是这些词，剥掉后为空就说明拿到的不是产品名。
// 短语优先匹配，避免把 "Sign in" 拆成两个普通词。
const PAGE_NAME_PHRASES = new Set([
  "sign in",
  "sign up",
  "log in",
  "log out",
  "contact us",
  "about us",
  "privacy policy",
  "terms of service",
  "terms of use",
  "terms and conditions",
  "cookie policy",
  "refund policy",
  "knowledge base",
  "help center",
  "get started",
  "coming soon",
  "page not found",
  "not found",
  "just a moment",
  "attention required",
  "403 forbidden",
  "404 not found",
  "登录",
  "注册",
  "联系我们",
  "关于我们",
  "隐私政策",
  "服务条款",
  "使用条款",
  "个人信息",
  "帮助中心",
  "常见问题",
  "页面未找到",
  "即将上线",
]);

const PAGE_NAME_WORDS = new Set([
  "privacy",
  "policy",
  "policies",
  "terms",
  "conditions",
  "condition",
  "legal",
  "imprint",
  "impressum",
  "disclaimer",
  "disclosure",
  "cookie",
  "cookies",
  "gdpr",
  "ccpa",
  "compliance",
  "security",
  "refund",
  "refunds",
  "shipping",
  "returns",
  "contact",
  "contacts",
  "about",
  "home",
  "homepage",
  "403",
  "404",
  "500",
  "502",
  "503",
  "forbidden",
  "denied",
  "blocked",
  "captcha",
  "verifying",
  "redirecting",
  "cloudflare",
  "welcome",
  "blog",
  "news",
  "faq",
  "faqs",
  "help",
  "support",
  "docs",
  "doc",
  "documentation",
  "resources",
  "resource",
  "pricing",
  "price",
  "prices",
  "plans",
  "plan",
  "login",
  "logout",
  "signin",
  "signup",
  "register",
  "registration",
  "account",
  "profile",
  "settings",
  "dashboard",
  "overview",
  "search",
  "cart",
  "checkout",
  "download",
  "downloads",
  "demo",
  "trial",
  "status",
  "changelog",
  "careers",
  "jobs",
  "press",
  "partners",
  "affiliate",
  "affiliates",
  "community",
  "forum",
  "forbidden",
  "error",
  "moment",
  "attention",
  "required",
  "page",
  "pages",
  "untitled",
  "loading",
  "首页",
  "主页",
  "个人主页",
  "个人网站",
  "官方网站",
  "官网",
  "文档",
  "支持",
  "帮助",
  "隐私",
  "条款",
  "cookie",
  "登录",
  "注册",
  "常见问题",
  "博客",
  "论坛",
  "社区",
  "价格",
  "定价",
  "资源",
  "账户",
  "设置",
  "搜索",
  "下载",
  "即将",
]);

// 剥掉块里的页面名词汇（先整短语、再单词），剩下什么就返回什么
function stripPageNameWords(chunk: string): string {
  let text = chunk.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
  if (!text) return "";

  const lower = text.toLowerCase();
  for (const phrase of PAGE_NAME_PHRASES) {
    if (lower === phrase || lower.startsWith(`${phrase} `)) {
      text = text.slice(phrase.length);
      break;
    }
  }

  const kept = text
    .split(/\s+/)
    .filter(Boolean)
    .filter((word) => {
      const bare = word
        .toLowerCase()
        .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
      // 纯符号（"Desk & Park" 里的 &）没有字母数字可比对，保留原样
      if (bare === "") return true;
      return !PAGE_NAME_WORDS.has(bare);
    });

  const joined = kept
    .join(" ")
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
  // 只剩分隔符/"!" 之类符号也算剥空（"Attention Required! | Cloudflare" → ""）
  return /\p{L}|\p{N}/u.test(joined) ? joined : "";
}

// co.uk / com.au 这类二级后缀，取域名主标签时要连着 TLD 一起剥掉
const SECOND_LEVEL_TLDS = new Set([
  "co",
  "com",
  "org",
  "net",
  "gov",
  "edu",
  "ac",
  "or",
  "ne",
]);
const MAX_PRODUCT_NAME_LENGTH = 60;
// 不承载品牌信息的子域名前缀。flow.google.com 的 flow 没在这里，所以会被当成候选品牌；
// app.warmbly.com 的 app 在这里，所以只认 warmbly。
const GENERIC_SUBDOMAINS = new Set([
  "www2",
  "app",
  "apps",
  "my",
  "get",
  "go",
  "try",
  "use",
  "web",
  "site",
  "online",
  "blog",
  "news",
  "shop",
  "store",
  "help",
  "support",
  "docs",
  "doc",
  "api",
  "dev",
  "mail",
  "email",
  "login",
  "account",
  "admin",
  "dashboard",
  "panel",
  "portal",
  "console",
  "beta",
  "alpha",
  "staging",
  "test",
  "cdn",
  "static",
  "assets",
  "en",
  "zh",
  "cn",
  "us",
  "jp",
  "eu",
  "meet",
  "chat",
  "forum",
  "community",
  "status",
]);

function decodeHtmlEntities(text: string): string {
  const fromCodePoint = (code: number): string =>
    Number.isFinite(code) && code > 0 && code <= 0x10ffff
      ? String.fromCodePoint(code)
      : "";

  return text
    .replace(
      /&#x([0-9a-f]+);/gi,
      (_, hex: string) => fromCodePoint(Number.parseInt(hex, 16)) || "",
    )
    .replace(
      /&#(\d+);/g,
      (_, dec: string) => fromCodePoint(Number.parseInt(dec, 10)) || "",
    )
    .replace(
      /&([a-z][a-z0-9]*);/gi,
      (match, name: string) => NAMED_ENTITIES[name.toLowerCase()] ?? match,
    );
}

function normalizeText(text: string): string {
  return decodeHtmlEntities(text).replace(/\s+/g, " ").trim();
}

// 正常站点 meta/title 都在 head 里，先切出来能避免正文里的同名字符串干扰；
// 但有些模板（实测 zvonai.ai）会把整段 meta/title 渲染到 body，
// 所以 head 里找不到时调用方还要再整篇扫一遍。
function getHead(html: string): string {
  const end = html.search(/<\/head\s*>/i);
  return end === -1 ? html : html.slice(0, end);
}

// 按 property/name 取 meta 的 content，不假设属性顺序（content 可能在前面）
function extractMetaContent(head: string, key: string): string {
  for (const match of head.matchAll(/<meta\b[^>]*>/gi)) {
    const tag = match[0] ?? "";
    const keyMatch = /\b(?:property|name)\s*=\s*["']([^"']+)["']/i.exec(tag);
    if (!keyMatch) continue;
    if ((keyMatch[1] ?? "").trim().toLowerCase() !== key) continue;
    const contentMatch = /\bcontent\s*=\s*["']([^"']*)["']/i.exec(tag);
    if (contentMatch) return normalizeText(contentMatch[1] ?? "");
  }
  return "";
}

function extractTitle(head: string): string {
  const match = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(head);
  return match ? normalizeText((match[1] ?? "").replace(/<[^>]*>/g, "")) : "";
}

// 托管平台域名（xxx.vercel.app、xxx.chatgpt.site）：注册标签是平台名而不是品牌，
// 品牌在最左边的标签里。必须在 `.` 边界上匹配，"superfly.dev" 不会被 "fly.dev" 误判。
const HOSTING_PLATFORM_SUFFIXES = [
  "chatgpt.site",
  "vercel.app",
  "netlify.app",
  "webflow.io",
  "notion.site",
  "lovable.app",
  "bolt.host",
  "dora.run",
  "framer.app",
  "framer.website",
  "glide.page",
  "softr.app",
  "base44.app",
  "replit.app",
  "herokuapp.com",
  "github.io",
  "gitlab.io",
  "pages.dev",
  "workers.dev",
  "onrender.com",
  "fly.dev",
  "railway.app",
  "streamlit.app",
  "firebaseapp.com",
  "web.app",
  "canva.site",
  "typedream.app",
  "carrd.co",
  "surge.sh",
  "supabase.co",
];

// Vercel/Netlify 预览域名带部署哈希（echo-echo-ae11.vercel.app），
// 末尾的「含数字的 4-10 位短串」当噪声剥掉；"daemon-os"、"cool-tool-123" 不受影响
const DEPLOYMENT_HASH = /^(?=.*\d)[a-z0-9]{4,10}$/;

function stripDeploymentHash(label: string): string {
  const parts = label.split("-").filter(Boolean);
  if (parts.length < 2) return label;
  const last = parts[parts.length - 1] ?? "";
  return DEPLOYMENT_HASH.test(last) ? parts.slice(0, -1).join("-") : label;
}

function getHostingPlatformBrandLabels(hostname: string): string[] {
  for (const platform of HOSTING_PLATFORM_SUFFIXES) {
    const suffix = `.${platform}`;
    if (!hostname.endsWith(suffix)) continue;
    // meowmood-care.huangshihtsu.chatgpt.site → ["meowmood-care", "huangshihtsu"]
    return hostname
      .slice(0, hostname.length - suffix.length)
      .split(".")
      .filter((label) => label && !GENERIC_SUBDOMAINS.has(label))
      .map(stripDeploymentHash);
  }
  return [];
}

// 域名兜底用的标签，第一个就是最终兜底值。
// warmbly.com → ["warmbly"]；app.mycooltool.co.uk → ["mycooltool"]（app 是通用前缀）；
// news.ycombinator.com → ["ycombinator"]（news 是通用前缀）。
function getDomainLabels(url: string): string[] {
  try {
    const hostname = new URL(url).hostname.toLowerCase();

    const platformLabels = getHostingPlatformBrandLabels(hostname);
    if (platformLabels.length > 0) return platformLabels;

    const labels = hostname
      .replace(/^www\./i, "")
      .split(".")
      .filter(Boolean);
    if (labels.length === 0) return [];

    let tldStart = labels.length - 1;
    if (
      labels.length >= 3 &&
      SECOND_LEVEL_TLDS.has((labels[labels.length - 2] ?? "").toLowerCase())
    ) {
      tldStart -= 1;
    }

    const registered = labels[tldStart - 1] ?? labels[0] ?? "";
    const brandedSubdomains = labels
      .slice(0, tldStart - 1)
      .map((label) => label.toLowerCase())
      .filter((label) => label && !GENERIC_SUBDOMAINS.has(label));

    return [registered, ...brandedSubdomains].filter(Boolean);
  } catch {
    return [];
  }
}

// 应用商店 / 代码托管这类「多产品宿主」站点：og:site_name 给的是平台名
//（"App Store"、"GitHub"）而不是产品名，只能从 URL 里取。
const MARKETPLACE_HOST_SUFFIXES = [
  ".apple.com",
  "play.google.com",
  "github.com",
  "gitlab.com",
  "gumroad.com",
];
// GitHub/GitLab 的一级路径若是这些保留字，说明不是 用户/仓库 结构
const CODE_HOST_RESERVED_PATHS = new Set([
  "orgs",
  "users",
  "features",
  "topics",
  "collections",
  "sponsors",
  "settings",
  "marketplace",
  "explore",
  "notifications",
  "apps",
  "login",
  "pricing",
  "about",
  "search",
]);
const PACKAGE_GENERIC_PARTS = new Set([
  "com",
  "io",
  "co",
  "net",
  "org",
  "app",
  "apps",
  "android",
  "mobile",
  "web",
  "www",
  "ltd",
  "inc",
]);

function isMarketplaceUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return MARKETPLACE_HOST_SUFFIXES.some(
      (suffix) => hostname === suffix || hostname.endsWith(suffix),
    );
  } catch {
    return false;
  }
}

// 应用商店的 slug 一律「品牌名 + 描述词」结构，描述词开始的地方就是品牌名的结尾：
// "superset-100-coding-agents" → "Superset"（数字）、
// "pome-ai-calorie-tracker" → "Pome"（ai 属于描述词）。
// 首个词永远保留，避免把 "ai-diary" 这种品牌首词砍掉。
const SLUG_DESCRIPTOR_WORDS = new Set([
  "ai",
  "app",
  "apps",
  "assistant",
  "bot",
  "chat",
  "chatbot",
  "coach",
  "companion",
  "converter",
  "counter",
  "creator",
  "dashboard",
  "editor",
  "finder",
  "generator",
  "guide",
  "helper",
  "maker",
  "manager",
  "mobile",
  "note",
  "notes",
  "planner",
  "platform",
  "player",
  "plus",
  "pro",
  "reader",
  "scanner",
  "studio",
  "suite",
  "tool",
  "tools",
  "tracker",
  "watch",
]);

function titleCaseSlug(slug: string): string {
  const tokens = slug.split(/[-_]+/).filter(Boolean);
  const head: string[] = [];
  for (const [index, token] of tokens.entries()) {
    const isLast = index === tokens.length - 1;
    // 末位描述词不切："trade-tracker" 里的 tracker 属于名字本身，
    // 而 "pome-ai-calorie-tracker" 里的 ai 后面还有内容，是副标题起点
    const isBoundary =
      /^\d+$/.test(token) || (!isLast && SLUG_DESCRIPTOR_WORDS.has(token));
    if (index > 0 && isBoundary) break;
    head.push(token);
  }
  // 描述词表不可能穷尽（"fractionsolver-math-step-calc" 一个都没命中），
  // 超过两个词的 slug 尾部基本都是副标题，只留前两词兜底
  const kept =
    head.length > 2 ? head.slice(0, 2) : head.length > 0 ? head : tokens;
  return kept
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ");
}

function extractNameFromMarketplaceUrl(url: string): string {
  try {
    const target = new URL(url);
    const hostname = target.hostname.toLowerCase();
    const pathSegments = target.pathname.split("/").filter(Boolean);

    // apps.apple.com/us/app/superset-100-coding-agents/id6788926383
    if (hostname.endsWith(".apple.com")) {
      const match = /\/app\/([^/]+)\/id\d+/i.exec(target.pathname);
      return match?.[1] ? titleCaseSlug(match[1]) : "";
    }

    // play.google.com/store/apps/details?id=com.superset.app
    if (hostname === "play.google.com") {
      const parts = (target.searchParams.get("id") ?? "")
        .split(".")
        .filter(Boolean);
      const meaningful = parts.filter(
        (part) => !PACKAGE_GENERIC_PARTS.has(part.toLowerCase()),
      );
      const last = (meaningful.length > 0 ? meaningful : parts).pop() ?? "";
      return last ? titleCaseSlug(last) : "";
    }

    // github.com/marsbos/zep → "Zep"（保留字路径如 /orgs/xxx 不算仓库）
    if (hostname === "github.com" || hostname === "gitlab.com") {
      const [first, second] = pathSegments;
      if (!first || !second) return "";
      if (CODE_HOST_RESERVED_PATHS.has(first.toLowerCase())) return "";
      return titleCaseSlug(second.replace(/\.git$/i, ""));
    }

    // xxx.gumroad.com/l/schemahand-offline → "Schemahand Offline"
    if (hostname === "gumroad.com" || hostname.endsWith(".gumroad.com")) {
      const listIndex = pathSegments.findIndex((part) =>
        ["l", "p"].includes(part.toLowerCase()),
      );
      const slug = listIndex >= 0 ? pathSegments[listIndex + 1] : undefined;
      return slug ? titleCaseSlug(slug) : "";
    }
  } catch {
    return "";
  }
  return "";
}

// "meowmood-care" → "Meowmood Care"，"warmbly" → "Warmbly"
function capitalizeLabel(label: string): string {
  if (!label) return "";
  return label
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

// 清洗一条候选名字（og:site_name / og:title / <title>）：
// 按分隔符切成块，逐块剥掉「页面名词汇」，返回第一个还剩下内容的块。
// 整条都被剥空（"Privacy Policy"、"登录 - XXX" 的纯页面名）就返回空串，
// 交给下一个来源或域名兜底。
// 按分隔符切成块，逐块剥掉页面名词，取第一个还剩下内容的块：
// "Privacy Policy" → ""（纯页面名，作废，交给下一个来源/域名）；
// "Privacy Policy | Maildoso" → "Maildoso"；
// "Peptide Tracker | Protocol. Perfected." → "Peptide Tracker"。
// （"哪一侧是品牌并不固定"，这里只取第一块是取舍：品牌在前的写法占多数，
//   "描述 | 品牌" 那类会拿到描述，比整条标题带标语更好用。）
function cleanNameValue(raw: string): string {
  const text = normalizeText(raw);
  if (!text) return "";

  // 分隔符：| · • – — , : 以及「点号后接空格」（避免切坏 milliseconds.ai、
  // tagio.art 这类名字里的点）
  const chunks = text.split(
    /\s*[|·•]\s*|\s+[-–—]\s+|[,，、]\s*|\s*[:：]\s+|\.\s+/,
  );

  for (const chunk of chunks) {
    const cleaned = stripPageNameWords(chunk);
    if (cleaned) return cleaned;
  }
  return "";
}

export function extractProductName(html: string, url: string): string {
  // 1) 应用商店 / 代码托管链接：og:site_name 给的是平台名，产品名只能从 URL 取
  if (isMarketplaceUrl(url)) {
    const marketplaceName = extractNameFromMarketplaceUrl(url);
    if (marketplaceName) return marketplaceName;
  }

  const head = getHead(html);
  // 先扫 head（避免正文同名串干扰），head 里没有再把整篇当兜底扫描
  const scopes = head === html ? [head] : [head, html];
  const findMeta = (key: string): string => {
    for (const scope of scopes) {
      const value = extractMetaContent(scope, key);
      if (value) return value;
    }
    return "";
  };
  const findTitle = (): string => {
    for (const scope of scopes) {
      const value = extractTitle(scope);
      if (value) return value;
    }
    return "";
  };

  // 2) og:site_name → og:title → <title>，谁清洗后还有内容就用谁
  for (const value of [
    findMeta("og:site_name"),
    findMeta("og:title"),
    findTitle(),
  ]) {
    const cleaned = cleanNameValue(value);
    if (cleaned && cleaned.length <= MAX_PRODUCT_NAME_LENGTH) {
      return cleaned;
    }
  }

  // 3) 兜底：域名主标签（warmbly.com → "Warmbly"、meowmood-care → "Meowmood Care"）
  return capitalizeLabel(getDomainLabels(url)[0] ?? "");
}

async function scrapeLevel1(
  url: string,
): Promise<{ emails: string[]; candidates: string[]; name: string }> {
  // 缓存命中：直接返回已解析结果（emails / 候选链接 / 站点名），跳过 fetch 与解析
  const cached = await readPageCache(url);
  if (cached) {
    console.log(`[pageCache] hit ${pageCacheStorageKey(url)}`);
    return {
      emails: cached.emails,
      candidates: cached.candidates,
      name: cached.name,
    };
  }

  const { html, browserTried } = await fetchWithTimeout(url);
  if (!html) {
    return { emails: [], candidates: [], name: "" };
  }

  let emails = extractEmailsFromText(html);
  let finalHtml = html;
  let finalBrowserTried = browserTried;

  // fetch 拿到的是未执行 JS 的静态 HTML。Next.js/SPA 站的邮箱常在
  // hydration 之后才插入 DOM，静态源码里搜不到。0 邮箱且尚未做过
  // 浏览器渲染时，用后台 tab 完整渲染兜底一次（仅首页，控制成本）。
  if (emails.length === 0 && !browserTried) {
    const renderedHtml = await fetchWithBrowserTab(url);
    if (renderedHtml) {
      finalHtml = renderedHtml;
      finalBrowserTried = true;
      const renderedEmails = extractEmailsFromText(renderedHtml);
      if (renderedEmails.length > 0) {
        emails = renderedEmails;
      }
    }
  }

  // 用最终拿到的 HTML（含渲染兜底）找候选页；缓存命中后无需再解析 HTML
  const candidates = findCandidateLinks(finalHtml, url).map((c) => c.url);
  const name = extractProductName(finalHtml, url);

  // 只缓存成功的抓取；无论是否匹配到邮箱都缓存（满足「200 即缓存」）
  await writePageCache(url, {
    emails,
    candidates,
    name,
    browserTried: finalBrowserTried,
    status: 200,
  });

  return { emails, candidates, name };
}

async function scrapeLevel2and3(candidates: string[]): Promise<string[]> {
  const allEmails = new Set<string>();

  // 抓取全部候选页。不再"命中一个就停"——不同页面常有不同联系人的邮箱，
  // 提前 break 会漏掉 team 页、about 页上的个人邮箱。
  for (const candidateUrl of candidates) {
    // 缓存命中：直接取已解析的邮箱，跳过 fetch 与解析
    const cached = await readPageCache(candidateUrl);
    if (cached) {
      for (const email of cached.emails) allEmails.add(email);
      continue;
    }

    const { html } = await fetchWithTimeout(candidateUrl);
    const emails = extractEmailsFromText(html);
    // 候选页只贡献邮箱、不再向下钻取（避免无限递归）；同样只缓存成功抓取
    await writePageCache(candidateUrl, {
      emails,
      candidates: [],
      name: "",
      browserTried: false,
      status: 200,
    });
    for (const email of emails) {
      console.log(`[Level candidate] Found email: ${email}`);
      allEmails.add(email);
    }
  }

  return Array.from(allEmails);
}

export async function scrapeEmails(url: string): Promise<ScrapedEmail[]> {
  const timestamp = Date.now();
  const scrapedEmails: ScrapedEmail[] = [];

  try {
    // Level 1: Direct page fetch (with automatic fallback to background tab)
    const { emails: level1Emails, candidates, name } = await scrapeLevel1(url);

    // Level 2 & 3: 联系/关于/团队等候选页。
    // 即便首页已抓到邮箱也照样抓候选页并合并——首页常见的是 info@ 这类
    // 角色邮箱，真正的联系人邮箱往往在 contact/team/about 页上。
    const level23Emails = await scrapeLevel2and3(candidates);

    // 合并去重（首页邮箱优先，标记为 mailto；其余标记为 contact-page）
    const seen = new Set<string>();
    const all: { email: string; source: "mailto" | "contact-page" }[] = [];
    for (const email of level1Emails) {
      if (seen.has(email)) continue;
      seen.add(email);
      all.push({ email, source: "mailto" });
    }
    for (const email of level23Emails) {
      if (seen.has(email)) continue;
      seen.add(email);
      all.push({ email, source: "contact-page" });
    }

    for (const { email, source } of all) {
      const isReachable = await verifyEmail(email);
      if (isReachable) {
        scrapedEmails.push({
          email: email.toLowerCase(),
          name,
          foundOn: url,
          timestamp,
          source,
        });
      } else {
        console.warn(`[verifyEmail] Email is unreachable, skipped: ${email}`);
      }
    }

    return scrapedEmails;
  } catch (error) {
    console.error(`Error scraping emails from ${url}:`, error);
    return [];
  }
}
