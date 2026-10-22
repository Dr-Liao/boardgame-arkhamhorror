# 外部硬编码清理 · 交接文档

> 更新：2026-10-22（第 127 轮）——**第 4 / 7 / 8 批全部完成，DoD 九条全部达成**
> 仓库：`games/arkhamhorror`
> 关联审计：[REPORT.md](../../../artifacts/arkham-hardcode-audit/REPORT.md)（修复前快照，当前工作区缺失）
> 实时进度：[PROGRESS.md](../../../artifacts/arkham-hardcode-audit/PROGRESS.md)
> 目标状态：内容层分支 **0**、第 8 批字面量 **0**、引擎实体 id **0**、
> `EFFECTS[` 读取 **0**、未引用原语 **0**、`player-effects.js` 已删除。
> 第 127 轮完成：`web/` 34 → **0**（卡号表集中到 `web/ui-cards.js` + 新增 web 守卫）。
> 第 128 轮修正：该数据表随浏览器模块留在 `web/` 内（原放在 `presentation/`，
> 浏览器按 `/mods/presentation/...` 请求会 404，整个 Mod 界面退回大厅通用弹窗）。

---

## 0. 一句话结论

**三批全部完成。** 引擎层硬编码清零（`engine.js` 卡号 0、引擎实体 id 0），
内容层卡号规则分支 476 → **0**（守卫基线 0），
`src/campaign` / `src/integration` / `web` 的单卡特判 **0 处**，
`src/cards/player-effects.js` 已删除（8 个 `effect.type` 全部搬进条目），
`EFFECTS[` 读取 0、未引用原语 0、死原语分支 0。

**唯一残余风险**：本工作区没有 Playwright，`web/*.js` 的改动只做了语法检查、
Node 模块可加载验证与纯函数行为验证，**没有跑浏览器套件**；
装好 `@playwright/test` 后应补一次 `npm run test:carcosa:browser` 之类的验收。

---

## 1. 当前指标（2026-10-22，第 127 轮）

| 指标 | 修复前 | 现在 | 说明 |
| --- | ---: | ---: | --- |
| `engine.js` 卡号 | 0 | **0** | 原始指标，不是全部 |
| 引擎实体 id | 40 | **0** ✅ | 第 124 轮：`study` 占位清空 + `thePathToCarcosa` 改战役清单字段 |
| 卡牌层卡号（非 entries，去重） | 147 | **635** | `card-rules.js` 的流程常量改成条目派生 |
| 内容层卡号字面量 | 2162 | **845** | `behavior.js` / `encounter-rules.js` / `card-data.js` |
| 内容层卡号**规则分支**（全 content） | 未统计 | **0** ✅ | `tests/architecture-guard.test.mjs`；**第 7 批完成** |
| **第 8 批字面量**（campaign/integration/web） | 未统计 | **0** ✅ | 85 → 63 → 52 → 34 → **0**（第 127 轮收尾） |
| `behaviorLines` | 14830 | **12708** | 预算 **14831**，余量 **2123** 行 |
| 效果原语 | 97 | **56** | 第 121–122 轮退役 10 个、第 126 轮退役 12 个 |
| 无引用原语 | 27 | **0** ✅ | DoD 第 6 条（前半）达成 |
| `EFFECTS[` 残留读取 | 69 处 | **0** ✅ | DoD 第 6 条（后半）达成 |
| `player-effects.js` 按卡分派 | 24 | **0** ✅ | 文件已删除（DoD 第 3 条达成） |
| `legacyReaction` 条目 | 未统计 | **33** | 见 §3.2，只剩兼容旧式询问顺序的作用 |
| `test:fast` | 2210 | **2216 通过 / 0 失败** | architecture-guard 17/17 |
| replay 基线 | — | **13 局 / 779 步逐条一致**（第 124 轮重录） | `node tools/replay-fixtures.mjs --check` |

当前门禁（第 127 轮最后一次运行）：

- `npm.cmd run cards:check` → **5/5**
- `node tools/run-tests.mjs fast` → **2216 / 0 失败**
- `node tools/replay-fixtures.mjs --check` → **13/13 一致**
- rchitecture-guard → **17/17**（第 127 轮新增：web 不得出现卡号字面量）
- `node tools/audit-dead-primitives.mjs` → **8 个分派点 / 0 个死分支**
- 内容层卡号守卫基线：`CONTENT_CARD_CODE_BASELINE = 845`、`CONTENT_BRANCH_BASELINE = 0`
- `node tools/hardcode-audit.mjs --check` → 无增长、无 stale
  （`engineEntityHits = 0`、`unusedPrimitives = 0`、`EFFECTS[` 读取 = 0）
- `node tools/audit-dunwich-acceptance.mjs --write` → 333/333
- replay 基线第 124 轮重录（`--write`）：13 局 `final` 与 `log` 与旧基线逐项相同，
  只有「调查员占位地点」相关的前若干步哈希变化（备份 `artifacts/arkham-hardcode-audit/golden-replays-before-124.json`）

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
| 4 | `player-effects.js` / 卡名原语 | ✅ **完成**（8 个 `effect.type` 全搬进条目，文件已删除；原语 97 → 68） |
| 5 | 剧本脚本出引擎 | ✅ 完成（夜之狂热三关的幕/密谋/强制的旧 case 已删） |
| 6 | 调查员能力进条目 | ✅ 完成（数据层；`INVESTIGATOR_ABILITIES` 只剩兼容导出） |
| 7 | 内容层批量迁移 | ✅ **完成**（2162 → 845；`code === '0xxxx'` 分支 476 → **0**） |
| 8 | 战役 / 叙事 / UI | 🟡 `src/campaign` 已 **0**；剩 `card-rules.js` 11 + `integration` 18 + `web` 34，详见 §3.3 |

---

## 3. 剩余工作明细

### 3.1 第 7 批：内容层（✅ 已完成，分支 = 0）

2026-10-22 第 120 轮实测：`content/**/*.js` 的 `(?:code|originalCode) === '0xxxx'` 计数为 **0**，
守卫 `CONTENT_BRANCH_BASELINE = 0`（新增即失败）。最后 4 个分支由三处框架改造收尾：

| 原分支 | 收尾方式 |
| --- | --- |
| `04055` / `04056`（跨章共用议程，2） | 条目的 `agendaRuleByScenario.turnBackTime`；读点 `agendaRuleFor(code, state.scenario?.id)` |
| `04214`（同号既是遭遇卡又是幕卡，1） | 幕规则挂到既有遭遇条目的 `actRule`（引擎只对幕读 `actRuleFor`） |
| `04092`（效果前选择的恢复凭据，1） | 条目内逐字对齐选项 id/顺序；删掉章节内分支与 `code !== '04092'` 豁免 |

第 114–119 轮清零的章节文件（不要再回头加分支）：`theUnspeakableOath`、`thePallidMask`、
`blackStarsRise`、`curtainCall`、`dimCarcosa`、`dunwich-chaos`、`theLastKing`、`theCityOfArchives`、
`theDepthsOfYoth`、`theBoundaryBeyond`、`theHouseAlwaysWins`、`theUntamedWilds`、
`extracurricularActivity`、`shatteredAeons`、`heartOfTheEldersPart1`、`threadsOfFate`、
`aPhantomOfTruth`、`echoesOfThePast`、两个 `encounter-rules.js`、NotZ 三个 behavior、
`content/packs/manifests.js`、`dunwichCampaign/manifest.js`。

**新规则一律写条目**：内容层的卡号分支守卫现在是 0，任何 `code === '0xxxx'` 都会让
`architecture-guard` 失败；迁移手法见 §3.1.2 与各轮的「新增读点」记录。

#### 3.1.1 内容层主文件的剩余分支

**敦威治 `later-behaviors.js`（0 个，已清零）**
文件：`content/campaigns/theDunwichLegacy/later-behaviors.js`
第 53 轮已把 `resolveEncounter` 的 02142/02143/02144/02145/02180/02181/02220–02223/02256/02257
共 12 个分支迁到条目；第 55 轮把 `locationRevealed` 的 02173/02176/02177/02285–02292
与 `locationEntered` 的 02132/02134 共 13 个分支迁到 `locationRule.onReveal` / `onEnter.effect`；
第 56 轮把 `agendaReveal` 的 16 个与 `actReveal` 的 8 个分支迁到
`agendaRule.onReveal` / `actRule.onReveal`（入口先查条目）；
第 57 轮又把 02089/02224/02296/02298/02331/02333 迁到 `encounterResolve` / `enemyScript`；
第 58 轮把 `actReveal` 剩余的 02122/02125/02165/02199/02240/02278–02280/02317 迁入条目；
第 59 轮把 `afterTest` 里 02133/02135/02136 的调查失败规则迁到 `locationRule.onTestFail`
（引擎统一派发）；第 61 轮把 02258/02259 迁入条目（条目内自带 brood 移动/随机地点 helper）；
第 62 轮把 02146/02297 迁入条目（条目内自带追猎恐魔/暗影之子 helper）；
第 63 轮把 02332 与 02208/02211 迁入条目（`encounterResolve` + `locationRule.onReveal`），
内容层 `locationRevealed` 整段删除；第 64 轮把 `agendaReveal` 02119/02120/02237/02238 与
`actReveal` 02123/02124 迁入条目，内容层两个钩子变成纯注册表分派；
第 65 轮把 02141/02323 的生成/击败迁入 `enemyScript`，内容层 `enemySpawned` 删除；
第 66 轮把 02325/02326/02278–02280/02255/02204/02244/02245 迁入条目，新增
`locationRule.onCluesRemoved` / `onLeave.effect` / `enemyEvadeModifier` / `enemyScript.statModifier` 读点；
第 67 轮把 02327 的离开检定与 02216/02323 的禁闪避/禁借机攻击迁入条目，
新增 `onLeave.onFail` 读点；第 68 轮把 Essex 02167–02171 的五节旅客车厢迁入
`locationRule.onEnter.effect`；第 69 轮把 02324–02328 迁入 `locationRule.onDraw`；
第 70 轮把 02130/02131/02137/02174 的调查限制迁入 `locationRule.investigationError`；
第 71 轮把 `checkObjectives` 的幕目标/结局条件迁入 `actRule.objective` / `actRule.finish`；
第 72 轮把 02126/02206 的「不能获得资源」与 02172/02174 的场景行动迁入
`locationRule.canGainResources` / `locationRule.actions`；第 73 轮把 02182 的交战禁移与
02097 的禁获资源改为 `enemyRule` 标志；第 74 轮把卡尔克萨 03091/03094 的附属行动迁入
`treacheryRule.attachmentAction`；第 75 轮把 03059/03093/03258/03261 的场景行动与
02295 的攻击结算迁入 `enemyScript` / `treacheryRule`；第 76 轮把 02088 的盟友限制改为
`threatEffect.cannotPlayAllies` / `blanksAllies`；第 77 轮把 02178 的显现效果迁入
`entries/02178.js` 的 `encounterResolve`；第 78 轮把 02214/02215 的「地点底下翻出」
迁入 `onFound` 钩子；第 79 轮把跨卡查敌人改为 `enemyRule.brood` / `huntingHorror` 标记；
第 80 轮把关键资产改为 `assetRule` 标志；第 81 轮把 02138/02139/02179/02217/02218
改为 `assetRule`、02088 改读 `threatEffect`；第 82 轮把最后 4 个（02221/02249/02294/02205）
迁入 `treacheryRule.song` / `locationRule.turnEndDamage` / `enemyRule.alteredHerald` /
`locationRule.onInvestigateFail`，**本文件卡号分支清零**。

迁移前先判断 body 是否只依赖 `api` 与 `state`；依赖章节私有 helper 的先把 helper 提升为 `api.*` 通用能力。

**敦威治 `encounter-rules.js`（0 个，已清零）**
文件：`content/campaigns/theDunwichLegacy/encounter-rules.js`
`resolveEncounter` 的 14 个卡号分支与 `enemyAttackStarted/Resolved`、`enemySpawned` 的 4 个
`enemyScript` 分支已在第 52 轮迁到 `src/cards/encounter-abilities.js`；
第 53 轮删除了 `statModifier` 里与 `entries/<code>.js` 重复的 5 张剧情资产 +1（02061/02080/
02140/02217/02218），并补了 `entries/02217.js`；
第 60 轮把 02329 的生成/移动统一到 `enemyScript`、02088 的回合结束检定改走
`threatEffect.endTurnTest`、02219 的剧情可打出与入场线索改走条目字段；
第 113/114 轮把剩余的 `statModifier` / `cardDrawn` / `cluesGained` / `enemyDefeated` /
`assetLeftPlay` / `enemyMoved` / `canPlayCard` 收尾（历史上写成「16 个分支」的口径现已为 0）。

**失落时代（1 个分支，故意保留）**
文件：`content/campaigns/theForgottenAge/encounter-rules.js`
第 52 轮已迁走 `01170` / `01174` / `01178`；第 54 轮把 `04062`（生成/攻击成功/躲避）、
`04078` / `04079`（攻击结算）迁到敌人条目的 `enemyScript`，删掉 `04084` 的 no-op
`beforeEnemyHarm`，`04102` 改走 `isPoisonThreat` 读点（第 114 轮把 `tfa-chaos.js`、
`theUntamedWilds`、`heartOfTheEldersPart2` 里重复的 `04102` 判断也统一到该读点）。剩余：

- `04092`（不祥之兆，地点选择；第 120 轮已迁入条目，选项 id/顺序与旧分支逐字一致）

**卡尔克萨（0 个，已清零）**
文件：`content/campaigns/thePathToCarcosa/encounter-rules.js`
第 52 轮已迁走 `03102` / `03224` / `01176`；第 114 轮把 `03248` 的 `moveError` 豁免
改成地点条目的 `locationRule.waivesEnterClueCost`，并同步 `thePallidMask/behavior.beforeMove` 的同一判断。

**第 120 轮：最后 4 个分支的收尾方式（守卫已到 0）**

| 原分支 | 收尾方式 |
| --- | --- |
| `04055` / `04056`（跨章共用议程，2） | 条目加 `agendaRuleByScenario.turnBackTime`；`agendaRuleFor(code, state.scenario?.id)` 优先取变体 |
| `04214`（同号既是遭遇卡又是幕卡，1） | 幕规则挂到既有遭遇条目的 `actRule`（引擎只对幕读 `actRuleFor`，两个方向互不干扰） |
| `04092`（效果前选择，1） | 条目内对齐选项 id/顺序与「找不到时不放毁灭」的边界；删掉 `code !== '04092'` 豁免 |

**第 119 轮新增的条目读点 / 手法**：

- `locationRule.exitLock: { flag, message }`：地点「到本轮结束不能离开」的锁
  （03215 调查成功后 / 03218 进入后），内容层 `movementError` 只读锁，不再认卡号；
- 玩家弱点条目也可以声明 `encounterResolveCampaigns` / `encounterResolve`
  （03227 失魂落魄从遭遇牌库结算的路径），同号卡不需要第二个条目；
- `enemyScript.onPhaseStart` / `.onRoundEnd`：敌军阶段开始与轮末的敌人脚本，内容层按条目统一派发；
- `actRule.shadowAction`：幕背面提供的团队行动标志（03207 跟踪阴影）；
- 资产身份标志 `assetRule.peabody`（03141）+ 地点 `locationShroud` 修饰符（03137）。

**第 118 轮新增的条目读点 / 手法**：

- 幕牌库型章节数据（命运之线）：条目直接读 `state.scenarioFlags.actDecks` 复算「在场幕数」，
  不需要给 `onReveal` 传 hooks（见 `threadActDecksInPlay`）；
- 线索总数回写：条目里用 `syncCluesInEntry(state)`（与引擎 `syncClues` 同口径求和）；
- 核心共享卡（01135/01136）用 `encounterResolveCampaigns: ['tfa']` 限定入口，
  不会截胡卡尔克萨 / 夜之狂热的同号卡。

**跨章共用的卡（历史问题，已解决）**：`04055` / `04056` 同时被《埃兹特里的覆灭》与《时间倒流》使用，
两章的文案/结局不同。第 120 轮用条目的 `agendaRuleByScenario` 解决：默认 `agendaRule` 留给前者，
`turnBackTime` 变体留给后者，读点带 `state.scenario?.id`。同样的手法可以用于任何「同号不同章」的规则。

**同号双类型（04214，已解决）**：同一卡号既是遭遇卡又是幕卡，能力层一个卡号只能注册一个条目；
第 120 轮把幕的结局分流挂到既有遭遇条目的 `actRule` 上——引擎只在幕上读 `actRuleFor`，
遭遇侧只读 `treacheryRule`/`encounterResolve`，两者互不干扰，不需要改注册键。

**两章共用但文案不同（04215/04216/04221）**：第 117 轮用条目标志
（`flags.pitfall` / `flags.spores` / `flags.ants` / `flags.noTurningBack`）把卡号判断收进条目，
两章各自保留实现；后续可以合并成单一 `encounterResolve`，但要先统一提示文案与「从探索牌库抽出」的判定标记
（part1 用 `exploreDrawPending`，part2 用 `exploringSeat`）。

**第 117 轮新增的条目读点**：

- `flags.pitfall` / `flags.spores` / `flags.ants` / `flags.noTurningBack`：两章共用的遭遇卡的条目标志；
- `locationRule.afterTest` 用**对象参数** `({ state, inv, result, api })`，`beforeExplore` 用位置参数——
  迁移时容易写错签名（第 117 轮踩过）。

**第 116 轮新增的条目读点**（下一轮直接用，不要另造）：

- `api.tokenLabel(token)`（`scenario-runtime`）：条目写「揭示混乱标记」日志时用同一份中文标记名，
  不要在卡条目里复制标签表（引擎 `treachery-tokens.tokenLabel` 是唯一实现）；
- `locationRule.nodeHazard: { withTrait, harm, icon, label }`：联结点型强制效果
  （进出带某特质的地点时，线索数转伤害/恐惧）；
- `locationRule.beforeInvestigate(state, inv, location, api)`：调查前的额外费用（04073 曲折小道）；
- 地点条目可直接声明 `locationShroud` 修饰符（04328 拉莱耶海岸 / 04335 瓦卢西亚），
  与章节 `locationShroudModifier` 相加，二者等价；
- `locationRule.actions({ state, inv, location, moves, hooks })`：`hooks` 传章节常量（如 `pillarsToOpen`）。

**第 115 轮新增的条目读点**（下一轮直接用，不要另造）：

- `actRule.objectiveCheck(state, act, api)` / `actRule.roundEndCheck(state, act, api)`——幕的推进检查与轮末检查；
- `locationRule.beforeExplore(state, inv, api, location)`（返回 `false` 取消探索）/
  `.afterExplore({ state, inv, api, context, location })` / `.afterExploreFailure(...)`；
- `onReveal(state, card, api, hooks)` 的**第四个参数**：章节耦合的编排交给条目、实现留在 behavior
  （`theBoundaryBeyond` 的 `sweep` / `shiftPresentDay` / `enterFinalStage`，
  `turnBackTime` 的 `removeSetAside` / `addActToVictory` / `shuffleDeck`）；
- `locationRule.scenarioActions: [...]`（地点声明自己提供哪些场景行动，文案/结算按 `move.rule` 在 content）；
- 章节级数据字段：`agendaRule.criminalAloof` / `.criminalDamagedAdvancesAgenda` /
  `.discardsCriminalsWithAbomination`、`actRule.allowsCheating` / `.guestAsset` /
  `.guestResignedResolution`、`locationRule.investigateFailLosesResources` / `.skipsUpkeepIncome` /
  `.facultyOfficeReveal`。

**第 114 轮新增的条目读点**：

- `entryFlags(code)`（`card-rules.js`）——「这张牌是不是 X」的通用标志读取（静态索引回落）；
- `enemyScript.onMoved` / `.attackModifier` / `.onDamaged`——敌人移动/攻击修正/受伤的条目脚本，
  内容层只做一行转发；
- `locationRule.onTurnEnd` / `.performAction` / `.waivesEnterClueCost` / `.investigateSkill` /
  `.handSlotsPenalty` / `.choeurGothique`（数据）；
- `assetRule.setAsideOnBodySwap`；
- `actRule.objective`（definition 里用 `actRuleFor(code)?.objective` 读，见 `curtainCall/definition.js`）。


#### 3.1.2 已建立的条目钩子（第 7 批继续用这些）

`src/cards/encounter-abilities.js` / `src/cards/entries/<code>.js` 支持：

- `actRule.onReveal(state, act, api)`
- `agendaRule.onReveal(state, agenda, api)`
- `locationRule.onReveal(state, loc, api, seat)`（第 55 轮新增；受 `ignore:revealText` 抑制）
- `locationRule.onEnter.effect(state, loc, api, inv)`（第 55 轮新增；在 `onEnter.test` 之前执行）
- `locationRule.onEnter` / `onLeave` / `onTurnEnd` / `onRoundEnd` / `onTestFail` / `playDiscount`
  - `onTestFail` 自第 59 轮起由 `src/engine/tests.js` 统一派发（内容层 `afterTest` 之后）；
  - `onEnter` 支持 `test` / `failChoice` / `effect`；`effect` 在 `test` 之前执行。
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

### 3.2 第 4 批：玩家效果（✅ 已完成，`player-effects.js` 已删除）

第 121–122 轮把 8 个 `effect.type` 全部搬进各自条目，`src/cards/player-effects.js` 与
`rt.playerCardEffect` 接线一并删除；退役 10 个原语（`EFFECT_PRIMITIVES` 78 → 68）：

| 原 `effect.type` | 卡片 | 现在 |
| --- | --- | --- |
| `cancelHarmGainResources` / `cancelHarm` | 02261 / 03157 / 04111 | 条目 `resolve` + `api.cancelHarm(seat, { maximum, gainResources })` |
| `redrawEncounter` | 02302 | `api.cancelEncounterDraw(seat, { redraw })` |
| `returnCommittedSkill` | 02309 | `api.recallCommittedSkill`（与 04159 同一实现） |
| `healHorrorNearby` | 02012 | 条目内 `api.choice` + `api.healHorror` |
| `redrawChaos` | 02230 | 重抽由条目级 `rerollTokenCost` 提供 |
| `flare` | 02115 | 条目 `resolve` + 新原语 `api.searchDeckIntoPlay` |
| `lookTopDeckAndDoom` | 02232 | 条目 `resolve` + `api.placeDoomOnCard` |
| `dukeInvestigate` | 02014 | 条目 `resolve` + 新原语 `api.moveDestinations` + `api.investigate` |
| `redGlovedManSkills` | 无引用 | 删除 |

新增通用原语（后续第 8 批与其它卡都能用）：

- `api.cancelHarm(seat, { maximum, gainResources, source, prompt })`
- `api.cancelEncounterDraw(seat, { redraw })`
- `api.searchDeckIntoPlay(seat, { amount, trait, fromSeat, source, prompt, ownerPrompt })`
- `api.moveDestinations(seat)`

**33 个 `legacyReaction` 条目**

```
01012, 01021, 01032, 01033, 01041, 01046, 01073, 01075,
02006, 02012, 02020, 02029, 02149, 02188, 02230, 02269,
02302, 02309, 03024, 03195, 03268, 03269, 03305, 03313,
04008, 04017, 04023, 04107, 04158, 04159, 04197, 04200, 04307
```

`legacyReaction` 是旧描述子兼容通道，规则已经在该卡自己的文件里，不算“外部硬编码”；
它曾经是第 4 批 3 个 type 的前置，第 121–122 轮后这些 type 已全部改成条目 `resolve`，
所以 `legacyReaction` 本身只剩「兼容旧式询问顺序」的作用。

`EFFECTS[` 60 处读取 / 29 文件：
`src/engine/ability.js`、`actions.js`、`actions-extra.js`、`assets.js`、`campaign-plugin.js`、
`card-defs.js`、`card-effects.js`、`card-implementation.js`、`card-lookup.js`、`deck-ops.js`、
`dispatch.js`、`encounter.js`、`enemies.js`、`engine.js`、`harm-threat.js`、`lifecycle.js`、
`modifiers.js`、`play-condition.js`、`reveal.js`、`rules-state.js`、`save-migration.js`、
`scenario-runtime.js`、`setup.js`、`stats.js`、`table-decisions.js`、`tests.js`、`turn.js`、
`turn-flow.js`、`weakness.js`。

`EFFECTS` 已空；**第 126 轮已把全部 `EFFECTS[` 读取删掉（60 → 0）**，
`lifecycle.js` / `card-defs.js` / `stats.js` / `table-decisions.js` / `card-implementation.js`
等读点改成只读条目/描述子。

无引用原语（**0**，`EFFECT_PRIMITIVES` / `audit/hardcode-whitelist.json`）：
第 126 轮退役了这 12 个（原语 68 → 56）：

```
addFog, addTestBonus, aquinnahRedirect, becomeAsset, discardAsset, discardHand,
exhaust, moveHorrorToInvestigator, retryTest, search, skillTest, spawnEnemy
```

退役方式：从 `EFFECT_PRIMITIVES` 删除 + `node tools/audit-abilities.mjs --write`；
依赖旧通道的测试（`phase1-state` / `phase6-implementation`）同步改成断言「通道已退役」。

---

### 3.3 第 8 批：战役 / 叙事 / UI（已完成，0 处）

已完成：`storyRole` + `storyCardCode(role)`；`src/campaign` 三文件归零（123 轮）；
`card-rules.js` 全部流程常量改成条目派生（124 轮）；引擎实体 id 归零（124 轮）。

| 位置 | 数量 | 内容 |
| --- | ---: | --- |
| ~~`src/campaign/campaign.js`~~ ✅ | 0 | 第 123 轮：条目字段 `researchRequirement` / `startingXp` / `shrewdAnalysis` / `arcaneResearch` / `uniqueInDeck` |
| ~~`src/campaign/story.js`~~ ✅ | 0 | 第 123 轮：`content/campaigns/*/story-roles.js`（角色 → 卡号） |
| ~~`src/campaign/campaign-effects.js`~~ ✅ | 0 | 第 123 轮：`poisonWeaknessCode()`（条目 04102 声明 `poisonWeakness`） |
| `src/campaign` 合计 | **0** ✅ | |
| ~~`src/cards/card-rules.js`~~ ✅ | 0 | 第 124 轮：`randomBasicWeakness`（01000）、`doomPerInvestigatorAmount`（03121–23）、`legacyStraitjacket`（03185）、`legacyFightOrFlight`（03155）、`explicitReactionPrompt`（02217）、四个 storyRole 兜底全部改条目派生 |
| ~~`src/engine/campaign-flow.js`~~ ✅ | 0 | 第 124 轮：战役清单字段 `campaignWeaknessTransferRecord` |
| ~~`src/engine/setup.js`~~ ✅ | 0 | 第 124 轮：占位地点改 `null`（replay 基线重录，final/log 未变） |
| ~~`src/integration/presentation-state.js`~~ ✅ | 0 | 第 125 轮：`content/campaigns/thePathToCarcosa/presentation.js` 的 `HIDDEN_LOCATION_ART`（02285–02292 分两组） |
| ~~`src/integration/attack-style.js`~~ ✅ | 0 | 第 125 轮：`content/presentation/attack-styles.js` 的 `ATTACK_STYLE_OVERRIDES`（7 把武器） |
| ~~`src/integration/observation.js`~~ ✅ | 0 | 第 125 轮：条目字段 `observationVariant: { code, minDamage }`（03009 → 03009b） |
| `src/integration` 合计 | **0** ✅ | |
| `web/game-ui.js` | 6 | 01038/02102/02089/02011、03103、01008 |
| `web/table-components.js` | 7 | 02007/02011/02142 |
| `web/deck-rules.js` | 7 | 02002（黛西）牌组限制 + 敦威治 5 人清单 |
| `web/table-regions.js` | 11 | 剧本 → 剧本卡号表 |
| `web/rulebook-data.js` / `web/situation-view.js` | 3 | 02085/02220、01002 |
| `web` 合计 | **34** | 需要先做「presentation 端点」 |

**第 127 轮：web 34 处已清零** —— 卡号表集中到 `web/ui-cards.js`（纯数据表，位于浏览器挂载目录内），
并新增 architecture-guard 第 17 条守卫「web/**/*.js 不得出现 5 位卡号字面量（`web/ui-cards.js` 除外）」（基线 0）。

**第 128 轮修正**：第 127 轮把该文件放进了 `presentation/`，但浏览器只能访问 `web/` 挂载点
（大厅把 `web.dir` 挂到 `/mods/arkhamhorror/`），`import '../presentation/ui-cards.js'` 实际请求
`/mods/presentation/ui-cards.js` 并 404，导致整个 Mod 浏览器模块加载失败：启动页退回通用弹窗、
开局后停在「正在加载界面…」。现已移入 `web/ui-cards.js`，并新增第 18 条守卫
「web 模块的导入不越出 web/ 挂载目录」，Node 侧能解析、浏览器会 404 的路径从此在单元测试就失败。

`web/*.js` 是 Mod HTTP 层静态提供的浏览器 ES 模块，不能 import `src/` 或 `content/`；
本工作区也没有 Playwright（`node_modules/playwright` 不存在），`tests/*.browser.mjs` 跑不了。

1. 在 Mod HTTP 层新增 `/api/mods/arkhamhorror/presentation`（或把字段塞进现有 catalog 响应），
   由 `src/integration` 从条目/内容生成：
   `{ attackStyles, hiddenLocationArt, scenarioReferences, deckRuleFlags, syntheticReferences,
   locationMarkers, rulebookOverrides, situationFlags }`；
2. `web/*.js` 启动时读这份数据，删掉全部按卡号的分支；
3. 用浏览器套件验收（需先 `npm i -D @playwright/test`）。

建议顺序：

1. **integration**：先让 `presentation-state` / `cardMarkerData` 输出派生字段
   （如 `counterTreacheryCode`、`storyCardCode`、`scenarioCardCode`、`attackStyle`、`observationVariant`），
   前端只读字段，不再认卡号。
2. **web**：`table-regions.js` 的剧本→卡号表由 manifest 提供 `scenarioCardCode`；
   `deck-rules.js` 的黛西限制改成条目字段；其余按派生字段读取。

---

### 3.4 收尾项

- `behaviorLines` 余量 2123，迁 `behavior.js` 实现时注意仍走「实现放同目录小模块，behavior 只挂 hook」。
- 内容层守卫基线 `CONTENT_CARD_CODE_BASELINE=845`、`CONTENT_BRANCH_BASELINE=0`
  （内容层分支已归零，新增即失败）；不要为了过守卫把卡号搬到另一个公共文件。
- 当前 `cardLayerCodes=635` 包含大量**应该存在**的非玩家卡条目卡号，不能当剩余量；真正剩余看 §3.2 / §3.3。
- `tests/architecture-guard.test.mjs` 已有 16 个用例；新增迁移模式时优先加读点/守卫，不要只改测试。
- 改 `tests/carcosa-*.test.mjs` 后必须重跑 `node tools/audit-carcosa-all-cards.mjs --write`
  （账本锁定验收文件哈希，否则 `carcosa-all-card-ledger` 用例失败）。
- 新增非玩家条目会让 `audit/hardcode-whitelist.json` 的 `cardLayerCodes` 增长，
  属目标形态；每次迁移后跑 `node tools/hardcode-audit.mjs --write` 并审阅 diff。
- **加条目前先查重**：`grep "code: '0xxxx'" src/cards/encounter-abilities.js` + `ls src/cards/entries`。
  第 115 轮曾给 `02078` / `04055` / `04056` 重复声明，导致「重复注册」直接抛错、以及
  静默用了旧条目（行为漂移）。

---

## 4. 建议的后续排期

第 52–61 轮的详细分工见旧记录（`git log` 与 `PROGRESS.md` 存档）。当前计划：

| 轮次 | 工作 |
| --- | --- |
| 52–82（已完成） | 敦威治 `later-behaviors.js`（82 → 0）与 `encounter-rules.js`（16 → 0）|
| 83–113（已完成） | 卡尔克萨 / 失落时代单点：`theLastKing`、`theUnspeakableOath`、`blackStarsRise`、`thePallidMask`、`dimCarcosa` 等 |
| 114（已完成） | 邪秽誓约 6、苍白面具 10、黑星升起 2+5、谢幕 1+1、卡城幽影 6、敦威治混乱袋 6、最后之王 1、失落时代 4、夜之狂热 4；新增 `entryFlags` 与 `enemyScript.onMoved/attackModifier/onDamaged` 读点 |
| 115（已完成） | 百赌百胜 15、荒莽密林 15、课外活动 5、界限彼端 3、时间倒流 5（剩 2）、两个 manifest 3；新增 `actRule.objectiveCheck/roundEndCheck`、`locationRule.beforeExplore/afterExplore`、`onReveal` 的 hooks 参数 |
| 116（已完成） | 破碎永世 15、久远腹地（上）11；新增 `api.tokenLabel`、`locationRule.nodeHazard`、`locationRule.beforeInvestigate`、条目级 `locationShroud` 修饰符 |
| 117（已完成） | 久远腹地（下）10（剩 04214 例外）、久远腹地（上）3；04215/04216/04221 用条目标志收掉卡号判断，新增 `onReveal` hooks 用于走圈/预示者 |
| 118（已完成） | 命运之线 16；密谋/敌人/遭遇/地点四类分支分别走 `agendaRule.onReveal`、`enemyScript.onSpawn`、`encounterResolve`（`['tfa']` 限定）、`locationRule.actions` |
| 119（已完成） | 真相幻影 11、往事回声 11；新增 `locationRule.exitLock`、`enemyScript.onPhaseStart/onRoundEnd`、`actRule.shadowAction`、弱点条目的 `encounterResolve` |
| 120（已完成） | **框架改造把内容层分支压到 0**：`agendaRuleByScenario`（04055/04056）、`actRule` 挂遭遇条目（04214）、04092 走条目 |
| 121（已完成） | 第 4 批第一刀：5 个 `effect.type` 改成条目 `resolve` + 通用原语（`api.cancelHarm` / `cancelEncounterDraw` / `recallCommittedSkill`），退役 7 个原语（78 → 71），`player-effects.js` 8 → 2 |
| 122（已完成） | 第 4 批收尾：新增 `api.searchDeckIntoPlay` / `moveDestinations`，`flare`（02115）、`lookTopDeckAndDoom`（02232）、`dukeInvestigate`（02014）搬进条目；**删除 `player-effects.js`** 与 `rt.playerCardEffect`，原语 71 → 68 |
| 123（已完成） | 第 8 批第一批：`campaign.js` 11 + `story.js` 9 + `campaign-effects.js` 2 → **0**；新增条目字段 `researchRequirement` / `startingXp` / `shrewdAnalysis` / `arcaneResearch` / `uniqueInDeck` / `poisonWeakness` 与两个 `story-roles.js` |
| 124（已完成） | 第 8 批第二批：`card-rules.js` 11 → **0**（全部条目派生）；`campaign-flow.js` / `setup.js` 收尾 → **`engineEntityHits = 0`**（DoD 第 5 条）；replay 基线重录（final/log 未变） |
| 125（已完成） | 第 8 批第三批：`src/integration` 18 → **0**（`content/presentation/attack-styles.js`、`thePathToCarcosa/presentation.js` 的隐藏地点背面、条目字段 `observationVariant`） |
| 126（已完成） | DoD 第 6 条：`EFFECTS[` 读取 60 → **0**、未引用原语 12 → **0**（原语 68 → 56，退役 12 个旧原语）；修掉批量替换留下的重复属性链 |
| 127（已完成） | **第 8 批收尾**：web/ 34 → 0（web/ui-cards.js + web-api.js 资源版本 + architecture-guard 第 17 条 web 守卫） |
| 128（已完成） | **浏览器挂载边界修复**：`presentation/ui-cards.js` → `web/ui-cards.js`（第 127 轮放错目录导致界面与开局全部退回通用页）+ architecture-guard 第 18 条守卫 |

**当前真实状态：三批全部完成，DoD 九条全部达成。**

1. 内容层 `code === '0xxxx'` 分支 0、第 8 批字面量 0、引擎实体 id 0。
2. `EFFECTS[` 读取 0、未引用原语 0、`player-effects.js` 已删除。
3. 门禁：`cards:check` 5/5、`test:fast` 2216/0、replay 13/13、`architecture-guard` 17/17。

**残余风险**：本工作区没有 Playwright，`web/*.js` 只做了语法检查、模块可加载验证与纯函数行为验证；
浏览器套件验收待补（`npm i -D @playwright/test` 后跑 `npm run test:carcosa:browser`）。

---

## 5. 固定工作流与踩坑

### 5.1 每次改动后的命令（Windows PowerShell）

```powershell
cd G:\boardgame-hall-ai\games\arkhamhorror

node tools/build-card-index.mjs --write          # 新增/修改 entries 时
npm.cmd run cards:check                          # 5 项守卫
node tools/replay-fixtures.mjs --check           # 13 局 golden 基线
node tools/replay-fixtures.mjs --compare <迁移前基线>   # 需要逐条对比时
node tools/run-tests.mjs fast
node --test tests/architecture-guard.test.mjs    # 内容层字面量/分支基线
node tools/audit-abilities.mjs --write            # 覆盖产物变化时
node tools/hardcode-audit.mjs --check             # 无增长；--write 只在基线下降后
```

> PowerShell 下必须用 `npm.cmd`，`npm` 可能被执行策略拦住。
> `node tools/run-tests.mjs fast` 输出重定向时用 `*>`，读日志注意 UTF-16 编码。
> `node tools/replay-fixtures.mjs --check` 与 `--compare` 二选一：golden 基线可用时优先 `--check`。

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
   - 预算 14831，当前 12708，余量 2123；
   - 实现放同目录小模块（如 `act-reveal.js`），`behavior.js` 只挂一行 import/hook；
   - 不要为了行数把逻辑塞回 `behavior.js`。

7. **重复卡号**
   - `02178` 是玩家弱点，标记只能放 `entries/02178.js`，非玩家条目重复注册会抛错；
   - `04214` 同时是遭遇卡和幕卡，幕分支保留在 behavior，条目入口跳过；
   - 第 114 轮踩到：`02255` 已有 `entries/02255.js`、`02323`/`03046` 已在
     `encounter-abilities.js` 声明过，**加字段要改原条目**，再声明一次会让引擎加载时抛
     「重复注册（能力层同一卡号只允许一个条目）」；
   - `enemyRule` 会被 `content/campaigns/theForgottenAge/card-data.js` 整体并入 `state.scenario`，
     给 TFA 敌人加 `enemyRule` 字段可能改变 replay 指纹——身份标志优先用 `flags`。

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

11. **不要用 PowerShell 批量改写中文源码**
    - 第 60 轮事故：`(Get-Content -Raw) -replace ... | Set-Content` 把 `later-behaviors.js`
      按 ANSI 读入、按 UTF-8 写出，整篇中文变成 GBK 乱码；代码行虽保留但提示文案损坏；
    - 已用「HEAD 原文 + CJK 片段回填 + 手工修复 13 处断行/引号」恢复并通过全量门禁；
    - 批量替换只能用 `edit`/写文件工具，或 Node `fs` 显式 `utf8`；不要用 `Get-Content` 管道写回。

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
| `tests/fixtures/replay/golden-replays.json` | 13 局 / 779 步行为基线（`--check`） |

---

## 7. 工作区与提交状态

- 第 51 轮的工作已由仓库提交 `5b3c43e 重构`（子模块 `games/arkhamhorror`）收录；
  第 52–114 轮的修改（本文件、`src/cards/encounter-abilities.js`、`src/cards/card-rules.js`、
  多个 `encounter-rules.js` / `behavior.js`、`tests/architecture-guard.test.mjs`、
  `audit/*.json`）**尚未提交**。工作区里还有大量本任务之前就存在的 UI/AI 改动。
- `artifacts/` 是 gitignore 目录，第 52 轮重建了 `artifacts/arkham-hardcode-audit/PROGRESS.md`，
  第 114 轮重建为最新指标；`REPORT.md` 需要从旧会话/备份取回，不要伪造修复前快照。
- replay 的稳定基线是签入的 `tests/fixtures/replay/golden-replays.json`（13 局 779 步），
  日常用 `node tools/replay-fixtures.mjs --check`；迁移期需要逐条对比时再 `--baseline/--compare`。
- 以下改动在本任务之前就存在，不要误删：
  `content/campaigns/nightOfTheZealot/scenarios/theMidnightMasks/definition.js`、
  `index.js`、`src/ai/*`、`src/engine/describe.js`、`src/engine/engine.js`、
  `src/engine/moves.js`、`src/engine/table-decisions.js`、
  `tests/ai-completion.test.mjs`、`tests/fixtures/replay/golden-replays.json`、
  `release.bat`、`src/engine/location-facts.js`。
- 新增但未跟踪的关键文件：
  `audit/hardcode-whitelist.json`、`tools/hardcode-audit.mjs`、
  `docs/card-fidelity-*.md`、`release.bat`、
  `src/cards/investigator-abilities.js`、`src/engine/location-facts.js`。

**建议**：第 114 轮已是全绿状态（2215/0、replay 13/13、守卫 16/16），继续前先 commit
（或至少 `git stash create` 快照）；否则下一轮很难区分本轮迁移与历史改动。
不要用 `git checkout/reset` 回滚。

---

## 8. 完成定义（DoD）

第 4、7、8 批全部完成时，应同时满足：

1. 内容层 `code === '0xxxx'` 分支 = **0** ✅（全 `content/**/*.js` 口径；第 120 轮达成，
   守卫 `CONTENT_BRANCH_BASELINE = 0`，新增即失败）；
2. 内容层卡号字面量 ≤ 约定低基线（当前 845，只降不升）；
3. `player-effects.js` 不再按 `effect.type` 分派单卡效果 ✅（第 122 轮：文件已删除，
   单卡逻辑在各自条目、通用逻辑是 `api.cancelHarm` / `cancelEncounterDraw` / `recallCommittedSkill` /
   `searchDeckIntoPlay` / `moveDestinations` 等原语）；
4. `src/campaign` / `src/integration` / `web` 不再有单卡特判，改用条目/派生字段；
   `src/campaign` 与 `src/integration` **已完成（0 处）**，`web` 还剩 34 处，
   需要先做 presentation 端点（方案见 §3.3）；
5. `engineEntityHits` = 0 ✅（第 124 轮：`study` 占位改 `null` + `thePathToCarcosa` 改战役清单字段，
   replay 基线同步重录且 `final`/`log` 未变）；
6. `EFFECTS[` 读取 = 0 ✅，未引用原语 = 0 ✅（第 126 轮达成；原语 68 → 56）；
7. `cards:check`、`test:fast`、replay 13 局全绿；
8. `behaviorLines` ≤ 14831，最好继续下降；
9. `PROGRESS.md` / `hardcode-whitelist.json` 同步更新（`REPORT.md` 是修复前快照，不追平）。

---

## 9. 相关文件

- 审计报告：[REPORT.md](../../../artifacts/arkham-hardcode-audit/REPORT.md)（当前工作区缺失）
- 进度：[PROGRESS.md](../../../artifacts/arkham-hardcode-audit/PROGRESS.md)
- replay 基线：`tests/fixtures/replay/golden-replays.json`（13 局 779 步）
- 白名单：`audit/hardcode-whitelist.json`
- 扫描工具：`tools/hardcode-audit.mjs`
- 能力审计：`tools/audit-abilities.mjs` / `audit/ability-coverage.json`
- 迁移流程：[arkham-content-migration.md](arkham-content-migration.md)
- 卡模型：[card-model.md](card-model.md)
