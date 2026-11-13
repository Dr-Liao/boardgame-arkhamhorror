# 《绯红密钥》一般玩家卡（P6 交付说明）

P6 迁移 09021–09128 共 108 条记录（103 张可构筑玩家卡 + 5 张基础弱点 09124–09128），
含 16 张定制升级卡（Customizable）与跨循环重印 canonical 处理。
逐卡证据见 `audit/tsk-player-acceptance.json`（`status: verified`），浏览器证据见
`audit/tsk-player-browser.json`（双视口 10/10）。

## 1. 分片与批量协议

- 分片计划：`node tools/plan-tsk-player.mjs --write` → `audit/tsk-player-shards.json`（4 片 ×27）、
  `audit/tsk-player-queue.json`、运行目录 `artifacts/migration/tsk/workers/` 的 worker 输入；
- 每片 worker 只写 `src/cards/entries/<code>.js` 与本片 `tests/tsk-player-m2-N.test.mjs`；
  主进程负责索引重建、共享层、账本、文档与全量门禁；
- 逐卡验收：每张卡至少一条实跑、非 skip 的 `P6 <code> …` 测试；四片 126 例全绿；
- 缺原语时 worker 写 `artifacts/migration/tsk/primitive-requests/<code>.json`，条目 `note` 逐条披露近似。

## 2. 逐卡结果

| 指标 | 数值 |
| --- | --- |
| 记录总数 | 108（103 可构筑 + 5 基础弱点） |
| verified | 108/108（全部有逐卡实跑证据） |
| 近似披露 | 61 张（`simplified: true` + `note`，逐条披露，不冒充印刷等价） |
| 分片测试 | 126 例全绿（M2-1 27 + M2-2 27 + M2-3 27 + M2-4 45） |
| 浏览器验收 | 10/10（桌面 1440 / 移动 390；构筑池、事件、资产、技能投入、弱点显现 + 10 张截图） |
| 原语 backlog | 56 份请求 / 31 个卡号，全部 `deferred`（P7–P8 原语 backlog），账本 `primitiveBacklog` 可查 |
| 跨循环重印 | 04096↔09587（canonical 04096 战役卡）、09064↔12049（canonical 09064 本循环实现一份） |

## 3. 定制升级卡（16 张）

勾选面板契约由条目静态声明 `customizationOptions`（数据源 cards-data 的 `customizationText` 逐字），
注册期登记到 `src/engine/tsk-customizable.js` 原语；可实现的运行时效果（费用修正等）经
`customizationEffects` / 条目读点接线，缺读点的选项在条目 note 与 primitive-request 中逐项披露。

## 4. 内容包与可用性

- `content/packs/tskPlayer/manifest.js`：P6 起 `playable`，108 条 `rulesImplemented: true`，
  103 张 `deckbuilding: true`，09124–09128 `dependencyOnly: true`；
- `src/deck/availability.js`：tskPlayer 码表来自生成物 `src/cards/tsk-player-acceptance.js`；
- `src/deck/deckbuilding.js`：103 张可构筑卡进入 `EXPANDED_PLAYER_CARD_CODES`（大厅构筑池）；
- 战役卡（09501+）与十章仍 `catalog-only`，不在大厅可启动/可构筑。

## 5. 基线处理（一次性、已登记）

P6 注册 108 张玩家卡条目并开放构筑池后，整局状态投影与（EotE/TIC P8 脚本中的）自动牌组卡池
发生变化，既有整局 replay 基线按同一固定脚本/recipe 一次性重采；TSK golden replay 行为零漂移
（`replay-fixtures --compare tests/fixtures/replay/tsk-baseline.json` exit 0）。处理清单与理由
与 P5 相同口径（见 `docs/campaign/theScarletKeys/investigators.md §4`）：EotE/TIC P8 基线重采，
TSK 账本（scope/mechanism/primitives/rules/interactions/investigators/player）与 TDE P10 账本重签；
既有 4 条冻结 fast 失败集合保持不变。

## 6. 验收命令

```powershell
node tools/plan-tsk-player.mjs --check
npm run test:tsk:player                       # 四片逐卡 Node 验收（126 例）
node tools/audit-tsk-player.mjs --check       # 账本与生成物逐字节复算
node tools/run-tsk-player-browser.mjs         # 浏览器双视口验收（10 例 + 截图）
npm run cards:check                           # 索引/一卡一文件/条目合规（含 R1/R2/R3）
node tools/replay-fixtures.mjs --compare tests/fixtures/replay/tsk-baseline.json
```

退出门禁：`audit/tsk-player-acceptance.json#status = verified`（6 项 gates 全真）、
四片测试全绿、浏览器双视口通过、fast 失败集合等于 P0 冻结 4 条。
