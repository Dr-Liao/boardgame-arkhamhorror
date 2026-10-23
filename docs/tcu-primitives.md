# 万象无终（TCU）原语手册（第 2 步产物）

> 适用：`games/arkhamhorror`，第四循环 **The Circle Undone**（`tcu`，中文《万象无终》）。
> 依据：[`tcu-migration-roadmap.md`](tcu-migration-roadmap.md) §4（第 2 步：拆分原语与通用层改动）、
> [`arkham-content-migration.md`](arkham-content-migration.md) §4.3（原语五件套）。
> 状态口径：本文只写**已经接线并有测试**的原语。未完成的条目保留「计划」标记，不得当作文档已交付。

## 0. 这份文档怎么用

第 2 步的产物不是「一堆新函数」，而是**可复算的原语账本**：

```powershell
node tools/audit-tcu-primitives.mjs --write   # 由代码/测试重新计算，生成下面两份产物
node tools/audit-tcu-primitives.mjs --check   # CI 门禁：代码与产物不一致就失败
```

| 产物 | 内容 | 谁写 |
| --- | --- | --- |
| `artifacts/migration/tcu/primitive-plan.json` | 计划 + 实测状态：每个原语的读点是否接线、测试是否实跑通过、实现文件哈希、机制覆盖率、escape 登记 | 工具（不手改） |
| `artifacts/migration/tcu/primitive-catalog.json` | 主进程维护的原语快照：`registries`（ability kind / effect 原语 / `ctx.api` / `scenarioRuntime` / 窗口 / modifier 目标）+ 每个原语的读点与状态 | 工具（worker 只读） |

`status=done` 的充分条件（缺一不可）：声明的读点全部能在模块里枚举到、测试文件存在且 `node --test` 实跑通过、实现文件哈希可复算。**状态不手写**。

## P2.1 闹鬼结算（Haunted）

**已实现。** 落点：`src/engine/haunted.js`（规范化 + 读取 + 结算）、`src/engine/windows.js`（`haunted` 窗口）、
`src/engine/actions.js`（调查检定失败后的调用点）、`src/engine/setup.js`（开局校验）、`src/engine/scenario-runtime.js`（内容层窄接口）。

### 卡面与规则

地点卡印刷「闹鬼 - …」。规则：调查员在**该地点**进行一次调查检定并失败后，结算该地点的**每条**闹鬼能力；
玩家决定结算顺序；能力可以因没有合法目标而不结算。攻击/躲避失败**不是**关键字本身的条件——那是混乱标记
（序章 05043、死亡门前 05065、罪恶报应 05161 的 `[tablet]`）或敌人强制能力（05101 暗影猎犬、05267 幽灵乌鸦）
单独印的文本，由卡面显式调用同一个原语。

### 数据形状（纯 JSON，随存档往返）

地点定义（`scenario.locations[<locationId>]` 或已放置的 `state.locations[]` 实例）可以带：

```js
haunted: [
  { text: '闹鬼 - 受到 1 点恐惧。', effect: [{ kind: 'horror', amount: 1 }] },
  { text: '闹鬼 - 你必须失去 1 次行动或失去 2 点资源。',
    effect: [{ kind: 'choice', options: [
      { id: 'action', label: '失去 1 次行动', effect: [{ kind: 'loseAction', amount: 1 }] },
      { id: 'resource', label: '失去 2 点资源', effect: [{ kind: 'loseResource', amount: 2 }] },
    ] }] },
]
```

`text` 必填（玩家看到的是卡面原文）；能力 `id` 可选，缺省为 `<locationId>#<index>`。
未知子句、未知字段、非法 `amount`、缺 `text` 会在**开局加载**时抛错（`normalizeScenarioHaunted`），
不会等到对局中途静默失效。

### 闭集子句词表

| kind | 参数 | 语义 | 代表卡面 |
| --- | --- | --- | --- |
| `damage` / `horror` | `amount` | 受到 N 点伤害/恐惧（走引擎分配管线） | 05257、05102 |
| `directDamage` / `directHorror` | `amount` | 直接伤害/恐惧（不能分配） | — |
| `damageAssets` | `amount` | 你每张带生命值的卡牌受到 N 点直接伤害 | 05083 |
| `loseAction` | `amount` | 失去 N 个行动 | 05079、05137 |
| `loseResource` | `amount`、`overflowHorror` | 失去 N 点资源；`overflowHorror` 时每 1 点无法失去改为 1 点恐惧 | 05080 |
| `discardRandom` / `discardChosen` | `amount` | 随机/选择弃手牌 | 05176b / 05084、05256 |
| `discardAsset` | `amount` | 弃掉你控制的支援 | 05081、05255 |
| `placeClue` | `amount` | 把你的线索放到本地点 | 05082 |
| `doom` | `amount`、`target: agenda\|location\|enemy`、`code?` | 在议程/地点/敌人上放毁灭 | 05131、05141、05335 |
| `spawn` | `code`、`locationId?` | 生成敌人 | 05103（配合 script） |
| `attack` | `target: nearest\|code`、`code?` | 敌人攻击你 | 05100、05335 |
| `moveTo` | `locationId`/`code` | 移动到指定地点 | 05138 |
| `choice` | `options[{ id, label, effect[] }]` | 二选一（选项内可再嵌套子句） | 05081、05252 |
| `script` | `id`、`code?` | 交给章节 `hauntedScript` 钩子 | 05129、05173b、05174b |

`script` 是**逃生口**：只有一张卡/一章才需要的复杂效果（检索遭遇牌库、把牌库顶变成敌人、把弃牌堆的诡计放进威胁区）
走这里。章节没实现时写进 `state.hauntedGaps` 并在日志里打 ⛔，审计可见，**不静默通过**；批量写卡阶段（P8）
必须把这些 gap 清零或保持登记。

### 读点与调用点

| 读点 | 位置 | 用途 |
| --- | --- | --- |
| `hauntedAbilitiesAt(state, locationId)` | `src/engine/haunted.js` | 印刷能力 + 授予能力的唯一读点 |
| `isLocationHaunted(state, locationId)` | 同上 | 「你所在地点闹鬼」（05065 的 `[skull]` -3、05104/05105 前置条件） |
| `normalizeHauntedAbility` / `normalizeScenarioHaunted` | 同上 | 注册期/开局校验 |
| `scenarioRuntime.haunted(seat, { locationId, times, kind, source })` | `src/engine/scenario-runtime.js` | 内容层结算入口 |
| `scenarioRuntime.hauntedAt(id)` / `hauntedIs(id)` | 同上 | 内容层读取 |
| `scenarioRuntime.grantHaunted(grant)` / `clearHauntedGrants(predicate?)` | 同上 | 05102「每个地点获得：闹鬼 - 受到 1 点恐惧」、05100 附属地点的授予 |
| 窗口 `haunted`（interrupt） | `src/engine/windows.js` | 取消/替代整次结算：描述子 `{ kind: 'interrupt', trigger: 'window:haunted', resolve: ({ context }) => { context.cancelled = true } }` |
| 失败窗口 | `src/engine/actions.js` 的 `doInvestigate` 失败分支 | 调查失败自动触发；`state.scenario.hauntedOn` 可把 `fight`/`evade` 也纳入自动结算 |
| 章节脚本 | `scenarioBehavior(state).hauntedScript?.(state, payload, api)` | `script` 子句 |

授予能力写在 `state.hauntedGrants = [{ locationId: 'all' | '<id>', ability }]`，只存纯 JSON；
`hauntedAbilitiesAt` 把印刷能力排在授予能力之前。

### 结算行为

1. 没有闹鬼能力 → 空操作（不写日志、不开窗口）。
2. 开 `haunted` 窗口；`context.cancelled` 为真 → 整次取消，日志写「闹鬼能力被取消」。
3. 每条能力先判「有没有合法目标」（弃手牌需要手牌、弃支援需要支援、`placeClue` 需要线索、`attack` 需要敌人等）；
   全部没有目标时记录「没有合法目标，跳过」。
4. 多条可用能力 → `requestChoice({ kind: 'haunted' })` 让玩家选下一条，选过的移除，直到全部结算。
5. `times > 1` 时整轮重复（05257 一类「结算两次」）。
6. 调查员被击败/撤退 → 立即停止，返回 `reason: 'eliminated'`。
7. `resolveAfterFailedAction` 默认只认 `investigate`；`state.scenario.hauntedOn = ['investigate','fight','evade']` 可扩。

### 测试与证据

- `tests/tcu-primitives-haunted.test.mjs`（18 例，`fast` tier）：注册期校验、加载期校验、读取点、`times=2`、
  顺序、取消、无能力、无合法目标、`choice`、资源溢出转恐惧、`script` 缺实现记账、失败窗口三类、
  真实引擎里的调查失败触发/成功不触发/复数能力待决选择/forced 取消/存档往返。
- `npm run audit:tcu:primitives` 复算 `primitive-plan.json` 的 `status`；`--check` 与磁盘比对。
- 对既有卡零行为变化：`node tools/replay-fixtures.mjs --compare artifacts/migration/tcu/replay-before.json`
  （13 局 / 786 步）；`npm run test:fast` 无新增失败。

## P2.2 幽灵界第二遭遇牌堆

**已实现。** 落点：`src/engine/alt-decks.js`（纯数据操作）、`src/engine/encounter.js`（参数化抽牌）、
`src/engine/scenario-runtime.js`（内容层接口）、`src/engine/setup.js`（逐关重置）、`src/cards/campaign-view.js`（公开投影）。

- 状态：`state.extraEncounterDecks = { spectral: { deck: string[], discard: string[] } }`，纯 JSON；未建堆的关卡没有这个键（不给旧战役新增状态字段）。
- 纯函数：`setExtraEncounterDeck(state, id, codes, { shuffle })`（去重 + 洗牌）、`addToExtraEncounterDeck`（默认牌库底 / `top` 牌库顶）、
  `shuffleIntoExtraEncounterDeck`、`drawFromExtraEncounterDeck`（牌库空时把弃牌堆洗回；两堆都空返回 `null`）、
  `discardTopOfExtraEncounterDeck`、`discardFromExtraEncounterDeck`、`extraEncounterDeckInfo`（只给张数与弃牌堆副本）。
- 抽牌管线：`drawEncounter(state, inv, events, { deck: 'spectral' })` / `drawExtraEncounter(...)` 与普通遭遇牌共用
  取消、重抽、涌动、敌人生成、诡计结算同一条路径；不传 `deck` 时行为逐字不变。
- 内容层：`api.extraDeck(id, codes)`、`api.addExtra`、`api.shuffleExtra`、`api.drawExtra(seat, id)`、`api.discardExtra(id, n)`、
  `api.discardExtraCards(id, codes)`、`api.extraDeckInfo(id)`、`api.extraDecks()`。
- 投影：`campaignProjection` 只对建过堆的关卡输出 `spectral: { deck, discard }`，牌堆顺序永不外泄。
- 测试：`tests/tcu-primitives-spectral-deck.test.mjs`（12 例）。

## P2.3 幽灵地点与翻面

**已实现。** 落点：`src/engine/locations.js`（读点 + 翻面 + 注册期校验）、`src/engine/scenario-runtime.js`、
`content/registry.js`（注册期校验）、`src/cards/campaign-view.js`。

- 数据：单面幽灵地点写 `spectral: true`；双面幽灵地点写 `back: { code, name?, subname?, clues? }`（`back` 是幽灵面）。
  线索与毁灭翻面时保留（印刷规则），只替换印刷字段；正面字段在首次翻面时快照进 `loc.front`。
- 读点：`spectralFaceOf(location)`、`isSpectralLocation(state, id)`；
  内容层 `api.flipSpectral(id, seat)`、`api.isSpectral(id)`、`api.spectralFace(id)`。
  非幽灵地点对幽灵敌人的目标限制由章节的 `canFightEnemy` 读 `isSpectral` 实现（不新增全局规则）。
- 行为钩子顺序：`locationWillFlip`（翻面前）→ 应用数据 → `locationStory` → `locationFlipped`（与 `flipScenarioLocation` 同序）。
- 注册期校验：`normalizeScenarioSpectralLocations` 在 `content/registry.js` 装配内容时校验 `spectral`/`back` 形状。
- 测试：`tests/tcu-primitives-spectral-location.test.mjs`（7 例）。

## P2.4 塔罗牌组（22 张大阿卡纳）

**已实现。** 落点：`src/engine/tarot.js`、`src/engine/scenario-runtime.js`、`src/engine/setup.js`、`src/cards/campaign-view.js`。

- 状态：`state.scenarioDecks.tarot = { deck: number[], drawn: [{ arcana, orientation }], discarded: number[] }`；未建堆时不建键。
- 纯函数：`buildTarotDeck`（22 张唯一、注入 `shuffle`）、`drawTarot`（从牌库顶抽、正逆位、不自动洗回）、
  `chooseTarot`（抽 N 选 1，未选中的放回牌库底）、`shuffleTarotIntoDeck`、`discardDrawnTarot`、
  `tarotOrientation`（`upright`/`reverse`/`random`，`random` 用注入的随机源）、`tarotRemaining`、`tarotInfo`。
- 内容层：`api.tarot.{build,draw,choose,shuffleInto,discard,remaining,info}`、`api.tarotRemaining()`、`api.tarotInfo()`。
  随机只走 `randomValue`（`shuffle` 与正逆位两个注入点），因此可确定性单测。
- 投影：`campaignProjection` 只对建过牌组的关卡输出 `tarot: { deck, drawn, discarded }`，牌库顺序不投影。
- 测试：`tests/tcu-primitives-tarot.test.mjs`（10 例）。

## P2.5 阵法（多技能合成检定）

**已实现。** 落点：`src/engine/tests.js`（`normalizeTestSkills`/`testSkillLabel` + 多技能求和与 `actionKind`）、
`src/engine/stats.js`（`iconValue`/`commitIcons` 接受技能数组）。

- `performTest(state, seat, skill, difficulty, options)` 的 `skill` 可以是单个技能名或 2–4 个技能名的数组：
  检定值 = 各技能值之和（`options.baseValue` 仍可整体覆盖），难度照常比较，投入的卡牌匹配任一技能即计入图标，
  万能图标只算一次（`iconValue` 先算 wild，再累加各技能）。
- 单技能调用：`normalizeTestSkills` 得到 `['<skill>']`，标签、数值、`source` 标识与旧实现逐字一致
  （`source` 仍用英文技能 id，避免改日志/状态）；`state.skillTest` 不新增字段。
- `options.actionKind`（例如 `'circle'`）记在 `state.skillTest.actionKind` 与 `testBegins` 上下文里，
  卡面/混乱标记可以据此判断「本次检定在阵法行动期间」；不传时记录里没有该字段。
- 测试：`tests/tcu-primitives-circle.test.mjs`（9 例，含合成、难度、单技能零变化、actionKind、图标求和、失败窗口）；replay 13 局零变化。

## P2.6 序章无牌组故事调查员

**已实现。** 落点：`src/engine/story-investigators.js`（选人/划掉/换人/无牌组准备）、`src/engine/setup.js`
（`startScenario` 选人 + `prepareInvestigator` 无牌组分支）、`src/engine/deck-ops.js`（抽牌拦截）、
`src/engine/table-decisions.js`（跳过换起始手牌）、`content/scenario-declaration.js`（`setup.storyInvestigators` 透传）、
`content/registry.js`（注册期校验）、`src/cards/campaign-view.js`（公开投影）。

- 声明（关卡 definition）：`setup: { storyInvestigators: { codes, crossOutUnused?, setupCards?, prompt? } }`。
- 状态：`state.storyInvestigators = { config, chosen: [{ seat, code, name }], crossedOut, originals }`，纯 JSON；
  没有声明故事调查员的关卡不会出现这个键（旧战役指纹不变）。
- 流程：`startScenario` 在 `prepareInvestigator` 之前——本章声明了就**每座位各选一次**（已选 code 不可重复，
  人数少于 4 时未选者划掉），没声明且上一章是序章时 `restoreStoryInvestigators` 换回原本的调查员。
- 无牌组：`prepareStoryInvestigator` 清空 deck/hand/discard/beneath 并标记 `storyInvestigator`/`noDeck`；
  `drawCards` 记「没有牌组，不能抽牌」，`runMulligans` 直接跳过，专属设置卡直接入场且不占 30 张。
- 投影：`campaignProjection.storyInvestigators = { chosen, crossedOut }`（桌面公开信息）。
- 测试：`tests/tcu-primitives-story-investigators.test.mjs`（10 例：注册期校验、1–4 人、重复选择、划掉开关、
  人数溢出、无牌组准备、抽牌拦截、换回、投影、存档往返、无牌组仍可调查）。
- 未覆盖（P8 垂直切片）：真实的 `startScenario` 全链路（选人 → 建局 → 进入序章）需要 P1 的 `tcuCampaign` 包与 9 章占位；
  以及 AI 在选人窗口上的偏好。

## P2.7 通用谈判（Parley）

**已实现。** 落点：`src/engine/parley.js`（纯函数：读点、枚举、目标校验）、`src/engine/moves.js`（legalMoves /
validateMove）、`src/engine/dispatch.js`（执行与借机攻击豁免）、`src/engine/ability-exec.js`（`doEntityAbility`）、
`src/engine/ability.js`（非玩家实体的 action 描述子只允许带 actionKind）、`src/engine/table-decisions.js`（actionKind 读点）。

- 声明（非玩家条目的 abilities 里）：`{ kind: 'action', actionKind: 'parley', label, cost: { action: 1 }, target?, resolve }`。
  地点 / 敌人 / 剧情资产都可以声明；带 `target` 时按目标逐条展开，执行前用同一份 `enumerateTargets` 校验。
- 读点：`isParleyDescriptor`、`entityParleyDescriptors`、`parleyMovesFor`、`parleyTargetError`、`isParleyCard`（构筑用）。
- legalMoves：本地点、同地点敌人、同地点剧情资产的谈判行动都会出现（AI 与人类同一份列表）；
  带 `criteria` 的能力条件不满足时不出现。
- 执行：`doEntityAbility` 走能力层同一条 `executeDescriptor`（费用 / 上限 / 日志 / 目标注入共用），
  消耗 1 个行动点；**不引发借机攻击**（dispatch 把 `actionKind: 'parley'` 与 entityAbility 视为豁免）。
- actionKind 读点：`actionKind()` 先读描述子的 `actionKind`，再回落旧的 `countsAs`。
- 构筑：`isParleyCard(card, code)` 读卡面文本（谈判 / Parley）或条目里的谈判能力；普雷斯顿这类
  「可带谈判卡」的构筑规则在 M1（P6）接入，本步只提供读点。
- 测试：`tests/tcu-primitives-parley.test.mjs`（9 例：读点、实体声明、构筑读点、legalMoves、目标展开与校验、
  执行与借机攻击对照、实体不在场、criteria 过滤）。

## P2.8 绑定（Bonded）

**已实现。** 落点：`src/engine/bonded.js`（数据解析 + 场外集合 + 检索/收回 + 公开投影）、
`src/engine/engine.js`（`retrieveBonded`/`returnBonded`/`returnAllBonded`/`bondedProjection`）、
`src/engine/api-card.js`（`ctx.api.bonded.group/retrieve/return`）、`src/engine/setup.js`（章节开始时收回散落副本）、
`src/cards/campaign-view.js`（公开投影）。

- 数据：主卡 `bondedCards: [{ code, count }]`；副本 `bondedTo`/`bondedCount`。引擎不认卡号——
  主卡/副本关系、张数全部来自卡面字段（`bondedCardList`/`findBondedMain`）。
- 状态：`state.bondedSets = { '<主卡号>': { seat, cards: [...], retrieved } }`，只存**场外**剩下的副本；
  没有绑定集合的关卡不新增状态键（旧战役指纹不变）。
- 入场：`retrieveBonded(state, inv, mainCode)` 取出全部副本——默认 1 张入手、其余洗回牌库（随机只走 `randomValue`）；
  场外集合清空并标记 `retrieved`，重复入场不会重复检索。
- 离场/换章：`returnBonded` 从手牌/牌库/弃牌堆/`beneath`/场上/威胁区收回该组副本；
  `returnAllBonded` 在 `startScenario` 里对每个已知集合扫一遍所有调查员（章节结束的兜底）。
- 构筑：绑定副本不在 30 张牌库里（卡面 `bondedTo` 的牌不会被当作普通牌库卡计入），本步不需要改构筑计数。
- 投影：`campaignProjection.bonded`（只在有集合时出现）给出 `{ seat, cards, retrieved }`——桌面公开信息。
- 测试：`tests/tcu-primitives-bonded.test.mjs`（9 例：数据读点、入场 1+2、离场收回、两组互不影响、
  一次性收回、存档、注入洗牌、`ctx.api.bonded` 真实能力、投影）。

## P2.9 塔罗槽位与开局入场

**已实现。** 落点：`src/engine/tarot-slot.js`（槽位读数、开局入场、手牌封锁、换牌保护）、
`src/engine/setup.js`（抽完起始手牌后放置入场）、`src/engine/tests.js`（投入候选过滤）、
`src/engine/table-decisions.js`（换牌候选过滤）、`src/engine/ability.js`（三个条目级布尔标记）。

- 槽位：7 张玩家塔罗卡都是 `Tarot` 槽位的普通牌库卡；默认容量 1（`TAROT_SLOT_BASE`），
  额外槽位只走修正管线 `add:slot+value:'tarot'`（安娜·卡斯洛 +2、月光吊坠 +1）。
  读点：`isTarotCard`（可传卡面查询函数，资产实例只带 code）、`tarotSlotUsage`、`tarotSlotCapacity`、
  `tarotSlotInfo`；「超槽」仍由引擎的 `canEquip` 统一判定，本模块不重复实现装备规则。
- 开局入场：条目声明 `entersPlayFromOpeningHand: true` —— 起始手牌里有它就放置入场（不付费用）；
  读点 `openingHandEntries` / `enterOpeningHandCards`（引擎在 `drawOpeningHand` 之后调用，导出同名包装供测试）。
- 手牌封锁（高塔）：条目声明 `blocksCommitWhileInHand: true` —— 它在手牌里时你不能投入任何卡牌；
  `handCommitBlocker` 是 `tests.js` 投入候选过滤的唯一读点（只封锁本人的投入，不影响队友协助）。
- 换牌保护（高塔）：`cannotMulliganAway: true` —— 起始手牌抽到后不能被换掉；
  `mulliganCandidates` 是 `runMulligans` 的唯一读点。
- 构筑：塔罗是普通牌库卡（占槽位、计入 30 张）；绑定/永久/卓越等既有规则不变。
- 测试：`tests/tcu-primitives-tarot-slot.test.mjs`（8 例：槽位读数、加槽、超槽、开局入场、
  手牌封锁的真实投入窗口、换牌保护、7 张真实卡面、存档读数）。

## P2.10 遗留记忆 / 看守人 / 战役资产

**已实现。** 落点：`src/campaign/mementos.js`（Memento 词表与记录读写、看守人记录、公开投影）、
`src/campaign/campaign-effects.js`（`addCampaignCardToDeck` 效果）、`src/engine/scenario-runtime.js`（`api.campaignCard`）、
`src/cards/campaign-view.js`（`mementos`/`watcher` 投影，非空才出现）。

- Memento：10 个稳定 id（参考实现枚举）；`recordMemento`/`crossOffMemento` 写 `mementosDiscovered: string[]`，
  `mementoCount` 供幕间/结局的数量分支；未知 id 直接失败。
- 看守人：`youAreBeingHunted`（座位）与 `wasTakenByTheWatcher`（调查员卡号）两个 `string[]` 记录；
  `markHunted`/`clearHunted`/`isBeingHunted`/`markTakenByWatcher`/`takenByWatcher`。跨章追踪与公开提示都读这一层。
- 战役资产：`applyCampaignEffect({ type: 'addCampaignCardToDeck', code, seat|seats, reason })` 走
  `campaignCardChange(campaign, seat, code, 'add')`——加入战役牌组（排序、下一章带入、不占 30 张）；
  卡号无效时抛错。内容层也可用 `api.campaignCard(code, seat, reason)`。
- 投影：`campaignProjection.mementos` 与 `campaignProjection.watcher = { huntedSeats, taken }`（公开信息）。
- 测试：`tests/tcu-primitives-campaign-records.test.mjs`（6 例：词表、发现/重复/划掉/数量、看守人跨章与存档、
  投影、战役资产入牌组与错误路径、多人 seats）。

## P2.11 裂口与地点布尔状态

**已实现。** 落点：`src/engine/location-state.js`（裂口/标记/骷髅值/公开投影）、
`src/engine/scenario-runtime.js`（`breach/removeBreach/breachOf/breachTotal/skullValue/locationFlag/setLocationFlag/hasLocationFlag`）、
`src/cards/campaign-view.js`（`locations` 投影，只含有标记的地点）。

- 状态：地点实例上的 `breaches: number`（缺省 0、上限 3）与 `flags: { brazier: boolean }`，纯 JSON。
- 读点：`addBreach`/`removeBreach`（含上限与旧存档容错）、`breachTotal`、`locationSkullValue`（裂口 + 地点毁灭）、
  `locationFlagOf`/`setLocationFlag`/`locationFlagsOf`（词表只有 `brazier`，未知标记立即失败）。
- 投影：`campaignProjection.locationStates[<locationId>] = { breaches?, flags? }`，非空才出现。
  键名不能叫 `locations`：观察投影里的 `view.locations` 是地点数组，同名会把牌桌地图覆盖成 id 表（P5 修正）。
- 测试：`tests/tcu-primitives-location-state.test.mjs`（6 例：词表/上限、增减与容错、骷髅值、火盆、存档、投影）。

## P2.12 异端者多面与放逐

**已实现。** 落点：`src/engine/enemy-faces.js`（面表/换面/放逐/不能击败读点）、
`src/engine/engine.js`（导出包装 + 剧本运行时依赖）、`src/engine/scenario-runtime.js`（`flipEnemy/enemyFace/banish`）。

- 数据：敌人定义或实例上的 `faces = [{ code, side: 'enemy' | 'unfinishedBusiness' }]` 与当前 `side`；
  面的代码、属性来自关卡数据/卡面定义（引擎不认卡号）。
- 换面：敌人面 → 未了之事面时离场、解除交战、剧情卡进入持有者威胁区；反向时移除威胁区剧情卡、
  换回敌人属性并回到敌人列表。`flipEnemyFace` 返回 `{ side, code, changed }`，同一面不重复翻。
- 放逐：`banishEnemyToVictory` 解除交战、移出敌人列表、进胜利展示区（有胜利点由 `addVictory` 结算），
  不进遭遇弃牌堆——「不能以任何方式被击败」的卡由此离场。
- 不能击败：`enemyCannotBeDefeated(enemy)` 是卡面 `cannotBeDefeated` 的统一读点（沿用既有 `enemyDef` 字段）。
- 测试：`tests/tcu-primitives-enemy-faces.test.mjs`（6 例：读点、双面翻面、放逐与胜利点、存档、运行时接口）。

## P2.13 Cosmos / 未知地点牌库

**已实现。** 落点：`src/engine/alt-decks.js`（地点牌库的建堆/抽/选/洗回/弃置/公开读数）、
`src/engine/scenario-runtime.js`（`api.cosmos` / `api.locationDeck`）。

- 状态：`state.extraLocationDecks = { cosmos|unknownPlaces: { deck: [地点定义 id], discard: [] } }`；
  牌库顺序是隐藏信息，公开投影只给张数（放置后的地点才公开）。
- 建堆：`buildScenarioLocationDeck(state, id, ids, { shuffle })`（去重 + 注入洗牌）；
  `EXTRA_LOCATION_DECKS = ['cosmos', 'unknownPlaces']`，未知 id 立即失败。
- 抽/选：`drawScenarioLocationDeck`（牌库空时把弃牌堆洗回）、`chooseScenarioLocationDeck`（抽 X 选 1，
  未选中的放回牌库底，顺序保留）。
- 洗回/弃置：`shuffleScenarioLocationIntoDeck`（Void 地点）、`discardScenarioLocation`、`resetExtraLocationDecks`。
- 内容层：`api.cosmos({ build|draw|shuffle|discard|take, id, seat, from })` —— `take` 会抽 X 选 1、
  用 `placeLocation` 放置入场，并在给了 `from` 时把原地点上的调查员与敌人一起搬过去。
- 测试：`tests/tcu-primitives-cosmos.test.mjs`（6 例：词表/建堆、抽取与洗回、抽 X 选 1、洗回/弃置/重置、
  存档与投影、运行时接口）。

## 全部原语已完成（14/14）

§4.1 的 13 个原语在 P3 交付，第 14 个 `hunchDeck`（直觉牌库）随 P6 的 M1 调查员批次补上：
20 个 `type=primitive` 机制全部由原语覆盖（`deferred` 归零）。审计命令 `npm run audit:tcu:primitives`
现在应通过；任何 `pending` 或门禁失败都说明代码与本文不一致。

| 步 | 原语 | 落点 | 覆盖机制 |
| --- | --- | --- | --- |
| P6 | 直觉牌库（调查员专属牌库） | [`tcu-investigators.md#31-直觉牌库乔戴蒙德`](tcu-investigators.md#31-直觉牌库乔戴蒙德)、`src/engine/hunch-deck.js` | `hunchDeck` |

`hunchDeck` 不在引擎的通用牌库层（`alt-decks.js`）：它是「调查员专属牌库」这一层，卡面只声明
`investigator.hunchDeck = { size, trait, requiredCodes, discount }`，结算集中在 `src/engine/hunch-deck.js`，
配额在 `src/deck/deckbuilding.js`，公开投影在 `src/cards/campaign-view.js`。
