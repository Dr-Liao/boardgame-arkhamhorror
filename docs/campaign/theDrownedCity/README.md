# 十循环《沉没之城》迁移路线图

The Drowned City 的战役标识为 `theDrownedCity`，审计简称沿用卡牌筛选中的 `tdc`，参考源战役编号为 `11`。本地卡表中的 `tdcp`、`tdcc` 共 425 条记录。调查员包和一般玩家卡包已开放，战役注册状态为 `playable`。发布验收证据见 [P8](#p8-整体验收与发布)。

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

下表路径相对 `games/arkhamhorror/`。运行资料另存于大厅根目录的 `artifacts/migration/tdc/`，包括分片、原语请求、worker 记录、replay 基线、日志与截图。

**门禁输入已入库**：大厅根 `.gitignore` 对 `artifacts/migration/tdc/` 开白名单，专门入库 `audit:tdc:check` 与 `audit:tdc:p7` 在 `--check` 路径上读取的证据——`p7/literal/*.json`（逐卡账本）、`p7/{targeted-parallel-final,replay-final-verified,fast-final-verified}.log`、`p8/screenshots/*.png`、`p8/{full-before,regression-*}.log`、`replay-before.json`、`replay-before-recovered.json`。其余运行产物（分片、worker 报告、primitive-requests、Playwright 临时输出）仍不入库。修改这些证据后必须与代码同一提交入库，否则干净检出无法复算发布门禁。

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

- [x] 按包和归一化卡号复算范围。分区覆盖 425 条记录，分开登记编号位置、印刷份数、关联面与候选行为卡号。范围外依赖记录了核心组的实际选取范围与歌莉娅替代号。[范围账本](../../../audit/tdc-scope.json)
- [x] 锁定 10 张提示卡和各章符号效果指纹。将发行商俄文版指南第 3 页渲染后逐枚核对，四档初始混乱袋均与参考后端相同。首章提示卡两面均无邪教徒效果，终章第二部提示卡为 `11688a`。[范围账本](../../../audit/tdc-scope.json) · [发行商印刷指南，第 3 页](https://hobbygames.ru/download/rules/uzhas-arkhema-zatonuvshij-gorod-kampanija-rules.pdf#page=3)
- [x] 记录大厅和 Mod 子仓库的起始提交、既有修改、快速测试和合规基线。2026-11-19 从同动作、同逐步指纹的采集副本补回旧版压缩遗漏的规则标志。严格重放逐局通过，修复前的基线和失败日志可查。内容为 `catalog-only`。[基线证据](../../../audit/tdc-baseline.json)

### P1 扫描新增机制

- [x] 425 条记录的卡文与关联面均已归类。逐行指纹、代表卡号、现有引擎读点和缺口已登记。[机制扫描](../../../audit/tdc-mechanism-scan.json)
- [x] 幕间 II 西线移除 1 枚石板、加入 1 枚邪教徒并持续至战役后续，东线保持原袋。已登记终章阈值推进与另外三项官方勘误。印刷页核对消除了英文网页抽取漏读造成的初始混乱袋差异。[官方战役指南，第 11 页](https://images-cdn.fantasyflightgames.com/filer_public/c1/3b/c13b0e74-62bb-49bc-bc85-036ab9d1ef10/ahc84_campaign_guide-web_1.pdf#page=11) · [官方 FAQ v2.4](https://images-cdn.fantasyflightgames.com/filer_public/f9/25/f925d867-e844-48d1-9d41-045ce41f8950/ahc_faq_v24_july_2025.pdf)
- [x] 12 份指南文件共 1,014 个段落已建立英中键位映射，标明待译状态，覆盖图示引用、条件设置、任务段落和特殊小节。西墙 `specialRules` 的本地化链接已解析。[段落对照](../../../audit/tdc-mechanism-scan.json)

### P2 拆分并实现通用原语

- [x] 已分列 `reuse / new / escape`，并复验三级淹没、已有密封、附属与跨章记录。已接入最近幸存者交接、相邻整行连接、独立牌库底抽与回收、进度指派及去重。[原语计划](../../../audit/tdc-primitive-plan.json) · [接口和验证路径](primitives.md)
- [x] 多部位敌人已接入主体的移动和交战、部位战斗与躲避、聚合攻击、单部位反击与警戒、翻面、离场和 JSON 往返。2026-11-19 专项测试、原基线的严格重放与快速回归通过。[迁移审计](../../../audit/tdc-migration.json) · [测试与回放记录](../../../audit/tdc-baseline.json)

### P3 关键词与规则书

- [x] 已核对警戒、巡逻、无情、封印及其印刷卡面。专项测试覆盖无情在普通敌人攻击结束后再攻一次，包括首击取消和巨型敌人攻击多个席位。[关键词账本](../../../audit/tdc-rules.json)
- [x] 已收录淹没、任务、文物与字形、地点连接、终章板块与独立牌库等 12 个中英条目，接入 425 条循环卡表记录。桌面与移动端通过目录、搜索、相关主题跳转与返回、卡牌直达及焦点恢复。关键词和规则书确认项已验收。[规则书验收](rulebook.md) · [迁移确认](../../../audit/tdc-migration.json)

### P4 新增交互与界面

- [x] 已验收任务去重与个人进度、东西路线与区域划除、A–Z 字形、文物分配与最近幸存者接管、地点重排，以及终章主体和部位目标。选择、禁用及多人平手由服务端判定，覆盖取消和存档恢复。[交互接口](interactions.md)
- [x] 已验收幕／议程的 `scriptCard` 归属和提示卡下方的“关卡设置”。特别规则优先，后续剧情和结局默认折叠。座位投影验证了私人任务、暗置内容和实际叙事分支。[交互接口](interactions.md)
- [x] 真大厅夹具在桌面 1440×900 与移动 390×844 验证了正常、非法、空状态、重试、键盘和焦点路径。报告、截图与严格回放证据已记录。[交互账本](../../../audit/tdc-interactions.json)

### P5 调查员及专属依赖

2026-11-19 已完成。大厅开放 `tdcInvestigators` 的 6 位调查员、8 个版本和 14 张专属依赖，含歌莉娅书版及两张替代牌。逐人核对了能力、旧印、构筑、专属牌与同一身份的席位互斥。[交付说明](investigators.md) · [验收账本](../../../audit/tdc-investigators.json)

| 清单 | 卡号与调查员 | 专属依赖和验收重点 |
| --- | --- | --- |
| [x] | `11001` 玛利翁·塔瓦雷斯 | `11002/11003`。构筑特质、手部槽、不同事件连打、检定回收和恐惧费用。 |
| [x] | `11004` 卢修斯·加洛维 | `11005/11006`。躲避差值、线索、灵感、恰好成功、旧印与洗回。 |
| [x] | `11007/11008` 阿加莎·克雷恩 | 共用 `11009/11010`。35 张、职阶限制、标记追踪与替换、弃牌事件移出。 |
| [x] | `11011` 迈克尔·麦克格林 | `11012/11013`。枪械构筑、按实体限次、弹药、枪盒槽位与没收。 |
| [x] | `11014/98019` 歌莉娅·戈德堡 | 循环版 `11015/11016`，书版 `98020/98021`。抽取顺序、查看、暗置、非精英筛选及两套签名牌。 |
| [x] | `11017` 乔治·巴纳比 | `11018/11019`。35 张、手牌上限、暗置投入、交换、弃置与存档隐私。 |

17 项专项测试和 16 项双端大厅开局验收通过。共享代码更新后，《失落的时代》的两局曾在第 22 步探索出现差异。补给短缺会按动作日志记录的规则重放其选项，修复后原基线的 13 局再次逐步一致。[回放与 P6 验收](player-cards.md)

### P6 一般玩家卡

- [x] 按职业、等级以及依赖分无交集批次，单列基础弱点、重印和变身卡。专项测试覆盖 `11068a → 11068b` 的转换、构筑锁定、再次败退死亡和起始选人门禁。
- [x] 111 个记录均接入单卡文件、索引和行为验收。103 张进入手动构筑，3 张研究牌通过战役记录升级，4 张基础弱点进随机候选，继任调查员只用于身份转换。
- [x] 三个子代理提交分片、实现与实测证据，主进程合并共享规则、重建索引并核对原语队列。新增 R1/R2/R3 为 0。

2026-11-19 完成。逐卡验收覆盖费用、时机、目标、限制、区域移动和存档所需的状态。桌面和移动端均通过真实大厅手动构筑验收。[P6 交付说明](player-cards.md) · [P6 验收账本](../../../audit/tdc-player.json)

### P7 共享遭遇、剧本与战役流程

共用运行层支持揭示时选择检定技能、按失败差值限量弃牌、最近合法地图目标，以及独立牌库重抽和弃回。剧本登记检查任务、路线和字形声明，战役流支持去重集合门槛和按调查员身份防重结算。专项测试与严格回放结果记录在账本中。[P7 进度账本](../../../audit/tdc-p7.json) · [P7 逐章账本](../../../audit/tdc-p7-scenarios.json) · [原语接口](primitives.md)

战役卡包已由现有卡表登记为目录内容。正交网格地点可旋转方向出口并重算连接。跨章开局调整按调查员身份保留，可指定生效章节。指南面板在资料缺项时保留布置摘要、说明和重试入口。

自有内容可按开发状态登记。战役卡包放在 `content/packs/tdcCampaign/`，战役清单与章节模块放在 `content/campaigns/theDrownedCity/`，双语指南源使用 `content/scenario-guide-sources/<scenarioId>.json`。P7 清点分别记录真实注册的章节、流程结构可达的章节、与源文件一致的指南，以及可从既有卡包复用的遭遇。逐卡行为、布置守恒、剧情、实局回放和浏览器仍按逐章确认清单验收。[生产注册表](../../../content/registered.js) · [自有指南接入](../../scenario-guides.md)

**2026-11-19/20 P7 内容批次交付**

| 项 | 结果 | 证据 |
| --- | --- | --- |
| 共享遭遇 | 15 组 54 张全部落单卡条目（`_shared/<group>/`）。第二轮补齐 11724 猎手授予、11731 地点附属修正、11752 特性禁触发的引擎读点 | [逐章账本](../../../audit/tdc-p7-scenarios.json) · [共享遭遇账本](../../../../../artifacts/migration/tdc/p7/literal/shared.json) |
| 剧本 | 10 章均已注册，231 张专属卡均有单卡条目。逐章测试覆盖存档重放、原语接线和卡牌行为 | [逐章账本](../../../audit/tdc-p7-scenarios.json) · `tests/tdc-scenario-*.test.mjs` |
| 战役流程 | 序章 → 金盆洗手 → 幕间 I（逐人领任务）→ 幕间 II 东西向 → 六章路线（含西墙结局 3、养育场结局 4 跳章）→ 墓穴三门三结局 → 幕间 III/IV（逐人任务结算/Toe the Line 降档/Good Money 弱点）→ 终章 I/II（Doom I 无结局弱点补入）→ 尾声 1–4；47 节点 flow，终点与 10 章全部可达 | [P7 进度账本](../../../audit/tdc-p7.json) · `tests/tdc-p7-campaign-layer.test.mjs` |
| 叙事 | `story-text.js` 由 `tools/import-tdc-story.mjs` 生成：12 文件 1,014 叶全部自译，中文缺译 0；序章、幕间 I–IV、终章导入、尾声 1–4 齐备 | `content/campaigns/theDrownedCity/story-source/zh-CN/` · [worker 报告](../../../../../artifacts/migration/tdc/p7/workers/narrative-guides.md) |
| 指南 | 10/10 章完整中英 authored 指南（生成物逐字节可复算、与 `buildAuthoredScenarioGuide` 同口径、注册后 `import-scenario-guides --check` 94 场景全绿）；narrative-guides 第二轮交叉复核了指南与 manifest/flow 的结局键与跳章键 | `content/scenario-guide-sources/` · `web/scenario-guides/` |
| 原语 | **21/21** 份 pending 原语请求已全部落地或内容可做并接线：hunter、特性禁触发、地点附属修正、离场钩子、抽牌来源、生成落点、不可伤害/横置、翻面强制、屋顶连接、混乱袋降档、storyAssets 毁灭保留、逐人战役选择、基础弱点、受控剧情资产 action/free、攻击线索加伤、地点移动额外费用、地点附属离开检定、地点进入共同线索费用、Good Money 跨章维护禁资源、11688 enemyOverride/文本空白、合成地点 xsky schema | `artifacts/migration/tdc/p7/PRIMITIVES.md` · `primitive-requests/*.json` · [原语接口](primitives.md) |
| 逐卡 literal | 10 章的 `literalCardBehavior` 均通过。共享遭遇和战役流程的剩余差异按各自账本登记 | [逐章确认](../../../audit/tdc-migration.json) · [共享遭遇账本](../../../../../artifacts/migration/tdc/p7/literal/shared.json) · [战役流程账本](../../../../../artifacts/migration/tdc/p7/literal/campaign.json) |
| 存档重放 | 10/10 章 + 战役层 + 共享层均新增**真实**持久化测试：临时 `DSH_HOME` 下 `saveSnapshot`→`readSnapshot`，恢复状态全等并继续执行同一动作，结果指纹一致 | 各章 `tests/tdc-scenario-*.test.mjs` · `artifacts/migration/tdc/p7/literal-crosscheck/ledger-crosscheck.json` |
| 验证 | `npm run test:fast` 无失败；`npm run test:tdc:p7` 全绿；strict replay 与 recovered 基线逐局一致（第二轮改动行为中性）；`audit:tdc:p7` / `audit:tdc:scenarios` / `audit:tdc:check` 均通过；架构守卫按第二轮实测重锁 behavior 行数基线 | [P7 进度账本](../../../audit/tdc-p7.json) · [逐章账本](../../../audit/tdc-p7-scenarios.json) · `artifacts/migration/tdc/p7/*.log` |
| 发布时披露的差异 | 共享遭遇 6 条近似，战役 7 条流程解释。24 份原语请求均已完成 | [P8 发布验收](#p8-整体验收与发布) · [共享遭遇账本](../../../../../artifacts/migration/tdc/p7/literal/shared.json) · [战役流程账本](../../../../../artifacts/migration/tdc/p7/literal/campaign.json) |

- [x] 先迁移战役内共享的 Stowaways、Pilgrims、Star Spawn、Cosmic Legacy、Elder Mist、Undersea Creatures、Flood、R’lyeh、Domination、The Inescapable、Deep Ones、Dreams、Alien Machinery、Tasks、Expedition，再按第 3 节逐章接入。54 张条目逐卡 `note` 记录读点与近似，第二轮已补齐 3 条共享原语读点，章节 `encounterDefinitions` 已引用共享组。
- [x] 每章交付完整中英冒险指南，并通过生成、注册覆盖及桌面和移动端浏览器验收。[逐章浏览器证据](../../../audit/tdc-release-browser.json)
- [x] 实现序章、幕间 I–IV、终章导入和尾声，覆盖逐人任务、分支跳章、墓穴胜负、回阿卡姆、结算与存档继续。[战役端到端用例](../../../tests/tdc-p8-campaign.test.mjs)
- [x] 每章审计登记来源、身份、区域守恒、幕／议程、地图、遭遇行为、逐卡、符号、结局、叙事、保存／重放和浏览器证据。[逐章账本](../../../audit/tdc-p7-scenarios.json) · [双端证据](../../../audit/tdc-release-browser.json)

### P8 整体验收与发布

2026-11-20 完成 P8。大厅已开放《沉没之城》，战役、战役包和十章均注册为 `playable`。剧本、关键词和规则书三组确认均为 `verified`，`releaseAcceptance.status` 为 `complete`。选人和构筑沿用 P5、P6 的范围，在线推荐不可用时由引擎自动构筑合法牌组。[迁移总账](../../../audit/tdc-migration.json) · [战役清单](../../../content/campaigns/theDrownedCity/manifest.js)

| 验收项 | 当前结果 | 证据 |
| --- | --- | --- |
| 双端逐章 | 桌面 1440×900、移动 390×844 各通过十章。逐章验证地图入场、基本合法行动和双语指南资源，检查“关卡设置”的加载、分区顺序、剧透默认折叠及 Esc 关闭 | [浏览器验收账本](../../../audit/tdc-release-browser.json) |
| 大厅路线 | 桌面西线取得胜利，移动东线进入失败结局。两线均经真实大厅选人、构筑和开始章节，并按各自的结局选择绕过淹没城区。通过房主调试命令触发正常章末结算。另用调试跳关检查两线未到达的淹没城区和沉睡者墓穴牌桌 | [浏览器验收账本](../../../audit/tdc-release-browser.json) |
| 战役分支 | 生产引擎专项用例验证拒绝邀约、任务成功和失败、墓穴入场／绕行、墓穴尾声与经验结算、终章反击／放逐及失败结局。墓穴门槛与放逐路线使用预置条件，西线路线动作从头重放并比对终态指纹 | [战役端到端用例](../../../tests/tdc-p8-campaign.test.mjs) |
| 联机、AI 与存档 | 两个视口分别通过存档管理读回并继续行动。双真人与双真人加 AI 各走真实中转联机，检查座位权限、对方手牌和牌库顺序的隐私、真实行动和客人断线恢复。AI 使用大厅内置决策兜底 | [浏览器验收账本](../../../audit/tdc-release-browser.json) |
| 回归与审计 | 十循环专项、P4–P6 双端回归、索引、条目合规、叙事、指南、展示和 13 局严格重放通过。全量套件重跑确认新增失败为 0，10 项基线失败逐项列在回归账本 | [回归账本](../../../audit/tdc-p8-regression.json) · [严格回放基线](../../../../../artifacts/migration/tdc/replay-before-recovered.json) |
| 发布边界 | 常规发布，`earlyAccess: false`，无延后验收项。共享遭遇 6 条近似和战役 7 条流程解释均列入迁移账本的 `remaining`，规则等价认证状态为 `equivalenceCertified: false` | [迁移总账](../../../audit/tdc-migration.json) |

- [x] 从真实大厅建局并推进东西两线，复核西墙结局 3、养育场结局 4 的绕行和地图记录。战役专项覆盖墓穴和任务分支、终章两种幕牌及失败结局。[章节与战役流转](#3-章节与战役流转)
- [x] 在桌面 1440×900 和移动 390×844 验收十章。截图、联机、AI、断线恢复及存档读回记录按视口登记。[浏览器验收账本](../../../audit/tdc-release-browser.json)
- [x] 逐卡和总账本复算通过，发布账本登记验证命令、回归结果、截图及其 SHA-256。[验证命令](#5-验证命令)
- [x] 剧本、关键词、规则书三组确认和发布门槛均通过。[发布门槛](../../arkham-content-migration.md#8-审计状态与发布门槛) · [迁移总账](../../../audit/tdc-migration.json)

## 3. 章节与战役流转

序章为叙事步骤。10 个剧本入口按下表登记，编号沿用参考源中的身份列表。表内中文名来自现有简中卡表。

| 验收 | 章节 | 标识与提示卡 | 逐章重点 |
| --- | --- | --- | --- |
| [x] | 金盆洗手 / One Last Job | `oneLastJob` · `11501` | 露比赌局胜负、外星语言解锁记录、开场布局和进入幕间 I。 |
| [x] | 西墙 / The Western Wall | `theWesternWall` · `11517` | 5 层地点、相邻两整层互通与同层不连通、东西向起点与淹没差异、沉没阶梯、Do No Harm 结算。 |
| [x] | 淹没城区 / The Drowned Quarter | `theDrownedQuarter` · `11536` | 随机海床布局、文物 Barrier Node、供能改道记录及后续对大秘库布置的影响。 |
| [x] | 养育场 / The Apiary | `theApiary` · `11553` | 东西向遭遇组、迷失朝圣者、Hive Mind 及方向旋转、败退与寄生变异、跳章和 Grisly “Mask”。 |
| [x] | 大秘库 / The Grand Vault | `theGrandVault` · `11587` | 大阶梯与随机秘库房间、淹没布局、供能分支、内殿解封、Tidal Tablet 及 Good Money 对下一章的效果。 |
| [x] | 古代议庭 / Court of the Ancients | `courtOfTheAncients` · `11612` | 大升降机在 1–4 层移动，牌和标记随行，邻接与路径即时更新。另核对东西向布局、Cosmic Omen 与 Shard of Y’ch’lecht。 |
| [x] | 黑曜石峡谷 / Obsidian Canyons | `obsidianCanyons` · `11639` | 正交地图、开放天空、峰顶牌库从底抽和补空位、风暴强度、吊船、磁力尖塔、Obsidian Claw 双面及 Prove Your Worth。 |
| [x] | 沉睡者墓穴 / Sepulchre of the Sleeper | `sepulchreOfTheSleeper` · `11673` | 根据文物、字形与解封记录处理入场和跳过，验收 Disturbance、败退附加结算及直接结束战役的胜负分支。 |
| [x] | 阿卡姆的毁灭 第一部分 / The Doom of Arkham Part I | `theDoomOfArkhamPartI` · `11682` | 阿卡姆地点变体、盟友与 Horror in Clay、文物划除、淹没街区和失败弱点、两部之间升级。 |
| [x] | 阿卡姆的毁灭 第二部分 / The Doom of Arkham Part II | `theDoomOfArkhamPartII` · `11688a` | 按战役记录选幕／议程、布置未划除文物及继承淹没街区，验收克苏鲁本体／部位、独立牌库、怒气、胜负与 The Final Seal 阈值推进勘误。 |

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

以下命令从 `games/arkhamhorror/` 执行。两个扫描命令使用大厅参考资源目录复算来源与卡文指纹。迁移审计使用已记录的账本复算阶段状态。

```powershell
npm run scan:tdc:scope:check
npm run scan:tdc:check
npm run audit:tdc:check
npm run audit:tdc:p5
npm run audit:tdc:p6
npm run audit:tdc:p7
npm run audit:tdc:scenarios
npm run test:tdc:p7
npm run test:tdc:p7:content
npm run test:tdc:scenarios
npm run test:tdc:p8
npm run test:tdc:p8:browser
npm run verify:tdc:p8:regression
node tools/import-tdc-story.mjs --check
node tools/build-tdc-guides.mjs --check
node tools/build-tdc-guides.mjs --readiness
npm run test:tdc:p5:browser
npm run test:tdc:p6:browser
npm run test:tdc
npm run docs:check
npm run baseline:check
node tools/replay-fixtures.mjs --baseline ../../artifacts/migration/tdc/replay-before.json
node tools/replay-fixtures.mjs --compare ../../artifacts/migration/tdc/replay-before-recovered.json
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
