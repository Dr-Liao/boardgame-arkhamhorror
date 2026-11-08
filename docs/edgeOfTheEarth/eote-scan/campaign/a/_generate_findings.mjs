// Generator (auditor A) — builds games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/campaign/a/findings.json from the audit data.
import fs from 'node:fs'

const P1 = 'content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart1'
const P2 = 'content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart2'
const P3 = 'content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart3'
const SHARED = 'src/cards/encounter-entries/edgeOfTheEarth/_shared/ice_and_death'
const E1 = 'src/cards/encounter-entries/edgeOfTheEarth/iceAndDeathPart1'
const E2 = 'src/cards/encounter-entries/edgeOfTheEarth/iceAndDeathPart2'
const E3 = 'src/cards/encounter-entries/edgeOfTheEarth/iceAndDeathPart3'
const CD = 'content/campaigns/edgeOfTheEarth/card-data.js'
const API_MISC = 'src/engine/api-misc.js'

const issue = (severity, dimension, summary, evidence, suggestion) => ({ severity, dimension, summary, evidence, suggestion })

// 通用 D3 缺陷（多处引用，保证同一条根因在每个受影响的卡上都有证据）
const ISSUE_HOOK_ACTIONS = issue('high', 'runtime',
  '引擎只调用 behavior.actions/performAction（moves.js:222、dispatch.js:633），本章 behavior 导出的是 scenarioActions/performScenarioAction → 真实引擎路径从不提供营地撤退/抽取地点底牌行动',
  `${P1}/behavior.js:397-398 / ${P2}/behavior.js:396-397 / ${P3}/behavior.js:159-160；读点 src/engine/moves.js:222、src/engine/dispatch.js:633、src/engine/moves.js:631-649`,
  '把行为对象键名改为 actions/performAction（与 cityOfTheElderThings/toTheForbiddenPeaks 一致），或让引擎同时接受旧名；补真实引擎 legalMoves 断言。')
const ISSUE_SHROUD = issue('high', 'impl-vs-text',
  '地点卡印刷「隐藏值 shroud」未进入章节地点数据：LOCATION_TABLE/placeLocation 只带 shelter/clues，card-data.js#location 不复制 shroud；引擎调查难度 = loc.shroud + … 得到 NaN',
  `${P1}/definition.js:28-61,98-104、${P2}/definition.js:26-52,83-90、${P3}/definition.js:31-40,81-86；content/campaigns/edgeOfTheEarth/card-data.js:23-41；引擎 src/engine/actions.js:593；probe 实测 UI 显示「调查『冰冻海岸』（智识 vs 帷幕 NaN）」且调查必失败`,
  'location() 从 ALL_CARDS 复制 shroud/investigateSkill（或 LOCATION_TABLE 增列），并在测试中断言每张地点 shroud 与卡面一致。')
const ISSUE_P3_SHELTER = issue('high', 'impl-vs-text',
  'Part III 地点数据既无 shelter（印刷 0–8）也无线索（setup 把全部地点 clues/maxClues 清 0）→ [skull] 恒 0、08516 难度恒 0、营地结局庇护值记录恒 0、营地撤退 4 线索永远凑不齐',
  `${P3}/definition.js:31-40,81-86（location({...clues:0})，无 shelter）；${P3}/behavior.js:39,48-60（maxClues:0）；src/engine/eote-shelter.js:18-32；${P3}/chaos.js:19-27`,
  'Part III 与 Part I/II 共用同一份地点印刷数据（含 shelter/clues），setup 只清营地线索而不是清全部线索。')

const cards = []
const add = (card) => cards.push(card)

// ---------------------------------------------------------------------------
// 共享组 08501–08517
// ---------------------------------------------------------------------------
add({
  code: '08501', name: 'Ice and Death', nameZh: '亡命冰原',
  verdict: 'gap', accepted: false,
  clauses: [
    { text: '[skull] easy/standard = -ceil(shelter/2)；hard/expert = -shelter', status: 'missing',
      evidence: `${P1}/chaos.js:50-55、${P2}/chaos.js:45-50、${P3}/chaos.js:27-29（partNChaosTokenValue）；但引擎只读 behavior.resolveChaosToken（src/engine/treachery-tokens.js:348-364、src/engine/tests.js:922,1122），三个章节导出的是 chaosTokenValue，从未被读取`,
      note: '真实引擎路径实测 resolveSpecialToken(skull) 返回 delta:0（probe：Part1 standard）。' },
    { text: '[cultist] -2；检定失败按难度差洗入忒咳哩-哩（困难/专家按差值，不能洗入受 1 恐惧/张）', status: 'approximation',
      evidence: `${P1}/behavior.js:314-329（afterTest 已接线 tests.js:1277）、${P2}/behavior.js:355-380；[cultist] 数值同样只落在 tokenMeanings（{cultist:-2}，非 delta 形状），引擎 tokenOutcome 解析为 unknown→0（src/engine/combat-odds.js:132-143、treachery-tokens.js:352-364）`,
      note: '失败后果已实现；符号数值未接线。' },
    { text: '[tablet] -3/-4；检定失败每低于难度 1 点弃牌库顶 1 张，弃到的弱点抽取', status: 'approximation',
      evidence: `${P1}/behavior.js:330-339、${P2}/behavior.js:591-600；数值同 [cultist] 为 unknown→0`,
      note: '失败后果已实现；数值未接线。' },
    { text: 'Part III 共用同一提示卡（08501c）：[cultist]/[tablet] 失败后果', status: 'missing',
      evidence: `${P3}/behavior.js:149-164（behavior 无 afterTest）、${P3}/chaos.js:10-29（只有数值表）`,
      note: 'Part III 没有任何失败后果实现。' },
  ],
  perceivability: { status: 'partial', evidence: `${P1}/definition.js:186-194 把 tokenMeanings 接入 scenario（仅展示/AI 读取 src/engine/combat-odds.js:155、src/engine/treachery-tokens.js:352），检定结算不生效`, note: '提示卡文本可读，但掷出符号时的实际修正与失败效果与卡面不符。' },
  tests: { status: 'partial', evidence: 'tests/eote-scenario-iceAndDeathPart1.test.mjs:295-307 只直接调用 part1ChaosTokenValue/part1ChaosFailureSpec；未测真实引擎 resolveSpecialToken', note: '第 1/2 章测试完全绕开引擎标记结算。' },
  issues: [
    issue('high', 'runtime', '真实引擎路径下 [skull]/[cultist]/[tablet] 修正均为 0（hook 名应为 resolveChaosToken，不是 chaosTokenValue）',
      `${P1}/behavior.js:368-370,411 / ${P2}/behavior.js:349,402 / ${P3}/behavior.js:145,162；src/engine/treachery-tokens.js:348-364；对照 content/campaigns/edgeOfTheEarth/scenarios/toTheForbiddenPeaks/behavior.js:271（正确 hook 名）`,
      '把 chaosTokenValue 改名为 resolveChaosToken 并返回 { delta } 形状；或把 tokenMeanings 改成 { delta } 形状。'),
    issue('high', 'impl-vs-text', 'Part III 缺失 [cultist]/[tablet] 失败后果（洗入忒咳哩-哩/弃牌库顶+抽弱点）', `${P3}/behavior.js:149-164`, '补 afterTest（复用 Part1/2 的 partNChaosFailureSpec 分支）。'),
    issue('medium', 'primitive', 'flags.shelterToken / flags.tekeliliOnFail 声明无读点（flags-readpoints unread）', `${SHARED}/08501.js:10-17`, '删除或改为引擎统一读点；本条目的实现实际在章节 chaos.js/behavior，属重复事实源。'),
    issue('medium', 'impl-vs-text', 'Part III tokenMeanings 只覆盖静态文本，skull 动态值缺少运行时接线（与 Part I/II 同根因）', `${P3}/definition.js:142-147、${P3}/chaos.js:10-17`, '同 resolveChaosToken 修复。'),
  ],
})

const LOC_BASE = {
  '08502': { name: 'Crash Site', nameZh: '坠机点', entry: 'none', extra: [
    { text: '[action]：检定[intellect]或[agility](3) 在残骸中搜寻；成功在剧本日志记录备用零件（每剧本/每战役最多一次成功）', status: 'implemented',
      evidence: `${SHARED}/08502.js:14-28（abilities action，kind action + api.test 选项对象）；枚举读点 src/engine/parley.js:150-178；真实引擎结算见 tests/eote-scenario-shared.test.mjs:361-372`, note: 'limit 用 perGame；参考实现以「未获得该补给」判定一次性（近似为可再检定但记录幂等）。' },
  ], specIssues: [
    issue('low', 'impl-vs-text', '一次成功上限写成 perGame（每章），卡面/参考实现是「每战役」；因 suppliesRecovered 集合幂等，实际影响仅是重复检定可被再次发起',
      `${SHARED}/08502.js:24,44-56、content/campaigns/edgeOfTheEarth/records.js:166-180`, '改用 perCampaign limit（limits.js 支持）。'),
  ] },
  '08503': { name: 'Frozen Shores', nameZh: '冰冻海岸', entry: 'none', extra: [
    { text: '如果有遭遇卡牌附属到冰冻海岸，冰冻海岸得到 +2 隐藏。庇护 2。', status: 'missing',
      evidence: `${SHARED}/08503.js:7-11（只声明 flags/locationRule.shroudWhenAttached，无 abilities）；flags-readpoints unread；引擎调查加成只读 locationRule.shroudModifier（src/engine/actions.js:588）`, note: '整条规则缺失（已登记 primitive-request p7-shared-08503，属已披露近似）。' },
  ], specIssues: [
    issue('high', 'impl-vs-text', '「有遭遇卡牌附属时 +2 隐藏」未实现（声明 locationRule.shroudWhenAttached 无读点）',
      `${SHARED}/08503.js:7-11；读点 src/engine/actions.js:587-588（只支持 locationRule.shroudModifier）；known-deviations p7-shared-08503`, '改为 locationRule.shroudModifier(st,loc,inv) 返回 2（引擎已有读点），并补真实引擎断言。'),
  ] },
  '08504': { name: 'Treacherous Path', nameZh: '危险道路', entry: 'none', extra: [
    { text: '强制 - 你在危险道路的技能检定期间揭示 [frost] 后：每揭示一个 [frost]，受到 1 点伤害或恐惧。庇护 1。', status: 'implemented',
      evidence: `${SHARED}/08504.js:9-20（forced tokenReveal，可用 location 实体窗口清单 src/engine/ability-rules.js:337-378；tokenReveal 窗口 src/engine/tests.js:919-933）；参考实现 Location/Cards/.../TreacherousPath.hs:18-34`, note: '每个 frost 事件各弹一次「伤害或恐惧」选择，与参考 repeated n 等价。' },
  ], specIssues: [] },
  '08505': { name: 'Precarious Ice Sheet', nameZh: '不稳定冰盖', entry: 'none', extra: [
    { text: '[reaction] 你在不稳定冰盖抽取一张 [[危险]] 诡计时，在混乱袋里加入 1 个 [frost]：取消该卡效果并弃掉（团队每轮一次）。庇护 2。', status: 'approximation',
      evidence: `${SHARED}/08505.js:9-20（reaction encounterDrawn，api.mechanics.frost.add；读点 src/engine/encounter.js:140-148、src/engine/api-mechanics.js:153）；参考实现只对 DrawCard 取消（TreacherousPath/PrecariousIceSheet.hs）`, note: '只覆盖遭遇牌库抽牌（卡面就是「抽到诡计时」）；取消后进弃牌堆行为由引擎 encounter.js:153-165 处理。' },
  ], specIssues: [
    issue('low', 'impl-vs-text', '未处理「同一轮团队限一次」的跨响应者传达之外的边界（limit perRound/group 已声明），且取消对象只限遭遇抽牌', `${SHARED}/08505.js:14,46-47`, '补一条真实引擎 double-trigger 断言。'),
  ] },
  '08506': { name: 'Broad Snowdrifts', nameZh: '辽阔雪地', entry: '1', extra: [
    { text: '[reaction] 成功调查辽阔雪地时，加 1 个 [frost]：额外发现 3 个线索（团队每场游戏一次）。庇护 4。', status: 'implemented',
      evidence: `${SHARED}/08506.js:9-28（reaction investigateSuccess；limit perGame 与参考 BroadSnowdrifts.hs:20-31 的 groupLimit PerGame 一致）` },
    { text: '背面：作为进入本地点的额外费用，所在地点调查员必须共同花费 1[per_investigator] 线索。', status: 'missing',
      evidence: `${P1}/behavior.js:128-166 把费用放在 locationEntered 钩子里（引擎在 reveal 后才调用：src/engine/movement.js:235-249），且返回值不被检查 → 费用从不收取；probe：带着 5 线索进入辽阔雪地后线索仍 5、地点已揭示`, note: '参考实现用 costToEnterUnrevealedL（BroadSnowdrifts.hs:16-18）。' },
  ], specIssues: [
    issue('high', 'runtime', '未探索地点入场费在真实引擎路径永远不收取（引擎先 reveal 再调用 locationEntered，且忽略其返回值）',
      `${P1}/behavior.js:128-166；src/engine/movement.js:235-249；src/engine/locations.js:251-287；参考 Location/Cards/.../BroadSnowdrifts.hs:16-18`, '用 locationRule.entryError 或移动事务的 entry cost 读点收取（按地点 per_investigator 线索）。'),
    issue('medium', 'primitive', 'flags.campCandidate / flags.entryGroupCluesPerInvestigator 无读点（flags-readpoints unread）', `${SHARED}/08506.js:11；${P1}/definition.js:93-96`, '营地候选与入场费改由 definition/引擎单一数据源读取 entry flags，或删除声明。'),
  ] },
  '08507': { name: 'Icy Wastes', nameZh: '冰封荒原', entry: '1', extra: [
    { text: '在冰封荒原的每次技能检定期间，改为将揭示的第一个 [frost] 修正视为 -3。庇护 4。', status: 'approximation',
      evidence: `${SHARED}/08507.js:11-27（forced tokenReveal + api.mechanics.chaosTokens.treat({as:'frost',modifier:-3})；setTokenTreatment 读点 src/engine/chaos-token-effects.js:6-17、tests.js:1069-1074）`, note: '参考实现只在「本检定尚无 frost」时改第一枚（IcyWastes.hs:21-31），条目用 tokenResults 近似判定。' },
    { text: '背面：进入额外费用 1/调查员线索', status: 'missing', evidence: `同 08506：${P1}/behavior.js:135-166 在真实路径不可达`, note: '' },
  ], specIssues: [
    issue('medium', 'primitive', 'flags.firstFrostModifier 无读点；第一枚 frost 判定读 state.skillTest.tokenResults 近似', `${SHARED}/08507.js:13,27,45,51-58`, '改读引擎 resolveChaosToken/地点规则读点，或在 tokenReveal 上下文里确认「本检定已揭示 frost 数」。'),
    issue('high', 'runtime', '入场费同 08506（真实路径不收取）', `${P1}/behavior.js:128-166；src/engine/movement.js:235-249`, '同 08506。'),
  ] },
  '08508': { name: 'Rocky Crags', nameZh: '岩石峭壁', entry: '1', extra: [
    { text: '强制 - 在一张诡计附属到岩石峭壁时：该诡计获得涌动（每阶段一次）。庇护 3。', status: 'missing',
      evidence: `${SHARED}/08508.js:7-10（只有 flags.surgeOnAttachedTreachery，无 abilities）；flags-readpoints unread；参考 RockyCrags.hs:19-31`, note: '已登记 primitive-request p7-shared-08508（已披露近似）。' },
    { text: '背面：进入额外费用 1/调查员线索', status: 'missing', evidence: `同 08506：${P1}/behavior.js:128-166（费用判定在 reveal 之后的 locationEntered 内，返回值被 src/engine/movement.js:249 忽略）`, note: '' },
  ], specIssues: [
    issue('medium', 'impl-vs-text', '「诡计附属到本地时获得涌动（每阶段一次）」未实现（声明未接线）', `${SHARED}/08508.js:7-10；known-deviations p7-shared-08508`, '补地点附属事件窗口/涌动读点。'),
    issue('high', 'runtime', '入场费同 08506（真实路径不收取）', `${P1}/behavior.js:128-166`, '同 08506。'),
  ] },
  '08509': { name: 'Snow Graves', nameZh: '雪冢', entry: '2', extra: [
    { text: '[reaction] 你发现雪冢最后一个线索后，将忒咳哩-哩牌库顶 3 张洗入牌库，记录绿皂石（团队每场战役一次）。庇护 5。', status: 'implemented',
      evidence: `${SHARED}/08509.js:10-28（reaction clueDiscovered，limit perCampaign 与参考 SnowGraves.hs:22-33 一致；clueDiscovered 读点 src/engine/locations.js:436-440）` },
    { text: '背面：进入额外费用 2/调查员线索', status: 'missing', evidence: `同 08506：${P1}/behavior.js:128-166（费用判定在 reveal 之后的 locationEntered 内，返回值被 src/engine/movement.js:249 忽略）`, note: '' },
  ], specIssues: [
    issue('high', 'runtime', '入场费同 08506（真实路径不收取）', `${P1}/behavior.js:128-166`, '同 08506。'),
  ] },
  '08510': { name: 'Icebreaker Landing', nameZh: '破冰船登陆点', entry: '2', extra: [
    { text: '[action]：谈判。检定[intellect](4) 搜索被困船只；成功移除 1 个 [frost] 或记录小型收音机（每战役最多一次成功）。庇护 5。', status: 'implemented',
      evidence: `${SHARED}/08510.js:10-30（action/parley，api.choice + frost.pay；parleyMovesFor 枚举读点 src/engine/parley.js:150-178）` },
    { text: '背面：进入额外费用 2/调查员线索', status: 'missing', evidence: `同 08506：${P1}/behavior.js:128-166（费用判定在 reveal 之后的 locationEntered 内，返回值被 src/engine/movement.js:249 忽略）`, note: '' },
  ], specIssues: [issue('high', 'runtime', '入场费同 08506（真实路径不收取）', `${P1}/behavior.js:128-166`, '同 08506。')] },
  '08511': { name: 'Frigid Cave', nameZh: '严寒洞穴', entry: '2', extra: [
    { text: '[action] 加 1 个 [frost]：记录矿物标本（团队每剧本一次）。庇护 6。', status: 'implemented',
      evidence: `${SHARED}/08511.js:10-25（action，frost.add + recordSets.add；limit perGame）` },
    { text: '背面：进入额外费用 2/调查员线索', status: 'missing', evidence: `同 08506：${P1}/behavior.js:128-166（费用判定在 reveal 之后的 locationEntered 内，返回值被 src/engine/movement.js:249 忽略）`, note: '' },
  ], specIssues: [issue('high', 'runtime', '入场费同 08506（真实路径不收取）', `${P1}/behavior.js:128-166`, '同 08506。')] },
  '08512': { name: 'Barrier Camp', nameZh: '屏障营地', entry: '4', extra: [
    { text: '[action]：谈判。检定[willpower](4) 说服其他探索者；成功记录炸药（每战役最多一次）。庇护 7。', status: 'implemented',
      evidence: `${SHARED}/08512.js:10-21（action/parley）` },
    { text: '背面：进入额外费用 4/调查员线索', status: 'missing', evidence: `同 08506：${P1}/behavior.js:128-166（费用判定在 reveal 之后的 locationEntered 内，返回值被 src/engine/movement.js:249 忽略）`, note: '' },
  ], specIssues: [issue('high', 'runtime', '入场费同 08506（真实路径不收取）', `${P1}/behavior.js:128-166`, '同 08506。')] },
  '08513': { name: "Remnants of Lake's Camp", nameZh: '莱克营地遗址', entry: '4', extra: [
    { text: '[action]：检定[combat](4) 挖掘；成功记录木制雪橇（每战役最多一次）。庇护 7。', status: 'implemented',
      evidence: `${SHARED}/08513.js:10-21（action）` },
    { text: '背面：进入额外费用 4/调查员线索', status: 'missing', evidence: `同 08506：${P1}/behavior.js:128-166（费用判定在 reveal 之后的 locationEntered 内，返回值被 src/engine/movement.js:249 忽略）`, note: '' },
  ], specIssues: [issue('high', 'runtime', '入场费同 08506（真实路径不收取）', `${P1}/behavior.js:128-166`, '同 08506。')] },
  '08514': { name: 'Crystalline Cavern', nameZh: '水晶洞穴', entry: '4', extra: [
    { text: '[action]：检定[agility](5) 爬上水晶墙；成功记录瘴气水晶（每战役最多一次）。庇护 8。', status: 'implemented',
      evidence: `${SHARED}/08514.js:10-21（action）` },
    { text: '背面：进入额外费用 4/调查员线索', status: 'missing', evidence: `同 08506：${P1}/behavior.js:128-166（费用判定在 reveal 之后的 locationEntered 内，返回值被 src/engine/movement.js:249 忽略）`, note: '' },
  ], specIssues: [issue('high', 'runtime', '入场费同 08506（真实路径不收取）', `${P1}/behavior.js:128-166`, '同 08506。')] },
}
for (const [code, data] of Object.entries(LOC_BASE)) {
  add({
    code, name: data.name, nameZh: data.nameZh,
    verdict: 'gap', accepted: false,
    clauses: [
      { text: '印刷数值（shroud / clues / shelter）', status: 'missing', evidence: ISSUE_SHROUD.evidence, note: 'shroud 未进入章节地点数据；shelter/clues 在 Part I/II 正常、Part III 缺失（见 scenarios.iceAndDeathPart3）。' },
      ...data.extra,
    ],
    perceivability: { status: data.extra[0]?.status === 'implemented' ? 'perceivable' : 'partial',
      evidence: data.extra[0]?.status === 'implemented' ? '地点行动/强制经 parleyMovesFor / 实体窗口进入可感知行动列表（src/engine/parley.js:122-178、src/engine/ability-rules.js:337-378）' : '当前规则缺失或不可达，玩家无法从界面感知',
      note: '' },
    tests: { status: code === '08502' ? 'partial' : 'uncovered', evidence: code === '08502' ? 'tests/eote-scenario-shared.test.mjs:361-372（真实 runtime 结算搜索行动）' : '章节测试只断言数据表（如 tests/eote-scenario-iceAndDeathPart1.test.mjs:194-211），无引擎行为断言', note: '' },
    issues: [ISSUE_SHROUD, ...data.specIssues],
    notes: 'Part III 使用同一卡面时 shelter/clues 全缺（见 scenarios.iceAndDeathPart3 的 high）；本卡为三章复用（08502–08514 的印刷地点）。',
  })
}

add({
  code: '08515', name: 'Skittering Nonsense', nameZh: '疾行谬物',
  verdict: 'gap', accepted: false,
  clauses: [
    { text: 'Hunter.', status: 'implemented', evidence: `${P1}/definition.js:150-157 encounterDefinitions 从印刷文本提取 hunter/massive（content/campaigns/edgeOfTheEarth/card-data.js:53-80）` },
    { text: '强制 - 在你击败疾行谬物时：将忒咳哩-哩牌库顶 1 张洗入你的牌库；不能则它攻击你。', status: 'approximation',
      evidence: `条目 ${SHARED}/08515.js:6-23（forced enemyDefeated，近似按印刷攻击值扣 1 伤害/1 恐惧）＋章节 ${P1}/behavior.js:301-313（scenarioBehavior.enemyDefeated 钩子，引擎 enemyDefeated 读点 src/engine/enemies.js:708）→ 两者同时结算（双发，probe 实测 tekeli 16→14、玩家牌库 +2）`, note: '真实攻击管线近似已在 primitive-request p7-shared-08515 披露；重复结算是实现缺陷。' },
  ],
  perceivability: { status: 'perceivable', evidence: '双发并无提示差异；攻击近似在 note/primitive-request 中披露', note: '' },
  tests: { status: 'partial', evidence: 'tests/eote-scenario-iceAndDeathPart1.test.mjs 仅在 setup 牌堆断言包含 08515；无击败结算测试', note: '' },
  issues: [
    issue('high', 'duplication', '击败 08515 时强制效果结算两次（章节 behavior.enemyDefeated + 单卡 forced ability）',
      `${SHARED}/08515.js:6-23 与 ${P1}/behavior.js:301-313 同时生效；引擎读点 src/engine/enemies.js:701-708、src/engine/abilities 实体窗口（src/engine/ability-exec.js:251-286）`,
      '只保留一处（推荐单卡 abilities；删除 Part1 behavior.enemyDefeated 的 08515 分支），并补引擎级「击败一次只洗入 1 张」断言。'),
    issue('low', 'impl-vs-text', '「不能洗入则它攻击你」以固定 1 伤害/1 恐惧近似（已披露）', `${SHARED}/08515.js:14-21,23`, '待 primitives 支持被击败瞬间快照攻击后替换。'),
  ],
})

add({
  code: '08516', name: 'Apeirophobia', nameZh: '无限恐惧症',
  verdict: 'approximation', accepted: false,
  clauses: [
    { text: '显现 - 检定[willpower](X)，X 为你所在地点的庇护值。', status: 'implemented',
      evidence: `${SHARED}/08516.js:5-60（encounterResolve 读 state.locations[].shelter；引擎读点 src/engine/treachery-tokens.js:113-122）`, note: 'Part I/II 地点实例有 shelter；Part III 地点无 shelter → 难度 0（见 scenario）。' },
    { text: '失败选择：每低于难度 1 点 1 恐惧 / 放 2 线索到所在地点 / 加 1 [frost]。', status: 'approximation',
      evidence: `${SHARED}/08516.js:37-58（api.choice 三选一）；参考 Apeirophobia.hs:28-36（线索选项要求 canPlaceClues、frost 选项要求袋中仍有寒霜）`, note: '缺少「线索不足/frost 池满时不提供该选项」的前置过滤。' },
  ],
  perceivability: { status: 'perceivable', evidence: 'api.choice + prompt（api-misc.js:666 test 选项对象；runtime 选项）' },
  tests: { status: 'covered', evidence: 'tests/eote-scenario-shared.test.mjs:361-383（真实 runtime 结算，失败差值 4 恐惧）' },
  issues: [
    issue('low', 'impl-vs-text', '失败选项未过滤不可支付项（无线索时可仍选「放 2 线索」；frost 池满时仍提供 frost 选项）', `${SHARED}/08516.js:44-57`, '按参考 canPlaceClues/hasRemainingFrostTokens 过滤选项。'),
    issue('medium', 'runtime', 'Part III 复用本卡时难度恒 0（地点 shelter 缺失）', '见 scenarios.iceAndDeathPart3；src/engine/eote-shelter.js:18-32', '补 Part III 地点 shelter。'),
  ],
})

add({
  code: '08517', name: 'Zero Visibility', nameZh: '零能见度',
  verdict: 'approximation', accepted: false,
  clauses: [
    { text: '显现 - 将零能见度放置入场，放到你的威胁区域。', status: 'implemented',
      evidence: `${SHARED}/08517.js:8-15（encounterResolve api.threat；引擎读点 src/engine/treachery-tokens.js:113-122）` },
    { text: '作为离开「有诡计附属的地点」的额外费用，你必须花费 1 个行动。', status: 'missing',
      evidence: `${SHARED}/08517.js:10,29（flags.moveSurchargeFromTreacheryLocation，无读点；已登记 primitive-request p7-shared-08517）`, note: '参考实现 ZeroVisibility.hs:17-22 用 AdditionalCostToEnterMatching（离开 = 进入别处 +1 动作）。' },
    { text: '强制 - 你的回合结束时：检定[agility](2)，成功弃掉零能见度。', status: 'implemented',
      evidence: `${SHARED}/08517.js:16-27（forced turnEnded；window 读点 src/engine/windows.js:57、src/engine/turn-flow.js:396；api.removeThreat src/engine/api-clue.js:58）` },
  ],
  perceivability: { status: 'partial', evidence: '威胁区放置与回合结束检定可感知；离开地点+1 行动缺失，无法感知', note: '' },
  tests: { status: 'partial', evidence: 'tests/eote-scenario-iceAndDeathPart1.test.mjs 只有名称命中（见 tests-coverage: file-only）；无回合结束检定断言', note: '' },
  issues: [
    issue('medium', 'impl-vs-text', '「离开有诡计附属的地点 +1 行动」未实现（声明未接线，已披露）', `${SHARED}/08517.js:10,29；known-deviations p7-shared-08517`, '改由 treacheryRule.threat.extraActionCost 或移动附加费读点实现。'),
  ],
})

// ---------------------------------------------------------------------------
// Part I 08518–08522
// ---------------------------------------------------------------------------
add({
  code: '08518', name: 'Cold Welcome', nameZh: '冷遇',
  verdict: 'gap', accepted: false,
  clauses: [
    { text: '强制 - 调查员第一次进入一个地点后：将放在一边的地点中所有与该地点相连的地点放置入场。', status: 'implemented',
      evidence: `正面由 ${P1}/behavior.js:128-134 的 locationEntered → placeConnectedSetAsideLocations（59-76）实现；引擎 locationEntered 读点 src/engine/movement.js:249；probe 实测进入冰冻海岸后辽阔雪地入场`, note: '与参考 ColdWelcome.hs:21-37 等价（印刷连接表一致）。' },
    { text: '背面：在队长所在地点生成 1 个疾行谬物；其余疾行谬物 + 冰中生物组洗入遭遇牌库。', status: 'missing',
      evidence: `${P1}/behavior.js:184-195（resolveColdWelcomeBack 已实现但无人调用：引擎 agenda back 只走 agendaReveal，src/engine/phases.js:268-283；${P1}/behavior.js:399 的 agendaReveal 是空函数）`, note: 'probe：advanceAgenda 后 agendaIndex 0→1，但敌人/遭遇牌库/放一边数量都不变。' },
  ],
  perceivability: { status: 'partial', evidence: '正面强制有 api.info 日志（behavior.js:73）；背面效果永不发生，玩家看不到', note: '' },
  tests: { status: 'partial', evidence: 'tests/eote-scenario-iceAndDeathPart1.test.mjs:235-249 直接调用 behavior.resolveAgendaBack，未走引擎议程推进', note: '' },
  issues: [
    issue('high', 'runtime', '议程背面效果在真实引擎路径永不结算（Part1 behavior.agendaReveal 是空函数；resolveAgendaBack 无引擎读点）',
      `${P1}/behavior.js:373-380,399；引擎 src/engine/phases.js:268-283；probe：advanceAgenda(doom) 后 0 副作用`,
      '实现 behavior.agendaReveal(state, agenda, api) 按 agenda.originalCode/agendaRule.chapterFlow 分派到 resolveColdWelcomeBack，并补引擎推进断言。'),
    issue('medium', 'primitive', 'agendaRule.locationEntered/onAdvance 与 flags.* 声明无读点（真正读点是 definition 的 chapterFlow 与 behavior 内的卡号 switch）', `${E1}/08518.js:11-17；${P1}/definition.js:175-179,200-209`, '把声明与 behavior 的单一事实源合并（behavior 读 agendaRule.chapterFlow）。'),
  ],
})

add({
  code: '08519', name: 'Into the White', nameZh: '深入白雪',
  verdict: 'gap', accepted: false,
  clauses: [
    { text: '强制 - 第一次进入地点后放出相连的放一边地点（与议程 1 同一条）。', status: 'implemented', evidence: `同 08518：${P1}/behavior.js:128-134,369-370` },
    { text: '背面：将放在一边的星之恐怖生成在已揭示且庇护值最高的地点。', status: 'missing',
      evidence: `${P1}/behavior.js:197-203（resolveIntoTheWhiteBack）从未被引擎调用（同 08518 根因）；probe 实测不生成`, note: '参考 IntoTheWhite.hs:25-35 在并列最高时由队长选择，mod 直接取第一个最高（参见 medium）。' },
  ],
  perceivability: { status: 'partial', evidence: '背面永不发生', note: '' },
  tests: { status: 'partial', evidence: 'tests/eote-scenario-iceAndDeathPart1.test.mjs:235-249 只直接调用 resolveAgendaBack', note: '' },
  issues: [
    issue('high', 'runtime', '议程背面在真实引擎路径永不结算（同 08518）', `${P1}/behavior.js:197-203,399；src/engine/phases.js:268-283`, '同 08518。'),
    issue('low', 'impl-vs-text', '并列最高庇护值时参考实现让队长选择，mod 自动取第一个', `${P1}/behavior.js:197-203`, '补 api.choice。'),
  ],
})

add({
  code: '08520', name: 'Running Out of Time', nameZh: '没时间了',
  verdict: 'gap', accepted: false,
  clauses: [
    { text: '强制 - 第一次进入地点后放出相连的放一边地点（与议程 1 同一条）。', status: 'implemented', evidence: `同 08518：${P1}/behavior.js:128-134,369` },
    { text: '背面：每位调查员（包括已退场的）将忒咳哩-哩牌库顶 1 张洗入牌库；选择场上一个没有线索的地点，全体未被击败调查员移动并撤退（庇护值越高越好），然后结算幕 1a 目标。', status: 'missing',
      evidence: `${P1}/behavior.js:205-218（resolveRunningOutOfTimeBack）未被引擎调用；probe 实测不撤退不结算`, note: '实现里只遍历 activeInvestigators（漏掉已退场者，参见 medium）。' },
  ],
  perceivability: { status: 'partial', evidence: '背面永不发生 → 游戏不会因议程 III 结束', note: '' },
  tests: { status: 'partial', evidence: 'tests/eote-scenario-iceAndDeathPart1.test.mjs 无该函数测试（只断言 agendaRule 数据）', note: '' },
  issues: [
    issue('high', 'runtime', '议程 III 背面在真实引擎路径永不结算（同 08518）：本应由它强制结束 Part I 并结算 R1', `${P1}/behavior.js:205-218,399；src/engine/phases.js:268-283`, '补 agendaReveal 分派。'),
    issue('medium', 'impl-vs-text', '「每位调查员（包括已退场的）」只处理未被击败/未撤退者；目标地点选择未给玩家选择', `${P1}/behavior.js:206-214`, '按参考循环所有调查员（含 defeated），目标地点用 api.choice。'),
  ],
})

add({
  code: '08521', name: 'Search for a Camp Site', nameZh: '寻找扎营点',
  verdict: 'gap', accepted: false,
  clauses: [
    { text: '[action] 如果所有调查员都在同一地点，且该地点没有线索：撤退。所有调查员扎营。', status: 'missing',
      evidence: `${P1}/behavior.js:249-279 实现了 scenarioActions/performScenarioAction，但引擎读 behavior.actions/performAction（src/engine/moves.js:222、src/engine/dispatch.js:633）；probe：Part1 合法行动列表无 scenarioAction`, note: '营地撤退是本章唯一正常结局路径。' },
    { text: '目标 - 所有未被击败的调查员都撤退后推进（撤退地点庇护值越高越好，然后 →R1）。', status: 'missing',
      evidence: `${P1}/behavior.js:236-247 checkObjectives 已实现（引擎每次行动后调用 src/engine/act-agenda.js:183），但没有任何可达的撤退行动；且 act 背面 reveal 缺失：advanceAct 会抛「场景规则尚未迁移：08521」（probe 实测）`, note: '引擎 advanceAct 读点 src/engine/reveal.js:151-176。' },
  ],
  perceivability: { status: 'not-perceivable', evidence: '合法行动列表无撤退按钮（probe）', note: '' },
  tests: { status: 'partial', evidence: 'tests/eote-scenario-iceAndDeathPart1.test.mjs:251-265 直接调用 behavior.scenarioActions/performScenarioAction/checkObjectives，未断言引擎 legalMoves/applyMove', note: '' },
  issues: [
    ISSUE_HOOK_ACTIONS,
    issue('high', 'runtime', '幕 1a 背面在真实引擎路径缺失：behavior 无 actReveal，advanceAct 抛 "场景规则尚未迁移：08521"', `${P1}/behavior.js:382-412（无 actReveal）；src/engine/reveal.js:151-176；probe`, '补 actReveal（→ R1）并让 checkObjectives 用 api.finish 之外的一致路径。'),
    issue('high', 'runtime', '营地记录键与检查点读取口径不一致：Part1 只写 records.camp（自定义键）与 iceAndDeathPart1CampShelter，检查点读 Camp_* 记录/eoteShelterValue → 检查点庇护值=0、失踪伙伴=9',
      `${P1}/behavior.js:344,353,361；content/campaigns/edgeOfTheEarth/checkpoints.js:197-205；content/campaigns/edgeOfTheEarth/records.js:186-214,258-262；probe 实测 eoteShelterValue=0、eoteMissingCount=9`,
      '按参考写 Camp_* 记录（camps map），或让检查点读取 records.camp/iceAndDeathPart1CampShelter；二者择一并补检查点测试。'),
  ],
})

add({
  code: '08522', name: 'Terror of the Stars', nameZh: '星之恐怖',
  verdict: 'gap', accepted: false,
  clauses: [
    { text: 'Hunter. Massive.', status: 'implemented', evidence: `${P1}/definition.js:150-157 encounterDefinitions（content/.../card-data.js:53-80 从文本提取）；probe 星之恐怖 hunter/massive=true` },
    { text: '星之恐怖得到 +3[per_investigator] 生命值。', status: 'implemented',
      evidence: `${P1}/behavior.js:294-299 enemyStatModifier('health') → 引擎 rules-state.js:9-13；probe 实测 2 人局 enemyHealth=9（3+3×2）` },
    { text: '星之恐怖处于重整状态时，调查员不能在星之恐怖所在地点撤退，或发现其所在地点的线索。', status: 'approximation',
      evidence: `发现线索：${P1}/behavior.js:281-292 → 引擎 src/engine/locations.js:361,374 已接线（probe 断言通过）；撤退封锁只在 ${P1}/behavior.js:249-263,490-492 的 scenarioActions 内判定，而该函数未接线`,
      note: '发现线索子句真实生效；撤退子句因撤退行动本身不可达而无从验证。' },
  ],
  perceivability: { status: 'perceivable', evidence: '调查行动会显示"星之恐怖处于重整状态…"（investigationError，src/engine/moves.js:856）', note: '' },
  tests: { status: 'partial', evidence: 'tests/eote-scenario-iceAndDeathPart1.test.mjs:267-276 直接调用 enemyStatModifier/canDiscoverClues', note: '' },
  issues: [
    issue('medium', 'runtime', '「不能在其所在地点撤退」子句挂在未接线的 scenarioActions 上（与 ISSUE_HOOK_ACTIONS 同根因）', `${P1}/behavior.js:249-263（blocked 判定 254-259）`, '随 08521 的 actions 接线一并生效。'),
    issue('low', 'primitive', 'enemyScript.whileReady.blocksCluesAtLocation/blocksResignAtLocation 与 enemyScript.healthPerInvestigator 声明无读点（真正读点在 behavior 与卡表文本）', `${E1}/08522.js:13-19；${P1}/behavior.js:281-299；flags-readpoints 未标 unread 属扫描漏报`, '把声明合并进引擎读点（如 enemyRule.whileReady）或删除重复声明。'),
  ],
})

// ---------------------------------------------------------------------------
// Part II 08523–08534
// ---------------------------------------------------------------------------
add({
  code: '08523', name: 'A Harsh Wind Blows', nameZh: '狂风呼啸',
  verdict: 'gap', accepted: false,
  clauses: [
    { text: '背面：选择一张压在某个地点底下正面朝下的遭遇卡，查看其正面后放回。', status: 'approximation',
      evidence: `${P2}/behavior.js:117-131（agendaAdvance 已实现：自动取第一个有底牌地点、只看 beneath[0]、api.cardReveal 公开提示）；但引擎从不调用 agendaAdvance（读点应为 behavior.agendaReveal，src/engine/phases.js:268-283）；probe：advanceAgenda 抛「密谋规则尚未迁移：08523」`,
      note: '选择/私密查看语义也与参考 AHarshWindBlows.hs:20-29 有差距。' },
  ],
  perceivability: { status: 'not-perceivable', evidence: '议程推进直接抛错，无界面感知', note: '' },
  tests: { status: 'partial', evidence: 'tests/eote-scenario-iceAndDeathPart2.test.mjs:242-256 直接调用 behavior.agendaAdvance', note: '' },
  issues: [
    issue('high', 'runtime', 'Part II behavior 无 agendaReveal：真实引擎议程推进抛 "密谋规则尚未迁移：08523"（probe 实测），关卡议程流程中断',
      `${P2}/behavior.js:382-405（无 agendaReveal）；src/engine/phases.js:268-283；probe`, '实现 behavior.agendaReveal 并分派 08523/08524/08525；补真实 advanceAgenda 测试。'),
    issue('medium', 'impl-vs-text', '查看底牌应为「选择地点 + 私密查看」，实现是自动取第一个 + api.cardReveal 公开', `${P2}/behavior.js:117-131`, '改 api.choice 选地点，使用私密 focus/peek 原语。'),
  ],
})

add({
  code: '08524', name: 'The Chill of Night', nameZh: '寒冷夜晚',
  verdict: 'gap', accepted: false,
  clauses: [
    { text: '背面：选择一张压在某个地点底下正面朝下的遭遇卡，查看其正面后放回。', status: 'approximation',
      evidence: `同 08523：${P2}/behavior.js:117-131,382-405`, note: '同 08523 的语义差距。' },
  ],
  perceivability: { status: 'not-perceivable', evidence: '议程推进抛错', note: '' },
  tests: { status: 'partial', evidence: 'tests/eote-scenario-iceAndDeathPart2.test.mjs:242-256', note: '' },
  issues: [
    issue('high', 'runtime', 'Part II 无 agendaReveal，08524 推进同样抛错（同 08523 根因）', `${P2}/behavior.js:382-405；src/engine/phases.js:268-283`, '同 08523。'),
    issue('medium', 'impl-vs-text', '查看底牌的选择/私密语义近似', `${P2}/behavior.js:117-131`, '同 08523。'),
  ],
})

add({
  code: '08525', name: 'Madness and Death', nameZh: '疯狂与死亡',
  verdict: 'gap', accepted: false,
  clauses: [
    { text: '背面：剩下的每位调查员被击败并承受 1 点精神创伤。(→R1)', status: 'missing',
      evidence: `${P2}/behavior.js:132-147（agendaAdvance 内已实现 defeated+trauma+resolution1，但引擎不调用 agendaAdvance）；probe 无副作用`, note: '参考 MadnessAndDeath.hs:15-20 会 push R1。' },
  ],
  perceivability: { status: 'not-perceivable', evidence: '永不触发', note: '' },
  tests: { status: 'partial', evidence: 'tests/eote-scenario-iceAndDeathPart2.test.mjs:250-255 直接调用 agendaAdvance', note: '' },
  issues: [
    issue('high', 'runtime', '议程 VI 背面效果在真实引擎路径永不结算（同 08523 根因）', `${P2}/behavior.js:132-147,382-405；src/engine/phases.js:268-283`, '补 agendaReveal 分派。'),
    issue('medium', 'impl-vs-text', '精神创伤写入用 campaign.investigators[].trauma 或 records.mentalTrauma_* 两套兜底，未走引擎统一 trauma 入口', `${P2}/behavior.js:132-147`, '改用 api.campaignTrauma/记录原语。'),
  ],
})

add({
  code: '08526', name: 'The Lost Expedition', nameZh: '失踪队员',
  verdict: 'gap', accepted: false,
  clauses: [
    { text: '[fast] 你所在地点的调查员共同花费 1[per_investigator] 线索：抽取你所在地点底下的遭遇卡。', status: 'missing',
      evidence: `${P2}/behavior.js:254-320 实现了 scenarioActions/performScenarioAction，但引擎读 behavior.actions/performAction（src/engine/moves.js:222、src/engine/dispatch.js:633）；probe：Part2 合法行动列表无该行动` },
    { text: '[action] 如果你位于营地：撤退。', status: 'missing', evidence: `同上：${P2}/behavior.js:254-268,305-320 未接线` },
    { text: '目标 - 找到尽可能多的失踪队员（加入胜利区），黎明前回到营地；所有未被击败的调查员撤退后推进。', status: 'missing',
      evidence: `${P2}/behavior.js:236-252 checkObjectives 已实现且被引擎调用（src/engine/act-agenda.js:183），但因没有撤退行动永远不满足` },
  ],
  perceivability: { status: 'not-perceivable', evidence: '合法行动列表无抽取/撤退行动（probe）', note: '直接导致 08527–08534 剧情卡、08535–08543 被附身队员在真实路径不可达。' },
  tests: { status: 'partial', evidence: 'tests/eote-scenario-iceAndDeathPart2.test.mjs:258-286 直接调用 behavior.scenarioActions/performScenarioAction', note: '' },
  issues: [
    ISSUE_HOOK_ACTIONS,
    issue('high', 'runtime', '幕背面推进在真实路径缺失：behavior 无 actReveal，advanceAct 抛 "场景规则尚未迁移：08526"（probe）', `${P2}/behavior.js:382-405；src/engine/reveal.js:151-176`, '补 actReveal → R1。'),
    issue('high', 'runtime', '地点底下的 9 张卡（8 剧情 + 1 Mia 敌人）在真实路径永不可翻出 → 08527–08534 / 08535–08543 全部不可用；所有未被击败调查员撤退目标也无法达成', `${P2}/behavior.js:254-320；probe 合法行动列表`, '修 hook 名后补真实引擎端到端测试（撤营 + 翻底牌 + 剧情结算）。'),
  ],
})

const STORY = {
  '08527': { name: 'Dead End', nameZh: '死路', effect: 'removeFrost', status: 'implemented', evidence: `flags.storyEffect 声明 ${E2}/08527.js:8-13；执行 ${P2}/behavior.js:149-220（case removeFrost，api.removeChaosToken('frost')）` },
  '08528': { name: 'Cracks in the Ice', nameZh: '冰上裂缝', effect: 'tekeliliToBottom', status: 'implemented', evidence: `flags ${E2}/08528.js:8-13；${P2}/behavior.js:149-220（tekeliReturn destination bottom）` },
  '08529': { name: 'Somber Remains', nameZh: '忧心弃物', effect: 'tekeliliTopNineToBottom', status: 'implemented', evidence: `flags ${E2}/08529.js:8-13；${P2}/behavior.js:149-220` },
  '08530': { name: 'Disappearing Footprints', nameZh: '消失的足迹', effect: 'removeFrost', status: 'implemented', evidence: `flags ${E2}/08530.js:8-13；${P2}/behavior.js:149-220` },
  '08531': { name: 'Dissected Explorer', nameZh: '被剖开的探险家', effect: 'tekeliliToBottom', status: 'implemented', evidence: `flags ${E2}/08531.js:8-13；${P2}/behavior.js:149-220` },
  '08532': { name: 'Evil Within', nameZh: '深层邪恶', effect: 'discardNonEliteEidolon', status: 'approximation', evidence: `flags ${E2}/08532.js:8-13；${P2}/behavior.js:149-220（自动取 candidates[0]，未让玩家选择）` },
  '08533': { name: 'Bloody Evidence', nameZh: '血腥证据', effect: 'tekeliliTopNineToBottom', status: 'implemented', evidence: `flags ${E2}/08533.js:8-13；${P2}/behavior.js:149-220` },
  '08534': { name: 'Madness Inside', nameZh: '心中的疯狂', effect: 'possessedDoomToClues', status: 'approximation', evidence: `flags ${E2}/08534.js:8-13；${P2}/behavior.js:149-220（自动取 candidates[0]，未让玩家选择）` },
}
for (const [code, s] of Object.entries(STORY)) {
  add({
    code, name: s.name, nameZh: s.nameZh,
    verdict: 'approximation', accepted: false,
    clauses: [
      { text: '剧情卡正面效果（从地点底下翻出时结算）', status: s.status, evidence: s.evidence,
        note: s.status === 'implemented' ? '' : '存在多个可弃目标时应由玩家选择，实现自动取第一个。' },
      { text: '将本剧情卡加入胜利区', status: 'implemented', evidence: `${P2}/behavior.js:149-220 收尾写入 state.victoryDisplay（storyAddToVictory 声明于条目 flags）` },
    ],
    perceivability: { status: 'not-perceivable', evidence: '剧情卡在真实引擎路径不可达（08526 的 actions/performAction 未接线），玩家永远翻不到这些牌', note: '' },
    tests: { status: 'partial', evidence: 'tests/eote-scenario-iceAndDeathPart2.test.mjs:288-304 直接调用 behavior.resolveStory', note: '' },
    issues: [
      issue('medium', 'runtime', '剧情卡在真实引擎路径不可达（08526 high 的下游）', `${P2}/behavior.js:254-320；${P2}/behavior.js:149-220`, '随 08526 修复后补端到端断言。'),
      ...(s.status === 'approximation' ? [issue('low', 'impl-vs-text', '多目标时应由玩家选择，当前自动取第一个', `${P2}/behavior.js:149-220`, '改用 api.choice。')] : []),
    ],
  })
}

// ---------------------------------------------------------------------------
// Part II 08535–08543 被附身队员
// ---------------------------------------------------------------------------
const POSS = {
  '08535': { name: 'Professor William Dyer', nameZh: '威廉·戴尔教授', partner: '08714', skill: 'discardForResources', threshold: 3, extra: issue('medium', 'impl-vs-text', '「选择并弃掉最多 2 张手牌」只让玩家选张数，实际自动弃手牌数组前几张（丢弃哪张不可选）', `${E2}/08535.js:70-90`, '用 api.choice 枚举手牌逐张选择。') },
  '08536': { name: 'Danforth', nameZh: '丹佛斯', partner: '08715', skill: 'drawTekeliliForResources', threshold: 3, extra: issue('high', 'impl-vs-text', '「抽取忒咳哩-哩牌库顶最多 2 张」实现成 api.drawCards（抽玩家牌库），抽的是玩家自己的牌库而不是忒咳哩-哩牌库', `${E2}/08536.js:92-102（api.drawCards）；对照 src/engine/scenario-runtime.js:1396 与 eote-tekeli 原语 src/engine/eote-tekeli.js:113-119`, '改用 api.mechanics.tekeli / tekeliDraw 原语并补测试。') },
  '08537': { name: 'Eliyah Ashevak', nameZh: '伊里亚·阿什瓦克', partner: '08716', skill: 'test agility 2 perOverSuccess', threshold: 2, extra: null },
  '08538': { name: 'Dr. Mala Sinha', nameZh: '玛拉·辛哈医生', partner: '08717', skill: 'test willpower 2 perOverSuccess', threshold: 2, extra: null },
  '08539': { name: 'Avery Claypool', nameZh: '艾弗里·克莱普尔', partner: '08718', skill: 'test willpower 5 flat', threshold: 1, extra: issue('medium', 'impl-vs-text', '卡面允许 [willpower] 或 [intellect](5) 二选一，实现只提供 willpower', `${E2}/08539.js:36-43`, '用 api.choice 让玩家选技能。') },
  '08540': { name: 'James "Cookie" Fredericks', nameZh: '詹姆斯·“曲奇”·弗雷德里克斯', partner: '08719', skill: 'test combat 2 perOverSuccess + retaliate', threshold: 2, extra: null },
  '08541': { name: 'Dr. Amy Kensler', nameZh: '艾米·肯斯勒博士', partner: '08720', skill: 'test intellect 2 perOverSuccess', threshold: 2, extra: null },
  '08542': { name: 'Roald Ellsworth', nameZh: '罗尔德·埃尔斯沃思', partner: '08721', skill: 'test combat 5 flat', threshold: 1, extra: issue('medium', 'impl-vs-text', '卡面允许 [combat] 或 [agility](5) 二选一，实现只提供 combat', `${E2}/08542.js:36-43`, '用 api.choice 让玩家选技能。') },
  '08543': { name: 'Takada Hiroko', nameZh: '高田弘子', partner: '08722', skill: 'spendResources max3', threshold: 5, extra: null },
}
for (const [code, s] of Object.entries(POSS)) {
  add({
    code, name: s.name, nameZh: s.nameZh,
    verdict: code === '08536' ? 'gap' : ['08539', '08542', '08535'].includes(code) ? 'approximation' : 'match',
    accepted: !['08536', '08539', '08542', '08535'].includes(code),
    clauses: [
      { text: `[action]：谈判。${s.skill}；成功在其上放置资源（阈值 ${s.threshold}[per_investigator]）；失败其攻击你；达到阈值将其加入胜利区。`,
        status: s.extra ? (s.extra.severity === 'high' ? 'missing' : 'approximation') : 'implemented',
        evidence: `${E2}/${code}.js:25-45（abilities actionKind parley + 阈值 scenarioFlag + api.buryEnemyInVictory）；枚举 src/engine/parley.js:122-178；执行 ability-exec doEntityAbility（src/engine/ability-exec.js）`, note: '' },
      { text: '强制 - 如果该队员被击败：在剧本日志上划掉其名字。', status: 'implemented',
        evidence: `${P2}/behavior.js:222-234 enemyDefeated → POSSESSED_PARTNERS 映射 + setPartnerStatus('eliminated')；引擎读点 src/engine/enemies.js:708` },
    ],
    perceivability: { status: 'not-perceivable', evidence: '被附身队员要在 Part II 从地点底下翻出才会登场（08526 的 actions 未接线）→ 真实路径不可达；单测层 api.choice+api.info 齐全', note: '' },
    tests: { status: 'partial', evidence: code === '08539' ? 'tests/eote-scenario-iceAndDeathPart2.test.mjs:306-327（直接调用 descriptor.resolve）' : 'tests/eote-scenario-iceAndDeathPart2.test.mjs:174-190 仅断言数据声明', note: '' },
    issues: [
      issue('medium', 'primitive', 'enemyScript.partner/negotiation/crossOutOnDefeat/rescueThresholdPerInvestigator 声明无读点；实际逻辑在 abilities 与 Part II behavior 的 POSSESSED_PARTNERS 常量（声明未接线）', `${E2}/${code}.js:29-35；flags-readpoints 未标 unread 属扫描漏报`, '删除重复声明或让引擎读 enemyScript 配置；把 9 张同构谈判上收为共享原语。'),
      issue('medium', 'runtime', '真实引擎路径不可达（08526 的翻底牌行动未接线）', `${P2}/behavior.js:254-320`, '随 08526 修复。'),
      ...(s.extra ? [s.extra] : []),
      issue('medium', 'duplication', '9 张被附身队员的谈判实现近逐字复制（screen duplication.clonePairs jaccard 0.81–0.89），含 4 个死分支（CONFIG.kind 只会命中其中一种）', `${E2}/08535.js-08543.js 同构（见 ${E2}/08535.js:62-124 与 ${E2}/08543.js:60-122）`, '按项目规范提取共享 descriptor builder（_shared 原语），CONFIG 只保留差异。'),
    ],
  })
}

// ---------------------------------------------------------------------------
// Part III 08544–08548
// ---------------------------------------------------------------------------
add({
  code: '08544', name: 'Manifestations of Evil', nameZh: '邪灵现身',
  verdict: 'gap', accepted: false,
  clauses: [
    { text: '强制 - 在本密谋将要推进时，如果在渗出梦魇底下有正面朝下的卡牌：不推进，改为移除 2 毁灭，找到底牌最多的渗出梦魇并随机翻出 1 张生成在其地点。', status: 'missing',
      evidence: `${P3}/behavior.js:74-88（agendaWouldAdvance 语义与引擎相反：引擎用返回 true 表示"阻止推进"（src/engine/act-agenda.js:328），本函数对非 08544 返回 true、对 08544 返回 false；且引擎第 2 参是 scenarioRuntime 而非 agenda → 永远走 return true）。probe：doom=10 advanceAgenda 后 agendaIndex 仍 0；即使触发也只把 code 压入 encounterDiscard，无生成（behavior.js:83-87）`, note: '参考 ManifestationsOfEvil.hs:26-63。' },
    { text: '背面：队长二选一 —— 加 1 [frost]，或以玩家顺序每位调查员洗入忒咳哩-哩牌库顶 2 张（不能者 1 伤害+1 恐惧）。', status: 'missing',
      evidence: `${P3}/behavior.js:149-164（behavior 无 agendaReveal）；若议程因非 doom 原因推进则引擎 runAgendaReveal 抛 "密谋规则尚未迁移：08544"（src/engine/phases.js:273-279 静态读点）`, note: '' },
  ],
  perceivability: { status: 'not-perceivable', evidence: '议程永不推进/推进即抛错，玩家无法感知', note: '' },
  tests: { status: 'partial', evidence: 'tests/eote-scenario-iceAndDeathPart3.test.mjs:67-82 直接以 agenda 对象调用 behavior.agendaWouldAdvance（引擎实际传 scenarioRuntime，故测试掩盖了签名/语义错误）', note: '' },
  issues: [
    issue('high', 'runtime', 'agendaWouldAdvance 签名与语义双重错误：引擎传 (state, scenarioRuntime) 并用 true 表示阻止推进；实现按 (state, agenda) 且把 false 当阻止 → Part III 议程永远不推进',
      `${P3}/behavior.js:74-88；src/engine/act-agenda.js:326-329；probe（doom=10 后 agendaIndex 0）`, '改为 agendaWouldAdvance(state, api) 读 state.agendas[state.agendaIndex]，返回 true=阻止；补真实 advanceAgenda 测试。'),
    issue('high', 'runtime', '「翻出底牌并生成」只把牌塞进 encounterDiscard，没有任何生成/结算读点执行', `${P3}/behavior.js:83-87`, '用引擎 spawn/遭遇结算原语在该地点生成（参考 createEnemy_ / 遭遇结算）。'),
    issue('high', 'runtime', '议程背面（加 frost / 洗入 2 张忒咳哩-哩）完全未实现，且推进即抛错', `${P3}/behavior.js:149-164；src/engine/phases.js:268-283`, '实现 behavior.agendaReveal 并分派 08544/08545。'),
    issue('medium', 'primitive', 'agendaRule.forcedAdvanceHold/removeDoomOnHold/spawnFromBeneath 与 flags.seepingNightmareAdvance 声明无读点', `${E3}/08544.js:12-19`, '与 engine agenda 规则读点统一或删除声明。'),
  ],
})

add({
  code: '08545', name: 'Icy Depths', nameZh: '冰雪深处',
  verdict: 'gap', accepted: false,
  clauses: [
    { text: '背面：剩下的每位调查员被击败并承受 1 点肉体创伤。', status: 'missing',
      evidence: `${P3}/behavior.js:149-164（无 agendaReveal）；非 doom 推进时 runAgendaReveal 抛 "密谋规则尚未迁移：08545"（src/engine/phases.js:273-279）`, note: '参考 IcyDepths.hs:13-19。' },
  ],
  perceivability: { status: 'not-perceivable', evidence: '永不触发', note: '' },
  tests: { status: 'partial', evidence: 'tests/eote-scenario-iceAndDeathPart3.test.mjs:135 只断言 agendaWouldAdvance 对 08545 返回 true（恰好与引擎期望相反）', note: '' },
  issues: [
    issue('high', 'runtime', '议程背面未实现且推进抛错（同 08544 根因）', `${P3}/behavior.js:149-164；src/engine/phases.js:268-283`, '同 08544。'),
    issue('medium', 'primitive', 'agendaRule:{} 与 flags.deeperIce 均无读点', `${E3}/08545.js:12-14`, '删除或接线。'),
  ],
})

add({
  code: '08546', name: 'Under Attack!', nameZh: '陷入围攻！',
  verdict: 'gap', accepted: false,
  clauses: [
    { text: '每个 [[幻灵]] 敌人获得胜利 0。', status: 'missing',
      evidence: `全仓无实现（参考 UnderAttack.hs:33-36 GainVictory 0）；${E3}/08546.js:8-21 也没有声明`, note: '影响"击败的幻灵是否进胜利区"与胜点记录。' },
    { text: '营地获得：「[action] 你所在地点的调查员共同花费 4 个线索：撤退。」', status: 'missing',
      evidence: `${P3}/behavior.js:100-126（scenarioActions/performScenarioAction，未接线）+ ${E3}/08546.js:13-19（locationRule.actions，引擎无此读点）→ 真实路径无该行动；probe：Part III legalMoves 无 scenarioAction`, note: '且 Part III 地点无线索（见 scenarios）→ 4 线索不可支付。' },
    { text: '目标 - 如果没有 [[幻灵]] 敌人，推进；如果所有未被击败的调查员都撤退了，推进（分别 →R1/→R2）。', status: 'missing',
      evidence: `${P3}/behavior.js:91-97 actObjectiveMet 实现但未接线（Part III 无 checkObjectives，引擎 src/engine/act-agenda.js:183-190 回落到 actRule.objective，而 ${E3}/08546.js:12 actRule:{}）；advanceAct 抛 "场景规则尚未迁移：08546"（probe）`, note: '结局键也应为 resolution1/resolution2，而 behavior.scenarioResolution 用 victory/defeat（${P3}/behavior.js:129-143）。' },
    { text: '地点行动由营地（被 ScenarioModifier camp 标记的地点）提供', status: 'missing', evidence: `${E3}/08546.js:13-19 声明 locationRule.actions，但引擎不读 locationRule.actions（仅 TPC 章节 behavior 自己调用）；实际实现在 ${P3}/behavior.js:100-106`, note: '声明未接线。' },
  ],
  perceivability: { status: 'not-perceivable', evidence: '合法行动列表无营地撤退（probe）', note: '' },
  tests: { status: 'partial', evidence: 'tests/eote-scenario-iceAndDeathPart3.test.mjs:84-104 手动调用 entry08546.locationRule.actions 与 behavior.performScenarioAction（两者在引擎都不被调用）', note: '' },
  issues: [
    issue('high', 'runtime', '幕 08546 在真实引擎路径无法推进/结算：behavior 无 checkObjectives 与 actReveal，engine 的通用 objective 读点不认识 {type:"noEidolonEnemies"}',
      `${P3}/behavior.js:149-164；${E3}/08546.js:12；src/engine/act-agenda.js:183-190；src/engine/reveal.js:151-176；probe advanceAct 抛错`, '补 checkObjectives（调 engine advanceAct/api.finish）与 actReveal（→R1/R2）。'),
    issue('high', 'runtime', '营地撤退行动不可达（hook 名错误）+ Part III 无线索 → 4 线索费用不可支付', `${P3}/behavior.js:100-126；${P3}/behavior.js:39`, '同 ISSUE_HOOK_ACTIONS；补线索。'),
    issue('high', 'impl-vs-text', '「每个幻灵敌人获得胜利 0」未实现', `${E3}/08546.js；参考 Act/Cards/.../UnderAttack.hs:33-36`, '补声明式胜利点修正（引擎已有 victory 读点）。'),
    issue('medium', 'impl-vs-text', '结局键体系不一致：behavior 用 victory/defeat，印刷/参考是 R1（无幻灵）/R2（撤退）', `${P3}/behavior.js:129-143、${P3}/definition.js:140-144；参考 UnderAttack.hs:40-43`, '统一 resolution1/resolution2 并接战役记录。'),
  ],
})

add({
  code: '08547', name: 'Seeping Nightmare', nameZh: '渗出梦魇',
  verdict: 'gap', accepted: false,
  clauses: [
    { text: '位于渗出梦魇所在地点的 [[幻灵]] 敌人移动时，其所在地点视为与营地相连。', status: 'missing',
      evidence: `无实现（参考 SeepingNightmare.hs:18-26 ConnectedToWhen）；${E3}/08547.js:8-14 只有 flags/enemyRule 声明`, note: '' },
    { text: '当渗出梦魇底下没有正面朝下的卡牌时，它获得猎手。', status: 'approximation',
      evidence: `${P3}/behavior.js:59（setup 时 hunter=beneath.length===0）、80-82（议程 hold 移除底牌时重算）；但底牌减少的其他路径不重算；flags.beneathHolder/enemyRule.hunterWhenNoBeneath 无读点（flags-readpoints unread）`, note: '' },
    { text: '强制 - 在渗出梦魇被击败时：将其底下的所有正面朝下的卡牌从游戏中移除。', status: 'missing',
      evidence: `${P3}/behavior.js:149-164（无 enemyDefeated 钩子）；${E3}/08547.js:12 enemyRule.removeBeneathOnDefeat 无读点`, note: '参考 SeepingNightmare.hs:28-38。' },
  ],
  perceivability: { status: 'not-perceivable', evidence: '上述规则无界面/日志表现', note: '' },
  tests: { status: 'partial', evidence: 'tests/eote-scenario-iceAndDeathPart3.test.mjs:52-65 只断言 setup 与 beneath 数', note: '' },
  issues: [
    issue('high', 'impl-vs-text', '「被击败时移除其底下所有正面朝下卡牌」未实现（Part III behavior 无 enemyDefeated 钩子）', `${P3}/behavior.js:149-164；参考 Enemy/Cards/.../SeepingNightmare.hs:28-38`, '补 behavior.enemyDefeated（或条目 forced enemyDefeated ability）。'),
    issue('high', 'impl-vs-text', '「幻灵敌人从 SN 地点移动时该地点视为与营地相连」未实现', `${E3}/08547.js:12；参考 SeepingNightmare.hs:18-26`, '实现 enemyConnections/移动规则读点。'),
    issue('medium', 'primitive', 'enemyRule.hunterWhenNoBeneath/removeBeneathOnDefeat、flags.beneathHolder/eidolon/elite 声明无读点（隐藏规则靠 behavior 手工推断）', `${E3}/08547.js:12-14`, '改由引擎 enemyRule 读点或条目 forced ability 表达。'),
  ],
})

add({
  code: '08548', name: 'Phantasmagoria', nameZh: '千变幻景',
  verdict: 'gap', accepted: false,
  clauses: [
    { text: '显现 - 如果没有渗出梦魇，获得涌动；否则找到离调查员最近的渗出梦魇：底牌≥1 随机翻出 1 张生成在其地点；没有则如敌军阶段移动并攻击（不横置）。', status: 'missing',
      evidence: `${E3}/08548.js:8-14 只有 flags/treacheryRule 声明，无 encounterResolve/abilities；${P3}/behavior.js 无任何 08548 分派；引擎对无 scenario resolveEncounterCard 的战役会回落到 treachery-tokens.js:113-123，但该条目没有 encounterResolve → 直接进入通用分支（无效果）`, note: '参考 Phantasmagoria.hs:19-44。' },
  ],
  perceivability: { status: 'not-perceivable', evidence: '抽到该诡计无任何效果/日志（仅进入威胁/弃牌流程）', note: '' },
  tests: { status: 'partial', evidence: 'tests/eote-scenario-iceAndDeathPart3.test.mjs:106-110 只断言 flags 存在', note: '' },
  issues: [
    issue('high', 'impl-vs-text', '整张卡的显现效果未实现（treacheryRule.spawnBeneathOrHunterAttack / flags.surgeIfNoSeepingNightmare 均无读点）',
      `${E3}/08548.js:8-14；src/engine/treachery-tokens.js:113-123（找不到 encounterResolve 时无效果）；参考 Treachery/Cards/.../Phantasmagoria.hs:19-44`,
      '补 encounterResolve（最近 SN、涌动、翻底牌生成、猎手移动+攻击不横置）并补真实引擎抽牌测试。'),
  ],
})

// ---------------------------------------------------------------------------
// 汇总 scenarios / duplication / screen triage / notes
// ---------------------------------------------------------------------------
const scenarios = [
  {
    id: 'iceAndDeathPart1', status: 'blocked-in-engine',
    setup: 'setupScenario 正常建 4 地点/放一边 20/遭遇牌库 23/忒咳哩-哩 16（probe 实测）；但地点 shroud 全缺（undefined）→ 调查难度 NaN。',
    rules: '正面强制（首次进入放相连地点）在引擎生效；议程 I/II/III 背面因 behavior.agendaReveal 为空永不结算；营地撤退/幕推进在引擎不可达。',
    flow: 'Part1 → 检查点 I 的营地记录口径不一致（records.camp vs Camp_*）→ 检查点庇护值 0、失踪伙伴 9（probe）。',
    issues: [
      issue('high', 'runtime', '行为钩子名不符（scenarioActions/performScenarioAction vs 引擎 actions/performAction）→ 营地撤退不可用，幕目标不可达', `${P1}/behavior.js:397-398；src/engine/moves.js:222；src/engine/dispatch.js:633；probe legalActions 无 scenarioAction`, '改 hook 名 + 端到端测试。'),
      issue('high', 'runtime', 'agendaReveal 空实现 → 08518/08519/08520 背面全部不结算（probe：advanceAgenda 无敌人/牌库变化）', `${P1}/behavior.js:399；src/engine/phases.js:268-283`, '实现 agendaReveal 分派。'),
      issue('high', 'runtime', 'actReveal 缺失 → advanceAct 抛 "场景规则尚未迁移：08521"（probe）', `${P1}/behavior.js:382-412；src/engine/reveal.js:151-176`, '实现 actReveal → R1。'),
      issue('high', 'runtime', '13 张地点 shroud 未接线；未探索地点入场费永不收取（reveal 先于 locationEntered，且返回值被忽略）', `${P1}/definition.js:98-104；src/engine/movement.js:235-249；probe（5 线索进入辽阔雪地后仍 5）`, '修 location 数据与移动费用读点。'),
      issue('high', 'runtime', '营地记录口径不一致导致检查点庇护值/失踪伙伴错误', `${P1}/behavior.js:344,353；content/campaigns/edgeOfTheEarth/checkpoints.js:197-205；probe eoteShelterValue=0`, '写 Camp_* 记录。'),
      issue('medium', 'primitive', '测试全部直接调用 behavior 函数（tests/eote-scenario-iceAndDeathPart1.test.mjs:213-292），未覆盖引擎钩子名/议程推进/legalMoves → 上述缺陷对测试不可见', 'tests/eote-scenario-iceAndDeathPart1.test.mjs:213-292', '补真实引擎端到端用例。'),
    ],
    guide: '剧情正文经 story-access 接入（SCENARIO_TEXT），未见缺章。',
    runthrough: '未能完成一次真实引擎 runthrough：无撤退行动、议程背面缺失。',
  },
  {
    id: 'iceAndDeathPart2', status: 'blocked-in-engine',
    setup: 'setupScenario 建立 13 地点、9 张底牌、遭遇牌库 32（probe）；未按参考洗混 9 张（顺序确定），未追加难度 frost，未按庇护值设开局资源。',
    rules: '08523/08524 查看底牌、08525 全员击败、08526 抽底牌/撤退全部只存在于未被引擎调用的 behavior 函数；议程推进抛错。',
    flow: 'Part2 无法在引擎内正常完成；9 张底牌无法翻出 → 剧情/被附身队员不可达。',
    issues: [
      issue('high', 'runtime', '无 agendaReveal → advanceAgenda 抛 "密谋规则尚未迁移：08523"（probe）', `${P2}/behavior.js:382-405；src/engine/phases.js:268-283`, '实现 agendaReveal。'),
      issue('high', 'runtime', '无 actReveal + actions/performAction 未接线 → advanceAct 抛 "场景规则尚未迁移：08526"，抽底牌/撤退不可用（probe）', `${P2}/behavior.js:382-405,254-320`, '修 hook 名并补 actReveal。'),
      issue('medium', 'runtime', 'setup 未按参考洗混 9 张（deterministic 顺序）、未加难度 frost、未按当前庇护值设置 BaseStartingResources', `${P2}/behavior.js:86-108；参考 IceAndDeathPart2.hs:112-113,241-274`, '按参考实现补齐。'),
      issue('high', 'runtime', '下游：08527–08543 在真实路径不可达（剧情/被附身队员）', `${P2}/behavior.js:254-320`, '随 08526 修复。'),
      issue('medium', 'primitive', '测试全部直接调用 behavior 函数（tests/eote-scenario-iceAndDeathPart2.test.mjs:242-304），未覆盖引擎钩子/advanceAgenda', 'tests/eote-scenario-iceAndDeathPart2.test.mjs:242-304', '补引擎用例。'),
    ],
    guide: '剧情正文已接入；未见指南缺章。',
    runthrough: '未完成：议程 I 推进即抛错。',
  },
  {
    id: 'iceAndDeathPart3', status: 'blocked-in-engine',
    setup: 'setupScenario 建 13 地点（全部 clues/maxClues=0、无 shelter）、按人数放渗出梦魇（位置取"非营地前 N 个"，与参考按营地映射的候选地点不符）、幻灵池为 4 个唯一 code（未按印刷份数）、遭遇牌库 22（未展开份数、缺 ancientEvils、含 7 张忒咳哩-哩弱点）。',
    rules: '08544 强制不推进失效（签名/语义错）、08545/08544 背面缺失、08546 胜利0/营地行动/双目标不可达、08547 移动连接与击败清底牌缺失、08548 整卡显现缺失；无 afterTest。',
    flow: '议程永不推进（probe agendaIndex 0→0）；幕无法推进（advanceAct 抛错）；营地 4 线索不可支付。',
    issues: [
      issue('high', 'runtime', '议程无法推进：agendaWouldAdvance 语义/签名反了（probe doom=10 后 agendaIndex 仍 0）', `${P3}/behavior.js:74-88；src/engine/act-agenda.js:328`, '修签名/语义。'),
      issue('high', 'runtime', '幕无法推进/结算：无 checkObjectives、无 actReveal、objective {type:noEidolonEnemies} 引擎不识', `${P3}/behavior.js:149-164；${E3}/08546.js:12；src/engine/act-agenda.js:183-190`, '补钩子。'),
      issue('high', 'impl-vs-text', '地点无线索且无 shelter：营地撤退费不可支付、[skull]=0、08516 难度 0、庇护值记录 0', `${P3}/definition.js:31-40,81-86；${P3}/behavior.js:39,48-60`, '共用 Part1/2 地点数据。'),
      issue('high', 'impl-vs-text', '08544/08545/08546/08547/08548 五张卡的规则大段缺失（见各卡 issues）', `见 cards 08544–08548`, '按参考 card behavior 逐条补。'),
      issue('medium', 'impl-vs-text', '渗出梦魇生成地点未按参考「营地→候选地点」映射（Haskell IceAndDeathPart3.hs:168-188）；幻灵分配按唯一 code 而非印刷份数', `${P3}/behavior.js:48-60`, '按参考映射表与份数展开。'),
      issue('medium', 'impl-vs-text', 'setup 未按 LocationsRevealed 记录揭示已探索地点（参考 IceAndDeathPart3.hs:138,148）；营地只认 4 个候选（定义 CAMPS 少了 9 个）', `${P3}/definition.js:27；${P3}/behavior.js:28-36`, '与记录/13 营地对齐。'),
      issue('medium', 'runtime', '遭遇牌库构成错误：份数未展开、缺 ancientEvils、忒咳哩-哩弱点卡 08723–08729 混入遭遇牌库（应在独立忒咳哩-哩牌库）', `${P3}/definition.js:116-136；参考 IceAndDeathPart3.hs:129-136,190-223`, '按印刷份数展开、剔除 tekelili 组、补 Ancient Evils。'),
      issue('medium', 'runtime', '缺 afterTest（08501 [cultist]/[tablet] 失败后果）、未在 setup 追加难度 frost', `${P3}/behavior.js:149-164；参考 IceAndDeathPart3.hs:77`, '补 afterTest/frost。'),
      issue('medium', 'primitive', '测试以 agenda 对象手动调用 agendaWouldAdvance（tests/eote-scenario-iceAndDeathPart3.test.mjs:67-82）掩盖了引擎实际传参；locationRule.actions 亦只在测试里手动调用', 'tests/eote-scenario-iceAndDeathPart3.test.mjs:67-104', '改为断言真实引擎。'),
    ],
    guide: '剧情正文接入，未见缺章。',
    runthrough: '未完成：议程/幕均不可推进。',
  },
]

const duplication = {
  summary: 'D5 复用问题（本分片）',
  items: [
    { severity: 'medium', dimension: 'duplication', summary: 'Part I/II/III 三份 definition 各自复制地点表/连接表/坐标（Part2 与 Part1 逐字同表；Part3 复制时漏了 shelter/clues 列）→ 数据漂移已实际发生', evidence: `${P1}/definition.js:28-104、${P2}/definition.js:26-90、${P3}/definition.js:31-86、${P3}/definition.js:60-65 vs ${P1}/definition.js:46-61`, suggestion: '上收到 content/campaigns/edgeOfTheEarth/shared.js 单一地点表（含 shelter/clues），三章引用。' },
    { severity: 'medium', dimension: 'duplication', summary: '三份 chaos.js 的 token 表/数值函数/失败 spec 近逐字复制，且 Part3 版本偏离 Part1/2（自带 shelterValueOf，未走 eote-shelter 读点）', evidence: `${P1}/chaos.js:11-75、${P2}/chaos.js:8-60、${P3}/chaos.js:10-31`, suggestion: '提取共享 EOTE 混乱标记表 + shelterValueOf 到战役 shared 层，章节只保留差异。' },
    { severity: 'medium', dimension: 'duplication', summary: 'Part1/Part2 behavior 的 afterTest/cultist/tablet 失败结算实现近逐字复制（含 tekeliShuffleIn/弃牌库顶+弱点抽取）', evidence: `${P1}/behavior.js:314-340、${P2}/behavior.js:355-380`, suggestion: '提取共享 afterTest 辅助到战役 shared。' },
    { severity: 'low', dimension: 'duplication', summary: 'Part1 behavior 的 PUBLIC_LINKS 与同章 definition 的 PRINTED_LINKS 重复声明同一张印刷连接表（同源数据两份）', evidence: `${P1}/behavior.js:78-88、${P1}/definition.js:46-61`, suggestion: 'behavior import definition 的连接表（或反之）。' },
    { severity: 'medium', dimension: 'duplication', summary: '08535–08543 九张被附身队员近逐字复制（screen duplication.clonePairs jaccard 0.81–0.89），且 4 个 CONFIG.kind 分支里每张卡有 3 个死分支', evidence: `${E2}/08535.js:62-124 vs ${E2}/08543.js:60-122`, suggestion: '按项目规范提取 shared negotiation descriptor builder。' },
  ],
}

const screenTriage = {
  'integrity.json': { cards: ['08515'], note: '08515 唯一 marker 是已披露的攻击近似注释；无 empty-behavior/no-implemented-flag 命中本分片（08503/08504/08505/08508 等"无 abilities 但有 flags"未被 integrity 标记，属筛查缺口）。' },
  'flags-readpoints.json': {
    unread: 39,
    triage: [
      { keys: ['flags.shelterToken', 'flags.tekeliliOnFail'], cards: ['08501'], verdict: '真未接线但语义已在章节 chaos.js/behavior 实现 → low/medium 声明冗余', evidence: `${SHARED}/08501.js:10-17` },
      { keys: ['flags.campCandidate'], cards: ['08502', '08503', '08504', '08505', '08506', '08507', '08508', '08509', '08510', '08511', '08512', '08513', '08514'], verdict: '真未接线；营地选择实际在 behavior/records 表实现 → low', evidence: `${SHARED}/08502.js:13 等；content/campaigns/edgeOfTheEarth/records.js:186-203` },
      { keys: ['flags.entryGroupCluesPerInvestigator'], cards: ['08506', '08507', '08508', '08509', '08510', '08511', '08512', '08513', '08514'], verdict: '真未接线（入场费在 Part1 behavior 死代码里）→ high 规则缺失', evidence: `${P1}/behavior.js:128-166` },
      { keys: ['flags.firstFrostModifier'], cards: ['08507'], verdict: '声明未接线，但规则由条目 abilities+treat 原语近似实现 → medium', evidence: `${SHARED}/08507.js:11-27` },
      { keys: ['flags.shroudWhenAttached', 'locationRule.shroudWhenAttached'], cards: ['08503'], verdict: '真未接线 → high（规则缺失）', evidence: `${SHARED}/08503.js:9-10` },
      { keys: ['flags.surgeOnAttachedTreachery'], cards: ['08508'], verdict: '真未接线 → medium（已披露 primitive-request）', evidence: `${SHARED}/08508.js:9` },
      { keys: ['flags.moveSurchargeFromTreacheryLocation'], cards: ['08517'], verdict: '真未接线 → medium（已披露 primitive-request）', evidence: `${SHARED}/08517.js:10` },
      { keys: ['flags.seepingNightmareAdvance', 'agendaRule.forcedAdvanceHold/removeDoomOnHold/spawnFromBeneath', 'flags.deeperIce', 'flags.beneathHolder', 'enemyRule.hunterWhenNoBeneath/removeBeneathOnDefeat', 'flags.surgeIfNoSeepingNightmare', 'treacheryRule.spawnBeneathOrHunterAttack'], cards: ['08544', '08545', '08547', '08548'], verdict: '全部真未接线；实际逻辑只部分存在于 behavior（且 08544 签名/语义反、08545/48 无逻辑）→ high', evidence: `${E3}/08544.js:12-19、08545.js:12-14、08547.js:12-14、08548.js:12-14` },
    ],
    scanGaps: '扫描漏报：08518–08526 的 agendaRule/actRule 字段、08535–08543 的 enemyScript.*、08522 的 enemyScript.* 在引擎/内容中无对应读点，但 flags-readpoints 因同名字符串出现在其它战役而未列入 unread。',
  },
  'keyword-coverage.json': { cards: 0, note: '本分片无 keyword 漏报命中。' },
  'known-deviations.json': { note: '5 条 primitive-request（08503/08506/08508/08515/08517）+ 2 条 simplified（08544/08546）均核对为「仍存在且已披露」；但 08544/08546 的 simplified 理由（pending-primitive）低估了实际缺陷：这两条的引擎钩子名/语义问题不是原语缺失，是接线错误。' },
  'tests-coverage.json': { note: '48 张中 08503/08504/08505 为 none、其余多为 file-only；strong 仅 08544/08546/08501（且断言的是行为函数/数据而非引擎路径）。章节测试以 api stub 直接调 behavior（见各 scenarios.issues.medium）。' },
  'scenario-integrity.json': { note: '自动扫描 0 issues，但只检查导出/计数，未检查行为钩子是否引擎可调；Part3 的 encounterDeck 计数 0 已提示 ENCOUNTER_DECK 未导出/份数未展开。' },
  'primitive-compliance.json': { note: '22 张 escapeCards 覆盖本分片（地点/被附身/08515/08517）；directWrites=0、forbiddenImports=0（条目层合规）。被附身队员的 9 份重复在 duplication.clonePairs 中已列。' },
}

const findings = {
  area: 'campaign/a',
  auditor: 'campaign-auditor-a',
  method: '逐卡逐子句核对 cards-data 卡面 vs 单卡条目 + 三章 definition/behavior 消费点，并用生产组合根 fixture（tests/eote-p8-fixture.mjs）在真实引擎路径上实测 setup/legalMoves/advanceAgenda/advanceAct/标记结算；D3 另对照参考实现 Haskell Scenario/Scenarios/EdgeOfTheEarth/IceAndDeathPart1-3.hs 与 CardDefs/Cards；D4 逐条 triage flags-readpoints（含扫描漏报补查）；D5 读 duplication 与三章源码。',
  generatedAt: '2026-11-08',
  scope: { codes: cards.map(c => c.code), count: cards.length, chapters: ['iceAndDeathPart1', 'iceAndDeathPart2', 'iceAndDeathPart3'] },
  summary: {
    cards: cards.length,
    verdicts: {
      match: cards.filter(c => c.verdict === 'match').length,
      approximation: cards.filter(c => c.verdict === 'approximation').length,
      gap: cards.filter(c => c.verdict === 'gap').length,
      blocked: 0,
    },
    accepted: cards.filter(c => c.accepted).length,
    distinctRootCauses: {
      high: new Set(cards.flatMap(c => c.issues).concat(scenarios.flatMap(sc => sc.issues))
        .filter(i => i.severity === 'high').map(i => i.summary)).size,
      medium: new Set(cards.flatMap(c => c.issues).concat(scenarios.flatMap(sc => sc.issues), duplication.items)
        .filter(i => i.severity === 'medium').map(i => i.summary)).size,
    },
    issuesBySeverity: {
      high: cards.reduce((n, c) => n + c.issues.filter(i => i.severity === 'high').length, 0)
        + scenarios.reduce((n, s) => n + s.issues.filter(i => i.severity === 'high').length, 0),
      medium: cards.reduce((n, c) => n + c.issues.filter(i => i.severity === 'medium').length, 0)
        + scenarios.reduce((n, s) => n + s.issues.filter(i => i.severity === 'medium').length, 0)
        + duplication.items.filter(i => i.severity === 'medium').length,
      low: cards.reduce((n, c) => n + c.issues.filter(i => i.severity === 'low').length, 0)
        + duplication.items.filter(i => i.severity === 'low').length,
    },
    unreadDeclarations: 39,
    topFindings: [
      '真实引擎路径的行为钩子名不符：Part I/II/III behavior 导出 scenarioActions/performScenarioAction，引擎只调用 actions/performAction → 营地撤退/翻底牌行动全部不可用（08521/08526/08546 无法推进）',
      '议程/幕背面钩子缺失或空实现：Part1 agendaReveal(){}；Part2/3 无 agendaReveal、全部无 actReveal → 引擎推进即抛错或静默丢失全部背面效果（08518–08520/08523–08525/08544–08545）',
      '08501 混乱标记值在真实引擎路径全部按 0 结算（章节导出 chaosTokenValue，引擎读 resolveChaosToken）；Part III 另缺 [cultist]/[tablet] 失败后果',
      'Part I/II/III 13 张地点定义缺 shroud（调查难度 NaN）；Part III 另缺 shelter/clues（[skull]=0、营地撤退 4 线索不可支付）',
      'Part1 营地记录键与检查点读取口径不一致 → 检查点庇护值 0、9 名伙伴全部失踪；08515 击败强制效果双发（洗入 2 张忒咳哩-哩）',
    ],
  },
  cards,
  scenarios,
  duplication,
  screenTriage,
  notes: {
    scopeRule: '08502–08514 为三章共用印刷地点，按一张卡评审、D3 章级差异写在 scenarios 与 notes；08501 为三章共用提示卡。',
    blockedDefinition: '未使用 verdict=blocked（均可读源码并实测），但 Part I/II/III 三个章节在真实引擎路径处于 blocked-in-engine 状态（见 scenarios.status）。',
    priorLedger: '既有账本 48 张全部 verified/simplified；本轮发现至少 7 项 high 级 runtime 缺陷与测试口径问题（测试直接调用 behavior 函数绕过引擎钩子），因此 prior verified 不能作为语义正确性依据。',
    probes: ['games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/campaign/a/_probe2.mjs（钩子键/legalMoves/advanceAgenda/advanceAct）', 'games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/campaign/a/_probe3.mjs（未探索地点入场费）', 'games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/campaign/a/_probe5.mjs（08515 双发/08522 血量）', 'games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/campaign/a/_probe7.mjs（营地记录→检查点）', 'games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/campaign/a/_probe8.mjs（08501 符号标记 delta）'],
    testRuns: ['node tests/eote-scenario-iceAndDeathPart1.test.mjs → 13 pass', 'node tests/eote-scenario-iceAndDeathPart2.test.mjs → 13 pass', 'node tests/eote-scenario-iceAndDeathPart3.test.mjs → 6 pass', 'node tests/eote-scenario-shared.test.mjs → 19 pass'],
  },
}

fs.writeFileSync('G:/boardgame-hall-ai/games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/campaign/a/findings.json', JSON.stringify(findings, null, 1))
console.log('cards', cards.length, 'high', findings.summary.issuesBySeverity.high, 'medium', findings.summary.issuesBySeverity.medium, 'low', findings.summary.issuesBySeverity.low)
