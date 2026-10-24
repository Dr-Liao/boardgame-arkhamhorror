# atDeathsDoorstep（死亡门前 05065）· P8 章节 spec

> 参考实现（只读）：`Scenario/Scenarios/TheCircleUndone/AtDeathsDoorstep.hs`、
> `{Act,Agenda,Enemy,Location,Story}/CardDefs|Cards/TheCircleUndone/AtDeathsDoorstep*`；
> 中文正文：`frontend/src/locales/zh/theCircleUndone/scenarios/atDeathsDoorstep.json`。
> 数据来源：`content/campaigns/theCircleUndone/card-data.js`（印刷数值/卡文）+ `p8/location-map.json`（符号与连接）。

## 1. 参考实现的运行步骤

### 1.1 setup（`setupAtDeathsDoorstep`）

1. 收齐遭遇组：`AtDeathsDoorstep`、`SilverTwilightLodge`、`SpectralPredators`、`TrappedSpirits`、
   `InexorableFate`、`ChillingCold`（核心组）。**放一边**：`RealmOfDeath`、`TheWatcher`、
   Josef Meiger（05085）、7 张幽灵地点（05078–05084）。
2. 议程 `justiceXI`（05066，阀值 8）→ `overTheThreshold`（05067，阀值 11）；
   幕 `hiddenAgendas`（05068）→ `theSpectralRealm`（05069，团队 4×人数线索）→ `escapeTheCage`（05070）。
3. 放置 7 张非幽灵地点（入口大厅/维多利亚式宴会厅/纪念品陈列室/台球室/主卧/露台/办公室），
   全员从**入口大厅**开始。
4. 读剧本日志「失踪人口」（`missingPersons`）：未被划掉者对应的 4 个地点各放 6 个线索
   （入口大厅/办公室/台球室/露台）；再按 `piecesOfEvidenceWereLeftBehind` 数量从这些地点**尽量平均**移除线索。
5. 诅咒袋 13 枚（TCU 基础袋）；本章不额外加标记。

### 1.2 逐卡机制（行为文件）

| 卡 | 规则（参考实现） | 本章接法 |
| --- | --- | --- |
| 05066 议程 1 面 | 银暮秘社敌人不能受伤/被击败；强制：抽到[[怪物]]敌人时不生成、放一边、在本议程放 1 毁灭（可致推进） | `enemyDamageAllowed`/`enemyCanBeDefeated` + `spawnLocation`→非法地点 + `spawnFailed` 里改放一边并 `api.doomOn(agenda)`、达阀值 `api.advanceAgenda()` |
| 05066 背面 | 团队未持 3×人数线索则失去全部线索；否则花费 3×人数并生成 Josef 于「除入口大厅外离所有调查员最远」的地点；幕间故事 I（按地点无线索判定 4 条 trail 记录）；移除所有地点线索并推进到幕 1b | `agendaReveal`→`agendaRule.onReveal`：线索判定 + `api.choose` 选地点 + `api.spawn` + 写 4 个 trail 记录 + `api.advanceAct()` |
| 05067 议程 2 面 | 银暮秘社敌人获胜利 0 且猎手移动时视作调查员；强制（猎手移动后）：每个重整幽灵敌人对其地点每个类人敌人造成其伤害值 | `hunterMove` 重写成「调查员 + 银暮秘社敌人」目标；伤害结算放 `enemyPhaseEnd`（见 §4 简化 1） |
| 05067 背面 | 幕 2：被困幽灵国度（→R3）；幕 3：未撤退者被击败 + 1 肉体创伤 | `agendaReveal`→按 `state.actIndex` 走 `resolution`/击败+创伤 |
| 05068 幕 1 | 目标：发现尽可能多线索；不主动推进 | 无 `objective`（只由议程 1b 推进） |
| 05068 背面 | 入口大厅调查员/敌人移到维多利亚式宴会厅；7 地点替换为幽灵版本；有调查员的地点揭示；按玩家顺序生成放一边的[[怪物]]敌人；生成幽灵看守人于入口大厅；看守人组+冥界组+遭遇弃牌洗入牌库 | `actRule.onReveal`：移人/移敌 → `api.flipSpectral` ×7 → `api.reveal` → 逐人 `api.spawn` 放一边怪物 → `api.spawn('05086')` → 洗入 05087×2/05105×2/05106×2 + 弃牌堆 |
| 05069 幕 2 | 团队共付 4×人数线索推进 | `objective: { type:'clues', perInvestigator:4 }` |
| 05069 背面 | 揭示入口大厅；遭遇弃牌堆洗回牌库 | `actRule.onReveal`：`api.reveal(entryHall)` + `api.shuffleDiscard()` |
| 05070 幕 3 面 | 强制轮末：入口大厅的银暮秘社敌人逃到入口大厅底下（场外）；重整+冷漠的银暮秘社敌人向入口大厅移动一次；目标：所有未被击败调查员撤退则推进 | `roundEnded` + `checkObjectives`/`allResigned`（`api.advanceAct()`） |
| 05070 背面 | → 结局 1 | `actRule.onReveal`→`api.finish('r1')` |
| 05071 入口大厅 | [action]：撤退 | 条目 `locationRule.actions/performAction`（behavior 分派） |
| 05072 维多利亚式宴会厅 | 团队每场一次：[action] 弃遭遇牌直到弃出银暮秘社敌人，生成在该地点，然后获得 2 线索 | 条目 `locationRule`（用 `api.discardUntilEnemyTrait`/手写弃牌） |
| 05073 纪念品陈列室 | 每轮一次：[action] 获得 2 资源，或花 2 资源获得 1 线索 | 条目 `locationRule` |
| 05074 台球室 | 每轮一次：[action] 敏捷(3) 成功获得 1 线索 | 条目 `locationRule` |
| 05075 主卧 | 强制轮末（有调查员时）：最近的银暮秘社敌人放 1 毁灭 | 条目 `locationRule.onRoundEnd`（引擎直读） |
| 05076 露台 | 团队每场一次：[action] 弃 3 张智识图标手牌：谈判，获得 2 线索 | 条目 `locationRule`（谈判 actionKind 用 `api.choose` 简化，见 §4 简化 2） |
| 05077 办公室 | 办公室的银暮秘社敌人失去冷漠；强制：调查办公室揭示负面符号时，最近银暮秘社敌人 +1 毁灭 | `locationRule` 标志 + behavior `afterTest`/`enemySpawned` 同步 `enemy.aloof` |
| 05078–05084 幽灵面 | 入口大厅：不能进入；银暮秘社敌人不能生成；[action] 撤退。其余：闹鬼能力（失去行动/失去资源/弃支援/放线索/资产直接伤害/弃手牌） | `definition.locations[].back` → `flipSpectral`；`haunted` 数据声明在**幽灵面**数据（翻面后 `locationRule.onReveal` 不适用，改为 `locationFlipped` 时把 `haunted` 授予实例，见 §4 简化 3） |
| 05085 Josef Meiger | 反击；[action] 若其他银暮秘社敌人无毁灭：谈判 智识(4)：失败他攻击你；成功翻面结算 05085b | `behavior.actions/performAction`（谈判）+ `api.flipEnemy` |
| 05085b 约瑟夫的计划 | 移除他身上毁灭；本局银暮秘社敌人不能放毁灭、Josef 获冷漠；翻回敌人面并解除交战 | `api.flipEnemy` 回落 + `state.scenarioFlags.josefPlanResolved` |
| 幽灵敌人目标限制 | 非幽灵地点上的幽灵敌人不能被攻击/交战/躲避 | `canFightEnemy`/`canEvadeEnemy` 读 `api.isSpectral`（覆盖共享 `encounterRules` 同名钩子） |

### 1.3 混乱标记（05065 + zh locale tokens）

| 标记 | 简单/普通 | 困难/专家 |
| --- | --- | --- |
| skull | 地点闹鬼则 -3，否则 -1 | -4 / -2 |
| tablet | -2；失败且本次为攻击/躲避 → 结算所在地点全部闹鬼能力 | -3；本次为攻击/躲避即结算（不论成败） |
| elderthing | -2；所在地点有幽灵敌人 → 受 1 伤害 | -4；同左 + 1 恐惧 |

### 1.4 结局

| 键 | 触发 | 记录（shared.js recordTypes） |
| --- | --- | --- |
| r1 | 幕 3b（全员撤退） | `theInvestigatorsEscapedTheSpectralRealm`；幕间 II 键按「Josef 是否胜利区/入口大厅底下/银暮秘社数量」算 `interludeKey`（记入 `scenarioFlags`，P9 用） |
| r2 | 幕 1 结束时无结局 | `theInvestigatorsLearnedNothingOfTheLodgesSchemes` |
| r3 | 幕 2 结束时无结局 | `theInvestigatorsAreNeverSeenOrHeardFromAgain`；未撤退者 `campaign.investigators[].status='killed'` |
| noResolution | 引擎兜底 | 按 `actIndex` 映射到 r2/r3/r1（`storyResolutionKey` 同步映射正文） |

## 2. definition/index/layout 要点

- `scenario.locations`：7 个正常地点；`location()` + `symbol/links`（Haskell 顶部地图
  `billiardsRoom trophyRoom victorianHalls masterBedroom balcony / . . entryHall . .`），
  `back: backFace(code)` 写入幽灵面 `{ code, name }`（**不写 clues**：翻面保留线索）。
- `setAsideLocations`：无（幽灵面不是独立地点）。`setAsideAliases`：05085、05086、05087×2、
  05105×2、05106×2、7 张幽灵地点代码 05078–05084（区域账本口径），`storyAssets: storyCards(['05085b'])`。
- `encounterDeck`：6 组 `encounterCards` 去掉 05085/05086/05087/05105/05106（放一边）；
  核心组 `chillingCold` 计入。
- acts/agendas 全部 `reveal: { type:'campaignRule' }`；`startLocation: 'entryHall'`。
- manifest：`status:'development'`、`requiredPackIds:['core','tcuCampaign']`、
  `requiredMechanicIds:['tcuHaunted','tcuSpectral','tcuChaos']`、`recordReads`（missingPersons、
  piecesOfEvidenceWereLeftBehind）、`recordWrites`（4 个 trail + 3 个结局记录）。

## 3. 钩子清单（behavior.js）

`...encounterRules` + `id`，覆盖并显式回调共享实现的钩子：
`setupLocations`、`setupEnemies`（无）、`actions/performAction`（撤退、谈判、地点行动分派）、
`actReveal/agendaReveal`（条目分派）、`canFightEnemy/canEvadeEnemy`（幽灵目标限制）、
`enemyDamageAllowed/enemyCanBeDefeated`（议程 1）、`spawnLocation/spawnFailed`（怪物放一边）、
`hunterMove/enemyPhaseEnd`（议程 2）、`afterTest`（tablet）、`resolveChaosToken`（chaos.js）、
`roundEnded`（幕 3 强制 + 主卧由条目 `onRoundEnd`）、`checkObjectives/allResigned`（幕 3 目标）、
`enemyStatModifier`/`enemySpawned`（办公室冷漠同步）、`investigatorEntryError`（幽灵入口大厅封锁）、
`locationFlipped`（幽灵面 haunted 与胜利点）、`resolution`、`storyResolutionKey`、`scenarioGaps`。

## 4. 忠实近似（scenarioApproximations，不阻塞 literalCardBehavior）

> 审计口径（WORKER-BRIEF §4）：scenarioGaps = 卡面子句完全没实现（必须为空）；下面这些是
> 「用战役 JSON 状态/单章逻辑等价承载卡面语义」的忠实近似，登记在 behavior.scenarioApproximations。

1. **议程 1 的「放一边」怪物**：spawnLocation 返回非法生成点，spawnFailed 把遭遇弃牌堆里的
   该卡移到 scenarioZones.setAside 并用 pi.addDoom(1) 在议程上放毁灭（等价「该敌人不生成，
   改为放在一边，并在本密谋上放毁灭」；同一次结算内玩家不可见）。
2. **议程 2 的「视为调查员」**：重写 hunterMove，目标候选 = 存活调查员所在地点 + 场上银暮秘社
   敌人所在地点，沿连接走一步（等价「将其视为调查员决定猎手移动方向」）。
3. **议程 2 的「猎手移动后」时点**：引擎没有独立的「猎手移动后」钩子，幽灵→类人伤害结算放在
   enemyPhaseEnd（数值、目标、次数忠实；时点晚于敌人攻击）。
4. **露台的「弃 3 个智识图标手牌：谈判」**：通用谈判原语的实体描述子需登记在能力层；本章在
   ehavior.actions/performAction 内实现（按手牌智识图标从高到低凑够 3 点，费用与结果同卡面）。
5. **幽灵面 haunted**：lipSpectral 只替换印刷字段；locationFlipped 把幽灵面的 haunted 数组写到
   地点实例，翻回正常面时清除（与 P2.1 数据形状一致）。
6. **幽灵面胜利点**（05081/05082/05084）：翻面时补一次「无线索则进胜利区」结算（与引擎
   revealLocation 的 awardLocationVictory 同口径）。
7. **办公室冷漠同步**：事件驱动把结果同步到 enemy.aloof（生成/移动/回合开始/幕议程推进后），
   因为引擎没有关键词修正词表。
8. **Josef 谈判**：一次结算内完成 flipEnemy 到 05085b、移除毁灭、记录本局限制、翻回敌人面并解除交战
   （等价双面卡正反面的连续结算）。
9. **「留下的证据」线索移除「尽量平均」**：参考由队长逐个选择；本实现用确定性规则（每次从线索最多
   的地点移除，平手按地点 id），未揭示地点同步扣 maxClues。
10. **幕间故事 I/II**：P9 才导入整段正文；本章只写 4 条 trail 记录、scenarioFlags.interludeKey 与日志。
11. **银暮秘社「获得胜利 0」**：引擎胜利点只在进入胜利区时按 victory 统计，0 点不改变数值（等价）。

## 5. 验收证据

- 
ode tools/check-tcu-scenario.mjs atDeathsDoorstep → PASS（7 地点 / 3 幕 / 2 议程 /
  7 敌人 / 10 诡计 / 遭遇牌 25 / 放在一边 15 / 记录写 7）。
- 
ode --test tests/tcu-deaths-doorstep.test.mjs → 34/34 通过（含存档往返与确定性）。
- 
ode tools/audit-tcu-scenarios.mjs：除 sourceLocked（锁文件路径前缀不匹配，Lead 侧）与
  rowserAcceptance（真实浏览器 runner 待跑）外 10 项均为 true，scenarioGaps 为空。
## 6. 条目归属

按 	ools/encounter-entry-placement.mjs：7 张幽灵面地点（05078–05084）由序章与本章共用、 5085（Josef Meiger）由本章与《聚合幻灭》共用，条目归 src/cards/encounter-entries/theCircleUndone/_shared/at_deaths_doorstep/（由 Lead 按归属算法移动/合并）；其余 05066–05077、05085b 只服务本章，留在章节目录。

## 7. 架构守卫：内容层零卡号分支

	ests/architecture-guard.test.mjs 的「内容层按卡号的规则分支只减不增」基线为 **0**。
本章 behavior 通过数据表分派，content/** 内 code === '05xxxx' / originalCode === '05xxxx' 共 **0 处**：

- definition.js 的 CARD_RULES：{ '05066': { advanceRule: 'justiceXI' }, … }（纯数据）；
- 单卡条目  5066–05070 的 lags.advanceRule 携带同一份键（运行时 entryFlags(code) 优先）；
- ehavior.actReveal/agendaReveal 只查 ACT_ADVANCE / AGENDA_ADVANCE 分派表（键是 rule id，不是卡号）；
- 议程身份判断走 gendaRule(state)?.advanceRule === 'justiceXI'（比较声明的 rule id，不比较卡号）。

验证：
ode --test tests/architecture-guard.test.mjs → 18/18 通过（含 branch 基线 0）；

ode --test tests/tcu-deaths-doorstep.test.mjs → 34/34；
ode tools/check-tcu-scenario.mjs atDeathsDoorstep → PASS。