# EOTE 扫描：测试与门禁基线（Lead，2026-11-08）

## 1. EOTE 专项 Node 测试实跑（in-process）

命令（沙箱禁用 spawn，采用 isolation=none 单进程）：

```bash
cd G:\boardgame-hall-ai\games\arkhamhorror
node --experimental-test-isolation=none --test tests/eote-*.test.mjs tests/replay-eote-p8.test.mjs
```

结果：**477 tests / 474 pass / 3 fail / 0 skipped**，耗时 ~82s。

### 3 个失败逐条定性

| # | 测试 | 定性 | 证据 |
| --- | --- | --- | --- |
| 1 | `P8 eote all-cards 两次构建一致且与账本一致`（tests/eote-all-cards.test.mjs:119） | **真实账本漂移（非环境）**：复算 all-cards 账本与 `audit/eote-all-card-acceptance.json` 仅 `sources.ledgers[1].sha256` 不同（`audit/eote-investigators.json` 当前 sha=`aadf6fb3…`，账本记录 `ee80f9ed…`）。即 `audit/eote-investigators.json` 在 P8 账本生成后被改动，导致 P8 逐卡账本 `--check` 不可复算。 | `node games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/tools/diff-allcards.mjs` 输出 diff count=1；两次构建 summary 完全一致 |
| 2 | `P7 story 生成物确定性：--check 通过…`（tests/eote-story.test.mjs:253） | **沙箱环境伪失败**：测试内 `spawnSync(node tools/import-eote-story.mjs --check)` 在管道沙箱下 EPERM，`result.status` 为 null，与期望 0 不等。 | tests/eote-story.test.mjs:262-263；沙箱 spawn EPERM 已知 |
| 3 | `P7 guides 幂等：…verify 退出 0`（tests/eote-story.test.mjs:388） | **沙箱环境伪失败**：同上，line 398 `spawnSync(node tools/import-scenario-guides.mjs)` EPERM，status null。 | tests/eote-story.test.mjs:398-399 |

> 结论：EOTE 专项 477 用例中真实失败 1 条（P8 逐卡账本 drift），实际行为测试 474 条全绿。既有 P8 账本声称 475/475——当前用例数已变为 477（测试在 P8 后新增/改动），且 all-cards `--check` 当前会失败。

## 2. 只读门禁工具复算（不 spawn，可运行）

| 命令 | 结果 |
| --- | --- |
| `node tools/audit-card-entry-compliance.mjs --check` | exit 0（无基线外 R1/R2/R3） |
| `node tools/audit-dead-primitives.mjs --check` | exit 0（无死分支） |
| `node tools/scan-eote-mechanisms.mjs --check` | exit 0（复算一致） |
| `node tools/scan-eote-scope.mjs --check` | exit 0（复算一致） |
| `node tools/audit-eote.mjs --check` | exit 0（migration verified） |
| `node tools/audit-eote-scenarios.mjs --check` | **无法运行**（内部 spawn 章节测试 → EPERM） |
| `node tools/audit-eote-all-cards.mjs --check` | **无法运行**（内部 spawn 测试 → EPERM）；已用 diff 脚本手工复算，见上 |
| `node tools/audit-eote-player/investigators/rules/interactions/release --check` | 未运行（依赖 spawn 或需逐项评估） |

## 3. 手工复算 P8 逐卡账本差异

`games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/tools/diff-allcards.mjs`：复算结果与 `audit/eote-all-card-acceptance.json` 差异仅 1 处（investigators 账本 sha）；400/403 条记录、gates、summary、sources 其它字段全部一致。

## 4. 复现

```bash
cd G:\boardgame-hall-ai\games\arkhamhorror
node --experimental-test-isolation=none --test tests/eote-*.test.mjs tests/replay-eote-p8.test.mjs   # 需约 82s
cd G:\boardgame-hall-ai && node games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/tools/diff-allcards.mjs
```
