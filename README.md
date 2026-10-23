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
| 万象无终 | 9 章，`catalog-only` | 237 张，`catalog-only`（4 张序章故事调查员已实现） | 6 位 + 4 位序章（19 张），`verified` | 87 张，`catalog-only` | M1 与 M4 完成；M2/M3、M5 未开始 |

- **敦威治遗产**：八关的布置、结算、地点、敌人、遭遇与混乱标记规则均已接入，可以从大厅打通整条战役（包括开局二选一与祭坛后的分支）。五位调查员的能力、构筑、专属卡和专属弱点已接入。玩家卡已全部逐卡验收，其中 91 张可以构筑。另有一个「支援卡试点」包（实验室助理、奇异溶液、澄明心智），奇异溶液的升级依赖战役研究记录。
- **卡尔克萨之路**：原版循环已逐卡验收，战役已开放启动。六位调查员的能力、构筑、专属卡、专属弱点和存档回放都已通过逐人验收；玩家卡和基础弱点的主要印刷效果已逐卡验收，其中 92 张可以构筑。还差 M5 的大厅、联机与浏览器端到端认证。
- **失落的时代**：M3 与 M4 已完成，M5 已开放入口。十个章节（荒莽密林、埃兹特里的覆灭、命运之线、界限彼端、久远腹地上下两半、天机之城、幽嘶深渊、破碎永世、时间倒流）都有独立的 `definition.js` / `layout.js` / `behavior.js`：布置与放在一边区、幕与议程、地点符号连线、遭遇牌堆组成、混乱标记表、结局与跨章记录，并逐章接入七项循环机制（探索牌库、检查补给、复仇、伊格之怒、中毒、古代遗物、领队）。剧情正文由 `tools/import-tfa-story.mjs` 从锁定的中文来源生成，包含序章、十章导入、全部结局、五个幕间与尾声，运行时只投影已经到达的分支并按座位过滤私密段落。八个关键词（探索、复仇、伊格之怒、补给、中毒、古代遗物、远征领队、旧神标记）已逐项验收，规则书新增九条失落的时代条目（战役与记录、探索牌库、补给与检查补给、复仇与伊格之怒、中毒、古代遗物与领队、时间线与年代、深度等级、混乱符号），带拼音索引、卡文直达与桌面／移动端浏览器用例。五位调查员（里奥·安德森、厄休拉·唐斯、芬恩·爱德华兹、马泰奥神父、加尔文·怀特）与他们 11 张专属卡、91 张玩家卡均已逐卡验收。补给链路已接通：序幕按人数发放补给品点数（1/2/3/4 人 → 每人 10/7/5/4 点）并逐位购买，补给点提供第二次购买（8/5/4/3 点），幕间按卡面共同划掉等于人数的配给、用药品移除牌组里的中毒弱点、划掉汽油，清单显示在大厅的「补给品」页签与牌桌战役面板。五个幕间与补给点也按卡面顺序结算：毛毯、放哨者（双筒望远镜额外 2 XP）、配给不足（下一场起始资源 -3）、汽油与粉笔（没有则下一场不能换牌）、地图（「摸清前进的道路」）、水壶（下一场起始线索 +1）、伊塔卡的信念、归位程式反作用（离体体验与伊斯人身体）、恢复意识、火盆、遗物读数，以及补给点用 3 XP 治中毒 / 5 XP 治 1 点创伤。48 条战役记录都有中文名，幕间正文只把实际到达的段落写进「调查纪事」，局外面板还会显示一张「幕间纪事」羊皮纸卡。牌桌的战役面板显示复仇合计、伊格之怒、当前深度、石柱、漆黑、探索牌库剩余与古代遗物位置；牌堆里混入的核心盒遭遇卡（01163–01178 共 11 种）与 04259／04261 也已逐条实现，攻击／躲避型玩家卡能力不再引发借机攻击，4 张快速卡不再白花行动，「检定 A 或 B」由玩家选择技能。账本仍是 `earlyAccess`：章节的 `literalCardBehavior` 与浏览器验收尚未完成（逐章简化分支登记在 `audit/tfa-scenario-acceptance.json` 的 `gaps`），因此不宣称规则等价。
- **万象无终**：M0–M4 与 M1 已完成，M2/M3、M5 未开始；战役与九章仍是 `catalog-only`（不可启动），但六位正式调查员已经**可选人、可构筑**。范围账本锁定 343 张主卡 + 34 个关联面 = 377 条印刷记录（战役 237 / 调查员 19 / 玩家 87）；第 1 步机制扫描登记 20 个原语机制与 21 个遭遇组；第 2 步 14/14 原语已接线并有 116 例测试（闹鬼、幽灵界第二遭遇牌堆、幽灵地点翻面、塔罗牌组、阵法多技能、无牌组故事调查员、通用谈判、绑定、塔罗槽位、遗留记忆/看守人/战役资产、裂口与火盆、异端者多面与放逐、宇宙牌库；第 14 个「直觉牌库」随 M1 交付）；第 3 步 16 行关键词与机制台账全部 `verified`（`content/campaigns/theCircleUndone/keywords.js` 是唯一事实源，与机制扫描逐条对齐），规则书新增 16 条万象无终条目并同步拼音索引、卡文直达（377 条记录逐张校验）与桌面 1440／移动 390 浏览器用例；第 4 步把 11 条交互接进牌桌与大厅：塔罗抽牌（`pickTarot`）、序章选人（`storyInvestigator`）、闹鬼结算、幽灵牌堆面板、阵法多技能合计、裂口/火盆/幽灵地点徽标、异端者两面与「不能击败」、遗留记忆与看守人的公开提示，面板模型集中在 `web/tcu-ui.js`，样式在 `web/tcu-panels.css`，只读观察投影并只提交 `legalMoves` 里的动作。浏览器证据由 `tests/tcu-*.browser.mjs` 的 runner 生成到 `audit/tcu-browser-acceptance.json`，截图在 `artifacts/tcu-migration/`。逐章混乱符号表、剧本与逐卡行为分别属 P8、P7、P9；交互目前是组件级浏览器证据（真实模块/样式/引擎状态），从大厅进入剧情的实机路径要等 P8 接通序章后补跑，差异与未完成项记录在 `audit/tcu-migration.json` 的 `remaining`。

  M1（第 5 步 · 调查员）已交付：卡洛琳·弗恩、乔·戴蒙德、普雷斯顿·费尔蒙特、黛安娜·史丹利、丽塔·杨、玛丽·朗博六位调查员与他们的 13 张专属卡（含 6 张专属弱点）逐人验收——牌组 30/40/30/35/30/30，能力、旧印、构筑规则、专属卡与弱点、存档往返都在 `tests/tcu-investigators.test.mjs` 的 33 例里；序章 4 位故事调查员只在序章用（不进选人、无牌组），卡面能力与旧印同样实现。三个调查员专属读点单独成模块：直觉牌库（`src/engine/hunch-deck.js`，冒险设置抽 11 张洞察事件、调查阶段开始揭示并视作手牌、-2 费用、阶段结束洗回）、资源寄存（`src/engine/resource-bank.js`，「家族遗产」每回合 4 点、回合结束弃掉、获得的资源改为寄存）、法术专用额外行动（`src/engine/spell-actions.js`，有毁灭标记才给且只能用于法术）。构筑规则补上卡表里的三种新写法：`not: true` 的排除项（无高等级武器／无违法卡）、`text` 正则与 `hh`/`st` 标签、乔的「至少 11 张洞察事件」配额。手册见 [docs/tcu-investigators.md](docs/tcu-investigators.md)；5 条显式简化（05009／05010／05012／05013／05019 的个别子句）逐条写进账本 `remaining`，不宣称规则等价。

目前扩展玩家卡共有 272 张进入构筑池（敦威治与卡尔克萨 186 张 + 失落的时代 86 张）。以上数字以 `content/registered.js` 注册表为准，调整包状态或开放卡牌后应同步更新本节。

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
npm run test:mod -- arkhamhorror fast     # 日常回归：规则、AI、卡牌逻辑、golden replay，约 20 秒
npm run test:mod -- arkhamhorror assets   # 资源与生成器校验：卡池导入、展示资源、媒体许可，约 30 秒
npm run test:mod -- arkhamhorror slow     # 长跑：整局模拟、存读档迁移、100 局随机对局重放与大厅联机集成，约 2 分钟以上
npm run test:mod -- arkhamhorror          # 全量：每个文件独立进程并行，约 2.5 分钟
npm run test:mod -- arkhamhorror browser  # 浏览器回归，含大厅开局与联机界面（复用系统 Edge）
```

在 `games/arkhamhorror` 内还可以跑：`npm run baseline:check`（P0 基线：16 条审计 + 文档链接 + golden replay + `fast` 用例数）、`npm run docs:check`（文档本地链接体检）、`npm run scan:tcu:check`（《万象无终》机制扫描）、`npm run audit:tcu:primitives`（《万象无终》第 2 步原语账本复算；`npm run plan:tcu:primitives` 重写产物）、`npm run scan:tcu:scope:check` / `npm run audit:tcu:check`（M0 范围与迁移账本复算，P4 起含关键词与规则书确认、P5 起含交互确认、P6 起含调查员确认）、`npm run test:tcu:rules`（第 3 步关键词/规则书 Node 验收）、`npm run test:tcu:interactions`（第 4 步交互协议与面板模型 Node 验收）、`npm run test:tcu:investigators`（第 5 步 M1 六位调查员 + 13 张专属卡 + 4 位故事调查员的逐人验收）、`npm run test:tcu:interactions:browser`（规则书 + 交互面板的桌面 1440／移动 390 浏览器用例，并重写 `audit/tcu-browser-acceptance.json`）。

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
- 旧的阶段文档（architecture-refactor-roadmap.md、phase2-primitives.md、phase4-replay.md、phase5-migration.md、card-fidelity-*.md/.csv）已随 2026-10-22 的一卡一文件重构删除；重放口径并入 [ARCHITECTURE.md §5.3](ARCHITECTURE.md#53-重放撤销与迁移对比)，阶段判据并入 [docs/arkham-content-migration.md](docs/arkham-content-migration.md)。
- 大厅侧的适配入口：`index.js`、`src/integration/hall-integration.js`、`src/ai/agent-plans.js`

## 版权声明

本应用中关于[《诡镇奇谈：卡牌版》（Arkham Horror: The Card Game™）][arkham]的信息，包括文字与图像，版权归 © Fantasy Flight Games 所有。本项目是非官方的粉丝作品，并非由 Fantasy Flight Games 制作，也未获得其认可或支持，与其没有任何关联。

所有美术作品与插画的知识产权归各自的创作者所有。《诡镇奇谈：卡牌版》的全部图像与图形版权归 Fantasy Flight Games 所有。"Arkham Horror" 及相关名称、标志是其各自权利人的商标。

### Copyright Disclaimer

The information presented in this app about [Arkham Horror: The Card Game™][arkham], both textual and graphical, is © Fantasy Flight Games. This app is a fan project and is not produced, endorsed, or supported by, or affiliated with Fantasy Flight Games.

All artwork and illustrations are the intellectual property of their respective creators. All Arkham Horror: The Card Game™ images and graphics are copyrighted by Fantasy Flight Games.

[arkham]: https://www.fantasyflightgames.com/en/products/arkham-horror-the-card-game/
