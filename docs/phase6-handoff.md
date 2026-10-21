# Phase 6 交接文档（engine 拆分 · 战役解耦）

> 最后更新：Phase 6 `6e-8` 之后（观测面解耦 + engine.js 再拆 5 个模块 + 战役插件化第一批 + 22 张快速反应事件迁移）。
> 配套阅读：`docs/architecture-refactor-roadmap.md`（Phase 6 目标与判据）、
> `docs/phase6-decoupling.md`（40 节逐批证据）、`docs/phase5-handoff.md`（能力层迁移交接）。

---

## 1. 一句话现状

Phase 6 的四件事里，**①② 已完成**、**③ 的阻塞已解开并开始清零（57 → 30）**、
**④ 已拆到 −81.0%（2403 行，达到 < 2.5k 目标）且战役插件化第一批已落地**。

| 目标 | 状态 | 证据 |
| --- | --- | --- |
| ① `engineCodes` 28 → 0（卡号文案标签数据驱动） | ✅ 完成 | `audit-abilities`：`engineCodes=0` |
| ② 引擎里清掉战役字样与残留卡号 | ✅ 完成 | `tests/phase6-guard.test.mjs` 通过；`src/engine/*.js` 无 `tfa/carcosa/dunwich`、无 `0\d{4}` 字面量 |
| ③ 迁移剩余 `EFFECTS` 30 条 / `effectsTopLevelFields` 30 项 | 🚧 已开工 | 6e-1 观测面解耦（`src/cards/card-implementation.js`）、6e-2 删 5 条纯登记条目、6e-8 迁 22 张快速反应事件 |
| ④ 拆分 engine.js + 战役插件化 | 🚧 拆分 −65.2%；插件化第一批已落地 | 本文 §2–§5 |

---

## 2. 拆分成果（41 个模块）

`engine.js` 从 **12654 行降到 4398 行（−65.2%）**，拆出的模块（`src/engine/`，按行数）：

| 模块 | 行数 | 职责 |
| --- | --- | --- |
| `tests.js` | 857 | 技能检定主流程（`performTest`，ST.1–ST.8） |
| `turn-flow.js` | 508 | **6e-13**：`advanceInvestigator`、打出费用与折扣、旧印结算、反应规格与条件评估 |
| `moves.js` | 652 | 合法行动枚举与校验（`legalMoves` / `validateMove`） |
| `setup.js` | 578 | 建局：调查员准备、关卡布置、混乱袋 |
| `api-misc.js` | 471 | 能力 API：通用动作与展示 |
| `combat.js` | 446 | 攻击 / 躲避 |
| `dispatch.js` | 437 | 行动分派（`applyMove → executeCommand → executeAction`） |
| `enemies.js` | 434 | 伤害与敌人原语（`applyHarm` 唯一入口） |
| `deck-ops.js` | 429 | 牌堆操作（查看 / 检索 / 搬运 / 抽弃） |
| `actions-extra.js` | 420 | **6e-5**：场景侧额外行动（谈判 / 剧情资产 / 地点能力 / 威胁与债务） |
| `encounter.js` | 400 | 遭遇牌与反应窗口 |
| `actions.js` | 399 | `doPlay` / `doInvestigate` |
| `scenario-runtime.js` | 398 | 剧本运行时（内容层 ↔ 引擎边界） |
| `turn.js` | 382 | 回合与阶段推进 |
| `treachery-tokens.js` | 372 | **6e-7**：混乱标记与诡计结算（惩罚链 / 特殊标记） |
| `ability-exec.js` | 370 | 能力执行（`doAbility` / `openAbilityWindow` / `effectError`） |
| `table-decisions.js` | 369 | **6e-4**：台面决策层（谁在操作 / 能不能行动 / 开局调度） |
| `skill-effects.js` | 319 | 检定的效果侧 |
| `reveal.js` | 314 | 揭示与描述子执行（`executeDescriptor`） |
| `phases.js` | 311 | 补给阶段与密谋揭示 |
| `api-card.js` | 302 | 卡牌 API |
| `hub.js` | 299 | 战役台面与幕间 |
| `weakness.js` | 283 | 弱点结算 |
| `ability-rules.js` | 259 | **6e-3**：描述子可用性 / 费用 / 目标枚举 / 修正来源 |
| `campaign-flow.js` | 252 | 关间 / 重开 / 结局 / 创伤 |
| `movement.js` | 249 | 移动与位置 |
| `locations.js` | 213 | 地点与线索 |
| `describe.js` | 176 | 状态投影（纯函数） |
| `api-enemy.js` | 163 | 敌人 API |
| `api-clue.js` | 142 | 线索/毁灭 API |
| `describe-ai.js` | 124 | **6e-6**：AI / 界面描述层（`stripLabel` / 行动与移动文案） |
| `api-test.js` | 93 | 检定 API |
| `card-lookup.js` | 90 | 卡牌查表 + 合并表 |

两个搬到内容层的模块：`src/cards/player-effects.js`（324 行，6d-15）、
`src/cards/campaign-plugin.js`（542 行，6e-7：战役规则原语 + 玩家卡效果调度）。

`engine.js` 现在只剩：**顶层状态机、剩余 `do*` 动作、约 300 个小函数、以及 25 张依赖表的装配**。

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
```

**为什么必须惰性**：这些函数被更早的依赖表在模块顶层引用，`const` 解构会 TDZ。

### 3.2 依赖的四种类型（踩了 6 次坑总结出来的）

| 依赖种类 | 例子 | 正确做法 |
| --- | --- | --- |
| 可重新赋值的模块绑定（`let`） | `contentRegistry` | **`import` live binding，不注入** |
| 与别处共享的可变对象 | `SCENARIOS`（`registerCampaignScenarios` 往里写）、`failedTestResolves`（WeakMap） | **注入同一引用** |
| 可变模块级标量状态 | `currentActionKind` | **注入 getter/setter**，不注入值 |
| 常量对象 / 函数声明 | `EFFECTS`、`performTest` | 可安全注入 |

用错任一条的表现：`Cannot access 'X' before initialization`、`Assignment to constant variable.`、
或最阴的——**测试红但 replay 绿**（因为引擎与副本各写各的）。

### 3.3 切块的机械注意点

1. 边界要找**方法名到方法名**，并且遇到 `import` / `export {` 也要停；
2. 切完**从尾部回退**到第一个 `}`，避免尾部孤立括号；
3. 先把已有 `...createXxx(...)` 的 spread 行作为右边界，别按行号硬切；
4. 新模块里**不要 `export` 内部函数**，由 `engine.js` 统一 `export function` 包装，否则 `Duplicate export`；
5. **每个被搬走的声明都要有同名包装**——只包装「外部用到的」会让 `deps` 表里的名字变 ReferenceError；
6. **依赖推导要包含**：顶层 `function/const/let`、**解构式声明**（`export const { legalMoves, validateMove } = …`）、
   跨行 `import` 与夹在括号里的**行注释**；
7. 迁移后遗留的 `export { … }` 清单要一起删（本轮 `doExplore` 撞过 `Duplicate export`）。

### 3.4 每次都要跑的门禁

```powershell
node tools/replay-fixtures.mjs --compare ..\..\artifacts\replay-before.json   # 行为零变化
node tools/audit-abilities.mjs                                                # 指标
node tools/audit-workorder.mjs --check
node tools/migrate-card.mjs --verify
node tools/audit-dead-primitives.mjs --check
node --test tests/phase6-guard.test.mjs tests/phase6-implementation.test.mjs
node tools/run-tests.mjs fast                                                 # 2148 例
```

**关键教训（第 5、6 次复现）**：`replay --compare` 绿不等于没坏。6e-6 的 `validateMove` 漏注入
让 21 条 fast 用例红而 replay 全绿；本轮的通用修法是临时脚本 `develop/tmp-fixdeps.mjs`
（引擎绑定 × 模块标识符差分，两个文件一起补），跑完即删。

---

## 4. 当前门禁状态

| 门禁 | 结果 |
| --- | --- |
| `replay --check` / `--compare` | ✔ 全部基线逐条一致 |
| `audit-abilities` | `engineCodes=0` `effectsEntries=30` `effectsTopLevelFields=30` `escapeCards=0`；`descriptorEntries=441` `descriptorAbilities=366` `abilityKinds=12` `windows=52`；通道 descriptor 432 / legacy 20 / hybrid 9 / data 4 |
| `audit-workorder --check` | ✔ 非行为债务 0 |
| `migrate-card --verify` | ✔ 79 个批次与实现一致 |
| `audit-dead-primitives --check` | ✔ 没有死分支 |
| `run-tests fast` | **2148 例 / 2141 通过 / 7 失败**（既有 7 条） |
| `phase6-guard` | ✔ 引擎无战役名、无卡号字面量 |
| `phase6-implementation` | ✔ 6 条（通道 / 摘要 / isPlayable 一致） |

### 4.1 已知的 7 条失败（**既有，非本阶段引入**）

| # | 用例 | 说明 |
| --- | --- | --- |
| 81 | N4 真实HTTP合法败退进入关间 | 战役流程 |
| 625 | 关卡入口检查点可由队长创建精确分支 | 分支/检查点 |
| 1471–1475 | N3 致命借机攻击跨关后不得续算旧 … ×5 | 跨关旧动作续算 |

另有**不在 fast tier 内**、但确实红的存量失败（`git stash` 验证过与拆分无关）：
`tests/campaign-n4.test.mjs` 8 条；`tests/core-acceptance.test.mjs` 并发偶发（重跑即恢复）。

---

## 5. 下一步（建议顺序）

### 5.1 ~~继续拆 engine.js~~（✅ 已完成：2403 行，−81.0%）

拆分方法与踩坑见 `phase6-decoupling.md` §39.2 / §43.2（切块脚本 + 依赖差分脚本，可重建）。
剩余可再拆的小块（按需）：

| 建议模块 | 内容 | 粗估 |
| --- | --- | --- |
| `assets.js` | `canEquip` / `normalizedSlots` / `slotUsage` / `assetReplacementPlans` / `replaceAssets` / `handSlotsBonusFor` / `weaponHandSlotsFor` / `leaveAsset` / `discardRandomAsset` | ~250 |
| `harm-threat.js` | `assignHarm` / `checkDefeated` / `checkOutcome` / `eliminateInvestigator` / `dealDamageAll` / `applyThreatForced` / `removeThreat` / `assetsCannotReady` | ~300 |
| `act-agenda.js` | `advanceAct` / `checkAct` / `advanceAgenda` / `checkAgenda` / `payAndAdvanceAct` / `actObjectiveContext` / `placeDoomOnCard` | ~300 |
| `deck-cards.js` | `playReactionCard` / `topDiscardEvent` / `disposePlayedEvent` / `refillAsset` / `reloadAmmo` / `rechargeAsset` / `searchCards` / `findZoneCard` | ~250 |
| `stats.js` | `getStat` / `assetEffect` / `assetPassiveBonus` / `handSize` / `investigateBonus` / `extraActionBonus` / `iconValue` / `effectiveTraits` / `cardKeyword` | ~280 |

### 5.2 战役插件化第二批（roadmap Phase 6 的最后一块）

第一批（6e-7）搬走了**行为**；第二批要把**状态切片与观察投影**也收进去：

1. `stateSlice`：战役专属字段（`campaign.supplies` / `campaign.records.yigsFury` / `relicOfAges` /
   `expeditionLeader` / `carcosaPlayDiscount` / `tfaDamageBonus` …）改由插件声明与读写，
   引擎只经 `campaignSlice(state)` 访问（**字段名不改**，否则 `stateHash` 变）；
2. `project`：观察投影里的战役片段（现在 `src/integration/observation.js` 直接读这些字段）改成插件提供；
3. `agentHints`：AI 上下文里的战役提示（目前 `ai-story.js` + `ai-context.js` 各自拼）；
4. `actions+hooks`：`content/campaigns/<id>/behavior.js` 已有钩子，补上「新增战役只加目录」的登记校验。

### 5.3 `EFFECTS` 30 条清零（③ 剩余）

6e-8 已把「快速反应事件」整批迁完（22 张：01010/01022/01023/01056/01065/01068/01079/01080/
01083/01084/02113/02115/02153/02225/02261/02307/03030/03156/03157/03270/04110/04111，形状映射与
两处读点修正见 `phase6-decoupling.md` §41）。剩余 30 条按下面的顺序推进（每批 ≤10 张，
`replay --compare` + `fast` 新增失败 0）：

1. **`abilities` 条目**（01044/01063/01076/01086/02114/02152/03036/03037/04268 等）：
   `discardSelf`/`exileSelf` 会改变日志顺序，必须逐张对照 replay，不能机械搬；
2. **规则字段**（`paintedWorld` / `phaseControl` / `startingResources` / `enemyWeakness` /
   `sealOnEnterChoice` / `usesFromStoneRecord` / `discardAtRoundEnd` / `returnToHandOnAutoFail` /
   `forcedTurnEndPayOrDiscard` / `chargesOnSymbolReveal` / `removeFromGameWhenEmpty` / `fastForIllicit` /
   `survivorEventDiscount` / `limitPerInvestigator` / `onPlayDoom` / `endTurnInHandHorror` /
   `deckbuildingOnly` / `permanentRule` / `kingInYellow` / `addToVictory`）：
   先扩 `ability.js` 的 `ENTRY_KEYS` 与引擎读点（`registeredEntry(code)?.xxx`，回落 `legacyEntry`），
   再逐张搬；
3. **`weakness` 条目**（03011 / 04038）：走 `kind: 'weakness'` 数据体 + 需要的条目级字段。

> 迁移任何一批时都要顺手做三件事（6e-8 的经验）：包清单登记（`abilityLayerCodes` /
> `IMPLEMENTED_PLAYER_CODES`）、把断言旧形状的用例改成断言行为、跑
> `node tools/rehash-acceptance.mjs --write` 重算验收账本。

### 5.4 观测面与文档

- 新增 `EFFECTS` 条目时**必须**改用描述子（守卫已挡）；新增 `kind` 要同时改 `card-model.md` 与守卫；
- `implementationSummary` 是 AI / 图鉴的唯一读点，改形状要同时更新 `tests/phase6-implementation.test.mjs`。

---

## 6. 常用命令

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
node --test tests/phase6-implementation.test.mjs
```

> 临时脚本只放 `develop/tmp-*.mjs` 与 `develop/tmp-*.json`，用完删除；**不要提交 `develop/tmp-*`**。

---

## 7. 提交规范

- 子模块提交：`Phase 6 · 6e-<n>：<做了什么>`，正文写「拆了什么 / 踩了什么坑 / 门禁结果」，
  最后一行固定为门禁摘要；
- 父仓库：`chore: bump arkhamhorror submodule (Phase 6 6e-<n>: <module>)`；
- 两个仓库提交后都要 `git status` 干净；不要提交 `develop/tmp-*`、不要改 `state.log` 文案。
