# 长期记忆 (MEMORY.md)

## 用户协作偏好
- 遇到「修少数特例会动到大多数正确结果」的取舍时，用户倾向保守：**保持现有正确逻辑不动**，接受少数已知偏差（2026-09-23：拒绝用 URL 路径段覆盖 og:site_name 的提案）。提改动时要说明代价与受影响面，让用户拍板。
- 用户可以接受助手对其提议提出异议/不认可。如果助手认为某个改动不合理、有副作用或存在更好方案，应明确说出来，而不是为了省事一味照做。

## 项目约定 (daily-email-scraping)
- **项目用途**：从网页抓取邮箱，用于**冷启动营销邮件（cold outreach）**。因此过滤目标是：保留真人/可转化业务邮箱，过滤系统/角色/隐私/占位地址以提升送达率与转化。
- `src/lib/email-scraper.ts` 中的 `validateEmail` 负责邮箱校验与过滤，包含多个黑名单：
  - `TEST_DOMAINS`：过滤整域名（如 example.com、google.com、github.com 等）。
  - `EMAIL_PREFIX_BLOCKLIST`：过滤 @ 前的本地部分前缀（系统/隐私/角色类，如 suffix、private、privacy、example、legal、noreply、no-reply、donotreply、do-not-reply、postmaster、abuse、webmaster）。对冷营销场景，过滤 legal/privacy/noreply 等是正确的（非误伤，属预期行为）。
  - `FILE_EXTENSIONS`：过滤 TLD 为文件后缀的伪邮箱。
- `verifyEmail`：调用 Reacher API (`https://api.reacher.focusapps.app/v1/check_emailL`) 校验可达性，`is_reachable === "invalid"` 才返回 false，接口异常时 fail-open 返回 true。`scrapeEmails` 在 push 前会调用它，失败则打印 warn 日志。
- 抓取结果 `ScrapedEmail.name`（字段名就叫 `name`）：由 `extractProductName(html, url)` 提取，整站共用一个名字。**2026-09-23 定稿为极简管线**（用户明确要求不再用域名打分）：
  1. **平台宿主链接**（apps.apple.com / play.google.com / github.com / gitlab.com / gumroad.com，见 `MARKETPLACE_HOST_SUFFIXES`）→ 从 URL slug、包名、owner-repo 取名（App Store slug 遇数字或非末位描述词截断、超两词只留两词；Vercel 部署哈希剥掉）。
  2. **`og:site_name` → `og:title` → `<title>`**：每个值经 `cleanNameValue`（先扫 head 再扫全文，因有站点把 meta 渲染进 body）——按 `| · • – — , : .（后接空格）` 切块，逐块剥掉 `PAGE_NAME_PHRASES`/`PAGE_NAME_WORDS`（privacy / terms / contact / home / sign in / 403 / cloudflare / 登录 / 隐私政策 …），**取第一个剥完还剩下的块**；全剥空或 >60 字符则该来源作废，换下一个。（试过整条保留：名字会带上标语，70 样本 35 个变化，已否决。）
  3. **域名兜底**：`getDomainLabels()[0]` 经 `capitalizeLabel`（连字符拆词大写）；子域名非通用前缀、托管平台左标签（`*.vercel.app` 等）也参与。
  - 已知代价（70 样本回归 18 个变化）：`glp1.app→Peptide Tracker` ✅、`oriane/lead-sparker→Lead Sparker` ✅、`gameplayer/nobrl→NovelMorrow` ✅；但「描述 | 品牌」型标题会拿到描述（`niubigeo`、`crecaly`、`gmapsscout`、`planningdatahub`、`check.hryp`），`saladict→AllenTown`、`solluz→Solar Panel Company in India` 翻回旧值。要修这些只能恢复域名打分（旧版 70 样本里仅 glp1 翻车）——用户选择保持简单。
  - CSV 导出列：`email,name,url,time`。改动此逻辑务必用真实站点验证（子页面、无 og、非英文站、商店链接）。
- **潜在增强（用户尚未采纳）**：可补充角色型前缀黑名单（info、sales、support、admin、contact、hello、marketing、billing、accounts、team、careers），对冷邮件转化差。

## 网站技术栈速查（影响内容脚本设计）
- **launchigniter.com**：Next.js App Router SPA（有 `self.__next_f` RSC flight，无 `__NEXT_DATA__`）。列表页 `/weekly-launches/*` 的 `div.cursor-pointer` 卡片，点击后客户端软导航到 `/launch/{slug}` 详情（document 不销毁，滚动位置保持）。**列表→详情→Back 之间内容脚本 `main()` 不会重新执行**，所以"依次点击"流程必须放在常驻的列表脚本里用轮询+pathname 判断驱动；详情脚本仅作整页加载兜底。进度用 `sessionStorage` key `launchigniter_progress_index` 共享以支持刷新续跑。

## 内容脚本通用模式（列表→详情→Back 类站点）
- 若目标是 SPA（客户端路由），把完整编排（点列表项→抓详情邮箱→点 Back→下一个）放在常驻列表脚本内，靠 `setInterval/while+sleep` + `window.location.pathname` 状态机驱动；详情脚本只在整页加载时能单独跑，作兜底。
- TypeScript 状态机阶段变量若用字面量联合并在循环体里重赋值，易被控制流窄化误报（2367），用 `let phase = "init" as string;` + `const p = phase` 快照规避。
- `document.querySelectorAll("button, a, div")` 返回 `Element`，取 `innerText` 需 `(el as HTMLElement)`。
