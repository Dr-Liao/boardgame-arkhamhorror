# 万象无终（TCU）关键词与规则书手册（第 3 步产物）

> 适用：`games/arkhamhorror`，第四循环 **The Circle Undone**（`tcu`，中文《万象无终》）。
> 依据：[`tcu-migration-roadmap.md`](tcu-migration-roadmap.md) §5（第 3 步：关键词与规则书）、
> [`arkham-content-migration.md`](arkham-content-migration.md)（六步顺序与证据规则）、
> [`tcu-primitives.md`](tcu-primitives.md)（第 2 步原语手册，本步骤引用它的读点）。
> 状态口径：本文只写**已经接线、有测试、审计能复算**的关键词与规则条目；未实现的部分逐条标「P8」并不写成可用。

## 0. 这份文档怎么用

第 3 步的产物不是「再加十几个规则页」，而是**一份可复算的关键词台账**：

```powershell
node tools/audit-tcu.mjs --write                # 由代码/测试/浏览器报告重新计算账本
node tools/audit-tcu.mjs --check                # CI 门禁：与磁盘账本逐字节比对
npm run test:tcu:rules                          # 关键词与规则书的 Node 验收（13 例）
npm run test:tcu:rules:browser                  # 桌面 1440 / 移动 390 规则书用例（生成浏览器证据）
```

| 产物 | 内容 | 谁写 |
| --- | --- | --- |
| `content/campaigns/theCircleUndone/keywords.js` | 关键词台账（唯一事实源）：机制 id、规则条目 id、卡面来源、引擎读点、实现状态 | 手写，测试与审计共用 |
| `web/rulebook-data.js` | 16 条「万象无终」规则条目 + 拼音索引 + `^05` 卡文直达分支 | 手写 |
| `web/ui-cards.js` | 9 张剧本参考卡（章节 id → 卡号） | 手写 |
| `content/mechanics.js` | 已实现的 `tcu*` 机制登记（`tcuChaos` 除外） | 手写 |
| `audit/tcu-browser-acceptance.json` | 浏览器证据：用例、视口、截图路径 | **Playwright runner** |
| `audit/tcu-migration.json` | 迁移账本：关键词/规则书的 `confirmations`、门禁与 `remaining` | `tools/audit-tcu.mjs` |

`verified` 的充分条件（缺一不可）：卡面来源能在 `src/cards/cards-data.js` 命中、引擎读点真的导出且形状正确、
`tests/tcu-rules.test.mjs` 实跑通过、规则条目存在且搜得到中文名、来源卡都能跳到该条目、
浏览器证据由 runner 生成且两个视口都有截图。**状态不手写**。

## 1. 关键词台账（16 行）

行数与第 1 步的机制扫描严格对齐：`mechanismId` 必须能在 `artifacts/migration/tcu/mechanism-scan.json`
里找到，`ruleId` 必须等于该机制的 `keyword.ruleId`（多一行、少一行或 ruleId 漂移都会让测试与审计同时失败）。
16 行 = 路线图 §5.1 的 11 个关键词（`haunted / spectral / circle / tarotDeck / tarotSlot / parley / bonded /
memento / watcher / storyInvestigator / breach`）+ 第 1 步扫描里另外 5 个同样声明了 `ruleId` 的机制/规则条目
（`chaos / heretic / cosmos / brazier / campaignAsset`）。规则书共 16 条，多出的 `tcuCampaign` 是战役总览，不在关键词表里。

| # | id | kind | 印刷词 / 中文 | ruleId | 卡面来源 | 引擎读点 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `haunted` | printed | Haunted / 闹鬼 | `tcuHaunted` | 05043、05065、05079–05084 等 49 条记录 | `src/engine/haunted.js` |
| 2 | `spectral` | trait | Spectral / 幽灵 | `tcuSpectral` | 05065、05067、05164、05165 等（特性与文本） | `src/engine/alt-decks.js`、`src/engine/locations.js` |
| 3 | `circle` | printed | Circle / 阵法 | `tcuCircle` | 05238、05243–05248、05250–05257 | `src/engine/tests.js` |
| 4 | `tarotDeck` | mechanism | — / 塔罗牌组 | `tcuTarot` | **无 05 卡**：22 张大阿卡纳是剧本牌组组件 | `src/engine/tarot.js` |
| 5 | `tarotSlot` | printed | Tarot / 塔罗槽位 | `tcuTarotSlot` | 05023/05027/05031/05035/05039/05040/05042 + 05283 | `src/engine/tarot-slot.js` |
| 6 | `parley` | printed | Parley / 谈判 | **`parley`（核心条目）** | 05020、05076、05085、05095–05097、05178a、05178c 等 | `src/engine/parley.js` |
| 7 | `bonded` | printed | Bonded / 绑定 | `tcuBonded` | 05313/05314、05316/05317 | `src/engine/bonded.js` |
| 8 | `memento` | mechanism | — / 遗留记忆 | `tcuMemento` | **无 05 卡**：10 条战役日志 | `src/campaign/mementos.js` |
| 9 | `watcher` | mechanism | — / 看守人 | `tcuWatcher` | 05086、05087、05228、05247、05248、05257、05272 | `src/campaign/mementos.js` |
| 10 | `storyInvestigator` | mechanism | — / 序章故事调查员 | `tcuPrologue` | 05046–05049（调查员卡；设置卡 05258–05261） | `src/engine/story-investigators.js` |
| 11 | `breach` | printed | Breach / 裂口 | `tcuBreaches` | 05284–05289 等 31 条记录 | `src/engine/location-state.js` |
| 12 | `chaos` | rule | — / 混乱符号 | `tcuChaos` | 9 张剧本参考卡 | `content/campaigns/theCircleUndone/shared.js#CHAOS_BAGS`（**符号效果未实现**） |
| 13 | `heretic` | mechanism | — / 异端者多面与放逐 | `tcuHeretics` | 05161、05165、05171、05178a 等 | `src/engine/enemy-faces.js` |
| 14 | `cosmos` | mechanism | — / 宇宙牌库 | `tcuCosmos` | 05329–05339 等 11 条记录 | `src/engine/alt-decks.js` |
| 15 | `brazier` | mechanism | — / 火盆 | `tcuBraziers` | 05228、05241–05250 等 17 条记录 | `src/engine/location-state.js` |
| 16 | `campaignAsset` | mechanism | — / 战役资产 | `tcuCampaignAssets` | 05150 黑书、05203 四把钥匙、05207 前厅、05228 机关盒 | `src/campaign/campaign-effects.js` |

说明：

- `kind` 区分证据形态：`printed` 卡面印刷词、`trait` 印刷特性、`mechanism` 机制名（卡面不印）、`rule` 只在规则书里成条。
- `memento`、`watcher`、`storyInvestigator`、`cosmos`、`brazier`、`campaignAsset` **不是卡面印刷关键词**，是机制 id；
  第 4 行与第 8 行没有任何 05 卡面来源，因此 `sourceKind: 'engine'`，证据落在模块导出的数据表上（22 张大阿卡纳、10 条 Memento）。
- `parley` 复用核心条目 `parley`（`ruleOwned: false`），只补通用实体能力通道与卡文直达，不新建重复条目。
- `implemented: false` 目前只有 `chaos` 一行：基础袋已登记，但逐章符号效果属 P8 的 `tcu-chaos.js`，
  因此**不**登记进 `content/mechanics.js`。测试会断言「实现状态与登记状态一致」。

## 2. 规则书 16 条

| ruleId | 标题 | 讲什么 | 对应机制 |
| --- | --- | --- | --- |
| `tcuCampaign` | 万象无终战役与记录 | 9 章顺序、三个包与 377 条记录、仅图鉴状态、4 个记录键、13 枚基础袋 | —（总览） |
| `tcuHaunted` | 闹鬼（Haunted） | 失败检定的结算窗口、多条能力顺序、两次、取消、`hauntedGaps` | `haunted` |
| `tcuSpectral` | 幽灵界、幽灵地点与第二遭遇牌堆 | 特性、第二牌堆、地点翻面、目标限制 | `spectral` |
| `tcuCircle` | 阵法与多技能检定 | 2–4 项技能求和、图标与万能、`actionKind` | `circle` |
| `tcuTarot` | 塔罗牌组（剧本） | 22 张唯一、正逆位、抽 N 选 1、确定性随机 | `tarotDeck` |
| `tcuTarotSlot` | 塔罗槽位与开局入场 | 默认 1 槽、`add:slot`、开局入场、高塔封锁与换牌保护 | `tarotSlot` |
| `tcuBonded` | 绑定（Bonded） | 场外集合、1 入手 2 洗回、离场收回、不计 30 张 | `bonded` |
| `tcuMemento` | 遗留记忆（Memento） | 10 条集合、发现/划掉/计数、投影 | `memento` |
| `tcuWatcher` | 看守人（Watcher） | 被追捕与被带走两个 `string[]` 记录、公开投影 | `watcher` |
| `tcuPrologue` | 序章与无牌组故事调查员 | 选人/划掉、无牌组、设置卡直接入场 | `storyInvestigator` |
| `tcuBreaches` | 裂口与入侵 | 地点裂口上限 3、骷髅值 = 裂口 + 毁灭 | `breach` |
| `tcuChaos` | 万象无终的混乱符号 | 四档基础袋、符号按章读取、**逐章效果未实现** | `chaos` |
| `tcuHeretics` | 异端者、多面与放逐 | 敌人面/未了之事面、放逐到胜利区、不能击败 | `heretic` |
| `tcuCosmos` | 宇宙牌库与虚空地点 | 面朝下地点牌库、抽 X 选 1、洗回、牌序不投影 | `cosmos` |
| `tcuBraziers` | 火盆与地点状态 | `flags.brazier`、词表只有火盆 | `brazier` |
| `tcuCampaignAssets` | 战役资产入牌组 | `addCampaignCardToDeck`、不占 30 张、排序带入下一章 | `campaignAsset` |

每条同时具备：卡面来源（代表卡号）、引擎行为（模块/函数）、Node 验收、规则书条目、卡文直达、
桌面 1440 与移动 390 可读可跳转。正文的「当前状态」段落写的是**已经实现的部分**；
尚未实现的内容（章节布置、逐章符号、卡面行为）逐条标注属 P8 / P9，不写成可用。

## 3. 卡文直达怎么算

`web/rulebook-data.js` 的 `cardRuleIds` 增加 `^05` 分支，判据与 `keywords.js` 的 `pattern` **同一套**：

- 卡面（`text` + `textZh` + `traits` + `slot`）命中某个关键词判据，就链到对应条目；
- 每张 05 卡至少链到 `tcuCampaign`；幕/议程另外链到核心条目 `script`；
- 序章调查员（05046–05049）与设置卡（05258–05261）额外链 `tcuPrologue`；
- 战役资产（05150/05203/05207/05228）额外链 `tcuCampaignAssets`（卡名不在卡文里，只能按卡号登记）；
- `scenario/act/agenda/location/enemy/treachery` 另外链 `tcuChaos`（都受该章混乱符号表约束）。

测试逐张核对 377 条印刷记录：每条卡只能连到 `TCU_RULE_IDS` + `parley` + `script`，
并且「卡面命中判据 ⇒ 必须已连到该条目」双向成立。这条不变式比「只查代表卡」更严，
改判据时判据与链接必须一起改。

## 4. 浏览器证据（由 runner 生成）

TFA 的 `audit/tfa-browser-acceptance.json` 是手工提交的 JSON，不可复现；TCU 的硬要求是：

1. 用例在 `tests/tcu-rules.browser.mjs`：桌面 1440×950 与移动 390×844 各两条（规则目录/搜索/关联跳转/返回，
   以及图鉴卡牌的规则链接与焦点恢复）；
2. 截图写在 `artifacts/tcu-migration/p4-rulebook-{desktop,mobile}.png`，并用 `test.info().attach()` 声明归属；
3. `tools/playwright-tcu-reporter.mjs` 挂在 `playwright.tcu.config.mjs` 上，把结果写成
   `audit/tcu-browser-acceptance.json`（不含耗时与时间戳，同一命令重复跑得到逐字节相同的结果）；
4. `tools/audit-tcu.mjs` 只读该文件：缺失、`status !== 'passed'`、或是某个视口没有用例/截图，
   `desktopBrowser` / `mobileBrowser` 一律为 `false`——**不允许手写补上**。

单独跑（不影响其他循环的浏览器回归）：

```powershell
npm run test:tcu:rules:browser
```

## 5. 门禁与复算

`node tools/audit-tcu.mjs --check` 复算下列门禁（全部通过才算 P4 完成）：

| 门禁 | 判据 |
| --- | --- |
| `scopeLedger` / `records` / `packCounts` / `encounterGroups` | P1 的范围账本与三包计数未漂移 |
| `packsCatalogOnly` / `campaignCatalogOnly` / `launchBlocked` / `chaptersNotLaunchable` | 仍是 catalog-only，战役不可启动 |
| `keywordScanAligned` | 16 行与第 1 步机制扫描的机制集合、`ruleId` 一一对应 |
| `keywordsVerified` | 16/16 行的五项检查全真 |
| `rulebookEntries` | 16 条都在 `RULES`、都在拼音索引、且没有孤儿条目 |
| `rulebookVerified` | `campaignOverview / scenarioMechanics / keywordEntries / cardLinks / desktopBrowser / mobileBrowser` 全真 |
| `nodeAcceptance` | `node --test tests/tcu-rules.test.mjs` 退出码 0 且失败数为 0 |
| `mechanicsRegistered` | 已实现的关键词都登记进 `content/mechanics.js`，未实现的没被登记 |

`remaining` 不手写：从 checks 为 false 的项、未 verified 的关键词、未完成原语、catalog-only 的章节与卡牌、
记录键数量与浏览器证据状态汇总。

## 6. 仍未完成（诚实边界）

- `tcuChaos` 的**逐章符号效果**（骷髅/异教徒/石板/古神标记的取值与后果）要等 P8 的 `content/campaigns/theCircleUndone/tcu-chaos.js`；
  规则书条目已明写「尚未实现」。
- 9 章剧本、234 张卡（343 主卡中除 5 张样本外的全部）与剧情文本分别属 P8 / P7 / P9；本步骤只完成关键词与规则书。
- 战役状态仍是 `catalog-only`：`assertLaunchable('theCircleUndone')` 必须失败，这是 P1 的门禁，P4 不放宽。
