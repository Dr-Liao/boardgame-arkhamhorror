# P7 合并前的基线快照（2026-10-24）

本文件记录 P7（M2 玩家卡）开工前的仓库状态，用于区分「本轮新增失败」与「既有失败」。

## 1. 基线命令与结果

| 项 | 命令 | 结果 |
| --- | --- | --- |
| fast 回归 | `node tools/run-tests.mjs fast` | **2508 pass / 4 fail**（tests 2512） |
| replay | `node tools/replay-fixtures.mjs --baseline artifacts/migration/tcu/replay-before.json` | 13 局 / 786 步，已写基线 |
| TCU 审计 | `node tools/audit-tcu.mjs --check` | **失败**：`verifiedScope, confirmations, evidence, remaining, gate` 与内容不一致（P6 后内容仍有未提交/未重算改动；P7 收尾会 `--write` 重算） |
| git HEAD | `git rev-parse HEAD` | 见 `baseline-git-head.txt` |
| git 未提交改动 | `git status --short` | 见 `baseline-git-status.txt` |

## 2. 既有 4 例 fast 失败（不得新增；P7 收尾时逐条复核是否变化）

1. `幕间奖励的剧情支援在关卡开始时带上槽位定义（02040 画在盟友槽，而不是其他资产）`
2. `旧存档的卡牌展示表会补上米奇·布朗的受限盟友槽字段`
3. `分层清单与 node-suite 一致，且磁盘上每个用例都归属唯一的 tier`
   —— 原因：磁盘上有 3 个既有测试文件未登记进 `tests/suites.mjs` / `tests/node-suite.mjs`：
   `hall-static.test.mjs`、`view-shared-state.test.mjs`、`view-static.test.mjs`（P7 之前就存在，不在本任务范围；
   P7 新增的 5 个测试文件必须登记一致，不得扩大该失败）。
4. `P1 账本：scope.json 与 audit/tcu-migration.json 可复算且 gate 一致`
   —— 原因：`audit/tcu-migration.json` 是 P6 生成的冻结账本，其后内容/证据有变化。
   P7 会重跑 `scan:tcu:scope --write` 与 `audit:tcu --write`，预期该条转为通过；若仍失败按新增失败处理。

## 3. 开工前已存在、非 P7 产生的未提交改动

`games/arkhamhorror` 工作区在本轮开工前已有未提交改动（engine/web/tests/audit 等 20 个文件，
见 `baseline-git-status.txt`）。它们不属于 P7，不得计入 P7 的新增失败；P7 的 diff 审阅以此快照为界。

## 4. 既有失败判定口径

P7 收尾时 `node tools/run-tests.mjs fast` 的失败集合必须 ⊆ 上述第 2 节的既有失败集合（第 3、4 条预期被 P7 修复），
新增失败数必须为 0。任何新增失败按 worker/文件归因返工。
