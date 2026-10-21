# 外部硬编码清理 · 交接文档

> 更新：2026-10-22
> 仓库：`games/arkhamhorror`
> 关联审计：[REPORT.md](../../../artifacts/arkham-hardcode-audit/REPORT.md)（修复前快照）
> 实时进度：[PROGRESS.md](../../../artifacts/arkham-hardcode-audit/PROGRESS.md)
> 目标状态：**未完成**。第 0–3、5、6 批完成；第 4、7、8 批仍有余量。

---

## 0. 一句话结论

引擎层硬编码已基本清零（`engine.js` 卡号 0、引擎实体 id 40 → 2），
但**内容层的章节脚本仍有 331 个按卡号写的规则分支、1282 个卡号字面量**，
第 4 批还有 8 个卡名效果调度分支，第 8 批还有约 79 处战役/叙事/UI 卡号。
按当前每轮 4–12 个分支的速度，剩余工作量约 **40–55 个专注轮次**，不可能在本次 60 轮目标内收尾。

---

## 1. 当前指标（2026-10-22，第 51 轮）

| 指标 | 修复前 | 现在 | 说明 |
| --- | ---: | ---: | --- |
| `engine.js` 卡号 | 0 | **0** | 原始指标，不是全部 |
| 引擎实体 id | 40 | **2** | `study`（中性初始值）+ `thePathToCarcosa`（第 8 批常量） |
| 卡牌层卡号（非 entries） | 147 | **385** | 上升主要是**非玩家卡条目**按卡号落在 `encounter-abilities.js`，属目标形态；不是剩余工作量 |
| 内容层卡号字面量 | 2162 | **1282** | `behavior.js` / `encounter-rules.js` / `card-data.js`，共 **25 个文件** |
| 内容层卡号**规则分支** | 未统计 | **331** | `code === '0xxxx'` / `originalCode === '0xxxx'`，共 **24 个文件**；这是第 7 批真正可执行的工作量 |
| `behaviorLines` | 14830 | **14469** | 预算 **14831**，余量 **362** 行 |
| 效果原语 | 97 | **78** | 第 4 批已迁 19 类 |
| 无引用原语 | 27 | **13** | 见 §3.2 |
| `EFFECTS[` 残留读取 | 69 处 | **60 处 / 29 文件** | `EFFECTS` 已空，读取是 fallback |
| 玩家效果调度分支 | 24 | **8** | `src/cards/player-effects.js` |
| `legacyReaction` 条目 | 未统计 | **33** | 见 §3.2，属表达能力债，不是外部硬编码 |
| `test:fast` | 2210 | **2214 通过 / 0 失败** | 新增守卫用例后 +4 |
| replay 基线 | — | **13 局 / 779 步逐条一致** | `artifacts/arkham-hardcode-audit/replay-before.json` |

当前门禁（本轮最后一次运行）：

- `npm.cmd run cards:check` → **5/5**
- `node tools/run-tests.mjs fast` → **2214 / 0 失败**
- `node tools/replay-fixtures.mjs --compare .../replay-before.json` → **13/13 一致**
- `architecture-guard` → **15/15**
- 内容层卡号守卫基线：`tests/architecture-guard.test.mjs` 的 `CONTENT_CARD_CODE_BASELINE = 1282`

> 注意：`REPORT.md` 顶部的指标是滚动更新的，但正文 §2–§5 是修复前快照，不能当作当前待办清单。
> 以本文件和 `PROGRESS.md` 为准。

---

## 2. 批次状态

| 批次 | 内容 | 状态 |
| --- | --- | --- |
| 0 | 守卫与基线 | ✅ 完成 |
| 1 | `movement.js` 三条地点规则 | ✅ 完成 |
| 2 | 引擎实体 id 分支 | ✅ 完成（卡牌级；剧本级在第 5 批） |
| 3 | `card-rules.js` 拆表 | ✅ 完成（流程常量留到第 8 批） |
| 4 | `player-effects.js` / 卡名原语 | 🟡 已迁 19 类；剩 8 个调度分支 + 33 个 `legacyReaction` |
| 5 | 剧本脚本出引擎 | ✅ 完成（夜之狂热三关的幕/密谋/强制的旧 case 已删） |
| 6 | 调查员能力进条目 | ✅ 完成（数据层；`INVESTIGATOR_ABILITIES` 只剩兼容导出） |
| 7 | 内容层批量迁移 | 🟡 2162 → 1282；331 个分支待迁，详见 §3.1 |
| 8 | 战役 / 叙事 / UI | 🟡 剧情角色派生已完成；常量/战役 id/story/web 仍待处理，详见 §3.3 |

---

## 3. 剩余工作明细

### 3.1 第 7 批：内容层（最大块，331 个分支）

按分支数排序（`branches / codes / 文件`）：

| 分支 | 卡号 | 文件 |
| ---: | ---: | --- |
| 39 | 60 | `content/campaigns/theDunwichLegacy/encounter-rules.js` |
| 26 | 57 | `content/campaigns/thePathToCarcosa/scenarios/theUnspeakableOath/behavior.js` |
| 22 | 72 | `content/campaigns/theForgottenAge/scenarios/theBoundaryBeyond/behavior.js` |
| 21 | 78 | `content/campaigns/thePathToCarcosa/scenarios/theLastKing/behavior.js` |
| 19 | 42 | `content/campaigns/thePathToCarcosa/scenarios/curtainCall/behavior.js` |
| 18 | 39 | `content/campaigns/theForgottenAge/scenarios/theDepthsOfYoth/behavior.js` |
| 17 | 41 | `content/campaigns/theDunwichLegacy/scenarios/extracurricularActivity/behavior.js` |
| 17 | 98 | `content/campaigns/thePathToCarcosa/scenarios/blackStarsRise/behavior.js` |
| 16 | 67 | `content/campaigns/theForgottenAge/scenarios/theUntamedWilds/behavior.js` |
| 16 | 151 | `content/campaigns/theForgottenAge/scenarios/threadsOfFate/behavior.js` |
| 15 | 34 | `content/campaigns/theDunwichLegacy/scenarios/theHouseAlwaysWins/behavior.js` |
| 15 | 47 | `content/campaigns/theForgottenAge/scenarios/shatteredAeons/behavior.js` |
| 14 | 49 | `content/campaigns/theForgottenAge/scenarios/heartOfTheEldersPart1/behavior.js` |
| 12 | 47 | `content/campaigns/theForgottenAge/scenarios/heartOfTheEldersPart2/behavior.js` |
| 11 | 63 | `content/campaigns/thePathToCarcosa/scenarios/aPhantomOfTruth/behavior.js` |
| 11 | 43 | `content/campaigns/thePathToCarcosa/scenarios/echoesOfThePast/behavior.js` |
| 10 | 53 | `content/campaigns/thePathToCarcosa/scenarios/thePallidMask/behavior.js` |
| 9 | 31 | `content/campaigns/theForgottenAge/encounter-rules.js` |
| 7 | 42 | `content/campaigns/theForgottenAge/scenarios/turnBackTime/behavior.js` |
| 6 | 26 | `content/campaigns/thePathToCarcosa/encounter-rules.js` |
| 6 | 90 | `content/campaigns/thePathToCarcosa/scenarios/dimCarcosa/behavior.js` |
| 2 | 20 | `content/campaigns/theForgottenAge/scenarios/theCityOfArchives/behavior.js` |
| 1 | 1 | `content/campaigns/nightOfTheZealot/scenarios/theDevourerBelow/behavior.js` |
| 1 | 1 | `content/campaigns/nightOfTheZealot/scenarios/theGathering/behavior.js` |

> `codes` 列包含定义数据、`implementedEncounterCodes` 审计数组等，不等于“需要迁的规则”。
> 先按 `code ===` 分支迁，再处理数据数组。

#### 3.1.1 三个 `encounter-rules.js` 的剩余分支

**敦威治（39 个分支，最大）**
文件：`content/campaigns/theDunwichLegacy/encounter-rules.js`
主要是 `statModifier` / `enemySpawned` / `enemyAttacked` / `enemyMoved` / `resolveEncounter` 的逐卡分支。
已迁走：`implementedTreacheries` 集合、8 个生成地点模式。

**失落时代（9 个分支）**
文件：`content/campaigns/theForgottenAge/encounter-rules.js`

- `01170`（密会巫师，生成地点选择）
- `01174`（上锁的门，线索最多地点选择）
- `01178`（提供力量，险境二选一）
- `04092`（不祥之兆，地点选择；**故意保留在内容层**，原因见 §5.2）
- `04062`（预示者生成，`applyHarbingerSpawn`）
- `04084`（复仇阈值减伤）
- `04078/04079`（中毒/毒蛇攻击）
- `isPoisoned` helper 里直接读 `04102`

**卡尔克萨（6 个分支）**
文件：`content/campaigns/thePathToCarcosa/encounter-rules.js`

- `01176`（隐藏卡，已有 `hiddenRule` 条目但仍在 if 链）
- `03102`（锈蚀，弃道具选择）
- `03224`（致命运数，弃牌堆敌人选择）
- `03091/03094`（`encounterActions` 里的地点附着行动列表）
- `03248`（`spawnLocation` 里的“已揭示则不生成”判断）

#### 3.1.2 已建立的条目钩子（第 7 批继续用这些）

`src/cards/encounter-abilities.js` / `src/cards/entries/<code>.js` 支持：

- `actRule.onReveal(state, act, api)`
- `agendaRule.onReveal(state, agenda, api)`
- `locationRule.onEnter` / `onLeave` / `onTurnEnd` / `onRoundEnd` / `onTestFail` / `playDiscount`
- `locationBarrier`
- `enemyRule`（会并入 `state.scenario` 定义，**不要放函数/易变数据**）
- `enemyStatRule` / `enemySpawnRule` / `enemyScript`（**只进注册表，不并入定义**）
- `encounterResolve(state, inv, card, api, { location })`
- `encounterResolveCampaigns: ['carcosa' | 'tfa' | ...]`
- `threatAction`
- `implemented` / `doomPerInvestigator` / `vengeanceWhile` / `historicalRoom` / `storyRole`

读点集中在 `src/cards/card-rules.js`，不要从内容层直接读注册表内部结构。

#### 3.1.3 数据数组

行为文件里还有 `implementedEncounterCodes`（约 10 个章节）、`setupPlan`、`EXPLORATION_LOCATIONS` 等数组。
它们是**审计/布置数据**，不是单卡规则；如果要继续压内容层卡号，建议：

1. 给条目加 `implementedIn: ['theXxx']`；
2. 行为导出改为 `implementedEncounterCodesFor('theXxx')`；
3. 测试继续拿数组，但数据只存条目。

不要在没有测试覆盖的情况下直接删数组。

---

### 3.2 第 4 批：剩余 8 个玩家效果 + 33 个 `legacyReaction`

文件：`src/cards/player-effects.js`

剩余 `effect.type`（都是卡名函数，应改成该卡 `resolve` + 通用 API）：

```
flare
lookTopDeckAndDoom
redrawChaos
cancelHarmGainResources
redrawEncounter
returnCommittedSkill
healHorrorNearby
dukeInvestigate
```

其中：

- `flare`：需要窗口上下文（取消一次攻击/伤害）；
- `lookTopDeckAndDoom`：整段牌库操作，建议先补 `api.peekDeck` / `api.putDeckTop`；
- `redrawChaos` / `cancelHarmGainResources` / `redrawEncounter`：反应窗口上下文；
- `returnCommittedSkill` / `healHorrorNearby`：与 `legacyReaction` 数据体绑定；
- `dukeInvestigate`：杜克调查，基础值 4，建议条目 `action` + `api.test`。

**33 个 `legacyReaction` 条目**

```
01012, 01021, 01032, 01033, 01041, 01046, 01073, 01075,
02006, 02012, 02020, 02029, 02149, 02188, 02230, 02269,
02302, 02309, 03024, 03195, 03268, 03269, 03305, 03313,
04008, 04017, 04023, 04107, 04158, 04159, 04197, 04200, 04307
```

`legacyReaction` 是旧描述子兼容通道，规则已经在该卡自己的文件里，不算“外部硬编码”；
但它是第 4 批 3 个 type（`returnCommittedSkill` / `healHorrorNearby` / `redrawChaos`）的前置。
优先级低于第 7 批。

`EFFECTS[` 60 处读取 / 29 文件：
`src/engine/ability.js`、`actions.js`、`actions-extra.js`、`assets.js`、`campaign-plugin.js`、
`card-defs.js`、`card-effects.js`、`card-implementation.js`、`card-lookup.js`、`deck-ops.js`、
`dispatch.js`、`encounter.js`、`enemies.js`、`engine.js`、`harm-threat.js`、`lifecycle.js`、
`modifiers.js`、`play-condition.js`、`reveal.js`、`rules-state.js`、`save-migration.js`、
`scenario-runtime.js`、`setup.js`、`stats.js`、`table-decisions.js`、`tests.js`、`turn.js`、
`turn-flow.js`、`weakness.js`。

`EFFECTS` 已空，这些 fallback 可以逐步删除，但要先确认每处都走条目读点。

无引用原语（13，`EFFECT_PRIMITIVES` / `audit/hardcode-whitelist.json`）：

```
addFog, addTestBonus, aquinnahRedirect, becomeAsset, discardAsset, discardHand,
exhaust, moveHorrorToInvestigator, redGlovedManSkills, retryTest, search,
skillTest, spawnEnemy
```

处理方式：要么在卡条目里接线，要么从 `EFFECT_PRIMITIVES` 删除并在 `audit-abilities` 重新生成。

---

### 3.3 第 8 批：战役 / 叙事 / UI（约 79 处）

已完成：`storyRole` + `storyCardCode(role)`，丽塔/古代遗物/击退邪恶/寻找伊兹四个常量改为派生。

仍待处理：

| 位置 | 数量 | 内容 |
| --- | ---: | --- |
| `src/campaign/campaign.js` | 11 | `researchRequirement`（02262–64/03192–93）、`STARTING_XP['04004']`、04106 升级、01117 特判、04109 折扣 |
| `src/campaign/story.js` | 9 + 5 个 `campaign.id` 分支 | 场景 id → 卡号；`carcosaFlowStory` 等 |
| `src/campaign/campaign-effects.js` | 2 | `poisonCode \|\| '04102'` |
| `src/campaign` 合计 | **22** | |
| `src/integration/presentation-state.js` | 10 | 02285–02292 地点图分组 |
| `src/integration/attack-style.js` | 5 | 7 把武器的攻击动画 |
| `src/integration/observation.js` | 3 | 03009 / 03009b 变身 |
| `src/integration` 合计 | **18** | |
| `web/game-ui.js` | 6 | 01038/02102/02089/02011、03103、01008 |
| `web/table-components.js` | 7 | 02007/02011/02142 |
| `web/deck-rules.js` | 7 | 02002（黛西）牌组限制 |
| `web/table-regions.js` | 11 | 剧本 → 剧本卡号表 |
| `web/rulebook-data.js` / `web/situation-view.js` | 3 | 02085/02220、01002 |
| `web` 合计 | **34** | |
| `src/cards/card-rules.js` | 3 | `RANDOM_BASIC_WEAKNESS_CODE='01000'`、`LEGACY_STRAITJACKET_CODE='03185'`、`LEGACY_FIGHT_OR_FLIGHT_CODE='03155'` |
| `src/engine/campaign-flow.js` | 1 | `campaign.id === 'thePathToCarcosa'` |
| `src/engine/setup.js` | 1 | `location: 'study'` 中性初始值 |

建议顺序：

1. **常量**：`RANDOM_BASIC_WEAKNESS_CODE` 是占位卡（catalog-only），可保留为「牌组构建常量」并加注释；两个 `LEGACY_*` 移到 `save-migration.js` 局部常量；`thePathToCarcosa` 特判改成战役内容钩子 `campaignEndEffects` 或 `campaignBehavior`。
2. **campaign.js**：`researchRequirement` / `STARTING_XP` / `04106` / `04109` 改成条目 `campaign` 字段或战役记录规则；`01117` 特判改 `storyRole` 读点。
3. **story.js**：把 `carcosaFlowStory` / `dunwichFlowStory` / `tfaFlowStory` 整段搬到 `content/campaigns/<id>/story.js`，`story.js` 只保留通用拼装；`campaign.id` 分支改成内容注册。
4. **integration / web**：先让 `presentation-state` / `cardMarkerData` 输出派生字段（如 `counterTreacheryCode`、`storyCardCode`、`scenarioCardCode`），前端只读字段，不再认卡号。
5. `web/table-regions.js` 的剧本→卡号表可以留在 content，由 manifest 提供 `scenarioCardCode`。

---

### 3.4 收尾项

- `behaviorLines` 余量 362，迁 `behavior.js` 实现时注意仍走「实现放同目录小模块，behavior 只挂 hook」。
- 内容层守卫基线 `1282` 必须随迁移下降，否则守卫会失败。
- 当前 `cardLayerCodes=385` 包含大量**应该存在**的非玩家卡条目卡号，不能当剩余量；真正剩余看第 7 批分支数和 §3.3。
- `tests/architecture-guard.test.mjs` 已有 15 个用例；新增迁移模式时优先加读点/守卫，不要只改测试。

---

## 4. 建议的后续排期

如果继续按 60 轮目标推进（当前第 51 轮，剩 9 轮），建议：

| 轮次 | 工作 |
| --- | --- |
| 52 | 敦威治 `encounter-rules.js` 的 39 个分支：先迁 `enemySpawned` / `statModifier` 数据型（约 10 个） |
| 53 | 敦威治剩余 `resolveEncounter` 分支 + 卡尔克萨 `03102` / `03224` |
| 54 | 失落时代 `01170/01174/01178` + `04078/04079`，保留 `04092` |
| 55 | 卡尔克萨 `theUnspeakableOath` / `theLastKing` / `curtainCall` 的 `actRule/agendaRule` |
| 56 | `theBoundaryBeyond` / `theDepthsOfYoth` / `threadsOfFate` 的幕/密谋 |
| 57 | 第 4 批：`dukeInvestigate` / `lookTopDeckAndDoom` / `redrawEncounter` 等 8 个 type |
| 58 | 第 8 批：`campaign.js` + `story.js` 战役分支 |
| 59 | 第 8 批：integration/web 派生字段 |
| 60 | 全量门禁 + replay + 更新 REPORT/PROGRESS/白名单 + 最终交接 |

按历史速度，9 轮只能再清掉约 60–100 个分支，**不要在第 60 轮宣称全部完成**；
若目标要求真正完成，需要额外 40+ 轮。

---

## 5. 固定工作流与踩坑

### 5.1 每次改动后的命令（Windows PowerShell）

```powershell
cd G:\boardgame-hall-ai\games\arkhamhorror

node tools/build-card-index.mjs --write          # 新增/修改 entries 时
npm.cmd run cards:check                          # 5 项守卫
node tools/replay-fixtures.mjs --compare G:\boardgame-hall-ai\artifacts\arkham-hardcode-audit\replay-before.json
node tools/run-tests.mjs fast
node tools/audit-abilities.mjs --write            # 覆盖产物变化时
node tools/hardcode-audit.mjs --write             # 白名单下降后
```

> PowerShell 下必须用 `npm.cmd`，`npm` 可能被执行策略拦住。
> `node tools/run-tests.mjs fast` 输出重定向时用 `*>`，读日志注意 UTF-16 编码。

### 5.2 关键约定 / 已踩过的坑

1. **规则数据只能进注册表，不能进 `state` / `state.scenario`**
   - `state.scenario` 会进 replay 指纹；
   - 函数字段绝不能并入定义（`structuredClone` 会抛 DOMException）；
   - 用 `enemyStatRule` / `enemySpawnRule` / `enemyScript` 这类**只进注册表**的字段；
   - 已因此返工：`movement` 的 `onEnter`、TFA 04084 的 `vengeanceThresholds`。

2. **选择恢复凭据**
   - `requestChoice` 按 `choiceId + kind + source + seat + optionId` 匹配；
   - 在条目里做「效果前选择」时，选项 id/顺序/文案必须与旧分支完全一致；
   - `api.choose` 必须显式 `seat`；
   - 座位比较用 `String(seat)`（`0` vs `'0'`）；
   - 已因此返工：`04092` 保留在内容层、`04100` 的座位映射。

3. **战役作用域**
   - 同号卡可能出现在多个战役；
   - 用 `encounterResolveCampaigns: ['carcosa']` 限定入口；
   - 否则 TFA 迁移的核心盒条目会截胡卡尔克萨的同号卡（`carcosa-curtain-call-*` 第 18 步）。

4. **逐实体派发，不要在条目里再套全表循环**
   - `locationWillFlip` / `locationFlipped` 内容层已逐敌人调用；
   - 条目里再 `for (enemy of state.enemies)` 会双重结算（C5 攻击两次）。

5. **Phase 6 门禁**
   - `src/engine/**` 的注释里不能出现战役名（`Carcosa` / `TFA` / `Dunwich`），
     否则 `tests/phase6-guard.test.mjs` 失败；
   - 注释写「内容层 encounter-rules」而不是具体战役。

6. **`behaviorLines` 预算**
   - 预算 14831，当前 14469，余量 362；
   - 实现放同目录小模块（如 `act-reveal.js`），`behavior.js` 只挂一行 import/hook；
   - 不要为了行数把逻辑塞回 `behavior.js`。

7. **重复卡号**
   - `02178` 是玩家弱点，标记只能放 `entries/02178.js`，非玩家条目重复注册会抛错；
   - `04214` 同时是遭遇卡和幕卡，幕分支保留在 behavior，条目入口跳过。

8. **测试假 `api`**
   - 单元测试的 stub 没有 `shuffle` / `cardName` / `giveAsset` 等；
   - 条目里用 `api.shuffle?.(...)` 或本地 Fisher–Yates 兜底；
   - 不要假设测试环境注册了引擎。

9. **可选链与默认值**
   - 卡条目可能被静态索引在引擎注册前读取；
   - 用 `entryOf` 的静态回落读点（`card-rules.js`），不要直接读 `registeredEntry`。

10. **不要 `git checkout` / `reset`**
    - 工作区有大量未提交修改（本次修复 + 之前就存在的 UI/AI 改动）；
    - 先跑门禁，不要用重置来“修复”失败。

### 5.3 新增条目字段的检查清单

1. `src/engine/ability.js` 的 `ENTRY_KEYS` 加字段；
2. 归一化里深拷贝/冻结（数组/对象）；
3. `src/cards/card-rules.js` 加读点函数（静态回落）；
4. 内容层只通过读点访问；
5. 加/改 `tests/architecture-guard.test.mjs` 或对应卡测试；
6. 跑 replay；如改 `state.scenario` 结构，replay 会失配，说明字段选错了。

---

## 6. 文件地图

| 位置 | 作用 |
| --- | --- |
| `src/cards/entries/<code>.js` | 玩家卡：一卡一文件 |
| `src/cards/encounter-abilities.js` | 非玩家卡条目（敌人/地点/幕/密谋/剧情资产/诡计） |
| `src/engine/ability.js` | 条目注册、字段归一化、冻结 |
| `src/cards/card-rules.js` | 规则读点（静态索引回落） |
| `src/engine/scenario-runtime.js` | 剧本 API（`api.*`），给条目/behavior 用 |
| `content/campaigns/<id>/scenarios/<scenario>/behavior.js` | 章节流程（应只剩分派与流程钩子） |
| `content/campaigns/<id>/encounter-rules.js` | 共享遭遇规则（第 7 批主战场） |
| `content/campaigns/<id>/card-data.js` | 卡定义补充（已基本无手写规则表） |
| `tests/architecture-guard.test.mjs` | 硬编码/预算/产物守卫 |
| `tools/hardcode-audit.mjs` | 分层卡号扫描 + 白名单 |
| `tools/replay-fixtures.mjs` | 行为零变化证明 |
| `artifacts/arkham-hardcode-audit/replay-before.json` | 13 局基线（不要覆盖） |

---

## 7. 工作区与未提交修改

- 本次修复**全部未提交**；`git status` 有 100+ 个修改/新增文件。
- 已知在本任务之前就存在、不要误删的改动：
  `content/campaigns/nightOfTheZealot/scenarios/theMidnightMasks/definition.js`、
  `index.js`、`src/ai/*`、`src/engine/describe.js`、`src/engine/engine.js`、
  `src/engine/moves.js`、`src/engine/table-decisions.js`、
  `tests/ai-completion.test.mjs`、`tests/fixtures/replay/golden-replays.json`、
  `release.bat`、`src/engine/location-facts.js`。
- 新增但未跟踪的关键文件：
  `audit/hardcode-whitelist.json`、`tools/hardcode-audit.mjs`、
  `tools/...`、`docs/card-fidelity-*.md`、`release.bat`、
  `src/cards/investigator-abilities.js`、`src/engine/location-facts.js`。
- `tests/fixtures/replay/golden-replays.json` 在本任务前已被修改；本次只跑 `--compare`，未覆盖它。

**建议**：先 commit 当前全绿状态（或至少打 stash 快照），再继续第 7 批；否则后续返工很难区分本次改动与历史改动。

---

## 8. 完成定义（DoD）

第 4、7、8 批全部完成时，应同时满足：

1. 内容层 `code === '0xxxx'` 分支 = **0**（或只剩有注释说明的展示/布置数据）；
2. 内容层卡号字面量 ≤ 一个约定的低基线（当前 1282，目标按迁移进度下降）；
3. `player-effects.js` 不再按 `effect.type` 分派单卡效果；
4. `src/campaign` / `src/integration` / `web` 不再有单卡特判，改用条目/派生字段；
5. `engineEntityHits` = 0（`study` 改为剧本 setup 注入，`thePathToCarcosa` 改为内容钩子）；
6. `EFFECTS[` 读取 = 0，未引用原语 = 0；
7. `cards:check`、`test:fast`、replay 13 局全绿；
8. `behaviorLines` ≤ 14831，最好继续下降；
9. `REPORT.md` / `PROGRESS.md` / `hardcode-whitelist.json` 同步更新。

---

## 9. 相关文件

- 审计报告：[REPORT.md](../../../artifacts/arkham-hardcode-audit/REPORT.md)
- 进度：[PROGRESS.md](../../../artifacts/arkham-hardcode-audit/PROGRESS.md)
- replay 基线：`artifacts/arkham-hardcode-audit/replay-before.json`
- 白名单：`audit/hardcode-whitelist.json`
- 扫描工具：`tools/hardcode-audit.mjs`
- 能力审计：`tools/audit-abilities.mjs` / `audit/ability-coverage.json`
- 迁移流程：[arkham-content-migration.md](arkham-content-migration.md)
- 卡模型：[card-model.md](card-model.md)
