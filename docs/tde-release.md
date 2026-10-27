# 《食梦者》发布手册（M5 / P10 骨架 · draft）

> **口径**：本文件是 **P10 之前的骨架**（`draft`）。TDE 现在是 `catalog-only`：**不可启动、不可选人、不可构筑**。
> 发布口径（路线图 §0 / §11.2）：最多 `playable` + `earlyAccess=true`、`equivalenceCertified=false`；任何未完成项必须写进 `remaining` 与 `scenarioApproximations`，**不宣称规则等价**。
> 路线图：[`tde-migration-roadmap.md`](./tde-migration-roadmap.md) §11；规范：[`arkham-content-migration.md`](./arkham-content-migration.md) §8。

## 1. 事实：现在的状态

| 项 | 状态 |
| --- | --- |
| 内容状态 | 三个包 + 战役 + 8 章全部 `catalog-only`（`content/registered.js` 未接入） |
| 已完成阶段 | P0（清理/勘误/基线/D8-C 协议级 spike）、P1（范围与来源锁）、P2（机制扫描），证据见 [`tde-p0-report.md`](./tde-p0-report.md)、[`tde-p1-report.md`](./tde-p1-report.md)、[`tde-p2-report.md`](./tde-p2-report.md) |
| 未开始 | P3 原语、P4 关键词/规则书、P5 交互、P6 调查员、P7 玩家卡、P8 剧本、P8-T 自译、P9/P9.5 验收与双线开闸、P10 发布 |
| 账本 | `audit/tde-migration.json` 尚不存在（P10 产物） |
| 规则等价 | 不宣称；`equivalenceCertified=false` |

## 2. 发布门禁（M5）

三组确认必须全部 `verified`（状态只有 `pending`/`verified`，由校验器按证据计算）：

| 组 | 检查项 |
| --- | --- |
| `confirmations.scenarios` | 逐章 12 项：sourceLocked / identityRegistered / setupAndZones / actsAndAgendas / locationsAndConnections / encounterBehaviors / literalCardBehavior / chaosEffects / resolutionsAndRecords / storyText / saveReplay / browserAcceptance |
| `confirmations.keywords` | 5 项：sourceInventoried / engineBehavior / nodeAcceptance / rulebookEntry / cardLinks |
| `confirmations.rulebook` | 6 项：campaignOverview / scenarioMechanics / keywordEntries / cardLinks / desktopBrowser / mobileBrowser |

额外门禁（路线图 §11.2）：

- `test:tde`、`replay:fixtures`（13 局零漂移）、`npm test`、`presentation:check`、浏览器回归；无新增失败，既有失败单独记账。
- 双线开闸另需 §11.2 的 10 条（`seatParts` 只对 TDE 写入、偶数校验、16 排列、双线隐私、schema 7→8、双版本、全局串行提交、幕间幂等）。
- `literalCardBehavior` 在逐卡核对完成前保持 `false`；`blocked`/`rejected` 的原语与卡必须单列，不能写成「已迁移」。

## 3. 待办（P9/P9.5/P10）

| # | 事项 | 产物 |
| ---: | --- | --- |
| 1 | 全卡账本 | `audit/tde-all-card-acceptance.json`、`tde-player-acceptance.json` |
| 2 | 逐章账本 | `audit/tde-scenario-acceptance.json` + `check:tde:scenario` |
| 3 | 剧情账本 | `tde-scenario-source-lock.json`（自译来源）+ `storyText` 审计字段 |
| 4 | 浏览器账本 | `tde-browser-acceptance.json`（桌面 1440 / 移动 390） |
| 5 | 双线验收 | 4 人 2+2 / 2 人 1+1 / 3 人 2+1、16 排列、存档/回放（P9.5） |
| 6 | 发布账本 | `audit/tde-migration.json` 的 `gate.pass`、`playable` + `earlyAccess` |
| 7 | 发布口径审查 | `remaining` / `scenarioApproximations` 逐条有理由；不得声称规则等价 |

## 4. 边界

- `playable` 只表示「本 Mod 声明的实现范围可玩」，不等于规则等价；`earlyAccess=true` 是默认口径。
- `officialFull`（每人两套牌组、整桌切换）**不在**本轮发布范围（§7.4 仅历史事实）；四种开局见 §1.4.1。
- 发布前不得删除或伪造既有失败记录；账本由工具生成，`--check` 必须能复算。

## 5. 相关手册与维护

- 原语：[`tde-primitives.md`](./tde-primitives.md)；规则书：[`tde-rules.md`](./tde-rules.md)；交互：[`tde-interactions.md`](./tde-interactions.md)；调查员：[`tde-investigators.md`](./tde-investigators.md)；玩家卡：[`tde-player-cards.md`](./tde-player-cards.md)；剧本：[`tde-scenarios.md`](./tde-scenarios.md)；剧情：[`tde-story.md`](./tde-story.md)。
- 维护：每个阶段收尾补「产物与证据路径」；发布账本只能由 `tools/audit-tde.mjs` 生成，先 `--write` 再 `--check`。
