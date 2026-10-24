# The Secret Name（隐秘之名 · 05120）spec（P8 / M3）

> 事实源：`参考资源/.../Scenario/Scenarios/TheCircleUndone/TheSecretName.hs`、
> `{Act,Agenda,Enemy,Treachery,Location}/CardDefs|Cards/TheCircleUndone/TheSecretName*`、
> `frontend/src/locales/zh/theCircleUndone/scenarios/theSecretName.json`、
> `content/campaigns/theCircleUndone/{card-data,shared,tcu-chaos,encounter-rules,record-labels}.js`。
> 卡面数据只从 `card-data.js` 取；中文剧情只从 zh locale 取；Memento 走 `src/campaign/mementos.js`。

## 1. 参考实现怎么跑（Haskell → 我们的语义）

### setup（`setupTheSecretName`）
1. gather：TheSecretName、CityOfSins、InexorableFate、RealmOfDeath、Witchcraft、Rats。
2. 放置：Moldy Halls（起点，全部调查员）、Walter Gilman's Room、3 张 Decrepit Door（
   Landlord's Quarters / Joe Mazurewicz's Room / Frank Elwood's Room）。
3. 未知地点牌库（7 张，未揭示面朝上）：巫宅遗址 + 3 张随机 = 洗混后放牌库**底**；
   其余 3 张洗混后放牌库**顶**（只以「未知地点」面朝上，玩家无法分辨哪张是巫宅遗址）。
4. setAside：Nahab、Site of the Sacrifice、Keziah's Room、The Black Book、2×Strange Geometry、2×Ghostly Presence。
5. agenda deck = [The Hermit IX(4), The Familiar(6), The Witch Light(8), Marked for Sacrifice(8)]；
   act deck = [Investigating the Witch House(3/inv@Walter), Beyond the Witch House(5/inv@Ruins), Stopping the Ritual]。
6. intro（PreScenarioSetup）：按剧本日志分支：
   - 秘社成员 → 二选一：告诉秘社（记录 `theInvestigatorsToldTheLodgeAboutTheCoven`，混乱袋 +1 cultist）
     / 隐瞒（记录 `theInvestigatorsHidTheirKnowledgeOfTheCoven`）。
   - 秘社敌人 → intro4；没发现秘社阴谋 → intro5；音讯全无 → intro6（只放映剧情文本）。

### acts / agendas
| 卡 | 正面目标 | 背面 |
| --- | --- | --- |
| 05125 Investigating the Witch House（act1） | 所有未被击败调查员都在 Walter's Room，团队花费 3×人数线索（回合中） | 用 set aside 的 Keziah's Room **替换** Walter's Room（原地点标记/卡牌转移）；移除其他所有地点；选择一位调查员控制 set aside 的 Black Book；2 张 Strange Geometry 洗入遭遇牌库 |
| 05126 Beyond the Witch House（act2） | 只在巫宅遗址的调查员团队花费 5×人数线索 | 放置 Site of the Sacrifice；Nahab（在场/场外/不在场都可找出）放到该处：agenda4 时把 4a 上的毁灭全部移到她身上，否则放 2 毁灭；Brown Jenkin 找出并放在 Nahab 所在地点 |
| 05127 Stopping the Ritual（act3） | Nahab 上没有毁灭标记 | （→结局2）Nahab 不能离开献祭场所；强制 - Nahab 被击败时改为治愈全部伤害、解除交战、横置、本轮补给阶段不重整 |
| 05121 The Hermit IX（agenda1，doom 4） | 每个非弱点敌人 +1 生命；[reaction] 击败 Brown Jenkin/Nahab 后获得 1 线索（≥3 人改为 2） | 若 Brown Jenkin 在场：找 1 张 Swarm of Rats 生成在他所在地点；否则找出 Brown Jenkin 生成在队长地点。≥3 人时再找 1 张 Swarm of Rats 生成在任一巫宅地点 |
| 05122 The Familiar（agenda2，doom 6） | 每个非弱点敌人 +2 生命；同上反应 | 按当前幕：1→Nahab 生成在 Walter's Room；2→Keziah's Room；3→Nahab 上放 1 毁灭。2 张 Ghostly Presence 洗入遭遇牌库；找出 Brown Jenkin 放在 Nahab 所在地点 |
| 05123 The Witch Light（agenda3，doom 8） | 每个非弱点敌人 +3 生命；同上反应 | 幕 3 → Nahab 放 1 毁灭；否则把 Nahab 放回场外 set aside 区，并在密谋 4a 入场时在其上放 4 毁灭 |
| 05124 Marked for Sacrifice（agenda4，doom 8） | 每个非弱点敌人 +4 生命；同上反应 | （→结局1） |

### 敌人/诡计
- Brown Jenkin（05148）：冷漠、猎手；每个处于重整状态的生物敌人 +2 攻击；强制 - 敌军阶段结束时若重整：
  其所在地点每位调查员弃掉所有手牌再抽等量。
- Nahab（05149）：猎手、反击；密谋推进时不移除她的毁灭（引擎只清 agenda 自身 doom，天生产生）；
  攻击值 + 当前密谋编号；强制 - 敌军阶段开始后若重整：放 1 毁灭。
- Meddlesome Familiar（05143 ×3）：显现 - Brown Jenkin 不在场则找出并生成在你地点且你受 1 伤；
  否则找 1 张 Swarm of Rats 生成并交战，你受 1 伤。
- Ghostly Presence（05144 ×2）：显现 - Nahab 在场→重整、结算猎手、攻击她所在地点每位调查员，
  若她在献祭场所再放 1 毁灭；否则找出 Nahab 生成在你地点。
- Extradimensional Visions（05145 ×2）：显现 - 意志(2 + 遭遇弃牌堆每 10 张 +1)，失败弃 1 个支援。
- Pulled by the Stars（05146 ×2）：显现 - 放入威胁区；强制 - 回合结束且本回合未移动→2 恐惧；
  [action] 意志(3) 弃掉；所在地点有横置的女巫敌人→自动成功。
- Disquieting Dreams（05147 ×2）：显现 - 意志(5)，失败放入威胁区；强制 - 回合结束弃遭遇牌库顶 1 张；
  强制 - 遭遇牌库耗尽时弃掉它并揭示牌库顶 10 张，抽其中的弱点。
- Black Book（05150 剧情资产）：+1 意志/+1 智识；[reaction] 打牌时横置并受 X 恐惧，费用 -X。

### 地点（15 张，全部带 `unrevealed` 未揭示面数据）
- 巫宅：Moldy Halls（05128，闹鬼）；3 张 Decrepit Door（加号符号，未揭示时同名）分别在揭示后变成
  Landlord's Quarters（找 Swarm of Rats 生成在 Moldy Halls；闹鬼同效果）/ Joe's Room（[action] 每场一次
  检索祝福/道具支援；闹鬼 1 恐惧或弃支援）/ Frank's Room（闹鬼：放 1 线索在此或 agenda 放 1 毁灭）；
  Walter's Room（05132，进入额外费用：Moldy Halls 的调查员团队花费 1×人数线索；[action] 抽 3 受 1 恐惧；
  闹鬼弃遭遇牌库顶 2 张）；Keziah's Room（05133，幽灵地点：成功调查后改为把未知地点牌库顶放置入场，
  然后可移入；闹鬼弃到巫术卡并抽取）。
- 未知地点（7）：巫宅遗址（05137，[action] 每场一次 调查→治愈 2 恐惧；闹鬼失去 1 行动）、暮光深渊（05135，
  进入 combat/敏捷(3) 失败每差 1 点 1 伤）、古老者之城（05136，揭示后受 2 恐惧可选：放置未知地点并连接）、
  1692 塞勒姆监狱（05138，[action] 智识(3) 移动到任意已揭示地点；闹鬼移动到 Keziah's Room）、
  物理教室（05139，成功调查超难度 ≥2 时发现另一地点 1 线索）、旧日支配者皇廷（05140，进入意志(3) 失败每差
  1 点 1 恐惧；闹鬼下一行动必须调查）、发霉的走道「今晚早些时候」（05134，[action] 每场一次 弃牌堆回手并记
  「沉湎过去」）。
- 献祭场所（05141）：[action] 团队 1×人数线索移除 Nahab 1 毁灭（不引发趁乱攻击）；强制轮末补线索到 3×人数；
  闹鬼：Nahab 放 1 毁灭或她攻击你。
- 古怪图形（05142 ×2）：显现放场并移入；强制调查阶段结束弃掉并把调查员/敌人移到线索最多地点、各受 1 伤 1 恐惧；
  [free] 无线索时移到任意已揭示地点。

### 结局（`ScenarioResolution`）
- noResolution → R1。
- R1：XP = 胜利区；act2 起记 Memento `gilmensJournal`，act3 再记 `keziahsFormulae`；≥act2 时可选把 Black Book
  加入某位调查员战役牌组并 +1 skull。击败过 Brown Jenkin/Nahab 各 +1 奖励 XP。
- R2：XP = 胜利区；记 Memento `gilmensJournal`+`keziahsFormulae`+`wornCrucifix`；+2 奖励 XP；Black Book 选择同上。
- 未知 key 抛错。

## 2. 我们的钩子怎么接

`content/campaigns/theCircleUndone/scenarios/theSecretName/`：
- `definition.js`：15 地点（`unrevealed` 数据 + `haunted` 闭集子句 + 幽灵点 `spectral`）、3 幕、4 议程
  （`forced.roundEnd` 等）、2 敌人 + 5 诡计 + 1 剧情资产、`scriptCards`、`resolutions`、`intro/setup`。
  encounterDeck = 本章诡计 + shared 组（排除 set aside 的 2 张 Ghostly Presence）+ Rats；01159 进 definitions。
- `behavior.js`（`...encounterRules`）：
  - `preScenarioSetup`：intro 日志分支 + 告诉/隐瞒记录 + 1 cultist 混乱标记。
  - `setupLocations`：放置 6 处巫宅地点（未知地点牌库 7 张按 setup 分层入 `state.extraLocationDecks.unknownPlaces`，
    用 `api.cosmos`/`buildScenarioLocationDeck` 的纯函数语义；不放置未知地点）；返回初始地点 id 列表。
  - `locationRevealed`：对带 `unrevealed` 的地点在揭示时应用真实名称/副标题/traits/符号并重算符号连线。
  - `actReveal` → act 条目 `actRule.onReveal`（05125 换地点/黑书/洗古怪图形；05126 献祭场所+Nahab+Brown Jenkin；05127→finish）。
  - `agendaReveal` → agenda 条目（弱点/敌人生成、Nahab 毁灭、4a 的 4 毁灭）。
  - `checkObjectives`：act1/act2 的团队线索目标、act3「Nahab 无毁灭」。
  - `phaseBegan('mythos')`：古怪图形（05142）调查阶段结束的强制。
  - `enemyPhaseStart`/`enemyPhaseEnd`：Nahab/Brown Jenkin 强制。
  - `enemyDefeated`：Nahab 在 act3 的「不弃掉改为治愈/横置」；四张议程的「击败奖励线索」反应。
  - `enemyStatModifier`：agenda 的 +N 生命；Nahab 攻击 + 密谋编号；Brown Jenkin 生物敌人 +2 攻击。
  - `beforeMove`/`entryError`：Walter's Room 的锁定入场费用（团队 1×人数线索）。
  - `actions`/`performAction`：当前地点条目的 `locationRule.actions`（05129/05130/05132/05134/05137/05138/05141/05142）。
  - `cluesGained`/`investigateResult`：Keziah's Room 的「改成放置未知地点」、物理教室的额外线索。
  - `drawLocation`：把 05142 古怪图形以遭遇牌库地点形式放置（`locationRule` 数据在条目里）。
  - `hauntedScript`：05129（找 Swarm of Rats 生成 Moldy Halls）与 05133（弃到巫术卡并抽取）两个 `script` 子句。
  - `resolveChaosToken`/`afterTest`：`chaos.js` 的符号表（skull 异次元、cultist 再抽 + 失败弃 3/5、tablet Nahab 攻击、
    elderthing 猎手移动）。
  - `resolution`：R1/R2（Memento/黑书/skull/+XP）与 noResolution→R1。
- `chaos.js`：`secretNameChaosToken(state, inv, token)` + 失败后的 `secretNameChaosAfterTest`。
- `layout.js`：Haskell 顶部 5×8 ASCII 地图（未知地点按符号列位给出坐标）。
- `index.js`：`status:'development'`、`requiredEncounterGroupIds`
  = `['theSecretName','cityOfSins','inexorableFate','realmOfDeath','witchcraft']`、
  `requiredMechanicIds:['tcuChaos','tcuHaunted','tcuSpectral','tcuMemento','tcuCampaignAssets','tcuCosmos']`、
  `recordReads/recordWrites` 见 §3、`setAsideAliases` 与 zones 对齐。
- 单卡条目：`src/cards/encounter-entries/theCircleUndone/theSecretName/<code>.js`
  （15 地点 + 3 幕 + 4 议程 + 2 敌人 + 5 诡计 + 05150 剧情资产 = 30 个）。

## 3. 显式简化 / 依赖（写进 status.json 的 gaps/notes，不藏）

1. **未知地点牌库的「未揭示面」**：引擎只认识 `unrevealedActualName`/`hiddenIdentity`；本章在
   `locationRevealed` 里应用 `unrevealed` 数据（名称/副标题/traits/符号）并重算符号连线，等价于翻面。
2. **未知地点「放在牌库底/顶」**：`buildScenarioLocationDeck` 只做洗牌；本章按参考实现的 splitAt 3
   自行拼 `state.extraLocationDecks.unknownPlaces.deck`（仍走原语的堆结构，存/读档纯 JSON）。
3. **黑书入牌组**：用 `api.campaignCard('05150', seat, '隐秘之名结局')`（P2.10 原语）加入战役牌组，
   同时 `ui` 侧记录 `state.scenarioFlags.blackBookSeat`；「+1 skull」按参考实现只在选择加入时永久加袋
   （用 `tcu-chaos.addChaosToken(..., {permanent:true})`，P8 只在本局袋上验证，P9 再接战役袋持久化）。
4. **05123 的「密谋 4a 入场时放 4 毁灭」**：在 05123 背面把 4 毁灭直接放到下一张 agenda（05124）实例上
   （引擎的 agenda 揭示只触发一次背面，没有「4a 入场」窗口）；数字与参考实现一致。
5. **弱点/额外敌人搜索**（05121/05122 背面）：引擎没有「从遭遇牌库/弃牌堆查找指定敌人」的统一原语，
   本章用 `state.encounterDiscard`/`state.encounterDeck` 直接查找（纯数组操作），找到后 `api.spawn` /
   `api.spawnStoryEnemy`；找不到时按卡面「找出」= 从 set aside/off-game 生成（Brown Jenkin/Nahab 本来就在
   set aside）。
6. **Rats（01159）**：核心包 `rats` 组没有共享单卡条目；本章把 01159 写进 `scenario.enemies`（猎手关键词
   由 definition 从卡面解析），规则仅关键词、无额外条目逻辑。若共享条目负责人补 `shared/rats/01159.js`，
   `literalCardBehavior` 自动转绿；否则该 code 会作为 dependency 记录。
7. **Nahab「密谋推进时不移除毁灭」**：引擎推进 agenda 只清 `state.doom` 与 agenda 自身 doom，敌人上的
   毁灭本来就不清，因此无需额外数据（spec 记录为「天然满足」）。
8. **「沉湎过去」**：参考实现写 `ScenarioLog.RememberedThePast`；P8 记进
   `state.scenarioFlags.meddledWithThePast`（string[]，跨章读点属 P9）。
9. **闹鬼的未闭集子句**（05129/05133 的 script、05140 的「下一行动必须调查」）：
   - 05129/05133 由 `hauntedScript` 实现；
   - 05140 的「下一行动必须调查」引擎没有行动限制读点，近似为设置 `state.scenarioFlags.mustInvestigateSeat`
     并在 `actions()` 里只显示调查行动（描述层提示），实际强制力有 gap（记录在 scenarioGaps 的候选，见 status）。

## 4. 验收
- `node tools/check-tcu-scenario.mjs theSecretName`；
- `node --test tests/tcu-secret-name.test.mjs`（≥20 例：setup/未知地点牌库、幕议程、地点/行动/幽灵点、
  敌人/诡计、混乱四难度、结局 Memento/黑书记录、存档往返 `JSON.stringify`+`deepEqual` 与
  `scenarios/theSecretName/` 字面路径）；
- status：`artifacts/migration/tcu/p8/chapters/theSecretName.status.json`。
