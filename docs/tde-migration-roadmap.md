# 《食梦者》迁移路线图（TDE，五循环）

> **状态口径**：`draft` · 尚未开工。TDE 当前是 `catalog-only`：卡面数据已在 `src/cards/cards-data.js`，但**不可选人、不可构筑、不可启动**；本文是**计划文档**，不是完成报告，不含任何「已实现 / 已验收 / 规则等价」声明。
> 起草：2026-10-27；依据 [`arkham-content-migration.md`](./arkham-content-migration.md)（迁移规范）的六步顺序与 M0–M5 产物范围，分层约束见 [`ARCHITECTURE.md`](../ARCHITECTURE.md) §3–§9；仓库基线 HEAD `e0dc5bd`、规则版本 `n6.0`。先例：TCU（四循环）已完整交付的全链路产物，本文的数字级类比均以 `audit/tcu-migration.json` 为锚点。
> 阅读顺序：[`arkham-content-migration.md`](./arkham-content-migration.md) → 本文 → M0 之后按阶段新建的 8 篇卫星文档（`docs/tde-primitives.md`、`tde-rules.md`、`tde-interactions.md`、`tde-investigators.md`、`tde-player-cards.md`、`tde-scenarios.md`、`tde-story.md`、`tde-release.md`；骨架见 §8.3）。
> 数据来源：`artifacts/migration/tde/recon/` 三份只读初勘（`scope/scope-draft.*`、`mechanism/mechanism-draft.*`、`baseline/{inventory.json,gaps.md,baseline.md}`），以及 2026-10-27 补充评估 `recon/fullmode/impact.md`（FullMode 改动量）与 `recon/story-gap/report.md`（自译缺口）。初勘数字**不是正式账本**，M0 由 `npm run scan:tde:scope --write` 重新生成 `artifacts/migration/tde/scope.json` 后才算锁定。

## 0. 一页结论

| 项 | 结论 |
| --- | --- |
| 目标 | 按六步顺序把 TDE（06 号段）迁移为可启动、可存档重放、三组确认齐备的战役；先例与门禁全部照 [`arkham-content-migration.md`](./arkham-content-migration.md) §4–§9，不另立规矩 |
| 范围 | **388 条印刷记录 = 352 主卡 + 36 关联面**；内容包分区 `tdeCampaign` 283（249+34）/ `tdeInvestigators` 18（16+2）/ `tdePlayer` 87；印刷包 7 个（tde 112 / sfk 62 / tsh 41 / dsm 40 / pnr 54 / wgd 47 / woc 32） |
| 章节 | **8 章** = 双战役各 4 章（A 梦寻：Beyond→Search→DarkSide→WhereGods；B 梦网：Waking→ThousandShapes→PointOfNoReturn→Weaver）；20 个遭遇组 = 8 章节组 + 12 共享组 |
| 玩法结构 | 官方三种玩法：A 单独 4 章 / B 单独 4 章 / **FullMode 交错 8 章**（每人两套牌组、两条 Campaign Log、两袋混乱袋）；参考实现见 `Campaign/Campaigns/TheDreamEaters.hs`（845 行） |
| 初勘缺口 | 机制条目 38（primitive 9 / keyword 7 / rulebook 6 / scenario 11 / interaction 2 / content 3），覆盖 388/388；新增关键词 4（Myriad 14 / Swarming 11 / Veiled 23 / Researched 3），已有待确认 3（Alert 5 / Hidden 18 / Bonded 27）；原语候选 21 新增 + 1 复用，escape 3 |
| 里程碑 | M0 目录与来源基线 → M1 调查员（5 位）→ M2 玩家卡（87 张，4 批）→ M3 剧本（8 章）→ M4 关键词与规则书 → M5 发布（`playable` + `earlyAccess`，`equivalenceCertified: false`） |
| 当前阻塞 | ① 中文剧情源不完整——**已决策自译补齐**（2026-10-27）：en 源 194,299 字符、净需翻译 147,718，预计约 50k 中文字符、14 批、单人约 3–5 周；② FullMode 的实测改动量：spike 550–850 行、最小可用 1,900–3,100 行（34 文件 / 54–71 例）、完整 2,300–3,500 行；不做 FullMode 时只剩 40–90 行「按线基础袋」缺口；③ 06 段本地卡图仅 1/388；④ 既有 37 处文档断链 + TCU 三本账本漂移，会让 TDE 的 `docs:check` / 审计门禁无法直接全绿 |
| 诚实边界 | 上述任一未完成时，TDE 只能停在 `catalog-only` / `development`；发布最多 `playable` + `earlyAccess`，逐条剩余写入 `remaining` 与 `scenarioApproximations`，**不宣称规则等价** |

一句话判断：**TDE 的规模与 TCU 同级（388 vs 377 条记录），但结构难度更高——双战役、双牌组、两袋混乱袋、蜂拥/掩藏两个新关键词族，以及一份明显不完整的中文剧情来源。路线图必须先把「FullMode 做到什么程度」和「剧情来源怎么补」两个决策钉死，再进入卡牌批量迁移。**

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

### 1.4 三种玩法的规则事实（来源：英文战役规则 `campaignStructure` + 参考实现）

- **A《梦寻》单独 4 章**：Beyond → Search for Kadath → Dark Side → Where the Gods Dwell；使用 A 的混乱袋与 A 的 Campaign Log。
- **B《梦网》单独 4 章**：Waking Nightmare → Thousand Shapes → Point of No Return → Weaver；使用 B 的混乱袋与 B 的 Campaign Log。
- **FullMode 交错 8 章**：每对平行章可互换顺序，每对完成后进入幕间（黑猫 I / Oneironauts II / Great Ones III），末对完成后按 8 条记录 × 16 段矩阵进入尾声；**每位玩家为 A/B 各建一套调查员牌组**，切换线别时整组调查员替换；两线各有独立记录与混乱袋，幕间可跨线写入/勾销记录（参考实现 `Meta.hs` / `Campaigns/TheDreamEaters.hs:126-202,261-385`）。
- 混乱袋（`Campaigns/TheDreamEaters/ChaosBag.hs`，8 组）：A 线 14/14/15/16 枚（Cultist+Tablet+AutoFail+ElderSign，无骷髅/古神）；B 线 17/17/18/19 枚（Skull+ElderThing+Cultist+AutoFail+ElderSign，无石板）。
- 战役记录键 **55 个**（`Campaigns/TheDreamEaters/Key.hs`），中文 `key.*` 覆盖 55/55（`locales/zh/theDreamEaters/base.json`）。

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

- 来源清单初勘共 **46 个文件** 的 SHA-256 台账（`recon/scope/scope-draft.json` 的 `sources`）；P1 由 `scan:tde:scope --write` 重算并锁定，来源漂移时 `--check` 必须失败。
- 迁移前基线：`git rev-parse HEAD` = `e0dc5bd`；golden replay **13 局 / 786 步 / 799 逐步指纹**（规则 `n6.0`，schema 7）；`test:fast` 的 fast tier 现有 158 个测试文件（slow 13 / assets 16），**当前失败集合必须 M0 重采**（初勘按要求未跑全量测试）。
- 卡图：`web/img/cards`（英文）0 张 06、`web/img/zh/cards` 仅 `06327.avif` 1 张；远程回退字段 `imagesrc/backimagesrc` 可用。**不得**为 TDE 新建循环专属卡图目录或改名副本。

## 2. 执行顺序（规范 §4 的六步，不可交换）

```text
P1 锁定范围与基线 → P2 扫描新增机制 → P3 拆分原语 → P4 关键字与规则手册
  → P5 实现新增交互与界面 → P6–P8 批量迁移卡牌/调查员/剧本（多子进程 + 原语队列）→ P9–P10 测试与验收
```

M0–M5 是内容阶段与产物范围（§4.8），不是执行顺序：扫描、原语、关键字、交互都可并行推进，不必等全部剧本迁完。下图是路线图的阶段结构（P 编号为本路线图的工作阶段，M 为内容里程碑）：

| 阶段 | 名称 | 对应内容里程碑 | 主产物 |
| --- | --- | --- | --- |
| **P0** | 前置清理与规范勘误 | — | 文档断链清零方案、TCU 账本漂移处置、基线重锁、`.gitignore`、规范勘误 |
| **P1** | 范围与来源锁 | M0 | `scan:tde:scope`、`artifacts/migration/tde/scope.json`、`replay-before.json` |
| **P2** | 机制扫描 | M0 | `scan:tde`、`mechanism-scan.json`、`_review.md` |
| **P3** | 拆分原语（含双战役技术验证） | M0 | `plan:tde:primitives`、`primitive-plan.json`/`primitive-catalog.json`、双线切片 spike |
| **P4** | 关键词与规则书 | M4 | `confirmations.keywords/rulebook` 证据、规则书条目、`test:tde:rules*` |
| **P5** | 新增交互与界面 | M4 | 交互组件/`presentation-state` 字段/浏览器验收、桌面 1440 + 移动 390 截图 |
| **P6** | M1 调查员 | M1 | `content/packs/tdeInvestigators/manifest.js`、5 人逐人验收 |
| **P7** | M2 玩家卡（4 片） | M2 | `src/cards/entries/<code>.js` × 87、分片/队列报告、逐卡账本 |
| **P8** | M3 剧本（8 章） | M3 | `content/campaigns/theDreamEaters/scenarios/<id>/**`、逐章 12 项检查 |
| **P8-T** | 剧情自译补齐（可与 P3–P8 并行） | M3-C | 14 批自译源 + 术语表 + 来源锁 → `story-text.js`（§8.5） |
| **P9** | 全卡账本与逐章验收 | M3/M4 | `audit/tde-all-card-acceptance.json`、`tde-scenario-acceptance.json`、逐卡 `literalCardBehavior` |
| **P9.5** | FullMode（仅当 D1 选做；spike 并入 P3） | M5 前增量 | `campaign-parts` 原语、双牌组 hub、schema 8 迁移、FullMode 测试与浏览器证据（§7.3） |
| **P10** | 发布 | M5 | 三组确认 + `gate.pass`、`audit/tde-migration.json`、`playable` + `earlyAccess` |

> P2/P3 在 M0 范围锁定后推进，不计入 M0 的「目录与来源基线」产物范围（规范 §4.8 的 M0 产物清单只有来源锁与目录骨架）。P9.5 是增量里程碑：若 spike 判定不做，P10 仍可按 A/B 单线发布（`earlyAccess` + `remaining` 写明 FullMode 未实现）。

## 3. P1 第 0 步：范围与来源锁（M0）

- **工具**：新建 `tools/scan-tde-scope.mjs`（照 `scan-tcu-scope.mjs` 改数据源：06 段正则、三包清单、`theDreamEaters/shared.js`、分片草案）。命令：`npm run scan:tde:scope` / `scan:tde:scope:check`。
- **产物**：`artifacts/migration/tde/scope.json`（counts / packs / faces / encounterGroups / chapters / shards / sources / baseline / gate）、`replay-before.json`；来源 SHA-256 46 项。
- **门禁**（规范 §4.1 + 初勘 §9）：记录 388 全部分区、`main=352` / `faces=36`、三包 283/18/87、20 组唯一且组卡和 = 283、8 章 × 1 组一一对应、分片无交集、`git rev-parse HEAD` 与基线落盘；**范围外卡不得进入本轮**。
- **M0 附加动作**：登记「无主双面卡」归属（`06015a/b` → 调查员包、`06169a/b` → 战役包）；补 `Beyond the Gates of Sleep` 遭遇牌库证据（参考实现无 `gather`，缺口如实 pending）；图片库存扫描（缺图 387 条）；内容保持 `catalog-only`。

## 4. P2 第 1 步：机制扫描（M0）

- **工具**：新建 `tools/scan-tde-mechanisms.mjs`。**扫描引擎可整体照抄 TCU 版**（分类/分级/证据文本匹配/门禁计算），但章节表、机制表、规则来源表、watchlist、crossCheck 必须按 TDE 卡面重写。命令：`scan:tde` / `scan:tde:check` / `scan:tde:review`。
- **初勘结论**（待正式工具复算）：**38 条机制**，`type` 分布 primitive 9 / keyword 7 / rulebook 6 / scenario 11 / interaction 2 / content 3；覆盖 388/388，未分类 0；分级 mechanism 182 / content 156 / standard 50；与 TCU（40 条 / 377 卡）同规模。
- **关键词三档**（详见 §6）：新增 4 —— `Myriad`（多重，14 卡）、`Swarming X`（蜂拥，初勘 11 敌 / 英文机检 9，M0 复核）、`Veiled`（掩藏，23 地点）、`Researched`（研究完成，3 卡，`06236/06237/06238` 梦境日记）；已有待确认 3 —— `Alert`（5 敌）、`Hidden`（18 卡）、`Bonded`（27 卡）；其余标准关键词（Retaliate/Hunter/Aloof/Massive/Peril/Surge/Victory/Fast/Permanent/Uses/Doom/Parley/Prey）直接复用现有读点。
- **战役级机制**（必须全部落条目）：双战役 FullMode/PartialMode 结构、每部分独立牌组与调查员切换、55 键记录的部分隔离与跨部分双写/勾销、两袋混乱袋与跨部分增删换、战役选项（`theDreamQuest`/`theWebOfDreams`/`full`/`UseSwarmPlaceholders`）、序章 + 3 幕间、16 段结局矩阵、剧情支援入队/离场、成就（默认 out-of-scope，待确认）。
- **门禁**（规范 §4.2）：本轮范围内每张卡至少出现在一个机制条目；未分类卡为 0；`type=primitive` 条目全部进入下一步；未知机制默认**阻断**，不得用近似卡文静默过关。watchlist 需明确排除误判（如 `Patrol`/`Seal`/`Explore`/`Supply` 在 TDE 只是文本提及）。

## 5. P3 第 2 步：拆分原语（M0，含双战役技术验证）

### 5.1 先做高风险 7 项（其余按章排）

| # | 原语 | 用途 / 风险 | 候选 API |
| ---: | --- | --- | --- |
| 1 | `campaignPart`（set/read） | FullMode 双 part 切换；决定整轮结构 | `campaign.setPart(part)` |
| 2 | `campaign.recordInPart`（record/read/crossOut） | 55 键记录按 part 隔离 + 幕间跨线写入 | `campaign.record({part,key})` |
| 3 | `campaign.twoPartDecks` | FullMode 每人两套牌组 | `campaign.chooseDecksForParts` |
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

### 5.5 双战役技术验证（P2/P3 交界，决策点 D1）

见 §7：在 P3 结束前用最小切片验证「双 part 状态 + 两套牌组 + 两袋」可行性，决定 FullMode 是否进入 M5。

## 6. P4 第 3 步：关键词与规则书（M4）

- **新增 4 个关键词**（每项需：来源卡号、引擎行为、Node 验收、规则书条目、卡文直达）：

| 关键词 | 中文 | 印刷卡数 | 代表卡 | 引擎缺口 |
| --- | --- | ---: | --- | --- |
| `Myriad` | 多重 | 14 | 06020 庄严立誓、06021 一瓣缟玛瑙、06245 希望微光 | 构筑期同名至多 3 张；`deck.myriadLimit` |
| `Swarming X` | 蜂拥 X | 11 敌（初勘；英文机检 9，M0 复核口径） | 06102 蛛群、06145 乌撒之猫、06228 土星猫 | 蜂拥实体、蜂拥卡区域、溢出伤害、清空才可击败 |
| `Veiled` | 掩藏 | 23 地点 | 06127 乌撒、06143 地图未见之城（06143b「凶星」是其背面故事卡）、06262–06265 漆黑之海（另 06254/06257/06258/06261 为同章 Veiled 地点） | 未揭示翻面、背面故事卡、记录门控 |
| `Researched` | 研究完成 | 3 | 06236/06237/06238 梦境日记 | 记录键门控的卡牌升级 |

- **需在本循环确认的既有 3 项**：`Alert`（5 敌；与 Swarming/Massive 组合的失败分支）、`Hidden`（18 卡；敌人形态的「隐藏在手牌」与威胁区语义差异）、`Bonded`（27 卡；场外/在场交换、地点绑定卡；规则条目先复用 `tcuBonded`）。
- **规则书条目建议 16 条新增**：`tdeCampaign`（双战役/两套牌组/记录/结局矩阵）、`tdeDreamQuest`、`tdeWebOfDreams`、`tdeChaos`（两袋与逐章符号表）、`tdeRecords`、`tdeEpilogue`、`tdeMyriad`、`tdeSwarming`、`tdeVeiled`、`tdeResearched`、`tdeDreamGate`、`tdeInfestationBag`、`tdeAlarmLevel`、`tdeSignsOfTheGods`、`tdeStoryAssets`、`tdeLocationDoom`；`alert`/`hidden`/`parley` 复用核心条目。
- **剧情来源缺口（已决策：自译补齐，D2 / 2026-10-27）**：zh locale 没有序章/幕间/结局矩阵正文、关键词解释与附加规则文本。决定采用「自译（非官方中文）」补齐：en 源锁定 SHA-256、术语表基线、14 批翻译与审校，`storyText` 可按批次 `verified`，但审计账本必须标注自译来源，不得写成官方中文。工作量与批次见 §8.5。
- 门禁（规范 §6/§7）：新增关键词与规则条目全部 `verified`（5 项 / 6 项检查）；规则书桌面/移动端浏览器用例通过；未确认关键词不得在卡牌文件使用。

## 7. P5 第 4 步：新增交互与双战役架构（决策点 D1）

### 7.1 交互工作项清单（初判 10 条，P4 结束前定稿）

| # | 交互 | 场景 | 备注 |
| ---: | --- | --- | --- |
| 1 | 选择玩法（A / B / FullMode） | 序章 | `campaignOption.variant` |
| 2 | 为 A/B 各选一套牌组（每位玩家） | FullMode 序章 | 复用选牌组面板，必须支持「两次选择」 |
| 3 | 蜂拥卡面板 | Swarming X 敌人 | 蜂拥卡数量/来源/溢出伤害选择；桌面 & 移动 |
| 4 | 蛛群滋生袋 | B1 Waking Nightmare | 独立 token 袋揭示、可取消放回 |
| 5 | 警报等级 | A3 Dark Side | 0–5 值显示与增减 |
| 6 | 隐藏手牌 | Hidden 遭遇/敌人 | 座位私有投影；敌人手牌形态的攻击/躲避入口 |
| 7 | 掩藏地点翻面 | A2 Search / B3 Point of No Return | 背面故事卡、萨尔纳斯记录门控 |
| 8 | 神迹/桥梁进度计数 | A2 / B1 / B3 | 参考卡旁计数显示 |
| 9 | 大网/神秘阶梯纵向堆叠 | B4 / B2 | 动态位置必须复用既有布局变量 |
| 10 | 梦境之门与 16 段结局矩阵 | 通用 / 尾声 | 结局矩阵按 8 记录选 1 段，不得提前泄露 |

- 机制扫描里 `type=interaction` 只登记 2 条（战役模式选择、双牌组选择）；其余 8 条来自场景机制与战役结构，须在 P4 定稿时并入 `confirmations.interactions`，不得在卡牌批次里边写卡边临时拼面板。
- FullMode 的第二次选人/选牌组**可复用现有 hub 流程**（`hubSelectInvestigator` / `hubSetDeck`）：切到未玩过的线时清空 hub 准备态再走一遍 setup，不需要并发双面板（评估见 §7.3），比预想小。
- 复用 `web/` 现有组件、CSS 变量与交互模式；交互状态由服务端 `requestChoice` / `presentation-state` / 观察投影产生，浏览器只提交 `legalMoves` 中的动作；私有候选、手牌、牌库顺序不得进入其他座位投影。
- 门禁（规范 §4.5）：桌面 1440×900 与移动 390×844 各至少一条真实操作路径 + 截图；无卡号 UI 分支；新增颜色/字号/间距来自既有 token；隐私投影断言通过。

### 7.2 双战役架构（TDE 特有，必须显式决策）

**参考实现模型**：一个战役 id `06`，`CampaignPart = TheDreamQuest | TheWebOfDreams`，`CampaignMode = PartialMode part | FullMode`；FullMode 下每个玩家在 A/B 各有一套调查员牌组，两线各自持有 `CampaignAttrs`（记录、混乱袋、玩家 attrs），幕间通过 `InTheDreamQuest/InTheWebOfDreams` 消息跨线读写；`setCampaignPart` 时整组 `SetInvestigator` 切换。来源：`Campaigns/TheDreamEaters/Meta.hs:10-44`、`Campaign/Campaigns/TheDreamEaters.hs:63-104,126-202,261-385`。

**本引擎现状**：单战役、单牌组/座位、单混乱袋（`content/campaigns/*/shared.js` 的 `CHAOS_BAGS`）、`src/campaign/campaign-flow.js` 的 flow 节点只服务一条线。

**候选方案**：

| 方案 | 内容 | 优点 | 代价 |
| --- | --- | --- | --- |
| **D1-A（推荐起点）** | 一个战役 `theDreamEaters`，先交付 **PartialMode A 与 B 两个 4 章线性 flow**（序章选 A/B → 4 章 → 尾声），FullMode 之后再加 | 与现有单战役引擎同构；两种玩法都真实可玩；可先让 8 章内容全部迁完 | FullMode 缺席时是「半量体验」，必须如实登记 remaining |
| **D1-B（已评估）** | 直接把 FullMode 做进 M5：3 个新状态字段（`campaign.mode/currentPart/parts`）+ `campaign-parts` 原语 + 双牌组选人 + 双线记录/袋 + 双日志投影 + schema 7→8 迁移 + AI/UI。实测推荐口径 **34 文件 / 1,900–3,100 行 / 54–71 例**（§7.3） | 完整还原官方体验；方案已代码级验证，既有回放可零漂移 | 本轮最大单项工程（AI/UI/联机与 16 段矩阵文案要一起验收）；排期需在 M3 之后 |
| D1-C（不建议） | 用同一套牌组跨 A/B、把两线记录合并、两袋合一 | 省事 | 改变卡面结算（黑猫联动/记录门控/袋内容），属于规则偏离；只能写进 `remaining`，不得静默发布 |

**建议（2026-10-27 代码级评估后）**：**D1-A 起步**（A/B 单线各 4 章先可玩，引擎增量近乎 0）；P3 内用 spike（9 文件 / 550–850 行 / 12–15 例）验证「双 part 状态 + 两套牌组 + 两袋 + JSON 往返 + 零漂移」；spike 通过且 8 章内容可玩后，把「最小可用 FullMode」作为 M5 前的增量里程碑排进 P9.5。无论哪种，**禁止 D1-C 式静默简化**；若不做 FullMode，发布手册必须写明「FullMode 未实现」并放进 `remaining`。

### 7.3 FullMode 改动量实测（2026-10-27，代码级评估）

评估产物：`artifacts/migration/tde/recon/fullmode/impact.md`（482 行，每个改动点带文件:行号）。**核心结论：可行，且不需要把 194 处 `campaign.records` 读点、75 处 `state.chaosBag` 读点改成嵌套读法**——沿用参考实现的「活动线占主字段 + 另一线快照」：活动线继续用 `state.investigators` / `campaign.records` / `campaign.investigators` / `state.chaosBag`，非活动线快照进新增的 `campaign.parts`。

- 新增状态字段 **3 个**：`campaign.mode`（partial-A / partial-B / full）、`campaign.currentPart`、`campaign.parts[]`（每线切片：records / chaosBag / investigators / retired / trauma / xp / victory / storySections 约 8 个子键）。**只有 manifest 声明 `parts` 的战役写入这些键**，其他战役状态字节不变 → 既有 13 局 / 786 步 / 799 指纹零漂移。

三情景（近似 ±25%，不含 8 章内容迁移）：

| 口径 | 改动/新增源码文件 | 源码行数 | 新增测试 | 阶段 | 相对锚点（TCU 实测） |
| --- | ---: | ---: | ---: | ---: | --- |
| 最小 spike（决策 D1 用） | 9（1 新 + 8 改） | 550–850 | 12–15 例 | 1 | ≈ TCU 14 原语的 15–20% |
| **推荐（最小可用 FullMode）** | **34（6 新 + 28 改）** | **1,900–3,100** | **54–71 例** | 3 | ≈ TCU P3 的 0.5–0.7× + P5 的 0.4–0.6× |
| 完整（联机/审计/结局矩阵/迁移/浏览器） | 42（7 新 + 35 改） | 2,300–3,500 | 68–92 例 + 2 browser spec | 5 | — |

- 主要改动面：新增 `src/campaign/campaign-parts.js`（切片/切换/`inPart` 作用域原语）+ `content/campaigns/theDreamEaters/{parts,fullmode-flow,interludes,fullmode-story,fullmode-effects}.js`；修改 `content/schema.js`（manifest parts 校验）、`src/engine/setup.js`（建局/换袋/切 part 时序）、`src/engine/campaign-flow.js`（flow 条件 `mode/part/partRecord`、双线纪事）、`src/campaign/campaign-effects.js`（跨线写入）、`src/campaign/campaign.js`（`campaignView` 双日志脱敏）、`src/engine/hub.js`/`dispatch.js`/`table-decisions.js`（`hubSetMode`、第二次选人/选牌组）、`src/integration/observation.js`/`src/cards/campaign-view.js`（线别投影）、`src/ai/ai-context.js`（当前线上下文）、`web/{hub,situation-view,story-reader}.js`（模式按钮/线别徽标/双日志/纪事分组）、`src/engine/rules-state.js` + `save-migration.js`（schema 7→8 + 1 条迁移）、`tools/replay-games.mjs`（+2 条 recipe）。
- 门禁要点：① 未声明 `parts` 的战役状态字节不变，`--baseline/--compare` 证明 13 局 hashes 逐条一致；② schema 7→8 只升结构版本、规则版本保持 `n6.0`，旧档迁移对非 TDE no-op；③ 双线隐私：`campaignView` 必须对 `parts` 内他席牌组脱敏，否则 8 套牌组泄露；④ 切 part 只发生在关间边界，关内无跨线读。
- 若不做 FullMode（D1-A 降级）：A/B 单线两个 4 章战役可完整交付，唯一通用引擎缺口是「按线基础袋」约 **40–90 行**（`campaign-effects` + `chaos-bag` 同区域，且该原语 FullMode 也要用）；发布按 `playable + earlyAccess + remaining`，`confirmations.interactions` 增加 `pending` 的 `fullmodeDualCampaign` 项。
- 主要残余风险：切片字段漏存（用显式 `PART_SCOPED_CAMPAIGN_FIELDS` 常量 + 启动期断言）、投影泄露（先写失败用例）、16 种交错路径无法全测（章对 gate 状态机 + 抽样全流程）、schema 8 迁移影响全部存档（no-op 化 + 双向前后测试）、16 段结局矩阵正文依赖 §8.5 自译。

## 8. P6–P8 内容阶段（M1–M3）

### 8.1 M1 调查员（P6）

- 5 位调查员：构筑选项、牌组要求、主能力、旧印、专属卡与专属弱点（18 条记录逐人验收）。
- 自动构筑与手动构筑使用同一服务端规则；每位调查员分别测初始化、能力、依赖、存档恢复与负面路径后，才进入选人列表。
- 已知难点：Tony 的赏金/猎物（`counter.investigator`）、Luke 的门之匣 + 梦境之门（绑定地点 + 移动）、Patrice 的牌库/弃牌循环与手牌上限、Mandy 的查找改写（`window.afterDeckSearch`）、Tommy 的伤害承接与 Becky 弹药。
- 产物：`content/packs/tdeInvestigators/manifest.js`、`tests/tde-investigators.test.mjs`；账本 `confirmations.investigators`。

### 8.2 M2 玩家卡（P7，4 片多子进程）

- 87 张一卡一文件：`src/cards/entries/<code>.js`；每张逐项登记费用、槽位、使用次数、时机、目标、检定、升级、永久、卓越、放逐等行为。
- 分片（`shards.json`）：`M2-1` 22 / `M2-2` 22 / `M2-3` 22 / `M2-4` 21；4 个 worker 各写自己的单卡文件，**不重建索引**；主进程合并后统一重建 `entries/index.js` 一次。
- 原语请求队列：worker 写 `artifacts/migration/tde/primitive-requests/<id>.json`（`pending→claimed→done|rejected`），主进程只改共享层；队列统计写入 `reports/primitive-queue.json`。
- 复用资产：`artifacts/migration/tcu/workers/P7-WORKER-BRIEF.md`（272 行）改写为 TDE 版；写入边界、三交付、显式简化、自检 schema 全部照搬。
- 门禁：每张开放卡有行为测试与审计证据；目录卡不能仅凭卡文解析进入构筑或升级池；`cards:check` / `cards:encounter-check` 全绿。

### 8.3 M3 剧本与剧情（P8）

- 目录结构（规范 §3 + 本循环扩展；`keywords.js`/`record-labels.js`/`card-data.js`/`interludes.js`/`tde-chaos.js` 沿用 TCU 实践、超出规范 §3 最小骨架）：`content/campaigns/theDreamEaters/` + `manifest.js` / `shared.js` / `chapters.js` / `keywords.js` / `record-labels.js` / `card-data.js` / `encounter-rules.js` / `interludes.js` / `tde-chaos.js` / `story-text.js` / `scenarios/<8 id>/{index.js,definition.js,layout.js,behavior.js}`。
- 8 章按「平行章对」分批：对 1（Beyond + Waking）→ 对 2（Search + Thousand Shapes）→ 对 3（Dark Side + Point of No Return）→ 对 4（Where Gods Dwell + Weaver）；Search 53 张单独占一个大批次。
- 每章逐项：布置与放在一边区、遭遇牌库（含跨循环通用组）、地点正反面与连接、幕/议程与推进条件、敌人/诡计/剧情支援、剧本行动归属（`scenario.scriptCards`，规范 §4.5.1）、混乱符号四项、结局与跨关记录；逐章 12 项检查进 `audit/tde-scenario-acceptance.json`。
- 剧情（M3-C）：见 §8.5「自译补齐」工作流；`tools/import-tde-story.mjs` 从锁定的自译来源生成 `story-text.js`；译校完成前缺口章节的 `storyText` 保持 pending，不得手写摘要顶替原文。
- 门禁：章节可单独 `development`，但战役在所有章节确认前不可启动；`literalCardBehavior` 必须在逐卡核对完成前保持 `false`。

### 8.4 M4 / M5

- M4：关键词与规则书见 §6；M5：完整合法路线、失败路线、存档恢复、多人/AI、桌面与移动端浏览器验收；三组确认全部 `verified` 才能升 `playable`。发布口径：`playable` 只表示「本 Mod 声明的实现范围可玩」，`earlyAccess=true`、`equivalenceCertified=false`；未逐条等价的分支、`blocked` 卡与未完成原语必须单列。

### 8.5 剧情自译补齐工作流（P8-T，M3-C 前置）

**决策 D2（2026-10-27）：允许自行翻译补齐中文剧情来源**；口径为「自译，非官方中文」，来源锁与审计标注见下。评估产物：`artifacts/migration/tde/recon/story-gap/report.md`。

- **工作量事实**：en 源 9 文件 `textChars` 194,299；现有 zh 可复用 en 文本 45,221 字符（23.3%，其中 15 段正文疑似节译须重译、11 条短记录键可原样复用）；**净需翻译 147,718 en 字符**（叙事 120,098 / 规则 24,999 / 界面 2,621）；按 en→zh 字符比 0.30–0.38 估算 **约 44k–56k 中文字符（中值约 50k）**，其中 story-text 约 36k–46k。**14 个翻译批次 + 批 00（复用/不译）**；约 23–36 人日，单人约 **3–5 周**。
- **批次**：00 术语表 / 来源锁 / 55 记录键校对 → 01 序章 + 战役结构规则段 → 02 / 03 / 04 幕间 I（黑猫）/ II（入梦者）/ III（伟大的存在）→ 05 16 段结局矩阵 + 特殊尾声（`brokeTheLawOfUlthar`）→ 06–11 按平行章对译 8 章（A1/B1 → A2/B2 → A3/B3 → A4/B4）→ 12 关键词解释与附加规则（alert / storyCards / swarming / hidden）→ 13 场景规则文本 → 14 界面杂项与终审。
- **来源锁与审计字段**：自译底本锁定 `参考资源/.../locales/en/theDreamEaters/**` 的 SHA-256；自译产物（`.json`/`.md` 源）落在 `content/campaigns/theDreamEaters/story-source/`（不写 `参考资源/`，运行时不依赖参考资源）；`tools/import-tde-story.mjs --check` 同时校验来源哈希与生成物。审计账本的 `storyText` 记 `sourceKind: 'self-translated'`、`officialChinese: false`、`enSourceHashes`、`glossaryVersion`、`generatedSha256`，**不得写成官方中文来源**。
- **术语与审校**：44 行术语表，以中文卡表（`src/cards/cards-data.js`）为专名基线（7 关键词官方词形：多重 / 蜂拥 / 掩藏 / 研究完成 / 警戒 / 隐私 / 绑定；8 章标题 / 5 调查员 / 战役名）；**5 个高风险词形冲突**（Hidden 隐私 vs 隐藏、Dreamlands 幻梦境 vs 梦境之地、Swarming 蜂拥 vs 群集、Veiled 掩藏 vs 隐蔽、campaign/scenario 战役/剧本 vs 冒险）+ **3 个空白词**（Great Ones、waking world、campaign 称呼）在批 01 拍板。新增术语一致性检查 `check:tde:terms`；15 段正文疑似节译必须重译或逐段补齐后才可复用；`epilogueMatrix` 含 `data-epilogue` / `{count}` 控制标记，生成器需专门处理。
- **验收**：`storyText` 审计（每章存在导入正文、每个可达结局有正文、无 HTML 控制标记、未触发分支不泄露、私密段落按座位过滤）+ 术语一致性检查 + 生成器 `--write/--check` 逐字节一致；FullMode 双线剧情按 part 投影，A/B 组互不泄露。
- **依赖**：批次 01/05 与 FullMode 的幕间/16 段矩阵共用文案；若 FullMode 降级，跨线段落可先译存档，发布时按实际实现范围裁剪。

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
| 内容包 | `content/packs/tdeCampaign/manifest.js`、`content/packs/tdeInvestigators/manifest.js`、`content/packs/tdePlayer/manifest.js` |
| 战役 | `content/campaigns/theDreamEaters/{manifest,shared,chapters,keywords,record-labels,card-data,encounter-rules,interludes,tde-chaos,story-text}.js` + `scenarios/<8 id>/`（每章 `index/definition/layout/behavior`） |
| 单卡文件 | `src/cards/entries/<code>.js` × 87（玩家卡）；`src/cards/encounter-entries/theDreamEaters/**/<code>.js`（283 条战役记录，按归属目录） |
| 工具 | `tools/scan-tde-scope.mjs`、`scan-tde-mechanisms.mjs`、`audit-tde.mjs`、`audit-tde-player.mjs`、`audit-tde-all-cards.mjs`、`audit-tde-scenarios.mjs`、`import-tde-story.mjs`、`check-tde-registry.mjs`、`check-tde-scenario.mjs`、`develop/gen-tde-source-lock.mjs`、`playwright.tde.config.mjs`、`tools/tde-primitive-spec.mjs` 为 TDE 专用新文件；`audit-tcu-primitives.mjs` 与 Playwright reporter 建议先参数化共用（`tools/audit-cycle-primitives.mjs --cycle tde`、`tools/playwright-tde-reporter.mjs --cycle tde`），避免复制约 1986 行（2026-10-27 实测）的审计大件 |
| 测试 | `tests/tde-*.test.mjs`（原语/关键词/交互/调查员/玩家卡/剧本/剧情/账本，约 40 个文件）+ 5 个 browser spec（rules/interactions/scenarios/release/media）+ `tests/tde-suite.mjs` |
| 账本 | `audit/tde-migration.json`、`tde-scenario-acceptance.json`、`tde-all-card-acceptance.json`、`tde-player-acceptance.json`、`tde-scenario-source-lock.json`、`tde-browser-acceptance.json`；生成物 `src/cards/tde-player-acceptance.js` |
| 运行目录 | `artifacts/migration/tde/{scope.json,mechanism-scan.json,primitive-plan.json,primitive-catalog.json,primitive-requests/,workers/,reports/,shards.json}` |

### 10.2 接入点（新增循环必须登记的 7 处 + 3 处清单）

1. `content/registered.js`：三个包 + 战役 + 8 章加入 bundle（`currentContentBundle()` 同步）。
2. `content/mechanics.js`：`supportedMechanics` 追加 `tde*` 机制 id。
3. `web/rulebook-data.js`：规则书分组、拼音索引、卡文直达（`supportedMechanics` 见上一条）。
4. `src/deck/availability.js`：`PLAYABLE_INVESTIGATOR_CODES` / `SIGNATURES_BY_INVESTIGATOR` / `ALL_BUILDABLE_CODES` / `isStrictAccepted`。
5. `content/packs/manifests.js` 或其数据段写法（若 TDE 包沿用 ranges 表达式）。
6. `content/campaigns/theDreamEaters/keywords.js` 关键词台账（M4 事实源）。
7. `tools/audit-baseline.mjs` 的 `AUDITS` 追加 `tdeScope` / `tdeMigration`。
8. `tests/suites.mjs` + `tests/node-suite.mjs`：TDE 测试文件登记各自 tier（`tde-suite.mjs` 作总入口）。
9. `package.json`：约 30 条 `*:tde*` 命令（见 §11）。
10. `.gitignore`：增加 `!artifacts/migration/tde/`（照 TCU L19-22 的例外写法），否则干净检出无法复算 TDE 账本。

### 10.3 文档集（9 篇，M 阶段逐步补齐）

`docs/tde-migration-roadmap.md`（本文）+ 8 篇卫星：`tde-primitives.md`（P3）、`tde-rules.md`（P4）、`tde-interactions.md`（P5）、`tde-investigators.md`（M1）、`tde-player-cards.md`（M2）、`tde-scenarios.md`（M3）、`tde-story.md`（M3-C）、`tde-release.md`（M5）。骨架照 TCU 9 篇（每篇含「口径 → 事实表 → 证据 → 边界 → 相关手册与维护」）；卫星文档是原语账本 `files` 的必需输入，**先建文档再跑 `plan:tde:primitives`**。

## 11. 验收门禁与命令

### 11.1 命令表（建议，随 P1 落地）

| 阶段 | 命令 | 产物 |
| --- | --- | --- |
| 范围/基线 | `scan:tde:scope` / `scan:tde:scope:check` | `scope.json` + `replay-before.json` |
| 机制扫描 | `scan:tde` / `scan:tde:check` / `scan:tde:review` | `mechanism-scan.json`、`_review.md` |
| 原语 | `plan:tde:primitives` / `audit:tde:primitives` | `primitive-plan.json` / `primitive-catalog.json` |
| 关键词/规则书 | `test:tde:rules` / `test:tde:rules:browser` | `confirmations.keywords/rulebook` |
| 交互 | `test:tde:interactions` / `test:tde:interactions:browser` | `confirmations.interactions` |
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
| 发布 | `test:tde`、`replay:fixtures`、`npm test`、`presentation:check`、浏览器回归 | 三组确认 `verified`；无新增失败；既有失败单独记账 |

- 审计报告必须含 `confirmations.scenarios`（12 项检查）/ `confirmations.keywords`（5 项）/ `confirmations.rulebook`（6 项）；状态只有 `pending` 与 `verified`；三组未完成时 `playable: true` 只能以 `earlyAccess` 口径存在，且不得描述为规则等价。
- 最终报告必须区分：本轮新增失败、可复现的既有失败、`blocked` 卡与未完成原语；任何 `blocked`/`rejected` 都不能写成「已迁移」。

### 11.3 规范细目对照（核验清单 G1–G12 的落点）

| # | 规范要求 | TDE 落点 |
| ---: | --- | --- |
| G1 | §4.6.2 分片 20–50 张/片 | §9：M1 单包切片记豁免理由；Search 章 53 张拆两片 |
| G2 | §4.6.3 队列细节（原子写/去重/rejected/claimed 超时） | §9「原语队列协议」逐条 |
| G3 | §4.5.1 scriptCard 三处断言 | §8.3：`legalMoves` / `scriptActionHints` / `viewState(...).scriptActions` 三处断言；地点/敌人行动不得误标；不可执行仍返回带 `reason` 的提示 |
| G4 | §5.2 `literalCardBehavior` 审查口径 | §8.3/§11.2：逐卡能力清单（正/背/关联面/升级/复用）+ 合法与非法行动断言；不得以卡号出现在源码作为证据；简化进待实现清单并保持 `false` |
| G5 | §2 通道状态枚举 | 审计账本逐卡记 `descriptor \| legacy \| hybrid \| missing` 与证据路径；`missing` 使该章 `literalCardBehavior=false` |
| G6 | §2 可重放 / 存档迁移 | 新状态字段（双 part、双牌组、警报、蜂拥、地点掩藏等）进 `save-migration.js` 版本迁移 + JSON 往返；replay `--baseline` / `--compare` |
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
| R2 | **FullMode 工程改造**（官方玩法之一）：3 个新状态字段、推荐口径 34 文件 / 1,900–3,100 行 / 54–71 例、schema 7→8 + 迁移 | 中高（排期，非可行性） | 决定 TDE 是完整体验还是半量体验 | D1-A 起步 + P3 spike（9 文件 / 550–850 行 / 12–15 例）；不做时缺口仅 40–90 行「按线基础袋」；如实写 remaining |
| R3 | 06 段本地卡图仅 1/388 | 中 | M5 展示素材与离线体验 | `images:fetch` + 远程回退；M0 缺图清单；不得建循环专属目录 |
| R4 | 既有 37 处文档断链 + TCU 三本账本漂移 + `baseline:check` 过期 | 中 | `docs:check`/审计门禁不能全绿，TDE 文档无法「新增 0 断链」 | P0 决策 D3：恢复 TCU 9 篇归档或改链接；TCU 账本 `--write` 重算或冻结口径；TDE 门禁不依赖红账本 |
| R5 | 蜂拥/掩藏是全新实体级机制（蜂拥卡区域、地点翻面/故事卡），影响战斗、移动、观察、AI、存档 | 中高 | 原语与交互工作量集中在 P3/P5 | 高风险原语先行（§5.1）；每项补 Node + 浏览器双证据 |
| R6 | 章节规模极不均（Search 53 vs Waking 21） | 中 | 排期与 worker 分片 | 按章分片、Search 单独批；不按章均分 |
| R7 | 跨循环通用遭遇组（8 组）在仓库目录的可用性、`DarkCult↔pentagram` 映射未证实 | 中 | M3 setup 卡住 | M0/P1 库存扫描 + 逐组确认；缺失组在账本标 pending |
| R8 | `Beyond the Gates of Sleep` 参考实现无 `gather` | 低中 | 该章 `setupAndZones` 证据不足 | 用正式扫描器 + 规则书 setup 文本对齐；否则该章检查项如实 pending |
| R9 | 规范自身三处过期/错误：§1 卡图路径写 `web/img/arkham/{,zh/}cards`（实际 `web/img/{,zh/}cards`）；§4.1 基线示例「10 局 / 529 步」（现行 13/786/799）；§4.6.8「既有 7 条」口径过期 | 低 | 文档口径不一致 | P0 规范勘误 PR（或路线图注记），P1 以工具实测为准 |
| R10 | 迁移期间环境假阴性：本会话执行器禁止子进程管道捕获，`audit-tcu-player/all-cards/carcosa-player` 会假失败 | 低（记账） | 误判账本状态 | 迁移报告中区分「环境假阴性 / 真实失败」；换普通终端复跑 |
| R11 | 自译质量与术语漂移（专名/关键词/记录标签不一致；节译误当完整译文） | 中 | 卡文/规则书不一致、审校返工 | 术语表基线 + `check:tde:terms` + 两轮审校 + 15 段正文重译清单 |
| R12 | schema 7→8 迁移影响全部存档版本（回放基线元数据重采） | 中 | 旧档兼容与回放基线 | 迁移项对非 TDE no-op；`--baseline/--compare` 证明 13 局 hashes 逐条不变；`save-migration.test` 全绿 |

**开放问题清单（需在 P1–P3 决策）**：D1 FullMode 是否进 M5（**待 P3 spike 后定；建议 D1-A 起步**）；D2 剧情来源补齐路径（**已定：自译补齐，2026-10-27，见 §8.5**）；D3 TCU 文档/账本处置；D4 `achievements` 是否纳入范围（默认 out-of-scope）；D5 `Bonded` 规则条目复用 `tcuBonded` 还是新立 `tdeBonded`；D6 `06015a/b`、`06169a/b` 无主双面卡归属登记；D7 `Patrol`/`Seal`/`Explore`/`Supply` 不作为 TDE 关键词的判定是否保留。

## 13. 立即开工清单（P0 → P1）

| # | 任务 | 产物 / 验收 | 依赖 |
| ---: | --- | --- | --- |
| 1 | 规范勘误：卡图路径、基线示例数字、既有失败口径 | 迁移规范或路线图注记更新；`docs:check` 不新增断链 | — |
| 2 | 文档断链处置：恢复 TCU 9 篇归档或改 37 处链接 | `node tools/check-doc-links.mjs` 0 失效 | 决策 D3 |
| 3 | TCU 三本账本漂移处置（`audit:tcu` / `tcu-scenarios` / `tcu-primitives`） | `--check` 通过或明确冻结口径；TDE 门禁不依赖 | — |
| 4 | 基线重锁：`replay-fixtures --baseline artifacts/migration/tde/replay-before.json` + 当前 `test:fast` 失败集合落盘 | 基线文件 + `reports/baseline.md` | — |
| 5 | `.gitignore` 增加 `!artifacts/migration/tde/` | `git status` 可见 TDE 审计输入 | — |
| 6 | 新建 `tools/scan-tde-scope.mjs` 并 `--write` | `scope.json` gate.pass=true，数字与初勘一致 | 1–5 |
| 7 | 新建 `tools/scan-tde-mechanisms.mjs` 并 `--write` | `mechanism-scan.json` gate.pass=true，38 条机制复算 | 6 |
| 8 | 双战役 **spike**（9 文件 / 550–850 行 / 12–15 例）：用测试内合成两 part 战役跑通 切换 / 隔离 / JSON 往返 / 13 局指纹零漂移 | 决策记录 D1；`primitive-plan.json` 增加 6 条 FullMode 原语（`setPart/readPart/partRecord/partChaos/inPart/partFlowCondition`） | 7 |
| 9 | 文档集开篇：按 TCU 骨架建 8 篇卫星文档的「口径 + 待办」占位（不是完整内容） | 8 个文件 + 互链；作为原语 `files` 输入 | 1–2 |
| 10 | 图片库存扫描（06 段缺图 387 条）与远程回退确认 | 缺图清单 + 回退策略记录 | — |
| 11 | 剧情自译批 00：锁 en 源 SHA-256、建术语表（≥20 条）、校对 55 记录键与 8 章标题 | 来源锁 + 术语表 + `check:tde:terms` 草稿 | 1–5 |
| 12 | 剧情自译批 01：序章 + 战役结构（约 5,244 en 字符 → ~1.8k 中文字符） | 自译源文件 + 审校记录 | 11 |

## 14. 附录

### 14.1 初勘口径与差异

- 卡号口径：06 号段 = `/^06\d{3}[a-z]?$/`；主卡 = 无字母后缀；关联面 = 带字母后缀。四份参考卡表（cards_zh-cn/en/zh/cards）与 `src/cards/cards-data.js` 的 388 个卡号集合一致、7 个关键字段 0 差异。
- 三包分类规则先用 TCU 05 段复算得 237/19/87/377，与 `artifacts/migration/tcu/scope.json` 完全一致后才用于 TDE；因此 TDE 的 283/18/87 可与 TCU 口径互证。
- 与 TCU 的规模对照（排期锚点）：TCU = 377 记录 / 9 章 / 16 关键词 / 11 交互 / 14 新原语 / 5 browser spec / 28 例 / 30 截图 / `gate.pass=true`；TDE = 388 记录 / 8 章 / 新增关键词 4 + 复用确认 3 / 交互 ~10 / 新原语候选 21 + 1 复用 / 双线架构 1 个大课题。
- 不确定项（M0 正式扫描锁定）：`Beyond the Gates of Sleep` 遭遇牌库、`DarkCult↔pentagram`、跨循环通用组库存、当前 `test:fast` 失败集合、`achievements` 范围、Swarming 印刷卡数（初勘 11 vs 英文机检 9）。
- 初勘口径修正（M0 以权威为准）：`mechanism-draft` 的「354 主卡 + 34 面」与 `gaps.md` 断链小计 31 为初勘错误；权威值 = **352 主卡 + 36 面**、既有失效 **37** 条（分布：README 26 / ARCHITECTURE 5 / AGENTS 1 / card-entry-files 4 / card-model 1）。
- FullMode 评估（2026-10-27）：`recon/fullmode/impact.md`；三情景 9 / 34 / 42 文件，550–850 / 1,900–3,100 / 2,300–3,500 行；结论为「活动线占主字段 + 另一线快照」，新增状态字段 3 个，既有 13 局回放零漂移前提成立。
- 剧情自译评估（2026-10-27）：`recon/story-gap/report.md`；en `textChars` 194,299、可复用 45,221、净需译 147,718、约 44k–56k 中文字符、14 批、约 23–36 人日；15 段正文疑似节译须重译（11 条短记录键可复用）；`epilogueMatrix` 控制标记需专门处理。

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

### 14.3 维护规则

1. 本文随阶段推进更新：每个 P 阶段收尾时补「产物与证据路径」，但**不得**把计划项改写成「已完成」，除非有 `--check` 过的账本或测试证据。
2. 所有数字以工具输出为准；初勘数字（本文件 §1）在 P1 被 `scope.json` 取代后，本文只保留指路，不重复数字。
3. 决策 D1–D7 一旦拍板，在本文件与对应卫星文档同步记录「决策 + 日期 + 依据」。
4. 卫星文档、账本、代码同一提交；先改代码再 `--write`，提交前跑对应 `--check`。
