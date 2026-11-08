# EOTE 玩家卡 B（08079–08133）与 P8 账本独立复核

- 复核员：独立 adversarial verifier（不预设审计员或 Lead 结论）
- 日期：2026-11-08
- 工作区：`G:\boardgame-hall-ai`
- 写入范围：仅 `games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/verify/**`；未改 `games/arkhamhorror` 或其他目录
- 产物：本文件 + `games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/verify/player-b-verify.json` + 独立复算/探针脚本（同目录）

## 0. 结论速览

| 复核对象 | 结论 | 关键数字/证据 |
| --- | --- | --- |
| 玩家卡 B 的 5 组 high（共 9 条 high） | **9/9 实质确认，0 驳回**；2 处证据行需修正、1 处表述夸大、1 处严重度可争议 | 08105/08107、08102、08130/08131×2、08091、08083 全部用真实引擎探针复现 |
| 12 条 high 抽样 6 条 | 5 组之外只剩 3 条 high（08079/08081/08088），全部复核并确认；另抽 3 条 medium（08084/08100/08117）也确认 | 见 §2 |
| Lead 的 135/403「无有效证据」 | **字面口径可复算为 135，但语义上夸大**：其中 4 条是假阳性（08011b–08014b 由 lily 测试覆盖），2 条 b 面记录疑似由 a 面覆盖；**稳健核心是 129 条 scenario-ledger** | 129/129 指向 HeartPart2，0/129 含卡号；110 条在任何测试文件中都不出现（96 verified + 14 simplified） |
| 135 的根因 | `audit-eote-scenarios.mjs:88-90` 把全部 264 张战役卡塞进每个章节；`audit-eote-all-cards.mjs:258-261` last-wins 全落到最后一章 | 8 个章节的 `cardCodes` 集合相同（各 264 unique codes，重复次数不同） |
| `audit/eote-player-acceptance.json` 115 verified / noSimplified | **形式为真、实质不成立** | 115/115 `simplified:false`，但 55/115 条目有 `approximation` 注释、11/115 有 `note:'approximation'`、0/115 设 `simplified:true`；10 抽样 9 条明确矛盾 + 1 条行为矛盾 |
| 指定测试 | **63 pass / 0 fail**（约 7.3s） | 但 08102/08105/08107 的测试绕过真实窗口/criteria |

---

## 1. 玩家卡 B 的 5 组 high 逐条复核（含 9 条 high）

### 1.a 08105 / 08107：`state.skillTest.actionKind` 真机为空 → 能力不出现

**判定：确认（限定 EotE / 无 `trackTestTarget` 的正常路径）；“真实引擎从不设置”属夸大。**

- 条目读点：
  - `src/cards/entries/08105.js:16`：`criteria: ({ state }) => ['fight','investigate'].includes(state.skillTest?.actionKind)`
  - `src/cards/entries/08107.js:21,25`：两条能力同一判据
- 引擎写点：
  - `src/engine/tests.js:166-167`：`typedTarget` 只有在 scenarioRule/assetRule `trackTestTarget` 为真时才是 `options.testTarget`
  - `src/engine/tests.js:173-180`：`skillTest` 对象只在 `typedTarget` 或显式 `options.actionKind` 时写 `actionKind`
  - `src/engine/combat.js:229-236`：fight 只传 `testTarget: { kind:'enemy', id, actionKind:'fight' }`（`combat.js:233`），**不传 `options.actionKind`**
  - `src/engine/actions.js:610`：investigate 同样只传 `testTarget`，不传 `options.actionKind`
- EotE 内无 `trackTestTarget`：全仓 grep 只有 TIC 的 `07163.js:8`、`07181.js:8` 声明 `assetRule.trackTestTarget`，EotE 条目 0 条。
- 反证/限定：
  - `tests.js:176` 在 `options.actionKind` 存在时会写 `skillTest.actionKind`；
  - `tests.js:166-175` 在 `trackTestTarget` 开启时会写；
  - `tests.js:253-259` 会把 `testTarget.actionKind` 写进 `testInitiated` 的 **context**（08086 正是读 `context.actionKind`，`08086.js:31`，所以 08086 不受影响）。
  - 因此“engine 从不设置 actionKind”不成立；正确表述是“EotE 正常战斗/调查路径不写 `state.skillTest.actionKind`，只写 `testInitiated.context.actionKind`”。
- 真实引擎探针（本复核独立编写，`games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/verify/_probe-verify.mjs`）：
  - A1：真实 fight，`test.beforeCommit` 窗口（用合成控制条目强制窗口打开）选项 = `["让过","probe-free-1：probe control free"]`；`state.skillTest.actionKind = null`；skillTest keys = `seat,skill,difficulty,stage,committed,publicLog,basicAction,source,printedValue,baseValue,value`（无 actionKind、无 target）。**08105 不出现。**
  - A2：伪造 `state.skillTest.actionKind='fight'` 后，同一窗口出现 `破冰锥：横置：本次攻击/调查检定 +1 技能值` ×2（08105/08107）和 `破冰锥：弃掉破冰锥：成功时额外 +1 伤害/线索`。**08107 两条能力都出现。**
- 测试为何仍绿：
  - `tests/eote-player-m2-3.test.mjs:311` 直接伪造 `s.skillTest = { ..., actionKind:'fight' }`；
  - `tests/eote-player-m2-3.test.mjs:423` 伪造 `actionKind:'investigate'`；
  - 且 `fire()`（`m2-3.test.mjs:64-75`）直接 `executeDescriptor`，不经过 `descriptorUsable`/窗口枚举，criteria 根本不参与。
- 夸大/严重度：结论成立；08105 整卡唯一能力失效、08107 两条能力同时失效，high 合理。仅“从不设置”的措辞需降级为“EotE 正常路径不写”。

### 1.b 08102：真实 `assetLeavesPlay` 的 `context.asset` 没有 `location/traits` → 反应永不出现

**判定：确认；“asset 只有 {id,code,exhausted}”的说法略不精确，但关键字段确实不存在。**

- 条目读点：`src/cards/entries/08102.js:14-16`
  - `context?.asset?.location === inv.location`
  - `(context?.asset?.traits || []).some(t => t.toLowerCase() === 'ally')`
- 真实实例：
  - `src/engine/card-defs.js:306-308`：`newCardInstance = { id, code, ...cardIdentityFields(cardDef(code)), ...fields }`
  - `src/cards/card-identity.js:4`：identity 字段仅 `ruleId/originalCode/identityStatus/approximation/linkedOriginalCode/variant/linkedOriginalCode/haskellCardCode/artId`，**不含 traits/location**
  - 真实探针 B1 的 ally 实例 keys：`id, code, ruleId, originalCode, identityStatus, approximation, linkedOriginalCode, artId, exhausted, enteredRound`；`traits=undefined`、`location=undefined`
- 真实窗口：
  - `src/engine/assets.js:340-341`：`leaveAsset` 先判 `inv.assets.includes(asset)`
  - `src/engine/assets.js:397-402`：`reactionWindow('assetLeavesPlay', { assetCode, assetId, asset, reason, upgrades, ... })`
  - 窗口 context 本身有 `assetCode/assetId/location/reason`，所以**正确的实现方式已经具备**（用 `context.location` + `api.cardTraits(context.assetCode)`），但条目没有用。
- 探针：
  - B2：真实 `leaveAsset(reason:'effect')` 窗口打开（唯一候选是无关的 `researchLibrarian` 反应），**08102 不在选项中**。
  - B3：用测试同款手工 context（`asset:{traits:['Ally'],location:...}`）调用 `reactionWindow`，选项 = `["不打出","保护魂灵"]`，**08102 出现**。
- 测试掩盖：
  - `tests/eote-player-m2-3.test.mjs:292-306` 手工塞 `asset:{traits:['Ally'],ownerSeat:0,location:...}`（296、303 行）；
  - 更关键的是 `fire()`（`m2-3.test.mjs:64-75`）直接执行描述子，**criteria 完全没被评估**，所以这个测试即使删掉 criteria 也会绿。
- 反证检查：没有其他读点会补 `asset.location/traits`。`vehicles.js:115`、`location-swap.js:98` 只对载具/交换位置写 `location`；普通盟友实例没有。
- 夸大：仅“只有 {id,code,exhausted}”不精确（还有 identity 字段和 enteredRound）；“无 traits/location”与“真机不触发”成立。

### 1.c 08130 / 08131：`threatDamageSink` 未接线 + `free + discardSelf` 移不走威胁区卡

**判定：两条 high 均确认；但第二条的引用行 `ability-exec.js:178-189` 不是这两张卡实际走的路径。**

#### c-1 `threatDamageSink` 已实现但条目未声明 `flags.threatDamageSink`

- 条目：`src/cards/entries/08130.js:13-15,21,29-31`；`08131.js:12-13,18,26-28`；均无 `flags`
- 引擎：
  - `src/engine/harm-threat.js:702-740` 的 `healDamageFrom`；读点 `721`：`registeredEntry(card.code)?.flags?.threatDamageSink === true`
  - `src/engine/api-misc.js:231-240`：`api.healDamage` 统一走 `healDamageFrom`
  - `tests/eote-player-primitives.test.mjs:85-102`：合成条目 + `flags:{threatDamageSink:true}`，治疗 1 点后威胁卡离场，原语通过
- 探针：
  - C1：真实抽到 08130 → 威胁区实例 `counters=1`
  - C2：`healDamageFrom(inv,1)` 返回 **0**；威胁卡仍在、counters 仍 1、调查员 damage 未变 → **没有该 flag 时治愈子句完全不可用**
  - C6：`playerWindow('test.beforeCommit')` 会列出 `臂伤：近似-可治愈：弃掉臂伤…`
- 对比：同模板 08132 声明了 `threatHorrorSink`（`08132.js:17-18`），`tests/eote-player-m2-4.test.mjs:674-693` 实测治疗改道并弃卡；伤害侧却没有对应 flag。这不是“引擎没有原语”，而是“条目没接线”。

#### c-2 `free + discardSelf` 无法把威胁区卡移走

- 条目：`08130.js:29-31` / `08131.js:26-28`，`cost: { action:false, discardSelf:true }`
- **实际路径**（描述子能力）：
  - `src/engine/reveal.js:213` `executeDescriptor` → `reveal.js:255` `payAbilityCost`
  - `src/engine/ability-rules.js:139-143`：`if (cost.discardSelf && source) { leaveAsset(state,inv,source); if (!source.removedFromGame && !source.returnedToHand) inv.discard.push(source.code); ... }`
  - `src/engine/assets.js:340-341`：`leaveAsset` 第一行 `if (!inv.assets.includes(asset)) return`；威胁区卡不在 `inv.assets`，直接返回
  - 结果：`inv.discard.push('08130')` 执行了，但 `inv.threat` 里的实例没被移除
- 引用行问题：
  - 审计引用 `ability-exec.js:178-189` 是 **legacy `doAbility`** 的 `cost.discardSelf` 分支；08130/08131 是描述子能力，走 `executeDescriptor` → `payAbilityCost`，不经过 `ability-exec.js:178-189`。
  - 正确证据应为 `ability-rules.js:139-143` + `assets.js:340-341`；**结论不变，但证据行必须改**。
- 探针：
  - C3：`legalMoves` 出现 `⚡免费 近似-可治愈：弃掉臂伤…`
  - C4：使用后 `stillInThreat=true`、`discard` 里出现 1 张 `08130`、`threatCodes=['08130']`
  - C5：同一窗口内该能力不再出现；卡继续留在威胁区，继续锁行动
- 测试：`tests/eote-player-m2-4.test.mjs:652-661`（08130）、`663-672`（08131）只测“进威胁区 + 锁行动”，**没有治愈/弃卡断言**。

### 1.d 08091：第二子句整条缺失，而咒印原语已实现

**判定：确认。**

- 条目：
  - `src/cards/entries/08091.js:14-16` 自述省略“符号揭示后改为查找并揭示咒印”
  - `08091.js:25-45` 只有一条 `entersPlay` 能力；用 `api.addEffect` 记录咒印（`36-43`）
  - 无 `tokenReveal` 能力
- 引擎原语：
  - `src/engine/api-misc.js:1418-1442`：`setSigilToken` / `replaceRevealedToken`
  - `tests/eote-player-primitives.test.mjs:197-215`：合成支援上设置 sigil + 手工 `tokenReveal` context 替换
- 探针 G：
  - `registeredEntry('08091').abilities` = 仅 `{kind:'entersPlay'}`；无 tokenReveal
  - 条目源码使用 `addEffect`（true），未使用 `setSigilToken`（false）
- 反证检查：全仓 `setSigilToken/replaceRevealedToken` 只出现在 `api-misc.js:1420/1435` 与 primitive 测试；没有任何真实卡接线。原语是“可用的”，但没有自动读点；要工作仍需条目声明 `tokenReveal` 反应并读取 `source.sigilToken`。
- 账本冲突：`audit/eote-player-queue.json:277-282` 把 `m2-3-08091` 标 `done`，但条目未接线。
- 测试：`tests/eote-player-m2-3.test.mjs:372-381` 只断言第一子句（addEffect 的 label/duration/sourceInstanceId）；第二子句无测试。

### 1.e 08083：`api.healAsset(target, 1)` 第二参类型错误

**判定：确认；严重度 high 可争议（medium 也说得通），但机制与结论准确。**

- 条目：`src/cards/entries/08083.js:38`：`api.healAsset(target, 1); api.addAssetHorror(target, -1)`
- 签名：`src/engine/api-misc.js:759-768`：`healAsset: (card, spec = {}) => { card.damage = Math.max(0, (card.damage||0) - (spec.damage||0)); ... }`
  - 传数字 1 时 `spec.damage` 为 `undefined` → 伤害治疗 0
- 描述子 API 包装：`src/engine/reveal.js:303-306` 只补 `owner/cardCode`，不会把数字转成 spec；`{...1}` = `{}`
- 恐惧侧：`src/engine/api-clue.js:67-71` 的 `addAssetHorror` 没有下限：`card.horror = (card.horror||0) + amount`，可从 0 变 -1
- 探针 D：
  - D1：选真实的 `asset:<id>` 选项；盟友 damage 1→**1**（没治），horror 1→**0**（治了），调查员未变
  - D2：盟友 damage 1→1，horror 0→**-1**
- **审计员交付的 probe 与 notes 不一致**：`games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/player-b/_probe2.mjs` P5 的实际输出是 `damage after = 1, horror after = 1`（它自动选了第一个选项 = 调查员，根本没测盟友分支）；notes/findings 却写“probe：ally damage 1→1、horror 1→0”。本复核显式选择 `asset:` 选项后得到 horror 1→0，结论成立，但**交付的 probe 输出不能复现该结论**。
- 测试：`tests/eote-player-m2-3.test.mjs:106-114` 只测调查员目标；盟友分支无断言。
- 夸大：这是“半条小治疗静默失效”，不是整卡失效；high 可接受但偏高。

---

## 2. 12 条 high 的抽样复核

**先说明抽样可行性**：12 条 high 的清单是 08079、08081、08083、08088、08091、08102、08105、08107、08130×2、08131×2。5 个指定项覆盖 9 条（08105、08107、08102、08130×2、08131×2、08091、08083）。剩余只有 **3 条** high：08079、08081、08088。因此“除上述 5 条外随机抽 6 条 high”在集合上不可能；本复核改为 **3 条剩余 high 全查 + 另取 3 条 medium**，共 6 条。

| # | 卡号 | 级别 | findings 摘要 | 判定 | 证据行是否支持 | 备注 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 08079 | high | “该攻击伤害/恐惧不能分配给盟友”整句未实现；主效果仍生效 | 确认 | 是 | `08079.js:6-7,14-22`；`assignHarm`（`harm-threat.js:117,140-181`）无 attack 参数；`applyHarm` 收到 attack（`enemies.js:859`）但只在分配完成后的 `harmAssigned` context 传（`enemies.js:1020-1022`） |
| 2 | 08081 | high | 缺 `flags.composureDamage`，伤害侧强制分配未接线 | 确认 | 是 | `08081.js:16-24`、`harm-threat.js:162-165`；探针 F：damage 选项含“由调查员承受”，horror 不含 |
| 3 | 08088 | high | `eventPlayed` 永久把 uses 设为 2、不限打牌者 | 确认（小幅不精确） | 是 | `08088.js:22-24`；`actions.js:519-523`；探针 E：seat1 的事件让 seat0 的 uses 0→2，再触发仍 2；“跨座位”实际受同地点限制（`encounter.js:326`）。注意：`_probe.mjs` P2 输出是 0→0（它没选反应），与 notes 的 0→2→2 不符；`_probe2.mjs` P7 与本复核 E2/E3 才真正触发 |
| 4 | 08084 | medium | 未印的精英排除 | 确认 | 是（参考行号漂移） | `08084.js:33-38`（34 行 `!enemy.elite`）；参考 `OnTheTrail1.hs` 实际 25 行、`OnTheTrail3.hs` 实际 22 行（findings 写 26/34） |
| 5 | 08100 | medium | “two different actions”未去重 | 确认 | 是 | `08100.js:36-40` 连续两次 `performAction`（38-39）；`performAction`（9-29）没有记录第一次选择 |
| 6 | 08117 | medium | 单一合法目标时自动花充能，违反 “may” | 确认 | 是 | `08117.js:43-49`：`if (options.length===1) break`；`options.length===2 && options[0].id==='skip'` 时直接取 `options[1]` |

---

## 3. P8 全卡账本 `audit/eote-all-card-acceptance.json` 独立复算

### 3.1 独立口径（不复用 Lead 脚本）

自写 `games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/verify/_ledger-recompute.mjs`，输出 `_ledger-recompute.json`。判定标准：

1. 记录有 `evidence.file`：该测试文件全文必须包含该卡号（按 token 边界匹配，避免 `08558` 命中 `08558b`）；
2. 或 `evidence.kind === 'strong'` 且 `evidence.test` 标题含卡号；
3. 额外扫描全部 `tests/*.test.mjs`，区分“引用错文件但别处有”与“任何测试都没有”；
4. 额外用 `ledger.testRun.passRecords` 把 strong 标题解析回测试文件，检查文件是否含卡号；
5. 额外按 entry 路径推导“本应引用的章节测试”，检查该测试是否含卡号。

### 3.2 核心数字

| 指标 | 数字 |
| --- | --- |
| 记录总数 | **403** |
| 字面口径 valid / invalid | **268 / 135** |
| invalid 按 partition | eoteCampaign **131**；eoteInvestigators **4** |
| invalid 按 evidence kind | strong **4**；file **2**；scenario-ledger **129** |
| invalid 按 status | verified **121**；simplified **14** |
| strong 有效 | 138/142 |
| file 有效 | 130/132 |
| scenario-ledger 有效 | **0/129** |
| strong 标题→文件解析后 invalid | **131**（129 scenario-ledger + 2 file） |
| 其中 investigator 假阳性 | **4**（08011b/08012b/08013b/08014b） |
| 129 scenario-ledger 中在任何测试文件都找不到卡号 | **110**（96 verified + 14 simplified） |
| 129 scenario-ledger 中卡号出现在别的测试文件 | **19**（错误引用，但可追溯） |
| 129 按 entry 目录（=章节）分布 | fatalMirage 60、cityOfTheElderThings 26、toTheForbiddenPeaks 15、the_heart_of_madness 10、memorials_of_the_lost 6、tekelili 5、ice_and_death 3、left_behind 2、nameless_horrors 1、shoggoths 1 |

### 3.3 129 条 scenario-ledger：3 个事实全部成立

1. **129/129 全部指向 `tests/eote-scenario-theHeartOfMadnessPart2.test.mjs`，chapter 全部 `theHeartOfMadnessPart2`。**
2. **该文件不含 129 个卡号中的任何一个**（0/129）。文件本身 206 行，含 `08648`（第 194 行测试标题）和 `08671–08686`（第 20-38 行 import/数组），但没有 08503/08551/08622/087xx 等任何一个被引用的卡号。
3. **连按 entry 路径推导的 expected chapter test 也不含这些卡号**：129 条全部为 `false`。也就是说，问题不只是“把 A 章测试写成 B 章测试”；这些章节测试本身不按卡号逐卡断言（19 条卡号只在 `eote-migration` 等别的测试里出现，110 条任何测试都不出现）。

### 3.4 根因：不是一处笔误，是生成器把整章卡池写成了全卡池

**Bug 1：`audit-eote-scenarios.mjs:88-90`**

```js
const assignedCards = chapter.gatherSets.flatMap(set => scope.encounterGroups
  .filter(group => group.id.toLowerCase() === String(set.set).toLowerCase())
  .flatMap(group => CAMPAIGN_CODES.filter(code => entryCodes.has(code) && code.startsWith('08'))))
```

内层 `flatMap(group => CAMPAIGN_CODES.filter(...))` **完全不使用 `group`**，对每个匹配的遭遇组都返回全部 264 张战役卡；多个 gatherSets 再把整份列表重复多次。结果：

- `audit/eote-scenario-acceptance.json` 的 8 个 `chapters[].cardCodes` 数组**卡号集合完全相同**（每个都是同样的 **264** 个 unique codes）；数组长度 1848/1584/2640，只是同一份全量列表重复次数不同。其中 6 个数组序列化后完全相同，另 2 个仅重复次数不同；
- 每个章节 1848–2640 条，但 unique codes 都是 **264**；
- 总 `cardCoverageAssigned` 15312 = 8 章重复计数。

证据：`audit/eote-scenario-acceptance.json:42,1926,3810,5694,7578,9198,11874,13758`（8 个 cardCodes 数组）；章节 id 在 `:34`（iceAndDeathPart1）到 `:13750`（theHeartOfMadnessPart2）。

**Bug 2：`audit-eote-all-cards.mjs:258-261, 302-308`**

```js
const chapterByCode = new Map()
for (const chapter of ledgers.scenario?.chapters || []) {
  const files = [`tests/eote-scenario-${chapter.id}.test.mjs`]
  for (const code of chapter.cardCodes || []) chapterByCode.set(code, { id: chapter.id, files })
}
...
const chapter = chapterByCode.get(code)
if (chapter) {
  const file = chapter.files.find(candidate => testRun.filesWithPasses.has(candidate))
  if (file) used.push({ kind: 'scenario-ledger', titleMatched: false, ledgerMatched: true, file, chapter: chapter.id })
}
```

`Map.set` 是 last-wins；由于每章都含全部 264 个 code，每个 code 最终都映射到**最后一章** `theHeartOfMadnessPart2`。回退逻辑只要求该章节测试“本次有通过用例”，**不要求文件含该卡号**。因此 129 条全部落到 HeartPart2。

**Bug 3：门禁太弱，假绿**

`audit-eote-all-cards.mjs:429`：

```js
withoutEvidence: records.filter(record => record.status !== 'no-behavior' && !record.evidence.length).length
```

`:470`：`everyBehaviorCardHasEvidence: evidenceSummary.withoutEvidence === 0`。

它只检查 `evidence.length > 0`，不检查 evidence 是否可追溯。因此 135 条 citation-invalid 仍然让 `withoutEvidence: 0`、`everyBehaviorCardHasEvidence: true` 通过（`audit/eote-all-card-acceptance.json:5,14413`）。

### 3.5 Lead 的「135/403」准确吗？

**字面口径：准确。语义口径：夸大。**

- **字面 135**：用 Lead 的规则（file 含 code 或 strong title 含 code）复算为 268 valid / 135 invalid，完全一致。
- **4 条确定假阳性**（eoteInvestigators）：
  - `08011b/08012b/08013b/08014b` 的 strong evidence 标题写的是 a 面（`P5 08010 演武 08011a…`），但产生该标题的测试文件 `tests/eote-investigator-lily.test.mjs` **明确 import 并断言 b 面**：
    - import：`tests/eote-investigator-lily.test.mjs:23,25,27,29`
    - 断言：`:205,213,221,233,246,267-275,309,314,333,336,349-352`
  - Lead 的脚本只看标题字符串，没有把标题解析回文件；这 4 条不应算“无有效证据”。
- **2 条疑似假阳性**（eoteCampaign file）：
  - `08575b/08579b` 引用 `tests/eote-scenario-fatalMirage.test.mjs`；该文件含 a 面 `08575`（`tests/eote-scenario-fatalMirage.test.mjs:26,93-98,116,143`）和 `08579`（`:93-98`），但不含 b 面 code。a 面行为有测试，b 面是否被覆盖未证；暂列“疑似”，不当作确定假阳性。
- **稳健核心 129**：去掉 4 条确定假阳性后是 131；再去掉 2 条 b 面疑似，正好是 **129 条 scenario-ledger**。这 129 条无论用哪种标准都不成立。
- **真正“任何测试都没提过”的**：129 条中有 19 条卡号出现在别的测试文件（`eote-migration.test.mjs`、`eote-primitives-travel.test.mjs`、`eote-campaign-flow.test.mjs`、`eote-interactions.test.mjs`），属于“引错文件但可追溯”；剩下 **110 条**（96 verified + 14 simplified）在任何 `tests/*.test.mjs` 中都找不到卡号。

**建议给最终报告的表述**：

> 403 条中有 135 条按字面规则无法从引用文件追溯；其中 129 条是 scenario-ledger 系统性错配（全部指向 theHeartOfMadnessPart2，0/129 含卡号）；扣除 4 条由 lily 测试实际覆盖的 b 面假阳性后为 131；其中 **110 条在任何测试文件中都没有出现（96 verified + 14 simplified）**。因此不应把“135”写成“135 张 verified 卡无证据”。

### 3.6 分布

**按 partition（字面 135）**：eoteCampaign 131、eoteInvestigators 4（后者全为假阳性；修正后 eoteInvestigators 0）。

**按章节/entry 目录（字面 135）**：

| 章节/目录 | 数量 |
| --- | --- |
| fatalMirage | 62（60 scenario-ledger + 2 file b 面） |
| cityOfTheElderThings | 26 |
| toTheForbiddenPeaks | 15 |
| the_heart_of_madness（_shared） | 10 |
| memorials_of_the_lost | 6 |
| tekelili | 5 |
| ice_and_death（_shared） | 3 |
| left_behind | 2 |
| nameless_horrors | 1 |
| shoggoths | 1 |
| eoteInvestigators entries（假阳性） | 4 |

**按 status（字面 135）**：verified 121、simplified 14。129 条 scenario-ledger 内部是 **115 verified + 14 simplified**；110 条“任何测试都没有”的是 **96 verified + 14 simplified**。

### 3.7 建议

1. 修 `audit-eote-scenarios.mjs:88-90`：按 encounter group 的真实卡表取交集，而不是对每个 group 返回全量 `CAMPAIGN_CODES`；
2. 修 `audit-eote-all-cards.mjs:258-261`：禁止 last-wins（发现同一 code 属于多个章节时应报错或按真实归属唯一化）；
3. 修回退逻辑：`scenario-ledger` 必须验证 cited file 含 code，或至少验证 expected chapter test 含 code；否则不得作为证据；
4. 收紧 `everyBehaviorCardHasEvidence`：从“非空数组”改为“至少一条可追溯证据”；
5. 重新签发 `audit/eote-scenario-acceptance.json` 与 `audit/eote-all-card-acceptance.json`；在重签前，96 条 verified 的 scenario-ledger 记录应降级为 unproven，14 条 simplified 保留但注明“无逐卡证据”。

---

## 4. `audit/eote-player-acceptance.json`：115 verified / noSimplified 与条目自述 approximation 的矛盾

### 4.1 账本事实

- `audit/eote-player-acceptance.json:10`：`status: verified`
- `:11-18`：`gates.noSimplified: true`（第 14 行）、`everyCardVerified: true`
- `:19-27`：`total 115`、`verified 115`、`simplified 0`
- 全部 115 个 entry：`status:"verified"`、`simplified:false`（逐条）

### 4.2 条目源码自述

对 08019–08133 的 115 个条目逐文件扫描：

- **55/115** 含 `// ... approximation` 注释；
- **11/115** 含正式 `note: 'approximation: ...'`：08113、08120、08121、08122、08123、08124、08125、08130、08131、08132、08133；
- **58/115** 含 `approximation|近似|省略|简化|未实现|缺失` 任一；
- **0/115** 含 `simplified: true`。

全仓 `src/cards/entries` 中唯一 `simplified: true` 是 `04051.js:16`（不在 EotE 115 内）。

### 4.3 口径机制：为什么 noSimplified 会“真”

`tools/audit-eote-player.mjs`：

- `:71-73`：

```js
status: entry && !entry.simplified && tests.length ? 'verified' : 'missing',
...
simplified: entry?.simplified === true || (entry?.abilities || []).some(ability => ability.simplified === true),
```

- `:91`：`noSimplified: entries.every(entry => !entry.simplified)`
- `:56-60`：证据只要求“测试标题以 P6 开头且包含该卡号 token”，不检查测试是否断言了印刷语义。

即：**`simplified` 只看布尔 flag，不看 `note`/注释**。条目把近似写在 `note:`/注释里，flag 保持 false，于是 `noSimplified` 恒真。这不是计算错误，而是门禁口径与项目自己的“披露近似”实践脱节。

### 4.4 抽查 10 张

| 卡号 | 条目自述（file:line） | 账本 status/simplified（file:line） | 判定 |
| --- | --- | --- | --- |
| 08086 | `08086.js:11,13-14`：攻击加成是“成功后追加 1 伤害”而非并入本次攻击 | `:2149 verified` / `:2151 false` | 矛盾 |
| 08097 | `08097.js:11-12`：用日志展示地点字段，不用揭示面原语 | `:2396 verified` / `:2398 false` | 矛盾 |
| 08104 | `08104.js:9-10`：“instead of”实现为追加 | `:2550 verified` / `:2552 false` | 矛盾 |
| 08112 | `08112.js:8-11`：替换当前标记而非两枚都计入 | `:2741 verified` / `:2743 false` | 矛盾 |
| 08113 | `08113.js:11-12,18`：游戏结束/退场近似为每轮结束 | `:2763 verified` / `:2765 false` | 矛盾 |
| 08117 | `08117.js:43-44`：单目标时自动花充能（无 note 自述） | `:2866 verified` / `:2868 false` | 行为矛盾（非自述） |
| 08120 | `08120.js:12-13,29`：费用来源用 beforePlayCost 减费近似 | `:2937 verified` / `:2939 false` | 矛盾 |
| 08124 | `08124.js:12,28`：同上 | `:3025 verified` / `:3027 false` | 矛盾 |
| 08130 | `08130.js:13-15,21`：伤害侧治愈用 discardSelf 近似 | `:3172 verified` / `:3174 false` | 矛盾 |
| 08133 | `08133.js:12,19`：行动锁作用域近似 | `:3216 verified` / `:3218 false` | 矛盾 |

（账本行号均指 `audit/eote-player-acceptance.json`；entry 行号均指 `src/cards/entries/<code>.js`。）

### 4.5 结论

- 形式层面：115/115 verified、simplified 0、noSimplified true，**计算上确实如此**（因为 flag 全 false）。
- 实质层面：**10/10 抽样与“无简化”矛盾**（9 条条目明确自述 approximation，1 条行为上近似但未自述）；55/115 条目有 approximation 注释。
- 因此 `noSimplified` 不能作为“没有简化”的证据；它只证明“没有条目设置 `simplified:true` 这个 flag”。最终报告若引用 115 verified/noSimplified 作为质量结论，会被源码自述直接反驳。
- 同类问题还有 queue：`audit/eote-player-queue.json:252-257,260-265,277-282,285-290,313-318` 把 5 个原语请求标 `done`，但 08081/08086/08091/08097/08107 的条目仍是旧近似或缺失。

---

## 5. 指定测试运行

命令：

```powershell
cd G:\boardgame-hall-ai\games\arkhamhorror
node --experimental-test-isolation=none --test tests/eote-player-m2-3.test.mjs tests/eote-player-m2-4.test.mjs
```

结果：**63 tests / 63 pass / 0 fail / 0 cancelled / 0 skipped**，约 7.3s。与审计员 notes 的 28+35 一致。

但必须说明：**测试绿不等于真实窗口正确**。08102、08105、08107 的测试都是 `fire()` 直接执行描述子（`m2-3.test.mjs:64-75`），绕开 `descriptorUsable`/criteria；08105/08107 还伪造了 `state.skillTest.actionKind`（`:311,423`）。08113/08120 等测试标题本身就把近似写进去了（如 `08113` 的 “轮末资源<10 时流放自身”、`08120` 的 “近似支付减费”），所以测试通过恰恰证明的是“近似行为被实现”，而非“印刷文本等价”。

---

## 6. 整体可信度

### 6.1 玩家卡 B findings

- **高置信**：5 组 high 的 9 条 high 全部确认；未发现应驳回项。
- **需修正的证据细节**：
  1. 08102 “asset 只有 {id,code,exhausted}” → 实际还有 identity 字段 + enteredRound；应改为“无 traits/location”；
  2. 08130/08131 的 discardSelf 证据行 `ability-exec.js:178-189` 错位 → 应改为 `ability-rules.js:139-143` + `assets.js:340-341`；
  3. 08105/08107 “engine 从不设置 actionKind” → 应限定“EotE 正常 fight/investigate 路径不写 `state.skillTest.actionKind`；`testInitiated.context.actionKind` 是可用读点”；
  4. 08083 high 严重度可降为 medium；
  5. 08084/08085 参考实现行号漂移（26→25、34→22）。
- **可复现性缺口**：`games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/player-b/_probe.mjs` / `_probe2.mjs` **不包含** 08102/08105/08107 的任何探针，尽管 findings/notes 对这三张卡都写了“real-path probe”。另外两处输出与 notes 不一致：
  - `_probe2.mjs` P5（08083）实际输出 `damage=1, horror=1`，不是 notes 的 `horror 1→0`（它自动选了调查员选项，没测盟友分支）；
  - `_probe.mjs` P2（08088）实际输出 uses `0→0→0`，不是 notes 的 `0→2→2`（它没有选择反应）；`_probe2.mjs` P7 选择反应后才是 `2→2`。
  - 本复核用自己的 `_probe-verify.mjs` 显式选对选项复现了这些结论；结论仍成立，但审计交付物的 probe 输出不可直接引用。

### 6.2 两份账本

- 全卡账本：**scenario-ledger 类不可信**（0/129 可追溯；110 条任何测试都不提）；`everyBehaviorCardHasEvidence` 是假绿。
- 玩家账本：**`verified` 只等于“有标题匹配测试”**；`noSimplified` 只等于“没有 flag”，与 55/115 的自述 approximation 矛盾。
- 结论：两份账本都不能作为“行为等价/无简化”的依据；只能作为“文件存在 + 至少有一条测试提及”的索引。

---

## 7. 必须进最终报告的 Top 3

1. **P8 全卡账本的 129 条 scenario-ledger 是系统性错配，110 条无任何测试提及。**
   - `tools/audit-eote-scenarios.mjs:88-90` 对每个 encounter group 返回全部 264 张战役卡 → 8 章 `cardCodes` 集合相同（各 264 unique codes）；
   - `tools/audit-eote-all-cards.mjs:258-261` last-wins → 全部落到最后一章 `theHeartOfMadnessPart2`；
   - `tests/eote-scenario-theHeartOfMadnessPart2.test.mjs` 不含 129 个卡号中的任何一个；
   - `audit-eote-all-cards.mjs:429,470` 的门禁只查非空 evidence，导致 `withoutEvidence:0` 假绿；
   - 修生成器 + 重签账本 + 96 条 verified 降级。

2. **115 玩家卡的 `noSimplified` 是空门禁，55/115 条目自述 approximation。**
   - `tools/audit-eote-player.mjs:71-73,91` 只看 `entry.simplified` flag，不看 `note`；
   - 11 条正式 `note:'approximation'`，0 条设 `simplified:true`；
   - 10 抽样 9 条明确矛盾 + 08117 行为矛盾；
   - 5 个 queue `done` 原语未接线（08081/08086/08091/08097/08107）。

3. **玩家卡 B 的 9 条 high 是真的，修复清单明确；但需修正 3 处证据/口径。**
   - 一行级接线：08081 `flags.composureDamage`、08086 `addAttackDamageBonus`、08091 `setSigilToken+replaceRevealedToken`、08097 `lookAtLocation`、08107 `onTestSuccess`、08130/08131 `flags.threatDamageSink`；
   - 真实路径 bug：08102 criteria 字段、08105/08107 actionKind 读点、08083 `healAsset` spec；
   - 修正 08102/08130/08131 证据行，补真实窗口测试（不要再用 `fire()` 直执行描述子 + 伪造 skillTest）。

---

## 8. 限制

- 未重审 403 张卡的语义，只核对证据可追溯性；未重跑全量测试，只跑指定的两份。
- 探针使用合成控制条目（`probe-free-1` / `probe-leave-1`）强制窗口保持打开，不修改仓库、不影响游戏；这些不是游戏内容。
- `08575b/08579b` 的 b 面覆盖只到“a 面有测试”，未证明 b 面行为，故标“疑似”。
- 129 条 scenario-ledger 的“任何测试都没有”按精确 code token 检查；“行为名相同但无 code”的测试不计入。

## 9. 复现产物

- `games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/verify/_ledger-recompute.mjs` / `_ledger-recompute.json` / `_recompute-run.txt`
- `games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/verify/_probe-verify.mjs` / `_probe-verify.txt`
- `games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/verify/_approx-count.mjs` / `_line-lookup.mjs`
- `games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/verify/_auditor-probe1-output.txt` / `_auditor-probe2-output.txt`（审计员交付 probe 的实际输出）
- `games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/verify/player-b-verify.json`（结构化版本）
