# 05238《聚合幻灭》（unionAndDisillusion）· P8 实现规格

> 规则事实源：`参考资源/.../Scenario/Scenarios/TheCircleUndone/UnionAndDisillusion.hs`、
> `.../Location/CardDefs|Cards/TheCircleUndone/UnionAndDisillusion*.hs`、`{Act,Agenda,Enemy,Treachery,Story}/.../UnionAndDisillusion/`。
> 文案：`frontend/.../zh/theCircleUndone/scenarios/unionAndDisillusion.json`。印刷数值/文本只经 `card-data.js` 读 `ALL_CARDS`。

## 1. 参考实现怎么跑

### 1.1 序章选择（PreScenarioSetup）
调查员二选一，写记录：**支持秘社** `theInvestigatorsSidedWithTheLodge` / **支持女巫集会** `theInvestigatorsSidedWithTheCoven`。若支持女巫集会且 `erynnJoinedTheInvestigators` 追加一段 intro。

### 1.2 setup
1. 收齐：UAD + InexorableFate + RealmOfDeath + SpectralPredators + AncientEvils + ChillingCold；把 AnettesCoven / SilverTwilightLodge / TheWatcher 三个组**整组放在一边**。
2. 放在一边：灵怪陷阱 05257、看守人的注视 05272、AnetteMason / JosefMeiger（不在本包，gap）。检查「失踪人口」记录：每位未划掉的角色把剧情支援（05258–05261）+ 命运剧情卡（05262–05265，置于冒险参考牌底）放一边/牌底。
3. 放米斯卡塔尼克河（起点）与危险河岸；洗 6 张未访之岛（05251–05256），随机 2 张入场，其余 4 张放在一边。
4. 幽灵看守人 05086 放在一边（场外）。若支持女巫集会：危险河岸 + 2 张未访之岛的火盆已点燃（每处放 1 资源作提示）。
5. 按记录选幕 3/4 版本：v1 = 05243/05247（支持秘社）；v2 = 05244/05248（女巫集会 + 欺骗秘社 + 受感召入核心圈）；v3 = 05245/05248（女巫集会 + 至少 2 项：欺骗秘社/隐瞒女巫集会/隐瞒遗留记忆）；v4 = 05246/05248（其余支持女巫集会）。其余版本移出游戏。
6. 议程 [恋人·VI 05239, 命运的十字路口 05240]；幕 [未访之岛 05241, 命数已定 05242, act3, act4]；`hereticsWereUnleashedUntoArkham` 每有 1 个在议程 1a 放 1 毁灭。

### 1.3 幕
- 1a 未访之岛（3×人数线索）：背面 = 每位调查员随机放 1 张放在一边的未访之岛到自己面前并立即移入（女巫集会则点燃火盆）；把冒险参考牌底的命运卡随机发给调查员并逐张结算。
- 2a 命数已定（2×人数线索）：调查员不能离开面前地点；背面 = 幽灵看守人生成在米斯卡塔尼克河；弃牌堆/放在一边的看守人诡计洗回遭遇牌库；地点回中央；灵怪陷阱入场（女巫集会则点燃火盆）。
- 3a 迷雾彼端 v1–v4：目标 = 场上每个未访之岛都已翻开且火盆全亮（v1）/全灭（v2–v4）；自由能力：阵法行动中花 1 线索使本次检定难度 -2。背面 = 揭示灵怪陷阱、把未访之岛上的调查员移到灵怪陷阱、按版本生成敌人并洗牌。
- 4a 咒缚仪式 05247 / 仪式遭毁 05248：目标 = 灵怪陷阱火盆亮（咒缚）/灭（遭毁）时在灵怪陷阱击败幽灵看守人；背面 → R1 / R4。

### 1.4 议程
- 1a 恋人·VI（毁灭 8）：背面 = 洗回弃牌堆；每个 `wasTakenByTheWatcher` 角色给幽灵看守人 1「被偷走的灵魂」（获得 +1 攻击，+1×人数生命，持有该提示）。
- 2a 命运的十字路口（毁灭 10）：背面 = 所有幸存调查员被击败并受 1 物理创伤 → R5。

### 1.5 混乱标记
skull -2（困难 -3；**阵法检定期间再抽 1**）；cultist -3（困难 -4；揭示时身上无伤害则受 1 伤害、无恐惧则受 1 恐惧）；tablet -3（困难 -4；失败 → 所在地点一个幽灵敌人攻击你，即便横置）；elderthing -3（困难 -4；阵法检定失败 → 结算所在地点全部闹鬼能力）。

### 1.6 结局（记录）
- noResolution → 转 R5（`theWitchesSpellWasCast`、`josefDisappearedIntoTheMist`、`hereticsWereUnleashedUntoArkham` 三项比较 → R6/R7）。
- R1：若 `theInvestigatorsWereInductedIntoTheInnerCircle && !theInvestigatorsAreDeceivingTheLodge` 可选 → R2，否则 R3。R2 写 `theTrueWorkOfTheSilverTwilightLodgeHasBegun`（秘社胜）；R3 写 `carlSanfordPossessesTheSecretsOfTheUniverse` → R8。
- R4：写 `anetteMasonIsPossessedByEvil` → R8。
- R5 → R6（写 `carlSanfordPossessesTheSecretsOfTheUniverse`）/ R7（写 `anetteMasonIsPossessedByEvil`）→ R8。
- R8：移除机关盒 05228；按 `gavriellaIsAlive / jeromeIsAlive / pennyIsAlive / valentinoIsAlive` 分别 campaignCard 加入牌组（否则写 `*IsDead`）；XP（未实现，gap）。R9：写 `theCovenOfKeziahHoldsTheWorldInItsGrasp`（女巫集会胜）；R10：写 `anetteMasonIsPossessedByEvil` → R8。

## 2. 我们的钩子怎么接（`behavior.js`）

| 参考实现 | 本仓库落点 |
| --- | --- |
| 序章二选一 | `preScenarioSetup(state, events, api)`：读记录，若都未写则 `api.choose({kind:'story'})` 写记录（测试里可注入记录） |
| setup 分支 | `setupLocations`：洗 2/6 未访之岛、`state.scenarioZones.setAside`、火盆（`state.scenarioFlags.braziers` + 放置后 `api.setLocationFlag` 由引擎钩子写）、命运卡 `state.scenarioFlags.fateCards`、`state.scenarioFlags.asideIsles` |
| 幕 3/4 版本 | `preScenarioSetup` 按记录替换 `state.acts[2] / [3]`（`ACT_VARIANTS` 常量提供四个版本） |
| 幕背面 | `actReveal` 按 `original(act)` 分派：05241/05242/05243–05246/05247/05248 |
| 幕目标 | `checkObjectives`：act3 检查所有未访之岛 `revealed` + 火盆亮/灭（逐版本）；act4 检查幽灵看守人被击败地点 = 灵怪陷阱且火盆状态；`enemyDefeated` 记录 `flags.watcherDefeatedAt` 供 act4 |
| 阵法 | `actions`/`performAction` 读 `CIRCLE_ACTIONS` 表（每地点：技能数组 2–4 个、难度、成功选项）；`api.test(seat, skills, difficulty, resolve, 0, {label:'阵法'}, { actionKind:'circle' })`，成功 → 选择点燃/熄灭火盆/不做 → `api.setLocationFlag(id,'brazier',bool)` |
| 火盆 | `api.setLocationFlag(id, 'brazier', true/false)` + `api.hasLocationFlag`；定义里所有 8 处地点声明 `brazier: true`（数据标记），放置时按阵营初始化 |
| 闹鬼 | 地点定义写 P2.1 `haunted` 闭集子句；`mossCoveredSteps`/`standingStones`/`forsakenWoods` 需要跨检定/搜索的用 `script` 子句 + `hauntedScript` 钩子；`afterTest` 的 elderthing 在阵法中失败也调 `api.haunted` |
| 命运剧情卡 | `state.scenarioFlags.fateCards = [{code, seat}]`；幕 1 背面按玩家顺序结算：`disappearedIntoTheMist && onTrail` → `api.giveAsset(seat, allyCode)` + 写 `*IsAlive`；`wasClaimedBySpecters` → 生成背面敌人（`api.spawnEngaged/spawn`，onTrail 时横置不交战）；否则只记录「没找到」（用日志表达） |
| 敌人 | `enemySpawned`（幽灵看守人「被击败不弃掉，治伤+横置」在 `enemyDefeated` 拦截）、`enemyAttackedSuccessfully`/`afterEvade`/`enemyEngaged` 实现 4 张命运敌人与幽灵乌鸦、夜鹰；`enemyStatModifier` 夜鹰 -1 四技能、幽灵乌鸦猎物 → `prey` 数据 |
| 诡计 | `resolveEncounter` 实现 05268–05272（含威胁区 05269/05270），其余回落 `encounterResolveFor` |
| 混乱标记 | `chaos.js` 的 `uadChaosToken`（skull/cultist/tablet/elderthing，含四难度）+ `afterTest` 失败效果 |
| 结局 | `resolution` 写上述记录；R8 用 `campaignCardChange`；R2/R6 记录秘社胜、R9 女巫集会胜、R4/R7/R10 写 `anetteMasonIsPossessedByEvil` |

## 3. 显式简化与 gap（同时写进 `scenarioGaps` / status.json）

1. **AnetteMason / JosefMeiger** 及 AnettesCoven 整组卡牌不在本包清单（遭遇组 `anettesCoven` 已登记，但 `AtDeathsDoorstep` 组的 05267 等不在本包）；幕 3 背面「生成安妮特/约瑟夫/女巫集会学徒」改为：v1 生成 `05267 幽灵乌鸦`（有 `theWitchesSpellWasCast` 时 2 张，否则 1 张）；v2 只移除 cultist 标记；v3/v4 生成 `05095 秘社新信徒`（v3 1–2 张）+ 若有 `josefIsAliveAndWell` 改生成 `05096 守密人` 并标记不可谈判。
2. 「看守人的攫噬」05286 不在本包（TheWatcher 组整组放在一边）：幕 2 背面只能把 `05272 看守人的注视`（本包）洗回遭遇牌库；攫噬记 gap。
3. 女巫集会「被丢掉/洗回的巫术敌人」无法实现（无 witch 敌人卡在牌堆里）；幕 3 背面洗银暮秘社组为近似（`05095/05096/05097` 已在牌堆内则洗回弃牌堆）。
4. 幽灵看守人「不能以任何方式被击败 → 治愈所有伤害横置」在 `enemyDefeated` 拦截并用 `return false` 阻止击败；「被偷走的灵魂」用 `enemy.lostSouls` 记录 + `enemyStatModifier`/`enemySpawned` 折算（引擎无 token 原语）。
5. 命运剧情卡没有「冒险参考牌底」原语：用 `state.scenarioFlags.fateCards` 纯 JSON 记录；剧情卡翻面（story→enemy 背面）用 `api.spawn` 对应敌人近似。
6. 「任务目标：所有未访之岛已翻开」需要玩家的揭示流程；引擎没有「翻开未访之岛」的通用行动，改为：调查员在未访之岛的地点行动「探索/揭示」（`performAction` 里的 `revealIsle`，每次 1 行动）或进入时自动揭示（`locationEntered`）。
7. 结局 XP 与结局 9/10（ReturnTo 专属）未实现；R4 的 ReturnTo 分支不适用（本仓库无 ReturnTo 包）。
8. 共享遭遇组（InexorableFate/RealmOfDeath/SpectralPredators/SilverTwilightLodge）逐卡行为由 W-shared 条目 + 战役 `encounter-rules.js` 负责；本章 `resolveEncounter` 只实现 UAD 5 张诡计，其余回落 `encounterResolveFor(code)`。

## 4. gaps / approximations 口径（P8 策略）

- `behavior.scenarioGaps = []`：本章没有「卡面子句完全未实现」的项。
- 属于**引擎/内容范围限制**的项目登记在 `behavior.scenarioApproximations`（不阻塞 literalCardBehavior）：
  ReturnTo 分支不适用、结局 XP（P9 统一结算）、远古恶魔/寒冷刺骨两个核组不在本战役包。
- 用战役 JSON 状态/单章逻辑承载卡面语义的项目同样在 approximations：fateCards 命运卡、
  看守人灵魂计数、火盆初始化、共享幽灵地点规则的覆盖、幕 3 背面替代生成。
