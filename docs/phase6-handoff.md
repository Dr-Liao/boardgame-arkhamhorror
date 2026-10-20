# Phase 6 交接文档（engine 拆分 · 战役解耦）

> 最后更新：Phase 6 `6d-29` 之后。
> 配套阅读：`docs/architecture-refactor-roadmap.md`（Phase 6 目标与判据）、
> `docs/phase6-decoupling.md`（36 节逐批证据）、`docs/phase5-handoff.md`（能力层迁移交接）。

---

## 1. 一句话现状

Phase 6 的四件事里，**①② 已完成**，**④ 拆到一半（engine.js 12654 → 5652，−55.3%）**，
**③ 还阻塞在一个需要拍板的决定上**（见 §6）。

| 目标 | 状态 | 证据 |
| --- | --- | --- |
| ① `engineCodes` 28 → 0（卡号文案标签数据驱动） | ✅ 完成 | `audit-abilities`：`engineCodes=0` |
| ② 引擎里清掉战役字样与残留卡号 | ✅ 完成 | `tests/phase6-guard.test.mjs` 通过；`src/engine/*.js` 无 `tfa/carcosa/dunwich`、无 `0\d{4}` 字面量 |
| ③ 迁移剩余 `EFFECTS` 57 条 / `effectsTopLevelFields` 33 项 | ⛔ 阻塞 | 见 §6，需要先决定「观测面解耦」 |
| ④ 拆分 engine.js + 战役插件化 | 🚧 拆分 −55.3%；插件化未开始 | 本文 §2–§5 |

---

## 2. 拆分成果（28 个模块）

`engine.js` 从 **12654 行降到 5652 行（−55.3%）**，拆出的模块（`src/engine/`，按行数）：

| 模块 | 行数 | 职责 |
| --- | --- | --- |
| `tests.js` | 858 | 技能检定主流程（`performTest`，ST.1–ST.8） |
| `moves.js` | 652 | 合法行动枚举与校验（`legalMoves` / `validateMove`） |
| `setup.js` | 578 | 建局：调查员准备、关卡布置、混乱袋 |
| `api-misc.js` | 471 | 能力 API：通用动作与展示 |
| `combat.js` | 446 | 攻击 / 躲避 |
| `dispatch.js` | 437 | 行动分派（`applyMove → executeCommand → executeAction`） |
| `enemies.js` | 434 | 伤害与敌人原语（`applyHarm` 唯一入口） |
| `deck-ops.js` | 429 | 牌堆操作（查看 / 检索 / 搬运 / 抽弃） |
| `encounter.js` | 400 | 遭遇牌与反应窗口 |
| `actions.js` | 399 | `doPlay` / `doInvestigate` |
| `scenario-runtime.js` | 398 | 剧本运行时（内容层 ↔ 引擎边界） |
| `turn.js` | 382 | 回合与阶段推进 |
| `ability-exec.js` | 370 | 能力执行（`doAbility` / `openAbilityWindow` / `effectError`） |
| `skill-effects.js` | 319 | 检定的效果侧 |
| `reveal.js` | 314 | 揭示与描述子执行（`executeDescriptor`） |
| `phases.js` | 311 | 补给阶段与密谋揭示 |
| `api-card.js` | 302 | 卡牌 API |
| `hub.js` | 299 | 战役台面与幕间 |
| `weakness.js` | 283 | 弱点结算 |
| `campaign-flow.js` | 252 | 关间 / 重开 / 结局 / 创伤 |
| `movement.js` | 249 | 移动与位置 |
| `locations.js` | 213 | 地点与线索 |
| `describe.js` | 176 | 状态投影（纯函数） |
| `api-enemy.js` | 163 | 敌人 API |
| `api-clue.js` | 142 | 线索/毁灭 API |
| `api-test.js` | 93 | 检定 API |
| `card-lookup.js` | 90 | 卡牌查表 + 合并表 |

另有一个搬到内容层的模块：`src/cards/player-effects.js`（324 行，原 `engine.dunwichPlayerEffect`）。

`engine.js` 现在只剩：**顶层状态机、剩余 `do*` 动作、约 380 个小函数、以及 25 张依赖表的装配**。

---

## 3. 拆分方法论（下次继续照做）

### 3.1 依赖注入工厂

每个模块导出 `createXxx(deps)`，`engine.js` 末尾用**函数声明 + 惰性装配**接上：

```js
let combatImpl = null
function combatApi() {
  combatImpl ||= createCombat({ ...commonDeps, /* 专属依赖 */ })
  return combatImpl
}
export function doFight(...args) { return combatApi().doFight(...args) }
export function doEvade(...args) { return combatApi().doEvade(...args) }
```

**为什么必须惰性**：这些函数被更早的依赖表在模块顶层引用，`const` 解构会 TDZ。

### 3.2 依赖的四种类型（踩了 6 次坑总结出来的）

| 依赖种类 | 例子 | 正确做法 |
| --- | --- | --- |
| 可重新赋值的模块绑定（`let`） | `contentRegistry` | **`import` live binding，不注入** |
| 与别处共享的可变对象 | `SCENARIOS`（`registerCampaignScenarios` 往里写） | **注入同一引用** |
| 可变模块级标量状态 | `currentActionKind` | **注入 getter/setter**，不注入值 |
| 常量对象 / 函数声明 | `EFFECTS`、`performTest` | 可安全注入 |

用错任一条的表现：`Cannot access 'X' before initialization`、`Assignment to constant variable.`、
或最阴的——**测试红但 replay 绿**（因为引擎与副本各写各的）。

### 3.3 切块的机械注意点

1. 边界要找**方法名到方法名**，并且遇到 `import` / `export {` 也要停；否则会把下一段的注释和 import 吞进新模块；
2. 切完**从尾部回退**到第一个 `}`，避免尾部孤立括号；
3. 先把已有 `...createXxx(...)` 的 spread 行作为右边界，别按行号硬切；
4. 新模块里**不要 `export` 内部函数**，由 `engine.js` 统一 `export function` 包装，否则 `Duplicate export`。

### 3.4 每次都要跑的门禁

```powershell
node tools/replay-fixtures.mjs --compare ..\..\artifacts\replay-before.json   # 行为零变化
node tools/audit-abilities.mjs                                                # 指标
node tools/audit-workorder.mjs --check
node tools/migrate-card.mjs --verify
node tools/audit-dead-primitives.mjs --check
node tools/run-tests.mjs fast                                                 # 2142 例
```

**关键教训**：`replay --compare` 绿不等于没坏。有 4 次是 replay 全绿、用例红
（`doInvestigate is not defined`、`doEvade is not defined`、`contentRegistry` 快照、
`SCENARIOS` 副本）。拆 api / 动作层时**必须额外跑相关验收用例**。

---

## 4. 当前门禁状态

| 门禁 | 结果 |
| --- | --- |
| `replay --check` / `--compare` | ✔ 全部基线逐条一致 |
| `audit-abilities` | `engineCodes=0` `effectsEntries=57` `effectsTopLevelFields=33` `escapeCards=0`；`descriptorEntries=419` `descriptorAbilities=344` `abilityKinds=12` `windows=52` |
| `audit-workorder --check` | ✔ 非行为债务 0 |
| `migrate-card --verify` | ✔ 79 个批次与实现一致 |
| `audit-dead-primitives --check` | ✔ 没有死分支（8 个分派点全部仍有数据引用） |
| `run-tests fast` | **2142 例 / 2135 通过 / 7 失败** |
| `phase6-guard` | ✔ 引擎无战役名、无卡号字面量 |

### 4.1 已知的 7 条失败（**既有，非本阶段引入**）

| # | 用例 | 说明 |
| --- | --- | --- |
| 81 | N4 真实HTTP合法败退进入关间 | 战役流程 |
| 625 | 关卡入口检查点可由队长创建精确分支 | 分支/检查点 |
| 1471–1475 | N3 致命借机攻击跨关后不得续算旧 … ×5 | 跨关旧动作续算 |

另有**不在 fast tier 内**、但确实红的存量失败（已用 `git stash` 验证与拆分无关）：

- `tests/campaign-n4.test.mjs`：8 条（`N4 合法战役失败流程 …`、`N4 同次伤害恐惧…`）
- `tests/core-acceptance.test.mjs`：并发偶发（重跑即恢复，单独跑 92/92 全绿）

---

## 5. 下一步（建议顺序）

### 5.1 继续拆 engine.js（距离 roadmap 目标 < 2500 还差约 3150 行）

剩下的函数都很小（最大 `advanceInvestigator` 70 行），按域批量搬即可：

| 建议模块 | 内容 |
| --- | --- |
| `tokens.js` | `resolveSpecialToken`(45) / `applyPenalty`(50) / `resolveTreacheryBody`(45) / `applyFreeTriggers`(42) |
| `costs.js` | `payAbilityCost`(42) / `actionCost`(38) / `descriptorUsable`(40) |
| `harm.js` | `assignHarm`(40) / `checkDefeated`(41) / `searchTop`(37) |
| `mulligans.js` | `runMulligans`(55) / 初始手牌相关 |

### 5.2 战役插件化（roadmap Phase 6 的最后一块）

`engine.js` 里**仍有 14 个带战役名的函数**（`tfaCardDrawReaction`、`carcosaInvestigatorEffect`、
`tfaPlayerEffect`、`tfaApplyPlayCost`…，共约 500 行）。它们现在不含卡号字面量（门禁已过），
但按 roadmap 应该搬成：

```
content/campaigns/<id>/behavior.js   ← 已有（hooks）
        +
src/cards/campaign-effects.js        ← 新的调度点：按 campaignId 分派
```

步骤：
1. 把这些函数整体搬到 `src/cards/campaign-effects.js`（注意：**不能放 `src/engine/`**，
   否则 `phase6-guard` 立刻红——这条门禁会强制内容回到内容层）；
2. `engine.js` 只留 `campaignEffect(state, campaignId, …)` 的薄调度；
3. 跑门禁 + `dunwich/tfa/carcosa` 三套玩家卡验收。

### 5.3 `EFFECTS` 57 条迁移（**需要拍板**，见 §6）

---

## 6. 阻塞项：`EFFECTS` 57 条迁移需要先决定观测面

`EFFECTS` 里还剩 **57 条**旧 DSL 条目。删掉它们的最后一道障碍不是引擎，而是**观测量**：

`src/ai/ai-context.js` 用

```js
implemented: EFFECTS[code] || abilitySummary(code)
```

判断「这张卡实现了没有」——**把整个 `EFFECTS` 对象塞进了 AI 上下文**。
一旦删条目，AI 看到的 `implemented` 变化 → AI 决策变化 → 回放指���变化。

三条路（**需要你选**）：

| 方案 | 做法 | 代价 |
| --- | --- | --- |
| A（推荐） | 把 `implemented` 改成布尔/摘要（不暴露整个对象），**单独一个提交**重采 replay 基线 | 一次性重采基线；之后 ③ 可以一路清零 |
| B | 保留 `EFFECTS` 空壳（键在、值改成 `{}`）直到最后 | 指标清不零，且要额外维护 |
| C | 冻结 ③，Phase 6 以 ①②④ 收尾 | 文档里记「③ 移交 Phase 7」 |

**本轮没有替你做这个决定**，因为 A 会改变 AI 提示词，属于「观测面变更」，
而不是纯重构——需要你确认后才能重采基线。

---

## 7. 常用命令

```powershell
cd games/arkhamhorror

# 行为门禁
node tools/replay-fixtures.mjs --check
node tools/replay-fixtures.mjs --compare ..\..\artifacts\replay-before.json

# 账本与审计
node tools/audit-abilities.mjs
node tools/audit-workorder.mjs --check
node tools/migrate-card.mjs --verify
node tools/audit-dead-primitives.mjs --check
node tools/audit-dunwich-acceptance.mjs --write   # 验收产物变化时重采

# 测试（Windows 上 npm 被策略挡住，用这个）
node tools/run-tests.mjs fast

# 单文件
node --test tests/phase5-migration.test.mjs
```

> 临时脚本只放 `develop/tmp-*.mjs` 并及时删除；**不要提交 `develop/tmp-*`**。

---

## 8. 提交规范

- 子模块提交：`Phase 6 · 6d-<n>：<做了什么>`，正文写「拆了什么 / 踩了什么坑 / 门禁结果」，
  最后一行固定为门禁摘要；
- 父仓库：`chore: bump arkhamhorror submodule (Phase 6 6d-<n>: <module>)`；
- 两个仓库提交后都要 `git status` 干净；不要提交 `develop/tmp-*`、不要改 `state.log` 文案。
