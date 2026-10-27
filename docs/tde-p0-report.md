# 《食梦者》P0 收尾报告：前置清理、规范勘误、基线重锁与 D8-C 风险验证边界

> **状态口径**：P0 收尾（2026-10-27）。本文只记录实测、处置与决策，**不声明** TDE 已实现、已可玩或规则等价；
> TDE 仍为 `catalog-only`。路线图见 [`tde-migration-roadmap.md`](./tde-migration-roadmap.md) §13。
> 证据分为两类：**可复算的 `--check` 输出**（§2、§4、§5）与本机运行目录里的快照（`artifacts/migration/tde/reports/`，不签入）。
> 运行目录路径均相对 `games/arkhamhorror/`。

## 1. 一页结论

| 项 | 结论 |
| --- | --- |
| P0 任务 1 规范勘误 | ✅ 完成：迁移规范 4 处（卡图路径、基线示例数字、既有失败口径、`.gitignore` 写法），见 §3 |
| P0 任务 2 文档链接基线 | ✅ 完成：`docs:check` **43 文件 / 359 链接全通过**（P0 前为 22/61，因 9 篇 TCU 文档被删被动变少），见 §4 |
| P0 任务 3 TCU 账本漂移 | ✅ 完成：根因是 9 篇 TCU 文档被误删；恢复后重算，四项 TCU 检查 **4/4 通过**，见 §2.3、§5 |
| P0 任务 4 基线重锁 | ✅ 完成：replay **13 局 / 786 步 / 799 指纹**（与 golden 逐条一致）、fast **3607 tests / 0 fail**、git HEAD `421be47` 落盘，见 §5 |
| P0 任务 5 artifacts 白名单 | ✅ 完成：TDE 只放行 4 个复算输入，`git check-ignore` 逐条验证，见 §6 |
| P0 的 D8-C 部分 | ✅⚠️ 协议级完成 + adapter 级延后：合成双 lane 夹具跑通**七项门禁 7/7**（`develop/tde-dual-lane-spike*.mjs`，含 2 次变异校验）；真实 lane adapter 按依赖「9←8」随 P3 骨架执行，D8-C 文件/行/测试数仍记 **TBD**，见 §7 |
| 两处事实修正 | ① 路线图引用的 `artifacts/migration/tde/recon/**` **在仓库与 git 历史中都不存在**；② TCU 文档删除发生在 HEAD 提交 `421be47`（不只是一次旧清理），见 §2.2、§2.3 |

## 2. P0 开始时的事实清点

### 2.1 基线漂移：路线图写的 HEAD ≠ 现行 HEAD

- 路线图起草时记录 `git rev-parse HEAD = e0dc5bd`；P0 实测 HEAD 为 **`421be4777b81c9cd0e5eda63843fd5b2adc6b7d9`**（提交「五循环计划」）。
- P0 开工时工作树有 **34 个已修改文件**（TCU/TFA 账本、`content/packs/*`、`content/registry.js`、`tests/*`、`tools/audit-{tcu,tfa}.mjs` 等），
  均非 TDE 产生；逐条清单见 `reports/baseline-git-status-pre-p0.txt`，与 P0 改动分开归因（`reports/baseline.md` §4）。
- 处置：P0 不追认 `e0dc5bd` 为现行基线，按 `421be47` + 工作树实际状态重锁（`reports/baseline.md` §1）。

### 2.2 初勘产物缺失：路线图的 `recon/**` 不在仓库里

- 路线图头部与 §1.5 把 `artifacts/migration/tde/recon/{scope,mechanism,baseline,fullmode,story-gap}/**` 列为数据来源，
  但 P0 实测：**该目录不存在**，`git log --all -- artifacts/migration/tde` 为空（从未签入，也没有被忽略的残留）。
- 影响：初勘数字（38 条机制、21 个原语候选、9 条 escape、147,718 净需译字符、388/352/36 记录分区……）**目前没有可复算来源**。
  它们与本文、与路线图里的「初勘」措辞都只能当**历史口径**，直到 P1 `scan:tde:scope --write` 与 P2 `scan:tde` 重新生成。
- 处置：不改写路线图里的初勘数字（它们是待复核的历史输入），但在头部加「P0 核实」注记，并在 §1.5 标明「以 P1 工具实测为准」。

### 2.3 TCU 三本账本漂移：根因是文档被误删，不是代码漂移

P0 开工实测四项 TCU 检查：

| 检查 | 结果 |
| --- | --- |
| `node tools/audit-tcu.mjs --check` | ✅ `audit 复算一致：P10，关键词 16/16，规则书 verified，gate pass` |
| `node tools/audit-tcu-scenarios.mjs --check` | ✅ `P8 scenario ledger OK: 9/9 章节有 node 证据；0 张遭遇卡待实现；93 条 remaining` |
| `node tools/scan-tcu-scope.mjs --check` | ✅ `scope 复算一致：377 条记录，三包 237/19/87，21 个遭遇组` |
| `node tools/audit-tcu-primitives.mjs --check` | ❌ `primitive-plan.json 与代码不一致` + `primitive-catalog.json 与代码不一致` |

定位过程（可复现）：

1. `--write` 重算后 14 个原语全部落到 `pending`，`mechanismsCovered` 从 20 掉到 1 —— 不是「哈希漂移」，是**证据文件缺失**。
2. 逐条打印 `blockers`：14 条全部是 `文件缺失：docs/tcu-primitives.md`（hunchDeck 为 `docs/tcu-investigators.md`）。
3. `git log --diff-filter=D -- docs/*.md` 定位删除者：**HEAD `421be47` 删了 `docs/tcu-investigators.md`、`docs/tcu-primitives.md`**；
   更早的 `676f33b` 删了另外 7 篇（`tcu-{interactions,migration-roadmap,player-cards,release,rules,scenarios,story}.md`）。
4. 恢复：`git checkout 421be47^ -- docs/tcu-investigators.md docs/tcu-primitives.md` +
   `git checkout 676f33b^ -- <其余 7 篇>`；再 `--write` 重算。
5. 重算 diff 只有 `content/registry.js` 的 sha256（`7e09465…` → `0c83a33…`，工作树既有改动），`--check` 转绿：
   `primitive-plan/catalog 复算一致 · new 14/14 done · gate pass`。

遗留（记入 TCU 待办，不阻塞 TDE）：恢复的 9 篇是删除前最后版本，内容停在 TCU 收官时点；
`docs/tcu-migration-roadmap.md` 仍写 「`gate.pass=false`」，与当前账本（gate pass）不一致，需要 TCU 文档复算时一并修订。

## 3. 规范勘误（`docs/arkham-content-migration.md`）

| # | 位置 | 原文（错） | 修正 | 依据 |
| ---: | --- | --- | --- | --- |
| 1 | §1 权威来源 | 卡图路径 `web/img/arkham/cards/`、`web/img/arkham/zh/cards/` | `web/img/cards/`、`web/img/zh/cards/`（相对 `games/arkhamhorror/`），并写明远程回退字段 `imagesrc`／`backimagesrc` | 实测目录：卡图在 `web/img/{,zh/}cards/`；`.gitignore` 也按该路径忽略 |
| 2 | §4.1 门禁 | 「基线 10 局 / 529 步通过」 | 以 `--baseline` 实测写入 `replay-before.json` 的值为准，**不在文档里手写**；注明 TDE P0 实测 13 局 / 786 步 / 799 指纹 | P0 实跑结果与 `tests/fixtures/replay/golden-replays.json` 一致 |
| 3 | §4.6.8 批次验收 | 「`test:fast` 无新增失败（既有 7 条除外）」 | 既有失败以 `artifacts/migration/<cycle>/reports/baseline.md` 为准，未记录按 0 条计；注明 TDE P0 实测 0 条 | P0 实测 fast 0 fail；「7 条」是旧循环的历史数字 |
| 4 | §3 运行目录 | 只有「逐文件白名单」原则，无写法 | 补 `.gitignore` 逐级取反的实际写法 + `git check-ignore -v` 验证要求 | 对应路线图 §10.2 第 10 条的「同步勘误迁移规范」 |

> R9 列的「三处过期/错误」已全部改完；第 4 处是 §10.2 第 10 条要求的同一批勘误，一并落地。
> `docs/card-entry-files.md` §7.1 里的「10 局 / 529 步」是 2026-10-22 拆分当时的**历史证据**，不是门禁口径，本次不改写。

## 4. 文档链接基线

- P0 开始时：`docs:check` = **22 文件 / 61 链接**——数字偏小是因为 9 篇 TCU 文档被删，链接随之消失，属于「被动通过」。
- 恢复 9 篇后：**43 文件 / 359 链接全部可解析**，exit 0（含本次新增的 `docs/tde-p0-report.md`）。
- 后续要求：新增文档不得回归；`audit/baseline.json` 里的 `docLinks` 仍是旧值（36 文件 / 288 链接），
  按路线图 R4 记为「待重采」，不属于 P0 范围（重采要连 `test:fast` 一起跑完整 `audit/baseline.mjs --write`）。

## 5. 基线重锁（任务 4）

| 项 | 命令 | 实测结果 | 证据文件 |
| --- | --- | --- | --- |
| replay 基线 | `node tools/replay-fixtures.mjs --baseline artifacts/migration/tde/replay-before.json` | 13 局 / 786 步 / 799 指纹；`id` 与 `hashes` 和 golden 逐条一致；规则 `n6.0`、schema 7、hashVersion 2 | `reports/replay-before.json`（217 KB，忽略） |
| fast 失败集合 | `node tools/run-tests.mjs fast` | 3607 tests / 3604 pass / 3 skipped / **0 fail**，exit 0 | `reports/baseline-fast-final.log` |
| git HEAD | `git rev-parse HEAD` | `421be477…` | `reports/baseline-git-head.txt` |
| git 状态 | `git status --porcelain` | 开工前 34 项 / P0 收尾 46 项 | `reports/baseline-git-status{,-pre-p0}.txt` |
| 既有失败 | `audit-p6 --check`、`audit-carcosa-player` | 2 条既有红（`p6-behavior-ledger.json` 漂移、`carcosa-player-acceptance.json` stale），非 TDE 产生 | `reports/baseline.md` §2 |

口径：P1 起每个阶段用 `--compare` 证明 13 局零漂移，**禁止**用 `--baseline` 覆盖本次基线。

## 6. artifacts 白名单（任务 5）

`.gitignore` 新增 TDE 块（放在 TCU 块之后），只放行 4 个复算输入：

```gitignore
!artifacts/migration/tde/
artifacts/migration/tde/*
!artifacts/migration/tde/scope.json
!artifacts/migration/tde/mechanism-scan.json
!artifacts/migration/tde/primitive-plan.json
!artifacts/migration/tde/primitive-catalog.json
```

`git check-ignore` 实测：

| 路径 | 结果 |
| --- | --- |
| `artifacts/migration/tde/scope.json`（其余 3 个同） | 可跟踪（`git status` 显示 `??`） |
| `artifacts/migration/tde/replay-before.json` | 忽略 |
| `artifacts/migration/tde/reports/{baseline.md,x.log}` | 忽略 |
| `artifacts/migration/tde/workers/w.json`、`primitive-requests/r.json`、`recon/scope/scope-draft.json` | 忽略 |

TCU 仍是整目录放开的旧写法（`!artifacts/migration/tcu/`），本次不动，避免影响已签入的 TCU 过程文件；TDE 起按逐文件白名单。

## 7. D8-C 风险验证：本轮做到哪一步，为什么

### 7.1 依赖裁定

路线图内部有两处口径：§2 的 P0 行把「D8-C lane adapter + 并发提交 spike 与独立估算」列进 P0；
§13 的任务 9（D8-C P0 spike）依赖任务 8（P3 双战役骨架）。本报告裁定按 §13 的依赖执行：

- **lane adapter 必须坐在容器与 `roomSeat↔laneSeat` 映射之上**。先做 adapter 等于把 WP-1 的模型再写一遍，P3 骨架落地后必然返工。
- P0 因此交付「可以在 P3 之后立即执行」的四件套：**协议级双 lane 夹具（七门禁 7/7 通过）+ 门禁断言清单 + 适配面盘点 + 估算口径**（本节）。
- 路线图 §2 的 P0 行已加注说明；D8-C 的文件/行/测试数继续记 **TBD**，不得用 `pick` 的 34 文件 / 1,900–3,100 行代替。

### 7.2 七项确定性并发门禁（照 §7.5.2；本轮已在协议级全部跑通）

| # | 门禁 | 断言形态 | 协议级状态（2026-10-27） |
| ---: | --- | --- | --- |
| 1 | 跨线并发提交不丢更新 | 同一全局 revision 下 A/B 各提交一次 → 两次都生效，全局 revision +2，两线 `laneRevision` 各 +1 | ✅ G1 |
| 2 | 同线旧版本拒绝 | 目标线 `laneRevision` 已变 → `STALE_REVISION`；全局版本过期但目标线未变 → 允许安全重基 | ✅ G2 |
| 3 | AI 反向返回不覆盖 | 两线 AI 请求按反序返回 → 结果带创建时 `laneRevision`，过期结果丢弃 | ✅ G3 |
| 4 | 两线同时结算只跑一次幕间 | 同一 `pairId` 两侧结算 → 幕间只执行一次；重放/重连/重启幂等 | ✅ G4 |
| 5 | 保存失败不回成功 | 单文件保存抛错 → 命令失败、`session` 不替换；重试后幕间仍只有一次 | ✅ G5 |
| 6 | 重启恢复不重复幕间 | 从 `awaitingPair` 恢复 → 只补另一线；从已封对恢复 → no-op | ✅ G6 |
| 7 | 另一线事件/演出不可见 | 观察者属 A 线 → `viewState`/`viewEvents` 不含 B 线 move、结算摘要；非连续房间座位映射正确 | ✅ G7 |

### 7.3 适配面盘点（本轮实测，作为估算输入）

| 面 | 规模 | 说明 |
| --- | --- | --- |
| Mod 入口（`index.js`） | **393 行，65 个键、40 个函数** | 需要 lane 包装的有状态入口：`createState`、`validateMove`、`applyMove`、`legalMoves`、`decisionSeat`、`actingSeats`、`seatLocalMove`、`decisionSeed`、`moveCost`、`describeState`、`viewState`、`viewEvents`、`staticTables`、`commitChoiceBatch`、`createSessionCheckpoint`、`checkpointView`、`migrateSessionCheckpoints`、`forkSessionCheckpoint`、`saveSummary`、`actionsRemaining`、`validateAgentMove`、`agentFallback`、`autoChoice`、`autoPassChoice` 等（约 25 个） |
| 大厅（`lib/server.js`） | **2,906 行**；`revision` 128 处、`busy` 66 处、`SESSION_BUSY` 14 处、`STALE_REVISION` 5 处 | 这些是「按线加锁 + 双版本」的真实改动面，不是三处开关 |
| Mod 侧 revision 读点 | 55 行（`src/`、`content/`、`web/`） | 存档指纹、观察投影、AI 上下文都直接读 `state.revision` |
| 章内账本读点 | `campaign.records` 179 行、`chaosBag` 191 行 | 行数含读与写，**不等于**路线图早期口径的「194 / 75 个读点」；按线解析的范围以此盘点为准 |
| 保存/发布 | `snapshotSession` 保存队列、`flushPublish` 发布通道、`buildSessionView` 逐席位视图 | 单文件保存串行化 + 按线事件投影都落在这三处 |

### 7.4 估算口径（P3 之后填数）

- 文件/行数：按 WP-8 的七块（容器、lane adapter、双版本、事件 lane、投影/checkpoint、保存串行化、schema 迁移）分别计数，主进程与子进程分开；
  本轮协议夹具（337 行）只能作为「容器 + 双版本 + 屏障 + 保存串行化」四块的**下限参考**，不含 adapter 与大厅接线。
- 测试数：七项门禁各 ≥1 例 + 2+2 / 1+1 / 2+1 座位矩阵 + 并发/保存/恢复三类故障注入。
- 只有在**真实引擎的合成双 lane 夹具**（P3 骨架 + adapter）跑通七项门禁之后，才允许把 D8-C 从 TBD 改成区间估算，
  并回填路线图 §7.3 / §12 R15。本轮协议级 7/7 只解除「协议不可写」这一风险，不等于 adapter 级可报价。

### 7.5 协议级 harness 实测（本轮新增，`develop/`，不参与 test tier）

| 项 | 事实 |
| --- | --- |
| 位置 | `develop/tde-dual-lane-spike.mjs`（夹具，176 行）+ `develop/tde-dual-lane-spike.check.mjs`（七门禁，161 行） |
| 运行 | `node develop/tde-dual-lane-spike.check.mjs` → `7/7 gates pass · PASS`；`--json` 输出结构化结果 |
| 结果 | `artifacts/migration/tde/reports/dual-lane-spike.json`（5.3 KB，忽略） |
| 覆盖 | 容器 `shared + lanes.A/B`、全局 `revision` + 线内 `laneRevision`、串行提交链、单文件保存队列与失败注入、`awaitingPair` 屏障与 `interludeApplied` 幂等、按线观察投影、`roomSeat↔laneSeat`（含 `['B','A','B','A']` 非连续） |
| 变异校验（证明断言有牙） | ① 删掉 `laneRevision` 校验 → **G2 变红**；② 删掉重复结算 guard → **G4 变红**；两次变异后均恢复原文件并重跑 7/7 |
| 不覆盖（留给 WP-8） | 真实 `engine.*` 调用、`lib/server.js` 的 `busy`/`SESSION_BUSY`/保存管线接线、`presentation.tableState` 与演出快照、checkpoint 压缩、schema 迁移、AI runner 调度 |

## 8. P0 之后仍未开始（§13 其余项，按依赖排序）

| §13 # | 任务 | 状态 / 依赖 |
| ---: | --- | --- |
| 6 | `tools/scan-tde-scope.mjs` + `scope.json`（P1） | 未开始；依赖 P0 任务 1/4/5（已完成） |
| 7 | `tools/scan-tde-mechanisms.mjs` + `mechanism-scan.json`（P2） | 未开始；依赖 6 |
| 8 | 双战役骨架 `campaign-parts` + 合成两 part 夹具（P3） | 未开始；依赖 7；也是 D8-C adapter 的前置 |
| 9 | D8-C spike + 独立估算 | 协议级 7/7 已完成（§7.5）；adapter 级与估算在 P3 骨架之后 |
| 10 | 分线座位矩阵夹具（2+2 / 2+1 / 1+1 × 四种模式） | 未开始；依赖 8（`parallel` 部分依赖 9） |
| 11 | 8 篇卫星文档骨架 | ✅ 2026-10-27 已建（8 篇 `draft`，见路线图 §10.3 表）；**必须在 `plan:tde:primitives` 之前**（TCU 教训见 §2.3：文档缺失会让原语全部 pending） |
| 12 | 06 段图片库存扫描（初勘称缺图 387 条，待复核） | 未开始 |
| 13 / 14 | 剧情自译批 00（术语表 + 来源锁）/ 批 01（序章） | 未开始；依赖 1/4/5（已完成） |

## 9. 复现命令（P0 证据）

```powershell
cd games/arkhamhorror
git rev-parse HEAD
git status --porcelain
node tools/check-doc-links.mjs
node tools/replay-fixtures.mjs --baseline artifacts/migration/tde/replay-before.json
node tools/run-tests.mjs fast
node tools/audit-tcu.mjs --check
node tools/audit-tcu-scenarios.mjs --check
node tools/audit-tcu-primitives.mjs --check
node tools/scan-tcu-scope.mjs --check
git check-ignore -v --no-index artifacts/migration/tde/scope.json
```

## 10. 待办与风险

| # | 项 | 影响 | 处置 |
| ---: | --- | --- | --- |
| 1 | `artifacts/migration/tde/recon/**` 缺失 | 初勘数字不可复算 | P1/P2 工具重算后回填；路线图已加注记 |
| 2 | `audit/baseline.json` 旧口径（36/288、3567 tests） | 全局 `baseline:check` 不能直接全绿 | R4 待重采；TDE 门禁不依赖 |
| 3 | TCU 9 篇文档内容停在收官时点 | 文档与账本局部不一致 | TCU 文档复算时修订；不阻塞 TDE |
| 4 | D8-C 无 file/line/test 估算 | `parallel` 不能报价 | P3 骨架后跑 spike，见 §7 |
| 5 | P0 未跑浏览器/展示素材 | 不在 P0 门禁内 | P4/P5 起按 §11.2 补 |
