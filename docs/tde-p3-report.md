# 《食梦者》P3 批次 1 收尾报告：双战役骨架与 6 个数据模型原语（2026-10-27）

> **口径**：P3 分成三批（路线图 §5 开头的分批口径）。本文只报告 **批次 1：双战役骨架**；TDE 仍是 `catalog-only`。
> 批次 2/3 的原语（蜂拥、掩藏、蛛群袋、警报等级、纵向链、地点毁灭、16 段矩阵等）已在
> [`tools/tde-primitive-spec.mjs`](../tools/tde-primitive-spec.mjs) 的 `DEFERRED_PRIMITIVES` 与账本 `deferredPrimitives` 登记，**没有实现**。
> 账本：`artifacts/migration/tde/primitive-plan.json` / `primitive-catalog.json`（`npm run plan:tde:primitives` 生成、`npm run audit:tde:primitives --check` 复算）。
> 路线图：[`tde-migration-roadmap.md`](./tde-migration-roadmap.md) §5.5 / §13.4；手册：[`tde-primitives.md`](./tde-primitives.md) §6。

## 1. 一页结论

| 项 | 结论 |
| --- | --- |
| 交付 | [`src/campaign/campaign-parts.js`](../src/campaign/campaign-parts.js)：双 part 状态、逐线记录、座位映射、两袋、作用域绑定、flow 条件 |
| 账本 | `batch: "P3-1"`；**new 6/6 done**、reuse 2、escape 3、deferred 11、`gate.pass=true` |
| 测试 | [`tests/tde-campaign-parts.test.mjs`](../tests/tde-campaign-parts.test.mjs) **21 例**全过（合成两 part 战役，不建真实局） |
| 零漂移 | `replay-fixtures --compare artifacts/migration/tde/replay-before.json` → 13 局逐条一致（已进 gate） |
| 边界 | `engine.js` 无 06 卡号、无 `tde`/`theDreamEaters` 分支（gate `engineBoundary`） |
| 未接线 | flow 消费、`campaignView` 脱敏、hub 校验、lane adapter 运行时重建 = P5 |
| schema | **仍是 7**（不升 8），原因见 §4 |

## 2. 六个原语与 API

| # | 原语 | API | 关键口径 |
| ---: | --- | --- | --- |
| P3.1 | `campaignPart` | `createPartsState({mode,seatParts,activeParts,currentPart})` / `setPart(state, part)` | 切 part 五步；共享字段（flow/scenarioResults）不切片 |
| P3.2 | `recordInPart` | `partRecord` / `recordInPart` / `crossOutInPart` / `partScope` / `ensurePartSnapshot` | 记录是存在性语义；跨线写入不碰当前线 |
| P3.3 | `seatPartMap` | `seatPartMap` / `laneSeatOf` / `roomSeatOf` / `seatsOfLane` / `laneCounts` / `normalizeSeatParts` | 由 `seatParts` 派生；越界返回 `null` 不静默截断 |
| P3.4 | `chaosBag.multiPart` | `partChaosBag` / `mutateBothBags` | 当前线与 `state.chaosBag` 同步；非活动线落快照 |
| P3.5 | `inPart` | `inPart(state, part, fn)` | 只绑数据作用域，不换 `currentPart`/`state.investigators`；抛错也还原 |
| P3.6 | `partFlowCondition` | `partFlowCondition(campaign, condition)` | `part/parts/mode/modeIn/activeParts`；未知键返回 false（P5 加载期校验） |

辅助：`validateModeSeats`（并行禁奇、分选两线各 ≥1、单线不混线）与 `PART_SCOPED_FIELDS`
（`records/investigators/retired/trauma/xp/victory/chaosBag/storySections`）。

## 3. 测试覆盖（21 例）

- 座位映射：2+2、2+1、非连续 `['B','A','B','A']`、非法/越界抛错。
- 模式校验：parallel 奇数禁用、等分；pick 两线各 ≥1；single 不混线。
- 逐线数据：当前线读顶层 / 非活动线读快照；跨线写入不污染；勾销返回旧值。
- 切 part：整块存快照、共享字段不动、袋同步、重复切换为非变更、来回切换保数据。
- 两袋：读两线、`mutateBothBags` 同时改并同步活动线。
- `inPart`：作用域内读写、退出还原、回调抛错仍还原。
- JSON 往返：序列化前后逐字节一致，恢复后仍可切 part。
- 非 TDE 状态：不显式建 parts 就不写字段（字节不变）。

## 4. 为什么不升 schema 7→8

- `stateHash`（`src/engine/replay.js` 的 `stableStringify`）**包含 `schemaVersion`**；实测把同一局的 `schemaVersion` 从 7 改成 8，状态指纹立刻变化。
- 现在升 8 会让既有 13 局 golden 指纹全变、`replay-fixtures --compare` 红，违反 P3 的「13 局零漂移」门禁（也是 R12 记的风险）。
- 本批的 `parts`/`seatParts`/`mode` 都是**可选字段**：未声明 parts 的战役不产生任何字节变化。因此先落数据模型、推迟 schema 升级。
- 7→8 与 `save-migration` 放到 P5（TDE 真正产生带 parts 的存档、需要向下兼容时），届时按 R12 的「非 TDE no-op + 双向往返测试」一次性做。

## 5. 门禁实测

| gate | 结果 |
| --- | --- |
| `newPrimitives` | 6 / 6 done |
| `newPrimitivesHaveTests` | 6 / 6（同一测试文件 21 例） |
| `docsPresent` | `docs/tde-primitives.md` 在 6 条原语的 `files` 里 |
| `reuseReadPoints` | 2 / 2（`campaign.awardStoryCard`、记录写入路径） |
| `escapeRegistered` | 3 / 3（06164 / 06329 / 06331） |
| `mechanismCoverage` | 9 条 primitive 机制：4 条覆盖 + 5 条显式延后（`deferredTo` 有理由） |
| `engineBoundary` | 06 卡号 0、`tde`/`theDreamEaters` 分支 0 |
| `replayZeroDrift` | 13 局逐条一致 |

## 6. 与路线图锚点的对照

- 历史锚点是「骨架 9 文件 / 550–850 行 / 12–15 例」。本批实际：**新增 2 个工具（212 + 391 行）+ 1 个数据模块（305 行）+ 1 个测试（239 行）**，
  另有本报告；测试 **21 例**（超过 15 例）。D1 的「骨架保留、双线后开」前提成立。
- 与 §7.3 的 34 文件 / 1,900–3,100 行**不是同一口径**：那段只覆盖 `pick` 的单运行时改造，本批只做数据模型，不包含 flow 接线、投影与 hub。

## 7. 副作用与处置：TCU 玩家卡账本被 suites.mjs 变更带 stale

- P3 把 `tests/tde-campaign-parts.test.mjs` 登记进 `tests/suites.mjs`；TCU 的玩家卡验收账本把 `tests/suites.mjs`
  算进 `implementationFiles` 哈希，于是 `tools/audit-tcu-player.mjs` 判 `Acceptance artifact stale`，
  连累 `audit:tcu:check` 与 `tcu-migration.test.mjs`（P1 账本用例）在 full fast 里失败。
- 处置（按工具自带的 remedy）：`node tools/audit-tcu-player.mjs --write` → `node tools/audit-tcu.mjs --write`。
  diff 只有三类：`tests/suites.mjs` 与两个验收产物的哈希、包状态从旧值回到当前 manifest 的 `playable`、scope 哈希；
  **没有卡牌/规则行为改动**。重算后 `audit:tcu:check` 复算一致、`tcu-migration.test.mjs` 5/5。
- 全量 `test:fast` 复跑：**3628 tests / 3625 pass / 3 skipped / 0 fail**（`p3-fast-final.log`，含本批新增 21 例）。
- 教训：给 fast tier 增删测试会连带 stale 所有把 `tests/suites.mjs` 计入哈希的账本；以后加测试后要顺手重算这些账本。

## 8. 批次 2（2026-10-27）：6 条高风险机制原语

| # | 原语 | 机制 | 落点 | 测试例数 |
| ---: | --- | --- | --- | ---: |
| P3.7 | `counter.investigator` | alarmLevel 20 | `src/engine/counters.js` | 8 |
| P3.8 | `enemy.swarmingValue` | swarming 11 敌 | `src/engine/swarming.js` | 7 |
| P3.9 | `swarm.placeCards` | swarming 11 敌 | `src/engine/swarm.js` | 8 |
| P3.10 | `location.veiled` | veiled 23 地点 | `src/engine/veiled.js` | 8 |
| P3.11 | `tokenBag` | tokenBag 10 | `src/engine/token-bag.js` | 8 |
| P3.12 | `location.verticalChain` | verticalChain 15 | `src/engine/vertical-chain.js` | 7 |

- 六个原语都通过 [`src/engine/scenario-runtime-extras.js`](../src/engine/scenario-runtime-extras.js) 挂到 `scenarioRuntime`（`counters` / `swarming` / `swarm` / `veiled` / `tokenBag` / `verticalChain`），只做纯数据转发；**scenario-runtime 只加了一行 spread**，既有战役行为不变。
- 关键语义（全部有测试）：Swarming 的四种 X 口径（缺 `x` 抛错而不是按 0）；蜂拥卡清空前头领不可击败、溢出伤害逐张扣；Veiled 的「未揭示限制 / 翻面 / 洗回」三件事分开；蛛群袋可注入 rng 做确定性；纵向链越界返回 `null` 不夹端点；计数器只读不建字段。
- 账本：`primitive-plan.json` 的 `newPrimitives` 现在 **12/12 done**；`mechanismCoverage` 9 条 primitive 机制：7 覆盖 + 2 显式延后（epilogueMatrix、dreamGate）。
- 事务边界：真实敌人实体生成、调查动作拦截、infestation test、布局渲染都留 P8/P5；本批只保证原语可被内容层调用且有 Node 证据。
- 全量 	est:fast：**3674 tests / 3671 pass / 3 skipped / 0 fail**（p3b2-fast.log，含本批 46 例）。	ests/suites.mjs 新增 6 个测试文件再次触发 TCU 玩家卡账本 stale，按同一 remedy 重算（udit-tcu-player --write → udit-tcu --write），diff 只有哈希；重算后 udit:tcu:check 与 	cu-migration.test.mjs 6/6 通过。

## 9. 仍未完成（诚实清单）

| 项 | 归属 |
| --- | --- |
| `campaign-flow` 消费 `partFlowCondition`、`campaignView` 按 part 脱敏、hub 接 `validateModeSeats` | P5（WP-3/4） |
| 运行时座位重建与 lane adapter（D8-C） | P5（WP-8） |
| 批次 3：`location.placeBondedLocation`、`campaign.epilogueMatrix`、`deck.myriadLimit`、`location.doom`、`scenario.markerCount` | P3-3 |
| 原语的引擎接线（蜂拥实体、掩藏调查拦截、infestation test、纵向布局） | P8/P5 |
| schema 7→8 + save-migration | P5（R12） |
| 真 TDE 战役接线（manifest/parts/dual-flow） | P5/P8 |
