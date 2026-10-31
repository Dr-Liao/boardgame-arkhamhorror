# 《食梦者》剧本手册（M3 / P8 已交付 · 8 章 development）

> **口径**：本文件是 P8 交付后的剧本手册。**8 章全部落地为 `development` 章节**（`check:tde:scenario` 8/8 PASS），
> 283 条战役记录逐条有落点；**剧情正文（P8-T 自译）与逐卡等价/浏览器验收仍 pending**，
> 三组确认未齐前不得升 `playable`、不得宣称规则等价。
> 逐章账本：[`../audit/tde-scenario-acceptance.json`](../audit/tde-scenario-acceptance.json)（8/8 development、253/253 记录覆盖、12 条显式简化）。
> 来源锁：[`../audit/tde-scenario-source-lock.json`](../audit/tde-scenario-source-lock.json)（8 章 Haskell + en locale 逐章 + 8 个战役公共来源 SHA-256）。
> 路线图：[`tde-migration-roadmap.md`](./tde-migration-roadmap.md) §8.3；规范：[`arkham-content-migration.md`](./arkham-content-migration.md) §3 / §5。
> 阶段报告：[`tde-p8-report.md`](./tde-p8-report.md)。P8-T 剧情：[`tde-story.md`](./tde-story.md)。

## 1. 事实：8 章 = 双战役各 4 章

- `tdeCampaign` 283 条记录 = 8 章节组 **253** 张 + 12 个战役共享组 **30** 张；20 组 = 8 章节组 + 12 共享组。
- 分片按「章对」：对 1（A1+B1）47 / 对 2A（A2，最大章）53 / 对 2B+对 3A 57 / 对 3B 37 / 对 4A 37 / 对 4B+12 共享组 52 = **283**。
- 逐章记录全部有落点：249 张主卡由 `definition.js` 的 locations/acts/agendas/enemies/treacheries/storyAssets/storyFaces
  引用，或由 `src/cards/encounter-entries/theDreamEaters/**` 单卡条目承载；34 个关联面按 `encounterCode` 归属组目录。
- **10 条 noEntry（登记理由，不建条目）**：8 张剧本参考卡（`type=scenario`：06039/06063/06119/06168/06206/06247/06286/06333，
  由 `manifest.referenceCode` + 章节 definition/chaos 承载）+ 2 张背面故事面（06057b/06058b，谈判/击败分支在正面敌人条目结算）。

| # | id | 参考卡 | 中文名 | 线 | 对 | 包 | 地点（掩藏） | 幕/议程 | 敌/诡 | 剧情面 | 结局 |
| ---: | --- | --- | --- | --- | ---: | --- | --- | --- | --- | ---: | ---: |
| 1 | `beyondTheGatesOfSleep` | 06039 | 梦境门外 | A | 1 | tde | 12（0） | 4 / 1 | 8 / 12 | 2 | 3 |
| 2 | `wakingNightmare` | 06063 | 清醒噩梦 | B | 1 | tde | 8（0） | 3 / 3 | 5 / 11 | 1 | 7 |
| 3 | `theSearchForKadath` | 06119 | 寻觅卡达斯 | A | 2 | sfk | 17（15） | 5 / 2 | 13 / 10 | 17 | 3 |
| 4 | `aThousandShapesOfHorror` | 06168 | 万千骇形 | B | 2 | tsh | 15（0） | 2 / 3 | 6 / 12 | 0 | 5 |
| 5 | `darkSideOfTheMoon` | 06206 | 月之暗面 | A | 3 | dsm | 10（0） | 4 / 3 | 5 / 9 | 0 | 2 |
| 6 | `pointOfNoReturn` | 06247 | 无归之地 | B | 3 | pnr | 13（8） | 3 / 2 | 9 / 14 | 12 | 3 |
| 7 | `whereTheGodsDwell` | 06286 | 神居之所 | A | 4 | wgd | 11（0） | 5 / 3 | 11 / 17 | 0 | 6 |
| 8 | `weaverOfTheCosmos` | 06333 | 编织宇宙 | B | 4 | woc | 11（0） | 3 / 3 | 9 / 8 | 0 | 6 |

- 遭遇牌库张数（印刷展开）：A1 0（开局无遭遇牌库，41 张全部 set aside）/ B1 20 / A2 26 / B2 34 / A3 28 / B3 30 / A4 27 / B4 26。
- 跨循环通用组 8/8 可用（P1）：locked_doors / striking_fear / chilling_cold / ghouls / rats / ancient_evils / nightgaunts / "
  `DarkCult ↔ pentagram`（卡池 `encounterName='Dark Cult'`）。
- TDE 战役共享组条目落点：`src/cards/encounter-entries/theDreamEaters/_shared/<encounterCode>/`；
  其中 06053「魔幻森林」被 A1 与 B3 同时引用（B3 按 setup 从收藏中取出并放一边），归属算法要求放
  `_shared/beyond_the_gates_of_sleep/06053.js`（`encounter-entry-placement` 复算 0 unresolved/0 mismatch）。

## 2. 逐章实现要点

| 章 | 已实现（可测） | 显式简化 / gaps（账本 remaining 逐条） |
| --- | --- | --- |
| **梦境门外** A1 | 14 种梦境选择（效果声明）、开局无遭遇牌库（`modifyDeck` 清空 + encounterAside）、5 地点入场 + 5 张森林随机分配「面前」、纳什特/卡曼塔双面敌人 parley→翻故事面、幕 1–3 神话不抽遭遇、结局 1/2/noResolution + 4 个记录写入 | 「从牌库找 X 并打出」近似为进手牌+付印刷费；「把 1 张基础弱点换成随机基础弱点」记录并提示；故事面 06057b/06058b 不建条目（用 flags 记录）；「火焰洞穴/魔幻森林」等地点规则走 locationRule/flags + behavior 数据分派 |
| **清醒噩梦** B1 | 蛛群滋生袋（`api.tokenBag`：7 枚 token）、蛛巢/寄生状态与蔓延检定、护工→蛛群替换、议程强制、结局 7 个 | 寄生地点「伤害标记/封印换恐惧标记」的可见面板属 P5/P9；本层只维护 tokenBag 寄生状态与 `scenarioFlags.sealedRifts` |
| **寻觅卡达斯** A2 | 4 区域切换（清线索/移除旧地点/区域 spawn/夜魇 set aside）、15 张 Veiled（引擎原生 `flipVeiled` + `veiledFlipped` 读背面故事卡、06143b 入胜利区）、10 神迹 → R1、斯凯河/禁闭之地自翻面检定、6 港口撤退、被俘/证据/维吉尔/伦道夫记录 | 塞拉尼安「无手牌放行」、夜魇附属不保留、伊莱克-瓦达费用减免、06145 躲避额外标记、06149 动态反击（见 11 条 rejected 原语请求与 P9 清单） |
| **万千骇形** B2 | 183–188 神秘阶梯纵向链（`api.verticalChain`）、Endless Descent 随机重排、蜂拥授予（agenda grantsSwarming）、三件「记住」事实驱动不可名状之物数值、结局 2→3/4 分流 | 06193「另一张卡进入威胁区后弃手牌」无读点；06168 剧本参考卡的 chaos「再揭示一个标记」无剧本级额外揭示原语（chaos.js 记简化） |
| **月之暗面** A3 | 警报等级 0–5（`api.counters`，max 5）、被俘开场（garry 入场/每人 2 线索/警报 1）、白船限制、月蜥/拜亚基数值、土星猫 Swarming X（alarmLevel 口径）、议程 I/III 背面、结局记录 | 06214b「下船」翻面结算按翻面瞬间线索数二选一（behavior 流程） |
| **无归之地** B3 | 8 张漆黑之海 Veiled（`veiledFlipped` 读故事卡；**官方规则无洗回**）、巨噬蠕虫隧道、桥梁进度（`api.markers` / 记录 StepsOfTheBridge）、敌人身上放线索（`api.addCluesToEnemy`）、从胜利区取回巨噬蠕虫（`api.takeFromVictory`）、12 张背面故事面 `flags.storyRule` 分派 | 「查看遭遇牌库顶并任意排序」近似为弃到一半；「敌人正面朝下附属到皮克曼」用 flags 计数+removeEnemyFromGame 近似；「打乱漆黑之海位置」只做线索平均分配与重置可翻面；「卡达斯放一边的 1 点毁灭」计入在场毁灭（离场口径有偏差） |
| **神居之所** A4 | 5 形态奈亚拉托提普抽到后秘密进手牌（`hiddenEnemyInHand` + `api.hiddenCards`），塔×低语罗盘匹配→胜利区/洗回、Grand Design、act4 真形合成（攻/躲最高、生命/伤害/恐惧/胜利求和、关键词合并）、act5 真形生命按团队线索 -1、结局 5+noResolution | 「提到它则发疯」是桌面口头约定（无可机械化读点）；手牌敌人攻击按印刷伤害/恐惧直接结算（无攻击反应窗口）；塔方位只做匹配不做地图重排 |
| **编织宇宙** B4 | 11 个巨网实例（4 初始 + 7 展开）、3 幕 3 议程（神话旋转沿 8 段环）、四条腿 Massive/离开/击败标记、地点毁灭（`api.locationDoom`）、06342 调查阶段末、`spawnLocation`/`enemyAttackModifier`/`afterEvade`/`moveError` 数据分派 | 阿特拉克「躲避替代：不能攻击所选调查员」按不横置+本轮不攻击任何人近似（引擎无按人粒度攻击封锁读点；11 条 rejected 之一） |

- 通用约定：`definition.js` 纯 JSON（`intro/setup/rules/resolutions` 逐字 en 原文去 HTML + `textLanguage:'en'`/`textStatus:'pending-self-translation'`）；
  `tokenMeanings` 在 scenario 对象上；`behavior = { ...encounterRules, id, ... }` 且覆盖共享钩子必须显式转发；
  卡号常量统一在 `definition.js` 的 `RAW_CODES`（behavior 不写卡号字面量）。
- 12 条显式简化 = 各章 `behavior.scenarioGaps`，逐条进账本 `remaining`，未静默近似。

## 3. 战役层（manifest / 幕间 / 尾声）

- `manifest.js`：`status:'development'`、`requiredPackIds:['core','tdeCampaign','tdeInvestigators','tdePlayer']`、
  `parts`（A 梦寻 / B 梦网各 4 章 4 对）、`modes:['singleA','singleB','pick','parallel']`、`sharedEncounterGroupIds`
  （12 个战役共享组，供归属算法）、`chaosBags`（默认 A）+ `partChaosBags`（A/B 两套）、`recordSchema`（55 键）、
  `epilogueMatrix`（16 段）+ `singleLineEpilogue`、`flows`（四模式）与默认 `flow`（双线）。
- `interludes.js`：幕间 I（黑猫）/ II（入梦者）/ III（伟大的存在）节点图 + 32 段 en 原文（`pendingTranslation`）+
  21 条选项 + 条件/效果数据；`attachInterludes(flow,{mode})` 单线 A 只保留幕间 I 的 A 侧、单线 B 保留 B 侧 +「你独自前行」。
- `dual-story.js`：16/16 尾声矩阵（`normalizeEpilogueMatrix ok`，每格 `theDreamEaters.flavorText.epilogue<n>`）+
  Part 5（全杀 A 线）/ Part 13（全疯 A 线）/ Part 17（被俘 → `brokeTheLawOfUlthar`）特殊子步骤 +
  单线「无尾声正文」说明；`attachEpilogue(flow)` 把最后一对 gate 接 16 分支。
- 数据级限制（P9.5 接线）：引擎 `campaignManifestFor` 目前用 `partManifest` 覆盖 `flows.singleA/B` 自定义幕间；
  幕间跨 part 效果以 `effects[].part` / `branches.pendingEngine` 形式备好，需按 `recordInPart`/`mutateBothBags` 分发。
- 记录类型：2 个 number（`stepsOfTheBridge` 等计数）、2 个逐调查员 `string[]`、51 个 boolean；4 个「从不写入」键
  （`theDreamersStrayedFromThePath` 等）按参考实现保留，Weaver R1 永远落到 R5 的口径在 P8-T/P9 复核。

## 4. 章节目录契约（P8 实形）

```
content/campaigns/theDreamEaters/scenarios/<id>/
├─ index.js        # manifest = scenarioManifest(...)，导出 { scenario, identities, layout, behavior, implementedEncounterCodes }
├─ definition.js   # 纯 JSON：地点/幕/议程/遭遇定义/放在一边/结局/文本 + RAW_CODES 数据表
├─ layout.js       # 桌面坐标（layoutFor；复用既有布局变量）
├─ behavior.js     # 引擎钩子与章节流程（共享 encounterRules 扩展；不写卡号字面量）
├─ chaos.js        # 逐章混乱符号数值与失败后果（tokenMeanings 在 definition 的 scenario 上）
└─ texts.js / text-en.js  # （可选）en locale 逐字原文模块，P8-T 后可删
```

- 单卡条目：`src/cards/encounter-entries/theDreamEaters/<chapterId>/<code>.js`（关卡专用）或
  `.../_shared/<encounterCode>/<code>.js`（战役共享组）；一卡一文件、`code`=文件名、`implemented:true`、
  只读 state / 写入只走 `api.*`（R1 审计）。
- 归属算法以「磁盘内容」为准（P8 起 `tools/encounter-entry-placement.mjs` 会把未注册但已落地的
  development 章节加入归属索引），当前 0 unresolved、0 mismatch。

## 5. 逐章 12 项检查（账本口径）

`sourceLocked / identityRegistered / setupAndZones / actsAndAgendas / locationsAndConnections / encounterBehaviors /
literalCardBehavior / chaosEffects / resolutionsAndRecords / storyText / saveReplay / browserAcceptance`

- 当前 8/8：前 7 项 + `chaosEffects/resolutionsAndRecords/saveReplay` 为 `true`；
- `literalCardBehavior`：**P8 恒 false**（逐卡等价核对属 P9）；
- `storyText`：false（P8-T 未开工；`story-text.js` `status:'pending'`、`officialChinese:false`）；
- `browserAcceptance`：false（P9 桌面 1440 / 移动 390 截图与真实操作路径）；
- `status` 判定：结构项全过 = `development`；任何结构项失败 = `pending`。

## 6. 命令

```bash
npm run check:tde:scenario                # 用法：node tools/check-tde-scenario.mjs <chapterId> [--json]
npm run check:tde:registry                # 8 章 + 三包 + 战役 manifest 走注册期校验（PASS、launchable 0）
npm run test:tde:scenarios                # 223 例：8 章章节测试 + 场景交互 + 公共 API
npm run test:tde:campaign                 # 战役层 28 + 公共 API 19
npm run audit:tde:scenarios               # --check 逐字节复算；:write 重算账本与来源锁
npm run scan:tde:scenario:shards          # 283 条记录切 6 片（:check 只校验）
npm run audit:tde:rules / audit:tde:primitives / audit:tde:investigators / audit:tde:player
```

## 7. 边界

- 8 章是 **development**：引擎只把 `playable/verified` 装进 `SCENARIOS`（注册到 `content/registered.js` 属 P10），
  当前**不能从大厅启动**；章节可被测试直接 import 验证。
- 剧情正文/规则文本目前是**锁定英文原文**，不是官方中文、也不是自译中文；P8-T 后由 `story-text.js` 生成物替换。
- `literalCardBehavior=false`、`equivalenceCertified=false`：不宣称规则等价；12 条显式简化与 11 条 rejected 原语请求单列在报告与账本。
- 共享组的落点区分「战役共享组」（`theDreamEaters/_shared/`）与「跨循环通用组」（`shared/`），不得混目录。
- 双线真实开闸仍要等 P9.5（§11.2 十条门禁）；A/B 单线也需对应模式章节确认后才可 `playable`。

## 8. 相关手册与维护

- 原语：[`tde-primitives.md`](./tde-primitives.md)（P8 追加内容层 API/钩子见其 P8 节）；
  规则书：[`tde-rules.md`](./tde-rules.md)（P8 起登记战役层 6 条机制）；交互：[`tde-interactions.md`](./tde-interactions.md)；
  剧情：[`tde-story.md`](./tde-story.md)；发布：[`tde-release.md`](./tde-release.md)；阶段报告：[`tde-p8-report.md`](./tde-p8-report.md)。
- 维护：章节卡数/组归属以 `scope.json` 为准；改 definition/behavior 后跑 `check:tde:scenario <id>`、
  对应章节测试与 `audit:tde:scenarios --write`（账本必须重算）；改战役层跑 `test:tde:campaign` 与 `check:tde:registry`。
