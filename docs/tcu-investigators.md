# 《万象无终》调查员手册（M1）

> 范围：6 位正式调查员（05001–05006）+ 13 张专属卡（含 6 张专属弱点，05007–05019）+ 4 位序章无牌组故事调查员（05046–05049）。正式调查员在 P10 已 `可选人、可构筑`；故事调查员只在序章使用，不进选人、无牌组。
>
> 账本：[`audit/tcu-migration.json`](../audit/tcu-migration.json) 的 `confirmations.investigators`（19/19 verified，8 项检查全真）；包清单 [`content/packs/tcuInvestigators/manifest.js`](../content/packs/tcuInvestigators/manifest.js)（status `verified`）。命令：`npm run test:tcu:investigators`（33 例）、`node --test tests/tcu-prologue.test.mjs`（41 例）。

## 1. 六位正式调查员

| 卡号 | 调查员 | 职业 | 牌组 | 四维/生命/理智 | 专属卡 |
| --- | --- | --- | --- | --- | --- |
| 05001 | 卡洛琳·弗恩 | 守卫者 | 30 | 3/4/2/2 · 6/9 | 05007/05008 |
| 05002 | 乔·戴蒙德 | 探求者 | 40 | 2/4/4/2 · 8/6 | 05009/05010 |
| 05003 | 普雷斯顿·费尔蒙特 | 流浪者 | 30 | 1/1/1/1 · 7/7 | 05011/05012 |
| 05004 | 黛安娜·史丹利 | 神秘者 | 35 | 1/3/3/3 · 7/7 | 05013/05014/05015 |
| 05005 | 丽塔·杨 | 幸存者 | 30 | 3/2/3/5 · 9/5 | 05016/05017 |
| 05006 | 玛丽·朗博 | 神秘者 | 30 | 4/4/1/3 · 6/8 | 05018/05019 |

- 牌组契约（`deckRequirements`，见 [`src/cards/cards-data.js`](../src/cards/cards-data.js)）：`size` 30/40/30/35/30/30，各带 `signatureCards` 与基础弱点随机位；构筑规则由 [`src/deck/deckbuilding.js`](../src/deck/deckbuilding.js) 与 `src/deck/availability.js` 统一执行。
- 主能力、旧印与专属卡行为在 `src/cards/entries/<code>.js` 或 `src/cards/card-effects.js` 的 `INVESTIGATOR_ABILITIES`；不按卡号写引擎分支。
- 初始生命/理智、职业与四项技能由 `setup.js` 写入；换回故事调查员时用身份快照恢复。

## 2. 构筑规则补强

- 支持卡表里的三种新写法：`not: true` 的排除项（无高等级武器 / 无违法卡）、`text` 正则与 `hh`/`st` 标签、乔·戴蒙德的「至少 11 张[[洞察]]事件」配额。
- 配额在 [`src/deck/deckbuilding.js`](../src/deck/deckbuilding.js) 的自动/手动构筑两条路径都校验：直觉牌库配额不足时抛出明确错误（`需要 N 张[[洞察]]事件，当前 M 张`）。
- 85 张可构筑 TCU 玩家卡进入 `ALL_BUILDABLE_CODES` 与 `tcuPool` 升级池（既有循环记录看不到），默认自动构筑池与 replay 保持零变化。

## 3. 三个调查员专属读点

### 3.1 直觉牌库（乔·戴蒙德）

[`src/engine/hunch-deck.js`](../src/engine/hunch-deck.js)：冒险设置抽 11 张[[洞察]]事件正面朝下作为直觉牌库；调查阶段开始时揭示并视作手牌；打出直觉牌库的卡费用 -2；阶段结束洗回。旧印可把弃牌堆的一张[[洞察]]事件移到直觉牌库底。读点不暴露牌库顺序给其他座位。

### 3.2 资源寄存（普雷斯顿·费尔蒙特）

[`src/engine/resource-bank.js`](../src/engine/resource-bank.js)：「家族遗产」每回合寄存 4 点资源，回合结束弃掉；此后获得的资源改为寄存（不在常规资源池）。寄存数进入观察投影的公开面，超上限/结束清理由通用回合钩子处理。

### 3.3 法术专用额外行动（黛安娜·史丹利）

[`src/engine/spell-actions.js`](../src/engine/spell-actions.js)：只有在有毁灭标记（面朝下法术）时给额外行动，且该行动只能用于施放法术；额外行动不入 `actionsLeft` 上限账，用描述子 `kind` 与窗口限制来源。`src/engine/cancel-note.js` 承接「取消后记录/修正」类反应读点。

## 4. 序章故事调查员

| 卡号 | 名称 | 序章定位 |
| --- | --- | --- |
| 05046 | 加弗瑞拉·米兹拉克 | 无牌组，卡面固定职业/四项技能/生命/理智；起始区域与固定起手牌按卡背写入 |
| 05047 | 杰罗姆·戴维斯 | 同上 |
| 05048 | 瓦伦蒂诺·里瓦斯 | 同上 |
| 05049 | 佩妮·怀特 | 同上 |

- 代码落点：[`src/engine/story-investigators.js`](../src/engine/story-investigators.js)（身份快照、起始区域、固定起手牌、交换与恢复）+ `setup.js` 的故事调查员分支；4 人的设定与塔罗 22 结果来自序章定义与 `story-text.js`。
- 故事调查员不是战役身份：不登记 `campaign.investigators`、不建牌库、不受创伤、不进选人列表；序章结束换回正式调查员时按快照恢复。
- 验收：`tests/tcu-prologue.test.mjs` 用真实引擎 4 人开局逐人断言技能/职业/生命/理智与起始手牌键。

## 5. 时机窗口与读点

- `windows.js` 是时机窗口唯二注册表；新增窗口必须同时完成「注册 + engine.js 调用点 + 测试」三件事（注册≠接线）。
- 本项目新增的窗口包括闹鬼结算 `haunted`（interrupt，调用点在 `haunted.js`）等；调查员专属读点使用既有 `testBegins`、`harmDealt`、`evadeSuccess`、`skillTestFail` 等窗口。
- 能力层描述子只通过 `ctx.api` 改状态；状态进 `save-migration.js` 版本迁移，JSON 存读档往返一致。

## 6. 显式简化（5 条，账本 `remaining`）

| 卡号 | 简化内容 |
| --- | --- |
| 05009 | 侦探的柯尔特1911式手枪：「最多 2 张[[工具]]支援不占双手槽位」未实现（现有槽位读点不支持按特性分组） |
| 05010 | 悬案：「游戏结束时少取得 2 点经验」只记录 `inv` 标记，XP 结算在战役层近似 |
| 05012 | 秘社「债务」：「游戏结束时仍在手牌则受 1 点精神创伤」只记录标记，结算时机近似 |
| 05013 | 银暮匕首：「把黛安娜底下的事件/技能当手牌打出或投入」未实现（缺 beneath 打出通道） |
| 05019 | 安息日男爵：「少于 3 个毁灭标记时不能离场」未实现（缺按毁灭数的离场限制读点） |

其余子句（主能力、旧印、专属卡、构筑、存档）均已实现并断言；外部审计复核指出个别卡仍有缺口（如 05014 的「即便攻击被取消」、05018/05019 的个别窗口、05046 的窗口语义），这些不因本手册的 `verified` 状态而被抹平。

## 7. 验收与边界

- 调查员 Node：`tests/tcu-investigators.test.mjs` 33 例全过；序章：`tests/tcu-prologue.test.mjs` 41 例（当前工作区若被并行修复改动影响，以修复后复跑为准）。
- 浏览器：真实大厅→调查准备→选调查员→自动构筑→确认准备→开始关卡的路径由 `tests/tcu-release.browser.mjs` 覆盖（桌面/移动）。
- 边界：`confirmations.investigators` 的 `verified` 是 M1 迁移确认，不等于印刷规则逐条等价；5 条显式简化与外部复核发现的缺口都保留在账本/审计报告中，不宣称规则等价。
