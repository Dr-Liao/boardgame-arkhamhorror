# Agent 指令（Arkham Horror Mod）

本文件是**自动执行入口**。在本目录下改代码前先读：

1. [`ARCHITECTURE.md`](ARCHITECTURE.md)：目录职责、依赖方向、修改约定。
2. [`docs/card-entry-files.md`](docs/card-entry-files.md)：一卡一文件与一次性执行清单。
3. [`docs/card-model.md`](docs/card-model.md)：描述子模型（kind / modifiers / target / playCondition / resolve）。
4. [`docs/arkham-content-migration.md`](docs/arkham-content-migration.md)：整轮迁移六步、原语拆分、关键字/规则书、交互一致性、多子进程批量卡牌与原语队列。

## 不可协商

- **玩家卡行为一张卡一个文件**：`src/cards/entries/<code>.js`，`export default` 恰好一个条目，
  `code` 必须等于文件名。非玩家卡（敌人/地点/幕/议程等 9 条）仍走 `src/cards/encounter-abilities.js`，
  不要混进 `entries/`。
- **`card-abilities.js` 只聚合**；不要在它里面加条目，不要恢复 `ability-migration-batches.js`
  或任何 `BATCH_*` / `MIGRATED_*` 批次大数组。
- 新增/修改/迁移一张卡时，**同一次执行内**必须完成：写单卡文件 → `node tools/build-card-index.mjs --write`
  → `npm run test:fast`；行为改动还要 `replay-fixtures --baseline/--compare`。
- 卡文件不得 import `engine.js` / `card-abilities.js` / 批次文件 / `content/`；只通过描述子和 `ctx.api` 改状态。
- 5,930 张卡面数据仍在 `src/cards/cards-data.js`，**不要**按卡拆；未实现的卡不要预建空文件。
- **先原语、后卡牌**：卡只能使用已登记原语；需要新原语时按
  [`docs/arkham-content-migration.md`](docs/arkham-content-migration.md) §4.6.3 排队给主进程，子进程**不得**改 `src/engine/**`、`_shared.js`、`index.js`、`content/**`、`docs/**`、`audit/**`。
- **批量迁移的主进程是唯一索引写者**：子进程用 `scaffold-card --entry --no-index`，主进程合并后统一 `build-card-index --write`。
- **新交互先于批量卡牌**：新的选择/目标/提示/面板必须在批次前完成，复用现有界面 token，并通过桌面 1440 / 移动 390 浏览器验收。

## 一张卡的固定流程

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

`fast` 应全绿（2026-10-21 实测 2182 例全部通过）。新增失败必须为 0。

## 批量迁移（多子进程）

顺序固定：**扫描新增机制 → 拆分原语 → 关键字与规则书 → 新增交互与界面 → 批量卡牌 → 测试验收**。
完整协议见 [`docs/arkham-content-migration.md`](docs/arkham-content-migration.md) §4。

- **主进程**：唯一写共享文件（`src/engine/**`、`_shared.js`、`index.js`、`card-abilities.js`、`docs/**`、`audit/**`）；处理原语队列；合并后统一重建索引；跑全量门禁。
- **子进程**：只写自己分到的 `entries/<code>.js` 和 `artifacts/migration/<cycle>/primitive-requests/*.json`；用 `scaffold-card --entry --no-index`，不跑 `build-card-index`，不写 `_shared.js`/引擎/文档。
- **新原语**：子进程写请求（`pending`）→ 继续其他卡 → 主进程去重、实现、补测试、更新原语目录并回写 `done` → 子进程轮询后继续。不得由子进程改引擎。
- **卡牌只能用已登记原语**；单卡一次性逻辑可以 `resolve`，但要在 `primitive-plan.json` 的 `escape` 登记理由。
- 合并门禁：分片无交集、worker 无越界写入、`cards:check` 通过、replay 一致、`test:fast` 无新增失败、队列无悬挂。

## 旧 DSL 迁移

```bash
node tools/migrate-card.mjs --plan 01xxx
node tools/migrate-card.mjs --write 01xxx
node tools/migrate-card.mjs --verify
```

工具现在直接写 `src/cards/entries/<code>.js` 并重建索引；`--batch` 只影响账本分组。
