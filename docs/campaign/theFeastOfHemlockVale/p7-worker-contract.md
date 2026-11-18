# FHV P7 章节/共享遭遇 worker 契约

本文件是《铁杉谷盛宴》P7 批量迁移 worker 的交付契约。主进程已锁定事实源与共享层；
worker **只写**自己分到的文件，不碰共享文件、索引、账本、文档与其它 worker 的文件。

## 1. 输入

- 章节 worker：`artifacts/migration/fhv/workers/campaign-<scenarioId>.input.json`
- 共享遭遇组 worker：`artifacts/migration/fhv/workers/campaign-shared-<group>.input.json`
- 输入包含：场景 id/名称/提示卡号、`scenarioDir`、`testFile`、`guideFile`、`storyKey`、
  `cards`（每张：code/name/nameZh/type/encounterCode/references[{path,line}]）、`entryPaths`、
  `referenceFiles`（参考实现 .hs 清单）、`guidePath`（英文规则/剧情 JSON）、`chaosSymbols`（四档难度符号文本）。

## 2. 必须阅读

1. `AGENTS.md`（不可协商的卡牌规则）与 `docs/card-entry-files.md`。
2. 输入 JSON 的 `referenceFiles` 与 `cards[].references`：参考实现 Haskell（只读，不复制 Haskell 语法）。
3. `guidePath` 英文指南 JSON：章节规则/设置/幕议程/结局/法典的**权威印刷文本**。
4. 结构范本：`content/campaigns/theScarletKeys/scenarios/deadHeat/`（definition/layout/behavior/chaos/index），
   以及 `tests/tsk-scenario-deadHeat.test.mjs`（内容层章测试写法）。
5. 单卡条目范本：`src/cards/encounter-entries/theScarletKeys/deadHeat/*.js`（数据型条目 vs 行为型条目）。
6. 共享层（只读，不得修改）：
   - `content/campaigns/theFeastOfHemlockVale/card-data.js`（`printed/location/stage/encounterDefinitions/identitiesFor/encounterGroupDeck` 等）；
   - `content/campaigns/theFeastOfHemlockVale/story-access.js`（正文读取：`chapterStory/chapterText/chapterLeaves`）；
   - `content/scenario-manifest.js`（`scenarioManifest` / `layoutFor`）；
   - `src/engine/` 既有钩子与 `src/campaign/` 通用战役层（只读，不得改）。

## 3. 章节 worker 交付物

只写以下文件（路径均以模组根 `games/arkhamhorror/` 为基准）：

1. `content/campaigns/theFeastOfHemlockVale/scenarios/<scenarioId>/definition.js`
   - 导出：`scenario`（id/name/startLocation/locations/acts/agendas/resolutions/encounterDeck/
     setAsideCards/encounterGroups/actStages/agendaStages 等，按参考实现与 TSK 范本形状）、
     以及 behavior 与测试需要的具名常量（如 `LOCATIONS/LOCATION_CONNECTIONS/ENCOUNTER_DECK/
     SET_ASIDE_CARDS/ACT_CODES/AGENDA_CODES/STORY_CODES/SCENARIO_TEXT`）。
   - 卡面数据一律从 `card-data.js` 的 `printed()/location()/stage()/encounterDefinitions()` 读取，
     不抄第二份卡文；地点连接用 `LOCATION_CONNECTIONS` 表，坐标见 `layout.js`。
2. `.../scenarios/<scenarioId>/layout.js` — 导出 `layout`（网格/轨道坐标、地点与符号，形状照 TSK 的 layout.js）。
3. `.../scenarios/<scenarioId>/chaos.js` — 导出该章混乱符号含义/取值函数（用输入 `chaosSymbols` 四档文本与参考实现判定；供 behavior 与测试使用）。
4. `.../scenarios/<scenarioId>/behavior.js` — 导出 `behavior`（章节流程钩子）与 `implementedEntryFlags`；
   钩子沿用 TSK 范本：`preScenarioSetup / setupLocations / locationPlaced / afterDeckSetup / actions /
   performAction / enemySpawned / enemyMoved / enemyAttackStarted / enemyAttackResolved / enemyDefeated /
   locationShroudModifier / enemyStatModifier / moveError / beforeMove / roundEnded / turnEnded /
   actReveal / agendaReveal / checkObjectives / resolveChaosToken / applyTokenEffect / resolution`（按需）。
   行为只读 state、写变更只走 `api.*`（内容层测试用轻量 api 桩）；不 import engine.js。
5. `.../scenarios/<scenarioId>/index.js` — 汇总导出 `scenario/identities/layout/behavior/implementedEntryFlags`
   与具名常量；用 `scenarioManifest(scenario, identitiesFor(scenario), {...})` 生成 `manifest`
   （`campaignId: 'theFeastOfHemlockVale'`、`requiredPackIds: ['core','fhvCampaign']`、
   `requiredEncounterGroupIds: [encounterCode]`、`status: 'playable'`、`behaviorIds:[behavior.id]`、
   `recordReads/recordWrites` 按 behavior 实际读写的战役记录声明）。
6. 本场景全部卡片的单卡条目：`input.entryPaths` 中每个 code 一个文件
   （`src/cards/encounter-entries/theFeastOfHemlockVale/<scenarioId>/<code>.js`）。
   - `export default { code, scope, implemented: true, ... }`；scope 取值：
     `enemy`（敌人/敌人-地点）、`treachery`、`storyAsset`（剧情资产/campaign asset/story）、
     `location`、`act`、`agenda`（数据型条目：`abilities: []` + `flags` 印刷数值 + `note` 可选）。
   - 需要行为读点的敌人/诡计/剧情资产：在条目里声明 `flags` / `encounterRule` / `abilities`（描述子或
     `resolve`，写入只走 `ctx.api`），供 behavior 与引擎读取；行为复杂时把规则放在 behavior，条目只留身份/数值标记。
   - 严禁直写 `state.*`/`inv.*`/`enemy.*`/`location.*` 等字段；新增字段必须有引擎/behavior 读点。
7. 章测试 `input.testFile`（`tests/fhv-scenario-<scenarioId>.test.mjs`）：
   - 内容层测试（不 import engine.js）：直接 `import * as chapter from '../content/.../scenarios/<id>/index.js'`，
     构造轻量 state（参考 TSK 章测试 `stateFor/stateWithScenario/engineishApi`），断言：
     章节结构（卡数/gather 组/地点连接/放一边）、遭遇牌库构成、幕/议程推进与背面结算、
     混乱符号取值、关键敌人/诡计/剧情规则、结局与战役记录写入、存档 JSON 往返等。
   - 每条测试标题以 `P7 <scenarioId> ` 开头；至少覆盖输入中 80% 的卡片行为读点。

## 4. 共享遭遇组 worker 交付物

1. `input.entryPaths` 中每张卡一个条目文件（`src/cards/encounter-entries/theFeastOfHemlockVale/_shared/<group>/<code>.js`），
   形状与本契约 §3.6 相同。
2. 共享行为（如居民关系、传家宝、枯疫/折射等）写在条目 `flags`/`abilities` 或主进程战役层读取的数据约定中；
   不要改 `_shared.js` 或任何共享层文件。共享组不要求独立测试文件，主进程会统一注册并纳入章节/共享测试。

## 5. 通用约束

- **不修改**：`src/engine/**`、`src/cards/encounter-entries/index.js`、`src/cards/entries/index.js`、
  `content/campaigns/theFeastOfHemlockVale/{shared.js,manifest.js,chapters.js,flow.js,interludes.js,
  prologue.js,epilogue.js,records.js,parts.js,story-text.js,story-access.js,card-data.js}`、
  `content/packs/**`、`content/registered.js`、`tools/**`、`docs/**`、`audit/**`、`tests/suites.mjs`、
  `tests/node-suite.mjs`、`package.json` 以及其它 worker 的文件。
- 不重建索引、不跑 `cards:check` / `npm run test:fast` / audit / 浏览器；只跑自己的测试文件：
  `node --test <input.testFile>`。
- 无法表达的子句：用现有数据/钩子实现最接近行为，在模块注释与条目 `note` 里明确披露 approximation
  （不写假等价）；不新增状态字段；不 import 引擎。
- 完成后输出 JSON：`{"scenario":"<id>","entries":N,"tests":{"passed":N,"total":N},
  "simplified":[codes],"notes":"<=400 字符"}`。
