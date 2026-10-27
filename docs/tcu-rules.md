# 《万象无终》关键词与规则书手册

> 口径：关键词/机制台账的**唯一事实源**是 [`content/campaigns/theCircleUndone/keywords.js`](../content/campaigns/theCircleUndone/keywords.js)；规则书条目在 [`web/rulebook-data.js`](../web/rulebook-data.js)。账本 `confirmations.keywords` 16 条与 `confirmations.rulebook` 16 条在 P10 均为 `verified`；这只表示本 Mod 已声明的实现范围被登记与验收，**不等于印刷规则逐条等价**（逐卡差异见发布口径）。
>
> 命令：`npm run test:tcu:rules`（Node，13 例）、`npm run test:tcu:rules:browser`（桌面/移动端目录、搜索、返回、卡文跳转）。审计入口：[`audit/tcu-migration.json`](../audit/tcu-migration.json) 的 `confirmations.keywords` / `confirmations.rulebook`。

## 1. 口径

- 16 行台账区分 `printed`（印刷关键词/机制词）、`trait`（特性词）、`rule`（混乱符号规则）、`mechanism`（剧本级机制）；每行带 `ruleId`、代表卡号、`implemented` 与测试证据。
- 机制扫描（`artifacts/migration/tcu/mechanism-scan.json`）负责「哪些词/机制是新出现的」，keywords.js 负责「引擎如何实现」；两边的代表卡号集合必须对齐（账本 `keywordScanAligned`）。
- 新增关键词必须实现引擎行为 + 窗口/时机 + 成功失败分支 + 存档恢复 + 规则书条目；未 `verified` 的 ruleId 不得在卡牌文件中使用。
- 规则书描述必须**以当前实现为准**：未实现的原版分支写进 `remaining`/近似清单，不在规则条目里写成可用。

## 2. 16 行关键词/机制台账

| 关键词 | ruleId | 类型 | 代表卡 | 引擎落点 / 证据 |
| --- | --- | --- | --- | --- |
| 闹鬼 | `tcuHaunted` | printed | 8 | [`src/engine/haunted.js`](../src/engine/haunted.js)、`windows.js` 的 `haunted` interrupt |
| 幽灵 | `tcuSpectral` | trait | 8 | `locations.js` 幽灵面、`alt-decks.js` 幽灵第二遭遇牌堆 |
| 阵法 | `tcuCircle` | printed | 8 | [`src/engine/stats.js`](../src/engine/stats.js) 多技能合计 + 描述子 |
| 塔罗牌组 | `tcuTarot` | mechanism | 0（剧本级牌组） | [`src/engine/tarot.js`](../src/engine/tarot.js)，22 张大阿卡纳 |
| 塔罗槽位 | `tcuTarotSlot` | printed | 8 | [`src/engine/tarot-slot.js`](../src/engine/tarot-slot.js)、开局入场 |
| 谈判 | `parley` | printed | 8 | [`src/engine/parley.js`](../src/engine/parley.js) 通用谈判入口 |
| 绑定 | `tcuBonded` | printed | 4 | [`src/engine/bonded.js`](../src/engine/bonded.js) 场外绑定集合 |
| 遗留记忆 | `tcuMemento` | mechanism | 0（记录机制） | [`src/campaign/mementos.js`](../src/campaign/mementos.js)，10 个 id |
| 看守人 | `tcuWatcher` | mechanism | 7 | `mementos.js` + 观察投影的公开提示 |
| 序章故事调查员 | `tcuPrologue` | mechanism | 4 | [`src/engine/story-investigators.js`](../src/engine/story-investigators.js) |
| 裂口 | `tcuBreaches` | printed | 8 | [`src/engine/location-state.js`](../src/engine/location-state.js)，上限 3 |
| 混乱符号 | `tcuChaos` | rule | 9 | [`content/campaigns/theCircleUndone/tcu-chaos.js`](../content/campaigns/theCircleUndone/tcu-chaos.js) + 各章 `chaos.js` |
| 异端者多面与放逐 | `tcuHeretics` | mechanism | 8 | [`src/engine/enemy-faces.js`](../src/engine/enemy-faces.js) |
| 宇宙牌库 | `tcuCosmos` | mechanism | 8 | `alt-decks.js` 场景地点牌库 + `scenario-runtime.cosmos` |
| 火盆 | `tcuBraziers` | mechanism | 8 | `location-state.js` 的 `flags.brazier`（与机关盒 05228 共用） |
| 战役资产 | `tcuCampaignAssets` | mechanism | 3 | `campaign-effects.js` 的 `campaignCard` 入战役牌组（不占 30 张） |

## 3. 规则书 16 条

`web/rulebook-data.js` 中分组「万象无终」的 16 条（`RULES` 共 80 条，其中本项目 16 条）：

`tcuCampaign` 战役与记录 · `tcuHaunted` 闹鬼 · `tcuSpectral` 幽灵界/幽灵地点/第二遭遇牌堆 · `tcuCircle` 阵法与多技能检定 · `tcuTarot` 塔罗牌组 · `tcuTarotSlot` 塔罗槽位与开局入场 · `tcuBonded` 绑定 · `tcuMemento` 遗留记忆 · `tcuWatcher` 看守人 · `tcuPrologue` 序章与无牌组故事调查员 · `tcuBreaches` 裂口与入侵 · `tcuChaos` 万象无终的混乱符号 · `tcuHeretics` 异端者/多面/放逐 · `tcuCosmos` 宇宙牌库与虚空地点 · `tcuBraziers` 火盆与地点状态 · `tcuCampaignAssets` 战役资产入牌组。

- 每条含 `title / group / aliases / body`（正文按规则来源重写为「当前实现口径」），可用 `ruleById` / `ruleLink` / `matchingRules` 读取。
- 规则书条目是卡文直达与牌桌提示的共同来源：卡牌/地点/幕/议程通过关联 id 打开对应条目，返回后恢复原焦点。
- 收录与实现边界写在 `body` 内：例如塔罗牌组是剧本级牌组而非 05 卡；宇宙/裂口/火盆只描述本仓库已实现的读点。

## 4. 卡文直达与拼音索引

- 377 条记录的卡文跳转由规则条目关联 id 校验；`RULE_INDEX` 提供中文标题、别名与拼音索引，关键词页与卡文互相链接。
- 卡牌详情 → 规则条目 → 返回卡牌详情的焦点恢复由规则书浏览器用例覆盖（桌面 1440 与移动 390 各两条用例）。
- 拼音索引与别名只用于检索，不作为规则判定依据；规则判定一律走 `keywords.js` 的 `ruleId` 与引擎读点。
- 中文译名差异（如「恶罪报应」/「罪恶报应」、「隐秘之名」/「隐密之名」）保留在扫描 gaps 中待统一，不在规则层硬编码。

## 5. 浏览器验收

- `tests/tcu-rules.browser.mjs` 两条用例：规则目录/搜索/返回、卡牌规则链接可达并恢复详情焦点；在 `desktop` 与 `mobile` 两个 label 循环执行（合计 4 例）。
- 运行：`npm run test:tcu:rules:browser`；截图与结果写入 `test-results/` 或审计证据目录（不放进运行目录）。采用真实规则书数据与真实 `web/` 界面，不 mock 页面。
- 规则书浏览器用例在 P10 浏览器账本中通过；当前 `audit/tcu-browser-acceptance.json` 可能只记录最近一次单 spec 运行（见发布手册的漂移说明）。

## 6. 已知边界

- `confirmations.keywords`/`rulebook` 的 `verified` 是迁移确认状态，不覆盖逐卡字面缺口：外部审计（`artifacts/tcu-audit/REPORT.md`）复核 377 张后指出 60 张卡有未实现子句、174 张为显式近似，其中就包含闹鬼/裂口/宇宙等机制的个别分支。规则条目描述的是**已实现语义**，不是完整印刷规则。
- 剧本级机制（塔罗、宇宙、裂口、火盆、遗留记忆）没有独立 05 卡号，代表卡集合来自机制扫描；改这些机制时必须同时更新 `keywords.js`、规则条目、`mechanism-scan.json` 与本章 behavior，并重跑 `npm run scan:tcu:check` 与 `npm run test:tcu:rules`。
- 逐卡行为账本（`audit/tcu-card-behavior-audit.json`）与外部审计存在 over-claimed 复核项；规则手册不据此声称等价。

## 7. 相关手册与维护

- 关键词台账与机制扫描必须成对维护：新增/删除一行关键词时同时更新 `keywords.js`、`web/rulebook-data.js`、`mechanism-scan.json`，再跑 `npm run scan:tcu:check`、`npm run test:tcu:rules`、`npm run audit:tcu:check`。
- 规则书正文只写当前实现语义；原版规则的未实现分支写入 `remaining`/近似清单，不允许「规则条目写得比实现多」。
- 相关手册：[原语手册](./tcu-primitives.md)（闹鬼/裂口/宇宙/火盆等原语落点）、[剧情手册](./tcu-story.md)（战役记录与结局）、[发布手册](./tcu-release.md)（发布口径与待修项）、[迁移规范](./arkham-content-migration.md) §4.4/§6/§7。
- 浏览器证据由 `tests/tcu-rules.browser.mjs` 的 runner 产出；账本更新以 `npm run audit:tcu --write` 为准，不手改 `confirmations`。
