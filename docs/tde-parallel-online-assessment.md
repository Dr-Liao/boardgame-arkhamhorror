# 《食梦者》并行双线联机影响评估

> 范围：`parallel`（并行双线）模式在**大厅联机**下的主机（座位 1 / roomSeat 0）、其他真人玩家（座位 2–4）、
> AI 队友、观战者与存档/回档的影响。
> 结论先行：**引擎层不会串线，主机的本线操作与其他玩家的本线操作目前可用；P0 三项（自动代答、批量选择、观战）
> 已于 2026-10-29 修复，P1 仍待处理。** 逐条见 §3–§7。

## 1. 本次评估的代码口径

- 并行容器：`state.parallel.lanes.A/B`（两份完整运行时），大厅仍把容器当 `session.state`；
- 大厅每次只拿**自座位投影**：`viewState(container, roomSeat)` → `parallelView` → 本线 `viewState(laneState, laneSeat)`；
- 命令路由：`index.js` 的 `hosted*` 包装 → `parallelApplyMove / parallelValidateMove / parallelSeatLocalMove …`；
- 大厅侧的自动代答/批量选择/检查点/观战走的是**容器**，不认识 `parallel`。

实测脚本（合成双线战役，4 人并行、两条线各 2 人）**P0 修复前**输出（修复后 `pendingChoice`/批量/观战已变，见 §7）：

```text
launch true
container pendingChoice null   laneA undefined   laneB undefined
host view lane A               B player lane B
acting seats [0, 3]            decision 0
spectator view keys schemaVersion,status,uiState,parallel
checkpoint for parallel null
agentTurnKey inScenario::1:investigation:0:0
state bytes 2949890
```

## 2. 已经验证正常的部分

| 项 | 结论 |
| --- | --- |
| 视图隔离 | 座位 1 的视图是 A 线、座位 3（B 线）的视图是 B 线；不会把两条线的牌桌混在一起 |
| 行动路由 | `actingSeats` 同时返回两条线的决策座位（实测 `[0, 3]`）；大厅按座位提交，`validateMove/applyMove` 路由到对应 lane |
| 事件座位 | `parallelApplyMove` 把事件里的 `seat/privateSeat` 从线内座位换回房间座位，`viewEvents` 的私密过滤按房间座位生效 |
| 开闸/人数门 | 主机开始前会校验两线人数相等；不等时大厅与 mod 边界都拒绝 |
| 局内不串台 | 浏览器烟雾用例：并行开局后 `.ah-table` 正常、页面上没有分屏容器（另一条线后台） |
| 存档 | 容器含两条线，单文件可保存/恢复；`restoreParallelState` 校验两条线都在 |

## 3. 主机（座位 1）会受到的影响

| 影响 | 严重度 | 说明 |
| --- | --- | --- |
| 主机只看得到自己所在的线 | 设计如此 | 局内不做分屏；主机在 A 线就只看到 A 线牌桌。B 线只能从事件流/聊天看到摘要 |
| 分线与队长权限 | 已按规则收窄 | 队长仍由房主选；换线改为「真人自己换 + 房主只能代 AI 换」（`hubSetSeatPart` 权限校验，`actingSeats` 在并行准备阶段包含全部真人）。测试：`tde-parallel` 换线权限 1 例 |
| 自动反应/自动通过 | ~~高~~ **已修** | 新增 mod 钩子 `pendingChoice(state)`（lane 窗口换回房间座位），大厅 `settleAutoChoices` 改走该钩子；三态"自动"重新作用于并行线 |
| 多人换牌/技能批量确认 | ~~高~~ **已修** | `commitChoiceBatch` 增加并行分支：按 seat 找到 lane，在 lane 克隆上原子提交，成功才写回容器并 +1 版本 |
| 大厅容器版本号 | ~~高~~ **已修** | 大厅给动作带的是容器 `revision`，而 lane 有自己的内部版本；之前所有并行行动都会被引擎判「对局版本已过期」。现在 `parallelApplyMove/ValidateMove/SeatLocalMove` 在进 lane 前剥离 `revision`（容器版本已由大厅校验） |
| 关卡检查点/回档 | ~~中~~ **已修** | `createSessionCheckpoint` 增加并行分支：每章对生成一个同时覆盖两条线的检查点（scenarioId `A|B`，snapshot 含两份运行时）；任一线的队长都可 `fork`。测试：`tde-parallel` 检查点/回档 1 例 |
| 调试控制台 | 中 | `debugCommand` 作用在容器上，`debug scenario / spawn / xp` 等没有 lane 上下文；主机调试会失败或改错对象 |
| 存档体积 | 低 | 容器含两份完整运行时，实测约 **2.9 MB**（单线约一半）；联机落盘/快照更大，但仍是单文件 |

## 4. 其他真人玩家（座位 2–4）会受到的影响

| 影响 | 严重度 | 说明 |
| --- | --- | --- |
| 本线操作可用 | — | 自己的视图/合法动作/提交/待决选择都在本线；B 线玩家可以正常打自己那条线 |
| 换线 / 队长 | 换线已开放，队长仍房主 | 真人可在自己的卡上换线；房主只代 AI，不能替其他真人换线；队长仍由房主选 |
| 自动反应/自动通过设置 | ~~高~~ **已修** | 同主机：大厅通过 `mod.pendingChoice` 看到 lane 窗口 |
| 批量换牌/技能确认 | ~~高~~ **已修** | 同主机：并行分支按座位找到 lane |
| 私密事件 | 低（偏安全） | `privateSeat` 已换回房间座位，私密事件不会跨线泄漏；但事件里的 `presentation.tableState` 仍是线内座位编号，`projectTableState` 会把 B 线玩家自己的手牌也清空（**过度隐藏**，不是泄漏） |
| 重连/读档 | 低 | 视图按房间座位路由；但 `migrateState` 只迁移容器顶层，未来 schema 升级不会迁移 `lanes` 里的两份状态 |
| 观战（无座位） | ~~高~~ **已修** | `parallelPublicView` 改为 A 线公开投影 + 两线摘要 + 公开调查员列表；实测已含 `campaign/investigators`，手牌为空 |

## 5. AI 队友

| 项 | 结论 |
| --- | --- |
| AI 能否在两条线行动 | 可以：`nextAiSeat` 用 `actingSeats`（并行返回两条线的决策座位），`describeState/legalMoves/validateMove/applyMove` 都按座位路由 |
| AI 自动反应 | 引擎对 AI 座位的自动选项在 `requestChoice` 内直接领取（`!human` 分支），不依赖大厅 `settleAutoChoices`，所以 AI 窗口不会因此卡死 |
| AI 回合上下文 | `agentTurnKey` 用容器的 `scenario?.id / round / currentSeat`（实测 `inScenario::1:investigation:0:0`），容器没有 lane 的 scenario/round；同一 AI 座位跨回合可能复用同一段上下文（只影响提示记忆，不影响规则） |
| AI 计划（agentPlans） | `planPrompt/plansForObserver` 用容器的 `scenario/round`，并行下两个 lane 的计划会共用同一个"场景指纹"，`needsReview` 判断可能失真 |
| AI 行动点结束判定 | `actionsRemaining(container, seat)` 读容器里的运行时调查员（没有 `actionsLeft`），`Number.isFinite` 为假；AI 回合只按座位切换结束，不按行动点收尾（轻微） |
| AI 检查点/回档 | 与真人相同：并行整局没有检查点 |

## 6. 联机同步、读档与观战

| 项 | 结论 |
| --- | --- |
| 在线增量同步 | 服务端按 `viewState(observerSeat)` 生成投影；并行投影只含本线，不会把另一条线推给客户端；`parallel` 摘要只含关卡/回合/座位/等待，不含手牌 |
| 存档/快照 | 容器单文件保存；体积约 2.9 MB；`stateCompatibilityError` 只校验容器，不校验 `lanes` 内部 schema |
| 读档迁移 | `migrateState` 只迁移顶层字段；`lanes` 内两份状态不会跟着迁移（版本升级时的隐患） |
| 观战 | `parallelPublicView` 字段过少，当前观战 UI 不能直接用（**高**，若要支持联机观战需补投影） |
| 回档/检查点 | 并行不产生 `scenarioCheckpoints`；`checkpointView` 为空、无法 fork（**中**） |
| 主机/客机 UI | 主机和其他玩家都通过自己的 `viewState` 渲染；B 线玩家看到 B 线，不会因为主机在 A 线而受影响 |

## 7. 风险矩阵与建议修复顺序

| 优先级 | 问题 | 建议 |
| --- | --- | --- |
| **P0 ✅ 已修** | 大厅自动代答看不到 lane `pendingChoice` | 新增 mod 钩子 `pendingChoice(state)`（A/B 线窗口换回房间座位、带 `lane`）；大厅 `settleAutoChoices` 改走该钩子。测试：`tde-parallel` 代答钩子 1 例 |
| **P0 ✅ 已修** | 批量换牌/技能确认读容器 | `commitChoiceBatch` 增加并行分支：按 seat 找到 lane，在 lane 克隆上逐步 applyMove，成功才写回容器（原子、版本 +1、事件换回房间座位）。测试：`tde-parallel` 批量换牌 1 例 |
| **P0 ✅ 已修** | 大厅版本号（lane 与容器 revision 不一致） | 进入 lane 前剥离 `move.revision`；测试：`tde-parallel` 版本号 1 例 |
| **P0 ✅ 已修** | 观战空白 | `parallelPublicView` 改为 A 线公开投影 + 两条线摘要 + 公开调查员列表；观战不再只有 4 个字段。测试：`tde-parallel` 观战投影 1 例 |
| **P1 ✅ 已修** | 并行没有关卡检查点/回档 | `createSessionCheckpoint` 并行分支（每章对一个双线 checkpoint）；`checkpointView/fork` 允许 A/B 任一队长回档 |
| **P1 ✅ 已修** | 其他玩家不能自换线 | `hubSetSeatPart`：真人只能换自己，房主只能换 AI；`actingSeats` 在并行准备阶段包含全部真人。队长仍房主（按需求） |
| **P1** | `agentTurnKey/agentPlanning` 用容器 scenario/round | 改为取本座位 lane 的 `scenario/round/phase`，避免 AI 上下文跨回合/跨线复用 |
| **P2** | 事件 `presentation.tableState` 用线内座位 | 在 `parallelApplyMove` 里把事件 presentation 的座位也映射为房间座位（现在只是过度隐藏，无泄漏） |
| **P2** | 存档迁移/体积 | `migrateState` 递归迁移 `lanes`；必要时启动时把 lane 的 `cards` 静态表去重（共享引用/再水合） |

## 8. 联机测试建议矩阵（修完后逐项跑）

| 场景 | 期望 |
| --- | --- |
| 主机 + 3 AI，4 人并行 | 主机可打 A 线，B 线 AI 自动推进；无卡死 |
| 主机 + 1 真人（B 线）+ 2 AI | B 线真人能打自己的线；A 线 AI 推进；主机看不到 B 线牌桌但事件可见 |
| 4 真人 2+2 | 两边同时行动；`actingSeats` 两个座位；不会因为主机在 A 线导致 B 线不能提交 |
| 多人换牌（多选） | 批量确认在两条线都能提交（P0 修复后） |
| 三态"自动"反应 | 并行线的窗口按玩家设置自动通过（P0 修复后） |
| 观战/重连 | 观战有公开摘要；重连回到自己的线 |
| 回档 | 要么有两条线的检查点，要么 UI 明确禁用（P1） |

## 9. 结论

- **不会串线**：座位→线路由、视图投影、事件座位映射和行动校验都按座位隔离；主机和其他玩家不会看到/操作对方线的牌。
- **P0 已修（2026-10-29）**：自动代答、批量换牌、观战投影，以及**联机版本号**（容器/lane revision 不一致导致所有并行行动被判过期）已接线并有 Node 测试；`test:fast` 3944 / 3941 / 0 fail。
- **P1 也已完成两项**：并行关卡检查点/回档、换线权限（真人自助 + 房主仅 AI）。仍剩：AI `agentTurnKey/planning` 的 lane 上下文、事件 `presentation.tableState` 座位、迁移/体积。
- **建议**：现在可以按 §8 做"真人 × 并行"联机冒烟（重点盯回档、非房主换线、AI 长回合）；回档与自助换线这两项体验缺口修完前，不宣称并行联机完全等价单线。
