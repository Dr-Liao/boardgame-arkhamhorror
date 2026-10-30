# 《食梦者》交互手册（P5 批次 1：清单定稿 + 策略层）

> **口径**：10 条交互已在 P5 定稿为事实表（[`interactions.js`](../content/campaigns/theDreamEaters/interactions.js)）。源清单仍全部 `pending`（真实 TDE 章节未注册）。交互 1–2 的演示点击路径已在双线演示战役上核对（桌面 1440 + 移动 390，[`audit/tde-ui-browser.json`](../audit/tde-ui-browser.json)）。交互 3–10 的场景面板随 P8。
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
| 2 | `laneSelection` | 按线选人 / 选牌组（每座位一套） | 开局准备 | `ui:laneDeckSelection` | hub | 引擎 P5-2 ✅ / 按线名册 ✅ / 桌面 1440 + 移动 390 浏览器证据（`audit/tde-ui-browser.json`） | verified |
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
> 交互 2 的浏览器证据同样用双线演示战役：调查员页按 A/B 分组，真人座位点选候选人并自动构筑后，本线牌组摘要可见，另一条线的牌组不投影。源清单仍 `pending`。
>
> 第 3–10 条仍是 `pending`：设计已经登记，`verified` 还要真实界面路径、桌面/移动截图和隐私断言。

### 2.1 开局两条的硬口径（§1.4.1，本轮已落成策略层）

- 人数校验前置：奇数人数时「并行双线」不可用并给「两组人数相等」的原因；1 人只有两个单线选项。
  → 实现：[`campaign-modes.js`](../src/campaign/campaign-modes.js) 的 `modeOptions` / `modePlan`（纯策略，hub 接线在批次 2）。
- 分选要求两线各 ≥1 座位：`modePlan({ mode:'pick', seatParts:['A','A'] })` 直接给原因；改线走 `assignSeatPart`，清空任一条线会被拒绝。
- 并行可以自由改线，开始前两组人数必须相等；默认分线仍是 `defaultSeatParts('parallel', n)`（前 n/2 为 A）。奇数人数在模式选择处不可用。
- 每座位只建一套牌组：策略层只产出「座位→线」计划，不产生第二套牌组；跨线重复选人校验在批次 2 接。

### 2.2 场景交互的口径来源

- 蜂拥卡面板：P3 的 `swarm.placeCards` 决定入口数据；面板只展示与选择，不做规则判断。
- 掩藏地点：A2 的 15 张 b 面故事卡与 B3 的 8 张洗回牌堆是两种收尾，翻面面板要能表达；官方翻面门槛是「无线索 + [fast]」（P4 已按官方规则更正）。
- 隐藏手牌：18 张全部带险境；06306–06310 的敌人形态要在手牌里提供攻击/躲避入口。
- 纵向堆叠：布局必须复用既有 layout 变量，不新建循环专属布局。

## 3. 已落地（P5）

四模式、章对门与 16 排列、按线准备、分选运行时、并行管线、开局面板和按线选人名册都已接上。交互 1–2 的桌面/移动证据在 `audit/tde-ui-browser.json`（演示战役 `ARKHAM_BROWSER_DEMO=dualHub`，不依赖真实章节）。局内牌桌不分屏。盘点见 [`tde-parallel-interactions.md`](./tde-parallel-interactions.md)，联机缺口见 [`tde-parallel-online-assessment.md`](./tde-parallel-online-assessment.md)。真实 TDE 的 `dualLineGate` 仍关。

## 4. 仍待验收

| # | 事项 | 归属 |
| ---: | --- | --- |
| 1 | 交互 2 的源清单仍 `pending`：真实 TDE 章节未注册 | P8 注册章节之后 |
| 2 | 交互 3–9：随章节接入的场景面板 | P8 |
| 3 | 交互 10：梦境之门与 16 段尾声（含自译正文） | P8 / P8-T |
| 4 | 真实 TDE 打开 `dualLineGate`，并跑 P9.5 多人矩阵 | P8 之后 |

## 5. 边界

- 面板只呈现引擎已经算好的候选；浏览器只提交 `legalMoves`。
- 交互 1 的 `verified` 只覆盖模式门、分线和出发准备，不覆盖真实食梦者章节。
- 交互 2 的 `verified` 只覆盖演示战役上的按线选人、自动构筑和本线牌组投影，不覆盖真实食梦者章节。
- 并行开闸门禁在路线图 §11.2。演示战役打开开关，不等于 TDE 已开闸。

## 6. 相关手册与维护

- 原语：[`tde-primitives.md`](./tde-primitives.md)；规则书：[`tde-rules.md`](./tde-rules.md)；剧本：[`tde-scenarios.md`](./tde-scenarios.md)；发布：[`tde-release.md`](./tde-release.md)。
- 维护：交互清单以 `interactions.js` + 本表为准；新增交互先改清单与 `validateInteractionInventory`，再写服务端候选与浏览器证据。
