# 卡牌模型 v1

> 这是**模型规格**，不是阶段报告：它定义“一张卡的行为可以写成什么”，注册表按它校验。
> 稳态架构见 [`../ARCHITECTURE.md`](../ARCHITECTURE.md)，内容迁移流程见
> [`arkham-content-migration.md`](arkham-content-migration.md)，
> 开发命令见 [`card-entry-files.md`](card-entry-files.md)。

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

上面是新代码使用的核心形状。`ability.js` 的 `ENTRY_KEYS` 还列有迁移期遗留的扁平规则字段，其中部分只服务
单张旧卡；它们是兼容读点，不是新增内容的扩展目录。新机制必须优先进入已有的
`abilities` / `modifiers` / `playCondition` 或少量有类型的规则组，不得再增加以卡名、角色名命名的顶层布尔字段。
遗留字段的数量与清理进度由 `audit/card-entry-compliance.json` 跟踪。

使用次数元数据三件套（`uses` / `usesType` / `discardWhenEmpty`）是**条目级**字段，
读点只有三处：`newPlayerAssetInstance`（实例初始化）、`assetEffect`（补充弹药、充能耗尽、
界面文字）与 `executeDescriptor`（用完即弃）。旧 DSL 的同名字段仍在回落路径上，
迁移时整组搬走即可（Phase 5 的 5b-5 批次就是这么做的）。

注册即校验：未知字段、未知 `kind`、缺必填 payload、重复注册、未注册的窗口 id
都在模块加载时失败，而不是对局中途静默失效。描述子注册后 `Object.freeze`。

---

## 3. 十二个 `kind`

`kind` 决定“什么时候可用”和“谁来枚举它”。十二种是目前的全集，新增种类必须同时改本文、
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
| **`setup`** | 开局效果（永久卡等） | — | 引擎开局循环的 `descriptorOfKind(code, 'setup')` | `resolve` |

`setup` 是独立的开局钩子；**五个生命周期钩子**替代旧的 `EFFECTS[code].event` / `.skill` / `.weakness` / `.onEnter` 与引擎内联的
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

### 4.3 槽位容量（2026-10-26 原语收敛）

槽位判定只有两个读点：占用是 `assets.slotUsage(inv)`，装备判定是 `assets.canEquip(inv, card)`。
卡面只声明数据，不写判定；**候选卡（正在打出的那张）必须与在场卡走同一套口径**。

| 需求 | 声明字段 | 读点 / 语义 |
| --- | --- | --- |
| 通用额外槽（任何卡都能用） | 修正 `add:slot`（唯一入口；`slot:<slot>` 是同一读点的布尔形式） | `slotBonus()` → canEquip 容量；展示容量由 `card-defs` 从同一修正反推 |
| 受限额外槽（只放命中的卡） | `restrictedSlots: [{ slot, traitsAny?, unique?, count }]` | `restrictedSlotInfo`：容量只给命中谓词的候选；在场受限卡可移入受限槽，因此其占用要从普通槽里扣掉。`traitsAny` 按特性（01008 书位 / 02147 武器位 / 05112 法术位），`unique:false` 按独特性（04006 米奇「只放非独特盟友」） |
| 占用豁免（最多 N 张命中卡不占槽） | `slotExemptions: [{ slot, traitsAny?, count }]`（05009） | `slotExemptionRelief(inv, extraCards)`：在场卡与候选卡一起算豁免；字段/特性都可泛化，不再有「工具手槽」专用读点 |
| 实例不占槽（剧情支援改印表槽位） | 实例字段 `slots: []` | `slotUsage` / `restrictedSlotInfo` 优先读实例槽位 |

曾有 4 套并行写法（`extraSlots.handWeapon`、`tomeHandSlotsPerCopy`、`passive.handSlotsBonus`、以及只写不读的
`passive.handSlotsTrait`），盟友槽另有 `allySlotsForNonUnique` + `allySlotsOk` 旁路。它们各自在 `canEquip` 里写旁路，
导致 05009（工具豁免漏掉候选卡）、02147（武器专用槽漏掉「在场武器可让出普通槽」）两个 bug，并让
04006/01070/02157/02158 的展示与规则各写一份。现在：01008/02147/05112/04006 → `restrictedSlots`；
05009 → `slotExemptions`；01070/02157/02158 → `add:slot`；旧字段与 `allySlotsOk` 读路全部删除。
**不要**再为某张卡新增槽位专用字段，新卡按上表选择原语。展示侧的容量（装备面板格子）由
`card-defs.js` 从同一批声明派生 `extraSlots`（盟友受限槽派生 `allySlotsForNonUnique`），前端不再按卡号兜底。

**腾槽弃置（2026-10-31）**：打出/获得资产超出槽位时，`assetReplacementPlans(inv, card)` 只返回
「刚好够槽位」的最小弃置方案，且候选支援必须占用候选卡所需的槽位（`replacementCandidates`）。
支援离场只会减少某槽位的占用，或减少它自己提供的豁免/额外槽位，因此弃掉无关槽位的支援
（例如装手部武器时弃盟友）不可能让 `canEquip` 通过；`replaceAssets` 每轮按已选弃置重算方案，
弃到 `canEquip` 通过即停，不能顺手多弃。判定仍只有一个读点：`canEquip`。

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
迁移记录与对账证据保留在 `artifacts/` 与 git 历史中。
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

### 7.1 卡牌承载区（压在卡下面 / 附属在卡上）与「如同手牌」通道

「牌离开手牌与牌库、但仍属于某张卡或某位调查员」有这些存储形状。**「可以当作手牌打出/投入」
的语义统一由 `src/engine/play-channels.js` 一个原语声明**；新增存储形状时先看它能否落进
通道表，再补卡面表/观察投影/前端三处，否则表现是「读档后卡名变卡号」或「牌在场上但界面上无处可点」：

| 形状 | 谁在用 | 卡面表（`embeddedCardDefs`） | 观察投影 | 前端 |
| --- | --- | --- | --- | --- |
| `asset.attached` | 03264 原定计划（`cardPlan`） | 扫 | 随支援实例下发（`publicCardInstance`） | 角标计数 + 详情「附属卡」+ 宿主弹出「打出」 |
| `asset.attachedCards` | 04037 背包（`cardBackpack`） | 扫 | 同上 | 同上 |
| `asset.attachments` | 05279 黛雅娜·艾丝帕伦斯（`playAttachedEvents`）、05230 | 扫 | 同上 | 同上 |
| `inv.beneath` | 05004 黛安娜、03003 赛菲娜、03012 画中世界、05013 银暮匕首（`beneathPlayAsIfInHand`） | 只给本人 | 本人 `beneath: string[]`，全桌 `beneathCount: number` | 牌桌「下方」行 + 调查员详情「下方卡牌」+ 银暮匕首弹出「从底下打出」 |
| `inv.hunchDeck` / `inv.hunchRevealed` | 05002 乔·戴蒙德（`investigator.hunchDeck`，规则在 `hunch-deck.js`） | 牌库只给本人；已揭示那张给全桌 | `view.hunch[] = { seat, deck, revealed }`（顺序不外泄） | 牌桌「直觉 N」行 + 揭示那张的「从直觉牌库打出」 |
| `inv.discard` / `inv.threat` | `playableFromDiscard`（临时武器/温蒂的护身符）、`playableFromThreat`（05010 悬案） | 公开 | 弃牌堆/威胁区本来就公开 | 弃牌堆入口 / 威胁区小卡 |

其余相关位置：`state.locations[].attachments`、`state.enemies[].attachments`、
`state.playerLocationAttachments`（玩家卡附属到地点，如 03199）与 `state.bondedSets[].cards`（场外绑定集合）
都按公开信息带卡面；`inv.hiddenCards`（隐私牌）是**手牌上的标记**，牌本身仍在 `inv.hand` 里，
因此前端照常按手牌显示，不需要第二个区域。

食梦者的共用读点：`playableOnlyFromDiscard` 阻止手牌出牌候选与校验，`returnToHandAfterPlay`
决定事件结算后的去向；`connectsAttachedLocations` 让同卡号地点附件为调查员提供双向连接，
`legalMoves`、`validateMove` 与牌桌地点投影读取同一连接图。`handCardDiscarded` 在实际弃掉
一张手牌后开反应窗口，`treacheryWouldDiscard` 在诡计结算后且进入遭遇弃牌堆前开快速事件
窗口。绑定卡可存于 `asset.attachments`，区域搬运支持从该附件按实例 id 移到牌库；
绑定集合回收也会扫描附件。技能档案的 `mustCommitNextTest`、`subtractIcons` 与
`onFail.damage` / `onFail.horror` 分别提供强制投入、图标减值与失败后的伤害结算。

三条读点约定：

1. **「如同手牌」通道统一原语**：`src/engine/play-channels.js` 是这类效果的唯一声明与读取点。
   一个通道 = 一种「牌不在手牌里、但可以当作手牌打出/投入」的存储形状。每个通道在那一处声明：
   - **枚举**（`entries` / `windowEntries`）：当前有哪些可打出的牌、对应的 legalMoves 片段
     （`fromHunch` / `fromBeneath` / `fromAttachedEventOf` / `fromBackpackId` / `fromPlanAssetId` /
     `fromThreatId` / `fromDiscard`）与牌桌挂载键 `uiKey`（`hunch:<卡号>` / `beneath:<卡号>` /
     `asset:<宿主 id>`）；`windowEntries` 保留旧窗口的候选顺序，新增通道追加在末尾；
   - **门控与折扣**（`entryError` / `discountOf`）：区域许可、弱点许可、宿主附加费、直觉牌库 -2 等，
     拒绝文案与旧 validateMove 逐字一致；`validateMove` 与各窗口共用（预览 = 校验 = 扣费同源）；
   - **取牌与回滚**（`takeToHand` / `actionTake` / `takeCommit` / `putBack`）：把来源变成手里的牌、
     支付附加费（横置宿主/花 uses/横置通道支援）、记录通道上下文（如 `state._playedFromBeneath`），
     打出被拒时放回原处。
   引擎四类窗口只遍历这个原语，不再各写一遍通道分支：
   - 普通行动：`moves.js` 枚举 → `validateMove`（`entryOf` 还原通道）→ `dispatch.js`（`actionTake`）；
   - 快速事件反应窗口：`encounter.js` 的 `reactionWindow`（`windowEntries`）+ `assets.js` 的
     `playReactionCard`（牌已在手牌里的执行器；付费/结算/去向与手牌快速事件同源）；
   - 收尾玩家窗口：`encounter.js` 的 `playerWindow`（`fastHandPlays` 复用 legalMoves 的通道候选）；
   - 能力层 fromHand 窗口与技能检定投入：`ability-rules.js`（`descriptorSources` 的 `fromChannel`、
     `descriptorUsable` 的通道折扣）、`ability-exec.js`（`openAbilityWindow` + `takeToHand`）、
     `reveal.js`（`executeDescriptor` 的 `channelDiscount`）、`tests.js`（`commitEntries` / `takeCommit`）。
2. **`uiKey` 是服务端下发的牌桌挂载协议**：`legalMoves` 的动作带 `move.uiKey`，选择选项带
   `option.uiKey`（观察投影白名单 `pendingChoice.options` 已放行 `uiKey`/`cardCode`）。
   `web/card-interactions.js` 的 `entityMoves()` / `choicePresentation()` 优先用它把动作/选项挂回
   直觉区那张、下方那张或宿主支援实体，点牌即打出；旧的按字段/id 推导保留为兼容回退。
   「能力不上桌」的约定不变：`beneath` / `attachedCards` / `attachments` 上的牌不参与 `cardAbility`
   枚举，只有通道声明能把它们变成可打出的动作。
   **选项链接卡牌的展示（2026-10-31）**：`pendingChoice.options` 带 `cardCode` 时，`choicePresentation()`
   把卡面挂到 item（`cards` + `code`），牌桌在选项里画整张卡并在右上角给「详情」按钮：点选项 = 提交
   `legalMoves`，点详情 = 打开完整卡牌（与牌桌其它卡面同一套详情弹窗），不提交选择；卡面沿用 `tableArt`，
   按住 Alt 悬停即放大。内容层没给 `cardCode` 时，界面按「完整卡名唯一精确匹配」兜底（重名/找不到不猜，
   只影响展示、不设 `key`、不改提交动作）。注意兜底读的是 `view.cards`，它不含 `encounterDiscard` 等区域
   的卡（迷失时空「选择一个被弃掉的地点」即如此），那类选项**必须**由内容层在 `api.choose` 里下发
   `cardCode`（02325/02326 已按此接线）——名称兜底只覆盖旧内容/仅下发卡名的选项。回归护栏：
   `tests/card-interactions.test.mjs`（含真实 `viewState` 投影断言）、`tests/choice-card-offers.browser.mjs`
   （主用例按实机口径：options 带 `cardCode`、视图 cards 不含地点卡；另有名称兜底兼容用例）。
   **快速反应开关与 auto 档**：通道里的卡在牌桌小卡上也显示同一颗闪电开关（准入判定
   `investigatorHoldsCard`，覆盖手牌/场上/威胁区/直觉区/下方/背包/原定计划/宿主附属），
   开关按 `cardCode` 记忆（ask=提示，skip=本局不再询问），`reactionView` / `reactionSkipPlan` /
   大厅 `autoChoice` 的 skip 分支都按同一卡号过滤；窗口内所有候选都关闭时整窗自动跳过。
   **快速事件（played+fast 或 fromHand 反应）只有开/关两档，没有「自动触发」**：按
   `card-defs.js` 的 `hasAutoReactionFor` 口径，auto 会替玩家从手牌付费打出，风险不同，所以
   手牌、直觉区与其它通道的快速事件同一处理；非事件反应（场上支援/调查员能力）的 auto 档不变。
   **所有快速事件都要有开关**（2026-10-31）：开关口径收敛在 `card-rules.js#entryNeedsReactionPrompt`
   ——`explicitReactionPrompt`（条目级 read point 窗口，如 02305/01071）以及所有 `played + fast`
   描述子。没有固定触发时机的「快速。只能在你回合期间打出」事件（01050 逃避隐藏等 27 张）只会在
   收尾玩家窗口（`investigation.afterAction` 的 `fastHandPlays`）以「⚡ 快速打出」候选出现，
   选项 id 是 `fast-card:<卡号>` / `fast-card:hunch:<卡号>`；`reactionChoices` 从 id 反查卡号，
   关闭开关就过滤掉该候选、唯一候选时整窗自动让过。存档迁移用同一口径检测内嵌卡面缺
   `hasReactionPrompt` 的旧存档并强制刷新（`save-migration.js#needsReactionPromptFlags`）。
3. **新增通道或新增窗口都只改一处**：新增通道 = 在 `play-channels.js` 的 `entriesOf` /
   `CHANNEL_ORDER` / `WINDOW_CHANNEL_ORDER` 加一条并补 `entryError`/`takeToHand`/`actionTake` 的
   switch 分支；新增窗口 = 遍历 `entries()` / `windowEntries()`。窗口、validate、dispatch、UI 不需要
   再改。**例外**：画中世界（`copiesBeneathEvents`）打出的物理牌是手牌宿主、被复制的是下方事件，
   仍走手牌通道的专用 `copyCode` 分支。
   回归护栏：`tests/play-channels.test.mjs`（通道 × 窗口矩阵 + uiKey 端到端）、
   `tests/cards-under-ui.test.mjs`、`tests/cards-under.browser.mjs`、`tests/turn-end-window.test.mjs`。

**地点附属卡的主动能力挂载（2026-11-05）**：`location.attachments` 与观察投影合并进来的玩家卡
地点附属（`state.playerLocationAttachments`）都用 `attachment:<地点 id>:<下标>` 当牌桌实体键。
「这个行动属于哪张附属」在服务端有四种字段族 + 一种规则名兼容，`web/card-interactions.js` 的
`entityMoves()` 一次收口，避免每个循环各写一套界面判断：

| 字段族 | 来源 | 例子 |
| --- | --- | --- |
| `locationId` + `attachmentIndex` | 按地点下标指回附属 | Carcosa 03091/03094 的 `treacheryRule.attachmentAction`、04270 的解除行动 |
| `attachmentId` | 按附属实例 id 指回 | 失落时代 04076 的 `threatAction`；TCU/TDE 同类行动 |
| `entityId`（+ `uiKey: locationAttachment:<id>`） | 附属自身的能力枚举 | TIC 07299/07099 的 `treacheryRule.attachmentAbilities`（parley 的 `entityAbility`） |
| `assetId` | 玩家卡地点附属自身能力 | `assetRule.sharedLocationAbility` 的 07310 |
| `rule` 后缀 `:<附属 id>` | 规则名里嵌附属 id，无独立字段 | 食梦者 `locationAttachment:<id>` / `discardSickeningWebs:<id>` 的摆脱行动 |

玩家卡地点附属「捷径」（03232）的 `shortcutMove` 不带任何附属引用，由观察投影的
`publicAttachments()` 派生 `markerAction: 'shortcutMove'`（只做展示标记，可用性仍只由
`legalMoves` 决定）。有行动时左键点头部卡弹出这张卡自己的选项（`ah-card-action-popover`），
没有行动时才回落到打开卡牌详情。回归护栏：`tests/card-interactions.test.mjs`、
`tests/state-presentation.test.mjs`、`tests/location-attachment-actions.browser.mjs`
（桌面 1440 / 移动 390）。

原语登记：直觉牌库在 `tools/tcu-primitive-spec.mjs` 的 `hunchDeck`（checks 覆盖 channel 读点）；
其余通道是引擎级通用基础设施，登记在本节。`docs/tcu-primitives.md` §3.1 与
`docs/tcu-investigators.md` §3.1 同步描述。

### 7.2 地点特性与「特性连接」原语

地点的「特性」有时是动态的：卡牌效果可以让地点获得/失去特性，阶段规则可以让「带某特性的地点
互相连接」。这两件事统一由 `src/engine/location-traits.js` 一个原语声明与记账，内容层只写数据 /
调 `api`，不要在章节 behavior 里各自维护连接或 `flags`（旧实现的教训：隐藏的图书馆一入场就被
静态连上、清理时会误删印刷特性/印刷连接）。

状态形状（只在真正用到的关卡出现，不给其它关卡新增存档字段）：

| 状态 | 形状 | 说明 |
| --- | --- | --- |
| 运行期授予 | `location.traitGrants = { Passageway: ['03141', '03139'] }` | 按来源记账；同一特性可多来源同时授予，撤销一个来源不误删其它来源；印刷特性（关卡定义 / 变体 / 卡面）永不删除。授予时若实例没有该特性，会补进 `location.traits`。 |
| 特性连接规则 | `state.locationTraitLinks = { rules: [{ id: 'act:03126:Passageway', trait: 'Passageway' }], added: [['meetingRoom','secondLibrary'], …] }` | `rules` 是当前生效的阶段声明；`added` 是引擎自己加过的**有向**连接（排序固定）。规则失效只撤销 `added` 里的边，印刷连接（含单向）不受影响。 |

三条读点约定：

1. **声明在条目里，不在 behavior 里**：当前幕/密谋条目的 `actRule.locationTraitLinks` /
   `agendaRule.locationTraitLinks` 是纯数据（字符串数组）。引擎在 `advanceAct` / `advanceAgenda`
   换阶段、`placeLocation` / `removeLocation`、以及每次特性授予/撤销后调用 `syncLocationTraitLinks()`
   重算；没有声明且没有历史时不写状态键，因此其它战役的存档/重放零变化。
2. **授予/撤销只经 `ctx.api`**：`api.addLocationTrait(location, trait, { source })` /
   `api.removeLocationTrait(location, trait, { source })` / `api.grantedLocationTraits(location)`；
   临时帷幕修正用既有 `api.setShroudMod(location, ±n)`（不要给引擎加卡号专用字段——
   旧 `peabodyShroud` 已删除）。`source` 是稳定字符串（卡号 / 情景 id），同一 source 重复授予幂等。
3. **投影是派生值**：观察投影的 `view.locations[].grantedTraits`（含 `grantedTraitsZh`）只由
   `grantedTraitsOf(location)` 从 `traitGrants` 派生；浏览器不读引擎。未揭示地点只显示授予特性
   （印刷特性仍隐藏），地图只给 [[通道]] 之类规则关键字做徽记，地点档案列出全部可见特性。

首个使用方（往事回声）：
- 03126 誓约：`actRule.locationTraitLinks: ['Passageway']` —— 幕 3 当前时印刷[[通道]]地点互相连接；
- 03141 皮博迪先生：横置 → `api.setShroudMod(loc, -1)` + `api.addLocationTrait(loc, 'Passageway', { source: '03141' })`，他重整时反向撤销（可指向隐藏的图书馆，打通入口）；
- 03139 隐藏的图书馆：敌人移动窗口（`enemyPhaseStart` → `enemyPhaseAfterHunters`）临时以
  `source: '03139'` 授予，猎手因此能追进图书馆；窗口结束撤销。

回归护栏：`tests/location-traits.test.mjs`（授予/多来源/撤销/幂等/存档往返/声明接线）、
`tests/echoes-passageways.test.mjs`（真实引擎的往事回声端到端）、`tests/carcosa-middle-a.test.mjs`。

### 7.2b 物理面翻面（07300 / 07211 / 07212 / 07330–07331）

- **唯一写入口**：`api.flipAsset(asset, nextCode)`（能力面 / 场景运行时都可用）→
  `src/engine/physical-faces.js#applyPhysicalFace`。同一个物理实例只替换印刷特征：
  实例 id、横置状态、控制者、位置、附属、计数全部保留；不模拟入场/离场/生成/揭示钩子。
- **合法性**：`cards-data` 的 `linkedCardCode`/`linkedToCode` 成对声明，`planPhysicalFace`
  在注册期外做同类型/成对校验；不在场的实体或非成对卡返回 null/抛错（`physicalFacePlanIfAny`）。
- **能力枚举**：翻面后实例的 `code/originalCode` 变为新面，引擎按
  `registeredEntry(source.originalCode || source.code)` 读**当前物理面**的条目。因此双面卡
  每个面各有一个单卡文件（如 `07300.js` / `07300b.js`、`07211a.js`/`07211b.js`），
  卡面能力只写在对应面的文件里。
- **首个使用方**：07211/07212 载具（运行/熄火面，翻面时同步 `running`）、07300 雕塑
  （[action] 花费蓝/白/红/黄钥匙 → 重整 + 翻到 07300b 的祝福转换面，审计 H11）、
  07330/07331 沉睡/苏醒古神（`flipEnemy` 同一条物理面管线）。
- 回归护栏：`tests/tic-physical-faces.test.mjs`、`tests/tic-scenarios-late.test.mjs`。

### 7.3 快速事件统一通道与重印别名（P2-4，2026-10-28）

- **快速事件只有一条通道**：`quickEventView(code)` 把 `played + fast + trigger`（旧）与
  `reaction + fromHand + quickEvent`（新）归一；候选只从 `reactionWindow` 出（旧展示方言），
  执行只走 `playReactionCard`（费用/日志/去向同一口径）。`openAbilityWindow` 在
  `quickEventWindow` 下跳过 `quickEvent` 候选（不双问），`playerWindow` 对「旧 shim + free 描述子」
  两条枚举路径去重。
- **重印只实现一次**：canonical（`01xx`）文件是唯一实现；`entries/_reprint-aliases.js` 白名单 +
  `card-identity.js` 出口 + `registerCardAbilities` 注册期克隆（`reprintOf`）让别名号复用同一行为与
  运行时可用性，R2 清零。5 对合并与米兰 auto 口径裁决见
  [`arkham-content-migration.md`](arkham-content-migration.md) 的 §4.6.10。

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
   effect 数据体时会退化成普通行动。读点是 `actionKind()`（`actionPreview` 的借机攻击提示也读它）。
   2026-10-26 起 `played` 描述子的 `countsAs` 也进入同一读点（事件卡「攻击。/躲避。/谈判。/撤退。」
   打出即按对应行动结算）；`tests/card-entries.test.mjs` 会扫描卡面粗体行动指示，漏写会让 fast tier 失败；
5c. **反应（`kind: 'reaction'`）的两种写法**：
   - 从 `EFFECTS[code].reactions` 搬过来的：`legacyReaction: true` + `trigger` + `criteria`（旧条件字段）
     + `cost` + `effect`（数据体）。引擎用旧式询问（`是否触发「X」的反应？`）加同一套费用/效果解释器结算，
     提示文案与状态指纹都不变；
   - 新写的：`resolve(ctx)`，走 `openAbilityWindow` 的「【能力】…」询问。
   同一张卡只用一种；`legacyReaction` 是 Phase 5 的过渡标记，Phase 6 删掉旧式询问后一起移除。
   读点是 `triggerReaction`（`descriptorReactionSpec`）与 `openAbilityWindow`（跳过 `legacyReaction`）；
   5d. **快速事件（P2-4，2026-10-28）**：`played + fast + trigger`（旧写法）与
   `reaction + fromHand + quickEvent`（新写法）是快速事件的两种合法数据形状，但只有一条通道：
   `ability.js#quickEventView` 归一候选视图 → `encounter.js#reactionWindow` 是唯一候选出口
   （保留旧展示方言）→ `assets.js#playReactionCard` 是唯一执行器（费用/⚡日志/`state._reaction`/
   去向旗标同一口径）。`quickEvent` 只能写在 `reaction` 描述子上并隐式 `fromHand`；
   `playAccess().reactionOnly` 用同一视图判定，快速事件不能当普通行动打出。
   设计、重印别名与口径裁决见 [`arkham-content-migration.md`](arkham-content-migration.md) 的 §4.6.10；
6. 测试从"断言 `EFFECTS[code]` 的形状"改成"断言行为"，参照 `tests/card-lifecycle.test.mjs` 的三段式；
   已迁移的 21 张逃生卡另有一层通道断言（`tests/phase2-primitives.test.mjs` 的最后三条）；
7. 跑 `npm run cards:audit:write`（白名单收缩）+ `npm run test:fast`，指标下降即迁移成立的证据；
   若该卡属于有验收账本的战役，再按对应 `audit:*:acceptance` 重新生成账本哈希；
8. 用 replay 基线证明"行为零变化"：迁移前 `node tools/replay-fixtures.mjs --baseline <文件>`，
   改完 `--compare <文件>`（命令与判定口径见 [`../ARCHITECTURE.md`](../ARCHITECTURE.md#53-重放撤销与迁移对比)）。

**判据**：旧通道表达不了才迁；纯数据卡不迁成闭包（见路线文档 §7）。

## 万象无终补完原语

`api.cardAbilityOptions(seat, source, {ignoreCosts})` 与 `api.resolveCardAbility(seat, source, {abilityIndex, ignoreCosts})` 共用能力目标、条件、限次和效果管线。忽略费用不跳过限次。`partOfAbility: index` 把条件子句关联到同卡的行动能力；从手牌揭示后，只有这些子句在本次能力结算期间作为临时来源可用，结束即清理。

`api.replaceChaosToken(context, token)` 只在 `tokenReveal` 中生效；取消的原标记不结算后续效果，替代标记走正常调查员效果。

`api.beginImmediateAction(seat, {source})` 在可重放事务中选择并执行一次行动，结束后恢复原座位和正常行动额度。条目 `betweenActionsAnyTurn` 开放任意调查员行动之间的快速打出时机。

资源费用读取 `availableResources(inv)`；资源条件与损失仍读取真实 `inv.resources`。`asset.resources` 独立保存卡上资源，支付通过统一来源选择。

`api.progressWeakness(seat, {code, nextCode, recordKey, counterKey, addedKey})` 将个人剧情记录、当前牌库底与战役牌组升级一起持久保存。条目 `transferOnControllerDefeat` 在控制者被击败时转交同一支援实例；能力 `noOpportunityAttackFrom` 仅豁免列出的敌人。

## P7 章节接口（开发中）

P7 的逐章验收与生产注册仍以路线图为准；下列接口通过专项测试不代表整章完成。

- 非玩家 `action` / `free` 能力必须声明 `actionKind`。`range` 为 `here`（默认）、`connecting` 或 `anywhere`；幕与密谋只有当前在场实体可以执行能力。`abilityIndex` 指经过 `entityActionDescriptors` 过滤后的行动数组索引。
- `cost.groupClues` 使用统一费用表达式；`groupClueScope:'anywhere'` 允许远程活调查员贡献，默认仅本地点。`additionalKeyCost:{colors,scope,destination}` 与其它成本一起预检，使用现有彩色钥匙选择器支付。`scope` 为 `self/here/anywhere`；`destination` 为 `reference/source`。
- `cost.drawEncounter` 走真正抽牌管线，费用引发战败、撤退或换关后中止能力效果。空牌库且空弃牌堆时不可支付。`runtime.spawn(code,location,{exhausted:true})` 在入场及交战窗口前已经横置。
- `enemyRule.revelationSpawn:{locationOriginalCodes,cluesPerInvestigator}` 只作用于真正抽到敌人的显现；直接生成不额外放线索。互斥的 `farthestOfCodes` 按实际抽牌者计算距离并由其处理平局。`revelationSpawnOptions` 在真正生成前决定横置等初态。
- `runtime.takeEnemyClues(enemy,seat,count,{victoryWhenEmpty:true})` 转移实际线索，清空后放逐到胜利区；它不等于击败，不触发击败后效果。印刷胜利0也进入胜利区。
- `scenarioDecks.discardTop(id,count)` 将实际顶牌直接移入遭遇弃牌堆；`takeEncounterDeckCard(code)` 只取走一张实际遭遇牌，不抽取、不结算显现、不制造弃置过程。`takeSetAsideToHand(seat,code)` 从实际放置一旁区移入手牌，不制造进出场过程。
- `locationRule.connectsToTrait:'Cave'` 在来源正面生效时双向连接对应特性的在场地点；后续地点入场自动同步，保留其它印刷连接。`floodBounds.onlyRevealed:true` 使水位限制仅在正面生效；省略时维持原有双面规则。
- `runtime.remember(fact)` 对本场景记忆去重。重复句通过 `keyedFlashbackAbility`、`localKeyFlashbackAbility`、`evadeTraitAndDrainLocation`、`suspectEntry`、`symbolFailingRevelation` 共享工厂表达，不逐卡复制。
- `keys.linkAsset(color,assetId)` 关联已有物理遗物。钥匙转交调查员时转移同一实体，放到其它场上卡旁时遗物无控制者；钥匙转交幕或离场时移除遗物，后续转移不会重新创建。`interactions.chooseKey` 仅选择已揭示颜色，返回颜色或取消，不自动移动钥匙。
- `teamActivatable:true` 同时适用于支援区与威胁区的实际卡牌；同地点活调查员可激活，费用由行动者支付。`exemptAssetSlot(asset,'ally')` 仅豁免指定实例的槽位。`preventEnemyReadyNextUpkeep(enemy)` 仅消耗下次真正发生的重整阶段，重复或跳过阶段按实际发生次数处理。
- `health:null` 表示没有生命值：伤害仍累积，但不因伤害达到生命值而自动被击败，观察视图也保留空值。
- 新章节数据 `eventWindowInstances:true` 为真正交战和水位变化产生独立的事件发生序号；同一次事件的多入口复用其上下文，同一行动中的两次事件分别触发。旧章节省略该字段时保留原存档及重放形状。
- 数值及布尔修正的 `condition` 必须是条件对象，自定义函数写为 `{when:fn}`。直接写函数将被校验拒绝，避免静默丢失条件。

专项覆盖见 `tests/tic-scenario-*.test.mjs`、`tests/tic-flashbacks.test.mjs` 与各片区测试。P7 队列、完整章节流程、指南和浏览器证据继续在本循环文档中收拢。
