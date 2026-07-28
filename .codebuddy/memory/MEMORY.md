# 长期记忆 (MEMORY.md)

## 用户协作偏好
- 用户可以接受助手对其提议提出异议/不认可。如果助手认为某个改动不合理、有副作用或存在更好方案，应明确说出来，而不是为了省事一味照做。

## 项目约定 (daily-email-scraping)
- **项目用途**：从网页抓取邮箱，用于**冷启动营销邮件（cold outreach）**。因此过滤目标是：保留真人/可转化业务邮箱，过滤系统/角色/隐私/占位地址以提升送达率与转化。
- `src/lib/email-scraper.ts` 中的 `validateEmail` 负责邮箱校验与过滤，包含多个黑名单：
  - `TEST_DOMAINS`：过滤整域名（如 example.com、google.com、github.com 等）。
  - `EMAIL_PREFIX_BLOCKLIST`：过滤 @ 前的本地部分前缀（系统/隐私/角色类，如 suffix、private、privacy、example、legal、noreply、no-reply、donotreply、do-not-reply、postmaster、abuse、webmaster）。对冷营销场景，过滤 legal/privacy/noreply 等是正确的（非误伤，属预期行为）。
  - `FILE_EXTENSIONS`：过滤 TLD 为文件后缀的伪邮箱。
- `verifyEmail`：调用 Reacher API (`https://api.reacher.focusapps.app/v1/check_emailL`) 校验可达性，`is_reachable === "invalid"` 才返回 false，接口异常时 fail-open 返回 true。`scrapeEmails` 在 push 前会调用它，失败则打印 warn 日志。
- **潜在增强（用户尚未采纳）**：可补充角色型前缀黑名单（info、sales、support、admin、contact、hello、marketing、billing、accounts、team、careers），对冷邮件转化差。
