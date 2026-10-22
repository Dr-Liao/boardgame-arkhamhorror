# 卡牌模型 v1（重构路线 §10 第 2 项）

> 日期：2026-02。这是**模型规格**，不是实现说明：它定义"一张卡的行为可以写成什么"，
> 后续迁移（Phase 1/2/5）按它写，注册表按它校验。
> 稳态架构见 [`../ARCHITECTURE.md`](../ARCHITECTURE.md)，阶段与判据见
> [`architecture-refactor-roadmap.md`](architecture-refactor-roadmap.md)，内容迁移流程见
> [`arkham-content-migration.md`](arkham-content-migration.md)，
> Phase 2 八项原语的用法与对照表见 [`phase2-primitives.md`](phase2-primitives.md)。

---

## 1. 一条原则

**卡 = 数据 + 声明式行为。** 行为只有一种写法：单卡文件里的**单卡条目**（一张卡一个文件）。
玩家卡在 `src/cards/entries/<code>.js`；非玩家卡在 `src/cards/encounter-entries/`（通用 / 战役共用 /
关卡专用三档，见 [`card-entry-files.md`](card-entry-files.md) §2.1）。`card-abilities.js` 与
`encounter-abilities.js` 都只做聚合，不再放条目。
条目里没有函数式逃生口以外的自由度——数据是纯 JSON，`resolve` 只在"数据表达不了"时出现，
且只能通过 `ctx.api` 改状态。拆分流程与 agent 一次执行清单见
[`card-entry-files.md`](card-entry-files.md)。

三层，自外向内：

| 层 | 放什么 | 谁读 |
| --- | --- | --- |
| **卡面数据** | 名字、类型、费用、槽位、图标、文本 | `cards-data.js`（导入生成，不手改） |
| **声明式行为**（本文） | `modifiers`（常驻修正）+ `abilities`（生命周期钩子） | 引擎按窗口/读点枚举 |
| **运行期状态** | `state.effects[]`、`state.abilityLimits`、实例字段 | 只写进 `state`，随存档往返 |

不允许第四层：**不得**在 `engine.js` 按卡号分支，**不得**把行为写进 `content/**.js` 的命令式钩子
（例外：剧本流程、布置与结局仍属 `behavior.js`；单卡规则写 `encounter-entries/`，见 §6）。

---

## 2. 条目形状

```js
{
  code: '01518',                 // cards-data.js 里的卡号，必填且唯一
  name: '巡警',                   // 可选，仅用于审计报告
  uses: 3, usesType: 'supplies', // 可选：带「使用」的资产（实例在 state 上带 uses）
  discardWhenEmpty: true,        // 可选：使用次数归零后弃置（D2，Phase 5）
  fast: true,                    // 可选：资产/调查员的「快速」关键字（事件卡写在 played 描述子上）
  noOpportunityAttack: true,     // 可选：打出不引发借机攻击（同上）
  playCondition: [ ... ],        // 可选：能不能打出（见 §5）
  modifiers: [ ... ],            // 可选：常驻修正（见 §4）
  abilities: [ ... ],            // 可选：生命周期钩子（见 §3）
  elderSign: { resolve(ctx) {} } // 可选：调查员旧印（kind 固定为 investigator）
}
```

使用次数元数据三件套（`uses` / `usesType` / `discardWhenEmpty`）是**条目级**字段，
读点只有三处：`newPlayerAssetInstance`（实例初始化）、`assetEffect`（补充弹药、充能耗尽、
界面文字）与 `executeDescriptor`（用完即弃）。旧 DSL 的同名字段仍在回落路径上，
迁移时整组搬走即可（Phase 5 的 5b-5 批次就是这么做的）。

注册即校验：未知字段、未知 `kind`、缺必填 payload、重复注册、未注册的窗口 id
都在模块加载时失败，而不是对局中途静默失效。描述子注册后 `Object.freeze`。

---

## 3. 十一个 `kind`

`kind` 决定"什么时候可用"和"谁来枚举它"。十一种是目前的全集，加第十二种必须同时改本文、
`ABILITY_KINDS` 与 `tests/architecture-guard.test.mjs` 的冻结表。

| kind | 时机 | 消耗行动 | 引擎读点 | payload |
| --- | --- | --- | --- | --- |
| `action` | 自己回合主动使用 | 1（`cost.action:false` 免） | `legalMoves` / 牌桌按钮 / `doAbility` | `resolve` |
| `free` | `trigger` 指定的**玩家窗口**内 | 0 | `playerWindow` | `resolve` |
| `reaction` | `trigger` 指定的事件窗口**之后** | 0 | `reactionWindow` / `triggerReaction` | `resolve` |
| `forced` | `trigger` 窗口**自动**结算 | 0 | 同上（不问询） | `resolve` |
| `constant` | 不触发，只提供修正 | — | `modifiers` 管线 | `modifiers` |
| `elderSign` | 旧印投入 | — | `elderSignDescriptor` | `resolve` |
| **`played`** | 事件卡打出 | 由卡面决定 | `lifecycle.playedEffect(code)` | `effect`（效果 DSL 纯数据） |
| **`commit`** | 投入技能检定 | 0 | `lifecycle.commitProfile(code)` | `skill`（检定档案） |
| **`weakness`** | 弱点揭示 | — | `lifecycle.weaknessProfile(code)` | `weakness`；可加 `resolve` 自定义结算 |
| **`entersPlay`** | 支援放置入场 | — | `lifecycle.entersPlayEffect(code)` | `entersPlay`（效果 DSL） |
| **`leavesPlay`** | 支援离开场上 | — | `lifecycle.leavesPlayEffect(code)` | `leavesPlay`（效果 DSL） |
| **`setup`** | 开局效果（永久卡，如「原定计划」） | — | 引擎开局循环的 `descriptorOfKind(code, 'setup')` | `EFFECTS[code].setup`（效果 DSL，回退路径） |

**五个生命周期钩子**替代旧的 `EFFECTS[code].event` / `.skill` / `.weakness` / `.onEnter` 与引擎内联的
离场特判。它们不带 `trigger`，也不产生牌桌按钮；读点函数在描述子缺失时回落到 `EFFECTS`，因此
**迁移一张卡不需要改引擎**。`weakness` 描述子带 `resolve` 时接管整段揭示结算，不进入引擎的类型分支。

### 3.1 生命周期读点的契约

`src/engine/lifecycle.js` 是这五类行为的唯一入口：

```js
playedEffect(code)      // → 效果 DSL 对象 | null
commitProfile(code)     // → 检定档案对象 | null
weaknessProfile(code)   // → 弱点档案对象 | null
entersPlayEffect(code)  // → 效果 DSL 对象 | null
leavesPlayEffect(code)  // → 效果 DSL 对象 | null
lifecycleChannel(code)  // → { played, commit, weakness, entersPlay, leavesPlay }，各为 'descriptor'|'legacy'|null（审计用）
```

- 返回值必须是**纯数据**，不返回函数、不读 `state`，因此可以在 `legalMoves`、校验与结算里反复调用；
- 描述子优先于 `EFFECTS`：迁移 = 把数据搬进描述子 + 删掉旧条目；
- 一处读点漏改的后果是"某条路径仍读旧通道"，由 `tests/card-lifecycle.test.mjs` 的通道断言兜住。

### 3.2 目标枚举（`target`）

需要先选目标的能力在描述子上声明：

```js
target: { kind: 'enemy' }
target: { kind: 'investigator', optional: true }
target: { kind: 'location', query: ctx => ctx.candidate.entity.clues > 0 }
```

`kind`：`enemy`（同地点）/ `investigator`（同地点，含自己）/ `location`（当前 + 连接）/ `asset`（自己控制的支援与威胁卡）/
`cardInHand`（手牌卡号去重）。`query` 是 matcher predicate 或数组，ctx 带 `candidate = { id, label, kind, entity }`，
只能收窄默认候选集合。`legalMoves` 会为每个候选生成一条带 `targetId` 的行动，`validateMove` 用同一份枚举校验，
执行时 `ctx.target` / `ctx.targetId` 直接可用。没有合法目标且非 `optional` 时这条能力不出现。

### 3.3 持续效果（`state.effects`，A1）

```js
api.addEffect({
  duration: 'endOfPhase',
  label: '本阶段战斗 +2',
  modifiers: [{ target: 'skill:combat', amount: 2 }],
  abilities: [{ kind: 'reaction', trigger: 'defeatEnemy', label: '抽 1 张', effect: { type: 'draw', amount: 1 } }],
  sourceCode, sourceInstanceId, controllerSeat,
})
```

`duration`：`endOfTest` / `endOfTurn` / `endOfPhase` / `endOfRound` / `whilstAttached` / `untilLeavesPlay`。
过期唯一入口是 `expireEffects(state, timing)`（`src/engine/effect-state.js`）；来源离场由引擎调用
`removeEffectsFromSource`。效果记录必须**纯 JSON**：`modifiers` 可以是声明式条件对象，`abilities` 只能是
`reaction`/`forced` + `effect` 数据体（写 `resolve` 会在注册时直接报错，因为事务克隆会丢函数）。

---

## 4. 修正（`modifiers`）

```js
{ target: 'skill:combat', amount: 1 }
{ target: 'skill:*', amount: -1, condition: { damageAtLeast: 5 } }
{ target: 'slot:arcane', amount: 1 }
{ target: 'playCost', amount: 1, condition: { sourceInHand: true } }
{ target: 'enemyHealth', amount: ({ state }) => -state.numInvestigators, condition: { blankedThisRound: true } }
```

| 字段 | 取值 |
| --- | --- |
| `target` | 数值：`skill:<name>` / `skill:*` / `maxHealth` / `maxSanity` / `handSize` / `actions` / `slot:<slot>` / `playCost` / `enemyHealth`<br>布尔（Phase 2，见 §4.1）：`capability:<id>` / `ignore:<id>`<br>授予（Phase 2，见 §4.2）：`add:trait` / `add:keyword` / `add:slot` / `add:skillIcon` |
| `amount` | 数字，或 `({ state, inv, controller, source }) => number`；`capability`/`ignore`/`add:*` 可省略（默认 1，0 表示不生效） |
| `value` | `add:*` 的授予名（特性/关键词/槽位/技能图标），必填 |
| `audience` | `controller`（默认）/ `here`（同地点所有调查员） |
| `condition` | 声明式条件：`damageAtLeast`、`atTrait`、`resourcesAtMost`、`controllerHasNoThreat`、`sealedWithSource`、`sourceInHand`、`blankedThisRound`、`when(ctx)` 逃生口 |

文本被清空的来源（02088、04099）整体跳过修正，与旧 `assetEffect` 口径一致。
修正必须在**读点**统一叠加（`statPipeline`），不得在读取处写 `if`。
持续效果的 `modifiers` 与卡面修正走同一条管线，只是多了一个到期时间；读点是
`effect-state.effectModifiers`，由引擎通过 `setModifierHooks` 注入（避免 `modifiers.js` 反向 import）。

### 4.1 布尔修正（C1，Phase 2）

```js
{ target: 'capability:investigate' }                       // 不能调查
{ target: 'ignore:retaliate' }                             // 你的攻击落空不触发反击
{ target: 'ignore:opportunityAttack', condition: { inPhase: 'investigation' } }
```

- 能力禁止：`investigate` / `fight` / `evade` / `move` / `draw` / `play` / `triggerAbilities` /
  `locationAbility` / `commit` / `resign` / `discoverClue`；
- 规则无视：`retaliate` / `alert` / `hunter` / `opportunityAttack`；
- 读点：`capabilityBlocked()` / `ruleIgnored()` / `modifierBlocked()`，与数值修正共用同一份
  来源枚举（因此"文本空白""同地点受益""效果到期"的口径完全一致）；
- **注册即校验**：未知的 `capability:*` / `ignore:*` id 在注册期报错——不提供"能写但不生效"的目标。

### 4.2 授予修正（C2，Phase 2）

```js
{ target: 'add:trait', value: 'Tome' }        // 这张卡在运行期获得特性
{ target: 'add:keyword', value: 'fast' }      // 或 noOpportunityAttack
{ target: 'add:slot', value: 'arcane' }       // 额外槽位（与 slot:arcane 同一读点）
{ target: 'add:skillIcon', value: 'combat' }  // 投入时多 1 个战斗图标
```

授予**只作用于声明它的那张卡**（`collectGrants(state, inv, kind, { code })` 会比对来源 code），
并合并进原本的读点：`effectiveTraits()`、`cardKeyword()`、`commitIcons()`、`slotBonus()`。

---

## 5. 条件的唯一写法

`criteria` 是 predicate 数组，全满足才可用；组合子来自 `matcher.js`
（`ownSeat`、`atTrait`、`contextEnemy`、`all/any/none`…）。条件抛异常按"不满足"处理。

**打出条件**是另一个读点（`playCondition`），条目级声明：

```js
{ code: '02186', playCondition: [{ when: clueAtLocation(), message: '当前地点没有线索' }], ... }
```

组合子：`ownTurn` / `ownFirstAction` / `clueAtLocation` / `noEnemiesHere` / `remainingSanityAtLeast` /
`investigatorClues` / `resignAvailable`。旧 DSL 散落的 10 个可用性字段——`ownTurnOnly` / `duringOwnTurn` /
`firstActionOnly` / `requiresClue` / `requiresClueAtLocation` / `requiresNoEnemies` / `requiresRemainingSanity` /
`requiresResign` / `playableFromDiscard` / `playableWeakness`——由 `src/engine/play-condition.js` 的
`LEGACY_RULES` 表翻译成同样的 predicate，文案逐字保留；引擎只调用 `playConditionError()` / `playAccess()`，
不再逐字段读取。**不得再新增同类散字段**。

---

## 6. 内容来源（谁可以声明能力）

| 来源 | 现在 | 目标 |
| --- | --- | --- |
| 玩家卡（手牌/场上的支援/威胁区） | ✅ 描述子 | 保持 |
| 调查员（旧印、主动能力） | ✅ 描述子 + `INVESTIGATOR_ABILITIES` | 能力迁完后删旧表 |
| 敌人 / 诡计 / 地点 / 幕 / 议程 / 剧情资产 / 威胁 | ✅ 描述子（`scope` 非玩家通道） | 一卡一文件，已按通用 / 战役共用 / 关卡专用落点（`encounter-entries/`） |
| 剧本层机制 | `behavior.js`（命令式） | D3/D4 声明化（Phase 3） |

非玩家条目的归属与目录规则见 [`card-entry-files.md`](card-entry-files.md) §2.1；529 条存量条目的
迁移记录与对账证据见 [`encounter-entry-split-plan.md`](encounter-entry-split-plan.md)。
`encounter-abilities.js` 现在只是 facade，新条目不得再写回该文件。

---

## 6.1 费用、上限与检定（Phase 2）

### 费用表达式（C3）

```js
cost: {
  action: true,
  resources: { per: 'clues' },                                   // 每有 1 个线索付 1 资源
  uses: { per: 'assets', filter: { usesType: 'ammo' }, max: 3 },  // 弹药支援数，最多 3
  clues: ({ inv }) => Math.min(2, inv.clues),                     // 函数逃生口
  horror: { x: true, amount: 2 },                                 // X 费读 state.abilityX
}
```

`per` 取值：`clues / resources / damage / horror / assets / investigators / enemiesHere /
usesOnSource / cardsInHand / cardsInDiscard / locationsConnected`；`amount / offset / min / max / filter`
可组合。数字与函数写法完全兼容旧内容。三个读点共用一份求值（`normalizeCostValues`）：
行动文案预览、`canAffordAbility` 校验、`payAbilityCost` 扣费；求值失败按"付不起"处理。

### 上限的作用域与归属（C4）

```js
limit: 'oncePerTurn'                                          // 旧写法
limit: { scope: 'perTurn', owner: 'instance' }                // 与上面等价
limit: { scope: 'perAttack', owner: 'group', count: 2 }
```

scope：`perTest / perTurn / perPhase / perRound / perGame / perCampaign / perWindow /
perAttack / perSearch / perAction`；owner：`instance / investigator / player / group`。
记账格式 `state.abilityLimits[key] = { used, round, phase, turn }`（旧存档的
`{ round, phase, turn }` 按 `used: 1` 兼容）。`describeLimit()` 给 AI/牌桌一份中文文案。

### 检定结果契约（B3）

```js
const result = api.test(inv.seat, 'willpower', 3, { resolve })
result.summary       // { seat, skill, difficulty, baseValue, value, success, autoFail, successBy, failedBy, drawn, cancelled, source, stage }
state.lastTestResult // 结算后仍可读，随存档往返
ctx.result           // 检定期间窗口里读 pendingTestResult()（半成品形状）
api.retryTest(inv.seat, { bonus: 2 })   // 同一 skill/difficulty/source 重跑
api.commitCards(inv.seat, ['01025'])    // 强制投入（不询问）
```

阶段词表在 `src/engine/test-result.js`：`beforeCommit`（ST.1–2）/ `afterCommit`（ST.3）/
`tokens`（ST.4–7）/ `results`（ST.8）。

### `ctx.api` 的 Phase 2 增量

```
harm({ damage, horror, strategy })               // B2：distribute / self / assetsFirst / soakFirst / assetsOnly
lookAt(seat, { zone, count, arrange, returnStrategy, choose, filter, targetSeat })   // B5
searchDeck(seat, { trait, type, usesType, count, choose, shuffle, optional })         // B5
moveCard({ code 或 id, from, to, attachTo, beneath, facedown })                      // B6
testResult() / describeTest() / testStage()      // B3
retryTest(seat, { bonus }) / commitCards(seat, codes)                                // B3
addPendingTestBonus(n) / returnClueToLocation(seat, n) / placeDoomOnCard(card, n) /
addAssetHorror(card, n) / setAssetUses(card, n) / discardTopOfDeck(seat, n) /
tempShroudMod(location, n) / moveClueToLocation(from, to, n) / removeThreat(card) /
drawEncounter(seat) / endTurn(seat) / cardIcons(code) / cardTraits(code) / describeLimit(descriptor)
```

---

## 7. 状态模型（Phase 1 已实现，Phase 2 扩展）

```js
state.effects = [{          // A1：持续效果与时长（已实现）
  id, sourceCode, sourceInstanceId, controllerSeat,
  duration: 'endOfTest' | 'endOfTurn' | 'endOfPhase' | 'endOfRound' | 'whilstAttached' | 'untilLeavesPlay',
  label, modifiers: [...], abilities: [...],
  createdAt: { round, phase, turnSerial },
}]
state.abilityLimits = { [key]: { used, round, phase, turn } }   // C4：上限按 (scope, owner) 记账
state.lastTestResult = { ... }                                   // B3：上一次检定的标准结果
state.history = { round: [...], phase: [...], turn: [...] }      // C6：本回合/本阶段做过什么（未交付）
```

统一过期点 `expireEffects(state, timing)`：时长链 `endOfTest < endOfTurn < endOfPhase < endOfRound`，
到点连同更短的时长一起清；`whilstAttached` / `untilLeavesPlay` 由来源实例绑定（`removeEffectsFromSource` +
"来源已不在场"的兜底清理）。效果进 `state` 之后 replay 才能覆盖"临时修正"，
`stateHash` 已把 `effects` 计入指纹。

已从旧散字段迁到效果实体的机制：`addStatPhase`（02185 的「本阶段 +1」）与 `fightOrFlight`（03155 的「本轮 +
恐惧值」）。`inv.phaseStatBonus`（单数）只作为旧存档兼容读取点保留。

---

## 8. 迁移一张卡的标准动作

1. 在 `src/cards/entries/<code>.js` 写条目（`played`/`commit`/`weakness`/`entersPlay`/`leavesPlay`/`action`/`modifiers`/`playCondition` 按需），并运行 `node tools/build-card-index.mjs --write`；新卡可用 `node tools/scaffold-card.mjs <code> --entry` 生成骨架；
2. 删掉 `EFFECTS[code]`（或它在 `content/packs/*/effects.js` 里的条目）与 `engine.js` 里的卡号分支；
3. 旧打出条件字段（`requiresClueAtLocation` 等）翻成条目的 `playCondition`，文案逐字保留；
4. 包清单声明 `abilityLayerCodes`（若该包的可用性依赖 handler 表，见 `content/packs/dunwichPlayer/manifest.js`；
   Phase 2 起 `carcosaPlayer/manifest.js` 也有这份清单——漏登记会让内容 schema 报
   "构筑开放需要规则实现"）；
5. 事件卡的 `fast` / `noOpportunityAttack` 写进描述子（`kind: 'played'` 的 `fast` / `noOpportunityAttack`，
   读点是引擎的 `cardPlayFlag()`），不要留在 `EFFECTS` 顶层；
5b. 用 `resolve` 实现的能力如果**不按普通行动结算**（例如「意志闪避」按躲避结算、不引发借机攻击），
   必须写 `countsAs: 'evade'`（或 `'fight'` 等）：旧式能力把这件事写在 `effect.kind` 上，描述子没有
   effect 数据体时会退化成普通行动。读点是 `actionKind()`（`actionPreview` 的借机攻击提示也读它）；
5c. **反应（`kind: 'reaction'`）的两种写法**：
   - 从 `EFFECTS[code].reactions` 搬过来的：`legacyReaction: true` + `trigger` + `criteria`（旧条件字段）
     + `cost` + `effect`（数据体）。引擎用旧式询问（`是否触发「X」的反应？`）加同一套费用/效果解释器结算，
     提示文案与状态指纹都不变；
   - 新写的：`resolve(ctx)`，走 `openAbilityWindow` 的「【能力】…」询问。
   同一张卡只用一种；`legacyReaction` 是 Phase 5 的过渡标记，Phase 6 删掉旧式询问后一起移除。
   读点是 `triggerReaction`（`descriptorReactionSpec`）与 `openAbilityWindow`（跳过 `legacyReaction`）；
6. 测试从"断言 `EFFECTS[code]` 的形状"改成"断言行为"，参照 `tests/card-lifecycle.test.mjs` 的三段式；
   已迁移的 21 张逃生卡另有一层通道断言（`tests/phase2-primitives.test.mjs` 的最后三条）；
7. 跑 `npm run cards:audit:write`（白名单收缩）+ `npm run test:fast`，指标下降即迁移成立的证据；
   若该卡属于有验收账本的战役，再按对应 `audit:*:acceptance` 重新生成账本哈希；
8. 用 replay 基线证明"行为零变化"：迁移前 `node tools/replay-fixtures.mjs --baseline <文件>`，
   改完 `--compare <文件>`（命令与判定口径见 [`phase4-replay.md`](phase4-replay.md) §4）。

**判据**：旧通道表达不了才迁；纯数据卡不迁成闭包（见路线文档 §7）。
