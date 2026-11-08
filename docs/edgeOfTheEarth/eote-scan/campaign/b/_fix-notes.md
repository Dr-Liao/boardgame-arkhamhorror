# Fatal Mirage P0-5 / P0-13 修复记录（修复小组 · fatal-mirage）

日期：2026-11-08（Asia/Shanghai）。写入范围：`content/campaigns/edgeOfTheEarth/scenarios/fatalMirage/**`、
`tests/eote-scenario-fatalMirage.test.mjs`、`docs/edgeOfTheEarth/eote-scan/campaign/b/**`（探针/本记录）。
未修改 `src/engine/**`、`audit/**`、`tests/fixtures/**`、`tests/suites.mjs`、索引文件；未 git commit。

## 一、复现（修复前基线）

```powershell
# 1) 议程推进 throw（真实 advanceAgenda 入口）
node docs/edgeOfTheEarth/eote-scan/campaign/b/tools/repro.mjs
# -> v1 after setup: agendas 1 agendaIndex 0 threshold 15
# -> v1 REPRODUCED THROW: 密谋规则尚未迁移：08550
# -> v2 after setup: agendas 1 agendaIndex 1 current= undefined
# -> v2 advanceAgenda returned without throw; agendaIndex= 1 status= playing doom= 20

# 2) 钩子缺失 + v2/v3 索引越界
node docs/edgeOfTheEarth/eote-scan/verify/_probe-runtime.mjs
# -> agendaReveal hook: undefined / actReveal hook: undefined / resolution hook: undefined
# -> v1 checkAgenda THROW: 密谋规则尚未迁移：08550
# -> v2 agendas: 1 agendaIndex: 1 agenda at index: undefined

# 3) 08549 标记数值全 0
node docs/edgeOfTheEarth/eote-scan/verify/_probe-token.mjs
# -> fatalMirage cultist {"value":3,...} tablet {"value":3,...} elderthing {"value":3,...}   # delta 全 0
# -> theHeartOfMadnessPart2 tablet {"value":0,...}                                            # 对照 -3
```

另：真实 hub 路径 setup 后 `locations` 只有 `prisonOfMemories` 且 `clues=0`、`investigate` 标签为
「智识 vs 帷幕 NaN」、`legalMoves` 无翻面行动；`state.campaign.records.fatalMirageTimes` 永不写。

## 二、修复后验证（真实引擎路径）

```powershell
# 综合探针（生产组合根 content/registered.js + tests/eote-p8-fixture.mjs 真实大厅流程）
node docs/edgeOfTheEarth/eote-scan/campaign/b/_fix-realpath.mjs
# -> 93/93 PASS；ALL PASS
#    A 布置：议程 08550/1a/阈值15、幕 08553/1a、索引 0；记忆囚笼 revealed=true 且 clues=6；
#            帷幕=1（不再是 NaN）；18 地点放一边；9 记忆敌人；Tekeli-li 牌库 16 张；
#            7 张弱点不再进主遭遇牌库、Chilling Cold 已 gather；19 地点帷幕/线索数据齐全。
#    B 调查 → 线索；legalMoves 出现「花线索翻面」，performAction 真实翻面揭示大本营（revealed、6 线索）。
#    C 议程达到 15 毁灭 → 真实 advanceAgenda 不再 throw，背面击败全员，noResolution 正常结算且记录写入。
#    C2 真实神话阶段（endTurn 推进到第 2 轮）触发 checkAgenda → uiState=scenarioResult / noResolution /
#      records 写入；另验证「直接调用 checkAgenda」时结局已落盘（resolution/campaign.phase/scenarioResults/records），
#      只有 hub 的 uiState 过渡属于 dispatch.settleScenarioBoundary。
#    D 飞机场翻面生成记忆敌人（生命 4/人×2=8）→ 真实 defeatEnemy 触发记忆剧情 → 记录高田直面恶魔 /
#      08577b 进胜利区 / 允许推进幕 → legalMoves「推进当前幕」→ victory 结局；records 写
#      fatalMirageTimes/Resolution/Completed、memoriesBanished/memoriesDiscovered/resolutePartners。
#    E 三次重入：08550/1a/15 → 08551/2a/13 → 08552/3a/11（幕 08553/08554/08555 同步），
#      每次 agendaIndex=0 不越界，advanceAgenda 均正常结算，fatalMirageTimes 递增 1/2/3，之后回主线。
#    F 真实 performTest：standard cultist -2 / tablet -3 / elderthing -4；hard tablet -4 / elderthing -5；
#      skull -X（X=胜利区剧情卡数，2→-2，与 verifier 修正后的印刷口径一致）；hard skull -(X+当前密谋编号)= -3；
#      对照 theHeartOfMadnessPart2 tablet -3（修复前 fatalMirage 三个符号全 0）。
#    G 标记失败追加效果：cultist 失败把 1 个线索放到所在地点；tablet 失败洗入忒咳哩-哩牌库顶 1 张；
#      elder_thing 失败在[[幻灵]]敌人上放 1 个毁灭标记。

# 章节测试（真实引擎用例含：token 真实 performTest + 真实大厅议程推进）
node --test tests/eote-scenario-fatalMirage.test.mjs
# -> tests 10 / pass 10 / fail 0
```

### 2.1 verifier 抓的「全灭后 checkAgenda 未落 noResolution」复核

verifier 的观察（`status` 仍 `playing`）**不是缺少读点**，而是「引擎边界」与「直接调用引擎函数」的差异：

- 规则/引擎事实：`status` 在对局层保持 `playing` 直到战役结束；单关结束由 `state.resolution`、
  `campaign.phase='resolution'`、`campaign.scenarioResults.at(-1)` 与 hub 的 `uiState` 表示。
- 本轮把 **结局落盘提前到 `behavior.agendaReveal` 末尾**（击败剩余调查员后立即 `api.finish('noResolution')`，
  满足规则「没有存活调查员 → 无结局」，也不再依赖 `advanceAgenda` 之后的 `checkOutcome` 兜底）。
- 真实动作路径（`applyMove` → `executeCommand` 捕获 `ScenarioEnded` → `settleScenarioBoundary`）下：
  第 2 轮神话阶段 `checkAgenda` 触发 → `uiState='scenarioResult'`、`resolution='noResolution'`、
  `records.fatalMirageTimes=1`、`records.fatalMirageResolution='noResolution'`（探针 C2.1–C2.5）。
- 直接调用 `world.engine.checkAgenda(state, [])`（不经 dispatch，verifier 常用形态）时 `ScenarioEnded`
  抛到调用方；**结局已落盘**：`state.resolution='noResolution'`、`campaign.phase='resolution'`、
  `scenarioResults` 已登记、`records` 已写（探针 C2.6–C2.10）；只有 hub 的
  `uiState→scenarioResult` 过渡属于 `src/engine/dispatch.js:183-209 settleScenarioBoundary`，
  直接调用不会执行它。若在 `resolveTransaction` 的 execute 内把 `ScenarioEnded` 吞掉，事务会提交半程
  状态（仍需真实 `applyMove` 才能完成 hub 过渡）。

> 修复前探针 `verify/_probe-runtime.mjs` 的抛错是「密谋规则尚未迁移：08550」；修复后手搓状态探针会在结算处
> 因缺少完整战役而抛 `Cannot read properties of null (reading 'scenarioIds')`——两者都不是产品路径证据，
> 以 `_fix-realpath.mjs` 为准。

## 三、逐项修复与真实读点（file:line）

| P0 项 | 修复 | 真实引擎读点 |
| --- | --- | --- |
| 议程推进 throw（agendaReveal 缺失） | `behavior.js:721 agendaReveal`（背面：v1 洗入 1 张忒咳哩-哩并击败，v2 二选一，v3 精神创伤并击败） | `src/engine/phases.js:268-283 runAgendaReveal` → `src/engine/act-agenda.js:326-373 advanceAgenda` |
| 幕目标不可达 / 无 actReveal | `behavior.js:690 actReveal`（幕背面 → `api.finish('victory')`）+ `behavior.js:655 performAction` 的「推进当前幕」行动（`behavior.js:645 actions` 暴露，`fatalMirageMayAdvance` 由直面恶魔/放逐记忆置位，`behavior.js:376 enemyDefeated`、`behavior.js:506 flipStoryFace`） | `src/engine/reveal.js:151-176 runActReveal` → `src/engine/act-agenda.js:53-89 advanceAct`；`src/engine/dispatch.js:632-633 scenarioAction` |
| v2/v3 agendaIndex 越界、阈值恒 15、stage 恒 1a | `definition.js:84 AGENDA_STAGES` / `:86 ACT_STAGES`（`stage()` 取 08550/08551/08552 与 08553/08554/08555 的印刷 doom/stage）；`behavior.js:197 prepareScenario` 按版本重建 `state.agendas/acts` 并把 `agendaIndex/actIndex` 归 0 | `src/engine/setup.js:639-648` 的 `state.agendas/agendaIndex`；`src/engine/act-agenda.js:331-332` |
| 19 幻景地点 0 线索 / 花线索翻面循环不可用 | `definition.js:72 LOCATIONS` 取印刷 `clues`/`shroud` 并附 `mirage/tier/storyCode`；`behavior.js:144 mirageClueTotal`（按指南 Mirage：每玩家基础线索 - 幻景值×已入场/已放逐目标数）；`behavior.js:342 locationPlaced`（引擎入场读点）；`behavior.js:357 locationShroudModifier`（记忆囚笼帷幕=当前密谋编号）；`behavior.js:645 actions`/`:655 performAction`（`mirageFlip:*`：共同支付 tier×在地调查员数 的线索，`api.payGroupClues`） | `src/engine/locations.js:143-178 placeLocation`/`:251-287 revealLocation`；`src/engine/moves.js:222 actions`；`src/engine/dispatch.js:633`；`src/engine/actions.js:587 locationShroudModifier` |
| 28 张关联面 `flipStoryFace` 无引擎调用点 | `behavior.js:365 locationStory`（performAction → `api.flipLocation` → `src/engine/locations.js:180-190 flipScenarioLocation` 回调）；`behavior.js:376 enemyDefeated`（`src/engine/enemies.js:708` 击败读点，`enemyRule.flipOnDefeat`）；`behavior.js:506 flipStoryFace` 重写：地点剧情揭示记忆/生成记忆敌人/放逐记忆、记忆剧情记录直面恶魔+切坚毅+进胜利区 | `src/engine/locations.js:180-190`；`src/engine/enemies.js:673-739 defeatEnemy`；`src/engine/scenario-runtime.js:1571 flipLocation` |
| resolution 记录钩子缺失 / 全灭 noResolution 记录缺失 | `behavior.js:875 resolution`（fatalMirageTimes/Resolution/Completed、memoriesDiscovered（卡号）/memoriesBanished（剧情卡号）、resolutePartners、xp 镜像）；`behavior.js:721 agendaReveal` 末尾在击败全员后立即 `api.finish('noResolution')`；version 计数修复见 `behavior.js:79 fatalMirageVersion`（scenarioResults/records 取最大值，避免双重计数） | `src/engine/campaign-flow.js:241-300 applyResolutionEffects`；`src/engine/harm-threat.js:354-361 checkOutcome` |
| P0-13 08549 标记数值全 0 | `chaos.js:12 FATAL_MIRAGE_TOKEN_MEANINGS` 改为引擎可读对象；`chaos.js:60 fatalMirageChaosToken`（skull=-X/-(X+密谋编号)、cultist -2、tablet -3/-4、elderthing -4/-5）；`behavior.js:763 resolveChaosToken`；`behavior.js:844 afterTest` 结算失败追加效果 | `src/engine/treachery-tokens.js:348-393 resolveSpecialToken`；`src/engine/tests.js:1120-1122`（普通路径）、`:1277/:1506-1517`（afterTest） |
| 遭遇牌库组成（P0-13 依赖 + 参考 Setup） | `definition.js:20 GATHER_GROUPS` 补 ChillingCold；`:114 ENCOUNTER_DECK` 排除 7 张忒咳哩-哩弱点；`:27 TEKELI_FACES/:28 TEKELI_COPIES`；`behavior.js:197 prepareScenario` 用 `initializeTekeliDeck` 建 16 张牌库；`definition.js:130 defs` 补记忆敌人定义（供 `api.spawn`） | `src/engine/setup.js:807-815`；`src/engine/eote-tekeli.js:63-91`；`src/engine/enemies.js:525-526 healthPerInvestigator` |

`index.js`：`requiredEncounterGroupIds` 补 `chillingCold`；`recordWrites` 补 9 个「直面恶魔」布尔记录（均在
`content/campaigns/edgeOfTheEarth/records.js` 的 `recordSchema` 内）。

## 四、测试

`tests/eote-scenario-fatalMirage.test.mjs`（10 例，`node --test` 全绿）：

1. 章节结构/story-access；
2. 三次重入版本（阈值 15/13/11、阶段 1a/2a/3a、索引不越界）；
3. Mirage 关键词（线索扣减/翻面费用/揭示下一层记忆，performAction 契约）；
4. 地点剧情生成记忆敌人 → 击败后 hostile→坚毅切换 + 记录 + 胜利区 + 可推进幕；
5. 伙伴被划掉 → 放逐记忆（回记忆囚笼、剧情卡进胜利区、地点离场）；
6. 代表条目 + catalog 标记数值（含困难分支）；
7. **P0-13 真实 performTest 标记 delta**（cultist/tablet/elderthing/skull/困难分支，对照 Heart of Madness Part2）；
8. 08592 真实引擎内伙伴攻击（原有用例保留）；
9. 结局记录写入 + JSON 存档往返 + version 不双重计数；
10. **真实大厅路径**议程达到阈值后推进（不再 throw、背面击败全员、noResolution 结算与记录）。

## 五、未覆盖 / 剩余风险（如实披露）

1. **本任务只覆盖 P0-5/P0-13 验收口径**；审计报告里 Fatal Mirage 其余 high（08549 entry 的 flags 数据、
   08550 正面 `[fast]` 移动能力、19 地点各自的 forced/reaction 细节、9 张记忆敌人的战斗反应、
   9 张坚毅伙伴的 partnerRules 能力、08585/08586 显现等）**未在本次修复**；它们多数仍是「声明未接线」，
   需要后续轮次逐条落地或降级披露（未新增声明，未删除既有声明）。
2. **伙伴入场路径**（choosePartner 的生产调用点 / 检查点名册带入）未接；真实对局中 `isAlive` 读的是
   既有战役伙伴名册，若前序检查点已划掉伙伴，记忆敌人将走「放逐记忆」分支（符合规则）。
3. **遭遇牌库份数**：沿用以 code 列表建堆的既有口径，08584/08585/08586 的印刷 3 份未展开（EOTE 其它章同样
   口径，属既有近似）。
4. **跨范围基线**：`tests/replay-eote-p8.test.mjs` 的 golden 指纹与 `tests/eote-all-cards.test.mjs` 的审计账本
   因工作区多人并行改动（引擎/其它章节/审计工具）已漂移，需由主进程重生成 `tests/fixtures/replay/eote-p8-baseline.json`
   与 `audit/eote-all-card-acceptance.json`；不在本任务写入范围（`tests/fixtures/**`、`audit/**`）。
   实测：`node --test tests/eote-p8-campaign.test.mjs tests/eote-p8-multiplayer.test.mjs tests/eote-p8-registration.test.mjs
   tests/eote-campaign-flow.test.mjs tests/eote-scenario-shared.test.mjs tests/eote-primitives-flow.test.mjs`
   → 87/87 pass（fatalMirage 三次进入/回场/失败分支均覆盖）。
5. **旧 in-process 探针**（`tools/repro.mjs`、`verify/_probe-runtime.mjs`）修复后会在结算处报探针构造错误，
   不应作为修复后验收证据；以 `_fix-realpath.mjs` 为准。
