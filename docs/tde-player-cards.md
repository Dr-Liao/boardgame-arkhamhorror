# 《食梦者》玩家卡手册（M2 / P7 骨架 · draft）

> **口径**：本文件是 **P7 之前的骨架**（`draft`），只登记 87 张玩家卡的分片、关键词归属与验收契约；TDE 仍是 `catalog-only`，玩家卡**不可构筑**。
> 事实来源：[`scope.json`](../artifacts/migration/tde/scope.json) 的 `shards.playerWaves` 与 [`mechanism-scan.json`](../artifacts/migration/tde/mechanism-scan.json)。
> 路线图：[`tde-migration-roadmap.md`](./tde-migration-roadmap.md) §8.2 / §1.3；规范：[`arkham-content-migration.md`](./arkham-content-migration.md) §4.6（多子进程 + 原语队列）。

## 1. 事实：87 张 = 83 普通 + 4 基础弱点

| 分片 | 张数 | 卡号区间（含端点） | 备注 |
| --- | ---: | --- | --- |
| `M2-1` | 22 | 06018–06110 | 含 06019 嗜血（bonded 弱点） |
| `M2-2` | 22 | 06111–06195 | |
| `M2-3` | 22 | 06196–06245 | 含 06199 三张 A、06241–06243 自我赋能（Myriad） |
| `M2-4` | 21 | 06246–06332 | 含 06283 无束之兽（bonded 弱点）、06245 希望微光（Myriad）、06331 梦境寄生物 |

- 基础弱点 **4 张**：06035 自私、06036 盗窃癖、06037 嗜睡症、06038 你最可怕的梦魇（只作依赖，不进构筑池）。
- bonded 弱点 **4 张**：06019 嗜血、06025 水晶仪守护者、06283 无束之兽、06331 梦境寄生物。
- 关键词归属（P2 实测）：**Myriad 14 张**全部在玩家包；`Researched` 3 张（06236–06238 梦境日记）在玩家包；`Bonded` 27 条里玩家包占多数（06013/06014/06018/06019/06021/06022/06024/06025/06027/06028/06030/06031/06032/06033/06276/06277/06282/06283/06330/06331 等）。
- 印刷包分布见 P1 账本（tde 112 / sfk 62 / tsh 41 / dsm 40 / pnr 54 / wgd 47 / woc 32，全循环口径）。

## 2. 卡片契约（与既有循环一致）

- **一张有行为的卡 = 一个文件**：`src/cards/entries/<code>.js`，`export default` 恰好一个条目，`code` 等于文件名；不得写进 `card-abilities.js` 或任何批次大数组。
- 卡文件不得 import `engine.js` / `card-abilities.js` / 批次文件 / `content/`；只通过描述子与 `ctx.api` 改状态。
- 新增/修改一张卡的同一次执行内：写单卡文件 → `node tools/build-card-index.mjs --write` → `npm run test:fast`；行为改动还要 `replay-fixtures --baseline/--compare`。
- 未实现的卡不预建空文件；需要新原语时走 `artifacts/migration/tde/primitive-requests/*.json` 队列，**子进程不得改引擎**。

### 2.1 escape 逃生口（§5.3，单卡逻辑必须在 P3 账本登记）

| 卡号 | 名称 | 理由 |
| --- | --- | --- |
| 06164 | 飘渺灵体 | 「无形」状态位只服务 1 张卡 |
| 06329 | 闪耀的偏方三八面体 | 费用替代管线的一次性特例 |
| 06331 | 梦境寄生物 | 负技能图标 + 强制投入；若做通用负图标原语则移出 escape |

## 3. 待办（P7 / M2）

| # | 事项 | 产物 / 验收 |
| ---: | --- | --- |
| 1 | 四个分片的多子进程迁移 | 每片 22/22/22/21 张，`--no-index` 写单卡文件 |
| 2 | 原语请求队列 | `primitive-requests/` 的 `pending → claimed → done/rejected`，统计写 `reports/primitive-queue.json` |
| 3 | Myriad 构筑限制 | `deck.myriadLimit`（同名至多 3 张）在构筑期生效 |
| 4 | 逐卡账本 | `audit/tde-player-acceptance.json` + `audit:tde:player` |
| 5 | 分片/队列报告 | `shards.json`、`workers.json`、`merge.json` |
| 6 | 门禁 | `cards:check`、`cards:encounter-check`、replay `--compare` 一致、`test:fast` 无新增失败 |

## 4. 边界

- `content/packs/tdePlayer/manifest.js` 是 **M0 骨架**（`rulesImplemented=false`、`deckbuilding=false`）；P7 完成后才允许把包状态推进。
- Myriad 的「同名至多 3 张」是构筑期规则，**不是**单卡行为：先在 P3 落地 `deck.myriadLimit`，再批量写卡。
- 06199/06241–06243 依赖「多张同名同时在场」的合体结算，属卡牌行为，不得用构筑限制替代。

## 5. 相关手册与维护

- 调查员（专属卡依赖）：[`tde-investigators.md`](./tde-investigators.md)；原语：[`tde-primitives.md`](./tde-primitives.md)；规则书：[`tde-rules.md`](./tde-rules.md)；发布：[`tde-release.md`](./tde-release.md)。
- 维护：分片与卡数以 `scope.json` 的 `shards.playerWaves` 为准；每片合并后由主进程统一重建索引并跑门禁。
