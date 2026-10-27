# 《食梦者》剧本手册（M3 / P8 骨架 · draft）

> **口径**：本文件是 **P8 之前的骨架**（`draft`），只登记 8 章的结构、遭遇组归属与逐章机制清单；TDE 仍是 `catalog-only`，**没有任何章节可启动**（8 章只有 M0 目录占位）。
> 事实来源：[`scope.json`](../artifacts/migration/tde/scope.json)（P1）、[`mechanism-scan.json`](../artifacts/migration/tde/mechanism-scan.json)（P2）。
> 路线图：[`tde-migration-roadmap.md`](./tde-migration-roadmap.md) §8.3 / §1.2；规范：[`arkham-content-migration.md`](./arkham-content-migration.md) §3 / §5。

## 1. 事实：8 章 = 双战役各 4 章

| # | id | 参考卡 | 中文名 | 线 | 章对 | 印刷包 | 组（主卡+面） | 逐章机制锚点 |
| ---: | --- | --- | --- | --- | ---: | --- | --- | --- |
| 1 | `beyondTheGatesOfSleep` | 06039 | 梦境门外 | A | 1 | tde | 24+2 | 14 种梦境 setup；幕 1–3 神话阶段不抽遭遇 |
| 2 | `wakingNightmare` | 06063 | 清醒噩梦 | B | 1 | tde | 21+0 | 蛛群滋生袋、蛛巢、护工→蛛群替换 |
| 3 | `theSearchForKadath` | 06119 | 寻觅卡达斯 | A | 2 | sfk | 36+17 | 最大章：4 区域、15 张 Veiled 地点 + b 面故事卡、神迹计数、被俘记录 |
| 4 | `aThousandShapesOfHorror` | 06168 | 万千骇形 | B | 2 | tsh | 26+2 | 183–188 神秘阶梯纵向链、随机门分组、蜂拥授予 |
| 5 | `darkSideOfTheMoon` | 06206 | 月之暗面 | A | 3 | dsm | 28+1 | 警报等级 0–5+、白船限制（5 以上不能进）、被俘开场 |
| 6 | `pointOfNoReturn` | 06247 | 无归之地 | B | 3 | pnr | 25+12 | 漆黑之海 8 张 Veiled 地点翻面洗回、剧本参考卡伤害数即进度 |
| 7 | `whereTheGodsDwell` | 06286 | 神居之所 | A | 4 | wgd | 37+0 | 奈亚拉托提普 5 形态（Hidden 敌人在手牌）、6 塔 × 4 低语 |
| 8 | `weaverOfTheCosmos` | 06333 | 编织宇宙 | B | 4 | woc | 22+0 | 大网纵向堆叠、阿特拉克·纳克亚旋转、四腿 Massive、地点毁灭 |

- 20 个遭遇组 = **8 章节组 253 张 + 12 共享组 30 张 = 283**（`tdeCampaign` 的 283 条记录）。
- 打印分支：每组按「主卡 + 关联面」登记，章节组与共享组都要有落点（`shared/` 或 `theDreamEaters/_shared/`），搜索章 53 张拆两片（主卡 36 / 面 17）。
- 跨循环通用组 **8/8 可用**（P1 已证实）：locked_doors / striking_fear / chilling_cold / ghouls / rats / ancient_evils / nightgaunts / pentagram（= 参考实现 `Set.DarkCult`，卡池 `encounterName='Dark Cult'`）。

### 1.1 已知缺口（P2 账本 `pending`）

| 缺口 | 说明 |
| --- | --- |
| `beyondTheGatesOfSleepEncounterDeck` | 参考实现只有 `li "gatherSets"` 声明、没有任何 `gather Set.*`；遭遇牌库要用规则书 setup 文本逐句对齐（R8） |
| `achievements` | 成就默认 out-of-scope（D4），不列入本轮机制 |
| 中文剧情 | 8 章正文依赖 P8-T 自译（[`tde-story.md`](./tde-story.md)） |

## 2. 目录契约（每章）

```
content/campaigns/theDreamEaters/scenarios/<id>/
├─ index.js        # 导出 scenario/identities/layout/behavior/manifest
├─ definition.js   # 地点 / 幕 / 议程 / 遭遇牌库 / 放在一边 / 结局
├─ layout.js       # 桌面坐标（复用既有布局变量）
└─ behavior.js     # 引擎钩子（不得按卡号写分支）
```

- 现在只有 `index.js` 的 **M0 占位**（16 行，`status: 'catalog-only'`）；`definition/layout/behavior` 属 P8。
- 战役层文件（P3/P8 建）：`manifest.js`（必须声明 `parts` 与 `modes: ['singleA','singleB','pick','parallel']`）、`shared.js`（已建）、`chapters.js`（每章带 `part`/`pair`）、`keywords.js`、`record-labels.js`、`card-data.js`、`encounter-rules.js`、`interludes.js`、`tde-chaos.js`、`story-text.js`、`dual-flow.js` / `dual-story.js`。

## 3. 逐章 12 项检查（P8/P9）

`sourceLocked / identityRegistered / setupAndZones / actsAndAgendas / locationsAndConnections / encounterBehaviors / literalCardBehavior / chaosEffects / resolutionsAndRecords / storyText / saveReplay / browserAcceptance`。

- 布置/区域守恒：`setupLocations` + `encounterDeck` + `setAside`/`removed` + 随机变体都由章节 definition 声明，运行时建局交叉核对。
- 幕/议程的 `[action]` 归属用 `scenario.scriptCards` 声明（规范 §4.5.1），地点/敌人的行动不得误标。
- 混乱符号：全局 `tde-chaos.js`（两袋 + 逐章符号表）+ 各章 behavior 的 `chaosAfterTest`。
- 跨章记录：55 键按 part 隔离（P3 原语 `partRecord`）；幕间写另一线走 `recordInPart`。
- 章节可单独 `development`；A/B 单线在 4 章确认后可先 `playable`，`pick`/`parallel` 另见 §11.2 门禁。

## 4. 待办（P8）

| # | 事项 | 产物 / 验收 |
| ---: | --- | --- |
| 1 | 8 章 definition/layout/behavior | 按章对批次推进（对 1 Beyond+Waking → 对 2 Search+Thousand → 对 3 DarkSide+Point → 对 4 WhereGods+Weaver） |
| 2 | 非玩家单卡条目 | `src/cards/encounter-entries/theDreamEaters/**/<code>.js` 一卡一文件 |
| 3 | 三幕间 + 16 段尾声 | `interludes.js` + `dual-story.js` |
| 4 | 逐章账本 | `audit/tde-scenario-acceptance.json` + `check:tde:scenario` |
| 5 | 剧情正文 | P8-T 自译（见 [`tde-story.md`](./tde-story.md)） |
| 6 | 浏览器验收 | 每章桌面/移动各一条真实路径 |

## 5. 边界

- 8 章目录占位**不是**可玩章节：没有 definition、没有 setup、没有遭遇牌库。
- `literalCardBehavior` 在逐卡核对完成前保持 `false`；`verified` 不等于规则等价（发布口径见 [`tde-release.md`](./tde-release.md)）。
- 共享组的落点必须区分「循环共享组」（本循环 12 组）与「跨循环通用组」（8 组），不得混目录。

## 6. 相关手册与维护

- 原语：[`tde-primitives.md`](./tde-primitives.md)；规则书：[`tde-rules.md`](./tde-rules.md)；交互：[`tde-interactions.md`](./tde-interactions.md)；剧情：[`tde-story.md`](./tde-story.md)；发布：[`tde-release.md`](./tde-release.md)。
- 维护：章节卡数/组归属以 `scope.json` 为准；改 definition 后跑 `scan:tde:scope:check` 与 `check:tde:scenario`，账本必须重算。
