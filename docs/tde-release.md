# 《食梦者》发布手册（M5 / P10 骨架 · draft）

> **口径**：本文件是 **P10 之前的骨架**（`draft`）。战役与玩家卡、8 章仍不可启动；调查员包已是 `development`，5 人可以选、可以构筑。
> 发布口径（路线图 §0 / §11.2）：最多 `playable` + `earlyAccess=true`、`equivalenceCertified=false`；任何未完成项必须写进 `remaining` 与 `scenarioApproximations`，**不宣称规则等价**。
> 路线图：[`tde-migration-roadmap.md`](./tde-migration-roadmap.md) §11；规范：[`arkham-content-migration.md`](./arkham-content-migration.md) §8。

## 1. 事实：现在的状态

| 项 | 状态 |
| --- | --- |
| 内容状态 | 战役、玩家卡包、8 章仍是 `catalog-only`，未接入 `content/registered.js`，不可启动。调查员包是 `development`（可选择、可构筑；AI 池未扩容） |
| 已完成 | P0–P4 门禁通过；P5 双线机制闭环（真实 TDE 的 `dualLineGate` 仍关）；P6 调查员 verified 3/5，其余 2 人显式简化。证据见路线图 §2 与各 `tde-pN-report.md` |
| 未开始 | P7 玩家卡、P8 剧本、P8-T 自译、P9 逐章/全卡账本、P9.5 真实双线矩阵、P10 发布账本 |
| 账本 | 已有 `audit/tde-rules.json`、`audit/tde-investigators.json`；`audit/tde-migration.json` 仍是 P10 产物 |
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
