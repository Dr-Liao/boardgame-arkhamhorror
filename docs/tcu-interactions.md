# 万象无终（TCU）交互与界面手册（第 4 步产物）

> 适用：`games/arkhamhorror`，第四循环 **The Circle Undone**（`tcu`，中文《万象无终》）。
> 依据：[`tcu-migration-roadmap.md`](tcu-migration-roadmap.md) §6（第 4 步：新增交互与界面）、
> [`tcu-primitives.md`](tcu-primitives.md)（第 2 步原语）、[`tcu-rules.md`](tcu-rules.md)（第 3 步关键词与规则书）。
> 状态口径：本文只写**已经接线、有测试、审计能复算**的界面；未实现的部分标 P8，并不当成已可用。

## 0. 这份文档怎么用

第 4 步的产物不是「再加几个弹窗」，而是**服务端说清楚「谁在选什么」、浏览器只负责画和提交**的一层：

```powershell
node tools/audit-tcu.mjs --write          # 由代码/测试/浏览器报告重新计算账本（含 interactions 确认组）
node tools/audit-tcu.mjs --check          # 门禁：与磁盘账本逐字节比对
npm run test:tcu:interactions             # 交互协议与面板模型的 Node 验收（6 例）
npm run test:tcu:interactions:browser     # 规则书 + 交互面板的桌面/移动浏览器用例（生成证据）
```

| 产物 | 内容 | 谁写 |
| --- | --- | --- |
| `src/engine/tarot.js` | `pickTarot` 待决选择；选项带编号/正逆位/中英文名 | 手写 |
| `src/engine/story-investigators.js` | `storyInvestigator` 待决选择；选项带职业/属性/生命理智 | 手写 |
| `src/engine/haunted.js` | `haunted` 待决选择的 `source` 带地点与能力身份 | 手写 |
| `web/tcu-ui.js` | 四个面板模型 + 四个渲染函数（塔罗/选人/闹鬼/战役面板）与地点、敌人、多技能读数 | 手写 |
| `web/tcu-panels.css` | 面板样式（桌面/移动共用，窄屏两列） | 手写 |
| `web/game-ui.js` / `web/hub.js` | 桌面动作栏与大厅待决选择区接入面板 | 手写 |
| `web/situation-view.js` | 局势弹窗的「剧本状态」块（幽灵牌堆/塔罗/裂口/火盆/看守人/记忆） | 手写 |
| `audit/tcu-browser-acceptance.json` | 两个浏览器 spec 的用例、视口与截图 | **Playwright runner** |

## 1. 服务端协议：三种专用待决选择

通用 `choice` 只会给一串按钮。TCU 的三种选择需要「这是什么、还能选谁、选中的牌长什么样」，所以选择本身带上了身份：

| kind | 出处 | `source` | 选项里额外带的字段 |
| --- | --- | --- | --- |
| `pickTarot` | `chooseTarot`（序章/巫异时刻的 22 张选 1） | `{ kind: 'tarot', mode: 'choose', count }` | `arcana`、`orientation`、`nameZh`、`nameEn` |
| `storyInvestigator` | `selectStoryInvestigators`（序章选人） | `{ kind: 'storyInvestigator', remaining, seatCount }` | `name`、`klass`、`classLabel`、`subtitle`、`stats`、`health`、`sanity` |
| `haunted` | `resolveHaunted`（闹鬼结算） | `{ kind: 'haunted', locationId, times, order }` 或 `{ …, abilityId, text }` | `text`、`abilityIndex`、`order` |

约定：

- **选项 id 仍是唯一非空字符串**（`requestChoice` 的 P0 校验），回放凭据逐字比对 `kind + source + seat + optionId`；
- 面板**不发明选项**：候选按钮的可用性只取决于 `legalMoves` 里有没有对应的 `choose`，没有就置灰并写明原因；
- 提交只发 `{ action: 'choose', choiceId, optionId }`，与 AI 走同一份 `legalMoves`。

## 2. 十一个交互落在哪里

| 交互 | 界面位置 | 读点 |
| --- | --- | --- |
| 塔罗抽牌/选择 | 桌面动作栏与大厅待决选择区（`ah-tarot-picker`） | `pickTarot` 选择 + `state.tarot` 投影 |
| 序章选调查员 | 同上（`ah-story-picker`），无牌组提示写在主说明 | `storyInvestigator` 选择 + `storyInvestigators` 投影 |
| 闹鬼结算 | 同上（`ah-haunted-panel`），地点名 + 能力原文 + 编号列表 | `haunted` 选择 + `state.locations` |
| 幽灵界第二牌堆 | 局势弹窗「剧本状态」的行 | `state.spectral = { deck, discard }` |
| 阵法多技能 | 技能检定条（`ah-test-preview`）显示「意志+智识…」与合计 | `state.skillTest.skill` 数组 + `actionKind` |
| 谈判目标 | 现有动作栏；谈判动作由 `parleyMoves` 产出，不引发借机攻击 | `legalMoves` 的 `actionKind` |
| 遗留记忆/记录 | 局势弹窗的遗留记忆胶囊 + 大厅档案页的记录块 | `state.mementos` + `campaign.mementoLabels` |
| 看守人 | 局势弹窗的「看守人：在追捕…；已带走…」与大厅档案页 | `state.watcher = { huntedSeats, taken }` |
| 裂口/毁灭 | 地点卡徽标「裂口 N」「火盆点燃/熄灭」「幽灵地点」 | `state.locationStates` + `loc.spectral` |
| 异端者翻面/放逐 | 敌人卡的「敌人面 / 未了之事面」「不能击败」标签 | `enemy.side`、`enemy.faces`、`enemy.cannotBeDefeated` |
| 塔罗槽位 | 现有槽位 UI（`tarot` 槽位标签与图标） | 引擎 `tarot-slot.js`（P2.9） |

面板模型集中在 `web/tcu-ui.js`：`tarotPickerModel`、`storyInvestigatorPickerModel`、`hauntedChoiceModel`、
`tcuCampaignModel`、`locationTcuBadges`、`enemyFaceBadge`、`multiSkillTestInfo`。它们都是纯函数（只读会话），
Node 侧可以直接 import 做验收；渲染函数只依赖宿主传入的 `h`，因此同一份代码在桌面与移动端共用。

## 3. 界面的统一要求

- **只用现有组件与 token**：按钮、图标（`tableIcon`）、卡图（`tableArt`）与颜色变量都来自 `web/`，没有按卡号或循环分支的样式；徽标复用牌桌的 `.ah-loc-badge`。
- **状态来自服务端**：选择、投影、`legalMoves` 都由 `observation.viewState` 下发；浏览器只提交合法动作，并在提交后按服务端返回的状态重绘。
- **可用/不可用/空/提交中/取消**：没有合法动作的选项置灰并写明原因（`title` 与 `aria-label`），`aria-busy` 标记提交中；
  只有 `canSkip` 的选择才出现「跳过本次选择」按钮，取消动作同样来自 `legalMoves`；缺投影时整个面板不出现。
- **键盘与触屏**：每个选项是原生 `button`，Tab 顺序与阅读顺序一致，Enter/Space 直接触发；移动端 390 宽改两列，不横向溢出。
- **公开信息**：牌堆只给张数、塔罗只给已抽牌与正逆位、看守人只给被追捕/被带走的人；私密信息（手牌、遭遇牌库顺序）不上界面。

## 4. 浏览器证据（由 runner 生成）

| spec | 视口 | 内容 | 截图 |
| --- | --- | --- | --- |
| `tests/tcu-rules.browser.mjs` | 1440×950 / 390×844 | 规则目录、搜索、关联跳转、图鉴卡牌规则链接与焦点恢复 | `artifacts/tcu-migration/p4-rulebook-*.png` |
| `tests/tcu-interactions.browser.mjs` | 1440×950 / 390×844 | 四个面板 + 地点徽标 + 多技能条：候选数、置灰数、顺序，点选与键盘提交，横向溢出 | `artifacts/tcu-migration/p5-interactions-*.png` |

证据写入 `audit/tcu-browser-acceptance.json`（`tools/playwright-tcu-reporter.mjs`），`tools/audit-tcu.mjs` 只读它：

- 每个 spec × 每个视口都要有 **一条通过的用例 + 一张存在的截图**，否则 `interactionsVerified` / 规则书的 `desktopBrowser`、`mobileBrowser` 为 `false`；
- 会话状态由引擎在测试进程里现场产出（`fixture` + 塔罗/幽灵/裂口/记忆原语），不是手写 JSON；
- 面板模块就是浏览器实际加载的 `/mods/arkhamhorror/tcu-ui.js`，样式表就是游戏内的 `style.css`（含 `tcu-panels.css`）。

> **如实说明**：战役仍是 `catalog-only`，序章与章节内容属 P8。因此当前浏览器证据是**组件级**的：
> 真实模块、真实样式、真实引擎状态、真实提交动作，但**不是**从大厅进入剧情后的实机路径。
> 实机路径在 P8 接通序章后补跑，并作为 `remaining` 记在 `audit/tcu-migration.json` 里。

## 5. 门禁与复算

`node tools/audit-tcu.mjs --check` 在 P4 的六项规则书检查之外，新增：

| 门禁 | 判据 |
| --- | --- |
| `interactionsVerified` | 11 条交互都有模型/引擎读点、`node --test tests/tcu-interactions.test.mjs` 实跑通过、桌面与移动各有通过的浏览器用例与截图 |
| `confirmations.interactions.items[]` | 每条交互的 `model`、`engineReadPoint`、`nodeAcceptance`、`desktopBrowser`、`mobileBrowser` 五项 |

`remaining` 也是算出来的：没有可启动章节时，它会自动追加
「交互实机路径待 P8：9 章仍 catalog-only…」，而不是手写一句待办。

## 6. 仍未完成（诚实边界）

- **实机路径**：序章/章节内容（P8）接通前，面板只能在大厅的待决选择区或组件级用例里出现；从「大厅 → 序章 → 塔罗/选人/闹鬼」的完整路线要等 P8。
- **火盆熄灭态**：状态里只记录「已点燃」（清掉等于熄灭），所以徽标只在点燃时出现；《聚合幻灭》接通时若需要显示「熄灭」，要在章节数据里声明地点有火盆（P8）。
- **幽灵敌人目标限制**：由章节的 `canFightEnemy` 读 `isSpectral` 实现（P8），界面只显示「幽灵地点」标记。
- 9 章剧本、逐卡行为与剧情文本分别属 P8 / P7 / P9。
