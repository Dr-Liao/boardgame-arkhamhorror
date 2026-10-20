# Phase 5 · 交接说明（Handoff）

> 更新：2026-02（Phase 5 进行中，暂停点）
> 上游：[`architecture-refactor-roadmap.md`](architecture-refactor-roadmap.md) §6 Phase 5、§7 迁移判据、§8 工具
> 本阶段的完整批次证据：[`phase5-migration.md`](phase5-migration.md)
> 能力层模型与加卡步骤：[`card-model.md`](card-model.md)

本文给接手的人：**现在做到哪、怎么验收、下一步做什么、有哪些坑**。文档里的数字都由
`npm run cards:audit`（= `node tools/audit-abilities.mjs`）现算，别手改。

---

## 1. 一句话现状

迁移工具链已交付，**296 张卡**迁到能力层（32 个批次），`EFFECTS` 385 → **90**、
通道 legacy 286 → **60**、descriptor 75 → **363**、**逃生卡 93 → 32**、**引擎卡号 166 → 126**。
`replay` 基线逐条不变、`fast` 无新增失败。**5a 引擎卡号分支、5c 剩余 32 张、5b 尾部（反应 2 / 非 stats 被动 8）仍未完成。**

---

## 2. 怎么跑（全部命令在 `games/arkhamhorror/` 下）

```powershell
# 指标 + 两份账本（唯一可信来源）
npm run cards:audit                       # --write 会重算并收缩白名单；--check 用于 CI
node tools/audit-workorder.mjs            # 5a 工作单：按 condition/block/reference/table 分类

# 迁移门禁（每批必跑）
node tools/replay-fixtures.mjs --compare ..\..\artifacts\replay-before.json
node tools/migrate-card.mjs --verify      # 每个批次的旧条目都已删、能力层有条目
node tools/audit-dead-primitives.mjs --check
node tools/rehash-acceptance.mjs --check
npm run test:fast                         # 见下方基线
```

**基线（不是新失败就别慌）**：

| tier | 既有失败数 | 说明 |
| --- | --- | --- |
| `fast` | **8** | 03310 Cheat Death、N3×5、N4 真实 HTTP、关卡入口检查点 |
| `slow` | **11** | D9 Mind Wipe、N4×8、P2×1 等 |
| `assets` | **4** | 与本次重构无关的素材用例 |

`replay` 基线文件在仓库根 `artifacts/replay-before.json`（10 局 / 529 步 / 530 个指纹）；
`artifacts/` 被 `.gitignore` 忽略，换机器要重新采集：

```powershell
node tools/replay-fixtures.mjs --baseline ..\..\artifacts\replay-before.json
```

---

## 3. 已交付

| 类别 | 产物 |
| --- | --- |
| 迁移工具 | `tools/migrate-card.mjs`（判定/生成/删条目/登记卡包）、`tools/scaffold-card.mjs`、`tools/cards-migrate.mjs`、`tools/rehash-acceptance.mjs` |
| 5a 支持 | `tools/audit-workorder.mjs`（工作单）、`tools/audit-dead-primitives.mjs`（死分支守卫）、`src/cards/card-rules.js`（卡号级规则数据） |
| 能力层 | `src/cards/card-abilities.js`（注册表）、`src/cards/ability-migration-batches.js`（工具生成批次）、`src/engine/ability.js`（描述子模型与校验） |
| 账本 | `audit/ability-coverage.json`、`audit/migration-batches.json`、`audit/ability-workorder.json`、两份白名单 |
| 用例 | `tests/architecture-guard.test.mjs`（10 条含死分支/卡包登记守卫）、`tests/migration-tools.test.mjs`（8）、`tests/phase5-migration.test.mjs`（37）、`tests/card-rules.test.mjs`（2） |
| 文档 | 本文 + `phase5-migration.md`（批次证据与踩坑记录）+ `card-model.md`（加卡流程） |

批次：5b-1…5b-5（机械 154）、5b-6/6b/6c/6d/7/8a/8b/9/10/11（反应/天赋/被动/规则字段/封印附属 46）、
5c-1…5c-17（逃生卡 60）、5a-1…5a-4（引擎侧 10 个码）。

---

## 4. 下一步（按性价比排序）

### 4.1 5c 剩余 32 张（其中 24 张引擎里仍有逃生原语实现）

顺序（每批 2–3 张，逐张验证）：

1. `04010` 走私货物（牌库顶 9 / 弃牌堆两区查找）
2. `04021` 艾丽·霍洛维兹（顶 9 张找遗物支援并附属；需要 `searchTop` + `attachCardTo` 的 api 化）
3. `04158` 水晶摆锤 / `04159` 预兆钟（都有 2 处引擎引用）
4. `04270` 骷髅钥匙（附属到地点 + 隐藏值视为 1）
5. `04308` 借来的时间（`maxClicks` 门要等价表达）、`04310` 虚空碎片（"充能或释放封印"二选一付费）
6. `03189` 我会在地狱里见你（**已尝试并回退**，见 §5 第 6 条）

**每张卡的标准动作**（顺序不能变）：

```
① 写描述子（resolve / effect 数据体）
② 删旧 EFFECTS 条目（否则旧通道先赢）
③ 需要的话登记卡包（carcosa/dunwich 用 abilityLayerCodes；TFA/core 走 IMPLEMENTED 清单）
④ 删引擎分支（在同一个分派函数里！见 §5）
⑤ replay --compare + 该战役验收用例
```

### 4.2 5a 剩余 126 个码（`condition` 25 / `block` 58 / `reference` 38 / `table` 0）

- **`reference`（38）**：多数是 `requestChoice({ source: '0xxxx' })` 的来源标签——它会进状态指纹，
  改法本身会改变 replay，**归 Phase 6 与 UI 文案一起处理**，不要单独动。
- **`condition` / `block`（83）**：`def.code === '0xxxx'` 形式的真实行为分支。
  做法：先补 `ctx.api`（`engine.js` 的 `abilityApi`），把分支搬成描述子，再删分支。
  候选小分支：`02007/02011/02013/02015`（入场钩子）、`02178`（弃牌堆顶 3 张）、
  `01007/01071/01082/02308`（创伤 / 雕像充能 / 安奎娜转移）。
- 已做过的样板：把"卡号 → 数据"搬进 `src/cards/card-rules.js`（5a-2/3/4，共 7 个码），
  以及"逃生原语 → 描述子"（5c，共 30 个码）。

### 4.3 5b 尾部

| 组 | 数量 | 卡点 |
| --- | --- | --- |
| `reactions` | 2 | `01082`（`cost.assetHorror` 引擎从未付费，既有 bug）、`02310`（需要 `forcedMythosEndDiscard` 钩子） |
| 非 `stats` 的 `passive` | 8 | `02110/03264/03308`（永久卡）、`03010`（analyticalMind 特判）、`01018/01027/01028`（`discardSelf`/`assetDamage` 费用）、`03143`（剧情资产，要走非玩家通道） |

---

## 5. 必须记住的坑（都是被门禁实际抓过的）

1. **迁移/恢复一张卡必须同时登记卡包**，否则包的 `deckbuilding` 变 false、自动牌组池少一张，
   `replay` 第 9 步立刻不一致。`architecture-guard` 有一条守卫专门拦这个。
   *例外：基础弱点（`deckbuilding: false`）不需要登记。*
2. **合并顺序**：`card-abilities.js` 的 `byCode` 里，手写批次必须排在工具生成批次之后，否则被覆盖
   （`02187.minimumHandForBoost` 就是这样丢的）。
3. **`played` 描述子声明 `trigger` 时，`fast: true` 要写在描述子上**（条目级不够）。
4. **`assetEffect` 是合并读点**：条目级字段（`uses` / `fast` / `noOpportunityAttack` / `passive` /
   `freeTriggers` / 封印附属 / 规则字段）必须在这里合并，否则"能声明但不生效"。
   改完记得 grep 还有没有直接读 `EFFECTS[code]` 的地方。
5. **给 `ctx.api` 加方法前先 grep 同名键**：`test` 已被 `test(seat, skill, difficulty, options)` 占用，
   新增同名方法会静默覆盖，导致一批不相关的卡片检定全挂（现用 `startTest`）。
6. **删引擎分支要在同一个分派器里放回**：`engine.js` 有 `carcosaPlayerEffect` / `tfaPlayerEffect` /
   `tfaPlayerEffect3` / `dunwichPlayerEffect` 等调度器，放错函数 = 静默"未实现"。
   逃生通道的引擎分支**不是死代码**（它就是 `effect.type: '<pack>Player'` 的实现），
   必须先改成 `resolve` 才能删。
7. **差异优先怀疑结算细节**：`03189` 的回退原因是"击败/创伤/致命伤害"的写法差异，不是接线问题。
   遇到这种，直接回退、保留原实现，不要为了指标去改语义。
8. **PowerShell 里不要用内联 `node -e` 写含引号/反引号的脚本**：会被转义吃掉。
   一律写临时 `.mjs` 文件（`develop/` 或 `tools/`）再删。

---

## 6. 未提交/环境说明

- `artifacts/replay-before.json` 不入库（`.gitignore`）。
- `develop/scaffolds/`（`scaffold-card.mjs` 生成的骨架）是临时产物，已清理，需要时重新生成。
- 本仓库是 `boardgame-hall-ai` 的子模块，提交后父仓库要更新指针。
