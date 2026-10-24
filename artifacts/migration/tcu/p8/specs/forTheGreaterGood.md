# 05197《崇高利益》（forTheGreaterGood）· P8 实现规格

> 规则事实源：`参考资源/.../Scenario/Scenarios/TheCircleUndone/ForTheGreaterGood.hs`、
> `.../Location/CardDefs|Cards/TheCircleUndone/ForTheGreaterGood*.hs`、`{Act,Agenda,Enemy,Treachery}/.../ForTheGreaterGood/`、
> `Asset/Assets/{PuzzleBox,AugustLindquist}.hs`。文案：`frontend/.../zh/theCircleUndone/scenarios/forTheGreaterGood.json`。
> 卡面印刷数值/文本一律经 `content/campaigns/theCircleUndone/card-data.js` 读取（`ALL_CARDS`）。

## 1. 参考实现怎么跑

### 1.1 setup（Haskell `setupForTheGreaterGood`）
1. 遭遇组：FGG + CityOfSins + SilverTwilightLodge + AncientEvils + DarkCult + LockedDoors。
2. 检查记录 `theInvestigatorsAreMembersOfTheLodge`：
   - 成员：场景 1 用「热烈欢迎」05200，「渗透秘社」05201 移出游戏；放「我们一直在等你」版大门/前厅/地窖，三个「秘社成员方可入内」版移出游戏；再从遭遇组移除 3×祭司（DarkCult）、1×密会巫师、2×核心圈骑士、1×牢房看门人。
   - 非成员：场景 1 用「渗透秘社」05201；放「秘社成员方可入内」版三地点；移除 3×秘社新信徒、1×守密人、2×边缘虚空骑士、1×秘社狱卒。
3. 再放置 秘社地下墓穴 05213、休息室 05210；每位调查员从秘社大门开始。
4. 放在一边（场外）：藏书室 05212、机密室 05211、圣堂内室 05216、2×圣堂门廊（05214/05215）、机关盒 05228、响应召唤的怪兽 05220、奥古斯特·林奎斯特 05227、双面南森·威克（成员=引导 05217，非成员=教化 05217b）。
5. 4 把钥匙 = 从收藏拿取的 skull/cultist/tablet/elderThing 标记，放在一边，**不进混乱袋、不进遭遇牌库**。
6. 议程牌库 [教皇·V 05198, 目的与手段 05199]；场景牌库按 1.2。

### 1.2 幕
- 1a 热烈欢迎 05200（成员）：目标组队支付 3×人数线索；背面：藏书室入场 → 生成南森·威克（引导面）→ 机关盒附属给他。
- 1a 渗透秘社 05201（非成员）：目标 2×人数线索；获得反应「躲避敌人后移除其所有毁灭」；背面：圣堂内室入场 → 生成南森·威克（教化面）→ 机关盒附属。
- 2a 取得仪器 05202：目标：南森·威克以任何方式进入胜利区 → 选一位调查员控制附属机关盒 → 推进。
- 3a 四把钥匙 05203：目标：同地点调查员同时控制机关盒 + 4 把钥匙 → 推进；背面：若成员 → R1，否则 R2。

### 1.3 议程
- 1a 教皇·V 05198（毁灭 8）：强制：击败银暮秘社敌人时，把该地点每个敌人各 1 毁灭移到当前议程；背面：弃遭遇牌库顶 5 张，按玩家顺序每人选 1 张被弃的异教徒敌人抽取。
- 2a 目的与手段 05199（毁灭 10）：圣堂地点的银暮秘社敌人失去冷漠；同样的击败强制；背面：弃掉全部幕牌 → 生成响应召唤的怪兽（在机关盒地点，否则任意圣堂地点）→ 机关盒移出游戏。

### 1.4 混乱标记
| 标记 | 简单/普通 | 困难/专家 |
| --- | --- | --- |
| skull | -X，X=场上异教徒敌人中单卡最多毁灭 | -X，X=所有异教徒敌人毁灭总和 |
| cultist | -2，再抽 1 标记 | 同左 |
| tablet | -3；失败 → 最近的异教徒敌人 +1 毁灭 | -3；失败 → 每个异教徒敌人 +1 毁灭；场上无异教徒则再抽 1 |
| elderthing | -3；失败 → 最近的有毁灭异教徒敌人 -1 毁灭并移到议程 | -3；失败 → 毁灭最多的异教徒敌人全部毁灭移到议程；无毁灭则再抽 1 |

### 1.5 结局
`noResolution` 记录「陷阱的守卫者现身」；`r1`（成员）与 `r2` 都记录「调查员发现打开机关盒的方法」并 `api.campaignCard(05228, seat)` 加入牌组（不占 30 张，r1 进入幕间 III）；`r3` 记录「陷阱的守卫者出现并被打败」（响应召唤的怪兽被击败时触发）。额外钥匙 XP 未实现（见 gaps）。

## 2. 我们的钩子怎么接（`behavior.js`）

| 参考实现 | 本仓库落点 |
| --- | --- |
| setup 分支 / 区域 | `setupLocations` 读记录、写 `state.scenarioZones.setAside`、keys、`state.scenarioFlags`；`startLocation(state)` 返回分支起点；`modifyDeck` 从遭遇牌库移除「另一分支」的敌人各 1 张 |
| 幕 1 背面（生成南森 + 附属机关盒） | `actReveal` → `spawnNathanWick`：藏书室/圣堂内室入场、生成敌人、`state.scenarioFlags.puzzleBox = { holder: 'enemy', enemyId }` |
| 幕 2 目标 | `checkObjectives`：南森进胜利区（`victoryDisplay` / `flags.nathanDefeated`）→ `api.choose` 选调查员 → 移走剧情资产、`api.giveAsset(seat, 05228)` → `api.advanceAct()` |
| 幕 3 目标 | `checkObjectives`：同地点调查员控制机关盒 + 4 钥匙 → `api.advanceAct()`；幕 3 背面 `actReveal` → `api.finish(record ? 'r1' : 'r2')` |
| 议程背面 | `agendaReveal`：05198 弃顶 5 张 → 按玩家顺序抽异教徒敌人；05199 弃幕、生成怪兽、机关盒移出游戏 |
| 混乱标记 | `chaos.js` 的 `fggChaosToken` 返回 delta/drawAnother；`afterTest` 结算 tablet/elderthing 失败效果（读 `result.drawn`） |
| 敌人 | `enemySpawned`（狱卒/看门人放 2 毁灭+1 随机钥匙；边缘虚空骑士显现 1-2 毁灭；南森取钥匙）、`enemyDefeated`/`enemyDiscarded`（银暮秘社强制移毁灭到议程；响应召唤的怪兽 → `finish('r3')`）、`afterEvade`（教化南森躲避成功 3+ → 取钥匙+进胜利区）、`enemyAttackedSuccessfully`（引导南森谈判计数在 `performAction`）、`enemyPhaseStart`（响应召唤的怪兽击败同地点类人敌人并吸收毁灭）、`enemyStatModifier`（怪兽每 2 点场上毁灭 +1 攻/躲） |
| 地点 | 行为集中写在 `behavior.js` 的 `locationRevealed` / `actions` / `performAction`（藏书室、机密室、圣堂内室、休息室、地下墓穴、拘禁室、典礼室、前厅/地窖/大门分支）；`locationError` 用 `investigatorEntryError` 读 `flags` 挡门；大门撤退用 `actions`/`performAction` |
| 四把钥匙 | 本仓库没有 chaos-token-key 原语：用纯 JSON `state.scenarioKeys = { skull: { holder, location, enemyId }, … }` 记录（见 gaps）；与卡面相连的读点集中在 `keysOf / enemyKeys / giveKey / randomSetAsideKey` |
| 结局 | `resolution` 写 `theGuardianOfTheTrapEmerged` / `theGuardianOfTheTrapEmergedAndWasDefeated` / `theInvestigatorsDiscoveredHowToOpenThePuzzleBox`；r1/r2 用 `campaignCardChange(campaign, seat, '05228', 'add', …)` |

## 3. 显式简化与 gap（同时写进 `scenarioGaps` / status.json）

1. **钥匙原语**：参考实现用 chaos token 作为 key（`Arkham.Key`）；本仓库没有该原语，用 `state.scenarioKeys` 纯 JSON 近似；卡面「控制钥匙」的检定分支、同地点转交钥匙、被击败掉落钥匙按近似规则实现，未接入混乱袋/标记系统。
2. **AncientEvils / DarkCult / LockedDoors** 三个核组不属 TCU 21 个遭遇组，未收进牌堆（成员分支「移除 3×祭司 1×密会巫师」因此只做了「移除本包内对应卡」的等价部分：另一分支的 FGG/银暮秘社敌人各 1 张）。
3. 议程 2 背面「弃掉全部幕牌」用 `state.acts = []` 近似（引擎没有「弃幕」原语；此后无法再推进幕，只能等结局/撤退）。
4. 结局额外 XP（数字 chaos token 钥匙的 XP）未实现，`api` 没有 XP 管线；只在日志里记录。
5. 机关盒「附属到敌人」用 `state.scenarioFlags.puzzleBox` 记录，资产实例进 `state.storyAssets`（引擎无 AttachedToEnemy 的剧情资产）。
6. 响应召唤的怪兽「敌军阶段开始击败同地点类人敌人」对共享组敌人的 `defeatEnemy` 需要索引；本地直接改 `state.enemies` + 移毁灭（不触发银暮秘社强制，避免循环）。
7. 边缘虚空骑士「控制 1 毁灭并翻成线索」用「移除敌人 1 毁灭，调查员 +1 线索」近似。
8. 共享遭遇组（CityOfSins/SilverTwilightLodge）的逐卡行为由 W-shared 的条目 / 战役 `encounter-rules.js` 负责；本章 `behavior.resolveEncounter` 只实现本章 4 张诡计，其余回落 `encounterResolveFor(code)`。

## 4. gaps / approximations 口径（P8 策略）

- `behavior.scenarioGaps = []`：本章没有「卡面子句完全未实现」的项。
- 属于**引擎/内容范围限制**的项目登记在 `behavior.scenarioApproximations`（不阻塞 literalCardBehavior）：
  结局额外 XP（无 XP 管线，P9 统一结算）、三个核组（远古恶魔/黑暗异教徒/上锁的门）不在本战役包。
- 用战役 JSON 状态忠实承载卡面语义的项目同样在 approximations：scenarioKeys 四把钥匙、
  puzzleBox 归属、弃幕近似、自动反应结算、幻象毁灭翻线索、骑士猎物、南森谈判计数。
