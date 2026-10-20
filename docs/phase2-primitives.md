# Phase 2 语义原语（重构路线 §6 Phase 2 的交付与证据）

> 日期：2026-02。本文是 Phase 2 的**交付说明 + 门禁证据**，不是新的规矩来源：
> 分层与硬约束见 [`../ARCHITECTURE.md`](../ARCHITECTURE.md)，阶段与判据见
> [`architecture-refactor-roadmap.md`](architecture-refactor-roadmap.md)，卡片模型见
> [`card-model.md`](card-model.md)。
>
> 阅读顺序：§1 交付清单 → §2 八项原语的读点与用法 → §3 **逃生卡对照表（门禁证据）** →
> §4 指标变化 → §5 还没做的部分。

---

## 1. 交付清单

Phase 2 的目标是"补能力、不迁卡"，八项按 §5 的优先级顺序落地：

| 编号 | 缺口 | 产物 | 读点 / 入口 | 测试 |
| --- | --- | --- | --- | --- |
| **C1** | 布尔/禁止/无视修正 | `modifiers.js` 的 `capability:*` / `ignore:*` 目标 | `capabilityBlocked()` / `ruleIgnored()` / `modifierBlocked()` | `phase2-primitives.test.mjs` C1×3 |
| **C3** | 费用表达式 | `src/engine/cost.js` | `normalizeCostValues()` / `describeCost()`；`canAffordAbility` 与 `payAbilityCost` 共用 | C3×2 |
| **C4** | 上限类型与归属 | `src/engine/limits.js`（ability.js 再导出） | `limit: { scope, owner, count }` / `describeLimit()` | C4×2 + TFA 验收 |
| **C2** | 特性/关键词/槽位授予 | `modifiers.js` 的 `add:*` 目标 | `collectGrants()` → `effectiveTraits()` / `cardKeyword()` / `commitIcons()` / `slotBonus()` | C2×2 |
| **B2** | 伤害/恐惧分配策略 | 引擎 `assignHarm` 的 strategy 参数 | `api.harm({ damage, horror, strategy })` | B2×1 |
| **B3** | 检定续延与策略 | `src/engine/test-result.js` + 引擎接线 | `performTest().summary` / `state.lastTestResult` / `ctx.result` / `api.retryTest` / `api.commitCards` | B3×2 |
| **B5** | 检索、看牌、牌序 | `src/engine/look.js` + 引擎 `lookAt()` / `searchDeck()` | `api.lookAt(...)` / `api.searchDeck(...)` | B5×2 |
| **B6** | 区域、附属、牌去向 | `src/engine/zones.js` + 引擎 `moveCardTo()` | `api.moveCard({ code 或 id, to, attachTo, beneath })` | B6×2 |

配套的薄包装（都是已有引擎入口的别名，内容层仍不直接改 `state`）：
`api.addPendingTestBonus`、`api.returnClueToLocation`、`api.placeDoomOnCard`、`api.addAssetHorror`、
`api.setAssetUses`、`api.discardTopOfDeck`、`api.tempShroudMod`、`api.moveClueToLocation`、
`api.removeThreat`、`api.drawEncounter`、`api.endTurn`、`api.cardIcons`、`api.cardTraits`、`api.describeLimit`。

事件卡还多了一条通道：`kind: 'played'` 的描述子现在**可以只带 `resolve`**（数据体表达不了时），
读点仍是 `lifecycle.playedEffect()`，引擎侧没有第二条路径。

---

## 2. 八项原语的用法

### C1 布尔/禁止/无视修正

```js
modifiers: [
  { target: 'capability:investigate' },                    // 不能调查
  { target: 'capability:play' },                            // 不能打出卡牌
  { target: 'ignore:retaliate' },                           // 你的攻击落空不触发反击
  { target: 'ignore:opportunityAttack', condition: { inPhase: 'investigation' } },
]
```

- 可声明的能力：`investigate / fight / evade / move / draw / play / triggerAbilities /
  locationAbility / commit / resign / discoverClue`；
- 可无视的规则：`retaliate / alert / hunter / opportunityAttack`；
- 每一项都有引擎侧读点（`legalMoves`、`validateMove`、结算函数三处共用同一个函数），
  声明了却没接线的 id 在注册期就会被 `normalizeModifier` 拒绝——**不提供"能写但不生效"的目标**；
- `forced` 能力不受 `capability:triggerAbilities` 影响（强制在规则上仍然结算）。

### C2 特性/关键词/槽位/图标授予

```js
modifiers: [
  { target: 'add:trait', value: 'Tome' },        // 这张卡在运行期获得特性
  { target: 'add:keyword', value: 'fast' },      // 或 noOpportunityAttack
  { target: 'add:slot', value: 'arcane' },       // 额外槽位（与 slot:arcane 同一读点）
  { target: 'add:skillIcon', value: 'combat' },  // 投入时多 1 个战斗图标
]
```

授予**只作用于声明它的那张卡**（来源 code 必须匹配），并合并进原来的读点：
`effectiveTraits()`（特性判定、附件目标、`countControlled`）、`cardKeyword()`（`fast` /
`noOpportunityAttack`）、`commitIcons()`、`slotBonus()`。

### C3 费用表达式

```js
cost: {
  resources: { per: 'clues' },                                   // 每有 1 个线索付 1 资源
  uses: { per: 'assets', filter: { usesType: 'ammo' }, max: 3 },  // 弹药支援数，最多 3
  clues: ({ inv }) => Math.min(2, inv.clues),                     // 函数逃生口
  horror: { x: true, amount: 2 },                                 // X 费读 state.abilityX
}
```

`per` 取值见 `PER_SOURCES`（`clues / resources / damage / horror / assets / investigators /
enemiesHere / usesOnSource / cardsInHand / cardsInDiscard / locationsConnected`），
`offset / min / max / filter` 可组合。三个读点共用一份求值：预览（行动文案）、校验、扣费；
求值失败（内容写错、算出 NaN）一律按"付不起"处理，不抛异常。

### C4 上限的作用域与归属

```js
limit: 'oncePerTurn'                                        // 旧写法，等价于下一行
limit: { scope: 'perTurn', owner: 'instance' }
limit: { scope: 'perAttack', owner: 'group', count: 2 }
```

- scope：`perTest / perTurn / perPhase / perRound / perGame / perCampaign /
  perWindow / perAttack / perSearch / perAction`；
- owner：`instance`（默认）/ `investigator` / `player` / `group`；
- `count` 支持 1 次以上的上限；记账仍是 `state.abilityLimits` 里的纯 JSON，读档后有效；
- 旧存档里 `{ round, phase, turn }` 形状的记录按 `used: 1` 兼容读取。

### B2 伤害/恐惧分配策略

```js
api.harm(inv.seat, { damage: 2, strategy: 'self' })         // 不询问，本人承受
api.harm(inv.seat, { horror: 1, strategy: 'assetsFirst' })  // 先给支援，溢出到本人
```

策略只决定"分给谁"；量、时机、`harmDealt` / `damageAssignedToSelf` / `horrorPlaced` 等窗口完全不变。
默认仍是 `distribute`（逐点询问）。

### B3 检定结果契约

```js
const result = api.test(inv.seat, 'willpower', 3, { resolve })  // result.summary 是标准形状
api.testResult()      // 上一次检定的标准结果（state.lastTestResult）
api.describeTest()    // 中文文案："willpower检定 5 vs 3：成功（超过 2）"
api.retryTest(inv.seat, { bonus: 2 })   // 用同一 skill/difficulty/source 重跑
api.commitCards(inv.seat, ['01025'])    // 强制投入（不询问），返回增加的点数
```

标准结果：`{ seat, skill, difficulty, baseValue, value, success, autoFail, successBy,
failedBy, drawn, cancelled, source, stage }`；`successBy` / `failedBy` 都是非负数，
窗口条件（`failedByAtMost` / `successByAtLeast`）与新读点同源。`testWouldFail` /
`wouldSucceedTest` 的 `ctx.result` 用 `pendingTestResult()`（半成品形状，`stage` 为当前阶段）。

### B5 看牌与检索

```js
api.lookAt(inv.seat, { zone: 'deck', count: 3, arrange: true, returnStrategy: 'top' })
api.lookAt(inv.seat, { zone: 'discard', count: 2, choose: 1, returnStrategy: 'bottom' })
api.searchDeck(inv.seat, { trait: 'Tome', optional: true })
```

`zone`：`deck / discard / encounterDeck / explorationDeck / investigatorDeck`（可指定 `targetSeat` 看别人牌库）；
`returnStrategy`：`shuffle / top / bottom / discard / keep`；`choose>0` 时转成"拿走 N 张进手牌"。
一切随机走 `randomValue(state)`，一切询问走 `requestChoice`，因此可重放。

### B6 区域与牌的去向

```js
api.moveCard({ code: '01088', from: 'discard', to: 'hand' })
api.moveCard({ id: asset.id, to: 'attached', attachTo: hostAsset.id })
api.moveCard({ code: '03012', to: 'beneath', beneath: planAsset.id, facedown: true })
```

`to`：`hand / deckTop / deckBottom / discard / play / threat / attached / beneath /
setAside / removedFromGame / victoryDisplay`；`from` 不写时按 手牌→牌库→弃牌堆→场上→一边 自动定位，
写 `from` 就只在那个区域找（避免"从弃牌堆拿回"先命中牌库同名卡）。场上卡离开时走 `leaveAsset`，
因此离场钩子（`leavesPlay`）与绑定效果清理仍然生效。

---

## 3. 逃生卡对照表（门禁证据）

Phase 2 门禁：**114 张逃生卡中至少 20 张能在描述子里找到等价表达**，并写出
"卡号 → 旧原语 → 新写法"的对照表。下表 21 张已**实际迁移**（不是纸面推演）：

- 每张卡的旧 `EFFECTS` 条目已删除，`engine.js` 里对应的 `if (effect.action === '…')` 分支已删除；
- 行为由 `src/cards/card-abilities.js` 的 `MIGRATED_ESCAPE_ENTRIES` 承担，全部经 `ctx.api`；
- 回归证据：`tests/phase2-primitives.test.mjs`（通道断言 + 抽样行为）、
  `tests/tfa-player-acceptance.test.mjs`、`tests/carcosa-player-acceptance.test.mjs`（原有逐卡验收全绿）。

| 卡号 | 卡名 | 旧原语 | 新写法（描述子） | 用到的原语 |
| --- | --- | --- | --- | --- |
| 03112 | 大卫·伦费尔德 | `carcosaPlayer.davidRenfield` | `modifiers: [{ skill:willpower, condition.sourceDoomAtLeast }]` + `free` 能力：`api.placeDoomOnCard` → `api.gainResources(asset.doom)` | C2 条件修正 |
| 03152 | 偷袭 | `carcosaPlayer.sneakAttack2` | `played` + `resolve`：`api.choice` 选未交战敌人 → `api.damageEnemy(2)` | — |
| 03155 | 战斗或逃跑 | `carcosaPlayer.fightOrFlight` | `played` + `fast` + `playCondition: ownTurn()` + `api.addEffect({ endOfRound })` | A1 |
| 03191 | 逻辑推理 | `carcosaPlayer.logicalReasoning` | `played` + `playCondition: investigatorClues(1)`：`api.healHorror(2)` 或 `api.removeThreat(恐怖卡)` | — |
| 03198 | 拉布兰奇夫人 | `carcosaPlayer.madameDraw/madameResource` | 两条 `free` 能力：`api.drawCards` / `api.gainResources` | — |
| 03236 | 探知术 | `carcosaPlayer.scrying3` | `free`（花 1 充能）：`api.lookAt({ arrange, returnStrategy:'top' })` + 顶牌有恐怖/预兆时 `api.horror(1)` | **B5** |
| 03239 | 应急物品(3) | `carcosaPlayer.emergencyCache3` | `played`：`api.choice` 分配 4 点 → `api.gainResources` + `api.addUses` | — |
| 03265 | 指导 | `carcosaPlayer.guidance` | `played`：`api.choice` 选同地点调查员 → `api.gainAction(1)` | — |
| 03271 | 新晋术士 | `carcosaPlayer.arcaneInitiateEntry` | `reaction`（`assetEnteredPlay`）：`api.placeDoomOnCard` 或 `api.addAssetHorror(2)`；外加 `free` 检索法术 | — |
| 04018 | 冒险家 | `tfaPlayer.adventurer` | `free`（横置 + 1 补给）：`api.choice` → `api.addUses(1)` | — |
| 04026 | 华饰头骨 | `tfaPlayer.ornateSkullCharge` | `reaction`（`defeatEnemy`, `limit:{perPhase}`）：`api.addUses(1)`；`action`：抽 1 + 1 资源 | **C4** |
| 04035 | 雅沃托 | `tfaPlayer.yaotlIcons/yaotlDiscardTop` | `free`：`api.addPendingTestBonus(弃牌堆顶图标)`；`free`（`limit:{perPhase}`）：`api.discardTopOfDeck(1)` | **C2/C4** |
| 04103 | 犯罪现场 | `tfaPlayer.crimeScene` | `played` + `noOpportunityAttack` + `playCondition: ownFirstAction()`：`api.discoverClue(有敌人 ? 2 : 1)` | — |
| 04152 | 洞悉真相 | `tfaPlayer.discernTruth` | `played` + `playCondition: investigatorClues(1)`：`api.addUses(2)` | — |
| 04154 | 一目十行 | `tfaPlayer.bookwormBoost` | `free`（花 1 线索 + 横置）：`api.returnClueToLocation(1)` + `api.addPendingTestBonus(3)` | **B3** |
| 04160 | 围困 | `tfaPlayer.cornered` | `free`（弃 1 手牌 + 横置，`limit:{perTest}`）：`api.addPendingTestBonus(2)` | **C4/B3** |
| 04204 | 华饰弓 | `tfaPlayer.reloadBow` | `action`：`api.setAssetUses(1)`（另一条攻击能力用 `effect: fight` 数据体） | — |
| 04233 | 收获日 | `tfaPlayer.payday` | `played` + `noOpportunityAttack`：`api.gainResources(已执行行动数)` + `api.endTurn()` | — |
| 04269 | 最后一击 | `tfaPlayer.lastShot` | `played` + `noOpportunityAttack`：`api.damageEnemy(1)` → 击败则 `api.drawCards(1)` → `api.endTurn()` | — |
| 04274 | 保温瓶 | `tfaPlayer.thermosDamage/thermosHorror` | 两条 `action`：创伤 ≥2 时 `api.healDamage/healHorror(2)`，否则 1 | — |
| 04306 | 观景台 | `tfaPlayer.vantagePoint` | `played` + `fast`：`api.tempShroudMod(-1)` + `api.moveClueToLocation(别处→这里, 1)` | — |

> 对照表的读法：**"新写法"一栏里的每个 `api.*` 都是窄接口**，没有任何一条需要引擎新增卡号分支；
> 21 张卡合计删掉 222 行引擎分支与 21 条 `EFFECTS` 条目，比"新增一个原语 + 一批描述子"便宜得多。

### 3.1 为什么这 21 张能迁，剩下的 93 张还不能

| 还缺什么 | 例子 | 属于 |
| --- | --- | --- |
| 需要看反应窗口的上下文细节（`_reaction` 里的临时字段） | 03304「吃枪子吧！」把额外弹药写进本次检定 | B3 后续（ctx.result 扩展） |
| 需要"牌上牌/附属堆里打出/复制别名" | 03264 原定计划、03012 彩绘世界 | B6 后续 + A3 |
| 需要战役记录 / 剧本状态 | 04308 时间借取（滴答计数）、04230 古代巨石（日志秘密数） | D4（Phase 3） |
| 需要"视为"与替换管线 | 03012、03157 | A2/A3（P2） |

这些卡继续留在逃生通道里，`audit/ability-migration.json` 的 `escapeCards` 清单就是下一批工作单。

---

## 4. 指标变化（`npm run cards:audit:write` 生成）

| 指标 | Phase 1 结束 | Phase 2 结束 | 变化 |
| --- | --- | --- | --- |
| `engine.js` 卡号字面量 | 180 | **166** | −14（删掉已迁移卡牌的引擎分支） |
| `EFFECTS` 行为条目 | 406 | **385** | −21 |
| `EFFECTS` 顶层字段 | 70 | **69** | −1 |
| 逃生卡 | 114 | **93** | −21（门禁 20 张，实际 21 张）；按原语 tfaPlayer 55→43、carcosaPlayer 53→44 |
| 描述子条目 / 能力数 | 58 / 58 | **79 / 59** | +21 |
| 通道分布 | legacy 286 / descriptor 54 / hybrid 2 / escape 114 / engine 5 | legacy 286 / descriptor **75** / hybrid 2 / escape **93** / engine 5 | |
| 时机窗口 | 51 | 51 | 本阶段没有新增窗口 |

白名单随之收缩（`--write` 会打印）：engine 码收缩 14 项、`EFFECTS` 键收缩 21 项。
**没有新增任何卡号分支或 `EFFECTS` 条目**——架构守卫的逐码比对就是证据。

回归基线（本次实测）：

| tier | 结果 | 失败构成 |
| --- | --- | --- |
| `fast` | 1990/1998 | Phase 0 记账的 4 个文件 / 8 条既有漂移（`rules-n3`×5、`campaign-http-n4`×1、`checkpoint-rewind`×1、`carcosa-implementation-gaps`×1） |
| `assets` | 119/123 | 4 条**在 `HEAD` 快照上逐条复现**：`import-cards`×2（生成物 `resourceVersion` 漂移）、`p6-content`×1（纯合法动作终局类型）、`presentation-http`×1（卡背 jpg/webp） |

> 判定方法：把 `git archive HEAD` 解出来的快照单独跑同一批用例，失败集合完全一致，
> 因此它们属于本 checkout 的既有漂移，而不是 Phase 2 引入的回归。

---

## 5. 还没做的部分（明确留白，不要误读为"已完成"）

1. **C1 的 `capability:` 还没被真实卡牌使用**：读点与测试已就位，但迁移批次里没有需要它的卡；
   第一批使用者会出现在 5c 的"不能调查/不能攻击"类卡上。
2. **C2 的 `add:keyword` 只接线了 `fast` 与 `noOpportunityAttack`**：其它关键词（`retaliate` /
   `hunter` / `alerts` 的"敌人获得关键词"）属于 D1 通道（Phase 3，敌人没有控制器）。
3. **B3 的"投入上限"只覆盖了 `commitProfile` 的既有字段**（`maxPerTest` / `noOtherCommits` 等），
   没有新增 `commitLimit` 描述子字段——真实卡牌暂时不需要。
4. **B5 的 `lookAt` 排列只支持 ≤4 张全排列**：更多张时按"放回原顺序"处理（避免组合爆炸），
   真正需要大排列的卡应在 Phase 5 换成"逐张选顶/底"的交互。
5. **B6 的 `beneath`/`attached` 依赖宿主实例 id**：按卡号批量搬牌（如"把弃牌堆所有法术洗回"）
   仍要走 `searchDeck`/`lookAt`，不在 `moveCard` 的语义里。
6. **A2 / A3 / A4 / B4 / C6 / D4 / E1 / E2** 仍是未交付项，其中 A2（替换与防止）与 A3（视为）
   是下一批难卡（03012 / 03157 / 03264）的硬前置。
7. **`test/` 里的 015xx 测试双**：`tests/phase2-primitives.test.mjs` 用 5 张未实现的升级版卡作
   "带描述子的资产"测试双（代码里已注明）。它们只存在于该用例的进程内，不影响正式内容与审计账本。
