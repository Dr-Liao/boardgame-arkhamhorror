# 黑色王座（beforeTheBlackThrone, 05325）· P8 章节 spec

> 事实源：`参考资源/.../Scenario/Scenarios/TheCircleUndone/BeforeTheBlackThrone.hs`、
> `.../BeforeTheBlackThrone/{Helpers.hs,Cosmos.hs,Cosmos/Types.hs}`、
> `Location/CardDefs/.../BeforeTheBlackThrone.hs`、`{Act,Agenda,Enemy,Treachery}/Cards/TheCircleUndone/BeforeTheBlackThrone/`、
> `frontend/src/locales/zh/theCircleUndone/scenarios/beforeTheBlackThrone.json`、
> `artifacts/migration/tcu/p8/{scenario-inventory,location-map}.json`。卡面中文以 `src/cards/cards-data.js` 为准。

## 1. 参考实现怎么跑

### 1.1 开局

1. 收齐 `BeforeTheBlackThrone`、`AgentsOfAzathoth`、`InexorableFate`、`AncientEvils`、`DarkCult`。
2. 把「憎恶宫殿 05333 / 旧日支配者皇廷 05334 / 黑色王座 05335」放一边（它们是三张宇宙地点的已揭示面）。
3. 宇宙入口 05332 入场，调查员从宇宙入口开始。
4. 剩余 12 张宇宙地点混洗成「宇宙」牌库：无尽黑暗 05338×3、宇宙门扉 05339、虚空之路 05340×2、
   舞者之雾 05336×3、飞入湮灭 05337×3（宇宙面朝上）。
5. 宇宙中心（网格 `Pos`）初始：宇宙入口 (0,0)；从宇宙顶抽 1 张与憎恶宫殿混洗后放 (2,1)/(2,-1)；
   队长牌库顶 6 张牌背面朝上作为虚空格子放在固定 6 个位置。
6. 阿撒托斯 05346 入场（在场但不位于任何地点）；阿撒托斯的吹笛手 05088 放一边；
   议程 3 张（命运之轮·X 4 毁灭、它在等待 6、最后的倒计时 8）；幕 3 张。
7. 剧本日志 `thePathWindsBeforeYou` 每有 1 次记录，在冒险参考卡上放 1 资源。

### 1.2 Cosmos / 虚空（`Cosmos.hs` + 各地点）

- Cosmos 是可向四方向扩张的网格；地点可滑动；虚空格子（玩家牌背面）占位。已被揭示的宇宙地点与其相邻地点连接。
- 每个虚空地点获得与三个已揭示面之一对应的行动：「将本地点洗入宇宙，把本地点上的每位调查员与每个敌人移动到
  宇宙入口 / 憎恶宫殿 / 旧日支配者皇廷」。
- 地点「宇宙 -」指令决定放置时的连接方向（右/上/下/任意已揭示地点任意方向），可改为付代价自选方向。
- 进入宇宙门扉：花 1 线索或受 1 恐惧；进入虚空之路：弃 1 手牌或受 1 伤害。
- 黑色王座：隐藏值 + ceil(阿撒托斯上毁灭/2)；闹鬼 - 在阿撒托斯上放 1 毁灭，或阿撒托斯攻击你。
- 三个枢纽地点回合结束强制补线索到 3 / 4 / 6。
- 若干 `[action]` 花冒险参考卡 1 资源：移动本地点一次/把调查员移到别的虚空地点（团队每轮/每场一次）。

### 1.3 幕/议程

| 卡 | 行为 |
|---|---|
| 05329 宇宙的呼唤 | `[action]` 花 X 线索：抽宇宙顶 X、选 1 按「宇宙 -」放置并移动过去，其余洗回。目标：只有憎恶宫殿的调查员可共同支付 1×人数线索推进。背面：清场并重建宇宙（放憎恶宫殿 + 皇廷 + 3 张宇宙地点 + 7 虚空格子）。 |
| 05330 阿撒托斯的领域 | 同上（目标：皇廷，2×人数）。背面：清场重建（皇廷 + 黑王座 + 4 张宇宙地点 + 8 虚空格子）。 |
| 05331 必竟之事 | 同上；目标：队长在黑色王座且该地点无线索→推进。背面：按 Memento/记录从 R2/R3/R4 中选，R4 再选 R5 或 R1。 |
| 05326 命运之轮·X | 毁灭 4。推进：弃掉所有异教徒敌人并把其毁灭移到阿撒托斯；抽取魔鬼的笛声；每人在宇宙中向左移动一次/把所在地点左移一次（吉爾曼日志可跳过）。 |
| 05327 它在等待 | 毁灭 6。推进：弃异教徒+笛声；每人意志 4 检定，失败 1 伤害 1 恐惧（有破旧十字架可跳过）。 |
| 05328 最后的倒计时 | 毁灭 8。推进：弃异教徒+笛声；有玉米壳娃娃则从阿撒托斯移除 1 毁灭；弃掉本议程（此后毁灭进阿撒托斯）。 |

### 1.4 敌人 / 诡计

- 05346 阿撒托斯：不在任何地点、免疫玩家效果与调查员行动、不能被击败；其上 ≥10 毁灭 → 结局 1。
  骷髅 = max(2, ceil(毁灭/2))（困难 = max(2, 毁灭)）。
- 05341 盲目舞者：生成于最远虚空格子；猎手；可进入虚空格子；猎手移动到虚空格子后再结算一次（每轮一次）。
- 05342 究极混沌：意志 4；失败附属到阿撒托斯；低 2 点受 1/1，低 3 点涌动；不能取消；3 张附属时弃掉并放 1 毁灭或阿撒托斯按顺序攻击每人。
- 05343 耳语契约：险境；在阿撒托斯放 1 毁灭，或阿撒托斯攻击你。
- 05344 终结将至：意志 1 + 当前议程编号；失败把异教徒敌人的毁灭移到阿撒托斯（无敌人的话放 1）。
- 05345 黑暗世界：阿撒托斯无毁灭→涌动；否则每点毁灭二选一（失 1 资源/弃 1 手牌/受 1 恐惧/受 1 伤害）。

### 1.5 结局

R1（吞食宇宙，全员死亡）/ R2（队长加入吹笛人+沉睡+每人 2 精神创伤）/ R3（沉睡+每人 2 物理创伤）/
R4（选择：R5 签名黑书，或 R1）/ R5（签名+沉睡+每人 2/2 创伤）/ R6（逆转咒语+沉睡+每人 1/1 创伤）。

## 2. 我们的实现（钩子接法）

`content/campaigns/theCircleUndone/scenarios/beforeTheBlackThrone/`
- `definition.js`：16 个地点 id（9 张卡；05336/05337/05338 各 3 份、05340 2 份 → `dancersMist1..3` 等），
  静态连接近似为「每个宇宙地点 ↔ 宇宙入口 / 憎恶宫殿 / 皇廷 / 黑色王座 四个枢纽」；`setAsideLocations` = 皇廷、黑王座；
  幕 3、议程 3；敌人（05346 阿撒托斯、05341 盲目舞者、05088 吹笛手）；4 张诡计；`resolutions` r1–r6 + noResolution。
- `layout.js`：以宇宙入口为中心的放射坐标（四枢纽 + 12 宇宙地点环绕，避免重叠）。
- `behavior.js`：
  - `setupLocations`：宇宙牌库 `api.cosmos({build:[12 ids]})`；放宇宙入口 + 憎恶宫殿（初始入场）；
    `scenarioZones.setAside=[05334,05335,05088]`；`scenarioFlags.{azathothDoom,referenceResources,pathWinds,emptySpaceCount}`。
  - `startLocation` 固定宇宙入口；地点进入效果写在单卡条目的 `locationRule.onEnter.effect`（引擎直读）：
    05339 门扉花线索/恐惧、05340 虚空之路弃牌/伤害、05336 舞者之雾反应；黑色王座闹鬼在 behavior.hauntedScript；
  - `roundEnded`：三枢纽补线索到 3/4/6；`doomPlaced`：议程毁灭在无议程时进阿撒托斯；
  - `actReveal`：读单卡条目的 `actRule.advance` 数据（`rebuild` 参数 / `resolutionChoice`），不写卡号分支；
  - `agendaReveal`：读 `agendaRule.advance` 数据（`ritualSuicide`/`daemonicPiping`/`moveLeft`/`tests`/`skipMemento`/
    `removeDoomMemento`/`discardSelf`），不写卡号分支；
  - `resolveChaosToken`（chaos.js）：skull/cultist/tablet/elderthing；
  - `resolveEncounter`：4 张诡计；
  - 虚空地点行动：`actions` 为每个场上枢纽生成「洗入宇宙并搬到枢纽」行动；
  - `resolution`：r1–r6 写 `shared.js` 中已有记录 + 创伤；`scenarioGaps` 见 §3。
- 条目：`beforeTheBlackThrone/` 下 21 个（05326–05331、05332–05340、05341、05342–05345、05346）；
  `implemented: true` + 逐卡规则数据：`actRule.advance`（05329/05330/05331）、`agendaRule.advance`
  （05326/05327/05328）、`locationRule.onEnter.effect`（05336/05339/05340）；behavior 只读
  `actRuleFor`/`agendaRuleFor` 与引擎直读的 `locationRule`，不含 `code === '05xxxx'` 分支（架构守卫 content 分支在本章为 0）。
- `tests/tcu-black-throne.test.mjs`：≥20 例（manifest/身份、16 地点、宇宙牌库 build/draw/take/shuffle、Void 洗回、
  三枢纽补线索、幕推进重建、议程推进与阿撒托斯计时、阿撒托斯 ≥10 → R1、4 诡计、地点进入效果、
  混乱标记四难度、结局记录/创伤、JSON 往返、确定性、异常路径）。

## 3. 显式近似（写进 `behavior.scenarioApproximations` 与 status.json；`scenarioGaps` 为空）

> 2026-10-24 Lead 策略：`scenarioGaps` 只放「卡面子句完全没实现」；用战役/章节 JSON 状态等价承载卡面语义的
> 记为 `scenarioApproximations`（不阻塞 literalCardBehavior）。本章 16 地点 + 3 幕 + 3 议程 + 4 诡计 + 阿撒托斯
> 计时 + 6 个结局均已有对应行为，故 gaps 为空；下列近似的卡面语义都有等价实现（Cosmos 用「放置顺序 + 方向表」
> 线性模型，虚空格子用 scenarioFlags 计数，阿撒托斯用毁灭计时 + 3/3 攻击近似）。

1. **宇宙网格未实现**：Cosmos 用 P2.13 地点牌库（`api.cosmos`）近似；没有网格坐标/滑动/相邻扩张。
   每个宇宙地点的连接固定到四个枢纽，Void 地点「洗回宇宙」用 `api.cosmos({shuffle})`。
2. **虚空格子未建为地点**：只用 `scenarioFlags.emptySpaceCount` 记账（不参与连接/移动/猎手目标）。
   盲目舞者的「生成于最远虚空格子/进入虚空格子」因此近似为「生成于最远已揭示地点/普通移动」。
3. **「宇宙 -」放置指令**（连右/上/下/任意方向、付代价改方向）未实现：地点以印刷面直接放置入场（视为已揭示）。
4. **阿撒托斯不是场上敌人实体**（参考实现里它也不在任何地点）：毁灭记在 `scenarioFlags.azathothDoom`；
   「阿撒托斯攻击你」= 直接 3 伤害与 3 恐惧（卡面 3/3）。免疫/不可击败因此自动成立，但无法被 UI 当作敌人目标。
5. **冒险参考卡资源**用 `scenarioFlags.referenceResources` 记账；只有宇宙门扉的「移动任意数量调查员」行动被实现，
   其余地点 `[action]`（把地点上/下/左/右移动一次）因无网格未实现（列入 gap）。
6. **命运之轮·X / 它在等待 的「在宇宙中向左移动」未实现**（只结算其余效果）；空场重建时不搬动虚空格子上的玩家卡。
7. **夜魇坐骑 54061（ReturnTo 资产）与 ReturnTo 变体卡不实现**。
8. **调查员被击败的「被击败」段落**只记 info 日志 + 1 点精神创伤近似（参考实现的 `drivenInsane` 会在战役记录里换状态）。
