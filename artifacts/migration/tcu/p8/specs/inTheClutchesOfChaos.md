# 混沌魔掌（inTheClutchesOfChaos, 05284）· P8 章节 spec

> 事实源：`参考资源/.../Scenario/Scenarios/TheCircleUndone/InTheClutchesOfChaos.hs`、
> `Location/CardDefs/.../InTheClutchesOfChaos.hs`、`Scenarios/.../InTheClutchesOfChaos/Helpers.hs`、
> `{Act,Agenda,Enemy,Treachery}/Cards/TheCircleUndone/{InTheClutchesOfChaos,AgentsOfAzathoth}/`、
> `frontend/src/locales/zh/theCircleUndone/scenarios/inTheClutchesOfChaos.json`、
> `artifacts/migration/tcu/p8/{scenario-inventory,location-map}.json`。卡面中文以 `src/cards/cards-data.js` 为准。

## 1. 参考实现怎么跑

### 1.1 开局（`setupInTheClutchesOfChaos`）

1. 收齐遭遇组：`InTheClutchesOfChaos`、`AgentsOfAzathoth`、`Nightgaunts`；
   若剧本日志有 `AnetteMasonIsPossessedByEvil`，追加 `MusicOfTheDamned`、`AnettesCoven`、`CityOfSins`、`Witchcraft`；
   若日志有 `CarlSanfordPossessesTheSecretsOfTheUniverse`，追加 `SecretsOfTheUniverse`、`SilverTwilightLodge`、`StrikingFear`
   以及 `TheMidnightMasks` 的 `huntingShadow`/`falseLead`。
2. 六对这种地点各随机放一个版本入场、另一个移出游戏：French Hill 05290/05291、Rivertown 05292/05293、
   Southside 05294/05295、Uptown 05296/05297、South Church 05298/05299、Merchant District 05300/05301。
   每位调查员从 Southside 开始。
3. 变体地点：`anetteMasonIsPossessedByEvil` 时放 05302 绞刑者山丘(终焉之地)+05303 银暮秘社(神秘笼罩)，
   移出 05304/05305；否则放 05304/05305、移出 05302/05303。
4. 幕牌库：Anette 变体 `[05286a 黑暗知识(一), 05287 坟墓彼端]`，否则 `[05288a 黑暗知识(二), 05289 世界新秩序]`。
5. 议程：05285 战车·VII（毁灭 7）。阿撒托斯的吹笛手 05088 放在一边。
6. SetupStep 1：4 人局随机 3 个不同地点各 1 裂口（重复 3 次）；否则随机 2 个不同地点各 1 裂口（重复人数次）。

### 1.2 裂口与入侵（卡面规则，中文见 `breachesAndIncursions`）

- 裂口是地点上的资源标记，上限 3。骷髅值 = 该地点裂口 + 该地点毁灭（困难 +1）。
- 议程 05285 强制①：**毁灭将要放到本密谋时**，改为在「调查员人数 + 1」个随机不同地点上各放 1 裂口。
- 议程 05285 强制②：**裂口将要放到已有 3 个裂口的地点时**，改为结算该地点的**入侵**：
  1) 移除该地点全部裂口；2) 在其上放 1 点毁灭；3) 在它的每个连接地点各放 1 裂口（可连锁）；4) 本阶段内已结算过入侵的地点不再被其他入侵的裂口覆盖。
- 「随机地点」= 开局被移出游戏的那 6 个地点版本 + 未使用的两个变体地点（共 8 张），混洗后抽取；
  选完仍放回池中（可重复），并优先排除正在结算的地点的同名版本。
- 幕上的裂口：幕卡本身也能承载裂口（05286a/05287/05288a/05289 的 `[fast] 移除本场景 3 个裂口`），
  楼层能力把地点裂口「移到当前场景」；幕推进时裂口随之移到下一张幕。

### 1.3 幕/议程行为

| 卡 | 行为 |
|---|---|
| 05286a/05288a 黑暗知识（一/二） | 目标：全队收集 3×人数线索并立即花费推进。背面：把对应首领（05286b 安妮特 / 05288b 卡尔）生成到其卡面指定地点，把幕上全部裂口移到下一张幕。`[fast]`：移除本幕 3 裂口 → 随机地点放 1 线索。 |
| 05287 坟墓彼端 | 目标：安妮特被击败→推进，背面→结局 1。`[fast]` 同上。 |
| 05289 世界新秩序 | 目标：卡尔被击败→推进，背面→结局 2。`[fast]` 同上。 |
| 05285 战车·VII | 见 1.2。背面：有 Anette 记录→结局 3，否则→结局 4。 |

### 1.4 首领与敌人

- 05286b 安妮特·梅森（重生的邪恶）：警戒/猎手，生命 6×人数，生命 -2×调查员控制线索总数；胜利 2；
  她所在地点被放裂口后：每位调查员受到 1 伤害或 1 恐惧。
- 05288b 卡尔·桑福德（不死的狂信徒）：猎手/反击，生命 6×人数，生命 -2×调查员控制线索总数；胜利 2；
  从当前幕移除任意数量裂口后：把其中 1 个放到卡尔所在地点。
- 05309 秘社打手（秘社组）：生成于裂口最多的地点（都无裂口则银暮秘社）；反击；其所在地点文本框视为空白。
- 05311 混沌见证者（受诅咒的歌声）：生成于裂口最少的地点；猎手；进入地点后在该地点放 1 裂口。
- 05088 阿撒托斯的吹笛手：见共享组（W-shared）；本章开局放一边。

### 1.5 诡计

- 05306 混沌幽现：意志 3；失败且低难度 X 点 → X 个不同随机地点各 1 裂口。
- 05307 元初通道：附属随机地点并把裂口补到正好 3；该地点印刷文本空白；`[action]` 智/意 4 → 弃掉。
- 05308 猛鬼出笼：所在地点无裂口先放 1；受到 X 伤害/恐惧（任意分配），X = 地点裂口+毁灭。
- 05310 异界之秘：场上毁灭最多的异教徒敌人每点毁灭 → 在其地点放 1 裂口；未放置则获得涌动。
- 05312 不惮辛劳不惮烦：险境；二选一：结算遭遇弃牌堆最顶部「力量」诡计的显现，或结算所在地点入侵。

### 1.6 结局（`ScenarioResolution`）

- 1：Anette 线；`allGainXp`；记录四选一（continuedAlone / askedForAssistance / arrestedAnette（有侦探/警察/机构）/ spellsOfOld（有秘术/密斯卡托尼克/学者））。
- 2：Carl 线；记录四选一（continuedAlone / askedSanfordForAssistance / arrestedSanford / assumedControl）。
- 3/4：记录 `doomDrawsEverCloser`。
- noResolution：有 Anette 记录→R3，否则→R4（卡尔线兜底）。

## 2. 我们的实现（钩子接法）

`content/campaigns/theCircleUndone/scenarios/inTheClutchesOfChaos/`
- `definition.js`：16 地点（12 章组 + 2 music + 2 secrets，均为印刷符号连线）；幕 = 两套变体（`VARIANT_ACTS`），
  manifest 声明 music 变体 2 幕为默认；`encounterDeck` = 基线三组 + 两变体组 + `strikingFear` + 午夜假面 01135/01136 的**并集**（见 gap 1）；
  敌人/诡计来自 `encounterDefinitions`（含 05286b/05288b 与放一边的 05088）；`resolutions` r1–r4 + noResolution。
- `layout.js`：手写阿卡姆地图坐标（符号图布局：Southside 中央，四周六区，T 型连 French Hill、星形连银暮、月牙连绞刑者山丘）。
- `behavior.js`：
  - `startLocation`/`setupLocations`：按剧本日志选变体；六对地点用 `helper.shuffle` 各取一；变体地点放置；
    `state.acts` 换成变体幕牌库；写 `scenarioZones.setAside=[05088]`；`scenarioFlags.{variant,chosenLocations,actBreaches,breachPool,incursionGuard}`；
    4 人 3×3 裂口 / 其余人数×2 裂口，走 `placeBreach`（会触发入侵）。
  - `modifyDeck`：把声明并集裁剪为所选分支的遭遇组（gap 1）。
  - `doomPlaced`：议程毁灭改为裂口（强制①，`state.doom` 回退到放置前）。
  - `actReveal`：读单卡条目的 `actRule.advance` 数据（`spawnBossFromAct` / `resolution`），不写卡号分支。
  - `phaseBegan`/`roundEnded`：入侵保护集按阶段清理 / 回合末结算。
  - `actions`/`performAction`：幕 `[fast]`（本幕 3 裂口）与 16 个地点的 `[action]/[fast]`（`LOCATION_HANDLERS` 以地点卡号作**数据键**，不含 `code === '05xxxx'` 分支）；`scriptCards.rules` 声明归属。
  - `spawnLocation`：读敌人条目的 `enemySpawnRule.location`（`mostBreaches` / `fewestBreaches`）数据分派。
  - `resolveChaosToken`：由 `chaos.js` 提供（skull/cultist/tablet/elderthing）；`afterTest` 处理石板/古神失败追加效果。
  - `resolveEncounter`：5 张诡计逐卡解析（`encounter-entries` 已实现但为可测试性在 behavior 分派）。
  - `resolution`：r1–r4/noResolution 写记录（`shared.js` 内已有键）。
  - `scenarioGaps`：本文件 §3。
- `chaos.js`：`resolveChaosToken` 表 + `afterTest` 追加效果。
- `src/cards/encounter-entries/theCircleUndone/inTheClutchesOfChaos/<code>.js`：05285、05290–05301、05306–05308，
  以及两个变体子剧本的 14 张（05286a/05286b/05287/05288a/05288b/05289/05302–05305/05309–05312）。
  说明：这 14 张原本按遭遇组放在 `_shared/{music_of_the_damned,secrets_of_the_universe}/`，因只有《混沌魔掌》
  使用，按仓库归属算法由 Lead 统一移到章节目录（内容不变；见 Lead 的「结构性归位」说明）。
  条目承载逐卡规则数据：`actRule.advance`（4 张幕）、`enemySpawnRule.location`（05309/05311）、
  以及其余文件的归属与 `implemented: true`；behavior 只读 `actRuleFor` / `enemySpawnRuleFor` 等数据读点，
  不含 `code === '05xxxx'` 分支（架构守卫 content 分支在本章为 0）。
- `tests/tcu-clutches-chaos.test.mjs`：≥20 例（manifest/身份、16 地点符号连线、变体二选一、幕牌库变体、
  裂口上限/入侵连锁/阶段保护、骷髅值、议程毁灭转裂口、首领生成与生命修正、5 张诡计、地点能力、
  四个混乱标记 × 四难度、结局记录、JSON 往返、同路线确定性、异常路径）。

## 3. 显式近似（写进 `behavior.scenarioApproximations` 与 status.json；`scenarioGaps` 为空）

> 2026-10-24 Lead 策略：`scenarioGaps` 只放「卡面子句完全没实现」；用战役/章节 JSON 状态等价承载卡面语义的
> 记为 `scenarioApproximations`（不阻塞 literalCardBehavior）。本章 16 地点 + 5 诡计 + 4 幕 + 议程 + 双变体
> 均已有对应行为，故 gaps 为空；下列近似的卡面语义都有等价实现。

1. **遭遇牌库是「两变体并集」的静态声明**：manifest `zones.encounterDeck` 含两变体组（张数合计大于单局实际），
   开局 `modifyDeck` 按剧本日志裁成单局分支。原因：manifest 是静态数据，分支来自剧本日志。
2. **随机地点的「8 张未使用版本」池**用 `scenarioFlags.breachPool` 里的未放置地点 id 近似（不建独立随机地点牌堆）；
   为选定/抽到版本与在场版本同名时排除其在场版本。
3. **幕上裂口**用 `scenarioFlags.actBreaches` 单一计数承载（P2.11 只支持地点裂口）；幕推进时随当前幕移动，逻辑等价于「裂口在幕卡上」。
4. **阿撒托斯的吹笛手**按共享组条目（W-shared）结算；本章只在开局把它放一边，没有额外生成子句。
5. **05307 元初通道的「地点文本视为空白」**只屏蔽本章 behavior 提供的地点行动（引擎没有全局文本置空原语），
   探索/调查等引擎行动不受影响。
6. **05312 不惮辛劳不惮烦**的「结算最顶部力量诡计显现」在 behavior 内重放该诡计（若是本章 5 张之一），
   共享组诡计（05107 等）交给共享 `resolveEncounter`（W-shared）。
7. **resolveChaosToken 的裂口副作用**直接写在 chaos.js（引擎 `onDraw/onFail` fx 词表没有 placeBreach）；仍走 `api.breach` 的唯一入口。
