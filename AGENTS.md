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

> 上面的 `--encounter` / `cards:encounter-check` / `build-encounter-index.mjs` 在迁移落地时补齐；
> 落地前新增非玩家条目按本节路径手写单卡文件，并在 `encounter-entries/index.js` 手工登记（或等主进程重建）。

`fast` 应全绿（2026-10-22 实测 2304 例全部通过）。新增失败必须为 0。
存量 529 条非玩家条目的一次性迁移方案见 [`docs/encounter-entry-split-plan.md`](docs/encounter-entry-split-plan.md)；
迁移完成前 `encounter-abilities.js` 只读，新增一律进单卡文件。

## 批量迁移（多子进程）

顺序固定：**扫描新增机制 → 拆分原语 → 关键字与规则书 → 新增交互与界面 → 批量卡牌 → 测试验收**。
完整协议见 [`docs/arkham-content-migration.md`](docs/arkham-content-migration.md) §4。

- **主进程**：唯一写共享文件（`src/engine/**`、`entries/_shared.js`、`entries/index.js`、`encounter-entries/_shared.js`、`encounter-entries/index.js`、两个聚合入口、`docs/**`、`audit/**`）；处理原语队列；合并后统一重建索引；跑全量门禁。
- **子进程**：只写自己分到的单卡文件（玩家卡 `entries/<code>.js`，非玩家卡 `encounter-entries/<归属目录>/<code>.js`）和 `artifacts/migration/<cycle>/primitive-requests/*.json`；用 `scaffold-card --entry --no-index` 或 `--encounter --no-index`，不跑任何 `build-*-index`，不写 `_shared.js`/引擎/文档。
- **新原语**：子进程写请求（`pending`）→ 继续其他卡 → 主进程去重、实现、补测试、更新原语目录并回写 `done` → 子进程轮询后继续。不得由子进程改引擎。
- **卡牌只能用已登记原语**；单卡一次性逻辑可以 `resolve`，但要在 `primitive-plan.json` 的 `escape` 登记理由。
- 合并门禁：分片无交集、worker 无越界写入、`cards:check` 与 `cards:encounter-check` 通过、replay 一致、`test:fast` 无新增失败、队列无悬挂。

## 旧 DSL 迁移

```bash
node tools/migrate-card.mjs --plan 01xxx
node tools/migrate-card.mjs --write 01xxx
node tools/migrate-card.mjs --verify
```

工具现在直接写 `src/cards/entries/<code>.js` 并重建索引；`--batch` 只影响账本分组。
