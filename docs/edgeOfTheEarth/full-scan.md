# 《地球边缘》全量扫描报告（2026-11-08）

> 扫描对象：EOTE 全量内容（403 条记录 = 367 主卡 + 36 关联面；5 调查员；115 玩家卡；266 战役卡；8 章节单元；16 共享遭遇组；战役流程层）。
> 扫描方式：**独立复核**（不采信既有账本 `verified`），逐卡逐子句 + 真实引擎路径探针 + 机械审计 + 对抗式复核。
> 机器账本：`audit/eote-full-scan.json`（本目录同仓库）。完整逐卡逐子句数据、机械筛查、探针与日志在工作区 `G:/boardgame-hall-ai/games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/`（含 `全量扫描报告.md` 完整版、`ledger/eote-full-scan.json` 904 条 issue、`bundles/` 403 份逐卡审阅包、各分片 `findings.json`）。
> 结论只代表本次复核对当前工作区源码的判定，未修改任何源码。

## 0. 结论

**P8 的「全量 verified / releaseAcceptance passed」不能独立复现。** 按「卡面印刷文本逐子句在真实引擎路径可达」标准：403 条记录 **match 90（22%）/ approximation 111（28%）/ gap 202（50%）**；8 个章节单元**没有一个**能在真实引擎路径完整跑通。P8 逐卡账本**证据系统性错配**：129 条 scenario-ledger 全部指向无关测试（字面口径 135/403 不可追溯、修正后 131；110 条卡号任何测试都不出现）。章节测试与 P8 campaign 验收通过 `api stub 直调 behavior` / `finishScenario` 跳过章节内真实游玩，是「测试全绿但真实不可玩」的根因。

| 指标 | 数值 |
| --- | --- |
| verdict | match 90 / approximation 111 / gap 202 / blocked 0 |
| issue（去重） | 904：high 476 / medium 312 / low 116；另有 90 条场景级 issue |
| 分区 verdict | 调查员 14/5/3；玩家卡 38/60/17；战役卡 38/46/182 |
| EOTE 测试实跑 | 477 例 / 474 pass / 3 fail（2 为沙箱 spawn 伪失败，1 为 P8 账本 hash 漂移真实失败） |
| 只读门禁 | audit-eote / mechanism / scope / primitive-plan / rules / interactions / compliance / dead-primitives / 两索引检查 exit 0（其通过标准≠规则等价） |

## 1. P0 阻断问题（均已复核）

1. **Ice&Death I/II/III 剧本行动不在 legalMoves**：behavior 导出 `scenarioActions/performScenarioAction`，引擎只调 `actions/performAction`（`iceAndDeathPart{1,2,3}/behavior.js:397-398/396-397/159-160; src/engine/moves.js:222; src/engine/dispatch.js:633`）→ 营地撤退/翻底牌行动不存在，08521/08526/08546 目标不可达（Lead 探针实测 legalMoves 无 scenarioAction）。
2. **幕/议程 reveal 未接线**：Part1 `agendaReveal(){}` 空函数、Part2/3 无 `agendaReveal`；三章无 `actReveal` → 引擎抛「密谋/场景规则尚未迁移：08521/08523/08544/08526/08546」（`behavior.js:399; src/engine/phases.js:268-283; src/engine/reveal.js:151-176`）。
3. **Ice&Death 混乱标记修正值全部按 0 结算**：章节导出 `chaosTokenValue`，引擎只读 `resolveChaosToken`（`iceAndDeathPart1/behavior.js:368-370,411; src/engine/treachery-tokens.js:349`）；Part III 另缺 `afterTest`。
4. **冰原 13 地点 shroud 未进入地点数据** → 调查难度 NaN 必失败；未探索地点入场费永不收取（`content/campaigns/edgeOfTheEarth/card-data.js:23-41; iceAndDeathPart1/definition.js:98-104; src/engine/actions.js:593; src/engine/movement.js:235-249`）。
5. **Fatal Mirage 无法正常胜利/结算**：议程推进 throw（`agendaReveal` 缺失，真实 `checkAgenda` 复现「密谋规则尚未迁移：08550」）、v2/v3 `agendaIndex` 越界（agendas 仅 1 张、doom 20 仍 no-op、doomThreshold 恒 15、actStage 恒 1a）、19 个幻景地点 clues=0、08549 混乱标记数值全 0（复核新增）、`resolution` 记录钩子缺失、28 张关联面死数据（`fatalMirage/definition.js:66-69,146-147; behavior.js:69-74,141-142,201-265,276-296,302-323; src/engine/phases.js:268-283; src/engine/turn.js:131,140; src/engine/campaign-flow.js:241-243`）。全灭 `noResolution` 仍可结束，但不可胜利且记录缺失。
6. **古者之城钥匙无玩家入口 → 幕 1 目标不可达**；08629 `actRule.forcedOnEnemyEnter` 全仓仅条目自身；议程 2 背面 R2 未实现（`cityOfTheElderThings/behavior.js:180-201,256-293,415-417; 08629.js:30`）。
7. **古者之城地点动作 TypeError 卡死**：`api.test(seat, skill, difficulty, {source, resolve})` 把 options 当第 4 参，引擎签名第 4 参是 resolve 回调（`cityOfTheElderThings/behavior.js:571` 等；`src/engine/scenario-runtime.js:657`）→ 实机抛「options.resolve is not a function」，待决选择 commit 卡死。
8. **Heart of Madness Part2**：08672 无印刷 doom → `doomThreshold=0` 提前清场（`definition.js:53; src/engine/act-agenda.js:435`）；R1/R2 记录全仓只读无写入 → 结局永久不可达（`behavior.js:275-276`）；08716 成功躲避后引用未定义 `here` → ReferenceError（`_shared/expedition_team/08716.js:35`）。
9. **Peaks/City 8 张专属诡计真实遭遇零结算**：`treacheryDefinition` 缺 `entryRevelation`（`toTheForbiddenPeaks/definition.js:110-117; cityOfTheElderThings/definition.js:121-127; src/engine/treachery-tokens.js:113-124`）；两章遭遇牌库仅 14/20 张本章卡。
10. **玩家卡真实路径失效**：08105/08107 窗口不出现、08102 context 形状不符、08130/08131 威胁区治愈不可用、08091 第二子句缺失、08083 healAsset 参数错、08028/08074/08059 未接线或零实现、08053/08058 非法移动（见工作区 `games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/player-a|player-b/findings.json`，对抗复核已独立复现）。
11. **调查员真实路径 bug**：08013a 全局检定结束+翻面标记无过期点、08006 可被 searchDeck/moveCardTo 绕过、08005 第二模式无真实激活窗口+实现缺口+图标双计、08004 牌库顶 sync 缺口与换牌座位 bug、**08014a fightEvade 额度从不清理**（下一轮普通行动可用 0）（见 `games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/investigators/findings.json`、`games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/verify/inv-verify.md`）。
12. **P8 逐卡账本证据系统性错配**：按字面口径 135/403 不可追溯（含 4 条 investigator 假阳性，修正后 131）；稳健核心为 129 条 scenario-ledger 全部指向无关测试（129/129 不含卡号；110 条=96 verified+14 simplified 在任何测试中都不出现），根因见 §4.1。

## 2. 分维度

- **D1 实现 vs 描述**：match 22% / approx 28% / gap 50%；战役卡 68% gap。战役侧典型：Ice&Death 08521/26/46 目标与撤退、08527–08543 剧情/谈判链、08544–08548 多张 rule 大段缺失（08544 agendaWouldAdvance 语义反了）；Peaks 攀爬/afterMove 未接权威移动、08607 嵌套错位、08608/09 数值错、08614–08620 Expedition 支援零能力；City 08629/30/34/37/40/41/43 声明未接线；Heart 08660/62/73/74–78/79/87 规则缺失或错值。
- **D2 可感知**：链路完整（选择事务 + UI 渲染 + privacy 逐观察者过滤 + scenarioFlags 白名单；6 份浏览器账本 passed、200 张截图全在）。缺口：动态 label/prompt/info 全中文硬编码（488/491、192/192、286/286，EN locale 无回退，medium）；City `lastAutoFailReason` 写后无读（medium）；`frostRevealedThisTest` 死写（low）。
- **D3 关卡可跑通**：战役流程图本身可走通（flow-only 真实引擎抵达 campaign end；检查点/幕间/FM 回场/失败/存档往返验证通过）；但章节内真实玩法不可跑通（IDP2 议程崩溃、City TypeError 卡死、IDP3/FM 无正常结算、IDP1 无合法撤退、H2 提前清场）。指南面板 8/8 齐全、无英文冒充（缺失走「中文待补」），zh 覆盖不完整（FM 缺 33 块等）；混乱袋四档与 scope 逐 token 一致，但 FM/IDP3 缺失败 rider、Peaks/City 未加 elderthing token、H1 tokenMeanings 为空。（**2026-11-09 翻译修复批次更新：中文覆盖已补齐，8 章 469/469、战役 258/258、指南 `chineseGaps=0`；见 [`translate/fix-batch.md`](translate/fix-batch.md)。**）
- **D4 原语合规**：合规/死原语/机制/范围/规则书/交互/索引门禁 exit 0；引擎行为级卡号分支 0（100 处字面量均为注释/availability 表）。但 **207 条声明无读点**（158 key + 49 规则调度值，171 条在 verified 卡上）；49 条调度值 = 声明 handler 名但无实现（high）；R1 工具对局部变量直写有假阴性（`08008.js:30`，工具 `:50-54` 正则）；escape 登记 0 与 201 个 resolve 条目不符；≥21 处测试只断言声明数据。
- **D5 复用**：应复用未复用 4 簇：08535–08543 九张克隆（0.82–0.89）、08120–08124 五张克隆（0.926）、08693/08694、08117/08119；Ice&Death 三份地点/连接/chaos 数据漂移；跨循环重印 4 条（08004↔98007、08057↔60379、08058↔60384、08073↔12073）只实现一次，合规。

## 3. 账本与测试可靠性

- `audit/eote-all-card-acceptance.json`：证据系统性错配（129 条 scenario-ledger 全指向 Heart Part2；字面 135/403 不可追溯、修正 131；110 条无任何测试提及）；生成器根因见 §4.1。
- `audit/eote-migration.json`：releaseAcceptance=passed、playable，但 4+ 章节真实不可玩；P8 campaign/browser 用 finishScenario/调试 endScenario 跳关。
- `audit/eote-investigators.json` sha 与 all-cards 账本不一致（真实 `--check` 失败）。
- simplified 披露索引缺口：p7-08560/p7-08587 请求文件在工作区根 `artifacts/migration/eote/primitive-requests/`（43 文件）存在，但模组内副本（25 文件）不一致且 deferred 索引未列入。
- 对抗复核修正：调查员 5 条 high 中 3 confirmed / 1 severity 降级 / 1 定性改写（并新增 08014a 额度不清理）；FatalMirage Top5 3 confirmed / 1 partial / 1 partially-refuted（primitive 目录、08549 数值两处事实由复核纠错）。
- `audit/eote-player-acceptance.json`：115 verified/noSimplified 为空门禁（55/115 注释自述 approximation、11 条正式 note、0 条 simplified:true；`tools/audit-eote-player.mjs:71-73,91` 只看 flag；queue 5 条 done 未接线）。
- `tests-coverage` file-only 归因误报（lily.test.mjs:265-285 有真实断言，且与 all-cards 账本 strong 判定自相矛盾）。
- 测试全绿不可作章节可玩证据（api stub 直调 behavior；P8 用例每章 setup 后 debug endScenario）。

## 4. 修复优先级

**P0**：统一章节 behavior 钩子契约并补 `agendaReveal/actReveal/resolution/checkObjectives`（Ice&Death I/II/III、FatalMirage）；修 City 地点动作 api.test 签名与钥匙入口/议程 2；修 Heart2 08672/R1R2/08716；修冰原 shroud/入场费/Part3 shelter+clues；Peaks/City 诡计 entryRevelation 与 gather；修 10–11 两类玩家/调查员真实路径 bug；修审计流水线（证据映射、sha、simplified 请求、R1 漏检、章节测试真实引擎化）。
**P1**：207 条声明逐条接线或删除并降级账本；49 条调度值落地 handler；9+5 克隆上收原语；三份地点数据收敛；26 张 simplified 重新披露；动态文案 i18n；lastAutoFailReason 接 UI。
**P2**：浏览器补 EN 文案/感知断言；P8 campaign 验收禁止跳关；重印别名表；escape 登记；测试断言从「声明存在」升级为「行为被执行」。

## 4.1 对抗复核修正（2026-11-08）

对三组重结论启动独立复核（`games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/verify/`）：

- **玩家卡 B**：9/9 条 high 实质确认、0 驳回（真实引擎探针 A1/A2、B2/B3、C2/C4、D1、G）；修正 3 处证据行与「引擎从不设置 actionKind」的夸大（限定 EotE 正常路径）。
- **FatalMirage**：Top5 3 confirmed / 1 partial / 1 partially-refuted；25 条 high 抽样 22 confirmed / 3 partial / 0 refuted。**新增关键发现：08549 四个混乱标记真实检定 delta 全 0**（`chaos.js:6-11` 数字 schema vs 引擎 `{kind,delta}`；`behavior.chaosTokenValue` 无读点），已升为 P0。同时纠正：`p7-08560/08587` primitive 请求文件在工作区根 `artifacts/`（43 文件）存在（审计员查错目录）；「死锁」应为「不可胜利（全灭 noResolution 可结束）」；XP 批评打在从未被调用的 `scenarioResolution` 死代码上。
- **调查员**：3 confirmed / 1 severity 降级 / 1 定性改写（08005 第二模式无真实激活窗口=未实现+实现缺口）；新增 08014a fightEvade 额度不清理（下一轮普通行动 0）、08013a 翻面标记无过期点、08006 可被 moveCardTo 绕过、08005 图标双计；整体可信度 7.5/10。
- **全卡账本口径修正**：135/403「字面不可追溯」，其中 4 条 08011b/12b/13b/14b 为假阳性（lily 测试覆盖 b 面）→ 修正 131；稳健核心为 **129 条 scenario-ledger 系统性错配**（129/129 指向 Heart Part2、0/129 含卡号；110 条=96 verified+14 simplified 在任何测试中都不出现）。根因：`tools/audit-eote-scenarios.mjs:88-90`（每章塞全部 264 张 CAMPAIGN_CODES）+ `tools/audit-eote-all-cards.mjs:258-261`（last-wins）、`:302-308`、`:429,470`（gate 只查 evidence 非空→假绿）。
- **玩家卡验收门禁**：115 verified/noSimplified 为空门禁——55/115 条目注释自述 approximation、11 条正式 note、0 条 simplified:true；`tools/audit-eote-player.mjs:71-73,91` 只看 flag。

## 5. 证据与复现
完整报告/数据：`G:/boardgame-hall-ai/games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/`（`全量扫描报告.md`、`ledger/eote-full-scan.json`、`ledger/report-appendix.md`、`bundles/`、`screen/`、`{investigators,player-a,player-b,campaign/a..d,scenarios,interactions,primitives}/findings.json`、`verify/`）。
复现（沙箱内只读）：`node games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/tools/extract-scope.mjs`、`mechanical-screen.mjs`、`triage-unread.mjs`、`ledger-evidence-check.mjs`、`ledger-validity.mjs`、`dead-hooks-exact.mjs`、`diff-allcards.mjs`；EOTE 测试 `node --experimental-test-isolation=none --test tests/eote-*.test.mjs tests/replay-eote-p8.test.mjs`（477 例）。
