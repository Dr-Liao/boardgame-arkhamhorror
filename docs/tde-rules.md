# 《食梦者》关键词与规则书手册（P4）

> **口径**：P4（规范第 3 步：关键词与规则书）已交付。7 个关键词全部 `verified`（5 项检查），17 条规则书条目全部 `verified`（6 项检查），388/388 张 06 卡都有卡文直达。
> 事实源：关键词 [`content/campaigns/theDreamEaters/keywords.js`](../content/campaigns/theDreamEaters/keywords.js)、规则条目 [`web/rulebook-data.js`](../web/rulebook-data.js)、卡面 [`src/cards/cards-data.js`](../src/cards/cards-data.js)、第 1 步扫描 [`mechanism-scan.json`](../artifacts/migration/tde/mechanism-scan.json)。
> 账本：`audit/tde-rules.json`（`npm run audit:tde:rules:write` 生成、`npm run audit:tde:rules` 复算）。
> 验收：`npm run test:tde:rules`（15 例）与 `npm run test:tde:rules:browser`（桌面 1440 / 移动 390 共 4 条）。
> 路线图：[`tde-migration-roadmap.md`](./tde-migration-roadmap.md) §6；规范：[`arkham-content-migration.md`](./arkham-content-migration.md) §6–§8。
> 相关：[`tde-primitives.md`](./tde-primitives.md)（原语）、[`tde-p4-report.md`](./tde-p4-report.md)（过程报告）。

## 1. 确认口径与证据

每个关键词必须同时具备 5 项（规范 §6 / 路线图 §11.3 G9）：

| 项 | 判据（工具复算，不能手写） |
| --- | --- |
| `sourceInventoried` | 关键词表列出的每个卡号都在卡池里，且卡面 `text / textZh / traits / slot` 命中该关键词判据 |
| `engineBehavior` | 声明的引擎模块可 import，`names` 逐个是函数、`values` 形状符合声明 |
| `nodeAcceptance` | `tests/tde-rules.test.mjs` 实跑通过（审计工具 spawn，用例数 > 0、失败 0） |
| `rulebookEntry` | 规则条目存在、分组正确（自有条目在「食梦者」）、正文 ≥ 80 字、中文名是别名、进了拼音索引 |
| `cardLinks` | 每张来源卡都连到该条目；判据方向对 388 张 06 卡逐张成立 |

规则书 6 项：`campaignOverview`（战役总览）、`scenarioMechanics`（8 章参考卡与线路/符号直达）、`keywordEntries`（关键词条目存在且可搜）、`cardLinks`（388 张全部连到战役条目、无外循环链接）、`desktopBrowser` / `mobileBrowser`（只认 `tools/playwright-tde-reporter.mjs` 生成的 `audit/tde-browser-acceptance.json`）。

命令：`npm run test:tde:rules` / `npm run test:tde:rules:browser` / `npm run audit:tde:rules:write` / `npm run audit:tde:rules`。
状态只有 `pending` 与 `verified`；本文件不手写状态，以账本 `audit/tde-rules.json` 为准。

## 2. 事实：7 个关键词（P2 实测卡数，P4 逐条给结论）

| 关键词 | 中文 | 卡数 | kind / ruleId | 引擎读点 | 本循环结论 |
| --- | --- | ---: | --- | --- | --- |
| Myriad | 多重 | 14 | printed / `tdeMyriad` | `src/engine/myriad.js`（`validateMyriadLimit` 等） | **新增**：构筑期同名至多 3 张（按标题跨卡号共享）；构筑界面显示属 P7 |
| Swarming X | 蜂拥 | 11 敌 | printed / `tdeSwarming` | `src/engine/swarming.js` + `swarm.js` | **新增**：X 四种口径、蜂拥卡放置、清空前不可击败、溢出伤害；实体接线属 P8 |
| Veiled | 掩藏 | 23 地点 | printed / `tdeVeiled` | `src/engine/veiled.js` | **新增**：已揭示面入场、无线索时 [fast] 翻面、翻过一次不能再翻；**P4 更正 P3 口径** |
| Researched | 研究完成 | 3 | printed / `tdeResearched` | `src/campaign/campaign.js`（`researchRequirement` 门禁） | **新增**：购入限制关键词，复用既有研究记录门禁；三张梦境日记的记录键属 P7 |
| Alert | 警戒 | 5 敌 | printed / `alert`（复用核心条目） | `src/engine/combat.js`（躲避失败反击） | **确认**：核心读点够用；Alert+Swarming 的反击归属与 Alert+Massive 顺序留给 P8 逐卡确认 |
| Hidden | 隐私 | 18 | printed / `hidden`（复用核心条目） | `src/engine/hidden-rules.js` | **确认**：手牌=威胁区、能力只由持有者触发、不能按普通方式弃掉（TCU 已交付）；敌人形态在手牌被攻击/躲避属 P8 |
| Bonded | 绑定 | 27 | printed / `tdeBonded`（**D5：新立条目**） | `src/engine/bonded.js` + `bonded-location.js` | **确认**：场外/在场交换、每种绑定卡只放 1 张（《梦的本质》）；地点绑定（梦境之门）与绑定弱点敌人属 P8 |

### 2.1 三个「已有待确认」的结论

- **Alert + Swarming**：蜂拥卡是「独立实例」，但警戒反击由敌人攻击结算触发；本循环的蜂拥敌人（06102/06145/06228/06273 等）不带警戒，只有 06107 同时带 Alert 与 Swarming。P4 判定：不必新原语，P8 逐卡确认「头领攻击时蜂拥卡是否同时反击」并按卡面写行为。
- **Hidden 敌人形态**：06306–06310 是「在手牌里可被攻击/躲避的敌人」。核心隐私语义（手牌=威胁区、只能由持有者触发、不能普通弃掉）已交付；「敌人形态在手牌中的战斗/躲避入口」与隐私投影属 P8/P5，已写进关键词 `deferred`，**不宣称已实现**。
- **Bonded 地点与弱点敌人**：`bonded.js` 覆盖玩家卡场外实体；`bonded-location.js` 覆盖梦境之门成对放置/移除；06025/06283 的绑定关系只写在卡文里（cards-data 无 `bonded` 字段），P7 在单卡条目声明。D5 因此新立 `tdeBonded`，不复用 `tcuBonded`。

### 2.2 官方规则文本来源（逐条核对，不是转述）

| 关键词/条目 | 来源 |
| --- | --- |
| Alert / Story Cards / Swarming X / Hidden | `参考资源/.../locales/en/theDreamEaters/base.json` 的 `additionalRulesAndClarifications`（战役规则） |
| Veiled | `locales/en/theDreamEaters/scenarios/{theSearchForKadath,pointOfNoReturn}.json` 的 `rules.locations` + `rules.veiled`（两章同文） |
| Swarming + Victory | `theSearchForKadath.json` 的 `rules.swarmingAndVictory` |
| Alarm Level | `darkSideOfTheMoon.json` 的 `rules.alarmLevel`（用毁灭标记表示、不算毁灭、不计入议程阈值） |
| Infestation | 卡面 06078《蛛群滋生开始…》（7 枚滋生袋、蛛巢、滋生检定） |
| Bonded | 规则参考的 Bonded 条目（含《梦的本质》只放 1 张的 FAQ 例子） |
| Myriad / Researched | 卡面印刷词 + `deckLimit: 3` 字段；Researched 来自官方 FAQ v2.0 勘误（把购入限制替换为该关键词） |
| 章节结构 / 幕间 / 尾声矩阵 | `base.json` 的 `flavorText.campaignStructure` 与 `flavorText.epilogueMatrix`；混乱袋枚数与符号见 `Campaigns/TheDreamEaters/ChaosBag.hs` |

### 2.3 P4 更正：两条 P3 原语口径与官方规则冲突

| 原语 | P3 口径 | 官方规则 | 处置 |
| --- | --- | --- | --- |
| `location.veiled` | 「未揭示的掩藏地点不能调查」，翻面前禁调查 | 掩藏地点**没有未揭示面**，以已揭示面入场；无线索时 [fast] 翻面；翻过一次不能再翻 | 删除 `veiledBlocksInvestigation` / `revealVeiledLocation`，改为 `veiledFlipBlockedReason` / `canFlipVeiledLocation` / `flipVeiledLocation`；测试与账本重算 |
| `location.doom` | 「地点毁灭」：毁灭达到阈值就移除地点 | 地点上的毁灭**是毁灭**（计入议程阈值、被 B4 骷髅读取）；06 段没有「毁灭地点」规则 | 删除 `shouldDestroyLocation` / `destroyLocation` / `locationDoomThreshold`，改为记账 + `highestLocationDoom` / `removeLocationDoom` |

两条都按「口径冲突先裁决」处理：先改实现与测试，再改文档，最后 `plan:tde:primitives --write` + `--check` 重算账本（`gate.pass=true`）。

## 3. 事实：17 条规则书条目

| # | id | 内容 | 卡面/来源证据 |
| ---: | --- | --- | --- |
| 1 | `tdeCampaign` | 两个四章小战役、三种进行方式、章对与幕间、两套混乱袋、16 段尾声 | 战役层（8 章参考卡） |
| 2 | `tdeDreamQuest` | A 线 4 章：无遭遇牌堆的开场、掩藏与神迹、警报等级、隐私敌人 | 06039/06119/06206/06286 |
| 3 | `tdeWebOfDreams` | B 线 4 章：蛛群滋生袋、纵向阶梯、漆黑之海、大网 | 06063/06168/06247/06333 |
| 4 | `tdeChaos` | 两袋构成与逐章符号表（含黑猫加入的符号） | 8 张剧本参考卡的正反面 |
| 5 | `tdeRecords` | 两本战役日志、55 个记录条目、跨线读写、Steps of the Bridge | `Key.hs` 55 键 + 卡面 |
| 6 | `tdeEpilogue` | 4×4 = 16 段尾声与子步骤 | `flavorText.epilogueMatrix` |
| 7 | `tdeMyriad` | 同名至多 3 张、跨卡号共享 | 14 张 Myriad 卡 |
| 8 | `tdeSwarming` | 蜂拥卡、头领、攻击/横置、清空前不可击败、溢出伤害、Victory 只算头领 | 11 敌 + 规则文本 |
| 9 | `tdeVeiled` | 已揭示面入场、[fast] 翻面、翻过一次不能再翻 | 23 地点 + 两章 rules |
| 10 | `tdeResearched` | 购入限制：完成研究并记录后才能购入 | 06236/06237/06238 + FAQ v2.0 |
| 11 | `tdeBonded` | 场外绑定、每种只放发行张数、地点绑定、绑定弱点 | 27 卡 + 规则参考 |
| 12 | `tdeDreamGate` | 与每个已揭示地点互连、只有卢克能进、调查阶段结束离场 | 06013/06014/06015a/b |
| 13 | `tdeInfestationBag` | 7 枚滋生袋、蛛巢、滋生检定、古神符号读数 | 06065/06066/06078/06083 |
| 14 | `tdeAlarmLevel` | 用毁灭标记表示但不算毁灭、改动方式、白船门槛 | 06206/06214b–06232 |
| 15 | `tdeSignsOfTheGods` | 神迹计数、骷髅读数、证据来源、维吉尔奖励 | 8 张背面故事卡 + 06144 |
| 16 | `tdeStoryAssets` | 场外剧情卡、不占牌组、控制权转移、离场 | 8 张剧情支援 |
| 17 | `tdeLocationDoom` | 大网地点上的毁灭、骷髅读数、石板移除 | 06333/06341–06354 |

- **D5 决策（2026-10-29）**：Bonded 新立 `tdeBonded`，不复用 `tcuBonded`。理由：本循环多了地点绑定（梦境之门）与绑定弱点敌人，且《梦的本质》「每种绑定卡只放 1 张」需要在 TDE 名下讲清。路线图 §6 原建议 16 条 → 实际 17 条，已同步。
- 规则条目只写规则本身：不出现引擎/实现/界面/审计词（`test:tde:rules` 的禁用词检查逐个跑 17 条）。
- 中文正文暂为规则手册风格（不是剧情正文）；剧情正文与序幕/幕间/尾声的完整翻译仍属 P8-T（[`tde-story.md`](./tde-story.md)）。

## 4. 卡文直达

- 388/388 张 06 卡至少连到 `tdeCampaign`；无一张连到其他循环的条目（允许的通用条目只有 `script`（幕/议程）与复用的 `alert` / `hidden`）。
- 关键词按卡面判据连条目（与 `keywords.js` 的 `pattern` 同一份正则）；判据方向逐张检查：卡面命中判据却没有链接会失败。
- 章节参考卡按线连 `tdeDreamQuest` / `tdeWebOfDreams`；8 张剧情支援与 7 张地点毁灭卡按卡号登记在 [`web/ui-cards.js`](../web/ui-cards.js) 的 `rulebookReferences`（浏览器端唯一卡号来源）。
- 章节 id → 桌面提示卡的映射（`scenarioCards`）**属 P8**：战役仍 `catalog-only`，现在加映射会触发 `campaign-experience.test.mjs` 的「映射表不能混进注册表没有的章节」守卫。

## 5. 机制登记（`content/mechanics.js`）

已登记 11 项（引擎读点已交付且有测试）：`tdeMyriad` / `tdeSwarming` / `tdeVeiled` / `tdeResearched` / `tdeBonded` / `tdeDreamGate` / `tdeInfestationBag` / `tdeAlarmLevel` / `tdeSignsOfTheGods` / `tdeStoryAssets` / `tdeLocationDoom`。

未登记 6 项（战役层能力，仍 `catalog-only`，接线后才登记）：`tdeCampaign` / `tdeDreamQuest` / `tdeWebOfDreams` / `tdeChaos` / `tdeRecords` / `tdeEpilogue` —— 对应 P5 流程与 P8 章节；测试显式断言它们**不在** `supportedMechanics`，防止提前宣称。

## 6. 验收与已实测数字

| 项 | 结果 |
| --- | --- |
| Node | `tests/tde-rules.test.mjs` **15 例**：关键词 5 项、388 张逐张链接、17 条规则书结构、规则内容、搜索、8 章、两袋、6 组引擎行为 |
| 浏览器 | `tests/tde-rules.browser.mjs` **4 条**（桌面 1440 / 移动 390 × {规则目录与搜索、卡牌直达与焦点恢复}），截图在 `artifacts/tde-migration/p4-rulebook-{desktop,mobile}.png` |
| 账本 | `audit/tde-rules.json`：关键词 7/7 verified、规则书 verified（17 条）、Node 15 例 0 失败、浏览器桌面+移动、`gate.pass=true` |
| 卡文直达 | 388/388，无外循环链接 |
| 搜索 | 7 个关键词的中文名与印刷词都能定位条目；关键句（蜂拥卡 / 掩藏地点 / 梦的本质 / 蛛巢 / 警报等级 / 神迹 / Steps of the Bridge / 尾声矩阵）都能命中 |
| 原语账本 | P4 重算后 `new 17/17 done`、`gate.pass=true`（含两条口径更正） |
| replay | `node tools/replay-fixtures.mjs --compare artifacts/migration/tde/replay-before.json` → 13 局逐条一致 |

## 7. 边界与待办

| 项 | 归属 |
| --- | --- |
| 敌人形态隐私卡在手牌中的攻击/躲避入口、隐私投影 | P8 / P5 |
| 蜂拥实体生成、交战、攻击、清空判定接线 | P8 |
| 掩藏翻面动作接进调查/移动流程、故事卡阅读器 | P8（正文 P8-T） |
| 三张梦境日记的 `researchRequirement` 记录键 | P7 |
| 构筑界面 `myriadUsage` 的 n/3 显示 | P7 |
| 绑定弱点敌人的场外实体与「无主卡在场放回场外」 | P8 |
| 章节 id → `UI_CARDS.scenarioCards` 映射 | P8 |
| 战役层 6 条条目登记进 `supportedMechanics` | P5 / P8 |
| 规则书的完整中文（剧情段落）与术语终审 | P8-T（自译，非官方中文） |

关键词未 `verified` 前不得在卡牌文件使用——本轮 7 条全部 `verified`，P6/P7 可以直接引用；`deferred` 列出的语义仍要在卡牌/章节实现时逐条兑现，不能拿「关键词已 verified」当整体已实现。

## 8. 维护

1. 改关键词表或规则条目后：`npm run test:tde:rules` → `npm run audit:tde:rules:write` → 审阅 diff → `npm run audit:tde:rules`。
2. 改浏览器用例后必须重跑 `test:tde:rules:browser`（账本里的 `desktopBrowser` / `mobileBrowser` 只认 runner 生成的文件，不手写补齐）。
3. 规则书条目改名/改 id 时同步 `web/rulebook-data.js` 的拼音表与 `TDE_RULE_IDS`；孤儿条目或空拼音会让审计失败。
4. 关键词判据（`pattern`）与 `web/rulebook-data.js` 的 `TDE_CARD_RULES` 必须同时改：测试对 388 张逐张比对两份判据。
5. P3 原语口径再变更时，先按本文件第 2.3 节的方式裁决规则、再改实现与测试、最后重算原语账本。
