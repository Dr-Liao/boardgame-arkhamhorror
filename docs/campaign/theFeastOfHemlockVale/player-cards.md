# 《铁杉谷盛宴》一般玩家卡（P6 交付说明）

P6 迁移 `10019`–`10138` 共 **120 条记录**（102 张可构筑玩家卡 + 4 张基础弱点 + 11 张绑定/场外依赖 +
3 张 Research 卡）。逐卡证据见 `audit/fhv-player-acceptance.json`（`status: verified`），
浏览器证据见 `audit/fhv-player-browser.json`（双视口 10/10）。

## 1. 分片与批量协议

- 分片计划：`node tools/plan-fhv-player.mjs --write` → `audit/fhv-player-shards.json`（12 片 × 10 张）、
  `audit/fhv-player-queue.json`、运行目录 `artifacts/migration/fhv/workers/` 的 worker 输入
  （逐卡印刷文本、参考实现 Haskell 行号、机制归类、原语引用）。
- 每片 worker 只写 `src/cards/entries/<code>.js` 与本片 `tests/fhv-player-m2-N.test.mjs`；
  主进程负责索引重建、共享层、账本、文档与全量门禁。
- 逐卡验收：每张卡至少一条实跑的非 skip `P6 <code> …` 测试；
- 缺原语时写 `artifacts/migration/fhv/primitive-requests/<code>.json`，条目可先近似实现并在
  `note:`/`simplified` 逐条披露，不直写状态绕过 API。

## 2. 逐卡结果

| 口径 | 数量 | 说明 |
| --- | ---: | --- |
| 记录总数 | 120 | `10019`–`10138` |
| 逐卡行为验收（verified） | 120 | 每张至少一条实跑 `P6 <code>` 测试；12 份分片测试共 142 条用例全绿 |
| 可构筑（进大厅构筑池） | 102 | `src/cards/fhv-player-acceptance.js#FHV_PLAYER_BUILDABLE_CODES` |
| 基础弱点（只作随机基础弱点依赖） | 4 | `10135`–`10138` |
| 绑定/场外依赖（deckLimit=0，只作依赖） | 11 | `10036`、`10039`、`10045`、`10063`、`10086`–`10090`、`10106`、`10107` |
| Research（P7 战役日志购牌读点前不进池） | 3 | `10059`、`10060`、`10061` |
| 近似披露（`simplified: true` + 逐条 `note`） | 54 | 逐卡 `simplification.disclosures` 见账本；不声称与印刷文本等价 |
| 原语请求（P7–P8 原语 backlog） | 45 | `artifacts/migration/fhv/primitive-requests/*.json`，裁决见 `audit/fhv-player-request-disclosures.json`（全部 deferred） |

分片测试：`tests/fhv-player-m2-1.test.mjs` … `m2-12.test.mjs`（每片 10 张），通用原语/包边界：
`tests/fhv-player-primitives.test.mjs`（Double 额外行动三处同源、包边界、依赖/Research 口径）。
浏览器：`tests/fhv-player.browser.mjs`，桌面 1440 / 移动 390 各 5 例（构筑池、事件、资产、技能、基础弱点）。

## 3. 跨卡共通机制

- **Double 特质（11 张）**：卡面「As an additional cost to play X, spend an action.」统一由
  played 描述子 `cost: { action: 1 }` 声明，引擎在 `legalMoves` / `validateMove` / `doPlay`
  三处同源校验并扣减额外行动（`src/engine/ability.js#playedActionCost`）。
- **祝福/诅咒（Blessed/Cursed）**：复用 P2 `chaos-pool` 原语（加/减/替换/封印/支付组合费用）。
- **绑定/场外依赖（11 张，deckLimit=0）**：只作依赖，由绑定原语带入，不进构筑池。
- **基础弱点（10135–10138）**：只进随机基础弱点池，不进入构筑池与可构筑数量。
- **Research（10059/10060/10061）**：需要战役日志「you have classified a new species」的购牌读点，
  P7 战役流程接线前不进入构筑池（账本 `researched` 标记 + `dependencyOnly` 口径）。
- **面具（`[[Mask]]`）**：复用 P2 `assets.maskLifecycle`（同特质上限、地点入场与毁灭放置区分）。

## 4. 内容包与可用性

- `content/packs/fhvPlayer/manifest.js`：P6 起 `playable`，120 条 `rulesImplemented: true`，
  102 张 `deckbuilding: true`，基础弱点 `dependencyOnly: true`；
- `src/deck/availability.js`：`FHV_PLAYER_VERIFIED_CODES` 进入 strict 可用集，可构筑码表来自生成物
  `src/cards/fhv-player-acceptance.js`；`ALL_BUILDABLE_CODES` / `EXPANDED_PLAYER_CARD_CODES` 纳入 102 张；
- 战役包（`fhvCampaign`）与八章仍 `catalog-only`，属 P7–P8。

## 5. 验收命令

```powershell
node tools/plan-fhv-player.mjs --check         # 分片/队列/worker 输入复算
npm run test:fhv:player                        # 八片逐卡 Node 验收 + 通用原语
node tools/audit-fhv-player.mjs --check        # 账本与生成物逐字节复算
node tools/run-fhv-player-browser.mjs          # 浏览器双视口 10 例 + 截图
npm run verify:fhv:node                        # Node 验收账本（含 player 段）
npm run verify:fhv:regression                  # fast 无新增失败 + replay 零漂移
npm run cards:check                            # 索引/一卡一文件/条目合规（含 R1/R2/R3）
node tools/replay-fixtures.mjs --compare tests/fixtures/replay/golden-replays.json
```

退出门禁：`audit/fhv-player-acceptance.json#status = verified`（全员 verified、分片覆盖、近似披露、
原语请求裁决、浏览器双视口、包边界、replay/fast 全真），且全量 `npm run test:fast` 无新增失败
（既有 EOTE 2 项按 P3–P5 记账）。
