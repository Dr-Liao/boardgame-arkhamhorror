# 战役卡审计 A · 亡命冰原 I–III + 冰原共享组（08501–08548）

> 审计员：campaign-auditor-a（task-4）｜日期：2026-11-08｜只读 mod，只写 `games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/campaign/a/**`
> 权威对照：`src/cards/cards-data.js` 卡面（text/textZh/backText）→ 单卡条目 `src/cards/encounter-entries/edgeOfTheEarth/**` → 三章 `content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart{1,2,3}/{definition,behavior,chaos}.js` → 引擎读点；并对照参考实现 Haskell `Scenario/Scenarios/EdgeOfTheEarth/IceAndDeathPart*.hs` 与 `{Agenda,Act,Enemy,Treachery,Story,Location}/Cards/EdgeOfTheEarth/IceAndDeath/*.hs`。

## 一、结论摘要

- 48 卡全部有 verdict + clauses + `file:line` 证据：
  - **match 5**（08537/08538/08540/08541/08543，单卡谈判实现正确、引擎 parley 管线可达）
  - **approximation 13**（08516/08517、08527–08534 剧情卡、08535/08539/08542 谈判近似）
  - **gap 30**（08501–08515 共享组、08518–08526 Part I/II 议程/幕、08536、08544–08548 Part III 全部）
  - blocked 0（源码均可读且已实测；但三章整体在真实引擎路径处于 blocked-in-engine，见第三节）
- 去重后 **high 根因 41 项**、medium 36 项（按卡重复计数：high 61 / medium 67 / low 9）。
- **先前账本全部标 `verified/simplified` 不能作为语义正确性依据**：至少 7 个 high 级 runtime 缺陷在章节测试里完全不可见，因为测试直接用 api stub 调 `behavior.*` 函数、绕开引擎钩子名与钩子接线（见第五节）。

### Top 5 结构性问题（真实引擎路径实测）

1. **行为钩子名不符**：引擎只调用 `behavior.actions` / `behavior.performAction`（`src/engine/moves.js:222`、`src/engine/dispatch.js:633`），三章 behavior 导出的是 `scenarioActions` / `performScenarioAction`（`iceAndDeathPart1/behavior.js:397-398`、`Part2/behavior.js:396-397`、`Part3/behavior.js:159-160`）。→ 营地撤退、Part II 翻底牌行动在 `legalMoves` 中完全不存在（probe：Part1/2/3 legalActions 均无 `scenarioAction`）。直接后果：08521/08526/08546 的目标无法达成，08527–08543 全部不可达。
2. **议程/幕背面钩子缺失或空实现**：`Part1/behavior.js:399 agendaReveal() {}`（空函数，引擎 `src/engine/phases.js:268-283` 调用后什么都不做）；Part2/Part3 连 `agendaReveal` 都没有 → 引擎 `runAgendaReveal` 抛 `密谋规则尚未迁移：08523/08544`；三章都没有 `actReveal` → `advanceAct` 抛 `场景规则尚未迁移：08521/08526/08546`（probe 全部实测）。`resolveAgendaBack`/`agendaAdvance` 无任何引擎读点。
3. **08501 混乱标记在真实检定中全部按 0 结算**：三章导出 `chaosTokenValue`（Part1 `behavior.js:368-370,411`、Part2 `behavior.js:349,402`、Part3 `behavior.js:145,162`），但引擎只读 `behavior.resolveChaosToken`（`src/engine/treachery-tokens.js:348-364`、`src/engine/tests.js:922,1122`；对照正确写法 `toTheForbiddenPeaks/behavior.js:271`）。probe：Part1 `resolveSpecialToken(skull|cultist|tablet)` 均 `delta:0`。另外 Part III 无 `afterTest`（`Part3/behavior.js:149-164`）→ [cultist]/[tablet] 失败后果整段缺失。
4. **13 张地点（08502–08514）印刷 shroud 未进入任何一章地点数据**：`definition.js` 的 `placeLocation` 只带 shelter/clues，`content/campaigns/edgeOfTheEarth/card-data.js:23-41` 的 `location()` 不复制 shroud；引擎 `src/engine/actions.js:593` 计算 `loc.shroud + …` 得 NaN。probe 实测 UI 显示 `调查「冰冻海岸」（智识 vs 帷幕 NaN）` 且调查必失败（`智识 1 vs NaN`）。Part III 另缺 shelter/clues（见第三节）。
5. **Part I 检查点记录口径错误 + 08515 双发**：Part1 只写自定义 `records.camp`/`iceAndDeathPart1CampShelter`（`Part1/behavior.js:344,353,361`），检查点却读 `Camp_*` 记录/`eoteShelterValue`（`checkpoints.js:197-205`、`records.js:186-214`）→ probe 实测检查点 `eoteShelterValue=0`、`eoteMissingCount=9`（本应 shelter=2、失踪数更少）；08515 击败时章节钩子 `behavior.enemyDefeated`（`Part1/behavior.js:301-313`）与单卡 forced ability（`_shared/ice_and_death/08515.js:6-23`）同时结算 → probe 实测忒咳哩-哩 16→14、玩家牌库 +2（应为 1 张）。

## 二、48 卡 verdict 一览

| 卡号 | 名称 | verdict | 主要问题（详见 findings.json） |
| --- | --- | --- | --- |
| 08501 | 亡命冰原 | gap | 符号数值 hook 名错误→全 0；Part III 缺失败后果 |
| 08502 | 坠机点 | gap | shroud 缺失；搜寻行动已接线（shared 测试真实 runtime 覆盖） |
| 08503 | 冰冻海岸 | gap | shroud 缺失；「附属时 +2 隐藏」未实现 |
| 08504 | 危险道路 | gap | shroud 缺失；frost 强制已接线 |
| 08505 | 不稳定冰盖 | gap | shroud 缺失；取消危险诡计为近似（只限遭遇抽牌） |
| 08506 | 辽阔雪地 | gap | shroud 缺失；入场费不收取；reaction 已实现 |
| 08507 | 冰封荒原 | gap | shroud 缺失；入场费不收取；firstFrost 近似 |
| 08508 | 岩石峭壁 | gap | shroud 缺失；入场费不收取；附属涌动缺失（已披露） |
| 08509 | 雪冢 | gap | shroud 缺失；入场费不收取；reaction 已实现（perCampaign 正确） |
| 08510–08514 | 破冰船/严寒洞穴/屏障营地/莱克遗址/水晶洞穴 | gap | shroud 缺失；入场费不收取；地点行动已接线 |
| 08515 | 疾行谬物 | gap | 击败强制**双发**（判定 high）；攻击近似已披露 |
| 08516 | 无限恐惧症 | approximation | 选项前置过滤缺失；Part III 难度 0 |
| 08517 | 零能见度 | approximation | 离开地点 +1 行动未实现（已披露）；回合结束检定已接线 |
| 08518/08519/08520 | 冷遇/深入白雪/没时间了 | gap | 正面强制已接线；背面在引擎全部不结算 |
| 08521 | 寻找扎营点 | gap | 撤退行动不可用；幕背面缺失；营地记录键错误 |
| 08522 | 星之恐怖 | gap | +3/人生效（probe 9 血）、封锁线索生效；「不能撤退」挂在未接线函数上 |
| 08523/08524 | 狂风呼啸/寒冷夜晚 | gap | 背面实现存在但引擎不调用且推进抛错；选择/私密语义近似 |
| 08525 | 疯狂与死亡 | gap | 背面永不结算 |
| 08526 | 失踪队员 | gap | 抽底牌/撤退行动不可用；幕背面缺失；9 张底牌不可翻出 |
| 08527–08534 | 8 张剧情卡 | approximation | 效果实现正确（自动取目标处为近似），但真实路径不可达 |
| 08535 | 威廉·戴尔教授 | approximation | 弃哪两张手牌不可选 |
| 08536 | 丹佛斯 | gap | 谈判抽牌抽的是玩家牌库而不是忒咳哩-哩牌库 |
| 08537/08538/08540/08541/08543 | 队员谈判 | match | 实现与阈值/技能/反击一致；阈值与胜利区写成 scenarioFlag/buryEnemyInVictory |
| 08539/08542 | 克莱普尔/埃尔斯沃思 | approximation | 卡面「A 或 B 技能」只实现一个 |
| 08544 | 邪灵现身 | gap | agendaWouldAdvance 签名/语义反了→议程永不推进；翻牌生成未实现；背面缺失 |
| 08545 | 冰雪深处 | gap | 背面缺失；推进即抛错 |
| 08546 | 陷入围攻！ | gap | 胜利0/营地行动/双目标全部不可达；结局键体系错 |
| 08547 | 渗出梦魇 | gap | 移动视为与营地相连缺失；击败清底牌缺失；猎手仅近似 |
| 08548 | 千变幻景 | gap | 整卡显现效果未实现 |

## 三、D3 章节可跑通性（真实引擎路径，probe 证据）

> Probe：`_probe2.mjs`（钩子键/legalMoves/advanceAgenda/advanceAct）、`_probe3.mjs`（入场费）、`_probe5.mjs`（08515/08522）、`_probe7.mjs`（营地记录/检查点）、`_probe8.mjs`（08501 标记）、`_probe9.mjs`（调查难度 NaN）。全部在生产组合根 `content/registered.js` + `tests/eote-p8-fixture.mjs` 上驱动。

| 章节 | 正常 setup | 议程推进 | 幕推进 | 行动/撤退 | 结局 |
| --- | --- | --- | --- | --- | --- |
| iceAndDeathPart1 | ✅ 4 地点/放一边 20/遭 23/忒 16 | ❌ 静默无效果（agendaReveal 空） | ❌ 抛「场景规则尚未迁移：08521」 | ❌ legalMoves 无 scenarioAction | 检查点 shelter=0 / 9 名伙伴失踪 |
| iceAndDeathPart2 | ✅ 13 地点/32 遭/9 张底牌 | ❌ 抛「密谋规则尚未迁移：08523」 | ❌ 抛「场景规则尚未迁移：08526」 | ❌ 无抽取底牌/撤退 | 底牌/剧情/队员全不可达 |
| iceAndDeathPart3 | ⚠️ 22 遭（份数未展开、缺 ancientEvils、混入 7 张 tekelili）；地点 0 线索/无 shelter | ❌ agendaWouldAdvance 语义反→永不推进 | ❌ 抛「场景规则尚未迁移：08546」 | ❌ 无营地 4 线索撤退行动 | 无法结算 |

章节结构性问题（编号与 findings.json `scenarios[].issues` 对应）：

1. （三章共有，high）hooks 名不符 → actions/performAction = `scenarioActions`/`performScenarioAction`；证据：`moves.js:222`、`dispatch.js:633`。
2. （三章共有，high）agendaReveal/actReveal 缺失：`phases.js:268-283`、`reveal.js:151-176`；Part1 `behavior.js:399` 空函数；Part2/3 未导出。
3. （Part1，high）13 地点 shroud 缺失 → 调查永远失败（probe UI「帷幕 NaN」）；未探索地点入场费永收不到（`movement.js:235-249` 先 reveal 再调 `locationEntered`，且忽略返回值；`Part1/behavior.js:135-166` 因此是死代码）。
4. （Part1，high）营地记录口径：`records.camp` vs `Camp_*` → 检查点 `eoteShelterValue=0`、`eoteMissingCount=9`。
5. （Part1，medium）议程 III 背面只处理 activeInvestigators（漏已退场者，参考要求包括）；目标地点自动选而非选择（`Part1/behavior.js:205-218`）。
6. （Part2，high）无 agendaReveal → 议程 I 推进即抛错；08523/08524 底牌查看、08525 全员击败永不发生。
7. （Part2，high）08526 的 actions 未接线 → 9 张底牌不可翻出，剧情卡（08527–08534）与被附身队员（08535–08543）整组不可达；幕目标不可达。
8. （Part2，medium）setup 未按参考洗混 9 张底牌、未追加难度 frost、未按当前庇护值设开局资源（参考 `IceAndDeathPart2.hs:112-113,241-274`）。
9. （Part3，high）`agendaWouldAdvance(state, agenda)` 与引擎 `(state, runtime)` 签名不符、且 true/false 语义相反（`Part3/behavior.js:74-88` vs `act-agenda.js:326-329`）→ probe doom=10 后 agendaIndex 仍 0。
10. （Part3，high）无 `checkObjectives`、无 `actReveal`、`ACT_EXTRA.objective={type:'noEidolonEnemies'}` 引擎不识（`Part3/behavior.js:149-164`、`Part3/definition.js:108-110`、`act-agenda.js:183-190`、`reveal.js:151-176`）→ 幕永远不推进。
11. （Part3，high）地点数据缺 shelter/clues（`Part3/definition.js:81-86`、`Part3/behavior.js:39`）→ [skull]=0、08516 难度 0、结局 `shelterValue=0`、营地 4 线索不可支付。参考 `IceAndDeathPart3.hs:114-166` 只清营地线索、按记录揭示已探索地点。
12. （Part3，high）08544/08545/08546/08547/08548 五张卡规则大段缺失（详见各卡 issues）。
13. （Part3，medium）渗出梦魇生成地点未按参考「营地→候选地点」映射（`IceAndDeathPart3.hs:168-188`），幻灵池按唯一 code 而非印刷份数（`Part3/behavior.js:48-60`）。
14. （Part3，medium）营地只认 4 个候选（`Part3/definition.js:27`），Part I/II 记录可在其余 9 个营地 → 回退 crashSite。
15. （Part3，medium）遭遇牌库份数未展开、缺 `ancientEvils`、7 张 tekelili 弱点卡混入遭遇牌库（`Part3/definition.js:116-136`；参考 `IceAndDeathPart3.hs:129-136`）。
16. （Part3，medium）无 `afterTest`（08501 失败后果）、setup 未追加难度 frost（参考 `IceAndDeathPart3.hs:77`）。

## 四、D4 声明读点 triage（flags-readpoints：本分片 39 条 unread）

| 声明 | 卡 | 判定 | 依据 |
| --- | --- | --- | --- |
| flags.shelterToken / tekeliliOnFail | 08501 | 真未接线，但语义已在章节 chaos.js/behavior → **low/medium 冗余** | `_shared/ice_and_death/08501.js:10-17` |
| flags.campCandidate ×13 | 08502–08514 | 真未接线；营地选择实际在 behavior/records 表 → **low** | `records.js:186-203`；`Part1/behavior.js:415-417` |
| flags.entryGroupCluesPerInvestigator ×9 | 08506–08514 | 真未接线，且对应规则在引擎路径缺失 → **high** | `Part1/behavior.js:128-166` 死代码 |
| flags.firstFrostModifier | 08507 | 声明未接线，但条目 abilities 用 treat 原语近似实现 → **medium** | `08507.js:11-27` |
| flags/locationRule.shroudWhenAttached | 08503 | 真未接线 → **high（规则缺失）** | `08503.js:7-11`；`actions.js:587-588` 只认 `locationRule.shroudModifier` |
| flags.surgeOnAttachedTreachery | 08508 | 真未接线 → **medium（已披露 primitive-request）** | `08508.js:7-10` |
| flags.moveSurchargeFromTreacheryLocation | 08517 | 真未接线 → **medium（已披露）** | `08517.js:10,29` |
| 08544/45/47/48 的 agendaRule/enemyRule/flags/treacheryRule | 上述 4 卡 | 全部真未接线；实际逻辑只部分在 behavior（08544 语义反、08545/48 无逻辑）→ **high** | `iceAndDeathPart3/08544.js:12-19`、`08545.js:12-14`、`08547.js:12-14`、`08548.js:12-14` |

**扫描漏报（已人工补查）**：`08518–08526` 的 `agendaRule/actRule`、`08535–08543` 的 `enemyScript.*`、`08522` 的 `enemyScript.*` 在引擎/内容中没有对应读点，但 flags-readpoints 未列 unread（同名字符串出现在其它战役源码，按 key 名匹配所致）。这些属「声明未接线 → medium」（实际实现分散在 abilities/behavior 的另一套数据里）。
另：`flags.shelter`（08504–08514）虽被扫描标为"有读点"，实际是 `shelter` 单词在 eote-shelter 等文件出现造成的假阳性；条目上的 flags.shelter 从未被读取，章节用的是 definition 里的独立地点表（三份，Part3 还漏了）→ D5 数据漂移。

## 五、测试复核（已按要求 in-process 运行）

```
cd G:\boardgame-hall-ai\games\arkhamhorror
node tests/eote-scenario-iceAndDeathPart1.test.mjs   → 13 pass / 0 fail
node tests/eote-scenario-iceAndDeathPart2.test.mjs   → 13 pass / 0 fail
node tests/eote-scenario-iceAndDeathPart3.test.mjs   →  6 pass / 0 fail
node tests/eote-scenario-shared.test.mjs             → 19 pass / 0 fail
```
（任务给出的多文件单命令在 Node 22 下只会执行第一个文件，故逐文件运行。）

**测试口径问题（结论性）**：章节测试全部用 api stub 直接调用 `behavior.*` 函数，从不经过引擎的钩子解析/legalMoves/advanceAgenda/advanceAct：
- Part1：`tests/eote-scenario-iceAndDeathPart1.test.mjs:213-230`（直接调 locationEntered 测入场费）、`:235-249`（直接调 resolveAgendaBack）、`:251-265`（直接调 scenarioActions/performScenarioAction）。
- Part2：`tests/eote-scenario-iceAndDeathPart2.test.mjs:242-256`（直接调 agendaAdvance）、`:258-286`（直接调 scenarioActions/performScenarioAction）。
- Part3：`tests/eote-scenario-iceAndDeathPart3.test.mjs:67-82`（手动传 agenda 对象调 agendaWouldAdvance，掩盖引擎实际传 runtime 的错误）、`:84-104`（手动调用 entry08546.locationRule.actions 与 behavior.performScenarioAction，两者在引擎都不被调用）。
- shared 测试用的是真实 runtime（`runRuntime/callAbility/callEncounter`），是本分片唯一覆盖引擎路径的测试（08502/08516 等）；但未覆盖 08501/08515/08517。

## 六、D5 复用

见 findings.json `duplication.items`：三份地点表/连接表（Part2 与 Part1 逐字重复、Part3 复制时丢列已造成 shelter/clues 漂移）→ 应上收 `content/campaigns/edgeOfTheEarth/shared.js` 单一数据源；三份 chaos.js 近逐字重复且 Part3 偏离 eote-shelter 原语；Part1/Part2 afterTest 重复；Part1 behavior PUBLIC_LINKS 与 definition PRINTED_LINKS 同源两份；08535–08543 九张谈判卡近克隆（duplication.clonePairs jaccard 0.81–0.89，各含 3 个死分支）→ 应提取共享 negotiation descriptor builder。

## 七、既有账本复核

- 48 卡在 `audit/eote-all-card-acceptance.json` 等账本均为 verified/simplified，但本轮 high 缺陷（钩子名、议程背面、08501 标记值、地点 shroud、Part III 数据、08515 双发）均不在任何测试断言内 → **prior `verified` 只证明"文件/函数存在"，不代表语义正确**。
- known-deviations 的 5 条 primitive-request 与 2 条 simplified 均"仍存在且已披露"；但 08544/08546 被标 simplified 的理由（pending-primitive）低估了实际缺陷：这两张的根因是**接线错误（hook 名/签名/语义）**，不是原语缺失，不应以 pending-primitive 解释为"近似已披露"。

## 八、复现与证据文件

- 主要 probe（均在 `games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/campaign/a/` 下，node 直接运行）：`_probe2.mjs`、`_probe3.mjs`、`_probe5.mjs`、`_probe7.mjs`、`_probe8.mjs`、`_probe9.mjs`。
- 机械线索抽取：`_extract.mjs` → `_screen_extract.txt`；条目行号：`_linemap.mjs` → `_entry_lines.txt`。
- 生成器：`_generate_findings.mjs`（改动数据后可重跑生成 `findings.json`）。
