// 战役卡分片 C（08596–08647）findings 数据 → 生成 games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/campaign/c/findings.json。
import { ALL_CARDS } from 'file:///G:/boardgame-hall-ai/games/arkhamhorror/src/cards/cards-data.js'

const EP = 'src/cards/encounter-entries/edgeOfTheEarth/toTheForbiddenPeaks'
const EC = 'src/cards/encounter-entries/edgeOfTheEarth/cityOfTheElderThings'
const P = 'content/campaigns/edgeOfTheEarth/scenarios/toTheForbiddenPeaks'
const C = 'content/campaigns/edgeOfTheEarth/scenarios/cityOfTheElderThings'
const ENG = 'src/engine'
const REF = '参考资源/ArkhamHorror-main/backend/arkham-api/library/Arkham'

const issue = (severity, dimension, summary, evidence, suggestion) => ({ severity, dimension, summary, evidence, suggestion })

// --- 跨卡共享 issue 模板（同一根因逐卡登记，便于账本逐条销账）---
const treacheryDead = (entryFile, entryLine, chapterDefLine, chapterName) => issue('high', 'primitive',
  `章节遭遇卡在真实引擎路径不结算：条目只声明 treacheryRule.resolveKind（${chapterName} behavior.resolveEncounter 未被任何引擎读点调用），且 ${chapterName} 的 treacheryDefinition 未设 entryRevelation、条目也无 encounterResolve/treacheryRule.test → 抽到时只记日志、无任何效果`,
  `${entryFile}:${entryLine}（仅 resolveKind）；${chapterDefLine}（treacheryDefinition 无 entryRevelation）；${ENG}/treachery-tokens.js:113-124（只认 entry.encounterResolve / treacheryRule.test / effect.kind==='campaignRule'）；对比 ${C}/../theHeartOfMadnessPart1/definition.js:151（其它 EOTE 章补 entryRevelation:true）`,
  '按其它 EOTE 章节模式：章节 definition 的 treacheryDefinition 补 entryRevelation:true，并在每个条目声明 encounterResolve 转发章节 TREACHERY_HANDLERS；补真实遭遇抽牌测试')

const climbWiring = (entryFile, entryLines) => issue('high', 'runtime',
  '卡面「从下方进入」强制效果在真实引擎路径永不触发：behavior.locationEntered 只读 climbState.enterFromBelow，而权威移动管线（movement.js#moveInvestigator）不会调用 eote-climb.ascend 写该标记；ascend 只经 api.mechanics.climb 暴露（无内容层调用者）',
  `${entryFile}:${entryLines}（声明 enterFromBelow）；${P}/behavior.js:189-199（读 climbState）；${ENG}/eote-climb.js:109-123（ascend 只写标记）；${ENG}/api-mechanics.js:176-183（仅 API）；${ENG}/movement.js:236-249（移动只 reveal+locationEntered）；全仓 ascend 调用点仅测试 tests/eote-scenario-toTheForbiddenPeaks.test.mjs:169-188`,
  '在权威移动的 Level+1 上行前调用 eote-climb.ascend，或让 behavior.locationEntered 以 from/to Level 差判定（不依赖瞬时标记），并补真实移动集成测试')

// ============================== 失落之峰 08596–08620 ==============================
const peaksCards = [
  {
    code: '08596', verdict: 'match',
    clauses: [
      { text: '简单/普通：skull=-X（X=所在地点高度）；cultist=-1 失败后移到下方；tablet=-3 失败失去[[探险]]支援；elder_thing=-4 失败最近古老者向/攻击', status: 'implemented', evidence: `${P}/chaos.js:16-30,32-40`, note: '两档取值表 + 函数读点齐全' },
      { text: '困难/专家：skull=-(X+2)；cultist=-1 检定后必下移；tablet=-4；elder_thing=-5', status: 'implemented', evidence: `${P}/chaos.js:16-30,32-40`, note: '' },
      { text: '（场景 setup，非卡面）混乱袋 +1 [elder_thing] 标记', status: 'missing', evidence: `${P}/definition.js:196-227（scenario 数据无 setup token）；${P}/behavior.js:81-103（setupLocations 不加 token）；${REF}/Scenario/Scenarios/EdgeOfTheEarth/ToTheForbiddenPeaks.hs:225`, note: '属章节 setup 缺口，记入 scenarios[0].issues' },
    ],
    perceivability: { status: 'perceivable', evidence: `${P}/behavior.js:271-295（resolveChaosToken/afterTest 输出 api.info）`, note: '符号后果有日志' },
    tests: { status: 'hook-only', evidence: 'tests/eote-scenario-toTheForbiddenPeaks.test.mjs:281-301（直调 chaos 函数）', note: '无真实袋/真实抽取' },
    issues: [],
  },
  {
    code: '08597', verdict: 'gap',
    clauses: [
      { text: '强制-你移动到一个地点后：将所有线索放回供应堆', status: 'approximation', evidence: `${EP}/08597.js:13-16（onMove:'returnClues'）；${P}/behavior.js:244-256（afterMove 实现）`, note: '实现存在，但引擎不调用 afterMove → 真实路径不触发（high）' },
      { text: '背面：把放一边的星之恐怖放到最高且有调查员的地点；该地点调查员失去全部[[探险]]支援并放回地点', status: 'implemented', evidence: `${P}/behavior.js:158-176（spawnTerrorOfTheStars+dropExpeditionAssetsOf）`, note: '支援入场链路本身缺失见场景 issue' },
    ],
    perceivability: { status: 'partial', evidence: `${P}/behavior.js:158-176（api.info 有“最高处入场”提示）`, note: '强制归还线索无任何界面提示' },
    tests: { status: 'hook-only', evidence: 'tests/eote-scenario-toTheForbiddenPeaks.test.mjs:201-220（直调 afterMove/agendaReveal）', note: '断言的是直调钩子，不能证明引擎接线' },
    issues: [issue('high', 'runtime',
      '08597 正面强制「移动后归还全部线索」只写在 behavior.afterMove，引擎没有任何 afterMove 读点（全仓仅测试调用）→ 真实对局永不触发',
      `${EP}/08597.js:13-16；${P}/behavior.js:244-256；${ENG}/movement.js:249（移动后只派发 locationEntered）；grep afterMove 仅 tests/eote-scenario-toTheForbiddenPeaks.test.mjs:205`,
      '把归还线索并入 behavior.locationEntered，或向引擎提出 afterMove 钩子读点；补真实移动集成测试')],
  },
  {
    code: '08598', verdict: 'gap',
    clauses: [
      { text: '强制-你移动到一个地点后：将所有线索放回供应堆', status: 'approximation', evidence: `${EP}/08598.js:13-16；${P}/behavior.js:244-256`, note: '同 08597：afterMove 无引擎读点' },
      { text: '背面：有调查员撤退 → (→R1)；否则 (→R2)', status: 'implemented', evidence: `${P}/behavior.js:116-124（agendaReveal→finalResolution→api.finish）；${P}/behavior.js:355-359`, note: '议程推进确实走 phases.js:274 runAgendaReveal' },
    ],
    perceivability: { status: 'partial', evidence: `${P}/behavior.js:116-124`, note: '' },
    tests: { status: 'hook-only', evidence: 'tests/eote-scenario-toTheForbiddenPeaks.test.mjs:201-220', note: '' },
    issues: [
      issue('high', 'runtime', '08598 正面强制「移动后归还全部线索」无引擎读点（同 08597）', `${EP}/08598.js:13-16；${P}/behavior.js:244-256；${ENG}/movement.js:249`, '同上：并入 locationEntered 或补引擎钩子'),
      issue('medium', 'impl-vs-text', 'R1 未写「the team climbed to the summit」战役记录；R2 未写 theTeamFoundAnotherWayThroughTheMountains（后续幕间 II 读取该键）', `${P}/behavior.js:348-350（只写 theInvestigatorsScoutedTheMountainPass）；${REF}/Scenario/Scenarios/EdgeOfTheEarth/ToTheForbiddenPeaks.hs:275,294；content/campaigns/edgeOfTheEarth/interludes.js:52`, '按 resolution key 写两条记录并处理 Supplies Recovered 划掉'),
    ],
  },
  {
    code: '08599', verdict: 'approximation',
    clauses: [
      { text: '[action]：控制你所在地点的一个[[探险]]支援', status: 'implemented', evidence: `${EP}/08599.js:14-19；${P}/behavior.js:307-345（actions/performAction takeExpeditionAsset）`, note: '实现存在，但 7 件支援从不入场（场景 issue）→ 行动在真实对局不可用' },
      { text: '目标：所有未被击败的调查员都撤退后推进', status: 'implemented', evidence: `${P}/behavior.js:177-187（checkObjectives allResigned）；${EP}/08599.js:15-18`, note: '' },
      { text: '背面 (→R1)', status: 'implemented', evidence: `${EP}/08599.js:19（onReveal resolution1）；${P}/behavior.js:105-114（actReveal）；${ENG}/reveal.js:151-162`, note: '' },
    ],
    perceivability: { status: 'perceivable', evidence: `${P}/behavior.js:320-345（api.info 控制支援提示）`, note: '' },
    tests: { status: 'hook-only', evidence: 'tests/eote-scenario-toTheForbiddenPeaks.test.mjs:222-247', note: '' },
    issues: [issue('medium', 'runtime', '08599 的 [action] 依赖探险支援在 state.storyAssets，但 setup 把 7 件支援全部放一边且无入场代码 → 行动永不出现', `${EP}/08599.js:14-19；${P}/definition.js:142-146；${P}/behavior.js:339-345`, '先修 Expedition 支援入场（preScenarioSetup 读 suppliesRecovered），再补能力')],
  },
];
// 08600–08606 山地地点：enterFromBelow 声明 + 效果实现存在但真实路径不触发；blocksUntilBelowClear 已接线
const mountainSpecs = [
  ['08600', 'deepDrifts', 'discardTop3ThenDrawWeaknesses', '弃掉牌库顶 3 张并抽取其中弱点'],
  ['08601', 'whiteBluff', 'agilityTestLevelPlus1OnFailDropExpedition', '敏捷(X=高度+1)，失败失去一个[[探险]]支援'],
  ['08602', 'steepIncline', 'damage1', '受到 1 点伤害'],
  ['08603', 'narrowRidge', 'horror1', '受到 1 点恐惧'],
  ['08604', 'rockyLedge', 'tekeliShuffleIntoDeck', '忒咳哩-哩牌库顶 1 张洗入你的牌库'],
  ['08605', 'snowCoveredCrag', 'exhaustAllAssets', '横置你控制的所有支援'],
]
for (const [code, key, effect, desc] of mountainSpecs) {
  const entry = `${EP}/${code}.js`
  peaksCards.push({
    code, verdict: 'gap',
    clauses: [
      { text: `强制-从下方移动到本地点后：${desc}`, status: 'approximation', evidence: `${entry}:13-19（enterFromBelow.effect='${effect}'）；${P}/behavior.js:378-437（applyEnterFromBelow 实现），:189-199（locationEntered）`, note: '效果代码存在，但真实移动从不写 climbState → 不触发（high）' },
      { text: '背面：下方紧邻地点的线索未全部发现时不能进入', status: 'implemented', evidence: `${entry}:14-19（blocksUntilBelowClear）；${P}/behavior.js:201-222（moveError 读点，引擎 engine.js:210 调用）`, note: '' },
    ],
    perceivability: { status: 'partial', evidence: `${P}/behavior.js:378-437（各 api.info 提示）`, note: '触发链路缺失时玩家永远看不到' },
    tests: { status: 'hook-only', evidence: 'tests/eote-primitives-travel.test.mjs；tests/eote-scenario-toTheForbiddenPeaks.test.mjs:169-196', note: '只测 behavior.ascend/直调 locationEntered' },
    issues: [climbWiring(entry, '13-19')],
  })
}
{
  const entry = `${EP}/08606.js`
  peaksCards.push({
    code: '08606', verdict: 'gap',
    clauses: [
      { text: '强制-被揭示后：若高度为 0，放置 1[per_investigator] 线索', status: 'approximation', evidence: `${entry}:14-25（onReveal placeCluesPerInvestigator）；${P}/behavior.js:142-155`, note: '实现按人数放线索但缺「高度为 0」条件（当前确定性 setup 把 08606 放一边，永不在场）' },
      { text: '强制-从下方移动到此后：放置 1 个线索', status: 'approximation', evidence: `${entry}:15-18；${P}/behavior.js:378-437`, note: '同山地 enterFromBelow 接线缺口（high）' },
      { text: '背面：下方线索未发现时不能进入', status: 'implemented', evidence: `${entry}:23；${P}/behavior.js:201-222`, note: '' },
    ],
    perceivability: { status: 'partial', evidence: `${P}/behavior.js:142-155`, note: '' },
    tests: { status: 'hook-only', evidence: 'tests/eote-primitives-travel.test.mjs', note: '' },
    issues: [climbWiring(entry, '15-18'),
      issue('medium', 'impl-vs-text', '08606 揭示效果缺少「若高度为 0」条件，且该地点在确定性 setup 里被放一边、没有入场路径', `${entry}:19-22；${P}/behavior.js:142-155；${P}/definition.js:40-43`, '补条件判断；随机 setup 或给出 set-aside 地点的入场途径')],
  })
}
{
  const entry = `${EP}/08607.js`
  peaksCards.push({
    code: '08607', verdict: 'gap',
    clauses: [
      { text: '山顶的线索只能通过调查发现', status: 'missing', evidence: `${entry}:16-19（嵌套在 locationRule.flags）；${ENG}/locations.js:377-380（引擎读 locationRule.cluesOnlyByInvestigation 顶层）`, note: '嵌套错位 → 限制不生效（high）' },
      { text: '强制-山顶被揭示时：混乱袋加入 1 个 [frost]', status: 'implemented', evidence: `${entry}:20；${P}/behavior.js:142-155,127-139；${ENG}/locations.js:272（locationRevealed 读点）`, note: '' },
      { text: '[action]：撤退；所有[[探险]]支援加入胜利区；线索放回供应堆', status: 'implemented', evidence: `${P}/behavior.js:307-317（actions 按 summit id 硬编码提供）,320-338（performAction）`, note: '行为已实现，但未读条目的 summitResign 声明（声明未接线 low）' },
      { text: '背面：下方线索未发现时不能进入', status: 'implemented', evidence: `${entry}:21；${P}/behavior.js:201-222`, note: '' },
    ],
    perceivability: { status: 'perceivable', evidence: `${P}/behavior.js:322-338（api.info）`, note: '' },
    tests: { status: 'hook-only', evidence: 'tests/eote-scenario-toTheForbiddenPeaks.test.mjs:234-247', note: '' },
    issues: [
      issue('high', 'primitive', '08607「线索只能通过调查发现」声明在 locationRule.flags 内，而引擎读点是 locationRule.cluesOnlyByInvestigation（顶层）→ 规则完全未生效', `${entry}:16-19；${ENG}/locations.js:377-380；${ENG}/ability.js:791（注册期校验的也是顶层）`, '把 cluesOnlyByInvestigation 移到 locationRule 顶层'),
      issue('low', 'primitive', 'summitResign 声明无字面读点（实际行为在 behavior 里按 summit id 硬编码）', `${entry}:17；${P}/behavior.js:307-317`, 'behavior 改为读 locationRuleFor(code).flags.summitResign，或删除孤儿声明'),
    ],
  })
}
{
  const e = `${EP}/08608.js`
  peaksCards.push({
    code: '08608', verdict: 'gap',
    clauses: [
      { text: '猎手。庞大。', status: 'implemented', evidence: `${e}:15-21（hunter/massive；definition enemyDefinition 亦解出）`, note: '' },
      { text: '星之恐怖得到 +3[per_investigator] 生命', status: 'implemented', evidence: `${P}/behavior.js:286-294（enemyStatModifier health=3×人数）；${ENG}/rules-state.js:9-13（health 读点）`, note: '' },
      { text: 'X = 你所在地点的高度（至少 1）', status: 'missing', evidence: `${e}:19（levelStats:'level'）；src/cards/cards-data.js（08608 fight/evade=-2 的 X sentinel）；${P}/behavior.js:286-294；${ENG}/enemies.js:136,154（+=）`, note: '实际 fight/evade = -2+Level，应为 Level（min1）→ 数值错误（high）' },
      { text: '强制-一轮结束时：将星之恐怖所在地点的所有调查员移动到下方地点', status: 'implemented', evidence: `${P}/behavior.js:296-305（roundEnded）；${ENG}/phases.js:226（轮末读点）`, note: '按卡号字面量分支实现，声明的 roundEnd: moveDownToBelow 无读点（medium）' },
    ],
    perceivability: { status: 'perceivable', evidence: `${P}/behavior.js:296-305、286-294`, note: '' },
    tests: { status: 'hook-only', evidence: 'tests/eote-scenario-toTheForbiddenPeaks.test.mjs:281-301', note: '断言 hook 返回值 3，未断言最终 fight/evade' },
    issues: [
      issue('high', 'impl-vs-text', '08608 的 X 数值错误：fight/evade 印刷值在 cards-data 里以 -2 表示 X，但 behavior.enemyStatModifier 返回 +Level 被引擎相加 → 实际为 -2+Level（Level1 时 -1），应为 Level（最少 1）', `${e}:19；${P}/behavior.js:286-294；${ENG}/enemies.js:136,154；正确口径参照 content/campaigns/theDreamEaters/scenarios/darkSideOfTheMoon/behavior.js:539-543（value += X - enemy[stat]）`, '改为返回 X - (enemy.fight/evade 印刷值)（或让数据读点支持 replace 语义），并补最终数值断言'),
      issue('medium', 'primitive', 'enemyRule.roundEnd:"moveDownToBelow" 声明无读点；轮末强制改为 behavior 内按卡号字面量实现（D4 声明即接线）', `${e}:20；${P}/behavior.js:296-305`, 'behavior.roundEnded 读 enemyRuleFor(code).roundEnd 分派，去掉卡号字面量'),
    ],
  })
}
{
  const e = `${EP}/08609.js`
  peaksCards.push({
    code: '08609', verdict: 'gap',
    clauses: [
      { text: '猎手。', status: 'implemented', evidence: `${e}:14-19`, note: '' },
      { text: 'X = 你所在地点的高度（至少 1）', status: 'missing', evidence: `${e}:16；src/cards/cards-data.js（08609 health=-2 的 X sentinel）；${P}/behavior.js:286-294；${ENG}/rules-state.js:9-13（+=）`, note: 'health 实际 = -2+Level（Level<=2 时被夹到 0/1），应为 Level（min1）' },
      { text: '与本敌人交战时，你不能移动到上方地点', status: 'missing', evidence: `${e}:17（blocksAscendWhileEngaged:true）；全仓仅此一处（grep）；${P}/behavior.js:201-222 moveError 未检查`, note: '完全未实现（high）' },
    ],
    perceivability: { status: 'perceivable', evidence: `${P}/behavior.js:286-294`, note: '' },
    tests: { status: 'none', evidence: 'tests 仅名称命中（tests/eote-scenario-toTheForbiddenPeaks.test.mjs:298-300 断言 hook 值）', note: '' },
    issues: [
      issue('high', 'primitive', '08609「与你交战时不能移动到上方地点」声明 enemyRule.blocksAscendWhileEngaged 但全仓无读点，moveError 未实现该限制', `${e}:14-19；${P}/behavior.js:201-222；全仓 grep 仅条目本身`, '在 behavior.moveError 读 enemyRuleFor(code).blocksAscendWhileEngaged 并检查交战敌人'),
      issue('high', 'impl-vs-text', '08609 的生命值 X 数值错误（-2 sentinel + Level 相加）', `${e}:16；${P}/behavior.js:286-294；${ENG}/rules-state.js:9-13；对比 darkSideOfTheMoon/behavior.js:539-543`, 'X 数值应替换 sentinel 而非相加'),
    ],
  })
}
for (const [code, line, kind] of [['08610', 12, 'snowfall'], ['08611', 12, 'avalanche'], ['08612', 12, 'hangingOnTheEdge'], ['08613', 12, 'hypothermia']]) {
  const e = `${EP}/${code}.js`
  const clauses = [{ text: '显现效果（见卡面）', status: 'approximation', evidence: `${e}:${line}（resolveKind:'${kind}'）；${P}/behavior.js:488-562（TREACHERY_HANDLERS.${kind} 实现）`, note: 'handler 逻辑存在且单元直调通过，但真实遭遇路径不调用（high，见 issue）' }]
  if (code === '08613') clauses.push({ text: '高度 4/5 时额外揭示 1 枚混乱标记', status: 'approximation', evidence: `${P}/behavior.js:534-562（近似为难度 +2，仅代码注释披露）`, note: '近似未登记到 scenarioApproximations / known-deviations（medium）' })
  peaksCards.push({
    code, verdict: 'gap', clauses,
    perceivability: { status: 'partial', evidence: `${P}/behavior.js:488-562（api.info/choice）`, note: '真实抽到时甚至看不到结算' },
    tests: { status: 'hook-only', evidence: 'tests/eote-scenario-toTheForbiddenPeaks.test.mjs:252-276（直调 behavior.resolveEncounter）', note: '' },
    issues: [treacheryDead(e, line, `${P}/definition.js:110-117`, '失落之峰'),
      ...(code === '08613' ? [issue('medium', 'docs', '08613「额外揭示 1 枚」近似（难度+2）只在源码注释披露，未进 behavior.scenarioApproximations / known-deviations', `${P}/behavior.js:534-562；${P}/behavior.js:54-56（scenarioApproximations 只有确定性 setup 一条）`, '登记近似到 scenarioApproximations 与账本')] : [])],
  })
}
const storyAssetData = [
  ['08614', 15, '使用(4充能)', '[reaction]成功攻击时花 1 充能+横置：该攻击 +1 伤害'],
  ['08615', 12, '（本卡无 uses，仅 flags）', '[action]横置：本地点调查员查看牌库顶 6 张，找最多 3 张非弱点道具/供给正面朝下附属；附属牌如同手牌可打出'],
  ['08616', 15, '使用(2补给)', '[action]花 1 补给+横置：选本地点或连接地点，对每个敌人与调查员各造成 3 伤害'],
  ['08617', 15, '使用(3充能)', '[reaction]同地点调查员抽到忒咳哩-哩弱点时花 1 充能：取消效果、放回忒咳哩-哩牌库底并抽 1 张'],
  ['08618', 15, '使用(3充能)', '[action]花 1 充能：以基础智力 5 调查；取消本次 frost 标记；成功额外发现 1 线索'],
  ['08619', 15, '使用(3补给)', '可触发不在场的 Expedition 支援能力（未划掉者），以横置+1 补给代替非行动费用'],
  ['08620', 15, '使用(3补给)', '[fast]花 1 补给+横置：本地点另一支援 +1 补给，或本地点调查员 +1 资源'],
]
for (const [code, line, uses, ability] of storyAssetData) {
  const e = `${EP}/${code}.js`
  peaksCards.push({
    code, verdict: 'gap',
    clauses: [
      { text: uses, status: 'implemented', evidence: `${e}:${line}-19（uses/usesType/flags 数据）`, note: '数据存在；08615 无 uses 属于卡面事实' },
      { text: ability, status: 'missing', evidence: `${e}:11-20（条目只有 code/uses/flags，无 abilities/描述子）；${P}/behavior.js:47-56（isExpeditionAsset）,301-345（只做取得/撤退，无能力结算）；全仓 grep 相关 flags 仅条目自身`, note: '卡片能力零实现（high）' },
    ],
    perceivability: { status: 'unverifiable', evidence: `${e}`, note: '无能力可感知' },
    tests: { status: 'data-only', evidence: 'tests/eote-interaction-fixture.mjs / tests/eote-migrations 仅登记身份与 uses', note: '无行为断言' },
    issues: [issue('high', 'impl-vs-text',
      `${code} 卡面能力完全未实现：条目只声明 uses/flags，behavior 无对应读点；账本 status=verified 与实际不符（虚假 verified）`,
      `${e}:1-21；${P}/behavior.js:301-345；${REF}/Scenario/Scenarios/EdgeOfTheEarth/ToTheForbiddenPeaks.hs:216-227（仅入场，能力在 Asset CardDefs）`,
      '先补齐 Expedition 资产入场，再按共享原语实现能力（+1 伤害/搜索附属/爆炸/取消弱点/调查/借能力/补给）或提交 primitive request 并降账本状态')],
  })
}

// ============================== 古老者之城 08621–08647 ==============================
const cityCards = [
  {
    code: '08621', verdict: 'match',
    clauses: [
      { text: '简单/普通：skull=-X（X=你控制的钥匙数）；cultist=-2 失败放 1 钥匙到地点；tablet=-3 若本检定揭示 frost 改为自动失败；elder_thing=-4 失败最近敌人移动/攻击', status: 'implemented', evidence: `${C}/chaos.js:11-25,27-38；${C}/behavior.js:371-397`, note: 'skull 用 valueKeysAt 计数' },
      { text: '困难/专家：skull=-(X+2)；cultist=-2 必放钥匙；tablet=-4 +1 伤害 + 自动失败；elder_thing=-5', status: 'implemented', evidence: `${C}/chaos.js:11-25,27-38；${C}/behavior.js:375-397,380-393（testAutoFail）`, note: '' },
      { text: '（场景 setup，非卡面）混乱袋 +1 [elder_thing] 标记（v1/v2）', status: 'missing', evidence: `${C}/behavior.js:83-140；${REF}/Scenario/Scenarios/EdgeOfTheEarth/CityOfTheElderThings.hs:363,394（v3 不加）`, note: '属章节 setup 缺口，记入 scenarios[1].issues' },
      { text: '（场景特别规则 Keys）无线索地点的钥匙可 [fast] 取得；[action] 转交；被击败时钥匙落地', status: 'missing', evidence: `${C}/behavior.js:180-201（只有导出函数），:256-293（actions 无数值钥匙取得/转交）；shared _shared.js:842-847 是彩色钥匙版且未挂到 08621`, note: '玩家在真实界面无法取得钥匙 → 幕 1 目标不可达（high）' },
    ],
    perceivability: { status: 'partial', evidence: `${C}/behavior.js:371-397；${C}/chaos.js:27-38`, note: 'token 值可感知；钥匙取得无入口' },
    tests: { status: 'hook-only', evidence: 'tests/eote-scenario-cityOfTheElderThings.test.mjs:144-158（直调 behavior.claimKey）,222-240', note: '' },
    issues: [],
  },
]
for (const code of ['08622', '08623']) {
  const e = `${EC}/${code}.js`
  cityCards.push({
    code, verdict: 'gap',
    clauses: [
      { text: '[fast] 本回合花 1 线索：查看所在行/列一个城市景观的已揭示面（每轮一次）', status: 'approximation', evidence: `${e}:14-29（freeActions）；${C}/behavior.js:261-265,274-276` , note: '可扣线索并记录每轮一次，但 api.chooseRowOrColumn 不存在（scenarioRuntime 无该 API），且从未调用 behavior.lookAtRow/visibleOnRow → 无任何信息展示' },
      { text: '[fast] 本回合花 3 线索：移动到所在行/列任意地点（每轮一次）', status: 'missing', evidence: `${C}/behavior.js:277-279,311-317`, note: '只扣线索+日志，从未改变 inv.location（high）' },
      ...(code === '08623' ? [{ text: '背面 (→R2)', status: 'missing', evidence: `${e}:14-30（agendaRule 无 onReveal）；${C}/behavior.js:220-226,415-417`, note: '最后议程推进无结算（high）' }] : []),
    ],
    perceivability: { status: 'partial', evidence: `${C}/behavior.js:303-317`, note: '查看行动无输出，移动行动无效' },
    tests: { status: 'hook-only', evidence: 'tests/eote-scenario-cityOfTheElderThings.test.mjs:163-176（只断言线索扣减/去重）', note: '未断言移动结果/查看输出' },
    issues: [
      issue('high', 'impl-vs-text', `${code} 议程自由行动两处不等价：查看未展示城市景观（api.chooseRowOrColumn 不存在）；移动行/列只扣 3 线索而不移动（performAction 无位移）`, `${e}:14-29；${C}/behavior.js:274-279,303-317；grep 全仓无 chooseRowOrColumn 实现`, '移动改走权威移动管线（或 api.mechanics.city 移动校验）；查看看牌改为把 visibleOnRow/visibleOnColumn 结果作为私密信息发给该座位；补断言'),
      issue('medium', 'duplication', '同一自由行动在 agendaRule.freeActions 与 behavior.actions 硬编码各声明一次 → 合法行动列表重复', `${e}:14-29；${C}/behavior.js:261-265,274-279；tests/eote-scenario-cityOfTheElderThings.test.mjs:168-175（用 some() 未发现重复）`, '删除 behavior 内硬编码，仅保留条目数据'),
      ...(code === '08623' ? [issue('high', 'runtime', '08623 背面 (→R2) 未实现：finalResolution 无调用者，探索完最后一个议程只做 checkOutcome（仅全灭才结束）→ 毁灭耗尽无法结束/记录 R2', `${e}:14-30；${C}/behavior.js:220-226,415-417；${ENG}/act-agenda.js:355-361；${ENG}/harm-threat.js:354-361`, '08623 声明 onReveal:"finalResolution"，behavior.agendaReveal 处理 finalResolution 并写 R2 记录；补超时测试')] : []),
    ],
  })
}
const act1Back = {
  '08624': ['v1', '将放一边的修格斯组与遭遇弃牌堆混洗入遭遇牌库；揭示隐秘隧道；把放一边的星之恐怖放到隐秘隧道（横置）', `${C}/behavior.js:462-467（act1BackV1 只设 hiddenTunnelRevealed + 日志）`],
  '08625': ['v2', '将放一边的冰中生物组与遭遇弃牌堆混洗入遭遇牌库；揭示隐秘隧道；混乱袋 +1 [frost]', `${C}/behavior.js:469-475（act1BackV2 只设 flag + frost）`],
  '08626': ['v3', '将放一边的修格斯组与遭遇弃牌堆混洗入遭遇牌库；揭示隐秘隧道；按玩家顺序每位调查员抽 1 张遭遇牌', `${C}/behavior.js:476-483（act1BackV3 只设 flag + drawEncounter）`],
}
for (const code of ['08624', '08625', '08626']) {
  const [v, backText, impl] = act1Back[code]
  const e = `${EC}/${code}.js`
  const missing = code === '08624' ? '洗混修格斯组+遭遇弃牌堆；星之恐怖入场' : code === '08625' ? '洗混冰中生物组+遭遇弃牌堆' : '洗混修格斯组+遭遇弃牌堆'
  cityCards.push({
    code, verdict: 'gap',
    clauses: [
      { text: '[action] 花费 2 个符号钥匙：记录对应战役条目', status: 'implemented', evidence: `${e}:15-47（objective/keyActions）；${C}/behavior.js:282-286,332-341（actions/performAction actKey）`, note: '通用 actKey 分派；钥匙取得入口缺失（场景 issue）' },
      { text: '目标：两条记录都完成时推进', status: 'implemented', evidence: `${C}/behavior.js:227-243（checkObjectives cityKeys）；${ENG}/act-agenda.js:183`, note: '' },
      { text: `背面：${backText}`, status: 'approximation', evidence: `${e}:48（onReveal）；${impl}；${ENG}/reveal.js:151-162`, note: `缺少：${missing}（high）` },
    ],
    perceivability: { status: 'perceivable', evidence: `${C}/behavior.js:332-341,460-488（api.info）`, note: '' },
    tests: { status: 'hook-only', evidence: 'tests/eote-scenario-cityOfTheElderThings.test.mjs:178-196（只测 v1 正面；背面仅断言 hiddenTunnelRevealed）', note: '' },
    issues: [issue(code === '08624' ? 'high' : 'high', 'impl-vs-text',
      `${code}（${v}）背面效果不完整：${missing} 均未实现，只设置 hiddenTunnelRevealed（${code === '08626' ? '抽遭遇牌已实现' : ''}）`,
      `${e}:48；${impl}；${REF}/Scenario/Scenarios/EdgeOfTheEarth/CityOfTheElderThings.hs:342-371（v1）/383-406（v2）/418-440（v3）`,
      '用 state.scenario.encounterDeck/state.encounterDiscard 合并共享组与弃牌堆，按版本 spawn Terror（v1），并补测试')],
  })
}
const act2Data = {
  '08627': ['v1', '[action] 花费 2 个 cultist 钥匙：每位调查员可治愈 1 伤害/1 恐惧/1 创伤', 'healAll', `${C}/behavior.js:343-351（actTwo: 只花钥匙+日志，无治愈）`],
  '08628': ['v2', '[action] 花费 2 个 tablet 钥匙：每位调查员查找牌库中所有忒咳哩-哩弱点并洗回忒咳哩-哩牌库，然后洗牌', 'returnTekeliWeaknesses', `${C}/behavior.js:343-351（只花钥匙+日志）`],
  '08629': ['v3', '[action] 花费 2 个 elder_thing 钥匙：从混乱袋移除所有 elder_thing 标记', 'removeElderThingTokens', `${C}/behavior.js:343-351（只花钥匙+日志）；行为无 onEnemyEnter/forcedOnEnemyEnter 读点`],
}
for (const code of ['08627', '08628', '08629']) {
  const [v, actionText, ruleName, impl] = act2Data[code]
  const e = `${EC}/${code}.js`
  const actTwoLines = code === '08629' ? '20-29' : '19-28'
  const onRevealLine = code === '08629' ? 31 : 29
  const clauses = [
    { text: actionText, status: 'missing', evidence: `${e}:${actTwoLines}（actTwoActions ${ruleName}）；${impl}`, note: '效果未实现（high）' },
    { text: '目标：所有未被击败调查员在隐秘隧道且隧道无线索时推进', status: 'implemented', evidence: `${e}:16-18；${C}/behavior.js:245-253（checkObjectives hiddenTunnel）`, note: '' },
    { text: '背面 (→R1)', status: 'implemented', evidence: `${e}:${onRevealLine}（onReveal resolution1）；${C}/behavior.js:204-218（actReveal 字符串 resolution 分支）`, note: '' },
  ]
  if (code === '08629') clauses.push({ text: '强制-修格斯或精英敌人进入地点时：击败该地点的所有古老者敌人', status: 'missing', evidence: `${e}:30（forcedOnEnemyEnter:'defeatElderThingsAtLocation'）；全仓 grep 该键仅条目本身；${ENG}/movement.js:390 只开 enemyEnteredLocation 窗口、无章节读点`, note: '声明未接线（high）' })
  cityCards.push({
    code, verdict: 'gap', clauses,
    perceivability: { status: 'partial', evidence: `${C}/behavior.js:343-351（api.info）`, note: '' },
    tests: { status: 'hook-only', evidence: 'tests/eote-scenario-cityOfTheElderThings.test.mjs:178-196（仅 v1 幕1）；无 act2 行动测试', note: '' },
    issues: [
      issue('high', 'impl-vs-text', `${code}（${v}）的 [action] 效果未实现：通用 actTwo 分派只花钥匙并写日志`, `${e}:19-31；${impl}`, '在 behavior 为 actTwo action 增加按 action 名的效果分派（治愈/洗回弱点/移除 token），或改用通用原语'),
      ...(code === '08629' ? [issue('high', 'primitive', '08629 forcedOnEnemyEnter:"defeatElderThingsAtLocation" 在 src+content 无任何读点（已全仓 grep 确认），强制能力未实现', `${e}:30；全仓仅此一处`, '在章节 behavior 或引擎 enemyEnteredLocation 窗口接读 actRule.forcedOnEnemyEnter；补入场地测试')] : []),
    ],
  })
}
{
  const e = `${EC}/08630.js`
  cityCards.push({
    code: '08630', verdict: 'gap',
    clauses: [
      { text: '隐秘隧道上的线索不能被（非调查）发现或移动到其他地点', status: 'missing', evidence: `${e}:14-22（blocksClueDiscovery:true）；全仓无该键读点（grep）`, note: '规则未生效（high）' },
      { text: '[action] 任选技能检定(4)；可花 1 个 skull 钥匙使本次技能值 +5；成功把隧道 1 线索放回供应堆（花 skull 则 2）', status: 'approximation', evidence: `${C}/behavior.js:544-558（tunnelInvestigate 固定 willpower 4；成功后花 skull 才变 2）`, note: '缺「任选技能」与「+5 技能值」；花费时机/效果不等价' },
      { text: '背面：隐秘隧道未揭示时不能进入', status: 'implemented', evidence: `${C}/behavior.js:245-253（moveError）`, note: '' },
      { text: '胜利 1 点', status: 'implemented', evidence: `${e}:22；${C}/definition.js:111-118（hasVictory）`, note: '' },
    ],
    perceivability: { status: 'perceivable', evidence: `${C}/behavior.js:544-560（api.test/api.info）`, note: '' },
    tests: { status: 'hook-only', evidence: 'tests/eote-scenario-cityOfTheElderThings.test.mjs:124-139（只测不能进入）', note: '' },
    issues: [
      issue('high', 'primitive', '08630 blocksClueDiscovery 声明无读点：隧道线索可被非调查效果发现/移动', `${e}:21；全仓 grep 仅条目本身；${ENG}/locations.js:368-381（只有 cluesOnlyByInvestigation/canDiscoverClues）`, '在引擎 clue discovery/move 读点接 locationRule.blocksClueDiscovery，或 behavior.canDiscoverClues 读条目'),
      issue('medium', 'impl-vs-text', '08630 隧道行动近似：固定意志(4)、+5 技能值未实现、skull 钥匙在成功后而非检定前花费', `${e}:14-22；${C}/behavior.js:544-560`, '改为任选技能 + 检定前可选花 skull(+5)；补测试'),
    ],
  })
}
{
  const e = `${EC}/08631.js`
  cityCards.push({
    code: '08631', verdict: 'gap',
    clauses: [
      { text: '[action] 花费 2 个「0」钥匙：把花费的一个「0」钥匙作为混乱标记加入混乱袋（直到战役结束）；记录「队伍拍摄了天文图照片」', status: 'missing', evidence: `${e}:12-25（values ['0','0']，remember:'theTeamStudiedTheHistoryOfTheElderThings'）；${C}/behavior.js:560-566（planetariumStudy：addFrostToken + 写错键）`, note: '两处错误：加入 frost 而非「0」钥匙 token；记录键错（应为 theTeamPhotographedTheAstronomicalCharts）' },
    ],
    perceivability: { status: 'partial', evidence: `${C}/behavior.js:562-573（api.info）`, note: '提示文字也与卡面不符' },
    tests: { status: 'none', evidence: '无针对 planetariumStudy 的断言', note: '' },
    issues: [
      issue('high', 'impl-vs-text', '08631 实现与卡面不符：把「花费的 0 钥匙作为混乱标记」实现成「加入 1 个 frost」，且记录错战役键（写入幕1目标记录 theTeamStudiedTheHistoryOfTheElderThings）', `${e}:12-25；${C}/behavior.js:453-457（addFrostToken）,562-573；content/campaigns/edgeOfTheEarth/records.js:237（正确键 theTeamPhotographedTheAstronomicalCharts）`, '按卡面加「0」值 chaos token（持久），remember 改为 theTeamPhotographedTheAstronomicalCharts'),
    ],
  })
}
{
  const e = `${EC}/08632.js`
  cityCards.push({
    code: '08632', verdict: 'approximation',
    clauses: [
      { text: '[action] 检定 [combat](4) 或 [agility](4)：成功发现石桥 1 个线索', status: 'approximation', evidence: `${e}:13-24；${C}/behavior.js:568-581（固定 combat 4；成功后直接搬 1 线索到 inv.clues）`, note: '缺技能选择；发现线索绕过引擎发现管线（不计发现窗口/加成）' },
      { text: '[action] 移动到另一个石桥地点', status: 'approximation', evidence: `${C}/behavior.js:582-590（取第一个其他石桥，无选择/无移动管线）`, note: '' },
    ],
    perceivability: { status: 'perceivable', evidence: `${C}/behavior.js:575-607（api.test/api.info）`, note: '' },
    tests: { status: 'none', evidence: '无 city 石桥断言', note: '' },
    issues: [issue('medium', 'impl-vs-text', '08632 少技能选择、发现线索绕过引擎管线、石桥传送无选择', `${e}:13-24；${C}/behavior.js:575-607`, '用 api.test 的 skillChoice / 走引擎 discover 入口；移动改走移动管线')],
  })
}
{
  const e = `${EC}/08633.js`
  cityCards.push({
    code: '08633', verdict: 'approximation',
    clauses: [
      { text: '[action] 花费 2 个「-2」钥匙：抽 2 张牌、获得 2 资源、从混乱袋移除 2 个 [frost]；记录「队伍研究了壁画雕刻」', status: 'approximation', evidence: `${e}:12-25；${C}/behavior.js:592-601（towerStudy）`, note: '效果主体实现；记录键错写 theTeamStudiedTheHistoryOfTheElderThings（应为 theTeamStudiedTheMuralCarvings）；抽牌用 inv.deck.pop() 绕过抽牌管线' },
    ],
    perceivability: { status: 'perceivable', evidence: `${C}/behavior.js:608-623（api.info）`, note: '' },
    tests: { status: 'none', evidence: '无 towerStudy 断言', note: '' },
    issues: [issue('medium', 'impl-vs-text', '08633 记录键错误（写入幕1目标记录，而不是 theTeamStudiedTheMuralCarvings）；抽牌绕过引擎抽牌管线', `${e}:48；${C}/behavior.js:608-623；content/campaigns/edgeOfTheEarth/records.js:238`, '改用正确战役记录键；抽牌走 api.drawCards')],
  })
}
{
  const e = `${EC}/08634.js`
  cityCards.push({
    code: '08634', verdict: 'gap',
    clauses: [
      { text: '在本地点的技能检定期间，每次揭示混乱标记：若本地点/本地点调查员有同面钥匙，其修正值翻倍', status: 'missing', evidence: `${e}:12-17（locationRule.flags.doubleKeyTokenModifier）；${C}/behavior.js:371-397（afterTest 无该分支）；全仓无读点`, note: '声明未接线（high）' },
    ],
    perceivability: { status: 'unverifiable', evidence: `${e}`, note: '' },
    tests: { status: 'none', evidence: '无断言', note: '' },
    issues: [issue('high', 'primitive', '08634 的 flags.doubleKeyTokenModifier 无任何读点：钥匙同面时混乱标记修正翻倍完全未实现', `${e}:13-15；全仓 grep 仅条目本身；${C}/chaos.js:27-38（token delta 计算无该修正）`, '在章节 chaos/resolveChaosToken 或 afterTest 读双倍标记（需访问地点/钥匙）')],
  })
}
{
  const e = `${EC}/08635.js`
  cityCards.push({
    code: '08635', verdict: 'gap',
    clauses: [
      { text: '[action] 花费 2 个「-3」钥匙：选择并揭示 3 个隐秘隧道以外的地点；从中各发现 1 个线索；记录「队伍查看了地图」', status: 'approximation', evidence: `${e}:12-25；${C}/behavior.js:603-610（mapRoomStudy）`, note: '无选择（取前 3 个未揭示）；「发现 1 线索」只把地点线索减 1，未给调查员记线索（不等于发现）；记录键错（应为 theTeamReadTheMap）' },
    ],
    perceivability: { status: 'partial', evidence: `${C}/behavior.js:624-637`, note: '' },
    tests: { status: 'none', evidence: '无断言', note: '' },
    issues: [issue('high', 'impl-vs-text', '08635 三项不等价：无地点选择、发现线索未记给调查员（线索蒸发）、记录键写入幕1目标键', `${e}:48；${C}/behavior.js:624-637；records.js:237`, '选择地点 + 走发现管线记给调查员 + 正确记录键')],
  })
}
{
  const e = `${EC}/08636.js`
  cityCards.push({
    code: '08636', verdict: 'approximation',
    clauses: [
      { text: '[action] 花费 2 个「-1」钥匙：移除密谋 1 毁灭，或弃掉场上 1 个非精英敌人或 1 张诡计；记录「队伍发现了一个古代墓穴」', status: 'approximation', evidence: `${e}:12-25；${C}/behavior.js:612-622（rampartStudy）`, note: '无选择；只处理「密谋毁灭（state.doom）/非精英敌人」，未实现「弃掉场上诡计」；记录键错（应为 theTeamDiscoveredAnAncientVault）' },
    ],
    perceivability: { status: 'partial', evidence: `${C}/behavior.js:638-653`, note: '' },
    tests: { status: 'none', evidence: '无断言', note: '' },
    issues: [issue('medium', 'impl-vs-text', '08636 缺少诡计弃掉选项且无选择交互；记录键错误', `${e}:48；${C}/behavior.js:638-653；records.js:235`, '补选择（毁灭/敌人/诡计）与正确的记录键')],
  })
}
{
  const e = `${EC}/08637.js`
  cityCards.push({
    code: '08637', verdict: 'gap',
    clauses: [
      { text: '强制：在本地点技能检定揭示 ≥1 个 [frost] 后，受到 1 点伤害', status: 'missing', evidence: `${e}:13-16（flags.frostForcedDamage:1）；${C}/behavior.js:375-397（afterTest 无该分支）；全仓无读点`, note: '声明未接线（high）' },
      { text: '[reaction] 发现本地点最后一个线索后：发现连接地点的 1 个线索', status: 'approximation', evidence: `${e}:17-23；${C}/behavior.js:624-632（streetsReactionClue 被做成 [action] 地点行动，非 reaction）`, note: '触发时机由 reaction 变为主动行动' },
    ],
    perceivability: { status: 'partial', evidence: `${C}/behavior.js:654-665`, note: '' },
    tests: { status: 'none', evidence: '无断言', note: '' },
    issues: [
      issue('high', 'primitive', '08637 的 flags.frostForcedDamage 无读点：揭示 frost 后的强制伤害未实现', `${e}:14-15；${C}/behavior.js:375-397；全仓 grep 仅条目本身`, '在章节 afterTest（或引擎 frost 读点）结算地点强制'),
      issue('medium', 'impl-vs-text', '08637 的 reaction（发现最后线索后）被实现为 [action] 地点行动，时机不等价', `${e}:17-23；${C}/behavior.js:654-665`, '改为线索发现后的 reaction/触发窗口'),
    ],
  })
}
{
  const e = `${EC}/08638.js`
  cityCards.push({
    code: '08638', verdict: 'approximation',
    clauses: [
      { text: '[action]：将本行另一个地点的 1 个钥匙移到巨大尖顶（团队每场一次）', status: 'approximation', evidence: `${e}:12-20；${C}/behavior.js:634-648（moveKeyToSpires）`, note: '取第一个有钥匙的同行地点，无选择；teamOnce 已实现' },
    ],
    perceivability: { status: 'perceivable', evidence: `${C}/behavior.js:666-681（api.info）`, note: '' },
    tests: { status: 'none', evidence: '无断言', note: '' },
    issues: [issue('low', 'impl-vs-text', '08638 缺「选择哪个地点/哪把钥匙」交互（自动取第一个）', `${e}:12-20；${C}/behavior.js:666-681`, '补目标选择')],
  })
}
{
  const e = `${EC}/08639.js`
  cityCards.push({
    code: '08639', verdict: 'approximation',
    clauses: [
      { text: '[action]：将本地点 1 个线索移到本行/本列一个未揭示地点', status: 'approximation', evidence: `${e}:12-19；${C}/behavior.js:650-663（moveClueToHidden）`, note: '取第一个匹配目标，无选择；效果成立' },
    ],
    perceivability: { status: 'perceivable', evidence: `${C}/behavior.js:682-698`, note: '' },
    tests: { status: 'none', evidence: '无断言', note: '' },
    issues: [issue('low', 'impl-vs-text', '08639 缺目标地点选择（自动取第一个未揭示同行/列地点）', `${e}:12-19；${C}/behavior.js:682-698`, '补选择')],
  })
}
{
  const e = `${EC}/08640.js`
  cityCards.push({
    code: '08640', verdict: 'gap',
    clauses: [
      { text: '强制：在本地点技能检定揭示 ≥1 个 [frost] 后，受到 1 点恐惧', status: 'missing', evidence: `${e}:13-16（flags.frostForcedHorror:1）；${C}/behavior.js:375-397；全仓无读点`, note: '声明未接线（high）' },
      { text: '[action] 若本地点无线索：选择 2 个有钥匙的地点，交换这些地点的所有钥匙（团队每场一次）', status: 'approximation', evidence: `${e}:17-24；${C}/behavior.js:665-678（swapKeys）`, note: '自动取前两个「≥2 把钥匙」地点（限制错误：卡面只要求有钥匙）；无选择' },
    ],
    perceivability: { status: 'partial', evidence: `${C}/behavior.js:699-712`, note: '' },
    tests: { status: 'none', evidence: '无断言', note: '' },
    issues: [
      issue('high', 'primitive', '08640 的 flags.frostForcedHorror 无读点：强制恐惧未实现', `${e}:14-15；${C}/behavior.js:375-397`, '在 afterTest 结算地点强制'),
      issue('medium', 'impl-vs-text', '08640 交换钥匙实现错误：要求两地点各 ≥2 把钥匙（卡面只需有钥匙）、无玩家选择', `${e}:17-24；${C}/behavior.js:699-712`, '放宽条件并补选择'),
    ],
  })
}
{
  const e = `${EC}/08641.js`
  cityCards.push({
    code: '08641', verdict: 'gap',
    clauses: [
      { text: '猎手。庞大。', status: 'implemented', evidence: `${e}:14-20`, note: '' },
      { text: '星之恐怖得到 +3[per_investigator] 生命', status: 'implemented', evidence: `${C}/behavior.js:399-405（enemyStatModifier health=3×人数）`, note: '' },
      { text: '星之恐怖处于重整状态时，其所在地点调查员不能花费或控制钥匙', status: 'missing', evidence: `${e}:18（blocksKeysWhileReady:true）；全仓无读点`, note: '声明未接线（high）' },
    ],
    perceivability: { status: 'partial', evidence: `${e}`, note: '' },
    tests: { status: 'none', evidence: '无断言', note: '' },
    issues: [issue('high', 'primitive', '08641 blocksKeysWhileReady 无任何读点：重整时封锁钥匙花费/取得的限制未实现', `${e}:14-19；全仓 grep 仅条目本身；${C}/behavior.js:180-201（claimKey/giveKeys 不检查该限制）`, '在章节钥匙取得/花费入口或引擎 key-cost 读点检查该 enemyRule')],
  })
}
{
  const e = `${EC}/08642.js`
  cityCards.push({
    code: '08642', verdict: 'gap',
    clauses: [
      { text: '生成 - 任意无人地点', status: 'missing', evidence: `${e}:16（spawn:"anyEmpty"）；${ENG}/encounter.js:217（引擎读 spawnAnyEmpty 布尔）；${ENG}/enemies.js:409,507（spawnLocation/spawnOverrides 钩子）`, note: '键名/形状不符 → 不生效（high）' },
      { text: '入场带有 1 个毁灭标记', status: 'missing', evidence: `${e}:17（onSpawnDoom:1）；${ENG}/enemies.js:553（只读剧本 def.onSpawnDoom）；${C}/definition.js:109-118（enemyDefinition 未合并条目字段）`, note: '未接线（high）' },
      { text: '强制-被击败时：在当前密谋放 1 个毁灭', status: 'missing', evidence: `${e}:18（onDefeatDoom:1）；全仓无读点`, note: '未接线（high）' },
      { text: '[action]：谈判。意志(3)，成功将其移出游戏', status: 'missing', evidence: `${e}:19-24（enemyRule.parley 对象）；全仓无读点（parley 需条目 abilities 描述子或 def.parley：${ENG}/parley.js:105）`, note: '未接线（high）' },
    ],
    perceivability: { status: 'unverifiable', evidence: `${e}`, note: '只有数值可感知' },
    tests: { status: 'none', evidence: '无断言（city 测试仅注释提及名称）', note: '' },
    issues: [issue('high', 'primitive', '08642 四个条款（生成任意无人地点/入场毁灭/被击败毁灭/谈判）全部未接线：spawn 形状错误、onSpawnDoom 数据源未合并、onDefeatDoom 与 parley 无读点', `${e}:15-25；${ENG}/encounter.js:217；${ENG}/enemies.js:553；${ENG}/parley.js:105；全仓 grep 仅条目本身`, '按引擎既有键（spawnAnyEmpty/def.onSpawnDoom/abilities 谈判描述子）重写条目声明并接线')],
  })
}
{
  const e = `${EC}/08643.js`
  cityCards.push({
    code: '08643', verdict: 'gap',
    clauses: [
      { text: '猎手。', status: 'implemented', evidence: `${e}:14-20`, note: '' },
      { text: '强制-与本敌人交战时：把你控制的一个钥匙放到它上面；它离场时把该钥匙放到它的地点', status: 'missing', evidence: `${e}:16,18（takesKeyOnEngage/placesKeyOnLeave）；全仓无读点`, note: '未接线（high）' },
      { text: '强制-其地点调查员取得钥匙时：本敌人重整、与其交战并攻击', status: 'missing', evidence: `${e}:17（readiesOnKeyControlled）；全仓无读点`, note: '未接线（high）' },
    ],
    perceivability: { status: 'unverifiable', evidence: `${e}`, note: '' },
    tests: { status: 'none', evidence: '无断言', note: '' },
    issues: [issue('high', 'primitive', '08643 三条强制（交战取钥匙/离场放钥匙/取得钥匙时重整交战攻击）均无读点', `${e}:14-19；全仓 grep 仅条目本身；${C}/behavior.js:180-201（钥匙取得入口未接该限制）`, '在章节钥匙取得/敌人交战/离场钩子读 enemyRule 三键')],
  })
}
for (const [code, entryFile] of [['08644', `${EC}/08644.js`], ['08645', `${EC}/08645.js`], ['08646', `${EC}/08646.js`], ['08647', `${EC}/08647.js`]]) {
  const entryLine = code === '08644' || code === '08645' ? 12 : 14
  const clauses = [{ text: '显现效果（见卡面）', status: 'approximation', evidence: `${entryFile}:${entryLine}（resolveKind）；${C}/behavior.js:485-540（TREACHERY_HANDLERS 实现）`, note: 'handler 逻辑存在，但真实遭遇路径不结算（high）' }]
  if (code === '08644') clauses.push({ text: '难度按「你所在地点 + 你控制」的钥匙数增加', status: 'approximation', evidence: `${C}/behavior.js:487-502（只计控制钥匙 behavior.keyCount，未计地点上的钥匙；难度公式还多加 level——city 地点无 level 故无害）`, note: '少算地点上的钥匙（medium）' })
  if (code === '08645') clauses.push({ text: '检定期间若揭示与地点/控制钥匙同面的混乱标记则自动失败', status: 'missing', evidence: `${C}/behavior.js:504-518（只设置 flags.crumblingRuinsKeys，未接 chaosTokenRevealed/testAutoFail）`, note: '自动失败条款未实现（high）' })
  if (code === '08646' || code === '08647') clauses.push({ text: '强制：技能检定揭示 [frost] 时，受到 1 伤害/恐惧 或 自动失败（每检定一次）', status: 'missing', evidence: `${entryFile}:18-23（flags.frostWeakness:true）；全仓无读点；${C}/behavior.js:375-397（afterTest 无）`, note: '声明未接线（high）' })
  cityCards.push({
    code, verdict: 'gap', clauses,
    perceivability: { status: 'partial', evidence: `${C}/behavior.js:485-563（api.test/api.info/api.choice）`, note: '' },
    tests: { status: 'hook-only', evidence: 'tests/eote-scenario-cityOfTheElderThings.test.mjs:201-220,222-240（直调 behavior.resolveEncounter/chaos 函数）', note: '' },
    issues: [treacheryDead(entryFile, entryLine, `${C}/definition.js:121-127`, '古老者之城'),
      ...(code === '08644' ? [issue('medium', 'impl-vs-text', '08644 难度未计入「你所在地点上的钥匙」', `${C}/behavior.js:485-500；卡面 games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/bundles/08644.md:10`, '难度 = 2 + 所在地点钥匙数 + 控制钥匙数')] : []),
      ...(code === '08645' ? [issue('high', 'impl-vs-text', '08645「揭示与钥匙同面的混乱标记→自动失败」完全未实现（仅记录 flags.crumblingRuinsKeys）', `${C}/behavior.js:501-514；${ENG}/treachery-tokens.js:113-124（无该路径）`, '在测试/afterTest 或 chaosTokenRevealed 读点实现同面自动失败')] : []),
      ...((code === '08646' || code === '08647') ? [issue('high', 'primitive', `${code} 强制条款（揭示 frost → 1 伤害/恐惧或自动失败，每检定一次）无读点；${code === '08646' ? '且「如 1 点伤害被治愈」仅在代码注释披露近似' : ''}`, `${entryFile}:18-23；${C}/behavior.js:375-397,520-540；全仓 grep frostWeakness 仅条目本身`, '接 frost 揭示的威胁区强制读点；近似登记到 known-deviations')] : []),
    ],
  })
}

const cards = [...peaksCards, ...cityCards]
for (const card of cards) {
  const c = ALL_CARDS[card.code] || {}
  card.name = c.name || card.code
  card.nameZh = c.nameZh || c.name || card.code
  card.accepted = false
  if (!card.perceivability) card.perceivability = { status: 'unknown', evidence: '', note: '' }
  if (!card.tests) card.tests = { status: 'none', evidence: '', note: '' }
  if (!card.issues) card.issues = []
  card.accepted = card.verdict === 'match' && !card.issues.some(i => i.severity === 'high')
}

export { cards }
