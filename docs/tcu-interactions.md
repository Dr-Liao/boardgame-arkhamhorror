# 《万象无终》交互与界面手册

> 口径：11 条交互登记在 [`audit/tcu-migration.json`](../audit/tcu-migration.json) 的 `confirmations.interactions.items`，P10 全部 `verified`（模型 / 引擎读点 / Node / 桌面浏览器 / 移动浏览器五项检查）。交互层只读观察投影、只提交 `legalMoves` 里的动作，不复制规则判定。
>
> 命令：`npm run test:tcu:interactions`（Node 协议 7 例）、`npm run test:tcu:interactions:browser`（Playwright 桌面 1440 / 移动 390）。面板模型集中在 [`web/tcu-ui.js`](../web/tcu-ui.js)，样式在 [`web/tcu-panels.css`](../web/tcu-panels.css)。

## 1. 口径

- 交互 = 选择目标/卡牌/地点/敌人、多选、顺序、确认/取消、危险操作提示、空状态、不可用原因、动画与音效；新交互必须先于批量卡牌完成，见 [迁移规范](./arkham-content-migration.md) §4.5。
- 服务端通过 `requestChoice` / `presentation-state` / 观察投影产出候选；浏览器只提交合法动作。私有候选、手牌、牌库顺序不得进入其他座位投影。
- 面板必须给出：可用、不可用（带原因）、空候选、提交中、失败重试、取消后回到原状态；桌面与移动端各至少一条真实路径与截图。
- 新增界面只复用 `web/` 现有组件、CSS 变量与交互模式；不得为单卡写 UI 分支，不得内联硬编码颜色/字号。

## 2. 三种专用待决选择

| 选择 | 模型 | 引擎读点 | 说明 |
| --- | --- | --- | --- |
| 塔罗抽牌/选择 `pickTarot` | `tarotPickerModel` / `renderTarotPicker` | [`src/engine/tarot.js`](../src/engine/tarot.js) | 22 张大阿卡纳的正逆位、候选来自已抽牌；仅渲染/模型层证明可达 |
| 序章选调查员 `storyInvestigator` | `storyInvestigatorPickerModel` / `renderStoryInvestigatorPicker` | [`src/engine/story-investigators.js`](../src/engine/story-investigators.js) | 真实大厅→序章路径触发（`tests/tcu-release.browser.mjs`） |
| 闹鬼结算 `hauntedResolution` | `hauntedChoiceModel` / `renderHauntedChoice` | [`src/engine/haunted.js`](../src/engine/haunted.js) | 按顺序列闹鬼条目，可被 haunted interrupt 取消/替代 |

## 3. 11 条交互落点

| # | id | 中文 | 模型/读点 | 检查 |
| --- | --- | --- | --- | --- |
| 1 | `tarotPick` | 塔罗抽牌/选择 | `tarotPickerModel` + `src/engine/tarot.js` | 模型/引擎/Node/桌面/移动 |
| 2 | `storyInvestigatorPick` | 序章选调查员 | `storyInvestigatorPickerModel` + 序章 definition | 同上 |
| 3 | `hauntedResolution` | 闹鬼结算 | `hauntedChoiceModel` + `haunted.js` | 同上 |
| 4 | `spectralDeck` | 幽灵界第二牌堆面板 | `tcuCampaignModel` / `renderTcuCampaignPanel` | 同上 |
| 5 | `circleTest` | 阵法多技能检定 | `multiSkillTestInfo` + `stats.js` | 同上 |
| 6 | `parleyTarget` | 谈判目标与豁免 | 描述子目标 + `parley.js` | 同上 |
| 7 | `campaignRecords` | 遗留记忆/记录面板 | `tcuCampaignModel` + `mementos.js` | 同上 |
| 8 | `watcherPanel` | 看守人公开提示 | `tcuCampaignModel` + 观察投影 | 同上 |
| 9 | `breachDoom` | 裂口/毁灭标记 | `locationTcuBadges` + `location-state.js` | 同上 |
| 10 | `hereticFaces` | 异端者翻面/放逐 | `enemyFaceBadge` + `enemy-faces.js` | 同上 |
| 11 | `tarotSlot` | 塔罗槽位 | 观察投影 + `tarot-slot.js` | 同上 |

## 4. 投影与视觉

- 观察者视图只放公开信息：地点裂口/火盆/幽灵面徽标、敌人当前面与「不能击败」、幽灵牌堆张数与弃牌堆、战役记录/看守人提示、塔罗槽位与已抽塔罗。私有塔罗结果只在 `campaign.privateStories`，按座位过滤。
- 绘制入口：`web/tcu-ui.js` 输出模型（`tcuCampaignModel`、`locationTcuBadges`、`enemyFaceBadge`、`multiSkillTestInfo` 等），`web/game-ui.js` 负责挂载；样式 token 在 `web/tcu-panels.css`，与相邻面板共用布局节奏。
- 徽标/面板不自行判定规则：数值与布尔状态来自 `src/cards/campaign-view.js` 的投影；客户端不得改写来源状态。
- 浏览器只提交 `legalMoves` 中的 `scenarioAction` / `playCard` / `choose` 等动作；服务端 `validateMove` 二次校验（含不可用原因与费用）。

## 5. 验收与证据

- Node：`node --test tests/tcu-interactions.test.mjs`（7 例，协议/模型/投影）；`tests/tcu-scenario-hooks.test.mjs`（4 例，章节钩子）合计 11 例，P10 记录 11/0。
- 浏览器：`tests/tcu-interactions.browser.mjs` 两条用例（桌面/移动）走真实 `/mods/arkhamhorror/` 页面，检查面板可读、可点、可键盘操作；与规则书/9 章实机/真实大厅/媒体共 5 个 spec。
- P10 实测（外部审计报告）：浏览器 27 例通过 / 26 张截图（规则书 4、交互 2、9 章实机 18、真实大厅 2、媒体 1）；`audit/tcu-browser-acceptance.json` 是 runner 输出，当前可能只含最近一次 spec 的局部记录，见 [发布手册](./tcu-release.md)。
- 9 章实机路径（`tests/tcu-scenarios.browser.mjs`）覆盖每章 × 桌面/移动；真实大厅→序章→牌桌由 `tests/tcu-release.browser.mjs` 覆盖。

## 6. 已知边界

- 三种专用选择里只有序章选人走真实大厅端到端；塔罗/闹鬼的浏览器用例使用合成 pendingChoice fixture，真实战役里贪心策略没有自然走到这两种状态，因此「真实游戏内可达」只有模型/渲染层证明。
- 11 条登记交互中，浏览器专用断言只直接覆盖 3 条（塔罗/序章/闹鬼）；幽灵牌堆、看守人、裂口、异端者、塔罗槽位等依赖章节测试与截图间接覆盖，缺少逐交互的浏览器断言清单。
- 媒体 spec 的移动端与资源计数契约在 P10 未满足（`media.mobile=false`、`resources=0`），直接导致发布门禁 `releaseBrowser=false`；修复轮已补 mobile 用例，需重跑浏览器账本后复核。
- 面板依赖观察投影字段；新增投影字段必须同步 `src/integration/observation.js` 与浏览器用例，不能只在 `web/` 本地推断。

## 7. 相关手册与维护

- 交互账本与面板模型必须同提交：改 `web/tcu-ui.js` / `web/tcu-panels.css` / `src/integration/observation.js` 后跑 `npm run test:tcu:interactions` 与 `npm run test:tcu:interactions:browser`，再重跑 `npm run audit:tcu --write`。
- 新增选择/面板的固定顺序：先扩 `requestChoice`/观察投影/面板模型 → Node 断言 → 桌面 1440 与移动 390 浏览器用例与截图 → 最后才批量接卡（见 [迁移规范](./arkham-content-migration.md) §4.5）。
- 相关手册：[关键词与规则书手册](./tcu-rules.md)（规则书跳转）、[调查员手册](./tcu-investigators.md)（直觉牌库/资源寄存/法术行动的项目入口）、[发布手册](./tcu-release.md)（浏览器账本与发布门禁）、[迁移路线图](./tcu-migration-roadmap.md) §6。

## 附录：复核要点

- 本文 11 条交互、5 项检查与模型名取自 `confirmations.interactions.items`；浏览器 27 例/26 截图数字取自外部审计报告。
- 复核命令：`npm run test:tcu:interactions`、`npm run test:tcu:interactions:browser`、`npm run audit:tcu:check`。
