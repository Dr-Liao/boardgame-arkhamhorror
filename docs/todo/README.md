# Arkham Horror 剩余内容实施顺序

基线为本地 Mod `019eef91`。大厅已开放 21 个战役、120 个章节（含批次 1–2 的入门包、三套「重返」、三条独立支线与四项调查员挑战）。本路线图覆盖剩余玩家卡、5 套「重返」、11 个独立支线入口、8 个挑战入口，以及参考项目额外收录的战役。逐包卡号见[剩余玩家卡清单](player-cards.md)。

## 实施批次

批次按规则复用和验收依赖排列。独立内容可在共用机制稳定后并行推进。复选框记录该项的交付状态，支线、挑战和战役在下方按入口逐项勾选。

### 批次 1 · 存量构筑与首批入门包

每包先做调查员、签名和弱点，再做普通牌，最后接入构筑与升级。详细状态见[批次 1 账本](../../audit/starter-batch-1.json)。

- [x] 接通 `04038`、`04040` 在指定随机弱点池中的构筑校验。
- [x] 接通 `10059–10061` 的关间研究升级及存档恢复。
- [x] 开放修订核心印刷 `01685` 的行为别名及导入，复用已开放原版 `60227`。
- [x] 开放 Nathaniel Cho 的选人、签名牌和入门包基础弱点。
- [x] 开放 Harvey Walters 的选人、签名牌和入门包基础弱点。
- [x] 开放 Winifred Habbamock 的选人、签名牌和入门包基础弱点。
- [x] 开放 Jacqueline Fine 的选人与签名、弱点套件。
- [x] 开放 Stella Clark 的选人与签名、弱点套件。
- [x] 将拳击手套和荣耀加入普通牌池。
- [x] 注册 137 个卡牌行为条目和 23 个入门包重印别名。
- [x] 开放通过实际结算验证的 137 个行为条目，覆盖选人、依赖、普通牌与升级。
- [x] 补齐并验收最后 14 个卡号的引擎规则。
- [x] 补齐并验收 `60114`、`60123` 的交战与战斗行动归类，以及 `60129` 的潜藏揭露。

同批用 *Curse of the Rougarou* 打通支线通用流程，交付项见[剩余支线与挑战](#剩余支线与挑战)。

### 批次 2 · 「重返」与首批平行调查员

- [x] 随各自战役补「重返」玩家卡与弱点。
  - [x] 前三套「重返」的 28 张玩家卡已接通构筑与升级，2 张研究卡通过关间升级解锁，4 张基础弱点可由对应候选池抽取。
  - [x] 注册前三套「重返」玩家包，并用独立测试战役验证开局构筑池和基础弱点池读取正确。
  - [x] 验收大厅自动构筑确认时抽取所引用「重返」玩家包的基础弱点。
  - [x] 随「重返」战役接入默认弱点池和开局配置：三套重返战役已注册（`returnToNightOfTheZealot` / `returnToTheDunwichLegacy` / `returnToThePathToCarcosa`），`requiredPackIds` 引入对应 `rt*Player`（51011、52011–52013 进入战役默认弱点池），`opening.experience = 0` 与基础混乱袋随清单进入大厅开局投影。
- [x] 开放重返敦威治遗产原版 `51007` 及修订核心印刷 `01689` 的别名和导入。
- [x] 接通前四位平行调查员的选人、正背面搭配、标准与进阶签名，以及平行罗兰的三张准则选择。
- [x] 验收自动与手动构筑、平行背面的开局 XP 和保留旧版升级、战役存档与本地卡组库恢复。
- [x] 验收平行阿格妮丝打出 `10102` 后洗回牌库，以及未洗回时揭示符号并在回合末回手。
- [x] 验收 `51009` 用失败攻击的伤害揭露隐匿迷你卡，以及 `51010` 使用检定指定的基础技能值。
- [x] 用原创测试剧本验收独立开局的 XP、调查员限制、难度和混乱袋，以及战役支线的入场费用、结局回写和回到下一章。

生产剧本已完成前三套[「重返」战役](#重返战役)、支线通用流程及 *Carnevale of Horrors*、*Murder at the Excelsior Hotel*，以及前四个[调查员挑战](#调查员挑战)；*Curse of the Rougarou* 单开与插入战役两条路径均验收。逐项状态与测试证据见[批次 2 账本](../../audit/return-player-batch-2.json)。

### 批次 3 · 2026 核心盒与后续入门包

- [x] 交付 2026 核心盒的五位调查员、签名、基础弱点和普通玩家牌：Daniela Reyes / Joe Diamond / Trish Scarborough / Dexter Drake / Isabelle Barnes（12001–12015），54 张普通玩家卡（12016–12088）与 8 张基础弱点（12097–12104）进入可选池与构筑池。
- [x] Tommy Muldoon 入门包，复用已完成的重印行为。
- [x] Carolyn Fern 入门包，复用已完成的重印行为。
- [x] André Patel 入门包，复用已完成的重印行为。
- [x] Marie Lambeau 入门包，复用已完成的重印行为。
- [x] Miguel de la Cruz 入门包，复用已完成的重印行为。

批次 3 已完成（2026 核心盒 + tom/car/and/mar/mig 五个入门包，共 219 张单卡行为；45 个跨包重印号归并到已开放原版；Starting 关键词接入起手牌读点）。逐卡状态、共享改动、缺原语与验收证据见[批次 3 账本](../../audit/starter-batch-3.json)，逐卡近似注释见 `src/cards/entries/<code>.js` 与 `artifacts/migration/starter-batch-3/`。

核心牌池就绪后做 **Brethren of Ash**。先完成多章节支线衔接，再做 *Fortune and Folly*、*The Midwinter Gala*、*Film Fatale*。继续「重返失落的时代」和「重返万象无终」。

### 批次 4 · 剩余调查员套件与 Beta 支线

- [x] 补齐剩余平行调查员，各挑战所需套件随该剧本验收。（5 套独立平行版本 + 4 套挑战平行套件已接入构筑/替换签名；近似逐卡见账本）
- [x] 补齐书籍替换签名。（98001–98018、99002–99003 替换签名条目与 alternate 家族已接线；98004/98010/99001 走重印别名）
- [x] 交付 Subject 5U-21 调查员套件。（89001–89004 条目、可用性与双基础弱点构筑数据已接入；特殊 50 张/五职业配比自动牌组待补）

同批做其余四个挑战、*The Blob That Ate Everything* 的普通流程和 ELSE! 变体，以及参考中的 Beta 支线。跨桌协作在各剧本普通流程之后验收。

批次 4 已交付：调查员套件（平行/替换签名/Subject 5U-21）、四个挑战 90041/90054/90065/90094、Blob 85001 普通 + ELSE! 双入口、四个 Beta 支线 70001/83001+83016/86001/87001 的单桌普通流程（各带双语指南与真实引擎测试）。**跨桌 epic multiplayer 编排与少数遭遇卡逐条规则仍待后续批次**，逐项状态见[批次 4 账本](../../audit/starter-batch-4.json)。

### 批次 5 · Children of Blood

- [ ] 随战役接入新来源中确认属于玩家侧的卡。

**Children of Blood** 放在最后，按[剩余战役](#剩余战役)中的章节顺序验收。

## 剩余支线与挑战

支线按参考前端的入口计数。内部有多个章节或变体的入口，在同一剧本批次内落实。

1. [x] Curse of the Rougarou（`81001`）。首条支线，覆盖单开与插入战役。
   - [x] 验证单剧本开局、初始 XP、难度和混乱袋设置：`opening.experience = 1`、只开放 Standard/Hard 两档袋，大厅难度按钮按清单过滤。
   - [x] 验证插入战役时的 XP 扣除、奖励与创伤回写，以及返回原定下一章：关间 `hubStartSideStory`（每人 1 XP），结算后回原关间再推进。
2. [x] Carnevale of Horrors（`82001`）。复用通用支线入口，核对结局与奖励（每人 3 XP，单开起始 3 XP）。
3. [x] Murder at the Excelsior Hotel（`84001`）。验收随机幕后真凶及组合结局（10 张真凶议程随机 1 张，每人 3 XP）。
4. [ ] Fortune and Folly（`88001`）。验收两部分的切换和各项状态继承。
5. [ ] The Midwinter Gala（`71001`）。核对不同阵营带来的布置和结局差异。
6. [ ] Film Fatale（`72001`）。核对片场分支及剧情目标。
7. [x] The Blob That Ate Everything（`85001`）。先普通流程，再接 ELSE! 变体和 Subject 5U-21，最后验证跨桌协作。
8. [x] Guardians of the Abyss（`83001`，参考 Beta）。先 *The Eternal Slumber*，再 *The Night’s Usurper*，覆盖连玩与各部分单开。
9. [x] The Labyrinths of Lunacy（`70001`，参考 Beta）。先核对可用的单桌与迷你战役流程，再接跨桌协作。
10. [x] War of the Outer Gods（`86001`，参考 Beta）。先做单桌三方冲突，再接跨桌协作。
11. [x] Machinations Through Time（`87001`，参考 Beta）。先核对时间线和区域间规则，再接跨桌协作。

### 调查员挑战

调查员挑战按下列顺序实现。逐个锁定参考的调查员限制、初始 XP、牌组依赖、难度和结算。

1. [x] Read or Die（`90004`），同批验收 Daisy Walker（单开 1P：起始 3 XP、仅 90001 可选）。
2. [x] All or Nothing（`90011`），同批验收 “Skids” O’Toole（起始 3 XP、仅 90008 可选）。
3. [x] Bad Blood（`90020`），同批验收 Agnes Baker（起始 3 XP、仅 90017 可选）。
4. [x] By the Book（`90032`），同批验收 Roland Banks 与 Directive（起始 3 XP、仅 90024 可选；本批按 1P 单开验收，多人限制留批次 4）。
5. [x] Red Tide Rising（`90041`），同批验收 Wendy Adams。
6. [x] Laid to Rest（`90054`），同批验收 Jim Culver 与灵体牌组。
7. [x] Relics of the Past（`90065`），同批验收 Monterey Jack。
8. [x] Enthralling Encore（`90094`），同批验收 Lola Hayes 及角色相关卡。选人限制以参考剧本入口和规则为准。

[参考支线与挑战清单](../../../../参考资源/ArkhamHorror-main/frontend/src/arkham/data/side-stories.json)

## 剩余战役

### 「重返」战役

首套先验证同一原版的开局选择、遭遇组替换和存档续玩。后续套件复用这些入口，再逐章补布置、行动、结局与战役记录差异。

1. [x] 重返夜之狂热（`50`）：三章 `returnToTheGathering` / `returnToTheMidnightMasks` / `returnToTheDevourerBelow` 已注册可启动，随机阁楼/地窖、双版本密谋、扩充密林与乌默尔多斯附属按参考差异实现。
2. [x] 重返敦威治遗产（`51`）：八章重返变体已注册可启动（十处随机二选一地点、扩充列车池/展厅/子嗣池、v.II 幕密谋等）。
3. [x] 重返卡尔克萨之路（`52`）：八章重返变体已注册可启动（六张陌生人幕、确信/疑惑选项、地下墓穴扩建、哈斯塔版本替换等）。
4. [ ] 重返失落的时代（`53`）。
5. [ ] 重返万象无终（`54`），核对通用塔罗占卜与现有剧情塔罗的关系。

### 新战役

1. [ ] Brethren of Ash（`12`）。与 2026 核心玩家卡共用包号，按卡牌用途拆分验收。
   - [ ] Spreading Flames（`12105`）。
   - [ ] Smoke and Mirrors（`12133`）。
   - [ ] Queen of Ash（`12168`）。
2. [ ] Children of Blood（`13`，参考 Alpha）。
   - [ ] 核对卡面、章节设置、路线和结局来源，从参考行为和现有资源锁定目录范围，补齐缺失卡面记录与双语指南。
   - [ ] River of Blood（`13001`）。
   - [ ] New Horizons（`13031`）。
   - [ ] Blood Money（`13068`）。

[参考战役清单](../../../../参考资源/ArkhamHorror-main/frontend/src/arkham/data/campaigns.json) · [Brethren of Ash 章节](../../../../参考资源/ArkhamHorror-main/frontend/src/arkham/data/brethrenOfAsh.json) · [Children of Blood 章节](../../../../参考资源/ArkhamHorror-main/frontend/src/arkham/data/childrenOfBlood.json)

## 验收与更新

- 每批先锁定来源、卡号和回放基线，再按[内容迁移规范](../arkham-content-migration.md#4-迁移执行顺序唯一)处理原语、关键词、规则书和交互。卡牌按[一卡一文件](../card-entry-files.md)落地，重印沿用原版行为。
- 玩家卡覆盖实际选人、手动构筑、升级、弱点或签名依赖，以及对局结算。每个剧本补齐[中英文冒险指南](../scenario-guides.md)，从生产入口验证布置、结局、存读档及适用的联机路径。
- 登记完成前通过相关索引守卫、快速测试和回放对比。新增牌桌交互覆盖桌面 1440 和移动端 390。每批合入后更新对应审计账本与本目录待办。
- 已开放战役的规则差异沿用各自账本追踪，包括[沉没之城](../../audit/tdc-migration.json)的任务与跳章差异，以及[铁杉谷盛宴](../../audit/fhv-migration.json)的逐卡行为近似。
- 批次 2 的生产交付与证据见[批次 2 账本](../../audit/return-player-batch-2.json)：三套重返战役（19 章变体）、三条独立支线、四项调查员挑战、关间插入流程与 120 章中英指南生成物；逐章差异、卡号覆盖与已知近似见 `artifacts/migration/batch-2-remaining/*-dossier.md`，浏览器 1440/390 验收见 `artifacts/migration/batch-2-remaining/browser-guides-final.log` 与 `browser-hub-rerun.log`，全量快测见 `fast-release-concurrency6.log`（9197 例 · 9194 通过 · 0 失败 · 3 跳过）。
