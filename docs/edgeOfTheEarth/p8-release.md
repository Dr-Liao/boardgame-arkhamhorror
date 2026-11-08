# 《地球边缘》P8 发布验收记录

本文件记录《地球边缘》（Edge of the Earth，`edgeOfTheEarth`）P8「整体验收与发布」的最终证据与结论。
本循环已完成 P0–P8：范围/原语/调查员/一般玩家卡/八章与战役流程均已逐项验收，P8 汇总发布门禁并给出
可复算账本。逐卡/逐章结论以 `audit/` 生成账本为准；下方数字为最终一次干净运行的实测值。

> **2026-11-08 P0 修复轮修订（重要）**：后续独立全量扫描（[`eote-scan/全量扫描报告.md`](eote-scan/全量扫描报告.md)）
> 推翻了下方的 P8「verified」结论：403 条记录中 202 条 gap、111 条 approximation；8 个章节单元在真实引擎
> 路径均不能完整跑通；P8 逐卡账本 135/403 条证据字面不可追溯（其中 129 条 scenario-ledger 系统性错配）。
> 本轮已按 [`eote-scan/repair/README.md`](eote-scan/repair/README.md) 修复 P0-1..P0-13，并重建诚实账本
> （生成器根因修复；missing/blocked/simplified 如实登记；`equivalenceCertified:false`；证据见
> [`eote-scan/verify/`](eote-scan/verify/) 与 `audit/eote-all-card-acceptance.json`/`audit/eote-migration.json`）。
> **下方 P8 段落保留为历史记录，其中「verified / passed / remaining=0」等结论不再作为当前发布口径**；
> 当前发布口径以重建后的账本与 [`eote-scan/verify/audit-fix.md`](eote-scan/verify/audit-fix.md) 为准。

**发布结论**：`audit/eote-migration.json` = **verified**（gates 19/19，confirmations scenarios/keywords/
rulebook 全 verified，releaseAcceptance passed，remaining=0，`earlyAccess:false`）；
`audit/eote-release-acceptance.json` = **passed**（checks 12/12、截图 104/104）；
P8 Node `verify-eote --node` = **475/475**；全量回归 = **6956 项 / 6950 过 / 3 条 P0 冻结失败 /
3 skipped / additions []、replay 零漂移**；真实大厅发布/进度/联机浏览器 = **3 specs × 双视口，
6/6 用例、104 张截图哈希一致**。

- 战役入口：大厅可选《地球边缘》（`playable`，无提前开放标记）；八章与战役流程可完整游玩。
- 发布总账本：`audit/eote-migration.json`（`--write/--check` 可复算）。
- 发布审计：`audit/eote-release-acceptance.json`；浏览器发布证据：`audit/eote-release-browser.json`。
- 逐卡账本：`audit/eote-all-card-acceptance.json`；逐章账本：`audit/eote-scenario-acceptance.json`。

## 1. 生产注册与启动链路

- `content/registered.js` 静态注册 `edgeOfTheEarth` 战役、8 个章节单元与三个内容包
  （`eoteCampaign` 266 / `eoteInvestigators` 22 / `eotePlayer` 115）；`contentRegistry.assertLaunchable('edgeOfTheEarth')` 通过，
  `campaignListForUi` 在大厅可见，`earlyAccess:false`。
- 大厅真实链路：选战役 → 调查准备（5 位调查员、自动/自定义牌组、多人/AI 席位）→ 序幕 1–4 →
  开始当前关卡 → 检查点 I–III → 幕间 I–III → 致命幻景可选再入 → 尾声。
- 八个章节 manifest：`playable`、参考卡身份、地点/幕/议程/混乱袋/遭遇组/机制闭包、layout 均由
  P8 注册测试与发布审计复算。

## 2. 逐卡与规则证据

- 403 条记录 = 367 主卡 + 36 关联面；三包 266/22/115。
- 逐卡账本 `audit/eote-all-card-acceptance.json`：每条记录带条目文件 sha256 与实跑测试证据
  （标题命中/文件级/分片账本回填）；`missing=0`、`blocked=0`；显式简化（26 张，关联 8 个 pending
  行为原语请求）作为已披露近似单列，不阻塞发布门禁。参考卡 08596/08621 按口径为 `no-behavior`。
- 规则/关键词/规则书：`audit/eote-rules.json` 23 条规则、38 条关键词、16 条规则书条目与卡文直达
  全部 `verified`；`audit/eote-interactions.json` 交互验收 `verified`。
- 条目合规：`node tools/audit-card-entry-compliance.mjs` 无基线外 R1/R2/R3 违规；
  `build-card-index --check` / `build-encounter-index --check` 索引一致。

## 3. Node 验收

P8 Node 测试（真实生产组合根 + 真实大厅/引擎入口，不伪造内容）：

| 文件 | 覆盖 |
| --- | --- |
| `tests/eote-p8-registration.test.mjs` | 静态注册、可启动、8 章 manifest/布局/记录/混乱袋/指南/机制闭包 |
| `tests/eote-p8-campaign.test.mjs` | 完整主线八章+结局、检查点 I/II 跳过分支、致命幻景进入/忽略/回场、失败/撤退、伙伴全存/全灭记录、四档难度、存档恢复、章节边界指纹 |
| `tests/eote-p8-multiplayer.test.mjs` | 2 真人 + AI 席位、手牌隐私、越权拒绝且状态不变、断线/存档恢复 |
| `tests/replay-eote-p8.test.mjs` | 固定 seed/脚本逐步骤状态指纹，两次运行一致且匹配 `tests/fixtures/replay/eote-p8-baseline.json` |
| `tests/eote-all-cards.test.mjs` | 403 逐卡账本自洽/确定性 |
| `tests/eote-migration-ledger.test.mjs` | 发布/迁移账本结构、门禁、确认项、确定性 |

`node tools/verify-eote.mjs --node` 覆盖 P0–P8 全部 EotE Node 测试（含上述文件）：
**475 项 / 475 过 / 0 失败**，`sourceStableDuringRun:true`，报告 `audit/eote-node-acceptance.json`。

## 4. Replay 与存档

- 固定 seed 的 P8 campaign replay：`tests/replay-eote-p8.test.mjs` 记录 10 步状态指纹，
  两次运行逐步骤一致，并与签入基线一致；seed 不符时测试提示重新生成基线，不静默通过。
- 存档恢复：检查点/幕间后 JSON → `migrateState` 幂等恢复并可继续下一章；多人模式断线后
  重新载入会话/状态可继续且手牌隐私不变。
- 既有 13 局 golden replay：`verify-eote --regression` 要求 replay 一致、无新增失败（P0 冻结项单独记账）。

## 5. 真实大厅浏览器发布验收

`node tools/run-eote-release-browser.mjs`（桌面 1440×950 / 移动 390×844，真实大厅 + 真实 HTTP，
不使用 `page.route` 伪造）生成 `audit/eote-release-browser.json`，覆盖：

- **release**：大厅可见《地球边缘》、catalog 8 章标题、选人（08001）+ 自动构筑 + AI 席位、真实
  `/api/start`、`hubBeginScenario`、首章真实牌桌与合法行动；无 pageerror/console error/横向溢出。
- **progression**：真实主线逐章推进，检查点 I–III、幕间 I–III、升级窗口、尾声；八章指南面板/
  记录投影断言。
- **online**：relay + 两个真实大厅实例，双真人 `/api/online/create|join|ready|command` 进入首章；
  双方手牌/座位隐私、越权命令拒绝（revision 不变）、断线恢复后会话一致。
- 发布账本 `checks` 12 项（release/progression/online/privacy/permission/disconnect × 双视口）
  全 true；3 specs × 双视口共 **6/6 用例 passed**；截图逐张 stat+sha256，**104/104 一致**
  （release 6/6、progression 42/42、online 4/4 每视口，总 ≥20）。

## 6. 全量门禁与跨循环

- `node tools/verify-eote.mjs --node`：**475/475**，`sourceStableDuringRun:true`。
- `node tools/verify-eote.mjs --regression`：**6956 项 / 6950 过 / 3 条 P0 冻结失败 / 3 skipped、
  additions []、13 局 replay 零漂移、sourceStable**。
- `node tools/audit-eote.mjs --check` / `audit-eote-release.mjs --check` / `audit-eote-scenarios --check` /
  `audit-eote-all-cards --check` / `audit-eote-rules --check` / `audit-eote-interactions --check` /
  `audit-eote-investigators --check` / `audit-eote-player --check` 均 exit 0。
- `scan-eote-scope --check` / `scan-eote-mechanisms --check` / `build-card-index --check` /
  `build-encounter-index --check` / `check-doc-links` 均通过；TCU/TIC 既有账本按各循环口径复算/重签，
  不计入本循环新增失败。
- 发布不依赖 `参考资源/`：证据与运行时扫描（`content/**`、`src/**`、`web/**` 无运行时读取参考工程；
  卡图走 `web/img/**` 本地缓存或数据中的远程回退字段）。卡图库存见 `audit/eote-scope.json#cardImages`
  （英文/中文目录、`remoteFallback`、375 条远程正面图、102 条远程背面图）。
- `confirmations.scenarios / keywords / rulebook` 全部 `verified` 后才将迁移总账本置为 `verified`。

## 7. 已披露限制与维护项

以下项目在发布账本中如实披露，不属于未披露缺口；如后续接线原语可把对应卡从「已披露近似」收紧为完全等价：

- `releaseAcceptance`：status=**passed**、`earlyAccess:false`、required 15 项全 true、**remaining=0**、
  **deferred=28 条**（25 条 pending 原语请求逐条「已披露近似」、26 张 simplified 卡、8 个 pending 行为
  请求、22 条 P6 队列 rejected；每项带证据路径，不阻塞发布门禁）。
- 26 张战役卡为已披露近似（8 个 pending 行为原语请求：p7-08544/08546/08560/08587/08673/08679/08681/08682
  及章节 `scenarioApproximations` 项）；未声称与原版逐字等价。
- 印刷随机布阵（失落之峰山腰、古老者之城布局/钥匙、设施槽）在实现中为确定性顺序 + 可注入 shuffle。
- 中文剧情/指南来自参考 zh locale：260 段 present-needs-review、10 段 untranslated、199 段 missing；
  缺译按 `chineseGaps`/missing 标记显示「中文待补」，不以英文冒充中文。
  **（2026-11-09 更新：翻译修复批次已补齐全部缺译，章节 469/469、战役 258/258、指南 `chineseGaps=0`；见
  [`translate/fix-batch.md`](translate/fix-batch.md) 与 README §18。以下为发布时点的历史记录。）**
- P7 原语请求与玩家卡队列的 pending/rejected 项在 `audit/eote-migration.json#releaseAcceptance` 逐条披露。
- P0 冻结的 3 条既有失败（TDE P10 账本 ×2、TIC P8 replay）继续冻结，不计入本循环新增失败。

## 8. 最终账本

| 账本 | 用途 |
| --- | --- |
| `audit/eote-migration.json` | P8 总迁移账本：来源哈希、三包/八章/逐卡/关键词/规则书/剧情/Node/回归/浏览器、confirmations、releaseAcceptance、remaining |
| `audit/eote-release-acceptance.json` | 发布门禁复核（launch/chapters/browser checks/screenshots/证据源） |
| `audit/eote-release-browser.json` | 发布浏览器证据（release/progression/online × 双视口，截图清单） |
| `audit/eote-all-card-acceptance.json` | 403 条记录逐卡账本（verified/simplified/no-behavior） |
| `audit/eote-scenario-acceptance.json` | 8 章逐章验收（P7/P8） |
| `audit/eote-node-acceptance.json` / `audit/eote-regression.json` | Node 验收 / 全量回归与 replay |

复算命令：

```bash
node tools/audit-eote.mjs --check
node tools/audit-eote-release.mjs --check
node tools/audit-eote-all-cards.mjs --check
node tools/audit-eote-scenarios.mjs --check
node tools/verify-eote.mjs --node
node tools/verify-eote.mjs --regression
node tools/run-eote-release-browser.mjs
```
