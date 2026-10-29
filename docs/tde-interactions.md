# 《食梦者》交互手册（P5 批次 1：清单定稿 + 策略层）

> **口径**：10 条交互已在 P5 定稿为事实表（[`interactions.js`](../content/campaigns/theDreamEaters/interactions.js)），全部 `pending`——引擎侧的开局模式、座位分线、按线准备与双线 gate 已接通（批次 1–2），但交互 UI 与桌面/移动证据要等 P8 注册真实战役后才可能有真实路径。
> 事实来源：[`mechanism-scan.json`](../artifacts/migration/tde/mechanism-scan.json)（P2 登记了 2 条开局交互）+ 路线图 §7.1 的 10 条清单。
> 路线图：[`tde-migration-roadmap.md`](./tde-migration-roadmap.md) §7.1 / §11.2；规范：[`arkham-content-migration.md`](./arkham-content-migration.md) §4.5。
> 过程报告：[`tde-p5-report.md`](./tde-p5-report.md)。

## 1. 证据口径

- 交互状态必须由服务端 `requestChoice` / `presentation-state` / 观察投影产生，浏览器只提交 `legalMoves` 中的动作；私有候选、手牌、牌库顺序不得进入其他座位投影。
- 每条交互必须有：可用路径、不可用原因、空状态、取消/重试；桌面 1440×900 与移动 390×844 各至少一条真实操作路径 + 截图。
- 复用 `web/` 现有组件、CSS 变量与交互模式，**不得**按卡号写 UI 分支。
- 状态只有 `pending` 与 `verified`；本清单的 `blockers` 就是该条交互尚未 `verified` 的原因，不能空白。

## 2. 10 条交互（定稿）

| # | id | 交互 | 触发 / 章节 | 机制 id | hook | 归属 | 状态 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `campaignOption` | 选择玩法（单线 A / 单线 B / 并行 / 分选） | 序章（战役台面） | `ui:modeSelection` | hub | 引擎 P5-2 ✅ / UI P5-3 ✅ / 桌面 1440 + 移动 390 浏览器证据（`audit/tde-ui-browser.json`） | verified |
| 2 | `laneSelection` | 按线选人 / 选牌组（每座位一套） | 开局准备 | `ui:laneDeckSelection` | hub | 引擎 P5-2 ✅ / UI P5-3 | pending |
| 3 | `swarmPanel` | 蜂拥卡面板（数量 / 来源 / 溢出伤害） | Swarming X 敌人 | `swarming` | table | P8 | pending |
| 4 | `infestationBag` | 蛛群滋生袋（揭示 / 放回 / 蛛巢标记） | 清醒噩梦 | `tokenBag` | table | P8 | pending |
| 5 | `alarmLevel` | 警报等级 0–5+ 显示与增减 | 月之暗面 | `alarmLevel` | table | P8 | pending |
| 6 | `hiddenHand` | 隐藏手牌（座位私有投影 + 敌人形态入口） | 隐私 18 张 | `hidden` | table | P8 | pending |
| 7 | `veiledFlip` | 掩藏地点翻面（无线索时 [fast] + 背面故事卡） | 寻觅卡达斯 / 无归之地 | `veiled` | table | P8 | pending |
| 8 | `markerProgress` | 神迹 / 桥梁进度计数 | 寻觅卡达斯 / 无归之地 | `signsOfTheGods` | table | P8 | pending |
| 9 | `verticalStack` | 纵向堆叠（神秘阶梯 / 大网） | 万千骇形 / 编织宇宙 | `verticalChain` | table | P8 | pending |
| 10 | `dreamGateEpilogue` | 梦境之门与 16 段结局矩阵 | 通用 / 尾声 | `dreamGate` + `epilogueMatrix` | both | P8 / P8-T | pending |

> 交互 1 的浏览器证据用 P5 的「双线演示」战役（`ARKHAM_BROWSER_DEMO=dualHub`）取得：面板/座位分线只在声明 parts 的战役出现，真实 TDE 要等 P8 注册章节；同一条 UI 路径不依赖具体战役。
>
> `pending` 不是「没设计」：每条交互的触发时机、章节、机制 id 与阻塞原因都已登记；`verified` 需要真实 UI 路径 + 桌面/移动截图 + 隐私断言，最早在 P5 批次 2（第 1–2 条）与 P8（第 3–10 条）。

### 2.1 开局两条的硬口径（§1.4.1，本轮已落成策略层）

- 人数校验前置：奇数人数时「并行双线」不可用并给「两组人数相等」的原因；1 人只有两个单线选项。
  → 实现：[`campaign-modes.js`](../src/campaign/campaign-modes.js) 的 `modeOptions` / `modePlan`（纯策略，hub 接线在批次 2）。
- 分选要求两线各 ≥1 座位：`modePlan({ mode:'pick', seatParts:['A','A'] })` 直接给原因；改线走 `assignSeatPart`，清空任一条线会被拒绝。
- 并行等分：默认分线由 `defaultSeatParts('parallel', n)` 决定（前 n/2 A、其余 B），不接受手工改线。
- 每座位只建一套牌组：策略层只产出「座位→线」计划，不产生第二套牌组；跨线重复选人校验在批次 2 接。

### 2.2 场景交互的口径来源

- 蜂拥卡面板：P3 的 `swarm.placeCards` 决定入口数据；面板只展示与选择，不做规则判断。
- 掩藏地点：A2 的 15 张 b 面故事卡与 B3 的 8 张洗回牌堆是两种收尾，翻面面板要能表达；官方翻面门槛是「无线索 + [fast]」（P4 已按官方规则更正）。
- 隐藏手牌：18 张全部带险境；06306–06310 的敌人形态要在手牌里提供攻击/躲避入口。
- 纵向堆叠：布局必须复用既有 layout 变量，不新建循环专属布局。

## 3. 已交付的 P5 批次 1–2 支撑（引擎侧，不是交互 UI）

| 项 | 落点 | 验收 |
| --- | --- | --- |
| 四模式可用性 / 默认分线 / 改线校验 | `src/campaign/campaign-modes.js` | [`tde-modes.test.mjs`](../tests/tde-modes.test.mjs) 7 例 |
| 章对门（`partGate`）与单线/双线 flow | `src/campaign/part-flow.js` | [`tde-dual-flow.test.mjs`](../tests/tde-dual-flow.test.mjs) 7 例（含 16 排列） |
| 双线条件（`part/mode/activeParts` 嵌进普通条件） | `src/campaign/campaign-flow.js` | 同上：条件矩阵 |
| 非活动线投影脱敏 | `src/campaign/campaign-parts.js#partScopedView` | 同上：牌组/购入/故事正文不外泄 |
| hub 四模式开局与座位分线 | `src/engine/{hub,dispatch}.js` | [`tde-hub-modes.test.mjs`](../tests/tde-hub-modes.test.mjs) 5 例 |
| 按线选人/牌组与跨线重复校验 | `dispatch.js` 的 `inPart` 路由 + `table-decisions.js` | 同上：非活动线 record 落 `parts[line]`、跨线候选互斥 |
| 双线运行 gate | `dispatch.js` 的 `hubBeginScenario` | 同上：分选/并行开始关卡时抛「批次 3」原因 |
| 交互清单与阻塞原因 | `content/campaigns/theDreamEaters/interactions.js` | 10/10、`validateInteractionInventory` |

## 3.1 开局模式面板（交互 1 的 UI，P5 批次 3）

- 纯模型 [`web/hub-mode-view.js`](../web/hub-mode-view.js)：四模式固定顺序、置灰原因原样透传、分选逐座位分线、先选模式提示；`tests/tde-mode-panel.test.mjs` 4 例。
- 渲染接在 `web/hub.js` 的战役总览：`hubSetMode` / `hubSetSeatPart` 按钮，disabled 时直接显示引擎给的原因；`hub.mode.*` 词典中英各 5 键。
- **浏览器证据仍缺**：没有注册声明 `parts` 的战役（P8），面板在浏览器里没有可点入口；因此交互 1 保持 `pending`，不写 `verified`。

> 并行双线的完整交互盘点、线框与波次见 [`tde-parallel-interactions.md`](./tde-parallel-interactions.md)（24 处交互点；W1 已落，W2 关卡首页分屏未做）。

## 4. 待办（P5 批次 3 / P8）

| # | 事项 | 归属 | 产物 / 验收 |
| ---: | --- | --- | --- |
| 1 | hub 四模式与座位分线（引擎） | P5 批次 2 ✅ | `hubSetMode` / `hubSetSeatPart` + 5 例 Node（`tde-hub-modes`）；**UI 面板与浏览器截图仍缺** |
| 2 | 按线选人 / 牌组、跨线重复校验 | P5 批次 2 ✅ | 非活动线 record 落 `parts[line]`；跨线候选互斥 |
| 3 | lane adapter（roomSeat↔laneSeat 边界转换）与切 part | P5 批次 3 | 非连续座位可行动；线内数组连续 |
| 4 | 交互面板（模式选择 / 确认页）与浏览器路径 | P5 批次 3 / P8 | 账本 `pending→verified`（桌面/移动各一条路径 + 截图） |
| 5 | 8 条场景交互随章节接入 | P8 | 逐章 12 项检查 + 隐私断言 |

## 5. 边界

- 交互不是规则：面板只把已算好的候选呈现出来；规则判断留在引擎与描述子。
- 并行双线的 UI 仍是「一个房间、每座位只看本线」，开闸门禁在路线图 §11.2，不随 P5 批次 1–2 放开。
- 本轮没有浏览器证据（没有任何已注册战役声明 `parts`），因此**不能**把任何一条交互写成 `verified`；引擎侧动作（批次 2）不等于交互验收。

## 6. 相关手册与维护

- 原语：[`tde-primitives.md`](./tde-primitives.md)；规则书：[`tde-rules.md`](./tde-rules.md)；剧本：[`tde-scenarios.md`](./tde-scenarios.md)；发布：[`tde-release.md`](./tde-release.md)。
- 维护：交互清单以 `interactions.js` + 本表为准；新增交互先改清单与 `validateInteractionInventory`，再写服务端候选与浏览器证据。
