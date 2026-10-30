# 《食梦者》P5 收尾报告：模式、章对门、hub 与双运行时（2026-10-29）

> **口径**：P5 机制闭环已完成。本文按批次追加，靠前的小节会写「尚未接线」，以文末和 [`tde-interactions.md`](./tde-interactions.md) 的现状为准。
> **仍未完成**：真实 TDE 章节（P8）、交互 3–10 的场景界面、P9.5 的多人矩阵。战役仍不可启动。交互 2 的演示点击路径已核对，源清单仍 `pending`。
> 手册：[`tde-interactions.md`](./tde-interactions.md)；路线图 §7。

## 1. 一页结论

| 项 | 结论 |
| --- | --- |
| 模式策略 | 四模式可用性矩阵（1–4 人）、默认分线（并行等分 / 分选交替 / 单线全侧）、改线校验（仅分选、两线各 ≥1）、开局摘要 |
| 章对门 | 新增 `partGate` 节点：两边都完成 → 幕间；只剩一边 → 自动进入；两边都未完成 → 玩家选先手；**16 种排列全部跑通** |
| 双线条件 | `part / parts / mode / modeIn / activeParts` 可嵌进普通 `all/any/not/compare/completed/record` 条件（与关系） |
| 投影脱敏 | `partScopedView`：别人的线只给记录/经验/创伤/胜利/袋与牌组张数，**故事正文与别人的牌组/购入不投影**；观察者自己的记录保留牌组。未声明 parts 的战役逐字节不变 |
| 交互清单 | 10 条已定稿。交互 1–2 的演示路径后来 `verified`；源清单仍全部 `pending`；3–10 仍 `pending`。以 [`tde-interactions.md`](./tde-interactions.md) 为准 |
| hub 开局（批次 2） | `hubSetMode` / `hubSetSeatPart`：未选模式只给四模式 + 队长；奇数并行置灰给原因；单线 A/B 按模式化章节顺序真正开局；分选/并行可改线与按线准备 |
| 按线准备（批次 2） | 非活动线座位的 record 经 `inPart` 写进 `parts[line]` 快照；跨线重复选人同时看两条线；分选/并行的关卡运行由批次 3 gate 阻塞并给原因 |
| 测试 | P5 累计 **69 例**：`tde-modes` 7 + `tde-dual-flow` 7 + `tde-hub-modes` 5 + `tde-lane-adapter` 7 + `tde-dual-runtime` 8 + `tde-lane-runtime` 7 + `tde-parallel` 10 + `tde-mode-panel` 10 + `tde-hub-modes` 7 |
| 运行时（批次 3） | `lane-runtime.js`：关卡内线内密集座位、记录键换 laneSeat、离开还原；index.js 大厅边界全套 room↔lane 转换（另一线座位无行动权） |
| 并行管线 | `parallel-runtime.js`：两条完整运行时、按座位路由、本线视图 + 另一线公开摘要、单文件存档、章对屏障（6 例） |
| 模式面板 | `web/hub-mode-view.js` + `web/hub.js`：四模式按钮、置灰原因、并行也可改线；浏览器证据见下行 |
| 并行开闸 | `dualLineGate` 逐战役。演示战役已开；真实 TDE 仍关 |
| 面板浏览器证据 | `audit/tde-ui-browser.json`：桌面 1440 + 移动 390。张数以账本为准，不在这里手写 |
| 未做 | 真实 TDE 开闸与双线全流程（P8/P9.5）、交互 3–10、`confirmations.interactions` 其余条目。交互 2 的演示点击路径已核对，源清单仍 `pending` |

## 2. 交付物

| 类别 | 文件 | 要点 |
| --- | --- | --- |
| 模式策略 | [`src/campaign/campaign-modes.js`](../src/campaign/campaign-modes.js) | `modeOptions` / `modePlan` / `defaultSeatParts` / `assignSeatPart` / `describeModePlan` / `campaignPartsManifest`；纯策略、不写状态 |
| 双线流程 | [`src/campaign/part-flow.js`](../src/campaign/part-flow.js) | `dualPartFlow` / `singlePartFlow` / `partFlow` / `normalizePartPairs` / `validatePartManifest`；只产可序列化数据 |
| 流程读点 | [`src/campaign/campaign-flow.js`](../src/campaign/campaign-flow.js) | `partGate` 节点类型、`flowCondition` 的双线条件、图校验的出口规则 |
| 投影 | [`src/campaign/campaign-parts.js`](../src/campaign/campaign-parts.js) | `partScopedView`；由 `campaignView` 统一调用 |
| 交互清单 | [`content/campaigns/theDreamEaters/interactions.js`](../content/campaigns/theDreamEaters/interactions.js) | 10 条 + `validateInteractionInventory` |
| 测试 | [`tests/tde-modes.test.mjs`](../tests/tde-modes.test.mjs)、[`tests/tde-dual-flow.test.mjs`](../tests/tde-dual-flow.test.mjs) | 14 例，登记 FAST |
| 命令 | `package.json` | `test:tde:pick` / `test:tde:dual` |
| 文档 | 本文件、[`tde-interactions.md`](./tde-interactions.md)、路线图 §7 / §13.8 | — |

## 3. 关键设计

### 3.1 四模式是「策略 + 数据」，不是引擎分支

`campaign-modes.js` 只回答三件事：当前人数下哪些模式可用、默认怎么分线、改线是否合法。它不写 `state`、不识别战役名，也不产生第二套牌组；`campaign.parts` 的写入仍由 P3 的 `createPartsState` / `setPart` 负责。这样 hub 接线（批次 2）只需要把 `modePlan` 的结果落库并生成 moves，不必在 hub 里再写一份人数规则。

置灰原因在策略层就定了文案（奇数并行 / 1 人只能单线 / 分选两线各 ≥1），hub 与观察投影直接复用，避免 UI 与引擎各写一份。

### 3.2 `partGate` 与 16 种排列

旧流程只有 `scenario → interlude → scenario` 的线性边。双线要求「同一对的两个章节都完成才进幕间」，且同对内部可先 A 或先 B。批次 1 用新节点类型 `partGate` 表达：

```text
gate_n: options = [A_n (when: A_n 未完成), B_n (when: B_n 未完成)]
        next    = (n < 4) ? interlude_n : end
A_n/b_n: scenario，next 回到 gate_n
```

`walkCampaign` 对 `partGate` 的规则：可用出口 0 → 走 `next`；1 → 自动进入（不问玩家）；2 → 询问先手。测试枚举 4 个章对 × 2 种先手 = **16 种排列**，逐一验证：

- 每章恰好打一次、8 章全到；
- 第 n 对两章都出现在第 n+1 对之前（屏障）；
- 每对的先手与偏好一致；
- 16 条序列互不相同。

### 3.3 双线条件与普通条件是「与」

`flowCondition` 先处理 `all/any/not`，然后若叶子上出现 `part/parts/mode/modeIn/activeParts`，先用 `partFlowCondition` 判双线部分，再把剩余键递归回普通条件——所以 `{ mode: 'pick', completed: 'a1' }` 是「分选模式 **且** a1 已完成」，而不是只判一个。这样 P8 的 manifest 不用为每个条件写两套字段。

### 3.4 投影脱敏只做「不该看的」

`partScopedView` 保留战役日志级信息（记录、经验、创伤、胜利、混乱袋、调查员身份/状态/牌组张数），去掉牌组内容、购入记录、升级草稿与 `storySections` 正文——后两者会泄露另一条线尚未到达的分支。未声明 `parts` 的战役直接返回原对象，不写 `partsRedacted`，保证既有循环的投影逐字节不变。

## 4. 门禁实测

| 项 | 结果 |
| --- | --- |
| `tde-modes` / `tde-dual-flow` | 14 / 14 通过 |
| 16 排列 | 16 条序列全部可达、互不相同、逐对屏障成立 |
| 存档往返 | 中途 JSON 恢复后继续推进，结局与直接推进一致；`parts`/`seatParts`/记录保留 |
| 投影 | 非活动线的 `storySections` / `deck` / `purchases` 不出现；自有牌组保留；无 parts 战役不变 |
| `test:fast` | 批次 1 收尾 **3889 tests / 3886 pass / 3 skipped / 0 fail**（`p5-fast.log`）；批次 2 收尾 **3894 / 3891 / 3 skipped / 0 fail**（`p5b2-fast.log`） |
| replay | `replay-fixtures --compare artifacts/migration/tde/replay-before.json` → 13 局逐条一致（非 TDE 行为零变化） |
| `docs:check` | 36 文件 / 278 本地链接全部可解析 |

## 5. 与路线图的对照

- 路线图 §2 的 P5 定义包含「四种开局选项 / 按线选人 / 切 part / 并行双运行时 / 双日志双袋投影 / 座位分线」。本批只覆盖其中的**策略与数据流**：模式选择规则、章对门、双线条件、非活动线投影。
- 路线图 §11.2 的双线额外门禁中，本批已满足「16 种逐章对先手排列全部通过轻量 flow/gate 测试」这一条；其余（2+2/1+1 矩阵、lane adapter、并发提交、单文件存档、隐私事件的运行期断言）要等批次 2/3。
- **D1 口径不变**：骨架保留、单线先暴露、双线留 gate。P5 批次 1 没有改变任何已注册战役的行为（replay 13 局零漂移）。

## 6. 仍未完成（批次 2 / 3）

| 项 | 归属 | 说明 |
| --- | --- | --- |
| hub 接四模式 + 置灰原因 + 确认页 | P5 批次 2 | 需要把 `modeOptions`/`modePlan` 变成 `hubSetMode`/`hubSetSeatPart` moves 与 UI |
| 按线选人 / 牌组、跨线重复校验、缺牌组阻塞 | P5 批次 2 | 与 `seatParts` 绑定的选人流程 |
| `roomSeat↔laneSeat` 边界转换、切 part 的运行时重建 | P5 批次 3 | lane adapter（WP-8） |
| 并行双运行时 `shared + lanes.A/B`、全局提交队列、单文件存档 | P5 批次 3 | D8-C 骨架 |
| 双日志/双袋 tab、按线事件投影、AI 按线 | P5 批次 3 | 与 privacy 门禁一起验收 |
| 交互第 1–2 条的 UI 与浏览器证据 | P5 批次 2 | `confirmations.interactions` 才能从 pending 转 verified |
| 第 3–10 条交互 | P8 | 随章节内容接入 |

## 7. 诚实边界

- 本批**没有**浏览器证据：没有任何已注册战役声明 `parts`，四模式界面尚不存在；因此不能宣称 P5 的交互门禁通过。
- 本批**没有**改 `state.investigators` 的座位语义；`pick` 的切线与 `parallel` 的双运行时都还没接，`campaign.currentPart` 目前只是数据字段。
- 交互清单全部 `pending`：`blockers` 写明了原因，`verified` 需要真实路径 + 截图，最早在批次 2。

## 8. 批次 2（2026-10-29）：hub 四模式开局与按线准备

### 8.1 交付

| 项 | 落点 | 说明 |
| --- | --- | --- |
| 模式化清单读点 | [`src/engine/engine.js`](../src/engine/engine.js) 的 `campaignManifestFor` + [`part-flow.js`](../src/campaign/part-flow.js) 的 `partManifest` | 声明 `parts` 且选定模式后，manifest 的 `flow`/`scenarioIds` 按模式替换（单线只排本线 4 章、双线交错）；未声明 parts 的战役原样返回 |
| hub 模式动作 | [`src/engine/hub.js`](../src/engine/hub.js) | 未选模式只给四个 `hubSetMode`（置灰项带 `disabled` + 原因）与队长；分选追加 `hubSetSeatPart` 改线动作 |
| 落库与校验 | [`src/engine/dispatch.js`](../src/engine/dispatch.js) | `hubSetMode` 复核 `modePlan`（人数/等分/两线各 ≥1）后写 `mode/seatParts/activeParts/currentPart/parts`；`hubSetSeatPart` 只允许分选且两线不空 |
| 按线准备 | `dispatch.js` 的选人/牌组分支 + `hub.js` 的 record 读取 | 非活动线座位的 campaign record 用 `inPart` 写进该线快照；`hubDoneSeat`/`hubAutoDeck` 按座位所属线取 record |
| 跨线重复选人 | [`table-decisions.js`](../src/engine/table-decisions.js) 的 `hubInvestigatorChoices` | used 集合合并活动线 + 所有 `parts` 快照的现役与退役记录 |
| 双线运行 gate | `dispatch.js` 的 `hubBeginScenario` | 分选/并行在「开始当前关卡」处抛明确原因（lane adapter 属批次 3），不静默按整桌开局 |

### 8.2 验收（[`tests/tde-hub-modes.test.mjs`](../tests/tde-hub-modes.test.mjs)，5 例）

- 3 人：`parallel` 置灰并给「两组人数相等」；4 人可用；未选模式前不提供选关/准备。
- 单线 A（2 人）：`seatParts=['A','A']`、`scenarioOrder=[a1,a2]`、`hubSelectedScenarioId='a1'`；选人 → 自动构筑 → 确认 → `hubBeginScenario` 后 `state.scenario.id==='a1'`。
- 单线 B（1 人）：`currentPart='B'`、首章 b1。
- 分选（2 人）：把唯一 B 座位改到 A 被拒绝；3 人 2+1 改线成功；座位 1 的 record 落 `parts.B` 且活动线没有它的 record；跨线重复选人被排除；准备完成后 `hubBeginScenario` 抛「批次 3」。
- 并行（4 人）：`seatParts=['A','A','B','B']`、`activeParts=['A','B']`、`currentPart=null`；四个座位都能准备；关卡开始同样被 gate 挡住。

### 8.3 取舍

- **分选/并行只开到「准备完成」**：真正的关卡运行需要 `roomSeat↔laneSeat` 与运行时重建（批次 3）。把它挡在 `hubBeginScenario` 而不是 `hubGoSetup`，是为了让「每座位一套牌组、按线准备」这条交互在真实 hub 流程里可验收，而不是做一个点不动的模式选择器。
- **交互状态仍是 pending**：hub 的引擎动作与文案有了，但 `web/hub.js` 没有渲染模式面板（没有已注册战役声明 `parts`，无法做真实浏览器路径），因此第 1–2 条交互不能转 `verified`。


## 9. 批次 3（进行中，本轮只落协议层）：lane adapter 与双运行时容器

### 9.1 交付

| 项 | 落点 | 说明 |
| --- | --- | --- |
| 座位适配器 | [`src/campaign/lane-adapter.js`](../src/campaign/lane-adapter.js) | roomSeat↔laneSeat、命令/待决选择/座位列表/事件/观察者的整条边界；非双线战役全部原样透传（不写 `lane` 字段） |
| 双运行时容器 | [`src/campaign/dual-runtime.js`](../src/campaign/dual-runtime.js) | `shared + lanes.A/B`、全局 `revision` + 每线 `revision`、原子提交、同线旧版本拒绝、全局过期可重基、`sealPairOnce` 屏障、单文件序列化/恢复 |
| 测试 | [`tests/tde-lane-adapter.test.mjs`](../tests/tde-lane-adapter.test.mjs) 7 例 + [`tests/tde-dual-runtime.test.mjs`](../tests/tde-dual-runtime.test.mjs) 8 例 | `test:tde:runtime`；协议门禁逐条（双版本/屏障/存档往返/事件 lane） |

### 9.2 协议门禁（已实测）

- 同线旧版本被拒且不留半成品；全局版本过期、目标线未变时允许安全重基。
- 跨线同时提交（A→B 与 B→A 两种顺序）都保留两条线的更新，全局各 +1、线内各 +1。
- 两条线都 `awaitingPair` 才封盘；幕间只跑一次；重复提交/重连/重放返回 `already-applied`。
- 单文件存档往返逐字节一致；非法版本/缺线/负 revision 直接拒绝。
- 事件 lane 标记把 seat 转回 roomSeat；`visibleToLane` 只放行 shared 与本线私有事件。

### 9.3 尚未接线（批次 3 剩余）

- **运行时重建**：在 `hubBeginScenario` 真正把 `state.investigators` 重建为该线密集座位、把 `humanSeats/leadSeat/currentSeat` 换成 lane 座位，并在关间/切口时切回。
- **引擎边界**：`applyMove/validateMove/legalMoves/viewState/viewEvents` 的 room↔lane 双向转换接到适配器。
- **并行双运行时**：把容器接进 index/observation/AI/存档管线；`test:tde:parallel` 与 §11.2 双线门禁。
- **交互 UI 与浏览器证据**：依赖 P8 注册真实 parts 战役。

### 9.4 本批门禁

| 项 | 结果 |
| --- | --- |
| `test:tde:runtime` | 15 / 15 通过（adapter 7 + container 8） |
| `test:fast` | **3909 tests / 3906 pass / 3 skipped / 0 fail**（`p5b3-fast.log`，含本批 15 例） |
| replay | `--compare` 13 局逐条一致（适配器/容器都是新增纯模块，未接引擎） |
| `docs:check` | 36 文件 / 287 本地链接全部可解析 |
| 账本 | `audit:tde:primitives` / `audit:tde:rules` / `audit:tcu` / `scan:tde:*` 全绿（`suites.mjs` 变更后重算 TCU 账本） |

> 因此本轮**不**宣称 P5 完成：适配器与容器是 P5 批次 3 的协议骨架，真实运行时接线与浏览器验收仍未做。


## 10. 批次 3（本轮续）：关卡运行时重建与大厅边界接线

### 10.1 交付

| 项 | 落点 | 说明 |
| --- | --- | --- |
| 运行时重建 | [`src/engine/lane-runtime.js`](../src/engine/lane-runtime.js) | `enterLaneRuntime`：把当前线的 campaign record 改成以 laneSeat 为键（保留 `roomSeat`）、运行时调查员改成密集线内数组、`humanSeats/leadSeat/currentSeat/hubSeat*` 同步换座；`leaveLaneRuntime`：记录键与全部座位运行时改回 roomSeat，`roomSeat` 运行期字段清掉 |
| hub 接线 | `dispatch.js` | `hubBeginScenario`：按目标关卡所属线 `setPart` + `enterLaneRuntime`，再 `progressCampaign`；关卡结束（`ScenarioEnded`）先 `leaveLaneRuntime` 再进结算/关间 |
| 开局先手 | `table-decisions.js` | `initialHubScenarioMoves` 支持 `partGate` 起点（按 `when` 过滤未完成章节），分选的第一关能真正被选中 |
| 大厅边界 | [`index.js`](../index.js) | `legalMoves / validateMove / applyMove / decisionSeat / actingSeats / seatLocalMove / viewState / describeState / autoChoice` 全部按 `state.laneRuntime` 做 room↔lane 转换；另一条线座位返回「另一条线」原因 |
| 结算记录 | `engine/campaign-flow.js` | `scenarioResults[].investigators[].seat` 存 roomSeat（`record.roomSeat ?? inv.seat`），战役日志不出现线内座位 |
| 事件座位 | `engine.js` 的 `info` / `privateInfo` | 私有事件在生成时就换成 roomSeat（`roomSeatForEvent`），`viewEvents` 不需要 state 参数也能按房间座位过滤 |
| 结算快照 | `lane-runtime.js` 的 `roomKeyedRecords` | 离开运行时把 `scenarioResults[].recordsBefore/After` 里的线内键改回 roomSeat，并清掉运行期字段 |
| 测试 | [`tests/tde-lane-runtime.test.mjs`](../tests/tde-lane-runtime.test.mjs) **7 例** | 进入分选 A 线（3 人 2+1）后：密集座位、记录键与 `roomSeat`、队长/人类座位换算、另一线无行动权、观察投影、离开还原、私有事件座位、快照键、非双线 no-op |

### 10.2 与批次 2 的差异（口径更新）

- 批次 2 的分选「只能准备、不能开局」已作废：**分选（pick）现在可以进入关卡**，每关开始时切到目标线；并行（parallel）仍在 `hubBeginScenario` 被 gate 挡住（双运行时容器要接引擎管线）。
- `tde-hub-modes` 里分选用例同步改成「进入 A1 + 断言 lane 运行时」；并行用例仍断言 gate 原因。

### 10.3 尚未接线（P5 批次 3 剩余）

- **并行管线**：`dual-runtime` 容器接进 index/observation/AI/存档（并行仍是 gate）。
- ~~viewEvents 座位转换~~：已改为在事件生成时写 roomSeat（`privateSeat`），接口签名不变。
- ~~scenarioResults 快照键~~：离开运行时统一改回 roomSeat。
- **交互面板与浏览器证据**：依赖 P8 注册真实 parts 战役。

### 10.4 本批门禁

| 项 | 结果 |
| --- | --- |
| `tests/tde-lane-runtime.test.mjs` | 7 / 7 通过（3 人分选 2+1 真实 hub → A1 → 边界行动 → 私有事件 → 离开还原） |
| `test:fast` | **3916 tests / 3913 pass / 3 skipped / 0 fail**（`p5b3c-fast.log`，含本批 7 例） |
| replay | `--compare` 13 局逐条一致（非双线战役无 `seatParts`，适配器全是 no-op） |
| 回归子集 | `tde-hub-modes`（分选改为可开局）、`hub-*`、`flow-*`、`campaign-*` 全绿 |
| 账本 | `audit:tcu`（`suites.mjs` 变更后重算）、`audit:tde:primitives`（文档收尾后重算）、`audit:tde:rules`、`scan:tde:*` 全部一致 |
| docs | `docs:check` 36 文件 / 294 链接全部可解析 |

## 11. 批次 3（本轮续）：并行双运行时管线与开局模式面板

### 11.1 并行管线（D8-C 接线）

| 项 | 落点 | 说明 |
| --- | --- | --- |
| 容器启动 | [`src/integration/parallel-runtime.js`](../src/integration/parallel-runtime.js) `launchParallelLanes` | 复制大厅容器为 A/B 两份完整运行时，各自 `setPart` + 进入 lane 运行时 + `resolveTransaction(setup)` 开局；两条线独立混乱袋、独立回合 |
| 命令路由 | `parallelApplyMove` / `parallelValidateMove` / `parallelSeatLocalMove` / `parallelLegalMoves` | 座位 → `seatParts` → laneState → 线内座位；容器不参与规则结算 |
| 观察与 AI | `parallelView` / `parallelDescribe` / `parallelAutoChoice` | 本线视图 + 另一线公开摘要（先关、回合、座位、是否等待）；AI 描述不含另一线剧情 |
| 决策座席 | `parallelDecisionSeats` / `parallelActingSeats` | 两条线各自决策座位换回 roomSeat；大厅按座位驱动 |
| 存档 | `serializeParallelState` / `restoreParallelState` | 单文件（容器含两条线）；缺线/座位表不一致直接拒绝 |
| 屏障 | `markLaneFinished` / `advanceParallelPair` | 两边结算到同一章对才封盘；未封盘 `advanceParallelPair` 返回 `not-sealed`；封盘后按 hub 动作推进下一章 |
| 大厅边界 | [`index.js`](../index.js) | `isParallelState` 时全部走并行路由（与分选 lane 适配器同一层） |
| 测试 | [`tests/tde-parallel.test.mjs`](../tests/tde-parallel.test.mjs) 6 例 | 启动两条线（a1/b1）、按座位路由互不污染、事件带 lane、观察/AI 隔离、存档往返、屏障只封一次、非并行拒绝 |

### 11.2 开局模式面板（交互 1 的 UI）

| 项 | 落点 | 说明 |
| --- | --- | --- |
| 纯模型 | [`web/hub-mode-view.js`](../web/hub-mode-view.js) | 四模式固定顺序、置灰原因原样保留、分选逐座位分线、先选模式提示 |
| 渲染 | [`web/hub.js`](../web/hub.js) 战役总览 | `hubSetMode` / `hubSetSeatPart` 按钮；disabled 时直接显示引擎原因（`ah-mode-reason`），不再维护第二套判断 |
| 词典 | [`web/locales/zh-CN.hub.js`](../web/locales/zh-CN.hub.js) / [`en.hub.js`](../web/locales/en.hub.js) | `hub.mode.*` 中英各 5 键 |
| 测试 | [`tests/tde-mode-panel.test.mjs`](../tests/tde-mode-panel.test.mjs) 4 例 | 无 parts 不渲染；模式顺序与置灰原因；座位分线；并行不显示座位行 |

### 11.3 本批门禁

| 项 | 结果 |
| --- | --- |
| `test:tde:parallel` | 6 / 6 通过（真实 4 人并行开局 → 两条线各自结算 → 存档 → 屏障） |
| `test:tde:pick` | 7 + 5 + 4 = 16 通过（含面板模型） |
| `test:fast` | **3926 tests / 3923 pass / 3 skipped / 0 fail**（`p5b3d-fast.log`） |
| replay | `--compare` 13 局逐条一致（非并行/非双线状态原样透传） |
| docs | 36 文件 / 310 链接全部可解析 |
| 账本 | `audit:tcu`（suites 变更后重算）、`audit:tde:primitives`、`audit:tde:rules`、`scan:tde:*` 全部一致 |

### 11.4 仍不宣称完成的部分

- **并行玩家开闸**：管线、路由、存档、屏障都已接线并由 Node 覆盖，但 `hubBeginScenario` 对 `parallel` 仍返回明确原因——双线大厅界面（两线同时行动、回滚/检查点归属）属于 P9.5 开闸内容；本轮**没有**把并行模式开放给玩家。
- **浏览器证据**：模式面板已接进 `web/hub.js`，但内容层还没有注册声明 `parts` 的战役（P8），浏览器里没有入口可点；交互 1 仍是 `pending`，不写 `verified`。
- 并行线的回滚/撤销（大厅 checkpoint 按单线设计）未覆盖；开闸前必须补。

### 11.5 下一步（P9.5 开闸清单）

1. `hubBeginScenario` 的 parallel 分支改调 `launchParallelLanes`，并让 `web/hub.js` 的局内视图识别 `parallel` 容器。
2. 大厅回滚/检查点按 lane 归属（每个 laneState 自带 checkpoint 表）。
3. 双线同时行动的服务端驱动（AI 座位按各自 lane 的决策座位）。
4. P8 注册 TDE parts 后补浏览器截图与交互 `verified`。

## 12. 批次 3（本轮续）：并行开闸机制与开局模式面板浏览器证据

### 12.1 并行玩家开闸（逐战役 feature gate）

| 项 | 落点 | 说明 |
| --- | --- | --- |
| 开闸开关 | 战役 manifest 的 `dualLineGate` | `hubBeginScenario` 在 **mod 边界**启动双运行时；只有显式 `dualLineGate: "open"` 的战役可开。真实 TDE 保持关闭，等 P9.5 的 4 人 2+2 / 2 人 1+1 矩阵验收 |
| 大厅入口 | [`index.js`](../index.js) `parallelLaunchMove` + `launchParallelLanes` | `hubBeginScenario` 直接启动两份运行时，容器进入 `inScenario`；纯引擎调用仍给明确原因（引擎层没有容器） |
| 章对屏障 | `parallelApplyMove` | 本线 `hubBeginScenario` 前检查 `sealed[pair]`；另一线没结算到同一章对就拒绝，防止抢跑下一章 |
| 观战视图 | `parallelPublicView` | 无座位视图只给两条线的关卡/回合/座位/等待/封盘摘要，不含手牌与牌库 |
| 状态同步 | `syncParallelStatus` | 两条线都结束后容器才 `ended` + `campaignResult` |
| 测试 | [`tests/tde-parallel.test.mjs`](../tests/tde-parallel.test.mjs) **9 例** | 新增：大厅开闸（mod 启动 / 纯引擎拒绝）、章对屏障、无 `dualLineGate` 的战役拒绝启动 |

### 12.2 开局模式面板浏览器证据（交互 1）

| 项 | 落点 | 说明 |
| --- | --- | --- |
| 演示战役 | [`content/browser-demo/dualHub.js`](../content/browser-demo/dualHub.js) | 仅 `ARKHAM_BROWSER_DEMO=dualHub` 时由组合根注册；复用核心《聚会》两章做 A/B 线，`dualLineGate: "open"` |
| 浏览器配置 | [`playwright.tde-ui.config.mjs`](../playwright.tde-ui.config.mjs) | webServer 注入演示战役；只跑 `tde-modes.browser.mjs` |
| 用例 | [`tests/tde-modes.browser.mjs`](../tests/tde-modes.browser.mjs) | 桌面 1440 + 移动 390：四模式可见、并行置灰并显示原因、选分选后出现 3 个座位分线按钮、切换一条线后 UI 保持 |
| 证据 | [`audit/tde-ui-browser.json`](../audit/tde-ui-browser.json) | runner 生成：2 条用例通过、4 张截图（`modes-{desktop,mobile}.png` / `modes-{desktop,mobile}-seats.png`），`desktopBrowser` / `mobileBrowser` 均 true |
| 证据命令 | `npm run test:tde:modes:browser` | 报告器 [`tools/playwright-tde-ui-reporter.mjs`](../tools/playwright-tde-ui-reporter.mjs) 写账本，不手写 |

### 12.3 本批门禁

| 项 | 结果 |
| --- | --- |
| `test:tde:parallel` | 9 / 9 通过（含大厅开闸、屏障、闭闸拒绝） |
| `test:tde:pick` | 7 + 5 + 5 = 17 通过 |
| `test:fast` | **3930 tests / 3927 pass / 3 skipped / 0 fail**（`p5b4-fast.log`） |
| 浏览器 | `audit/tde-ui-browser.json`：2 条用例通过、4 张截图、桌面/移动均 true |
| replay | `--compare` 13 局逐条一致 |
| docs | `docs:check` 36 文件 / 323 链接全部可解析 |
| 账本 | `audit:tcu`、`audit:tde:primitives`、`audit:tde:rules`、`scan:tde:*` 全部一致 |

### 12.4 剩余（不在本轮范围）

- **真实 TDE 开闸**：TDE 仍是 `catalog-only`，manifest 未置 `dualLineGate: "open"`；P8 注册 8 章、P9.5 跑 4 人 2+2 / 2 人 1+1 / 3 人分选 2+1 矩阵与两条全流程后才打开。
- **双线大厅细节**：两线同时行动时的回滚/检查点归属、AI 座位并发驱动仍按 P9.5 清单验收；本轮管线与 Node 测试已覆盖机制，未做真实内容双线全流程。
- 交互 2（按线选人/牌组）的名册与桌面/移动点击路径已补上（`audit/tde-ui-browser.json`）。源清单仍 `pending`：真实 TDE 章节未注册。

## 13. 并行交互改造 W1（2026-10-29）：模式先于一切、自由分线与人数相等门

完整盘点与线框见 [`tde-parallel-interactions.md`](./tde-parallel-interactions.md)（24 处交互点、3 个波次）。本轮完成 **W1**：

| 项 | 落点 | 行为 |
| --- | --- | --- |
| 首屏模式门 | `web/hub.js` `renderGame` | 声明 parts 且模式未定时只渲染「开局模式」整屏：没有页签、没有关卡/调查员入口；页面带 `data-mode-gate="true"` |
| 模式卡片 | `web/hub-mode-view.js` + hub | 四模式固定顺序、置灰原因来自引擎；当前模式与提示 |
| 自由分线 | `assignSeatPart` 支持 `parallel`；`hubSetSeatPart` 允许 `pick/parallel` | 每个座位可换线（自己改自己；房主可改全部），首次整备期间有效；开始后锁定 |
| 人数相等门 | `laneBalance` / `hubBeginScenario` / `parallelLaunchLanes` | 并行允许暂时 3:1，但「开始当前关卡」置灰并显示「两线人数必须相等（A 3 / B 1）」；大厅边界同样拒绝，不能绕过 UI |
| 分线摘要 | `web/hub-mode-view.js` `assignments` / `laneCounts` / `balanced` | 常驻显示 A/B 人数、每座位归属与换线按钮；相等/不等状态着色 |
| 开始按钮 | `web/hub.js` `action()` / `departure` | 尊重引擎 move 的 `disabled` + `explanation`，置灰原因可见 |
| 测试 | [`tests/tde-mode-panel.test.mjs`](../tests/tde-mode-panel.test.mjs) 7 例 + [`tests/tde-hub-modes.test.mjs`](../tests/tde-hub-modes.test.mjs) 6 例 | 首屏门、分线摘要、并行 3:1 → 开始置灰 → 调回 2:2 → 可开始；大厅边界拒绝不平衡开局 |
| 浏览器证据 | [`audit/tde-ui-browser.json`](../audit/tde-ui-browser.json) | **4 条用例 / 10 张截图**：首屏无页签、模式置灰原因、分选座位行、并行 2:2 可开始、3:1 警告；桌面 1440 + 移动 390 |

### 13.1 本批门禁

| 项 | 结果 |
| --- | --- |
| `test:fast` | **3944 tests / 3941 pass / 3 skipped / 0 fail**（`p5b12-fast.log`） |
| `test:tde:pick` | 7 + 7 + 10 = 24 通过；`test:tde:parallel` 16 通过（P0 版本号/代答/批量/观战 + 换线权限 + 检查点） |
| replay | `--compare` 13 局逐条一致 |
| docs | `docs:check` 38 文件 / 336 链接全部可解析 |

### 13.2 模式门的作用域（修正）

- 模式门**只属于声明了 parts 的战役**：引擎投影对这类战役加 `campaign.requiresMode` 与 `campaign.mode`，
  `modePanelModel.firstScreen = requiresMode && !mode`；`renderGame` 还要求 `visible`。非房主席位在首屏拿不到 `hubSetMode`，
  仍能看到模式门并显示「等待房主选择开局模式」。
- 生产内容里只有**第五循环（食梦者）**会声明 parts；核心、敦威治、卡尔克萨、失落的时代、万象无终都不受影响，
  照旧直接进入战役台面（页签、关卡、调查员入口不变）。
- 浏览器新增回归：核心循环 2 人开局 → 无 `data-mode-gate`、无「开局模式」区域、页签可见。

### 13.2.1 联机影响评估

并行容器与大厅的联机钩子（自动代答/批量选择/检查点/观战/迁移）存在已知缺口，逐条评估见
[`tde-parallel-online-assessment.md`](./tde-parallel-online-assessment.md)。
结论：引擎不会串线。P0 四项、P1（检查点、换线、AI 本线上下文）和 P2（演出座位、`lanes` 迁移）已有测试。两线卡表不去重。见 [`tde-parallel-online-assessment.md`](./tde-parallel-online-assessment.md)。

### 13.3 出发准备分屏与双线队长（W2，已完成）

按用户给的参考图，分屏落在**出发准备页**（不是局内牌桌）：一条竖线把准备页分成左右两栏，左 A 线 / 右 B 线；移动端竖线变横线（上下排列）。

| 项 | 落点 | 行为 |
| --- | --- | --- |
| 分屏模型 | [`web/departure-lanes.js`](../web/departure-lanes.js) | 按线输出座位、人数、该线队长候选/当前队长、换线按钮、开始按钮；非并行返回 `{ parallel:false }` |
| 分屏渲染 | `web/hub.js` `departure()` | `[data-parallel="true"]` 两栏；A 线在左、B 线在右，中间 1px 竖线；移动端上下两块；每线标题下显示**本线关卡名 + 插图**（`campaign.partScenarios` 投影） |
| 双线队长 | 引擎 `hubSetPartLeader` + `campaign.partLeads` | 每条线各选一名队长（可真人或 AI，但必须在本线）；默认每线第一个座位；队长入口在**人物卡内**（「设为队长」/「队长」），启动时两条运行时各用自己的队长座位 |
| 换位置 | `hubSetSeatPart`（人物卡内一键） | 每张人物卡一个「换位置」文字动作：点一下自己就换到另一条线；AI 的「换位置」只在房主视图出现（房主点了 AI 换线）；人数不等时开始置灰 |
| 队伍记录 | `recordForSeat` | 首次整备时记录可能只在 `parts[line]` 快照里，出发准备按线取记录，4/4 准备计数与开始按钮才正确 |
| 对齐/通用按钮 | `ah-departure-common` + `ah-lane-team` 网格 | 两线人物卡两列横排（一排最多两张，桌面 2+2；移动端窄屏单列）；阅读导入/开始/重新准备收进顶部一行；不再有重复的队长候选行 |
| 测试 | [`tests/tde-mode-panel.test.mjs`](../tests/tde-mode-panel.test.mjs) + [`tests/tde-parallel.test.mjs`](../tests/tde-parallel.test.mjs) | 分屏模型 2 例；双线队长 1 例（A/B 各自选、启动后映射到线内座位） |
| 浏览器 | [`audit/tde-ui-browser.json`](../audit/tde-ui-browser.json) | 新增 2 条（桌面/移动）：A/B 两栏、各线队长候选、B 线换队长真实提交；截图 `departure-parallel-{desktop,mobile}.png` |

**局内不做分屏（2026-10-29 用户决定）**：牌桌保持单线视图，另一条线在后台由双运行时处理；浏览器新增烟雾用例：并行开局后 `.ah-table` 正常渲染、页面上没有分屏容器，两条运行时在服务端同时存在。
