# EOTE P0 修复工作区（repair）

> 本目录是本轮 **P0 修复**（不是审计）的过程与验收记录。审计报告见上级目录 `全量扫描报告.md`；审计产物在各 area 目录。
> 工作根：`games/arkhamhorror/`。修复口径：**真实引擎路径可复现**（`content/registered.js` 生产组合根 + `src/engine/engine.js` 的 `createGameState/legalMoves/applyMove/advanceAgenda/advanceAct/performTest` 等），不以「测试变绿」或「条目声明存在」为完成证据。

## 0. 状态总表（由 Lead 汇总，逐步更新）

> 修复状态截至 2026-11-08 21:58：六组修复全部落地，P0-11 审计流水线根因修复与账本重建完成。
> 独立验收员（verifier）真实引擎套件最终结果：**P0-1..P0-13 全部 PASS（PASS 165 / FAIL 0，154 项断言 + 2 条实测记录，两次复跑一致，退出码 0）**；
> 账本层面 P0-11 按诚实口径重建：release=`failed`、migration=`pending`、all-cards=`pending`
> （248 verified / 12 simplified / 127 missing / 14 blocked），不构成行为等价认证（见 §6）。

| P0 | 内容 | 负责人 | 修复状态 | 独立验收 | 证据 |
| --- | --- | --- | --- | --- | --- |
| P0-1 | IDP I/II/III 剧本行动不在 legalMoves（actions/performAction 契约） | idp | 完成 | PASS | `campaign/a/_fix-idp-p0.mjs`；三章 behavior `actions/performAction` |
| P0-2 | IDP 幕/议程 reveal 未接线（agendaReveal/actReveal/checkObjectives） | idp | 完成 | PASS | 同上；`advanceAgenda` 推进 + 08518/19/20 背面真实效果 |
| P0-3 | IDP 混乱标记修正值为 0（resolveChaosToken）/ afterTest | idp | 完成 | PASS | 同上；真实 `performTest` delta 非 0 |
| P0-4 | EOTE 地点 shroud 未入数据 / 未探索地点入场费不收 | idp | 完成 | PASS | `card-data.js:38`；`beforeMove` 收费 + `moveError` 过滤 |
| P0-5 | Fatal Mirage 议程崩溃/版本索引/线索翻面/结算记录 | fatal-mirage | 完成 | PASS | `campaign/b/_fix-realpath.mjs` 93/93；`campaign/b/_fix-notes.md` |
| P0-6 | 古者之城钥匙无入口→幕 1 不可达；议程 2 背面 R2 | city-elder | 完成 | PASS | `campaign/c/_probe-city.mjs` 23/23；`campaign/c/city-fix.md` |
| P0-7 | Heart2 08672 doomThreshold=0、R1/R2 记录、08716 ReferenceError | heart-peaks | 完成 | PASS | `campaign/d/_fix-heart2.mjs` 5/5 |
| P0-8 | Peaks/City 专属诡计零结算（entryRevelation）、遭遇牌库、Peaks 支援/攀爬 | heart-peaks / city-elder | 完成 | PASS | `campaign/d/_fix-peaks.mjs` 14/14；City 见上 |
| P0-9 | 玩家卡真实路径失效（12 张） | player-cards | 完成 | PASS | `player-b/_fix-player-cards.mjs` 25/25（含修复前 FAIL 基线） |
| P0-10 | 调查员真实路径 bug（08013a/08006/08005/08004/08014a） | investigators | 完成 | PASS | `investigators/_fix-p0-10.mjs`；169/169 测试 |
| P0-11 | 审计流水线假绿根因 + EOTE 账本重建 | audit-pipeline | 完成 | PASS（8/8） | `verify/audit-fix.md`、重建后的 `audit/eote-*.json`、`verify/_phase-b-gates.json` |
| P0-12 | 古者之城地点动作 api.test 第 4 参 TypeError | city-elder | 完成 | PASS | `_probe-city.mjs` P0-12 段（真实 applyMove 无 TypeError） |
| P0-13 | Fatal Mirage 08549 混乱标记数值全 0 | fatal-mirage | 完成 | PASS | 真实 `performTest` delta：cultist -2 / tablet -3/-4 / elderthing -4/-5 |

## 1. 环境与基线

- 本机 `npm run` 不可用（`npm.ps1` 被执行策略禁用）；等价命令：`node tools/run-tests.mjs fast`、`node --test <files>`、`node tools/<tool>.mjs`。
- Node 子进程 spawn 正常（与审计报告 §1.4 记录的旧沙箱限制不同，当前 DSH 为 danger-full-access）。
- 修复前 `node tools/run-tests.mjs fast` 基线（2026-11-08 20:36 完成）：**6956 tests / 6947 pass / 6 fail / 3 skipped**。6 个失败：
  1. `P8 eote all-cards 两次构建一致且与账本一致`（P0-11 已知：investigators sha 漂移 + 假绿生成器）
  2. `已本地化的 UI 文件不再残留用户可见中文`（非 EOTE 本体，工作区既有）
  3. `TIC P8 replay 基线：逐局重放出相同逐步指纹`（审计报告 §1.4 记录的既有失败）
  4. `P1 账本：scope.json 与 audit/tcu-migration.json 可复算且 gate 一致`（TCU 既有）
  5. `P10 账本：schema/范围/三包/8 章/... 与真实数据复算一致`（TCU 既有）
  6. `P10 账本 --check 逐字节复算`（TCU 既有）
  完整日志：`../repair-baseline-fast.txt`。修复验收要求：不新增失败（EOTE all-cards 一项应由 P0-11 转为通过）。
- EOTE 专项测试：`npm run test:eote` 等价于 `node --test tests/eote-*.test.mjs tests/replay-eote-p8.test.mjs`（见 `package.json#scripts.test:eote`）。

## 2. 事故记录：src/engine/play-channels.js 编码损坏与恢复（2026-11-08 20:42–20:50）

- **现象**：20:42:32 后 `import('./src/engine/engine.js')` 抛 `SyntaxError: Illegal return statement`（文件 211 处 U+FFFD、换行被吞、注释行吞掉下一行代码），全部真实引擎探针与测试被阻塞约 8 分钟。
- **根因**：P0-10 负责 agent 用 PowerShell 文本管线改写文件：
  `(Get-Content src/engine/play-channels.js -Raw) -replace ... | Set-Content src/engine/play-channels.js -NoNewline`
  本机 `pwsh` 工具实为 **Windows PowerShell 5.1**（`$PSVersionTable.PSVersion = 5.1.26100.9711`），`Get-Content` 默认按 ANSI/GBK 解码无 BOM 的 UTF-8 文件；UTF-8 三字节字符与后续换行落入同一 GBK 双字节配对时被替换为 `?` 并吞掉换行，`Set-Content` 回写后文件不可逆损坏（局部）。
- **恢复**：两路独立重建交叉验证——
  1. Lead 从 `C:\Users\ASUS\.dsh\sessions\--G-boardgame-hall-ai--\*` 全部会话日志（zstd 多帧）提取损坏前对该文件的 read 工具结果，按行号合并（2026-11-08 20:41 首处 edit 之前、行号 1–976 无缺口）；
  2. investigators 从另一会话的完整 read 结果字节级还原；
  两者得到同一 sha256：`fd07f86cf15ab8003ad379b83d1e517b62066f5da46289e51238848367d96c6f`（47646 bytes / 976 行）。
  随后 investigators 用 Node `fs.copyFileSync` 恢复基线，再用 `edit` 工具重做 4 处预期改动；最终 `src/engine/play-channels.js` = 49591 bytes / 1001 行，sha256 `bba22574bc293a0540e4d0935fd13d41465d811a1b3d2a82ab963d33c63d981e`，0 个 U+FFFD，`node --check` 与 engine import 均通过。恢复过程不丢任何未提交改动（未使用 git restore）。
- **恢复证据**：`G:\boardgame-hall-ai\artifacts\recovery\`（重建脚本、`play-channels.baseline.js`、`edits.json`、`merge-report.json`、`reads-summary.json`）。
- **预防**：本轮所有 agent 已通知——**禁止用 PowerShell `Get-Content`/`Set-Content`/`-replace` 管线改写仓库文本文件**；统一使用 `read` / `write` / `edit` 工具或 Node `fs`（显式 UTF-8）。作为兜底，Lead 对 3 小时内修改过的 `src/ content/ tests/ tools/ web/` 文件做 UTF-8 全量校验（最终复检 108 个文本文件含 json/md，0 无效）。

## 3. 修复验收清单（最终需逐项附证据）

对每个 P0 至少需要：
1. 修复前**真实引擎复现**（FAIL）与修复后 PASS 的探针输出（探针保留在各 area 目录或 `verify/p0-accept/`）。
2. 对应 `file:line` 证据（实现点/引擎读点/测试）。
3. 对应测试文件更新或新增断言（不许用 api stub 直调 behavior 冒充真实路径）。
4. 全局门禁：`node tools/run-tests.mjs fast` 不新增失败；EOTE 专项测试全绿；索引重建后 `npm run cards:check` / `cards:encounter-check` 等价检查通过；审计账本见 P0-11。

## 4. 集成改动与全局门禁（Lead 执行，2026-11-08 21:00–21:56）

### 4.1 Lead 侧集成改动（已冻结）

| 改动 | 文件 | 说明 |
| --- | --- | --- |
| 架构守卫基线重锁 | `tests/architecture-guard.test.mjs` | behaviorLines 32330→**33734**；content 卡号字面量 1132→**1142**（含本轮 P0 修复注释；`CONTENT_BRANCH_BASELINE` 仍为 0） |
| EOTE 浏览器进度结局键 | `tests/eote-progression.browser.mjs:127` | IDP3 `victory`→`resolution1`（IDP3 按印刷改为 resolution1/resolution2 双结局） |
| EOTE replay 基线重采 | `tests/fixtures/replay/eote-p8-baseline.json` | 由 `repair/regen-eote-p8-baseline.mjs` 走真实大厅脚本重采（10 步/3 章，同 seed 两次一致）；原因=六组 P0 修复有意改变 state 指纹，属合法基线更新 |
| 卡牌索引重建 | `src/cards/entries/index.js`、`src/cards/encounter-entries/index.js` | `--write` 校验一致（914 张玩家卡 / 1573 条非玩家条目） |
| 能力覆盖产物重生成 | `audit/ability-coverage.json` 等 | `node tools/audit-abilities.mjs --write`；behaviorLines=33734 与新基线一致 |
| P8 发布文档诚实修订 | `docs/edgeOfTheEarth/p8-release.md` | 顶部新增 2026-11-08 P0 修复轮修订：P8 旧 verified 结论被独立扫描推翻，下方段落仅作历史记录 |
| UTF-8 兜底校验 | 3 小时内变更的 `src/ content/ tests/ tools/ web/` 文本文件 | 最终 108 文件（含 json/md）**0 个无效 UTF-8**（play-channels 事故后加的防回归检查） |

### 4.2 全局门禁实测

| 门禁 | 结果 |
| --- | --- |
| `node tools/run-tests.mjs fast`（最终，2026-11-08 21:57） | **6987 tests / 6979 pass / 5 fail / 3 skipped**；5 条失败全部是会话起始基线既有失败（见下）；**无新增失败**，且会话起始 6 条中的 `P8 eote all-cards 两次构建一致且与账本一致` 已由 P0-11 修复转绿。日志：`repair/final-fast.txt`；起始基线：`repair-baseline-fast.txt`（6956/6947/6） |
| 5 条既有失败（按标题冻结在 `audit/eote-baseline.json#fastFailures`） | P10 账本 ×2、TIC P8 replay、TCU 迁移账本漂移（含本轮已批准的 `src/campaign/campaign.js` 08059 哈希；不重签其他循环账本）、i18n `web/music-player.js` 音乐 mood 中文（均非 EOTE 本轮引入） |
| `node tools/replay-fixtures.mjs --check`（非 EOTE golden replay） | 13/13 局逐步指纹一致（**replay 零漂移**） |
| 全量 EOTE Node（`node --experimental-test-isolation=none --test tests/eote-*.test.mjs tests/replay-eote-p8.test.mjs`） | **508/508 pass** |
| `node tools/verify-eote.mjs --node` | **506/506 pass、sourceStable=true**（`audit/eote-node-acceptance.json#status=passed`） |
| `node tools/verify-eote.mjs --regression` | **passed**：replay matches、fast 5 条既有失败、**additions=[]**（`audit/eote-regression.json#status=passed`） |
| 审计门禁（15 项） | **12 项 exit 0**；all-cards/release/migration 的 `--check` 为「账本逐字节一致但**诚实未通过**」exit 1（见 §6）。证据：`verify/_phase-b-gates.json` |
| `node --test tests/architecture-guard.test.mjs` | 18/18 pass |
| `node --test tests/eote-all-cards.test.mjs tests/eote-migration-ledger.test.mjs tests/eote-migration.test.mjs` | 18/18 pass |

## 5. 独立验收（verifier，不修改 mod 实现）

- 套件：`docs/edgeOfTheEarth/eote-scan/verify/p0-accept/run.mjs`（生产组合根 `tests/eote-p8-fixture.mjs` 真实引擎路径：`createGameState/legalMoves/applyMove/advanceAgenda/advanceAct/checkAgenda/真实 performTest/真实遭遇抽取`）。
- 复现：`node docs/edgeOfTheEarth/eote-scan/verify/p0-accept/run.mjs --ledger-check`（约 27s）。
- 最终结果：**PASS 165 / FAIL 0**（154 项断言 + 2 条实测记录；两次相同运行 case/check 状态一致，deterministic=true；含 7 项显式反向断言，例如「IDP1 调查员不同地点时 campResign 必须消失」「City 地点有线索时 claim 非法」「FM 0 线索无可执行翻面」「08006 无锁时 searchDeck 正常」「08091 无卡时不替换」）。
- 逐项：**P0-1..P0-13 全部 PASS**（P0-11 8/8：scenario-ledger 假证据 129→0、章卡池不再全 264、账本可追溯性、等价认证诚实降级等）。
- 报告：`verify/p0-accept/report.md`（含 PASS/FAIL/近似披露/残余风险四类与证据 file:line）、`verify/p0-accept/results.json`。
- verifier 另行独立复跑 owner 探针（不采信 owner 结论）：`campaign/a/_fix-idp-p0.mjs` PASS、`campaign/b/_fix-realpath.mjs` 93/93、`campaign/c/_probe-city.mjs` 23/23、`campaign/d/_fix-heart2.mjs` 5/5、`campaign/d/_fix-peaks.mjs` 14/14、`investigators/_fix-p0-10.mjs` exit 0、`player-b/_fix-player-cards.mjs` 25/25，与套件结论无冲突。

## 6. 诚实降级与残余风险（不得视为已消除）

P0-11 修复后账本不再假绿，但**不等于行为等价认证**：

| 账本 | 重建后状态 |
| --- | --- |
| `audit/eote-all-card-acceptance.json` | **pending**：verified 248 / simplified 12 / no-behavior 2 / **missing 127 / blocked 14**；262 条 evidence 全部可追溯、invalid=0（旧 129 条 scenario-ledger 假证据清账） |
| `audit/eote-scenario-acceptance.json` | **verified 8/8**（章卡池 39/55/39/94/42/50/39/43，旧 8×264 相同；cardCoverageAssigned 15312→401） |
| `audit/eote-player-acceptance.json` | **verified 115/115 + simplified 54 条逐条披露**（`noSimplified` 空门禁已删除；verified=有逐卡测试证据≠印刷等价） |
| `audit/eote-investigators.json` | **verified**（9/9 checks；sha 漂移重签） |
| `audit/eote-release-acceptance.json` | **failed**（missing=`allCards`；`equivalence.certified=false` + `independentAudit`） |
| `audit/eote-migration.json` | **pending**（gates 17/19；remaining=`gate:allCards`、`gate:releaseAcceptance`；`releaseAcceptance.equivalenceCertified=false`） |

残余风险（如实披露）：
1. **141 张卡无逐卡可追溯证据**（127 missing + 14 blocked）→ release 等价未认证；章节测试「不按卡号逐卡断言」的覆盖问题仍需下一轮真实引擎路径 + 逐卡断言，禁止回填假证据。
2. 14 张 blocked 卡依赖 pending P7 原语请求（`releaseAcceptance.deferred` 28→36，含 p7-08544/08546/08560/08587/08673/08679/08681/08682）。
3. 玩家卡 54 张自述近似（含本轮 P0-9 中 08028 事件附敌、08074 criteria 私有读点、08130/08131 行动类型窗口、08074/08614–08620 的引擎原语缺口等，均已在条目 note/behavior 披露）。
4. R1 直写基线 149→164（检测补漏，非新增债务）：含 08008 `whip.exhausted` 等，需下一轮用原语替换。
5. 非 EOTE 5 条既有失败按标题冻结（不重签其他循环账本）；TCU 迁移账本漂移包含本轮已批准的 08059 `src/campaign/campaign.js` 声明式改动，其账本由 TCU 循环自行处理。
6. 本轮未修的非 P0 规则（扫描报告中的 P1/P2）：IDP2 setup 三项近似、08547/08548 非 P0 规则、Fatal Mirage 其余 high（条目 flags/forced/reaction 等）、City v3 伙伴投票入口、Peaks 08614/08615/08618/08619 四项近似、玩家/调查员 M 级残留项，均已在各 area notes 与原报告登记，留待后续轮次。
7. P8 旧账本「verified」结论已被独立复核推翻（135/403 字面不可追溯、129 条 scenario-ledger 系统性错配、noSimplified 空门禁）；新账本只证明「248 有证据 / 54 披露近似 / 141 待补证据」，不构成行为等价认证。

## 7. 证据与变更索引

- 逐 area 探针与证据：`eote-scan/campaign/{a,b,c,d}/_fix-*.mjs`、`eote-scan/player-a|player-b/_fix-player-cards.mjs`、`eote-scan/investigators/_fix-p0-10.mjs`；独立验收集：`eote-scan/verify/p0-accept/`。
- 分 area 说明：`campaign/a`（idp 探针）、`campaign/b/_fix-notes.md`、`campaign/c/city-fix.md`、`campaign/d/_fix-*`、`player-b/_fix-player-cards-*.txt`、`investigators/_fix-p0-10.*.txt`。
- 审计重建：`eote-scan/verify/audit-fix.md`、`_ledger-before-phase-b.json`、`_ledger-after-phase-b.json`、`_phase-b-gates.json`、`_allcards-fix-probe.json`、`_r1-detect-probe.json`。
- 修改文件（本轮涉及，均为工作区未提交改动，未 git commit）：
  - 引擎：`src/engine/{play-channels,tests,deck-ops,api-misc,api-test,eote-investigator-support,restricted-actions,turn}.js` 等（按各任务写入范围；恢复后的 `play-channels.js` sha256 `bba22574…981e`）；
  - 内容：`content/campaigns/edgeOfTheEarth/{card-data.js, scenarios/*8 章 definition/behavior/chaos/index, shared...}`；
  - 条目：`src/cards/entries/08004/08005/08006/08013a/08014a/08028/08053/08058/08059/08074/08083/08091/08102/08105/08107/08130/08131.js`、`src/cards/encounter-entries/edgeOfTheEarth/**`（08607–08620、08716 等）；
  - 工具/账本：`tools/audit-eote-*.mjs`、`tools/audit-card-entry-compliance.mjs`、`audit/eote-*.json`、`audit/card-entry-compliance.json`；
  - 测试/基线：8 个章节测试、5 个调查员测试、4 个玩家卡测试、`tests/eote-all-cards.test.mjs`、`tests/eote-migration-ledger.test.mjs`、`tests/architecture-guard.test.mjs`、`tests/eote-progression.browser.mjs`、`tests/fixtures/replay/eote-p8-baseline.json`；
  - 文档：本文件、`docs/edgeOfTheEarth/p8-release.md`、`eote-scan/verify/**`。

