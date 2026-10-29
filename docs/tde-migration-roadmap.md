# 《食梦者》迁移路线图（TDE，五循环）

> **状态口径**：`draft` · 尚未开工。TDE 当前是 `catalog-only`：卡面数据已在 `src/cards/cards-data.js`，但**不可选人、不可构筑、不可启动**；本文是**计划文档**，不是完成报告，不含任何「已实现 / 已验收 / 规则等价」声明。
> 起草：2026-10-27；依据 [`arkham-content-migration.md`](./arkham-content-migration.md)（迁移规范）的六步顺序与 M0–M5 产物范围，分层约束见 [`ARCHITECTURE.md`](../ARCHITECTURE.md) §3–§9；仓库基线 HEAD `e0dc5bd`、规则版本 `n6.0`。先例：TCU（四循环）已完整交付的全链路产物，本文的数字级类比均以 `audit/tcu-migration.json` 为锚点。
> 阅读顺序：[`arkham-content-migration.md`](./arkham-content-migration.md) → 本文 → M0 之后按阶段新建的 8 篇卫星文档（`docs/tde-primitives.md`、`tde-rules.md`、`tde-interactions.md`、`tde-investigators.md`、`tde-player-cards.md`、`tde-scenarios.md`、`tde-story.md`、`tde-release.md`；骨架见 §8.3）。
> 数据来源：`artifacts/migration/tde/recon/` 三份只读初勘（`scope/scope-draft.*`、`mechanism/mechanism-draft.*`、`baseline/{inventory.json,gaps.md,baseline.md}`），以及 2026-10-27 补充评估 `recon/fullmode/impact.md`（旧双 part / `pick` 改动量）与 `recon/story-gap/report.md`（自译缺口）。初勘数字**不是正式账本**，M0 由 `npm run scan:tde:scope --write` 重新生成 `artifacts/migration/tde/scope.json` 后才算锁定。
> **2026-10-27 P0 核实**：上述 `artifacts/migration/tde/recon/**` 在当前工作树与 git 历史中均不存在（`git log --all -- artifacts/migration/tde` 为空），初勘数字**暂无复算来源**；P1 起由 `scan:tde:scope --write` / `scan:tde` 重新生成，本文所有「初勘」数字降级为历史口径。核实与处置见 [`tde-p0-report.md`](./tde-p0-report.md) §2.2。
> 2026-10-27 路径重排：双 part 骨架前移到 P3，P5 通闭环但只暴露 A/B，P9.5 只做双线模式开闸；官方玩法事实与四人联机语义见 §1.4、§7.2、§7.4。
> 2026-10-27 玩法口径定稿（取代上一条的开局口径）：开局只暴露 **四个选项** —— 单线 A、单线 B、**并行双线**（两组等分、同时各打一条线）、**分选双线**（自由选线、可不等分、每个章对独立选择先手）；**人数为奇数时禁止开并行双线**。每座位只需一套牌组，线归属落 `campaign.seatParts`；`officialFull` 的整桌切换与每人两套不再是开局选项。见 §1.4.1、§7.5。
> 命名约定：产品代码与当前实施范围只使用四个模式值：`singleA`、`singleB`、`pick`、`parallel`。本文用「双线模式」统称 `pick` + `parallel`；`officialFull` 仅指官方规则中的「整桌切换、每人 A/B 各一套」玩法，并且**不在本轮产品范围内**。禁止再用裸 `FullMode` 同时指两套不同语义；§7.4 只保留 `officialFull` 的历史事实，不进入当前原语、工作包或开闸门禁。
> 2026-10-27 D8 决策：并行双线采用 **D8-C**（一个房间 / 一个房主 / 一套存档；双运行时并发推理、全局串行提交；关卡屏障）。细节同时拍板：两边结算后**自动**进幕间、等待期**只见自己的结算**、**AI 席位允许两线并存且请求并发**（不轮转排队）、幕间正文**两边读全文**、存档**单文件**。见 §7.5.2。

## 0. 一页结论

| 项 | 结论 |
| --- | --- |
| 目标 | 按六步顺序把 TDE（06 号段）迁移为可启动、可存档重放、三组确认齐备的战役；先例与门禁全部照 [`arkham-content-migration.md`](./arkham-content-migration.md) §4–§9，不另立规矩 |
| 范围 | **388 条印刷记录 = 352 主卡 + 36 关联面**；内容包分区 `tdeCampaign` 283（249+34）/ `tdeInvestigators` 18（16+2）/ `tdePlayer` 87；印刷包 7 个（tde 112 / sfk 62 / tsh 41 / dsm 40 / pnr 54 / wgd 47 / woc 32） |
| 章节 | **8 章** = 双战役各 4 章（A 梦寻：Beyond→Search→DarkSide→WhereGods；B 梦网：Waking→ThousandShapes→PointOfNoReturn→Weaver）；20 个遭遇组 = 8 章节组 + 12 共享组 |
| 玩法结构 | 开局**四个选项**：`singleA`（4 章）/ `singleB`（4 章）/ `parallel`（座位等分两组、两线同时推进，仅偶数人）/ `pick`（自由选线、可不均、每个章对独立选择 A 或 B 先打）；后两者都是 4 对 A/B + 3 幕间 + 4×4 尾声，每座位**一套**牌组、`campaign.seatParts` 记房间座位归属、两条 Campaign Log、两袋混乱袋；参考实现见 `Campaign/Campaigns/TheDreamEaters.hs`（845 行） |
| 初勘缺口 | 机制条目 38（primitive 9 / keyword 7 / rulebook 6 / scenario 11 / interaction 2 / content 3），覆盖 388/388，**P2 已复算确认**（另 1 条 baseline）；新增关键词 4（Myriad 14 / Swarming 11 / Veiled 23 / Researched 3），已有待确认 3（Alert 5 / Hidden 18 / Bonded 27）；原语候选 21 新增 + 1 复用，escape 3 |
| 里程碑 | M0 目录与来源基线 → M1 调查员（5 位）→ M2 玩家卡（87 张，4 批）→ M3 剧本（8 章）→ M4 关键词与规则书 → M5 发布（`playable` + `earlyAccess`，`equivalenceCertified: false`） |
| 当前阻塞 | ① 中文剧情源不完整——**已决策自译补齐**（2026-10-27）：en 源 194,299 字符、净需翻译 147,718，预计约 50k 中文字符、14 批、单人约 3–5 周；② 旧实测数字只覆盖双 part 骨架 + `pick`：骨架 550–850 行、累计 1,900–3,100 行（34 文件 / 54–71 例）；`parallel` 的 D8-C 还需房间座位↔线内座位映射、容器适配器、全局提交序列、按线事件投影与单文件存档串行化，**P0 spike 复测前不得把旧数字当完整双线报价**；③ ~~06 段本地卡图仅 1/388~~ **P1 实测 en/zh 各 388/388**（本地缓存被忽略，干净检出 0 张属预期）；④ ~~TCU 三本账本漂移~~ **P0 已处置**（2026-10-27）：根因是 9 篇 TCU 文档被误删（HEAD `421be47` 删 2 篇、`676f33b` 删 7 篇），已恢复并重算，`audit:tcu` / `audit:tcu-scenarios` / `audit:tcu-primitives` / `scan:tcu:scope:check` **4/4 通过**；`audit/baseline.json` 仍为旧口径（R4 待重采，不阻塞 TDE）。文档链接 P0 收尾实测 **43 文件 / 376 本地链接全通过**；⑤ 初勘产物 `artifacts/migration/tde/recon/**` 在仓库与 git 历史中缺失，初勘数字待 P1/P2 工具重算（见 [`tde-p0-report.md`](./tde-p0-report.md)） |
| 诚实边界 | 上述任一未完成时，TDE 只能停在 `catalog-only` / `development`；发布最多 `playable` + `earlyAccess`，逐条剩余写入 `remaining` 与 `scenarioApproximations`，**不宣称规则等价** |

一句话判断：**TDE 的规模与 TCU 同级（388 vs 377 条记录），但结构难度更高——双战役、两条线各自独立的两袋混乱袋、蜂拥/掩藏两个新关键词族，以及一份明显不完整的中文剧情来源。路线图把双 part 骨架前移到 P3、把双线开闸后移到 P9.5；四人局按 `parallel` 是两组等分同时进行，按 `pick` 是自由分线并在每个章对独立选择先手；`officialFull` 的「每人两套牌组、整桌切换」明确退出本轮范围。**

## 1. 范围与来源（M0 交付物 / 索引）

### 1.1 印刷记录与三包分区

分区规则（先用 TCU 05 号段复算验证 237/19/87/377 后才用于 TDE）：**战役卡 = 主卡且带 `encounter_code`；调查员包 = 5 位正式调查员 + 其专属卡；玩家卡 = 其余主卡；关联面按归属跟随**。

| 内容包 | 主卡 | 关联面 | 记录 | 卡号范围（主卡端点） | 说明 |
| --- | ---: | ---: | ---: | --- | --- |
| `tdeCampaign` | 249 | 34 | **283** | 06039–06354 | 8 章节组 253 + 12 共享组 30，全部带 `encounter_code` |
| `tdeInvestigators` | 16 | 2 | **18** | 06001–06017 | 5 调查员 + 11 专属主卡 + 2 面（`06015a/b` 梦境之门，归 Luke） |
| `tdePlayer` | 87 | 0 | **87** | 06018–06332 | 含 4 张基础弱点（06035–06038）与 4 张 bonded 弱点（06019/06025/06283/06331） |
| 合计 | **352** | **36** | **388** | — | 无重叠、无遗漏 |

- 印刷卡包分布：`tde` 112 / `sfk` 62 / `tsh` 41 / `dsm` 40 / `pnr` 54 / `wgd` 47 / `woc` 32。
- `06015a/b` 未出现在卡表 `signatureCards` 中，按卡面 `Bonded (Gate Box)` / `Bonded (Detached from Reality)` 补入调查员包；M0 必须在审计账本里显式登记「无主双面卡」归属规则（另见 `06169a/b` 归战役包）。
- 唯一印刷事实源是 [`../src/cards/cards-data.js`](../src/cards/cards-data.js)（由 `参考资源/.../frontend/public/cards*.json` 经 `npm run import` 生成）；初勘已确认四份参考卡表与仓库卡表**卡号集合一致、7 个关键字段 0 差异**。

### 1.2 八章清单

| # | 目录 id（建议） | 参考卡号 | 中文名 | 英文名 | 线别 | 卡包 | 章节组（主卡/面） | 迁移难度锚点 |
| ---: | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `beyondTheGatesOfSleep` | 06039 | 梦境门外 | Beyond the Gates of Sleep | A 梦寻 | tde | 26（24/2） | 14 种梦境 setup、幕 1–3 的神话阶段不抽遭遇卡、纳什特/卡曼塔 parley 考验 |
| 2 | `wakingNightmare` | 06063 | 清醒噩梦 | Waking Nightmare | B 梦网 | tde | 21（21/0） | **蛛群滋生袋**（独立 7 枚 token 袋）、蛛巢地点、护工替换 |
| 3 | `theSearchForKadath` | 06119 | 寻觅卡达斯 | The Search for Kadath | A 梦寻 | sfk | 53（36/17） | **最大章**：4 区域切换、神迹计数、15 张掩藏地点 + 背面故事卡、被俘记录 |
| 4 | `aThousandShapesOfHorror` | 06168 | 万千骇形 | A Thousand Shapes of Horror | B 梦网 | tsh | 28（26/2） | 183–188 阶梯纵向链、随机门分组、蜂拥授予 |
| 5 | `darkSideOfTheMoon` | 06206 | 月之暗面 | Dark Side of the Moon | A 梦寻 | dsm | 29（28/1） | **警报等级**（0–5+）、白船限制、被俘开场、土星猫 Swarming X |
| 6 | `pointOfNoReturn` | 06247 | 无归之地 | Point of No Return | B 梦网 | pnr | 37（25/12） | 漆黑之海掩藏地点翻面洗位、巨噬蠕虫隧道、桥梁进度决定 setup |
| 7 | `whereTheGodsDwell` | 06286 | 神居之所 | Where the Gods Dwell | A 梦寻 | wgd | 37（37/0） | 奈亚拉托提普 5 形态以 Hidden 敌人在手牌、6 塔 × 4 低语对应、act5 真形生命 |
| 8 | `weaverOfTheCosmos` | 06333 | 编织宇宙 | Weaver of the Cosmos | B 梦网 | woc | 22（22/0） | 大网纵向堆叠、阿特拉克·纳克亚旋转、四腿 Massive、地点毁灭 |

- 章节组卡数合计 **253** = 8 章之和；加 12 个共享组 30 张 = `tdeCampaign` 的 283 条记录（校验通过）。
- 建议迁移顺序采用参考实现声明序（A1→B1→A2→B2→…），便于按「平行章对」复用同一批机制与原语；M3 排期**不能按章均分**（Search 53 张 ≈ Waking 的 2.5 倍）。
- 8 个跨循环通用遭遇组（LockedDoors / StrikingFear / ChillingCold / Ghouls / Rats / AncientEvils / Nightgaunts / DarkCult）被 TDE 章节 `gather` 引用，M3 前必须在现有 `encounter-entries/` 中确认可用；其中 Haskell `Set.DarkCult ↔ ArkhamDB pentagram` 是推断，M0 逐组确认。

### 1.3 调查员与玩家卡分片

| 调查员 | 职业 | 卡号 | 专属卡 |
| --- | --- | --- | --- |
| 托米·马尔登 Tommy Muldoon | guardian | 06001 | 06006 贝基；06007 低级错误（弱点） |
| 曼蒂·汤普森 Mandy Thompson | seeker | 06002 | 06008 神秘证据；06009 惊人的发现（弱点） |
| 托尼·摩尔根 Tony Morgan | rogue | 06003 | 06010 赏金合约；06011 托尼的.38柯尔特长管手枪；06012 托尼的猎物（弱点） |
| 卢克·罗宾逊 Luke Robinson | mystic | 06004 | 06013 门之匣；06014 脱离现实（弱点）；06015a/b 梦境之门 |
| 派翠丝·海瑟薇 Patrice Hathaway | survivor | 06005 | 06016 派翠丝的小提琴；06017 异次元监视者（弱点） |

- 正式调查员 **5 位**（五职业各 1），专属卡 13 条记录（11 主卡 + 2 面）。
- 玩家卡 87 张按 20–50 张/片切 4 片：`M2-1` 22（06018–06110）/ `M2-2` 22（06111–06195）/ `M2-3` 22（06196–06245）/ `M2-4` 21（06246–06332）。

### 1.4 官方三种玩法与 `officialFull` 结构（参考实现事实，来源：英文战役规则 `campaignStructure`）

| 玩法 | 场景顺序 | 牌组 / 记录 / 袋 |
| --- | --- | --- |
| A《梦寻》单独 4 章 | A1 Beyond → A2 Search → A3 Dark Side → A4 Where Gods | 每人 1 套；A log；A 袋 |
| B《梦网》单独 4 章 | B1 Waking → B2 Thousand Shapes → B3 Point of No Return → B4 Weaver | 每人 1 套；B log；B 袋 |
| **`officialFull` 8 章（官方事实，本轮不实现）** | 四对 A/B 交错 + 幕间 I/II/III + 尾声 | 每人 A/B 各 1 套；两 log；两袋 |

```text
A1 ⇄ B1 → 幕间 I → A2 ⇄ B2 → 幕间 II → A3 ⇄ B3 → 幕间 III → A4 ⇄ B4 → 尾声
```

- **四对配对**：A1/B1、A2/B2、A3/B3、A4/B4；`⇄` 表示这一对可先 A 或先 B，但同对两章都完成后才进下一幕间。开局 + 3 次幕间 = 4 个二元选择 = **16 种合法排列**，不是 16 种玩法；本产品的 `pick` 与 `parallel` 沿用这套逐章对 gate，不采用“开局定一次先手后固定 ABAB”的两排列模型。
- **配对屏障**：A1 完成后若 B1 未完成，`nextStep` 强制 B1；B1 完成后同理强制 A1；A2/B2、A3/B3、A4/B4 相同（`Campaign/Campaigns/TheDreamEaters.hs:126-196`）。
- **幕间**：I 黑猫、II Oneironauts、III Great Ones；A 单线只读幕间 I 的 A 侧叙述（part 1）后直接 A2，跳过 II/III；B 单线在幕间 I 直接跳 part 3，处理“你独自前行”后 B2（`Campaign/Campaigns/TheDreamEaters.hs:404-735`）。
- **尾声**：A4 的 4 种结果 × B4 的 4 种结果 = **16 段**；部分组合另有处决 / 疯狂 / 被俘子步骤（`Campaign/Campaigns/TheDreamEaters.hs:736-813`）。
- **切 part 是整桌切换**：每个玩家在 A/B 各一名调查员；4 人 = 8 名调查员 / 8 套牌组。每场场景仍是同一批玩家同时玩，只是换成对应半区的那套调查员；**不存在“2 人打 A、2 人打 B、另外 2 人待机”**。（这条仅是 `officialFull` 的来源事实；本产品的四种开局见 §1.4.1。）
- **两线独立**：记录、牌组、混乱袋、XP、创伤、胜利点、剧情段各自持有；共享的是已完成场景与当前步骤。逐线袋：A 14/14/15/16 枚（Cultist+Tablet+AutoFail+ElderSign，无骷髅/古神）；B 17/17/18/19 枚（Skull+ElderThing+Cultist+AutoFail+ElderSign，无石板）（`Campaigns/TheDreamEaters/ChaosBag.hs:8-42`）。
- **跨线读写**：幕间可写/勾销另一线记录，可给两袋同时增删换；银钥匙可从 B 转移到 A；A 的“入梦者渐弱”只加 A 袋。参考实现用 `record`/`recordInBoth`/`getHasRecord part` 与 `InTheDreamQuest`/`InTheWebOfDreams` 标签消息实现（`Campaign/Campaigns/TheDreamEaters.hs:43-122,833-844`）。
- **记录键**：55 个（`Campaigns/TheDreamEaters/Key.hs`），中文 `key.*` 覆盖 55/55（`locales/zh/theDreamEaters/base.json`）。
- **客户端通用入口**：`Standalone` 可让 8 章各自单开；`Partial Campaign` 若要从任选场景起手，必须先由 scenario 推导 part 并初始化该线 mode/bag/log，否则只允许 A1/B1 起手。两者都不算三种官方玩法，但 M3 验收要显式覆盖，不能默认沿用单战役的 Partial 逻辑。

### 1.4.1 开局四种玩法（2026-10-27 定稿口径）

产品开局**只暴露四个选项**；四者的差别只有两件事：**谁打哪条线**、**两线怎么推进**。

| 选项 | 座位分配 | 推进方式 | 幕间 | 允许人数（`seats = 4`） | 引擎形态 |
| --- | --- | --- | --- | --- | --- |
| 单线 A | 全部座位在 A | 只跑 A1–A4 | 只读幕间 I 的 A 侧 | 1–4 | PartialMode（单运行时） |
| 单线 B | 全部座位在 B | 只跑 B1–B4 | 只读幕间 I 的 B 侧 | 1–4 | PartialMode（单运行时） |
| **并行双线** | 座位**等分**到 A/B | 两线**同时**推进，A_n 与 B_n 可并行结算 | I/II/III，两边同对都完成才进（自动） | **仅 2 / 4（偶数）** | 单房间双运行时（D8-C），见 §7.5 |
| **分选双线（`pick`）** | 座位**自由选线**，可不均 | 同一时刻只跑一条线；**每个章对独立选择** A 或 B 先打，共 16 种合法排列 | I/II/III，两边同对都完成才进 | 1–4，且两线各 ≥1 | 单运行时 + 切 part（复用 §7.2.2 骨架） |

- **人数校验前置到开局设置**（hub）：`playerCount` 为奇数时「并行双线」置灰并给出原因（“并行需要两组人数相等”），不能进入后续选人；`playerCount = 1` 时只保留两个单线选项。
- **分选的双线下限**：两线都必须 ≥1 座位；当分选结果使某线为 0 人时，按单线处理并在开局确认里显式说明，不静默开局。3 人 → 2+1 是合法分选，但**不能**开并行。
- **线归属落状态**：`campaign.seatParts[roomSeat] = 'A' | 'B'`，开局后不可改线（中途换线不在首版范围，写 `remaining`）；线内 `laneSeat` 由该数组确定性派生，见 §7.2.2。
- **每座位一套牌组**：本口径取代 `officialFull` 的「每人 A/B 各一套、4 人 8 套」。选人/构筑只按本线走一次；跨线重复选人校验仍保留（同一位调查员不能同时出现在两线）。
- **`officialFull` 的处置**：`campaign-parts` 切片、`inPart`/`recordInPart`、配对屏障、三幕间、16 段尾声可被本产品双线模式复用；「整桌切换、每人两套」不进入原语清单、工作包或测试门禁，§7.4 只在未来另立第五模式时重新启用。
- **幕间触发**：并行与分选都要求同对章节（A1/B1、A2/B2、A3/B3）两边都完成才进幕间；A4/B4 之后按两线记录查 16 段尾声。单线按各自终章直接结束。
- **非活动线座位**：分选在某一关进行时，另一线的座位处于 waiting——可看本线已公开信息、日志与幕间，**不看**当前关的未公开内容；并行两线同时在打，不存在 waiting 座位。这条直接决定 §7.2.2 的投影与 §11.2 的隐私门禁。

### 1.5 来源锁与基线

| 来源 | 内容 | 初勘状态 |
| --- | --- | --- |
| `参考资源/.../frontend/public/cards_zh-cn.json`（另有 cards_zh/en/cards.json） | 卡号、卡文、包、遭遇组、`myriad` 等字段 | 四表与仓库卡表一致；P1 锁 SHA-256 |
| `参考资源/.../backend/.../library/Arkham/Campaigns/TheDreamEaters/*.hs`（6 文件） | 双战役 Meta、CampaignSteps、ChaosBag、Key、Helpers | 已盘点 |
| `参考资源/.../backend/.../library/Arkham/Campaign/Campaigns/TheDreamEaters.hs`（845 行） | 双战役主流程、牌组切换、幕间、结局矩阵 | **新增依赖源**，必须进来源锁 |
| `参考资源/.../backend/.../library/Arkham/Scenario/Scenarios/TheDreamEaters/*.hs`（8 文件） | 各章 setup/gather/规则细节 | **新增依赖源**，必须进来源锁 |
| `参考资源/.../frontend/src/locales/zh/theDreamEaters/`（base + 8 章 JSON） | 中文记录键、逐章 chaos/剧情 | **不完整**（可复用 45,221 字符 / 23.3%；15 段正文疑似节译须重译，11 条短记录键可原样复用）：base 仅 55 键、无 flavorText/规则段；3 章只有 `tokens`。**用户决策：允许自译补齐（D2，2026-10-27）**，见 §8.5 |
| `参考资源/.../frontend/src/locales/en/theDreamEaters/`（base + 8 章 JSON） | 英文完整剧情/规则原文（自译底本） | 完整：9 文件、`textChars` 194,299、净需译 147,718；P1 锁 SHA-256（批次见 §8.5） |
| `参考资源/.../frontend/src/locales/zh/campaignLog.json` | 记录标签全局副本 | 可作记录文案来源 |

- 来源清单：初勘称 **46 个文件**（`recon/scope/scope-draft.json` 的 `sources`），但 `recon/**` 不在仓库（P0 已核实），该数字不可复算。**P1 实测锁定 43 项**（卡表 4 + 双战役后端 7 + 8 章剧本 8 + 英文剧情 9 + 中文剧情 9 + 中文记录标签 1 + 仓内事实源 5），逐文件 SHA-256 记入 `scope.json.sources`；来源漂移时 `--check` 必须失败。
- 迁移前基线：起草时 `git rev-parse HEAD` = `e0dc5bd`；**P0 重锁**实测 HEAD `421be47`（工作树 34 文件未提交），replay 基线 `artifacts/migration/tde/replay-before.json` = **13 局 / 786 步 / 799 逐步指纹**（规则 `n6.0`，schema 7，与 `tests/fixtures/replay/golden-replays.json` 逐条一致）；`test:fast` 实测 **3607 tests / 0 fail**，既有 2 条红（P6 账本漂移、Carcosa 玩家卡账本 stale）非 TDE 产生，见 [`tde-p0-report.md`](./tde-p0-report.md) §5。用例数与耗时随迁移变化，不写死在文档里，以 `node tools/test-timings.mjs fast` 与 `npm run baseline:check` 的实时输出为准。
- 卡图：**P1 实测** `web/img/cards`（英文）与 `web/img/zh/cards`（中文）各覆盖 **388/388**（avif），远程回退字段 `imagesrc/backimagesrc` 覆盖 388/388。本地卡图目录整体被 `.gitignore` 忽略，干净检出为 0 张属预期，不构成仓库缺陷。**不得**为 TDE 新建循环专属卡图目录或改名副本。

## 2. 执行顺序与实现路径（2026-10-27 重排）

规范六步不变：

```text
P1 锁定范围与基线 → P2 扫描新增机制 → P3 拆分原语 + 双战役骨架 → P4 关键字与规则手册
  → P5 新增交互 + 双战役引擎闭环 → P6–P8 批量迁移卡牌/调查员/剧本（P8-T 剧情并行）
  → P9–P9.5 测试、双线开闸 → P10 发布
```

TDE 按“**骨架先行、模式后开**”重排，不再把双线模式当成 P9.5 的一次性加装：

- **P3 落骨架**：`campaign-parts` 的切片/切换/`inPart` + 座位映射原语 + JSON 往返 + 旧 13 局零漂移。骨架同时服务 `singleA`/`singleB`/`pick`，D8-C 的容器适配在 P0 spike 后从 P5 接入，不做“先单战役、后补双线”的两套代码。
- **P5 通闭环**：四个开局选项、按线选人、切 part（`pick`）、并行双运行时落位（D8-C，§7.5.2）、双日志/双袋投影、座位分线。用现有战役 + 合成两 part 夹具验证；TDE 的 A/B 内容在 P8 接入后才对玩家开放，P5 只验证机制闭环；双线始终留在 feature gate 后。
- **P8 补内容**：8 章按 part 标注；三幕间 + 16 段尾声 + 跨线效果按双线写，单线复用同一批章节与幕间 I。
- **P9.5 只开闸**：双线从 feature gate 打开，跑 4 人 2+2、2 人 1+1、3 人分选 2+1、16 排列、并发提交/存档/回放/浏览器验收；不再做架构返工。
- 若 P3 骨架失败，退回纯 A/B 单线（不引入 `parts`）：保留 A/B 可玩，双线写 `remaining`；**禁止 D1-C 式合并两线**。

M0–M5 是内容阶段与产物范围（§4.8），不是执行顺序；扫描、原语、关键字、交互都可并行推进，不必等全部剧本迁完。

| 阶段 | 名称 | 对应内容里程碑 | 主产物 / 开闸点 |
| --- | --- | --- | --- |
| **P0** | 前置清理、规范勘误与 D8-C 风险验证 | — | 文档/账本处置方案、基线重锁、最小 artifacts 白名单、规范勘误、D8-C lane adapter + 并发提交 spike 与独立估算。**2026-10-27 收尾**：前四项已完成并留证；D8-C spike 按 §13 依赖「9←8」改到 P3 骨架之后执行，P0 先交七项门禁清单 / 适配面盘点 / 估算口径，见 [`tde-p0-report.md`](./tde-p0-report.md) §7 |
| **P1** | 范围与来源锁 | M0 | `scan:tde:scope`、`artifacts/migration/tde/scope.json`、`replay-before.json`。**2026-10-27 收尾**：`gate.pass=true`，388 = 352 + 36，三包 283/18/87，20 组 283，8 章，分片 15 片并集 388 无交集，来源锁 43 项；M0 目录骨架已建（3 包 manifest + `shared.js` + 8 章占位，全部 `catalog-only`）。见 [`tde-p1-report.md`](./tde-p1-report.md) |
| **P2** | 机制扫描 | M0 | `scan:tde`、`mechanism-scan.json`、`_review.md`。**2026-10-27 收尾**：38 条机制（7/9/6/11/2/3）+ 1 baseline，388/388 已分类，`gate.pass=true`，来源锁 91 个文件；见 [`tde-p2-report.md`](./tde-p2-report.md) |
| **P3** | 拆分原语 + 双战役骨架 | M0 | `plan:tde:primitives`、`primitive-plan.json`/`primitive-catalog.json`、`campaign-parts` 骨架、合成两 part 夹具。**2026-10-28 批次 1+2+3 收尾**：`new 17/17 done`、100 例原语测试、`deferredPrimitives` 空、`gate.pass=true`；replay 基线因外部提交 `6f60771 修bug` 重采后零漂移 |
| **P4** | 关键词与规则书 | M4 | `confirmations.keywords/rulebook` 证据、规则书条目、`test:tde:rules*`。**2026-10-29 收尾**：关键词 7/7、规则书 17 条全 `verified`，388/388 卡文直达；审计账本 `audit/tde-rules.json`（`gate.pass=true`）；Node 15 例 + 浏览器 4 条；核对官方规则时更正 P3 的 `location.veiled` / `location.doom` 两条口径。见 [`tde-p4-report.md`](./tde-p4-report.md) 与 §13.7 |
| **P5** | 新增交互 + 双战役引擎闭环 | M4 | 四种开局选项（单线 A/B、并行、分选）/ 按线选人 / 切 part（分选）/ 并行双运行时（D8-C）/ 双日志双袋投影 / 座位分线；**先暴露单线，双线留 gate**；桌面 1440 + 移动 390 截图。**2026-10-29 批次 1–3 收尾（批次 3 只到协议层）**：四模式策略、`partGate` + 16 排列、双线条件、非活动线投影脱敏、10 条交互清单定稿、hub 四模式开局与按线准备（单线可开局）、lane adapter 与 D8-C 双运行时容器（双版本/屏障/单文件存档）、分选关卡运行时重建与大厅边界（3 人 2+1 可进入 A1）；Node 41 例。**仍有缺口**：并行管线接线、viewEvents 座位转换、交互 UI 与浏览器证据，见 [`tde-p5-report.md`](./tde-p5-report.md) 与 §13.8–§13.10 |
| **P6** | M1 调查员 | M1 | `content/packs/tdeInvestigators/manifest.js`、5 人逐人验收。**2026-10-29 收尾**：16 个单卡文件（06001–06014 / 06016 / 06017）、9 条 P6 原语、可用性/构筑接线、逐人账本 `audit/tde-investigators.json`（18 条记录、`gate.pass=true`、**verified 3/5**、pending 2 人显式简化）、Node 24 例；replay 零漂移、`test:fast` 3968/0 fail。未做：梦境之门地点（06015a/b）与卢克「事件如同位于连接地点」→ P8；06017 隐私敌人 → P7。见 [`tde-p6-report.md`](./tde-p6-report.md) 与 §13.15 |
| **P7** | M2 玩家卡（4 片） | M2 | `src/cards/entries/<code>.js` × 87、分片/队列报告、逐卡账本 |
| **P8** | M3 剧本 + 幕间/尾声 | M3 | `content/campaigns/theDreamEaters/scenarios/<id>/**`、三幕间、16 段尾声、逐章 12 项检查 |
| **P8-T** | 剧情自译补齐（可与 P3–P8 并行） | M3-C | 14 批自译源 + 术语表 + 来源锁 → `story-text.js`（§8.5） |
| **P9** | 全卡账本与逐章验收 | M3/M4 | `audit/tde-all-card-acceptance.json`、`tde-scenario-acceptance.json`、逐卡 `literalCardBehavior` |
| **P9.5** | 双线开闸 + 多人验收 | M5 前增量 | feature gate、4 人 2+2 / 2 人 1+1 / 3 人分选 2+1 矩阵、16 排列 flow 全覆盖、两条真实全流程、浏览器与回放证据（§1.4.1/§7.5） |
| **P10** | 发布 | M5 | 三组确认 + `gate.pass`、`audit/tde-migration.json`、`playable` + `earlyAccess` |

> P2/P3 在 M0 范围锁定后推进，不计入 M0 的「目录与来源基线」产物范围（规范 §4.8 的 M0 产物清单只有来源锁与目录骨架）。
>
> P3 的骨架不是一次性 spike：历史评估的 9 文件 / 550–850 行可演进为 `campaign-parts.js` 与其测试；34 文件 / 1,900–3,100 行只代表 `pick` 的累计口径。D8-C 必须先经 §7.5.2 P0 spike 独立估算。若骨架判定失败，P10 仍可按 A/B 单线发布（`earlyAccess` + `remaining` 写明双线未实现）。

## 3. P1 第 0 步：范围与来源锁（M0）

- **工具**：新建 `tools/scan-tde-scope.mjs`（照 `scan-tcu-scope.mjs` 改数据源：06 段正则、三包清单、`theDreamEaters/shared.js`、分片草案）。命令：`npm run scan:tde:scope` / `scan:tde:scope:check`。
- **产物**：`artifacts/migration/tde/scope.json`（counts / modes / parts / pairs / packs / faces / encounterGroups / chapters / crossCycleGroups / gatherRefs / shards / sources / baseline / cardImages / pending / gate）、`replay-before.json`；来源 SHA-256 **43 项**（参考实现 38 + 仓内 5）。
- **门禁**（规范 §4.1 + 初勘 §9）：记录 388 全部分区、`main=352` / `faces=36`、三包 283/18/87、20 组唯一且组卡和 = 283、4 个章对各含 A/B 两线、印刷包分布 112/62/41/40/54/47/32、分片两两无交集且并集 388、43 项来源全部存在、`replay-before` 与 golden 逐条一致、`content/registered.js` 未接入（`catalogOnly`）；**范围外卡不得进入本轮**。
- **M0 附加动作**：登记「无主双面卡」归属（`06015a/b` → 调查员包、`06169a/b` → 战役包，账本 `unownedFaces` 门禁）；补 `Beyond the Gates of Sleep` 遭遇牌库证据（参考实现确认无 `gather Set.*`，缺口如实 `pending`）；**P1 实测**图片库存 en/zh 各 388/388（`npm run scan:tde:images` → `reports/image-inventory.json`，原「缺图 387 条」作废）；内容保持 `catalog-only`。
- **P1 收尾（2026-10-27）**：`npm run scan:tde:scope:check` → `scope 复算一致：388 条记录（352 主卡 + 36 面），三包 283/18/87，20 个遭遇组，8 章，43 个来源`，`gate.pass=true`；M0 目录骨架 12 个文件（3 包 manifest、`shared.js`、8 章 `index.js`）全部 `catalog-only`；`test:fast` 无新增失败。详见 [`tde-p1-report.md`](./tde-p1-report.md)。

## 4. P2 第 1 步：机制扫描（M0）

- **工具**：新建 `tools/scan-tde-mechanisms.mjs`。**扫描引擎可整体照抄 TCU 版**（分类/分级/证据文本匹配/门禁计算），但章节表、机制表、规则来源表、watchlist、crossCheck 必须按 TDE 卡面重写。命令：`scan:tde` / `scan:tde:check` / `scan:tde:review`。
- **初勘结论**（**P2 已复算**）：**38 条机制**，`type` 分布 keyword 7 / primitive 9 / rulebook 6 / scenario 11 / interaction 2 / content 3（与初勘完全一致）；覆盖 388/388，未分类 0；分级 mechanism 173 / content 151 / standard 64（初勘 182/156/50，差额集中在调查员专属卡，见 [`tde-p2-report.md`](./tde-p2-report.md) §3.2）；来源锁参考实现 **91 个文件**。另 1 条 baseline（`standardRules`）承接「无新增机制」的卡，不计入 38。
- **关键词三档**（详见 §6）：新增 4 —— `Myriad`（多重，14 卡）、`Swarming X`（蜂拥，初勘 11 敌 / 英文机检 9，M0 复核）、`Veiled`（掩藏，23 地点）、`Researched`（研究完成，3 卡，`06236/06237/06238` 梦境日记）；已有待确认 3 —— `Alert`（5 敌）、`Hidden`（18 卡）、`Bonded`（27 卡）；其余标准关键词（Retaliate/Hunter/Aloof/Massive/Peril/Surge/Victory/Fast/Permanent/Uses/Doom/Parley/Prey）直接复用现有读点。
- **战役级机制**（必须全部落条目）：四模式 `singleA`/`singleB`/`pick`/`parallel`、每座位一套牌组、房间座位到线内连续座位的映射、55 键记录的部分隔离与跨部分双写/勾销、两袋混乱袋与跨部分增删换、逐章对 gate（4 个二元先手选择）、序章 + 3 幕间、16 段结局矩阵、剧情支援入队/离场、成就（默认 out-of-scope，待确认）。`officialFull` 的第二套牌与整桌切换仅记来源事实，不进入本轮待实现机制。
- **门禁**（规范 §4.2）：本轮范围内每张卡至少出现在一个机制条目；未分类卡为 0；`type=primitive` 条目全部进入下一步；未知机制默认**阻断**，不得用近似卡文静默过关。watchlist 需明确排除误判（如 `Patrol`/`Seal`/`Explore`/`Supply` 在 TDE 只是文本提及）。
- **P2 收尾（2026-10-27）**：`npm run scan:tde:check` 复算一致、`gate.pass=true`——388/388 已分类、38 条机制（7/9/6/11/2/3）+ 1 baseline、20/20 遭遇组有卡、`scopeConsistent=true`、6 个 absent 词 0 命中；关键词实测 Myriad 14 / Swarming 11 敌 / Veiled 23 地点 / Researched 3 / Alert 5 / Hidden 18 / Bonded 27；逐卡复核清单 `_review.md` 已生成。详见 [`tde-p2-report.md`](./tde-p2-report.md)。

## 5. P3 第 2 步：拆分原语（M0，含双战役骨架）

> **分批口径（2026-10-27）**：P3 拆成三批，避免一次性把 21+ 条原语压在一个批次里。
> **批次 1（双战役骨架，已完成）**：`campaignPart` / `recordInPart` / `seatPartMap` / `chaosBag.multiPart` / `inPart` / `partFlowCondition` —— 落点 [`src/campaign/campaign-parts.js`](../src/campaign/campaign-parts.js)，账本 `primitive-plan.json` 的 `batch: "P3-1"`，21 例 Node 测试 + 13 局 replay 零漂移。
> **批次 2（高风险机制原语，已完成 2026-10-27）**：`enemy.swarmingValue` / `swarm.placeCards` / `location.veiled` / `tokenBag` / `counter.investigator` / `location.verticalChain` —— 落点 `src/engine/{swarming,swarm,veiled,token-bag,counters,vertical-chain}.js`，经 `scenario-runtime-extras.js` 挂到 `scenarioRuntime`；账本 `batch: "P3-1+2"`、`new 12/12 done`、46 例 Node 测试。真实引擎接线（蜂拥实体、调查拦截、infestation test、布局）属 P8/P5。
> **批次 3（其余候选，已完成 2026-10-28）**：`location.placeBondedLocation` / `campaign.epilogueMatrix` / `deck.myriadLimit` / `location.doom` / `scenario.markerCount` —— 落点 `src/engine/{bonded-location,myriad,location-doom,marker-count}.js` + `src/campaign/epilogue-matrix.js`；账本 `batch: "P3-1+2+3"`、`new 17/17 done`、`deferredPrimitives` 空、33 例测试。
> **P4 复核更正（2026-10-29）**：`location.veiled` 与 `location.doom` 两条原语按官方规则更正（掩藏地点是「已揭示面入场 + 无线索时 [fast] 翻面」，地点上的毁灭**不是**「毁灭地点」）；删除 5 个错误导出、测试重写、账本重算，详见 [`tde-p4-report.md`](./tde-p4-report.md) §4 与 §13.7。
> 每批都跑同一套 `plan:tde:primitives` / `audit:tde:primitives --check` 门禁；未落地的条目必须留在 `tools/tde-primitive-spec.mjs` 的 `DEFERRED_PRIMITIVES` 与账本里，不能悄悄消失。

### 5.1 先做高风险 7 项（其余按章排）

| # | 原语 | 用途 / 风险 | 候选 API |
| ---: | --- | --- | --- |
| 1 | `campaignPart`（set/read） | `pick` 双 part 切换；决定当前章对结构 | `campaign.setPart(part)` |
| 2 | `campaign.recordInPart`（record/read/crossOut） | 55 键记录按 part 隔离 + 幕间跨线写入 | `campaign.record({part,key})` |
| 3 | `campaign.seatPartMap` | 房间座位映射到 part 与线内连续座位；保证现有 `investigators[seat]` 读点成立 | `campaign.seatMap(seatParts)` |
| 4 | `enemy.swarmingValue` + `swarm.placeCards` | Swarming X：蜂拥卡放牌库顶/随头领移动交战/清空才可击败/溢出伤害 | `enemy.swarming(host)`、`swarm.placeCards(host,n,{source})` |
| 5 | `location.veiled`（declare/flip） | 掩藏地点翻面触发背面故事卡、记录门控 | `location.canFlip/flip` |
| 6 | `tokenBag`（create/reveal/add/return） | 蛛群滋生袋：独立 token 袋，与混乱袋语义不同 | `tokenBag.create/reveal/add` |
| 7 | `counter.investigator`（add/remove/max） | 警报等级（0–5+）、赏金；先判定能否泛化现有 token | `tokens.add/count({counterId})` |

### 5.2 其余候选（21 新增 + 1 复用，摘要）

`campaign.epilogueMatrix`（16 段结局矩阵）、`chaosBag.multiPart`（两袋增删换）、`location.placeBondedLocation`（梦境之门）、`deck.myriadLimit`（同名至多 3 张，构筑期）、`window.afterDeckSearch`（曼蒂）、`window.afterAlarmRaised`、`scenario.markerCount`（神迹/桥梁进度）、`location.doom`（地点毁灭 + agenda 阈值）、`attach.facedown`（面朝下附属）、`api.bonded.swap`（绑定换面）、`location.verticalChain`（阶梯/大网纵向链）、`investigator.extraRestrictedAction`、`window.replaceUpkeepDraw`（派翠丝）；复用项：`campaign.awardStoryCard`（剧情支援）。完整 22 条及参数见初勘 `recon/mechanism/mechanism-draft.json` 的 `primitiveCandidates[]`。

### 5.3 escape 逃生口（3 条，必须登记理由）

| 卡号 | 名称 | 理由 |
| --- | --- | --- |
| 06164 | 飘渺灵体 | 「无形」全新状态位（不能交战/攻击/伤害），只服务 1 张卡；若 M2 出现同类再提升为通用条件 |
| 06329 | 闪耀的偏方三八面体 | 费用替代管线的一次性特例（支付法术费用改为 willpower 检定） |
| 06331 | 梦境寄生物 | 技能图标为负 + 手牌强制投入；若本轮决定做「负图标」通用原语则移出 escape |

### 5.4 五件套与门禁

每个新原语必须同时具备：① 通用实现（按所属层）；② 注册期校验；③ Node 单测（正常、无合法目标、费用不足、存档往返）；④ 文档条目（`primitive-plan.json` 的 `docs` 字段，稳定后补 `docs/card-entry-files.md`）；⑤ 对既有卡 replay 零变化。门禁：`plan:tde:primitives` / `audit:tde:primitives` 全绿、`reuse` 引用可查、`escape` 只含单卡逻辑、`engine.js` 无 06 卡号分支、`test:fast` 无新增失败。**原语账本的 `files` 必须包含 8 篇卫星文档，文档缺失会让原语全部变 pending（TCU 踩过的坑）。**

### 5.5 双战役骨架（P3 交付，决策点 D1）

- P3 不做一次性 spike，而是交付可演进的骨架：`campaign-parts` 切片/切换/`inPart`、双袋/双记录、`seatParts` 与房间座位↔线内连续座位映射、JSON 往返、旧 13 局零漂移。每座位仍只有一套牌组。
- 骨架必须用**合成两 part 战役**覆盖：A1→B1→A2 切换、两袋独立、跨线记录、`seatParts` 分线（2+2 与 2+1）、非连续房间座位重编号、存档恢复；不依赖 TDE 8 章内容。
- 通过后 D1 默认“骨架保留、双线后开”；失败则只保留单线发布，并在 `remaining` 写明双线未实现。
- 评估数字见 §7.3：骨架 9 文件 / 550–850 行 / 12–15 例；后续 P5+P8 增量合计到 34 文件 / 1,900–3,100 行。
- **P3 批次 1 收尾（2026-10-27）**：`src/campaign/campaign-parts.js`（约 300 行，8 个导出面）+ `tools/tde-primitive-spec.mjs` + `tools/audit-tde-primitives.mjs`；
  账本 `artifacts/migration/tde/primitive-plan.json` 的 `batch: "P3-1"`：**new 6/6 done、reuse 2、escape 3、deferred 11、gate.pass=true**（含 `replayZeroDrift` 13 局逐条一致与 `engineBoundary` 零 06 卡号/零战役名）。
  `tests/tde-campaign-parts.test.mjs` **21 例**覆盖切 part、跨线记录/勾销、2+2 与 2+1 与非连续座位、两袋、`inPart` 还原、JSON 往返、模式校验。
  **schema 仍为 7**：`parts` 是可选字段，`stateHash` 含 `schemaVersion`，现在升 8 会让既有 13 局指纹全变；schema 7→8 与 save-migration 推迟到 P5（TDE 真正产生存档时），与 §12 R12 一致。
  未接线：`campaign-flow` 消费 `partFlowCondition`、`campaignView` 按 part 脱敏、hub 接 `validateModeSeats`、运行时座位重建（lane adapter）都在 P5。

## 6. P4 第 3 步：关键词与规则书（M4）

- **新增 4 个关键词**（每项需：来源卡号、引擎行为、Node 验收、规则书条目、卡文直达）：

| 关键词 | 中文 | 印刷卡数 | 代表卡 | 引擎缺口 |
| --- | --- | ---: | --- | --- |
| `Myriad` | 多重 | 14 | 06020 庄严立誓、06021 一瓣缟玛瑙、06245 希望微光 | 构筑期同名至多 3 张；`deck.myriadLimit` |
| `Swarming X` | 蜂拥 X | 11 敌（初勘；英文机检 9，M0 复核口径） | 06102 蛛群、06145 乌撒之猫、06228 土星猫 | 蜂拥实体、蜂拥卡区域、溢出伤害、清空才可击败 |
| `Veiled` | 掩藏 | 23 地点 | 06127 乌撒、06143 地图未见之城（06143b「凶星」是其背面故事卡）、06262–06265 漆黑之海（另 06254/06257/06258/06261 为同章 Veiled 地点） | 未揭示翻面、背面故事卡、记录门控 |
| `Researched` | 研究完成 | 3 | 06236/06237/06238 梦境日记 | 记录键门控的卡牌升级 |

- **需在本循环确认的既有 3 项**：`Alert`（5 敌；与 Swarming/Massive 组合的失败分支）、`Hidden`（18 卡；敌人形态的「隐藏在手牌」与威胁区语义差异）、`Bonded`（27 卡；场外/在场交换、地点绑定卡；~~规则条目先复用 `tcuBonded`~~ **P4 改判：新立 `tdeBonded`，见 D5**）。
- **规则书条目建议 16 条新增**：`tdeCampaign`（双战役/两套牌组/记录/结局矩阵）、`tdeDreamQuest`、`tdeWebOfDreams`、`tdeChaos`（两袋与逐章符号表）、`tdeRecords`、`tdeEpilogue`、`tdeMyriad`、`tdeSwarming`、`tdeVeiled`、`tdeResearched`、`tdeDreamGate`、`tdeInfestationBag`、`tdeAlarmLevel`、`tdeSignsOfTheGods`、`tdeStoryAssets`、`tdeLocationDoom`；`alert`/`hidden`/`parley` 复用核心条目。**P4 实际 17 条**（+`tdeBonded`）。
- **剧情来源缺口（已决策：自译补齐，D2 / 2026-10-27）**：zh locale 没有序章/幕间/结局矩阵正文、关键词解释与附加规则文本。决定采用「自译（非官方中文）」补齐：en 源锁定 SHA-256、术语表基线、14 批翻译与审校，`storyText` 可按批次 `verified`，但审计账本必须标注自译来源，不得写成官方中文。工作量与批次见 §8.5。
- 门禁（规范 §6/§7）：新增关键词与规则条目全部 `verified`（5 项 / 6 项检查）；规则书桌面/移动端浏览器用例通过；未确认关键词不得在卡牌文件使用。

**P4 收尾（2026-10-29）**：`npm run audit:tde:rules` 复算一致、`gate.pass=true`——

| 项 | 实测 |
| --- | --- |
| 关键词 | **7/7 verified**（5 项检查逐条通过）；`deferred` 显式列出未接线语义（敌人形态隐私、蜂拥实体、翻面动作、梦境日记记录键等） |
| 规则书 | **17 条 verified**（6 项检查通过：战役总览、8 章机制、关键词条目、388 张卡文直达、桌面/移动浏览器） |
| 卡文直达 | 388/388 张 06 卡连到 `tdeCampaign`，外循环链接 0；关键词判据逐张对齐 |
| Node | `tests/tde-rules.test.mjs` **15 例 / 0 失败**（含 6 组引擎行为：多重、蜂拥、掩藏、研究完成、绑定、警报/蛛群袋/地点毁灭/神迹/结局矩阵） |
| 浏览器 | `tests/tde-rules.browser.mjs` 4 条（1440×950 与 390×844 各 2 条），截图 `artifacts/tde-migration/p4-rulebook-{desktop,mobile}.png`；账本 `audit/tde-browser-acceptance.json` 由 runner 生成 |
| 机制登记 | 11 个 `tde*` 能力项；6 条战役层条目**不登记**（P5/P8） |
| **P3 口径更正** | `location.veiled`（掩藏 = 已揭示 + 无线索时 [fast] 翻面，不是「翻面前不可调查」）与 `location.doom`（地点上的毁灭 ≠ 毁灭地点）与官方规则冲突，已改实现/测试/文档并重算原语账本（`new 17/17 done`、`gate.pass=true`） |
| 副作用 | 外部提交 `42aa746` 让原语账本 stale（`scenario-runtime` 键数 190→241），P4 重算吸收；`suites.mjs` 新增测试后按 remedy 重算 TCU 账本 |

逐项证据见 [`tde-p4-report.md`](./tde-p4-report.md) 与 [`tde-rules.md`](./tde-rules.md)。

## 7. P5 第 4 步：新增交互与双战役架构（D1 重排）

> **批次口径（2026-10-29）**：P5 按三批推进，避免把「策略/流程/投影」与「hub UI/lane adapter/双运行时」混在一个批次。
> **批次 1（已完成）**：四模式策略（`campaign-modes.js`）、章对门与 16 排列（`part-flow.js` + `partGate`）、双线条件、非活动线投影脱敏、10 条交互清单定稿；Node 14 例。见 [`tde-p5-report.md`](./tde-p5-report.md) §1–§7 与 §13.8。
> **批次 2（已完成）**：hub 四模式开局与座位分线（`hubSetMode`/`hubSetSeatPart` + 置灰原因）、模式化清单读点、按线选人与按线牌组（非活动线 record 落 `parts[line]`）、跨线重复选人校验；单线可真正开局，分选/并行在 `hubBeginScenario` 由批次 3 gate 挡住；Node 5 例。见 §13.9。
> **批次 3（机制闭环完成）**：`lane-adapter.js` / `dual-runtime.js` 协议层（15 例）+ `lane-runtime.js` 分选运行时重建与大厅边界（7 例）+ `parallel-runtime.js` 并行管线（9 例：开闸/路由/观察/存档/屏障/闭闸拒绝）+ 开局模式面板（5 例）与浏览器证据（2 条用例、4 张截图，`audit/tde-ui-browser.json`）。**开闸按战役**：只有 manifest 置 `dualLineGate: "open"` 的战役能启动并行（演示战役已开；真实 TDE 等 P8/P9.5）。见 §13.10–§13.13。

### 7.1 交互工作项清单（初判 10 条，P5 批次 1 已定稿进 [`interactions.js`](../content/campaigns/theDreamEaters/interactions.js)）

| # | 交互 | 场景 | 备注 |
| ---: | --- | --- | --- |
| 1 | 选择玩法（单线 A / 单线 B / 并行双线 / 分选双线） | 序章 | `campaignOption.variant`；奇数人数时「并行双线」置灰并给原因（§1.4.1） |
| 2 | 按线选人 / 选牌组（每位玩家一套） | 序章 | 按 `campaign.seatParts` 只走一次选人/选牌组；跨线重复选人校验保留；未分到线或牌组非法时阻塞开局并给原因 |
| 3 | 蜂拥卡面板 | Swarming X 敌人 | 蜂拥卡数量/来源/溢出伤害选择；桌面 & 移动 |
| 4 | 蛛群滋生袋 | B1 Waking Nightmare | 独立 token 袋揭示、可取消放回 |
| 5 | 警报等级 | A3 Dark Side | 0–5 值显示与增减 |
| 6 | 隐藏手牌 | Hidden 遭遇/敌人 | 座位私有投影；敌人手牌形态的攻击/躲避入口 |
| 7 | 掩藏地点翻面 | A2 Search / B3 Point of No Return | 背面故事卡、萨尔纳斯记录门控 |
| 8 | 神迹/桥梁进度计数 | A2 / B1 / B3 | 参考卡旁计数显示 |
| 9 | 大网/神秘阶梯纵向堆叠 | B4 / B2 | 动态位置必须复用既有布局变量 |
| 10 | 梦境之门与 16 段结局矩阵 | 通用 / 尾声 | 结局矩阵按 8 条记录（A4/B4 各 4）选 1/16 段，不得提前泄露 |

- **清单定稿（P5 批次 1）**：10 条逐条登记 `trigger / scenarioIds / mechanismIds / hook / milestone / status / blockers`；`ui:modeSelection` 与 `ui:laneDeckSelection` 两条 P2 机制被清单覆盖（`validateInteractionInventory` 校验）。**全部 `pending`**，`blocked` 原因写在各条 `blockers` 里；`verified` 需要真实 UI 路径 + 桌面/移动截图，最早批次 2。
- 机制扫描里 `type=interaction` 只登记 2 条（开局四选项选择、按线选人/选牌组）；其余 8 条来自场景机制与战役结构，已在批次 1 定稿，不得在卡牌批次里边写卡边临时拼面板。
- Partial Campaign 的起手场景必须映射到 part（06039/06119/06206/06286 → A；06063/06168/06247/06333 → B）；映射不到就回退 A1/B1，不允许用双线默认袋启动。
- **每个座位只选一次人/牌组**（§1.4.1）：分选切 part 时该线座位沿用已选角色，另一线座位转 waiting，不需要「第二次选人」，也不需要并发双面板；只有未来追加整桌双线（每人两套）时才需要两轮 setup（§7.4）。
- 复用 `web/` 现有组件、CSS 变量与交互模式；交互状态由服务端 `requestChoice` / `presentation-state` / 观察投影产生，浏览器只提交 `legalMoves` 中的动作；私有候选、手牌、牌库顺序不得进入其他座位投影。
- 门禁（规范 §4.5）：桌面 1440×900 与移动 390×844 各至少一条真实操作路径 + 截图；无卡号 UI 分支；新增颜色/字号/间距来自既有 token；隐私投影断言通过。

### 7.2 双战役架构（TDE 特有）

#### 7.2.1 参考实现事实（2026-10-27 代码复核）

- 一个 campaign id `06`，不是两个 campaign；参考实现使用 `CampaignPart = TheDreamQuest | TheWebOfDreams`、`CampaignMode = PartialMode part | FullMode`（`Campaigns/TheDreamEaters/Meta.hs:20-44`）；后者在本文只映射为来源事实 `officialFull`，不作为产品枚举。
- 活动线用主字段，非活动线整体快照进 `otherCampaignAttrs`；共享 `completedSteps` + 当前 `step`，逐线持有 log/decks/chaosBag/XP/storyCards。
- 切 part 五步：保存当前 attrs（`campaignMeta = Null`，防递归）→ 载入目标 attrs → 带过 `completedSteps`/`step` → 交换 `current/otherCampaignPlayers` → 对每个玩家 `SetInvestigator`；首次进入某线时 `ClearInvestigators` 并重新选牌组（`Campaign/Campaigns/TheDreamEaters.hs:63-104,321-385`）。
- 配对屏障在 `nextStep`：A1 完成后若 B1 未完成则强制 B1，反之亦然；A2/B2、A3/B3、A4/B4 同理；每对都完成才进幕间（`Campaign/Campaigns/TheDreamEaters.hs:126-196`）。
- 幕间 I/II/III 是多子步骤状态机（`InterludeStepPart`），`normalizedCampaignStep` 归一成 `InterludeStep`（`CampaignStep.hs:137-148`）；跨线效果用 `record`/`recordInBoth`/`getHasRecord part` 与 `InTheDreamQuest`/`InTheWebOfDreams` 标签消息（`Campaign/Campaigns/TheDreamEaters.hs:404-735,833-844`）。
- 结局：单线直接 `GameOver`；来源实现的 `officialFull` 用 A4 的 4 种结果 × B4 的 4 种结果 = 16 段尾声（`Campaign/Campaigns/TheDreamEaters.hs:736-813`），本产品 `pick`/`parallel` 复用该矩阵。

#### 7.2.2 本引擎映射（活动线占主字段）

沿用参考实现的“活动线占主字段 + 另一线快照”，不把 194 处 `campaign.records` 读点和 75 处 `state.chaosBag` 读点改成嵌套读法：

```js
campaign.mode = 'singleA' | 'singleB' | 'parallel' | 'pick'
campaign.seatParts = ['A', 'B', 'A', 'B']   // 座位 → 线；单线时全 A 或全 B
campaign.activeParts = ['A', 'B']            // 并行两条；分选/单线只有一条
campaign.currentPart = 'A' | 'B' | null      // 分选/单线的当前线；并行下为 null
campaign.parts = {
  // 只存非活动线；示例为 A 非活动、B 活动。
  // 并行模式（D8-C）下两条线同时活动，容器状态见 §7.5.2：shared + lanes.A/B。
  // 活动线继续使用顶层 campaign.records / campaign.investigators /
  // campaign.trauma / campaign.xp / campaign.victory / state.chaosBag
  A: { records, chaosBag, investigators, retired, trauma, xp, victory, storySections },
}
```

- **两套座位 id，禁止混用**：`seatParts` 的下标是大厅房间座位（`roomSeat`，0–3）；引擎运行时继续只接收线内连续座位（`laneSeat`，0–该线人数−1）。例如 `seatParts=['A','B','A','B']` 时，A 线 `room 0→lane 0`、`room 2→lane 1`，B 线 `room 1→lane 0`、`room 3→lane 1`。映射由 `seatParts` 在建局/读档时确定性派生，不重复持久化第二份真相。
- **映射边界**：大厅命令的 `roomSeat` 在进入 lane adapter 前转成 `laneSeat`；引擎产生的 `currentSeat`、`pendingChoice.seat(s)`、`humanSeats`、`leadSeat`、调查员/牌组记录与事件 seat 在离开 adapter 时转回 `roomSeat`。`state.investigators` 与 `campaign.investigators` 在线内始终是无洞的密集数组，禁止用房间座位直接索引。
- **人数缩放**：每条线的 `numInvestigators`、线索/生命缩放、遭遇结算与 AI 参与人数只按该线的 `laneSeat` 数计算；等待中的另一线座位不得以空槽或占位调查员进入运行时。
- **共享**：`campaign.scenarioResults`、`campaign.flow`（节点带 part 标记）、`campaign.ending`、lead/seat 信息。
- **逐线**：`records`、`chaosBag`、`campaign.investigators`（每座位一条 campaign record）、`retired`、`trauma`、`xp`、`victory`、`storySections`。
- **单线 / 分选**：`singleA`/`singleB` 只有一条活动线、`parts` 为空；`pick` 两条线都有座位但同一时刻只有一条活动，非活动线进 `parts` 快照，切 part 复用 §7.2.1 的五步。三种形态共用同一套 `partRecord`/`inPart`/`partChaosBag` 读写函数，不做两套代码。**并行**见 §7.5。
- **运行时**：单线与分选下 `state.investigators` 只装当前线；切 part 后由当前线的 campaign records 在下一场 setup 重建，不保存运行时手牌/场面。并行（D8-C）下改由 `lanes.A/B` 各持一份完整运行时，本条的“只装当前线”不适用。
- **跨线**：新增 `partRecord(campaign, part, key)` / `recordInPart` / `partChaosBag` / `inPart(campaign, part, fn)`；`inPart` 只把 records/chaosBag 的**数据作用域**绑到目标线，不换 `state.investigators`/`currentPart`；真正的切 part 只在关间/幕间边界（分选只替换该线座位，另一线座位转 waiting）。这样关内效果可以写另一线记录/袋，但不会把关内状态串到另一线。
- **记录隔离**：`campaign.records` 只反映活动线；幕间跨线写入必须走 `recordInPart`，读取走 `partRecord`；`campaignView` 同时脱敏活动线与 `parts` 的非活动线。共享协调状态与 lane runtime 不得各保存一份同名权威字段：章内记录/袋/XP/创伤只在线内，章对完成、幕间幂等标记与最终结局只在共享层。
- **私密剧情**：若 TDE 章节写 `campaign.privateStories`，该字段也必须按 part 切片（8 键评估未计；TDE 当前无此写入时可不加，加入时按第 9 键处理）。
- **其他跨关记账**：`state.abilityLimits` 的 `|campaign` 键、每战役一次的统计/UI 记账等默认是全局；双线模式需要按线独立的，必须在 key 上加 part 前缀或并入 `parts` 切片。M0/P5 用 grep 清单逐项确认，不能只按 8 键机械切片。
- **混乱袋**：`state.chaosBag` 是活动线；切 part 时与 `parts[part].chaosBag` 互换；两袋同时增删用 `mutateBothBags`（`AddChaosToken` 的跨线等价物）。封存 token 若跨关保留，再并入切片；默认关末归还，不进切片。
- **配对屏障**：`campaign.flow` 的 `scenario` 节点出边不直接写死下一章，而是先过 `pairGate(A1/B1)` 一类 branch 节点；条件读 `scenarioResults`（共享），保证“同对两章都完成才进幕间”。
- **幕间**：`content/campaigns/theDreamEaters/interludes.js` 提供 I/II/III 的节点与效果；输出 A/B 各自 `storySections` 与跨线 records/bag 变更；`pick`/`parallel` 挂 II/III，A/B 单线只挂 I 的对应分支。
- **结局**：`endings` 不能只按单条 record 匹配；`pick`/`parallel` 用 `epilogueMatrix` 由 A4/B4 两线记录选 1/16，单线用各自终章结果直接结束。

#### 7.2.3 实现工作包（顺序固定）

| WP | 内容 | 主要文件 | 依赖 | 验收 |
| --- | --- | --- | --- | --- |
| WP-1 模型 | `campaign-parts.js`：切片/切换/`inPart`/`partRecord`/`partChaosBag`、`roomSeat↔laneSeat` 映射；schema 7→8 | `src/campaign/campaign-parts.js`、`src/engine/rules-state.js`、`src/engine/save-migration.js` | P2 | JSON 往返、非连续房间座位映射、13 局零漂移、非 TDE no-op |
| WP-2 流程 | 配对屏障、part 条件、幕间节点 | `src/engine/campaign-flow.js`、`content/campaigns/theDreamEaters/{manifest,parts,dual-flow,interludes}.js` | WP-1 | 合成两 part 战役 A1→B1→A2→…、16 排列 flow 全覆盖 |
| WP-3 结算 | 逐线 records/bag/XP/trauma/victory、跨线写入、双日志投影 | `src/campaign/campaign-effects.js`、`src/campaign/campaign.js`、`src/cards/campaign-view.js` | WP-1 | 跨线记录/袋变更、`campaignView` 隐私断言 |
| WP-4 座位/牌组 | 四个开局选项、`seatParts` 分线、按线各选一次人/牌组、`roomSeat↔laneSeat` 边界转换、切 part（分选）、奇数禁并行校验 | `src/engine/hub.js`、`src/engine/dispatch.js`、`src/engine/table-decisions.js`、`src/campaign/campaign-parts.js`、`web/hub.js` | WP-1、WP-3 | 2/3/4 人 × 四种模式的开局矩阵；非连续座位可行动；奇数时并行置灰给原因；缺牌组阻塞而非待机 |
| WP-5 投影/AI | 当前线上下文、双线日志/袋 tab、线别徽标、AI 当前线 | `src/integration/observation.js`、`src/ai/ai-context.js`、`web/{hub,situation-view,story-reader}.js` | WP-3、WP-4 | 桌面 1440 / 移动 390；他席与另一线牌组不泄露 |
| WP-6 内容 | 8 章 part 标注、三幕间、16 尾声、跨线效果 | `content/campaigns/theDreamEaters/**` | WP-2；同对 A/B 章先行 | 逐章 12 项 + 全卡账本 |
| WP-7 验收 | 双线 gate、多人矩阵、回放/浏览器 | `tools/replay-games.mjs`、`tests/tde-*.test.mjs`、browser spec | WP-4、WP-5、WP-6 | 2+2 / 1+1 / 2+1、16 排列、存档/回放、`gate.pass` |

| WP-8 双运行时（D8-C） | `shared` + `lanes.A/B` 容器、lane adapter、全局提交序列 + 线内版本、事件线别、按线投影/checkpoint、单文件存档串行化、schema 迁移 | `index.js`、`src/integration/{observation,hall-integration,choice-batch}.js`、`src/ai/*`、`src/engine/{setup,rules-state,save-migration}.js`、`lib/server.js` | WP-1、WP-4 | 2+2 非连续座位不串线；跨线并发提交不丢更新；自动幕间只触发一次；事件/演出不泄露；两线 AI 并存不死锁 |

> 排期映射：WP-1/2 在 P3 起、P5 收口；WP-3/4/5 在 P5；WP-6 在 P8；WP-7/WP-8 在 P9.5（WP-8 从 P5 开始搭骨架）。WP-6 不依赖 WP-4 完成，但双线开闸依赖 WP-4/5/8；单线可在 WP-6 的同对章节完成后先 `development`，全部章节确认后再 `playable`。

#### 7.2.4 决策 D1（2026-10-27 重排）

| 方案 | 内容 | 结论 |
| --- | --- | --- |
| **D1-A 起步（推荐）** | P3 落双 part 骨架；P5 通单线闭环（内容 P8 接入后开放）；P8 补双线内容；P9.5 开闸 | 架构不返工；最坏情况退回“单线可玩 + 双线 remaining” |
| **D1-B 同期开闸** | 骨架 + 双线内容 + 多人验收都在 M5 前完成，P8 后即开闸，不等 P9.5 | 完整体验；排期最长，需分线牌组/16 排列与尾声/联机一起验收 |
| **D1-C 禁止** | 合并两线记录/两袋/两套牌组 | 改变卡面结算；只能写 `remaining`，不得静默发布 |

推荐口径：**走 D1-A 的节奏、交付 D1-B 的终点**。即“先让 A/B 单线真实可玩，但双 part 数据模型从第一天就在”，最后按 D1-B 的完整范围开闸；避免当前路线“先单战役、后补双线”的 34 文件返工。

### 7.3 双 part + `pick` 的历史改动量实测（2026-10-27，非 D8-C 总报价）

> 口径：本节数字只覆盖 **双 part 骨架 + `pick`**（单运行时、切线），是采用四模式口径前留下的历史评估。`parallel` 的 D8-C 还需另计 lane adapter、房间/线内座位映射、全局提交序列、事件投影与单文件存档串行化（§7.5.2 / WP-8）。**这些数字不得出现在摘要、排期承诺或 D8-C 开闸估算中；P0 完成 WP-8 spike 后新增独立的 D8-C 估算表。**

评估产物：`artifacts/migration/tde/recon/fullmode/impact.md`（482 行，每个改动点带文件:行号）。**核心结论：可行，且不需要把 194 处 `campaign.records` 读点、75 处 `state.chaosBag` 读点改成嵌套读法**——沿用参考实现的「活动线占主字段 + 另一线快照」：活动线继续用 `state.investigators` / `campaign.records` / `campaign.investigators` / `state.chaosBag`，非活动线快照进新增的 `campaign.parts`。

- 当时评估的状态字段只有 **3 个**：`campaign.mode`（旧枚举 partial-A / partial-B / full）、`campaign.currentPart`、`campaign.parts[]`。该枚举已被 `singleA/singleB/pick/parallel` 取代，且未包含 `seatParts`、lane adapter 与 D8-C 容器；因此下表只可用于 `pick` 的相对量级比较。未声明 `parts` 的战役仍必须保持状态字节不变，既有 13 局 / 786 步 / 799 指纹零漂移。

三档累计口径（近似 ±25%，不含 8 章内容迁移）：

| 口径 | 改动/新增源码文件 | 源码行数 | 新增测试 | 阶段 | 相对锚点（TCU 实测） |
| --- | ---: | ---: | ---: | ---: | --- |
| 最小骨架（P3 交付，保留） | 9（1 新 + 8 改） | 550–850 | 12–15 例 | P3 | ≈ TCU 14 原语的 15–20% |
| **`pick` 最小可用（P3+P5+P8 累计）** | **34（6 新 + 28 改）** | **1,900–3,100** | **54–71 例** | P3/P5/P8 | ≈ TCU P3 的 0.5–0.7× + P5 的 0.4–0.6× |
| 完整（联机/审计/结局矩阵/迁移/浏览器） | 42（7 新 + 35 改） | 2,300–3,500 | 68–92 例 + 2 browser spec | P3–P9.5 | — |

> 三行是 `pick` 的累计口径，不是三次独立改造；不含 WP-8。D8-C 的文件、行数、测试数在 P0 spike 前记为 **TBD**，不得用“完整 42 文件 / 2,300–3,500 行”代替。

- 历史评估中的 `fullmode-*` 文件名统一改为中性名称 `dual-flow.js` / `dual-story.js` / `dual-effects.js`；`hub` 不做第二轮选人/选牌组，每个房间座位只在所属线建立一条 campaign record。跨线重复调查员校验读取两线已选集合，但不要求第二套牌。
- `pick` 门禁要点：① 未声明 `parts` 的战役状态字节不变，保留迁移前 baseline 并用 `--compare` 证明 13 局 hashes 逐条一致；② schema 7→8 只升结构版本、规则版本保持 `n6.0`，旧档迁移对非 TDE no-op；③ `campaignView` 同时按 part 与 room seat 脱敏；④ 切 part 只发生在关间边界，关内无跨线运行时切换；⑤ `state.investigators`/`campaign.investigators` 使用连续 `laneSeat`，所有大厅边界恢复 `roomSeat`。
- 若双线开闸失败（只保留 A/B）：A/B 单线两个 4 章战役可完整交付，唯一通用引擎缺口是「按线基础袋」约 **40–90 行**（`campaign-effects` + `chaos-bag` 同区域，且双线模式也要用）；发布按 `playable + earlyAccess + remaining`，`confirmations.interactions` 增加 `pending` 的 `dualCampaign` 项。
- 主要残余风险：切片字段漏存（用显式 `PART_SCOPED_CAMPAIGN_FIELDS` 常量 + 启动期断言）、投影泄露（先写失败用例）、16 种交错路径（全部跑轻量 gate 测试，2 条跑真实全流程）、schema 8 迁移影响全部存档（no-op 化 + 双向前后测试）、16 段结局矩阵正文依赖 §8.5 自译。

### 7.4 `officialFull` 整桌双线语义（仅历史事实，已退出本轮范围）

> **口径变更（2026-10-27）**：本节描述的是「整桌切换、每人 A/B 各一套、4 人 8 套」的 `officialFull`。开局四种玩法（§1.4.1）不包含它；本节仅在将来追加“整桌双线”第五选项时作为来源依据，当前并行/分选的多人语义见 §1.4.1 与 §7.5。

- **不是 2+2 分桌**：4 个座位全程在同一局；每个座位在 A/B 各一名调查员，4 人 = 8 名调查员 / 8 套牌组（1–3 人同理，n 人 = 2n 名调查员）。每场场景仍是同一批玩家同时玩，只是整桌换成对应半区的调查员。
- **整桌原子切换**：切 part 后 `state.investigators` 对 4 个座位一起替换/重建；禁止“两个人先切、两个人等”。`campaign.currentPart` 是全局唯一值。
- **第二套牌是硬门槛**：每条线第一次进入前（先手 A1 或 B1），4 个座位都必须有该线 campaign record + 合法牌组；缺一套就阻塞开局并给出明确原因，不允许静默把该座位当替补/观战。
- **选人不得跨线重复**：`replacementCandidates`/hub 选人必须把另一条线的 `investigators` + `retired` 一起算进 used 集合；同一调查员不能同时出现在 A/B。
- **投影隔离**：`campaignView` 对活动线只显示自己的牌组；`parts[other]` 内他席牌组、手牌、牌库顺序全部脱敏；双线日志/袋按 tab 显示，不默认泄露另一线未到达分支。
- **AI 座位**：每个 AI 座位也要两条线各一套；AI 上下文只读 `currentPart`，不能基于另一线未到达信息决策；第二套牌由自动构筑补齐。人类座位缺第二套牌时阻塞并提示，不静默代选。
- **Solo 多手**：`playerCount=4` + `Solo` 仍按 4 个座位计，只是同一人操作 4 套；两线切换同样整桌替换，不因“单人”合并成一套。
- **中途加入/离开**：`officialFull` 不允许“临时补位到另一条线”；加入流程只处理当前线座位。若座位永久离开，按 campaign replacement 规则在当前线替换；另一线保留其 record，待该线开始时再按加入/replacement 流程处理。
- **验收矩阵**：4 人 × 2 线 × {A1 先 / B1 先} × {存 / 读} 至少覆盖：
  - A1→B1→A2→B2→A3→B3→A4→B4；
  - B1→A1→B2→A2→B3→A3→B4→A4；
  - 两次幕间换线（Interlude 1 后先 B2、Interlude 2 后先 A3 等）。
  16 排列全部跑轻量 flow/gate 单测；另选上述 2 条做真实全流程与存/读验收。

### 7.5 并行双线：三种实现形态（决策 D8：2026-10-27 定为 D8-C）

分选双线是「单运行时 + 切线」，P3/P5 的骨架已经覆盖；**并行双线是四种玩法里唯一需要新增架构决策的地方**，三种形态的代价完全不同。**2026-10-27 用户拍板：采用 D8-C（暂无改动）**，A/B 保留为备选，不再作为默认路径。

| 形态 | 做法 | Mod 侧改动 | 大厅侧改动 | 主要风险 |
| --- | --- | --- | --- | --- |
| **D8-A 单会话双运行时** | 一个 session 内两条运行时（investigators / locations / enemies / act / agenda / doom / clues / encounterDeck / chaosBag 全部按 part 分区），`activeParts = ['A','B']`，两线同时可行动 | 大：`state` 分区、回合/阶段/待决选择按线、观察投影按线、AI 上下文按线、存档迁移与回放指纹 | 中：`SESSION_BUSY` 要按线分锁（现为会话级 `busy`，见 `lib/server.js`），一条线的长 AI 回合不能阻塞另一线 | 存档体积与每步落盘接近翻倍；194 处 `campaign.records` / 75 处 `state.chaosBag` 读点都要按线解析，回放基线大面积重采 |
| **D8-B 双会话 + 战役组** | 两个 session 各跑一条线，用 `campaignGroupId` 绑定，共享 campaign log 与跨线效果；幕间由组内协调 | 小：现有引擎零改动，只加 `campaign.mode = 'parallel'` 的占位与跨线读写接口 | 大：`lib/online.js`（现为单实例单房间）与 `lib/server.js` 新增组、共享 store、组内同步、断线恢复 | 跨机器一致性与单点故障；两桌各自存档，幕间必须两边都完成才能写跨线记录 |
| **D8-C 单会话双运行时（✅ 暂定实施方案）** | 一个 session 里两套场景运行时（`shared` + `lanes.A/B`）；模型推理可并发，权威状态提交全局串行；关卡结算后进 `awaitingPair`，两边齐了自动跑幕间 | 中高：容器状态、lane adapter、房间/线内座位映射、按线事件/状态投影、存档迁移；引擎规则原语不动 | 中：按线接收锁、全局提交队列、全局/线内双版本、AI runner 按线、单文件保存串行化 | 存档与每步落盘接近翻倍；单房主故障域；4 座上限（2+2）；适配器漏接与事件泄露 |

- **决策与顺序**：**D8-C 已定（2026-10-27）**；先落 **分选双线**（单运行时、切 part 骨架已在 P3；人数只需两线各 ≥1），并行按 D8-C 实现（§7.5.2：两套运行时、并发推理、串行提交、关卡屏障）。旧 13 局 baseline 保留并比较，不重采覆盖；D8-A / D8-B 只有在“必须真正并发提交”或“必须两房间 4+4”时才重新评估。
- **各形态共通的硬要求**：人数偶数校验（奇数禁用并行）、两线配对屏障、跨线写入只走 `recordInPart`/`inPart`、按线裁剪的私密投影，以及按线隔离的恢复路径。
- **验收口径**：4 人并行（2+2）与 2 人并行（1+1），两线同时进入 A_n / B_n，两边都结算后**自动**进幕间；等待期只看得到自己的结算；两线 AI 席位并存按线后台推进；断线重连后两线状态不串线；分选另测 3 人 2+1 的 waiting 座位——非活动线座位看不到当前关未公开内容，也不能提交行动。
- **仓库边界**：D8-C 不需要 D8-B 的跨房间协议，但大厅改动仍属中等：按线接收锁、全局提交队列、双版本校验、AI runner 按线、事件追加与单文件保存串行化；Arkham Mod 负责 lane adapter、座位转换、投影与迁移。P0 spike 必须同时触达两仓并重估，不得再按“大厅只改三处”排期。

#### 7.5.1 联机代价：UI 分离度与队列阻塞（2026-10-27 评估）

| 维度 | 现状（单会话） | 并行需要 | 结论 |
| --- | --- | --- | --- |
| 私有信息 | 每座位投影已隐藏手牌/牌库（`observation.viewState(state, seat)`） | 再按 `seatParts` 隐藏另一线整块看板 | 数据层可分离，改动集中在投影 |
| 公共看板 | 地点/幕/议程/敌人全桌共享 | 只显示本线 | 必须按线裁剪，否则直接剧透 |
| 操作队列 | 一个会话说一把 `busy` 锁、一个 `revision`、一个 `pendingChoice` | 每条线各一把 | **不分离**：D8-A 必须重做请求管线 |
| 存档/重连/故障域 | 同一 session、同一存档、同一房主 | 各自独立 | 只有 D8-B 天然满足 |

卡队列的四个来源（均已在现有代码里）：

1. **会话忙碌锁**：`lib/server.js` 的 `busy = new WeakSet()`；同一会话同一时刻只允许一个命令，其余返回 409 `SESSION_BUSY`。
2. **AI 回合**：即使走后台 AI（`pendingAi`），AI 思考期间除 `chat` 外的命令仍返回 `SESSION_BUSY`；单次模型调用超时 60s、单回合上限 24 次调用 / 120s，因此一条线的 AI 回合足以让另一条线等几十秒到几分钟。
3. **全局 `revision`**：任何一条线提交都会推进整局版本，另一条线在途命令变成 `STALE_REVISION`；客户端只对“自动跳过”静默重试，人工操作会直接弹错。
4. **全局 `pendingChoice` / `currentSeat`**：`requestChoice` 只有一个挂起槽位，两线同时进选择窗口会互相覆盖。

- **D8-B（双会话）**：上述四项天然按房间隔离，跨桌不排队；代价只剩幕间屏障与共享 store。
- **D8-A（单会话双运行时）**：除运行时分区外，锁、版本、待决选择、AI 调度都要按线重做（约等于两套请求管线）；即使全部做完，单进程事件循环与 4 座广播仍是共享的（本 Mod 单会话 `seats = 4`，并行即 2+2 上限；要 8 人只能 D8-B 的两个房间）。
- **结论（2026-10-27 已定）**：并行双线采用 **D8-C**（§7.5.2：两套运行时、并发推理、串行提交、关卡屏障）——一个房间、一个房主、一套存档，幕间天然在一起；代价是存档翻倍、Mod 入口适配与大厅提交/保存管线改造，不需要跨机组协议。D8-B 留作“必须 4+4 两桌”的备选。分选双线不受此影响——同一时刻只有一条线在动，天然串行。

#### 7.5.2 D8-C 实施方案：单房间双运行时 + 关卡屏障（暂定，2026-10-27）

口径：**一个房间、一个房主、一套存档**；两套场景运行时都在这个 session 里；模型推理与用户请求可同时在飞，但权威状态提交与单文件保存按 session 全局串行；配对屏障放在**关卡结算**，两边都结算完**自动**进共享幕间；等待期只可见自己的结算；幕间正文两边读全文。

```text
session.state = {
  schemaVersion,
  rulesVersion,
  resourceVersion,
  revision,                         // 全局 commitRevision：每次任一线成功提交都 +1
  shared: { mode, seatParts, pairProgress, interlude, ending, ... },
  lanes: {
    A: <完整线内运行时，含自己的 revision/pendingChoice/currentSeat/phase>,
    B: <完整线内运行时，含自己的 revision/pendingChoice/currentSeat/phase>,
  },
}
```

- **lane adapter 是唯一入口**。`index.js` 暴露给大厅的 `validateMove` / `applyMove` / `legalMoves` / `decisionSeat` / `actingSeats` / `seatLocalMove` / `viewState` / `viewEvents` / AI 上下文 / `commitChoiceBatch` / checkpoint 钩子先识别容器：按 `roomSeat` 找 part，转成连续 `laneSeat`，把该 lane runtime 交给现有引擎，再把状态、事件与座位 id 转回容器。规则引擎内部不读另一条线，也不接受稀疏房间座位。
- **双版本协议**：顶层 `revision` 是全局提交序列，供发布、事件、缓存失效、存档指纹与重连使用；每个 lane runtime 的 `revision` 只判断该线命令是否过期。客户端投影同时携带 `revision` 与 `laneRevision`，提交时两者都回传；全局版本过期但目标 `laneRevision` 未变时允许安全重基，目标线版本已变则返回 `STALE_REVISION`。禁止只把现有顶层 `revision` 改成按线，否则存档指纹与同步缓存会漏更新。
- **锁与提交边界**：接收锁按线，A 的模型 I/O 不阻塞 B；实际 `commitMove`、事件 seq 分配、`pairProgress` 修改与 `session.state` 替换进入同一个 session 级同步提交队列。`active` 只是进程内执行锁，不写入 `session.state`，崩溃恢复不依赖它。
- **权威字段唯一**：章内 `records`/bag/XP/trauma/victory/story 只在线内 runtime；`seatParts`、章对进度、幕间幂等标记与 ending 只在 `shared`。adapter 装载时可以派生兼容视图，但存回时不得让 shared 与 lanes 各留一份可独立修改的副本。
- **屏障（自动进入幕间）**：某线结算后写 `awaitingPair(pairId)` 不推进；第二条线结算的同一次权威提交中，校验 `pairId`、写 `pairSealed`、执行一次幕间效果并写 `interludeApplied`，然后同时释放两线。整个转换先在内存副本完成，再原子替换 session state 并可靠保存；重复提交、重连和重放看到 `interludeApplied` 时直接 no-op。
- **存档**：一个 session 两个运行时，体积与每步落盘约翻倍（现状 1–3 MB → 2–6 MB）。`requireReliableSaves` 下每次成功提交仍要整文件原子保存并在应答前完成；可按线压缩 checkpoint 内容，但**不得**声称分桶能减少单文件重写，也不得用防抖跳过权威动作保存。两个 lane runner 共用每 session 保存队列，禁止并发写同一文件。
- **回放基线**：`replay-before.json` 用 `--compare` 证明非 TDE 局的行为不变。**2026-10-28 更新**：外部提交 `6f60771 修bug` 改变了引擎行为（13 局 786→782 步），旧基线失效并留档为 `replay-before-2026-10-27.json`；当前 HEAD 重采 `replay-before.json`（13 局 / 782 步 / 795 指纹，与 golden 逐条一致）。此后以当前基线比较；留档文件不得删除。TDE/D8-C 新增独立 replay fixture 与新基线文件，schema 元数据变化单列，不替代旧行为比较。
- **UI**：仍是一个房间；每座位只渲染自己那条线的看板（按 `seatParts` 投影），幕间/日志/结局是共同页面。
- **事件与演出隐私**：所有引擎事件在 append 前标记 `lane: 'A'|'B'|'shared'`，事件内 seat 已转成 `roomSeat`；`viewEvents` 除 `privateSeat` 外还按观察者所属线过滤，`tableState` / `presentation.tableState` 只用对应 lane snapshot。幕间、共同聊天与最终结局才标 `shared`；AI prompt 同样只取本线游戏事件与已到达的 shared 事件，不能从全局 events/notes 读取另一线未公开结果。
- **等待期可见性**：`awaitingPair` 期间 `viewState` 与 `viewEvents` 只投影本线结算正文和“等待另一组”；对方 move、结算摘要、牌桌快照、日志条目与 AI 决策全部脱敏。
- **AI 并存（按线并发请求）**：两线都可预留 AI 席位；模型请求可以同时在飞，`aiBackgroundSessions`、预算和取消控制器按 `(session,lane)` 隔离；模型结果无论返回顺序如何，都必须带创建时的 `laneRevision` 进入全局提交队列，过期结果丢弃并按该线最新状态重算。供应商并发上限只限制推理，不改变状态提交顺序。
- **取舍**：比 D8-B 少一层跨机组协议、幕间天然在一起；比 D8-A 少引擎内部的 194/75 处嵌套读点改造，但仍需要完整的 Mod lane adapter 与大厅提交/保存协调。单点故障与 4 座上限（2+2）与 D8-A 相同。
- **已定（2026-10-27，用户确认）**：① 两边结算后**自动**进入幕间；② 等待期**只可见自己的结算**；③ **AI 席位允许两线并存**，两线请求并发在飞、不轮转排队；④ 幕间正文**两边都读全文**（共同剧情，不按线裁剪）；⑤ **一套存档**（整个 session 一个文件，不按线拆文件；`scenarioCheckpoints` 内部按线分桶只服务恢复、裁剪与压缩，不减少每次权威提交的整文件原子保存）。
- **P0 spike 与确定性并发门禁**：在承诺 D8-C 工期前，用合成双 lane 夹具完成 adapter 最小闭环，并用可控 barrier/fake agent 覆盖：A/B 从同一全局版本同时提交且都保留、同线旧版本被拒、AI 反向返回不覆盖新状态、两线同时结算只执行一次幕间、保存失败不回成功、重启恢复不重复幕间、另一线事件/演出不可见。通过后才补 D8-C 文件/行数/测试数估算。
  **2026-10-27 P0 进展**：协议级夹具已完成并 7/7 通过（`develop/tde-dual-lane-spike.mjs` + `.check.mjs`，含两次变异校验），
  证明「容器 + 双版本 + 屏障 + 单文件保存队列 + 按线投影」的协议可写；**真实引擎 adapter 与大厅接线仍属 WP-8**，
  在 P3 骨架落地后用同一批门禁复跑，才允许填 D8-C 估算。见 [`tde-p0-report.md`](./tde-p0-report.md) §7。
- **剩余实现细节（不再是产品决策项）**：按线 checkpoint 的压缩策略、并发上限配置键名、`pairSealed`/`interludeApplied` 的字段命名——在 WP-8 spike 中定。

## 8. P6–P8 内容阶段（M1–M3）

### 8.1 M1 调查员（P6）

- 5 位调查员：构筑选项、牌组要求、主能力、旧印、专属卡与专属弱点（18 条记录逐人验收）。
- 自动构筑与手动构筑使用同一服务端规则；每位调查员分别测初始化、能力、依赖、存档恢复与负面路径后，才进入选人列表。
- 已知难点：Tony 的赏金/猎物（`counter.investigator`）、Luke 的门之匣 + 梦境之门（绑定地点 + 移动）、Patrice 的牌库/弃牌循环与手牌上限、Mandy 的查找改写（`window.afterDeckSearch`）、Tommy 的伤害承接与 Becky 弹药。
- 产物：`content/packs/tdeInvestigators/manifest.js`、`tests/tde-investigators.test.mjs`；账本 `confirmations.investigators`。
- **P6 收尾（2026-10-29）**：16 个单卡文件 + 9 条 P6 原语；逐人账本
  [`audit/tde-investigators.json`](../audit/tde-investigators.json) `gate.pass=true`，**verified 3/5**
  （06001/06002/06003），pending 2 人 —— 06004/06013/06014 依赖 P8 的虚拟地点与梦境之门地点、
  06017 依赖 P7 的隐私敌人，四条简化全部带 `note`。Mandy 的查找改写落在 P6 原语
  `search.modify` + `search.cardInPile`（不是 `window.afterDeckSearch`）；Luke 与 Patrice 的
  其余已知难点（门之匣/弃牌循环/手牌上限）已在 P6 落地或显式登记。逐项证据见 §13.15、
  [`tde-p6-report.md`](./tde-p6-report.md) 与 [`tde-investigators.md`](./tde-investigators.md)。

### 8.2 M2 玩家卡（P7，4 片多子进程）

- 87 张一卡一文件：`src/cards/entries/<code>.js`；每张逐项登记费用、槽位、使用次数、时机、目标、检定、升级、永久、卓越、放逐等行为。
- 分片（`shards.json`）：`M2-1` 22 / `M2-2` 22 / `M2-3` 22 / `M2-4` 21；4 个 worker 各写自己的单卡文件，**不重建索引**；主进程合并后统一重建 `entries/index.js` 一次。
- 原语请求队列：worker 写 `artifacts/migration/tde/primitive-requests/<id>.json`（`pending→claimed→done|rejected`），主进程只改共享层；队列统计写入 `reports/primitive-queue.json`。
- 复用资产：`artifacts/migration/tcu/workers/P7-WORKER-BRIEF.md`（272 行）改写为 TDE 版；写入边界、三交付、显式简化、自检 schema 全部照搬。
- 门禁：每张开放卡有行为测试与审计证据；目录卡不能仅凭卡文解析进入构筑或升级池；`cards:check` / `cards:encounter-check` 全绿。

### 8.3 M3 剧本与剧情（P8）

- 目录结构（规范 §3 + 本循环扩展；`keywords.js`/`record-labels.js`/`card-data.js`/`interludes.js`/`tde-chaos.js` 沿用 TCU 实践、超出规范 §3 最小骨架）：`content/campaigns/theDreamEaters/` + `manifest.js` / `shared.js` / `chapters.js` / `keywords.js` / `record-labels.js` / `card-data.js` / `encounter-rules.js` / `interludes.js` / `tde-chaos.js` / `story-text.js` / `scenarios/<8 id>/{index.js,definition.js,layout.js,behavior.js}`。
- `manifest.js` 必须声明 `parts`（A/B 的章节、记录 schema、袋、起始章）与唯一模式枚举 `modes: ['singleA','singleB','pick','parallel']`；`chapters.js` 每章带 `part: 'A'|'B'` 与 `pair: 1..4`，供 flow 生成配对 gate；未声明 `parts` 的战役不写 `campaign.parts`。`officialFull` 不出现在 manifest。
- 8 章按「平行章对」分批：对 1（Beyond + Waking）→ 对 2（Search + Thousand Shapes）→ 对 3（Dark Side + Point of No Return）→ 对 4（Where Gods Dwell + Weaver）；Search 53 张单独占一个大批次。
- 每章逐项：布置与放在一边区、遭遇牌库（含跨循环通用组）、地点正反面与连接、幕/议程与推进条件、敌人/诡计/剧情支援、剧本行动归属（`scenario.scriptCards`，规范 §4.5.1）、混乱符号四项、结局与跨关记录；逐章 12 项检查进 `audit/tde-scenario-acceptance.json`。
- 幕间与尾声（P8 一并交付，不能留到 P9.5）：`interludes.js` 三幕间 + `dual-story.js` 16 段矩阵；A/B 单线复用幕间 I 的对应分支，`pick`/`parallel` 挂 II/III；`tde-chaos.js` 按 part 提供两套基础袋与逐章符号表。
- 剧情（M3-C）：见 §8.5「自译补齐」工作流；`tools/import-tde-story.mjs` 从锁定的自译来源生成 `story-text.js`；译校完成前缺口章节的 `storyText` 保持 pending，不得手写摘要顶替原文。
- 门禁：章节可单独 `development`，但战役启动要求对应模式的章节全部确认；`literalCardBehavior` 必须在逐卡核对完成前保持 `false`。A/B 单线在其 4 章确认后可先 `playable`；`pick` 必须等 8 章 + 16 排列 flow 门禁，`parallel` 还必须通过 §7.5.2 的 adapter/并发/隐私门禁。§7.4 的 `officialFull` 矩阵不属于本轮发布条件。

### 8.4 M4 / M5

- M4：关键词与规则书见 §6；M5：完整合法路线、失败路线、存档恢复、多人/AI、桌面与移动端浏览器验收；三组确认全部 `verified` 才能升 `playable`。发布口径：`playable` 只表示「本 Mod 声明的实现范围可玩」，`earlyAccess=true`、`equivalenceCertified=false`；未逐条等价的分支、`blocked` 卡与未完成原语必须单列。

### 8.5 剧情自译补齐工作流（P8-T，M3-C 前置）

**决策 D2（2026-10-27）：允许自行翻译补齐中文剧情来源**；口径为「自译，非官方中文」，来源锁与审计标注见下。评估产物：`artifacts/migration/tde/recon/story-gap/report.md`。

- **工作量事实**：en 源 9 文件 `textChars` 194,299；现有 zh 可复用 en 文本 45,221 字符（23.3%，其中 15 段正文疑似节译须重译、11 条短记录键可原样复用）；**净需翻译 147,718 en 字符**（叙事 120,098 / 规则 24,999 / 界面 2,621）；按 en→zh 字符比 0.30–0.38 估算 **约 44k–56k 中文字符（中值约 50k）**，其中 story-text 约 36k–46k。**14 个翻译批次 + 批 00（复用/不译）**；约 23–36 人日，单人约 **3–5 周**。
- **批次**：00 术语表 / 来源锁 / 55 记录键校对 → 01 序章 + 战役结构规则段 → 02 / 03 / 04 幕间 I（黑猫）/ II（入梦者）/ III（伟大的存在）→ 05 16 段结局矩阵 + 特殊尾声（`brokeTheLawOfUlthar`）→ 06–11 按平行章对译 8 章（A1/B1 → A2/B2 → A3/B3 → A4/B4）→ 12 关键词解释与附加规则（alert / storyCards / swarming / hidden）→ 13 场景规则文本 → 14 界面杂项与终审。
- **来源锁与审计字段**：自译底本锁定 `参考资源/.../locales/en/theDreamEaters/**` 的 SHA-256；自译产物（`.json`/`.md` 源）落在 `content/campaigns/theDreamEaters/story-source/`（不写 `参考资源/`，运行时不依赖参考资源）；`tools/import-tde-story.mjs --check` 同时校验来源哈希与生成物。审计账本的 `storyText` 记 `sourceKind: 'self-translated'`、`officialChinese: false`、`enSourceHashes`、`glossaryVersion`、`generatedSha256`，**不得写成官方中文来源**。
- **术语与审校**：44 行术语表，以中文卡表（`src/cards/cards-data.js`）为专名基线（7 关键词官方词形：多重 / 蜂拥 / 掩藏 / 研究完成 / 警戒 / 隐私 / 绑定；8 章标题 / 5 调查员 / 战役名）；**5 个高风险词形冲突**（Hidden 隐私 vs 隐藏、Dreamlands 幻梦境 vs 梦境之地、Swarming 蜂拥 vs 群集、Veiled 掩藏 vs 隐蔽、campaign/scenario 战役/剧本 vs 冒险）+ **3 个空白词**（Great Ones、waking world、campaign 称呼）在批 01 拍板。新增术语一致性检查 `check:tde:terms`；15 段正文疑似节译必须重译或逐段补齐后才可复用；`epilogueMatrix` 含 `data-epilogue` / `{count}` 控制标记，生成器需专门处理。
- **验收**：`storyText` 审计（每章存在导入正文、每个可达结局有正文、无 HTML 控制标记、未触发分支不泄露、私密段落按座位过滤）+ 术语一致性检查 + 生成器 `--write/--check` 逐字节一致；`pick`/`parallel` 剧情按 part 与事件 lane 投影，A/B 组互不泄露。
- **依赖**：批次 01/05 与双线模式的幕间/16 段矩阵共用文案；若双线降级，跨线段落可先译存档，发布时按实际实现范围裁剪。

## 9. 多子进程批量迁移协议（复用规范 §4.6）

- **角色**：主进程是唯一共享文件写者（`src/engine/**`、两个索引、`_shared.js`/`_lookup.js`、`content/**`、`docs/**`、`audit/**`、`artifacts/migration/tde/**`）；worker 只写自己分到的单卡文件、自己的 `workers/<id>.json` 与 `primitive-requests/*.json`。
- **分片**：M1 调查员 1 片（18 条记录；按调查员维度整包切片，`shards.json` 记录 §4.6.2「20–50 张/片」的豁免理由——专属卡不可与调查员拆分）；M2 玩家卡 4 片（22/22/22/21）；M3 剧本按章 + 共享组切（8 章 8 片 + 共享组 1–2 片；Search 章 53 张拆两片：主卡 36 / 面 17），非玩家卡分片按**归属目录**切；每张卡只进一片。
- **原语队列协议**（逐条照规范 §4.6.3）：请求文件先写 `.tmp` 再原子 `rename`；卡标 `blocked` 后继续同片其他卡；主进程按 `(primitive, stableStringify(params))` 去重；`done` 带 `resolution.api`/测试/目录位置，`rejected` 必须带 `resolution.suggestion`（改用现有原语或 `resolve`）；`claimed` 超时回 `pending`；统计写 `reports/primitive-queue.json`。
- **幂等/恢复**：worker 读只读快照（`primitive-catalog.json`、`mechanism-scan.json`、`primitive-plan.json`、本轮卡表）；已存在且哈希一致的文件跳过；崩溃只重跑该分片。
- **索引**：worker 一律 `--no-index`；主进程在所有分片合并后**只重建一次** `entries/index.js` 与 `encounter-entries/index.js`。
- **门禁**（规范 §4.6.8）：分片完整性、写入边界、单卡文件形状、索引一致、队列无悬挂、`replay-fixtures --compare` 一致、`test:fast` 无新增失败、账本通道/证据更新、三份报告齐备。
- **报告**：`reports/workers.json`、`reports/primitive-queue.json`、`reports/merge.json`；基线快照与既有失败日志照 TCU 模板留痕。

## 10. 产物清单与接入点

### 10.1 新建文件（按包分）

| 类别 | 目标路径 |
| --- | --- |
| 内容包 | `content/packs/tdeCampaign/manifest.js`、`content/packs/tdeInvestigators/manifest.js`、`content/packs/tdePlayer/manifest.js`（M0 已建 `catalog-only` 骨架，P6–P8 往同名文件补内容） |
| 引擎 | `src/campaign/campaign-parts.js`（切片/切换/`inPart`/`partRecord`/`partChaosBag`） |
| 战役 | `content/campaigns/theDreamEaters/{manifest,shared,chapters,keywords,record-labels,card-data,encounter-rules,interludes,tde-chaos,story-text,parts,dual-flow,dual-story,dual-effects}.js` + `scenarios/<8 id>/`（每章 `index/definition/layout/behavior`） |
| 单卡文件 | `src/cards/entries/<code>.js` × 87（玩家卡）；`src/cards/encounter-entries/theDreamEaters/**/<code>.js`（283 条战役记录，按归属目录） |
| 工具 | `tools/scan-tde-scope.mjs`（P1 已建）、`scan-tde-mechanisms.mjs`（P2 已建）、`audit-tde.mjs`、`audit-tde-player.mjs`、`audit-tde-all-cards.mjs`、`audit-tde-scenarios.mjs`、`import-tde-story.mjs`、`check-tde-registry.mjs`、`check-tde-scenario.mjs`、`develop/gen-tde-source-lock.mjs`、`playwright.tde.config.mjs`、`tools/tde-primitive-spec.mjs` 为 TDE 专用新文件；`audit-tcu-primitives.mjs` 与 Playwright reporter 建议先参数化共用（`tools/audit-cycle-primitives.mjs --cycle tde`、`tools/playwright-tde-reporter.mjs --cycle tde`），避免复制约 1986 行（2026-10-27 实测）的审计大件 |
| 测试 | `tests/tde-*.test.mjs`（原语/关键词/交互/调查员/玩家卡/剧本/剧情/dual/账本；D8-C spike 后重估数量）+ 6 个 browser spec（rules/interactions/scenarios/dual/release/media）+ `tests/tde-suite.mjs` |
| 账本 | `audit/tde-rules.json`（P4）、`audit/tde-migration.json`、`tde-scenario-acceptance.json`、`tde-all-card-acceptance.json`、`tde-player-acceptance.json`、`tde-scenario-source-lock.json`、`tde-browser-acceptance.json`；生成物 `src/cards/tde-player-acceptance.js` |
| 运行目录 | `artifacts/migration/tde/{scope.json,mechanism-scan.json,primitive-plan.json,primitive-catalog.json,primitive-requests/,workers/,reports/,shards.json}` |

### 10.2 接入点（新增循环必须登记的 7 处 + 3 处清单）

1. `content/registered.js`：三个包 + 战役 + 8 章加入 bundle（`currentContentBundle()` 同步）。
2. `content/mechanics.js`：`supportedMechanics` 追加 `tde*` 机制 id。
3. `web/rulebook-data.js`：规则书分组、拼音索引、卡文直达（`supportedMechanics` 见上一条）。
4. `src/deck/availability.js`：`PLAYABLE_INVESTIGATOR_CODES` / `SIGNATURES_BY_INVESTIGATOR` / `ALL_BUILDABLE_CODES` / `isStrictAccepted`。
5. `content/packs/manifests.js` 或其数据段写法（若 TDE 包沿用 ranges 表达式）。
6. `content/campaigns/theDreamEaters/keywords.js` 关键词台账（M4 事实源）。
7. `tools/audit-baseline.mjs` 的 `AUDITS` 追加 `tdeScope` / `tdeMigration`。**P1 已具备 `scan:tde:scope:check`，但注册要等全局 `audit/baseline.json` 重采**：新增审计项会让 `baseline:check` 直接失败（见 R4）。
8. `tests/suites.mjs` + `tests/node-suite.mjs`：TDE 测试文件登记各自 tier（`tde-suite.mjs` 作总入口）。
9. `package.json`：约 30 条 `*:tde*` 命令（见 §11）。
10. `.gitignore`：逐级放开 `artifacts/migration/tde/` 后，立即重新忽略 `tde/*`，再只白名单 `scope.json`、`mechanism-scan.json`、`primitive-plan.json`、`primitive-catalog.json` 与审计明确声明的最小复算输入；`workers/`、`primitive-requests/`、日志、截图和临时报告继续不签入。同步勘误迁移规范中“整个 migration 目录不签入”的旧绝对表述。**P0 已落地**：白名单与 `git check-ignore` 验证见 [`tde-p0-report.md`](./tde-p0-report.md) §6；规范旧表述已在勘误中改写为逐文件白名单写法。

### 10.3 文档集（9 篇，M 阶段逐步补齐）

`docs/tde-migration-roadmap.md`（本文）+ 8 篇卫星：`tde-primitives.md`（P3）、`tde-rules.md`（P4）、`tde-interactions.md`（P5）、`tde-investigators.md`（M1）、`tde-player-cards.md`（M2）、`tde-scenarios.md`（M3）、`tde-story.md`（M3-C）、`tde-release.md`（M5）。骨架照 TCU 9 篇（每篇含「口径 → 事实表 → 证据 → 边界 → 相关手册与维护」）；卫星文档是原语账本 `files` 的必需输入，**先建文档再跑 `plan:tde:primitives`**。P0 另交付 [`tde-p0-report.md`](./tde-p0-report.md)（前置清理、勘误与基线证据）；它是过程文档，不占这 9 篇名额。

8 篇卫星文档已于 2026-10-27 按 TCU 骨架建好（起初全部 `draft`，只写「口径 + 事实表 + 待办 + 互链」，不含完成声明）；P4 起 [`tde-rules.md`](./tde-rules.md) 已按 P4 证据填实（关键词 5 项、规则书 6 项、两处 P3 口径更正）：

| 文档 | 阶段 | 主要内容 |
| --- | --- | --- |
| [`tde-primitives.md`](./tde-primitives.md) | P3 | 9 条 primitive + 4 条关键词原语 + 13 条 §5.2 候选 + 3 条 escape；五件套与命令 |
| [`tde-rules.md`](./tde-rules.md) | P4 ✅ | 7 个关键词（5 项证据）+ **17 条**规则书条目（6 项证据）+ P4 两处原语口径更正 + D5 决策 |
| [`tde-interactions.md`](./tde-interactions.md) | P5 批次 1 ✅ | 10 条交互定稿（触发/章节/机制 id/归属/blockers，全部 `pending`）+ 已交付的四模式策略、章对门与投影口径 + 批次 2/3 待办 |
| [`tde-investigators.md`](./tde-investigators.md) | M1 ✅ | 5 位调查员 + 13 条专属记录 + 逐人验收状态（verified 3/5、简化 4 条带 note）+ P6 原语读点 + 命令 |
| [`tde-player-cards.md`](./tde-player-cards.md) | M2 | 87 张 / 4 片（22·22·22·21）+ 卡片契约 + escape |
| [`tde-scenarios.md`](./tde-scenarios.md) | M3 | 8 章结构 + 20 组 + 逐章机制锚点 + 12 项检查 |
| [`tde-story.md`](./tde-story.md) | M3-C | 自译缺口（净需译 147,718 字符 / 14 批）+ 工作流 + 审计字段 |
| [`tde-release.md`](./tde-release.md) | M5 | 三组确认 + 发布门禁 + `playable`/`earlyAccess`/不宣称等价 |

## 11. 验收门禁与命令

### 11.1 命令表（建议，随 P1 落地）

| 阶段 | 命令 | 产物 |
| --- | --- | --- |
| 范围/基线 | `scan:tde:scope` / `scan:tde:scope:check` | `scope.json` + `replay-before.json` |
| 机制扫描 | `scan:tde` / `scan:tde:check` / `scan:tde:review` | `mechanism-scan.json`、`_review.md` |
| 原语 | `plan:tde:primitives` / `audit:tde:primitives` | `primitive-plan.json` / `primitive-catalog.json` |
| 关键词/规则书 | `test:tde:rules` / `test:tde:rules:browser` / `audit:tde:rules` | `confirmations.keywords/rulebook`、`audit/tde-rules.json` |
| 交互 | `test:tde:interactions` / `test:tde:interactions:browser` | `confirmations.interactions` |
| 双线（并行 / 分选） | `test:tde:dual`（已建）/ `test:tde:pick`（已建）/ `test:tde:parallel`（批次 3）/ `test:tde:dual:browser`（批次 2）/ `replay:fixtures --compare` | 2+2 / 1+1 / 2+1 分线矩阵、奇数禁并行、part 切换、座位映射、双日志/袋、缺牌组阻塞 |
| M1/M2 | `test:tde:investigators`、`test:tde:player`、`audit:tde:player` | 调查员/玩家卡账本 |
| M3/剧情 | `test:tde:scenarios`、`audit:tde:scenarios`、`check:tde:scenario`、`check:tde:registry`、`import:tde-story` / `:check`、`test:tde:story`、`check:tde:terms` | 逐章账本 + `story-text.js` + 自译术语一致性 |
| 全卡/整轮 | `test:tde:cards`、`audit:tde:all-cards`、`test:tde`、`audit:tde` | `tde-all-card-acceptance.json`、`tde-migration.json` |
| 浏览器/发布 | `test:tde:browser`、`docs:check` | 浏览器账本、0 失效链接 |

### 11.2 阶段门禁（规范 §4.7 + §8）

| 阶段 | 必跑 | 通过标准 |
| --- | --- | --- |
| 原语 | 新原语单测 + `npm run test:fast` | 正常/无目标/费用不足/存档往返；无新增失败 |
| 关键字/规则书 | `audit:tde` + 规则书浏览器 | 关键词/规则条目 `verified`；桌面/移动端可读、可跳转 |
| 交互 | Playwright 桌面 1440 / 移动 390 | 可用、不可用原因、空状态、取消/重试；视觉与既有界面一致 |
| 批量卡牌 | `cards:check` + replay + `test:fast` | 索引一致；行为零变化；无新增失败 |
| 单线开闸 | 该线 4 章 `check:tde:scenario` + 浏览器 | A/B 各自 4 章 + 幕间 I 对应分支；存档往返与回放一致 |
| 分选开闸 | `test:tde:pick` + 4 人浏览器 spec | 座位分线（含 2+1）、轮流推进、幕间屏障、每座位一套牌组、双线隐私 |
| 并行开闸 | `test:tde:parallel` + 两线同时推进 spec + `replay:fixtures --compare` | 偶数校验、非连续房间座位映射、跨线同时提交不丢更新、同线旧版本拒绝、两线结算后幕间只触发一次、状态与事件双重隐私、AI 反向返回不覆盖新状态、可靠单文件存档、断线恢复、16 尾声矩阵全量选择测试 |
| 发布 | `test:tde`、`replay:fixtures`、`npm test`、`presentation:check`、浏览器回归 | 三组确认 `verified`；无新增失败；既有失败单独记账 |

- 审计报告必须含 `confirmations.scenarios`（12 项检查）/ `confirmations.keywords`（5 项）/ `confirmations.rulebook`（6 项）；状态只有 `pending` 与 `verified`；三组未完成时 `playable: true` 只能以 `earlyAccess` 口径存在，且不得描述为规则等价。
- 最终报告必须区分：本轮新增失败、可复现的既有失败、`blocked` 卡与未完成原语；任何 `blocked`/`rejected` 都不能写成「已迁移」。
- 双线额外门禁（任一失败则该模式保持 feature gate 关闭，单线可照常发布）：
  1. `campaign.mode/seatParts/activeParts/currentPart/parts` 只对 TDE 写入；D8-C 的顶层 `shared/lanes` 容器只对 `parallel` 写入；旧 13 局 baseline 保留且 hashes 逐条不变；
  2. 并行：4 人 2+2 与 2 人 1+1 每座位一套合法牌组齐全，3 人时并行入口置灰并给原因；分选：2+1 分法可开局、某线 0 人时按单线处理并显式提示；缺牌组时 `hubGoSetup`/开局动作返回明确阻塞原因，不静默待机；
  3. 16 种逐章对先手排列全部通过轻量 flow/gate 测试；A1→B1→…→A4→B4 与 B1→A1→…→B4→A4 两条真实全流程 + 两次幕间换线通过；
  4. 双线 log/bag/XP/trauma/victory/story/abilityLimits 互不串线，跨线写入只走 `recordInPart`/`inPart`；
  5. `campaignView` 与 `viewEvents` 同时按 part/lane 和 room seat 脱敏；另一线 move、结算、日志、`tableState`/presentation snapshot 与 AI 决策不可见；AI 不读非本线未到达信息；
  6. schema 7→8 迁移对非 TDE no-op，TDE 旧档前后往返一致；旧 baseline 只 compare，不用新 `--baseline` 覆盖；
  7. `roomSeat↔laneSeat` 双向转换覆盖 `currentSeat`、`pendingChoice.seat(s)`、`humanSeats`、`leadSeat`、调查员/牌组记录、事件与 checkpoint；线内数组连续无洞，人数缩放只算本线；
  8. 顶层 `revision` 每次任一线提交都递增，目标 lane `revision` 独立递增；跨线全局版本过期可安全重基，同线版本过期必须拒绝；
  9. 两线推理可并发，但状态替换、事件 seq、屏障、checkpoint 与保存全局串行；保存失败不得回成功，两个 runner 不得并发写同一存档；
  10. 两线同时完成同一 `pairId` 时，`pairSealed` + 幕间效果 + `interludeApplied` 只提交一次；在返回顺序、重连、重启和重放下均幂等。

### 11.3 规范细目对照（核验清单 G1–G12 的落点）

| # | 规范要求 | TDE 落点 |
| ---: | --- | --- |
| G1 | §4.6.2 分片 20–50 张/片 | §9：M1 单包切片记豁免理由；Search 章 53 张拆两片 |
| G2 | §4.6.3 队列细节（原子写/去重/rejected/claimed 超时） | §9「原语队列协议」逐条 |
| G3 | §4.5.1 scriptCard 三处断言 | §8.3：`legalMoves` / `scriptActionHints` / `viewState(...).scriptActions` 三处断言；地点/敌人行动不得误标；不可执行仍返回带 `reason` 的提示 |
| G4 | §5.2 `literalCardBehavior` 审查口径 | §8.3/§11.2：逐卡能力清单（正/背/关联面/升级/复用）+ 合法与非法行动断言；不得以卡号出现在源码作为证据；简化进待实现清单并保持 `false` |
| G5 | §2 通道状态枚举 | 审计账本逐卡记 `descriptor \| legacy \| hybrid \| missing` 与证据路径；`missing` 使该章 `literalCardBehavior=false` |
| G6 | §2 可重放 / 存档迁移 | 新状态字段（双 part、座位线别、分线牌组、警报、蜂拥、地点掩藏等）进 `save-migration.js` 版本迁移 + JSON 往返；replay `--baseline` / `--compare` |
| G7 | §2 简化必须显式 | 未逐条还原的卡写 `simplified: true` + `note` 并留在待实现清单，不用近似实现静默过关 |
| G8 | §2 三项指标不倒退 | `engine.js` 卡号字面量 166 / `EFFECTS` 条目 385 / 逃生原语卡 93 只减不增（当前基线见 ARCHITECTURE §9） |
| G9 | §6 / §7 检查项字段 | keywords 5 项（sourceInventoried / engineBehavior / nodeAcceptance / rulebookEntry / cardLinks）；rulebook 6 项（campaignOverview / scenarioMechanics / keywordEntries / cardLinks / desktopBrowser / mobileBrowser） |
| G10 | §5.1 叙事覆盖清单 | 序章、每章导入、全部结局、幕间、条件信息段、尾声；只投影已到达分支；座位级过滤；不手写摘要 |
| G11 | §4.8 M0 每章独立 `index.js` | M0 建 8 个 `scenarios/<id>/index.js` 占位（`catalog-only`），M3 换真实模块 |
| G12 | §7 规则书只写规则本身 | 条目不出现引擎/实现/界面操作/审计状态/代码路径；未实现机制不建条目 |

## 12. 风险与开放问题

| # | 风险 | 等级 | 影响 | 对策 / 决策人 |
| ---: | --- | --- | --- | --- |
| R1 | **中文剧情需自译**（已决策 D2）：净需翻译 147,718 en 字符 → 约 50k 中文字符、14 批、约 23–36 人日（单人 3–5 周）；15 段正文现有 zh 为疑似节译需重译 | 中（工作量与质量，非阻断） | `storyText` 与规则书可 `verified`（标自译）；延期则相关章节 pending | 批 00 先锁术语表与来源；§8.5 分批验收 + `check:tde:terms`；不得把节译当原文 |
| R2 | **双 part + `pick` 工程改造**：历史评估为骨架 9 文件 / 550–850 行，累计 34 文件 / 1,900–3,100 行 / 54–71 例；不包含 D8-C | 中高（排期，非可行性） | 决定分选双线交付时点 | P3 落座位映射与切 part 骨架，P5 通闭环，P9.5 只开闸；历史数字只作 `pick` 锚点，不外推 `parallel` |
| R3 | ~~06 段本地卡图仅 1/388~~ **P1 实测 en/zh 各 388/388**（avif）；本地缓存被忽略，干净检出 0 张 | 低 | M5 展示素材与离线体验 | `images:fetch` + 远程回退（388/388 条记录有 `imagesrc/backimagesrc`）；清单 `reports/image-inventory.json`；不得建循环专属目录 |
| R4 | ~~TCU 三本账本漂移~~ + `baseline:check` 状态待重采；初勘曾报告 37 处断链，但当前 `docs:check` 已为 0 | 中 | 全局审计门禁可能不能直接全绿 | **P0 已处置 TCU 三项**（2026-10-27）：根因是 9 篇 TCU 文档被误删，已恢复并重算，四项检查 4/4 通过；`audit/baseline.json`（36/288、3567 tests）仍待重采；`docs:check` 基线更新为 **43 文件 / 376 链接**；TDE 范围扫描不依赖红账本 |
| R5 | 蜂拥/掩藏是全新实体级机制（蜂拥卡区域、地点翻面/故事卡），影响战斗、移动、观察、AI、存档 | 中高 | 原语与交互工作量集中在 P3/P5 | 高风险原语先行（§5.1）；每项补 Node + 浏览器双证据 |
| R6 | 章节规模极不均（Search 53 vs Waking 21） | 中 | 排期与 worker 分片 | 按章分片、Search 单独批；不按章均分 |
| R7 | ~~跨循环通用遭遇组（8 组）可用性、`DarkCult↔pentagram` 映射未证实~~ **P1 已证实**：8/8 目录存在，pentagram 条目的卡池 `encounterName` 就是 `Dark Cult` | 低 | M3 setup 卡住 | 账本 `crossCycleGroups` + `gatherRefs` 逐章登记；缺失组会让 `--check` 失败 |
| R8 | `Beyond the Gates of Sleep` 参考实现无 `gather`（**P1 确认**：只有 `li "gatherSets"` 声明，无任何 `gather Set.*`） | 低中 | 该章 `setupAndZones` 证据不足 | 已作 `pending` 条目写进 `scope.json`；M3 用规则书 setup 文本逐句对齐后才销账 |
| R9 | ~~规范自身三处过期/错误~~：§1 卡图路径写 `web/img/arkham/{,zh/}cards`（实际 `web/img/{,zh/}cards`）、§4.1 基线示例「10 局 / 529 步」、§4.6.8「既有 7 条」 | 低 | 文档口径不一致 | **P0 已修**（2026-10-27）：另补 §3 `.gitignore` 逐文件白名单写法，四处勘误见 [`tde-p0-report.md`](./tde-p0-report.md) §3；P1 起以工具实测为准 |
| R10 | 迁移期间环境假阴性：本会话执行器禁止子进程管道捕获，`audit-tcu-player/all-cards/carcosa-player` 会假失败 | 低（记账） | 误判账本状态 | 迁移报告中区分「环境假阴性 / 真实失败」；换普通终端复跑 |
| R11 | 自译质量与术语漂移（专名/关键词/记录标签不一致；节译误当完整译文） | 中 | 卡文/规则书不一致、审校返工 | 术语表基线 + `check:tde:terms` + 两轮审校 + 15 段正文重译清单 |
| R12 | schema 7→8 迁移影响全部存档版本（回放元数据需兼容新 schema） | 中 | 旧档兼容与回放证据 | 迁移项对非 TDE no-op；保留迁移前 baseline 并用 `--compare` 证明 13 局 hashes 逐条不变；TDE 新 fixture 另建基线；`save-migration.test` 全绿 |
| R13 | **分线座位与选人 UX**：四种开局入口、奇数禁并行、每座位一套牌组、跨线重复选人 | 中 | 开局走错模式或选错线；静默退化会被当成 bug | §1.4.1 口径 + hub 前置校验 + 2/3/4 人矩阵；缺牌/未分线时阻塞并给原因 |
| R14 | 切 part 时 hub 状态残留（上一线 `hubSeatSelected`/`hubSeatDone`/`upgradeDraft`） | 中 | 选人错线、重复调查员、旧牌组串线 | 切 part 清 hub 准备态；`parts` 只存 campaign record；`replacementCandidates` 的 used 集合合并两线 |
| R15 | **D8-C 双运行时改造**：lane adapter + 房间/线内座位映射 + 全局/线内双版本 + 事件投影 + 单文件保存串行化 + 存档翻倍 | 中高（排期，非可行性） | 决定并行双线的交付时点；最坏情况退回“并行不可用、单线/分选照常” | P0 先做 §7.5.2 spike 并重估；P3 落分选骨架；P5 起 WP-8；旧 baseline 只 compare 不覆盖；不做时并行写 `remaining` |
| R16 | **人数规则与退化**：奇数禁并行、1 人只能单线、分选可能某线 0 人 | 中 | 开局入口与阻塞文案；静默开局会直接玩错 | hub 层前置校验 + 明确原因（§1.4.1）；分选 0 人按单线处理并在确认页说明；§11.2 门禁覆盖 2/3/4 人 |

**开放问题清单（未标“已定”的项目在 P1–P5 决策）**：D1 双线开闸时点（**2026-10-27 重排：骨架 P3 必做，单线先暴露，双线于 P9.5 开闸；D1-A/D1-B 只决定开闸排期**）；D8 并行双线形态（**已定：D8-C 单房间双运行时 + 关卡屏障，2026-10-27，见 §7.5.2**）；D9 D8-C 细节（**已全部拍板 2026-10-27：自动进幕间 / 只见自己结算 / AI 两线并发请求 / 幕间两边读全文 / 单文件存档；见 §7.5.2**）；D2 剧情来源补齐路径（**已定：自译补齐，2026-10-27，见 §8.5**）；D3 TCU 三本漂移账本重算或冻结（文档链接已验证为 0）；D4 `achievements` 是否纳入范围（默认 out-of-scope）；D5 `Bonded` 规则条目复用 `tcuBonded` 还是新立 `tdeBonded`（**已定 2026-10-29：新立 `tdeBonded`，因为本循环多了地点绑定与绑定弱点敌人；规则条目总数 16→17**）；D6 `06015a/b`、`06169a/b` 无主双面卡归属登记；D7 `Patrol`/`Seal`/`Explore`/`Supply` 不作为 TDE 关键词的判定是否保留。

## 13. 立即开工清单（P0 → P3）

| # | 任务 | 产物 / 验收 | 依赖 |
| ---: | --- | --- | --- |
| 1 | 规范勘误：卡图路径、基线示例数字、既有失败口径 | 迁移规范或路线图注记更新；`docs:check` 不新增断链 | — |
| 2 | 固化文档链接基线，后续新增文档不得回归 | `node tools/check-doc-links.mjs` 保持 22 文件 / 61 本地链接全通过 | — |
| 3 | TCU 三本账本漂移处置（`audit:tcu` / `tcu-scenarios` / `tcu-primitives`） | `--check` 通过或明确冻结口径；TDE 门禁不依赖 | — |
| 4 | 基线重锁：`replay-fixtures --baseline artifacts/migration/tde/replay-before.json` + 当前 `test:fast` 失败集合落盘 | 基线文件 + `reports/baseline.md` | — |
| 5 | `.gitignore` 只白名单 TDE 最小复算输入（`scope/mechanism-scan/primitive-plan/primitive-catalog`），继续忽略 worker/队列/日志/截图；同步勘误迁移规范 | 干净检出可复算账本，`git status` 不出现过程产物 | 1 |
| 6 | 新建 `tools/scan-tde-scope.mjs` 并 `--write` | `scope.json` gate.pass=true，数字以工具实测为准（✅ 完成，见 §13.2） | 1、4、5；**不依赖**任务 2/3 |
| 7 | 新建 `tools/scan-tde-mechanisms.mjs` 并 `--write` | `mechanism-scan.json` gate.pass=true，38 条机制复算（✅ 完成，见 §13.3） | 6 |
| 8 | 双战役**骨架**（历史锚点 9 文件 / 550–850 行 / 12–15 例）：合成两 part 战役跑通切换/隔离、房间座位↔线内连续座位映射、JSON 往返、13 局指纹零漂移 | 决策记录 D1；`campaign-parts.js` + `primitive-plan.json` 增加 6 条原语（`campaignPart/recordInPart/seatPartMap/chaosBag.multiPart/inPart/partFlowCondition`）（✅ 批次 1 完成，见 §5.5 与 §13.4） | 7 |
| 9 | **D8-C P0 spike**：容器 lane adapter + 全局/线内双版本 + 全局提交队列 + lane 事件过滤 + 单文件保存串行化；fake agent/barrier 制造跨线并发 | §7.5.2 七项确定性并发门禁通过；产出独立文件/行数/测试数估算，失败则 `parallel` 保持 gate 关闭 | 8 |
| 10 | 分线座位矩阵夹具：2 人 1+1、3 人 2+1、4 人 2+2 × 四种模式；含非连续房间座位、并行禁奇、16 种逐章对先手、切 part、存/读、缺牌组阻塞 | Node 集成测试 + 失败原因断言；不得出现稀疏数组、静默待机或部分座位误映射 | 8；`parallel` 部分依赖 9 |
| 11 | 文档集开篇：按 TCU 骨架建 8 篇卫星文档的「口径 + 待办」占位（不是完整内容） | 8 个文件 + 互链；作为原语 `files` 输入（✅ 完成，见 §10.3 表） | 1–2 |
| 12 | 图片库存扫描与远程回退确认（原写「06 段缺图 387 条」，P1 实测为 0 缺图） | 缺图清单 + 回退策略记录（✅ 完成，见 §13.2） | — |
| 13 | 剧情自译批 00：锁 en 源 SHA-256、建术语表（≥20 条）、校对 55 记录键与 8 章标题 | 来源锁 + 术语表 + `check:tde:terms` 草稿 | 1、4、5 |
| 14 | 剧情自译批 01：序章 + 战役结构（约 5,244 en 字符 → ~1.8k 中文字符） | 自译源文件 + 审校记录 | 13 |

### 13.1 P0 收尾证据（2026-10-27）

任务 1–5 已完成；逐条证据、复现命令与待办见 [`tde-p0-report.md`](./tde-p0-report.md)。要点：

| §13 # | 产物 | 证据 / 实测 |
| ---: | --- | --- |
| 1 | 规范勘误 4 处 | `docs/arkham-content-migration.md`：§1 卡图路径、§4.1 基线口径、§4.6.8 既有失败、§3 `.gitignore` 逐文件白名单写法；`docs:check` 不新增断链 |
| 2 | 文档链接基线 | `node tools/check-doc-links.mjs` → **43 文件 / 376 链接全部可解析**（P0 前 22/61 是「9 篇 TCU 文档被删后被动变小」，不是更健康） |
| 3 | TCU 账本处置 | 恢复 9 篇被删文档 → `--write` 重算（diff 仅 `content/registry.js` 一个哈希）→ `audit:tcu` / `audit:tcu-scenarios` / `audit:tcu-primitives` / `scan:tcu:scope:check` **4/4 通过** |
| 4 | 基线重锁 | `artifacts/migration/tde/replay-before.json`（13 局 / 786 步 / 799 指纹，与 golden 逐条一致）+ `reports/baseline.md`、`reports/baseline-fast-final.log`（3607 tests / 0 fail）、`reports/baseline-git-head.txt`、`reports/baseline-git-status{,-pre-p0}.txt` |
| 5 | TDE 最小白名单 | `.gitignore` 只放行 `scope / mechanism-scan / primitive-plan / primitive-catalog`；`git check-ignore` 逐条验证（4 个可跟踪、`reports/`、`workers/`、`primitive-requests/`、`recon/`、日志仍忽略） |
| 9 | D8-C 风险验证 | **协议级已完成**：`develop/tde-dual-lane-spike*.mjs`（337 行）跑通七项确定性门禁 **7/7**，含 2 次变异校验（删校验规则对应门禁变红）；适配面盘点（`index.js` 65 键 / 40 函数 / 393 行；`lib/server.js` 2,906 行、`revision` 128 处、`busy` 66 处、`SESSION_BUSY` 14、`STALE_REVISION` 5）+ 估算口径已交付；**adapter 级 spike 与独立估算**按依赖「9←8」移到 P3 骨架之后，D8-C 文件/行/测试数仍记 **TBD** |

> 运行目录 `artifacts/migration/tde/` 不签入（除 4 个复算输入），上表证据均可在本机复算；命令见 [`tde-p0-report.md`](./tde-p0-report.md) §9。

### 13.2 P1 收尾证据（2026-10-27）

任务 6（范围与来源锁）与任务 12（图片库存）已完成；逐条口径见 [`tde-p1-report.md`](./tde-p1-report.md)。

| §13 # | 产物 | 证据 / 实测 |
| ---: | --- | --- |
| 6 | `tools/scan-tde-scope.mjs` + `scope.json` | `npm run scan:tde:scope:check` → `388 条记录（352 主卡 + 36 面），三包 283/18/87，20 个遭遇组，8 章，43 个来源`，`gate.pass=true`；新增 `scan:tde:scope` / `scan:tde:scope:check` / `scan:tde:images` 三条命令 |
| 6 | 来源锁 | `scope.json.sources` 43 项（参考 38 + 仓内 5）逐文件 SHA-256；缺失即 `--check` 失败 |
| 6 | M0 目录骨架 | `content/packs/tde{Campaign,Investigators,Player}/manifest.js` + `content/campaigns/theDreamEaters/shared.js` + 8 章 `scenarios/<id>/index.js` 占位；全部 `catalog-only`，`content/registered.js` 未接入（`gate.catalogOnly`） |
| 6 | 分片草案 | M1 18 / M2 22·22·22·21 / M3 9 片（Search 拆 36+17）+ 共享组 30；索引并集 388、交集 0 |
| 12 | 图片库存 + 回退 | `npm run scan:tde:images` → `reports/image-inventory.json`：en/zh 各 **388/388** avif；`imagesrc/backimagesrc` 覆盖 388/388；原「缺图 387 条」作废 |
| — | 跨循环组确认（R7） | 8/8 目录可用；`Set.DarkCult ↔ shared/pentagram` 由卡池 `encounterName='Dark Cult'` 证实；`gatherRefs` 逐章登记 |
| — | Beyond 无 gather（R8） | 已作为 `pending:beyondTheGatesOfSleepEncounterDeck` 写进账本，M3 用规则书 setup 文本销账 |

### 13.3 P2 收尾证据（2026-10-27）

任务 7（机制扫描）已完成；类型分布、关键词实测与分级差异见 [`tde-p2-report.md`](./tde-p2-report.md)。

| 项 | 证据 / 实测 |
| --- | --- |
| 命令 | `npm run scan:tde` / `scan:tde:check` / `scan:tde:review`（新增）；`--check` 复算一致 |
| 条目 | 38 条机制（keyword 7 / primitive 9 / rulebook 6 / scenario 11 / interaction 2 / content 3）+ 1 条 baseline（`standardRules`） |
| 覆盖 | 388/388 已分类、未分类 0；每条记录都有 `mechanisms[]` + `evidence{}`；`_review.md` 按 tier 列全卡 |
| 分级 | mechanism 173 / content 151 / standard 64（初勘 182/156/50；差额集中在 5 调查员 + 11 专属卡，P6 登记） |
| 关键词 | Myriad 14（字段）/ Swarming 11 敌 / Veiled 23 地点 / Researched 3 / Alert 5 / Hidden 18（16 本体 + 2 引用）/ Bonded 27 |
| 遭遇组 | 20/20 都有卡；与 P1 `scope.json` 的 388/352/36/8/20 逐项一致（`gate.scopeConsistent`） |
| 来源锁 | 参考实现 91 个文件 SHA-256（CardDefs 55 + 剧本 8 + 战役 6 + 主流程 1 + en/zh 剧情各 9 + 卡表 3） |
| watchlist | 6 个 absent 词 0 命中；`Patrol`/`Seal`/`Explore`/`Supply`/`swarm`/`curse` 已逐条登记「同名不同物」 |
| test:fast | P2 收尾出现 **2 条外部失败**（`decision-http.test.mjs` 的 4 座位用例）：大厅侧 17:09 的并发改动引入「AI 按 id/名字唯一」校验，而该用例只 mock 1 个 AI 却要 3 个席位。**已修复（2026-10-27）**：按新契约对齐测试（mock 4 个不同 AI + 3 个不同 id），该文件 18/18、全量 `test:fast` **3607 tests / 0 fail**。详见 [`tde-p2-report.md`](./tde-p2-report.md) §10 |

### 13.4 P3 批次 1 收尾证据（2026-10-27）

双战役骨架与 6 个数据模型原语已落地；逐项口径、schema 决策与未接线清单见 [`tde-p3-report.md`](./tde-p3-report.md)，
API 与边界见 [`tde-primitives.md`](./tde-primitives.md) §6 与 §5.5。

| 项 | 证据 / 实测 |
| --- | --- |
| 命令 | `npm run plan:tde:primitives`（写）/ `npm run audit:tde:primitives`（`--check`）；`--check` 复算一致 |
| 账本 | `artifacts/migration/tde/primitive-plan.json` + `primitive-catalog.json`；`batch: "P3-1"` |
| 结果 | **new 6/6 done**（campaignPart / recordInPart / seatPartMap / chaosBag.multiPart / inPart / partFlowCondition）、reuse 2、escape 3、deferred 11，`gate.pass=true` |
| 门禁 | `newPrimitivesHaveTests`、`docsPresent`、`reuseReadPoints 2/2`、`escapeRegistered 3/3`、`mechanismCoverage 9 条 primitive 机制：4 覆盖 + 5 显式延后`、`engineBoundary 0 卡号 / 0 战役名`、`replayZeroDrift`（13 局逐条一致） |
| 测试 | [`tests/tde-campaign-parts.test.mjs`](../tests/tde-campaign-parts.test.mjs) **21 例**：切 part 五步、跨线记录/勾销、2+2 / 2+1 / 非连续座位映射、两袋、`inPart` 还原（含抛错路径）、JSON 往返、模式与人数校验 |
| 实现 | [`src/campaign/campaign-parts.js`](../src/campaign/campaign-parts.js)：纯数据、不 import engine；`parts`/`seatParts`/`mode` 为可选字段 |
| schema | **仍为 7**（不升 8）：`stateHash` 包含 `schemaVersion`，现在升会让 13 局指纹全变、违反零漂移门禁；7→8 与 save-migration 推迟到 P5（R12） |
| 未接线 | `campaign-flow` 消费 `partFlowCondition`、`campaignView` 按 part 脱敏、hub 接 `validateModeSeats`、lane adapter 运行时重建 —— 全部属 P5（WP-3/4/5/8） |
| test:fast | **3628 tests / 3625 pass / 3 skipped / 0 fail**（`p3-fast-final.log`，含本批 21 例）。期间修掉一处由 `tests/suites.mjs` 变更触发的 TCU 玩家卡账本 stale（见 [`tde-p3-report.md`](./tde-p3-report.md) §7） |

### 13.5 P3 批次 2 收尾证据（2026-10-27）：6 条高风险机制原语

逐项 API 见 [`tde-primitives.md`](./tde-primitives.md) §7，报告见 [`tde-p3-report.md`](./tde-p3-report.md) §8。

| 项 | 证据 / 实测 |
| --- | --- |
| 原语 | `counter.investigator` / `enemy.swarmingValue` / `swarm.placeCards` / `location.veiled` / `tokenBag` / `location.verticalChain`（P3.7–P3.12） |
| 落点 | `src/engine/{counters,swarming,swarm,veiled,token-bag,vertical-chain}.js`；转发层 `src/engine/scenario-runtime-extras.js`；`scenario-runtime.js` 只加一行 spread |
| 账本 | `batch: "P3-1+2"`、**new 12/12 done**、deferred 5、`gate.pass=true` |
| 测试 | 6 个文件 **46 例**：四种 X 口径、缺 `x` 抛错、蜂拥清空前不可击败/溢出伤害、Veiled 三件事分开、蛛群袋确定性 rng、纵向链越界 `null`、计数器只读不建字段 |
| 机制覆盖 | 9 条 primitive 机制：7 覆盖（campaignPart/partRecord/seatPartMap/multiPartChaosBag/tokenBag/alarmLevel/verticalChain）+ 2 显式延后（epilogueMatrix/dreamGate） |
| 边界 | `src/engine` 无 `06` 卡号、无循环名（`engineBoundary` 由 8 命中修到 0：转发层改名 `scenario-runtime-extras.js`，注释去循环名） |
| 未接线 | 真实敌人实体生成、调查动作拦截、infestation test、纵向布局渲染 —— P8/P5 |
| test:fast | **3674 tests / 3671 pass / 3 skipped / 0 fail**（`p3b2-fast.log`，含本批 46 例）；`suites.mjs` 变更再次触发 TCU 账本 stale，按同一 remedy 重算后 `audit:tcu:check` 与 `tcu-migration.test.mjs` 6/6 通过 |

### 13.6 P3 批次 3 收尾证据（2026-10-28）：最后 5 条原语

逐项 API 见 [`tde-primitives.md`](./tde-primitives.md) §8，报告见 [`tde-p3-report.md`](./tde-p3-report.md) §9。

| 项 | 证据 / 实测 |
| --- | --- |
| 原语 | `location.placeBondedLocation` / `campaign.epilogueMatrix` / `deck.myriadLimit` / `location.doom` / `scenario.markerCount`（P3.13–P3.17） |
| 落点 | `src/engine/{bonded-location,myriad,location-doom,marker-count}.js` + `src/campaign/epilogue-matrix.js`；`bondedLocation` / `locationDoom` / `markers` 挂 `scenarioRuntime` |
| 账本 | `batch: "P3-1+2+3"`、**new 17/17 done**、deferred 0、`mechanismCoverage 9/9`、`gate.pass=true` |
| 测试 | 5 个文件 **33 例**：Bonded 成对放置/移除、16 格矩阵完整性、Myriad 按标题 3 张、地点毁灭阈值、参考卡计数只读 |
| replay | 外部提交 `6f60771 修bug` 使旧基线失效（786→782 步）；旧基线留档 `replay-before-2026-10-27.json`，当前 HEAD 重采后 `--compare` 逐条一致 |
| test:fast | **3750 tests / 3747 pass / 3 skipped / 0 fail**（`p3b3-fast.log`，含本批 33 例）；外部提交删掉的 TDE/TCU 账本已按工具重算恢复，`audit:tcu:check` 与 `tcu-migration.test.mjs` 5/5 通过 |
| 未接线 | 结局正文/分支、构筑 UI、议程联动、地点毁灭渲染 —— P5/P8/P8-T |

### 13.7 P4 收尾证据（2026-10-29）：关键词与规则书

逐项口径见 [`tde-rules.md`](./tde-rules.md)，过程与更正见 [`tde-p4-report.md`](./tde-p4-report.md)。

| 项 | 证据 / 实测 |
| --- | --- |
| 命令 | `npm run test:tde:rules` / `test:tde:rules:browser` / `audit:tde:rules:write` / `audit:tde:rules`（新增 4 条） |
| 账本 | `audit/tde-rules.json`（关键词 5 项 × 7、规则书 6 项、`gate.pass=true`）+ `audit/tde-browser-acceptance.json`（runner 生成） |
| 关键词 | **7/7 verified**：Myriad / Swarming X / Veiled / Researched / Alert / Hidden / Bonded；每条 `deferred` 显式列出 P5/P7/P8 待接线 |
| 规则书 | **17 条 verified**（原建议 16 条 + D5 新立 `tdeBonded`）：两条线、两套袋、55 记录键、16 段尾声、7 关键词、梦境之门、蛛群袋、警报等级、神迹、剧情支援、地点上的毁灭 |
| 卡文直达 | 388/388 张 06 卡连到 `tdeCampaign`；外循环链接 0；判据与 `keywords.js` 的 `pattern` 逐张对齐 |
| Node | `tests/tde-rules.test.mjs` **15 例**：关键词 5 项、388 张逐张、17 条结构、规则内容与禁用词、搜索、8 章、两袋构成、6 组引擎行为 |
| 浏览器 | `tests/tde-rules.browser.mjs` **4 条**（1440×950 / 390×844 × 规则目录+卡牌直达），截图 2 张；`desktopBrowser`/`mobileBrowser` 只认 runner 账本 |
| 机制登记 | 11 个 `tde*` 能力项；6 条战役层条目不登记（P5/P8），测试显式断言 |
| **P3 口径更正** | ① `location.veiled`：改为「已揭示面入场 + 无线索时 [fast] 翻面 + 翻过一次不能再翻」（官方 `rules.veiled`）；② `location.doom`：改为「地点上的毁灭标记」（06 段无「毁灭地点」规则）。删除 5 个错误导出，测试重写，原语账本重算 `new 17/17 done`、`gate.pass=true` |
| 副作用处置 | 外部提交 `42aa746` 让原语账本 stale（`scenario-runtime` 键数 190→241）：P4 重算吸收；`suites.mjs` 新增测试后按 P3 的 remedy 重算 TCU 账本；replay `--compare` 13 局零漂移 |
| test:fast | **3875 tests / 3872 pass / 3 skipped / 0 fail**（`p4-fast.log`，含本批 15 例）；`docs:check` 36 文件 / 269 链接全部可解析（文件数低于 P0 基线属外部删除 TCU 文档，非 TDE 改动） |
| 未接线 | 敌人形态隐私、蜂拥实体、翻面动作、梦境日记记录键、绑定弱点敌人、章节 `scenarioCards` 映射、剧情正文 —— P5/P7/P8/P8-T |

### 13.8 P5 批次 1 收尾证据（2026-10-29）：模式策略、章对门与双线投影

逐项口径见 [`tde-interactions.md`](./tde-interactions.md) 与 [`tde-p5-report.md`](./tde-p5-report.md)。

| 项 | 证据 / 实测 |
| --- | --- |
| 模式策略 | [`campaign-modes.js`](../src/campaign/campaign-modes.js)：`modeOptions`（1–4 人 × 四模式的可用性 + 置灰原因）、`modePlan`、`defaultSeatParts`（并行等分 / 分选交替）、`assignSeatPart`（仅分选、两线各 ≥1）、`describeModePlan` |
| 章对门 | [`part-flow.js`](../src/campaign/part-flow.js) 的 `dualPartFlow` / `singlePartFlow` / `partFlow` / `validatePartManifest`；`campaign-flow.js` 新增 `partGate` 节点（0 出口走幕间、1 出口自动、2 出口问玩家） |
| 16 排列 | 4 个章对 × 2 种先手全部跑通：每章恰好一次、逐对屏障成立、16 条序列互不相同 |
| 双线条件 | `flowCondition` 支持 `part/parts/mode/modeIn/activeParts`，可与 `all/any/not/completed/record/compare` 嵌套（与关系） |
| 投影脱敏 | [`campaign-parts.js`](../src/campaign/campaign-parts.js) 的 `partScopedView`（由 `campaignView` 调用）：非活动线只给记录/经验/创伤/胜利/袋与牌组张数，`storySections`/`deck`/`purchases` 不投影；无 parts 战役逐字节不变 |
| 交互清单 | [`interactions.js`](../content/campaigns/theDreamEaters/interactions.js) 10 条定稿（触发/章节/机制 id/hook/归属/blockers），全部 `pending`；P2 的两条 interaction 机制被覆盖 |
| 测试 | `tests/tde-modes.test.mjs` 7 例 + `tests/tde-dual-flow.test.mjs` 7 例（含 16 排列、存档往返、隐私、清单校验），登记 FAST；命令 `test:tde:pick` / `test:tde:dual` |
| replay | `replay-fixtures --compare` 13 局逐条一致（非 TDE 行为零变化；`partGate` 与投影只对声明 parts 的战役生效） |
| test:fast | **3889 tests / 3886 pass / 3 skipped / 0 fail**（`p5-fast.log`，含批次 1 的 14 例；批次 2 收尾时全量为 3894/3891） |
| 未做 | hub 四模式 UI 与按线选人（批次 2）、lane adapter 与并行双运行时 D8-C（批次 3）、浏览器桌面/移动证据、`confirmations.interactions` 的 `verified` |

### 13.9 P5 批次 2 收尾证据（2026-10-29）：hub 四模式开局与按线准备

逐项口径见 [`tde-p5-report.md`](./tde-p5-report.md) §8。

| 项 | 证据 / 实测 |
| --- | --- |
| 模式化清单 | `campaignManifestFor`（engine.js）在声明 `parts` 且选定模式后返回 `partManifest(manifest, mode)`：单线只排本线章节、双线 A/B 交错；未声明 parts 原样返回（replay 零漂移） |
| hub 动作 | `hubSetMode`（四模式，置灰项带 `disabled` + 原因）、`hubSetSeatPart`（仅分选、两线各 ≥1）、`hubGoSetup`（单线/双线均可准备） |
| 落库 | `dispatch` 复核 `modePlan` 后写 `campaign.mode/seatParts/activeParts/currentPart/parts`，重置 `scenarioIndex` 与 `hubSelectedScenarioId` |
| 按线准备 | 非活动线座位经 `inPart` 把 campaign record 写进 `parts[line]`；`hub.js` 按座位所属线取 record（自动构筑/确认准备） |
| 跨线校验 | `hubInvestigatorChoices` 合并活动线 + 全部 `parts` 快照的现役/退役记录，同一调查员不能同时出现在两线 |
| 双线 gate | `hubBeginScenario` 对 `pick`/`parallel` 抛明确原因（lane adapter 属批次 3），不静默按整桌开局 |
| 测试 | [`tests/tde-hub-modes.test.mjs`](../tests/tde-hub-modes.test.mjs) **5 例**：奇数并行置灰、单线 A/B 真正开局、分选 2+1 改线与按线 record、并行 4 人准备 + gate；`test:tde:pick` 命令同时跑 modes + hub |
| 回归 | `hub-concurrent` / `flow-n5` / `campaign-experience` / `campaign-http-n4` / `content-*` 共 56 例全绿；replay 13 局零漂移 |
| test:fast | **3894 tests / 3891 pass / 3 skipped / 0 fail**（`p5b2-fast.log`，含本批 5 例）；`docs:check` 36 文件 / 278 链接全部可解析 |
| 未做 | `web/hub.js` 的模式面板与浏览器证据（依赖 P8 注册真实战役）、lane adapter、并行双运行时、`confirmations.interactions` 的 `verified` |

### 13.10 P5 批次 3 收尾证据（2026-10-29）：lane adapter 与双运行时容器（协议层）

逐项口径见 [`tde-p5-report.md`](./tde-p5-report.md) §9。

| 项 | 证据 / 实测 |
| --- | --- |
| lane adapter | [`src/campaign/lane-adapter.js`](../src/campaign/lane-adapter.js)：`toLaneCommand` / `toRoomSeatValue` / `seatsToRoom` / `seatsToLane` / `pendingChoiceToRoom` / `laneViewFor` / `assertDenseRuntime` / `tagEventLane` / `visibleToLane` / `laneSummary`；非双线战役原样透传 |
| 双运行时容器 | [`src/campaign/dual-runtime.js`](../src/campaign/dual-runtime.js)：`createDualRuntime` / `commitLane`（全局 revision + 线内 revision；同线旧版本拒绝、全局过期重基）/ `markAwaitingPair` / `sealPairOnce`（只封一次、幂等）/ `serializeDualRuntime` / `restoreDualRuntime` / `commitBoth` |
| 测试 | [`tests/tde-lane-adapter.test.mjs`](../tests/tde-lane-adapter.test.mjs) 7 例 + [`tests/tde-dual-runtime.test.mjs`](../tests/tde-dual-runtime.test.mjs) 8 例；命令 `test:tde:runtime` |
| 协议门禁 | 双版本（同线旧版本拒绝 / 全局过期重基）、跨线同时提交两种顺序都保留、屏障只跑一次幕间、单文件存档往返逐字节一致、事件 lane 可见性 |
| 未接线 | 运行时重建（`state.investigators` 密集座位 / humanSeats / leadSeat / currentSeat）、引擎边界（applyMove/validateMove/legalMoves/viewState/viewEvents）、并行管线（事件/AI/存档）、`test:tde:parallel`、交互 UI 与浏览器证据 |
| test:fast | **3909 tests / 3906 pass / 3 skipped / 0 fail**（`p5b3-fast.log`，含本批 15 例）；`docs:check` 36 文件 / 287 链接 |


### 13.11 P5 批次 3 收尾证据（2026-10-29）：分选关卡运行时与大厅边界

逐项口径见 [`tde-p5-report.md`](./tde-p5-report.md) §10。

| 项 | 证据 / 实测 |
| --- | --- |
| 运行时重建 | [`src/engine/lane-runtime.js`](../src/engine/lane-runtime.js)：`enterLaneRuntime` / `leaveLaneRuntime` / `laneSeatForRoom` / `roomToLaneSeat`；关卡内 campaign record 以 laneSeat 为键并带 `roomSeat`，离开清掉 |
| hub 接线 | `hubBeginScenario` 按目标关卡所属线 `setPart` + `enterLaneRuntime`；`ScenarioEnded` 先 `leaveLaneRuntime`；`initialHubScenarioMoves` 支持 `partGate` 起点 |
| 大厅边界 | [`index.js`](../index.js)：`legalMoves/validateMove/applyMove/decisionSeat/actingSeats/seatLocalMove/viewState/describeState/autoChoice` 全部按 `state.laneRuntime` 转换；另一条线座位给「另一条线」原因 |
| 结算日志 | `scenarioResults[].investigators[].seat` 记 roomSeat |
| 测试 | [`tests/tde-lane-runtime.test.mjs`](../tests/tde-lane-runtime.test.mjs) 7 例：3 人分选 2+1 → A1；密集座位/记录键；room2→lane1 行动；B 线座位无行动权；观察投影；私有事件座位；离开还原与快照键；非双线 no-op |
| 回归 | `tde-hub-modes` 的「分选只能准备」改为「可进入 A1」；`test:fast` **3914 / 3911 / 3 skipped / 0 fail**（`p5b3b-fast.log`）；replay 13 局零漂移 |
| 未接线 | 并行双运行时接引擎/观察/AI/存档（`parallel` 仍 gate）、`test:tde:parallel`、交互 UI 与浏览器证据（事件座位与快照键已在 §13.11 补齐） |


### 13.12 P5 批次 3 收尾证据（2026-10-29）：并行双运行时管线与开局模式面板

逐项口径见 [`tde-p5-report.md`](./tde-p5-report.md) §11。

| 项 | 证据 / 实测 |
| --- | --- |
| 并行管线 | [`src/integration/parallel-runtime.js`](../src/integration/parallel-runtime.js)：`launchParallelLanes`（两份完整运行时、各自 part scope/混乱袋/开局事务）、`parallelApplyMove`、`parallelDecisionSeats`、`parallelView`、`serializeParallelState` / `restoreParallelState`、`markLaneFinished` / `advanceParallelPair` |
| 大厅路由 | [`index.js`](../index.js)：`isParallelState` 时 `legalMoves/validateMove/applyMove/decisionSeat/actingSeats/seatLocalMove/viewState/describeState/autoChoice` 全部走并行路由 |
| 开局模式面板 | [`web/hub-mode-view.js`](../web/hub-mode-view.js) + [`web/hub.js`](../web/hub.js) 战役总览：四模式按钮、置灰原因直显、分选逐座位分线；`hub.mode.*` 中英词典 |
| 测试 | [`tests/tde-parallel.test.mjs`](../tests/tde-parallel.test.mjs) 6 例 + [`tests/tde-mode-panel.test.mjs`](../tests/tde-mode-panel.test.mjs) 4 例 |
| 回归 | `test:fast` **3926 / 3923 / 3 skipped / 0 fail**（`p5b3d-fast.log`）；replay 13 局零漂移；`docs:check` 36 文件 / 310 链接 |
| 仍未开闸 | `hubBeginScenario` 对 `parallel` 仍返回原因：双线大厅 UI/回滚/检查点归 P9.5；交互 1 浏览器截图等 P8 注册 parts 战役 |

### 13.13 P5 批次 3 收尾证据（2026-10-29）：并行开闸机制与模式面板浏览器证据

逐项口径见 [`tde-p5-report.md`](./tde-p5-report.md) §12。

| 项 | 证据 / 实测 |
| --- | --- |
| 开闸开关 | 战役 manifest `dualLineGate`；[`index.js`](../index.js) 在 `hubBeginScenario` 上启动 `launchParallelLanes`，纯引擎仍拒绝 |
| 章对屏障 | `parallelApplyMove` 检查 `sealed[pair]`；未封盘时本线 `hubBeginScenario` 返回「另一条线尚未结算」 |
| 观战/状态 | `parallelPublicView`（无手牌/牌库）与 `syncParallelStatus`（两线都结束才 `ended`） |
| 测试 | [`tests/tde-parallel.test.mjs`](../tests/tde-parallel.test.mjs) 9 例（含大厅开闸、闭闸拒绝、屏障） |
| 面板浏览器证据 | [`tests/tde-modes.browser.mjs`](../tests/tde-modes.browser.mjs) 桌面 1440 + 移动 390；[`audit/tde-ui-browser.json`](../audit/tde-ui-browser.json) 2 条通过 / 4 张截图 / `desktopBrowser`+`mobileBrowser` true；命令 `npm run test:tde:modes:browser` |
| 演示战役 | [`content/browser-demo/dualHub.js`](../content/browser-demo/dualHub.js)，仅 `ARKHAM_BROWSER_DEMO=dualHub` 注册 |
| 回归 | `test:fast` **3930 / 3927 / 3 skipped / 0 fail**（`p5b4-fast.log`）；replay 13 局零漂移 |
| 未开闸 | 真实 TDE 仍 `catalog-only`，manifest 未置 open；P8 内容 + P9.5 矩阵验收后才打开 |

### 13.14 P5.5 并行交互 W1 证据（2026-10-29）：首屏模式门与自由分线

完整盘点、线框与波次：[`tde-parallel-interactions.md`](./tde-parallel-interactions.md)（24 处交互点）。

| 项 | 证据 / 实测 |
| --- | --- |
| 首屏模式门 | `web/hub.js`：`campaign.requiresMode` 投影 + `hubSetMode` 才整屏拦截；第五循环（食梦者）专属；非房主席位显示「等待房主」；其它循环照旧 |
| 自由分线 | `assignSeatPart` 支持 parallel、`hubSetSeatPart` 允许 pick/parallel；`web/hub-mode-view.js` 输出 assignments/laneCounts/balanced |
| 人数相等门 | `laneBalance` → `hubBeginScenario.disabled` + 原因；`parallelLaunchLanes` 拒绝不平衡；大厅边界同样拒绝 |
| 测试 | `tde-mode-panel` 7 例 + `tde-hub-modes` 6 例（3:1 置灰、2:2 可开始、边界拒绝） |
| 浏览器 | [`audit/tde-ui-browser.json`](../audit/tde-ui-browser.json)：**8 条通过 / 14 张截图** / 桌面+移动 true（模式门、自由分线、出发准备分屏、人物卡内一键换位置、局内单线+后台双线、非双线回归）；`npm run test:tde:modes:browser` |
| 回归 | `test:fast` **3944 / 3941 / 3 skipped / 0 fail**（`p5b12-fast.log`）；replay 13 局零漂移 |
| W2 出发准备分屏 | `web/departure-lanes.js` + `departure()`：A/B 两栏竖线、每线关卡名/插图（`partScenarios` 投影）、双线队长、唯一「换位置」弹窗、通用按钮重排；浏览器 2 条用例（桌面/移动） |
| 局内不做分屏 | 按用户决定：牌桌保持单线视图，另一条线在后台由双运行时处理；浏览器烟雾用例验证 `.ah-table` 正常、无分屏容器 |
| 联机评估 | [`tde-parallel-online-assessment.md`](./tde-parallel-online-assessment.md)：主机/其他玩家/AI/观战/存档逐项；**P0 已修**（`pendingChoice` 钩子、`commitChoiceBatch` 并行分支、观战公开投影、联机版本号剥离）；**P1 已修**（逐章对双线检查点/任一队长回档、真人自助换线 + 房主仅 AI）；仍剩 AI 上下文/事件 tableState/迁移体积 |
| 未做 | 交互 2 专属面板；P9.5 矩阵与真实 TDE 内容 |

### 13.15 P6 收尾证据（2026-10-29）：M1 调查员

逐人状态与命令见 [`tde-investigators.md`](./tde-investigators.md)，过程与偏差见 [`tde-p6-report.md`](./tde-p6-report.md)。

| 项 | 证据 / 实测 |
| --- | --- |
| 单卡文件 | `src/cards/entries/06001`–`06014`、`06016`、`06017`（16 个；06015a/b 是绑定地点，本轮无条目） |
| 可用性 | `availability.js`：`TDE_INVESTIGATOR_CODES`、`SELECTABLE_INVESTIGATOR_CODES`、5 条 `SIGNATURES_BY_INVESTIGATOR`、strict / dependencyOnly / 原因文案；**AI 池 `PLAYABLE_INVESTIGATOR_CODES` 不扩容**（池子变长会让旧种子局 AI 选人漂移） |
| 构筑 | 30/30/30/30/42 张、专属卡与随机基础弱点、手动构筑同一套服务端规则；曼蒂/托尼的 `faction_select`+`type`+`limit:10` 在 `web/deck-rules.js` 翻成允许项（`deck_size_select` 仍只支持 30） |
| P6 原语 | **9 条**：`assetDefeat`、`harm.moveBetween`、`counter.card`、`investigator.restrictedAction`、`search.modify`、`search.cardInPile`、`upkeep.replaceDraw`、`investigator.cardRules`、`play.fromHandFree`；账本 `new 26/26 done`、`deferred 5`、`gate.pass=true` |
| 逐人账本 | [`audit/tde-investigators.json`](../audit/tde-investigators.json)：18 条记录（16 主 + 2 面）、`gate.pass=true`、**verified 3/5**（06001/06002/06003）、pending 2（06004→P8、06005 仅 06017→P7）、simplified 4 条全部带 `note` |
| 测试 | [`tests/tde-investigators.test.mjs`](../tests/tde-investigators.test.mjs) **24 例**：可用性/构筑/副职业/开局存档/P6 原语/逐人能力/简化登记；`tests/suites.mjs` + `tests/node-suite.mjs` 记为 FAST |
| 命令 | `test:tde:investigators` / `audit:tde:investigators` / `audit:tde:investigators:write`（新增 3 条） |
| 回归 | replay 13 局零漂移；`test:fast` **3968 tests / 3965 pass / 3 skipped / 0 fail**；`cards:check` 索引 584 张、合规 0 新增 |
| 连带 | `availability.js` 是 TCU 玩家卡账本的证据文件 → 按 remedy 重算 `audit-tcu-player` + `audit-tcu`（87/87、6/6、377/377 通过）；`audit/ability-coverage.json` 因 16 条目 + 2 窗口重算（engineCodes/effects 仍 0） |
| 顺带修正 | `lookZoneAdapter` 写死「只看 3 张」→ 按 `count` 取牌（曼蒂的 +3 才可见；既有无改动，replay 零漂移） |
| 显式简化 | 06004/06013/06014（P8：虚拟地点 + 梦境之门地点）、06017（P7：隐私敌人）；三条都写进 `DEFERRED_PRIMITIVES` 或条目 `note` |
| 未做 | 06015a/b 地点行为、卢克事件如同位于连接地点、06017 隐私敌人、TDE 并入 AI 池（P10） |

## 14. 附录

### 14.1 初勘口径与差异

- 卡号口径：06 号段 = `/^06\d{3}[a-z]?$/`；主卡 = 无字母后缀；关联面 = 带字母后缀。四份参考卡表（cards_zh-cn/en/zh/cards）与 `src/cards/cards-data.js` 的 388 个卡号集合一致、7 个关键字段 0 差异。
- 三包分类规则先用 TCU 05 段复算得 237/19/87/377，与 `artifacts/migration/tcu/scope.json` 完全一致后才用于 TDE；因此 TDE 的 283/18/87 可与 TCU 口径互证。
- 与 TCU 的规模对照（排期锚点）：TCU = 377 记录 / 9 章 / 16 关键词 / 11 交互 / 14 新原语 / 5 browser spec / 28 例 / 30 截图 / `gate.pass=true`；TDE = 388 记录 / 8 章 / 新增关键词 4 + 复用确认 3 / 交互 ~10 / 新原语候选 21 + 1 复用 / 双线架构 1 个大课题。
- 不确定项（M0 正式扫描锁定；**P1 已销账 4 项**）：~~`DarkCult↔pentagram`~~（卡池 `encounterName='Dark Cult'` 证实）、~~跨循环通用组库存~~（8/8 目录可用）、~~当前 `test:fast` 失败集合~~（0 fail，2 条既有红属 P6/Carcosa 账本）、~~`Beyond the Gates of Sleep` 遭遇牌库~~（确认无 `gather Set.*`，转 `pending`）；仍待定：`achievements` 范围（默认 out-of-scope）、Swarming 印刷卡数（初勘 11 vs 英文机检 9，P2 复核）。
- 初勘口径修正（M0 以权威为准）：`mechanism-draft` 的「354 主卡 + 34 面」为初勘错误；权威值 = **352 主卡 + 36 面**。`gaps.md` 曾报告 31/37 条断链；P0 恢复 9 篇 TCU 文档后实跑 `npm run docs:check` 为 **43 文件 / 376 条本地链接全部可解析**（P0 前为 22/61，因文档被删被动偏小），断链数字降为历史记录，不再列作当前阻塞。
- 旧双 part / `pick` 评估（2026-10-27）：`recon/fullmode/impact.md`；三档累计口径 9 / 34 / 42 文件，550–850 / 1,900–3,100 / 2,300–3,500 行；结论为「活动线占主字段 + 另一线快照」，既有 13 局回放零漂移前提成立。该评估不含 D8-C lane adapter、座位映射、事件隔离与提交/保存协调，不能作为 `parallel` 报价。
- AB 双线事实复核（2026-10-27，参考实现代码级）：3 种玩法；A/B 四对配对，每对可先 A 或先 B，同对两章都完成才进幕间；开局 + 3 幕间 = 16 种合法排列；A4×B4 = 16 段尾声；切 part 五步（存快照/载入/带过进度/换玩家/`SetInvestigator`）；4 人 = 8 名调查员 / 8 套牌组，整桌切换、无替补待机。来源：`Campaign/Campaigns/TheDreamEaters.hs`、`Campaigns/TheDreamEaters/{Meta,ChaosBag}.hs`、`CampaignStep.hs`；前端双日志见 `CampaignLog.vue:144-234`，跨线选人校验见 `ChooseDeck.vue:284-290`。
- 剧情自译评估（2026-10-27）：`recon/story-gap/report.md`；en `textChars` 194,299、可复用 45,221、净需译 147,718、约 44k–56k 中文字符、14 批、约 23–36 人日；15 段正文疑似节译须重译（11 条短记录键可复用）；`epilogueMatrix` 控制标记需专门处理。
- P1 实测（2026-10-27，`scope.json` 取代初勘）：388 = 352 主卡 + 36 面；三包 283/18/87；20 组 = 8 章 253 + 12 共享 30；印刷包 112/62/41/40/54/47/32；43 个来源（参考 38 + 仓内 5）逐文件 SHA-256；`replay-before` 与 golden 13 局 / 786 步 / 799 指纹逐条一致；本地卡图 en/zh 各 388/388；初勘的「354 主卡 + 34 面」「46 个来源」「缺图 387 条」「卡图仅 1 张」全部作废。
- P2 实测（2026-10-27，`mechanism-scan.json` 取代初勘）：38 条机制的类型分布与初勘一致（keyword 7 / primitive 9 / rulebook 6 / scenario 11 / interaction 2 / content 3）+ 1 baseline；关键词 14/11/23/3/5/18/27 全部实测（初勘「Swarming 英文机检 9」是漏了 `[per_investigator]` 与 X 写法）；分级 173/151/64 与初勘 182/156/50 的差额集中在调查员专属卡（P6 登记）；初勘的「38 条 / 类型分布」自此可作为复算基线。

### 14.2 与迁移规范的对应关系

| 规范条目 | 本文落点 |
| --- | --- |
| §3 目标目录 | §10.1、§8.3 |
| §4.1 第 0 步 | §3 |
| §4.2 第 1 步 | §4 |
| §4.3 第 2 步 | §5 |
| §4.4 第 3 步 | §6 |
| §4.5 / §4.5.1 第 4 步 | §7.1；`scenario.scriptCards` 在 M3 逐章验收 |
| §4.6 第 5 步（多子进程/原语队列） | §9 |
| §4.7 第 6 步 | §11 |
| §4.8 M0–M5 | §2、§8 |
| §5 / §5.1 / §5.2 剧本确认 | §8.3、§8.5（自译来源口径）、§11.2 |
| §6 / §7 关键词与规则书 | §6 |
| §8 审计状态与发布门槛 | §11.2 |
| §9 最低验证命令 | §11.1 |
| TDE 双线（四种开局） | §1.4（官方事实）、§1.4.1（本产品四种开门口径）、§7.2（架构）、§7.3（改动量）、§7.4（旧整桌口径，仅存档）、§7.5（D8 三案，C 已定为实施方案）、§7.5.1（联机代价）、§7.5.2（D8-C 口径）、§11.2（开闸门禁） |

### 14.3 维护规则

1. 本文随阶段推进更新：每个 P 阶段收尾时补「产物与证据路径」，但**不得**把计划项改写成「已完成」，除非有 `--check` 过的账本或测试证据。
2. 所有数字以工具输出为准；初勘数字（本文件 §1）在 P1 被 `scope.json` 取代后，本文只保留指路，不重复数字。
3. 决策 D1–D9 一旦拍板，在本文件与对应卫星文档同步记录「决策 + 日期 + 依据」。
4. 卫星文档、账本、代码同一提交；先改代码再 `--write`，提交前跑对应 `--check`。
5. 2026-10-27 路径重排：双 part 骨架前移到 P3，P5 只暴露 A/B，P9.5 只做双线开闸；再改路径时同步更新 §2、§5.5、§7.2–§7.5、§11.2、§13 与 D1 记录。
6. 2026-10-27 玩法口径定稿：产品枚举固定为 `singleA/singleB/pick/parallel`，奇数人数禁用 `parallel`，每座位一套牌组、线归属走 `campaign.seatParts`；`pick` 在每个章对独立选择先手，共 16 种合法排列；`officialFull` 的每人两套/整桌切换只留 §7.4 来源事实。再改玩法时同步更新 §1.4.1、§7.1、§7.2.2、§7.4、§7.5、§11.2、§12 R15/R16、§13 与 D8 记录。
7. 2026-10-27 D8 决策：并行双线采用 **D8-C**（单房间、单房主、单存档、双运行时、并发推理、全局串行提交、关卡屏障）；同批拍板五个细节——**两边结算后自动进幕间**、等待期**只见自己的结算**、**AI 两线并存且请求并发**（不轮转排队）、**幕间两边读全文**、**一套存档（单文件）**。实现硬约束包括房间/线内座位映射、全局/线内双版本、事件 lane 过滤与单文件保存队列。D8-A/D8-B 仅作备选。再改 D8-C 口径时同步更新 §1.4.1、§7.2.2、§7.2.3（WP-8）、§7.5、§7.5.2、§11.2、§12 R15、D8/D9 记录。
