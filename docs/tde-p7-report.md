# P7（M2 玩家卡）收尾报告

> 阶段：P7 / M2「玩家卡」；日期：2026-10-31。
> 状态：**87 条玩家包记录全部实现并逐卡验收**（4 个分片，22/22/22/21）；72 张可入牌组、15 张只作依赖（11 张场外绑定卡/绑定弱点 + 4 张基础弱点）。
> 逐卡账本 [`audit/tde-player-acceptance.json`](../audit/tde-player-acceptance.json)：87/87 verified、0 pending、0 blocked、**57 张显式简化**、101 例逐卡证据；
> 生成物 [`src/cards/tde-player-acceptance.js`](../src/cards/tde-player-acceptance.js) 由 `--write`/`--check` 逐字节复算。
> 手册：[`tde-player-cards.md`](./tde-player-cards.md)。命令：`npm run test:tde:player` / `audit:tde:player` / `report:tde:player`。

## 1. 范围与不做什么

- **做**：87 条 `tdePlayer` 记录的逐卡行为（一卡一文件）、4 个分片测试、逐卡账本与生成物、包清单/可用性/构筑与升级池接线、Myriad 与 Researched 两个关键词的构筑/升级读点、Myriad 构筑界面 n/3 读数、worker/原语队列报告。
- **不做**：TDE 战役注册进 `content/registered.js` bundle、8 章剧本、幕间/尾声、剧情自译、真实双线开闸（依次属 P8 / P8-T / P9.5）。三个 TDE 内容包与战役一起在 P10 接入（路线图 §10.2 接入点 1）。
- **边界**：57 张卡有显式简化（`simplified:true` + `note`，账本 `remaining` 单列）；P7 不宣称规则等价，`literalCardBehavior` 仍为 `false`。

## 2. 产物

| 类别 | 文件 |
| --- | --- |
| 单卡文件 ×87 | `src/cards/entries/06018`–`06332`（区间内 87 条玩家包记录；调查员/专属卡不在本批） |
| 分片测试 ×4 | `tests/tde-player-m2-1…4.test.mjs`（101 例，每卡至少 1 条 `TDE <code> <中文名>` 真实行为测试） |
| 账本测试 | `tests/tde-player-ledger.test.mjs`（6 例：包清单/账本哈希/availability/升级池/Researched/Myriad） |
| 账本 | [`audit/tde-player-acceptance.json`](../audit/tde-player-acceptance.json)（`--write` 生成） |
| 生成物 | [`src/cards/tde-player-acceptance.js`](../src/cards/tde-player-acceptance.js)（verified 集合 + 基础弱点集合 + profile + sha256） |
| 包清单 | [`content/packs/tdePlayer/manifest.js`](../content/packs/tdePlayer/manifest.js)：`status: playable`、87 条 `rulesImplemented`、72 条 `deckbuilding`、15 条 `dependencyOnly` |
| 可用性 | [`src/deck/availability.js`](../src/deck/availability.js)：`TDE_PLAYER_CARD_CODES` / `TDE_PLAYER_BUILDABLE_CODES` / `TDE_PLAYER_DEPENDENCY_CODES`、strict 判定与原因文案 |
| 构筑/升级 | [`src/deck/deckbuilding.js`](../src/deck/deckbuilding.js) 开放玩家池（72 张）、[`src/campaign/campaign.js`](../src/campaign/campaign.js) 仅 06 记录可见 06 卡 |
| Myriad | [`web/deck-rules.js`](../web/deck-rules.js)（`MYRIAD_TITLE_LIMIT` / `myriadUsage` / 逐卡上限 + 同名 3 张）、[`web/hub.js`](../web/hub.js) n/3 显示、`src/engine/myriad.js` 在 `buildDeckFromList` 兜底 |
| 工具 | [`tools/scan-tde-player-shards.mjs`](../tools/scan-tde-player-shards.mjs)（shards/worker 输入）、[`tools/tde-p7-index-sync.mjs`](../tools/tde-p7-index-sync.mjs)（串行索引同步）、[`tools/audit-tde-player.mjs`](../tools/audit-tde-player.mjs)、[`tools/tde-p7-reports.mjs`](../tools/tde-p7-reports.mjs) |
| 运行目录 | `artifacts/migration/tde/{shards.json,workers/,primitive-requests/,reports/}`（不签入） |
| 文档 | 本文 + [`tde-player-cards.md`](./tde-player-cards.md) + 路线图 §8.2/§13 + [`tde-rules.md`](./tde-rules.md) 的 P7 待办销账 |

## 3. 多子进程分片

| 分片 | 记录数 | worker | done | blocked | simplified | 分片测试 |
| --- | ---: | --- | ---: | ---: | ---: | ---: |
| `M2-1`（06018–06110） | 22 | `w-m2-1` | 22 | 0 | 13 | 24 例 |
| `M2-2`（06111–06195） | 22 | `w-m2-2` | 22 | 0 | 15 | 23 例 |
| `M2-3`（06196–06245） | 22 | `w-m2-3` | 22 | 0 | 16 | 23 例 |
| `M2-4`（06246–06332） | 21 | `w-m2-4` | 21 | 0 | 13 | 31 例 |
| 合计 | **87** | 4 | **87** | **0** | **57** | **101 例** |

- 分片清单与输入快照：`artifacts/migration/tde/shards.json` + `workers/w-m2-*.input.json`（`scan:tde:player:shards:check` 复算）。
- worker 报告：`artifacts/migration/tde/workers/w-m2-*.json`；汇总 `reports/workers.json`（gate.pass=true）。
- 写入边界：worker 只写自己的单卡文件/测试/报告/原语请求；索引经 `tools/tde-p7-index-sync.mjs` 串行同步（目录锁），合并后主进程 `build-card-index` 重建一次。
- 合并期处理过 3 次并发注册期阻塞（06025/06283 的 `scope:'enemy'` 条目声明 `weakness`、06028 描述子未知字段 `removeAfterPlay`）：由对应 worker 修复，主进程重建索引后四个分片全部复跑通过。

## 4. 逐卡账本口径

| 项 | 结果 |
| --- | --- |
| 记录 | 87 = 72 可入牌组 + 11 场外绑定卡/绑定弱点（`deckLimit=0`）+ 4 基础弱点（06035–06038） |
| verified | 87/87（每卡 ≥1 条 `TDE <code>` 前缀行为证据；`evidence` 带文件/行/用例名） |
| simplified | 57（`note` 写明未实现子句/缺少的读点/已实现部分；`remaining` 逐条列出） |
| testsPassed | 101（4 个分片实跑；不含账本测试 6 例） |
| 生成物一致性 | `--write` 后 `--check` 逐字节一致（模块内 sha256 = 账本文件哈希） |

## 5. 显式简化与原语队列

- **57 张显式简化**（M2-1 13 / M2-2 15 / M2-3 16 / M2-4 13）：主印刷效果已实现并测试，未还原子句逐条写进条目 `note` 与账本 `remaining`。主要是：跨卡图标/槽位修正、自定义成功后结算、符号效果替换、负技能图标/强制投入、若干自定义窗口（诡计弃置时点、神话抽取步骤替换、地点动态连接、遭遇牌库中玩家卡显现）。
- **5 条原语请求全部 `rejected` + 替代方案**（`artifacts/migration/tde/reports/primitive-queue.json`，gate.pass=true）：
  - 06023 `searchedCardRule.resolve` → 用固定动作近似 + note；
  - 06028 遭遇牌库玩家卡通道 → 数据/绑定关系可验证 + note；
  - 06029 `locationLink` → 地点附属形态 + note；
  - 06110 神话抽取步骤替换窗口 → 查看/排列近似 + note；
  - 06156 诡计弃置时点窗口 → 改用 `encounterDrawn` + `api.cancelEncounterDraw` 近似。
- **escape 卡**（P3 登记）P7 收尾：06164 / 06329 / 06331 均显式 simplified（单卡逻辑已按可行通道实现主要分支）。
- 结论：本轮没有新增引擎原语；P7 的读点全部落在既有 `ctx.api`/描述子/窗口上，队列无悬挂。

## 6. 共享层改动（主进程）

1. `content/packs/tdePlayer/manifest.js`：M0 `catalog-only` → `playable`；87 条 `rulesImplemented`、72 条 `deckbuilding`、15 条 `dependencyOnly`；导出 `PLAYER_CARD_CODES` / `TDE_PLAYER_BUILDABLE_CODES` / `TDE_PLAYER_DEPENDENCY_CODES`。
2. `src/deck/availability.js`：87 条 strict、72 张进 `ALL_BUILDABLE_CODES`、15 张 `dependencyOnly`、原因文案；默认构筑池不变。
3. `src/deck/deckbuilding.js`：开放玩家池加 72 张 06 卡（默认池不动）；`buildDeckFromList` 增加 `deck.myriadLimit` 兜底。
4. `web/deck-rules.js`：Myriad 同名 3 张（跨卡号）+ 逐卡 `deckLimit` 双校验；`myriadUsage`；新增 `misc.deck.myriadLimit` 文案。
5. `web/hub.js` + `web/locales/{zh-CN,en}.hub.js`：构筑界面 Myriad 卡显示「同名 n/3」。
6. `src/campaign/campaign.js`：06 记录的升级池 = 原有池 + 72 张食梦者可入牌组卡（01–05 记录不可见）。
7. `content/campaigns/theDreamEaters/keywords.js` / `docs/tde-rules.md`：Myriad 构筑界面与 Researched 记录键两条 P7 待办销账；06236–38 的 `researchRequirement:'youHaveInterpretedTheDreams'`（记录由 06112 用 `api.recordResearch` 写入）。
8. `tests/suites.mjs` / `tests/node-suite.mjs`：登记 4 个分片 + 账本测试（并入 FAST tier）。
9. `package.json`：`test:tde:player`、`audit:tde:player(-write)`、`report:tde:player`、`scan:tde:player:shards(-check)`。
10. 生成物重算：`audit/ability-coverage.json`（新增 87 条目）；连带重算 TCU 三本账本（availability/campaign/suites 变更是 TCU 账本的证据文件）——`audit-tcu-player --write` → `audit-tcu-all-cards --write` → `audit-tcu --write` → `audit-tcu --check`。

## 7. 验证记录（2026-10-31 实测）

| 项 | 结果 |
| --- | --- |
| `npm run test:tde:player` | **107 例全过**（分片 101 + 账本 6） |
| `npm run audit:tde:player` | 87/87 verified、72/15、57 simplified、生成物字节一致 |
| `npm run report:tde:player` | workers.json gate.pass、primitive-queue.json `pending 0 / done 0 / rejected 5` gate.pass |
| `npm run cards:check` | 索引 671 张一致、一卡一文件、条目合规审计：TDE 新增 **0** 条 R1/R2/R3；命令整体仍报 1 条**存量** R1（03295，非 TDE，见 §8） |
| `npm run cards:encounter-check` | 索引/归属通过；条目合规同上（03295 存量） |
| `node tools/replay-fixtures.mjs --compare artifacts/migration/tde/replay-before.json` | 13 局逐条一致（行为零漂移） |
| `npm run plan:tde:primitives` / `audit:tde:primitives` | 不新增原语；P3/P6 账本保持 `new 29/29 done`、gate.pass |
| `npm run test:tde:rules` | 15/15 通过（388/388 卡文直达、关键词/规则书不受影响） |
| `npm run test:fast` | **4113 tests / 4102 pass / 8 fail / 3 skipped**：8 条失败全部为工作区既有问题（§8），TDE 新增用例 107 例全部通过 |
| TCU 连带账本 | `audit-tcu-player --write` → `audit-tcu-all-cards --write` → `audit-tcu --write` → `audit-tcu --check`：`audit 复算一致：P10，关键词 16/16，规则书 verified，gate pass`（availability/campaign/suites 是 TCU 账本的证据文件，P7 改动后必须连带重算） |
| TDE 连带账本 | P7 的可用性/文档改动使 `audit/tde-investigators.json`、`audit/tde-rules.json`、`primitive-plan/catalog` 的证据指纹变化：已重算 `audit-tde-investigators --write`、`audit-tde-rules --write`（并重跑 `tde-rules.browser` 生成桌面/移动浏览器证据与截图，恢复 P4 规则书 verified）、`audit-tde-primitives --write`；三者 `--check` 均 gate pass |

## 8. 已知问题与既有失败（非 TDE 产生）

以下失败在本轮开始前即存在于工作区（未提交的其他循环 WIP 或已提交的旧账本漂移），不属于 P7 产物，按「既有失败单独记账」处理（`test:fast` 最终 8 条失败即这 8 条）：

1. `audit-card-entry-compliance` 的 `R1 directStateWrite 03295`：`encounter-entries/thePathToCarcosa/blackStarsRise/03295.js` 的 `locationRule` 直接写 `state.scenarioFlags`（该文件本轮前已修改）；TDE 新增 0 条违规。
2. `tests/encounter-entries.test.mjs`：`02297.js` import `content/`（Carcosa 未提交改动）。
3. `tests/architecture-guard.test.mjs`：`behavior.js` 总行数 23600 超过 Phase 3 基线 23551（Carcosa WIP 新增行为）。
4. `tests/carcosa-final.test.mjs` / `carcosa-pending-encounters.test.mjs` / `carcosa-all-card-ledger.test.mjs`：Carcosa 未提交改动的 3 条红（Black Stars Rise、03185 约束衣、C4 账本）。
5. `tests/core-ledger.test.mjs` / `dunwich-ledger.test.mjs`：证据文件 `core-encounter-acceptance.test.mjs`、`dunwich-encounter-acceptance.test.mjs` 在工作区被改动导致账本 stale（非 TDE 文件）。
6. `tests/tcu-migration.test.mjs`（P1 账本）：TCU `scope.json` 记录的 `src/cards/cards-data.js` 哈希与当前文件不一致——`cards-data.js` 在 commit `61b3722`（P6 之后、本轮之前）更新而 TCU scope 未重采，属**已提交的旧账本漂移**；TDE P7 不改 cards-data。
7. （已修复，保留记录）`tests/suite-manifest.test.mjs`：P5 遗留的 `tests/tde-scenario-interactions.test.mjs` 未登记 tier；P7 已补登记进 FAST + `node-suite`，复跑后该项消除。

> 归类原则：报告不把既有失败写成「已通过」；TDE 自身新增失败为 0（四个分片 + 账本 + 玩家卡相关门禁全绿）。上述第 1–6 条建议由对应循环的 P 阶段或发布轮单独修复（重采账本 / 修 02297 import / 清 Carcosa WIP）。

## 9. 剩余工作（交接）

1. **P8**：8 章、三幕间、16 段尾声、梦境之门地点；剧本接入后才允许战役启动。
2. **P8/P10 评估 57 张显式简化**：尤其是符号效果替换（06285）、负技能图标/强制投入（06331）、诡计弃置时点窗口（06156）、遭遇牌库中玩家卡显现（06028）等；原语请求文件已附建议。
3. **P10**：三个 TDE 内容包 + 战役 + 8 章进 `content/registered.js` bundle；AI 自动选人池并入 TDE 并重采 replay 基线（P6 的 5 位调查员同样待并入）。
4. **P8-T**：中文剧情自译从批 00 开始（与 P7 无依赖）。

## 10. 维护

- 改玩家卡：改条目 → `node tools/tde-p7-index-sync.mjs` → `npm run test:tde:player` → `npm run audit:tde:player:write` → 审阅 diff → `npm run audit:tde:player`（必须逐字节一致）。
- 改可用性/构筑/升级池：同步重算 `audit:tde:player` 与 TCU 三本账本（`audit:tcu-player:write` → `audit-tcu-all-cards --write` → `audit-tcu --write` → `audit-tcu:check`）。
- 改原语：同步 `tools/tde-primitive-spec.mjs`、`docs/tde-primitives.md`，跑 `plan:tde:primitives` + `audit:tde:primitives`。
