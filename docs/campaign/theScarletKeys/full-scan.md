# 八循环《绯红密钥》全量扫描报告（2026-11-12）

> 扫描对象：TSK（The Scarlet Keys，八循环《绯红密钥》，战役标识 `theScarletKeys`，内容编号 `09`）当前工作区的全量内容：
> **439 条印刷记录**（398 个物理卡位；`tskCampaign` 311 / `tskInvestigators` 20 / `tskPlayer` 108）、
> 6 位正式调查员 + 14 张专属依赖、108 张一般玩家卡（含 16 张定制升级卡、5 张基础弱点）、311 张战役卡
> （301 张一卡一条目 + 10 张剧本参考卡）、26 个战役遭遇组（17 个共享组 + 10 个章内组）、10 个章节单元、
> 29 个关键词、17 条规则书条目、6 组交互面板、10 份冒险指南、143 节点战役流程与世界地图 36 节点。
>
> 扫描方式：**独立复核**——不采信 `audit/tsk-*.json` 的 `verified`/`gateComplete`、README 勾选或测试标题；
> 只采信「卡面印刷文本 + 当前实现文件 + 引擎读点 + 可复现探针」。
> 439 条记录由 **13 个逐卡/逐章审计分片**并行复核（每张卡一个 verdict，每个 issue 带 `file:line` 与复现），
> 再由 Lead 做机械筛查、真实引擎探针与对抗式复核。**扫描阶段未修改任何源码或账本。**
>
> 数据与复现：`artifacts/tsk-scan/`（`data/` 提取与机械账本、`shards/` 13 个分片数据包、
> `findings/` 13 个分片逐卡 JSON 与可复跑探针、`scripts/` 提取/筛查/探针脚本）。
> 结论只代表本次复核对**当前工作区源码**的判定，不代表规则等价，也不替代后续修复验收。

## 0. 结论

**逐卡层：439/439 条记录全部获得独立 verdict，既有「全 verified」账本与实测不符。**
13/13 分片完成：`match 110 / approximation 138 / gap 171 / blocked 20`；
共 **356 条 issue**（逐卡 298 条 + 章级 58 条）：**high 132 / medium 149 / low 75**
（维度：D1 201、D2 56、D3 50、D4 39、D5 7、D1∧D4 3）。high 数量按根因归并后约 32 组，
其中 **12 组为系统性缺陷**（影响多卡/多章），其余为单卡或单章规则错误。最严重的四类：
① **触发即崩溃**（`to:'deck'` 非法目标区 ×5、基础弱点 09126/09128 抽到即崩、终章全员阵亡无结局键、
09720/09721 未注册抽取崩溃、09751/09717 调错 api 命名空间）；
② **声明即死亡**（`tskExposed`/`tskKeyShifted` 窗口只注册不派发 ×18 条目、玩家无 Shift 入口 ×6 密钥卡、
`scenarioRuntime` 缺失 api.lookAt/moveCard/playCardFromHandFree/spawnStoryAsset、5 章 `choiceFor` 吞掉引擎
`ChoicePause` 导致选择静默默认/事务回滚）；
③ **数值/条件/时机错实现**（09018 旧印 +1 应为 +3、09007 受伤路人伤害翻倍、09070 图标多算 1、
10 张定制卡少付 XP、dogsOfWar 敌人印刷关键词丢失、血色阴影标靶/帷幕规则）；
④ **不可达/空转**（09023/09036/09067/09080/09105/09108/09121 等玩家卡，09524 苋击败时序，09730 变换只翻面，
09756 aura 无读点，四条章遭遇牌库缺失 40%–100%）。

**账本与门禁层：P8 的「16 项门禁全真、`--check` 复算一致」在当前工作区不能独立复现。**
14 个 TSK 冻结命令 11 通过 / **3 失败**：`scan:tsk:baseline:check`（`behaviorLines` 49329→49271 漂移）、
`audit:tsk:investigators`（`src/deck/deckbuilding.js` sha 漂移）、`audit:tsk:release`
（`ledgers`/`guards` 级联失败，含 `audit/presentation-report.json` 漂移）。
TSK 测试 **42 文件 / 595 例 / 594 pass / 1 fail**（唯一失败即上述账本复算）。
根因均为 P8 之后其他循环的工作区改动没有重签 TSK 账本，但「账本按当前工作区可复算」的发布口径不成立。
测试真实性同样偏低：50 个 TSK 测试/浏览器文件中真实引擎仅 4 个、部分真实 4 个、合成 state/stub 42 个，
**9/10 章测试不进入真实引擎**；本轮 P0 缺陷全部不在既有测试覆盖面内。

**关卡层：真实大厅主线流程可跑通；10 章中 7 章可进，3 章存在进关/通关阻断。**
真实 `createGameState` + 真实 hub 探针完成「序幕 → 谜雨 → 幕间 I → 世界地图 → 启程 → 结算 →
状况报告 α/ε → 时间 35 强制通古斯卡 → 钥匙议会 → 尾声 → `campaignResult`」
（`status=over`、`outcome=permanentPosition`、0 错误）。逐章 `startScenario` 探针：
`withoutATrace` 真实 hub 与调试跳关均抛 `TypeError … reading 'rngState'`（**完全不可玩**）；
`sanguineShadows`/`onThinIce`/`congressOfTheKeys` 在真实事务中因 `choiceFor`/结局键问题不可完成；
`dogsOfWar` 真实 hub 可进但开场版本选择被默认（版本二整条路线不可达）。
另发现 4 条章级 P0：遭遇牌库不完整（`sanguineShadows` 8/30、`dealingsInTheDark` 11/32、`dogsOfWar` 6 张、
`congressOfTheKeys` 0 张）、遭遇注册缺卡（09720/09721）、终章全灭崩溃、旅行把时间推过 35 仍播放目的地章节。

**交互与观察层：核心机制有投影，但章节状态大量不可感知，且存在隐私泄露。**
`mechanicView#tskView` 已投影 `concealed`（位置/可见性）、`keys`、`hollows`、`map`（时间/36 目的地/强制）、
`statusReports`、`dossiers`（已解锁/已读 key）、本人 `customizations`、`crossSeat`；未发现密档正文/异界牌序泄露。
但：**42 个章节 `scenarioFlags` 子键中 33 个没有任何投影/前端**（平民获救/被杀计数、彰显线索、日食、
remembered、阴影三位置等，直接影响 `[skull]` 与结局选择）；**隐匿「私人查看」信息全桌泄露**
（`known` 为全局布尔且投影无 observer，一人查看后所有座位拿到真身/诱饵并渲染到 UI，公开日志还打印卡名）；
**P4 交付的 6 组交互事务层整层无人调用**（真实玩法走 7 章 `scenarioAction` 等分散实现）；
en locale 无内容层动态文案回退（运行时中文字符串 3333 处/440 文件）。

**原语层：条目合规好于预期，但「声明即接线」系统性缺口明显。**
TSK 条目 R1 直写 = 0（`audit:entries` 112 条基线无 TSK 卡号，自建扫描亦 0；唯一漏网 09038 嵌套字段直写）；
引擎真实卡号分支 = 0（6 处 09xxx 命中全部是注释，`noEngineCardCodeBranches` 成立）；
77 项原语计划模块/exports/tests/文档全部存在。但：`tskExposed`/`tskKeyShifted` 注册后无派发、
`src/engine/tsk-investigator.js` 5/6 原语无内容消费方、`enemyStatRule.aura`/`flags.coterie/elite/patrol`/
`removedKey:*` 无读点、`location.attachments`/`agendaAside` 不在能力来源、33 个 flag 键全仓零读点、
red_coterie 9 份内联同一 `shiftAttachedKeys`、关键词 `cardCodes` 大小写不敏感扫描产生假阳性（hidden 6/6）。

**数据层：卡面事实源与锁定参考源 40 条差异，逐条复核后无影响规则的错误。**
差异以参考源错字/旧快照为主（本仓为修正版）；live arkhamdb 抽检 09107/09541 与本仓一致。
唯一注意点：09649 英文卡名拼写（本仓 `Zan'et` / 参考 `Zen'et`，以印刷为准待核）。

**修复顺序见同目录 [`fix-plan.md`](fix-plan.md)：P0 7 项（开局/抽弱点/洗回崩、choiceFor 事务、
终章失败路径、遭遇注册缺卡、四章遭遇牌库缺失）、P1 17 组、P2 9 组。**

### 0.1 P0 修复状态（2026-11-13）

**7 项 P0 全部已修复并通过真实引擎验收**（代码改动逐条见 [`fix-plan.md`](fix-plan.md) §P0 修复记录，
回归用例见 [`tests/tsk-p0-regressions.test.mjs`](../../../tests/tsk-p0-regressions.test.mjs)）：

| P0 | 结论 | 验收 |
| --- | --- | --- |
| 《不留痕迹》开局崩溃 | ✅ 修复（shuffleWith 补 state + 引擎 randomValue 回落） | 真实开局进入：4 地点 / 24 遭遇牌 / 4 迷你卡 |
| 09126/09128 弱点抽取崩溃 | ✅ 修复（weaknessStaysInHand + 通用 endTurnInHandDamage） | 抽到留手不崩；09126 回合结束 -1 伤害 |
| `to:'deck'` 非法目标区 ×5 | ✅ 修复（moveCardTo 始终归一 + 5 卡改规范目标区 + 09032 规格修正） | 5 张卡路径均不再抛「未知目标区域」 |
| 5 章 choiceFor 吞 ChoicePause | ✅ 修复（isPendingChoice 重抛控制流） | 血色阴影三选一/战争疮痍版本/如履薄冰幕推进真实可达 |
| 终章全员阵亡崩溃 | ✅ 修复（补 noResolution 结局键与正文来源） | 全灭 → `scenarioResult` / `noResolution` |
| 遭遇注册缺 09720/09721 | ✅ 修复（遭遇组展开原语 + 各章 definitions 覆盖牌库） | 10 章全局遭遇表 0 缺卡；真实抽取正常 |
| 四章（实为六章）遭遇牌库缺失 | ✅ 修复（sanguine 30 / dealings 32 / dogs 版本化 / shades 30 / onThinIce 43 / congress 版本化 + 第二牌库） | 6 章真实开局牌库完整；10/10 章可进入 |

**验收结果**：14/14 个 TSK 冻结门禁通过（此前 11/14）；TSK 测试 **626/626 通过**（此前 595 例中
1 失败且多章用例断言旧缺陷）；`probe.mjs` 十章全部可进入且主线战役仍跑通（`campaign.finished=true`）；
`npm run test:fast` 7688 例 / 4 fail——4 条正是 `audit/tsk-regression.json` 冻结基线里的既有失败
（EotE all-cards/EotE migration ledgers/TCU migration/i18n UI，均为本轮之前工作区已有漂移，
`additionsSinceInitialBaseline = []`）。受影响的 TSK 账本（scope / mechanism-scan / baseline /
primitive-plan / rules / interactions / investigators / player / scenarios / all-card / migration）
已按当前工作区重签，`audit/tsk-migration.json#status = verified`。

**修复过程中同批修掉的契约缺口**：`doomPlaced` 非玩家强制能力的窗口实例键未含目标卡 → 09571「彰显」
只有第一张卡翻线索面（ability-exec.js）；钥匙议会 v.I 第二遭遇牌库字段 `outsideEncounterDeck` 未进
TSK 战役容器白名单（tsk-state.js）；09032 把 `seat` 混进 moveCard 规格对象（在严格归一后暴露）。

**已知不属本轮 P0 的遗留**：
- golden replay `--verify` 仍有 3 局不一致（carcosa-curtain-call ×2、dunwich-extracurricular ×1，
  均在 investigate 第 13 步）。该不一致在本轮修复前的同一工作区已存在（golden-replays.json 在
  工作区里本就是未提交修改），与本轮改动无关，未更新 golden 基线以免掩盖其他循环的既有漂移。
- P1（17 组）与 P2（9 组）问题仍全部待办：窗口派发、玩家 Shift 入口、Concealed 数值/隐私、
  调查员与玩家卡不可达、章节规则缺口、观察投影、i18n、测试真实性与原语 backlog 等，见 fix-plan。

### 0.2 P1 修复进度（2026-11-13 第二轮 → 第三轮完成 17/17 组主体）

P1 **17/17 组主体已落代码**（逐组状态与剩余「引擎原语级」条目见 [`fix-plan.md`](fix-plan.md)
§「P1 修复进度」），回归用例：
[`tests/tsk-p1-regressions.test.mjs`](../../../tests/tsk-p1-regressions.test.mjs)（20 例真实引擎）。

第二轮完成 13 组（下文保留），第三轮（晚）补齐四组并收口 P1-16 单卡批：

- **P1-11 章节机制**：deadHeat 09524 苋被击败改推进幕 1（`enemyCanBeDefeated` 不真正移除 +
  `checkObjectives` 兑现）；09521/09522 复生者/食尸鬼「生成-随机地点」+ 猎手；09532 废弃版杰马广场
  打支援 +2（引擎 `turn-flow` 新增剧本层 `playCostIncrease` 读点）；riddles 09516 伦敦塔团队线索
  入场费用、09517 迷你卡落点重定向（`redirectConcealedLocation` 读点）。
- **P1-12 章节状态观察投影**：`manifest.publicScenarioFlags` 声明清单（10 章 60+ 子键，只含计数/位置/
  布尔，不含正文/牌序/未揭示身份）同时驱动 `observation.js#scenarioFlagsPublic` 与
  `mechanic-view.js#tsk.scenarioFlags`；web 面板新增「章节状态」段与中英文案；未声明键不投影有隐私用例。
- **P1-14 结局/分支可达**：dealings「追逐」补 R1 入口（持钥调查员在加拉塔码头 → 结局 1），
  R1→R2/R3→R4/R5 全链可达；sanguine 幕间「云开见日」1–7 按印刷补分支（有标靶/不相信 → R1；
  相信 → 生成 09557b 剧情支援并由调查员控制、进入「见红」）。
- **P1-15 隐私隔离**：隐匿迷你卡 `knownBy` 按座位隔离（`tsk-concealed` 校验/投影 +
  `mechanic.markKnown`）；本章「查看已揭示面」只对查看者座位可见、公开日志不再写真身/诱饵名；
  observation/mechanic-view 隐私用例。
- **P1-16**：15 个单卡条目修正（09766/09740/09747a-c/09739/red_coterie×9 等）；blocked 5 张与
  09694/09704 经真实引擎探针确认已恢复（P0-4 的 choiceFor 修复生效）；09724 实测引擎已扣 2 行动；
  onThinIce 空洞选择同名手牌 option id 重复与 `source` 硬编码修复；`agendaAside` 纳入
  `nonPlayerAbilitySources`。
- **剩余（引擎原语级，非整组）**：P1-6 的 4 个精度读点、P1-8 的 3 个引擎缺口、P1-16 的 6 项
  （隐匿迷你卡 fight/evade 动作与 `concealedFightEvadeBonus`、expose 每人每轮上限、
  09739 Concealed 2 的共享组 spawn 分配、09766 `cannotLeaveHand` 四条通道、red_coterie helper 上收、
  其它章级文本回放测试），逐条列在 fix-plan 状态表。

**第三轮验收结果**：**14/14 个 TSK 冻结门禁通过**、**TSK 测试 626/626 通过**（含 20 例 P1 真实引擎回归）、
`audit/tsk-migration.json#status = verified`（16/16 gates）；`npm run test:fast` 7713 例 / 4 fail——4 条
仍是 `audit/tsk-regression.json` 冻结基线里的既有失败（EotE/TCU/i18n），
`additionsSinceInitialBaseline = 0`；TSK 自己的 replay 13 局基线因工作区在本轮期间收到其它未提交引擎改动
（setup/rules-state 等，非本任务改动）而按当前工作区**重采一次**并复算通过；全局 `replay-fixtures --verify`
仍是与修复前相同的 3 局既有漂移；`docs:check` 链接全部可解析。

### 0.3 第四轮：剩余引擎原语读点（2026-11-13 晚）

第三轮遗留的「引擎原语级」条目已收口，回归扩到 **27 例**：

- **P1-6 4 项**：`reduceTestDifficulty` 双扣修复（只登记 `difficultyReduction`，唯一扣减在 ST.6）；
  `skillTest.id` 唯一化（瞬态 `_testSerial` + 非枚举，`limits.js#perTest` 不再退化为 `round:turnSerial`）；
  `test.beforeCommit/afterCommit` 支持同地点 `flags.testWindowObserver` 调查员参与（09015，`playerWindow`
  新增 `onlySeats`）；`harm-threat#assignHarm` 让 `flags.composureDamage` 支援强制承接第 1 点非直接伤害
  （09007；仍保留分配选择、其余点数正常分配）。
- **P1-8 3 项**：弃牌堆通道纳入 `playableFromDiscard` 支援的普通行动入口（09103；快速窗口仍只给事件）；
  `enemyRule.damageOnlyFromSourceTraits` + `damageReductionFromAllSources` 接入 combat/enemies（09124）；
  09059 线索落点第二轮已接。
- **P1-16 6 项**：引擎新增 `fightConcealed`/`evadeConcealed` 合法动作、dispatch 结算与借机攻击豁免
  （难度 = 隐蔽值 + `locationRule.concealedFightEvadeBonus`，成功走 `concealed.expose`）；
  `treacheryRule.exposeLimitPerInvestigatorPerRound` + 按轮/按座账本（09740 揭露上限）；
  09766 `cannotLeaveHand` 四通道读点；red_coterie 9 张共用 `encounter-entries/_shared.js#shiftAttachedKeys`
  （逐条目已删内联函数）；09610/09611 空洞选择 option id 去重 + `source` 改用当前议程；
  `agendaAside` 纳入 `nonPlayerAbilitySources`。
- **仍剩 1 项 + 1 类**：09739 的 Concealed 2 需在含 agents_of_yuggoth 的两章 `enemySpawned` 里做
  content 分配（条目 `enemyRule.concealed: 2` 已声明）；隐匿攻击/躲避的**章节专属真身入场**仍走既有
  `tskExposed` 窗口近似（已预留 `concealedCombatResolved` 内容钩子）。

> 第四轮验收（最终）：**14/14 TSK 冻结门禁**、**TSK 测试 633/633 通过**（27 例 P1 回归）、
> `audit/tsk-migration.json#status = verified`、`test:fast` 7720 例 / 4 fail（additions 0）、
> TSK replay 13 局逐条一致、`docs:check` 链接全部可解析。

> 第二轮结论（保留）：14/14 门禁、617/617 TSK 测试、`migration verified`、`test:fast additions=0`；
> 见下方「第二轮」原文与 fix-plan 历史。

## 1. 扫描范围与方法

### 1.1 范围

| 分区 | 记录数 | 说明 |
| --- | --- | --- |
| `tskCampaign` | 311 | 301 张需条目战役卡 + 10 张剧本参考卡（09501/09520/…/09694） |
| `tskInvestigators` | 20 | 6 位调查员（09001/04/08/11/15/18）+ 14 张专属依赖 |
| `tskPlayer` | 108 | 103 张可构筑玩家卡 + 5 张基础弱点（09124–09128）；含 16 张定制升级卡 |
| 合计 | **439** | 369 主卡 + 70 关联面（双面密钥 a/b、敌人 a/b 面等） |

十章：谜雨 `riddlesAndRain`、死亡酷暑 `deadHeat`、血色阴影 `sanguineShadows`、暗中交易 `dealingsInTheDark`、
疯星乱舞 `dancingMad`、如履薄冰 `onThinIce`、战争疮痍 `dogsOfWar`、苦痛之影 `shadesOfSuffering`、
不留痕迹 `withoutATrace`、钥匙议会 `congressOfTheKeys`。
战役流程 143 节点（10 章 + 17 段幕间 + 8 份状况报告 + 22 个密档映射 + 快捷旅票 + 序章/尾声/世界地图）；
世界地图 36 节点、36 个旅行目的地；29 关键词、17 条双语规则、6 组交互、16 张定制卡。

### 1.2 工作区基线（扫描快照）

- Mod 仓库（`games/arkhamhorror` 为独立 git 仓库）HEAD `930725e`，工作区 **610 项未提交改动**
  （168 修改 + 442 未跟踪）；TSK 的 P5–P8 产物大量是未跟踪文件（章节、条目、账本、测试）。
  扫描对象即该工作区源码，不采信 git HEAD 的干净视图。
- 扫描期间未修改任何源码/账本；全部写入落在 `artifacts/tsk-scan/`。
- 冻结门禁现状（2026-11-12 实测，11/14 通过）：`scan:tsk:scope:check` ✅、`scan:tsk:check` ✅、
  `audit:tsk:rules` ✅、`audit:tsk:interactions` ✅、`audit:tsk:player` ✅、`audit:tsk:scenarios` ✅、
  `audit:tsk:primitives` ✅、`audit:entries` ✅、`cards:check` ✅、`cards:encounter-check` ✅、
  `audit:tsk:allcards` ✅；`audit:tsk:investigators` ❌、`scan:tsk:baseline:check` ❌、`audit:tsk:release` ❌（见 §4.1）。

### 1.3 五个维度

| 维度 | 名称 | 判定内容 |
| --- | --- | --- |
| D1 | 实现 vs 描述 | 每个印刷子句是否逐句落地；错值/缺分支/语义反向/只声明不实现/多实现卡面没有的规则 |
| D2 | 交互可感知 | 决策所需信息是否有观察投影（`observation.js`/`mechanic-view.js`）、前端承载（`mechanic-ui.js`/`hub.js`/`data-tsk-*`）、中英文案；`legalMoves` 是否给出行动；待决选择是否有 prompt/label；隐私是否隔离 |
| D3 | 关卡可跑通 | 真实 `createGameState`/hub/`startScenario` 下 setup 不变量、幕议程推进、遭遇、结局、失败/撤退；behavior 钩子是否被引擎读点调用；章测试是否真实引擎 |
| D4 | 原语合规 | 条目是否直写状态（R1）、声明即接线、引擎卡号分支、同句规则重复手写、死声明 |
| D5 | 复用/重印 | 同文卡是否共享实现；重印是否只实现一次、别名是否登记可用 |

### 1.4 分片与证据

| 分片 | 覆盖对象 |
| --- | --- |
| investigators | 6 位调查员 + 14 张专属依赖（20） |
| playerA / playerB / playerC | 09021–09060 / 09061–09095 / 09096–09128（40/35/33） |
| sharedA / sharedB | 17 个战役共享遭遇组（38/28） |
| chapterA–chapterE | 十章逐章（每片 2 章）章内卡（48/52/49/61/35） |
| campaignFlow | 序幕/幕间/世界地图/状况报告/剧情/指南/记录（框架） |
| crossCutting | 关键词/规则书/交互 UI/观察投影/原语接线（横切） |

- 逐卡证据：每条 clause 给出 `file:line`；issue 带 severity/dimension/evidence/repro/confidence；
  分片审计员构造定向探针（真实 `createGameState`/hub/`startScenario`、既有测试夹具或最小引擎探针），
  Lead 对 high 级问题逐条复核（§6）。
- 机械审计脚本：`extract.mjs`、`screen.mjs`、`screen2.mjs`、`customization-gates.mjs`、
  `dead-flag-review.mjs`、`encounter-registry.mjs`、`aggregate-findings.mjs`。
- 真实引擎探针：`probe.mjs`、`probe-defeat.mjs`、`diag-enter.mjs`/`diag-enter5.mjs`/`diag-hosted.mjs`/
  `diag-advance.mjs`、`verify-weakness-crash.mjs`、`verify-pa1.mjs`（详细命令见 §8）。
- 分片数据包：`shards/<shard>/{meta.json,cards-*.md,chapters.md,framework.md}`。

## 2. 逐卡审计结果

### 2.1 汇总（13/13 分片，439/439 全覆盖，无 missing）

| 分片 | 卡数 | match | approximation | gap | blocked | high | medium | low |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| investigators | 20 | 0 | 2 | 15 | 3 | 14 | 18 | 5 |
| playerA | 40 | 12 | 17 | 11 | 0 | 2 | 11 | 11 |
| playerB | 35 | 12 | 15 | 7 | 1 | 4 | 8 | 7 |
| playerC | 33 | 9 | 17 | 4 | 3 | 5 | 7 | 3 |
| sharedA | 38 | 1 | 6 | 30 | 1 | 15 | 9 | 3 |
| sharedB | 28 | 4 | 15 | 9 | 0 | 11 | 9 | 3 |
| chapterA | 48 | 22 | 12 | 14 | 0 | 3 | 14 | 14 |
| chapterB | 52 | 12 | 8 | 27 | 5 | 22 | 5 | 1 |
| chapterC | 49 | 14 | 13 | 17 | 5 | 10 | 18 | 6 |
| chapterD | 61 | 20 | 19 | 22 | 0 | 25 | 11 | 1 |
| chapterE | 35 | 4 | 14 | 15 | 2 | 12 | 15 | 7 |
| campaignFlow | 框架 | — | — | — | — | 4 | 19 | 8 |
| crossCutting | 横切 | — | — | — | — | 5 | 5 | 6 |
| **合计** | **439** | **110** | **138** | **171** | **20** | **132** | **149** | **75** |

> high/medium/low 为「逐卡 issue + 章级 issue」合计；campaignFlow/crossCutting 无逐卡 verdict，只计 issue。
> 明细：`artifacts/tsk-scan/data/findings-summary.json`、`reports/findings-summary.md`、各分片 `findings/<shard>.json`。

### 2.2 verdict 口径

- `match`：全部印刷子句实现且与卡面一致（允许纯等价重构）。
- `approximation`：主行为可用，但有**已披露**的偏差/简化（审计员须指出披露位置）。
- `gap`：存在未实现子句、不可达关键效果，或影响正常对局的**未披露**偏差。
- `blocked`：实现完全不可用/触发即崩溃。

P8 账本口径（`verified 160 / simplified 121 / scenario-data 148 / scenario-reference 10`）不能与本轮直接换算：
`simplified` 只要求「有披露」、不判断披露是否完整；`scenario-data`（148 张）把地点/幕/议程等数据型条目的
行为交给章 behavior 承接，本轮逐张核对了印刷子句与 behavior 实现，其中 37 张仍有未落地子句
（如 09516 伦敦塔进入费用、09517 塔楼牢房迷你卡限制、09521/09522 议程正面关键字、09532 支援费用 +2）。

### 2.3 代表性偏差（完整清单见各分片 JSON）

- 崩溃/不可用 20 张（blocked）：09003/09012/09013（`to:'deck'`）、09126/09128（抽到即崩）、09121（条件非布尔）、
  09067（完全打不出）、09552/09555/09561/09565a/09565b（血色阴影 choiceFor 事务回滚）、
  09610/09611/09613/09614/09620（疯星乱舞触发即抛错回滚）、09694（[cultist] 翻钥匙分支）、
  09704（[fast] 移动）、09751（api.tsk 不存在）。
- 数值/条件错：09018（旧印 +1 vs +3）、09007（入场伤害未放置 + 事后追打翻倍）、09070（图标 +1）、
  09567/09716a-c（Concealed X 诱饵按人数倍增）、09654b（资源搬运数量/横置）、09603（大剧院 -2 永不到期）、
  09605（广场酒店范围扩大）、09646（横置盟友给 +1 无过滤）。
- 时机关闭：09001（跨座位投影双源）、09015/09018（检定期 [fast] 不可达）、09016（线索反应重复结算）、
  09019（assetExhausted 窗口不开）、09023（攻击来源字段无人写）、09036/09095（打出/取回空转）、
  09608（支援实例无 traits）、09618/09621（整句未实现）、09625b（api.beginImmediateAction 不存在）。
- 章级机制：09524（苋击败翻面时序）、09545/09546（标靶/初设毁灭）、09548/09557b（Cast a Light 分支）、
  09554（市议会）、09560（来访名片）、09581（离场检定）、09583/09584/09590a（api 缺失空转）、
  09636/09637/09645（dogsOfWar 密谋/节点规则）、09661/09666/09678（shades 分支）、
  09618/09621（onThinIce 场所）、09681（withoutATrace 洗牌）、09694（终章结局/牌库/同谋）。

## 3. 分维度结果

### 3.1 D1 实现 vs 描述（201 条 issue，其中 high 82）

按根因归并的主要 high 组：

1. **`to:'deck'` 非法目标区崩溃（5 卡）**：09003/09012/09013 触发即抛「未知目标区域 deck」，
   09014/09020 同型潜在。根因：`src/engine/zones.js:28-29` 目标区无 `'deck'`，`deck-ops.js:466`
   在 `to` 存在时跳过 `normalizeCardMove`，`deck-ops.js:546` 抛错。复现：`findings/tmp-probe4/6/14.mjs`。
2. **基础弱点抽到即崩（09126/09128）**：`weakness.js:96-97` 无 profile 直接 throw；
   两卡只声明 `playableWeakness`。复现：`scripts/verify-weakness-crash.mjs 09126`。
3. **`scenarioRuntime` 缺失/错命名空间 api 被当作成功**：`api.lookAt`/`api.moveCard`/`api.playCardFromHandFree`/
   `api.spawnStoryAsset`/`api.placeDoomOnCard`/`api.tsk`/`api.beginImmediateAction` 均为 undefined，
   但 09583/09584/09590a/09646/09669/09694/09625b/09751/09717 等照打成功日志；涉及 6 章 ~12 条规则。
4. **5 章 `choiceFor` 吞 `ChoicePause`**：`sanguineShadows:540`、`dogsOfWar:108`、`onThinIce:97`、
   `shadesOfSuffering:112`、`congressOfTheKeys:68` 的 `try{choose(request)}catch{return null}`；
   真实 hub 中开场/幕/轮末等选择静默默认（sanguine intro 恒 `everything`、dogs variant 恒 v1），
   调试跳关/真实推进时抛「存在未消费的选择恢复凭据」并回滚（onThinIce 真实对局不可通关）。
5. **死亡酷暑 09524 苋击败时序**：`enemies.js:703` 先 `leaveEnemyPlay` 再调击败钩子，behavior 在
   `state.enemies` 找不到她 → 幕 3 目标立即成立并短路到结局 4。复现：`findings/tmp-probe-defeat.mjs`。
6. **血色阴影章节规则缺口**：09545（[tablet] 只取消技能牌）、09546（初设毁灭缺失）、
   09554（市议会未实现）、09560（来访名片未实现）、09567（隐匿诱饵按人数）、09581（离场失败两种选择同结果）、
   09583/09584/09590a（api 缺失）、09557b/09548（Cast a Light 分支）。
7. **暗中交易章节规则缺口**：遭遇牌库组名 camelCase 过滤 snake_case（11/32，6 张卡不可达）、
   「追逐」R1–R5 无入口（只剩 R6）、09586 系列不可达、api 缺失空转。
8. **战争疮痍/苦痛之影章节规则缺口**：敌人关键词丢失（09655a 缺反击、09656 缺警戒/猎手/反击、
   09657 缺冷漠）、09636/09637/09645/09654b/09661/09666/09669/09674a/09678 规则缺失或空转、
   影穑充能与 remembered 无投影。
9. **疯星乱舞/如履薄冰章节规则缺口**：09608（支援实例无 traits → 主效果不可达）、09618/09621（整句未实现）、
   09625b（立即行动 api 缺失）、09606a/b/09607b（伤害写到另一张/攻击修正不检查目标）、09598/09603/09605、
   09634a/b 的 Shift 无执行点。
10. **不留痕迹/钥匙议会章节规则缺口**：withoutATrace 开局崩溃 + 补位迷你卡不洗牌（真身恒在首位）；
    congress 遭遇牌库恒 0、noResolution 缺失、choiceFor 吞异常、`api.spawnStoryAsset` 不存在、同谋支援不入场。
11. **调查员 09001/04/07/15/16/17/18/19**：旧印数值、受伤路人、证据计数器（花/移为空操作、线索反应重复）、
    检定期 [fast] 不可达、邦妮窗口不派发、取回场外卡空操作、跨座位投影双源。
12. **玩家卡 09023/09036/09067/09070/09080/09095/09105/09108/09121**：反应窗口字段无人写、
    打出/取回空转并谎报、完全打不出、图标多算、强制费用未接线、条件返回非布尔。
13. **共享遭遇 09716a-c/09717/09721/09722/09723/09724/09725/09726/09730/09735/09737/09738/09739/09740/
    09743/09745/09746/09747/09751/09756/09762/09763**：窗口不派发、kind 契约不一致、api 错命名空间、
    aura/行动限制/揭露上限无读点、诱饵数值语义错误。
14. **战役流程（campaignFlow 4 high）**：02310 禁用卡未接线（真实大厅可买入）、旅行把时间推过 35 仍播放
    目的地章节、Ω 状况报告永不可达、幕间 52 θ 门槛失效（跨章记录键断裂）。
15. **定制升级卡少付 XP（10 张）**：09021/09022/09023/09040/09042/09079/09081/09099/09100/09119
    用 `includes(index)`/`>0` 判定多格选项（正确示范 09059:29-32/09060/09061 的 `checkedFully`），
    勾 1 格即生效，单项少付 1–3 XP（09022 单卡最多 7 XP）；09041/09101 声明选项但完全不读。
16. **其他**：09009「不引发借机攻击」缺失、09031 投入顺序、09034 多出横置费用、09038 直写 skillTest、
    09056 行动费用、09059 Surveil 目标、09064 敏捷代替写死、09081/09090/09061 条件、09103/09123/09127 等。

### 3.2 D2 交互可感知（56 条 issue，其中 high 9）

- **已投影（核验通过）**：`mechanicView#tskView` 覆盖隐匿迷你卡（位置/可见性/无真身）、密钥（面/持有者/
  本轮已变换）、空洞数/卡、地图（当前/时间/解锁/强制/36 目的地/耗时）、状况报告（触发/待处理/θ/ψ）、
  密档（已解锁/已读 key）、本人定制勾选、跨座位授权（仅本人相关）；`web/mechanic-ui.js` 有
  `data-tsk-*` 面板与中英 `mechanic.tsk.*` 词条；`web/hub.js` 有地图时间/强制启程展示。
  隐私：密档正文不入状态、异界牌序不泄露、未揭露迷你卡在基础投影中不泄露身份（但见下条）。
- **high（不可感知/隐私泄露）**：
  1. **隐匿「私人查看」全桌泄露**：`src/engine/tsk-concealed.js:231-233` 的 `visible = … || card.known`
     无 observer，`mechanic-view.js:157`/`observation.js:246` 直接投影 → 一人查看后所有座位拿到
     `kind/decoy`，`web/mechanic-ui.js:195` 直接渲染真身/诱饵；公开日志还打印卡名。
  2. **42 个章节 `scenarioFlags` 子键中 33 个无任何投影/前端**（`screen2.json#projectionGaps`）：
     死亡酷暑平民获救/被杀（决定 `[skull]` 与结局比较）、暗中交易 `cluesUnveiled/eclipse`、苦痛之影 `remembered`、
     不留痕迹阴影三位置、血色阴影标靶等；`observation.js:47` 的 `PUBLIC_SCENARIO_FLAGS` 仅
     `depthLevel/pillars`（EotE 遗产）。
  3. **09001 跨座位授权投影双源**：条目写 `inv.crossSeatGrants`、`mechanic-view.js:230-241` 读
     `scenario.crossSeat` → web 面板永不出现；且两字段未纳入存档校验。
  4. **P4 六组交互事务层整层无人调用**（`tsk-interactions.js` 的 `interactions.tsk` 在 src/cards+content 零命中），
     `audit/tsk-interactions.json` 的 verified 只覆盖未接线层；真实玩法靠 7 章 `scenarioAction` 与
     4 章 `resolveKeyShift` 分散实现。
  5. **玩家无 Shift/转移密钥入口**：`legalMoves` 不枚举密钥、web 面板只读、`keys.shift` 事务无调用方
     → 6 张密钥卡的 Shift 效果只能被敌人强制变换或 09767 触发（09634a/b、09659a/b、09665a/b、09680a/b 等不可达）。
  6. **09015/09016 证据计数器不可见**（`web/table-components.js:98-115` 无 markers 行，投影无卡级 markers）。
- **medium**：18 张条目的 `tskExposed/tskKeyShifted` 窗口不出现；10 张定制卡升级面板信息不可信；
  09747/09748「查看已揭示面」只写无读点旗标；09694/09681 等章节关键计数器（影穑充能、法罗斯资源、
  密钥节点）无摘要面板；09059 证据计数显示为「标记」。
- **i18n**：TSK 条目/章节 behavior 运行时中文字符串 **3333 处 / 440 文件**（其中疑似 label/prompt/info 等
  玩家可见文案 848 处），`web/locales` 无 tsk 动态词条；en 界面下这些文案不翻译（系统性口径）。

### 3.3 D3 关卡可跑通（50 条 issue，其中 high 32）

- **真实大厅主线流程（`probe.mjs`）**：序幕 → 谜雨 → 结算 → 幕间 I → worldMap（36 目的地）→
  启程马拉喀什 → 死亡酷暑（真实 `startScenario`，setup 无 issue）→ 结算回 map → 时间 9 莫斯科
  （幕间 26 取快捷旅票）→ α/ε 状况报告 → 时间 35 强制启程通古斯卡 → 钥匙议会 → resolution2 →
  尾声 → `end`；`status=over`、`outcome=permanentPosition`、`campaign.finished=true`、0 错误。
  **结论：战役注册/流程接线/转场/结算/终局链路可用。**
- **逐章进入与可玩性（真实 `startScenario`）**：

  | 章节 | 可进 | setup 不变量 | 幕/议程推进 | 遭遇抽取 | 结局键 | 全员阵亡/撤退 | 备注 |
  | --- | --- | --- | --- | --- | --- | --- | --- |
  | riddlesAndRain | ✅ | ✅ | ⚠ 探针未推进（章测试走真实 startScenario） | ✅ | 5/5 | ✅ | 09516/09517/09519b 规则缺口 |
  | deadHeat | ✅ | ✅ | ✅ | ✅ | 6/6 | ✅ | 09524 击败短路、09521/22/32 缺失 |
  | sanguineShadows | ❌ | — | — | — | — | — | choiceFor 吞异常（P0） |
  | dealingsInTheDark | ✅ | ✅ | ✅ | 牌库 11/32 | 8/8 | ✅ | R1–R5 不可达、api 缺失 |
  | dancingMad | ✅ | ⚠ token 两档缺失 | ⚠ 探针未推进 | ✅ | 3/3 | ✅ | 09608 等单卡缺陷 |
  | onThinIce | ✅ | ✅ | ❌ 真实事务回滚 | 4/10 耗尽 | 5/5 | ✅ | choiceFor（P0，真实不可通关） |
  | dogsOfWar | ⚠ hub 可进但版本默认 v1 | ✅ | ✅ | 牌库 6 张 | 9/9 | ✅ | 关键词/牌库/分支缺失 |
  | shadesOfSuffering | ✅ | ✅ | ✅ | ❌ 09720 抽取崩 | 4/4 | ✅ | choiceFor/多 api 缺失 |
  | withoutATrace | ❌ | — | — | — | — | — | rngState 崩溃（P0） |
  | congressOfTheKeys | ✅ | ✅（版本相关） | ✅ | ❌ 牌库恒 0 | 2/2；全灭崩 | ❌ 全灭抛错 | noResolution/P0 |
- **战役流程缺陷（campaignFlow 4 high + 章级 9）**：时间 ≥35 前最后一趟旅行不会重定向通古斯卡（`tsk-map.js:177-191`
  只按出发前时间判强制）、Ω 报告永不可达（强制启程优先于 pending 报告，终章少 1 枚 cultist）、
  02310 禁用卡未接线、幕间 52 θ 门槛失效、幕间 14 追回密钥后四城未移除可刷 XP/时间、
  幕间 20/51 的 StartingHand/StartingResources 加成只写不读；15 个 flow 节点不可达（14 dossier + expeditedTicket）。
- **章节测试真实性**：10 个章测试中 9 个为合成 state + 自动机/stub（deadHeat 自述不 import engine.js；
  dealings 测试给缺失原语打桩；无 createGameState/startScenario/applyMove/legalMoves），仅 riddlesAndRain 走真实
  `startScenario`。本轮 6 个真实路径 P0（withoutATrace 崩溃、choiceFor 事务、congress 失败路径、遭遇注册缺卡、
  牌库缺失、onThinIce 不可通关）全部不在测试覆盖面内。
- **指南**：10 份 `web/scenario-guides/*.json` 中英齐备（`chineseGaps=[]`，生成器逐字节一致），
  但 6 章特别规则段为空、4 章 story 分类为空（来源 locale 缺 key），与实现存在 3 处矛盾
  （如 congress 指南要求全灭读战败正文但缺结局键）。

### 3.4 D4 原语合规（39 条 + D1∧D4 3 条，其中 high 6）

- **R1 直写**：TSK 条目自建扫描 0 处；`audit:entries` R1 基线 112 条无 TSK 卡号 → 合规。
  唯一漏网：09038 直写 `state.skillTest.boostedByGirish`（嵌套字段逃过 R1 正则）。
- **引擎卡号分支**：`src/engine/**` 6 处 09xxx 命中全部在注释（`tsk-investigator-support.js`/`tsk-map.js`/
  `card-lookup.js`/`restricted-actions.js`），真实分支 0；`noEngineCardCodeBranches` 门禁成立。
- **声明即接线（系统性缺口）**：
  1. `tskExposed`/`tskKeyShifted` 在 `windows.js:68-69` 注册但全仓无派发点；18 张条目
     （09716a-c/09721/09722/09726a-b/09747a-09750/09762/09763 的 tskExposed + 09752 的 tskKeyShifted）
     挂空，仅 withoutATrace 手工派发覆盖 8 张地点背面。
  2. `src/engine/tsk-investigator.js` 5/6 原语无内容消费方（调查员卡各写局部实现）；
     `inv.crossSeatGrants`/`aminaDoomPending` 未纳入存档校验。
  3. 语义未接线声明：`enemyStatRule.aura`（09756）、`flags.coterie/elite/patrol`（red_coterie 10 张）、
     `removedKey:*`（09757）、`location.attachments`/`agendaAside` 不在能力来源枚举（09743/09735）、
     33 个 flag 键全仓零读点（`aftermathCode/rescueAction/costClues/flipAtGameEnd/compareRescuedAndSlain/
     xpPerTier/traumaPerTier/frontFace/backFace/keyCard/keyTitle/pairCode/shadowLocation/...`）。
  4. 同句规则重复手写：red_coterie 9 张各内联 `shiftAttachedKeys`（且只处理 `assetRule.keyShift.resolve`，
     `.effect`/legacy shift 面被静默跳过）；5 段「法术槽=2」重复（09086/09087/09091 等）。
  5. 关键词 `cardCodes` 假阳性：`keywords.js:63` 大小写不敏感整词扫描把卡名/叙述算进关键词覆盖
     （hidden 6/6 全是卡名如 `Hidden Pocket`，prey 2/4 是卡名，spawn/patrol 多张只是动词），
     P3 的「29 关键词 cardCodes 逐张核验」口径不成立。
- **原语计划自洽**：77 项 catalog 模块/exports/tests/文档全部存在，`primitiveGaps 49/49 done` 可复算；
  但「done」不等于「有引擎消费方」（上列 1–3 为反例）。

### 3.5 D5 复用/重印（7 条，其中 high 2）

- 同文簇 9 组（`data/screen.json#duplicates`）：6 组为数据驱动（双面 a-b/副本定义，0 独立实现，合规）；
  **3 组为独立实现**：09716a/b/c（结社特工 A/B/C）、09726a/b（清理小队）、09727a/b，应上收共享实现
  （09059/09060 的定制 helper 是正确示范）。另有 09096/09097/09098 与 09082/09083/09085 三对同模板双实现。
- 重印：`09064↔12049`（跨循环重印，canonical 09064）只实现一份，但 `_reprint-aliases.js:7-19` **未登记 12049**
  → `registeredEntry('12049')` 为 null，重印号在可用池中不可用（潜在）；`04096↔09587` 映射登记正确。
- 09064 把「可用敏捷代替智力」写死为永远敏捷（未披露，D1∧D5 交叉）。

## 4. 账本、证据与测试可靠性

### 4.1 P8 冻结门禁不能独立复算（3/14 失败）

| 门禁 | 现象 | 根因（Lead 复核） |
| --- | --- | --- |
| `scan:tsk:baseline:check` | exit 1：`architectureMetrics 漂移：behaviorLines` | `audit/tsk-baseline.json#architectureMetrics.behaviorLines=49329`，当前 `audit/ability-coverage.json=49271`（P8 后其他循环改动章节 behavior 行数，未重签 TSK 基线） |
| `audit:tsk:investigators` | exit 1：`audit/tsk-investigators.json 与当前证据不一致` | 唯一差异是 `sources[27] = src/deck/deckbuilding.js` sha：`c1775ac6…`→`250afbe3…`（P8 后 TFA 玩家池修复改了该共享文件，未重签 TSK 调查员账本） |
| `audit:tsk:release` | exit 1：`audit/tsk-migration.json 与复算不一致` | 级联：`ledgers.baseline=false`、`ledgers.investigators=false`、`guards.presentation=false`（`audit/presentation-report.json` 漂移）；其余 13 门禁为 true |

三项均属「后 P8 工作区改动未重签账本」，不是 TSK 内容/规则漂移；但 P8 声称的
「`--check` 复算一致 / 16 项门禁全真」在当前工作区不成立，发布账本须重签或明确声明冻结快照。
**2026-11-13 修复后已按当年工作区重签全部受影响账本与 `audit/presentation-report.json`：
14/14 个 TSK 冻结门禁通过，`audit/tsk-migration.json#status=verified`（见 §0.1）。**

### 4.2 测试：595 例 / 1 fail；真实性偏低且多处断言错误实现

**2026-11-13 修复后：626/626 TSK 测试通过（新增 10 例 P0 真实引擎回归），此前断言旧缺陷的章测试已同步改正；测试真实性偏低（9/10 章测试为合成 state）仍属 P2-2 待办。**

- 42 个 `tests/tsk-*.test.mjs`：**595 tests / 594 pass / 1 fail（387s）**；唯一失败为
  `tests/tsk-p8-migration.test.mjs`（P8 发布账本复算，同 §4.1）。
- 真实性（`screen.mjs#testAuthenticity`）：50 个 TSK 测试/browser 文件中 **real-engine 4 个**
  （investigator-09015、p8-campaign、p8-customization、p8-fixes）、**partial-engine 4 个**
  （player-m2-1/m2-4、scenario-riddlesAndRain、scenarios.browser）、**synthetic 42 个**；
  9/10 章测试为合成 state + 自动机；`audit/tsk-scenario-acceptance.json` 的 12 项 gates 全真建立在这些
  非真实测试上，gate 的真实性口径不成立。
- 多处测试断言了错误实现：09018 旧印 +1（`tsk-investigator-09018.test.mjs:24`）、09070 图标公式
  （`tsk-player-m2-2.test.mjs:628-641`）、09023 手工塞 `assetSourceId`（`tsk-player-m2-1.test.mjs:197`）、
  deadHeat 伪 `advanceAct`、congress 直接喂 `behavior.resolution('noResolution')` 绕过引擎结局校验。

### 4.3 逐卡账本与「已披露近似」

- `audit/tsk-all-card-acceptance.json`：439 行，missing 0/blocked 0；`verified 160 / simplified 121 /
  scenario-data 148 / scenario-reference 10`；`strictComplete=false` 是账本自述口径。
- 121 张 `simplified` 的披露文本多为「数据型条目前由章节承接」「近似：xxx 记在 scenarioFlags」一类；
  本轮复核发现其中 **37 张仍有未落地印刷子句**，且 5 章 choiceFor/2 个窗口的「已披露 backlog」实际造成
  整条能力不可达——「披露」不等于「已验收」。
- `audit/tsk-migration.json` 的 16 门禁把「原语请求 175 份全部 deferred」计为通过；本轮确认这些 deferred
  项正是多个 high 缺陷的来源（tskExposed/tskKeyShifted、shift 入口、concealed 数值等），发布口径与可玩性不符。

### 4.4 死声明与「声明即接线」

- 机械扫描 38 个「零读点」flag 候选，全仓（含 tools/tests/docs）复核后 **33 个零读点**（`agency/paradox` 为
  普通词误报，`aftermathCode` 等 3 个为行为已由别的 flag 承接的重复声明）。
- 关键词 ledger 的 `engineBehavior=true` 对 patrol/otherworld/concealed/shift 不能按「引擎按规则结算」理解：
  patrol 无通用读点（仅 3 章手写）、otherworld 仅身份声明、concealed/hollow/customizable 走原语 + 章节，
  hidden 有引擎读但 TSK 卡全假阳性。

### 4.5 数据漂移（cards-data ↔ 锁定参考源）

- 40 条差异（25 textEn、12 backTextEn、1 nameEn、1 numeric.horror、5 clues 省略口径、1 textZh 类）。
  逐条复核为参考源错字/旧快照（`ot`→`of`、`catacboms`、`read him`→`ready him`、`Fliip`、`end ot`），
  本仓为修正版；live arkhamdb 抽检 09107 的 `non-[[Elite]]`、09541 的 `enemy_horror:1` 与本仓一致。
- 唯一待核：09649 英文卡名（本仓 `Zan'et el Settat` / 参考 `Zen'et el Settat`），以印刷图为准。
- 参考源 `shroud:-2` 是「变量帷幕」编码约定（非负值），本仓 09549/09672 的「基础 0 + 运行时修正」实现正确，
  扫描初期按字面比较产生的 2 条「不符」已复核撤销。

## 5. 真实引擎探针证据

### 5.1 战役主线流程（`probe.mjs`）

- 清单/注册：manifest 通过校验；143 flow 节点、36 世界地图节点、36 旅行目的地、36 旅行触发点
  （8 章 / 22 幕间 / 5 绿地 / 1 终章 / 0 只路过）、8 状况报告节点、17 幕间入口。
- 真实状态机：`campaignHub → 首章 → 幕间 I → map`；启程马拉喀什（耗时 1，时间 2→3）；死亡酷暑真实进入并
  结算回 map；时间 9 莫斯科（幕间 26 发快捷旅票 1 张）；α/ε 状况报告结算（α：混乱袋 +1 cultist）；
  时间 35 强制启程通古斯卡 → 钥匙议会 → `resolution2` → 尾声 → `end`；
  `status=over`、`outcome=permanentPosition`、`campaign.finished=true`、0 错误。
- 失败/撤退：其他 9 章撤退/全员阵亡均正常收口 `scenarioResult`；congress 全员阵亡抛「未知剧本结局」。

### 5.2 逐章进关与机制探针（`probe.mjs` / `probe-defeat.mjs` / `diag-*.mjs`）

见 §3.3 表。补充真实引擎失败点：

| 探针 | 结果 |
| --- | --- |
| 真实 hub 进 withoutATrace | `TypeError: Cannot read properties of undefined (reading 'rngState')`（behavior.js:683 → rules-state.js:16） |
| debug 跳 sanguineShadows / dogsOfWar | `存在未消费的选择恢复凭据`（resolution.js:159） |
| 真实 hub 进 sanguineShadows 后开场 | 无 pendingChoice，`intro` 静默默认 `everything`（宿主模式同样） |
| 真实推进 onThinIce 幕/密谋/轮末/检定后 | 4 类时机整步抛 `存在未消费的选择恢复凭据` 并回滚 |
| congress 每名调查员受伤 99 | `未知剧本结局`（campaign-flow.js:176） |
| shadesOfSuffering 抽取遭遇 | `未知遭遇卡：09720`（全局遭遇表缺 09720/09721） |
| 抽到 09126/09128 | `未实现的弱点效果：09126/09128`（weakness.js:96-97） |
| 09003 回合结束 / 09012、09013 选「是」 | `未知目标区域 deck`（deck-ops.js:546） |
| 09751 真实遭遇结算 | 选项一 TypeError（`api.tsk` undefined） |
| 09717 阴影分支 | TypeError（`api.placeDoomOnCard` undefined） |

### 5.3 观察投影与隐私探针

- `viewState`/`mechanicView` 在十章 setup 后均返回 `tsk` 投影（keys/map/statusReports/hollows/concealed 等），
  未发现密档正文、异界牌序、他人定制勾选泄露。
- **发现隐私 bug**：`tsk-concealed.js` 的 `concealedProjection` 以全局 `known` 判定 `visible` 且无 observer，
  一人查看后所有座位获得真身/诱饵信息（`cc-probe-projection.mjs`：observer 0 与 1 都拿到 `kind/decoy`）。
- 反向缺口：09747a/09748 的「查看已揭示面」只写无读点旗标，付费玩家反而看不到信息。

## 6. 对抗复核与修正

Lead 对下列 high 级结论做了独立复现（脚本见 §8）：

**确认（可复现）**：withoutATrace 开局崩溃（双路径）；09126/09128 抽到崩；`to:'deck'` 崩溃（09003/09012/09013，
09014/09020 同型）；choiceFor 吞 ChoicePause（sanguine 真实默认 `everything`、dogs/onThinIce 回滚）；
congress 全灭崩溃；shades 抽取 09720 崩溃；09023 反应永不触发（Lead 实测 token 窗口 `_resolvingAssetId` 有值而
`state.skillTest.assetSourceId` 未设）；09018 旧印 +3（cards-data/中文卡面/参考文本一致）；09007 入场伤害未放置
（探针 `asset.damage=undefined`）；09016/09017 证据空操作（`moveCardCounters` 返回 0）；09001 跨座位投影双源；
09751/09717 api 缺失；09756 aura 无读点；09730 变换只翻面；定制少付 XP（10 张，机械 + 对照 checkedFully）；
tskExposed/tskKeyShifted 无派发（全仓 grep + 18 条目）；玩家 Shift 无入口（legalMoves 不枚举密钥）；
P4 交互事务层无人调用；campaignFlow 的 02310/时间 35/Ω/θ 四项；9/10 章测试为合成。

**修正/降级（避免误报）**：
- 「dancingMad 缺 easy/expert tokenMeanings 导致规则算错」→ **部分修正**：真实检定走
  `behavior.resolveChaosToken` 覆盖，easy/expert 的 cultist 仍 -4/-6；受影响的是按 `state.difficulty`
  索引的 AI/命中率预估（`combat-odds.js:155`、`ai-context.js:224`），故降级为 medium（AI/预判口径）。
- 「引擎 6 处 09xxx 卡号分支」→ **撤销**：全部为注释，真实分支 0。
- 「09541 horror=1 是错值」「09107 多出 non-Elite」→ **撤销**：live arkhamdb 与本仓一致，本地参考源旧快照。
- 「09549/09672 可变帷幕未实现」→ **撤销**：参考源负数 shroud 是「X」编码；两章 behavior 已有
  `locationShroudModifier`，实现正确。
- 「probe 报告中 8 章地点数量与定义不符 / congress 起始地点不在场」→ **撤销**：跳舞/钥匙议会/薄冰等章
  按版本/时间动态决定入场地点（v.I/v.II、圣所/巢穴、outsidersLair 后入场），行为在 `setupLocations` 返回的
  实际列表才是口径；真实探针中调查员均落在合法地点。
- 「probe 混乱袋 17 vs 16」→ **撤销**：序幕选择会替换/增删标记，17 张是预期。
- 「09731 note 声称 enemyEngaged 未派发」→ **撤销**：`enemies.js:636` 已由 `triggerReaction` 开窗，行为正确。
- 「09555/09032 等 textEn 漂移是卡面错误」→ **撤销**：参考源笔误/格式差异，本仓为修正版。

**未完全验证（保留为 unverified，不据此升级）**：09759 伤害分配到支援的击败分支（未制造稳定探针）；
09122 perWindow 记账；09727 的 phaseBegins 等价时机与 FAQ；09616 单向连接时点；多座位（2 人以上）hub 全流程；
dancingMad 真实多轮结算（单调查员探针 + 伪造第二座位验证钩子语义）；09653a 生命值「3/人」与参考实现的冲突
（按 cards-data 未记 issue）。

## 7. 修复优先级摘要

完整步骤、修改点与验收命令见同目录 [`fix-plan.md`](fix-plan.md)。
**P0 已于 2026-11-13 全部修复并验收（见 §0.1）；下列 P0 条目保留为修复时的任务定义。**

- **P0（7 项，阻断可玩性，已修复 ✅）**：withoutATrace 开局崩溃；09126/09128 弱点抽取崩溃；`to:'deck'` 洗回崩溃 ×5；
  5 章 choiceFor 吞 ChoicePause（含 onThinIce 不可通关）；终章全灭无 `noResolution`；
  遭遇注册缺卡 09720/09721；四章遭遇牌库不完整（sanguine 8/30、dealings 11/32、dogs 6、congress 0）。
- **P1（17 组，规则正确性与可感知）**：tskExposed/tskKeyShifted 窗口派发；玩家 Shift/转移入口；
  Concealed X 数值语义；迷你卡 kind 跨章契约；`scenarioRuntime` 缺失 api 批量修正；
  调查员 09001/04/07/15/16/17/18/19；玩家卡不可达/空转（09023/09036/09067/09070/09080/09085/09095/09105/09108/09121）；
  公测（blocked）09610/09611/09613/09614/09620；09751/09717；concealed 隐私；章节规则缺口（10 章逐条）；
  观察投影（33 旗标）；战役流程 4 项（禁用卡/时间 35/Ω/θ）；章节测试真实性。
- **P2（9 组，工程收口）**：P8 账本重签；测试真实性；定制勾选口径（10 张）；i18n；
  原语 backlog 与 33 个死声明；重印别名 12049；09064 写死；遭遇组名/派生数据统一。

## 8. 证据与复现

| 内容 | 路径 / 命令 |
| --- | --- |
| 扫描数据（卡面/实现/引用点/数据漂移） | `artifacts/tsk-scan/data/cards.json`、`extract-summary.json` |
| 机械审计（R1/死声明/卡号分支/同文簇/文案/测试真实性/投影/遭遇注册/定制） | `artifacts/tsk-scan/data/screen.json`、`screen2.json`、`dead-flag-review.json`、`encounter-registry.json`、`customization-gates.json` |
| 逐卡 findings（13 分片） | `artifacts/tsk-scan/findings/<shard>.json` + 各分片探针 |
| 汇总账本 | `artifacts/tsk-scan/data/findings-summary.json`、`reports/findings-summary.md` |
| **P0 修复记录** | `artifacts/tsk-scan/data/fix-status.json`；回归 `tests/tsk-p0-regressions.test.mjs` |
| 真实战役流程 | `node artifacts/tsk-scan/scripts/probe.mjs` → `data/probe.json` |
| 逐章撤退/全灭 | `node artifacts/tsk-scan/scripts/probe-defeat.mjs` → `data/probe-defeat.json` |
| 进关/choiceFor 复现 | `node artifacts/tsk-scan/scripts/diag-enter.mjs`、`diag-enter5.mjs`、`diag-hosted.mjs` |
| 弱点/09023 复现 | `node artifacts/tsk-scan/scripts/verify-weakness-crash.mjs 09126`、`verify-pa1.mjs` |
| 章测试实跑 | `cd games/arkhamhorror && node --test tests/tsk-*.test.mjs`（修复后含 P0+P1 回归 617 例 / 0 fail） |
| 冻结门禁 | `npm run scan:tsk:*`、`npm run audit:tsk:*`（3 项失败，见 §4.1） |

**复现约束**：本轮未修改 `games/arkhamhorror` 任何源码/账本；探针均通过公开动作通道
（`createGameState`/`applyMove`/`legalMoves`/真实 hub/`startScenario`）或引擎模块直调执行；
章节流程探针中的逐章结算使用调试 `endScenario`（flow-only），章节内真实可玩性以 §5.2 的失败点为准。
