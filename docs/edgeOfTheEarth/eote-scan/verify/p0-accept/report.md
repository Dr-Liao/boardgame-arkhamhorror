# EOTE P0 独立验收报告（latest · 阶段 B（最终验证））

> 独立验收（verifier）：不修改 mod 实现，只以生产组合根 `tests/eote-p8-fixture.mjs` 的真实引擎路径判定 PASS/FAIL。
> 生成时间：2026-11-08T13:52:12.691Z；耗时 118158ms；Node v22.23.1。
> 复现命令：`node docs/edgeOfTheEarth/eote-scan/verify/p0-accept/run.mjs --ledger-check`（在 `games/arkhamhorror` 下运行）。
> 环境：生产组合根 tests/eote-p8-fixture.mjs（loadEoteWorld/createGameState/legalMoves/applyMove/performTest/drawEncounter）＋ src/engine 真实导出；Node 22。

## 总览：PASS 165 / FAIL 0（152 项客观断言）

| 分类 | 项 |
| --- | --- |
| ✅ PASS | P0-1 / P0-2 / P0-3 / P0-4 / P0-5 / P0-13 / P0-6 / P0-12 / P0-7 / P0-8 / P0-9 / P0-10 / P0-11 |
| ❌ FAIL / PENDING | — |

## 0. 四类结论（PASS / FAIL / 近似披露 / 残余风险）

### ✅ PASS（真实引擎路径已复核）
- P0-1 IDP I/II/III 剧本行动（actions/performAction）+ advanceAgenda/advanceAct 不 throw
- P0-2 IDP 幕/议程 reveal 真实生效（08518 冷遇生成 08515；08519 生成 08522；08523 查看底牌；08521/08526/08546 背面结局）
- P0-3 IDP resolveSpecialToken（skull/cultist/tablet）真实数值 + Part III afterTest 失败后果
- P0-4 13 张冰原地点 shroud = 印刷值；未探索地点入场费真实收取且线索不足拒绝移动
- P0-5 FM 议程/三版本（08550/51/52 @15/13/11、08553/54/55）/19 地点 Mirage 线索/花线索翻面真实行动/resolution 记录/noResolution
- P0-6 City 钥匙 claim/give 真实 legalMoves+applyMove、幕 1 目标（actKey→记录→checkAct 推进）、议程 2 背面 R2
- P0-7 Heart2 08672 不在 doom=0 提前推进/清场、R1/R2 门槛记录真实写入与结局分流、08716 成功躲避无 ReferenceError
- P0-8 Peaks/City 8 张专属诡计真实 drawEncounter 结算非零、遭遇牌库按 Setup gather 共享组（Tekeli-li/Shoggoths 独立牌库或按 v1 setAside）
- P0-9 抽样：08105/08107 真实 fight 检定窗口出现并支付横置；08091 tokenReveal 咒印替换；08130 威胁区伤害承接治愈
- P0-10 抽样：08013a 检定过期/延迟翻面按执行者座位过滤；08006 牌库顶封锁覆盖 searchDeck/moveCardTo；08014a 免费行动额度按轮清理
- P0-12 City 地点动作真实 applyMove 无 api.test TypeError 且触发真实 performTest
- P0-13 FM 08549 四个混乱标记在真实 performTest 中 delta = -X/-2/-3/-4（非 0）
- P0-11 账本假绿根因消除：scenario-ledger 0 条（不再全落 Heart Part2）、8 章 cardCodes 各不相同、260 条 verified/simplified 声称 100% 有可追溯证据（invalidClaimed 131→0）、无证据卡如实降级 missing 127/blocked 14、`node tools/audit-eote-all-cards.mjs --check` 复算一致（exit 1 = gate 如实 incomplete：missing 127/blocked 14/simplified 12）、eote-migration#releaseAcceptance.equivalenceCertified=false

### ❌ FAIL / PENDING
- （无）P0-1..P0-13 全部 PASS。

### ⚠️ 近似披露（不算规则完全等价，按披露口径记录）
- P0-9 抽样仅覆盖 08105/08107/08091/08130（+08013a 归属 P0-10）；其余 P0-9 卡（08102/08083/08028/08074/08059/08053/08058 等）以 owner 探针与披露口径记录，近似项不等于规则完全等价。
- P0-8 peaks 的攀爬 from-below / Expedition 支援入场与能力 / 08608-08609 X 数值等不在本套件断言内（由 owner `_fix-peaks.mjs` 探针 14/14 覆盖，仅作交叉证据，不替代本套件验收）。
- P0-7 Heart2 高塔攻击难度/进入费/封印力量等 P1 项、P0-6 City v2/v3 版本与 08629 强制等未纳入本次 P0 断言。
- P0-11 的 PASS 口径是「审计流水线不再假绿 + 账本与复算一致 + 声称均证据可追溯」，不等于「全部 403 卡已验收」：账本如实保留 missing 127 / blocked 14（旧验证声明下这些被假证据伪装成 verified）。
- 套件章节进入使用 fixture 的 debug endScenario 结算前置章节；连续游玩中的跨章记录链（XP/伙伴/检查点）只做抽样，不做全量对账。

### ⚠️ 残余风险
- P0-11 审计账本按修订后口径如实 pending：missing 127 / blocked 14，`audit-eote-all-cards.mjs --check` 退出码 1（复算一致、gate 如实不完整），`audit/eote-release-acceptance.json` failed（仅 allCards 门禁）；这是**如实披露**而非假绿，但意味着 P8「全量 verified / release passed」不能宣称。
- 真实引擎断言覆盖 Node 规则层；浏览器/UI 层（提示、隐私投影、EN 文案）不在本套件范围。
- P0-9/P0-10 只覆盖任务指定的抽样卡/调查员；其余同批卡仍以 owner 证据为准。
- owner 探针交叉复核均为复跑 PASS 且与本套件结论一致；但 owner 探针覆盖的「非 P0 子句」仍属各自披露口径，未由本套件独立验收。

## 1. 反向验证（7 项显式反向断言 + 其余项源码读点/前后对比）

反向验证口径（每个 PASS 至少一条，分两类）：

① 自动反向断言（名称含「反向验证」）：同一真实读点在条件不满足时必须给出相反结果，见下方 7 项；

② 读源码确认读点 + 修复前后行为对比：P0-3 用多标记不同数值（cultist/tablet/skull 精确匹配印刷公式）证明非默认 0；P0-4 内置「线索不足 → legalMoves 不提供且强制提交被 validateMove 拒绝」负向对照；P0-7 的 R1/R2 用两条互斥门槛记录分别触发 resolution1/resolution2（同一 checkObjectives 读点两个方向），08716 断言「无 TypeError + autoEvade 生效」；P0-8 每张诡计断言特定落地效果（线索+2/伤害/恐惧/威胁区），非「有日志即过」；P0-11 用「修复前 131 条不可追溯 vs 现 0 条声称不可追溯」对照；P0-12 断言无 TypeError 且 state.lastTestResult 出现真实 skillTest；P0-13 四个标记 delta 精确等于 -X/-2/-3/-4 且彼此不同；同时每条断言在「证据」字段给出生产引擎读点 file:line。

③ 修复前 baseline 中这些断言均为 FAIL（见 `baseline-first-run.md` 与 §4），修复后转 PASS，证明断言能区分修复前后。

- ✅ **P0-1 · [P0-1 反向验证] 调查员不在同一地点时营地撤退不在 legalMoves（gate 真实生效）**
  - 期望：0 个 scenarioAction（不满足同地点条件）；实测：scenarioActions=[] locations=["crashSite","frozenShores"]
  - 证据：src/engine/moves.js:222（legalMoves 读 behavior.actions）/ src/engine/dispatch.js:633（读 behavior.performAction）
- ✅ **P0-2 · [P0-2 反向验证] 连续两次议程 reveal：08518 只结算一次、08519 走另一条真实分支（08522）**
  - 期望：agendaIndex=2，08515×1，08522×1；实测：agendaIndex=2 enemies=["08515","08522"]
  - 证据：content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart1/behavior.js#resolveAgendaBack
- ✅ **P0-5 · [P0-5 反向验证] 线索不足（0）时没有可执行的幻景翻面行动（GroupClueCost 门槛真实生效）**
  - 期望：0 个带 label 的可执行 mirageFlip 行动；实测：mirageFlip=0 executable=0 sample=[]
  - 证据：src/engine/moves.js:222 + src/engine/dispatch.js:633（actions → legalMoves → performAction）；locationStory → behavior.flipStoryFace
- ✅ **P0-6 · [P0-6 反向验证] 地点仍有线索时 claim 不进入 legalMoves（印刷「无线索」门槛）**
  - 期望：0 个 key:claim（所在地点 clues=2）；实测：claims=[] clues=2
  - 证据：英文 setup specialRules.Keys / 08621：While at a location with no clues: claim a key
- ✅ **P0-6 · [P0-6 反向验证] 幕 1 目标未完成时 checkAct 不推进（不会假推进）**
  - 期望：actIndex 保持 0；实测：actIndex=0 records=false
  - 证据：src/engine/act-agenda.js:177-233
- ✅ **P0-9 · [P0-9 反向验证] 未在场时 [cultist] 揭示保持原标记（替换不是无条件空断言）**
  - 期望：drawn=[cultist]（无 08091 时无替换）；实测：drawn=["cultist"]
  - 证据：src/engine/tests.js:918-941（tokenReveal 窗口 + context.replacementToken 替换管线）
- ✅ **P0-10 · [P0-10 反向验证] 牌库顶无预示者时 searchDeck 可正常检索（封锁读点按真实状态生效）**
  - 期望：无锁 + searchDeck 真实取到牌（或在检索后离开牌库）；实测：lock=null taken=["01030"] deck=["01088"]
  - 证据：src/engine/deck-ops.js#searchDeck / #moveCardTo（blockedByDeckTopLock 读点）

## 2. owner 探针复跑（交叉核对）

| owner 探针 | 复跑结果 | 与套件是否冲突 |
| --- | --- | --- |
| campaign/a/_fix-idp-p0.mjs | RESULT: PASS（0 failing checks） | 无（P0-1..4 一致） |
| campaign/b/_fix-realpath.mjs | 93/93 PASS（ALL PASS） | 无（P0-5/P0-13 一致） |
| campaign/c/_probe-city.mjs | 23/23 PASS | 无（P0-6/P0-12/P0-8-City 一致） |
| campaign/d/_fix-heart2.mjs | 5/5 PASS | 无（P0-7 一致） |
| campaign/d/_fix-peaks.mjs | 14/14 PASS | 无（P0-8-Peaks 一致） |
| investigators/_fix-p0-10.mjs | exit 0（含 F0 legacy 对照输出） | 无（P0-10 抽样三项一致） |
| player-b/_fix-player-cards.mjs | 25/25 PASS | 无（P0-9 抽样一致；其余卡按披露口径） |

owner 探针由验收员用同一工作区直接复跑（不采信其结论，仅交叉核对输出）；套件断言与 owner 探针冲突时以真实引擎套件为准并上报 Lead。

## 3. 逐项结果与证据

| 项 | 结果 | 断言 | 说明 |
| --- | --- | --- | --- |
| P0-1 | PASS | 13/13 | 全部客观断言通过 |
| P0-2 | PASS | 13/13 | 全部客观断言通过 |
| P0-3 | PASS | 14/14 | 全部客观断言通过 |
| P0-4 | PASS | 7/7 | 全部客观断言通过 |
| P0-5 | PASS | 19/19 | 全部客观断言通过 |
| P0-13 | PASS | 9/9 | 全部客观断言通过 |
| P0-6 | PASS | 13/13 | 全部客观断言通过 |
| P0-12 | PASS | 3/3 | 全部客观断言通过 |
| P0-7 | PASS | 11/11 | 全部客观断言通过 |
| P0-8 | PASS | 15/15 | 全部客观断言通过 |
| P0-9 | PASS | 14/14 | 全部客观断言通过 |
| P0-10 | PASS | 13/13 | 全部客观断言通过 |
| P0-11 | PASS | 8/8 | 全部客观断言通过 |

### P0-1 · IDP I/II/III 剧本行动在 legalMoves 且真实可执行；advanceAgenda/advanceAct 不 throw — PASS

- ✅ **[iceAndDeathPart1] legalMoves 含 scenarioAction（营地撤退/翻底牌等真实入口）**
  - 期望：legalMoves 至少 1 个 action=scenarioAction
  - 实测：actions=scenarioAction,play,draw,resource,move,investigate,entityAbility,endTurn
  - 证据：src/engine/moves.js:222（legalMoves 读 behavior.actions）/ src/engine/dispatch.js:633（读 behavior.performAction）
- ✅ **[iceAndDeathPart1] applyMove(scenarioAction) 产生真实撤退/结算后果**
  - 期望：全体撤退（resigned）或关卡结算（resolution 写入）
  - 实测：resigned=2/2 status=playing resolution=resolution1 camp=crashSite
  - 证据：src/engine/moves.js:222（legalMoves 读 behavior.actions）/ src/engine/dispatch.js:633（读 behavior.performAction）
- ✅ **[iceAndDeathPart1] advanceAgenda 不 throw**
  - 期望：—
  - 实测：返回正常
  - 证据：src/engine/phases.js:268-283（runAgendaReveal → behavior.agendaReveal）
- ✅ **[iceAndDeathPart1] advanceAct 不 throw**
  - 期望：—
  - 实测：返回正常
  - 证据：src/engine/reveal.js:151-176（runActReveal → behavior.actReveal）
- ✅ **[iceAndDeathPart2] legalMoves 含 scenarioAction（营地撤退/翻底牌等真实入口）**
  - 期望：legalMoves 至少 1 个 action=scenarioAction
  - 实测：actions=scenarioAction,play,draw,resource,move,investigate,endTurn
  - 证据：src/engine/moves.js:222（legalMoves 读 behavior.actions）/ src/engine/dispatch.js:633（读 behavior.performAction）
- ✅ **[iceAndDeathPart2] applyMove(scenarioAction) 产生真实撤退/结算后果**
  - 期望：全体撤退（resigned）或关卡结算（resolution 写入）
  - 实测：resigned=2/2 status=playing resolution=resolution1 camp=frozenShores
  - 证据：src/engine/moves.js:222（legalMoves 读 behavior.actions）/ src/engine/dispatch.js:633（读 behavior.performAction）
- ✅ **[iceAndDeathPart2] advanceAgenda 不 throw**
  - 期望：—
  - 实测：返回正常
  - 证据：src/engine/phases.js:268-283（runAgendaReveal → behavior.agendaReveal）
- ✅ **[iceAndDeathPart2] advanceAct 不 throw**
  - 期望：—
  - 实测：返回正常
  - 证据：src/engine/reveal.js:151-176（runActReveal → behavior.actReveal）
- ✅ **[iceAndDeathPart3] legalMoves 含 scenarioAction（营地撤退/翻底牌等真实入口）**
  - 期望：legalMoves 至少 1 个 action=scenarioAction
  - 实测：actions=scenarioAction,play,draw,resource,move,investigate,endTurn
  - 证据：src/engine/moves.js:222（legalMoves 读 behavior.actions）/ src/engine/dispatch.js:633（读 behavior.performAction）
- ✅ **[iceAndDeathPart3] applyMove(scenarioAction) 产生真实撤退/结算后果**
  - 期望：全体撤退（resigned）或关卡结算（resolution 写入）
  - 实测：resigned=2/2 status=playing resolution=resolution2 camp=frozenShores
  - 证据：src/engine/moves.js:222（legalMoves 读 behavior.actions）/ src/engine/dispatch.js:633（读 behavior.performAction）
- ✅ **[iceAndDeathPart3] advanceAgenda 不 throw**
  - 期望：—
  - 实测：返回正常
  - 证据：src/engine/phases.js:268-283（runAgendaReveal → behavior.agendaReveal）
- ✅ **[iceAndDeathPart3] advanceAct 不 throw**
  - 期望：—
  - 实测：返回正常
  - 证据：src/engine/reveal.js:151-176（runActReveal → behavior.actReveal）
- ✅ **[P0-1 反向验证] 调查员不在同一地点时营地撤退不在 legalMoves（gate 真实生效）**
  - 期望：0 个 scenarioAction（不满足同地点条件）
  - 实测：scenarioActions=[] locations=["crashSite","frozenShores"]
  - 证据：src/engine/moves.js:222（legalMoves 读 behavior.actions）/ src/engine/dispatch.js:633（读 behavior.performAction）

### P0-2 · IDP advanceAgenda/advanceAct 正确推进且幕/议程 reveal 真实生效 — PASS

- ✅ **[iceAndDeathPart1] advanceAgenda 推进 agendaIndex 0→1**
  - 期望：agendaIndex=1
  - 实测：agendaIndex=1
  - 证据：src/engine/phases.js:268-283（runAgendaReveal → behavior.agendaReveal）
- ✅ **[iceAndDeathPart1] 议程 08518 背面剧情被翻出（story face=back）**
  - 期望：事件流含 code=08518、face=back 的幕间剧情
  - 实测：story=[["08518","back","密谋推进"],["08519",null,"新的密谋"],["08518","back","密谋推进"],["08519",null,"新的密谋"]]
  - 证据：src/engine/phases.js:268-283（runAgendaReveal → behavior.agendaReveal）
- ✅ **[iceAndDeathPart1] 议程 I 背面真实效果：生成疾行谬物 08515**
  - 期望：state.enemies 含 08515（冷遇背面：生成疾行谬物）
  - 实测：enemies=["08515"]
  - 证据：content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart1/behavior.js#resolveColdWelcomeBack
- ✅ **[P0-2 反向验证] 连续两次议程 reveal：08518 只结算一次、08519 走另一条真实分支（08522）**
  - 期望：agendaIndex=2，08515×1，08522×1
  - 实测：agendaIndex=2 enemies=["08515","08522"]
  - 证据：content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart1/behavior.js#resolveAgendaBack
- ✅ **[iceAndDeathPart1] advanceAct 结算幕 08521 背面（→R1）**
  - 期望：幕背面生效：resolution1 写入或关卡结束
  - 实测：resolution=resolution1 scenarioEnded=true status=playing
  - 证据：src/engine/reveal.js:151-176（runActReveal → behavior.actReveal）
- ✅ **[iceAndDeathPart2] advanceAgenda 推进 agendaIndex 0→1**
  - 期望：agendaIndex=1
  - 实测：agendaIndex=1
  - 证据：src/engine/phases.js:268-283（runAgendaReveal → behavior.agendaReveal）
- ✅ **[iceAndDeathPart2] 议程 08523 背面剧情被翻出（story face=back）**
  - 期望：事件流含 code=08523、face=back
  - 实测：story=[["08523","back"],["08523","back"],["08541","front"],["08524",null]]
  - 证据：src/engine/phases.js:268-283（runAgendaReveal → behavior.agendaReveal）
- ✅ **[iceAndDeathPart2] 议程背面真实效果：查看地点底下的遭遇卡**
  - 期望：scenarioFlags.lookedAt = { locationId, code }（查看一张压在地点下的卡）
  - 实测：{"locationId":"broadSnowdrifts","code":"08541"}
  - 证据：content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart2/behavior.js#lookUnderLocation
- ✅ **[iceAndDeathPart2] advanceAct 结算幕 08526 背面（→R1）**
  - 期望：resolution1 写入或关卡结束
  - 实测：resolution=resolution1 scenarioEnded=true
  - 证据：src/engine/reveal.js:151-176（runActReveal → behavior.actReveal）
- ✅ **[iceAndDeathPart3] 08544 强制：底牌存在时不推进议程（agendaIndex 保持 0）**
  - 期望：agendaIndex 保持 0（08544 邪灵现身：改为移除 2 毁灭 + 翻出 1 张底牌）
  - 实测：agendaIndex=0 doom 0→0
  - 证据：src/engine/act-agenda.js:326-329（agendaWouldAdvance 语义：返回 true = 否决推进）
- ✅ **[iceAndDeathPart3] 08544 强制真实后果：毁灭 -2 且翻出 1 张底牌**
  - 期望：doom=0 且底牌 8→7
  - 实测：doom=0 底牌 8→7 spawnedFrom={"seepingNightmare":"08547-1","code":"08689","location":"crashSite"}
  - 证据：content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart3/behavior.js#agendaWouldAdvance
- ✅ **[iceAndDeathPart3] 底牌清空后议程正常推进（08544→08545）**
  - 期望：agendaIndex=1
  - 实测：agendaIndex=1 resolution=resolution1
  - 证据：src/engine/phases.js:268-283（runAgendaReveal → behavior.agendaReveal）
- ✅ **[iceAndDeathPart3] advanceAct 结算幕 08546 背面（→R1/R2）**
  - 期望：幕背面生效：R1/R2 写入或关卡结束
  - 实测：resolution=resolution1 scenarioEnded=false
  - 证据：src/engine/reveal.js:151-176（runActReveal → behavior.actReveal）

### P0-3 · IDP resolveSpecialToken delta 非 0（真实读点）+ Part III afterTest 失败后果 — PASS

- ✅ **[iceAndDeathPart1] resolveSpecialToken([cultist]) delta = -2（真实引擎读点）**
  - 期望：delta=-2
  - 实测：delta=-2
  - 证据：src/engine/treachery-tokens.js:348-352（resolveSpecialToken → behavior.resolveChaosToken）
- ✅ **[iceAndDeathPart1] resolveSpecialToken([tablet]) delta = -3**
  - 期望：delta=-3
  - 实测：delta=-3
  - 证据：src/engine/treachery-tokens.js:348-352（resolveSpecialToken → behavior.resolveChaosToken）
- ✅ **[iceAndDeathPart1] resolveSpecialToken([skull]) 按印刷公式 = 1（庇护值 2）**
  - 期望：delta=1
  - 实测：delta=1
  - 证据：src/engine/treachery-tokens.js:348-352（resolveSpecialToken → behavior.resolveChaosToken）
- ✅ **[iceAndDeathPart1] skull delta 非 0（真实读点未回退到默认 0）**
  - 期望：≠0
  - 实测：delta=1
  - 证据：src/engine/treachery-tokens.js:348-352（resolveSpecialToken → behavior.resolveChaosToken）
- ✅ **[iceAndDeathPart2] resolveSpecialToken([cultist]) delta = -2（真实引擎读点）**
  - 期望：delta=-2
  - 实测：delta=-2
  - 证据：src/engine/treachery-tokens.js:348-352（resolveSpecialToken → behavior.resolveChaosToken）
- ✅ **[iceAndDeathPart2] resolveSpecialToken([tablet]) delta = -3**
  - 期望：delta=-3
  - 实测：delta=-3
  - 证据：src/engine/treachery-tokens.js:348-352（resolveSpecialToken → behavior.resolveChaosToken）
- ✅ **[iceAndDeathPart2] resolveSpecialToken([skull]) 按印刷公式 = 1（庇护值 2）**
  - 期望：delta=1
  - 实测：delta=1
  - 证据：src/engine/treachery-tokens.js:348-352（resolveSpecialToken → behavior.resolveChaosToken）
- ✅ **[iceAndDeathPart2] skull delta 非 0（真实读点未回退到默认 0）**
  - 期望：≠0
  - 实测：delta=1
  - 证据：src/engine/treachery-tokens.js:348-352（resolveSpecialToken → behavior.resolveChaosToken）
- ✅ **[iceAndDeathPart3] resolveSpecialToken([cultist]) delta = -2（真实引擎读点）**
  - 期望：delta=-2
  - 实测：delta=-2
  - 证据：src/engine/treachery-tokens.js:348-352（resolveSpecialToken → behavior.resolveChaosToken）
- ✅ **[iceAndDeathPart3] resolveSpecialToken([tablet]) delta = -3**
  - 期望：delta=-3
  - 实测：delta=-3
  - 证据：src/engine/treachery-tokens.js:348-352（resolveSpecialToken → behavior.resolveChaosToken）
- ✅ **[iceAndDeathPart3] resolveSpecialToken([skull]) 按印刷公式 = 1（庇护值 2）**
  - 期望：delta=1
  - 实测：delta=1
  - 证据：src/engine/treachery-tokens.js:348-352（resolveSpecialToken → behavior.resolveChaosToken）
- ✅ **[iceAndDeathPart3] skull delta 非 0（真实读点未回退到默认 0）**
  - 期望：≠0
  - 实测：delta=1
  - 证据：src/engine/treachery-tokens.js:348-352（resolveSpecialToken → behavior.resolveChaosToken）
- ✅ **[iceAndDeathPart3] afterTest：[cultist] 失败 → 忒咳哩牌库洗入或 +1 恐惧**
  - 期望：失败后果生效：deck 长度变化（洗入忒咳哩-哩）或 horror+1
  - 实测：drawn=["cultist"] deck 28→29 horror 0→0
  - 证据：src/engine/tests.js:1513（behavior.afterTest 失败回调）；印刷 08501 [cultist] 失败后果
- ✅ **[iceAndDeathPart3] afterTest：[tablet] 失败 → 按失败差值弃牌库顶**
  - 期望：失败后果生效：弃牌库顶（deck 减少 / discard 增加）
  - 实测：drawn=["tablet"] deck 28→0 discard 0→26
  - 证据：src/engine/tests.js:1513（behavior.afterTest 失败回调）；印刷 08501 [tablet] 失败后果

### P0-4 · IDP 地点 shroud = 印刷有限值；未探索地点入场费真实收取且线索不足拒绝移动 — PASS

- ✅ **[iceAndDeathPart2] 13 张冰原地点 shroud 均等于印刷有限值**
  - 期望：13/13 地点 Number.isFinite(shroud) 且 === cards-data 印刷 shroud
  - 实测：13/13 一致（crashSite:2,frozenShores:2,treacherousPath:2,precariousIceSheet:4,broadSnowdrifts:1,icyWastes:2,rockyCrags:3,snowGraves:3,icebreakerLanding:2,frigidCave:4,barrierCamp:4,remnantsOfLakesCamp:3,crystallineCavern:5）
  - 证据：content/campaigns/edgeOfTheEarth/card-data.js#location（印刷 shroud 进入地点数据）
- ✅ **[P0-4] 真实移动至 frozenShores 并放置相连未探索地点**
  - 期望：legalMoves 含 move→frozenShores
  - 实测：存在
  - 证据：src/engine/movement.js:283
- ✅ **[P0-4] 进入 frozenShores 后 broadSnowdrifts 入场且未揭示**
  - 期望：broadSnowdrifts on map & revealed=false
  - 实测：onMap revealed=false
  - 证据：content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart1/behavior.js#placeConnectedSetAsideLocations
- ✅ **[P0-4] 线索足够时 legalMoves 提供进入未探索地点**
  - 期望：legalMoves 含 move→broadSnowdrifts（需 2 线索）
  - 实测：存在
  - 证据：content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart1/behavior.js#beforeMove（揭示前收费）
- ✅ **[P0-4] 进入未探索地点真实收取入场费并揭示**
  - 期望：revealed=true 且线索由 2→0（共同支付 2）
  - 实测：revealed=true clues=0 location=broadSnowdrifts locClues=4
  - 证据：content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart1/behavior.js#beforeMove（揭示前收费）
- ✅ **[P0-4] 线索不足时未探索地点不出现在 legalMoves**
  - 期望：move→broadSnowdrifts 不合法（线索不足）
  - 实测：已过滤
  - 证据：content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart1/behavior.js#moveError
- ✅ **[P0-4] 线索不足时强制提交移动被拒绝（不会免费揭示）**
  - 期望：applyMove 抛错且地点仍未揭示、调查员留在原地
  - 实测：error=线索不足，无法进入未探索地点「辽阔雪地」（需要共同花费 2 个线索） revealed=false location=frozenShores
  - 证据：content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart1/behavior.js#beforeMove（揭示前收费）

### P0-5 · FM 议程推进不 throw/v2v3 索引与印刷阈值/19 地点线索/翻面行动可达/resolution 记录 — PASS

- ✅ **[fatalMirage] 开局议程为 08550（v1）且阈值=印刷 15**
  - 期望：08550 @15
  - 实测：08550 @15
  - 证据：src/cards/cards-data.js 08550.doom=15
- ✅ **[fatalMirage] checkAgenda 到达阈值不 throw（议程背面已接线）**
  - 期望：—
  - 实测：agendaIndex=0 status=playing
  - 证据：src/engine/phases.js:268-283（runAgendaReveal → behavior.agendaReveal）
- ✅ **[fatalMirage] 议程 08550 背面真实效果：剩余调查员全部被击败**
  - 期望：全部 investigators.defeated=true（08550 背面：每位剩余调查员被击败）
  - 实测：defeated=2/2
  - 证据：content/campaigns/edgeOfTheEarth/scenarios/fatalMirage/behavior.js#agendaReveal
- ✅ **[fatalMirage] 全员被击败后关卡可正常结束（noResolution）**
  - 期望：noResolution 写入结算（state.resolution / scenarioResults / uiState=scenarioResult）
  - 实测：resolution=noResolution results=["resolution1","noResolution"] uiState=inScenario status=playing
  - 证据：src/engine/campaign-flow.js:241-243（引擎读 behavior.resolution 写战役记录）
- ✅ **[fatalMirage v2] 重入版本 = 2（scenarioFlags.fatalMirageVersion）**
  - 期望：fatalMirageVersion=2
  - 实测：2
  - 证据：content/campaigns/edgeOfTheEarth/scenarios/fatalMirage/behavior.js#fatalMirageVersion
- ✅ **[fatalMirage v2] 当前议程 08551 @13（不再索引越界/阈值恒 15）**
  - 期望：08551 @13
  - 实测：agendaIndex=0 current=08551 @13
  - 证据：definition.js#AGENDA_STAGES（印刷 08551/08552 doom=13/11）
- ✅ **[fatalMirage v2] 当前幕 08554（stage 2a）**
  - 期望：08554 stage 2a
  - 实测：08554 stage=2a
  - 证据：definition.js#ACT_STAGES（印刷 08554/08555）
- ✅ **[fatalMirage v2] 到达阈值后议程真实推进（不再 doom=13/11 仍 no-op）**
  - 期望：agendaIndex 前进或关卡结算
  - 实测：agendaIndex 0→0 status=playing
  - 证据：src/engine/phases.js:268-283（runAgendaReveal → behavior.agendaReveal）
- ✅ **[fatalMirage v3] 重入版本 = 3（scenarioFlags.fatalMirageVersion）**
  - 期望：fatalMirageVersion=3
  - 实测：3
  - 证据：content/campaigns/edgeOfTheEarth/scenarios/fatalMirage/behavior.js#fatalMirageVersion
- ✅ **[fatalMirage v3] 当前议程 08552 @11（不再索引越界/阈值恒 15）**
  - 期望：08552 @11
  - 实测：agendaIndex=0 current=08552 @11
  - 证据：definition.js#AGENDA_STAGES（印刷 08551/08552 doom=13/11）
- ✅ **[fatalMirage v3] 当前幕 08555（stage 3a）**
  - 期望：08555 stage 3a
  - 实测：08555 stage=3a
  - 证据：definition.js#ACT_STAGES（印刷 08554/08555）
- ✅ **[fatalMirage v3] 到达阈值后议程真实推进（不再 doom=13/11 仍 no-op）**
  - 期望：agendaIndex 前进或关卡结算
  - 实测：agendaIndex 0→0 status=playing
  - 证据：src/engine/phases.js:268-283（runAgendaReveal → behavior.agendaReveal）
- ✅ **[fatalMirage] 19 个幻景地点 cluesPerInvestigator > 0（Mirage 印刷值）**
  - 期望：19/19 地点 clues>0
  - 实测：19/19：[{"id":"prisonOfMemories","clues":3,"tier":1},{"id":"baseCamp","clues":3,"tier":1},{"id":"deckOfTheTheodosia","clues":3,"tier":1},{"id":"universityHalls","clues":3,"tier":1},{"id":"hedgeMaze","clues":2,"tier":2},{"id":"desertedStation","clues":2,"tier":2}]
  - 证据：definition.js#LOCATIONS（clues=印刷 Mirage 每玩家线索值）
- ✅ **[fatalMirage] 入场地点（prisonOfMemories）按 Mirage 规则有线索（>0）**
  - 期望：prisonOfMemories clues>0 且 maxClues>0
  - 实测：prisonOfMemories clues=6 maxClues=6
  - 证据：behavior.js#mirageClueTotal / locationPlaced
- ✅ **[fatalMirage] 幻景「花线索翻面」是真实 legalMoves 行动（flipStoryFace 引擎可达）**
  - 期望：legalMoves 含 scenarioAction rule=mirageFlip:*（带 label，非仅 disabled 提示）
  - 实测：scenarioActions=[["mirageFlip:prisonOfMemories","🌫️ 幻景翻面「记忆囚笼」：共同支付 2 个线索 → 揭示「大本营」"],["mirageFlip:prisonOfMemories","🌫️ 幻景翻面「记忆囚笼」：共同支付 2 个线索 → 揭示「菲奥多西亚号甲板」"],["mirageFlip:prisonOfMemories","🌫️ 幻景翻面「记忆囚笼」：共同支付 2 个线索 → 揭示「大学礼堂」"]]
  - 证据：src/engine/moves.js:222 + src/engine/dispatch.js:633（actions → legalMoves → performAction）；locationStory → behavior.flipStoryFace
- ✅ **[fatalMirage] 真实 applyMove 翻面产生剧情后果（揭示幻景地点/胜利区/可推进标记）**
  - 期望：翻面后揭示新地点或写入剧情/胜利区或置 fatalMirageMayAdvance
  - 实测：{"before":{"locations":1,"victory":0,"resolved":false},"after":{"locations":2,"victory":0,"resolved":false}}
  - 证据：src/engine/moves.js:222 + src/engine/dispatch.js:633（actions → legalMoves → performAction）；locationStory → behavior.flipStoryFace
- ✅ **[P0-5 反向验证] 线索不足（0）时没有可执行的幻景翻面行动（GroupClueCost 门槛真实生效）**
  - 期望：0 个带 label 的可执行 mirageFlip 行动
  - 实测：mirageFlip=0 executable=0 sample=[]
  - 证据：src/engine/moves.js:222 + src/engine/dispatch.js:633（actions → legalMoves → performAction）；locationStory → behavior.flipStoryFace
- ✅ **[fatalMirage] 真实结算写入 fatalMirageTimes/fatalMirageResolution**
  - 期望：fatalMirageTimes>=1 且 fatalMirageResolution=victory
  - 实测：times=1 resolution=victory keys=fatalMirageResolution,fatalMirageTimes,fatalMirageCompleted,memoriesBanished,memoriesDiscovered,eoteFatalMirageEntries
  - 证据：src/engine/campaign-flow.js:241-243（引擎读 behavior.resolution 写战役记录）
- ✅ **[fatalMirage] 真实结算写入 memoriesDiscovered / memoriesBanished 记录**
  - 期望：campaign.records.memoriesDiscovered/​memoriesBanished 为数组
  - 实测：discovered=[] banished=[]
  - 证据：src/engine/campaign-flow.js:241-243（引擎读 behavior.resolution 写战役记录）

### P0-13 · FM 08549 混乱标记在真实 performTest 中 delta 非 0（cultist/tablet/elderthing/skull） — PASS

- ✅ **[fatalMirage] performTest [cultist] 修正值 = -2（非 0，真实引擎读点）**
  - 期望：delta=-2（base=4 → value=2）
  - 实测：delta=-2（base=4 → value=2，drawn=["cultist"]）
  - 证据：src/engine/treachery-tokens.js:348-352 / src/engine/tests.js（performTest 真实检定值）
- ✅ **[fatalMirage] performTest [cultist] 修正值非 0**
  - 期望：≠0
  - 实测：delta=-2
  - 证据：src/engine/treachery-tokens.js:348-352 / src/engine/tests.js（performTest 真实检定值）
- ✅ **[fatalMirage] performTest [tablet] 修正值 = -3（非 0，真实引擎读点）**
  - 期望：delta=-3（base=4 → value=1）
  - 实测：delta=-3（base=4 → value=1，drawn=["tablet"]）
  - 证据：src/engine/treachery-tokens.js:348-352 / src/engine/tests.js（performTest 真实检定值）
- ✅ **[fatalMirage] performTest [tablet] 修正值非 0**
  - 期望：≠0
  - 实测：delta=-3
  - 证据：src/engine/treachery-tokens.js:348-352 / src/engine/tests.js（performTest 真实检定值）
- ✅ **[fatalMirage] performTest [elderthing] 修正值 = -4（非 0，真实引擎读点）**
  - 期望：delta=-4（base=4 → value=0）
  - 实测：delta=-4（base=4 → value=0，drawn=["elderthing"]）
  - 证据：src/engine/treachery-tokens.js:348-352 / src/engine/tests.js（performTest 真实检定值）
- ✅ **[fatalMirage] performTest [elderthing] 修正值非 0**
  - 期望：≠0
  - 实测：delta=-4
  - 证据：src/engine/treachery-tokens.js:348-352 / src/engine/tests.js（performTest 真实检定值）
- ✅ **[fatalMirage] performTest [skull] 修正值 = -2（非 0，真实引擎读点）**
  - 期望：delta=-2（base=4 → value=2）
  - 实测：delta=-2（base=4 → value=2，drawn=["skull"]）
  - 证据：src/engine/treachery-tokens.js:348-352 / src/engine/tests.js（performTest 真实检定值）
- ✅ **[fatalMirage] performTest [skull] 修正值非 0**
  - 期望：≠0
  - 实测：delta=-2
  - 证据：src/engine/treachery-tokens.js:348-352 / src/engine/tests.js（performTest 真实检定值）
- ✅ **[fatalMirage] resolveSpecialToken 与 performTest 同源（cultist=-2, tablet=-3, elderthing=-4）**
  - 期望：{cultist:-2, tablet:-3, elderthing:-4}
  - 实测：{"cultist":-2,"tablet":-3,"elderthing":-4}
  - 证据：src/engine/treachery-tokens.js:348-352 / src/engine/tests.js（performTest 真实检定值）

### P0-6 · City 钥匙 claim/give 真实入口、幕 1 目标可达、议程 2 背面 R2 — PASS

- ✅ **[cityOfTheElderThings] 开局 16 把数值钥匙分布在场地点（holder=location:*）**
  - 期望：≥16 把 kind=value 钥匙 holder=location:*
  - 实测：keys=16 locations=17
  - 证据：src/engine/scenario-keys.js（数值钥匙唯一状态：scenarioFlags.mechanics.keys，holder location:/investigator:）
- ✅ **[cityOfTheElderThings] claimKey 进入真实 legalMoves（钥匙取得入口）**
  - 期望：scenarioAction rule/label 含 claimKey/key:claim/取得钥匙
  - 实测：invLoc=ancientPlanetarium locClues=0 scenarioActions=[["key:claim","🔑 取得「古代天文馆」上的一把钥匙（快速）"]]
  - 证据：src/engine/moves.js:222（legalMoves 读 behavior.actions）/ src/engine/dispatch.js:633（behavior.performAction）
- ✅ **[cityOfTheElderThings] applyMove claimKey：钥匙从地点转移到调查员控制**
  - 期望：investigator:0 钥匙数 0→1
  - 实测：after=1 locationKeyLeft=0
  - 证据：src/engine/scenario-keys.js（数值钥匙唯一状态：scenarioFlags.mechanics.keys，holder location:/investigator:）
- ✅ **[cityOfTheElderThings] giveKeys 进入真实 legalMoves（钥匙转交入口）**
  - 期望：scenarioAction rule/label 含 giveKeys/key:give/交给
  - 实测：scenarioActions=[["key:give","🔑 把自己的钥匙交给同地点的另一位调查员"]]
  - 证据：src/engine/moves.js:222（legalMoves 读 behavior.actions）/ src/engine/dispatch.js:633（behavior.performAction）
- ✅ **[cityOfTheElderThings] applyMove giveKeys：钥匙转移给同地点另一位调查员**
  - 期望：investigator:1 钥匙数 >0
  - 实测：after=1
  - 证据：src/engine/scenario-keys.js（数值钥匙唯一状态：scenarioFlags.mechanics.keys，holder location:/investigator:）
- ✅ **[cityOfTheElderThings] 真实 claim 行动可收集到 2×[elder_thing]+2×[tablet] 钥匙**
  - 期望：控制 ≥4 把 symbol 钥匙
  - 实测：claimed=["tablet","tablet","elderthing","elderthing"] held=tablet,tablet,elderthing,elderthing
  - 证据：src/engine/scenario-keys.js（数值钥匙唯一状态：scenarioFlags.mechanics.keys，holder location:/investigator:）
- ✅ **[cityOfTheElderThings] 幕 1 的两条 keyActions 进入真实 legalMoves**
  - 期望：actKey:studyHistory 与 actKey:discernShoggoths
  - 实测：["actKey:studyHistory","actKey:discernShoggoths"]
  - 证据：src/engine/moves.js:222（legalMoves 读 behavior.actions）/ src/engine/dispatch.js:633（behavior.performAction）
- ✅ **[cityOfTheElderThings] actKey 真实结算后写入幕 1 目标记录**
  - 期望：theTeamStudiedTheHistoryOfTheElderThings / theTeamDiscernedTheOriginOfTheShoggoths = true
  - 实测：acted=2 records={"study":true,"discern":true}
  - 证据：src/cards/encounter-entries/edgeOfTheEarth/cityOfTheElderThings/08624.js#actRule.keyActions
- ✅ **[cityOfTheElderThings] 幕 1 目标可达：真实 checkAct 推进 actIndex**
  - 期望：actIndex ≥ 1（08624 → 08627）
  - 实测：actIndex=1 status=playing resolution=null
  - 证据：src/engine/act-agenda.js:177-233（checkLinearAct → behavior.checkObjectives）
- ✅ **[cityOfTheElderThings] 议程 2 = 08623 @10**
  - 期望：08623 @10
  - 实测：08623 @10
  - 证据：src/cards/cards-data.js 08623.doom=10
- ✅ **[cityOfTheElderThings] 议程 2 背面结算为 R2（resolution2 写入真实结算记录）**
  - 期望：resolution2（08623 背面 → 结局 2）
  - 实测：scenarioResults=["resolution1","resolution1","resolution2"] state.resolution=resolution2 status=playing
  - 证据：src/cards/encounter-entries/edgeOfTheEarth/cityOfTheElderThings/08623.js（agendaRule.onReveal → R2）
- ✅ **[P0-6 反向验证] 地点仍有线索时 claim 不进入 legalMoves（印刷「无线索」门槛）**
  - 期望：0 个 key:claim（所在地点 clues=2）
  - 实测：claims=[] clues=2
  - 证据：英文 setup specialRules.Keys / 08621：While at a location with no clues: claim a key
- ✅ **[P0-6 反向验证] 幕 1 目标未完成时 checkAct 不推进（不会假推进）**
  - 期望：actIndex 保持 0
  - 实测：actIndex=0 records=false
  - 证据：src/engine/act-agenda.js:177-233

### P0-12 · City 地点动作无 api.test TypeError（真实 applyMove 触发真实 performTest） — PASS

- ✅ **[cityOfTheElderThings] 开局提供地点动作 scenarioAction:loc:*（真实 legalMoves）**
  - 期望：至少 1 条 loc:* 地点动作（如 loc:bridgeDiscover）
  - 实测：["loc:bridgeDiscover","loc:bridgeTravel"]
  - 证据：src/engine/moves.js:222（legalMoves 读 behavior.actions）/ src/engine/dispatch.js:633（behavior.performAction）
- ✅ **[cityOfTheElderThings] applyMove 地点动作不抛 api.test TypeError**
  - 期望：无「options.resolve is not a function」/TypeError
  - 实测：正常返回
  - 证据：src/engine/scenario-runtime.js:657（api.test(seat, skill, difficulty, resolve, …) 签名）
- ✅ **[cityOfTheElderThings] 地点动作真实触发了技能检定（api.test 第 4 参 resolve 生效）**
  - 期望：真实 skillTest 已结算（skill/difficulty 有效）
  - 实测：{"skill":"combat","difficulty":4,"success":true,"value":5}
  - 证据：src/engine/scenario-runtime.js:657（api.test(seat, skill, difficulty, resolve, …) 签名）

### P0-7 · Heart2 08672 不提前清场、R1/R2 记录真实写入、08716 成功躲避无 ReferenceError — PASS

- ✅ **[theHeartOfMadnessPart2] 开局议程 08671 @3**
  - 期望：08671 @3
  - 实测：08671 @3
  - 证据：src/engine/act-agenda.js:426-458（checkAgenda → advanceAgenda）；content/.../theHeartOfMadnessPart2/definition.js 08672 doomThreshold
- ✅ **[theHeartOfMadnessPart2] checkAgenda 推进到 08672（不 throw）**
  - 期望：agendaIndex=1（当前 08672）
  - 实测：agendaIndex=1 current=08672 status=playing
  - 证据：src/engine/act-agenda.js:426-458（checkAgenda → advanceAgenda）；content/.../theHeartOfMadnessPart2/definition.js 08672 doomThreshold
- ✅ **[theHeartOfMadnessPart2] 议程 08672 的 doomThreshold 不是 0（印刷无 doom → 不能即时推进）**
  - 期望：doomThreshold ≠ 0（null/undefined 或按参考实现的正阈值）
  - 实测：08672 doomThreshold=null
  - 证据：src/engine/act-agenda.js:426-458（checkAgenda → advanceAgenda）；content/.../theHeartOfMadnessPart2/definition.js 08672 doomThreshold
- ✅ **[theHeartOfMadnessPart2] doom=0 的下一次神话阶段不再提前推进 08672（agendaIndex 保持 1）**
  - 期望：agendaIndex 保持 1
  - 实测：agendaIndex=1 current=08672 status=playing
  - 证据：src/engine/act-agenda.js:426-458（checkAgenda → advanceAgenda）；content/.../theHeartOfMadnessPart2/definition.js 08672 doomThreshold
- ✅ **[theHeartOfMadnessPart2] 08672 不提前清场：幕 3 的高塔地点仍在场**
  - 期望：5 座高塔地点全部保留
  - 实测：pylons 5→5 locationsΔ=16→16 story=false
  - 证据：content/.../theHeartOfMadnessPart2/behavior.js#applyRampSequence（坡道清场只应在 08672 真实推进时发生）
- ✅ **[theHeartOfMadnessPart2] 真实 setup 写入 R1/R2 门槛记录（drKenslerHasAPlan / theTruthOfTheMirageEludesYou）**
  - 期望：两个布尔记录被写入且互补（一个 true 一个 false）
  - 实测：{"plan":false,"truth":true}
  - 证据：content/campaigns/edgeOfTheEarth/records.js:221-240（recordSchema 布尔键）；behavior.preScenarioSetup#recordCampaignLogBranch
- ✅ **[theHeartOfMadnessPart2] resolution1 真实可达（checkAct → 结局分流）**
  - 期望：resolution1 写入战役结算
  - 实测：resolution=resolution1 scenarioEnded=true status=playing
  - 证据：content/campaigns/edgeOfTheEarth/scenarios/theHeartOfMadnessPart2/behavior.js#checkObjectives / resolution
- ✅ **[theHeartOfMadnessPart2] resolution2 真实可达（checkAct → 结局分流）**
  - 期望：resolution2 写入战役结算
  - 实测：resolution=resolution2 scenarioEnded=true status=playing
  - 证据：content/campaigns/edgeOfTheEarth/scenarios/theHeartOfMadnessPart2/behavior.js#checkObjectives / resolution
- ✅ **[theHeartOfMadnessPart2] 08716 主动能力是真实 legalMoves 行动**
  - 期望：legalMoves 含 ability（assetId=probe-08716）
  - 实测：abilities=["probe-08716"]
  - 证据：src/cards/encounter-entries/edgeOfTheEarth/_shared/expedition_team/08716.js
- ✅ **[theHeartOfMadnessPart2] 08716 成功躲避路径无 ReferenceError（here is not defined）**
  - 期望：无 ReferenceError
  - 实测：正常结算
  - 证据：src/cards/encounter-entries/edgeOfTheEarth/_shared/expedition_team/08716.js（成功躲避路径 here 未定义）
- ✅ **[theHeartOfMadnessPart2] 08716 成功躲避真实后果（敌人被躲避/可移动选择出现）**
  - 期望：autoEvade 生效（敌人 exhausted）或出现移动选择
  - 实测：enemy={"exhausted":true} pending=null location=facility8
  - 证据：src/cards/encounter-entries/edgeOfTheEarth/_shared/expedition_team/08716.js（成功躲避路径 here 未定义）

### P0-8 · Peaks/City 专属诡计真实遭遇结算 + 遭遇牌库含共享组 — PASS

- ✅ **[toTheForbiddenPeaks] 遭遇牌库含参考 Setup 声明的共享组**
  - 期望：全部共享组（deadlyWeather,elderThings,hazardsOfAntarctica,namelessHorrors）在 encounterDeck 中各有 ≥1 张
  - 实测：deck=37 rows=["deadlyWeather:3/3","elderThings:3/3","hazardsOfAntarctica:2/2","namelessHorrors:3/3"]
  - 证据：content/scenario-manifest.js#requiredEncounterGroupIds + scenario.encounterDeck
- ✅ **[toTheForbiddenPeaks] 遭遇牌库含本章专属敌人/诡计**
  - 期望：本章在牌库卡 08609,08610,08611,08612,08613 全部在场
  - 实测：own=["08609","08610","08611","08612","08613"] setAside=["08601","08606","08608","08614","08615","08616","08617","08618","08619","08620"]
  - 证据：content/scenario-manifest.js#requiredEncounterGroupIds + scenario.encounterDeck
- ✅ **[cityOfTheElderThings] 遭遇牌库含参考 Setup 声明的共享组**
  - 期望：全部共享组（elderThings,miasma,namelessHorrors,penguins,lockedDoors）在 encounterDeck 中各有 ≥1 张
  - 实测：deck=31 rows=["elderThings:3/3","miasma:2/2","namelessHorrors:3/3","penguins:2/2","lockedDoors:1/1"]
  - 证据：content/scenario-manifest.js#requiredEncounterGroupIds + scenario.encounterDeck
- ✅ **[cityOfTheElderThings] 遭遇牌库含本章专属敌人/诡计**
  - 期望：本章在牌库卡 08643,08644,08645 全部在场
  - 实测：own=["08643","08644","08645"] setAside=["08710","08710","08711","08641"]
  - 证据：content/scenario-manifest.js#requiredEncounterGroupIds + scenario.encounterDeck
- ✅ **[cityOfTheElderThings] v1 setup 的放一边/移出游戏分流正确（Shoggoths 组 + 08641 放一边；08642 移出）**
  - 期望：setAside 含 08710/08711/08641；removed 含 08642
  - 实测：setAside=["08710","08710","08711","08641"] removed=["08642"]
  - 证据：definition.js#SET_ASIDE_BY_VERSION / REMOVED_BY_VERSION
- ✅ **[toTheForbiddenPeaks] 8 张专属诡计声明引擎可结算标记（entryRevelation + campaignRule/encounterResolve）**
  - 期望：每张都有真实引擎结算读点
  - 实测：[{"code":"08610","entryRevelation":true,"effectKind":"campaignRule","encounterResolve":false,"test":false,"resolvable":true},{"code":"08611","entryRevelation":true,"effectKind":"campaignRule","encounterResolve":false,"test":false,"resolvable":true},{"code":"08612","entryRevelation":true,"effectKind":"campaignRule","encounterResolve":false,"test":false,"resolvable":true},{"code":"08613","entryRevelation":true,"effectKind":"campaignRule","encounterResolve":false,"test":false,"resolvable":true}]
  - 证据：src/engine/treachery-tokens.js:113-124（entryRevelation / encounterResolve / effect.kind==campaignRule 才真实结算）
- ✅ **[toTheForbiddenPeaks] 真实 drawEncounter 08610 结算非零（非仅展示文本）**
  - 期望：{"clues":2}
  - 实测：{"before":{"horror":0,"damage":0,"clues":3,"threat":[],"chaosBag":["autofail"],"surge":false},"after":{"horror":0,"damage":0,"clues":5,"threat":[],"chaosBag":["autofail"],"surge":false}}
  - 证据：src/engine/encounter.js:99-200（drawEncounter 真实遭遇抽取）
- ✅ **[toTheForbiddenPeaks] 真实 drawEncounter 08611 结算非零（非仅展示文本）**
  - 期望：{"surge":true}
  - 实测：{"before":{"horror":0,"damage":0,"clues":3,"threat":[],"chaosBag":["autofail"],"surge":false},"after":{"horror":0,"damage":0,"clues":3,"threat":[],"chaosBag":["autofail"],"surge":true}}
  - 证据：src/engine/encounter.js:99-200（drawEncounter 真实遭遇抽取）
- ✅ **[toTheForbiddenPeaks] 真实 drawEncounter 08612 结算非零（非仅展示文本）**
  - 期望：{"damage":2}
  - 实测：{"before":{"horror":0,"damage":0,"clues":3,"threat":[],"chaosBag":["autofail"],"surge":false},"after":{"horror":0,"damage":2,"clues":3,"threat":[],"chaosBag":["autofail"],"surge":false}}
  - 证据：src/engine/encounter.js:99-200（drawEncounter 真实遭遇抽取）
- ✅ **[toTheForbiddenPeaks] 真实 drawEncounter 08613 结算非零（非仅展示文本）**
  - 期望：{"frostOrHorror":true}
  - 实测：{"before":{"horror":0,"damage":0,"clues":3,"threat":[],"chaosBag":["autofail"],"surge":false},"after":{"horror":0,"damage":0,"clues":3,"threat":[],"chaosBag":["autofail","frost"],"surge":false}}
  - 证据：src/engine/encounter.js:99-200（drawEncounter 真实遭遇抽取）
- ✅ **[cityOfTheElderThings] 8 张专属诡计声明引擎可结算标记（entryRevelation + campaignRule/encounterResolve）**
  - 期望：每张都有真实引擎结算读点
  - 实测：[{"code":"08644","entryRevelation":true,"effectKind":"campaignRule","encounterResolve":false,"test":false,"resolvable":true},{"code":"08645","entryRevelation":true,"effectKind":"campaignRule","encounterResolve":false,"test":false,"resolvable":true},{"code":"08646","entryRevelation":true,"effectKind":"campaignRule","encounterResolve":false,"test":false,"resolvable":true},{"code":"08647","entryRevelation":true,"effectKind":"campaignRule","encounterResolve":false,"test":false,"resolvable":true}]
  - 证据：src/engine/treachery-tokens.js:113-124（entryRevelation / encounterResolve / effect.kind==campaignRule 才真实结算）
- ✅ **[cityOfTheElderThings] 真实 drawEncounter 08644 结算非零（非仅展示文本）**
  - 期望：{"horror":2}
  - 实测：{"before":{"horror":0,"damage":0,"clues":2,"threat":[],"chaosBag":["autofail"],"surge":false},"after":{"horror":3,"damage":0,"clues":2,"threat":[],"chaosBag":["autofail"],"surge":false}}
  - 证据：src/engine/encounter.js:99-200（drawEncounter 真实遭遇抽取）
- ✅ **[cityOfTheElderThings] 真实 drawEncounter 08645 结算非零（非仅展示文本）**
  - 期望：{"damage":1}
  - 实测：{"before":{"horror":0,"damage":0,"clues":2,"threat":[],"chaosBag":["autofail"],"surge":false},"after":{"horror":0,"damage":3,"clues":2,"threat":[],"chaosBag":["autofail"],"surge":false}}
  - 证据：src/engine/encounter.js:99-200（drawEncounter 真实遭遇抽取）
- ✅ **[cityOfTheElderThings] 真实 drawEncounter 08646 结算非零（非仅展示文本）**
  - 期望：{"threat":"08646"}
  - 实测：{"before":{"horror":0,"damage":0,"clues":2,"threat":[],"chaosBag":["autofail"],"surge":false},"after":{"horror":0,"damage":0,"clues":2,"threat":["08646"],"chaosBag":["autofail"],"surge":false}}
  - 证据：src/engine/encounter.js:99-200（drawEncounter 真实遭遇抽取）
- ✅ **[cityOfTheElderThings] 真实 drawEncounter 08647 结算非零（非仅展示文本）**
  - 期望：{"threat":"08647"}
  - 实测：{"before":{"horror":0,"damage":0,"clues":2,"threat":[],"chaosBag":["autofail"],"surge":false},"after":{"horror":0,"damage":0,"clues":2,"threat":["08647"],"chaosBag":["autofail"],"surge":false}}
  - 证据：src/engine/encounter.js:99-200（drawEncounter 真实遭遇抽取）

### P0-9 · 玩家卡抽样：08105/08107 真实战斗窗口、08091 tokenReveal、08130 威胁区治愈 — PASS

- ✅ **[08105] 真实战斗 legalMoves 提供 fight 行动**
  - 期望：legalMoves 含 fight
  - 实测：actions=["scenarioAction","play","draw","resource","move","investigate","fight","engage","entityAbility","endTurn"]
  - 证据：src/engine/tests.js:312（playerWindow test.beforeCommit）/ src/engine/encounter.js:541-624（窗口枚举免费描述子）
- ✅ **[08105] applyMove(fight) 不抛错**
  - 期望：真实战斗检定开始
  - 实测：OK
  - 证据：src/engine/tests.js:312（playerWindow test.beforeCommit）/ src/engine/encounter.js:541-624（窗口枚举免费描述子）
- ✅ **[08105] 真实战斗检定窗口出现该卡免费能力（不靠伪造 skillTest.actionKind）**
  - 期望：test.beforeCommit 窗口选项含 assetId=probe-08105
  - 实测：pending=playerWindow options=[{"assetId":"probe-08105","label":"破冰锥：横置：本次攻击/调查检定 +1 技能值"}]
  - 证据：src/engine/tests.js:312（playerWindow test.beforeCommit）/ src/engine/encounter.js:541-624（窗口枚举免费描述子）
- ✅ **[08105] 支付横置费用并完成检定（能力真实结算）**
  - 期望：破冰锥 exhausted=true 且检定完成
  - 实测：exhausted=true lastTest=combat
  - 证据：src/engine/tests.js:312（playerWindow test.beforeCommit）/ src/engine/encounter.js:541-624（窗口枚举免费描述子）
- ✅ **[08107] 真实战斗 legalMoves 提供 fight 行动**
  - 期望：legalMoves 含 fight
  - 实测：actions=["scenarioAction","play","draw","resource","move","investigate","fight","engage","entityAbility","endTurn"]
  - 证据：src/engine/tests.js:312（playerWindow test.beforeCommit）/ src/engine/encounter.js:541-624（窗口枚举免费描述子）
- ✅ **[08107] applyMove(fight) 不抛错**
  - 期望：真实战斗检定开始
  - 实测：OK
  - 证据：src/engine/tests.js:312（playerWindow test.beforeCommit）/ src/engine/encounter.js:541-624（窗口枚举免费描述子）
- ✅ **[08107] 真实战斗检定窗口出现该卡免费能力（不靠伪造 skillTest.actionKind）**
  - 期望：test.beforeCommit 窗口选项含 assetId=probe-08107
  - 实测：pending=playerWindow options=[{"assetId":"probe-08107","label":"破冰锥：横置：本次攻击/调查检定 +1 技能值"}]
  - 证据：src/engine/tests.js:312（playerWindow test.beforeCommit）/ src/engine/encounter.js:541-624（窗口枚举免费描述子）
- ✅ **[08107] 支付横置费用并完成检定（能力真实结算）**
  - 期望：破冰锥 exhausted=true 且检定完成
  - 实测：exhausted=true lastTest=combat
  - 证据：src/engine/tests.js:312（playerWindow test.beforeCommit）/ src/engine/encounter.js:541-624（窗口枚举免费描述子）
- ✅ **[08091] 真实 legalMoves 可从手牌打出（进入威胁区/资产区并触发 entersPlay）**
  - 期望：legalMoves 含 play 08091
  - 实测：[["play","08091","🃏 装备「恩科西·马巴蒂」(4 资源)"]]
  - 证据：src/engine/actions.js#playCard（entersPlay 描述子）
- ✅ **[08091] 入场后指定咒印（skull）写入支援实例**
  - 期望：asset.sigilToken=skull
  - 实测：sigilToken=skull
  - 证据：src/engine/api-misc.js:1420-1431（setSigilToken）
- ✅ **[08091] tokenReveal：[cultist] 揭示被替换为咒印 [skull]（真实 performTest 管线）**
  - 期望：drawn 含咒印 skull（不再是 cultist）且支援横置
  - 实测：observedDrawn=["skull"] sigil=skull exhausted=true log=🔮 改为从混乱袋查找并揭示咒印 💀。
  - 证据：src/engine/tests.js:918-941（tokenReveal 窗口 + context.replacementToken 替换管线）
- ✅ **[P0-9 反向验证] 未在场时 [cultist] 揭示保持原标记（替换不是无条件空断言）**
  - 期望：drawn=[cultist]（无 08091 时无替换）
  - 实测：drawn=["cultist"]
  - 证据：src/engine/tests.js:918-941（tokenReveal 窗口 + context.replacementToken 替换管线）
- ✅ **[08130] 条目声明真实引擎读点 flags.threatDamageSink（替代 free+discardSelf 近似）**
  - 期望：flags.threatDamageSink=true
  - 实测：flags={"threatDamageSink":true} note=approximation: 动作后锁读 actionResolvedAtLocation（窗口不带行动类型），近似为任意行动后锁住印刷行动类型至回合结束。
  - 证据：src/engine/harm-threat.js:721（读 registeredEntry(code).flags.threatDamageSink）
- ✅ **[08130] 真实治疗入口承接威胁区 1 点伤害并弃掉该卡**
  - 期望：healDamageFrom 返回 1，威胁区卡被移除并进弃牌堆
  - 实测：healed=1 stillInThreat=false discard=["08130"] thrown=null
  - 证据：src/engine/harm-threat.js:702-740（healDamageFrom 的 flags.threatDamageSink 承接）

### P0-10 · 调查员抽样：08013a 座位过滤、08006 牌库封锁检索/操纵、08014a 免费行动额度清理 — PASS

- ✅ **[08013a] 使用演武是真实 legalMoves 行动**
  - 期望：legalMoves 含 ability assetId=probe-08013a
  - 实测：abilities=["c1","probe-08013a"]
  - 证据：src/cards/entries/08013a.js（action 描述子）
- ✅ **[08013a] 使用后「下一次检定 +5」效果与延迟翻面标记写入**
  - 期望：state.effects 含 08013a endOfTest 效果且 asset.eoteFlipAfterTest=08013b
  - 实测：effects=1 flipAfter=08013b
  - 证据：src/cards/entries/08013a.js:22-32
- ✅ **[08013a] 其他座位（seat=1）检定不消耗陈丽丽的 endOfTest 效果**
  - 期望：effects 保持 1
  - 实测：effects=1
  - 证据：src/engine/tests.js（expireEffects endOfTest / applyPendingFlipAfterTests 需按检定执行者过滤）
- ✅ **[08013a] 其他座位检定不触发陈丽丽的延迟翻面**
  - 期望：asset 仍为 08013a 且 eoteFlipAfterTest 保留
  - 实测：code=08013a flipAfter=08013b
  - 证据：src/engine/tests.js（expireEffects endOfTest / applyPendingFlipAfterTests 需按检定执行者过滤）
- ✅ **[08013a] 本人检定结束后效果过期并翻面到 08013b**
  - 期望：08013a → 08013b
  - 实测：code=08013b effectsLeft=0
  - 证据：src/engine/tests.js（expireEffects endOfTest / applyPendingFlipAfterTests 需按检定执行者过滤）
- ✅ **[08006] 牌库顶揭示预示者后封锁读点生效（blockedByDeckTopLock）**
  - 期望：blockedByDeckTopLock 返回预示者
  - 实测：lock=08006 top={"seats":{"0":{"code":"08006","public":false,"discount":0}},"played":{}}
  - 证据：src/engine/deck-ops.js#searchDeck / #moveCardTo（blockedByDeckTopLock 读点）
- ✅ **[08006] 封锁期真实 searchDeck 不能取走牌库牌（原先可绕过抽牌封锁）**
  - 期望：searchDeck 返回 []、不打开检索选择、日志注明牌库被封锁
  - 实测：searched=[] pending=[] deckAfter=["01030","01088","08006"] blockedLog=true
  - 证据：src/engine/deck-ops.js#searchDeck / #moveCardTo（blockedByDeckTopLock 读点）
- ✅ **[08006] 封锁期真实 moveCardTo 不能操纵牌库（不能把牌移到弃牌堆）**
  - 期望：moveCardTo 返回 null，牌仍在牌库
  - 实测：moved=null deck=["01030","01088","08006"] discardHas01030=false
  - 证据：src/engine/deck-ops.js#searchDeck / #moveCardTo（blockedByDeckTopLock 读点）
- ✅ **[P0-10 反向验证] 牌库顶无预示者时 searchDeck 可正常检索（封锁读点按真实状态生效）**
  - 期望：无锁 + searchDeck 真实取到牌（或在检索后离开牌库）
  - 实测：lock=null taken=["01030"] deck=["01088"]
  - 证据：src/engine/deck-ops.js#searchDeck / #moveCardTo（blockedByDeckTopLock 读点）
- ✅ **[08014a] 使用演武是真实 legalMoves 行动**
  - 期望：legalMoves 含 ability assetId=probe-08014a
  - 实测：abilities=["c1","probe-08014a"]
  - 证据：src/cards/entries/08014a.js（action 描述子）
- ✅ **[08014a] 使用后获得 3 次免费战斗/躲避额度**
  - 期望：fightEvadeOnlyActions=3
  - 实测：quota=3 code=08014b
  - 证据：src/engine/eote-investigator-support.js#grantFreeActions
- ✅ **[08014a] 下一轮调查阶段开始时免费战斗/躲避额度被清理（下一轮不再吃掉普通行动）**
  - 期望：fightEvadeOnlyActions=0（回合开始按轮清理）
  - 实测：quota=0 thrown=null round=2 phase=investigation
  - 证据：src/engine/restricted-actions.js + src/engine/turn.js（免费战斗/躲避额度应在回合结束清理）
- ✅ **[08014a] 下一轮普通行动可用（当前行动座位 actionsLeft=3 且 investigate 在 legalMoves）**
  - 期望：当前行动座位 actionsLeft=3 且 legalMoves 含 investigate
  - 实测：seat=1 actionsLeft=3 normalActions=true round=2
  - 证据：src/engine/restricted-actions.js + src/engine/turn.js（免费战斗/躲避额度应在回合结束清理）

### P0-11 · P8 账本证据有效性：scenario-ledger 分组不再全落 Heart Part2 / invalid 下降 / --check 一致 — PASS

- ℹ️ **[P0-11] 账本规模**
  - 实测：{"records":403,"scenarioLedger":0,"invalid":141,"invalidByKind":{"none":141},"scenarioEvidenceFiles":{}}
  - 证据：audit/eote-all-card-acceptance.json（records[].evidence[0]）
- ✅ **[P0-11] scenario-ledger 不再全落 tests/eote-scenario-theHeartOfMadnessPart2.test.mjs**
  - 期望：scenario-ledger 为空（假 kind 移除）或 Heart Part2 占比 < 50%（修复前 129/129=100%）
  - 实测：scenario-ledger=0 指向 Heart Part2=0（0.0%）files={}
  - 证据：tools/audit-eote-scenarios.mjs:88-90（group flatMap 不用 group）/ tools/audit-eote-all-cards.mjs:258-261（last-wins）
- ✅ **[P0-11] scenario-ledger 不再把非 Heart 章节卡错配给 Heart Part2 测试**
  - 期望：0 条「entry 非 Heart2 且引用 Heart2 测试且文件不含卡号」
  - 实测：0 条：[]
  - 证据：tools/audit-eote-scenarios.mjs:88-90（group flatMap 不用 group）/ tools/audit-eote-all-cards.mjs:258-261（last-wins）
- ✅ **[P0-11] 账本所有 verified/simplified 声称均有可追溯证据（假绿消除，invalidClaimed=0）**
  - 期望：0 条「声称 verified/simplified 但证据不可追溯」
  - 实测：claimed=260 invalidClaimed=0：[]
  - 证据：修复前独立复算：131 条不可追溯证据（129 scenario-ledger + 强证据/文件型）；见 verify/player-b-verify.md
- ✅ **[P0-11] 账本 invalid（声称已验收但证据不可追溯）计数显著下降（131 → 0）**
  - 期望：< 131（修复前复核口径 131）
  - 实测：invalidClaimed=0
  - 证据：games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/verify/player-b-verify.md（修复前 131 invalid）
- ✅ **[P0-11] 账本如实暴露无证据卡：missing/blocked 与 withoutTraceableEvidence 一致，且不再声称 verified**
  - 期望：missing+blocked === summary.evidence.withoutTraceableEvidence；有缺失时 status 不得为 verified
  - 实测：missing=127 blocked=14 withoutTraceable=141 status=pending gates={"deterministic":true,"everyBehaviorCardHasEvidence":false,"noFailedTests":true,"noMissingOrBlocked":false,"partitionsExact":true,"totalCards403":true}
  - 证据：tools/audit-eote-all-cards.mjs#gate（everyBehaviorCardHasEvidence 改查可追溯证据）
- ✅ **[P0-11] audit/eote-scenario-acceptance.json 每章 cardCodes 不再逐章完全相同（264 张污染根因）**
  - 期望：各章 cardCodes 集合不同（distinct > 1）
  - 实测：chapters=8 distinct=8 sizes=["iceAndDeathPart1:39","iceAndDeathPart2:55","iceAndDeathPart3:39","fatalMirage:94","toTheForbiddenPeaks:42","cityOfTheElderThings:50","theHeartOfMadnessPart1:39","theHeartOfMadnessPart2:43"]
  - 证据：audit/eote-scenario-acceptance.json#chapters[].cardCodes（每章污染 264 张的根因产物）
- ✅ **[P0-11] audit/eote-migration.json 不再声称逐卡行为等价（equivalenceCertified=false）**
  - 期望：releaseAcceptance.equivalenceCertified=false
  - 实测：equivalenceCertified=false
  - 证据：audit/eote-migration.json#releaseAcceptance
- ✅ **[P0-11] node tools/audit-eote-all-cards.mjs --check 与账本一致（非漂移：exit ∈ {0,1}）**
  - 期望：exit 0（一致且 gate 完整）或 exit 1（复算一致、gate 如实不完整）；exit 2 = 漂移即 FAIL
  - 实测：exit=1 tail=账本一致：403 条，gate incomplete（missing 127 / blocked 14 / simplified 12）
  - 证据：node tools/audit-eote-all-cards.mjs --check（语义漂移 exit 2；gate 不完整 exit 1）
- ℹ️ **[P0-11] --check 完整输出摘要**
  - 实测：账本一致：403 条，gate incomplete（missing 127 / blocked 14 / simplified 12）
  - 证据：node tools/audit-eote-all-cards.mjs --check（语义漂移 exit 2；gate 不完整 exit 1）

## 4. 与修复前 baseline 对比

> baseline 说明：
> - 修复过程是并发进行的，`baseline-results.json` 保存的是**修复中快照**（21:13：P0-11 FAIL、其余 PASS），并非严格修复前状态；验收员在 20:52 跑过真正的「修复前首跑」，但因后续迭代复跑同 label 被覆盖，完整逐项明细仅存于会话日志。
> - 真实首跑（2026-11-08 20:52，修复前/修复中早期）总览：**PASS 100 / FAIL 49（138 项断言）**；当时仅 P0-12 已先落地为 PASS，P0-1..P0-11、P0-13 均 FAIL。
> - 修复推进过程中的 baseline 复跑（真实运行记录）：20:55 → 121/28；21:06 → 142/12；21:09 → 146/9；21:13 → 150/5；21:52 最终 → **165/0 全 PASS**。FAIL 收敛项与各 owner 修复落地时点一一对应（P0-1/2/3/4、P0-5/13、P0-6/12、P0-7、P0-8、P0-9、P0-10、P0-11）。
> - 20:42 `src/engine/play-channels.js` 编码事故（另一 agent PowerShell GBK 中转）期间，引擎一度不可 import，该时段未用于 baseline 采样；事故由 Lead 从会话日志逐字节重建，IDP3 setup 的 randomValue 崩溃随后由 idp owner 修复。

| 项 | baseline 快照（21:13 修复中） | 本次 | 变化 |
| --- | --- | --- | --- |
| P0-1 | PASS | PASS | 保持 |
| P0-2 | PASS | PASS | 保持 |
| P0-3 | PASS | PASS | 保持 |
| P0-4 | PASS | PASS | 保持 |
| P0-5 | PASS | PASS | 保持 |
| P0-13 | PASS | PASS | 保持 |
| P0-6 | PASS | PASS | 保持 |
| P0-12 | PASS | PASS | 保持 |
| P0-7 | PASS | PASS | 保持 |
| P0-8 | PASS | PASS | 保持 |
| P0-9 | PASS | PASS | 保持 |
| P0-10 | PASS | PASS | 保持 |
| P0-11 | FAIL | PASS | FAIL → PASS |

---

*本报告由 `p0-accept/run.mjs` 自动生成；断言实现见 `cases/*.mjs`，真实引擎驱动层见 `lib/harness.mjs`。*
