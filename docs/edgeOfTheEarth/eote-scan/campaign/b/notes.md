# 致命幻景（Fatal Mirage）战役卡审计 · campaign-auditor-b

范围：`games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/scope/shards.json#campaign-auditor-b.codes`（75 条 = 08549–08555 + 08556–08574 地点 + 19 张 b 面地点故事卡 + 08575–08583 记忆敌人 + 08575b–08583b 记忆敌人故事卡 + 08584/08585/08586 + 08587–08595 坚毅伙伴）。
只读审计：未修改 `games/arkhamhorror/**`；只写 `games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/campaign/b/**`。

## 一、结论总览

- 75 条：**match 0 / approximation 3 / gap 72 / blocked 0**。3 条 approximation = 08589、08592、08593（坚毅伙伴能力有实现但计时/效果近似）；其余 72 条均有 missing 子句。
- issues：**high 120 / medium 50 / low 1**（含 20 条场景级 issue）。维度分布：impl-vs-text 91、primitive 45、runtime 28、duplication 6、tests 1。
- 账本（`audit/eote-all-card-acceptance.json`）：58 verified / 17 simplified。**独立复核结论：58 张 verified 中无一能按 D1 判 match；其中 60/75 张的 evidence 是同一条错误证据**（见 §七）。
- 一句话：**致命幻景目前是「数据骨架 + 仅测试可调的 behavior 函数」，真实引擎路径上核心循环（幻景翻面、记忆敌人、议程/幕推进、结局记录）不可用；唯一能跑通的是「幕间点门进入 → 布置 → ……（卡住）」。**

## 二、运行过的命令与结果

```powershell
cd G:\boardgame-hall-ai\games\arkhamhorror
node --experimental-test-isolation=none --test tests/eote-scenario-fatalMirage.test.mjs tests/eote-scenario-shared.test.mjs
# -> 27 tests / pass 27 / fail 0（fatalMirage 8 条 + shared 19 条），约 4.3s
node games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/campaign/b/tools/repro.mjs   # 引擎路径复现议程推进
# -> v1 REPRODUCED THROW: 密谋规则尚未迁移：08550
# -> v2 after setup: agendas 1 agendaIndex 1 current= undefined
# -> v2 advanceAgenda returned without throw; agendaIndex= 1 status= playing doom= 20（永不推进）
```

测试通过 ≠ 实现正确：8 条 fatalMirage 测试全部是**直接调用 behavior/条目**的单元测试，没有一条走真实引擎 `startScenario` / `applyResolutionEffects` / 遭遇抽牌路径。断言强度见 §六。

## 三、Top 发现（file:line）

1. **议程推进即崩溃（已 in-process 复现，high）**：`definition.js:146-147` 把幕/议程 reveal 设为 `campaignRule`，`behavior.js:302-323` 没有 `agendaReveal`/`actReveal`；`src/engine/phases.js:276-278` 在无钩子时 `throw new Error('密谋规则尚未迁移：08550')`。版本 1 的议程一旦达到 15 毁灭阈值，真实对局直接抛错。
2. **版本 2/3 议程永不推进（已复现，high）**：`behavior.js:69-74` 把 `agendaIndex` 设为 `version-1`，但 `state.agendas` 只有 1 张（`definition.js:147`）→ `state.agendas[1/2]` 为 undefined；`advanceAgenda` 静默返回，doom 累积到 20 也不推进。同时版本 2/3 的 `doomThreshold` 仍取 08550 的 15（应 13/11）、act stage 恒为 1a。
3. **所有 19 个幻景地点线索值为 0（high）**：`definition.js:66-69` 以 `location({... cluesFixed:false, clues:0 })` 生成，`content/campaigns/edgeOfTheEarth/card-data.js:32-41` 因此写 `cluesPerInvestigator:0`；`behavior.js:138-148` 的 `placeLocation` 又硬写 `clues:0,maxClues:0`。幻景地点的线索=幻景数值×未入场记忆数，0 线索使「共同花线索翻面」永远无法执行，整章核心循环不可用。
4. **声明即接线大面积违反（high）**：19 个地点的 `mirageId/tier/reactionInvestigate/forcedInvestigate/forcedReveal/forcedOnFrostReveal/forcedOnCluesDiscovered/forcedTekelili*/forcedFirstEntry/forcedTreacheryAttach/investigatorShroudBonus/extraInvestigateCost/moveCost/freeFrostForClues/shroudBonusIfTreacheryAttached/actionShuffleTekelili/forcedAfterInvestigate/locationModifier` 在 src+content 全仓只有条目自身声明，**无任何生产读点**（唯一命中是 `tests/eote-scenario-fatalMirage.test.mjs:142-144` 断言 flag 存在）。28 张关联面共用的 `flags.storyFlip` 唯一读点是 `behavior.js:197-265 flipStoryFace`，而该函数全仓**没有任何引擎/内容调用点**（仅测试直调）→ 关联面数据是死数据。
5. **记忆敌人/坚毅伙伴核心机制未接线（high）**：`enemyRule.flipOnDefeat`（08575–08584）、`preyPartner`、`reaction*` 系列、`flags.partnerRules`、`storyFlip.resolutePartner/record/victoryOnBanish` 全部无读点；9 张记忆敌人无 `abilities`；`flipStoryFace` 里生成记忆敌人用印刷固定 health（`behavior.js:224-231`，忽略 `healthPerInvestigator`）。即使调用 `flipStoryFace('08575b')` 也只会把卡放胜利区，不写「直面内心恶魔」、不切坚毅形态（`behavior.js:258-262`）。
6. **结局/记录不闭环（high）**：引擎读 `behavior.resolution`（`src/engine/campaign-flow.js:241-243`），fatalMirage behavior 只有 `scenarioResolution`（没有 `resolution` 键）→ `fatalMirageTimes/fatalMirageResolution/memoriesDiscovered/memoriesBanished/partnersFacedInnerDemon/xp` 在真实路径永不写；`index.js:29-34` 的 recordReads/Writes 成为死声明。且 `scenarioResolution` 的 XP 口径错误（`behavior.js:276-296`：用「b 码数量」而非 story 卡 victory 值之和；正则不含 08575b–08583b）。
7. **混沌标记 rider 全缺（high）**：08549 的 cultist/tablet/elder_thing 失败追加效果未实现（`chaos.js:6-34` 只有数值；behavior 无 `afterTest`，对比同族 `scenarios/iceAndDeathPart2/behavior.js:355-374`）。
8. **遭遇牌组错误（high）**：`definition.js:19-22 GATHER_GROUPS` 漏 Chilling Cold（参考 Setup 要求 gather 8 组，mod `ENCOUNTER_DECK` 只有 22 张；参考实现 `Scenario/Scenarios/EdgeOfTheEarth/FatalMirage.hs:191-198`），Tekeli-li 组 7 张弱点被洗进主遭遇牌库且没有初始化忒咳哩-哩牌库（`index.js:26 requiredMechanicIds: []`；其他章节如 `iceAndDeathPart1/behavior.js:114` 有 `initializeTekeliDeck`）。
9. **08585/08586 真实抽到是 no-op（medium→high 影响）**：`encounterDefinitions` 给所有诡计 `entryRevelation:true`（`card-data.js:72-74`），`treachery-tokens.js:113-124` 只认 `encounterResolve`/`treacheryRule.test`，而本二卡只有无读点的 `treacheryRule.attachToNearestUnflippedLocation` / `treacheryRule.chooseOne`，本章 behavior 又没有 `resolveEncounter` → 卡被弃掉、什么也不发生。
10. **账本证据虚假（high/账本级）**：见 §七。
11. **simplified 披露链断裂（medium）**：17 张简化卡的 reason 指向 `p7-08560`/`p7-08587`，但 `artifacts/migration/eote/primitive-requests/` 下**不存在**这两个请求 JSON（全仓只有 audit 两个文件出现这些 id）；条目头注释无近似说明；`known-deviations.scenarioApproximations` 与 scenario-integrity 的 `approximationMarkers` 均为空。详见 §五。

## 四、D1 分类小结

| 类别 | 数量 | 结论 |
| --- | --- | --- |
| 08549 场景参考卡 | 1 | chaos 数值已实现（含困难分支）；4 个标记的失败 rider 全缺 → gap |
| 08550–08552 议程 3 版 | 3 | 正面 `[fast]` 与背面「其余调查员被击败…」只有 agendaRule 数据；无 agendaReveal；版本数据/索引错误 → gap |
| 08553–08555 幕 3 版 | 3 | `actRule:{}`；无目标判定/推进/揭示；→R1 不可达 → gap |
| 08556–08574 幻景地点 19 | 19 | Mirage 关键词整体缺失 + 每张地点的 forced/reaction 能力只有 flag → gap |
| 08556b–08574b 地点故事卡 19 | 19 | 数据驱动（choices/放地点）在 `flipStoryFace` 内实现但引擎无调用点；翻回机制缺失 → gap |
| 08575–08583 记忆敌人 9 | 9 | 关键词（Alert/Retaliate）由敌人定义解析；prey/flip-on-defeat/reaction 全缺 → gap |
| 08575b–08583b 记忆故事卡 9 | 9 | `resolutePartner/record/victoryOnBanish` 键无读点；「加入胜利区」只有数据 → gap |
| 08584 恐怖阴影 | 1 | 关键词已解析；loses-aloof/doom-on-clue 未实现 → gap |
| 08585/08586 诡计 2 | 2 | 显现无实现（no-op）→ gap |
| 08587–08595 坚毅伙伴 9 | 9 | 3 张（08589/92/93）有 ability 但 [fast] 被实现成花行动 + 效果近似；6 张 `abilities: []`；且真实引擎无伙伴入场路径 → 3 approximation + 6 gap |

关键对照参考实现：`参考资源/ArkhamHorror-main/backend/arkham-api/library/Arkham/Scenarios/EdgeOfTheEarth/FatalMirage/Helpers.hs`（mirage 能力、clue 调整、handleMemory、mayAdvance）、`Location/CardDefs/EdgeOfTheEarth/FatalMirage.hs`、`Scenario/Scenarios/EdgeOfTheEarth/FatalMirage.hs`（Setup/FailedSkillTest/ScenarioResolution）。

## 五、24 → 17 与 simplified 逐条复核

- 任务卡写「24 张账本标 simplified」；本分片 75 条中实际命中 **17 张**（`08560/61/62/65/66/67/71/72` + `08587–08595`）。全账本 26 张 simplified 的其余 9 张（08544、08546、08673、08679、08681、08682 等）在其他分片。
- 17 张的 `reason` 全部引用 `pending-primitive: p7-08560 / p7-08587`；`artifacts/migration/eote/primitive-requests/` 实际只有 p7-08503…p7-08731 共 25 个文件，**没有 p7-08560.json / p7-08587.json**；`audit/eote-migration.json#releaseAcceptance.deferred` 的 `pendingBehaviorRequests` 文本声称「对应请求逐条列在本 deferred 的 primitiveRequest:* 中」，但列出的 primitiveRequest:* 不含这两项 → **披露链断裂**。
- 复核判定（「账本 reason vs 现状」）：

| code | 名称 | 账本 reason | 请求文件 | 复核判定 | 证据 |
| --- | --- | --- | --- | --- | --- |
| 08560 | 树篱迷宫 | pending-primitive: p7-08560（近似已披露，不阻塞 gate） | 不存在 | **披露不足：实际缺失（high）** | `08560.js:12`（mirageId/tier/shroudPlus1AndCannotLeave 无读点）；`definition.js:66-69`（线索 0） |
| 08561 | 荒废车站 | 同上（p7-08560） | 不存在 | 实际缺失（high） | `08561.js:9-14`（shroudBonusIfTreacheryAttached 无读点） |
| 08562 | 沿海水域 | 同上（p7-08560） | 不存在 | 实际缺失（high） | `08562.js:9-14`（forcedOnFrostReveal 无读点） |
| 08565 | 耸立岩石 | 同上（p7-08560） | 不存在 | 实际缺失（high） | `08565.js:9-14` |
| 08566 | 飞机场 | 同上（p7-08560） | 不存在 | 实际缺失（high） | `08566.js:9-20`（investigatorShroudBonus/extraInvestigateCost 无读点） |
| 08567 | 阿拉斯加荒野 | 同上（p7-08560） | 不存在 | 实际缺失（high） | `08567.js:9-20`（moveCost 无读点） |
| 08571 | 肯斯勒博士的办公室 | 同上（p7-08560） | 不存在 | 实际缺失（high） | `08571.js:9-16`（forcedAfterInvestigate 无读点） |
| 08572 | 摩艾石像 | 同上（p7-08560） | 不存在 | 实际缺失（high） | `08572.js:9-16` |
| 08587 | 威廉·戴尔教授 | pending-primitive: p7-08587 | 不存在 | 实际缺失（high）：`abilities: []`，[fast] 治愈能力无实现 | `08587.js:9-15` |
| 08588 | 丹佛斯 | 同上（p7-08587） | 不存在 | 实际缺失（high）：`abilities: []` | `08588.js:9-15` |
| 08589 | 伊里亚·阿什瓦克 | 同上（p7-08587） | 不存在 | 近似（medium）：ability 已实现但 [fast]→花行动、移动选择为近似 | `08589.js:16-30` |
| 08590 | 玛拉·辛哈医生 | 同上（p7-08587） | 不存在 | 实际缺失（high）：`abilities: []` | `08590.js:9-15` |
| 08591 | 艾弗里·克莱普尔 | 同上（p7-08587） | 不存在 | 实际缺失（high）：`abilities: []` | `08591.js:9-15` |
| 08592 | 詹姆斯·“曲奇”·弗雷德里克斯 | 同上（p7-08587） | 不存在 | 近似（medium）：ability 已实现但 [fast]→花行动；「本轮不能攻击」只写 info 日志（同基础伙伴 08719 的已知 deferred） | `08592.js:16-30` |
| 08593 | 艾米·肯斯勒博士 | 同上（p7-08587） | 不存在 | 近似（medium）：[fast]→花行动；看牌库顶只 `lookAt` 1 张，未实现「可弃掉」 | `08593.js:16-30` |
| 08594 | 罗尔德·埃尔斯沃思 | 同上（p7-08587） | 不存在 | 实际缺失（high）：`abilities: []` | `08594.js:9-15` |
| 08595 | 高田弘子 | 同上（p7-08587） | 不存在 | 实际缺失（high）：`abilities: []` | `08595.js:9-15` |

结论：**17 张 simplified 没有一张「如披露的近似」**——8 张地点与 6 张伙伴是实打实的 missing（high），3 张伙伴是近似但披露文字不足以说明差距；且「近似已披露」所依赖的 primitive 请求文件不存在。反之，账本里另外 11 张同机制地点（08556/57/58/59/63/64/68/69/70/73/74）被标 **verified**，与这 8 张简化卡的实现状态完全相同 → 账本内部口径自相矛盾。

## 六、测试与断言强度

- `tests/eote-scenario-fatalMirage.test.mjs`（8 test）覆盖：结构/pass story-access、三版 setup、伙伴/坚毅切换、记忆放逐、08556b/08560b 翻面（直接调 `flipStoryFace`）、代表条目 flags + chaos 数值、08592 在真实引擎结算一次攻击、结局函数 + JSON 往返。
- 弱点：
  1. 全部依赖**直接调用 behavior 函数**；没有 `startScenario`/引擎 setup/`applyResolutionEffects`/遭遇路径断言 → §三 1/2/4/5/6 的引擎级缺失全部测不到。
  2. 142-144 行断言 `flags.forcedAfterInvestigate`、`flags.evict` 等**声明存在**，恰好在为「无读点」背书；86-105 行第 91-92 行还有 `const basePartner = ... ? null : null; void basePartner` 的死代码。
  3. 结局测试（178-196 行）直接调 `scenarioResolution` 并手动 push 胜利区，不等于引擎会调用它。
  4. 61/75 张卡在 `tests-coverage` 中为 none（无任何测试标题命中）；14 张 file-only（仅测试文件包含卡号）。
- `tests/eote-scenario-shared.test.mjs` 27 test 中 shared 组覆盖伙伴名册/tekeli/frost 等共享原语（08575/08714 等共享组），但**不覆盖** fatalMirage 章节进程。
- 运行结果虽然全绿，但不可作为「章节可玩」证据。

## 七、账本虚假/弱证据（单独列出，供 Lead 汇总）

1. `audit/eote-all-card-acceptance.json`：本分片 75 条中 **60 条的 evidence 是同一条 `kind:"scenario-ledger"`，指向 `tests/eote-scenario-theHeartOfMadnessPart2.test.mjs`，chapter 字段写 `theHeartOfMadnessPart2`**。已核实该测试文件不包含本分片任何一个卡号，也不出现 `fatalMirage`/`致命幻景` → 证据无效；另 14 条为 file-only（只证明测试文件存在），仅 08556b 有 1 条 strong（且测试本身只覆盖 flipStoryFace 直调）。
2. `index.js:29-34` 的 `recordReads/recordWrites` 是「声明」而非接线：`fatalMirageResolution/fatalMirageCompleted/resolutePartners` 全仓无消费点，`scenarioResolution` 不在 behavior 里被引擎调用。
3. `known-deviations.entryMarkers` 在本分片为空；各条目头注释普遍写「幻景层与特殊规则由章节 behavior/遭遇结算读点消费」——**并不存在这样的消费点**（behavior 没有 resolveEncounter/locationStory/afterTest 等钩子），属误导性注释。
4. `games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/screen/flags-readpoints.json` 对本章扫描不全：`mirageId`/`tier`/`reactionInvestigate` 等键完全未出现在扫描结果（因扫描按「值 token 命中」近似，definition 里出现的 id 让部分 key 被误判为已读）；本章实际未读声明 ≥30 个键，screen 只报 52 条（其中一部分是 handler 字符串）。审计不能只依赖该 screen。

## 八、D3 章节流程（引擎路径）

- **进入/返回已验证存在**：幕间 I/II/III 的门选项 `next:'fatalMirage'`（`content/campaigns/edgeOfTheEarth/interludes.js:131,191,202,250,261`）；`parts.js:60,83-85,101-110` 的入口与 nextStep；`flow.js:46,74-84` 的 `fatalMirageReturn`（`stepReturn`，引擎支持：`src/campaign/campaign-flow.js:375-435`）；`flow.js:65-67` 每次进入 +1 `eoteFatalMirageEntries`（该记录目前无其它消费者）。3 个门在幕间 2/3 还受 `completedStep:'fatalMirage'`/`record:eoteEliminatedPartners ≥3` 条件控制，与参考 nextStep 顺序一致。
- **章节内部不可通关**：
  1. 议程推进抛错（§三-1，已复现）；
  2. 版本 2/3 议程索引越界（§三-2，已复现）→ 无 doom 时间压力；
  3. 幕没有推进/揭示实现（`actRule:{}`，无 `checkObjectives`/`actReveal`/`actIndexAfterAdvance`）→ R1 结局不可达；即 **只有全灭 noResolution 一条出口**，且该出口的结局记录也因无 `resolution` 钩子不写日志；
  4. 地点 0 线索 → 翻面动作不可用；
  5. 无伙伴入场（`preScenarioSetup` 缺失、`choosePartner` 无生产调用点，`src/engine/setup.js:740`），记忆敌人的「伙伴活着/被划掉」判定恒走兜底 true（`behavior.js:150-160`）；
  6. 结局后返回主线由 `stepReturn` 完成（工作正常），但 `fatalMirageTimes` 等记录不写，二次/三次进入的版本仍靠 `campaign.completedSteps`/scenarioResults 的 chapter id 计数（`behavior.js:42-50`）——目前恰好可用，但一旦补上 `resolution` 钩子会与 `fatalMirageTimes` **双重计数**（`completed.length + records.times + 1`），需同时改。
- 死锁判定：**是**（真实引擎路径无法正常结束本关；v1 在议程阈值处抛错，v2/3 议程永不推进）。

## 九、D4 未接线清单（本分片）

- 条目声明但无生产读点（逐键，全部仅出现在条目自身；部分被 screen 记为 unread）：`agendaRule.freeMoveToPrisonOfMemories`、`flags.agendaVersion`、`flags.mirageId`、`flags.tier`、`flags.reactionInvestigate`、`flags.forcedInvestigate`、`flags.forcedAfterInvestigate`、`flags.forcedReveal`、`flags.forcedOnFrostReveal`、`flags.forcedOnCluesDiscovered`、`flags.forcedTekeliliDraw`、`flags.forcedTekeliliReveal`、`flags.forcedFirstEntry`、`flags.forcedTreacheryAttach`、`flags.investigatorShroudBonus`、`flags.extraInvestigateCost`、`flags.moveCost`、`flags.freeFrostForClues`、`flags.shroudBonusIfTreacheryAttached`、`flags.actionShuffleTekelili`、`flags.locationModifier`、`flags.preyPartner`、`enemyRule.flipOnDefeat`、`flags.losesAloofAtFlippedLocation`、`flags.doomOnClueDiscover`、`flags.partnerRules`、`flags.attachLocationClues`、`flags.discardWhenLocationFlipped`、`treacheryRule.attachToNearestUnflippedLocation`、`treacheryRule.chooseOne`、`storyFlip.resolutePartner`、`storyFlip.record`、`storyFlip.victoryOnBanish`、`actRule`（08553–08555 全空）。
- 有「名义读点」但读点本身在引擎不可达：`storyFlip` → `behavior.flipStoryFace`（0 个引擎/内容调用点）；`scenarioResolution`/`choosePartner`/`eliminatePartner`/`fatalMirageVersion` 等 behavior 导出仅测试调用。
- 声明了但被 screen 误判为已读：`mirageId`/`tier`（值命中 definition 的 id）、`flags.version/actVersion`（token 命中其它模块的 'version'）、`flags.tokenMeanings`（引擎读的是 `state.scenario.tokenMeanings`，不是条目 flags）。
- 真正有引擎读点且实现正确的：08549 `tokenMeanings`（数值层面）、敌人关键词（Alert/Aloof/Hunter/Retaliate 由 `content/campaigns/edgeOfTheEarth/card-data.js:54-81` 解析进敌人定义）、伙伴 `uses/usesType`（实例创建侧）。
- 3 条可见 D4 越界嫌疑：`flipStoryFace` 写 `state.campaign.partners`/`state.campaign.resolutePartners`/`state.victoryDisplay`/`state.scenarioFlags` 等（content behavior 允许，但 `index.js` 的 recordWrites 未声明 `scenarioFlags.partnerSwitch` 与 `campaign.resolutePartners` 的读取方）；`scenarioResolution` 用 `setIn('memoriesBanished')` 去重逻辑对同一 key 反复 `setIn` 造成 O(n²)（低）。

## 十、D5 复用分析

- **三版议程**：`08550/08551/08552` 三条目除 `flags.version` 外完全重复（同样的 `agendaRule.freeMoveToPrisonOfMemories` + agendaVersion），且 `definition.AGENDA_VERSION_CODES` 已是第二份版本表 → 应收敛成「一份 agendaRule + 版本数据表」；`fatalMirageChaosTokenValue` 用 `state.agendaIndex+1` 冒充「当前密谋编号」并靠 setup 强写 agendaIndex，是重复实现版本机制的后果。
- **三版幕**：`08553/08554/08555` 全部 `actRule:{}` + version flag，同理。
- **幻景地点 19 张**：Mirage 是同一关键词能力，却没有任何共享原语/规则键；参考实现有 `mirage`/`mirageRunner`/`clearedOfMirages` 原语（Helpers.hs:51-124），本 mod 以 19 份不同 flag 名逐卡声明且无读点 → 应上收 `mirageLocation` 原语。
- **28 张关联面**：地点 b 面「选择一项→放入地点→翻回」模板 18 张重复；记忆敌人 b 面「记录直面恶魔→切坚毅→入胜利区」9 张重复；数据两份来源（`definition.MIRAGE_CHOICES` vs 各 b 条目 `storyFlip.choices`；`definition.MEMORY_LINKS` vs 各 b 条目 `storyFlip.memoryEnemy/partner`）→ 应各保留一份。
- **08549 标记数据三份**（条目 flags / chaos.js / definition）已漂移（tablet 困难 -4 只在 chaos.js）。
- **伙伴边界说明（与 campaign-auditor-d 的 08714–08722 探险队组）**：基础伙伴在 `src/cards/encounter-entries/edgeOfTheEarth/_shared/expedition_team/08714–08722.js` 有各自 abilities（08715/08721 等为披露的近似）；坚毅形态 `08587–08595` 在印刷上技能数值/触发时机不同（基础 [action] vs 坚毅 [fast]、基础值 5→6 等），不能简单 alias 复用 → 应共享「伙伴资产 + uses/usesType + 目标选择」原语，但能力需各自实现。本批 **6/9 张坚毅伙伴 ability 缺失**、3 张近似，属本分片责任；08714–08722 的实现质量由 campaign-auditor-d 判定（跨分片引用：`08719.js:30-31` 的「本轮不能攻击」已知 deferred，与 08592 同源缺陷）。
- `duplication.json` 本章无 clonePairs/textDuplicateGroups 命中（近似算法未识别上述结构重复），D5 结论需人工补充。

## 十一、交付物与可复现脚本

- `games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/campaign/b/findings.json`：75 条 verdict+clauses+file:line+issues；含 `scenario`（flow/records/deadlocks）与 20 条场景级 issues。
- `games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/campaign/b/data.json`：卡面/条目/屏幕线索汇总（由 `tools/collect.mjs` 生成）。
- `games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/campaign/b/cards-dump.md`：75 张卡面+条目逐卡 dump。
- `games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/campaign/b/tools/repro.mjs`：议程推进崩溃与 v2 索引越界的 in-process 复现（运行输出见 §二）。
- 其余分析脚本：`tools/analyze.mjs`、`tools/coverage.mjs`、`tools/ledger.mjs`、`tools/generate-findings.mjs`。

## 十二、未完全验证 / 留给 Lead 的裁决点

1. 「24 张 simplified」口径：本分片实际 17 张；若 Lead 的统计包含其他章节 7 张，请以账本实际 code 为准。
2. 全灭（noResolution）后引擎是否仍能 `finishScenario` 并推进到返回主线：从代码看 `finishScenario` 与 `stepReturn` 独立于 behavior，路径存在，但本审计未做完整引擎对局复现（需真实 startScenario + 战斗到全灭，成本高）。
3. 幻景地点「已翻面后再入场」与 records 的 round-trip（memoriesDiscovered/Banished）已按参考实现比对，但 mod 的 `memoriesBanished` 记录的是地点 id 而非卡号（`behavior.js:281` 只收 b 码；setup 又 push 正面码），两套口径需 Lead 在汇总时与 campaign-auditor-a 的 records 审计对齐。
4. `08586` 中文卡面「受到2点伤害」与英文「Take 2 horror」不一致（`cards-data.js` 08586 textZh）——属 cards-data 文案问题，非本分片实现，need 文案 owner 确认。
