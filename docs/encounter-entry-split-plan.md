# 非玩家条目拆分方案与对账记录（encounter-entry split plan）

> 状态：**已完成**（529 条非玩家条目于 2026-10-22 拆到单卡文件，见 [`AGENTS.md`](../AGENTS.md) 与
> [`docs/card-entry-files.md`](card-entry-files.md) §7.1）。本文是**现行口径 + 可复现证据索引**，
> 不是待办清单；新卡/新条目按 [`card-entry-files.md`](card-entry-files.md) §3.0 与
> [`docs/arkham-content-migration.md`](arkham-content-migration.md) §4 的固定流程走。

## 1. 背景与目标

拆分前，全部非玩家条目（敌人 / 诡计 / 地点 / 幕 / 议程 / 剧情资产 / 威胁）集中在
`src/cards/encounter-abilities.js`：**7,082 行**，其中条目区约 659–7067 行、顶部 52 个 helper。
该形状无法做文件级 review、无法多子进程并行迁移，也是「先原语、后卡牌」批量迁移的瓶颈之一。

目标（与玩家卡拆分同一套验收口径）：

1. **一张有行为的卡 = 一个文件**（`src/cards/encounter-entries/`），按归属分三档放置；
2. `encounter-abilities.js` 退化为只读 facade，**任何新增都进单卡文件**；
3. 运行时行为零变化：索引顺序、对象字段顺序、`abilities`/`modifiers` 条数、函数源码逐条归一化后一致；
4. 拆分过程可复现：一次性工具 + 快照对账 + replay 基线。

5,930 张卡面数据仍留在 `src/cards/cards-data.js`（生成物，不拆），只给**已实现行为**的卡建文件——
理由与启动成本实测见 [`card-entry-files.md`](card-entry-files.md) §5。

## 2. 现状扫描（2026-10-25 复核）

`node tools/encounter-entry-placement.mjs` 实测输出（该工具即扫描器本身）：

```json
{ "scenarios": 38, "entries": 779,
  "buckets": { "shared": 29, "campaign": 129, "scenario": 621 },
  "directories": 96, "unresolved": [] }
```

目录形状（行为条目，与 `content/campaigns/` 同构，但**不放关卡数据**）：

```text
src/cards/encounter-entries/
├── _shared.js                          # 跨卡窄工具（原 encounter-abilities.js 顶部 helper）
├── _lookup.js                          # 跨条目查询（惰性建表；唯一允许的跨卡读点）
├── index.js                            # 生成索引（保持拆分前数组顺序）
├── shared/<encounterGroup>/<code>.js   # 跨战役复用
├── <campaign>/_shared/<encounterGroup>/<code>.js  # 战役内跨关卡复用
└── <campaign>/<scenario>/<code>.js     # 关卡专用（地点/幕/议程/专属敌人/诡计/剧情资产）
```

各目录条目数（`Get-ChildItem -Recurse -File -Filter *.js` 实测，根文件 `_shared.js` / `_lookup.js` /
`index.js` 3 个另计）：`shared/` 29、`nightOfTheZealot/` 6、`theDunwichLegacy/` 168、
`thePathToCarcosa/` 185、`theForgottenAge/` 144、`theCircleUndone/` 247 → 合计 **779** 个条目文件
（+3 个根文件 = 782 个 `.js`）。

与拆分时 **529** 条的差额来自拆分后新增的战役内容（尤其四循环 TCU），不是回退；
`encounter-entry-placement.mjs` 的 `unresolved` 必须始终为空。

## 3. 归属算法（§3）

扫描器（`tools/encounter-entry-placement.mjs`）、`tools/scaffold-card.mjs --encounter` 与
`tests/encounter-entries.test.mjs` 共用同一算法（[`card-entry-files.md`](card-entry-files.md) §2.1）：

1. 用条目 `code`、`cards-data.originalCode`、`scenarioReferences.ruleId` 在**全部关卡**的
   `definition.js` 与 manifest zones 里匹配；
2. 命中 1 个关卡 → `<campaign>/<scenario>/`；命中同一战役多个关卡 → `<campaign>/_shared/`；
   跨战役 → `shared/`；
3. 印刷卡有 `encounterCode` 时用它做组目录（统一 snake_case，如 `anettes_coven`）；没有组的放该档
   根部（例如 `_shared/story/`）；
4. 运行时别名条目跟随同名印刷卡条目（要求唯一匹配），避免同一张卡被分到两处；
5. 判定结果必须 `unresolved: []`；`--encounter` 脚手架默认拒绝未归属的卡。

落地硬约束：`export default` 恰好一个条目、`code` 等于文件名、`scope` ∈
`enemy | location | act | agenda | treachery | storyAsset | threat`；跨卡 helper 只从
`encounter-entries/_shared.js` 取，跨条目查询只从 `encounter-entries/_lookup.js` 取；
条目不得 import `engine.js` / 任一聚合入口 / `content/`。

## 4. 拆分执行与对账（一次性，已完成）

- 旧源快照：`artifacts/legacy/encounter-abilities.js`（`artifacts/` 不签入；需要时从 git 历史取，
  仅作证据/回滚，不是运行时输入）。
- 工具：`tools/split-encounter-entries.mjs`（**一次性**；源码切片 + 顺序快照对账；**已执行，不要重跑**）。
- 产出（2026-10-22）：**529 个条目文件 / 72 个目录**；`shared/` 23、`<campaign>/_shared/` 97、
  `<campaign>/<scenario>/` 409；最大目录 26 个文件（不可言说的誓约）。
- 顺序与内容：`encounter-entries/index.js` 保持拆分前数组顺序；条目 code 顺序、对象 key 顺序、
  `abilities`/`modifiers` 条数与运行时一致；`JSON.stringify(NON_PLAYER_ABILITY_ENTRIES)` 快照
  `48,468 bytes / sha256 fb3cc3ac…` 与迁移前一致；函数源码逐条归一化对比 **0 差异**。
- 唯一源码改写：03124 / 03125 的 `NON_PLAYER_ABILITY_ENTRIES.some(...)` 改走 `_lookup.js` 的
  `someNonPlayerEntry(...)`（语义相同，对账时按旧函数名归一化）。
- ESM：`_lookup.js` 改为「index 求值完成后注册 + 运行时惰性建表」，单独 import
  `02043 / 03137 / 03124 / 03125 / 03059` 不抛错（守卫逐文件起新进程验证）。
- 行为对账：`node tools/replay-fixtures.mjs --compare` → **13 局 / 784 步逐条一致**；
  `npm run test:fast` **2311 例全绿**（拆分当时的实测数字）。
- 硬编码：`cardLayerCodes` 642 → 100（白名单只降）；`engineCodes` / `engineEntityHits` 保持 **0**。

## 5. 拆分后的规矩（新增一律单卡文件）

- 单卡：`node tools/scaffold-card.mjs <code> --encounter`（自动落归属目录并重建索引）→ 编辑落点文件
  → `npm run cards:encounter-check`。
- 批量/多子进程：子进程用 `--encounter --no-index`，只写自己分到的单卡文件与
  `artifacts/migration/<cycle>/primitive-requests/*.json`；**索引只由主进程统一重建**
  （[`card-entry-files.md`](card-entry-files.md) §3.1、[`arkham-content-migration.md`](arkham-content-migration.md) §4.6）。
- 禁止：把条目写回 `encounter-abilities.js`（当前仅 **1,506 B** facade）；恢复 `BATCH_*` / `MIGRATED_*`
  数组或 `ability-migration-batches.js`；新建按 scope 聚合的大文件（如 `enemies/`、`treacheries/`）；
  未实现的卡预建空文件。

## 6. 工具与验收门槛

| 工具/用例 | 作用 |
| --- | --- |
| [`tools/encounter-entry-placement.mjs`](../tools/encounter-entry-placement.mjs) | 归属算法（扫描器 / 脚手架 / 守卫共用），要求 0 unresolved |
| [`tools/build-encounter-index.mjs`](../tools/build-encounter-index.mjs) | 生成/校验 `encounter-entries/index.js`；`--write` / `--check` |
| [`tools/scaffold-card.mjs`](../tools/scaffold-card.mjs) | `--encounter` 生成非玩家单卡骨架并按归属落点；批量加 `--no-index` |
| [`tools/split-encounter-entries.mjs`](../tools/split-encounter-entries.mjs) | **一次性**拆分工具（源码切片 + 顺序快照对账），已执行，不要重跑 |
| [`tools/audit-abilities.mjs`](../tools/audit-abilities.mjs) | 生成/校验能力覆盖账本 `audit/ability-coverage.json`；指标只允许下降 |
| [`tests/encounter-entries.test.mjs`](../tests/encounter-entries.test.mjs) | 一卡一文件 / 归属目录 / 索引顺序 / 禁止写回 facade / 禁止 import / 单文件 import |
| `npm run cards:encounter-check` | `build-encounter-index --check` + `tests/encounter-entries.test.mjs`（日常门禁） |
| `npm run cards:encounter-index` | 主进程重建非玩家索引（唯一索引写者） |
| `npm run cards:audit` | `audit-abilities.mjs --check`（账本复算） |

批量迁移的六步顺序、原语队列、多子进程写入边界与合并验收见
[`docs/arkham-content-migration.md`](arkham-content-migration.md) §4（尤其 §4.6）。

## 7. 对账与证据位置

| 证据 | 位置 / 生成方式 | 说明 |
| --- | --- | --- |
| 能力覆盖账本 | `audit/ability-coverage.json`（`node tools/audit-abilities.mjs --write`） | 勿手改；`metrics` 只降不升（`engineCodes` / `effectsEntries` 每次减少都是迁移证据） |
| 旧 DSL 批次账本 | `audit/migration-batches.json`（`tools/migrate-card.mjs --write` 追加；`--verify` 校验） | 记录「哪张卡属于哪一批」；当前机械批次 79 批 / 373 卡，`manual` 为手写逃生卡批次 |
| 拆分旧源快照 | `artifacts/legacy/{encounter-abilities,card-abilities,ability-migration-batches}.js` | 不签入；需要时从 git 历史取；仅证据/回滚 |
| replay 基线 | `node tools/replay-fixtures.mjs --baseline/--compare`（拆分对账用 `artifacts/card-split-baseline.json`） | 逐条一致才算行为零变化 |

2026-10-25 复核时 `audit/ability-coverage.json` 的 metrics 快照（数字随迁移变化，以文件为准）：
`engineCodes 0 / effectsEntries 0 / descriptorEntries 572 / descriptorAbilities 506 /
nonPlayerCards 21 / behaviorLines 21057 / declaredScenarios 3`。

## 8. 当前状态（2026-10-25 实测）

- `node tools/build-encounter-index.mjs --check` → `✔ encounter-entries/index.js 与目录一致（779 个条目）`，exit 0；
- `node --test tests/encounter-entries.test.mjs` → **7/7 pass**；
- `node tools/encounter-entry-placement.mjs` → `unresolved: []`。

结论：529 条存量的拆分与对账已完成且守卫保持绿色；后续新增能力条目只需按 §3/§5 的单卡流程落到
`src/cards/encounter-entries/`，`encounter-abilities.js` 保持只读 facade。
