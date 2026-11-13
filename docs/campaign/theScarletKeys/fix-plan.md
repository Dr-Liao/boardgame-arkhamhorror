# 八循环《绯红密钥》修复步骤（fix-plan）

> 配套 [`full-scan.md`](full-scan.md)（扫描结果、逐卡证据与复现）。本文件把独立复核发现的问题收敛成可执行修复步骤：
> **P0（崩溃/章节不可进）→ P1（规则正确性与可感知）→ P2（账本/测试/i18n/原语收口）**。
> 每项含「现象/证据 → 根因与修法 → 验收」。
> 口径沿用仓库规范：先原语后卡牌；条目只读状态、写入只走 `ctx.api`；引擎不新增卡号分支；
> 修卡后重建索引并跑 `cards:check` / `cards:encounter-check` / `audit:entries`；行为变化先
> `replay-fixtures --baseline` 再 `--compare`；账本用对应 `--write` 重签。
>
> 状态（2026-11-13）：**P0 全部 7 项已修复并验收**（真实引擎回归见
> [`tests/tsk-p0-regressions.test.mjs`](../../../tests/tsk-p0-regressions.test.mjs)；
> 14/14 个 TSK 冻结门禁通过、626/626 个 TSK 测试通过；受影响的 TSK 账本
> （scope / mechanism-scan / baseline / primitive-plan / rules / interactions / investigators / player /
> scenarios / all-card / migration）与 `audit/ability-coverage.json` 已按当前工作区重签）。
> 同批还修掉了 3 个修复过程中暴露的引擎/条目契约缺口（见 §P0 修复记录）。
> P1（17 组）全部与 P2 的其余组尚未开始修复；P2-1（P8 账本重签）已随本轮 P0 验收完成。

## P0：崩溃与章节不可进（7 项，全部已修复 ✅）

### P0 修复记录（2026-11-13）

| 项 | 修复文件 | 关键改动 | 验收证据 |
| --- | --- | --- | --- |
| P0-1 | `withoutATrace/behavior.js` | `shuffleWith(helper, cards, state)` 补第三参；helper 缺失时回落引擎 `randomValue(state)`；`arrangeConcealedAround` 补 state | 真实开局进入（4 地点 / 24 遭遇牌 / 4 迷你卡）；`tsk-p0-regressions` P0-1 |
| P0-2 | `src/cards/entries/09126.js`、`09128.js`、`src/engine/ability.js`、`src/engine/turn-flow.js` | 两张基础弱点声明 `weaknessStaysInHand`（不再走未实现 profile）；09126 新增通用字段 `endTurnInHandDamage: 1`（镜像 `endTurnInHandHorror` 的手牌扫描读点）；移除 09126 无派发点的 fromHand 强制能力 | 抽到留手不崩；回合结束 -1 伤害；`tsk-p0-regressions` P0-2、`tsk-player-m2-4` |
| P0-3 | `src/engine/deck-ops.js`、`src/cards/entries/09003/09012/09013/09014/09020.js`、`09032.js` | `moveCardTo` 始终走 `normalizeCardMove`（`to:'deck'`→`deckTop` 由 zones.js 别名表统一）；5 张卡改用规范目标区；09032 的 `seat` 从规格对象移到 options | `moveCardTo` 目标区归一 + 5 卡路径；`tsk-p0-regressions` P0-3 |
| P0-4 | `src/engine/resolution.js` + 5 章 `behavior.js` | 新增 `isPendingChoice(error)` 导出；5 章的 `choiceFor` 只吞普通错误、`ChoicePause`/`ResolutionCheckpoint` 原样重抛 | 血色阴影开场三选一、战争疮痍版本选择、如履薄冰幕推进真实出现；`tsk-p0-regressions` P0-4a/b/c |
| P0-5 | `congressOfTheKeys/definition.js` | `resolutions` 补 `noResolution`（正文用战败正文），并让 `SCENARIO_TEXT.resolutions` 同步（否则被 `...SCENARIO_TEXT` 覆盖） | 全员阵亡 → `scenarioResult`/`noResolution`；`tsk-p0-regressions` P0-5 |
| P0-6 | `card-data.js` + `shadesOfSuffering/definition.js` 等 6 章 | 新增 `encounterGroupCode / encounterGroupCards / encounterGroupDeck` 单一展开原语（含 `darkCult→pentagram`、`shadowOfADoubt`、`strikingFear` 别名）；遭遇定义表并入牌库里的共享组卡 | 全局遭遇表 10 章 0 缺卡；苦痛之影抽 09720/09721 正常；`tsk-p0-regressions` P0-6 |
| P0-7 | 6 章 `definition.js`/`behavior.js` | 遭遇牌库按印刷 gather 组补齐：血色阴影 30、暗中交易 32、战争疮痍按版本 30/30/36、苦痛之影 30、如履薄冰 43、钥匙议会按版本 + v.I 第二牌库；战争疮痍 `modifyDeck` 按版本换组、钥匙议会 `modifyDeck` 追加投票进牌库的同志会敌人 | 6 章真实开局牌库完整且每张牌全局可解析；`tsk-p0-regressions` P0-7；`probe.mjs` 10/10 章可进入 |

同批修复的契约缺口：

- `src/engine/ability-exec.js`：非玩家强制能力的窗口实例键补「目标卡 id」。此前
  `doomPlaced` 在同一回合内对第二张卡放毁灭时会被当成同一窗口实例而跳过强制能力
  （09571「彰显」只有第一个异教徒的毁灭会翻成线索面）。只在 context 带 `card` 时追加键段，
  不带目标卡的窗口实例键逐字不变，不改既有重放指纹。
- `src/engine/tsk-state.js`：战役 TSK 扩展新增 `outsideEncounterDeck`（钥匙议会 v.I 第二遭遇牌库），
  纳入容器白名单与卡号数组校验。
- `tests/tsk-player-m2-4.test.mjs` 的 09126 回合结束用例从「无派发点的 fromHand 强制能力」改为
  引擎读点断言；`tsk-scenario-{congress,sanguine,onThinIce,dogsOfWar}.test.mjs` 的「旧牌库 =
  专属组」断言同步为印刷完整牌库。

## P0：崩溃与章节不可进（7 项）

### P0-1 《不留痕迹》真实开局崩溃（withoutATrace 完全不可玩）

- 现象：真实 hub 启程到 Bermuda Triangle 后点「开始关卡」抛
  `TypeError: Cannot read properties of undefined (reading 'rngState')`；调试跳关同样。章节无法开始。
- 证据：`content/campaigns/theScarletKeys/scenarios/withoutATrace/behavior.js:683`
  `shuffleWith(helper, [...])` 少传第三参 `state`；`behavior.js:248-261` 在 `helper.shuffle` 存在时执行
  `helper.randomValue(state)`；实际崩溃栈指向 `src/engine/rules-state.js:16`。
  `behavior.js:493-498` `arrangeConcealedAround` 同型（默认 helper 为空时退化为**不洗牌**，属 P1-9）。
  章测试 `tests/tsk-scenario-withoutATrace.test.mjs` 用只有 `shuffle` 的 stub 掩盖（不触发 randomValue）。
- 修法：两处调用补 `state`；`shuffleWith` 增加参数校验（`helper.randomValue` 缺失时回落到内容层
  `randomValue(state)`）；新增强制真实引擎回归（`createGameState`+hub 进关 + 真实 `startScenario`）。
- 验收：真实 hub 进关无异常；`node --test tests/tsk-scenario-withoutATrace.test.mjs` 仍过；
  新增 `tests/tsk-p0-regressions.test.mjs` 覆盖；6 次遭遇抽取后迷你卡位置为洗牌随机（种子可复现）。

### P0-2 基础弱点 09126/09128 抽到即崩溃

- 现象：任意 TSK 调查员牌库抽到 09126/09128 时抛 `未实现的弱点效果：09126/09128`，整局中断。
- 证据：`src/cards/entries/09126.js:23`、`09128.js:18` 只声明 `playableWeakness`，未声明
  `weaknessStaysInHand` 等弱点 profile；`src/engine/weakness.js:96-97` 找不到 profile 直接 throw。
  Lead 复现：`node artifacts/tsk-scan/scripts/verify-weakness-crash.mjs 09126`（09128 同）。
- 修法：两张卡接弱点 profile（09126：留在手牌，`turnEnded` 强制展示并受 1 伤害；09128：
  留在手牌，`commitIconBonus` 手牌来源削图标），或改为引擎支持的弱点描述子；补「抽到即结算」回归。
- 验收：真实 `draw` 抽到两张弱点均只进入对应区域/窗口，不抛错；`validateTskState`/JSON 往返通过。

### P0-3 `api.moveCard({to:'deck'})` 非法目标区崩溃（5 张卡同型）

- 现象：09003 回合结束强制洗回牌库必崩（每轮），09012/09013 选「是」洗回崩溃；09014/09020 同型潜在崩溃。
- 证据：`src/cards/entries/09003.js:24`、`09012.js:27`、`09013.js:24`、`09014.js:14`、`09020.js:15`
  使用 `to:'deck'`；`src/engine/zones.js:28-29` 合法目标为 `deckTop/deckBottom`；`src/engine/deck-ops.js:466`
  在 `rawSpec.to` 存在时跳过 `normalizeCardMove`，`:546` 抛「未知目标区域 deck」。
- 修法：5 张贴换成 `to:'deckTop'`；同时在 `src/engine/deck-ops.js` 统一「有 `to` 也走
  `normalizeDestination`」并补单测（防止同类再次发生）；`zones.js` 的源/目标别名表保持单一事实源。
- 验收：Lead 探针 `artifacts/tsk-scan/findings/tmp-probe4/6/14.mjs` 不再抛错；新增真实引擎回归
  （卡森弱点回合结束、阿米娜双真言互相洗回）。

### P0-4 5 章 `choiceFor` 吞掉引擎 `ChoicePause`：玩家选择被默认或事务崩溃

- 现象：`sanguineShadows` 真实 hub 开局三选一不出现，静默默认 `everything`；`sanguineShadows`/`dogsOfWar`
  调试跳关抛 `存在未消费的选择恢复凭据`；`onThinIce`/`congressOfTheKeys` 推进幕时同错。
- 证据：5 章 behavior 的本地 `choiceFor` 用 `try { return choose(request) } catch { return null }`
  （sanguineShadows:540、dogsOfWar:108、onThinIce:97、shadesOfSuffering:112、congressOfTheKeys:68）；
  引擎用异常表达待决选择：`src/engine/resolution.js#requestChoice` 抛 `ChoicePause`，事务结束检查
  `cursor === answers.length`（`resolution.js:159`）。
- 修法：`choiceFor` 只捕获普通错误，`ChoicePause`（以及 `ResolutionCheckpoint`）必须重新抛出；
  或改用引擎提供的「可选选择」原语（`canSkip`/`optional`）而不是 try/catch。同样的防御写法在其他
  循环若存在，一并抽取共享 helper（避免逐章复制）。
- 验收：真实 hub 进入 sanguineShadows 时开场三选一出现在 `pendingChoice` 且选择生效（三档分别验证）；
  5 章 debug 跳关/推进幕不再抛错；新增真实引擎回归（5 章 × 至少一个玩家选择）。

### P0-5 终章《钥匙议会》全员阵亡崩溃

- 现象：`congressOfTheKeys` 调查员被击败后 `checkOutcome → finishScenario('noResolution')` 抛
  `未知剧本结局`（`campaign-flow.js:176`），战役无法结算。
- 证据：`content/campaigns/theScarletKeys/scenarios/congressOfTheKeys/definition.js:311-314`
  `resolutions` 只有 `resolution1/2`；`DEFEATED_TEXT`（战败正文）已定义但未接进结局；
  Lead 复现 `node artifacts/tsk-scan/scripts/probe-defeat.mjs`（congress `defeat` 为 ERR）。
- 修法：definition 增加 `noResolution` 结局（正文用 `DEFEATED_TEXT`）；behavior `resolution` 处理战败分支
  （记录战役失败/尾声「调查员被击败」）；或引擎侧为「全灭」提供受控回退（需战役清单声明）。
- 验收：`probe-defeat.mjs` 中 congress `defeat.ok=true` 且 `status` 正常结束；真实 hub 终点路径新增回归。

### P0-6 第八章《苦痛之影》遭遇牌库缺注册：抽到 09720/09721 即崩溃

- 现象：`shadesOfSuffering` 真实 `startScenario` 后第 2 次抽遭遇抛 `未知遭遇卡：09720`，对局中断。
- 证据：生产组合根注册后 `ALL_ENEMIES['09720']`/`ALL_TREACHERIES['09721']` 均为 false；
  `mysteriesAbound` 组（09720/09721）被`shadesOfSuffering` 与 `sanguineShadows` 的 gatherSets 引用，
  但没有任何一章的 `encounterDefinitions([...])` 包含这两个号 → 全局遭遇表缺失。
  Lead 机械核对：`data/encounter-registry.json`（唯一缺号章节 = shadesOfSuffering）。
- 修法：把「本章 gather 组展开的卡号全集」统一交给 `encounterDefinitions`（或在 `card-data.js` 提供
  `gatherGroupCodes(group)` 单一事实源），补全局注册回归；同时用 `encounter-registry.mjs` 作为门禁脚本。
- 验收：10 章 `encounterDeck + setAsideAliases + 敌人/诡计定义` 的卡号 100% 在全局表；
  真实抽到 09720/09721 走正常显现；新增 Node 回归。

### P0-7 四章遭遇牌库按印刷缺失（组名过滤 bug / 组展开未接线 / 牌库为空）

- 现象：`dealingsInTheDark` 遭遇牌库 11 张（5 个 distinct，应 32 张）；`sanguineShadows` 8 张
  （4 distinct，应 30 张）；`dogsOfWar` 仅 6 张专属牌（五个共享组全缺）；`congressOfTheKeys` 恒为 **0**
  （`definition.js:218 ENCOUNTER_DECK=[]`，`behavior.js:1041-1043` 的投票结社敌人只记记录不入牌库）。
  印刷要求的大部分遭遇内容缺失 / 神话阶段永远无遭遇。
- 证据：`dealingsInTheDark/definition.js:224-233` 用 camelCase 组名（`dealingsInTheDark/agentsOfYuggoth/…`）
  过滤 `ALL_CARDS[code].encounterCode`（snake_case：`dealings_in_the_dark` 等）→ 只命中 `pentagram`；
  `sanguineShadows/definition.js:151-158` 只展开本章 8 张；`behavior.gatherGroups` 无引擎读点
  （`src/engine/setup.js:867-872` 只读 `scenario.encounterDeck`）。
- 修法：遭遇组名统一走 `card-data.js#encounterGroupCode`/`camelToSnake`；为「章清单声明 gather 组」补引擎读点
  （setup 时按 `scenario.gatherGroups` 展开并入牌库）或各章 definition 用共享构建器；congress 按三个版本
  的 setup 分别构建遭遇牌库（含投票敌人与两张 `outsideEncounterDeck`），补「每章遭遇牌库 ≥ 印刷张数」门禁。
- 验收：四章牌库数达到印刷要求（dealings 32 / sanguine 30 / dogs 全组 / congress 版本对应；
  参考实现差异逐条披露）；真实抽取覆盖每个组至少 1 张；`encounter-registry.mjs` 全绿。

## P1 修复进度（2026-11-13 第二轮 → 第三轮完成 17/17 组主体）

第二轮完成 **13/17 组主体**；第三轮补齐 **P1-11/12/14/15 四组**（回归扩到
[`tests/tsk-p1-regressions.test.mjs`](../../../tests/tsk-p1-regressions.test.mjs) 20 例真实引擎用例），
并对 P1-16 做了单卡批（15 个条目）与 5 项章级机制。**17/17 组主体已落代码**；剩余均为「引擎原语级
精度读点」，集中列在 P1-16 行与下方「已知遗留」，不再是整组未做。

第三轮新增（2026-11-13 晚）：
- **P1-14** dealings 追逐补 R1 入口（持钥调查员在加拉塔码头 → 结局 1，结局链 R1→R2/R3→R4/R5 全部可达）；
  sanguine 幕间「云开见日」按印刷补 1–7 分支（有标靶/不相信 → R1；相信 → 生成 09557b 剧情支援并进入「见红」）。
- **P1-15** 隐匿迷你卡 `knownBy` 按座位隔离（引擎校验/投影/`mechanic.markKnown` 全链路）；本章「查看已揭示面」
  只对查看者座位可见，公开日志不再打印真身/诱饵名。
- **P1-12** `manifest.publicScenarioFlags` 声明式清单（10 章 60+ 子键）同时驱动 `observation.js` 公开投影与
  `mechanic-view.js` 面板摘要，web 增加「章节状态」段落；未声明键不投影 + 隐私用例。
- **P1-11** deadHeat 09524 苋被击败改为推进幕 1（`enemyCanBeDefeated` + `checkObjectives`，不再先移除敌人）；
  09521/09522 复生者/食尸鬼「生成-随机地点」与猎手；09532 废弃版杰马广场打出支援 +2（引擎
  `turn-flow` 新增剧本层 `playCostIncrease` 读点）；riddles 09516 伦敦塔进入费用、09517 隐匿迷你卡落点重定向
  （`redirectConcealedLocation` 引擎读点）。
- **P1-16** 单卡 15 个：09766 语义订正、09740 走 `treacheryRule.discardOneAtRoundEnd`、09747a-c
  `concealedFightEvadeBonus` 统一声明、09739 `enemyRule.concealed:2`、red_coterie 9 份函数体统一；
  09610/09611/09613/09614/09620/09694/09704 经当前 HEAD 探针确认**已不再抛错**（P0-4 的 choiceFor 修复生效），
  09724 实测引擎已按 2 行动计费（原计划项过时）；另修 onThinIce 空洞选择同名手牌 option id 重复 + `source`
  硬编码，`agendaAside` 加入 `nonPlayerAbilitySources`。

| 组 | 状态 | 完成内容 | 未完成（引擎原语级，下轮/后续） |
| --- | --- | --- | --- |
| P1-1 窗口派发 | ✅ | `api-mechanics` 的 `concealed.expose` / `keys.shift` 成为唯一派发点（abilityApi + scenarioRuntime 同一窗口实现），上下文给 `{kind, code, decoy, location, position, seat}` / `{keyId, from, to, keyStable, seat}`；内容层统一走 `content/campaigns/theScarletKeys/concealed.js`；回归：09726a 强制（揭露→伤害分配）与 09752 强制（翻稳定面→攻击）真实结算 | — |
| P1-2 玩家 Shift/移交 | ✅ 引擎+面板 | 新增 `shiftKey`/`transferKey` 合法动作（费用 0、每轮每把一次）、dispatch 结算、`web/mechanic-ui.js` 密钥面板按钮 + 中英文案；回归：枚举/提交/轮限制/非法 key | 桌面 1440/移动 390 浏览器用例未跑 |
| P1-3 Concealed X | ✅ | `concealedSpecFor/concealedDecoysFor` 单一读点：09716a-c 印刷 Concealed 2 不再按人数倍增（2 人局 3 张），09518 的 1[per_investigator] 才乘人数 | 其余章节的本地 `concealedAmountOf` 可后续统一到该读点 |
| P1-4 kind/code 契约 | ✅ | 迷你卡新增 `code`（印刷卡号）字段（分配/保存/揭露/投影/校验全链路）；19 个 tskExposed/tskKeyShifted 条目改按 `context.code` 判身份（kind 回退兼容旧夹具）；各章真身卡补齐 code（含不留痕迹的地点卡号） | — |
| P1-5 09751/09717 api 面 | ✅ | 09751 用 `api.mechanics.tsk`（含 `api.tsk` 别名）；09717 优先真实导出 `api.doomOn`（原语 `placeDoomOnCard`）；真实遭遇抽取回归 | — |
| P1-6 调查员 6 组 | ✅ | 09018 旧印 +3、09018/09015 检定期 [fast] 改 free 描述子；09015/09017 证据计数改 `addCardCounter`；09016 双开窗 perWindow 去重 + 搬运范围补全；09007 伤害分配/离场/创伤 + 引擎 `weaknessPlaysAsAsset → entersPlay`；09019 assetExhausted 派发点（api.exhaust）；09004 取回场外卡/`healAsset` damage 走 healDamageFrom；09001 跨座位单源 | 09015 他人检定窗口、TSK `perTest` 上限、`reduceTestDifficulty` 双扣、09007「至少 1 点给旁观者」精确分配、位置遭遇附属入场窗口（engine 读点） |
| P1-7 09001 投影 | ✅ 单源 | 写/读都走 `tsk-investigator` 的 `crossSeat.grants` 容器（与 `mechanic-view.js` 投影同一事实源） | 授权生命周期按轮次过滤、面板在授权瞬间的可见性（engine 口径） |
| P1-8 玩家卡 18 张 | ✅ | 09023/09031/09034/09036/09056/09064/09067/09070/09080/09081/09085/09090/09095/09099/09105/09108/09121 + 09060 系列顺带修复；引擎补 `skillTest.assetSourceId`、调查成功 `reactionWindow`、线索落到被调查地点 | 09059/09103/09124 依赖的引擎读点（见其汇报 §3）；09045/09051/09058/09123 同分片 gap 未做 |
| P1-9 arrangeConcealedAround | ✅ | P0-1 同根修复（已随 P0 写入） | — |
| P1-10 疯星乱舞四档 | ✅ | `DANCING_MAD_TOKEN_MEANINGS_BY_DIFFICULTY` 补 easy/expert（AI 预估消费方同源） | — |
| P1-11 章节机制缺口 | ✅ | deadHeat 09524 苋被击败改推进幕 1（`enemyCanBeDefeated` + `checkObjectives`）、09521/09522 生成-随机地点与猎手、09532 支援费用 +2（引擎 `turn-flow` 剧本层 `playCostIncrease` 读点）；riddles 09516 伦敦塔团队线索入场费用、09517 迷你卡落点重定向 | congress 投票/密钥面板投影随 P1-12 完成；其余章级 high 按 P1-16 清单收口 |
| P1-12 章节状态投影 | ✅ | `manifest.publicScenarioFlags` 声明清单（10 章 60+ 子键：计数/位置/布尔，不含正文/牌序/未揭示身份）驱动 `observation.js#scenarioFlagsPublic` 与 `mechanic-view.js#tsk.scenarioFlags`；web 增加「章节状态」段 + 中英文案；未声明键不投影测试 | 浏览器桌面/移动视觉验收未跑（本环境无浏览器会话） |
| P1-13 运行时原语 | ✅ 主体 | `scenarioRuntime` 新增 `api.tsk` 别名 + `lookAt`/`moveCard`/`playCardFromHandFree`/`placeDoomOnCard`；09751/09717 与 dealings 等调用点可用；09751 真实遭遇回归 | 其余章节对不存在键的批量审计可并入 P2 |
| P1-14 dealings 结局分支 | ✅ | 追逐 R1 入口（持钥调查员在加拉塔码头 → 结局 1；R1→R2/R3→R4/R5 全链可达）；sanguine「云开见日」1–7 分支（有标靶/不相信 → R1；相信 → 09557b 生成并进入「见红」） | 结局文本级分支的叙述回放无浏览器证据 |
| P1-15 血色阴影隐私 | ✅ | `knownBy` 按座位隔离（`tsk-concealed` 校验/投影、`api.mechanics.tsk.concealed.markKnown`）；公开放置重定向读点；本章查看日志去掉真身/诱饵名；observation/mechanic-view 隐私用例 | 其它章节的「查看」日志逐条复核可并入 P2 |
| P1-16 其余章级 high | ✅ 正文+引擎读点（09739 分配待 content） | 单卡 15 个（09566/09766/09740/09747a-c/09739/red_coterie×9）修正；blocked 5 张与 09694/09704 经探针确认已恢复；09724 实测已按 2 行动计费；onThinIce 空洞选择 option id/source 修复；`agendaAside` 进 `nonPlayerAbilitySources`；deadHeat 09546 doom 等见章级说明 | ① 09747a-c/09577 的「攻击/躲避隐匿迷你卡 +2 难度」需要引擎级 fight/evade 隐匿动作与原语；② 09740「每人每轮最多揭露 1 张」需要 expose 事务的全局限制读点；③ 09739 的 Concealed 2 分配需共享组敌人 spawn 时统一结算（content 通用化）；④ 09766「不能离开你手中」需要 entry 级 `cannotLeaveHand` 四条通道读点；⑤ red_coterie `shiftAttachedKeys` 上收 `encounter-entries/_shared.js`；⑥ 09610/09611 空洞选择的 agenda `source` 已改、仍缺 agendaAside 卡反应窗口派发外的文本覆盖测试 |
| P1-17 战役流程 | ✅ 4 主项 | 02310 禁用卡写入 `campaign.tsk.invalidCards` 并接入升级池过滤；时间跨 35 旅行后重定向 + 先结算待处理状况报告（含 Ω）；θ 同时写 `records.thetaTime`（幕间 52 判定读点）；结算报告后回世界地图再启程 | 幕间 14 解锁节点回收、幕间 20/51 起始加成读取、`records.time` 重复声明（小项） |

> 第三轮同批还修了 4 个**引擎读点**（不在原 P1 清单字面，但为了让卡面/章节子句可达）：
> `turn-flow` 剧本层 `playCostIncrease`、`tsk-concealed`/`api-mechanics` 的 `knownBy` 与
> `redirectConcealedLocation` 放置重定向、`ability-rules#nonPlayerAbilitySources` 纳入 `agendaAside`。

### 第四轮：剩余引擎原语级读点（2026-11-13 晚）

第三轮遗留的「引擎原语级」条目已基本收口：

- **P1-6**：① `api.reduceTestDifficulty` 改为只登记 `difficultyReduction`，唯一扣减点在 `tests.js` ST.6
  （修双扣）；② `skillTest` 始终有唯一 `id`（非 eventWindowInstances 剧本用瞬态 `_testSerial` + 非枚举
  属性，不污染重放指纹），`limits.js` 的 `perTest` 不再退化为 `round:turnSerial`；③ 检定
  `test.beforeCommit/afterCommit` 窗口支持「同地点、条目声明 `flags.testWindowObserver` 的调查员」参与
  （09015 达雷尔；`encounter.js#playerWindow` 新增 `onlySeats`）；④ `harm-threat.js#assignHarm` 对
  `flags.composureDamage` 支援强制第 1 点非直接伤害先分配（09007）。
- **P1-8**：① `play-channels.js` 弃牌堆通道纳入「`playableFromDiscard` 的支援」普通打出入口（09103；
  快速窗口仍只给事件）；② `enemyRule.damageOnlyFromSourceTraits`（武器支援/策略事件来源限制）+
  `enemyRule.damageReductionFromAllSources`（每个来源 -1）读点接入 `combat.js`/`enemies.js`（09124）；
  ③ 09059 的线索落点读点在第二轮已接（`actions.js`）。
- **P1-16**：① 引擎新增 `fightConcealed`/`evadeConcealed` 合法动作与 dispatch 结算
  （难度 = 地点隐蔽值 + `locationRule.concealedFightEvadeBonus`，成功走 `concealed.expose` 揭露；
  `moves.js` 校验/借机攻击豁免同一口径）；② `treacheryRule.exposeLimitPerInvestigatorPerRound` +
  `tsk-concealed` 的按轮/按座账本，`api-mechanics` 揭露事务超限直接阻止（09740）；
  ③ `entry.cannotLeaveHand` 四通道读点（`discardableHandCards`、`player-zones.discardPlayerCards` 兜底、
  `cardPlayBlockedReason` 不能打出、投入候选过滤），09766 已声明；④ red_coterie 9 张共用 helper
  上收到 `encounter-entries/_shared.js#shiftAttachedKeys`（9 个条目已改为 import，行为零变化）；
  ⑤ 09610/09611 空洞选择 option id 去重与 `source` 改用当前议程；⑥ 09740/09739 的条目声明与
  09740 的 `approximation` 披露修正。
- 回归：`tests/tsk-p1-regressions.test.mjs` 扩到 **27 例**（新增 P1-R1…R7：09740 揭露上限、09007 强制分配、
  09103 弃牌堆支援打出入口、09124 来源/减伤声明、09766 四通道、隐匿迷你卡 fight/evade 动作、09015
  窗口声明）；重放基线保持逐条一致。

**仍明确未完成（1 项 + 1 类）**：09739 的「Concealed 2 在共享组敌人 spawn 时分配 1 真身 + 1 诱饵」仍需
两个含 agents_of_yuggoth 的章节在 `enemySpawned` 里接 content 通用化（条目声明 `enemyRule.concealed: 2`
已就绪）；引擎级隐匿攻击/躲避的**章节专属真身入场**仍走各章既有 `tskExposed` 窗口近似，缺逐章结算钩子
（`concealedCombatResolved` 钩子已预留给内容层）。

### 已知遗留（下轮开始前的边界）

- 浏览器验收：本轮已跑 `node tools/run-tsk-interactions-browser.mjs`（TSK P4 交互 16/16，桌面 1440 + 移动 390，
  覆盖隐匿/密钥/空洞/地图/定制/跨座位；含 P1-2 密钥按钮与 mechanic-view 改动的渲染路径）；P1-12「章节状态」
  段落与 P1-15 隐私的**专属**视觉用例尚未新增，现有 P4 用例只覆盖渲染 smoke。
- golden replay `--verify` 的 3 局既有漂移与本轮无关；TSK 自己的 replay 基线因工作区在本轮期间收到**其它
  未提交引擎改动**（含 setup/rules-state）而重采过一次（见 `audit/tsk-baseline.json`），详见 full-scan §0.2。
- P1-6 的 4 个精度读点与 P1-8 的 3 个引擎缺口、P1-16 的 6 项原语级读点（见上表「未完成」列）是本轮
  明确的边界：都不是「声明了没人读」的假接线，而是需要新增引擎动作/事务读点才能再收口。

## P1：规则正确性与可感知（17 组）

### P1-1 `tskExposed` / `tskKeyShifted` 窗口只注册不派发（18 张条目能力死亡）

- 证据：`src/engine/windows.js:68-69` 注册；全仓无 `reactionWindow(state, 'tskExposed'|'tskKeyShifted')`
  调用；18 张 TSK 条目挂在其上（17 张 `tskExposed`：09716a-c/09721/09722/09726a-b/09747a-09750/09762/09763；
  1 张 `tskKeyShifted`：09752）。唯一派发点是 `withoutATrace/behavior.js:353-394`（仅地点背面，且是手工派发）。
- 修法：在 `tsk-concealed.js#exposeMiniCard` 成功后派发 `reactionWindow(state, 'tskExposed', {miniCardId, kind, decoy, location, seat})`；
  在 `tsk-scarlet-keys.js#shiftKey` 成功后派发 `reactionWindow(state, 'tskKeyShifted', {keyId, from, to, stable, seat})`；
  上下文契约写入 `docs/campaign/theScarletKeys/interactions.md`。
- 验收：18 张条目在真实窗口可触发（至少 09752 强制、09722 揭露伤害、09716a 揭露弃置三例真实引擎回归）。

### P1-2 玩家没有 Shift / 转移密钥入口（6 张密钥卡效果仅敌人可触发）

- 证据：`tsk-interactions.js#keys.shift/transfer` 事务无调用方；`src/engine/moves.js:482-491` 不枚举密钥；
  `web/mechanic-ui.js:204-210` 只渲染密钥状态。规则要求：持钥调查员可在任意玩家窗口以 `[fast]` 变换。
- 修法：新增引擎合法动作（如 `action:'shiftKey'`，`legalMoves` 在 playerWindow/map 依 `keysHeldBy` 枚举，
  服务端校验本轮一次限制），复用 `api.mechanics.tsk.keys.shift`；`web/mechanic-ui.js` 增加按钮并绑定动作；
  同步 `docs/campaign/theScarletKeys/interactions.md`。
- 验收：桌面/移动浏览器用例（真实大厅，选一把已持有密钥 → 变换 → 面板面/轮限制更新）；引擎单测覆盖
  合法/非法/每轮一次/无钥匙时无候选。

### P1-3 隐匿 X 数值语义错误（按调查员人数倍增）

- 证据：`content/campaigns/theScarletKeys/scenarios/riddlesAndRain/behavior.js:274-281`
  `decoys = perInvestigator * numInvestigators(state)`；09716a/b/c 印刷 **Concealed 2**（无
  `[per_investigator]` 图标），2 人局实放 5 张迷你卡（应为 3 张）。`flags.concealed` 无权威读点。
- 修法：`definition.CONCEALED_DECOYS_PER_INVESTIGATOR` 语义改为「总诱饵数」，仅在卡面带
  `[per_investigator]`（如 09518）时才乘人数；`concealedDecoysFor` 返回 `{total, perInvestigator}` 明确口径；
  各章 `distributeConcealedEnemy` 统一走该读点。
- 验收：2 人局 09716a 放 3 张、09518 放 2 张；`tests/tsk-primitives-concealed.test.mjs` 增补断言。

### P1-4 迷你卡 `kind` 无跨章契约（阴影判定在 dancingMad/sanguineShadows 恒假）

- 证据：条目按 `enemy<卡号>` 判阴影（09726a:16-21、09721:21-23、09739:17-33、09725:22-25）；
  dancingMad 用 `CoterieEnforcerA`（definition.js:200-221）、sanguineShadows 用 `LaChicaRoja`
  （behavior.js:41-50）→ 09725/09726/09727/09739 在这些章不成立；09716a criteria 比裸卡号。
- 修法：`tsk-concealed` 增加 `kindOf(code)` 统一生成规则（或把 `concealedCodeOf` 用于全部内容层）；
  条目一律用 `concealedCodeOf(kind) === code` 判定；两章改名到统一 kind。
- 验收：dancingMad/sanguineShadows 真实遭遇抽取 09725/09726 时阴影计数>0；各章章测试覆盖。

### P1-5 09751 诡计在真实遭遇路径崩溃（api 面不一致）

- 证据：`09751.js:27` 调 `api.tsk.concealed.reshuffle`，但 `treachery-tokens.js:113-121` 传的
  `scenarioRuntime` 只有 `api.mechanics.tsk`；Lead 探针 `probe-runtime-api.mjs` 实测
  `api.tsk` undefined → 选项一触发 TypeError。09717.js:32 调 `api.placeDoomOnCard` 同样不存在。
- 修法：条目改用 `api.mechanics.tsk.concealed`（与 09716 系列一致）；审计全部 TSK 条目对
  `api.tsk`/`api.placeDoomOnCard` 的引用并批量修正；补真实遭遇抽取回归（抽到 09751 走两个选项）。
- 验收：真实 `debug encounter` 抽取 09751 两分支均不抛错并产生预期重排/伤害。

### P1-6 调查员能力 6 组（09001/04/07/15/18/19 等）

- 09018 旧印 +1 应为 +3（`09018.js:37,51`；测试断言错误值需同步改）；
- 09015/09018 检定期 `[fast]` 不可达（`moves.js:367-376` vs `resolution.js:116-120`）：引擎在 playerWindow
  枚举 `investigator.freeAction`（duringOwnSkillTest），或把两卡改为 `abilities` 描述子；
- 09015/09016/09017 证据计数器：`moveCardCounters(..., null, ...)` 在 `card-counters.js:73` 返回 0
  （09015 花证据不扣、09017 移除 4 证据不掉）；09016 线索反应双开窗（`locations.js:468-469` +
  `ability-exec.js:356`）重复结算；
- 09007 受伤路人：改走弱点入场钩子放 3 伤害；「至少 1 点分配给它」用 engines 的伤害分配替代事后追加；
  补「被击败 → 1 精神创伤」；
- 09019 邦妮反应：监听 `assetExhausted` 窗口需实际派发（`api.exhaust` 也开窗，或换窗口）；
- 09004 取回场外卡：`card-ops.js:196-222` 对共享区要求 `spec.code`，条目补 spec 并校验返回值。
- 验收：逐人真实引擎用例（`createGameState` + 真实合法动作），替换现有静态断言。

### P1-7 09001 跨座位授权投影双源

- 证据：条目写 `inv.crossSeatGrants`（`investigator-mechanics.js:141-147`），`mechanic-view.js:230-241`
  读 `scenario.crossSeat` → 面板永不出现。
- 修法：统一到 `tsk-interactions`/`scenario.crossSeat` 单源（或投影读 `inv`），补投影单测 + 浏览器用例。

### P1-8 玩家卡不可达/空转/多实现（09023/09036/09067/09070/09080/09085/09095 等）

- 09023 攻击来源字段：criteria 改用 `api.playerTools.testAssetSource()`（回落到 `_resolvingAssetId`）；
- 09036/09095：`api.playCard` 返回 false 时不得写成功日志，改为给出原因；09095 需接弃牌堆打出通道
  （`play-channels.js` 放宽 support 类型或声明 playableFromDiscard）；
- 09067：躲避支 criteria 不得用 `api.cardTraits`（窗口过滤期无 api），改用 `matcher`/派生字段；
  调查支补 reactionWindow 通道；
- 09070 图标公式去掉 extra +1；09080 接 `cost.discardControlledAsset` 管线；09085 目标枚举与 `canEvade`
  对齐（或改用 `parley`/自动躲避原语）；
- 09056 `[action][action]` 用 `cost.action:2` 而非 criteria+`loseActions`；
- 09059 Surveil 传 `locationId`；09031 图标翻倍按「最终投入集合」计算；09099 补 `skillTestFail` 窗口；
- 验收：逐卡真实引擎行为用例（legalMoves/applyMove + 真实窗口），替换 executeDescriptor 直调。

### P1-9 `arrangeConcealedAround` 洗牌退化（和不留痕迹 P0 同根）

- 证据：`withoutATrace/behavior.js:493-498` 调 `shuffleWith(helper, [...])` 无 state/helper；
  默认 `{}` 时 `shuffleWith` 返回原序 → 隐藏卡永远先真身后诱饵。
- 修法：调用点传入 `state`/`helper`；与 P0-1 一并修复。
- 验收：`node artifacts/tsk-scan/scripts/verify-...` 或新增断言：初始迷你卡顺序随种子变化。

### P1-10 《疯星乱舞》混乱标记缺 easy/expert 两档（影响 AI/预估口径）

- 证据：`dancingMad/chaos.js:19-32` 仅 standard/hard；`src/engine/combat-odds.js:155`、
  `src/engine/ai-context.js:224` 按 `state.difficulty` 索引 → easy/expert 拿 undefined 走 SYMBOL_DEFAULTS。
  真实检定走 `behavior.resolveChaosToken` 覆盖（cultist 仍 -4/-6），所以**不是规则算错**，而是
  AI 命中率预估与 AI 标记表失真。
- 修法：补齐 easy（同 standard）与 expert（同 hard）两档；补四档难度回归（含 combatOdds/ai 消费方）。
- 验收：四档难度下 `tokenMeanings[difficulty]` 完整；AI 预估与人工结算一致。

### P1-11 章节机制缺口（章级 high 的修复要点）

- deadHeat 09524 苋被击败翻面：引擎先 `leaveEnemyPlay` 再调击败钩子（`enemies.js:703`），behavior 在
  `state.enemies` 找不到她 → 用引擎 `prepareEnemyOutcome`/replace 原语或改 behavior 在 `enemyDefeated`
  前处理；补真实引擎回归（幕 2 击败 → 幕 3 目标仍成立）。
- deadHeat 09521/09522 议程正面关键字、09532 支援费用 +2：接 `actRule`/`playCost` 读点或章节 behavior。
- riddlesAndRain 09516 伦敦塔进入费用、09517 塔楼牢房迷你卡限制：借 `moveError`/concealed 分配读点实现。
- congress `choiceFor`（P0-4）与投票/密钥面板投影（P1-12）。
- 其余章级 high 见 `findings/chapter*.json` 的 `chapterIssues`。

### P1-12 章节状态观察投影（35 个 scenarioFlags 子键无投影）

- 证据：`data/screen2.json#chapterFlags`；死亡酷暑平民计数（`[skull]` 修正/结局比较依赖）、暗中交易
  `cluesUnveiled/eclipse`、苦痛记忆 `remembered`、不留痕迹阴影三位置等。
- 修法：`observation.js#PUBLIC_SCENARIO_FLAGS` 改为「战役清单声明」而非硬编码白名单；各章在
  `mechanic-view.js#tskView` 增投影段（计数/位置/解锁 key，不含正文）；`web/mechanic-ui.js` 增摘要行；
  中英文案补齐。
- 验收：浏览器用例（桌面/移动）显示各章计数并在变化时更新；投影隐私用例确认不泄露正文/牌序。

### P1-13 内容层批量调用不存在/错命名空间的运行时原语

- 证据：`scenarioRuntime` 无 `api.lookAt`、`api.moveCard`、`api.playCardFromHandFree`、`api.tsk`、
  `api.placeDoomOnCard`（Lead 用 `scenarioRuntime(state)` 实测 undefined）；但章节/条目在调用且照打成功日志：
  `dealingsInTheDark/behavior.js:266-271`（09590a 不抽牌）、`:246-257`（09584 取不回牌）、`:814-836`
  （09583 不打出卡）、`09751.js:27`（api.tsk）、`09717.js:32`（placeDoomOnCard）。
- 修法：以 `api.mechanics.*`/`ctx.api` 的真实导出面为准统一命名；批量修正 TSK 全部条目/章节 behavior 的
  调用点并加「API 面一致性」测试（对 `scenarioRuntime` 键做白名单校验）；调用失败必须报错/日志，禁止静默成功。
- 验收：章节 behavior/条目不再引用不存在键；真实流程中 09583/09584/09590a 的效果生效。

### P1-14 章节结局/分支不可达（dealing 追逐 R1–R5、cast a light、09557b）

- 证据：`dealingsInTheDark/behavior.js:695-715` 只实现「追逐」R6，全文件无 R1–R5 的可达入口 →
  真实对局只剩 R6/无结局；`behavior.js:406-434` 的 cast a light 缺「红衣女郎有标靶→R1」分支且从不生成 09557b。
- 修法：按印刷补齐 chasing 分支入口（地点/持钥/标靶条件进入 legalMoves 的结局动作）与 09557b 生成；
  补真实引擎回归（至少 R1 与 R6 两条路径）。
- 验收：`probe-dealings-real2.mjs` 类探针能走到 R1–R5；全部结局键可达。

### P1-15 血色阴影隐私泄露（真身/诱饵经公开日志与 known 旗标暴露）

- 证据：`sanguineShadows/behavior.js:638-650` 把 `known` 写全局并经 `concealedProjection` 对所有座位暴露；
  公开日志对诱饵打印 `DecoyLaChicaRoja`、真身打印「红衣女郎」→ 玩家可直接识别未揭露身份。
- 修法：`known` 按座位/观察者隔离（或只存 id 集合并由投影按观察者过滤）；日志只写「查看了一张隐匿迷你卡」；
  `mechanic-view.js` 增加隐私回归用例。
- 验收：他人投影/公开日志不含真身/诱饵区分信息；本座位仍能看到应得信息。

### P1-16 其余章级 high（分片 JSON 为准）

- 09610/09611/09613/09614/09620 触发即抛错回滚（dancingMad，blocked 级）；09694 的 [cultist] 翻钥匙分支、
  09704 的 [fast] 移动同样触发即崩；两章 `finalResolution` 为死钩子（引擎从不调用）。
- 09546 开局未设置 1[每人] 毁灭；09550/51/53/56 缺「再花 1 线索降 2 难度」；09554 市议会能力未实现；
  09581 失败必取消移动；09565a/b 的 Shift 无执行调用点（与 P0-4 同根）。
- 09739 无章节分配迷你卡 → 整条强制不可达；09740 揭露上限无读点 + agendaAside 不在窗口来源；
  09747a-c 的 +2 难度无读点；09724 `[action][action]` 只扣 1 行动；09766 `blocksCommitWhileInHand`
  被实现成「禁止投入任何卡」；09717 的 `api.placeDoomOnCard` 不存在。
- red_coterie 9 份内联 `shiftAttachedKeys` 上收共享实现（D4/D5）；`enemyStatRule.aura`、`flags.coterie/elite/patrol`、
  `removedKey:*` 接读点或删除；congress 的同志会敌人以身份 id 进全局表、按卡号的跨章效果找不到
  （`encounter-registry.mjs` 标记 10 条），统一注册键口径。

### P1-17 战役流程 4 项（禁用卡 / 时间 35 / Ω 报告 / θ 门槛）

- **02310 禁用卡未接线**：`shared.js:264`/`flow.js:290` 只声明，`src/engine/tsk-hollow.js:125-129` 读的
  `campaign.tsk.invalidCards` 无人写、`campaign.js:270-275/311-313` 购卡/换牌不查禁用表 → 真实 hub
  幕间窗口可买入 15 条 02310 候选（`_invalid2.mjs` 复现）。修法：把禁用表接入 `availablePurchases`/
  `replacementAnalysis`（或写 `invalidCards`），补真实 hub 回归。
- **时间推过 35 不重定向**：`tsk-map.js:177-191` 只按出发前时间判强制、`dispatch.js:859-890` 旅行后不复查
  → 时间 33 旅行 2 进 dogsOfWar 而非通古斯卡（`probe-campaign-flow.mjs#cross35`）。修法：旅行结算后复查阈值，
  若跨越 35 则改为强制启程并播放对应状况报告。
- **Ω 状况报告永不可达**：时间 ≥35 时 `hub.js:96-108` 只给强制启程、`dispatch.js:859-866` 跳过 pending 校验，
  Ω 留 pending（终章少 1 枚 cultist、正文不可见）。修法：markTime 内先播 Ω 再强制启程（参考 Helpers.hs）。
- **幕间 52 θ 门槛失效**：`records.thetaTime` 只在 `prologue.js:138` 写 0，`dancingMad/behavior.js:900-906`
  只写 `tsk.statusReports.theta` → `interludes.js:795` 条件恒真（θ 之前即拿 +2 XP + 镜像之刃）。
  修法：统一 θ/ψ 时间记录键并加契约测试。
- 附带：幕间 14 追回密钥后未把 Kabul/Quito/SanJuan/Reykjavik 移出 unlocked（刷 XP/时间）、
  幕间 20/51 的 StartingHand/StartingResources 加成只写不读、records.time 重复声明被覆盖成 boolean。

## P2：账本、测试与工程收口（9 组）

### P2-1 P8 账本重签/声明冻结快照（✅ 2026-11-13 已随 P0 完成）

- 已执行并审阅：`audit-abilities --write`（behaviorLines 49329→49325，含 P0 behavior 增量）、
  `build-presentation --write`（清 `audit/presentation-report.json` 漂移）、
  `scan-tsk-baseline --write`、`scan-tsk-scope --write`、`scan-tsk-mechanisms --write`、
  `audit-tsk-primitives --write`、`audit-tsk-rules/interactions/investigators/player/scenarios/all-cards
  --write`、`verify-tsk-regression`、`audit-tsk-migration --write`。
- 结果：**14/14 个冻结命令通过；`audit/tsk-migration.json#status = verified`（16/16 gates true）**；
  `audit/tsk-regression.json` 冻结失败集合仍为既有 4 条（EotE all-cards/EotE migration/TCU migration/i18n UI），
  `additionsSinceInitialBaseline = []`；`test:fast` 7688 例 4 fail = 同一冻结集合，无新增。
- 注意：golden replay `--verify` 仍有 3 局（carcosa ×2 / dunwich ×1）不一致，属本轮之前工作区已有漂移
  （`tests/fixtures/replay/golden-replays.json` 本就是未提交修改），本轮未更新 golden 基线以免掩盖其他循环问题。

### P2-2 测试真实性（9/10 章测试为合成 state）

- 新建 `tests/tsk-chapters-smoke.test.mjs`：真实 `createGameState({campaignId:'theScarletKeys',campaignHub:true})`
  → 逐章 debug 跳关/真实 hub 进关 → setup 不变量 + 真实 legalMoves/applyMove 抽样 + 结局键；
- 替换 09018/09070/09023 等「断言错误实现」的测试；
- 章测试至少覆盖真实 `startScenario` 与一次幕推进（合成 state 保留为单元补充）。

### P2-3 定制升级卡勾选口径（10 张少付 XP）

- 证据：`data/customization-gates.json` + crossCutting 复核；09021:22、09022:14、09023:39、09040:33/55、
  09042:60、09079:24-30、09081:53、09099:37-49、09100:65/73、09119:21/191 用 `includes(index)`/`>0`
  判定多格选项，勾 1 格即拿 2–5 格效果（单项少付 1–3 XP，09022 单卡最多 7 XP）；09041/09101 声明选项
  但完全不读。正确示范：09059:29-32 `checkedFully`、09060:45、09061:66。
- 修法：抽共享 helper `customizationFullyChecked(seat, code, optionIndex)`（读 `checks` 次）并替换 10 张卡；
  `web/mechanic-ui.js` 勾选 UI 限制为「按格递增」（前序格未勾不可勾后续格）。
- 验收：1 XP 不能解锁 2+ 格效果（真实 hub 升级回归）；面板显示每选项格数；09041/09101 选项接读点或删除。

### P2-4 i18n：运行时中文硬编码 3333 处/440 文件

- 优先修玩家可见文案（label/prompt/info，机械筛查 848 处）：迁移到 `web/locales/*.misc.js` 的
  `tsk.*` 键（现有 `mechanic.tsk.*` 已建立），en 缺省回退中文；条目 `label` 改为键或 `{zh,en}` 对象需先补原语。
- 验收：en 界面抽样无中文（除剧情正文）；新增 i18n 对照用例。

### P2-5 原语 backlog 收口 + 声明即接线清理

- 33 个零读点 flag 键：删除或接读点（删除时同步条目注释与账本披露）；`enemyStatRule.aura`、
  `flags.coterie/elite/patrol`、`removedKey:*`、`location.attachments`/`agendaAside` 能力来源枚举、
  `tsk-investigator.js` 无调用原语（接线或删除）、`09038` 直写 `skillTest.boostedByGirish` 改 api。
- 同句重复：red_coterie 9 份 `shiftAttachedKeys` 上收 `tsk-scarlet-keys` 或共享 helper；5 段「法术槽=2」上收读点。

### P2-6 数据/复用小项

- `09649` 英文卡名拼写核对（本仓 `Zan'et` / 参考 `Zen'et`，以印刷为准）；
- 12049 重印别名补登记（`src/cards/entries/_reprint-aliases.js`）；
- 09064「敏捷代替智力」写死为永远敏捷需改为可选；09096/09097/09098 与 09082/09083/09085 三对同模板
  评估上收共享实现；09716a-c/09726a-b/09727a-b 同文簇共享实现。

### P2-7 遭遇组名/卡表派生数据统一

- `card-data.js` 已提供 `encounterGroupCode`/`camelToSnake`，但 `dealingsInTheDark` 等章仍用手写
  camelCase 过滤/手写卡号表；统一到单一派生函数，`tools/scan-tsk-mechanisms.mjs` 的语料同步。
- 验收：全仓无 `encounterCode` 大小写不匹配过滤；新增派生一致性测试。

### P2-8 P4 交互事务层接线（6 组）

- 证据：`src/engine/tsk-interactions.js` 的 `createTskInteractions` 在 `src/cards`+`content` 零命中；
  `audit/tsk-interactions.json#status=verified` 只验证了未接线层。真实玩法走 7 章 `scenarioAction` 与
  4 章 `resolveKeyShift` 的分散实现。
- 修法：把隐匿揭露/密钥变换/空洞回收/地图启程/定制勾选/跨座位授权统一接到事务层（或明确删除该层并
  重签账本，避免「verified 的层无人调用」）；补真实引擎用例覆盖 6 组操作的合法/非法/取消/空状态。
- 验收：6 组交互在真实大厅可用且账本与实现同源。

### P2-9 关键词 cardCodes 假阳性与规则书口径

- 证据：`content/campaigns/theScarletKeys/keywords.js:59-64` 用 `new RegExp(pattern,'i')` 扫描
  卡名+正文，`hidden` 6/6 全是卡名/叙述（`Hidden Pocket`、`found hidden bones`），`prey` 2/4 是卡名
  （`Predator or Prey`/`Easy Prey`），spawn/patrol 多张只是动词 → P3 的 cardCodes 与「439 卡文直达」
  口径含假阳性；`patrol` 无通用引擎读点（仅 3 章手写）；`otherworld` 仅身份声明。
- 修法：关键词语料区分「卡名/叙述」与「规则文本」，或按 `[[Trait]]`/关键字行精确匹配；规则书标注
  「引擎读点 / 原语 / 章节实现」三档；重算 29 关键词的 cardCodes 并重签 `audit/tsk-rules.json`。
- 验收：关键词覆盖清单无卡名假阳性；`web/tsk-rules.js` 与 keywords.js 双向一致。

## 复现与验收命令

```powershell
cd G:\boardgame-hall-ai\games\arkhamhorror
# 机械证据
node ../artifacts/tsk-scan/scripts/screen.mjs
node ../artifacts/tsk-scan/scripts/screen2.mjs
node ../artifacts/tsk-scan/scripts/customization-gates.mjs
# 真实引擎探针
node ../artifacts/tsk-scan/scripts/probe.mjs
node ../artifacts/tsk-scan/scripts/probe-defeat.mjs
node ../artifacts/tsk-scan/scripts/diag-enter.mjs
node ../artifacts/tsk-scan/scripts/diag-enter5.mjs
node ../artifacts/tsk-scan/scripts/diag-hosted.mjs
node ../artifacts/tsk-scan/scripts/verify-weakness-crash.mjs 09126
# 既有门禁
node --test tests/tsk-*.test.mjs
npm run cards:check; npm run cards:encounter-check; npm run audit:entries
npm run replay:fixtures
```

所有脚本均为只读探针，可重复运行；输出写入 `artifacts/tsk-scan/`。
