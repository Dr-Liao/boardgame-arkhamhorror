# theWagesOfSin（恶罪报应 05161）· P8 章节 spec

> 参考实现（只读）：`Scenario/Scenarios/TheCircleUndone/TheWagesOfSin.hs`、
> `{Act,Agenda,Enemy,Story,Treachery,Location,Asset}/CardDefs|Cards/TheCircleUndone/TheWagesOfSin*`、
> `Scenarios/TheCircleUndone/TheWagesOfSin/Helpers.hs`；
> 中文正文：`frontend/src/locales/zh/theCircleUndone/scenarios/theWagesOfSin.json`。
> 数据来源：`card-data.js`（印刷数值/卡文）+ `p8/location-map.json`（11 对双面地点、符号、连接）。

## 1. 参考实现的运行步骤

### 1.1 setup（`setupTheWagesOfSin`）

1. 收齐遭遇组：`TheWagesOfSin`、`AnettesCoven`、`CityOfSins`、`InexorableFate`、`RealmOfDeath`、
   `TrappedSpirits`、`Witchcraft`；`TheWatcher` **放一边**。
2. 议程 `theHangedManXII`（05162，阀值 8）→ `deathsApproach`（05163，阀值 7）；
   幕 `inPursuitOfTheDead`（05164，团队 3×人数线索）→ `inPursuitOfTheLiving`（05165）。
3. 6 个异端者混洗后**随机 4 张放一边**，另外 2 张移出游戏；4 张幽灵迷网（05177）放一边。
4. **两个遭遇牌库**：基础牌库 = 收齐组中无[[幽灵]]特性的敌人/诡计；幽灵牌库 = 收齐组中带
   [[幽灵]]特性且不是地点的单面卡（`amongGathered (SingleSidedCard <> Spectral <> not location)`）。
5. 11 对双面地点：随机从「绞刑架 169/170」「异端者墓地 171/172」「教堂阁楼 175/176」
   「教堂地下室 173/174」各选 1，移除另一个；再加闹鬼农田、废弃教堂、绞刑者河 = **7 处**入场，
   全部用**非幽灵面**（已揭示）。全员从绞刑者河开始。

### 1.2 逐卡机制（行为文件）

| 卡 | 规则 | 本章接法 |
| --- | --- | --- |
| 05162 议程 1 背面 | 每个地点翻到幽灵面；幽灵看守人放到绞刑者河；看守人组剩余卡 + 幽灵弃牌堆洗入幽灵牌库 | `agendaRule.onReveal`：7 处 `api.flipSpectral` → `api.spawn('05086')` → `api.shuffleExtra('spectral',[05087,05087])` + 幽灵弃牌堆洗回 |
| 05163 议程 2 面 | 地点不能被翻到非幽灵面 | `locationRule`/`actions` 过滤：`agendaIndex≥1` 时翻面行动只允许 → 幽灵面（`flipSpectral` 目标面校验） |
| 05163 背面 | → 结局 2 | `agendaRule.onReveal`→`api.finish('r2')` |
| 05164 幕 1 面 | 地点不能被翻到幽灵面（勘误后文本） | `flipSpectral` 在幕 1 期间禁止翻到幽灵面 |
| 05164 背面 | 4 处指定地点各生成 1 个放一边的异端者；这些地点 +2×人数线索、其他地点 +1×人数；Memento≥3 时每人拿 1 张幽灵迷网 | `actRule.onReveal`：按地点名找入场实例 → 抽 4 个放一边异端者 → 加线索 → `mementoCount` 判定发网 |
| 05165 幕 2 面 | [fast] 翻面（团队每轮每地点限一次）；非幽灵地点不能发现线索；目标：胜利区 4 张未了之事 → 推进 | `actions`（快速翻面行动）+ `canDiscoverClues`（非幽灵地点 false）+ `checkObjectives` |
| 05165 背面 | 记录玉米皮娃娃 Memento；→ 结局 1 | `actRule.onReveal`：`recordMemento('cornHuskDoll')` + `api.finish('r1')` |
| 地点（11 对） | 正/反面各自能力（隐藏值修正、神话 -1 技能、幽灵敌人 +1 恐惧、被击败强制、[fast]/[action] 翻面等）+ 幽灵面闹鬼能力 | 条目 `locationRule`（`shroudModifier` 钩子由 behavior 分派；`onRoundEnd`/`actions` 引擎直读/分派）；`back` 数据 + `locationFlipped` 授权 haunted |
| 05177 幽灵迷网 | [action] 团队花 1–3 线索：攻击灵怪敌人，可用意志代替战斗，+X 技能值/+X 伤害 | 条目 `assetRule` + behavior `actions/performAction`（剧情资产行动） |
| 05178a–l 异端者 12 面 | 敌人面：+2×人数生命；在非幽灵地点获冷漠且不能被交战/受伤；[fast] 花 1 线索谈判看另一面；强制被击败后翻面结算另一面 | `enemySpawned` 挂 `faces`/`side`；`enemyStatModifier`/`canFightEnemy`/`enemyDamageAllowed`/`enemyCannotBeAttacked` 读所在地点；`enemyDefeated`→`api.flipEnemy(enemy, UB code)`；威胁区「未了之事」由 `roundEnded`/`encounterActions` 处理 |
| 未了之事（05178b/d/f/h 威胁区面） | 强制轮末：受 1 恐惧/1 伤害/失 2 资源/弃 2 手牌，或翻回敌人面；[action] 在对应地点（无线索）检定(4) → 驱除（进胜利区 = 放逐） | `roundEnded`（按卡号分派）+ `threatAction`/`performEncounterAction` + `api.banish` |
| 未了之事（05178j/l 立即翻回面） | 翻回敌人面、立即攻击；「不能以任何方式被击败」+ 谈判费用/地点限制；下次击败即驱除 | `enemyDefeated` 分派：j/l 面 `enemy.cannotBeDefeated`+`hereticBanishNextDefeat` 标记；再次击败走 `api.banish` |
| 05179 复仇女巫 | 生成于绞刑架或异端者墓地；警戒/猎手；被击败时对其地点每位调查员造成其伤害/恐惧（直接） | `spawnLocation` 选地点；`enemyDefeated` 结算直接伤害/恐惧 |
| 05180 恶毒邪灵 | 生成于教堂阁楼/地下室；在幽灵地点 +1 伤害/恐惧并获猎手；因非[[法术]]/[[遗物]]伤害被击败时改为治愈+横置+移到任一幽灵地点 | `spawnLocation`；`enemyStatModifier`/`enemyAttackModifier`；`enemyDefeated` 取消击败（`enemyCanBeDefeated`/脚本） |
| 05181 惩罚 | 显现入威胁区；任意地点敌人被击败后受 1 伤害；[action] 意志(3) 弃掉（同地点有横置女巫则自动成功） | 条目 `treacheryRule.threat` + `threatAction` + `enemyDefeated` 触发 |
| 05182 往昔重担 | 威胁区无未了之事→涌动；否则触发每张未了之事的强制能力（如同轮末） | `encounterResolve`（条目）+ 共享 `unfinishedBusinessForced` |
| 05183 凶兆 | 险境。二选一：抽幽灵牌库顶（获险境、不可取消）或 意志(3)；失败 2 恐惧 | 条目 `encounterResolve` + `api.drawExtra` |
| 05184 长明灯 | 从基础牌库抽出 → 洗入幽灵牌库 + 涌动；从幽灵牌库抽出 → 2 伤害 + 放回基础弃牌堆 | 条目 `encounterResolve`（读 `effect` 上下文/`deck` 标记） |
| 05185 祸害生者 | 险境。二选一：选场上未了之事翻回异端者面并放一半生命伤害；或从幽灵牌库顶弃到[[灵怪]]敌人并生成交战 | 条目 `encounterResolve` |
| 幽灵遭遇牌库路由 | 调查员位于幽灵地点时，一切遭遇牌库交互改用幽灵牌库 | **未接引擎读点**（见 §4 简化 1） |

### 1.3 混乱标记（05161 + zh locale tokens）

| 标记 | 简单/普通 | 困难/专家 |
| --- | --- | --- |
| skull | -X，X = 胜利区「未了之事」张数 + 1 | -X（= 张数），再抽 1 标记 |
| cultist | -3；本轮结束前每个异端者敌人 +1 攻击/+1 躲避 | -4；同左 |
| tablet | -3；失败时触发威胁区一张未了之事的强制能力（如同轮末） | -4；同左 |
| elderthing | -2；失败且本次为攻击/躲避 → 结算所在地点全部闹鬼能力 | -2；攻击/躲避即结算（不论成败） |

### 1.4 结局

| 键 | 触发 | 记录 |
| --- | --- | --- |
| r1 | 幕 2b | `hereticsWereUnleashedUntoArkham`（见 §4 简化 2）、`mementosDiscovered` += `wispOfSpectralMist`（X≤3 时） |
| r2 | 议程 2b | `theInvestigatorsSurvivedTheWatchersEmbrace` + 同上 heretics/memento |
| r3 | 参考实现存在（Erynn 支线：`erynnJoinedTheInvestigators` + `bloodyTreeCarvings`），本循环非 ReturnTo 不可达 | 保留键与记录分支，测试覆盖 |
| noResolution | 引擎兜底 | 有撤退者→r1，否则 r2（`storyResolutionKey` 同步映射） |

## 2. definition/index/layout 要点

- `scenario.locations`：11 对双面地点（`spectralLocation(id, frontCode, backCode)`），
  符号/连接按 `location-map.json`；`startLocation:'hangmansBrook'`；
  setup 时随机 4 对二选一（未选 4 张记入 `state.scenarioZones.removed`）。
- `setAsideAliases`：6 个异端者代码 + 05177×4 + 05086 + 05087×2；`storyAssets`：6 张未了之事
  （05178b/d/f/h/j/l）+ 05177 幽灵迷网。
- `encounterDeck`：标准牌库（非幽灵）；幽灵牌库代码由 `definition.js` 导出给 `setupLocations`
  用 `api.extraDeck('spectral', codes)` 建堆。
- `requiredEncounterGroupIds`: theWagesOfSin/anettesCoven/cityOfSins/inexorableFate/realmOfDeath/
  theWatcher/trappedSpirits/witchcraft；`requiredMechanicIds`: tcuSpectral/tcuHaunted/tcuHeretics/
  tcuWatcher/tcuChaos/tcuMemento。
- manifest：`status:'development'`、`requiredPackIds:['core','tcuCampaign']`。

## 3. 钩子清单（behavior.js）

`...encounterRules` + `id`，覆盖：`setupLocations`（地点二选一、幽灵牌库、放一边、已揭示）、
`setupEnemies`（无）、`actReveal/agendaReveal`（条目分派）、`actions/performAction`
（翻面、幽灵迷网、撤退）、`canFightEnemy/canEvadeEnemy/canDisengage`
（异端者非幽灵地点限制）、`enemyDamageAllowed`/`enemyCannotBeAttacked`（异端者非幽灵地点）、
`enemySpawned`（faces/side/生命加成/生成地点）、`enemyStatModifier`/`enemyAttackModifier`
（恶毒邪灵/闹鬼农田）、`enemyDefeated`（异端者翻面/放逐、复仇女巫、恶毒邪灵）、
`roundEnded`（未了之事强制）、`encounterActions/performEncounterAction`（未了之事 [action] 驱除）、
`canDiscoverClues`（幕 2 非幽灵地点）、`checkObjectives`（4 张未了之事）、
`locationFlipped`（幽灵面 haunted）、`locationShroudModifier`、`statModifier`（废弃教堂神话）、
`afterTest`（cultist/tablet/elderthing）、`resolveChaosToken`（chaos.js）、`spawnLocation`
（复仇女巫/恶毒邪灵生成点）、`resolution`、`storyResolutionKey`、`scenarioGaps`。

## 4. 忠实近似（scenarioApproximations，不阻塞 literalCardBehavior）

> 审计口径：scenarioGaps = 卡面子句完全没实现（必须为空）。下面这些是「用战役 JSON 状态/
> 单章逻辑等价承载卡面语义」的忠实近似，登记在 behavior.scenarioApproximations。
> 原 spec 里的两条真 gap 已由 Lead 的引擎读点解决：①幽灵牌库路由（ehavior.encounterDeckFor）；
> ②hereticsWereUnleashedUntoArkham 改为 number 记录。

1. **幽灵遭遇牌库路由**：ehavior.encounterDeckFor(state, inv) 在调查员位于幽灵地点时返回
   'spectral'，引擎 drawEncounter 据此换牌堆（含神话阶段）；显式 drawExtra 仍优先。
2. **石板标记/轮末触发未了之事强制**：ehavior.unfinishedBusinessForced 统一实现（按卡号二选一
   或翻回敌人面），「如同此时是一轮结束」与 roundEnded 共用同一函数。
3. **异端者「不能被交战」**：引擎没有 canEngage 读点，用 enemy.aloof + canFightEnemy=false
   + enemyDamageAllowed=false 承载（不能被交战体现为不能被攻击/伤害；aloof 阻止未交战攻击）。
4. **异端者 [fast] 谈判看另一面**：在 ehavior.actions 实现；B/D/F/H 只记录查看，I/K（J/L）
   按卡面 Forced 立刻翻回敌人面并攻击。
5. **J/L 翻回与立即攻击**：在一次 enemyDefeated 结算内完成（flipEnemy 往返 + api.attack），
   并写 hereticJResolved / hereticBanishNext 实例标记（纯 JSON，随存档）。
6. **05184 长明灯的抽牌来源**：引擎不传来源；由 ehavior.encounterDeckFor 在抽牌前写
   scenarioFlags.lastEncounterDeck（显式 drawExtra 的卡由章节 resolver 写同一标记），
   encounterGainsSurge 完成「洗入幽灵牌库 + 涌动 / 放回基础弃牌堆」。
   「洗入」用放到幽灵牌库顶的确定性顺序近似（encounterGainsSurge 无 api.shuffle）。
7. **05170/05170b 的隐藏值 X**：卡面扫描把 shroud 记成 -2 占位，definition 归零，
   locationShroudModifier 给出「场上灵怪敌人数量」。
8. **教堂阁楼的「放在阁楼底下」**：地点实例 eneath 数组（{code, ownerSeat}，纯 JSON）；
   cardDrawn 强制与 investigateResult 取回反应只对 175/175b 面生效。
9. **171/176 的调查加值**：eforeInvestigate 登记 wosInvestigateBonus，statModifier 在本次
   检定中加意志值 / 手牌张数（引擎 statModifier 没有 investigation 上下文）。
10. **地点常驻与幽灵面闹鬼文本**：分别由 enemyAttackModifier / statModifier /
    locationShroudModifier / hauntedScript 承载（闭集子句无法表达移动敌人、弃遭遇牌、
    生成敌人、设定基础值）。
11. **「地点不能被翻到幽灵/非幽灵面」**：引擎无 CannotBeFlipped 修正词表；ehavior.actions
    只在该幕允许的方向给出翻面行动（剧情脚本翻面不受影响）。
12. **复仇女巫 / 恶毒邪灵 / 惩罚 / 往昔重担 / 凶兆 / 长明灯 / 祸害生者**：都在章节
    enemyDefeated/enemyDamaged/esolveEncounter 中按卡号分派——参考实现即单章逻辑，
    分派读点用 original(card) 稳定键，不是引擎通用原语。
13. **异端者池的随机 4/2**：manifest.setAside 按 6 张登记（区域账本口径），运行期
    selected/removed 记在 scenarioZones.setAside / scenarioZones.removed。

## 5. 验收证据

- 
ode tools/check-tcu-scenario.mjs theWagesOfSin → PASS（11 地点 / 2 幕 / 2 议程 /
  12 敌人 / 16 诡计 / 基础遭遇牌 24 / 放在一边 13 / 剧情资产 7）。
- 
ode --test tests/tcu-wages-of-sin.test.mjs → 45/45 通过（含双牌库、异端者多面/放逐、
  未了之事、混乱标记、存档往返与确定性）。
- 
ode tools/audit-tcu-scenarios.mjs：除 sourceLocked（锁文件路径前缀不匹配，Lead 侧）与
  rowserAcceptance（真实浏览器 runner 待跑）外 10 项均为 true，scenarioGaps 为空。
## 6. 架构守卫：内容层零卡号分支

	ests/architecture-guard.test.mjs 的基线是 **0**；本章 behavior（1278 行 → 重构后更短）原有 50 处
code === '05xxxx' 分支，现已全部数据驱动，content/** 内该类分支 **0 处**：

| 原有分支 | 数据来源（条目 flags / definition 数据） |
| --- | --- |
| 幕/议程推进（05162–05165） | 条目 lags.advanceRule + definition.CARD_RULES；ACT_ADVANCE/AGENDA_ADVANCE 分派 |
| 诡计显现（05181–05185） | 条目 lags.resolveRule / lags.surgeRule；RESOLVE_RULES/SURGE_RULES 分派 |
| 敌人角色（05179/05180/异端者） | 条目 lags.enemyRole + lags.spawnRule；enemyRoleOf/SPAWN_RULES 分派 |
| 未了之事强制/立即结算（05178b/d/f/h/j/l） | definition.UNFINISHED_BUSINESS_RULES[].forced.kind / immediate.kind；FORCED_APPLY/IMMEDIATE_RESOLVE 分派 |
| 地点常驻规则（169/170/173/174/…） | 地点实例字段 shroudRule/statRule/investigateBonus/beneathRule/horrorAura/defeatRule/resignAction + HAUNTED_BY_LOCATION |
| 地点卡号 → 地点 id | definition.LOCATION_ID_BY_FRONT_CODE 纯数据表 |
| 异端者墓地 172 的击败强制 | 地点字段 defeatRule + LOCATION_DEFEAT_RULES 分派 |

读取顺序：entryFlags(code)（单卡条目）→ definition.CARD_RULES（索引未重建时的离线回退），
两者是**同一份规则键**；因此章节行为零卡号分支且单测不需要先重建 encounter-entries 索引。

验证：
ode --test tests/architecture-guard.test.mjs → 18/18 通过（含 branch 基线 0）；

ode --test tests/tcu-wages-of-sin.test.mjs → 45/45；
ode tools/check-tcu-scenario.mjs theWagesOfSin → PASS。