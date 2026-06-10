export interface ScrapedEmail {
  email: string;
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
]);
const OBFUSCATION_PATTERNS = [
  { pattern: /\[at\]/gi, replacement: "@" },
  { pattern: /\(at\)/gi, replacement: "@" },
  { pattern: /\s+at\s+/gi, replacement: "@" },
  { pattern: /\[dot\]/gi, replacement: "." },
  { pattern: /\(dot\)/gi, replacement: "." },
  { pattern: /\s+dot\s+/gi, replacement: "." },
];

const CANDIDATE_PATTERNS: Record<string, { pattern: RegExp; score: number }> = {
  contact: { pattern: /\/contact([\/-]|$)/i, score: 100 },
  "contact-us": { pattern: /\/contact[-_]?us/i, score: 95 },
  support: { pattern: /\/support/i, score: 90 },
  about: { pattern: /\/about([\/-]|$)/i, score: 85 },
  "about-us": { pattern: /\/about[-_]?us/i, score: 80 },
  privacy: { pattern: /\/privacy/i, score: 75 },
  terms: { pattern: /\/terms/i, score: 75 },
  help: { pattern: /\/help/i, score: 65 },
  legal: { pattern: /\/legal/i, score: 45 },
  impressum: { pattern: /\/impressum/i, score: 40 },
  team: { pattern: /\/team/i, score: 30 },
};

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

      const listener = async (
        tid: number,
        changeInfo: { status?: string },
      ) => {
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

async function fetchWithTimeout(url: string, timeout = 30000): Promise<string> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Accept-Encoding": "gzip, deflate",
        DNT: "1",
        Connection: "keep-alive",
        "Upgrade-Insecure-Requests": "1",
      },
    });
    clearTimeout(id);

    if (!response.ok) {
      return "";
    }

    let html = await response.text();

    // Check if it's skeleton content
    if (isSkeleton(html)) {
      const browserHtml = await fetchWithBrowserTab(url);
      if (browserHtml) {
        html = browserHtml;
      }
    }

    return html;
  } catch (error) {
    clearTimeout(id);
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.warn(`Failed to fetch ${url}:`, errorMsg);
    return "";
  }
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

  // Filter out test domains
  if (TEST_DOMAINS.has(domain)) {
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

function findCandidateLinks(html: string, baseUrl: string): CandidateLink[] {
  const candidates: CandidateLink[] = [];
  const hrefRegex = /href=["']([^"']+)["']/gi;
  const baseUrlObj = new URL(baseUrl);
  const seen = new Set<string>();

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

      // Check against patterns
      for (const [type, { pattern, score }] of Object.entries(
        CANDIDATE_PATTERNS,
      )) {
        if (pattern.test(pathname)) {
          candidates.push({
            url: candidateUrl.toString(),
            score,
            type,
          });
          break;
        }
      }
    } catch {
      // Skip invalid URLs
    }
  }

  // Sort by score descending, return top 5
  return candidates.sort((a, b) => b.score - a.score).slice(0, 5);
}

async function scrapeLevel1(
  url: string,
): Promise<{ emails: string[]; html: string }> {
  const html = await fetchWithTimeout(url);
  if (!html) {
    return { emails: [], html: "" };
  }

  const emails = extractEmailsFromText(html);
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

  // Fetch top candidates sequentially
  for (const candidate of candidates.slice(0, 3)) {
    const candidateHtml = await fetchWithTimeout(candidate.url);
    const emails = extractEmailsFromText(candidateHtml);
    for (const email of emails) {
      allEmails.add(email);
    }

    // If we found emails, no need to check more candidates
    if (allEmails.size > 0) {
      break;
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

    if (level1Emails.length > 0) {
      for (const email of level1Emails) {
        scrapedEmails.push({
          email,
          foundOn: url,
          timestamp,
          source: "mailto",
        });
      }
      return scrapedEmails;
    }

    // Level 2 & 3: Candidate pages
    const level23Emails = await scrapeLevel2and3(url, html);
    if (level23Emails.length > 0) {
      for (const email of level23Emails) {
        scrapedEmails.push({
          email,
          foundOn: url,
          timestamp,
          source: "contact-page",
        });
      }
    }

    return scrapedEmails;
  } catch (error) {
    console.error(`Error scraping emails from ${url}:`, error);
    return [];
  }
}
