# The Witching Hour（巫异时刻 · 05050）spec（P8 / M3）

> 事实源：`参考资源/.../Scenario/Scenarios/TheCircleUndone/TheWitchingHour.hs`、
> `{Act,Agenda,Enemy,Location}/CardDefs|Cards/TheCircleUndone/TheWitchingHour*`、
> `frontend/src/locales/zh/theCircleUndone/scenarios/theWitchingHour.json`、
> `content/campaigns/theCircleUndone/{card-data,shared,tcu-chaos,encounter-rules,tarot}.js`。
> 卡面数据只从 `card-data.js` 取；中文剧情文案只从 zh locale 取。

## 1. 参考实现怎么跑（Haskell → 我们的语义）

### setup（`setupTheWitchingHour`）
1. gather：TheWitchingHour、AnettesCoven、CityOfSins、Witchcraft、AncientEvils、StrikingFear、TheDevourerBelow（只取 6 张 Arkham Woods）。
2. gatherAndSetAside：AgentsOfShubNiggurath、AgentsOfAzathoth（放到场外）。
3. 从 7 张 Witch-Haunted Woods 随机取 5 张：按玩家顺序（队长先）轮流「放在自己面前」，
   直到 5 张；其余 2 张移出游戏。
4. setAside：Anette Mason + 6 张 Arkham Woods。
5. 每位调查员从自己面前的地点半随机选 1 处作为起始地点。
6. agenda deck = [Temperance XIV(8), The Night Howls(12)]；act deck = [Lost in the Woods, Witch Hauntings, Paths into Twilight, A Circle Unbroken]。
7. intro（PreScenarioSetup）：队长二选一：
   - avoidFate → 记录 `youHaveAcceptedYourFate`、加入 2×tablet、队长牌组加入 **The Tower XVI / Ace of Rods**（战役卡，不占 30 张）；Return To 可改为 8 张固定 Campaign Reading（见 §3-6）。
   - bullshit → 记录 `youHaveRejectedYourFate`、加入 2×elderthing。

### acts / agendas
| 卡 | 正面目标 | 背面 |
| --- | --- | --- |
| 05053 Lost in the Woods（act1） | 轮末团队花费 2×人数线索 | 每人随机抽 1 张 Arkham Woods 放在面前并移入（不可取消）；4 人时队长生成 Relentless Dark Young、其余人各生成 1 只 Goat Spawn（否则每人 Goat Spawn）；每人意志/敏捷(3)，成功者横置并解除交战该敌人；1 张 Daemonic Piping 洗入遭遇牌库、2 张进遭遇弃牌堆 |
| 05054 Witch Hauntings（act2） | 一位调查员在回合中花费 1×人数线索（fast） | 本场冒险余下时间可以进入其他调查员面前的地点 |
| 05055 Paths into Twilight（act3） | 团队花费 3×人数线索 | 放置 Witches' Circle（05055b）并结算其显现（生成 Anette） |
| 05056 A Circle Unbroken（act4） | Anette 被击败 **或** Witches' Circle 无线索 | 击败 Anette→结局1；打破圆环→结局2 |
| 05051 Temperance XIV（agenda1，doom 8） | — | 遭遇牌库弃到剩 5 张；游戏区域卡牌最多的调查员从遭遇弃牌堆顶抽 1 张女巫敌人 |
| 05052 The Night Howls（agenda2，doom 12） | 强制 - 轮末：圆环每有 1 个女巫敌人放 1 毁灭 | 每位存活调查员被击败（standalone 改为 1 精神创伤）；从收藏随机找基础 Omen/Curse 弱点入牌库，做不到者 1 精神创伤 |

### 地点/敌人（卡面文本在 ALL_CARDS）
- 7 张 Witch-Haunted Woods：未揭示背面只在 `location-map.json` 的 `unrevealed`（实为揭示后的副标题/符号）；
  揭示后副标题变为具体地点名。全部 `squiggle ↔ squiggle/plus`，Witches' Circle `plus ↔ squiggle`。
- Witches' Circle（05055b）：显现时把 set aside 的 Anette 生成在此；强制 - 敌军阶段开始后，
  所有处于重整且未交战的女巫敌人向圆环移动一次。
- Anette Mason（05057）：反击；强制 - 敌军阶段开始后弃遭遇牌库顶 3 张，
  把弃掉的每个女巫敌人生成在她所在地点，若没有则重整她。生命 4×人数，胜利 2。
- 05058 废弃矿山：拥有 3–10 资源时不能调查；[free] 团队每轮一次，与另一处女巫作祟之林的调查员互移最多 3 资源。
- 05059 巨石堆：任意数量线索被发现后，本地每位调查员失去等量资源。
- 05060 独木：拥有 3–5 张手牌时不能调查；[free] 每轮一次，双方互弃 1 张手牌换抽 1 张。
- 05061 孩童的树屋：本地最后一个线索被发现时，把遭遇弃牌堆顶的敌人生成在此（没有则弃遭遇牌库直到敌人）。
- 05062 被污染的井：其他女巫作祟之林↔本地点之间的技能检定可跨地点各投入 1 张牌。
- 05063 隐士之家：任意数量线索被发现后，本地每位调查员随机弃等量手牌。
- 05064 杂草丛生的谷仓：[reaction] 敌人将生成在另一处女巫作祟之林时改为生成在此，然后它攻击本地每位调查员。
- 05089 Daemonic Piping / 05088 Piper of Azathoth：由共享组条目（W-shared）实现，本章只负责把它们洗入/弃掉。
- 01179 Relentless Dark Young / 01180 Goat Spawn：NotZ `agents_of_shub` 核心卡，本章用
  `api.spawnStoryEnemy` 现场生成（印刷数值显式传入），不写进本章 enemies（避免劫持共享条目归属）。
- 05050 混乱符号：`[skull]` -1/失败每差 1 点弃遭遇牌库顶 1 张（简单普通）/ -2 且弃等于难度的张数（困难专家）；
  `[tablet]` -1/-2，失败后抽遭遇弃牌堆最底部的诡计；`[elderthing]` -3/-4，失败后选择（简单普通）/全部（困难专家）
  重整并治愈所在地上或连接地点的女巫敌人。

### 结局（`ScenarioResolution`）
- R1/R2（act4 击败 Anette / 打破圆环）：记录 `theWitchesSpellWasBroken`；Memento `mesmerizingFlute`+`ritualComponents` / `mesmerizingFlute`+`scrapOfTornShadow`；+1 奖励 XP。
- R3/R4（法术成功施放；noResolution 时 act4→R4、act1–3→R3）：记录 `theWitchesSpellWasCast`；act3 时 R3 记 Memento `mesmerizingFlute` 且 +1 奖励 XP。
- R5：法术施放 + `erynnWantsToMeet` + Memento `mesmerizingFlute`+`strangeIncantation`；+3 奖励 XP。
- 未知 key 抛错。

## 2. 我们的钩子怎么接

`content/campaigns/theCircleUndone/scenarios/theWitchingHour/`：
- `definition.js`：`location()`（7 woods + Witches' Circle + 6 Arkham Woods，`unrevealed` 用 reveal 后副标题/symbol）
  + `stages()` + `scriptCards` + `encounterDeck`（gather 组中排除 set aside 的卡）+ `resolutions`（上表键）+ `intro/setup`（zh 摘要）。
  `setAsideLocations` = 6 Arkham Woods + Witches' Circle + 7 woods 的未放置副本（用 codes 记在 behavior 的 setAside 里）。
- `behavior.js`（`...encounterRules`）：
  - `preScenarioSetup`：intro 二选一（`youHaveAcceptedYourFate/youHaveRejectedYourFate` 记录、2×tablet / 2×elderthing、
    队长战役卡 The Tower XVI/Ace of Rods）；avoidFate 后可进行 8 张 Campaign Reading（只读 `../../tarot.js`，固定表、正位）。
  - `setupLocations`：随机 5/7 woods、按玩家顺序轮流分配「面前」、其余移出游戏、
    写入 `state.scenarioZones.setAside`（Anette/05088/05089×3/01179/01180×3/6 Arkham Woods）、
    每人的起点 = 自己面前随机一处；`scenarioFlags.frontOf = { [locId]: seat }`。
  - 前进地点限制：`moveError` 在 act1–2 拒绝进入其他调查员面前的地点（act2 背面解锁）。
  - `actReveal` → 各 act 条目的 `actRule.onReveal`（05053 背面放置 Arkham Woods + 生成黑山羊 + 检定 + 洗入笛声）。
  - `agendaReveal` / `agendaForced('roundEnd')` → 05051/05052 条目规则。
  - `checkObjectives`：05054 单调查员 fast 支付推进（scriptCards.rules）、05056 双目标。
  - `cluesGained` / `cluesRemoved`：转发给当前地点条目的 `locationRule.cluesGained`（05059/05061/05063）。
  - `investigationError`：05058/05060 的资源/手牌封锁。
  - `actions`/`performAction`：当前地点条目的 `locationRule.actions`（05058/05060 的 free 能力、05064 reaction 不占行动）。
  - `canCommitCard`/`commitIconMultiplier`：05062 跨地点投入（每处 1 张）。
  - `enemyStatModifier`/`spawnLocation`/`enemySpawned`：05064 生成改道 + 攻击；Anette 的敌军阶段开始效果。
  - `enemyPhaseStart`：Anette（05057）弃 3 张遭遇；Witches' Circle（05055b）女巫敌人向圆环移动一次。
  - `enemyDefeated`：Anette 进胜利区判定；05056 目标推进。
  - `resolveEncounter`：转发给 `treacheryRuleFor(code).encounterResolve`（本章没有专属诡计，本钩子仍保留给共享条目）。
  - `resolveChaosToken`/`afterTest`：`chaos.js` 的符号表（四难度、tablet 失败后抽弃牌堆底部诡计、elderthing 重整治愈女巫）。
  - `resolution`：上表 5 个结局 + noResolution 的 act 步数分流；Memento 走 `src/campaign/mementos.js` 的 `recordMemento`。
- `chaos.js`：`witchingHourChaosToken(state, inv, token)`（纯函数，读 `tcu-chaos.js` 的 difficulty 工具）。
- `layout.js`：Haskell 顶部 ASCII 地图（5 处森林 + 圆环按列/行给坐标；Arkham Woods 不入静态棋盘，按面前放置）。
- `index.js`：`status:'development'`、`campaignId:'theCircleUndone'`、`requiredEncounterGroupIds`
  = `['theWitchingHour','anettesCoven','cityOfSins','witchcraft']`、`requiredMechanicIds:['tcuChaos','tcuTarot']`、
  `recordReads/recordWrites` 见 §3、`setAsideAliases` 与 zones 对齐。
- 单卡条目：`src/cards/encounter-entries/theCircleUndone/theWitchingHour/<code>.js`（8 地点 + 4 幕 + 2 议程 + 05057 敌人 = 15 个）。

## 3. 显式简化 / 依赖（写进 status.json 的 gaps/notes，不藏）

1. **05062 被污染的井**：引擎没有「跨地点投入」的修正目标；用 `canCommitCard` + `commitIconMultiplier`
   近似（其他森林地点的调查员对本地点检定可投入 1 张、且只算 1 个图标）。参考实现是
   `CanCommitToSkillTestPerformedByAnInvestigatorAt` 修饰符，`canCommitCard` 的调用点不带「目标地点」，属于已知近似。
2. **05058/05060 的 [free] 资源/手牌交换**：用 `api.choose` 选择对象与张数（0–3 / 0–1），团队每轮一次用
   `state.scenarioFlags` 记录；参考实现的「同一位目标可正反两向」用两段 choose 表达。
3. **Arkham Woods（01150–01155）**：6 张核心包地点没有共享单卡条目（01151 已有），本章在
   `definition.js` 用 `investigateSkill` 数据表达 01152/01153/01154，并在 behavior 里实现 01150（进入检定）/
   01155（[action] 治疗）；01151 走已有条目。若核心包负责人后续补条目，本章的近似实现应删除。
4. **Agents of ShubNiggurath（01179/01180）**：用 `api.spawnStoryEnemy` 生成（不占 `scenario.enemies`）；
   它们的卡面规则（山羊眷族被击败时同地点恐惧、黑山羊幼崽轮末治愈 2 伤）在本章 behavior 按 code 实现。
5. **塔罗占卜**：只读 import `content/campaigns/theCircleUndone/tarot.js` 的 `WITCHING_HOUR_DIVINATION`
   （固定 8 张正位，参考实现不洗牌）；结果写入 `state.scenarioFlags.campaignReading`（P9 再并入战役记录/幕间）。
   原版（非 Return To）intro 没有占卜选项，本章把它作为 avoidFate 之后的垂直切片选项保留。
6. **「面前的地点」**：引擎没有 LocationInFrontOf 概念；本章用 `scenarioFlags.frontOf` + `moveError`
   表达限制，静态连线使用印刷符号图（所有森林本就符号互连，因此 act 1–4 的「你面前的地点互相连接」自然成立）。
7. **弱点搜索（05052 背面）**：引擎没有「从收藏随机找基础弱点」接口；近似为
   `api.addBasicWeakness(seat, ['omen','curse'])`（没有对应弱点时 1 点精神创伤由脚本兜底）。
8. **独立模式**（standalone）不区分：`05052` 背面在 standalone 改为精神创伤的分支用 `state.campaign` 是否存在判断。

## 4. 验收
- `node tools/check-tcu-scenario.mjs theWitchingHour`（结构/身份/区域/条目覆盖）；
- `node --test tests/tcu-witching-hour.test.mjs`（≥20 例：setup/区域、符号、幕议程、地点行动、敌人/诡计、
  混乱四难度、结局记录、存档往返 `JSON.stringify`+`deepEqual` 与 `scenarios/theWitchingHour/` 字面路径）；
- status：`artifacts/migration/tcu/p8/chapters/theWitchingHour.status.json`。
