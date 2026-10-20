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

## 16. 6d-9：abilityApi 第三批（`api-clue.js`）

### 16.1 拆的是什么

`abilityApi` 再切 **112 行**（`returnClueToLocation` … `defeatEnemy`）：线索归还与搬运、
毁灭放置与移除、威胁区操作、抽取遭遇、结束回合、资产恐惧/使用次数、牌库顶弃置、
帷幕临时修正、附属到地点。依赖 13 个（比上一批还少）。

### 16.2 新坑：被 `const` 解构的工厂产物不在扫描候选集里

`doInvestigate` / `doEvade` / `doPlay` 已经不是顶层 `function`，而是
`const { doPlay, doInvestigate } = createActions({…})` 解构出来的绑定。
「engine 顶层声明」的正则是 `^(function|const|let|class) NAME`，遇到 `const {` 开头的行**捕获不到**，
于是：

1. 它们没进候选集 → 依赖表漏掉 → 运行期 `doInvestigate is not defined`；
2. 即使补上，`apiClueDeps` 是在模块顶层**立即求值**的，而这三个绑定要到文件末尾才初始化 → TDZ。

**正确做法**：用**惰性 thunk** 注入 —— `doInvestigate: (...args) => doInvestigate(...args)`。
箭头函数体在调用时才解析绑定，既避开 TDZ，也不影响 `abilityApi` 每次调用拿到最新实例。

> 验收信号：`replay --compare` 仍然一致（因为重放没走到这些 api），但
> `5c-2 / 5c-19 / 5c-21 / M2 lure of leylines …` 等 13 条用例红——这正是「重放不是万能门禁」的例子，
> 拆 api 层必须同时跑战斗/调查/躲避相关用例。

### 16.3 现状

| 文件 | 行数 |
| --- | --- |
| `src/engine/engine.js` | **10790**（6d-8 后 10884） |
| `src/engine/moves.js` | 652 |
| `src/engine/combat.js` | 446 |
| `src/engine/actions.js` | 397 |
| `src/engine/phases.js` | 311 |
| `src/engine/api-card.js` | 302 |
| `src/engine/describe.js` | 176 |
| `src/engine/api-enemy.js` | 163 |
| `src/engine/api-clue.js` | **139** |
| `src/engine/card-lookup.js` | 90 |

累计迁出 **约 1864 行**（12654 → 10790）。`abilityApi` 还剩约 470 行；下一批 `test 段`（82 行 / 16 依赖）。

## 17. 6d-10：abilityApi 第四批（`api-test.js`）

### 17.1 拆的是什么

`abilityApi` 再切 **66 行**（`addTestValue` … `phaseTestBonus`）：一次技能检定期间的读取与修正——
加值、重试、投入技能牌、查看/检索牌堆、描述限制与检定结果、成功后结算、阶段/待决加值。
依赖 13 个。

### 17.2 坑：切块时把「上一批的 spread 行」也包进来了

上一批（6d-9）把 `...createClueApi(state, events, apiClueDeps),` 留在了 `abilityApi` 里，
位置正好在本次要切的区间末尾。直接按行号切，这一行会被搬进 `api-test.js`，导致：

- 新的模块里出现 `...createClueApi(...)`（未定义）；
- `abilityApi` 少了这一行，上一批的方法整体消失。

**做法**：切块前先 `indexOf("...createXxxApi(state, events, …),")` 找到既有 spread 行作为右边界，
只切它**之前**的方法；spread 行留在原地，再加本批的新 spread。命名上让每批的 spread 行带自己的
`apiXxxDeps`，用 `indexOf` 精确定位，比按行号靠谱。

### 17.3 现状

| 文件 | 行数 |
| --- | --- |
| `src/engine/engine.js` | **10745**（6d-9 后 10790） |
| `src/engine/moves.js` | 652 |
| `src/engine/combat.js` | 446 |
| `src/engine/actions.js` | 397 |
| `src/engine/phases.js` | 311 |
| `src/engine/api-card.js` | 302 |
| `src/engine/describe.js` | 176 |
| `src/engine/api-enemy.js` | 163 |
| `src/engine/api-clue.js` | 139 |
| `src/engine/api-test.js` | **93** |
| `src/engine/card-lookup.js` | 90 |

累计迁出 **约 1909 行**（12654 → 10745）。`abilityApi` 还剩约 400 行（表现层与杂项）。

## 18. 6d-11：abilityApi 收尾（`api-misc.js`）· 装配函数成型

### 18.1 本轮结果

`abilityApi` 的**最后 409 行**全部搬进 `src/engine/api-misc.js`（通用动作、卡牌与地点信息、
牌堆操作、若干状态标记）。`engine.js` 里的 `abilityApi` 现在只剩装配：

```js
function abilityApi(state, events) {
  return {
    ...createMiscApi(state, events, apiMiscDeps),
    ...createTestApi(state, events, apiTestDeps),
    ...createClueApi(state, events, apiClueDeps),
    ...createEnemyApi(state, events, apiEnemyDeps),
    ...createCardApi(state, events, apiDeps),
  }
}
```

从 979 行 / 179 个方法，变成了 **5 个域模块 + 5 行装配**。

### 18.2 三个坑（都是本轮实际踩到的）

1. **解构里不能写 thunk**：`const { doFight: (...args) => doFight(...args) } = deps` 是非法语法。
   正确写法是先解构 `doFightRaw`，再在工厂体里包一层 `const doFight = (...args) => doFightRaw(...args)`。
2. **切块边界不能按「下一个顶层声明」找**：`abilityApi` 之后紧跟的是 `payAbilityCost` 的**前导注释**，
   按「下一个 function/const」扫描会把注释和残片一起吞进新模块，尾部出现孤立 `}`。
   正确做法：显式以 `  }` + `}`（对象与函数的收尾）为边界，或切完后按行尾裁剪。
3. **重复键要在同一个模块里保持相对顺序**：本轮搬走的 88 个方法里有 `cardName` / `cardTraits`
   各出现两次（后写覆盖先写）。它们都在同一批，顺序天然保留；跨模块没有重复键（已程序化核对），
   所以 spread 的先后不影响语义。

### 18.3 现状

| 文件 | 行数 |
| --- | --- |
| `src/engine/engine.js` | **10392**（6d-10 后 10745） |
| `src/engine/moves.js` | 652 |
| `src/engine/api-misc.js` | **470** |
| `src/engine/combat.js` | 446 |
| `src/engine/actions.js` | 397 |
| `src/engine/phases.js` | 311 |
| `src/engine/api-card.js` | 302 |
| `src/engine/describe.js` | 176 |
| `src/engine/api-enemy.js` | 163 |
| `src/engine/api-clue.js` | 139 |
| `src/engine/api-test.js` | 93 |
| `src/engine/card-lookup.js` | 90 |

累计迁出 **约 2262 行**（12654 → 10392，−17.9%）。下一步：`performTest`（782 行）→ `src/engine/tests.js`，
然后 `scenarioRuntime`（317 行），最后进入战役插件化。

## 19. 6d-12：拆出 tests.js（performTest，最大的一块）

### 19.1 拆的是什么

`performTest`（**782 行**）搬进 `src/engine/tests.js`，导出 `createPerformTest(deps)`。
一次检定跨 ST.1–ST.8 八个阶段（投入 → 揭示标记 → 结算修正 → 结果回调 → 收尾），
它调用几乎所有子系统（卡牌投入、混乱标记、隐藏卡、反应窗口），依赖 **61 项**——
是拆分过程中依赖最多的一块，也是「engine.js 之后只剩编排」的关键一步。

### 19.2 新坑：被 api 依赖表引用的函数必须惰性装配

`performTest` 被多个 `apiXxxDeps` 表引用，而那些表在**模块顶层立即求值**。
用 `export const performTest = createPerformTest({...})` 会得到：

```
ReferenceError: Cannot access 'performTest' before initialization
```

解法：保留**函数声明**（hoisted）+ 首次调用装配：

```js
let performTestImpl = null
export function performTest(state, seat, skill, difficulty, options = {}) {
  performTestImpl ||= createPerformTest({ /* 61 项依赖 */ })
  return performTestImpl(state, seat, skill, difficulty, options)
}
```

这样既保持 `import { performTest } from engine.js` 的老路径，也保证依赖在运行时才解析。
（thunk 方案在这一例里不适用：`performTest` 需要被当作函数值直接调用几十次，包装层反而更干净。）

### 19.3 另一个坑：切块尾部混进下一段的注释

`performTest` 之后紧跟「检定 resolve 回调挂 WeakMap」和「学无止境失败窗口」两段注释，
按「下一个顶层声明」扫边界会把它们吞进新模块，尾部出现孤立 `}`。
做法：切完后**从尾部逐行回退到第一个 `}`**（函数收尾），并在新模块里显式补 `return performTest`。

### 19.4 现状

| 文件 | 行数 |
| --- | --- |
| `src/engine/engine.js` | **9684**（6d-11 后 10392） |
| `src/engine/tests.js` | **858** |
| `src/engine/moves.js` | 652 |
| `src/engine/api-misc.js` | 470 |
| `src/engine/combat.js` | 446 |
| `src/engine/actions.js` | 397 |
| `src/engine/phases.js` | 311 |
| `src/engine/api-card.js` | 302 |
| `src/engine/describe.js` | 176 |
| `src/engine/api-enemy.js` | 163 |
| `src/engine/api-clue.js` | 139 |
| `src/engine/api-test.js` | 93 |
| `src/engine/card-lookup.js` | 90 |

累计迁出 **约 2970 行**（12654 → 9684，−23.5%）。engine.js 首次降到 1 万行以下。

## 20. 6d-13：拆出 scenario-runtime.js（内容层 ↔ 引擎的边界）

### 20.1 拆的是什么

`scenarioRuntime`（297 行，实际搬出 397 行含裁剪）搬进 `src/engine/scenario-runtime.js`，
导出 `createScenarioRuntime(deps)`，依赖 **90 项**——这是整个拆分里依赖最多的一块。

为什么它值 90 个依赖：剧本内容（遭遇卡、地点、密谋、议程）拿不到引擎内部，只能拿到这个**窄接口**：
放置地点、生成敌人、造成伤害、抽遭遇、推进密谋、检查补给……它本质是内容层与引擎之间的边界对象。
拆成独立模块后，「内容层能做什么」第一次以一张 90 行的依赖表形式可见——这对后续战役插件化
（按战役切分接口）是必要前提。

### 20.2 做法

同 `performTest`：用**函数声明 + 惰性装配**保留老调用点（`scenarioRuntime(state, events, testSource)`），
因为它的依赖表在模块顶层被多处引用，`export const` 会 TDZ。

### 20.3 现状

| 文件 | 行数 |
| --- | --- |
| `src/engine/engine.js` | **9485**（6d-12 后 9684） |
| `src/engine/tests.js` | 858 |
| `src/engine/moves.js` | 652 |
| `src/engine/api-misc.js` | 470 |
| `src/engine/combat.js` | 446 |
| `src/engine/scenario-runtime.js` | **398** |
| `src/engine/actions.js` | 397 |
| `src/engine/phases.js` | 311 |
| `src/engine/api-card.js` | 302 |
| `src/engine/describe.js` | 176 |
| `src/engine/api-enemy.js` | 163 |
| `src/engine/api-clue.js` | 139 |
| `src/engine/api-test.js` | 93 |
| `src/engine/card-lookup.js` | 90 |

累计迁出 **约 3169 行**（12654 → 9485，−25.0%）。

## 21. 6d-14：拆出 weakness.js（弱点结算）+ 修掉一条存量失败

### 21.1 拆的是什么

`resolveWeakness`（231 行）搬进 `src/engine/weakness.js`，导出 `createWeakness(deps)`（36 项依赖）。
弱点是这套引擎里规则最碎的一块（敌人型、威胁型、附着型、可打出、会升级、会洗回牌库），
Phase 5 补齐「弱点描述子 + resolve 通道」之后这里已经是「数据驱动 + 少量兜底分支」，
拆出来便于继续按 roadmap §7 的判据收。

engine 侧仍是惰性装配，保持 `resolveWeakness(state, inv, def, events, texts)` 调用点不变。

### 21.2 顺手发现并修掉一条**存量失败**

跑 `dunwich-player-acceptance` 时红了：

```
02110.campaign.adaptable   undefined !== 2
```

用 `git stash` 验证后确认：**这条失败在本次改动之前就存在**（`dunwich-player-acceptance`
不在 fast tier 里，所以一直没被看见）。原因是 Phase 5（5b-9）把「适应性」迁成了条目级
`adaptableSwaps`，但验收契约还写着旧字段名 `campaign.adaptable`，而 `behaviorOf()` 也没有折叠这个字段。

修法（两处，都是把契约对齐到新形状）：
1. `behaviorOf()` 增加 `...(entry?.adaptableSwaps ? { adaptableSwaps: entry.adaptableSwaps } : {})`；
2. 契约从 `['campaign.adaptable', 2]` 改成 `['adaptableSwaps', 2]`。

另外 `tools/audit-dunwich-acceptance.mjs` 因断言数据变化报 `Acceptance artifact stale`，
用 `--write` 重采（333/333 verified，384 testsPassed）。

### 21.3 现状

| 文件 | 行数 |
| --- | --- |
| `src/engine/engine.js` | **9299**（6d-13 后 9485） |
| `src/engine/tests.js` | 858 |
| `src/engine/moves.js` | 652 |
| `src/engine/api-misc.js` | 470 |
| `src/engine/combat.js` | 446 |
| `src/engine/scenario-runtime.js` | 398 |
| `src/engine/actions.js` | 397 |
| `src/engine/phases.js` | 311 |
| `src/engine/weakness.js` | **283** |
| `src/engine/api-card.js` | 302 |
| `src/engine/describe.js` | 176 |
| `src/engine/api-enemy.js` | 163 |
| `src/engine/api-clue.js` | 139 |
| `src/engine/api-test.js` | 93 |
| `src/engine/card-lookup.js` | 90 |

累计迁出 **约 3355 行**（12654 → 9299，−26.5%）。

## 22. 6d-15：拆出 player-effects（搬到 cards 层，战役插件化第一步）

### 22.1 拆的是什么

`dunwichPlayerEffect`（273 行）是「数据体描述不了的玩家卡效果」的落脚点：最初只服务敦威治卡包，
名字保留了历史，但它现在按 `effect.type` 分派**所有战役**的玩家卡复杂效果。
搬出后放在 **`src/cards/player-effects.js`**（不是 `src/engine/`），导出 `createPlayerEffects(deps)`（31 项依赖）。

### 22.2 为什么放在 cards 层

第一版放在 `src/engine/player-effects.js`，立刻被 **Phase 6 门禁**（`tests/phase6-guard.test.mjs`）抓住：

```
not ok · Phase 6 门禁：引擎源码里没有战役名
```

这个函数的**名字与注释天然带 `dunwich`**，而门禁要求 `src/engine/*` 里不出现战役名。
放到 `src/cards/` 有两个好处：

1. 职责正确——玩家卡效果属于内容层，不是引擎；
2. 满足门禁，不需要为了过关而给函数改名（改名会连带改 `api.dunwichPlayerEffect` 的调用点）。

> 这正是 Phase 6 门禁的价值：它不是纸面规则，而是**逼着把内容放回内容层**。

### 22.3 现状

| 文件 | 行数 |
| --- | --- |
| `src/engine/engine.js` | **9065**（6d-14 后 9299） |
| `src/engine/tests.js` | 858 |
| `src/engine/moves.js` | 652 |
| `src/engine/api-misc.js` | 470 |
| `src/engine/combat.js` | 446 |
| `src/engine/scenario-runtime.js` | 398 |
| `src/engine/actions.js` | 397 |
| `src/engine/phases.js` | 311 |
| `src/engine/api-card.js` | 302 |
| `src/engine/weakness.js` | 283 |
| `src/engine/describe.js` | 176 |
| `src/engine/api-enemy.js` | 163 |
| `src/engine/api-clue.js` | 139 |
| `src/engine/api-test.js` | 93 |
| `src/engine/card-lookup.js` | 90 |
| `src/cards/player-effects.js` | **320** |

累计迁出 **约 3589 行**（12654 → 9065，−28.4%）。

## 23. 6d-16：拆出 ability-exec.js（能力的执行层）

### 23.1 拆的是什么

三个函数一起搬进 `src/engine/ability-exec.js`（共 300 行，48 项依赖）：

| 函数 | 行数 | 职责 |
| --- | --- | --- |
| `doAbility` | 99 | 结算一次已选定的能力（费用、目标、描述子/旧式效果） |
| `openAbilityWindow` | 115 | 在反应窗口里枚举可用的声明式能力并询问 |
| `effectError` | 86 | 判定一条效果当前是否可执行（`legalMoves` 与提示共用） |

它们与 `src/engine/ability.js`（注册表、校验）分工不同：那边是**声明**，这边是**执行**。
engine 侧用惰性装配保留原调用点（这三个函数被多个依赖表在顶层引用）。

### 23.2 现状

| 文件 | 行数 |
| --- | --- |
| `src/engine/engine.js` | **8831**（6d-15 后 9065） |
| `src/engine/tests.js` | 858 |
| `src/engine/moves.js` | 652 |
| `src/engine/api-misc.js` | 470 |
| `src/engine/combat.js` | 446 |
| `src/engine/scenario-runtime.js` | 398 |
| `src/engine/actions.js` | 397 |
| `src/engine/ability-exec.js` | **369** |
| `src/engine/phases.js` | 311 |
| `src/engine/api-card.js` | 302 |
| `src/engine/weakness.js` | 283 |
| `src/engine/describe.js` | 176 |
| `src/engine/api-enemy.js` | 163 |
| `src/engine/api-clue.js` | 139 |
| `src/engine/api-test.js` | 93 |
| `src/engine/card-lookup.js` | 90 |
| `src/cards/player-effects.js` | 320 |

累计迁出 **约 3823 行**（12654 → 8831，−30.2%）。

## 24. 6d-17：拆出 campaign-flow.js（关间 / 重开 / 结局 / 创伤）

### 24.1 拆的是什么

六个函数（共 199 行，32 项依赖）搬进 `src/engine/campaign-flow.js`：

| 函数 | 行数 | 职责 |
| --- | --- | --- |
| `progressCampaign` | 39 | 按战役图推进到下一关 |
| `restartScenario` | 16 | 重开当前关卡 |
| `finishScenario` | 77 | 结算一关（胜利/失败、记录、经验） |
| `applyResolutionEffects` | 48 | 结算结局条目（含剧情盟友、创伤） |
| `addTrauma` / `applyDefeatTrauma` | 7 / 12 | 创伤簿记（败退、撤退、弱点） |

与 `scenario-runtime` 的分工：那边是剧本**进行中**的接口，这边是剧本**之间**的簿记。

### 24.2 坑：const 解构会 TDZ

第一版在文件末尾写：

```js
const campaignFlow = createCampaignFlow({ … })
const { progressCampaign, finishScenario, addTrauma, … } = campaignFlow
```

结果 `ReferenceError: Cannot access 'addTrauma' before initialization`——因为 `addTrauma` 被更早的
依赖表（`ability-exec` 等）在模块顶层引用。

解法：同 `performTest` —— 函数声明 + 惰性装配：

```js
let campaignFlowImpl = null
function campaignFlowApi() { campaignFlowImpl ||= createCampaignFlow({ … }); return campaignFlowImpl }
function addTrauma(...args) { return campaignFlowApi().addTrauma(...args) }
```

**规律**：只要一个函数可能出现在「模块顶层立即求值的依赖表」里，就必须用函数声明（hoisted）而不是
`const` 解构。

### 24.3 顺带发现：`campaign-n4` 有一批**存量失败**（与本轮无关）

跑 `tests/campaign-n4.test.mjs` 有 8 条红（`N4 合法战役失败流程 1人/easy…`、`N4 同次伤害恐惧…`）。
`git stash` 验证：**改动前同样红**。它们不在 fast tier 里，所以一直没暴露。
本轮不处理（属于 N4 战役流程的独立问题），已在此记录，避免下次误判为本轮引入。

### 24.4 现状

| 文件 | 行数 |
| --- | --- |
| `src/engine/engine.js` | **8671**（6d-16 后 8831） |
| `src/engine/tests.js` | 858 |
| `src/engine/moves.js` | 652 |
| `src/engine/api-misc.js` | 470 |
| `src/engine/combat.js` | 446 |
| `src/engine/scenario-runtime.js` | 398 |
| `src/engine/actions.js` | 397 |
| `src/engine/ability-exec.js` | 369 |
| `src/engine/phases.js` | 311 |
| `src/engine/api-card.js` | 302 |
| `src/engine/weakness.js` | 283 |
| `src/engine/campaign-flow.js` | **252** |
| `src/engine/describe.js` | 176 |
| `src/engine/api-enemy.js` | 163 |
| `src/engine/api-clue.js` | 139 |
| `src/engine/api-test.js` | 93 |
| `src/engine/card-lookup.js` | 90 |

累计迁出 **约 3983 行**（12654 → 8671，−31.5%）。

## 25. 6d-18：拆出 setup.js（建局流程）

### 25.1 拆的是什么

14 个函数（共 485 行，62 项依赖）搬进 `src/engine/setup.js`：

`makeInvestigator` / `drawOpeningHand` / `buildInvestigatorsDeck` / `prepareInvestigator` /
`refreshStateResources` / `unknownCardCodes` / `createGameState` / `pickAiInvestigator` /
`startScenario` / `scenarioStartLocation` / `setupScenarioLocations` / `setupScenarioEnemies` /
`setupScenarioDecks` / `setupChaosBag`

即「一局怎么开始」的全部步骤。拆完后 `engine.js`（8281 行）只剩运行时：动作、检定、阶段、API。
`createGameState` / `refreshStateResources` / `unknownCardCodes` 在 engine 里用**函数声明**再导出，
外部 import 路径与调用点不变。

### 25.2 关键坑：**模块级 `let` 绑定不能进依赖表**

拆完立刻红了 3 条：

```
D1 extracurricularActivity uses the existing engine setup …
N5 第二战役由注册表驱动 …
  campaignId: 未知战役 dunwichContract0        ← content/schema.js 的 assertLaunchableCampaign
```

原因：`content/registered.js` 的 `contentRegistry` 是 **`let`**，`registerContentBundle()` 会**重新赋值**它。
engine.js 里 `import { contentRegistry }` 是 ESM **live binding**，永远看到最新值；
但把它塞进 `deps` 对象后，就变成了**首次调用时的快照**——测试先建局、再注册战役，第二个战役就查不到。

修法：`setup.js` 直接 `import { contentRegistry } from '../../content/registered.js'`（live binding），
**不**从 deps 传。

> 通用规律（已写进本文档 §25.2）：
> **`let`/可重新赋值的模块绑定（如 `contentRegistry`）必须用 `import` 走 live binding，不能进依赖注入表。**
> 常量对象（`EFFECTS`、`ALL_CARDS` 等）可以放心注入——它们是同一对象、原地修改。

### 25.3 现状

| 文件 | 行数 |
| --- | --- |
| `src/engine/engine.js` | **8281**（6d-17 后 8671） |
| `src/engine/tests.js` | 858 |
| `src/engine/moves.js` | 652 |
| `src/engine/setup.js` | **578** |
| `src/engine/api-misc.js` | 470 |
| `src/engine/combat.js` | 446 |
| `src/engine/scenario-runtime.js` | 398 |
| `src/engine/actions.js` | 397 |
| `src/engine/ability-exec.js` | 369 |
| `src/engine/phases.js` | 311 |
| `src/engine/api-card.js` | 302 |
| `src/engine/weakness.js` | 283 |
| `src/engine/campaign-flow.js` | 252 |
| `src/engine/describe.js` | 176 |
| `src/engine/api-enemy.js` | 163 |
| `src/engine/api-clue.js` | 139 |
| `src/engine/api-test.js` | 93 |
| `src/engine/card-lookup.js` | 90 |

累计迁出 **约 4373 行**（12654 → 8281，−34.6%）。

## 26. 6d-19：拆出 dispatch.js（行动分派层）

### 26.1 拆的是什么

五个函数（共 326 行，93 项依赖——依赖最多的一块）：

```
applyMove → executeCommand →（关间？executeHubMove ：applyAction）
                             ↓
                        executeAction → 具体 do*（doPlay / doFight / doInvestigate …）
applyMoveUnchecked（绕过校验的执行入口，供测试与回放）
```

它本身不含规则，只做「校验通过后分发」与「动作级事件的统一记录」。
拆开后 engine.js 顶层只剩：状态机（阶段）、各个 `do*`、能力层 api。

### 26.2 坑：模块级可变状态不能用依赖注入

第一版把 `currentActionKind`（engine 里是 `let currentActionKind = null`）当普通依赖传进去，
运行时报：

```
Assignment to constant variable.
```

原因：解构出来的是 `const`，而分派层需要**写**这个变量（借机攻击判定用）。而且即便改成 `let`，
写入的也是本地副本，engine 看不到——**行为会静默错**。

修法：注入**取值/赋值函数**：

```js
// engine.js → createDispatch deps
getCurrentActionKind: () => currentActionKind,
setCurrentActionKind: value => { currentActionKind = value },
```

> 通用规律（§26.2 与 §25.2 是同一族问题）：
> - **可重新赋值的模块绑定**（`contentRegistry`）→ 用 `import` live binding，不注入；
> - **可变的模块级 `let` 状态**（`currentActionKind`）→ 注入 getter/setter，不注入值；
> - **常量对象**（`EFFECTS` / `ALL_CARDS`）→ 可安全注入。

### 26.3 现状

| 文件 | 行数 |
| --- | --- |
| `src/engine/engine.js` | **8059**（6d-18 后 8281） |
| `src/engine/tests.js` | 858 |
| `src/engine/moves.js` | 652 |
| `src/engine/setup.js` | 578 |
| `src/engine/api-misc.js` | 470 |
| `src/engine/combat.js` | 446 |
| `src/engine/dispatch.js` | **436** |
| `src/engine/scenario-runtime.js` | 398 |
| `src/engine/actions.js` | 397 |
| `src/engine/ability-exec.js` | 369 |
| `src/engine/phases.js` | 311 |
| `src/engine/api-card.js` | 302 |
| `src/engine/weakness.js` | 283 |
| `src/engine/campaign-flow.js` | 252 |
| `src/engine/describe.js` | 176 |
| `src/engine/api-enemy.js` | 163 |
| `src/engine/api-clue.js` | 139 |
| `src/engine/api-test.js` | 93 |
| `src/engine/card-lookup.js` | 90 |

累计迁出 **约 4595 行**（12654 → 8059，−36.3%）。
