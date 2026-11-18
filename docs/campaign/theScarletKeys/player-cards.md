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

### 3.1 玩家交互流程（2026-11-16 P2-3 后的真实路径）

```
构筑期 scenarioSetup / 关间 interlude
  → mechanic-view#customizationHub（按 observer 本人座位投影）
       { availableXp, entries: [{ code, name, checked, level, xpPerCheck, canUpgrade,
                                  options: [{ name, checks, checkedCount, implemented }] }] }
  → web/hub.js#customizationPanel（桌面 1440 / 移动 390 同面板）
  → 每个选项显示「已勾 checkedCount / 共 checks 格」与一枚「下一格」按钮
  → hubCustomize（legalMoves 逐格生成：cost = 1 或 exceptional 的 2 XP，availableXp = 当前未花费 XP）
  → dispatch#hubCustomize（相位/座位/牌组/未满格校验；且只能由该座位自己提交）
  → tsk-customizable#upgradeCustomization（勾选合法性、只能增加、XP 足够；写
     campaign.tsk.customizations.bySeat[seat][code]）
  → record.xp -= xpCost、record.spentXp += xpCost、campaign.xp 同步、info 日志
  → 面板刷新 level = ceil(勾选数 / 2)、选项格数、可用 XP；JSON 存档往返保留。
```

运行时读点：卡条目用 `customizationOptionFullyChecked(state, seat, code, optionIndex)`
（或 `api.mechanics.tsk.customizable.optionFullyChecked`）读取——**多格选项必须勾满 `checks` 格才生效**；
减费类在 `turn-flow.js#playCost` 的 abilityLayer 汇总 `customizationEffects.playCost`
（与 `playCostModifier` 单一声明，禁止同一效果两处声明造成双重减费）。

### 3.2 交互口径与边界（P2-3 修复）

- **多座位**：每个真人座位只给自己勾选（旧实现硬编码房主座位 0，多人局其他玩家永远无法升级）；
  伪造跨座位提交被 `validateHubMove` 拒绝且不扣 XP。AI 座位不产生勾选候选（AI 自动升级不处理定制）。
- **勾满才生效**：09021/09022/09023/09040/09042/09079/09081/09099/09100/09119 的
  2–5 格选项此前用 `includes(index)` 判定，勾 1 格即拿整项效果（白付 1–3 XP）；现已逐卡改为勾满读点。
- **费用效果**：09021/09022/09023 同时声明 `customizationEffects.playCost` 与 `playCostModifier`
  但前者从未被引擎读取；09061 Impulse Control 的 -1 费因此**完全没生效**。现统一由
  `turn-flow#playCost` 汇总 `customizationEffects.playCost`（勾满才减），重复声明已删除。
- **approximation 勾选格**：09041（8 格）与 09101（5 格）的规则尚未接读点，此前可购买但无效果。
  现声明 `implemented: false`：面板仍展示卡面文本并标「规则未实现：暂不可勾选」，不再生成候选，
  dispatch 伪造提交也拒绝（不浪费 XP）；旧存档里已勾选的格仍可加载。
- **写实边界**：升级草稿（hubPurchase staged）存在时定制候选隐藏、提交报「先保存/撤销」；
  勾满的选项不再给候选；过期候选（availableXp 变化）被拒且不重复扣 XP；
  exceptional 卡的每格 XP 元数据与候选/结算同口径（当前 16 张均非 exceptional）。
- **仍余**：09041/09101 需补读点后才可勾选；AI 座位不自动定制；P2-8 的事务层
  （`createTskInteractions#customizable.upgrade`）尚未接入大厅路径（当前 hub 直接调原语，
  与交互层同源但非同一包装）。

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
