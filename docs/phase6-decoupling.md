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
