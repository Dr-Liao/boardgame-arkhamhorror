# Arkham 重构路线（唯一决策文档）

> 日期：2026-02。本文合并并取代以下四份文档（已删除，内容按"可执行信息"重新组织，不保留过程记录）：
> `architecture-review-vs-reference.md`、`rule-expressiveness-gaps.md`、`card-abilities.md`、`architecture-unification-plan.md`。
>
> 三份文档的分工，不要再互相复述：
> - [`../ARCHITECTURE.md`](../ARCHITECTURE.md)：稳态架构——目录职责、依赖方向、运行流程、修改约定（**规矩的正式条文**）。
> - **本文**：重构与加卡的决策依据——现状基线、分层规矩、缺口清单、阶段路线、迁移判据。
> - [`arkham-content-migration.md`](arkham-content-migration.md)：内容迁移流程与验收门槛——接一个新战役/新卡包怎么走、证据怎么留。

---

> 交接入口：[`phase5-handoff.md`](phase5-handoff.md)（Phase 5 现状、验收命令、下一步与已知坑）。

## 0. 结论摘要

本实现的定位与参考实现不同，取舍也不同：它是"大厅里的一个可搬运 Mod + LLM 队友"，约束是嵌入大厅、零构建、离线可跑、AI 只能靠"观察投影 + 合法动作"决策。因此**参考实现的 Haskell/Postgres/Docker 三件套不要照搬**，要照搬的是它的**分层**（能力 / 窗口 / 代价 / 修正 / 匹配），不是它 6 千个逐卡模块的粒度。

当前状态一句话：**声明式入口通了，生命周期钩子补到五个，状态基础（持续效果 / 目标枚举 / 打出条件）与语义原语（布尔修正 / 费用表达式 / 上限归属 / 授予 / 分配策略 / 检定结果 / 看牌 / 区域搬运）都已落地（Phase 1、Phase 2 完成）；内容来源已统一（Phase 3 完成）；重放安全网完整交付（Phase 4 完成：golden replay 基线 + 100 局随机对局门禁 + 撤销 API）；Phase 5 的迁移工具、5b 机械迁移主体、**反应能力接线**与 5c 逃生卡（Carcosa → TFA，三十九批，**93 → 0 完成**）与 **5b 全部遗留（反应 / 战役规则 / 费用能力 / 剧情资产）已交付**（累计 341 张卡：`EFFECTS` 385 → 57、通道 legacy 286 → 50、descriptor 75 → 404、逃生卡 93 → 0、引擎卡号 166 → 73），只剩 5a 引擎卡号分支。** 冻结守卫、账本、重放安全网都已就位，后续每批仍按「replay 指纹不变 + 账本指标单调下降」验收。

---

## 1. 现状基线（本次实测，2026-02）

| 项 | 当前值 | 说明 |
| --- | --- | --- |
| `src/engine/engine.js` | **12,600 行** | 单文件承担 dispatch、检定、战斗、阶段、战役机制（5c-18/5c-19 删了 7 段旧原语分支、补了 9 个薄包装，净增约 20 行；卡号分支删完后自然变小） |
| `EFFECTS` 行为条目 | **57** | Phase 5 迁走 328 条（5b 机械 154 + 反应 35 + 天赋 15 + 被动 20 + 规则字段 6 + 封印附属 5 + 5c 60）；其中 32 张用战役逃生原语、5 张由引擎硬编码 `engine:`；通道分布（按卡）：legacy 50 / descriptor 404 / hybrid 2 / escape 0 / engine 5，见 `audit/ability-coverage.json` |
| `EFFECTS` 顶层字段 | **65** | 生命周期/metadata/条件混在一起（`event`/`skill`/`weakness` 搬空后归零；`cards:audit` 现算 **37** 个键） |
| 引擎里的卡号字面量 | **73 个** | `engine.js` 中 `'0\d{4}'` 去重计数，是**技术债主指标**（5c 带走 58 个、5b 带走 4 个、5a 十七批带走 43 个，其中 5c-18…5c-39 带走 23 个） |
| 战役逃生原语的卡 | **0 张** ✅ | 93 → 0，5c 三十九批全部走描述子通道 |
| `engine: 'xxx'` 标记卡 | **5 张** | 行为完全由引擎硬编码 |
| 引擎里的战役字样 | tfa 64 / carcosa 36 / dunwich 3 | 违反"引擎不按关卡分支"的约定 |
| 时机窗口 | **52**（reaction 35 / interrupt 9 / player 7 + `chaosTokenRevealed` 1） | `src/engine/windows.js` |
| 描述子 `kind` | **11** | 六种触发/修正 + 五种生命周期钩子（`played`/`commit`/`weakness`/`entersPlay`/`leavesPlay`） |
| 描述子 `scope` | **8**（`card`/`investigator` + 6 种非玩家） | Phase 3 · D1：敌人/地点/幕/议程/剧情支援/威胁 |
| 非玩家卡能力条目 | **9 张**（敌人 7 / 地点 2） | `src/cards/encounter-abilities.js`，读点 `entityModifierTotal` / `entityRuleActive` |
| `behavior.js` 总行数 | **14,831**（Phase 3 基线，只减不增） | 含 `later-behaviors.js`；守卫 `architecture-guard.test.mjs` |
| 已声明化关卡 | **3**（NOTZ 三关） | `content/scenario-declaration.js` 的 `declareScenario` |
| 能力层已交付 | **407 个注册条目 / 343 个描述子能力**（含 Phase 2 的 21 张逃生卡与 Phase 5 的 341 张） | `tests/ability-layer.test.mjs`、`card-lifecycle.test.mjs`、`phase2-primitives.test.mjs`、`migration-tools.test.mjs`、`phase5-migration.test.mjs` |
| 状态基础（Phase 1） | `state.effects[]`（6 种 duration）、`target` 枚举（5 种 kind）、`playCondition` 单一读点 | `src/engine/effect-state.js`、`targets.js`、`play-condition.js` |
| 语义原语（Phase 2） | `cost.js` / `limits.js` / `test-result.js` / `look.js` / `zones.js` + `modifiers.js` 的 `capability:*`/`ignore:*`/`add:*` | 见 [`phase2-primitives.md`](phase2-primitives.md) |
| 规则层读座位策略 | `resolution.js:58` 读 `state.humanSeats` | 策略泄漏进规则，未修 |
| 冻结守卫 / 覆盖度账本 | **已建（Phase 0 完成）** | `tests/architecture-guard.test.mjs`、`npm run cards:audit`、`audit/ability-coverage.json` |
| 对局日志 / 哈希 / 重放 / 撤销 | **已建（Phase 4 完成）** | `src/engine/replay.js`：`captureReplayLog` / `stateHash` / `replayLog` / `replayHashes` / `verifyReplay` / `stateDiff` / `rewindTo` / `undoMoves`，见 §1.3 |
| golden replay 基线 | **10 局 / 529 步 / 530 个逐步指纹** | `tests/fixtures/replay/golden-replays.json`，4 战役 / 5 关卡 / 3 种 uiState；`npm run replay:fixtures` |
| 随机对局门禁 | **100 局 / 2,039 步逐步一致；5,000 步随机走子器** | `tests/replay-fuzz.test.mjs`（slow tier），见 [`phase4-replay.md`](phase4-replay.md) §6 |
| 迁移提效工具（migrate-card/scaffold-card） | **已建（Phase 5）**：`tools/migrate-card.mjs` / `tools/scaffold-card.mjs` / `tools/cards-migrate.mjs` / `tools/rehash-acceptance.mjs` | 见 [`phase5-migration.md`](phase5-migration.md)；`npm run cards:migrate` / `cards:migrate:list` / `cards:scaffold` |

**回归基线（Phase 5 收尾实测）**：`fast` **7 条既有失败**（原第 8 条 `03310 Cheat Death` 已随 5c-36 修好）与 Phase 0 记账一致
（`rules-n3` 5、`campaign-http-n4` 1、`checkpoint-rewind` 1、`carcosa-implementation-gaps` 1）；
`slow` **11 条既有失败**（`campaign-n4` 8、`notz-n4` 1、`dunwich-rules` 的 D9 Mind Wipe 1、
`p2-hub-http` 的 P2 关卡结算 1，见 [`phase4-replay.md`](phase4-replay.md) §6.4）；
`assets` 沿用 Phase 2 记录 119/123（4 条失败在 `HEAD` 上可复现，与本次改动无关）。
Phase 5 的两个新用例文件（`migration-tools`、`phase5-migration`）已进 `fast` tier，**新增失败 0 条**。

> Phase 4 修正了 Phase 3 记账的两处遗漏：`fast` 的 TFA 验收用例（`tfa-untamed-wilds`、`tfa-heart-of-the-elders-part1`）
> 之前没有 import 引擎装配点，`entityModifierTotal`/`entityRuleActive` 恒为 0；`slow` 的 11 条既有失败比 Phase 3
> 记录（9 条）多出 `dunwich-rules` 与 `p2-hub-http` 各 1 条。两处都已按"既有失败"记账，不是本阶段引入。

**已交付（P0-A，勿重做）**：`ability.js`（描述子规范化/注册/枚举/上限）、`windows.js`（窗口注册表）、`matcher.js`（查询组合子）、`modifiers.js`（修正管线）、`card-abilities.js`（内容通道）；`getStat` 走 `statPipeline`；旧印 switch 已删除；`engine.js` 未按卡号新增分支。

**已交付（Phase 2，语义原语）**：`cost.js`（C3 费用表达式）、`limits.js`（C4 作用域/归属/次数）、
`test-result.js`（B3 结果契约）、`look.js`（B5 看牌/检索）、`zones.js`（B6 区域搬运），
以及 `modifiers.js` 的 `capability:*` / `ignore:*`（C1）与 `add:*`（C2）目标；
`api.harm()`（B2）与 15 个薄包装接口。21 张逃生卡已迁到描述子（对照表见
[`phase2-primitives.md`](phase2-primitives.md)），引擎卡号 180→166、`EFFECTS` 406→385、逃生卡 114→93。

**已交付（Phase 5，迁移工具 + 5b 主体 + 反应接线 + 5c 五批 + 5a 死分支清理）**：`tools/migrate-card.mjs`（判定 + 生成 + 删条目 + 登记卡包）、
`tools/scaffold-card.mjs`（测试骨架）、`tools/cards-migrate.mjs`（批次门禁编排）、
`tools/rehash-acceptance.mjs`（验收账本证据哈希重算）；`src/cards/ability-migration-batches.js`（按批次的生成描述子）
与 `audit/migration-batches.json`（批次账本）。**243 张卡迁完**（5b-1…5b-5 共 154 张机械迁移 + 5b-6/6b/6c 共 28 张反应描述子 + 5b-7 共 15 张天赋档位
+ 5c-1…5c-9 共 47 张逃生卡）+ 5a-1 的 4 段死分支清理，`EFFECTS` 385→141、legacy 286→97、descriptor 75→310、逃生卡 93→47、引擎卡号 166→141；
同时落地 D2（`discardWhenEmpty` 进注册表）、条目级 `fast`/`noOpportunityAttack`、描述子 `countsAs`，
以及 7 个 `ctx.api` 薄包装（`attachToLocation` / `playCard` / `discardAsset` / `defeatEnemy` /
`investigate` / `evade` / `enemyFight` + `maxHealth`）。
逐批证据与剩余清单见 [`phase5-migration.md`](phase5-migration.md)。

**已交付（Phase 0，冻结与守卫）**：

| 产物 | 作用 |
| --- | --- |
| `tools/audit-abilities.mjs` | 采集 §1 指标并生成两份账本；`--write` 重写、`--check` 校验漂移 |
| `audit/ability-coverage.json` | 指标 + 通道分布 + 逐卡通道（`engine/escape/hybrid/descriptor/legacy`） |
| `audit/ability-migration.json` | 迁移工作单：5a 引擎码与 `engine:` 标记卡、5b hybrid、5c 逃生卡（含按原语计数） |
| `audit/card-code-whitelist.json`、`audit/effects-whitelist.json` | 冻结集合，**只减不增** |
| `tests/architecture-guard.test.mjs` | 十条守卫：两份白名单逐码相等、`kind` 冻结、窗口已注册、内容层不 import 引擎、产物与实现同步、非玩家卡目标可解析、behavior 行数预算、`condition/block` 分支死代码、卡包登记完备 |
| `npm run cards:audit` / `cards:audit:write` | 校验 / 重写账本 |
| `tools/audit-workorder.mjs` + `audit/ability-workorder.json` | 180 个引擎码的形态/能力缺口工作单（§1.2） |
| `npm run cards:workorder` / `cards:workorder:write` | 校验 / 重写工作单 |

放行规则：`--write` 只收缩白名单；只要出现新增码就直接失败（打印清单并拒绝写入），
确需新增必须人工评审后加 `--allow-growth`。白名单**收缩**时 `--write` 会连带把账本数字降下来——
指标下降本身就是迁移证据，应当出现在同一次 diff 里。

**已交付（Phase 4，重放安全网）**：

| 产物 | 作用 |
| --- | --- |
| `src/engine/replay.js` | `state.actionLog`（成功动作的纯 JSON 日志）、`stateHash`（键排序 + 排除派生/瞬时字段）、`captureReplayLog`/`replayLog`/`replayHashes`、`verifyReplay`/`stateDiff`、`rewindTo`/`undoMoves`（撤销地基） |
| `tests/fixtures/replay/golden-replays.json` | 10 局真实对局 / 529 步 / 530 个逐步指纹：4 战役、5 关卡、局外准备/幕间升级/关卡结算/待决选择、严格规则 + 3 席位随机走子 |
| `tools/replay-games.mjs` | 对局驱动器与 recipe（p6 策略、通用策略、随机走子器）；只走合法动作，随机只来自 seed |
| `tools/replay-fixtures.mjs` | `--write` 重采基线、`--check` 校验、`--verify` 实时对照、`--baseline/--compare` 迁移前后指纹对比 |
| `tests/replay.test.mjs` / `replay-golden.test.mjs` / `replay-fuzz.test.mjs` | 契约 14 条 / golden 5 条 / 门禁 2 条（100 局随机对局 + 5,000 步随机走子器，slow tier） |
| `npm run replay:fixtures` / `replay:fixtures:write` / `replay:fixtures:verify` | 校验 / 重采 / 实时对照 |

交付说明与门禁证据：[`phase4-replay.md`](phase4-replay.md)。

**未交付**：`engine.js` 拆分、战役插件化、A2 替换与防止、A3 视为、A4 强制顺序、
B4 多人同时决定、C6 记录与历史、C5 计算表达式、E1 文案 i18n、E2 覆盖度报告。
（D1 非玩家卡通道、D3 剧本声明化首批、D4 战役结果声明化已随 Phase 3 交付；D2 使用次数元数据已随 Phase 5 交付；
重放/撤销的**引擎能力**已随 Phase 4 交付，但撤销 UI 与 `action_diff` 增量存档仍未做；
迁移提效工具已随 Phase 5 交付，**5b / 5c 均已收尾**，只剩 5a 引擎分支。）

### 1.2 引擎码工作单（§10 第 1 项）

`npm run cards:workorder` 把 73 个引擎码按**形态**拆开，产物在 `audit/ability-workorder.json`：

| 形态 | 数量 | 含义 | 是否规则债务 |
| --- | --- | --- | --- |
| `reference` | 28 | `requestChoice` 的 source 标签、`cardName('…')` 文案 | 否 |
| `table` | 0 | 静态数据表（如 `'01101': { hunter: true, … }`） | 否（搬家即可，已清零） |
| `condition` | 15 | 共享规则里的卡号条件 | 是 |
| `block` | 30 | 按卡号写死的实现块（`if (def.code === …)` / `case`） | 是 |

按能力缺口分类（关键字保守判定，逐条迁移前仍需人工确认）：

| 类别 | 数量 | 判定依据 |
| --- | --- | --- |
| A 现有描述子可表达 | 34（其中**只有 6 个**是行为分支，其余 28 就是上面两类非债务） | 不需要新能力 |
| B 需要 Phase 1 能力 | **43**（Phase 5 迁走 2 张：03026/03040 这类改用 `ctx.api` 后不再依赖逃生原语） | 效果时长 / 目标枚举 / 历史记录 / 非玩家通道 |
| C 需要 Phase 2 能力 | **28**（Phase 5 拆出 2 张需要 `ctx.api` 薄包装的卡） | | 布尔修正 / 费用表达式 / 区域附属 / as-if |

**结论（Phase 5 之后）**：87 个行为分支里只有 **6 个**在 Phase 1 之前就能写；Phase 1 落地了 `state.effects[]`（A1）、
`target` 枚举（B1）与 `playCondition` 收敛，Phase 2 补上了 C1/C2/C3/C4 与 B2/B3/B5/B6，
因此 B 类与 C 类里**不需要战役插件的部分已经全部解锁**；Phase 5 已经把其中 154 张能机械搬的卡迁完，
剩下的引擎码里只有"非玩家通道"（D1，已交付）与"视为/as-if"（A3）还需要新能力。
顺序不变：**先补能力，再批量迁卡**——下一批先补 `reactions`→窗口、`freeTriggers` 的自动投入档位（见 §6 Phase 5 剩余清单）。

### 1.3 对局日志与重放（§10 第 4 项）

`src/engine/replay.js`（Phase 4 完整版，交付说明与门禁证据见 [`phase4-replay.md`](phase4-replay.md)）：

- `state.actionLog`：每次成功 `applyMove` 追加 `{ seat, move }`，纯 JSON，随存档往返；
- `stateHash(state)`：键排序后 sha256。排除**派生资源**（`cards` / `investigatorDefs` / `classNames` /
  `classColors` / `skillNames` / `tokenLabels` / `resourceVersion`）、**瞬时字段**（`legalMoves` / `actionLog` /
  `lastActionSnapshot`）与 `_*` 事务临时字段；`state.effects` 参与指纹，因此"临时修正"也在覆盖范围内；
  指纹组成有 `STATE_HASH_VERSION`（当前 2），改组成必须升版本，基线工具会拒绝跨版本比较；
- `captureReplayLog(state)` → `{ version, meta, settings, players, moves }`：`settings` 覆盖**全部建局输入**
  （含 `aiStoryAwareness` 与 `seatInvestigators`，后者锁定 AI 选人结果）；`replayLog(log, { until, observe })` → 全新状态；
- `replayHashes(log)`：一次重放返回**全部中间指纹**（golden 基线用），`replayHash(log, { until })` 取某一步的指纹；
- `verifyReplay(state)` → `{ ok, hash, replayHash, moves, differences }`；`stateDiff(a, b)` 给出"路径 + 前后值"
  （迁移失败时不用只对着两个哈希猜）；
- `rewindTo(state, until)` / `undoMoves(state, count)` / `undoDepth(state)`：撤销 = 截断日志后重放，
  原地替换、保留检查点分支的 revision 偏移。

已解锁：**迁移安全网**（`--baseline` / `--compare` 逐条比较指纹）、`until` 取中间态、存档回放、撤销地基。
golden replay 已固化成用例（`tests/replay-golden.test.mjs` + `tests/fixtures/replay/golden-replays.json`），
100 局随机对局与 5,000 步随机走子器在 `tests/replay-fuzz.test.mjs`（slow tier）。
未做：撤销 UI、`action_diff` 增量存档、AI 决策回归（固定状态重跑不同模型）。

一条实现约束：日志必须由 `applyMove` 在**事务外**持有——`resolveTransaction` 会用"本次动作开始前"
的快照重建整个 state；`dynamicState` 已把 `actionLog` 排除在事务快照之外，否则历史会被后续选择覆盖。
第二约束：`continuation.move` 只保留语义字段（`resolution.js` 的 `cloneMove`）——事务恢复凭据会进
`state` 与指纹，`label`/`explanation` 这类展示文案不参与"行为是否变化"的判断。

> **编号对照（旧文档遗留，代码注释里仍会看到）**：旧的四份文档用 `P0-A…P0-D` 编号，本文用 `Phase 0…6`，两套数字**不是**同一件事，以本表为准。
>
> | 旧编号 | 含义 | 本文位置 |
> | --- | --- | --- |
> | `P0-A` | 能力层（描述子/窗口/Matcher/修正），**已完成** | §1「已交付」、§4 |
> | `P0-B` | 对局级动作日志 + 纯函数重放 | **Phase 4** |
> | `P0-C` | 拆分 `engine.js` | Phase 6（卡号分支删完后做） |
> | `P0-D` | 战役机制插件化 | Phase 6 |

---

## 2. 目标形态：五件唯一

不是重写所有卡，而是让下面五件事各只有一处：

| # | 唯一 | 现在 | 目标 |
| --- | --- | --- | --- |
| 1 | **行为入口** | `EFFECTS` DSL、`behavior.js`、引擎卡号分支、描述子 —— 四套并存 | 全部走 `card-abilities.js` 的描述子（含生命周期钩子） |
| 2 | **读点** | 引擎有 118 处 `eff.<field>` 读取（22 个字段名），`assetEffect` 只覆盖其中一部分 | 引擎只经 `ability.js` 注册表枚举，不读 `EFFECTS` |
| 3 | **账本** | 审计账本按战役分散（core/dunwich/carcosa/tfa） | 一张 `audit/ability-coverage.json`：每张卡 → 通道/证据/缺口 |
| 4 | **内容分层** | 卡=数据+EFFECTS；关卡=definition+behavior；战役=campaign-effects | 卡=数据+描述子；关卡=声明式定义+少数钩子；战役=声明式记录 |
| 5 | **守卫** | 无，新增卡可随便走旧通道 | CI 守卫：卡号集合、`EFFECTS` 键集合、`kind` 枚举**只减不增** |

验收指标（"调理好了"的判断标准）：

| 指标 | 现在（Phase 5 之后） | 目标 |
| --- | --- | --- |
| `engine.js` 卡号字面量 | **73**（其中行为分支 45 个：condition 15 + block 30；reference 28 / table 0） | **0** |
| `EFFECTS` 行为条目 | **57**（385 → 57，Phase 5 迁走 328 条） | **0**（静态卡面数据留在 `cards-data.js`） |
| 卡牌顶层字段 | **65** | **≤10 组** |
| 逃生原语卡 | **0** ✅（93 → 0，5c 三十九批全部迁完） | **0** |
| 描述子 `kind` | 11 | **≤11**（Phase 1 后为生命周期钩子的全集；再加 kind 需要同时改本文、`card-model.md` 与守卫） |
| 迁移批次的行为差异 | **已可断言**：`--baseline`/`--compare` 逐条比较逐步指纹，golden 基线 10 局 / 529 步；Phase 5 全部批次一致 | 每批 **replay hash 不变** |
| 新增一张卡 | 已达成：1 个文件 + 0 引擎改动 | 保持 |

---

## 3. 分层与硬规矩

以下八条是重构与迁移期间的**硬约束**，违反任一条都会把架构推回"四套并存"。

1. **新增卡牌行为只写描述子**：在 `src/cards/card-abilities.js` 加条目（`abilities` / `modifiers` / `elderSign`），**不得**在 `engine.js` 按卡号新增分支，**不得**往 `EFFECTS` 加新条目。
2. **引擎不得按卡号、关卡名、战役名分支**。确实需要新机制时，先扩通用能力（`ability.js` / `windows.js` / `matcher.js` / `modifiers.js`），补窗口接线与测试，再写卡。
3. **内容层不 import 引擎装配点**：`card-abilities.js → ability.js / modifiers.js / matcher.js / windows.js`，方向单向；`modifiers.js` 与 `ability.js` 互不 import（引擎通过 `setModifierRegistry` 注入读点）；`engine.js` 是唯一装配点。
4. **描述子不可变、注册即校验**：注册时规范化并冻结；未知 `kind`、缺 `trigger`、缺必填 payload（`effect`/`skill`/`weakness`/`entersPlay`/`leavesPlay`）、未知字段、重复注册都在模块加载时抛错，不在对局中途静默失效。运行期数据一律写 `state`。
5. **效果只经 `ctx.api` 窄接口结算**：描述子不直接改状态；需要新接口时，先在 `engine.js` 的 `abilityApi()` 加薄包装，再在内容侧使用——这是唯一允许的引擎侧改动。持续效果一律用 `api.addEffect()` 创建（A1），不要在调查员身上新写"到期靠某处记得清"的裸字段。
6. **窗口注册 ≠ 已接线**：新增窗口 = `windows.js` 注册 + `engine.js` 对应位置 `openAbilityWindow(...)` / `triggerReaction(...)` + 测试。未注册 id 会被 `unknownWindows()` 记录，测试必须断言为空。
7. **规则层不读策略**：引擎不认识"谁在操作这个座位"。可选反应的自动跳过必须由大厅注入策略，不能读 `state.humanSeats`（现存泄漏见 §1）。
8. **状态变化必须可重放**：任何状态变化都要能由合法动作重放，并在 JSON 存读档后一致；隐私字段先判级别，私有候选、手牌、内部续算数据不得进入其他座位投影。

> 简化/近似实现的卡必须写 `simplified: true` + `note`，并保持覆盖度账本里的状态为"未覆盖"，不得静默近似。

---

## 4. 加一张卡（能力层最小用法）

一个条目：

```js
{
  code: '01234',                    // cards-data.js 里的 code
  uses: 4, usesType: 'ammo',        // 可选：带「使用」的资产
  modifiers: [ ... ],               // 可选：常驻修正
  abilities: [ ... ],               // 可选：主动/免费/反应/强制
  elderSign: { resolve(ctx) {} },   // 可选：调查员旧印
}
```

十一种 `kind`（前六种是触发型，后五种是 Phase 1 新增的生命周期钩子）：

| kind | 何时可用 | 消耗行动 | 出现位置 |
| --- | --- | --- | --- |
| `action` | 自己回合主动使用 | 默认 1（`cost.action: false` 免） | `legalMoves` / 牌桌按钮 |
| `free` | `trigger` 指定的**玩家窗口**内 | 0 | `playerWindow` |
| `reaction` | `trigger` 指定的**事件窗口**后 | 0 | 反应窗口 |
| `forced` | `trigger` 窗口自动结算 | 0 | 不问询，窗口开即执行 |
| `constant` | 不主动触发，只提供修正 | — | 通过 `modifiers` |
| `elderSign` | 旧印 | — | 检定投入 |
| `played` | 事件卡打出 | 由卡面决定 | `lifecycle.playedEffect(code)` |
| `commit` | 投入技能检定 | 0 | `lifecycle.commitProfile(code)` |
| **`weakness`** | 弱点揭示 | — | `lifecycle.weaknessProfile(code)` |
| **`entersPlay`** | 支援放置入场 | — | `lifecycle.entersPlayEffect(code)` |
| **`leavesPlay`** | 支援离开场上 | — | `lifecycle.leavesPlayEffect(code)` |

五个生命周期钩子（`played` / `commit` / `weakness` / `entersPlay` / `leavesPlay`）都以**数据体**形式写，
不带 `trigger`、不产生牌桌按钮：数据体分别是 `effect` / `skill` / `weakness` / `entersPlay` / `leavesPlay`。
读点在 `src/engine/lifecycle.js`，描述子缺失时回落到 `EFFECTS`，因此**迁移一张卡不需要改引擎**。
`weakness` 描述子可以额外带 `resolve` 接管整段揭示结算（自定义弱点不用碰引擎的类型分支）。
完整模型见 [`card-model.md`](card-model.md)。

### 4.1 目标枚举（B1）

需要先选目标的能力在描述子上声明 `target`，引擎把它展开成"逐目标"的合法动作：

```js
target: { kind: 'enemy' },                        // 同地点的敌人
target: { kind: 'investigator', optional: true }, // 同地点调查员，可以不带目标
target: { kind: 'location', query: ctx => ctx.candidate.entity.shroud < 3 },
```

`kind` 取值：`enemy` / `investigator` / `location` / `asset` / `cardInHand`；`query` 是 matcher 风格 predicate
（或数组，全部满足），ctx 里带 `candidate`（`{ id, label, kind, entity }`）。候选集合是默认范围，query 只能**收窄**。
`legalMoves` 每个目标一条行动（`targetId`），`validateMove` 用同一份枚举校验，执行时 `ctx.target` 直接拿到实体：
`ctx.target.entity` 是敌人/调查员/地点/卡牌实例，`ctx.targetId` 是原样 id。没有合法目标且非 `optional` 时，这条能力不出现。

### 4.2 打出条件（playCondition）

「能不能打出」从 10 个散字段收敛成一个读点（`src/engine/play-condition.js`）：

```js
// 描述子化卡牌：条目级声明
{ code: '02186', playCondition: [{ when: clueAtLocation(), message: '当前地点没有线索' }], ... }
```

谓词组合子来自 `matcher.js`（`ownTurn` / `ownFirstAction` / `clueAtLocation` / `noEnemiesHere` /
`remainingSanityAtLeast` / `investigatorClues` / `resignAvailable`）。旧 DSL 的 10 个字段
（`ownTurnOnly`/`duringOwnTurn`/`firstActionOnly`/`requiresClue`/`requiresClueAtLocation`/`requiresNoEnemies`/
`requiresRemainingSanity`/`requiresResign`/`playableFromDiscard`/`playableWeakness`）由同一模块翻译成 predicate，
文案逐字保留；区域许可（弃牌堆/弱点/反应窗口/每调查员 1 张）由 `playAccess(code)` 统一提供。
**不得再新增同类散字段**——新卡写 `playCondition`。

### 4.3 持续效果（A1）

```js
api.addEffect({
  duration: 'endOfPhase',            // endOfTest / endOfTurn / endOfPhase / endOfRound / whilstAttached / untilLeavesPlay
  label: '本阶段战斗 +2',
  modifiers: [{ target: 'skill:combat', amount: 2 }],
  abilities: [{ kind: 'reaction', trigger: 'defeatEnemy', label: '抽 1 张', effect: { type: 'draw', amount: 1 } }],
  sourceCode: '02186', sourceInstanceId: asset.id, controllerSeat: inv.seat,
})
```

效果记录写进 `state.effects[]`，纯 JSON、随存档往返、参与 `stateHash`；修正由 `modifiers.js` 的读点读取，
能力由引擎的 `descriptorSources` 枚举。过期只有一个入口 `expireEffects(state, timing)`（时长链
`endOfTest < endOfTurn < endOfPhase < endOfRound`，到点连同更短的时长一起清）；来源离开场上时
`removeEffectsFromSource` 清掉绑定记录。**效果能力只能用 `effect` 数据体，不能写 `resolve` 闭包**
（JSON 克隆会丢函数，注册时会直接报错）。

```js
// 被动 +1 战斗；击败敌人后横置抽 1
{
  code: '02080',
  modifiers: [{ target: 'skill:combat', amount: 1 }],
  abilities: [{
    kind: 'reaction', trigger: 'defeatEnemy', label: '横置：抽 1 张牌',
    criteria: [ownSeat()], cost: { exhaust: true },
    resolve: ({ inv, api }) => api.drawCards(inv.seat, 1),
  }],
}
```

**窗口**：`windows.js` 是唯一事实源，当前 51 个。常用事件窗口 `enemyAttack`、`opportunityAttack`、`defeatEnemy`、`wouldDefeat`、`enemySpawn`、`evadeSuccess`、`attackFail`、`cardDrawn`、`clueDiscovered`、`investigateSuccess`、`enemyEngaged`、`horrorPlaced`、`treachery`；检定类 `testBegins`、`tokenReveal`、`symbolRevealed`、`testWouldFail`、`skillTestFailed`；流程类 `phaseBegins`、`turnBegins`、`enemyPhaseBegins`、`scenarioStarts`；玩家窗口 `test.beforeCommit`、`test.afterCommit`、`mythos.afterEncounter`、`enemy.afterHunters`、`enemy.afterAttacks`、`upkeep.end`、`investigation.afterAction`。

**条件**：`criteria` 是 predicate 数组，全满足才可用，组合子来自 `matcher.js`（`ownSeat`、`atTrait`、`contextEnemy`、`all/any/none`…）。读点：`ctx.state` / `ctx.inv` / `ctx.source` / `ctx.context` / `ctx.helpers`。条件抛异常按"不满足"处理。
**`forced` 没有询问环节**：窗口一开就会对所有满足 `criteria` 的持有者结算，只希望当事人触发时必须写 `ownSeat()`。

**费用与上限**：

```js
cost: { action: true, exhaust: true, uses: 1, resources: 1, clues: 1, discardSelf: true }
limit: 'oncePerTest' | 'oncePerPhase' | 'oncePerRound' | 'oncePerTurn' | 'oncePerGame'
```

费用先整体校验再扣费，付不起返回 false 不留半付状态；上限记在 `state.abilityLimits`，**按实例 id 记账**（不是卡号，同名两份支援各用一次），读档后仍然有效，且 `legalMoves` / `validateMove` 同样尊重上限。

**修正**：

```js
modifiers: [
  { target: 'skill:combat', amount: 1 },
  { target: 'slot:arcane', amount: 1 },
  { target: 'playCost', amount: 1, condition: { sourceInHand: true } },
  { target: 'skill:willpower', amount: ({ controller }) => controller.horror },
]
```

`target`：`skill:<name>`、`skill:*`、`maxHealth`、`maxSanity`、`handSize`、`actions`、`slot:<slot>`、`playCost`、`enemyHealth`。`amount` 可为数字或函数。`audience`：`controller`（默认）或 `here`（同地点所有调查员）。文本被清空的来源整体跳过修正。

**从手牌打出**：`fromHand: true` 按 `playCost()` 扣资源并在结算后弃置；「放置入场」类用 `fromHand: true, noPlayCost: true`，由 `resolve` 自己移动这张牌。

**`ctx.api`**（79 个接口，不直接改状态；Phase 5 的 5c 批次新增 `investigate` / `evade` / `enemyFight` / `enemyEvade` / `maxHealth` / `cardSanity` / `attachToLocation` / `playCard` / `discardAsset` / `defeatEnemy`）：

```
info / random / choice
damage / damageEnemy / horror / directDamage / directHorror / healDamage / healHorror
gainResources / loseResources / drawCards / discardFromHand
discoverClue / placeClues / discoverAt / gainAction
moveInvestigator / moveEnemy / engage / autoEvade / fight / investigate / evade / enemyFight / enemyEvade
exhaust / ready / addUses / addEffect / effects
addDoom / addChaosToken / removeChaosToken / addTestValue / test
setShroudMod / addLocationTrait
enemiesAt / investigatorsAt / countControlled / cardName / locationName
isNonWeakness / assetsCannotReady / searchTop / putIntoPlay / finish
attachToLocation / playCard / discardAsset / defeatEnemy
maxHealth / cardSanity
```

**测试**：`tests/ability-layer.test.mjs` 是模板——`tests/core-fixture.mjs` 造局，`move()` 提交动作，`passUntilAbility()` 推进窗口，`chooseAbility()` 点选项，最后**从 `state` 重新读取**断言（`applyMove` 克隆嵌套对象，旧引用会失效）。提交前至少跑 `node --test tests/ability-layer.test.mjs` 与 `npm run test:node`。

---

## 5. 表达力缺口（按优先级）

写法统一为：**症状 → 要补什么**。P1 = 不加就接不了下一批卡；P2 = 明显省成本；P3 = 结构性问题。

| 编号 | 缺口 | 症状（现状） | 要补什么 | 优先级 |
| --- | --- | --- | --- | --- |
| **A1** | 持续效果与时长 | ✅ **已完成（Phase 1）**：`state.effects[]` + 6 种 `duration` + 统一 `expireEffects(state, timing)`；修正与能力枚举都读它。`addStatPhase`（02185）与 `fightOrFlight`（03155）已从裸字段迁到效果实体 | — | ✅ |
| **B1** | 目标枚举 | ✅ **已完成（Phase 1）**：`target: { kind, query, optional }`；`legalMoves` 逐目标展开、`validateMove` 同源校验、`ctx.target` 注入（01518 / 07025 已改用它） | — | ✅ |
| **C1** | 布尔/禁止/无视修正 | ✅ **已完成（Phase 2）**：`capability:<id>` / `ignore:<id>` 修正目标 + 读点 `capabilityBlocked()/ruleIgnored()/modifierBlocked()`；11 种能力禁止、4 种规则无视，全部已接线（`legalMoves`/`validateMove`/结算三处同源） | — | ✅ |
| **B3** | 检定续延与策略 | ✅ **已完成（Phase 2）**：`performTest().summary` + `state.lastTestResult` + 窗口 `ctx.result`；`api.retryTest`、`api.commitCards`（强制投入）；`test-result.js` 定义阶段词表（beforeCommit/afterCommit/tokens/results） | 投入上限仍沿用 `commitProfile` 既有字段 | ✅ |
| **D1** | 非玩家卡通道 | ✅ **已完成（Phase 3）**：描述子条目加 `scope`（`enemy`/`location`/`act`/`agenda`/`storyAsset`/`treachery`）；`descriptorSources` 按「场上实体」枚举；数值走 `entityModifierTotal`，布尔规则走 `entityRuleActive`（`cannot:attack`/`beAttacked`/`beDefeated`/`beDamaged`/`opportunityAttack`/`ignore:revealText`）；9 张敌人/地点条目迁移（`src/cards/encounter-abilities.js`） | 剧情支援/威胁区的事件能力仍可用，但尚未迁移条目 | ✅ |
| **C4** | 上限类型与归属 | ✅ **已完成（Phase 2）**：`limit: { scope, owner, count }`；10 种 scope（含 `perWindow/perAttack/perSearch/perAction/perCampaign`）、4 种 owner（`instance/investigator/player/group`）、`count` 支持多次；`describeLimit()` 给文案 | — | ✅ |
| **E1** | 文案与 i18n | `label` 是中文串；`engine.js` 里 868 处中文字符串字面量直接进事件日志与 AI 上下文，改文案会破坏测试断言 | 事件改 `{ id, params }` + `src/i18n/zh-CN.js`，投影时渲染 | **P1** |
| **D2** | 使用次数元数据 | `discardWhenEmpty` 只从旧 `EFFECTS` 读 | 注册表条目支持该字段，三条读点统一 | **P1**（小） |
| A2 | 替换与防止 | 只有 `context.cancelled` 一个开关，没有"防止 1 点伤害/改为……"的统一管线 | `wouldTakeHarm` 窗口 + `prevent(n)` / `redirect(target)` / `replace(effect)`，记录"本来源已防止" | P2 |
| A3 | "视为"（as if） | 无 as-if 概念，"视为在你所在地点"只能特判 | `state.asIf` 作用域 + 读点函数 `locationOf/handOf/turnOf` | P2 |
| A4 | 强制能力顺序与重开窗 | 按座位顺序执行，不重开窗口 | 排序键（主动玩家优先）+ 每轮重开上限 + `oncePerWindow`（scope 已有，重开逻辑未做） | P2 |
| B2 | 伤害/恐惧分配策略 | ✅ **已完成（Phase 2）**：`api.harm({ damage, horror, strategy })`，策略 `distribute/self/assetsFirst/soakFirst/assetsOnly`；与 `applyHarm` 共用管线 | 与 A2 的防止管线合并仍待做 | ✅ |
| B4 | 多人同时决定 | `requestChoice` 支持 `seats`，但没有"每人各选一次/共同支付"的描述子语义 | `kind: 'group'` + `cost: { groupClues, groupResources }` | P2 |
| B5 | 检索、看牌、牌序 | ✅ **已完成（Phase 2）**：`api.lookAt({ zone, count, arrange, returnStrategy, choose })` + `api.searchDeck({ trait/type/usesType })`；看牌/洗回走 `randomValue`，可重放 | >4 张的排列改为逐张选顶/底（Phase 5 交互） | ✅ |
| B6 | 区域、附属、牌去向 | ✅ **已完成（Phase 2）**：`api.moveCard({ code 或 id, from, to, attachTo, beneath, facedown })`；11 个目标区域，场上卡离开走 `leaveAsset` | 批量搬牌仍用 `searchDeck`/`lookAt` | ✅ |
| C2 | 关键词/特性/槽位授予 | ✅ **已完成（Phase 2）**：`add:trait` / `add:keyword` / `add:slot` / `add:skillIcon` + 读点 `collectGrants()`；已接入特性判定、`fast`/`noOpportunityAttack`、槽位、投入图标 | 敌人侧关键词（猎手/反击授予）属 D1 | ✅ |
| C3 | 费用表达式 | ✅ **已完成（Phase 2）**：数字 / 函数 / 声明式表达式（`per/amount/offset/min/max/filter/x`）；`cost.js` 统一求值 + `describeCost` 预览；校验与扣费共用一份结果 | — | ✅ |
| C6 | 记录与历史 | 没有"本回合是否已发现线索/受过伤害"的统一记录 | `state.history`（round/phase/turn 三档）+ `matcher.history(...)` | P2 |
| D4 | 战役层结果 | ✅ **已完成（Phase 3）**：`resolution` 可返回 `effects[]` 声明式条目（`record`/`recordUnion`/`recordRemove`/`trauma`/`xp`/`investigatorStatus`/`failed`/`storyCard`/`chaos`/`flag` + `when` 条件），由 `applyResolutionResults` 统一结算并按 `recordSchema` 校验；NOTZ 三关结局已声明化 | 幕间的战役专用解释器（补给/遗物）仍在 `campaign-effects.js` | ✅ |
| E2 | 覆盖度报告 | 能枚举"注册了哪些能力"，但没有"目录有这张卡、能力层没实现"的清单 | `tools/audit-abilities.mjs` 输出 `{ total, implemented, catalogOnly, simplified }`，进 CI | P2 |
| C5 | 数值计算表达式 | `amount` 可为函数，但计算过程不入存档、不可展示，AI 只看到结果 | `calc: { sum, multiply, from }` 声明式对象，预览可解释"为什么是 3" | P3 |
| D3 | 剧本结构声明化 | ✅ **已完成（Phase 3 首批）**：`content/scenario-declaration.js` 的 `declareScenario({ setup, data, hooks })` 把布置（起始地点/地点清单/随机变体/敌人/遭遇牌库）与关卡常量抽成数据；NOTZ 三关已声明化 | 推进条件与 reveal 的 `campaignRule`（46 处）仍走命令式钩子，属 Phase 5 批次 | ✅（首批） |

**难卡基准集**（尺子：这些能用描述子写出来，说明层够用了）：

| 卡 | 难在哪 | 缺口 |
| --- | --- | --- |
| 03012 彩绘世界 | 把弃牌堆的牌当手牌打出（复制/别名） | A3、B6 |
| 03264 计划 | 牌上牌、从附属堆打出 | B6 |
| 02088 不能触碰 | 让盟友文本整体空白 | C1、A1 |
| 04062 瓦卢西亚 / 04078 蝮蛇 | 横置时仍能反击/攻击 | C1（读取侧） |
| 03149 查尔斯·格雷 | 同地点道具折扣（群体） | C3、B4 |
| 01531 智慧古书 / 01561 探知术 | 看顶 N 张、选 1、洗回/排列 | B5 |
| 07013 密教残页 | 手牌/场上的负面修正与"不能打出" | C1 |
| 06021 一瓣缟玛瑙 | 多张同名卡组合后放场外 | B6、C4 |
| 07026 黑暗仪式 | 封印标记 + 强制付费或弃置 | A4、C1 |
| 05300+ 可定制卡 | 升级时选装 | C4、D4 |
| 07017 / 05025 / 02040 / 03009 | 已用描述子实装，作为**对照组** | ✅ |

---

## 6. 分阶段路线

每阶段有出口门禁；**门禁不过不许开下一阶段**。

### Phase 0 · 冻结与守卫（1 周）—— ✅ 已完成

1. `tests/architecture-guard.test.mjs`（纯 node，无新依赖）：卡号白名单、`EFFECTS` 键冻结、`kind` 枚举、分层 import、产物同步、死分支、卡包登记。
2. `audit/ability-coverage.json` + `tools/audit-abilities.mjs`：指标、通道分布、逐卡通道。
3. `audit/ability-migration.json`：迁移工作单（5a 引擎码 / 5a `engine:` 标记卡 / 5b hybrid / 5c 逃生卡）。
4. 明文规定已落地为机械约束：新增卡只许写描述子；新增引擎分支或 `EFFECTS` 条目会让守卫失败，必须人工评审后 `--allow-growth`。

**门禁结果**：守卫 6/6 通过（约 0.1s，已在 `fast` tier）；`cards:audit --check` 与实现一致；
`npm run test:fast` 跑 1,952 个用例、1,944 通过、**8 失败**，失败集中在四个文件：
`rules-n3`（跨关续算 5 条）、`campaign-http-n4`（HTTP 存档 1 条）、`checkpoint-rewind`（检查点分支 1 条）、
`carcosa-implementation-gaps`（03310 1 条）。这些是本次改动之前就存在的引擎/战役行为失败——
四个文件都不 import 本次改过的任何模块，属于既有漂移，不是 Phase 0 引入的。
后续阶段的基线就按这 4 个文件 / 8 条记账，新增失败一律视为回归。

### Phase 1 · 生命周期模型 + 状态基础（2–3 周）—— ✅ 已完成

新增 5 个生命周期 `kind`（`played` / `commit` / `weakness` / `entersPlay` / `leavesPlay`），把对应读点从 `EFFECTS` 切到注册表；`state.effects[]` + `duration` + 统一过期点（A1）；`target` 枚举（B1）；`playCondition` 单一读点（10 个旧字段收敛）；`STATE_SCHEMA_VERSION` 升 7 + `save-migration.js` 迁移。

**交付清单**：

| 项 | 产物 | 读点 |
| --- | --- | --- |
| 五个生命周期钩子 | `ability.js` 的 `ABILITY_KINDS`（12 种，含 5c-39 新增的 `setup`）+ `card-abilities.js` 试点 | `lifecycle.playedEffect/commitProfile/weaknessProfile/entersPlayEffect/leavesPlayEffect` |
| 持续效果（A1） | `src/engine/effect-state.js`（6 种 duration、`expireEffects`、来源绑定、效果能力） | `modifiers.js`（`activeEffects` 注入）、引擎 `descriptorSources` |
| 目标枚举（B1） | `src/engine/targets.js`（5 种 kind、query、optional） | `legalMoves` / `validateMove` / `ctx.target` |
| 打出条件收敛 | `src/engine/play-condition.js`（旧 10 字段 → predicate + 文案，`playAccess`） | `validateMove('play')`、条目级 `playCondition` |
| 存档结构 | `STATE_SCHEMA_VERSION 7` / `RULES_VERSION n6.0` + `save-migration` 的 `[6,n5.5] → [7,n6.0]` | 旧临时修正折算成效果记录 |

**迁移记录**：`played` 6 张（01088/02008/02194/02105/02186/02273）、`commit` 4 张（02150/02268/02299/02271）、
`weakness` 2 张（01096/01097）、`entersPlay` 1 张（04021）、`leavesPlay` 1 张（03315）。
`EFFECTS` 413→406，描述子 50→58；引擎卡号字面量保持 180（**新增卡号分支仍为 0**）。
测试：`tests/card-lifecycle.test.mjs`（13 条）、`tests/phase1-state.test.mjs`（9 条）。
模型规格：[`card-model.md`](card-model.md)。

**门禁结果**：

- **10 张 event/skill 卡**已在不改引擎的前提下用描述子重写（比门禁要求"先迁 10 张"达标）；旧 DSL 里还剩 163 张 event/skill 条目，可随时按同一模板批量推进。
- 存读档往返一致：`state.effects` 参与 `stateHash`，JSON 往返哈希不变；schema v6 旧存档自动迁移出效果记录。
- 架构守卫 11 种 `kind` 冻结、`EFFECTS` 白名单收缩 7 项；`npm run test:fast` 为 1971/1979，失败恰为 Phase 0 记账的 4 个文件 / 8 条既有漂移（slow tier 另有 10 条既有失败，已在 `HEAD` 上复现，与本次改动无关）。

> 没有这 5 个生命周期 `kind`，"300 张旧 DSL 卡的机械迁移"不成立——这是统一路线的**第一个硬前置**，现已就位。

### Phase 2 · 语义原语（2 周）—— ✅ 已完成

按 §5 顺序：C1 → C3 → C4 → C2 → B2 → B3 → B5 → B6，全部落地；交付说明与用法见
[`phase2-primitives.md`](phase2-primitives.md)。

**交付清单**：

| 项 | 产物 | 读点 |
| --- | --- | --- |
| C1 布尔/禁止/无视修正 | `modifiers.js` 的 `capability:<id>` / `ignore:<id>` 目标（11 种能力、4 种规则） | `capabilityBlocked()` / `ruleIgnored()` / `modifierBlocked()`；已接线到 `legalMoves`/`validateMove`/反击/警戒/猎手/借机攻击 |
| C2 特性/关键词/槽位/图标授予 | `add:trait` / `add:keyword` / `add:slot` / `add:skillIcon` | `collectGrants()` → `effectiveTraits()` / `cardKeyword()` / `commitIcons()` / `slotBonus()` |
| C3 费用表达式 | `src/engine/cost.js`（`per/amount/offset/min/max/filter/x`，数字与函数仍可用） | `normalizeCostValues()`；`canAffordAbility` / `payAbilityCost` / 行动文案共用一份求值 |
| C4 上限作用域与归属 | `src/engine/limits.js`（10 种 scope、4 种 owner、`count`） | `limitUsed()` / `markLimitUsed()` / `describeLimit()`；`ability.js` 再导出 |
| B2 伤害/恐惧分配策略 | 引擎 `assignHarm` 的 strategy 参数（5 种策略） | `api.harm({ damage, horror, strategy })` |
| B3 检定结果契约 | `src/engine/test-result.js`（阶段词表 + 标准结果） | `performTest().summary` / `state.lastTestResult` / 窗口 `ctx.result` / `api.retryTest` / `api.commitCards` |
| B5 看牌与检索 | `src/engine/look.js` + 引擎 `lookAt()` / `searchDeck()` | `api.lookAt(...)` / `api.searchDeck(...)` |
| B6 区域与牌的去向 | `src/engine/zones.js` + 引擎 `moveCardTo()` | `api.moveCard({ code 或 id, from, to, attachTo, beneath, facedown })` |

顺带补齐的两件事：

1. `kind: 'played'` 的描述子可以**只带 `resolve`**（效果 DSL 表达不了时），读点仍是 `lifecycle.playedEffect()`；
2. 事件卡的 `fast` / `noOpportunityAttack` 从 `EFFECTS` 顶层字段搬进描述子（`cardPlayFlag()` 单一读点）。

**门禁结果**：

- **21 张逃生卡**已用描述子重写（门禁要求 20 张），逐卡对照表（卡号 → 旧原语 → 新写法）见
  [`phase2-primitives.md` §3](phase2-primitives.md)；旧 `EFFECTS` 条目与 `engine.js` 的
  `if (effect.action === '…')` 分支同步删除（222 行）。
- 指标：引擎卡号 **180 → 166**、`EFFECTS` **406 → 385**、逃生卡 **114 → 93**、描述子条目 **58 → 79**；
  白名单收缩 14 + 21 项，**没有新增任何卡号分支或 `EFFECTS` 条目**。
- 测试：新增 `tests/phase2-primitives.test.mjs`（19 条，覆盖八项原语的读点/接线 + 门禁断言）；
  `npm run test:fast` 为 1990/1998，失败仍是 Phase 0 记账的 4 个文件 / 8 条既有漂移
  （`rules-n3` 5、`campaign-http-n4` 1、`checkpoint-rewind` 1、`carcosa-implementation-gaps` 1）；
  `assets` tier 的 4 条失败已在 `HEAD` 快照上逐条复现（见 §1 的回归基线）。
- 迁移安全：21 张卡的原有逐卡验收用例（TFA / Carcosa player acceptance）全部保持绿，
  这是"行为零变化"的直接证据。

> Phase 2 之后，§5 里**不需要战役插件的部分**（B 类 59 项、C 类 37 项）都已解锁；
> 剩下挡住迁移的只有 D1（非玩家卡通道）与 A2/A3（替换与视为）——它们分别属于 Phase 3 与下一批难卡。

### Phase 3 · 内容来源统一（2–3 周）—— ✅ 已完成

`descriptorSources` 扩展（D1）→ 剧本声明化（D3）→ 战役结果声明化（D4）。

**交付清单**：

| 项 | 产物 | 读点 |
| --- | --- | --- |
| D1 非玩家卡通道 | `ability.js` 的 `ABILITY_SCOPES`/`NON_PLAYER_SCOPES`（条目的 `scope`）+ `src/cards/encounter-abilities.js`（9 张敌人/地点） | `descriptorsSources` 按场上实体枚举；`entityModifierTotal`（`enemyFight/enemyEvade/enemyHealth/locationShroud/locationClues`）与 `entityRuleActive`（`cannot:attack`/`beAttacked`/`beDefeated`/`beDamaged`/`opportunityAttack`/`ignore:revealText`） |
| D1 引擎去分支 | `enemyFightValue`/`enemyEvadeValue`/`enemyCanBeDefeated`/`enemyCannotAttack`/`enemyCannotBeAttacked`/`enemyCanOpportunityAttack`/`damageEnemy`/`revealLocation`/`locationShroud` 的写死卡号与剧本钩子改为「卡面声明优先、剧本钩子兜底」 | 尖叫的拜亚基从 `engine.js` 移出（`enemy.code === 'screechingByakhee'` 分支删除） |
| D3 剧本声明化 | `content/scenario-declaration.js`：`declareScenario({ id, setup, data, hooks })`；`setup` 支持 `startLocation`（含记录分支）、`locations`（固定/全量/随机变体/池）、`enemies`、`deck`、`startRevealed` | `behavior` 仍与旧钩子同形，引擎无需知道关口是否声明化 |
| D3 迁移 | NOTZ 三关（`theGathering`/`theMidnightMasks`/`theDevourerBelow`）改为声明 + 少数钩子（`actions`/`describe`/`resolution`） | `tests/notz-n4`、`campaign-n4`、`scenario-n4b`、`flow-n5` 全绿 |
| D4 战役结果声明化 | `campaign-effects.js` 的 `applyResolutionResults`（`record`/`recordUnion`/`recordRemove`/`trauma`/`xp`/`investigatorStatus`/`failed`/`storyCard`/`chaos`/`flag` + `when`）；`resolution` 返回 `effects[]` | `finishScenario` 在记录快照**之前**结算，`recordsAfter`/`story.js` 的差分口径不变 |
| 守卫与指标 | `audit-abilities.mjs` 新增 `nonPlayerCards` / `behaviorLines` / `declaredScenarios`；`architecture-guard.test.mjs` 新增两条：非玩家条目只能声明实体目标、`behaviorLines ≤ 14831` 且 `declaredScenarios ≥ 3` | `npm run cards:audit` |

**门禁结果**：

- **新增一个敌人/地点的能力不再写 `behavior.js`**：`04086`（不能攻击/不能被攻击/+1）、`04072`（此处蛇族 +1 攻击）、`04074`（复仇决定帷幕）、`04095`（毁灭 +1）、`03103`/`03222`/`03096`（战斗值）与尖叫的拜亚基已全部改由卡号条目声明，`theUntamedWilds`、`heartOfTheEldersPart1` 与 TFA/Carcosa 的 `encounter-rules.js` 同步删掉对应钩子分支。
- **`behavior.js` 总行数开始下降**：基线 14,841 → 14,831 行（含 Dunwich `later-behaviors.js`），NOTZ 三关改为声明（`declaredScenarios = 3`）；行数守卫固定在 `14831`，新增流程必须写声明。
- **指标**：`nonPlayerCards = 9`（敌人 7 / 地点 2），玩家卡账本不受影响（`descriptor=75 legacy=286 engine=5 hybrid=2 escape=93`，`engineCodes=166`、`EFFECTS=385` 与 Phase 2 持平）。
- **测试**：新增守卫 2 条、`tests/phase3-content.test.mjs`（14 条，覆盖 D1 读点/注册守卫/引擎接线、D3 声明、D4 结算与校验），并改造 4 条逐卡验收用例，使断言从「钩子返回值」改为「引擎统一读点」（`entityModifierTotal`/`entityRuleActive`）；`npm run test:fast` 为 **2006/2014**，8 条失败恰为 Phase 0 记账的既有漂移（`rules-n3` 5、`campaign-http-n4` 1、`checkpoint-rewind` 1、`carcosa-implementation-gaps` 1）。
- **已知漂移（非本次引入，已在 `HEAD` 快照上逐条复现）**：`notz-n4` 的「四个使者组」、`campaign-n4` 的 8 条（1 条创伤 + 7 条失败流程）属于 slow tier 的既有失败，Phase 3 前后表现一致；`carcosa-all-card-acceptance.json` 因改造验收用例需随 `node tools/audit-carcosa-all-cards.mjs --write` 一起提交。

### Phase 4 · 重放安全网（2 周，可与 1–3 并行）—— ✅ 已完成

`{ seed, moves[] }` 日志 + 稳定 `state hash`（键排序后哈希）+ `replay(seed, moves, until)` + golden replay 用例。
交付与门禁证据见 [`phase4-replay.md`](phase4-replay.md)。

**交付清单**：

| 项 | 产物 | 读点 / 命令 |
| --- | --- | --- |
| 日志与指纹 | `src/engine/replay.js`：`captureReplayLog` / `stateHash`（`STATE_HASH_VERSION 2`）/ `REPLAY_HASH_OMITTED` | `state.actionLog`、`applyMove` |
| 重放与自检 | `replayLog(log, { until, observe })` / `replayHashes` / `replayHash` / `verifyReplay` / `stateDiff` | 迁移对比、存档体检、失败定位 |
| 撤销地基 | `rewindTo` / `undoMoves` / `undoDepth`（截断日志后重放，保留检查点分支的 revision 偏移） | 引擎层；UI 未做 |
| 建局输入完整性 | `settings.seatInvestigators` + `state.setup.seatInvestigators`（锁定 AI 选人结果）、`aiStoryAwareness` 入日志、`continuation.move` 去掉展示字段 | `createGameState` / `captureReplayLog` / `resolution.js` |
| golden replay | `tests/fixtures/replay/golden-replays.json`（10 局 / 529 步 / 530 个逐步指纹）+ `tests/replay-golden.test.mjs` | `npm run replay:fixtures` |
| 对局驱动器与 recipe | `tools/replay-games.mjs`（p6 策略 / 通用策略 / 随机走子器，只走合法动作） | golden 采集、随机门禁共用 |
| 迁移对比工具 | `tools/replay-fixtures.mjs`：`--write` / `--check` / `--verify` / `--baseline` / `--compare` | Phase 5 每批的"行为零变化"证据 |
| 门禁用例 | `tests/replay.test.mjs`（14 条，fast）、`tests/replay-fuzz.test.mjs`（2 条，slow：100 局随机对局 + 5,000 步随机走子器） | `npm run test:fast` / `test:slow` |

**门禁结果**：

- **门禁 1（任一现有测试局可重放出相同 hash）**：golden 基线 10 局覆盖 4 战役 / 5 关卡 / 3 种 `uiState`，
  每局逐条比对 530 个逐步指纹全部一致；`--verify` 用驱动器**实时重跑**同一批 recipe 后也一致。
  其中 4 局就是 `tests/p6-content.test.mjs` 用的"纯合法动作从局外完成集结"的同一颗棋子（r1 / r2 / 失败 / 撤退）。
- **门禁 2（100 局随机对局 replay 与实时执行一致）**：100 局 / 2,039 步 / 923 次 `choose`，4 个战役轮转、
  1–4 席、严格/简化混跑，逐步一致率 100%；抽查 10 局的日志 JSON 往返同样一致。
- **随机走子器**：跨 67 局累计 5,018 步，逐条断言版本单调、行动点/资源非负、线索守恒、毁灭非负、
  引用完整、生命区间、卡号可解析、JSON 幂等、关键步重放；并**发现并修复**两处"合法动作崩溃"：
  `enemyForTarget` 无目标时抛错、`03033 解锢灵魂`把无目标的法术列为候选（见 [`phase4-replay.md`](phase4-replay.md) §6.3）。
- **回归**：`fast` 2028/2020（8 条既有漂移）、`slow` 341/330（11 条既有失败，已在撤销 Phase 4 改动的副本上逐条复现）。

> **这是 Phase 5 的前置**：没有它，批量迁移只能靠"看测试绿不绿"，无法证明"行为没变"。它同时解锁撤销、bug 复现、AI 决策回归。

### Phase 5 · 迁移（4–6 周，按批次）—— 🚧 进行中（工具 + 5b 主体 + 5c 三十九批全部完成 ✅ + 5a 五批已交付）

| 批次 | 范围 | 每批规模 | 门禁 | 状态 |
| --- | --- | --- | --- | --- |
| 5a | 引擎卡号分支（132 个卡号，先做出现 ≥3 次的 43 个） | 5–10 处 | replay hash 不变 + 该卡测试绿 | 🚧 五批：死分支 4 段（5a-1）、弱点敌人关键词 3 码（5a-2）、清空文本 1 码（5a-3）、议程/中毒/提示例外 3 码（5a-4）、卡号分支 → 条目级被动标记 1 码（5a-5）；`card-rules.test.mjs` 锁读点 |
| 5b | 旧 DSL 卡机械迁移（300 张，脚本生成草稿） | 20–40 张 | fast tier + 账本更新 | 🚧 235 张（机械 154 + 反应 35 + 天赋 15 + 被动 20 + 规则字段 6 + 封印附属 5） |
| 5c | 逃生卡（93 张，按战役：Carcosa → TFA → Dunwich） | 2–15 张 | 该战役审计 + replay | ✅ 三十九批 93 张（Carcosa 48 / TFA 40 / 跨战役 5） |

**每批只做一件事**：迁卡的批次不加新机制，加机制的批次不迁卡。

> 5b 的"机械迁移"指**搬槽位，不改写法**：`event` / `skill` / `passive` / `weakness` 里的数据对象原样搬到 `hooks.played` / `hooks.commit` / `modifiers` / `hooks.weakness`，仍然可枚举、可解释给 AI。**不要**在迁移时顺手改写成 `resolve` 闭包（见 §7 反例）。

**交付清单（Phase 5 已交付部分）**：

| 项 | 产物 | 读点 / 命令 |
| --- | --- | --- |
| 迁移工具 | `tools/migrate-card.mjs`（判定/生成/删条目/登记卡包）、`tools/scaffold-card.mjs`（测试骨架）、`tools/cards-migrate.mjs`（批次门禁编排）、`tools/rehash-acceptance.mjs`（验收账本证据哈希） | `npm run cards:migrate` / `cards:migrate:list` / `cards:scaffold` |
| 迁移目标 | `src/cards/ability-migration-batches.js`（按期次分组的生成描述子）+ `audit/migration-batches.json`（批次账本） | `card-abilities.js` 的 `byCode` 合并 |
| D2 使用次数元数据 | `ability.js` 条目字段 `discardWhenEmpty` | `newPlayerAssetInstance` / `assetEffect` / `executeDescriptor` |
| 卡面关键字与行动种类 | 条目级 `fast` / `noOpportunityAttack`（走 `lifecycle.playFlag`）+ 描述子 `countsAs`（走 `actionKind`） | 5c-2/5c-3 |
| `ctx.api` 薄包装 | `attachToLocation` / `playCard` / `discardAsset` / `defeatEnemy` / `investigate` / `evade` / `enemyFight` / `enemyEvade` / `maxHealth` / `cardSanity` / `cardType` / `healAsset` / `cardFactions` / `enemyTestModifier` / `preventNonEliteAttacks` / `removeEnemy` / `shuffleIntoEncounterDeck` / `reactionContext` / `redirectEncounter` / `cancelCurrentAttack` / `prepareEvadeBonus` | 5c-1…5c-8 |
| 反应接线 | 描述子字段 `legacyReaction` + `triggerReaction` 的合并枚举 + `openAbilityWindow` 去重 + 新窗口 `chaosTokenRevealed` | 5b-6/6b/6c，28 张 |
| 天赋接线 | 条目级 `freeTriggers` / `minimumHandForBoost` / `composure`（`assetEffect` 合并）+ 评分与沉静读点 | 5b-7，15 张 |
| 打出后去向接线 | 条目/描述子级 `playableFromDiscard` / `shuffleBackAfterPlay` / `removeAfterPlay` + `api.fromDiscardCode` / `api.shuffleDiscardIntoDeck` | 5c-10，3 张 |
| 被动接线（过渡） | 条目级 `passive`（raw 搬运）+ `legacyStatDelta`/`doPlay`/被动布尔判定/`scoreCard` 四处读点 | 5b-6d/8a/8b，22 张 |
| 规则字段接线 | 条目级 `healSelfHorrorAfterTurn` / `forcedUpkeepPayOrDiscard` / `defeatedDamage` / `redirectOneHorrorToSelf` / `cannotLeavePlay` | 5b-9，6 张 |
| 封印与附属接线 | 条目级 `sealOnEnter` / `substituteSealedElderSign` / `attachTo` / `onAttach` + 四处读点回落 | 5b-10，5 张 |
| 混合接线 | 条目级 `exhaustOnEnemyDefeatedHealHorror` +「被动 + legacyReaction」组合 | 5b-11，5 张 |
| 5c 追加接线 | `api.startTest` / `skipTestTokens` / `skipNextTestTokens` / `playCost` / `cardName` / `cardTraits` / `markSleightOfHand` / `addTestPendingBonus` / `addExtraOnSuccess` / `addTrauma` / `recruitAllyFromDiscard` | 5c-13…5c-15 |
| 5b 主体 | 154 张：`skill`→`commit` 40、`weakness` 27、`event`→`played` 37、`abilities`→`action` 19、`uses`+`abilities` 31 | 读点不变，见 [`phase5-migration.md`](phase5-migration.md) §3 |
| 5b 反应三批 | 28 张：Dunwich/core 纯数据反应 + Carcosa/TFA「反应 + 主动能力」混合卡 | [`phase5-migration.md`](phase5-migration.md) §3.4 |
| 5c 十批 | 50 张：地点附属/遭遇连抽/牌库检索 7、调查与躲避 8、武器与检定加值 5、事件与支援 4、移动与治疗 5、handler 改写 6、新包装交互 3、反应窗口快速事件 3、TFA 反应窗口 5、从弃牌堆打出 3 | [`phase5-migration.md`](phase5-migration.md) §4 |
| 5c-18 | 5 张「纯 handler」逃生原语改成 `resolve`（田野调查 / 扒手 / 阿登森林护甲 / 追忆未来 / 再试一次）+ 5 个新 api（`phaseTestBonus` / `drawCardsLogged` / `cancelDamage` / `nameChaosToken` / `recallCommittedSkill`） | [`phase5-migration.md`](phase5-migration.md) §4.26 |
| 5c-19 | `entersPlay` 的 resolve 读点（`LIFECYCLE_RESOLVE_KINDS`）+ 2 张卡（求助盟友 / 爱丽·霍洛维兹）+ 4 个新 api（`topDeckCodes` / `attachCardFromDeck` / `shuffleDeck` / `returnAssetToHand`） | [`phase5-migration.md`](phase5-migration.md) §4.27 |
| 5c-20 | 条目级 `playRestriction` / `teamLimit` 读点 + 走私货物（牌库顶/弃牌堆两区查找） | [`phase5-migration.md`](phase5-migration.md) §4.28 |
| 5c-21 | `api.cardHasLegalTarget` + 解锢灵魂（折扣打出另一张法术） | [`phase5-migration.md`](phase5-migration.md) §4.29 |
| 5a-5 | 卡号分支 → 条目级被动标记（03010 缜密分析：`passive.analyticalMind` / `passive.remoteCommit`），引擎不再认 03002 + 03010 的卡号组合 | [`phase5-migration.md`](phase5-migration.md) §4.30 |
| 5c-22 | 反应窗口快速事件 + `api.spendClueToLocation`：预警（花 1 线索取消诡计） | [`phase5-migration.md`](phase5-migration.md) §4.31 |
| 5c-23 | 遭遇牌库检索 + `api.encounterEnemies` / `api.spawnEncounterEnemy`：追猎 | [`phase5-migration.md`](phase5-migration.md) §4.32 |
| 5c-24 | 打出后变成场上卡 + 封印标记（`becomesAsset` / `substituteSealedToken` 读点）：危险预感 | [`phase5-migration.md`](phase5-migration.md) §4.33 |
| 5c-25 | 「本局一次」标记 + 毁灭读写（`api.gameFlag` / `setGameFlag` / `doom` / `removeDoom`）：古代遗物 | [`phase5-migration.md`](phase5-migration.md) §4.34 |
| 5c-26 | `api.chooseEnemy` + 修正「空 effect 必抛错」：暗示（先选敌人再按指定技能躲避） | [`phase5-migration.md`](phase5-migration.md) §4.35 |
| 5c-27 | 胜利区搬运（`api.buryEnemyInVictory`）：掩埋 | [`phase5-migration.md`](phase5-migration.md) §4.36 |
| 5c-28 | 充能支援判定与离场（`api.isChargeAsset` / `canLeavePlay`）：灵语人 / 愤怒之灵 | [`phase5-migration.md`](phase5-migration.md) §4.37 |
| 5c-29 | 研究记录与充能类型（`api.recordResearch` / `setUsesType`）：古代雕文 | [`phase5-migration.md`](phase5-migration.md) §4.38 |
| 5c-30 | 附属到地点 + 条目级 `shroudAsOne`：骷髅钥匙 | [`phase5-migration.md`](phase5-migration.md) §4.39 |
| 5c-31 | 攻击后反击（`api.isEnemyInPlay` + `api.fight` 的 `noSpend`）：求生匕首 | [`phase5-migration.md`](phase5-migration.md) §4.40 |
| 5c-32 | 角色切换 / 替人挨打（`switchRole` / `setRoleDiscount` / `className` / `enemyAttackByCard`）：即兴表演、英勇救援 | [`phase5-migration.md`](phase5-migration.md) §4.41 |
| 5c-33 | 额外弹药换额外揭示（`api.addExtraChaosChoicesToTest`）：吃子弹 | [`phase5-migration.md`](phase5-migration.md) §4.42 |
| 5c-34 | 附属区当手牌打出（条目级 `cardBackpack` + `setAttachedCards` / `takeFromDeck`）：背包 | [`phase5-migration.md`](phase5-migration.md) §4.43 |
| 5c-35 | 地点物品折扣 / 同归于尽（`setLocationItemDiscount` / `engagedEnemies` / `setDamageToMax` / 条目级 `quietPlay`）：查尔斯·罗斯、同归于尽！ | [`phase5-migration.md`](phase5-migration.md) §4.44 |
| 5c-36 | 免于一死 / 整段回滚（`disengageAll` / `discardAllThreats` / `softEndTurn` / `rewindLastAction`）：死里逃生、时间曲折 | [`phase5-migration.md`](phase5-migration.md) §4.45 |
| 5c-37 | 滴答计数 / 封印「0」的攻击（`addClicks` / `sealedTokensFrom` / `releaseSealedToken` + `maxClicks`）：时间借取、虚空碎裂 | [`phase5-migration.md`](phase5-migration.md) §4.46 |
| 5c-38 | 复制弃牌堆的洞察事件并重放（`discardPiles` / `playCostOf` / `exileFromDiscard` / `replayPlayedCode`）：遗觉记忆 | [`phase5-migration.md`](phase5-migration.md) §4.47 |
| 5c-39 | 附属区当手牌打出 + 开局检索（`cardPlan` / `setup` kind / `attachToHostByCode`）：原定计划 —— **5c 收官** | [`phase5-migration.md`](phase5-migration.md) §4.48 |
| 5b-8 | 攻击转移 / 入场自选技能 / 神话结束弃掉（`redirectAttackToAsset` / `forcedMythosEndDiscard` / `setStatOverride`）：安奎娜、戴红手套的男子 | [`phase5-migration.md`](phase5-migration.md) §4.49 |
| 5b-12 | 战役规则型被动（`adaptableSwaps` / `obolContract`）：适应性、卡戎的银币 | [`phase5-migration.md`](phase5-migration.md) §4.50 |
| 5b-13 | 费用型主动能力（`discardSelf` / `assetDamage`）：巡警 ×2、警徽 | [`phase5-migration.md`](phase5-migration.md) §4.51 |
| 5b-14 | 剧情资产的持续修正（`passive.conditionalStats`）：褴褛披风 —— **5b 收尾** | [`phase5-migration.md`](phase5-migration.md) §4.52 |
| 5a-6 | 卡号分支 → 条目级规则标记（`tomeHandSlotsPerCopy` / `clicksToActions`）：书虫、时间借取 | [`phase5-migration.md`](phase5-migration.md) §4.53 |
| 5a-7 | 书位排除 / 自食其力（`discardIfControllingAlly`）/ 入场额外充能 | [`phase5-migration.md`](phase5-migration.md) §4.54 |
| 5a-8 | 结局创伤 / 谈判降难度 / 遗物默认码（`mentalTraumaIfCounters` / `physicalTraumaIfUsesBelow` / `negotiationDifficultyReduction` / `RELIC_OF_AGES_CODE`） | [`phase5-migration.md`](phase5-migration.md) §4.55 |
| 5a-9 | 雷克斯的诅咒 / 奇异溶液（`rerollRevealedTokenOnSuccess`；研究能力只按实例 id） | [`phase5-migration.md`](phase5-migration.md) §4.56 |
| 5a-10 | 随机基础弱点卡号 / 古代雕像（`RANDOM_BASIC_WEAKNESS_CODE` / `chaosTokenExtraReveal`） | [`phase5-migration.md`](phase5-migration.md) §4.57 |
| 5a-11 | 消防斧提示来源 / 勘查额外行动（`INVESTIGATE_EXTRA_ACTIONS`） | [`phase5-migration.md`](phase5-migration.md) §4.58 |
| 5a-12 | 弱点结算迁到能力层（`weakness.resolve` 通道 + `revealChaosTokens` / `weaknessExhaustsAssets`） | [`phase5-migration.md`](phase5-migration.md) §4.59 |
| 5a-13 | 敌人卡面特殊规则数据化（`ENEMY_RULE_FLAGS`）：猎手夜魇、伊斯观察者 | [`phase5-migration.md`](phase5-migration.md) §4.60 |
| 5a-14 | 地点计数遭遇卡 / 诱饵卡号 / 梦魇弱点（`LOCATION_COUNTER_TREACHERY`、`scenarioDiscardTop`） | [`phase5-migration.md`](phase5-migration.md) §4.61 |
| 5a-15 | 附着型弱点（6 个 api + `SMITE_THE_WICKED_CODE` / `SEARCHING_FOR_IZZIE_CODE`）：惩戒邪恶、寻找伊兹 | [`phase5-migration.md`](phase5-migration.md) §4.62 |
| 5a-16 | 摧毁近战武器的敌人 / 失手转伤（`ENEMY_RULE_FLAGS` + 效果数据 `code`） | [`phase5-migration.md`](phase5-migration.md) §4.63 |
| 5a-17 | 弱点升级的替换卡号（`WEAKNESS_UPGRADE_CODES`） | [`phase5-migration.md`](phase5-migration.md) §4.64 |
| 5a 四批 | 4 段死分支清理 + 卡号级规则数据搬到 `src/cards/card-rules.js`（敌人弱点关键词 / 清空文本 / 反应提示例外 / 中毒威胁 / 议程手牌惩罚），`tests/card-rules.test.mjs` 锁读点；守卫 `tools/audit-dead-primitives.mjs` | [`phase5-migration.md`](phase5-migration.md) §4.0 / §4.17 / §4.18 |
| 用例 | `tests/card-rules.test.mjs`（2 条）、`tests/migration-tools.test.mjs`（8 条）、`tests/phase5-migration.test.mjs`（84 条）、`architecture-guard`（10 条，含死分支与卡包登记守卫），均在 `fast` tier | `npm run test:fast` |

**门禁结果（Phase 5 阶段性实测）**：

- **每批 replay 指纹不变**：`--baseline`（Phase 5 开工前，10 局 / 529 步）与 `--compare` 逐批执行，
  5b-1…5b-7、5b-6/6b/6c/6d、5c-1…5c-18、5a-1…5a-4 全部输出「与基线逐条一致（行为零变化）」；`npm run replay:fixtures` 仍是 530 个逐步指纹全绿。
- **指标单调下降**：`EFFECTS` 385 → **57**、通道 legacy 286 → **51**、descriptor 75 → **404**、逃生卡 93 → **0** ✅、
  `effectsTopLevelFields` 69 → **33**、`engineCodes` 166 → **73**（5c 带走 58 个、5b 带走 4 个、5a 十七批 43 个）。
- **白名单只收缩**：EFFECTS 白名单 385 → 57 项，engine 码白名单 166 → 73 项（`--write` 无新增；03143 与 03195/04197 回退时各用过一次 `--allow-growth`）。
- **新增失败 0 条**：`fast` 8 条既有失败、`slow` 11 条既有失败（与 Phase 0/4 记账一致）、`assets` 4 条既有失败。
- **被门禁抓住并修掉的漂移**（详见 [`phase5-migration.md`](phase5-migration.md) §5.2）：
  ① `dunwichSupport` 迁卡后包清单的「有行为实现」判定失效 → 自动牌组牌池少 1 张 → 弱点随机数错位；
  ② `executeDescriptor` 的日志文案与 `targetId` 展开与旧式 `doAbility` 不一致 → 状态指纹不同；
  ③ 资产卡的 `fast` 写在旧 DSL 顶层 → 迁走后打出会白花行动（补条目级关键字后才对齐）。
- **Round 17 的教训**：逃生通道卡片的引擎分支是 `effect.type: '<pack>Player'` 原语的实现，
  在被改写成真正的描述子之前**不能当死代码删除**；03195 / 04197 的删除曾被 `tfa-player-acceptance` 抓住并整体回退。
  5c-18 按正确顺序补做：先写 `resolve` 再删分支，03195 这次通过。
- **5c-18 的新教训**：`api.drawCards` **不写日志**（旧 handler 自己 info 抽牌文案），
  抽牌类结算要用 `api.drawCardsLogged`，否则 `state.log` 少一行、指纹对不上；
  另外 `evadeSuccess` 的窗口上下文没有 `successBy`，03195 的「超出 2 点两项都做」自始不可达，
  已在 [`phase5-migration.md`](phase5-migration.md) §6 记成待修缺口。

**剩余清单**（下一批的入口，分组依据见 [`phase5-migration.md`](phase5-migration.md) §6）：

1. ~~5b 尾部~~ **已完成**（5b-8 / 5b-12 / 5b-13 / 5b-14：反应、战役规则、费用能力、剧情资产全部迁完）、
   非 `stats` 的 `passive`（剩 8 张，需要 30 种键里的前四个修正目标）、
   `attachTo`/`exileAfterPlay`/`removeAfterPlay` 等打出后去向（~15 张）。
2. ~~5c~~ **已完成**：逃生卡 93 → 0，全部走描述子通道。
   「事件在反应窗口打出」的接线已在 5c-8 补齐，剩下的快速事件只需要逐张写 `resolve`。
   剩余大头是需要新包装的交互卡（附魔/封印/自定义计数器/from-discard 系列）与
   被既有实现卡住的卡（04010 的 `playRestriction` 没有描述子读点、04270 的解除附属分支有 bug）。
3. 5a：`table` 已清零、`reference` 剩 31 个码（多为 `requestChoice` 的 source 标签，要等文案 i18n）；`condition`/`block`（87 个码）要逐卡迁成描述子；
   `engine:` 标记的 5 张（01014 / 01072 / 01094 / 01095 / 01117）优先。

### Phase 6 · 收尾（持续）

删除 `EFFECTS` 行为读点（先留一版兼容层）→ 拆分 `engine.js`（卡号分支删完后自然变小，目标单文件 < 2.5k 行）→ 战役机制插件化（TFA 作为第一个搬家对象：`stateSlice` / `project` / `actions+hooks` / `agentHints`）。

**门禁**：`engine.js` / `observation.js` 内不出现 `tfa|carcosa|dunwich` 字样与具体卡号；新增战役只加 `content/campaigns/<id>/`。

### 排期（粗估，单人）

| Phase | 工期 | 状态 | 可并行 |
| --- | --- | --- | --- |
| 0 冻结与守卫 | 1 周 | ✅ 完成 | — |
| 1 生命周期 + 状态 | 2–3 周 | ✅ 完成 | 4 |
| 2 语义原语 | 2 周 | ✅ 完成 | 4 |
| 3 内容来源 | 2–3 周 | ✅ 完成（D1/D3 首批/D4） | 4 |
| 4 重放安全网 | 2 周 | ✅ 完成（golden 基线 + 100 局门禁 + 撤销 API） | 1–3 |
| 5 迁移 | 4–6 周 | ✅ 5c 三十九批（93/93）、🚧 5b 主体 235 张、🚧 5a 五批 | 5a/5b 可拆给两人 |
| **合计** | **13–17 周** | | 两人并行约 8–10 周 |

---

## 7. 迁移判据与纪律

### 什么时候迁一张卡

满足其一才迁：

1. **引擎里有这张卡的分支**（`=== '02088'`、`case '03012'`）——迁一个删一个分支，收益最大；
2. **卡面行为写不下**（用了战役逃生原语，或要新增效果原语才能表达）；
3. **这张卡因为别的原因本来就要改**（修 bug、补简化、接新剧本）——顺手迁。

**反例**：纯数据卡（`event: { type: 'gainResource' }`）没有表达力问题。迁成 `resolve` 会把它变成不可枚举的闭包，让覆盖度报告、AI 解释、审计工具都变差。**判据是"旧通道表达不了"，不是"新通道更时髦"。**

### 迁一张卡的标准动作

1. 在 `card-abilities.js` 写描述子；
2. 删掉 `card-effects.js` 里对应条目（或保留纯数据部分）与 `engine.js` 里该卡的**分支**；
3. 更新该卡的测试断言：从"断言 `EFFECTS[code]` 的形状"改成"断言行为"（现存约 60 条这类断言 / 16 个文件）；
4. 检查前端展示字段：`allCardDefs()` 目前从 `EFFECTS[code].passive` 生成 `statBonus` / `extraSlots` / `fightDamageBonus`，迁 passive 前先让它也读声明式修正，否则图鉴会丢字段；
5. 若该卡属于有 `manifest.js` 的卡包，把卡号补进该包的 `abilityLayerCodes`——包清单用
   `!effects[code] || abilityLayerCodes.includes(code)` 判定"有行为实现"，漏登记会让卡在
   `content/schema.js` 的"构筑开放需要规则实现"检查里直接失败（Phase 2 踩过）；
6. 逃生卡迁移时同步删掉 `engine.js` 里的 `if (effect.action === '…')` 分支，跑
   `npm run cards:audit:write` 让白名单与逃生卡计数一起下降（指标下降就是迁移证据）。

### 节奏

- 默认 **touch-it-migrate-it**：任何被打开修改的卡顺手迁；每批 ≤10 张，跑 `npm run test:fast` + 对应审计。
- 用**指标**而不是"全绿"管理：`engine.js` 卡号数从 180 单调下降到 0。
- 高密度卡优先：`01117`×11、`04037`×9、`03264`×7、`03012`×7、`02255`×6。
- 114 张逃生卡按战役分批，每批一次全量回归。
- **每批用基线证明"行为零变化"**（Phase 4 已交付）：

  ```powershell
  node tools/replay-fixtures.mjs --baseline ..\..\artifacts\replay-before.json   # 迁移前
  # …改卡…
  node tools/replay-fixtures.mjs --compare ..\..\artifacts\replay-before.json    # 迁移后
  ```

  输出"与基线逐条一致（行为零变化）"才算过；有差异会打印第一个不同的步数与动作。
  提交前再跑 `npm run replay:fixtures`——它守的是仓库里的 golden 基线（10 局 / 529 步），
  确认这批改动没有动到既有真实对局。有意改变行为（修 bug / 补简化）时，更新对应验收用例后
  用 `npm run replay:fixtures:write` 重采，把"行为变化"显式写进 diff。

### 不要做的事

1. **不要大爆炸迁移**：419 张一次迁完，回归失败时无法定位。
2. **不要把数据型效果改成闭包**（理由见上）。
3. **不要在没有 replay/等价检查前迁行为**：迁移必须"行为零变化"，否则分不清是迁移错还是卡本来就错。
   现在这条是**可执行**的（§7 的命令），不是口号；跳过基线对比的批次一律视为未验收。
4. **不要同批混做两件事**。
5. **不要把卡号白名单保留到收尾**：它只减不增，最终必须是空文件。
6. **不要先拆 `engine.js` 再迁卡**：卡号分支删完后文件自然变小；先拆会同时移动文件和行为，定位成本翻倍。

---

## 8. 守卫、指标与工具

### 防回退守卫（`tests/architecture-guard.test.mjs`，Phase 0 已落地）

六条守卫，全部在 `fast` tier（约 0.1s）：

| # | 断言 | 失败时该做什么 |
| --- | --- | --- |
| 1 | `engine.js` 的 5 位码集合 == `audit/card-code-whitelist.json` | 新增：拆掉分支或人工评审后 `--allow-growth`；删除：`--write` 让账本一起降 |
| 2 | `EFFECTS` 键集合 == `audit/effects-whitelist.json` | 新卡改写成描述子；删了旧条目就 `--write` |
| 3 | `ABILITY_KINDS` == 十一种冻结值 | 加 `kind` 要同时改本文 §4、`card-model.md` 与守卫 |
| 4 | 描述子的 `trigger` 都是已注册窗口 | 先在 `windows.js` 注册并接线 |
| 5 | `src/cards`、`content` 不 import `engine/engine.js` | 内容层只能依赖 ability/matcher/modifiers/windows |
| 6 | `audit/ability-coverage.json` == 当前实现 | 跑 `npm run cards:audit:write`，审阅指标变化 |

指标与账本由 `tools/audit-abilities.mjs` 生成：`npm run cards:audit`（校验）、`cards:audit:write`（重写）。
守卫第 6 条已经覆盖了 `--check` 的核心断言，所以 `cards:audit` 不必重复进 `test:fast`；CI 里单独跑一次即可。

### 迁移提效工具（Phase 5 已建）

| 工具 | 作用 | 状态 |
| --- | --- | --- |
| `node tools/migrate-card.mjs <code…>` | 读 `EFFECTS[code]` → 判定哪些槽位能机械搬（`event→played`、`skill→commit`、`weakness→weakness`、`onEnter→entersPlay`、`passive.stats→modifiers`、`abilities→action`、旧打出条件→`playCondition`）→ 生成描述子草稿（`--plan`）/ 写入并删旧条目（`--write`）/ 校验（`--verify`）/ 重排生成文件（`--rebuild`）/ 判定统计（`--report` / `--list`） | ✅ |
| `node tools/scaffold-card.mjs <code…\\|--batch N>` | 生成 `develop/scaffolds/<code>.test.mjs`（通道断言 + 读点断言 + 行为起手式），默认是绿的 | ✅ |
| `node tools/cards-migrate.mjs --batch N --codes …` | 「迁卡 → 账本/白名单收缩 → replay 对比 → 架构守卫 → 产物自检」一次跑完 | ✅ |
| `node tools/rehash-acceptance.mjs --check\\|--write` | 只重算 core/carcosa/dunwich 四份验收账本里「证据测试文件」的 sha256（证据映射不变） | ✅ |

`--write` 的拒绝规则（不静默近似）：战役逃生原语 → 拒绝（归 5c）；`discardSelf`/`exileSelf`/`assetDamage`
（副作用日志顺序不同）→ 拒绝；没有描述子读点的顶层字段 → 拒绝；源文件里 0 次或多次命中 → 拒绝。
落点：描述子写进 `src/cards/ability-migration-batches.js` 的批次块，批次清单记在 `audit/migration-batches.json`。

配合 `tools/audit-abilities.mjs` / `tools/replay-fixtures.mjs`，"接一张卡"的流程固定成：
`scaffold` →（工具）写描述子 → `--baseline/--compare` 对比 → `audit` 看指标 → `test:fast`。
5b 的六批实操记录与剩余清单见 [`phase5-migration.md`](phase5-migration.md)。

### 测试形状

Phase 4 之后，路线里要求的"最低补充"已经落地：

| 项 | 现状 | 位置 |
| --- | --- | --- |
| 随机走子器 | ✅ 5,000 步 / 67 局，断言版本单调、行动点/资源非负、线索守恒、毁灭非负、引用完整、生命区间、卡号可解析、JSON 幂等、关键步重放 | `tests/replay-fuzz.test.mjs`（slow） |
| golden replay | ✅ 10 局 / 529 步 / 530 个逐步指纹（4 战役、5 关卡、待决选择、幕间升级、严格模式 3 席位） | `tests/replay-golden.test.mjs` + `tests/fixtures/replay/golden-replays.json`（fast） |
| 随机对局重放门禁 | ✅ 100 局 / 2,039 步逐步一致 | `tests/replay-fuzz.test.mjs`（slow） |

仍缺的两项（不是 Phase 4 的门禁，留给后续）：

- **规则原语级单测**：`tests/phase2-primitives.test.mjs` 覆盖了八项原语的读点，但"每条原语的边界条件"还没有系统化；
- **属性测试**：目前只有随机走子器这一种属性化手段，`GameSpec/ActionSpec/TokenBagSpec` 那样的声明式 spec 还没有。

> 关于"牌数守恒"：随机走子器**没有**按区域做 multiset 守恒。本引擎允许敌人从遭遇牌库入场、遭遇卡加入
> 手牌/威胁区、剧情资产入场与"移出游戏"，按区域计数会被这些合法机制误报；改用"卡号可解析 + 逐步重放等价
> + JSON 幂等"守同一类损坏。实测记录见 [`phase4-replay.md`](phase4-replay.md) §6.3。

---

## 9. 与参考实现的关系

参考实现（`参考资源/ArkhamHorror-main`，只读）的价值在**分层范式**，不在技术栈：

| 参考实现替我们验证了什么 | 我们照搬 | 我们不照搬 |
| --- | --- | --- |
| 能力分四层（`Ability` / `Window` / `Modifier` / `Matcher`），加卡不碰内核 | ✅ 分层与声明式入口（P0-A 已落地） | 6,261 个逐卡 `CardDef` 模块（JS 里会变成 6 千个不可维护文件） |
| `ActiveCost` 把"付得起吗"算成独立结果，`validate` 与 `apply` 共用 | ✅ 费用表达式（C3）、目标枚举（B1） | Haskell/GHC 编译期检查兜底 |
| `Effect.hs` + `Duration` 把持续效果做成实体 | ✅ 效果记录（A1，最高优先） | — |
| `History.hs` 记录本回合/本阶段的行动 | ✅ 历史记录（C6） | — |
| `Undo.hs` + `arkham_steps.action_diff` 支持 undo/replay/复现 | ✅ 对局级 replay（Phase 4） | Postgres + sqitch 迁移（我们用 JSON 快照 + `save-migration.js`） |
| `docs/homebrew.md` 是卡牌作者手册 | ✅ 作者指南 = 本文 §4 | Docker/Nginx/CDN 部署 |

**参考实现没有、我们的独占优势**（不要为了"更像参考实现"牺牲）：`legalMoves` + `actionPreview` + `reason` 的 AI 契约、按座位显式的观察投影、Mod 隔离、单端口零构建可搬运、`schemaVersion`/`rulesVersion`/`resourceVersion` 三写版本门槛、内容契约与迁移确认。

**AI 线可额外拿到的红利**（大多依赖 Phase 4）：决策回归（固定状态重跑不同模型，量化提示词 A/B）、提示词稳定性（`aiDecisionContext` 固定键序 + 数值规范化，别直接 `JSON.stringify`）、给每条动作打 `intent` 标签（推进/保命/增益/资源）、让 AI 上下文复用 `viewState` 输出再叠加 `legalMoves`（避免一边加字段一边泄漏）。

---

## 10. 下一步（Phase 5 已交付工具与 5b 主体，继续 5b 尾部 / 5c / 5a）

| # | 事项 | 状态 | 产物 |
| --- | --- | --- | --- |
| 1 | 出工作单 | ✅ 完成，并修正了原估计 | `tools/audit-workorder.mjs` + `audit/ability-workorder.json`；结论见 §1.2 |
| 2 | 定义模型 v1 | ✅ 完成 | [`card-model.md`](card-model.md)（十一种 `kind`、双层 data/resolve、读点契约、状态模型） |
| 3 | 试点 `played` / `commit` | ✅ 完成（Phase 1 扩到 10 张） | `lifecycle.js` + `tests/card-lifecycle.test.mjs`（13 条） |
| 4 | 重放安全网 | ✅ 完成（Phase 4） | `replay.js` + `tools/replay-games.mjs` / `replay-fixtures.mjs` + golden 基线 + `tests/replay.test.mjs`（14 条）/ `replay-golden.test.mjs`（5 条）/ `replay-fuzz.test.mjs`（2 条）；交付说明 [`phase4-replay.md`](phase4-replay.md) |
| 5 | Phase 1 状态基础 | ✅ 完成 | `effect-state.js` / `targets.js` / `play-condition.js` + `tests/phase1-state.test.mjs`（9 条） |
| 6 | Phase 2 语义原语 | ✅ 完成 | `cost.js` / `limits.js` / `test-result.js` / `look.js` / `zones.js` + `modifiers.js` 的 C1/C2 目标 + `tests/phase2-primitives.test.mjs`（19 条）；交付说明 [`phase2-primitives.md`](phase2-primitives.md) |
| 7 | 门禁：逃生卡等价表达 | ✅ 达成（Phase 2 21/20；Phase 5 再迁 7 张） | Phase 2 对照表 + [`phase5-migration.md`](phase5-migration.md) §4；逃生卡 114 → 93 → 86 |
| 8 | 门禁：golden replay + 100 局随机对局 | ✅ 达成 | 10 局 / 529 步 / 530 个逐步指纹；100 局 / 2,039 步逐步一致；5,000 步随机走子器 |
| 9 | 迁移提效工具（`migrate-card` / `scaffold-card` / 批次编排） | ✅ 完成（Phase 5） | 见 §8；5b 机械五批 + 5c 十批用它跑完，共 204 张卡（手写批次覆盖反应/天赋/被动/规则字段迁移） |
| 10 | 5b 机械迁移主体 | 🚧 182 张（机械 154 + 反应 28） | `EFFECTS` 385 → 174；遗留 5b 尾部见下 |
| 11 | 5c 逃生卡 | ✅ 三十九批 93 张（Carcosa 48 / TFA 40 / 跨战役 5） | — |
| 12 | 5a 引擎卡号分支 | 🚧 十七批：死分支 4 段 + 卡号数据 36 个码（+ 弱点升级替换码） | 73 个码（`condition` 15 / `block` 30 / `reference` 28 / `table` 0） |

D1/D3/D4 已在 Phase 3 交付，Phase 4 补上了重放安全网，Phase 5 补上了迁移工具与 5b 主体，**"补能力"这条线只剩 A2/A3**：

1. **Phase 3 的成果**：非玩家卡（敌人/地点/幕/议程/剧情支援）的能力写在
   `src/cards/encounter-abilities.js` 的 `scope` 条目里，引擎按场上实体枚举；
   关卡的布置/推进常量/结局结果走 `content/scenario-declaration.js` 的声明 +
   `resolution.effects` 的战役结果条目。下一批敌人/地点规则迁移**不要**再写 `behavior.js`。
2. **继续迁移 `encounter-rules.js` 的逐卡规则**：三个战役文件里还有按卡号分支的
   敌人/诡计实现（TFA 约 780 行、Carcosa 约 690 行、Dunwich 约 260 行），
   凡属于「单卡常驻规则」的都可以按 Phase 3 的模板搬到 `encounter-abilities.js`。
3. ~~**5c 逃生卡继续迁移**~~（✅ 已完成，93 → 0）：明细见
   `audit/ability-migration.json` 的 `escapeCards`；每批用 `tools/replay-fixtures.mjs --baseline/--compare`
   做迁移前后指纹对比（§7 有命令）。**注意共享原语**：同一个 `effect.action` 被多张卡使用时必须整组迁
   （5c-1 的 `noStoneUnturned` 就是 03026 + 03307）。
4. ~~**5b 尾部迁移**~~ **已完成**：反应（5b-8）、战役规则（5b-12）、费用能力（5b-13）、剧情资产（5b-14）全部迁完；
   非 `stats` 的 `passive`（剩 8 张，补 `extraSlots`/`sanityBonus`/`handSizeBonus`/`evadeBonus` 等修正目标）、
   打出后去向字段（`attachTo`/`exileAfterPlay`/`removeAfterPlay`/`shuffleBackAfterPlay`/`addToVictory`，~15 张）。
5. **`playCondition` 的后续清理**：旧 10 字段的读取点已经只剩 `play-condition.js` 一处；随卡迁移逐张消失，
   迁移完成后可以删除 `LEGACY_RULES` 表。
6. **§5 的 P1 剩余项**：D2（使用次数元数据）已随 Phase 5 交付；E1（文案 i18n）仍未做，
   一旦做，`engine.js` 的 868 处中文字面量会同时受益，**并且要重采 golden 基线**
   （`state.log` 参与指纹，文案变化是玩家可见的行为变化，见 [`phase4-replay.md`](phase4-replay.md) §7）。
7. **难卡基准集验收**：03012 / 03264 / 07013 / 06021 需要 A2（替换与防止）或 A3（视为），
   建议在 5c 的 Carcosa 批之前先补 A2，否则这批卡会被反复搁置。
8. **撤销 UI / `action_diff`**：引擎侧 `rewindTo`/`undoMoves` 已就绪，交互入口与增量存档留给后续；
   做 UI 时要处理会话事务（鉴权、revision 校验、快照落盘、AI 侧重置）。

Phase 3 的门禁已达成（`behavior.js` 14,841 → 14,831 行，新增敌人/地点能力不再写 `behavior.js`）；
Phase 4 的门禁已达成（golden 基线 10 局全部重放出相同指纹；100 局随机对局逐步一致）；
Phase 5 已交付批次的门禁已达成（每批 replay 指纹不变 + 账本指标单调下降，见 §6 Phase 5）。
下一轮门禁交给剩余批次：**同样两条，且 `engineCodes` 只在 5a 里降**。
