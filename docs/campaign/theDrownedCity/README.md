# 十循环《沉没之城》迁移路线图

The Drowned City 的战役标识为 `theDrownedCity`，审计简称沿用卡牌筛选中的 `tdc`，参考源战役编号为 `11`。截至 2026-11-15，本地卡表中的 `tdcp`、`tdcc` 共 425 条记录均为 `catalog-only`，战役与章节尚未注册。本文件记录迁移计划，P0–P8 的完成状态以对应代码、测试和审计证据为准。

沿用九循环的阶段清单与八循环的分阶段验收方式。阶段内所有事项及退出门禁通过后才勾选，旁注日期、执行命令、结果及证据路径。规则、卡条目、冒险指南及发布状态按各自规范验收。[九循环路线图](../theFeastOfHemlockVale/README.md) · [八循环路线图](../theScarletKeys/README.md) · [迁移规范](../../arkham-content-migration.md) · [架构](../../../ARCHITECTURE.md) · [一卡一文件](../../card-entry-files.md) · [卡牌模型](../../card-model.md) · [冒险指南](../../scenario-guides.md)

## 1. 来源与迁移范围

参考源位于大厅根目录的 `参考资源/ArkhamHorror-main/`。P0 为实际使用的输入记录相对路径与 SHA-256。

| 内容 | 参考源路径 | 锁定要点 |
| --- | --- | --- |
| 卡面与译名 | `frontend/public/cards_en.json`、`cards_zh-cn.json`、`cards_zh.json`，对照 `cards.json` 与本地归一化卡表 | 英文与简中源各有 130 条 `tdcp` 和 295 条 `tdcc`；通用 `cards.json` 只有 77 条 `tdcc`，单用该文件会漏牌。 |
| 剧本身份 | `frontend/src/arkham/data/theDrownedCity.json`、`backend/arkham-api/library/Arkham/Campaigns/TheDrownedCity/CampaignSteps.hs` | 10 个入口。终章第二部的提示卡为 `11688a`，`11688` 是剧情文物 Horror in Clay。 |
| 战役与逐章行为 | `backend/arkham-api/library/Arkham/Campaign/Campaigns/TheDrownedCity.hs`、`Campaigns/TheDrownedCity/{ChaosBag,Helpers,Key}.hs`、`Scenario/Scenarios/TheDrownedCity/`，及同库对应 `CardDefs`、`Cards` | 初始混乱袋、东西路线、任务、地点布局、逐卡行为与跨章结算。卡文、指南与参考实现出现冲突时，在 P1 记录差异并裁决。 |
| 英文叙事与指南 | `frontend/src/locales/en/theDrownedCity/` | `base.json`、`interludes.json` 及 10 份章节 JSON。保留序章、四个幕间、终章导入、尾声、章节特别规则与勘误。 |
| 中文叙事与指南 | 计划建立 `content/campaigns/theDrownedCity/story-source/`，并按需补 `content/scenario-guide-translations.json` | 本地参考源无对应 `locales/zh/theDrownedCity/` 目录。卡名优先沿用简中卡表，完整指南及叙事按锁定英文源补译并标注译文来源。 |

本地卡表的候选边界为 `tdcp` 的 `11001`–`11129` 和 `tdcc` 的 `11501`–`11766`，含后缀面。按实际卡号、包归属和依赖收敛范围。P0 单列七条可选调查员身份（六位人物）、其专属卡、一般玩家卡、基础弱点、共享遭遇组、章节专用卡及剧本提示卡。检查 `11068a/b` 的身份转换、`11672a/b` 的文物翻面、`11753a`–`11760b` 的八组任务面、终章多面敌人，以及歌莉娅专属卡的跨包替代号。已有核心遭遇组（如 Agents of Cthulhu、Ancient Evils 与 The Midnight Masks 的选用卡）按依赖登记，并核对每个剧本的实际取卡范围。

### 计划产物

下表路径相对 `games/arkhamhorror/`。运行资料另存于大厅根目录的 `artifacts/migration/tdc/`，包括分片、原语请求、worker 记录、replay 基线、日志与截图。按现有仓库规则签入干净检出复算所需的输入和验收账本。

| 产物 | 路径 |
| --- | --- |
| 战役和内容包 | `content/campaigns/theDrownedCity/` 下的清单、战役流程、叙事及 `scenarios/<scenarioId>/index.js`，`content/packs/tdcCampaign/`、`tdcInvestigators/`、`tdcPlayer/` |
| 卡牌行为 | `src/cards/entries/<code>.js`、`src/cards/encounter-entries/theDrownedCity/_shared/<group>/<code>.js` 或 `theDrownedCity/<scenarioId>/<code>.js`。跨战役共享条目沿用 `shared/<group>/`，重印复用 canonical 条目。 |
| 叙事及指南 | 规划 `tools/import-tdc-story.mjs --write/--check` 与生成的 `story-text.js`。扩展现有 `tools/import-scenario-guides.mjs`，生成 `web/scenario-guides/<scenarioId>.json`。 |
| 规划及验收证据 | `audit/tdc-{scope,mechanism-scan,primitive-plan,primitive-catalog,migration}.json`，以及规则、交互、逐卡、逐章和发布证据。 |
| 测试 | `tests/tdc-*.test.mjs` 与 `tests/playwright/` 中的十循环浏览器用例，按阶段接入本循环测试和审计命令。 |

## 2. 阶段路线

执行顺序为 **P0 → P1 → P2 → P3 → P4 → P5 → P6 → P7 → P8**。P5–P7 对应迁移规范第 5 步的三个内容批次。

### P0 锁定范围与基线

- [ ] 按包和归一化卡号复算范围，展开关联面、重印、绑定卡与范围外依赖。各分区无交集，并集与卡号清单一致。分开登记卡表记录数、印刷数量和需要行为条目的卡号。
- [ ] 锁定 10 个真实提示卡号、四档难度的初始混乱袋与逐章符号效果、章节来源和指南来源。保留来源漂移检查，并记录中英文缺项。
- [ ] 记录起始提交、工作区已有修改、既有测试失败与 R1/R2/R3 合规基线。在改行为前采集既有关卡的 replay 基线。此阶段各项内容保持 `catalog-only`。

### P1 扫描新增机制

- [ ] 扫描全部卡文及关联面、故事设置、路线、任务与结局。每张范围内的卡关联至少一个机制分类，记录代表卡号、来源、已知引擎读点及行为缺口。范围内未分类项为 0 后进入 P2。
- [ ] 针对第 4 节逐项裁决规则差异。重点确认幕间 II 的混乱袋变化，英文指南西线明确写了移除 1 枚石板并加入 1 枚邪教徒，参考代码只显示西线文本，东线留有换标记 TODO。先对照锁定的指南与勘误确认实际适用分支，再实现和测试。
- [ ] 盘点各章指南中的图示、条件设置、任务段落和特殊小节，建立英中段落对照表。包含 `sunkenStairway`、`lostPilgrims`、`theHiveMind`、`theVaultCore`、`cosmicOmen`、`hangingShip`、`magneticSpires` 和终章 `errata`，并解析西墙 `specialRules` 中的本地化引用。

### P2 拆分并实现通用原语

- [ ] 按 `reuse / new / escape` 登记原语、接口、状态、窗口、目标及现有测试。先验证《印斯茅斯暗潮》的三级淹没、既有混乱袋密封、附属牌和跨章记录能力，再补离场交接、动态连接和独立牌库等真实缺口。
- [ ] 新原语同时交付注册校验、引擎读点、正常与非法路径测试及 JSON 存档往返。重复卡文按迁移规范提取共用能力，逐卡 `resolve` 的例外记入 `escape`。新增原语均已完成且 `test:fast` 无新增失败后进入 P3。

### P3 关键词与规则书

- [ ] 从指南与卡面核对 Alert、Patrol、Relentless、Seal 的适用范围和代表卡号。重点验证 Relentless 在敌人阶段攻击步骤后重新准备并再次攻击，第一次攻击被取消也满足触发条件。
- [ ] 登记本循环的淹没、任务、文物和字形、地点连接、终章专用板块及牌库等中英规则和卡文直达链接。按规范生成 `confirmations.keywords` 与 `confirmations.rulebook`，通过规则目录、搜索、跳转与返回的双端验收。

### P4 新增交互与界面

- [ ] 验收任务去重选取和当前进度、东西路线与地图划除记录、字形 A–Z 翻译记录、文物分配和接管、动态地点及终章克苏鲁板块／部位目标。以服务端合法操作驱动选择和禁用原因，覆盖多人平手、取消与恢复。
- [ ] 幕／议程行动以 `scriptCard` 归属到剧本书对应卡。复用剧本书右侧、混乱标记提示卡下方的“关卡设置”入口，特别规则优先，后续剧情和结局默认折叠。以座位权限控制私人任务选项、暗置内容和实际叙事分支。
- [ ] 桌面 1440 与移动 390 验收新交互的正常、非法、空状态、重试、键盘和焦点路径，保存报告与截图后进入批量卡牌。

### P5 调查员及专属依赖

对照卡面与构筑数据实现全部主能力、旧印及构筑选项。每位调查员验收初始化、专属依赖、正负构筑、触发窗口和存档。大厅选人与手动／自动构筑共用服务端口径。

| 清单 | 卡号与调查员 | 专属依赖与高风险行为 |
| --- | --- | --- |
| [ ] | `11001` 玛利翁·塔瓦雷斯（Marion Tavares） | `11002/11003`。构筑特质选择、少一个手部槽位、打出事件后补牌并可打出不同事件、每轮限制。 |
| [ ] | `11004` 卢修斯·加洛维（Lucius Galloway） | `11005/11006`。躲避检定成功且超出难度至少 2 时，发现所在地点 1 个线索。验收每轮限制及同地点敌人数对旧印的影响。 |
| [ ] | `11007/11008` 阿加莎·克雷恩（Agatha Crane） | 共用 `11009/11010`。探求者／潜修者版分别校验 35 张构筑与副职限制，同一角色身份互斥。回合结束检查本轮密封、取消或忽略标记，从弃牌区打出对应事件并在结算后移出游戏。 |
| [ ] | `11011` 迈克尔·麦克格林（Michael McGlen） | `11012/11013`。枪械和来源 `fa` 标签构筑、每件枪械每轮独立限次、弹药支付与补弹。 |
| [ ] | `11014` 歌莉娅·戈德堡（Gloria Goldberg） | `11015/11016`，替代号 `98020/98021`，同时核对书版身份 `98019`。神秘阶段调查员顺序、额外查看遭遇牌、非精英筛选和暗置区上限。 |
| [ ] | `11017` 乔治·巴纳比（George Barnaby） | `11018/11019`。35 张构筑、弃牌后暗置并补牌、阶段限制、以暗置数量确定手牌上限及从暗置区投入检定。 |

### P6 一般玩家卡

- [ ] 按职业、等级以及依赖分无交集批次，单列基础弱点、重印和变身卡。`11068a → 11068b` 的调查员转换纳入玩家卡批次，验证转换后的构筑变更限制与死亡结算，以及大厅的起始选人门禁。
- [ ] 逐卡对照每个费用、时机、目标、限制和离场条件，保留可执行证据。接入单卡文件和索引，复核构筑、升级与随机基础弱点池。
- [ ] 按通用规范提交原语请求及分片报告，由主进程合并、重建索引并执行合规审计。新增 R1/R2/R3 为 0、队列无悬挂、范围内卡均有测试证据后关闭本阶段。

### P7 共享遭遇、剧本与战役流程

- [ ] 先迁移战役内共享的 Stowaways、Pilgrims、Star Spawn、Cosmic Legacy、Elder Mist、Undersea Creatures、Flood、R’lyeh、Domination、The Inescapable、Deep Ones、Dreams、Alien Machinery、Tasks、Expedition，再按第 3 节逐章接入。
- [ ] 每章同步交付完整的中英文冒险指南，包括条件开场、完整设置、特别规则、后续剧情、全部结局与机械结算。核对布置图承载的地点层级和连线，逐章通过生成、注册覆盖和浏览器验收。
- [ ] 实现序章、幕间 I–IV、终章导入和尾声，验证拒绝邀约、东西向、分支跳章、墓穴特殊胜负、回阿卡姆以及终章进度。覆盖退出重入与结算重试，避免重复发放经验、任务进度、奖励或标记。
- [ ] 每章审计登记来源、身份、区域守恒、幕／议程、地图、遭遇行为、逐条卡文、符号、结局、叙事、保存／重放及浏览器证据。全部条件满足后才标记 `verified`。[逐章确认清单](../../arkham-content-migration.md#5-剧本迁移确认)

### P8 整体验收与发布

- [ ] 从真实大厅创建战役并推进东西两线，覆盖跳过淹没城区、墓穴进入／跳过、任务成功／失败、终章两种幕牌路线以及失败结局。用单人、多人及 AI 验证席位归属和存档后续玩。
- [ ] 复算总账本和逐卡清单，执行索引、合规审计、全量测试、replay 与双端浏览器回归。对照三组 `confirmations` 和 `releaseAcceptance`，按通用发布门槛确认大厅、选人与构筑的开放状态。

## 3. 章节与战役流转

序章为叙事步骤。10 个剧本入口按下表登记，编号沿用参考源中的身份列表。表内中文名来自现有简中卡表。

| 验收 | 章节 | 标识与提示卡 | 逐章重点 |
| --- | --- | --- | --- |
| [ ] | 金盆洗手 / One Last Job | `oneLastJob` · `11501` | 露比赌局胜负、外星语言解锁记录、开场布局和进入幕间 I。 |
| [ ] | 西墙 / The Western Wall | `theWesternWall` · `11517` | 5 层地点、相邻两整层互通与同层不连通、东西向起点与淹没差异、沉没阶梯、Do No Harm 结算。 |
| [ ] | 淹没城区 / The Drowned Quarter | `theDrownedQuarter` · `11536` | 随机海床布局、文物 Barrier Node、供能改道记录及后续对大秘库布置的影响。 |
| [ ] | 养育场 / The Apiary | `theApiary` · `11553` | 东西向遭遇组、迷失朝圣者、Hive Mind 及方向旋转、败退与寄生变异、跳章和 Grisly “Mask”。 |
| [ ] | 大秘库 / The Grand Vault | `theGrandVault` · `11587` | 大阶梯与随机秘库房间、淹没布局、供能分支、内殿解封、Tidal Tablet 及 Good Money 对下一章的效果。 |
| [ ] | 古代议庭 / Court of the Ancients | `courtOfTheAncients` · `11612` | 大升降机在 1–4 层移动，牌和标记随行，邻接与路径即时更新。另核对东西向布局、Cosmic Omen 与 Shard of Y’ch’lecht。 |
| [ ] | 黑曜石峡谷 / Obsidian Canyons | `obsidianCanyons` · `11639` | 正交地图、开放天空、峰顶牌库从底抽和补空位、风暴强度、吊船、磁力尖塔、Obsidian Claw 双面及 Prove Your Worth。 |
| [ ] | 沉睡者墓穴 / Sepulchre of the Sleeper | `sepulchreOfTheSleeper` · `11673` | 根据文物、字形与解封记录处理入场和跳过，验收 Disturbance、败退附加结算及直接结束战役的胜负分支。 |
| [ ] | 阿卡姆的毁灭 第一部分 / The Doom of Arkham Part I | `theDoomOfArkhamPartI` · `11682` | 阿卡姆地点变体、盟友与 Horror in Clay、文物划除、淹没街区和失败弱点、两部之间升级。 |
| [ ] | 阿卡姆的毁灭 第二部分 / The Doom of Arkham Part II | `theDoomOfArkhamPartII` · `11688a` | 按战役记录选幕／议程、布置未划除文物及继承淹没街区，验收克苏鲁本体／部位、独立牌库、怒气、胜负与 The Final Seal 阈值推进勘误。 |

- **开场**　序章 → 金盆洗手 → An Offer You Can’t Refuse（幕间 I，逐人领取互斥任务，队伍可拒绝邀约并结束战役）→ Expedition to R’lyeh（幕间 II，选择方向及同行者）。
- **西向**　西墙 → 淹没城区 → 养育场 → 大秘库 → 古代议庭 → 黑曜石峡谷。西墙结算可直接去养育场。
- **东向**　黑曜石峡谷 → 古代议庭 → 大秘库 → 养育场 → 淹没城区 → 西墙。养育场结算可直接去西墙。按各章结局而非列表顺序计算下一站，验证地图只划除已完成的章节。
- **墓穴门槛**　验证至少 1 件拉莱耶文物且至少 10 枚已译字形的初筛。通过后再核对 5 件文物、全部 26 枚字形和内殿解封。初筛通过但未达到完整条件时加入 `0` 标记并跳至幕间 III；完整条件满足后，玩家可进入墓穴，或跳过并给各调查员增加任务进度。墓穴自身可直接通向尾声或战役失败。
- **回城**　跳过墓穴 → The Awakening（幕间 III，按战役记录重置指定符号标记）→ Return to Arkham（幕间 IV，各自结算任务）→ 终章导入 → 第一部 → 升级／整备 → 第二部 → 按结局处理尾声或战役失败。

## 4. 机制回归重点

| 机制 | 验收样例 |
| --- | --- |
| 淹没与拓扑 | 复用 `src/engine/flood.js` 的三级淹没与上下限。淹没等级本身无固有效果，只有明确规则施加后果。分别验收西墙按层连通、峡谷按边邻接、议庭升降机按当前位置连通。对照移动、猎手、巡逻及最短距离查询。 |
| 任务与跨章效果 | 八张任务各有未完成／完成两面，每位调查员独立记录。验证领取互斥、0 进度不能擦除、撤退／被击败时结算且同一章只记一次，以及幕间 IV 的奖励或惩罚。下一章才生效的奖励须按进入章次结转。 |
| 文物与字形 | 记录 A–Z 已译集合，去重并以完整字形组解锁文物字形下方的文字。文物不加入牌库，按已获得且符合当前布置条件的集合选择。检验双面同一实体、不可弃置、持有者被击败时转交最近幸存者及同距离选择。分开核对远征用品的区位及弃牌归属。 |
| 地图、追踪敌人与持续效果 | 记录东西向、朝圣者、供能、内殿以及 The Inescapable 是否已被击败。验证后续章节按记录选择起点、地图与遭遇牌，幕间 IV 的持续混乱标记变更在新章、读档和 replay 中生效。 |
| 克苏鲁板块 | 本体是地图上的单一敌人，战斗／躲避选择部位，敌人阶段按板块合计伤害与恐惧。验证部位翻面、独立牌库的抽取和弃牌、符号触发的每轮上限、怒气阈值以及终章不同结算。 |
| 指南与结算一致性 | 逐章核对布局、四档符号、所有可达结局和来源勘误。终章第一部测试文物和淹没街区在相应结局写入后，由第二部正确继承，含同名地点的废墟变体。 |

## 5. 验证命令

以下现有命令从 `games/arkhamhorror/` 执行。十循环专用命令随对应阶段接入，验收日志记录当次实测结果。

```powershell
npm run docs:check
npm run baseline:check
node tools/replay-fixtures.mjs --baseline ../../artifacts/migration/tdc/replay-before.json
node tools/replay-fixtures.mjs --compare ../../artifacts/migration/tdc/replay-before.json
node tools/build-card-index.mjs --write
node tools/build-encounter-index.mjs --write
npm run cards:check
npm run cards:encounter-check
npm run audit:entries
node tools/import-scenario-guides.mjs --write
node tools/import-scenario-guides.mjs --check
node --test tests/scenario-guides.test.mjs
npx playwright test --config tests/playwright/playwright.config.mjs scenario-guides.browser.mjs
npm run test:fast
npm run replay:fixtures
npm run presentation:check
npm test
```

replay 基线在行为改动前采集，改动后对比。索引由主进程在合并单卡条目后重建，指南随每章生成并验证。发布账本链接逐章报告、双端截图和真实大厅游玩证据，记录新增失败、可复现的既有失败及尚未验收的机制。
