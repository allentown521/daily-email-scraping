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
]);

const INCLUDE_TEST_DOMAINS = new Set([
  "sentry.wixpress.com",
  "sentry.io",
  "atlassian.net",
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
      const timeout = setTimeout(() => {
        browser.tabs.remove(tabId).catch(() => {});
        resolve("");
      }, 15000);

      const listener = async (tid: number, changeInfo: { status?: string }) => {
        if (tid === tabId && changeInfo.status === "complete") {
          try {
            const results = await browser.scripting.executeScript({
              target: { tabId },
              func: () => document.documentElement.outerHTML,
            });
            const html = (results?.[0]?.result as string) || "";
            clearTimeout(timeout);
            browser.tabs.onUpdated.removeListener(listener);
            browser.tabs.remove(tabId).catch(() => {});
            resolve(html);
          } catch (error) {
            console.error("Failed to get HTML:", error);
            clearTimeout(timeout);
            browser.tabs.onUpdated.removeListener(listener);
            browser.tabs.remove(tabId).catch(() => {});
            resolve("");
          }
        }
      };

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
      return { html: "", browserTried: false };
    }

    // 其余状态码不拦截（304 的 body 为空、403/429 反爬常返回错误页），
    // 统一交给下方 isSkeleton 判断——空/过小内容自动升级为浏览器渲染兜底
    const html = await response.text();
    if (isSkeleton(html)) {
      const browserHtml = await fetchWithBrowserTab(url);
      if (browserHtml) return { html: browserHtml, browserTried: true };
      // tab 也拿不到内容：标记已尝试过，避免上层重复开 tab；
      // 保留原骨架 html——SPA 的骨架里可能仍有可提取的导航链接
      return { html, browserTried: true };
    }
    return { html, browserTried: false };
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

async function fetchWithTimeout(
  url: string,
  timeout = 30000,
): Promise<FetchResult> {
  const retryDelay = 100;
  const maxRetries = 5;

  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await attemptFetch(url, timeout);
    } catch (error) {
      if (i === maxRetries) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(
          `Failed to fetch ${url} after ${maxRetries} retries:`,
          errorMsg,
        );
        return { html: "", browserTried: false };
      }
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.warn(
        `Failed to fetch ${url} (attempt ${i + 1}/${maxRetries + 1}): ${errorMsg}, retrying in ${retryDelay}ms...`,
      );
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
    }
  }
  return { html: "", browserTried: false };
}

function normalizeEmail(email: string): string {
  let normalized = email.toLowerCase().trim();

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

/**
 * Verifies an email address by checking its reachability via the Reacher API.
 * Returns `true` if the email is reachable or the API call fails (fail-open policy),
 * and `false` only when the API explicitly reports the email as "invalid".
 * @param email - The email address to verify
 * @returns `true` if the email is not invalid or the API call fails; `false` if the email is confirmed invalid
 */
async function verifyEmail(email: string): Promise<boolean> {
  try {
    const response = await fetch(
      "https://api.reacher.focusapps.app/v1/check_email",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to_email: email }),
      },
    );
    const data = (await response.json()) as { is_reachable?: string };
    if (data.is_reachable !== "invalid") {
      return true;
    }
    console.warn(
      `[verifyEmail] Email is invalid, skipped: ${email} reason: ${data.is_reachable}`,
    );
    return false;
  } catch (error) {
    // API call failed, fail open
    console.error(`[verifyEmail] API call failed for email: ${email}`, error);
    return true;
  }

  const normalized = normalizeEmail(email);
  const domain = normalized.split("@")[1]?.toLowerCase();
  if (!domain) return false;
  try {
    // 💡 骚操作：同时并发查询 A 记录（网站）和 MX 记录（邮件）
    const [resA, resMX] = await Promise.all([
      fetch(`https://cloudflare-dns.com/dns-query?name=${domain}&type=A`, {
        headers: { Accept: "application/dns-json" },
      }),
      fetch(`https://cloudflare-dns.com/dns-query?name=${domain}&type=MX`, {
        headers: { Accept: "application/dns-json" },
      }),
    ]);

    if (!resA.ok && !resMX.ok) {
      // 如果 CF 接口偶尔挂了，使用 HEAD 方法，只连服务器探路，不下载任何网页内容，速度飞快
      // mode: 'no-cors' 是核心，防止被对方网站的跨域策略（CORS）拦截
      await fetch(`https://${domain}`, {
        method: "HEAD",
        mode: "no-cors",
        cache: "no-cache",
      });
      return true;
    }

    const dataA = await resA.json();
    const dataMX = await resMX.json();

    // 4. 审判：只有 Status 是 0 且真的有 Answer 解析结果，才算活域名
    if (
      (dataA.Status === 0 && dataA.Answer && dataA.Answer.length > 0) ||
      (dataMX.Status === 0 && dataMX.Answer && dataMX.Answer.length > 0)
    ) {
      return true; // 捞回像 seadance-video.com 这种有网站但没 MX 记录的精准大鱼！
    }
    console.log(`[dns 不存在] ${domain} 无法解析或建立连接`);
    return false;
  } catch (err) {
    // 连 HTTPS 都连不上，说明域名彻底挂了、或者根本不存在（如 testttttt.com）
    console.log(`[官网无法连接] ${domain} 无法解析或建立连接`, err);
    return false;
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
      const bare = word.toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
      // 纯符号（"Desk & Park" 里的 &）没有字母数字可比对，保留原样
      if (bare === "") return true;
      return !PAGE_NAME_WORDS.has(bare);
    });

  const joined = kept.join(" ").replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
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

    const labels = hostname.replace(/^www\./i, "").split(".").filter(Boolean);
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
  const chunks = text.split(/\s*[|·•]\s*|\s+[-–—]\s+|[,，、]\s*|\s*[:：]\s+|\.\s+/);

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
): Promise<{ emails: string[]; html: string }> {
  const { html, browserTried } = await fetchWithTimeout(url);
  if (!html) {
    return { emails: [], html: "" };
  }

  const emails = extractEmailsFromText(html);

  // fetch 拿到的是未执行 JS 的静态 HTML。Next.js/SPA 站的邮箱常在
  // hydration 之后才插入 DOM，静态源码里搜不到。0 邮箱且尚未做过
  // 浏览器渲染时，用后台 tab 完整渲染兜底一次（仅首页，控制成本）。
  if (emails.length === 0 && !browserTried) {
    const renderedHtml = await fetchWithBrowserTab(url);
    if (renderedHtml) {
      const renderedEmails = extractEmailsFromText(renderedHtml);
      if (renderedEmails.length > 0) {
        // 渲染后的 DOM 导航链接更全，后续用它找候选页
        return { emails: renderedEmails, html: renderedHtml };
      }
    }
  }

  return { emails, html };
}

async function scrapeLevel2and3(
  baseUrl: string,
  html: string,
): Promise<string[]> {
  if (!html) {
    return [];
  }

  const candidates = findCandidateLinks(html, baseUrl);
  if (candidates.length === 0) {
    return [];
  }

  const allEmails = new Set<string>();

  // 抓取全部候选页。不再"命中一个就停"——不同页面常有不同联系人的邮箱，
  // 提前 break 会漏掉 team 页、about 页上的个人邮箱。
  for (const candidate of candidates) {
    const { html: candidateHtml } = await fetchWithTimeout(candidate.url);
    const emails = extractEmailsFromText(candidateHtml);
    for (const email of emails) {
      console.log(`[Level ${candidate.type}] Found email: ${email}`);
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
    const { emails: level1Emails, html } = await scrapeLevel1(url);
    // 整站共用一个产品名：首页（含浏览器渲染兜底后的 DOM）的 head 最完整
    const name = extractProductName(html, url);

    // Level 2 & 3: 联系/关于/团队等候选页。
    // 即便首页已抓到邮箱也照样抓候选页并合并——首页常见的是 info@ 这类
    // 角色邮箱，真正的联系人邮箱往往在 contact/team/about 页上。
    const level23Emails = await scrapeLevel2and3(url, html);

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
