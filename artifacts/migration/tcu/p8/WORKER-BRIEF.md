# TCU P8 章节 worker 简报（M3 剧本）

> 版本：P8 开工稿（2026-10-24）。由 Lead 维护；worker 不得改本文件，有异议发消息给 Lead。
> 目标：把《万象无终》9 章从 `catalog-only` 占位推进到 `development`，逐章交付
> `definition / layout / behavior / index` + 单卡遭遇条目 + 章节测试 + 12 项验收证据。

## 0. 先读什么（按顺序）

1. `games/arkhamhorror/AGENTS.md`、`ARCHITECTURE.md`（目录职责、依赖方向、一卡一文件、禁止子进程改共享文件）。
2. `docs/tcu-migration-roadmap.md` §2（范围）、§4.1（原语）、§6（交互）、§7.1–§7.6（M1/M2/M3、剧情、记录）、§8（验收）。
3. `docs/tcu-primitives.md`（P2/P3 已实现原语的 API：haunted / spectral / tarot / circle / story investigators / parley / bonded / memento / breach / enemy faces / cosmos）。
4. `docs/tcu-interactions.md`（P5 交互协议：塔罗、序章选人、闹鬼、幽灵界、阵法、记录面板）。
5. `docs/card-model.md` + `docs/card-entry-files.md`（描述子模型、一卡一文件、索引规则）。
6. `artifacts/migration/tcu/p8/authoring-notes-tfa.md`（Lead 提供的 TFA 章节实现手册：hooks 全表 + 写法）。
7. `artifacts/migration/tcu/p8/evidence-notes-carcosa.md`（账本与浏览器证据口径）。
8. `artifacts/migration/tcu/p8/reference-map.md` + `reference-files.json`（参考实现里每章要读哪些 Haskell 文件）。
9. `artifacts/migration/tcu/p8/scenario-inventory.json`（每章/每遭遇组的卡号、类型、印刷字段、机制）；
   `artifacts/migration/tcu/p8/location-map.json`（每章地点的符号、连接、胜利点、双面/未揭示关系）。
10. 参考实现（**只读**）：`参考资源/ArkhamHorror-main/backend/arkham-api/library/Arkham/` 下的
    `Scenario/Scenarios/TheCircleUndone/<章>.hs`、`Campaigns/TheCircleUndone/`、
    `{Act,Agenda,Asset,Enemy,Location,Story,Treachery}/CardDefs/TheCircleUndone/`、
    `{Act,Agenda,Asset,Enemy,Story,Treachery}/Cards/TheCircleUndone/<章>/`（逐卡行为）。
11. 中文剧情/卡文：`参考资源/ArkhamHorror-main/frontend/src/locales/zh/theCircleUndone/scenarios/<章>.json`
    （setup / intro / resolutions / tokens 的中文正文；P8 的 `scenario.intro/setup/resolutions` 文案从这里取，
    不要自己写近似剧情；P9 才会把整段正文导入 story-text.js）。
12. 既有实现样板：`content/campaigns/theForgottenAge/scenarios/theDoomOfEztli/**`（结构最完整）、
    `content/campaigns/theForgottenAge/{card-data.js,encounter-rules.js,tfa-chaos.js}`、
    `src/cards/encounter-entries/theForgottenAge/**`、`tests/tfa-doom-of-eztli.test.mjs`。

## 1. 产物与写入范围（严格）

每章交付，全部在 Lead 分配的写范围内：

```text
content/campaigns/theCircleUndone/scenarios/<chapterId>/
├─ index.js        # 装配：scenario/identities/layout/behavior + scenarioManifest
├─ definition.js   # 地点/幕/议程/敌人/诡计/剧情资产/遭遇牌堆/结局/scriptCards
├─ layout.js       # 只做展示坐标与连线（坐标从参考 Haskell 的地图/相邻关系推导）
├─ behavior.js     # 引擎钩子（只放钩子；按需拆 helper 文件，文件名自己定）
└─ chaos.js        # 可选：本章混乱标记函数（供 behavior.resolveChaosToken 引用）
tests/tcu-<chapter>.test.mjs        # 章节测试（Lead 负责登记进 suites）
src/cards/encounter-entries/theCircleUndone/<章节目录或 _shared 组>/<code>.js  # 单卡条目
artifacts/migration/tcu/p8/specs/<chapterId>.md      # 先写 spec，再写代码
artifacts/migration/tcu/p8/chapters/<chapterId>.status.json  # 完成状态与 gaps
```

**绝不写**（Lead 独占）：`content/campaigns/theCircleUndone/` 下除 `scenarios/` 外的文件、`content/registered.js`、
`src/cards/encounter-entries/_shared.js`（**全局**非玩家条目 helper，Lead 独占；需要 helper 发消息）、
`src/cards/**/index.js`、`src/engine/**`、`content/mechanics.js`、`audit/**`、`docs/**`、
`tests/suites.mjs`、`tests/node-suite.mjs`、`package.json`、`web/**`。卡条目必须一卡一文件、不得 import
`engine.js`/`card-abilities.js`/`encounter-abilities.js`/`content/`；跨条目查询只经
`src/cards/encounter-entries/_shared.js`（相对路径 `../../../_shared.js` 或 `../../../../_shared.js`）或
`encounter-entries/_lookup.js`。**注意**：不存在 `theCircleUndone/_shared.js`，不要创建它；TFA/TCU 的所有单卡
条目共用 `src/cards/encounter-entries/_shared.js`。

**已由 Lead 提供的共享模块（可直接 import，别改）**：
- `content/campaigns/theCircleUndone/encounter-rules.js` —— 九章 behavior 约定 `...encounterRules` 展开；
  W-shared 负责继续扩展。
- `content/campaigns/theCircleUndone/card-data.js`、`shared.js`、`record-labels.js`、`tcu-chaos.js`（混乱标记公共读点）。

## 2. 共享数据（已由 Lead 建好）

- `content/campaigns/theCircleUndone/card-data.js`：`printed/location/spectralLocation/backFace/linkSymbolLocations/
  stages/encounterCards/encounterDefinitions/encounterDeck/storyCards/identitiesFor`。
  **definition.js 只从这里取印刷数据**，不要手抄卡文。
- `content/campaigns/theCircleUndone/shared.js`：9 章、21 遭遇组、4 难度混乱袋、64 个 recordTypes/Defaults、MEMENTO_IDS。
- `content/campaigns/theCircleUndone/record-labels.js`：64 个记录中文名 + 10 个 Memento 中文名。
- `content/campaigns/theCircleUndone/manifest.js`：战役清单（status 仍 catalog-only，flow 留 P9）。
- 各章 `requiredEncounterGroupIds` 用 camelCase 组 id（章节 id 本身 + 共享组 id），包清单已登记 21 组；
  遭遇组 → 卡号见 `scenario-inventory.json` 的 `groups[]`。

## 2.5 开工前必须知道的 10 个坑（来自 authoring-notes-tfa.md §10，实测）

1. **没有 Math.random**：只用 `helper.randomValue()` / `api.random()` / `api.shuffle()`，否则测试不确定。
2. **`encounterDefinitions` 对每张 treachery 硬编码 `effect:{kind:'campaignRule'}`**：诡计结算时引擎会走
   `resolveEncounter`，没有单卡条目/规则就会抛错。**每张敌人/诡计都必须有单卡条目并 `implemented: true`**。
3. **条目规则合并顺序**：`encounterDefinitions` 先放印刷数据，再合并条目 `enemyRuleFor/treacheryRuleFor`（覆盖同名字段）。
   地点/幕/议程规则由 `behavior.js` 显式调用 `locationRuleFor/actRuleFor/agendaRuleFor` 分派（照 TFA behavior 写法）。
4. **`{...encounterRules}` 后覆盖同名钩子**会丢掉共享实现：覆盖时要在函数内显式调用 `encounterRules.X?.(...)`。
5. **`linkSymbolLocations` 会重写 connections**：手写邻接用 `explicitConnections`（本仓库 `card-data.location()` 已把
   你传入的 `connections` 自动折算成 explicitConnections；非符号地图也可以直接传 `connections`）。
6. **新遭遇条目建好后不会自动生效**：`implementedFor` 读索引，索引由 Lead 合并后重建；本地验证 behavior 不依赖索引。
7. **每个身份别名只能解析到唯一原卡号**；地点 `id` 与 `frontCode` 不要重复/冲突。
8. **`scenarioManifest` 的区域校验很硬**：同一卡不能同时在 `encounterDeck` 与 `setAside`；数量不能超过 `quantity`；
   `agentSets` 会算进 setAside，别在 `setAsideAliases` 里重复列。
9. **`choose` 的 `source` 参与重放深比较**：必须稳定字符串；选项 id 必须唯一非空；不要在请求里放随机值。
10. **测试文件必须同时登记两个清单**：`tests/suites.mjs`（一个 tier）与 `tests/node-suite.mjs`（Lead 合并时做），
    且 `saveReplay` 审计要求测试源码里字面出现 `JSON.stringify` 与 `deepEqual`、并字面引用本章目录
    `scenarios/<chapterId>/`。

## 3. definition.js 契约（照 TFA 样板）

```js
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { bindScenarioIdentities } from '../../../../identities.js'
import { location, spectralLocation, stages, encounterCards, encounterDefinitions, encounterDeck,
  storyCards, identitiesFor, linkSymbolLocations } from '../../card-data.js'

const gathered = encounterCards(['theWitchingHour', 'anettesCoven', ...])   // camelCase 或 snake_case
const definitions = encounterDefinitions(gathered)                          // enemies + treacheries

const locations = { entryHall: location('entryHall', '05071', { symbol: 'square', links: ['t'], back: {...} }) }
linkSymbolLocations(locations)

export const scenario = {
  id: '<chapterId>', originalCode: '05xxx', name: '万象无终 · <章名>',
  intro: '……（来自 zh locale 的 intro，中文，非空）',
  setup: '……（来自 zh locale 的 setup 摘要，中文）',
  startLocation: '<locationId>',
  locations,
  setAsideLocations: [...],            // 可选：放在一边的地点 id
  agentSets: { ... },                  // 可选：放在一边的可选遭遇组
  acts: stages([...], 'act').map(...),
  agendas: stages([...], 'agenda').map(...),
  scriptCards: { ... },                // 幕/议程上的 [action]，见下
  ...definitions,                      // enemies + treacheries
  storyAssets: storyCards([...]),       // 剧情资产卡号（可能为空对象）
  encounterDeck: encounterDeck(gathered), // 或自行筛掉 setAside 的卡后传入
  resolutions: { noResolution: '……', r1: '……' },  // 与参考实现 resolution 键一致
}
export const identities = identitiesFor(scenario)
bindScenarioIdentities(scenario, identities)
```

要点：
- `acts/agendas` 的阶段顺序 = 印刷卡号顺序；幕 4 张、议程 2 张等按 inventory / Haskell `setActDeck`。
  议程 `doomThreshold` 默认取卡面 `doom`；按人数计的用 `doomPerInvestigator`/`doomThresholdPerInvestigator`
  （参考 Haskell `toChaosTokenValue` 与 `agendaForced`）。
- `encounterDefinitions` 会把卡面数值 + `card-rules.js` 的 `enemyRuleFor/treacheryRuleFor` 合并；逐卡条目写好后自动生效。
- `scriptCards`：幕/议程上的 `[action]`（如探索、点燃火盆、撤退）必须走 `scenario.scriptCards` 或 `scriptCard`；
  地点/敌人行动用 `locationRule.actions` / `enemyRule`。引擎的 `script-card-ownership` 测试会核对。
- 敌人在 `setAside` 里用 `agentSets` 或 `setAsideAliases` 声明；张数由印刷 quantity 决定，`scenarioZoneReport` 会校验。
- 34 张关联面（b/c 尾缀）不要单独建条目：地点背面用 `back`/`linkSymbolLocations`，同卡不同面用 `linkedCardCode`。

## 4. behavior.js 契约

导出 `{ ...encounterRules, id: '<chapterId>', setupPlan?, setupLocations, setupEnemies?, ...hooks, resolution, resolveChaosToken, scenarioGaps }`。
可用的引擎钩子（`scenarioBehavior(state).hook?.(...)` 实测清单，签名以 `src/engine/*.js` 调用点为准）：

```
setupLocations(state, events, helper)    preScenarioSetup        setupEnemies
afterDeckSetup  afterChaosBagSetup      afterMulligan           phaseBegan
turnBegins  turnEnded  roundEnded  mythosEnded  enemyPhaseStart  enemyPhaseEnd
locationRevealed  locationEntered  locationLeft  locationFlipped  locationWillFlip  locationStory
locationLeaveTest  locationLeaveFailed  locationsStartRevealed  ignoreLocationRevealText  cluesOnReveal
actReveal  agendaReveal  agendaForced  agendaAdvancing  agendaWouldAdvance  checkObjectives
actIndexAfterAdvance  agendaChain  roundEndActIndex  drawCultistActIndex  interruptRitualActIndex
beforeInvestigate  investigateResult  investigationError  canDiscoverClues  cluesGained  cluesRemoved
beforeExplore  afterExplore  canExplore  exploreConnects  drawLocation  spawnLocation  drawEncounterLocation
encounterDrawn  resolveEncounter  encounterGainsSurge  encounterActions  performEncounterAction  ignoreTreachery
afterTest  testDifficultyModifier  beforeHarm  beforeEnemyHarm  enemyAttackStarted  enemyAttackResolved
enemyAttackModifier  enemyDamaged  enemyDefeated  enemySpawned  enemyMoved  enemyEngaged  enemyDiscarded
enemyCanBeDefeated  enemyCannotAttack  enemyCannotBeAttacked  enemyDamageAllowed  enemyStatModifier
enemyAttackModifier  hunterMove  enemyConnections  preyTarget
beforeMove  beforeExplore  canFightEnemy  canEvadeEnemy  canDisengage  canOpportunityAttack  canPlayCard
canCommitCard  canGainResources  canPlaceAsset  canPlayScenarioCard  commitIconMultiplier
assetEntered  assetLeftPlay  cardDrawn  deckEmptied  handSizeModifier  handSizePenalty
skipUpkeepDraw  skipUpkeepIncome  spawnOverrides  spawnFailed  victoryChanged  statModifier
chaosTokenRevealed  resolveChaosToken  elderSign  doomCleared  doomPlaced  hauntedScript
actions  performAction  payScenarioActionCost  scenarioActionError  describe
resolution  storyResolutionKey  allResigned  investigatorEliminated  investigatorCanBeDefeated
storyAssetLeftPlay  moveError  movementError  investigatorEntryError  investigatorMovedByEncounterCard
```

写法要点：
- 引擎钩子参数：`(state, ...业务参数, api)`；`api` 即 `scenarioRuntime`（见 `src/engine/scenario-runtime.js` 586 行全表）。
- 优先「数据驱动」：地点 `locationRule`、幕 `actRule`、议程 `agendaRule`、敌人 `enemyRule`、诡计 `treacheryRule`
  写到单卡条目；`behavior.js` 只做分派与章节级流程（参考 TFA 的 theUntamedWilds.behavior.js）。
- `setupLocations` 返回初始地点 id 数组；把 setAside/removed 等写进 `state.scenarioZones`。
- 本章专属状态写 `state.scenarioFlags`（纯 JSON），不要新增引擎字段。
- 每次随机必须经 `api.random()/api.shuffle()`（或 setup 的 helper），不要用 `Math.random()`——测试要确定性。
- 所有「选择」必须 `api.choose({ kind, source, seat, prompt, options, canSkip? })`，选项 `{ id, label }`；
  空候选/不可用要写明原因（P5 协议，`web/tcu-ui.js` 已有面板）。
- `resolution(state, key, events, api)`：写战役记录（`state.campaign.records`，键必须在 shared.js recordTypes 内）、
  返回 `{ award: boolean, bonus: number }`；未知 key 抛错。
- `scenarioGaps`：显式数组，逐条写「参考实现的哪条子句**完全没实现**」。`literalCardBehavior` 审计会读它；
  有任何 gap 的章不能 development。**不要把「忠实近似」写进 gaps**——用 `scenarioApproximations`。
- `scenarioApproximations`：显式数组，写「用战役 JSON 状态/单章逻辑忠实承载了卡面语义，但不是引擎通用原语」
  （例如：钥匙用 `state.scenarioKeys`、异端者数量用 `scenarioFlags` 计数、Cosmos 放置指令用脚本表）。
  审计把它们列进账本 `approximations` 与 `remaining`，**不阻塞** literalCardBehavior；但每条必须说清
  「卡面/参考实现的语义 → 我们如何等价实现」。
- 判据：行为与卡面一致（测试可复现）就不算 gap；只有「卡面某句我们根本没做」才算 gap。
- 不要改引擎。确实缺原语：写 `artifacts/migration/tcu/primitive-requests/p8-<chapter>-<name>.json`
  （`{ id, status:'pending', chapter, need, reason, cards, proposedApi }`）并发消息给 Lead。

## 5. 单卡遭遇条目

- 每张出现在 `scenario.enemies/treacheries/locations/acts/agendas/storyAssets` 的**卡**（不是运行期 id）都要有单卡文件，
  路径按归属算法：只服务本章 → `encounter-entries/theCircleUndone/<chapterId>/<code>.js`；
  多章共用 → `theCircleUndone/_shared/<encounterCode>/<code>.js`（共享组由 W-shared 负责，你不要写）。
- 文件形状：`export default { code, scope, ... }`；`scope ∈ enemy|treachery|location|act|agenda|storyAsset`。
  常用字段：`implemented: true`、`enemyRule`、`treacheryRule`、`locationRule`、`actRule`、`agendaRule`、
  `threatAction`、`assetRule`、`flags`、`encounterResolve`。`implemented: true` 是审计读点（`implementedFor`），
  只有「卡面规则确实接到行为」才写；纯印刷数值卡（如无特殊文本的地点）也要建文件，写 `implemented: true` + 注释说明
  「卡面无额外规则，数值由 definition 声明」。
- 条目里只能 import `src/cards/encounter-entries/_shared.js`（相对 `../../../_shared.js` / `../../../../_shared.js`）
  或 `_lookup.js`；不能 import 引擎/content。
- 建文件后**不要**跑 `build-encounter-index`（Lead 合并后统一重建）。需要索引的验证等 Lead 通知。

## 6. 章节测试（tests/tcu-<chapter>.test.mjs）

照 `tests/tfa-untamed-wilds.test.mjs` / `tests/tfa-doom-of-eztli.test.mjs` 的「钩子级」写法：
- `import '../src/engine/engine.js'`（注册能力层）、import 本章 `index.js`/`definition.js`。
- 自建 `stateFor(n)` 假状态（同 TFA 样板）+ `setupApi(seed)` 确定性随机。
- 覆盖：manifest 身份/状态/地点数/幕议程顺序；符号连线；setup 区域与 setAside 张数；
  幕/议程揭示；地点进入/调查/行动；敌人与诡计规则；混乱标记四难度；结局写记录；
  **存档往返**（`JSON.parse(JSON.stringify(state))` + `deepEqual` 断言）与**同一路线确定性**。
- 每个 test 用中文标题；异常路径（未知 key / 非法目标 / 空候选）也要有。
- 目标 20–40 例/章；`node --test tests/tcu-<chapter>.test.mjs` 全绿。
- 测试文件末尾不要动 `tests/suites.mjs` / `node-suite.mjs`（Lead 登记）。

## 7. 验证命令（本机）

```powershell
cd G:\boardgame-hall-ai\games\arkhamhorror
node --test tests/tcu-<chapter>.test.mjs          # 章节测试
node tools/check-tcu-scenario.mjs <chapterId>      # 结构/区域/身份/幽灵地点注册期校验（Lead 提供）
node -e "import('./content/campaigns/theCircleUndone/scenarios/<chapterId>/index.js').then(m=>console.log(m.manifest))"
node develop/gen-tcu-p8-inventory.mjs              # 需要重新盘点时（只读源码生成 artifacts）
```

完成后把 `artifacts/migration/tcu/p8/chapters/<chapterId>.status.json` 写好（格式见 §9），并给 Lead 发一条
消息：`<chapterId> 完成：files=… tests=…/… gaps=… needs=…`。

## 8. 章程与纪律

- **不谎报**：没实现的子句进 `scenarioGaps` 与 status.json 的 `remaining`；不要用「卡号出现在代码里」当证据。
- **不做大改**：不改 TFA/Carcosa/核心内容；不动引擎；不动共享文件。
- **小步提交**：每完成一个文件就跑一次 import 测试；不要攒 9 个文件再验证。
- **先 spec 后代码**：`specs/<chapterId>.md` 先写清「参考实现怎么跑 → 我们的钩子怎么接 → 哪些显式简化」，
  发给 Lead 后再批量写。
- **阻塞就报**：缺原语、缺 helper、参考实现看不懂、规格冲突——立即消息 Lead，不要猜着实现。
- 参考实现是唯一规则事实源；卡面中文文本是唯一文案事实源。两者冲突时以卡面 + 参考实现共同印证为准，并在 spec 记录。

## 9. status.json 格式

```json
{
  "chapterId": "<id>",
  "milestone": "P8",
  "status": "complete | partial | blocked",
  "files": ["index.js", "definition.js", "layout.js", "behavior.js", "chaos.js", "tests/tcu-<id>.test.mjs", "entry:<code>", "..."],
  "checks": { "sourceLocked": true, "identityRegistered": true, "setupAndZones": true, "actsAndAgendas": true,
    "locationsAndConnections": true, "encounterBehaviors": true, "literalCardBehavior": true,
    "chaosEffects": true, "resolutionsAndRecords": true, "storyText": true, "saveReplay": true },
  "inventory": { "locations": 0, "acts": 0, "agendas": 0, "enemies": 0, "treacheries": 0, "encounterCards": 0, "resolutions": [] },
  "tests": { "file": "tests/tcu-<id>.test.mjs", "cases": 0, "passing": 0 },
  "gaps": ["逐条：哪张卡/哪条子句没实现、近似方案"],
  "remaining": ["待办"],
  "notes": "参考实现依据/取舍"
}
```
