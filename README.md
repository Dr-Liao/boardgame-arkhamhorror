# 诡镇奇谈：卡牌版（arkhamhorror）

[桌游大厅](../../README.md) 的合作卡牌 Mod，实现《诡镇奇谈：卡牌版》（Arkham Horror: The Card Game）的规则引擎、战役内容、AI 队友和浏览器牌桌。玩家与 0~3 名 AI 队友一起扮演调查员，合作完成战役。

![诡镇奇谈牌桌截图](docs/images/screenshot-table.jpg)

本目录是独立的 git 仓库（[boardgame-arkhamhorror](https://github.com/Dr-Liao/boardgame-arkhamhorror)），以子模块形式挂在大厅仓库 [boardgame-hall-ai](https://github.com/Dr-Liao/boardgame-hall-ai) 的 `games/arkhamhorror`，需要放在大厅内运行。

## 致敬

本项目深受 [halogenandtoast/ArkhamHorror](https://github.com/halogenandtoast/ArkhamHorror) 的启发，并以它作为主要参考。那是一个非官方、严格遵循规则的浏览器版《诡镇奇谈：卡牌版》（Haskell 后端 + Vue 前端，在线版本见 [arkhamhorror.app](https://arkhamhorror.app)），多年来积累了极其完整的卡牌与剧本实现。

我们从中参考的内容包括：

- 结构化卡牌数据（英文主表与简中、繁中卡表），作为本项目卡牌目录的导入来源；
- Haskell 源码中的卡牌定义与行为实现，用于核对规则细节；
- 卡图的解析与回退规则。

参考源在本地以只读方式保存，不做修补；卡牌字段的来源记录在 `catalog/provenance.json`。参考项目没有声明图片再分发许可，因此本项目只沿用卡图的解析规则，卡背等通用图片改用文字或 CSS 回退。

感谢 halogenandtoast 及所有贡献者的长期投入。

## 玩法

- **战役**：《夜之狂热》（3 关）、《敦威治遗产》（8 章）、《卡尔克萨之路》（8 章）和《失落的时代》（10 章）都可以从大厅启动。失落的时代按 M5 入口开放（`playable`，账本仍是 `earlyAccess`）：序幕会先选远征求领队并按人数购买补给品，幕间与补给点按卡面划掉配给、药品与汽油。逐张卡面字面核对仍在 `audit/tfa-migration.json` 的 `remaining` 清单中跟踪。各扩展的详细进度见下方「扩展包实现进度」。
- **调查员与构筑**：从各职业调查员中选择角色，可手动构筑或自动构筑。AI 队友会自动分配调查员并按属性契合度组出合法牌组。
- **回合循环**：神话阶段 → 调查阶段（每位调查员 3 个行动）→ 敌人阶段 → 重整阶段。
- **核心行动**：移动、调查（收集线索推进「幕」）、攻击、躲避、打出卡牌、使用资产能力；技能检定从混乱袋抽取标记。
- **跨关成长**：关卡结算后进入关间，处理经验、创伤、战役记录和卡组升级，再进入下一关。

规则采用本 Mod 的简化实现边界，未实现的机制默认阻断而不是近似放行。

## 扩展包实现进度

基础内容为核心包与《夜之狂热》。扩展按大循环迁移，每个循环拆成战役内容、调查员、玩家卡三个内容包，按 [迁移流程](docs/arkham-content-migration.md) 的 M0（目录基线）→ M1（调查员）→ M2（玩家卡）→ M3（剧本）→ M4（关键词与规则书）→ M5（发布验收）推进。包状态含义：`catalog-only` 只登记目录、不可选用；`verified` 已逐卡验收；`playable` 已开放到大厅。

| 循环 | 战役 | 战役内容 | 调查员 | 玩家卡 | 阶段 |
| --- | --- | --- | --- | --- | --- |
| 敦威治遗产 | 8 章，可启动 | 221 张，`playable` | 5 位（15 张），`verified` | 94 张，`playable` | 已发布 |
| 卡尔克萨之路 | 8 章，可启动 | 215 张，`playable` | 6 位（19 张），`verified` | 95 张，`verified` | M5 收尾 |
| 失落的时代 | 10 章，可启动（earlyAccess） | 231 张，`playable` | 5 位（16 张），`verified` | 91 / 91 张，`development` | M5 入口开放，逐卡核对进行中 |
| 万象无终 | 9 章，可启动（`playable`，earlyAccess） | 237 张，`playable`（9 张剧本参考卡由章节实现） | 6 位 + 4 位序章（19 张），`verified` | 87 张，`verified`（85 张可构筑 / 83 张可入牌组，2 张基础弱点只作依赖） | M5 已交付：大厅入口、逐卡账本与行为审计、发布浏览器证据；2026-10-25 修复战役后发布门禁 `gate.pass=true`（BGM 27/27、媒体双视口 37 项、浏览器 5 spec 28 例）；2026-10-25 第二轮全量逐卡行为审计：377 条记录 **363 match（登记已验收）/ 14 approximation / 0 gap**，8 组交叉复核后确认，口径仍 earlyAccess（见 [docs/tcu-card-audit-round2.md](docs/tcu-card-audit-round2.md)） |

- **敦威治遗产**：八关的布置、结算、地点、敌人、遭遇与混乱标记规则均已接入，可以从大厅打通整条战役（包括开局二选一与祭坛后的分支）。五位调查员的能力、构筑、专属卡和专属弱点已接入。玩家卡已全部逐卡验收，其中 91 张可以构筑。另有一个「支援卡试点」包（实验室助理、奇异溶液、澄明心智），奇异溶液的升级依赖战役研究记录。
- **卡尔克萨之路**：原版循环已逐卡验收，战役已开放启动。六位调查员的能力、构筑、专属卡、专属弱点和存档回放都已通过逐人验收；玩家卡和基础弱点的主要印刷效果已逐卡验收，其中 92 张可以构筑。还差 M5 的大厅、联机与浏览器端到端认证。
- **失落的时代**：M3 与 M4 已完成，M5 已开放入口。十个章节（荒莽密林、埃兹特里的覆灭、命运之线、界限彼端、久远腹地上下两半、天机之城、幽嘶深渊、破碎永世、时间倒流）都有独立的 `definition.js` / `layout.js` / `behavior.js`：布置与放在一边区、幕与议程、地点符号连线、遭遇牌堆组成、混乱标记表、结局与跨章记录，并逐章接入七项循环机制（探索牌库、检查补给、复仇、伊格之怒、中毒、古代遗物、领队）。剧情正文由 `tools/import-tfa-story.mjs` 从锁定的中文来源生成，包含序章、十章导入、全部结局、五个幕间与尾声，运行时只投影已经到达的分支并按座位过滤私密段落。八个关键词（探索、复仇、伊格之怒、补给、中毒、古代遗物、远征领队、旧神标记）已逐项验收，规则书新增九条失落的时代条目（战役与记录、探索牌库、补给与检查补给、复仇与伊格之怒、中毒、古代遗物与领队、时间线与年代、深度等级、混乱符号），带拼音索引、卡文直达与桌面／移动端浏览器用例。五位调查员（里奥·安德森、厄休拉·唐斯、芬恩·爱德华兹、马泰奥神父、加尔文·怀特）与他们 11 张专属卡、91 张玩家卡均已逐卡验收。补给链路已接通：序幕按人数发放补给品点数（1/2/3/4 人 → 每人 10/7/5/4 点）并逐位购买，补给点提供第二次购买（8/5/4/3 点），幕间按卡面共同划掉等于人数的配给、用药品移除牌组里的中毒弱点、划掉汽油，清单显示在大厅的「补给品」页签与牌桌战役面板。五个幕间与补给点也按卡面顺序结算：毛毯、放哨者（双筒望远镜额外 2 XP）、配给不足（下一场起始资源 -3）、汽油与粉笔（没有则下一场不能换牌）、地图（「摸清前进的道路」）、水壶（下一场起始线索 +1）、伊塔卡的信念、归位程式反作用（离体体验与伊斯人身体）、恢复意识、火盆、遗物读数，以及补给点用 3 XP 治中毒 / 5 XP 治 1 点创伤。48 条战役记录都有中文名，幕间正文只把实际到达的段落写进「调查纪事」，局外面板还会显示一张「幕间纪事」羊皮纸卡。牌桌的战役面板显示复仇合计、伊格之怒、当前深度、石柱、漆黑、探索牌库剩余与古代遗物位置；牌堆里混入的核心盒遭遇卡（01163–01178 共 11 种）与 04259／04261 也已逐条实现，攻击／躲避型玩家卡能力不再引发借机攻击，4 张快速卡不再白花行动，「检定 A 或 B」由玩家选择技能。账本仍是 `earlyAccess`：章节的 `literalCardBehavior` 与浏览器验收尚未完成（逐章简化分支登记在 `audit/tfa-scenario-acceptance.json` 的 `gaps`），因此不宣称规则等价。
- **万象无终**：M0–M5 已完成（发布口径 `playable` + `earlyAccess`）。P10 已把战役、9 章与 `tcuCampaign` 包升为 `playable` 并从大厅开放（`assertLaunchable` 通过）；九章在 P8 起就是真实章节（布置、幕/议程、遭遇规则、逐卡条目、混乱标记、结局记录与逐章测试都已接线，12 项检查全真）。六位正式调查员**可选人、可构筑**，87 张玩家卡逐卡验收（85 张可构筑 / 83 张可入牌组、2 张基础弱点只作依赖），P10 起 83 张可入牌组卡进入构筑界面与 TCU 战役起始牌组池。范围账本锁定 343 张主卡 + 34 个关联面 = 377 条印刷记录（战役 237 / 调查员 19 / 玩家 87）；第 1 步机制扫描登记 20 个原语机制与 21 个遭遇组；第 2 步 14/14 原语已接线并有 116 例测试（闹鬼、幽灵界第二遭遇牌堆、幽灵地点翻面、塔罗牌组、阵法多技能、无牌组故事调查员、通用谈判、绑定、塔罗槽位、遗留记忆/看守人/战役资产、裂口与火盆、异端者多面与放逐、宇宙牌库；第 14 个「直觉牌库」随 M1 交付）；第 3 步 16 行关键词与机制台账全部 `verified`（`content/campaigns/theCircleUndone/keywords.js` 是唯一事实源，与机制扫描逐条对齐），规则书新增 16 条万象无终条目并同步拼音索引、卡文直达（377 条记录逐张校验）与桌面 1440／移动 390 浏览器用例；第 4 步把 11 条交互接进牌桌与大厅：塔罗抽牌（`pickTarot`）、序章选人（`storyInvestigator`）、闹鬼结算、幽灵牌堆面板、阵法多技能合计、裂口/火盆/幽灵地点徽标、异端者两面与「不能击败」、遗留记忆与看守人的公开提示，面板模型集中在 `web/tcu-ui.js`，样式在 `web/tcu-panels.css`，只读观察投影并只提交 `legalMoves` 里的动作。浏览器证据由 `tests/tcu-*.browser.mjs` 的 runner 生成到 `audit/tcu-browser-acceptance.json`，截图在 `artifacts/tcu-migration/`；P8 起剧本实机路径由 `tests/tcu-scenarios.browser.mjs` 补跑（9 章 × 桌面/移动），P10 再由 `tests/tcu-release.browser.mjs` 覆盖真实大厅→序章→章节。逐卡自动账本 377/377 verified。逐卡行为审计在 2026-10-25 连续做了六轮修复后重跑（第二至七轮，每轮 8 组交叉复核 + Lead 裁决）：当前（第七轮）377 条记录 **363 match（登记已验收）/ 14 approximation / 0 gap**；未通过的 14 条逐卡写明差异并由 `audit/tcu-migration.json` 的 `remaining` 如实列出，不宣称规则等价（见 [docs/tcu-card-audit-round7.md](docs/tcu-card-audit-round7.md)、[第四轮](docs/tcu-card-audit-round4.md)、[第三轮](docs/tcu-card-audit-round3.md)、[第二轮](docs/tcu-card-audit-round2.md)、[docs/tcu-release.md](docs/tcu-release.md)）。修复战役后发布门禁 `gate.pass=true`：BGM 判据 27/27、媒体桌面+移动双视口 37 项、5 个浏览器 spec 28 例通过；引擎与逐卡内容修复在 artifacts 目录留档。`earlyAccess` 保持不变（尚有 14 条显式近似（gap=0））。

  M1（第 5 步 · 调查员）已交付：卡洛琳·弗恩、乔·戴蒙德、普雷斯顿·费尔蒙特、黛安娜·史丹利、丽塔·杨、玛丽·朗博六位调查员与他们的 13 张专属卡（含 6 张专属弱点）逐人验收——牌组 30/40/30/35/30/30，能力、旧印、构筑规则、专属卡与弱点、存档往返都在 `tests/tcu-investigators.test.mjs` 的 43 例里；序章 4 位故事调查员只在序章用（不进选人、无牌组），卡面能力与旧印同样实现。三个调查员专属读点单独成模块：直觉牌库（`src/engine/hunch-deck.js`，冒险设置抽 11 张洞察事件、调查阶段开始揭示并视作手牌、-2 费用、阶段结束洗回）、资源寄存（`src/engine/resource-bank.js`，「家族遗产」每回合 4 点、回合结束弃掉、获得的资源改为寄存）、法术专用额外行动（`src/engine/spell-actions.js`，有毁灭标记才给且只能用于法术）。构筑规则补上卡表里的三种新写法：`not: true` 的排除项（无高等级武器／无违法卡）、`text` 正则与 `hh`/`st` 标签、乔的「至少 11 张洞察事件」配额。手册见 [docs/tcu-investigators.md](docs/tcu-investigators.md)；4 条显式简化（05010／05012／05013／05019 的个别子句；05009 已在修复战役补齐并升为已验收）逐条写进账本 `remaining`，不宣称规则等价。

  M2（第 5 步 · 玩家卡）已交付：87 张玩家卡（85 张普通玩家卡 + 2 张基础弱点）逐卡验收——`src/cards/entries/05020–05324` 一卡一文件，4 个分片测试 `tests/tcu-player-m2-{1..4}.test.mjs` 共 123 例全绿；`tools/audit-tcu-player.mjs` 实跑分片测试后生成 `audit/tcu-player-acceptance.json` 与运行时模块 `src/cards/tcu-player-acceptance.js`（87/87 verified、85 可构筑、2 张基础弱点只作依赖、123 条逐卡证据，`--write` 后 `--check` 逐字节一致，`tests/tcu-player-ledger.test.mjs` 4 例守账本/可用性/升级池接线）。85 张可构筑卡进 `ALL_BUILDABLE_CODES` 和 TCU 调查员的升级池（`src/campaign/campaign.js` 的 `tcuPool`，既有循环记录看不到），默认自动构筑池与 replay 零变化；本批原语队列 17 条请求 → done 4（开局手牌 +1、离场回收、事件结算后窗口、条件图标）/ rejected 13，rejected 逐条折算为显式简化。19 张卡的个别子句为显式简化（取消面向、条件/时点、临时敌人数值修正、附属能力枚举等），逐条写在账本 `remaining`，不宣称规则等价。手册见 [docs/tcu-player-cards.md](docs/tcu-player-cards.md)。

  M3（第 5 步 · 9 章剧本）已交付：九章全部 `development`，每章 `scenarios/<id>/{index,definition,layout,behavior,chaos}.js`（共 47 文件 / 约 10,852 行）与章节专属单卡条目；`encounter-entries/theCircleUndone/**` 247 个 + 核心共享条目补遗全部 `implemented: true`，`pendingEncounterCodes = 0`、`scenarioGaps = 0`。逐章 12 项检查（来源锁/身份/区域/幕议程/地点连线/遭遇规则/逐卡/混乱/结局记录/正文摘要/存档回放/实机浏览器）**9/9 verified**：章节测试 9 文件 354 例（`npm run test:tcu:scenarios`）、账本 `audit/tcu-scenario-acceptance.json` 由 `node tools/audit-tcu-scenarios.mjs --write/--check` 逐字节复算；新增 `tests/tcu-scenarios.browser.mjs` 用真实内容注册表 + 真实 `createGameState` 建局，把真实会话交给真实 `web/` 界面跑 9 章 × 桌面/移动实机路径（与规则书/交互共 28 例、28 张截图，runner 写 `audit/tcu-browser-acceptance.json`）。引擎补了通用读点 `behavior.encounterDeckFor`（幽灵/普通遭遇牌堆自动路由）并修复资产型基础弱点（05042《高塔·XVI》）建牌组崩溃。88 条「忠实近似」逐条登记在 `behavior.scenarioApproximations` 与账本 `remaining`，不宣称规则等价；剧情全文、幕间与战役流程属 P9，发布门禁（大厅入口、`assertLaunchable`、展示素材）属 P10。手册见 [docs/tcu-scenarios.md](docs/tcu-scenarios.md)。

  M3-C（第 5 步 · 剧情）已交付：`tools/import-tcu-story.mjs` 从 10 个锁定中文 JSON 生成 `content/campaigns/theCircleUndone/story-text.js`（内嵌全部来源 SHA-256，`--check` 重新读来源逐字节复算，来源变更即失败；运行时不读 `参考资源/`）。序章（4 位故事调查员引言 + 22 条塔罗结果）、9 章导入与全部结局分支、4 段幕间、8 个战役结局与尾声都有导入正文（其中 `unionAndDisillusion/r9`、`beforeTheBlackThrone/r6` 两条来源本身是英文，原样导入、不冒充中文）；`src/campaign/story.js` 按进入章节时的战役记录/结局选择段落，未触发分支不写进「调查纪事」。`manifest.flow` 接成「序章 → 9 章 → 幕间二/三/四 → 尾声」的完整节点链（`validateCampaignGraph` 通过；幕间二按 Josef 记录与秘社身份分支、幕间三按核心圈路径分支、幕间四结算 `twistOfFate`），选择/XP/混乱标记/记录写入统一走 `campaign-effects` 的 `crossOffMementos`／`storyQuestions`／`twistOfFate`。序章引言与塔罗结果只进 `campaign.privateStories`，经 `campaignView`／`campaignStory(observerSeat)` 按座位过滤，不进 `scenarioIntro`。`tests/tcu-story.test.mjs` 覆盖生成物一致性、逐章正文/结局、分支互斥、幕间效果、旧存档不重写与私密投影；`node tools/import-tcu-story.mjs --check` 与剧情测试都由审计工具实跑并计入 `gate.storyVerified`。显式回退（`beforeTheBlackThrone/noResolution`、`unionAndDisillusion/r5`）与显式近似（幕间二 price 选择、expert 混乱标记 -6、returnTo 排除等）逐条进账本 `remaining`。战役仍 `catalog-only`、不能从大厅启动，大厅入口与发布素材属 P10。手册见 [docs/tcu-story.md](docs/tcu-story.md)。

  M5（第 6 步 · 发布）已交付（P10，2026-10-24）：战役/9 章/`tcuCampaign` 包升 `playable`，真实大厅路径打通（启动页 → 调查准备 → 选调查员 → 自动构筑 → 确认准备 → 开始关卡 → 序章选人 → 牌桌），演示素材补齐 10 张占位场景/桌面 WebP 与 27 首专属 BGM（`web/audio/music/sources.json` 逐字节哈希）。逐卡验收分两层：`tools/audit-tcu-all-cards.mjs` 实跑 441 例后生成 `audit/tcu-all-card-acceptance.json`（377/377 verified、pending 0、225 张带备注），逐卡行为审计 `audit/tcu-card-behavior-audit.json` 逐条核对「卡面印刷描述 vs 实现」；2026-10-25 第二轮全量重跑并加 8 组交叉复核后为 **152 match（登记已验收）/ 192 approximation / 33 gap**，225 条非 match 逐卡写明差异（33 gap 单独列出），发布口径按路线图 §8.4 取 `earlyAccess`（`playable: true`、`earlyAccess: true`、`equivalenceCertified: false`，不宣称规则等价；逐卡清单见 [docs/tcu-card-audit-round2.md](docs/tcu-card-audit-round2.md)）。发布级浏览器证据 5 个 spec 一次跑齐：28 例通过 / 28 张截图，含 `tests/tcu-release.browser.mjs` 的「真实大厅 → 序章 → 撤退结算 → 下一章《巫异时刻》」桌面/移动路径，与 `tests/tcu-media.browser.mjs` 的 37 项真实 HTTP 资源校验；同一命令连跑 4 次报告逐字节一致。审计还顺带修复进关演出后地图不自动适配（`web/game-ui.js`）与序章 05043 骷髅判定改用 `testActionKind` 两个缺陷。手册见 [docs/tcu-release.md](docs/tcu-release.md)。

目前扩展玩家卡共有 **357 张进入构筑池**（敦威治与卡尔克萨 186 张 + 失落的时代 86 张 + 万象无终 83 张；万象无终另有 2 张 `deckLimit=0` 的绑定副本只作场外检索、不计入牌组）。以上数字以 `content/registered.js` 注册表为准，调整包状态或开放卡牌后应同步更新本节。

## AI 队友

诡镇是大厅里合作类 Mod 的完整示例：

- 一个调查员每回合有 3 个行动点，AI 在同一回合内的多步决策共享对话历史（回合内记忆）。
- AI 只能看到自己座位的观察投影，读不到其他人的手牌、牌库顺序或未触发的剧情。
- 模型不可用时，兜底行动以对局随机数状态为种子，同一局可复现。
- 战术交流、备忘等功能由大厅提供，详见 [大厅 README](../../README.md#战术交流与备忘)。

## 安装

本 Mod 不能单独运行，需要放在大厅仓库的 `games/arkhamhorror` 下：

```bash
git clone https://github.com/Dr-Liao/boardgame-hall-ai.git
cd boardgame-hall-ai
git clone https://github.com/Dr-Liao/boardgame-arkhamhorror.git games/arkhamhorror
npm install
```

大厅不跟踪本目录。已经克隆过的话，在 `games/arkhamhorror` 里 `git pull` 即可更新。

卡图约 1.9 GB，不在仓库中。首次显示时会自动缓存，也可以在本目录运行 `npm run images:fetch` 一次性下载（`npm run images:estimate` 预估大小，`npm run images:verify` 校验）。

Windows 发布时，卡图单独打成资源包：在大厅根目录双击 `build-windows-assets.bat` 或运行 `npm run build:windows:assets`。

## 测试

在大厅根目录运行：

```bash
npm run cards:check                      # 一卡一文件 / entries 索引守卫（改玩家卡后先跑）
npm run cards:encounter-check            # 非玩家卡索引与归属守卫
npm run test:mod -- arkhamhorror fast     # 日常回归：规则、AI、卡牌逻辑、golden replay（本机约 25 秒）
npm run test:mod -- arkhamhorror assets   # 资源与生成器校验：卡池导入、展示资源、媒体许可（本机约 25 秒）
npm run test:mod -- arkhamhorror slow     # 长跑：整局模拟、存读档迁移、随机对局重放与大厅联机集成（本机约 1 分钟）
npm run test:mod -- arkhamhorror          # 全量：每个文件独立进程并行（本机约 1.4 分钟）
npm run test:mod -- arkhamhorror timing   # 打印各文件耗时、tier 墙钟与并行度（node tools/test-timings.mjs）
npm run test:mod -- arkhamhorror browser  # 浏览器回归，含大厅开局与联机界面（复用系统 Edge）
```

在 `games/arkhamhorror` 内还可以跑：`npm run baseline:check`（P0 基线：16 条审计 + 文档链接 + golden replay + `fast` 用例数）、`npm run docs:check`（文档本地链接体检）、`npm run scan:tcu:check`（《万象无终》机制扫描）、`npm run audit:tcu:primitives`（《万象无终》第 2 步原语账本复算；`npm run plan:tcu:primitives` 重写产物）、`npm run scan:tcu:scope:check` / `npm run audit:tcu:check`（M0 范围与迁移账本复算；P10 起含发布门禁、逐卡账本、行为审计与 earlyAccess/remaining）、`npm run test:tcu:rules`（第 3 步关键词/规则书 Node 验收）、`npm run test:tcu:interactions`（第 4 步交互协议与面板模型 Node 验收）、`npm run test:tcu:investigators`（M1 六位调查员 + 13 张专属卡 + 4 位故事调查员的逐人验收）、`npm run test:tcu:player`（M2 四个分片 123 例逐卡验收 + 账本接线 4 例）、`npm run audit:tcu:player`（M2 玩家卡账本：实跑分片测试并逐字节复算账本与生成模块）、`npm run test:tcu:cards`（P10 逐卡字面测试 275 例 + 全卡账本守卫 6 例）、`npm run audit:tcu:all-cards`（377 条全卡账本：实跑 6 个测试文件后逐字节复算）、`npm run test:tcu:interactions:browser`（规则书 + 交互面板的桌面 1440／移动 390 浏览器用例，并重写 `audit/tcu-browser-acceptance.json`）、`npm run test:tcu:browser`（P10 发布证据：规则书/交互/9 章实机/大厅→序章→章节/媒体资源 5 个 spec 一次跑齐）、`npm run test:tcu:story`（M3-C 剧情验收）、`npm run import:tcu-story:check`（剧情生成物与 10 个来源逐字节复算）。

改卡行为后要证明"行为零变化"：`node tools/replay-fixtures.mjs --baseline <文件>`（改动前）→ 改 → `--compare <文件>`（改动后）；
只改了文案/卡图等非行为内容时，`npm run replay:fixtures` 应当仍然全绿。说明见 [ARCHITECTURE.md §5.3](ARCHITECTURE.md#53-重放撤销与迁移对比)。

诡镇在大厅上的集成回归（多人联机、换牌确认、开局与存档界面）在 `tests/hall-online.test.mjs`、`tests/hall-online.browser.mjs` 与 `tests/hall-setup.browser.mjs`；大厅自身的回归不再依赖诡镇。

免安装包的卡图资源包由 `boardgame-mod.json` 的 `assetPacks` 声明，`tools/prepack-release.mjs --asset-pack=arkham-cards` 为它生成卡图清单；使用说明里的诡镇条目来自 `portableNotes`。

改动规则、默认值或 AI 时先跑 `fast`，只改卡牌数据或素材时再跑 `assets`。分层清单在 `tests/suites.mjs`，新增用例必须声明所属层级，否则守卫用例会报错。

HTTP 和浏览器回归会加载大厅的 `lib/server.js`，所以需要在大厅目录内运行。其中包含「同一种子产生相同 AI 决策序列」的复现性断言。更多说明见 [测试说明](../../docs/testing.md)。

## 文档

- [ARCHITECTURE.md](ARCHITECTURE.md)：目录职责、依赖方向、运行流程、内容扩展和修改约定（含演进规矩摘要与重放对比 §5.3）
- [docs/card-model.md](docs/card-model.md)：卡牌模型 v1——十一种能力 kind、修正与条件、目标枚举、持续效果、生命周期读点契约、迁移标准动作
- [docs/card-entry-files.md](docs/card-entry-files.md)：一卡一文件的行为目录与 **agent 一次执行清单**（新增/修改/迁移卡的固定流程，含非玩家卡的通用 / 战役共用 / 关卡专用落点）
- [docs/encounter-entry-split-plan.md](docs/encounter-entry-split-plan.md)：非玩家条目现状扫描与拆分方案（529 条 → 单卡文件、归属算法、工具与验收门槛）
- [docs/arkham-content-migration.md](docs/arkham-content-migration.md)：扩展战役的迁移流程与验收门槛——六步顺序、原语拆分、关键字/规则书、交互一致性、多子进程批量迁移与原语队列
- [docs/tcu-migration-roadmap.md](docs/tcu-migration-roadmap.md)：四循环《万象无终》迁移路线图——范围、机制扫描、原语与交互、批次依赖、验收门禁与风险
- [docs/tcu-primitives.md](docs/tcu-primitives.md)：四循环第 2 步原语手册——已接线原语的读写点、测试与证据，以及尚未实现的原语清单
- [docs/tcu-rules.md](docs/tcu-rules.md)：四循环第 3 步关键词与规则书手册——16 行关键词台账、16 条规则条目、卡文直达判据与由 runner 生成的浏览器证据
- [docs/tcu-interactions.md](docs/tcu-interactions.md)：四循环第 4 步交互与界面手册——三种专用待决选择、11 条交互的落点、面板模型与浏览器证据（含「实机路径待 P8」的边界说明）
- [docs/tcu-investigators.md](docs/tcu-investigators.md)：四循环第 5 步 M1 调查员手册——六位正式调查员与 13 张专属卡、三个调查员专属读点（直觉牌库／资源寄存／法术专用行动）、四个新时机窗口、序章故事调查员、显式简化与验收证据
- [docs/tcu-player-cards.md](docs/tcu-player-cards.md)：四循环第 5 步 M2 玩家卡手册——87 张逐卡验收口径（账本/生成物/证据前缀）、可用性与构筑/升级池接线、4 个新原语、19 张显式简化清单、门禁实测数字与 P8/P9/P10 边界
- [docs/tcu-scenarios.md](docs/tcu-scenarios.md)：四循环第 5 步 M3 剧本手册——9 章目录契约、逐章清单与实现要点、12 项验收与账本/来源锁/浏览器 runner、88 条近似口径、P9/P10 边界与命令
- [docs/tcu-story.md](docs/tcu-story.md)：四循环第 5 步 M3-C 剧情手册——中文剧情生成器与来源哈希、`TCU_STORY_TEXT` 形状、逐章分支与战役流程图、幕间 2/3/4 结算、尾声/结局、座位级私密正文、测试/审计命令、显式回退与显式近似、P10 边界
- [docs/tcu-release.md](docs/tcu-release.md)：四循环 M5 发布手册（P10）——playable/earlyAccess 口径、大厅入口与卡池开放、展示素材与 27 首 BGM、逐卡自动账本与逐卡行为审计（第七轮 363 match / 14 approximation / 0 gap）、发布级浏览器证据与 5-spec 命令、审计门禁、边界与后续工作
- [docs/tcu-card-audit-round2.md](docs/tcu-card-audit-round2.md)：四循环逐卡行为审计第二轮（2026-10-25，修复前基线）——判据、377 条记录分布、已验收清单（152 条）、未通过清单（192 approximation / 33 gap）、8 组交叉复核与 Lead 裁决、优先修复项与复现命令
- [docs/tcu-card-audit-round3.md](docs/tcu-card-audit-round3.md)：四循环逐卡行为审计第三轮（2026-10-25，第一次修复后重验）——377 条记录重审结果（283 match / 78 approximation / 16 gap）、新验收 131 张、8 组交叉复核与 Lead 裁决
- [docs/tcu-card-audit-round4.md](docs/tcu-card-audit-round4.md)：四循环逐卡行为审计第四轮（2026-10-25，继续修复后重验）——377 条记录重审结果（313 match / 54 approximation / 10 gap）、新验收 30 张、8 组交叉复核与 Lead 裁决
- [docs/tcu-card-audit-round7.md](docs/tcu-card-audit-round7.md)：四循环逐卡行为审计第七轮（2026-10-25，继续修复后重验）——新增引擎读点与 8 包内容修复摘要、377 条记录重审结果（**363 match（登记已验收）/ 14 approximation / 0 gap**）、新验收 13 张、7 组交叉复核与 Lead 裁决、已验收清单（326 条）与未通过清单、复现命令
- 旧的阶段文档（architecture-refactor-roadmap.md、phase2-primitives.md、phase4-replay.md、phase5-migration.md、card-fidelity-*.md/.csv）已随 2026-10-22 的一卡一文件重构删除；重放口径并入 [ARCHITECTURE.md §5.3](ARCHITECTURE.md#53-重放撤销与迁移对比)，阶段判据并入 [docs/arkham-content-migration.md](docs/arkham-content-migration.md)。
- 大厅侧的适配入口：`index.js`、`src/integration/hall-integration.js`、`src/ai/agent-plans.js`

## 版权声明

本应用中关于[《诡镇奇谈：卡牌版》（Arkham Horror: The Card Game™）][arkham]的信息，包括文字与图像，版权归 © Fantasy Flight Games 所有。本项目是非官方的粉丝作品，并非由 Fantasy Flight Games 制作，也未获得其认可或支持，与其没有任何关联。

所有美术作品与插画的知识产权归各自的创作者所有。《诡镇奇谈：卡牌版》的全部图像与图形版权归 Fantasy Flight Games 所有。"Arkham Horror" 及相关名称、标志是其各自权利人的商标。

### Copyright Disclaimer

The information presented in this app about [Arkham Horror: The Card Game™][arkham], both textual and graphical, is © Fantasy Flight Games. This app is a fan project and is not produced, endorsed, or supported by, or affiliated with Fantasy Flight Games.

All artwork and illustrations are the intellectual property of their respective creators. All Arkham Horror: The Card Game™ images and graphics are copyrighted by Fantasy Flight Games.

[arkham]: https://www.fantasyflightgames.com/en/products/arkham-horror-the-card-game/
