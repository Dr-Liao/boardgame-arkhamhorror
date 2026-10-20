# Phase 4 重放安全网（重构路线 §6 Phase 4 的交付与门禁证据）

> 日期：2026-02。本文是 Phase 4 的**交付说明 + 门禁证据**，不是新的规矩来源：
> 分层与硬约束见 [`../ARCHITECTURE.md`](../ARCHITECTURE.md)，阶段与判据见
> [`architecture-refactor-roadmap.md`](architecture-refactor-roadmap.md)，卡片模型见
> [`card-model.md`](card-model.md)。
>
> 阅读顺序：§1 交付清单 → §2 日志与指纹契约 → §3 API 用法 → §4 **迁移批次怎么用（Phase 5 的前置）**
> → §5 golden 基线 → §6 门禁证据 → §7 明确留白。

---

## 1. 交付清单

Phase 4 的目标是"把行为零变化变成可断言"：`{ settings, players, moves[] }` → 状态 → 稳定指纹。
五件产物全部落地，Phase 5 的每个迁移批次都可以直接用它做前后对比。

| # | 产物 | 文件 | 读点 / 命令 | 测试 |
| --- | --- | --- | --- | --- |
| 1 | 对局日志 + 稳定指纹 + 重放 + 回退 | `src/engine/replay.js` | `captureReplayLog` / `stateHash` / `replayLog` / `replayHashes` / `verifyReplay` / `rewindTo` / `undoMoves` | `tests/replay.test.mjs`（14 条） |
| 2 | 动作日志进权威状态 | `src/engine/engine.js` 的 `applyMove` | `state.actionLog`（`{ seat, move }`，纯 JSON，随存档往返） | 同上 + `tests/save-migration.test.mjs` |
| 3 | 真实对局的 golden 基线 | `tests/fixtures/replay/golden-replays.json` | `npm run replay:fixtures`（校验）/ `replay:fixtures:write`（重采） | `tests/replay-golden.test.mjs`（5 条） |
| 4 | 随机对局门禁 + 随机走子器 | `tools/replay-games.mjs` + `tests/replay-fuzz.test.mjs` | 100 局随机对局逐步重放一致；5,000 步随机走子断言不变量 | `tests/replay-fuzz.test.mjs`（2 条，slow tier） |
| 5 | 迁移对比工具 | `tools/replay-fixtures.mjs` | `--baseline <文件>` / `--compare <文件>` / `--verify` | 手工工作流，见 §4 |

顺带补的引擎侧改动（都是为了让"重放"真正成立，而不是给某张卡加分支）：

- `createGameState(settings)` 新增可选的 `settings.seatInvestigators`：AI 席位的调查员由 persona 与独立随机流决定，
  而 persona 不进 `state`，因此重放必须能锁定"建局时每个座位选到谁"。正常开局不传这个字段，行为不变。
- `state.setup` 增加 `seatInvestigators` 快照（**建局时**的选择）：关间换人由动作日志重放，不会覆盖它。
- `src/engine/resolution.js` 的 `continuation.move` 只保留语义字段（去掉 `label` / `explanation`）：
  事务恢复凭据会进 `state`、进存档、进指纹，展示文案不该参与"行为是否变化"的判断。
- `src/engine/effects.js` / `engine.js` 的两处空目标处理（见 §6.3，随机走子器发现的两个合法动作崩溃）。

---

## 2. 日志与指纹契约

### 2.1 日志形状

```js
{
  version: 1,                       // 日志格式版本；字段只增不减
  meta: { hashVersion: 2, schemaVersion: 7, rulesVersion: 'n6.0', moveCount: 53 },
  settings: {
    campaignId, difficulty, rulesMode, seed,
    campaignHub,                    // 是否走局外流程（决定建局后的 uiState）
    aiStoryAwareness,               // 布尔；影响 state 字段与 AI 上下文
    playerInvestigator,             // 建局时座位 0 的卡号
    seatInvestigators: [...],       // 建局时每个座位选到谁（锁定 AI 选人结果）
    playerDeck,                     // 可选：自定义卡组
  },
  players: [{ seat, role }],        // role: 'human' | 'ai'；必须按座位顺序排列
  moves: [{ seat, move }],          // 每次成功 applyMove 追加一条；不含 revision
}
```

三条硬约束：

1. **纯数据**：JSON 往返后逐字相同（`tests/replay.test.mjs` 有断言），不带闭包、Date、Map。
2. **建局参数够用**：`settings` 必须覆盖 `createGameState` 读到的全部输入。Phase 4 之前漏了
   `aiStoryAwareness` 与 AI 选人依据，`tests/replay.test.mjs` 的"建局参数完整"用例是这条的回归守卫。
3. **位置信息不进日志**：`move.revision` 由"这是第几个动作"决定；检查点分支会把 revision 拨快一步却不多记动作，
   保留它会让分支无法重放。

### 2.2 指纹组成（`STATE_HASH_VERSION = 2`）

`stateHash(state)` = 键排序后 JSON 的 sha256。**只覆盖权威状态**：

| 类别 | 字段 | 为什么排除 |
| --- | --- | --- |
| 派生资源 | `cards`、`investigatorDefs`、`classNames`、`classColors`、`skillNames`、`tokenLabels`、`resourceVersion` | 能从当前内容重建；算进指纹会让"资源升级/新增卡牌"伪装成"行为变化"，而且它们占 state 体积的 ~90% |
| 瞬时字段 | `legalMoves`、`actionLog`、`lastActionSnapshot` | 每个动作重算，或只对本次请求有意义 |
| 事务临时字段 | `_` 前缀（`_resolution` / `_reaction` / `_actionPaid` …） | 只在当前事务内有效 |

参与指纹的包括：`revision` / `rngState` / `seed` / `investigators` / `locations` / `enemies` / `campaign` /
`effects` / `pendingChoice` / `continuation` / `log` / `scenario` / `scenarioFlags` / 各牌区与结算记录。
`effects` 参与意味着"临时修正"也在覆盖范围内；`continuation` 参与意味着"停在待决选择"的存档形态也要一致。

>`state.log`（事件文案，上限 120 条）**参与**指纹：迁移如果改动了"该触发什么事件"，指纹会变。
> 只改展示字段（动作的 `label`）不会变——它们不进 `continuation`，也不进 `state`。

`REPLAY_HASH_OMITTED` 导出了这两份清单，测试逐字段断言，不要在别处复制。

### 2.3 为什么指纹里没有"卡牌目录"

`state.cards` / `investigatorDefs` 是建局时嵌入的资源快照（图鉴和展示用），规则结算不读它。
迁移卡牌行为时，目录数据只增不改语义；把它算进指纹会让每次卡图/文案/字段更新都要求重采全部基线，
遮蔽真正的行为差异。需要核对资源本身时，用 `resourceVersion` 与内容审计（`npm run cards:audit`）。

---

## 3. API 用法

```js
import {
  captureReplayLog, stateHash, replayLog, replayHashes, replayHash,
  verifyReplay, stateDiff, rewindTo, undoMoves, undoDepth,
} from './src/engine/replay.js'

// 1. 记录：从权威状态还原建局参数 + 动作序列（纯 JSON）
const log = captureReplayLog(state)

// 2. 重放：从头建局，按日志逐条 applyMove；until 取中间态
const replayed = replayLog(log)
const past = replayLog(log, { until: 10 })
assert.equal(stateHash(replayed), stateHash(state))

// 3. 逐步指纹：一次重放比较全部中间态（golden 基线就靠它，O(n) 而不是 O(n²)）
assert.deepEqual(replayHashes(log), recordedHashes)

// 4. 自检：当前状态能不能被自己的日志重放出来
const report = verifyReplay(state)   // { ok, hash, replayHash, moves, differences }
if (!report.ok) console.log(stateDiff(state, replayed))  // 路径 + 前后值，最多 24 条

// 5. 撤销：截断动作日志后重放，原地替换（调用方持有的引用保持有效）
rewindTo(state, 20)       // 回到"已提交 20 个动作"的状态
undoMoves(state, 3)       // 撤销最近 3 步
undoDepth(state)          // 当前可撤销的步数
```

实现约束（迁移/战斗逻辑改动时不要破坏）：

- `actionLog` 由 `applyMove` 在**事务外**持有：`resolveTransaction` 会用"本次动作开始前"的快照重建状态，
  `dynamicState` 已把 `actionLog` 排除在事务快照之外，否则历史会被后续选择覆盖。
- 重放只依赖 `settings/players/moves`；任何"读外部状态"的规则都会让重放漂移（`tests/replay.test.mjs`
  的随机对局用例会立刻失败）。
- 所有随机都必须走 `randomValue(state)`（`rules-state.js`），询问必须走 `requestChoice`（`resolution.js`）：
  这两个是"可重放"的唯二随机/交互入口。

---

## 4. 迁移批次怎么用（Phase 5 的前置）

路线 §7 要求"迁移必须行为零变化"。Phase 4 之后，一个批次的标准动作是：

```powershell
# ① 迁移前：用当前代码采集一份临时基线（生产内容、纯合法动作、10 局 / 529 步）
node tools/replay-fixtures.mjs --baseline ..\..\artifacts\replay-before.json

# ② 改卡：写描述子 / 删旧分支 / 改测试
#    （原则不变：一批只做一件事，行为零变化）

# ③ 迁移后：用同一批对局重放，逐条比较指纹
node tools/replay-fixtures.mjs --compare ..\..\artifacts\replay-before.json
# ✔ 输出 "与基线逐条一致（行为零变化）" 才算通过；
# ✖ 会打印第一个不同的步数与那一步的动作（座位 + action/cardId/optionId）。
```

判定口径：

| 结果 | 含义 | 处理 |
| --- | --- | --- |
| 全部一致 | 状态序列完全没变 | 通过，继续跑该卡/该战役的验收用例 |
| 第 N 步起不同 | 从那个动作开始行为变了 | 先判断是不是"有意的修复"；不是就回退这次改动 |
| 只有某几张卡的对局不同 | 改动只影响那几张卡的路径 | 用 `--baseline` 输出里的 `id` 定位是哪一局 |
| 基线指纹版本不同 | `STATE_HASH_VERSION` 变了 | 说明指纹口径改了，重新采集基线（不要跨版本比较） |

`npm run replay:fixtures` 校验的是**仓库里的 golden 基线**（见 §5），对应"这批改动有没有动到既有真实对局"；
`--baseline/--compare` 是针对**本次迁移**的临时基线。两者互补：

- 迁移批次：`--baseline` → 改 → `--compare`；
- 提交前：`npm run replay:fixtures`（基线没被无意改动）+ `npm run test:fast`；
- 有意改变行为（修 bug、补简化、剧本调整）：更新对应验收用例，再 `npm run replay:fixtures:write` 重采基线，
  把"行为变化"显式写进 diff。

> `docs/arkham-content-migration.md` §9 已把 `npm run replay:fixtures` 列入最低验证命令。

---

## 5. golden 基线（`tests/fixtures/replay/golden-replays.json`）

10 局生产内容对局，由 `tools/replay-games.mjs` 的 recipe 驱动，动作全部来自 `legalMoves` + `validateMove`。
每局存 `log` + **逐步指纹** + `final` 摘要；文件约 150 KB（动作里的 `label`/`explanation` 已剔除）。

| recipe | 驱动器 | 步数 | 覆盖 |
| --- | --- | --- | --- |
| `notz-gathering-hub-victory-r1` | p6 | 53 | 局外准备 → 集结 → 分支 r1 结算（同 `tests/p6-content.test.mjs` 的棋子） |
| `notz-gathering-hub-victory-r2` | p6 | 52 | 分支 r2 的战役记录（烧屋） |
| `notz-gathering-defeat` | p6 | 25 | 自然失败路线（被击败 → 关卡结算 → 战役结算） |
| `notz-gathering-resign` | p6 | 60 | 主动撤退路线 |
| `notz-midnight-masks` | p6 | 96 | 关间升级（`hubPurchase`/`hubConfirmUpgrades`）→ 第二关午夜假面 |
| `notz-gathering-pending-choice` | p6 | 12 | **停在待决选择**：`pendingChoice` + `continuation` 的存档形态 |
| `carcosa-curtain-call-hub` | generic | 50 | 《卡尔克萨之路》2 人局外流程 → 帷幕落下（D1 敌人/地点、剧本钩子） |
| `dunwich-extracurricular-hub` | generic | 70 | 《敦威治遗产》2 人局外流程 → 课外活动 |
| `tfa-untamed-wilds-hub` | generic | 31 | 《失落的时代》3 人局外流程 → 荒莽密林（探索牌库、中毒、补给） |
| `notz-strict-random-3p` | random | 80 | 严格规则模式 + 3 席位随机走子（多人共同决定、可选反应自动跳过） |

合计 **10 局 / 529 步**，覆盖 4 个战役、5 个关卡、3 种 `uiState`（`scenarioResult` / `campaignResult` / `inScenario`）。

**测试断言**（`tests/replay-golden.test.mjs`）：

1. 文件与当前 `STATE_HASH_VERSION` / `RULES_VERSION` / `STATE_SCHEMA_VERSION` / recipe 清单一致；
2. 每局一次重放拿到**全部中间指纹**，与基线逐项相等；最终 `uiState` / `status` / 关卡 / `revision` / 待决选择一致；
3. 抽样做 JSON 往返与 `until` 前缀等价；
4. 至少一局停在待决选择上，`verifyReplay` 自检为 `ok`；
5. 动作与关卡覆盖不退化（局外准备、`choose`、战斗、剧情推进都在）。

**什么时候要重采**：行为确实变了、关卡/战役结构变了、`rulesVersion` 或 `STATE_HASH_VERSION` 变了。
**什么时候不该重采**：只改了文案/卡图/目录字段——先怀疑自己动到了规则，再看 `stateDiff` 的路径。

---

## 6. 门禁证据

### 6.1 门禁 1：任一现有测试局可重放出相同 hash

`npm run replay:fixtures`（等价于 `node tools/replay-fixtures.mjs --check`）：

- 10 局逐条比对**逐步指纹**（529 步 = 530 个指纹），全部相等；
- `npm run replay:fixtures:verify` 额外用驱动器**实时重跑**同一批 recipe，再与基线比较，同样全部相等
  ——这就是"现有测试局实时执行 == 重放"的直接证据；
- 基线覆盖了 `tests/p6-content.test.mjs` 的两条"纯合法动作从局外完成集结"路线（r1/r2）、失败路线与撤退路线，
  因此"现有测试局"不是另造的对局，而是既有验收用的同一颗棋子。

### 6.2 门禁 2：100 局随机对局 replay 与实时执行一致

`tests/replay-fuzz.test.mjs`（slow tier）第 1 条：100 局随机对局，4 个战役轮转、1–4 席、严格/简化模式混跑，
步数按席位放大（`8 + 5 × 席位数`，保证 4 人局也能走完局外准备进关）；每局逐步比较"实时记录的指纹"
与"重放日志得到的指纹"，并抽查 10 局的 JSON 往返。

实测（本次运行）：

| 指标 | 值 |
| --- | --- |
| 对局数 | 100 |
| 合计动作数 | 2,039（每局 13–28 步） |
| `choose` 次数 | 923 |
| 覆盖关卡 | 4（`theGathering` / `extracurricularActivity` / `curtainCall` / `theUntamedWilds`） |
| 走到关卡结算（`campaignResult`） | 5 局 |
| 逐步一致率 | 100%（2,039 / 2,039 步） |

### 6.3 随机走子器：5,000 步不变量

`tests/replay-fuzz.test.mjs` 第 2 条，跨 67 局累计 5,018 步（每局最多 400 步，走完就换下一局），每步断言：

| 不变量 | 内容 |
| --- | --- |
| 版本单调 | 每个成功动作 `revision` 恰好 +1 |
| 行动点/资源 | 非负整数 |
| 线索守恒 | `state.clues === Σ 调查员线索` |
| 毁灭守恒 | `state.doom` 与场上毁灭计数都非负 |
| 引用完整 | 调查员/敌人所在地点存在；`engaged` 指向的敌人存在；敌人 id 唯一 |
| 生命区间 | 未败北时 `damage ≤ maxHealth`、`horror ≤ maxSanity`（败北允许"最后一击"溢出） |
| 卡号可解析 | 每 100 步 `unknownCardCodes(state)` 为空 |
| JSON 幂等 | 每 100 步 `stableStringify(JSON.parse(JSON.stringify(state))) === stableStringify(state)` |
| 关键步重放 | 前 3 局整局逐步指纹与重放一致 |

**关于"牌数守恒"**：没有按区域做 multiset 守恒。实测（`artifacts/` 探针，未入库）本引擎会合法地
"凭空"改变区域计数——遭遇敌人从 `encounterDeck` 入场、遭遇卡加入手牌/威胁区、剧情资产入场、
"移出游戏"离开所有跟踪区域、以及暂停事务把换牌中的卡放在事务局部变量里（`continuation` 之外看不到）。
按区域计数会把上面这些合法机制全部误报。因此改用同类的"卡号可解析 + 逐步重放等价 + JSON 幂等"来守
"凭空造卡/丢卡"这一类损坏。

**随机走子器发现的真实缺陷（已修）**：

1. `effects.js` 的 `evade` 效果在没有交战敌人时抛 `没有合法敌人目标`：`enemyForTarget` 把"没有目标"
   转交给了会抛错的 `chooseEnemy`，而调用方本来就按 null 分支处理。现在 `enemyForTarget` 返回 `null`，
   `evade` 记一条"没有交战的敌人"后结束；`fight` 同样按空目标处理。
2. `03033 解锢灵魂`的候选会把"需要敌人目标、但场上没有合法目标"的法术（例如 `01066 眩光一闪`）也列进去，
   选中后白弃一张牌。现在候选只保留能真正结算的牌，并在没有候选时记一条日志。

这两处都是**合法动作导致崩溃/空转**的路径，不是 Phase 4 引入的；随机走子器是第一次把它们走到的用例。

### 6.4 回归基线（本次实测）

| tier | 结果 | 说明 |
| --- | --- | --- |
| `fast` | 2028 / 2020 通过，8 失败 | 8 条是 Phase 0 记账的既有漂移（`rules-n3`×5、`campaign-http-n4`×1、`checkpoint-rewind`×1、`carcosa-implementation-gaps`×1） |
| `slow` | 341 / 330 通过，11 失败 | 11 条均为既有失败，见下 |

slow tier 的 11 条（在 `artifacts/phase4/pre-phase4` 的**撤销 Phase 4 改动**副本上逐条复现，失败集合一致）：

| 文件 | 条数 | 内容 |
| --- | --- | --- |
| `campaign-n4` | 8 | 1 条"同次伤害恐惧双败选创伤" + 7 条"合法战役失败流程"（1/2/3/4 人 × 难度组合） |
| `notz-n4` | 1 | 第三关四个使者组数量/漏牌编号 |
| `dunwich-rules` | 1 | D9 Mind Wipe 移除 brood 印刷免疫与生命加值（D1 区，Phase 3 遗留） |
| `p2-hub-http` | 1 | 关卡结算停在局外页，升级完成后进入下一关 |

> 更正：Phase 3 交付说明只记了 `campaign-n4` 8 条 + `notz-n4` 1 条；实际还有 `dunwich-rules`（D9 Mind Wipe）
> 与 `p2-hub-http`（P2 关卡结算）两条既有失败。Phase 4 的基线按 11 条记账，新增失败一律视为回归。

`assets` tier 本次未重跑（Phase 4 不触碰生成物/图片/导入）：Phase 2 记录为 119/123，
4 条失败在 `HEAD` 上可复现（`import-cards`×2、`p6-content`、`presentation-http`），沿用既有漂移。

---

## 7. 明确留白（不要误读为"已完成"）

1. **撤销只到引擎层**：`rewindTo` / `undoMoves` 已交付并测试，但没有大厅/前端入口。
   UI 需要会话事务（鉴权、revision 校验、快照落盘、AI 侧重置），不在本轮范围。
2. **`action_diff` 增量存档没做**：存档仍是整份 JSON 快照；`until` 让"差分存档"有了地基，但压缩策略未定。
3. **重放不依赖旧存档的动作日志**：Phase 4 之前保存的存档没有 `actionLog`，只能从建局参数重放
   （`captureReplayLog` 会得到空 `moves`）；`rewindTo`/`undoMoves` 会发现"revision 与日志步数不符"
   并明确拒绝，不会悄悄把进度重置成建局状态。
4. **`state.log` 里的文案参与指纹**：E1（文案 i18n）落地时所有基线要重采一次，这是有意的
   ——事件文案变化是"玩家可见行为变化"，应当显式确认。
5. **golden 基线不覆盖浏览器/AI 决策**：它覆盖的是规则状态。AI 决策回归（固定状态重跑不同模型）仍待做。
