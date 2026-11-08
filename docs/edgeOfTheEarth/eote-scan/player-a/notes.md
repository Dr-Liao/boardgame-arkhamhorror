# EOTE 玩家卡审计 A（08019–08078）· notes

- 审计员：player-auditor-a；范围：`games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/scope/shards.json#player-auditor-a.codes`（60 张，guardian/seeker/rogue/mystic/survivor 的资产/事件/技能/弱点）
- 交付：`findings.json`（60/60 卡均有 verdict + clauses + file:line 证据 + D2/D4/D5）、本文件
- 口径：只读复核；未修改 `games/arkhamhorror` 任何文件；所有派生中间物在 `games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/player-a/_work/`

## 一、结论分布

| 指标 | 数量 |
| --- | --- |
| 卡 | 60 |
| match | 17 |
| approximation | 36 |
| gap | 7 |
| blocked | 0 |
| issues: high / medium / low | 7 / 47 / 23 |
| 测试：covered / weak | 49 / 11 |

机制线索（screen/*.json 过滤本人分片）：
- `integrity.json`：60 张全部 `verified`，唯一 issue 是 `no-implemented-flag`（低价值，玩家卡普遍如此）；本人分片**没有** `empty-behavior`。
- `keyword-coverage.json`：26 张命中，经核对多数是通用原语（检定=api.test/startTest、搜索=lookAt、快速=fast 通道），不是缺失。
- `perceivability.json`：6 张技能卡（08024/08037/08052/08065/08077/08078）命中 `silent-ability-no-choice-no-log` —— 属机械误报：动态图标在“投入选择”时由 `commitIcons` 计算（src/engine/commit-rules.js:53），但手牌卡面本身不显示动态图标（见 low/medium 记录）。
- `tests-coverage.json`：60 张均 verified；实测 11 张只断言“描述子字段/低层入口”，见下“测试核验”。
- `flags-readpoints.json`：本人分片 0 条 unread（但见 D4 的**字段级**未消费问题，机械扫描未覆盖）。
- `duplication.json`：本人分片 textDuplicateGroups 3 条都是重印（08057/08058/08073），实现侧正确走 `duplicateOfCode` 别名（D5 通过样例）。

## 二、Top findings（high，全部可复现/有读点证据）

1. **08028 追猎行动：神话遭遇“改为”未实现，打出后仍照常抽遭遇卡（多 1 张遭遇）**
   - 条目在 `mythosEncounterStep` 窗口生成敌人，但从未调用 `api.playerTools.skipEncounterStep(context)`；引擎在窗口后检查 `!encounterStep.skip` 才抽遭遇。
   - 证据：`src/cards/entries/08028.js:25,27-44`；`src/engine/turn.js:144-146`；可用 API `src/engine/player-mechanics.js:106-110`（已有 07269 在用 `src/cards/entries/07269.js:4`）。
   - 测试恰好只断言“生成敌人/交战/击败得 3 资源”，未断言“不抽遭遇”（tests/eote-player-m2-1.test.mjs:496-521）。

2. **08070 真法魔典：`Uses (1 charge) + 每轮开始补满` 完全未实现，代理能力无任何费用/次数限制 → 可无限次使用**
   - 条目只有一个 `kind:'free'`、无 cost/exhaust/limit 的能力（`src/cards/entries/08070.js:21-54`）；没有 roundBegins 补满，也没有“把费用/充能转到魔典上”（注释 :8-10 自述未转移）。
   - 测试只断言 `lastTestResult` 存在（tests/eote-player-m2-2.test.mjs:700-708），未测充能/限制。

3. **08074 应急装备：真实打出路径下附属永不发生**
   - 条目在 played resolve 里 `api.moveCard({code:'08074', from:'hand', to:'attached'})`；但真实打出管线在结算前已把事件移出手牌（`src/engine/actions.js:159`），`from:'hand'` 只在手牌查找（`src/engine/card-ops.js:196-220`）→ moveCard 返回 null，日志“无法附属”，卡牌进弃牌堆；“宿主检定 +2”能力因 `hostAssetId` 不存在永不出现。
   - 测试用低层 `runDescriptor`（手牌仍在）绕过真实路径（tests/eote-player-m2-2.test.mjs:726-744）→ prior 账本 verified 是虚报。
   - 引擎其实已为 08074 加了声明式通道：`attachTo` + 附属事件 uses 初始化（`src/engine/actions.js:302-341`，注释点名 08074）与宿主检定读点 `api.playerTools.testAssetSource()`（`src/engine/api-misc.js:1527-1533`）——条目未接线。

4. **08053 / 08058 红色闹钟：“移动最多 2/3 次”分支会允许非法移动、漏掉合法目的地**
   - `here` 在循环外固定为回合开始地点（`src/cards/entries/08053.js:47`、`08058.js:42`），第二次起仍从**起始地点**枚举连接；而 `relocateInvestigator` 不校验相邻（`src/engine/movement.js:186-196`、`src/engine/hidden-rules.js:121-162`）→ 可移动到与当前位置不相连的地点。
   - 测试的 2 充能分支只选“不移动”（tests/eote-player-m2-2.test.mjs:566-604/606-639），未覆盖。

5. **08062 闭环：卡面核心“该行动期间检定可改用 willpower”缺失（引擎原语已实现但未接线）**
   - 条目只用 `api.beginImmediateAction`（`src/cards/entries/08062.js:39-52`），注释自称“缺少 ctx.api 级 substituteSkill”；
   - 实际引擎已有专属原语 `api.playerTools.takeBasicActionWithSubstitution(seat,{from,to})`（`src/engine/api-misc.js:1470-1489`，注释点名 08062；同源 primitive request `m2-2-08062` status=implemented），条目不接线 → 效果缺失。
   - 另：充能数把 neutral 当“职阶”（:13-20）。

6. **08059 掉进兔子洞：全部效果零实现**
   - 条目只把参数写进 `api.setScenarioFlag('downTheRabbitHole')`（`src/cards/entries/08059.js:14-26`）；该 flag 在 `src/`+`content/` 无任何读取点（grep 仅条目与测试命中）→ 升级前 2 张 -1 经验、新购卡 +1 经验在游戏内完全没有效果。
   - 测试只断言 flag 被写（tests/eote-player-m2-2.test.mjs:640-647）。

## 三、疑似 prior 账本虚报 / 过时披露（Lead 重点复核）

`audit/eote-player-acceptance.json` 对 60 张全部标 `status=verified`、`simplified=false`、evidence 指向测试行号。独立复核发现：

1. **测试绕过真实路径导致 verified 虚报**
   - 08074：测试用低层 `runDescriptor`（手牌未移除）→ 真实 play 路径附属失败（见二-3）。
   - 08053/08058：测试只走 `runDescriptor` 且移动分支只选 skip；未测真实 turnBegins 窗口与移动合法性。
   - 08059：只断言 flag，无实际效果。
   - 08070：只断言“发生了一次检定”，无充能/限制。
   - 08062：只断言“行动选择发生”，无 willpower 替代。
2. **披露与引擎现状不符（过时/错误近似）**
   - 08066 注释称 `lookAt` 的 arrange 只支持 ≤4 张、顺序能力待接线；实际 `src/engine/deck-ops.js:273-305` 已支持 >4 张（注释点名 08066），primitive request `m2-2-08066` implemented → 该近似已不存在（实现行为正确，仅注释/账本口径过时）。
   - 08062 注释称缺少 substituteSkill API；实际 `api.playerTools.takeBasicActionWithSubstitution` 已实现（m2-2-08062 implemented）。
   - 08056/08027/08040/08069 的“沉稳伤害分支”问题：`flags.composureDamage` 读点已在 `src/engine/harm-threat.js:160-165`（m2-2-08056 implemented），但**没有任何条目声明它**；08056 仍用 `assetRule.redirectOneDamageToSelf`（每次只转 1 点）近似，08027/08040/08069 连近似都没有（伤害分支纯缺失且未披露）。
   - 08074 注释称“attachTo 事件通道不初始化 uses、无宿主检定读点”；实际 `src/engine/actions.js:336-341`、`src/engine/api-misc.js:1527-1533` 已补（m2-2-08074 partial）。
3. **声明未接线（D4，机械扫描未覆盖到字段级）**
   - 08033 `api.setScenarioFlag('eoteConfirmedPath')`（src/cards/entries/08033.js:71）无读取点 → Campaign Log 记录实际不可见。
   - 08059 `api.setScenarioFlag('downTheRabbitHole')`（:18）无读取点。
   - “Limit 1 [[Composure]] in play”（08027/08040/08056/08069）与“Limit 1 [[Footwear]] per investigator”（08035）无引擎读点（composure 目前只用于伤害分配：src/engine/stats.js:55）。
   - “Researched”关键字（08041–08044，`src/cards/entries/08041.js:2` 等）无任何构筑/战役读点（grep researched 仅 cards-data 文本）。
   - 08074 直读引擎私有 `state._resolvingAssetId`（:58），而公开读点 `api.playerTools.testAssetSource()` 存在（api-misc.js:1530）。
4. **primitive-requests 状态与条目不一致**（目录 `artifacts/migration/eote/primitive-requests/`）
   - implemented：08053、08056、08062、08066、08076（部分实现）；partial：08058、08074；rejected：08020/08021/08024/08028/08031/08034/08046/08047/08049/08055/08057/08064/08067/08070/08072。
   - 其中 08062/08066/08074/08056 的“待原语/无读点”表述已过时（见上）。
   - 注意 `artifacts/migration/eote/primitive-requests/` 有仓库根与 mod 根两份（内容不同），审计/账本引用的路径需统一。

## 四、D5 复用清单（应上收/共享）

1. **“你控制卡牌的职阶数”计数（5 份手写，neutral 口径不一致）**
   - 08022 `api.cardFactions`+neutral 过滤（:32-35）；08036 `ALL_CARDS.factions`+neutral 过滤（:16-24）；08050/08062/08077 `ALL_CARDS.klass`**未过滤 neutral**（08050:11-18、08062:13-20、08077:9-16）。
   - 建议：一个共享 helper/引擎读点，统一“class ≠ neutral”。
2. **“手中/投入时双向技能图标交换”（4 份手写）**：08024:24-28、08037:22-26（三元，多技能漏算）、08065:20-26、08078:20-26（两 if）。建议共享 iconBonus helper。
3. **沉稳天赋模板（4 张）**：08027:18-28、08040:15-25、08056:15-28（额外 assetRule 近似）、08069:22-30（requireTestTrait）。建议统一 `flags.composureDamage` 声明 + 引擎“trait 限 1 在场”读点。
4. **通路档案/灵脉（5 张：08033 + 08041–08044）**：每张各自手写 entersPlay/free/action 骨架与 LeyLine 记账；08042 用地特性、08041/08043/08044 只扣 uses。建议实现通用 leyline 标记原语 + shared helper（primitive request m2-1-08033）。
5. **红色闹钟两等级（08053/08058）**：分支骨架 ~80% 同构，建议共享分支 helper（顺带统一修移动重算 bug）。
6. **重印（D5 正确样例，无需修改）**：08057↔60379、08058↔60384、08073↔12073 —— cards-data 在重印号上 `duplicateOfCode`，运行时别名读点 `src/engine/stats.js:124-133`，EOTE 只保留一份实现。
7. 通用原语使用良好样例（供其它卡参考）：08019 permanent/`playCardFromHandFree`、08032 `topDeckCodes`、08045 `ignore:opportunityAttack` modifier、08073 `harmAssigned`/`assetHarmPlaced` 窗口、08076 `exileFromDiscard`/`exileAfterPlay`、08060 `add:slot`。

## 五、D2 可感知性摘要

- 有 choice+prompt+info 日志的卡普遍可感知；`api.choice` 覆盖 35 张、`api.info` 覆盖 49 张。
- 记为 partial 的主因：
  - 08032 “揭示牌库顶 5 张”只记录数量、未公开牌名（Reveal 应为公开信息）。
  - 08033 灵脉只有地点特性、Campaign Log 用无效 flag。
  - 08041/08043/08044 “灵脉在敌人/调查员身上”无任何投影。
  - 08055 “放在一边”实际在弃牌堆（位置错误）。
  - 08070 看不到充能/每轮补满/使用次数限制。
  - 08062 的 willpower 替代无任何 UI/日志。
  - 08074 附属失败只有“无法附属”日志。
- 6 张 commit-only 技能卡（08024/08037/08052/08065/08077/08078）投入图标只在投入面板可见，手牌卡面不显示动态图标 → low。

## 六、测试核验

- 运行（in-process，未用 spawn）：
  - `node tests/eote-player-m2-1.test.mjs` → 30 tests / pass 30 / fail 0
  - `node tests/eote-player-m2-2.test.mjs` → 30 tests / pass 30 / fail 0
  - 注意：`node tests/a.mjs tests/b.mjs` 只运行第一个文件（多余参数被忽略）；README 给的 `--experimental-test-isolation=none --test` 形式或分文件运行才可靠。
- “weak”测试（11 张）：08027、08028、08040、08046、08053、08058、08059、08062、08063、08070、08074 —— 只断言描述子字段/低层 descriptor 入口/未覆盖缺陷点，不能作为语义正确性依据（详见 findings.json 各卡 tests.note）。
- 其余 49 张测试为行为级断言（真实窗口/legalMoves→move→act/API 副作用），质量总体较好；但 08025/08030/08067 等使用 `legalMoves`/`settle` 的部分仍依赖 fixture 语义。

## 七、引擎读点核验（本批用到的关键结论）

- `playCondition`：`src/engine/ability-rules.js:380-440`（evaluateCriteria/descriptorUsable）→ 已接线。
- `playCostModifier`：`src/engine/turn-flow.js:469`（对正在打出的卡自身）→ 已接线。
- `modifiers`（含 `condition.when` / `resourcesAtLeast` / `ignore:opportunityAttack` / `add:slot`）：`src/engine/modifiers.js:102-169,192,428-443`；采用点 `dispatch.js:331`、`assets.js:221-222` → 已接线。
- `freeTriggers`（含 `requireTestTrait`）：`src/engine/stats.js:82-89` + `src/engine/treachery-tokens.js:289-296` → 已接线。
- `composure`：仅恐惧分支 `src/engine/stats.js:55` + `src/engine/harm-threat.js:163`；`flags.composureDamage` 伤害读点存在（:160-165）但本批无条目声明。
- `uses/usesType/discardWhenEmpty`：条目→引擎初始化 `src/engine/card-defs.js:310-321`；耗尽弃置 `src/engine/ability-exec.js:204`。
- `cost:{uses}`：`src/engine/ability-rules.js:97,114,148` + `ability-exec.js:139-141,169` → 已接线。
- `exceptional`（经验×2）/`deckLimit`：`src/engine/deckbuilding.js:294,307,82`；`deckConstruction.sizeBonus`：`web/deck-rules.js:46`、`campaign/campaign.js:198`。
- `permanent` 玩家卡：`src/engine/setup.js:339` 开局 `newPlayerAssetInstance` → 已接线。
- 触发窗口：turnBegins(`turn.js:532`)、upkeepEnd(`phases.js:222`)、mythosEncounterStep(`turn.js:144`)、clueDiscovered(`locations.js:436-440`)、investigateSuccess(`actions.js:645`)、assetEnteredPlay(`actions.js:455`)、cardDrawn(`deck-ops.js:608-609`)、encounterDrawn(`encounter.js:145-148`)、enemyAttacked(`enemies.js:242-247`)、harmAssigned(`enemies.js:1020`)、assetHarmPlaced(`enemies.js:984-987`)、testBegins(`tests.js:273-274`)、testEnds(`tests.js:596`)、investigationPhaseStarts(`turn.js:573`) → 均存在。
- `entersPlay/leavesPlay/setup` 生命周期：`src/engine/assets.js:379-388`、`lifecycle.js:54-56`、`ability.js:57-81` → 已接线。
- `addEffect` 时长链：`src/engine/effect-state.js:31-53`；`endOfTest` 过期 `tests.js:1533` → 08053/08058 的“下一次检定 +3/+4”按此读点可生效。
- 混沌标记 token face 命名：`elderthing/autofail/eldersign/skull/cultist/tablet`（`content/campaigns/theDreamEaters/tde-chaos.js:47-56`；`chaos-bag.js:52-74` 返回字符串）→ 08048 映射正确。
- `api.playerTools` 里本批相关但未使用的原语：`skipEncounterStep`（08028 应有）、`takeBasicActionWithSubstitution`（08062 应有）、`testAssetSource`（08074 应有）。

## 八、局限 / 未验证

- 未逐张核对官方卡面与 cards-data 中文翻译差异（cards-data 为权威口径；中文文本与英文存在个别措辞差异，如“可以移动”/“移动”）。
- “cards you control 的不同职阶”是否含调查员卡未找到官方裁决来源（参考实现 Haskell 侧未检索到 08022 CardDef）；本文件只按“中立不算职阶”与实现间不一致记为 medium/low。
- 08020 的“自动成功”严格实现需要 doFight 新 option（autoSuccess）；未评估改动成本。
- 08021 持续改向、08055 setAside、08041-44 leyline、08028 敌人附属均依赖未实现原语，修复路径指向 primitive-requests。
- 未运行 verify-eote / audit-eote / npm run test:*（沙箱禁止 spawn，README 明确）。
- `perceivability` 的“能否在真人 UI 看到”只按引擎选择/日志/投影读点判断，未启动浏览器实机点击验证（本 area 任务不要求浏览器验收）。
