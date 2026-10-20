# Phase 6 · 引擎去卡号化与战役解耦（交付说明）

> 目标（roadmap §Phase 6）：`engine.js` / `observation.js` 内不出现 `tfa|carcosa|dunwich` 字样与具体卡号；
> 新增战役只加 `content/campaigns/<id>/`。本文件按批次记录进展与证据。

## 1. 硬指


| 指标 | Phase 5 结束 | 现在 |
| --- | --- | --- |
| `engineCodes`（引擎里的卡号字面量） | 28（全是 `reference` 文案标签） | **0** ✅ |
| 行为分支（`condition` + `block`） | 0 | 0 |
| 引擎源码里的战役名 | 2 处（`tfa` / `carcosa` 局部变量） | **0** ✅ |
| `EFFECTS` 条目 | 57 | 57（下一步） |
| `effectsTopLevelFields` | 33 | 33（下一步） |

## 2. 批次 6a-1：`reference` 28 个码清零

这 28 个码都是 `requestChoice({ source: '0xxxx' })` 的**文案标签**（外加两处 `cardName('0xxxx')` 日志）。
处理方式分三类：

### 2.1 一处注射解决 20 处

```js
// src/engine/engine.js
// 只在结算入口注入：playedEffect 本身保持纯函数，
// 生命周期读点的测试才能继续断言原始数据体。
function withEffectCode(effect, code) {
  if (!effect || !code || effect.code === code) return effect
  return { ...effect, code }
}
```

`doPlay` / `resolveEffect` 的入口用 `withEffectCode(playedEffect(code), code)`，
于是效果处理器统一写 `source: effect.code`。

> 最初把注入放进 `lifecycle.playedEffect()` 本身，结果两条「读点返回的数据体与描述子声明一致」
> 的用例失败（它们 `deepEqual` 断言原始数据体）——所以注入必须留在**结算入口**，读点保持纯函数。

### 2.2 借用现成对象

| 码 | 数据来源 |
| --- | --- |
| 02014 杜克 | `dukeInvestigate(state, seat, events, code)` 由调用方传 `effect.code` |
| 02190 蔑视 | 本次实际投入的那张牌：`commitments.find(...)?.code` |
| 02234 黑马 | 带 `darkHorse` 被动的支援：`darkHorseAsset.code` |
| 03007 家庭前线 | `homeFrontCode` 随技能效果一路传（`out.homeFrontCode` → `skillFx` → 日志） |
| 04157 / 04305 / 04312 / 04029 | `opts.sourceCode`（内容层传入）→ `weaponCode` / 支援卡号 |

### 2.3 新增数据通道

| api / 效果 | 改动 |
| --- | --- |
| `api.addExtraChaosChoices(amount, source)` | 记录 `skillTest.extraChaosSource`，03304 的选择框用它 |
| `api.recruitAllyFromDiscard(seat, source)` | 选择框 source 由内容层传入（03238） |
| `{ type: 'cancelSymbolToken', code }` | 效果记录 `skillTest.cancelledSymbolSource`，04110 日志用它 |

## 3. 批次 6b-1：战役名与旧存档卡号

| 位置 | 改动 |
| --- | --- |
| `playCost()` 的两个局部变量 | `carcosa` / `tfa` → `cardDiscount` / `playDiscount`（state 字段名保留，属于存档兼容面） |
| `src/engine/save-migration.js` | 03121/03122/03123 的毁灭阈值、03185 束身衣、03155 战斗或逃跑 → `card-rules.js` 的 `LEGACY_*` 常量 |
| `src/engine/look.js` 注释 | 示例卡号 `'01234'` → `'<卡号>'` |

## 4. 门禁

新增 `tests/phase6-guard.test.mjs`（注册在 fast 层与 node-suite）：

1. **引擎源码里没有卡号字面量**：扫 `src/engine/*.js` 的 `'0\d{4}'`（含注释，保证指标可单调下降）；
2. **引擎源码里没有战役名**：扫 `tfa|carcosa|dunwich`（大小写不敏感，按词边界）。

两个用例现在都通过，且失败时会打印「文件:行号: 内容」，方便直接定位。

## 5. 验证

| 项 | 结果 |
| --- | --- |
| `replay --check` / `--compare` | ✔ 全部基线重放出相同指纹 |
| `audit-abilities` | `engineCodes=0 effectsEntries=57 effectsTopLevelFields=33 escapeCards=0` |
| `audit-workorder` | 空（`A=0`） |
| `migrate-card --verify` | ✔ 79 个批次一致 |
| `audit-dead-primitives` | ✔ 没有死分支 |
| `phase6-guard` / `architecture-guard` / `migration-tools` | 20/20 通过 |
| fast tier | 2142 例 / 2135 通过 / **7 条既有基线失败**（新增 0 条） |
| `tfa-player-acceptance`（含火焰喷射器 M2） | 86/86 通过 |

## 6. 下一步

1. **`EFFECTS` 57 条**：继续按 §7 的手法逐个把行为读点搬进描述子；每批 ≤10 条。
2. **`effectsTopLevelFields` 33 项**：顶层字段收进描述子或规则表。
3. **拆分 `engine.js`**（当前约 12.6k 行 → 目标 < 2.5k）：先按域切出
   `combat/`、`investigate/`、`play/`、`enemy-phase/`、`upkeep/`，保持 `engine.js` 只做编排与 `abilityApi`。
4. **战役插件化**（TFA 第一个）：`content/campaigns/tfa/` 里放 `stateSlice` / `project` / `actions+hooks` / `agentHints`，
   引擎只保留通用阶段机；roadmap 的「新增战役只加 content/campaigns/<id>/」由 `phase6-guard` 继续守。

## 7. 6c 的前置条件：`EFFECTS` 还兼着「这张卡已实现」的语义

### 7.1 实验

试着把 5 条**纯登记**条目（`{ engine: 'printedSoak' }` ×3、`{ engine: 'wendyAmulet' }`、`{ engine: 'litaAura' }`）
从 `EFFECTS` 删掉——这三类行为在 Phase 5 已经数据化（soak 走卡面数据、护身符走 `playedEventsToDeckTop`、
光环走 `auraWhileInPlay`），条目本身没有任何读点。

结果：`effectsEntries` 57 → 55，但 **`replay --compare` 报了 1 局不一致**（行为变化），已整体回滚。

### 7.2 原因

`src/ai/ai-context.js` 的 `card(code)` 里：

```js
return { code, name: ..., implemented: EFFECTS[code] || abilitySummary(code) }
```

`implemented` 会把 `EFFECTS[code]` **整个对象**塞进 AI 上下文。条目一删，AI 看到的
`implemented` 从 `{"engine":"printedSoak"}` 变成 `undefined`（或大纲摘要），
提示词随之变化，AI 的决策就会不同——**这不是规则行为变化，而是观测面变化**，
但它同样会让重放指纹变红。

同一类耦合还有两处：

- `src/deck/deckbuilding.js:149`：`const eff = EFFECTS[card.code]` 参与构筑评分；
- `src/cards/card-catalog.js:158`：`Object.hasOwn(EFFECTS, code)` 决定图鉴的 `effectNote`。

### 7.3 下一步（6c-1 的正确顺序）

1. 先把 `implemented` 改成**稳定摘要**：`{ kinds: [...], summary: string }`，
   来源是「描述子 + 条目」而不是原始对象；这一步会**改变 AI 提示词**，需要显式重采基线
   （`replay-fixtures --baseline` + 在 diff 里写明「观测面变化」）。
2. 再逐个删「纯登记」条目，并按 `content/schema.js` 的约定在对应包 `abilityLayerCodes` 里登记
   （core 包的可用性来自 `src/deck/availability.js` 的显式列表，不受 `EFFECTS` 影响，已确认）。
3. 每批仍然要 `replay --compare` 一致 + fast tier 新增失败 0 条；如果这批必须先动观测面，
   就把「基线重采」作为独立批次提交，别和删条目混在一起。

> 这条纪律和 roadmap §7 的「不要同批混做两件事」是同一个道理：
> **删除数据来源**与**改变观测面**必须分开验收，否则分不清是迁移错还是提示词变了。

## 8. 6d-1：engine.js 拆分第一步 —— card-lookup.js

### 8.1 拆的是什么

「卡号 → 定义」的七个纯查询函数搬进 `src/engine/card-lookup.js`：

```
cardDef / cardName / originalCardCode / ruleCodeForOriginal /
isWeaknessCard / isWeaknessCode / enemyDef
```

它们不写 state、不触发事件，依赖只有几张数据表；合并剧本注册表（`ALL_ENEMIES` /
`ALL_TREACHERIES` / `ALL_STORY_ASSETS`）也跟着搬过去，engine 改成 import。

### 8.2 拆分纪律（本轮踩到的两个坑）

1. **转出 ≠ 导入**：只写 `export { cardDef } from './card-lookup.js'` 不会在 engine.js 里
   建立本地绑定，engine 内部调用 `cardDef()` 会直接 `ReferenceError`（10 局重放全红）。
   正确写法是 `import { … } from './card-lookup.js'` **再加**一行 `export { … }`，
   外部调用方的 import 路径才保持不变。
2. **注册表构建要跟着走**：`ALL_ENEMIES` 原来在 engine.js 顶部由 `contentRegistry` 拼出来；
   搬走时必须在 `card-lookup.js` 里重建同一份（同过滤条件、同合并顺序），否则遭遇牌查不到。

### 8.3 现状与后续顺序

- `engine.js`：**12589 行**（拆分前 12654；`card-lookup.js` 90 行）；
- 下一步按「依赖少 → 依赖多」的顺序拆：
  1. `describeState`（132 行，纯投影）；
  2. `scenarioRuntime`（317 行，依赖 runtime 接口，需要把被调用的 helper 作为依赖注入）；
  3. `abilityApi`（978 行，最大的一块，按域拆成若干 `create*Api(deps)`）；
  4. `performTest`（782 行，检定主流程，最后动）。
- 每拆一块都要求：`replay --compare` 一致、fast tier 新增失败 0、外部 import 路径不变。

## 9. 6d-2：拆出 describe.js（纯投影 + 依赖注入）

### 9.1 拆的是什么

`describeState`（133 行）搬进 `src/engine/describe.js`，导出 `createDescribeState(deps)`，
engine 里只留一行工厂调用：

```js
export const describeState = createDescribeState({
  campaignFor, inHub, describeTeamParticipation, actingSeats, legalMoves, actObjectiveContext,
  totalDoom, agendaDoom, scenarioBehavior, locName, getMaxHealth, getMaxSanity, getStat, cardName,
  assetEffect, CLASS_NAMES, investigatorParticipation, decisionSeat, aliveInvestigators, describeFreeAbilities,
  describePrey, enemyEvadeValue, enemyFightValue, enemyHealth, narrativeLogTexts, scriptActionHints, stripLabel,
})
```

### 9.2 为什么用依赖注入而不是 import engine

1. 与 engine **没有循环依赖**（engine → describe 单向）；
2. 依赖清单就是契约：解构里少一个名字、调用方多给/少给一个，都在首次调用时暴露；
3. `describeState` 是纯投影（只读 state、只拼字符串、不消耗随机数），所以这层拆分对行为零影响——
   重放指纹与拆分前逐条一致。

### 9.3 坑

`describeState` 原来带 `export` 关键字，整段搬进工厂后必须去掉（工厂内部是嵌套函数声明），
否则 `describe.js` 直接语法错误。改名后由工厂 `return describeState` 暴露。

### 9.4 现状

| 文件 | 行数 |
| --- | --- |
| `src/engine/engine.js` | **12466**（6d-1 后 12589） |
| `src/engine/card-lookup.js` | 90 |
| `src/engine/describe.js` | 176 |

下一块：`scenarioRuntime`（317 行）——同样用依赖注入，但它会**写 state**（放置地点、推进密谋），
所以拆之前要先把它调用的副作用 helper 列全，并用重放确认。

## 10. 6d-3：拆出 combat.js（按域拆分第一个示例）

### 10.1 拆的是什么

`doFight`（245 行）+ `doEvade`（131 行）搬进 `src/engine/combat.js`，
导出 `createCombat(deps)` 返回 `{ doFight, doEvade }`；engine 末尾一次性注入 53 个依赖。

这一对是 roadmap「按域拆分」的第一个示例（`combat/` 域）。与 `describeState` 不同，
它们**会写 state**（伤害、交战、击败、移动、行动成本），所以依赖清单长得多，
拆分的验收标准也更硬：重放逐条一致 + 战斗/躲避相关用例全绿。

### 10.2 坑：依赖清单不能只靠「函数调用」扫

第一版依赖表是用正则扫 `name(` 生成的，漏了两类**不带括号**的引用：

| 漏掉的 | 出现方式 |
| --- | --- |
| `getMaxSanity` | `captureTableState(state, getStat, getMaxSanity)` —— 作为值传递 |
| `SKILL_NAMES` | 拼日志文案时直接用（import 绑定，不是 engine 顶层函数） |

结果：重放第 43 步 `getMaxSanity is not defined`、随后 `SKILL_NAMES is not defined`。
**正确做法**：把「engine 顶层声明 + 全部 import 绑定」都纳入候选集，再与工厂解构对比，
一次找齐缺失项（脚本见本轮提交记录）。只扫调用会在这种「把函数当值传」的代码里翻车。

### 10.3 现状

| 文件 | 行数 |
| --- | --- |
| `src/engine/engine.js` | **12149**（6d-2 后 12466） |
| `src/engine/combat.js` | **446** |
| `src/engine/describe.js` | 176 |
| `src/engine/card-lookup.js` | 90 |

下一块按同样流程拆 `doPlay`（212 行）与 `doInvestigate`（114 行），然后才是 `abilityApi`；
`scenarioRuntime`（317 行）因为依赖 90+ 个副作用 helper，放到 `abilityApi` 之后。

## 11. 6d-4：拆出 actions.js（doPlay / doInvestigate）

### 11.1 拆的是什么

`doPlay`（212 行）+ `doInvestigate`（114 行）搬进 `src/engine/actions.js`，
导出 `createActions(deps)`；engine 末尾一次性注入 57 个依赖。

这是 roadmap「按域拆分」的第二个域：出牌与调查。两者都会写 state
（资源、手牌、支援入场、地点线索、事件弃置），依赖清单比 combat 略长。

### 11.2 坑一：注释会被当成标识符

用「engine 顶层声明 ∪ import 绑定」生成依赖表时，**必须先剥注释**。
第一版没剥，注释里的 \`Phase 5\`、\`C1\`、\`D1\`、行号 \`2\`/\`3\` 都被算成候选，
依赖表里混进一堆不存在的名字。剥掉 \`//…\` 与 \`/*…*/\` 后干净了（55 → 57 个真实依赖）。

### 11.3 坑二：`String.replace` 只换第一个

补两个漏掉的依赖（\`capabilityBlocked\` / \`entityModifierTotal\`）时，我用
\`text.replace("  cardDef,", …)\` 插入——它换的是**文件里第一处** \`  cardDef,\`，
也就是 \`createCombat\` 的注入块，结果：

- \`createCombat\` 块里多了一行重复键（对象字面量里合法，但脏）；
- \`createActions\` 块仍然缺依赖，重放报 `capabilityBlocked is not a function`。

**教训**：往两个相似的注入块里插东西，必须先用 \`indexOf("createXxx({")\` 定位到块再改，
不能用全局 \`replace\`；重复键不报错，会让问题延后到运行期才暴露。

### 11.4 现状

| 文件 | 行数 |
| --- | --- |
| `src/engine/engine.js` | **11883**（6d-3 后 12149） |
| `src/engine/combat.js` | 446 |
| `src/engine/actions.js` | **397** |
| `src/engine/describe.js` | 176 |
| `src/engine/card-lookup.js` | 90 |

累计从 engine.js 迁出 **约 670 行**（12654 → 11883）。下一块：`doUpkeep` / 敌人阶段等
阶段机（`upkeepPhase` 105、`runAgendaReveal` 142），然后才是 `abilityApi`。

## 12. 6d-5：拆出 phases.js（补给阶段 / 密谋揭示）

### 12.1 拆的是什么

`upkeepPhase`（105 行）+ `runAgendaReveal`（142 行）搬进 `src/engine/phases.js`，
导出 `createPhases(deps)`；engine 末尾注入 49 个依赖。

这是 roadmap「按域拆分」的第三块——**阶段机**。拆完后引擎主循环的职责变成
「按序调用各阶段 + 处理关间/结局」，阶段内部的固定流程（补充给养、重整、密谋揭示、抽取遭遇）
都收在 `phases.js` 里。

### 12.2 坑：函数在文件里的顺序不等于调用顺序

`runAgendaReveal` 在文件中位于 `upkeepPhase` **之前**（5209 vs 5718）。第一版按
`[0, s1) + [e1, s2) + [e2, …]` 切片，等于假设「先出现的函数先切」，结果把中间整段复制了一遍，
`engine.js` 从 11883 涨到 12306，并报 `maskedHunterPrey has already been declared`。

**正确做法**：先把要删的区间按起始行**从大到小排序再 splice**（后面的先删，前面索引不位移）；
写模块时再按「逻辑顺序」排（`upkeepPhase` 在前）。两件事分开做，互不影响。

### 12.3 现状

| 文件 | 行数 |
| --- | --- |
| `src/engine/engine.js` | **11692**（6d-4 后 11883） |
| `src/engine/combat.js` | 446 |
| `src/engine/actions.js` | 397 |
| `src/engine/phases.js` | **311** |
| `src/engine/describe.js` | 176 |
| `src/engine/card-lookup.js` | 90 |

累计迁出 **约 962 行**（12654 → 11692）。下一块：`legalMoves` + `validateMove`（各约 270 行、
60 个依赖）→ `src/engine/moves.js`，然后才是 `abilityApi`。

## 13. 6d-6：拆出 moves.js（legalMoves / validateMove）

### 13.1 拆的是什么

`legalMoves`（269 行）+ `validateMove`（287 行）搬进 `src/engine/moves.js`，
导出 `createMoves(deps)`；engine 末尾 `export const { legalMoves, validateMove } = createMoves({...})`
（77 个依赖），外部 import 路径不变。

两者必须同模块：它们共用同一批判定函数（`abilityTargets`、`canAffordAbility`、`actionCost`、
`actionKind` 等），拆开就会出现「能列出但不能执行」的漂移——这正是 Phase 2 立 `validateMove` 的原因。

### 13.2 三个坑（都在这一批里踩到）

1. **TDZ：工厂调用顺序**。`createDescribeState` 在 `createMoves` **之前**执行，而它的依赖里有
   `legalMoves` → `Cannot access 'legalMoves' before initialization`。
   解法：把依赖别人的工厂调用块挪到**后面**（本轮把 describe 块移到文件末尾）。
2. **内联依赖行不匹配逐行正则**。`createDescribeState` 的依赖是「一行多个名字」
   （`campaignFor, inHub, …, legalMoves, …`），按 `^  name,$` 写的 thunk 替换一处都没命中；
   改成整块搬移才解决。
3. **漏依赖只能靠运行期发现**。`capabilityBlocked` / `entityModifierTotal` / `scriptActionHints`
   都是**不带括号**的引用（作为值传递给 `captureTableState`、参与运算、拼提示），
   静态扫描的候选集漏了它们，最终用「跑重放 → 从报错里取名 → 自动补进两边」的循环收敛（1 轮结束）。

### 13.3 现状

| 文件 | 行数 |
| --- | --- |
| `src/engine/engine.js` | **11220**（6d-5 后 11692） |
| `src/engine/moves.js` | **652** |
| `src/engine/combat.js` | 446 |
| `src/engine/actions.js` | 397 |
| `src/engine/phases.js` | 311 |
| `src/engine/describe.js` | 176 |
| `src/engine/card-lookup.js` | 90 |

累计迁出 **约 1430 行**（12654 → 11220）。剩下最大的两块：`abilityApi`（978）与 `performTest`（782），
下一批从 `abilityApi` 开始按域拆（`play` / `test` / `enemy` / `card` 四组）。

## 14. 6d-7：abilityApi 按域拆（第一批：`api-card.js`）

### 14.1 为什么先拆这一批

`abilityApi(state, events)` 是 179 个方法的巨型对象（979 行），一次搬完风险太大。
先挑**尾部的 256 行薄封装**：它们是 Phase 5 期间为卡牌内容补齐的「按 id 查/取、放牌进弃牌堆、
遭遇牌库顶敌人、最远地点、生成敌人、标记弱点、揭示混乱标记、封印、驱逐、复制打出……」，
每个方法都只闭包 `state` / `events` 和少量 helper，依赖只有 29 个。

### 14.2 做法

```js
// src/engine/api-card.js
export function createCardApi(state, events, deps) { const { … } = deps; return { …256 行方法… } }

// src/engine/engine.js
const apiDeps = { /* 29 个 helper */ }
function abilityApi(state, events) {
  return {
    …,
    ...createCardApi(state, events, apiDeps),
  }
}
```

关键点：**api 方法必须继续闭包 `state` / `events`**——能力层只拿得到 api，拿不到引擎内部，
所以工厂签名是 `(state, events, deps)`，不是无参的 `createCardApi(deps)`。

### 14.3 现状

| 文件 | 行数 |
| --- | --- |
| `src/engine/engine.js` | **10966**（6d-6 后 11220） |
| `src/engine/api-card.js` | **302** |
| `src/engine/moves.js` | 652 |
| `src/engine/combat.js` | 446 |
| `src/engine/actions.js` | 397 |
| `src/engine/phases.js` | 311 |
| `src/engine/describe.js` | 176 |
| `src/engine/card-lookup.js` | 90 |

累计迁出 **约 1690 行**（12654 → 10966）。下一批继续拆 `abilityApi` 的其余分组：
`play`（出牌/费用）、`test`（检定/标记）、`enemy`（敌人/攻击）、`card`（已拆）。

## 15. 6d-8：abilityApi 第二批（`api-enemy.js`）

### 15.1 拆的是什么

从 `abilityApi` 再切出 **134 行**（`enemyTestModifier` … `putSelfIntoPlay`）：
敌人与威胁区的写入——测试修正、阻止非精英攻击、移除/生成敌人、遭遇牌库交互、
线索与毁灭的搬运、绑定标记、销毁与放逐。依赖只有 14 个，是这批里最干净的切分。

```js
// api-enemy.js
export function createEnemyApi(state, events, deps) { … }

// engine.js
const apiEnemyDeps = { /* 14 个 helper */ }
function abilityApi(state, events) {
  return { … , ...createEnemyApi(state, events, apiEnemyDeps), … }
}
```

### 15.2 挑块的判据

`abilityApi` 的方法在文件里大致按域聚集，但边界不严格。挑块时用两条判据：

1. **连续**：从某个方法名到另一个方法名，保证不在方法体中间切断；
2. **依赖少**：用「engine 顶层声明 ∪ import 绑定 − 块内局部」扫一遍，优先选 ≤20 个依赖的块。

本轮比较了三个候选：`test 段`（178 行 / 24 依赖）、`clue/doom 段`（126 行 / 15 依赖）、
`enemy+card 表现`（134 行 / 14 依赖），选了依赖最少的那个。

### 15.3 现状

| 文件 | 行数 |
| --- | --- |
| `src/engine/engine.js` | **10884**（6d-7 后 10966） |
| `src/engine/moves.js` | 652 |
| `src/engine/combat.js` | 446 |
| `src/engine/actions.js` | 397 |
| `src/engine/phases.js` | 311 |
| `src/engine/api-card.js` | 302 |
| `src/engine/describe.js` | 176 |
| `src/engine/api-enemy.js` | **163** |
| `src/engine/card-lookup.js` | 90 |

累计迁出 **约 1770 行**（12654 → 10884）。`abilityApi` 还剩约 580 行，
下一批挑 `clue/doom 段`（126 行 / 15 依赖），然后 `test 段`。
