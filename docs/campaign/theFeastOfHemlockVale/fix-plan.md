# 九循环《铁杉谷盛宴》修复步骤（fix-plan）

> 配套 [`full-scan.md`](full-scan.md)（扫描结果、逐卡证据与复现）。本文件把独立复核发现的问题收敛成可执行修复步骤：
> **P0（崩溃/软锁/章节核心循环错误）→ P1（高严重度规则错误、证据与叙事）→ P2（近似披露、声明接线、i18n 与流程）**。
> 每项含「现象/证据 → 根因与修法 → 验收」。
> 口径沿用仓库规范：先原语后卡牌；条目只读状态、写入只走 `ctx.api`；引擎不新增卡号分支；
> 修卡后重建索引并跑 `cards:check` / `cards:encounter-check` / `audit:entries`；行为变化先
> `replay-fixtures --baseline` 再 `--compare`；账本用对应 `--write` 重签。
>
> **状态（2026-11-18）**：本文件是扫描产出的修复计划，**扫描阶段未修改源码**；
> P0 6 项、P1 9 项、P2 7 项全部待修。P0 全部可用 `artifacts/fhv-scan/scripts/` 下的脚本复现。
> 复现脚本与数据只写在大厅根目录 `artifacts/fhv-scan/`，不签入 Mod。

## P0：崩溃、软锁与章节核心循环（6 项）

### P0-1 汉洛克庄园：敌人-地点翻面崩溃（未知机制字段 massive）

- **现象**：`hemlockHouse` 议程推进（议程 1 → 2）或敌人-地点翻面时抛
  `TypeError: 未知机制字段 massive`，章节核心循环中断。
- **证据**：`hemlockHouse/definition.js` 的 `enemyLocationFace()` 给每个面写 `massive: true`
  （`CELLAR_ENEMY_FACE` 还写了 `singleSided: true`）；`hemlockHouse/behavior.js:436` 把它传给
  `api.turnLocationIntoEnemy`；`src/engine/enemy-location.js:5-16` 的 `validateEnemyFace`
  白名单不含这两个字段（`src/engine/mechanic-state.js:33` 抛错）。
  复现：`node artifacts/fhv-scan/scripts/debug-hemlock-agenda.mjs`。
- **修法（二选一，推荐①+②都做）**：
  ① 引擎 `validateEnemyFace` 接受并忽略内容层派生关键词（`massive`/`singleSided`/`cannotBeFlipped` 等；
  引擎本来强制 `massive:true`），或把它们并入 `enemyKeys` 白名单但不参与校验；
  ② 内容层从 `ENEMY_LOCATION_FACES` / `CELLAR_ENEMY_FACE` 删除 `massive`/`singleSided`
  （`singleSided` 无引擎读点，见 P2-1）。
  ③ 补真实引擎回归：`hemlockHouse` 议程 1/2/3 推进 + 每个敌人-地点翻面往返 + 失形地窖单面不翻。
- **验收**：`debug-hemlock-agenda.mjs` 不抛错；`probe-depth.mjs` 的 hemlockHouse rounds/agenda-first 全 ok；
  新增 `tests/fhv-p0-regressions.test.mjs` 覆盖；`npm run test:fast` 无新增失败；replay 一致。

### P0-2 无 seat 的 `api.choose`（12 处）导致不可回答的待决选择（软锁）

- **现象**：真实引擎产生 `pendingChoice.seat = undefined`，`actingSeats()` 为 `[undefined]`，
  `legalMoves` 不产出任何 `choose` 动作 → 对局永久卡住。已复现两条正常路径：
  ① writtenInRock 幕 1 背面「塌方」选择矿车朝向（必然流程）；
  ② theLostSister 抽到诡计 10586/10587 的失败二选一。
- **证据**：`writtenInRock/behavior.js:525-535,703,744,1084,1096,1164,1276,1343`（9 处）、
  `theLostSister/behavior.js:797,853,1316,1349`（3 处）的 `api.choose({...})` 均无 `seat`；
  `src/engine/scenario-runtime.js:1656/1660` 不补默认 seat；`src/engine/resolution.js:66-106`。
  复现：`node artifacts/fhv-scan/scripts/probe-scenarios.mjs`（全局问题里 `seatlessChoice`）。
- **修法**：
  ① 内容层 12 处补 `seat`：一般用 `inv.seat`；矿车/幕背面这类全桌决策用 `state.campaign?.leadSeat ?? 0`
  （与既有 `theTwistdHollow`/`fateOfTheVale` 的写法一致）；
  ② 引擎兜底：`scenario-runtime.js` 的 `choose`/`choice` 在 `request.seat == null` 时补
  `state.pendingChoice?.seat ?? state.currentSeat ?? state.campaign?.leadSeat ?? 0`，
  并对 `requestChoice` 增加「seat 必须为整数」断言（宁可明确报错也不要静默产生无主选择）；
  ③ 静态门禁：新增 lint/单测扫描 `content/**` 的 `api.choose({...})` 字面量必须含 seat，
  变量形参（helper）要求调用侧有 seat 或走引擎默认；
  ④ 补真实引擎回归：writtenInRock 通过幕 1 背面与幕 2，theLostSister 使用 10573/10574 行动、
  抽到 10586/10587 并回答二选一。
- **验收**：`probe-scenarios.mjs` 无 `seatlessChoice`；两章可推进到 `scenarioResult`；
  `npm run test:fhv:scenarios` 与全量 `test:fast` 无新增失败。

### P0-3 三张「放一边→洗入/抽出」诡计未进遭遇注册表（抽到即「未知遭遇卡」）

- **现象**：`10545 墙外奇物`、`10546 拖离正道`、`10743 “着火了！”` 不在生产 `ALL_TREACHERIES`；
  汉洛克庄园议程 1b/2b 把它们洗入遭遇牌库、最长一夜的火焰行动与终章火焰也会抽到它们，
  抽到即抛 `Error: 未知遭遇卡：<code>` 中断对局。
- **证据**：`hemlockHouse/definition.js:76-98/491-497` 把三张放进 `SET_ASIDE_TREACHERY_CODES`
  并从 `encounterDefinitions([...])` 的 code 列表排除；`theLongestNight/definition.js:233`、
  `fateOfTheVale/definition.js:309` 同样；`hemlockHouse/behavior.js:1464-1470` 洗入 10545/10546、
  `theLongestNight/behavior.js:993` 用 `api.drawEncounter(..., { code: 10743 })`。
  注册实测：`probe-encounter-registry.mjs` → `treacheriesRegistered 34/40`。
  复现：`node artifacts/fhv-scan/scripts/repro-set-aside.mjs`。
- **修法**：把「放一边但会进遭遇牌库」的三张加入对应场景的 `encounterDefinitions` 列表
  （保留 set-aside 语义，只补注册）；同时新增机械门禁：
  `每关 ENCOUNTER_DECK ∪ SET_ASIDE_CARDS ∪ 章节 behavior 中被 drawEncounter/洗入 的卡号
  必须全部在 ALL_ENEMIES / ALL_TREACHERIES / cardDef 中可解析`。
- **验收**：`repro-set-aside.mjs` 三张均可正常显现结算；`probe-encounter-registry.mjs` 显示
  FHV 40 张诡计中仅签名/专属弱点不入遭遇表（34→37+）；新门禁脚本入 CI；`test:fast` 无新增失败。

### P0-4 最长一夜全灭：`noResolution` 未声明 → 「未知剧本结局」崩溃

- **现象**：全部调查员被敌人击败后，引擎 `finishScenario('noResolution')` 抛
  `Error: 未知剧本结局`，战役无法结算。
- **证据**：`src/engine/harm-threat.js:374-381` 固定请求 `noResolution`；
  `src/engine/campaign-flow.js:246` 要求章节 `resolutions` 含该 key；
  `theLongestNight/definition.js:306` 只有 `investigatorDefeat/resolution1-4`。
  复现：`node artifacts/fhv-scan/scripts/debug-longest-night.mjs`。
- **修法**：`theLongestNight` 的 `resolutions` 增加 `noResolution`（正文复用 `investigatorDefeat`，
  behavior 已有 `NO_RESOLUTION → resolution3/investigatorDefeat` 映射）；
  `welcomeToHemlockVale`、`dawnOfTheSecondDay` 同样补 key 作防御（当前幕文本禁止被击败，属潜在同类）；
  引擎侧可选：`finishScenario` 在 key 缺失时按 `manifest` 兜底并记录明确错误，不裸抛。
- **验收**：`debug-longest-night.mjs` 全灭时进入 `scenarioResult` 并写入战役结局（非 crash）；
  新增真实引擎回归（全灭路线）；`test:fast` 无新增失败。

### P0-5 寂静荒野：任何敌人攻击后都被击败（判据常量真）

- **现象**：真实引擎中，寂静荒野的所有敌人攻击一次后立即被击败并进入胜利区；
  实测 10563/10564/10565 一回合全部消失，Boss 族群虫后（Victory 2）一次攻击即死，关底战失效。
- **证据**：`theSilentHeath/behavior.js:952`
  `codeOf(enemy) === COLORLESS_LARVA_CODE || flagIs(COLORLESS_LARVA_CODE, 'defeatAfterAttack')`
  的第二项恒真（`10563.js:5` 恒定声明 `defeatAfterAttack: true`）；引擎 `enemies.js:335` 在每次攻击后调用。
  复现：`node artifacts/fhv-scan/scripts/verify-silentheath-attack.mjs`
  （`round 2: enemies=none`，`victoryDisplay ["10563","10564","10565"]`）。
- **修法**：判据改为 `flagIs(codeOf(enemy), 'defeatAfterAttack')`（或直接 `codeOf(enemy) === COLORLESS_LARVA_CODE`）；
  核对 10563 的近似披露（应说明只影响它自己）；补真实引擎回归：
  普通敌人攻击后仍在场、10563 攻击后进胜利区（Victory 0）。
- **验收**：`verify-silentheath-attack.mjs` 输出中 10564/10565 存活、仅 10563 消失；
  `probe-depth.mjs` silentHeath 通过；`test:fast` 无新增失败。

### P0-6 面具「每个牌组仅限 1 张」：合法动作崩溃（legalMoves 与 applyMove 判据不一致）

- **现象**：控制任意 `[[Mask]]` 后，第二张 Mask 出现在 `legalMoves`、`validateMove` 通过，
  但 `applyMove` 抛 `Error: 没有合法的槽位替换方案`。10111（破碎冠冕）未近似披露，任何玩家都可能触发。
- **证据**：`src/cards/entries/10111.js`、`10133.js`、`10134.js` 的 `controlledTraitLimit` 类声明；
  引擎 `src/engine/engine.js:2667`（`canEquip || assetReplacementPlans`）与 `src/engine/assets.js:212`
  在 apply 阶段才失败；复现：`node artifacts/fhv-scan/probes/p3-mask-crash.mjs`
  （`legalMoves exposes second mask: ok` → `applyMove THREW`）。
- **修法**：把槽位/唯一性/牌组限 1 的判定前移到 `legalMoves`/`validateMove` 的 `play` 合法判据
  （与 `applyMove` 共用同一函数，避免两套口径）；`applyMove` 对「非法动作」返回错误而不是抛异常；
  10111/10133/10134 的 `playCondition` 增加「已有同特性 Mask 在场」提示（不再把不可用动作列给玩家）。
- **验收**：`p3-mask-crash.mjs` 中第二张 Mask 不再出现在 `legalMoves`；强行提交被 `validateMove` 拒绝；
  新增回归（10111+10133 同时入手、10134 交换循环两轮）；`test:fast` 无新增失败。

### P0-7 终章《山谷的命运》主线不可达：幕 1 目标永假 + 幕 3 永不揭示

- **现象**：真实引擎中终章幕 1 的「每位调查员都取回真正的调查员卡」目标永远不满足，玩家没有推进幕的动作；
  即使推进，幕 3a 也永不揭示（`advanceToAct3` 把 `actIndex` 设为 2 后引擎再 `++` 越过 3 张幕牌库），
  `actReveal → api.finish(R1–R5)` 永不执行 → 终章 5 个印刷胜利结局全部不可达，只剩议程 3 背面的 `noResolution`。
- **证据**：`fateOfTheVale/behavior.js:221` 写入扁平键 `fateTrueSelfReturned:${seat}`，而 `:956` 读取
  `flagsFor(state).fateTrueSelfReturned?.[inv.seat]`（对象键）→ 目标恒 false；
  `fateOfTheVale/behavior.js:826-833` 的 `advanceToAct3` 设 `state.actIndex = 2`，
  引擎 `src/engine/act-agenda.js:66-80` 在 actReveal 之后无条件 `state.actIndex++` → 3。
  复现：`artifacts/fhv-scan/probes/probe-scenarioLate-focus6.mjs`（幕 1 仍 `satisfied:false`）；
  `artifacts/fhv-scan/findings/scenarioLate.json`（FV-1/FV-2，真实引擎探针）。
- **影响**：终章主线目标不可完成、胜利结局（R1–R5）不可达，战役只能走到战败尾声；
  与 P1-1/P1-14 的尾声缺陷叠加后，「完整战役」在终章断裂。
- **修法**：① 统一 `fateTrueSelfReturned` 的读写形状（推荐整体写对象或按座位一致写入）；
  ② `advanceToAct3` 改用引擎既有 `actIndexAfterAdvance` 钩子（或设 `actIndex = 1` 让引擎 ++ 到 2），
  并补 `state.acts` 长度/索引校验；③ 补真实引擎回归：终章幕 1 目标满足 → 幕 2 → 幕 3a 揭示 → R1–R5 各一条可达。
- **验收**：`probe-scenarioLate` 的 FV-1/FV-2 复现脚本转绿；终章真实引擎可走到任一 R1–R5；
  `test:fhv:scenarios` 与 `test:fast` 无新增失败。

## P1：高严重度规则错误、叙事与证据（16 项）

### P1-1 终章尾声同时显示 3 个互斥结局，且叙事恒用尾声 1

- **现象/证据**：`flow.js:444-465` 的 `localizeFhvNodes` 在加载时把 `epilogue.epilogue1/2/3`
  全部拼进节点正文（实测 958 字同时含三个结局）；`epilogue.js:166-167` 固定
  `appendStory(campaignStoryText('epilogue.epilogue1'))`，与 `fhvEpilogueBranch()` 无关；
  `FHV_EPILOGUE_BRANCHES` 无读点。
- **修法**：节点只绑定 `epilogue.body`；三个结局正文按 `fhvEpilogueBranch(records).textKey`
  在运行时选择（尾声效果写 `visit.storyText` 或节点展示时查询分支）；`FHV_EPILOGUE_BRANCHES`
  或接入判定或删除；补三分支回归（展示文本互斥、胜利/失败对应正确）。
- **验收**：`fhv-p8-campaign` 三条结局路线分别断言尾声文本（不再三合一）；`test:fast` 无新增失败。

### P1-2 审计门禁在 HEAD 不可复现（重签 + CI）

- **现象/证据**：`npm run audit:fhv:check` 失败：`audit/fhv-investigators.json` 的 sources 哈希
  与当前 `src/deck/deckbuilding.js`、`web/deck-rules.js` 不一致（HEAD 提交内改动未重签）；
  复算 `status=pending`、`playable=false`、`equivalenceCertified=false`；
  `build-presentation.mjs --check` 另报 `audit/presentation-report.json` 漂移（与并发媒体改动相关）。
- **修法**：审阅后按顺序重签：`node tools/audit-fhv-investigators.mjs --write` →
  `node tools/audit-fhv.mjs --write`（以及 player/scenarios/all-cards/rules/interactions 如受影响）→
  `node tools/audit-fhv.mjs --check`；在合并流程中固定跑 `audit:fhv:check`，避免「签名后源码再改」；
  presentation 账本在媒体同步批次完成后 `build-presentation.mjs --write` 重签。
- **验收**：`node tools/audit-fhv.mjs --check` 逐字节复算通过且 `status=verified`；
  `audit:fhv:allcards`、`audit:fhv:assets`、`audit:fhv:scenarios` 均 `--check` 通过。

### P1-3 关卡验收测试非真实引擎（补真实引擎回归）

- **现象/证据**：12 个 `tests/fhv-scenario-*.test.mjs` 全部使用 `stateFor()` 合成 state + 直接调
  `chapter.behavior.*` 钩子，0 个用例启动真实引擎进入关卡；P8 战役 E2E 用 `debug.endScenario` 跳过关卡内玩法。
- **修法**：把本报告 §9 的探针改造成常驻回归（`tests/fhv-*-engine.test.mjs`）：
  每关至少一条「真实 `createGameState` → `startScenario` → 真实 `legalMoves` 推进 act/agenda/回合 →
  到达 `scenarioResult`」路径；P0 修复项的回归与其合并；保留合成 state 测试作为单元测试。
- **验收**：新增测试在 `test:fast`/`test:fhv:scenarios` 中稳定通过，且能在修复前复现 P0；
  测试清单登记进 `tools/run-fhv-scenario-tests.mjs` 与审计账本。

### P1-4 theLostSister 残余高严重度规则错误

- **10586 重属自然**：`10586.js:24-27` 只在 `api.isDarkLocationHere` 存在时判昼夜，该 API 在场景运行时
  不存在 → 永远走 (Day) 面，已揭示黑暗地点的 (Night) 检定/失败分支整面不可达。
  修法：改用 behavior 已导出的 `isDarkLocation`/`locationIsDark`（或 `resolveScenarioEvent` 传地点 id 由
  behavior 判定），删除不存在的 API 分支；补黑夜地点抽牌回归。披露文本同步修正。
- **10587 荧光增生**：条目只有 flags，没有 encounterResolve/附属建立点；behavior 的
  `suppressedDarkIds`/`luminousGrowthLocations` 永远读不到附件 → 整卡空转。
  修法：实现「附属到最近已揭示黑暗地点」（`api.attach` 或 location.attachments 原语）+ 地点失去 Dark +
  所附地点敌人 +1 攻击/+1 伤害 + 地点 [action] 检定弃卡；或改披露为「未实现」并下架构筑池。
- **10573/10574 印刷行动**：`pickTarget`（`behavior.js:797`）不传 seat 且单候选也走 choose → 每次使用必软锁
  （见 P0-2；修复后仍需补单候选不询问的优化）。
- **10579/10578/10585/10583b/10580/10577/10582 等**：声明了 `onRevealSpawn`/`forcedOn*` 等 flags
  但无读点；`10578` 用不存在的 `api.revealChaosToken`/`api.drawChaosToken` 导致整段强制静默跳过。
  修法：逐条接读点（引擎已有 `locationRule.onTestFail`、`locationRevealed`、`enemyAttackResolved` 等）
  或删除声明并在条目 note/账本里如实披露。
- **10583a/10584a/b 生命双计**：`flipHybrid` 写实例 `enemy.health = enemyHealthFor(...)`，
  引擎 `enemyHealthValue` 又叠加 `enemyStatModifier('health')` → 1 人局鳖类混种 11 血（应 8）。
  实测 `flipHybrid` 后 `enemyHealth` 11 vs 期望 8。
  修法：翻面只改印刷面数据（`health` 用卡表原值），加值只由 `enemyStatModifier` 一处提供；
  补翻面往返血量回归。
- **10570 议程毁灭双计**：`behavior.js:1116-1122` 同时 `state.doom += doom` 与 `next.doom += doom`，
  引擎 `agendaDoom` 两者都计入 → 议程 2a 起始 2×天数毁灭（实测 state.doom=1 且实例 doom=1）。
  修法：只写一处（推荐实例 `next.doom`，因为印刷是「放在议程 2a 上」），补推进后毁灭值回归。
- **验收**：上述每项各带一条真实引擎回归；`probe-depth.mjs` theLostSister 全策略 ok。

### P1-5 writtenInRock 残余规则错误（除 P0-2 外）

- **[[Ally]]/[[Resident]] 判定**：`10503/10512/10519/10520/10521` 等按实例 traits 判定特性，
  而引擎只把 traits 放在 `cardDef` 上（其他章已用 `cardDef` 兜底）→ 相关子句失效。
  修法：统一用 `cardDef(code).traits`（或 behavior 的 `hasTrait` 辅助）判定；补 2 张居民互动回归。
- **敌人-地点 per-investigator 生命**：`10532b–10543b` 的 `+N[per_investigator]` 只有条目声明无读点
  （2 人局实测 10540b 生命 4 而非 6）。修法：接 `enemyStatModifier('health')` 或翻面时按人数写实例。
- **10503「毁灭搬到下一议程」**：条目 flag 名与引擎读点 `agendaRule.doomToNextAgenda` 不匹配。
  修法：改用引擎既有键或补读点。
- **10508 进入费用 / 10522、10548 反应**：声明未接线；逐条接读点或披露。
- **验收**：每项一条真实引擎回归；`probe-depth.mjs` writtenInRock（P0-2 修复后）全策略 ok。

### P1-6 混乱标记「If you succeed」判据用标记修正前的 failedBy

- **现象/证据**：`src/engine/skill-effects.js:111` 把 `test.failedBy = Math.max(0, difficulty - value)`
  在标记修正计入前传给 onDraw 效果；`theSilentHeath/behavior.js:1648`、`theLostSister/behavior.js:1216`
  用 `failedBy` 判定「成功/成功差值」→ hard/expert 的 [cultist]/[tablet] 效果在必败检定上也会成功结算
  （10549 hard、10569 hard）。
- **修法**：引擎给 onDraw 效果提供「结算后成功/差值」的正式契约（如 `onResolved`/`onSuccess` 回调或
  延后结算），内容改用该契约；短期可把「成功」判定改为 `nextValue + delta >= difficulty` 由内容传入
  （需要引擎把 delta 已知信息给 onDraw）。补跨循环回归（现有其他循环是否也用 failedBy）。
- **验收**：新增引擎/内容测试：必败检定下 [cultist] hard 效果不结算；`test:fast` 无新增失败；
  在 `docs/card-model.md` 或引擎注释中固化 onDraw 的「失败差值」语义。

### P1-7 声明即接线：201 键 / 302 处无读点；spawnOverrides 函数/对象错位

- **现象/证据**：`artifacts/fhv-scan/data/dead-declarations.json`（`dead: 201`、`printed drift: 0`）；
  典型：`spawnDirection`（10 处）、`printedCluesPerInvestigator`（10）、`controlBonus`（10）、
  `parleySetAside`（7）、`printedFight/Evade/Health/Damage/Horror/Victory`、`cannotBeMoved`、
  `cannotMakeAttacksOfOpportunity`、`pairedLocationCode`、`preludeOnly`、`nightOnlyKeywords`。
  `theLongestNight/behavior.js:1191` 把 `spawnOverrides` 导出为函数，而 `enemies.js:418` 按
  `spawnOverrides?.[code]` 读取 → 该钩子从未被调用。
- **修法**：按类处理：① 数据重复（printed*/spawnDirection 等）删除声明或改为从单一事实源导出；
  ② 未实现规则键：接引擎读点或删除；③ 契约错位：`spawnOverrides` 改对象（或引擎按函数调用）；
  ④ 新增 lint：条目中非 `KNOWN_ENTRY_KEYS` 的声明必须能在 `src/engine`/`content` 找到读点。
- **验收**：`dead-declarations.mjs` 的 `dead` 降到 0 或全部登记为「仅展示数据」白名单；
  lint 入 `audit:entries`；`test:fast` 无新增失败。

### P1-8 英文界面下条目动态文案为中文（i18n）

- **现象/证据**：187 个条目 / 1030 处 `label`/`prompt`/`api.info` 硬编码中文（如 `10021` 攻击 label、
  `10005` 翻面提示）；`web/locales/en.*` 不覆盖条目动态文案。
- **修法**：引入条目文案 en 回退机制（例如 `labelEn`/`i18n` key + 缺省中文），至少覆盖动作/选择/提示
  三类高频交互；或按既有 TIC/TCU 统一方案处理（跨循环一次性解决）。
- **验收**：英文界面下主要交互不出现中文（浏览器双视口抽检）；`test:fast` 无新增失败。

### P1-9 `theSilentHeath`/`theLostSister` 其他高/中规则错误汇总

- 10558/10559/10560（盐厅/洞穴地点自身 action/reaction）、10575（谈判看不到牌/不能重排）、
  10557（起始地点被直接置 revealed，揭示检定不可达）、10552（insectsLosePatrol 无读点）、
  10549 低优先（You may 变强制、昆虫阶段移动语义）、10581（熄暗提前一个神话阶段）、
  10564/10565 受 P0-5 影响（修复 P0-5 后自动恢复）。
- **修法**：逐条接引擎既有原语（`locationRule.action`/`onTestFail`/`onReveal`/`enemyRule.patrolTarget`）
  或如实披露；每条附真实引擎回归。
- **验收**：`findings/campaignHeathSister.json` 中 high 项清零（或全部降级为已披露近似），
  medium 项在账本逐条登记。

### P1-10 欢迎序曲：开场选择应加入的 [tablet]/[elder_thing] 混乱标记从未进袋

- **现象/证据**：`welcomeToHemlockVale/behavior.js:785-795` 的 `applyIntroChaosToken` 在
  `preScenarioSetup` 里写 `state.chaosBag`；但 `src/engine/setup.js:830` 的 preScenarioSetup 早于
  `:836` 的 `setupChaosBag`，后者用 `campaign.chaosBag` 整体覆盖 `src/engine/chaos-bag.js:21`，
  标记被丢弃；战役层也没有对应 `chaosBagTransitions`（`flow.js:497-499` 只有 welcome 结局的 autoFail）。
  Lead 真实引擎复现：进入 welcome 序曲后 chosen branch=survey，`chaosBag` 与 `campaign.chaosBag`
  都不含 `tablet`。
- **修法**：把入场标记迁移到 `afterChaosBagSetup` 钩子（preludeTheFinalEvening 已是正确写法），
  或在战役层 `chaosBagTransitions` 增加 `welcomeToHemlockVale/<introBranch>` 映射并让引擎读；
  补真实引擎回归（两个分支各断言袋内出现对应标记）。
- **验收**：两条开场分支实测 chaosBag/campaignBag 含对应标记；`test:fast` 无新增失败。

### P1-11 最终之夜：8 条地点法典缺少玩家入口（无 actions/performAction 钩子）

- **现象/证据**：`preludeTheFinalEvening/behavior.js:1617-1689` 的 behavior 对象没有
  `actions/performAction/fastActions`；共享地点条目 `10705a.js:16-30`、`10691b.js:8-22` 是
  `abilities: []`，只声明 `actionCodex` 而无读点。真实引擎探针在 8 处地点 `legalMoves` 中
  找不到任何 `scenarioAction`，但直接调用 `behavior.codexEntry` 返回 true →
  法典 9/10/11/12/13/14/15/16 正文存在却玩家不可达。
- **修法**：在 behavior 增加 `actions` 定义（地点 `actionCodex` → 法典动作）并接
  `performAction` 分派；或给地点条目接 `locationRule.action` 原语（引擎已有读点）；
  补真实引擎回归（8 个地点各自 legalMoves 出现动作并可结算）。
- **验收**：探针显示 8 个地点均有可提交的场景动作；`test:fast` 无新增失败。

### P1-12 汉克 10016a/10016b：无 per-window limit 的反应被窗口循环重复结算 12 次

- **现象/证据**：`src/cards/entries/10016a.js:68`、`10016b.js:67` 的 `reaction` 没有 `limit`，
  而 `src/engine/ability-exec.js:363` 的反应窗口循环（`while (guard++ < 12)`）会在同一窗口
  重复提供并结算同一反应。真实引擎复现：一次 `horrorPlaced` 窗口连续 12 次询问并全部结算，
  实际抽 12 张牌（deck 33→21）；10016b 一次 2 点伤害窗口资源 5→29（+24）。
- **修法**：两张卡的反应补 `limit: { scope: 'perWindow', owner: 'instance' }`；
  同时在引擎层考虑对「同一窗口内同一描述子」默认只允许一次（或登记为原语决策），
  避免其他循环同类卡复用同一漏洞；补真实引擎回归（一次触发只结算一次）。
- **验收**：同一窗口只结算一次（抽 1 张 / 得 2 资源）；`test:fast` 无新增失败；同类扫描
  （`artifacts/fhv-scan/data/reaction-no-limit.json` 31 条）逐条判定是否需要 limit。

### P1-13 第二段纯叙事夜（preludeTheSecondEvening）正文与 Simeon 分支缺失

- **现象/证据**：指南该节没有 `body` 键（`campaignLayer.json` 的 text.empty 唯一一条），
  `flow.js:294-301` 仍读 `.body`；`interludes.js:234-236` 回落到首夜正文
  （真实引擎第二夜条目 501 字全是首夜宴会正文）。上游
  `Campaign/Campaigns/TheFeastOfHemlockVale.hs:218-241` 的 Simeon 存亡分支
  （LeahIsSearchingForSimeon + 划掉 Simeon）完全未实现 → dawn3 的 `simeonCrossedOut` 分支与
  尾声 Atwoods 条件走错。
- **修法**：从英文/中文源补齐第二夜正文叶子并接入 flow；实现 Simeon 存亡记录与划掉分支
  （读点在 interludes.js 的 evening 解析 + dawn3 的条件分支）；补真实引擎回归（两条 Simeon 分支）。
- **验收**：第二夜显示自身正文（非首夜回落）；Simeon 分支记录与 dawn3/尾声条件一致；`test:fast` 无新增失败。

### P1-14 终章结局映射与战役层收尾错误（campaignLayer 分片）

- **resolution2 被改判**：`fateOfTheVale/behavior.js:1654/1687` 的 `resolution2` 同时写
  `theInvestigatorsSacrificedThemselvesForTheVale` 与自造键 `theInvestigatorsWereDevoured`；
  `epilogue.js:123` 先判 devoured → 印刷结局 2（调查员献身）永远变成 devoured/defeat/epilogue3。
  修法：`killed` 分支按结局语义只写对应记录（献身≠被吞噬），删除自造键或补 Key.hs 登记。
- **campaign.result 与 campaignOutcome 相反**：`src/engine/hub.js:319-333` 只看
  `campaign.failed/flowOutcome/noSurvivors`，而尾声节点固定 `outcome='campaignComplete'`
  （`epilogue.js:106-109`）→ 山谷焚毁（campaignOutcome=defeat）仍报 `campaign.result=victory`；
  `web/hub.js:1120` 直接显示 `cp.result`。修法：让 hub 结算读 `records.campaignOutcome`，
  或结局节点按 branch.outcome 写 flowOutcome；补 victory/defeat 双分支回归。
- **疲劳混乱袋替换未实现**：`flow.js:510` 的 `fatigueAfterLongestNight` 声明 `replaces/lowerBy`，
  但 `campaign-flow.js:226` 明确跳过 `replaces/lowerBy` → 永不执行；真正替换只在 dawnOfTheFinalDay
  的 `fatiguePending` 消费一侧，两处时序只挂一处。修法：实现 replaces/lowerBy 的引擎读点（或按
  Helpers.hs 的 replaceFatigueChaosTokens 由战役层一次性完成），补四难度回归。
- **序曲经验可提前花 / codex 经验被压平**：序曲奖励经验在下一场结束前即可花费（interludes.js:87-106
  与升级窗判据），第二夜只有 codex9 应给经验、Π 只应发 Worry Rock、Ω 的 Helen 10703 永远发不出；
  修法：按上游逐条恢复法典奖励与花费窗口。补记录/经验回归。
- **records 交叉**：`crossedOutResidents` 被 fateOfTheVale 写成卡号而战役层读居民 id →
  survivingResidents 把献身的 Dr. Marquez 也算幸存；`finishedTheirMeal` 写成全队布尔（多人局
  无法按调查员分别判 The Hemlock Curse / Gnawing Hunger）；第二夜 resolution1-6 文本被无条件全部拼接。
  修法：统一写入形状与读取端，补多人回归与逐分支文本回归。
- **验收**：以上每项各一条真实引擎回归；`campaignLayer.json` 的 high 项清零；
  `test:fat:fast` 与 `test:fhv:scenarios` 无新增失败。

### P1-15 最长一夜：印刷撤退（[action]: Resign.）不可达

- **现象/证据**：真实引擎中 `legalMoves` 从无 `resign`（逐一 moveTo 全部 10 个地点验证）：
  地点无 `resign` 标记、`scenario.resignAnywhere` 未设，`src/engine/turn-flow.js:454-459` 的
  卡文兜底正则匹配不上「[action]: Resign.」/「[action]：撤退。」→ 印刷 (→R3) 撤退路径与
  `allResigned` 钩子全不可达。
- **修法**：给该关地点/规则声明 `resign`（或 `scenario.resignAnywhere = true`），并让
  `allResigned` 结算接 P0-4 的 noResolution 修复；补真实引擎回归（撤退 → R3）。
- **验收**：真实引擎可 `resign` 并进入 R3；`test:fast` 无新增失败。

### P1-16 扭曲空洞 / 终章：幕索引越界（acts 队列越界同一模式）

- **现象/证据**：`theTwistedHollow` 幕 2 背面后 `acts=['10609']` 但 `actIndex=1`（10609 只作为
  议程留存）；终章 `advanceToAct3` 的 `actIndex=2 → ++ → 3` 越界（见 P0-7）。两处都是
  「手写 actIndex/acts 队列 + 引擎无条件 ++」的同一模式。
- **修法**：统一改用引擎 `actIndexAfterAdvance` 钩子（`act-agenda.js:67` 已有读点）或让内容层
  返回期望索引；为 `state.acts/actIndex` 增加越界保护与测试。
- **验收**：两关幕队列推进不再越界；`test:fast` 无新增失败。

## P2：近似披露、声明接线、i18n 与流程（7 项）

### P2-1 已披露近似卡的披露文本校正

- **范围**：`audit/fhv-player-acceptance.json` 的 `simplification.disclosures` 与各战役卡 note 共 171 条
  `simplified` 记录；分片 triage 显示 `disclosed-high` 16 条、`disclosed` 57 条。
- **问题**：部分披露的「根因」写错：10043 声称 `locationRevealed` 窗口收不到描述子（已由
  `artifacts/fhv-scan/probes/p10b-locreveal.mjs` 证伪，窗口可达 → 属可实现漏实现）；
  10586 披露「按调查员所在地点是否黑暗判定」，实际永远走白日面；10587 披露「只读持续效果」，
  但没有任何附属建立点，持续效果永不成立；10563 披露未提越界判据。
- **修法**：逐条校正 note/披露文本（原因、影响、原语请求编号），并把「已披露但影响核心玩法」的
  卡（10050/10054/10109/10111/10117/10118 等）按分片结论升级原语或明确下架决策。
- **验收**：`audit:fhv:player` / `audit:fhv:allcards` 重签后披露文本与实现一致；
  随机抽 20 张近似卡逐条对照卡文通过复核。

### P2-2 引擎「描述子 cost.exhaust」不派发 `assetExhausted` 窗口（同一规则两套口径）

- **现象/证据**：`src/engine/ability-rules.js:113` 只写 `source.exhausted = true`；
  `ability-exec.js:135-139`（旧式能力）与 `api-misc.js:536`（api.exhaust）才派发
  `reactionWindow('assetExhausted')`。因此 10054「所附属支援横置后」对走描述子横置费用的大多数支援失效
  （实测 10040 横置后无精准调配提示；宿主池 36 描述子/0 旧式）。
- **修法**：在 `ability-rules.js#payAbilityCost` 的 `cost.exhaust` 分支补同一个
  `reactionWindow('assetExhausted', {...})` 派发（与 ability-exec 同形状），收敛「同一件事两套结算」；
  10054 条目无需改逻辑（只更新披露）；补引擎回归（描述子横置后触发 window）。
- **验收**：10054 在 10040/10020 等宿主上可触发；跨循环同类卡回归；`test:fast` 无新增失败；
  replay 指纹变化需重新基线。

### P2-3 注册闭包/无 seat/死声明的机械门禁

- 把 P0-2/P0-3/P1-7 的静态检查固化为脚本并接入 `cards:check`/`cards:encounter-check` 或
  FHV 专项审计：① 每关遭遇牌库/放一边/章节字面量卡号注册闭包；② `content/**` 的 `api.choose`
  必须带 seat（或走引擎默认）；③ 条目声明键必须有读点；④ 敌人-地点 face 字段必须在引擎白名单。
- **验收**：门禁在修复前对 HEAD 报错、修复后通过；登记进 `tools/audit-fhv.mjs` 的 gate 列表。

### P2-4 文档与账本口径修正

- 更新 `docs/campaign/theFeastOfHemlockVale/README.md`：P7/P8 的「12 章逐章 verified / 完整合法路线」
  需注明「关卡内玩法由合成 state 测试覆盖、真实引擎只到章间转场」；补齐本报告与 fix-plan 的链接；
  修正 `primitives.md`/`campaign.md` 中与实测不一致的表述（例如「441 张卡文直达」实为按 pattern
  → 规则条目链接，不是逐卡正文页）。
- **验收**：`npm run docs:check` 通过；README 事实与 `audit/fhv-migration.json` 复算状态一致。

### P2-5 事件卡「回合结束/延迟返回手牌」的统一口径

- **现象/证据**：player3 分片：10100/10101/10102 的「回合结束返回手牌」被实现为「结算后立即回手」，
  同回合可二次使用；10123 模式 1 缺「地点附属→手牌」原语；10126 重试不重放原效果。
- **修法**：统一「延迟返回手牌」原语（`delayedReturnToHand`），三张卡共用；10123 补地点附属回手读点；
  10126 重试改为重放已解析效果（或明确披露）。逐卡登记 note。
- **验收**：三张卡在同回合不可二次使用；回归 + 披露更新。

### P2-6 战役层遗留（待 campaignLayer 分片结论并入）

- 覆盖：四档混乱袋、整备保留、升级窗、记录 schema、尾声分支、观察投影隐私等；
  若分片发现新问题，按 P1/P2 追加到本文件并更新 full-scan §7。

### P2-7 逐卡/逐场景分片账本归档

- 把 `artifacts/fhv-scan/findings/*.json`（10 个分片）与 triage 结果压缩成可签入审计账本
  （或作为报告附录），并更新 `audit/fhv-migration.json` 的 `confirmations` 口径：
  「verified」不得再覆盖 P0/P1 未修项；修复完成后才可重签 `equivalenceCertified: true`。
- **验收**：修复后重跑全部 FHV 审计链（`scan:fhv:check`、`audit:fhv:*`、`verify:fhv:node`、
  `verify:fhv:regression`、`cards:check`、`cards:encounter-check`、`docs:check`、replay compare）全绿。

## 建议执行顺序与验收门禁

1. P0-1/P0-2/P0-3/P0-4/P0-5/P0-6 逐项修 + 真实引擎回归（先修引擎判据类：P0-1/P0-6/P0-2 兜底）。
2. P1-1～P1-9（叙事/证据/规则错误），其中 P1-4/P1-5 依赖 P0-2 先修。
3. P2-1～P2-7（披露/i18n/门禁/文档），最后重签全部账本。
4. 每次修卡后：`npm run cards:check` → `npm run cards:encounter-check` → `node tools/replay-fixtures.mjs --compare`
   → `npm run test:fast`；账本用对应 `--write` 重签；最终 `npm run audit:fhv:check`。
