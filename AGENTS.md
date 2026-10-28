# Agent 指令（Arkham Horror Mod）

本文件是**自动执行入口**。在本目录下改代码前先读：

1. [`ARCHITECTURE.md`](ARCHITECTURE.md)：目录职责、依赖方向、修改约定。
2. [`docs/card-entry-files.md`](docs/card-entry-files.md)：一卡一文件与一次性执行清单。
3. [`docs/card-model.md`](docs/card-model.md)：描述子模型（kind / modifiers / target / playCondition / resolve）。
4. [`docs/arkham-content-migration.md`](docs/arkham-content-migration.md)：整轮迁移六步、原语拆分、关键字/规则书、交互一致性、多子进程批量卡牌与原语队列。

## 不可协商

- **一张有行为的卡 = 一个文件**（玩家卡与非玩家卡同一原则）：
  - 玩家卡：`src/cards/entries/<code>.js`，`export default` 恰好一个条目，`code` 必须等于文件名。
  - 通用非玩家卡（跨战役复用）：`src/cards/encounter-entries/shared/<encounterGroup>/<code>.js`。
  - 战役内跨关卡复用：`src/cards/encounter-entries/<campaign>/_shared/<encounterGroup>/<code>.js`。
  - 关卡专用（地点/幕/议程/专属敌人/诡计/剧情资产）：`src/cards/encounter-entries/<campaign>/<scenario>/<code>.js`。
  - **禁止**把非玩家条目继续写进 `src/cards/encounter-abilities.js` 或任何单一大文件；该文件只做兼容
    聚合（facade），不得新增条目。也**禁止**把所有关卡/遭遇组塞进同一个目录（例如
    `encounter-entries/all/` 或按 scope 建 `enemies/`、`treacheries/` 大目录）；`entries/` 仍只放玩家卡，
    不要混入非玩家条目。
- **`card-abilities.js` / `encounter-abilities.js` 只聚合**；不要在里面加条目，不要恢复
  `ability-migration-batches.js` 或任何 `BATCH_*` / `MIGRATED_*` 批次大数组。
- 新增/修改/迁移一张卡时，**同一次执行内**必须完成：写单卡文件 → 重建对应索引
  （玩家卡 `node tools/build-card-index.mjs --write`；非玩家卡 `node tools/build-encounter-index.mjs --write`）
  → `npm run test:fast`；行为改动还要 `replay-fixtures --baseline/--compare`。
- 卡文件不得 import `engine.js` / `card-abilities.js` / `encounter-abilities.js` / 批次文件 / `content/`；
  只通过描述子和 `ctx.api` 改状态。非玩家卡的跨条目查询走 `encounter-entries/_lookup.js`。
- **卡条目只读状态，写入只走 `ctx.api`**：不得直接写 `state.*` / `inv.*` / `location.*` / `enemy.*` /
  `act.*` / `agenda.*` / `asset.*` / `target.*` / `card.*` 的字段或数组，也不得为单张卡新造状态字段
  （`inv.ritaEvadeRound`、`location.sordidAndSilent` 这类）。表达不了就先补原语
  （`ctx.api` / `modifiers` / `effect` / 声明式规则键），**不要**「先直写、后补请求」。
  机械检查：`npm run audit:entries`（已并入 `cards:check` / `cards:encounter-check`），存量基线
  `audit/card-entry-compliance.json` **只减不增**。
- **同句规则只写一次**：同一句卡文模板（显现检定、失败差值、附属到地点/威胁区、谈判、撤退、搜索牌库、
  额外行动……）出现第二张卡时按「原语候选」处理，出现第三张时**停止写卡**、回
  [`docs/arkham-content-migration.md`](docs/arkham-content-migration.md) §4.3 补原语。
  逐卡手写第二遍不算完成，不能靠 `test:fast` 全绿过关。
- **重印只实现一次**：`cards-data` 里 `duplicateOfCode` / `duplicatedBy` 指向同一张印刷卡的两个卡号，
  只保留一份行为实现，另一号走 `card-identity.js` 的别名；跨战役重印（同名同文、不同号）同样处理。
- **声明即接线**：条目上新增的任何字段 / flag（`treacheryRule.*`、`locationRule.*`、`flags.*` …）
  必须在同一轮有引擎读点与测试；「声明了没人读」按未实现计，不得写进账本或报 `verified`。
- **口径冲突先裁决**：同一规则的多张卡实现口径不一致时（失败差值下限、回合限制、伤害分配顺序等），
  先改 [`docs/card-model.md`](docs/card-model.md) / 规则书并全局对齐，不允许每张卡各自解释。
- 5,930 张卡面数据仍在 `src/cards/cards-data.js`，**不要**按卡拆；未实现的卡不要预建空文件。
- **先原语、后卡牌**：卡只能使用已登记原语；需要新原语时按
  [`docs/arkham-content-migration.md`](docs/arkham-content-migration.md) §4.6.3 排队给主进程，子进程**不得**改 `src/engine/**`、任一本 `_shared.js` / `_lookup.js`、两个 `index.js`、`content/**`、`docs/**`、`audit/**`。
- **批量迁移的主进程是唯一索引写者**：子进程用 `scaffold-card --entry --no-index` / `--encounter --no-index`，主进程合并后统一重建两个索引。
- **新交互先于批量卡牌**：新的选择/目标/提示/面板必须在批次前完成，复用现有界面 token，并通过桌面 1440 / 移动 390 浏览器验收。
- **`web/` 是浏览器唯一能访问的目录**：`web/**` 只能从 `web/` 内相对导入。浏览器把 `/mods/arkhamhorror/`
  当根解析，跨出去（例如 `../presentation/...`）会 404，导致整块 Mod 界面加载失败：启动页退回大厅通用弹窗、
  开局后停在「正在加载界面…」。纯展示数据放 `web/ui-cards.js` 这类模块；Node 侧可以反向 import `web/`。
  `tests/architecture-guard.test.mjs` 会按浏览器口径检查，改了 web 导入就跑 `npm run test:fast`。

## 一张卡的固定流程

玩家卡：

```bash
node tools/scaffold-card.mjs 01xxx --entry   # 生成单卡文件 + 更新 entries/index.js
# 编辑 src/cards/entries/01xxx.js
npm run cards:check                          # 索引 + 一卡一文件守卫
node tools/replay-fixtures.mjs --baseline artifacts/card-before.json   # 改行为前
# 改行为
node tools/replay-fixtures.mjs --compare artifacts/card-before.json    # 证明零变化
npm run test:fast
node tools/audit-abilities.mjs --write
```

非玩家卡（敌人/诡计/地点/幕/议程/剧情资产/威胁）：

```bash
node tools/scaffold-card.mjs <code> --encounter   # 按归属自动落到 shared/ 或 <campaign>/<scenario>/
# 编辑落点文件；不要把条目写回 encounter-abilities.js
npm run cards:encounter-check                     # 索引 + 归属 + 一卡一文件守卫
# 行为改动同样先 --baseline 再 --compare
npm run test:fast
node tools/audit-abilities.mjs --write
```

> `--encounter` 会按归属算法把骨架落到 `shared/`、`<campaign>/_shared/` 或 `<campaign>/<scenario>/`；
> 批量 worker 加 `--no-index`，索引只由主进程重建。
>
> `cards:check` / `cards:encounter-check` 末尾已包含条目合规审计（R1 直写状态 / R2 重印双实现 /
> R3 回合限制缺失）。单独复核用 `npm run audit:entries`；修掉存量违规后跑 `npm run audit:entries:write`
> 收紧基线（基线只能删、不能为了过门禁手工加）。口径见迁移规范 §4.6.10。

`fast` / `slow` / `assets` 应全绿；**用例数与耗时不要写死在文档里**（会随迁移与引擎变化失真），以
`node tools/test-timings.mjs <tier>` 的实时输出和 `npm run baseline:check` 为准。新增失败必须为 0。
存量 529 条非玩家条目已于 2026-10-22 拆分完毕，拆分方案文档已归档；`encounter-abilities.js`
只是 facade，只读，新增一律进单卡文件。

## 批量迁移（多子进程）

顺序固定：**扫描新增机制 → 拆分原语 → 关键字与规则书 → 新增交互与界面 → 批量卡牌 → 测试验收**。
完整协议见 [`docs/arkham-content-migration.md`](docs/arkham-content-migration.md) §4。

- **主进程**：唯一写共享文件（`src/engine/**`、`entries/_shared.js`、`entries/index.js`、`encounter-entries/_shared.js`、`encounter-entries/index.js`、两个聚合入口、`docs/**`、`audit/**`）；处理原语队列；合并后统一重建索引；跑全量门禁。
- **子进程**：只写自己分到的单卡文件（玩家卡 `entries/<code>.js`，非玩家卡 `encounter-entries/<归属目录>/<code>.js`）和 `artifacts/migration/<cycle>/primitive-requests/*.json`；用 `scaffold-card --entry --no-index` 或 `--encounter --no-index`，不跑任何 `build-*-index`，不写 `_shared.js`/引擎/文档。
- **新原语**：子进程写请求（`pending`）→ 继续其他卡 → 主进程去重、实现、补测试、更新原语目录并回写 `done` → 子进程轮询后继续。不得由子进程改引擎。
- **卡牌只能用已登记原语**；单卡一次性逻辑可以 `resolve`，但要在 `primitive-plan.json` 的 `escape` 登记理由。
- 合并门禁：分片无交集、worker 无越界写入、`cards:check` 与 `cards:encounter-check` 通过（含条目合规审计：本批新增卡 0 条 R1/R2/R3）、replay 一致、`test:fast` 无新增失败、队列无悬挂。

## 旧 DSL 迁移

```bash
node tools/migrate-card.mjs --plan 01xxx
node tools/migrate-card.mjs --write 01xxx
node tools/migrate-card.mjs --verify
```

工具现在直接写 `src/cards/entries/<code>.js` 并重建索引；`--batch` 只影响账本分组。
