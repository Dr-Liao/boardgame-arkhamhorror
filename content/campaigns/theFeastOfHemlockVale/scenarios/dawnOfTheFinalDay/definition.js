// 最终日黎明（dawnOfTheFinalDay · 序曲 3 · 提示卡 10704「山谷 The Vale」）· 章节数据。
//
// 参考（只读）：
//   · Scenario/Scenarios/TheFeastOfHemlockVale/PreludeDawnOfTheFinalDay.hs（PreScenarioSetup /
//     Setup / ScenarioSpecific "codex" / ScenarioResolution / EndOfScenario「勘察选择」逐条镜像）；
//   · Act|Agenda|Location|Enemy|Treachery|Story/CardDefs/TheFeastOfHemlockVale/{DayOfTheFeast,TheVale,
//     TheFinalDay,Residents,AgentsOfTheColour}.hs（卡号/印刷数值/图标连接）；
//   · Campaigns/TheFeastOfHemlockVale/Helpers.hs（居民关系/传家宝/疲劳/天数）；
//   · frontend/src/locales/en/theFeastOfHemlockVale/base.json#prelude3（权威印刷正文，经 story-text.js）。
//
// 本章是**序曲**（非对抗段落）：
//   · 没有遭遇牌库（Haskell `hasEncounterDeckL .~ False`），幕/议程各 1 张，议程毁灭阈值 6 是计时器；
//   · 8 处地点全部（反面朝下）入场，序曲只用图标连接（不使用网格相邻），见 base.json
//     additionalRulesAndClarifications.locationAdjacency 最后一条；
//   · 法典（Codex 1/2/4/5/6/7/8/9/10/11/13/14/15/16）由 behavior + 地点/居民剧情资产触发；
//   · 第 3 日黎明；Residents 组按战役日志「划掉」名单移除，Mother Rachel 与 Judith Park 以资产面
//     放在十字路口，其余居民与 Agents of the Colour 放一边。
//
// 本循环没有官方中文：story-text.js 的 chineseGaps 覆盖全部叶子，正文取英文印刷文本并显式声明
// textStatus，不冒充中文。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { bindScenarioIdentities } from '../../../../identities.js'
import { location, stage, encounterDefinitions, identitiesFor } from '../../card-data.js'
import { chapterStory, chapterText } from '../../story-access.js'
import { PRELUDE_TOKEN_MEANINGS } from './chaos.js'

export const CHAPTER_ID = 'dawnOfTheFinalDay'
export const REFERENCE_CODE = '10704'
export const STEP_CODE = '10679a'
// 序曲没有独立遭遇组：这个 id 只作为行为/记录命名空间；遭遇组依赖见 GATHER_GROUPS。
export const ENCOUNTER_CODE = 'dawn_of_the_final_day'

// ---------------------------------------------------------------------------
// 幕 / 议程 / 时间标记
// ---------------------------------------------------------------------------
// 「Build the act and agenda deck using All is Full of Love and Dawn of the Final Day.」
// 幕 1「Dawn of the Final Day」10687（背面 The Bliss）；议程 1「All is Full of Love」10686（毁灭 6）。
export const ACT_CODES = Object.freeze(['10687'])
export const AGENDA_CODES = Object.freeze(['10686'])
export const ACT1_CODE = ACT_CODES[0]
export const AGENDA1_CODE = AGENDA_CODES[0]

// 第三日时间标记卡（story 10679 正面 Day Three / 背面 Night Three 10679b）。
export const TIME_MARKER_CODE = '10679'
export const TIME_MARKER_NIGHT_CODE = '10679b'
export const TIME_MARKER_CODES = Object.freeze({ 3: TIME_MARKER_CODE })
export const STORY_CODES = Object.freeze([TIME_MARKER_CODE])

export const ACT_STAGES = Object.freeze({
  1: Object.freeze({
    ...stage(ACT1_CODE),
    // 印刷目标「Talk to the locals and prepare yourself for the Feast.」没有可计量的推进条件；
    // 参考实现也没有 AdvanceAct 处理（幕只在其它关卡里翻面），因此这里只保留目标标签。
    objective: { type: 'talkToLocals' },
  }),
})
export const AGENDA_STAGES = Object.freeze({
  1: Object.freeze(stage(AGENDA1_CODE)),
})
export const ACTS = Object.freeze([structuredClone(ACT_STAGES[1])])
export const AGENDAS = Object.freeze([structuredClone(AGENDA_STAGES[1])])

// ---------------------------------------------------------------------------
// gather 组
// ---------------------------------------------------------------------------
// setup.gatherSets：The Final Day、Day of the Feast、Agents of the Colour、Residents、The Vale。
export const GATHER_GROUPS = Object.freeze([
  'theFinalDay', 'dayOfTheFeast', 'agentsOfTheColour', 'residents', 'theVale',
])
// 整组放一边的两组（Haskell gatherAndSetAside）：Agents of the Colour、Residents。
export const GATHER_SET_ASIDE_GROUPS = Object.freeze(['agentsOfTheColour', 'residents'])
// 地点来源：The Vale（在第 3 日面）+ Day of the Feast（十字路口/老磨坊用 Morning 面）。
export const LOCATION_GATHER_GROUPS = Object.freeze(['theVale', 'dayOfTheFeast'])

// ---------------------------------------------------------------------------
// 地点
// ---------------------------------------------------------------------------
// 页 6 地图：3 列 × 6 行，每张地点卡竖向占两格（地图上同一符号出现两次）。
// 序曲只用图标连接，坐标只用于 layout 展示；这里取每张卡的上格。
export const LOCATION_COORDINATES = Object.freeze({
  hemlockChapel: Object.freeze({ x: 1, y: 0 }),
  tadsGeneralStore: Object.freeze({ x: 2, y: 0 }),
  theAtwoodHouse: Object.freeze({ x: 0, y: 1 }),
  theCrossroads: Object.freeze({ x: 1, y: 2 }),
  theCommons: Object.freeze({ x: 2, y: 2 }),
  theOldMill: Object.freeze({ x: 0, y: 3 }),
  boardingHouse: Object.freeze({ x: 1, y: 4 }),
  valeSchoolhouse: Object.freeze({ x: 2, y: 4 }),
})

// 印刷图标（TheVale.hs / DayOfTheFeast.hs）：地点左下符号 + 右下连接图标。
//   Boarding House   Circle   [Diamond, Spade]
//   Hemlock Chapel   Triangle [Diamond, Moon]
//   Tad's Store      Square   [Diamond, Star]
//   The Atwood House Moon     [Diamond, Triangle, Heart]
//   The Commons      Star     [Diamond, Square, Spade]
//   Vale Schoolhouse Spade    [Star, Circle]
//   The Crossroads   Diamond  [Triangle, Square, Star, Circle, Heart, Moon]
//   The Old Mill     Heart    [Diamond, Moon]
export const LOCATION_CONNECTIONS = Object.freeze({
  boardingHouse: Object.freeze(['theCrossroads', 'valeSchoolhouse']),
  hemlockChapel: Object.freeze(['theCrossroads', 'theAtwoodHouse']),
  tadsGeneralStore: Object.freeze(['theCrossroads', 'theCommons']),
  theAtwoodHouse: Object.freeze(['theCrossroads', 'hemlockChapel', 'theOldMill']),
  theCommons: Object.freeze(['theCrossroads', 'tadsGeneralStore', 'valeSchoolhouse']),
  valeSchoolhouse: Object.freeze(['theCommons', 'boardingHouse']),
  theCrossroads: Object.freeze(['hemlockChapel', 'tadsGeneralStore', 'theCommons', 'boardingHouse',
    'theOldMill', 'theAtwoodHouse']),
  theOldMill: Object.freeze(['theCrossroads', 'theAtwoodHouse']),
})
export const LOCATION_SYMBOLS = Object.freeze({
  boardingHouse: 'circle',
  hemlockChapel: 'triangle',
  tadsGeneralStore: 'square',
  theAtwoodHouse: 'moon',
  theCommons: 'star',
  valeSchoolhouse: 'spade',
  theCrossroads: 'diamond',
  theOldMill: 'heart',
})

// 地点表：id / 第 3 日面卡号 / 另一面卡号 / 所属遭遇组。
const LOCATION_TABLE = Object.freeze([
  Object.freeze({ id: 'boardingHouse', code: '10705a', backCode: '10705b', group: 'theVale' }),
  Object.freeze({ id: 'hemlockChapel', code: '10707a', backCode: '10707b', group: 'theVale' }),
  Object.freeze({ id: 'tadsGeneralStore', code: '10710a', backCode: '10710b', group: 'theVale' }),
  Object.freeze({ id: 'theAtwoodHouse', code: '10709a', backCode: '10709b', group: 'theVale' }),
  Object.freeze({ id: 'theCommons', code: '10712a', backCode: '10712b', group: 'theVale' }),
  Object.freeze({ id: 'valeSchoolhouse', code: '10711a', backCode: '10711b', group: 'theVale' }),
  // 十字路口/老磨坊用 *Day of the Feast* 组的 (Morning) 面（10690a/10691a）；
  // The Vale 组的同地点版本与 Day of the Feast 的 Evening 面移出游戏（见 REMOVED_CARDS）。
  Object.freeze({ id: 'theCrossroads', code: '10690a', backCode: '10690b', group: 'dayOfTheFeast' }),
  Object.freeze({ id: 'theOldMill', code: '10691a', backCode: '10691b', group: 'dayOfTheFeast' }),
])

const printedClues = code => Number(ALL_CARDS[code]?.clues) || 0
const locationDefinition = row => location({
  id: row.id,
  code: row.code,
  symbol: LOCATION_SYMBOLS[row.id],
  connections: [...LOCATION_CONNECTIONS[row.id]],
  cluesFixed: true,
  clues: printedClues(row.code),
  backCode: row.backCode,
  gatherGroup: row.group,
  ...(Object.hasOwn(ALL_CARDS[row.code] || {}, 'victory') ? { hasVictory: true, victory: ALL_CARDS[row.code].victory } : {}),
  ...(row.id === 'theCrossroads' ? { central: true } : {}),
})

export const LOCATIONS = Object.freeze(Object.fromEntries(LOCATION_TABLE.map(row =>
  [row.id, locationDefinition(row)])))
export const LOCATION_IDS = Object.freeze(LOCATION_TABLE.map(row => row.id))
export const START_LOCATION = 'boardingHouse'
export const START_LOCATION_IDS = Object.freeze([START_LOCATION])
export const LOCATION_CODE_BY_ID = Object.freeze(Object.fromEntries(LOCATION_TABLE.map(row => [row.id, row.code])))
export const LOCATION_ID_BY_CODE = Object.freeze(Object.fromEntries(LOCATION_TABLE.map(row => [row.code, row.id])))
export const LOCATION_BACK_CODE_BY_ID = Object.freeze(Object.fromEntries(LOCATION_TABLE.map(row => [row.id, row.backCode])))

// 移出游戏的地点面：The Vale 的两张 Crossroads / Old Mill（正/夜面）与 Day of the Feast 的 Evening 面。
export const REMOVED_LOCATION_CODES = Object.freeze([
  '10690b', '10691b', '10706a', '10706b', '10708a', '10708b',
])
// 移出游戏的幕/议程（Haskell：Remove each other act and agenda from the game）。
export const REMOVED_STAGE_CODES = Object.freeze(['10688', '10689'])
export const REMOVED_CARDS = Object.freeze([...REMOVED_STAGE_CODES, ...REMOVED_LOCATION_CODES])

// 全部放一边的地点：无（8 处全部入场）。
export const SET_ASIDE_LOCATION_IDS = Object.freeze([])

// ---------------------------------------------------------------------------
// 居民
// ---------------------------------------------------------------------------
// Residents 组：8 位有关系的居民（资产面 + 敌人面）+ Bertie / Dr. Rosa Marquez / Helen Peters。
// 关系记录键与 base.json#key 的 Campaign Log 分节共名（引擎 resident-record.js 的读点）。
export const RESIDENT_MAX_LEVEL = 5
export const RESIDENT_SPECS = Object.freeze([
  Object.freeze({ key: 'motherRachel', assetCode: '10693', enemyCode: '10693b', name: 'Mother Rachel', nameZh: '蕾切尔嬷嬷',
    record: Object.freeze({ level: 'motherRachelRelationshipLevel', notes: 'motherRachelNotes', crossedOut: 'motherRachelCrossedOut' }) }),
  Object.freeze({ key: 'leahAtwood', assetCode: '10694', enemyCode: '10694b', name: 'Leah Atwood', nameZh: '莉亚·阿特伍德',
    record: Object.freeze({ level: 'leahAtwoodRelationshipLevel', notes: 'leahAtwoodNotes', crossedOut: 'leahCrossedOut' }) }),
  Object.freeze({ key: 'simeonAtwood', assetCode: '10695', enemyCode: '10695b', name: 'Simeon Atwood', nameZh: '席米恩·阿特伍德',
    record: Object.freeze({ level: 'simeonAtwoodRelationshipLevel', notes: 'simeonAtwoodNotes', crossedOut: 'simeonCrossedOut' }) }),
  Object.freeze({ key: 'williamHemlock', assetCode: '10696', enemyCode: '10696b', name: 'William Hemlock', nameZh: '威廉·汉洛克',
    record: Object.freeze({ level: 'williamHemlockRelationshipLevel', notes: 'williamHemlockNotes', crossedOut: 'williamCrossedOut' }) }),
  Object.freeze({ key: 'riverHawthorne', assetCode: '10697', enemyCode: '10697b', name: 'River Hawthorne', nameZh: '瑞玟·霍桑',
    record: Object.freeze({ level: 'riverHawthorneRelationshipLevel', notes: 'riverHawthorneNotes', crossedOut: 'riverCrossedOut' }) }),
  Object.freeze({ key: 'gideonMizrah', assetCode: '10698', enemyCode: '10698b', name: 'Gideon Mizrah', nameZh: '基甸·米兹拉克',
    record: Object.freeze({ level: 'gideonMizrahRelationshipLevel', notes: 'gideonMizrahNotes', crossedOut: 'gideonCrossedOut' }) }),
  Object.freeze({ key: 'judithPark', assetCode: '10699', enemyCode: '10699b', name: 'Judith Park', nameZh: '朱迪斯·帕克',
    record: Object.freeze({ level: 'judithParkRelationshipLevel', notes: 'judithParkNotes', crossedOut: 'judithCrossedOut' }) }),
  Object.freeze({ key: 'theoPeters', assetCode: '10700', enemyCode: '10700b', name: 'Theo Peters', nameZh: '希奥·彼得斯',
    record: Object.freeze({ level: 'theoPetersRelationshipLevel', notes: 'theoPetersNotes', crossedOut: 'theoCrossedOut' }) }),
])
// 没有关系等级/笔记的三张居民卡（Bertie 的 [codex] Ω 属于其它序曲）：仍随组放一边。
export const EXTRA_RESIDENT_SPECS = Object.freeze([
  Object.freeze({ key: 'bertieMusgrave', assetCode: '10701', enemyCode: '10701b', name: 'Bertie Musgrave', nameZh: '伯蒂·马斯格雷夫', record: null }),
  Object.freeze({ key: 'drRosaMarquez', assetCode: '10702', enemyCode: null, name: 'Dr. Rosa Marquez', nameZh: '罗莎·马奎兹博士', record: null }),
  Object.freeze({ key: 'helenPeters', assetCode: '10703', enemyCode: null, name: 'Helen Peters', nameZh: '海伦·彼得斯', record: null }),
])
export const ALL_RESIDENT_SPECS = Object.freeze([...RESIDENT_SPECS, ...EXTRA_RESIDENT_SPECS])
export const RESIDENT_BY_KEY = Object.freeze(Object.fromEntries(ALL_RESIDENT_SPECS.map(spec => [spec.key, spec])))
export const RESIDENT_BY_ASSET_CODE = Object.freeze(Object.fromEntries(ALL_RESIDENT_SPECS.map(spec => [spec.assetCode, spec])))
export const RESIDENT_BY_ENEMY_CODE = Object.freeze(Object.fromEntries(ALL_RESIDENT_SPECS
  .filter(spec => spec.enemyCode).map(spec => [spec.enemyCode, spec])))
export const RESIDENT_ASSET_CODES = Object.freeze(ALL_RESIDENT_SPECS.map(spec => spec.assetCode))
export const RESIDENT_ENEMY_CODES = Object.freeze(ALL_RESIDENT_SPECS.filter(spec => spec.enemyCode).map(spec => spec.enemyCode))
export const RESIDENT_RECORDS = Object.freeze(Object.fromEntries(RESIDENT_SPECS.map(spec =>
  [spec.key, Object.freeze({ ...spec.record, max: RESIDENT_MAX_LEVEL })])))

// 开局直接在场的居民（setup.motherRachelAndJudith：十字路口、资产面）。
export const RESIDENTS_IN_PLAY_AT_START = Object.freeze([
  Object.freeze({ key: 'motherRachel', location: 'theCrossroads' }),
  Object.freeze({ key: 'judithPark', location: 'theCrossroads' }),
])
export const RESIDENTS_START_LOCATION = 'theCrossroads'

// codex 9/11/13 把放一边的居民放进场的目标地点。
export const RESIDENT_ENTRY_LOCATIONS = Object.freeze({
  motherRachel: 'theCrossroads',
  leahAtwood: 'theAtwoodHouse',
  simeonAtwood: 'theAtwoodHouse',
  williamHemlock: 'theOldMill',
  riverHawthorne: 'boardingHouse',
  gideonMizrah: 'hemlockChapel',
  judithPark: 'theCrossroads',
  theoPeters: 'tadsGeneralStore',
})

// 放一边的居民卡：除 Mother Rachel / Judith Park 之外的资产面与敌人面（各 1 张）。
export const RESIDENTS_SET_ASIDE_CARDS = Object.freeze([
  ...ALL_RESIDENT_SPECS
    .filter(spec => !['motherRachel', 'judithPark'].includes(spec.key))
    .flatMap(spec => [spec.assetCode, ...(spec.enemyCode ? [spec.enemyCode] : [])]),
])

// Agents of the Colour 组整组放一边：Miasmatic Shadow ×2 + Alien Whispers ×2。
export const MIASMATIC_SHADOW_CODE = '10724'
export const ALIEN_WHISPERS_CODE = '10725'
export const AGENTS_SET_ASIDE_CARDS = Object.freeze([
  MIASMATIC_SHADOW_CODE, MIASMATIC_SHADOW_CODE, ALIEN_WHISPERS_CODE, ALIEN_WHISPERS_CODE,
])
export const SET_ASIDE_CARDS = Object.freeze([...AGENTS_SET_ASIDE_CARDS, ...RESIDENTS_SET_ASIDE_CARDS])
// 开局在场（manifest.zones.inPlay 的 nominal 读点）：第三日时间标记 + Mother Rachel + Judith Park。
export const IN_PLAY_CARDS = Object.freeze([TIME_MARKER_CODE, '10693', '10699'])

// ---------------------------------------------------------------------------
// 遭遇（无遭遇牌库；这些卡只作为「放一边/生成」读点）
// ---------------------------------------------------------------------------
export const ENCOUNTER_DECK = Object.freeze([])
export const ENCOUNTER_DECK_CODES = Object.freeze([])
// The Final Day 组：10680 异界幻象 ×3（序曲没有遭遇牌库，仅登记定义）。
export const OTHERWORLDLY_VISIONS_CODE = '10680'
// Day of the Feast 组：10692 狂乱的赴宴者 ×2（不在场时也不进牌库）。
export const FRENZIED_REVELER_CODE = '10692'

// ---------------------------------------------------------------------------
// 法典（Codex 1/2/4/5/6/7/8/9/10/11/13/14/15/16）
// ---------------------------------------------------------------------------
// 参考 PreludeDawnOfTheFinalDay.hs 的 `ScenarioSpecific "codex"` 分支与印刷正文。
// 触发方式：
//   · resident：控制/位于居民剧情资产所在地点的调查员支付卡面行动 → 谈判检定 → 法典；
//   · location：地点卡面的 [action]（本序曲由 behavior.actions 暴露同一规则，见 behavior 头注释）。
// limit：
//   · 'scenario' 触发一次后本序曲内不再可用（Haskell codexFinished）；
//   · 'retry'    失败/未达成时可再次触发，成功后才标记完成（Codex 10/11/14/15）；
//   · 'unlimited' 可反复触发（Codex 9）。
export const CODEX_IDS = Object.freeze([
  'motherRachel', 'leahAtwood', 'williamHemlock', 'riverHawthorne', 'gideonMizrah', 'judithPark',
  'theoPeters', 'boardingHouse', 'theCrossroads', 'hemlockChapel', 'theAtwoodHouse',
  'tadsGeneralStore', 'valeSchoolhouse', 'theCommons',
])

const codexEntry = (id, data) => Object.freeze({
  id,
  textPrefix: `prelude3.codex.${id}`,
  ...data,
})

export const CODEX_ENTRIES = Object.freeze({
  motherRachel: codexEntry('motherRachel', {
    number: 1, kind: 'resident', resident: 'motherRachel', location: 'theCrossroads',
    trigger: Object.freeze({ type: 'parley', skill: 'willpower', difficulty: 2, actions: 1 }),
    limit: 'scenario',
    // 「Check the Areas Surveyed section…If the box next to Southern Fields is checked, proceed to
    // Mother Rachel 2. Otherwise, you cannot reach the matron.」
    gate: Object.freeze({ type: 'surveyedArea', area: 'southernFields', unmet: 'cannotReach' }),
    branches: Object.freeze(['thankYou', 'iSeeYou']),
    textKeys: Object.freeze(['motherRachel1', 'proceedTo2', 'cannotReach', 'motherRachel2', 'motherRachel3',
      'motherRachel4', 'label.thankYou', 'label.iSeeYou']),
  }),
  leahAtwood: codexEntry('leahAtwood', {
    number: 2, kind: 'resident', resident: 'leahAtwood', location: 'theAtwoodHouse',
    trigger: Object.freeze({ type: 'parley', skill: 'combat', difficulty: 2, actions: 1 }),
    limit: 'scenario',
    branchBy: 'simeonCrossedOut',
    branches: Object.freeze(['crossedOut', 'notCrossedOut']),
    textKeys: Object.freeze(['crossedOut', 'notCrossedOut']),
  }),
  williamHemlock: codexEntry('williamHemlock', {
    number: 4, kind: 'resident', resident: 'williamHemlock', location: 'theOldMill',
    trigger: Object.freeze({ type: 'parley', skill: 'intellect', difficulty: 2, actions: 1 }),
    limit: 'scenario',
    branchBy: 'williamStoodByYou',
    branches: Object.freeze(['william2', 'william3']),
    textKeys: Object.freeze(['william1', 'proceedTo2', 'skipTo3', 'william2', 'isResolved', 'william3']),
  }),
  riverHawthorne: codexEntry('riverHawthorne', {
    number: 5, kind: 'resident', resident: 'riverHawthorne', location: 'boardingHouse',
    trigger: Object.freeze({ type: 'parley', skills: Object.freeze(['willpower', 'intellect']), difficulty: 3, actions: 1 }),
    limit: 'scenario',
    branchBy: 'riverStoodByYouAndScheme',
    branches: Object.freeze(['stoodByYou', 'otherwise']),
    textKeys: Object.freeze(['stoodByYou', 'otherwise']),
  }),
  gideonMizrah: codexEntry('gideonMizrah', {
    number: 6, kind: 'resident', resident: 'gideonMizrah', location: 'hemlockChapel',
    trigger: Object.freeze({ type: 'parley', actions: 2 }),
    limit: 'scenario',
    branchBy: 'gideonStoodByYou',
    branches: Object.freeze(['stoodByYou', 'otherwise']),
    textKeys: Object.freeze(['stoodByYou', 'otherwise']),
  }),
  judithPark: codexEntry('judithPark', {
    number: 7, kind: 'resident', resident: 'judithPark', location: 'theCrossroads',
    // 「[action] Spend X resources, where X is the current day number: Parley.」
    trigger: Object.freeze({ type: 'parley', actions: 1, cost: Object.freeze({ resourcesPerDay: true }) }),
    limit: 'scenario',
    branchBy: 'judithBacked',
    branches: Object.freeze(['judith2', 'judith3']),
    textKeys: Object.freeze(['judith1', 'proceedTo2', 'skipTo3', 'judith2', 'judith3']),
  }),
  theoPeters: codexEntry('theoPeters', {
    number: 8, kind: 'resident', resident: 'theoPeters', location: 'tadsGeneralStore',
    // 「[action] Choose and discard X cards from your hand, where X is the current day number: Parley.」
    trigger: Object.freeze({ type: 'parley', actions: 1, cost: Object.freeze({ discardPerDay: true }) }),
    limit: 'scenario',
    branchBy: 'theoStoodByYou',
    branches: Object.freeze(['stoodByYou', 'otherwise']),
    textKeys: Object.freeze(['stoodByYou', 'otherwise']),
  }),
  boardingHouse: codexEntry('boardingHouse', {
    number: 9, kind: 'location', location: 'boardingHouse',
    trigger: Object.freeze({ type: 'locationAction', actions: 1 }),
    limit: 'unlimited',
    // 「Investigators at Boarding House may spend any number of actions, as a group, to choose that
    // many additional options.」
    extraActions: true,
    branches: Object.freeze(['william', 'theo', 'river']),
    textKeys: Object.freeze(['body']),
  }),
  theCrossroads: codexEntry('theCrossroads', {
    number: 10, kind: 'location', location: 'theCrossroads',
    trigger: Object.freeze({ type: 'locationAction', actions: 1 }),
    limit: 'retry',
    gate: Object.freeze({ type: 'planUnderway' }),
    branches: Object.freeze(['planUnderway', 'otherwise']),
    fireworksTest: Object.freeze({ skills: Object.freeze(['combat', 'agility']), difficulty: 3 }),
    textKeys: Object.freeze(['planUnderway', 'otherwise']),
  }),
  hemlockChapel: codexEntry('hemlockChapel', {
    number: 11, kind: 'location', location: 'hemlockChapel',
    trigger: Object.freeze({ type: 'locationAction', actions: 1 }),
    limit: 'retry',
    gate: Object.freeze({ type: 'planUnderway' }),
    branches: Object.freeze(['planUnderway', 'otherwise']),
    fireworksTest: Object.freeze({ skills: Object.freeze(['agility']), difficulty: 2 }),
    placesResident: 'gideonMizrah',
    textKeys: Object.freeze(['planUnderway', 'otherwise']),
  }),
  theAtwoodHouse: codexEntry('theAtwoodHouse', {
    number: 13, kind: 'location', location: 'theAtwoodHouse',
    trigger: Object.freeze({ type: 'locationAction', actions: 1 }),
    limit: 'scenario',
    placesResident: 'leahAtwood',
    branches: Object.freeze(['body']),
    textKeys: Object.freeze(['body']),
  }),
  tadsGeneralStore: codexEntry('tadsGeneralStore', {
    number: 14, kind: 'location', location: 'tadsGeneralStore',
    trigger: Object.freeze({ type: 'locationAction', actions: 1 }),
    limit: 'retry',
    gate: Object.freeze({ type: 'planUnderway' }),
    branches: Object.freeze(['planUnderway', 'otherwise']),
    fireworksTest: Object.freeze({ skills: Object.freeze(['combat', 'agility']), difficulty: 3 }),
    textKeys: Object.freeze(['label.item', 'planUnderway', 'otherwise']),
  }),
  valeSchoolhouse: codexEntry('valeSchoolhouse', {
    number: 15, kind: 'location', location: 'valeSchoolhouse',
    trigger: Object.freeze({ type: 'locationAction', actions: 1 }),
    limit: 'retry',
    gate: Object.freeze({ type: 'planUnderway' }),
    branches: Object.freeze(['planUnderway', 'otherwise']),
    fireworksTest: Object.freeze({ skills: Object.freeze(['combat', 'agility']), difficulty: 3 }),
    textKeys: Object.freeze(['planUnderway', 'otherwise']),
  }),
  theCommons: codexEntry('theCommons', {
    number: 16, kind: 'location', location: 'theCommons',
    trigger: Object.freeze({ type: 'locationAction', actions: 1 }),
    limit: 'scenario',
    branches: Object.freeze(['delivering', 'regardless']),
    textKeys: Object.freeze(['delivering', 'regardless']),
  }),
})

export const CODEX_BY_NUMBER = Object.freeze(Object.fromEntries(
  CODEX_IDS.map(id => [CODEX_ENTRIES[id].number, id])))

// 传家宝（Heirlooms 组 10713–10715）：剧情资产、[[Item]] 特质，Codex 16 可交还换取关系等级。
export const HEIRLOOM_CODES = Object.freeze(['10713', '10714', '10715'])
export const HEIRLOOM_SET_CODE = 'heirlooms'
export const CODEX16_XP = 1

// 记录键（与 base.json#key / Key.hs 同名）。
export const RECORD_KEYS = Object.freeze({
  drMarquezHasAPlan: 'drMarquezHasAPlan',
  bertieHadAnEpiphany: 'bertieHadAnEpiphany',
  drMarquesHasAHunch: 'drMarquesHasAHunch',
  theValeIsFullOfFireworks: 'theValeIsFullOfFireworks',
  thePlanIsUnderway: 'thePlanIsUnderway',
  theInvestigatorsLearnedTheirPlace: 'theInvestigatorsLearnedTheirPlace',
  theThingInTheDepthsWasDefeated: 'theThingInTheDepthsWasDefeated',
  areasSurveyed: 'areasSurveyed',
  simeonCrossedOut: 'simeonCrossedOut',
  williamStoodByYou: 'williamStoodByYou',
  williamTookHeart: 'williamTookHeart',
  williamIsResolved: 'williamIsResolved',
  riverStoodByYou: 'riverStoodByYou',
  theSchemeIsInMotion: 'theSchemeIsInMotion',
  riverIsReclaimingTheirLegacy: 'riverIsReclaimingTheirLegacy',
  gideonStoodByYou: 'gideonStoodByYou',
  judithStoodByYou: 'judithStoodByYou',
  youBackedJudithUp: 'youBackedJudithUp',
  theoStoodByYou: 'theoStoodByYou',
  theoIsHavingSecondThoughts: 'theoIsHavingSecondThoughts',
  youAreDeliveringAPackage: 'youAreDeliveringAPackage',
  day: 'day',
  time: 'time',
  hemlockDate: 'hemlockDate',
  xp: 'xp',
})
// 四个勘察区域记录键（base.json#key [areasSurveyed] 的短名）。
export const SURVEY_AREAS = Object.freeze({
  southernFields: Object.freeze({ key: 'southernFields', name: 'Southern Fields', scenarioId: 'theLongestNight' }),
})

// ---------------------------------------------------------------------------
// 结局
// ---------------------------------------------------------------------------
export const RESOLUTION_KEYS = Object.freeze(['noResolution', 'resolution1', 'resolution2'])
// noResolution / resolution1 都「skip to / proceed to Resolution 2」：Resolution 2 是唯一结算页。
export const RESOLUTION_RECORD = Object.freeze({
  noResolution: 'resolution2',
  resolution1: 'resolution2',
  resolution2: 'resolution2',
})

// 下一次勘察的五个候选（resolution2：从「Areas Surveyed」未勾选的区域里选一个）。
export const SURVEY_DESTINATIONS = Object.freeze([
  'writtenInRock', 'hemlockHouse', 'theSilentHeath', 'theLostSister', 'theThingInTheDepths',
])
export const SURVEY_DESTINATION_LABELS = Object.freeze({
  writtenInRock: 'prelude3.label.writtenInRock',
  hemlockHouse: 'prelude3.label.hemlockHouse',
  theSilentHeath: 'prelude3.label.theSilentHeath',
  theLostSister: 'prelude3.label.theLostSister',
  theThingInTheDepths: 'prelude3.label.theThingInTheDepths',
})

// ---------------------------------------------------------------------------
// 正文（英文印刷文本；本循环无官方中文）
// ---------------------------------------------------------------------------
const STORY = (() => {
  try {
    return chapterStory(CHAPTER_ID)
  } catch {
    return { sectionsEn: {}, sections: {} }
  }
})()
const SECTIONS_EN = STORY.sectionsEn || {}

const HTML_ENTITIES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" }
const SYMBOL_PLACEHOLDERS = {
  "{'{'}codex{'}'}": '[codex]',
  "{'{'}perPlayer{'}'}": '[per_player]',
  "{'{'}skull{'}'}": '[skull]',
  "{'{'}cultist{'}'}": '[cultist]',
  "{'{'}elderThing{'}'}": '[elder_thing]',
  "{'{'}day{'}'}": '[day]',
  "{'{'}night{'}'}": '[night]',
}
const decodeEntities = value => String(value || '')
  .replace(/&(amp|lt|gt|quot|#39);/g, match => HTML_ENTITIES[match] || match)

/** 印刷 HTML → 纯文本（段落/列表换行；用于展示与测试断言）。 */
export function htmlToText(value) {
  return decodeEntities(String(value || '')
    .replace(/<section\b[^>]*class=['"]encounter-sets['"][^>]*>[\s\S]*?<\/section>/gi, '')
    .replace(/<h3>\s*@:[^<]*<\/h3>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n- ')
    .replace(/<\/(?:p|li|ul|ol|div|h\d)>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n'))
    .replace(/\s*\n\s*/g, '\n')
    .trim()
}

/** 取 base.json 的 prelude3 段落；缺段返回空串（story-text 由生成物提供，不在本文件写死正文）。 */
export function preludeSection(key, language = 'en') {
  const path = String(key).startsWith('prelude3.') ? String(key) : `prelude3.${key}`
  const raw = chapterText(CHAPTER_ID, path, language) || ''
  if (!raw) return ''
  return htmlToText(raw)
    .replace(/\{'\{\}\}/g, '')
}

const CODE_SYMBOLS = value => Object.entries(SYMBOL_PLACEHOLDERS)
  .reduce((text, [from, to]) => text.split(from).join(to), String(value || ''))

const section = key => CODE_SYMBOLS(preludeSection(key))

// 印刷 setup 顺序（嵌套项按手册缩进顺序展开）。
const SETUP_STEPS = Object.freeze([
  Object.freeze({ key: 'gatherSets', text: section('setup.gatherSets') }),
  Object.freeze({ key: 'dayThree', text: section('setup.dayThree') }),
  Object.freeze({ key: 'buildActAgenda', text: section('setup.buildActAgenda') }),
  Object.freeze({ key: 'placeLocations', text: section('setup.placeLocations') }),
  Object.freeze({ key: 'crossroadsAndOldMill', text: section('setup.crossroadsAndOldMill') }),
  Object.freeze({ key: 'startAt', text: section('setup.startAt') }),
  Object.freeze({ key: 'residents', text: section('setup.residents') }),
  Object.freeze({ key: 'removeResidents', text: section('setup.removeResidents') }),
  Object.freeze({ key: 'motherRachelAndJudith', text: section('setup.motherRachelAndJudith') }),
  Object.freeze({ key: 'setOutOfPlay', text: section('setup.setOutOfPlay') }),
  Object.freeze({ key: 'setAsideAgents', text: section('setup.setAsideAgents') }),
  Object.freeze({ key: 'placeDoom', text: section('setup.placeDoom') }),
])

// 法典小节正文：title + 逐分支 leaf（键来自 CODEX_ENTRIES[].textKeys）。
const codexTextOf = entry => Object.freeze({
  title: CODE_SYMBOLS(htmlToText(chapterText(CHAPTER_ID, `${entry.textPrefix}.title`, 'en') || '')),
  branches: Object.freeze(Object.fromEntries((entry.textKeys || []).map(key =>
    [key.split('.').pop(), section(`${entry.textPrefix}.${key}`)]))),
})

const CODEX_TEXT = Object.freeze(Object.fromEntries(CODEX_IDS.map(id => [id, codexTextOf(CODEX_ENTRIES[id])])))

const codexTitle = id => String(CODEX_TEXT[id]?.title || '').replace(/^\[codex\]\s*/i, '')

export const SCENARIO_TEXT = Object.freeze({
  textLanguage: 'en',
  textStatus: 'printed-en (official zh locale missing; story-text chineseGaps covers every leaf)',
  heading: section('intro.title'),
  intro: Object.freeze({
    title: section('intro.title'),
    checkCampaignLog: section('intro.checkCampaignLog'),
    proceedToIntro1: section('intro.proceedToIntro1'),
    skipToIntro2: section('intro.skipToIntro2'),
    intro1: section('intro.intro1'),
    intro2: section('intro.intro2'),
    intro3: section('intro.intro3'),
  }),
  setup: Object.freeze(Object.fromEntries(SETUP_STEPS.map(step => [step.key, step.text]))),
  setupSteps: SETUP_STEPS,
  specialRules: Object.freeze([0, 1, 2, 3, 4, 5, 6, 7].map(index => Object.freeze({
    id: `specialRules${index}`,
    title: CODE_SYMBOLS(String(chapterText(CHAPTER_ID, `specialRules[${index}].title`, 'en') || '')),
    body: htmlToText(chapterText(CHAPTER_ID, `specialRules[${index}].body`, 'en') || ''),
  })).filter(rule => rule.title || rule.body)),
  additionalRules: Object.freeze({
    theCodex: htmlToText(chapterText(CHAPTER_ID, 'additionalRulesAndClarifications.theCodex', 'en') || ''),
    threeDaysThreeNights: htmlToText(chapterText(CHAPTER_ID, 'additionalRulesAndClarifications.threeDaysThreeNights', 'en') || ''),
    residentsAndRelationshipLevels: htmlToText(chapterText(CHAPTER_ID, 'additionalRulesAndClarifications.residentsAndRelationshipLevels', 'en') || ''),
    locationAdjacency: htmlToText(chapterText(CHAPTER_ID, 'additionalRulesAndClarifications.locationAdjacency', 'en') || ''),
  }),
  codex: Object.freeze({
    titles: Object.freeze(Object.fromEntries(CODEX_IDS.map(id => [id, codexTitle(id)]))),
    entries: CODEX_TEXT,
    fireworksHidden: section('codex.fireworksHidden'),
    labels: Object.freeze({
      additionalActions: section('codex.label.additionalActions'),
      combat: section('codex.label.combat'),
      agility: section('codex.label.agility'),
      draw: section('codex.label.draw'),
      gainResource: section('codex.label.gainResource'),
      item: section('codex.tadsGeneralStore.label.item'),
      boardingHouseWilliam: section('codex.boardingHouse.label.william'),
      boardingHouseTheo: section('codex.boardingHouse.label.theo'),
      boardingHouseRiver: section('codex.boardingHouse.label.river'),
    }),
  }),
  resolutions: Object.freeze(Object.fromEntries(RESOLUTION_KEYS.map(key => [key, Object.freeze({
    title: htmlToText(chapterText(CHAPTER_ID, `prelude3.resolutions.${key}.title`, 'en') || ''),
    body: htmlToText(chapterText(CHAPTER_ID, `prelude3.resolutions.${key}.body`, 'en') || ''),
  })]))),
  labels: Object.freeze({
    survey: section('label.survey'),
    ...Object.fromEntries(Object.entries(SURVEY_DESTINATION_LABELS).map(([id, key]) => [id, section(key)])),
  }),
  xp: Object.freeze({
    survivor: htmlToText(chapterText(CHAPTER_ID, 'prelude3.xp.survivor', 'en') || ''),
    motherRachel: htmlToText(chapterText(CHAPTER_ID, 'prelude3.codex.xp.motherRachel', 'en') || ''),
    leahAtwood: htmlToText(chapterText(CHAPTER_ID, 'prelude3.codex.xp.leahAtwood', 'en') || ''),
    williamHemlock: htmlToText(chapterText(CHAPTER_ID, 'prelude3.codex.xp.williamHemlock', 'en') || ''),
    riverHawthorne: htmlToText(chapterText(CHAPTER_ID, 'prelude3.codex.xp.riverHawthorne', 'en') || ''),
    gideonMizrah: htmlToText(chapterText(CHAPTER_ID, 'prelude3.codex.xp.gideonMizrah', 'en') || ''),
    judithPark: htmlToText(chapterText(CHAPTER_ID, 'prelude3.codex.xp.judithPark', 'en') || ''),
    theoPeters: htmlToText(chapterText(CHAPTER_ID, 'prelude3.codex.xp.theoPeters', 'en') || ''),
    theCommons: htmlToText(chapterText(CHAPTER_ID, 'prelude3.codex.xp.theCommons', 'en') || ''),
  }),
  remembered: Object.freeze({
    youAreDeliveringAPackage: CODE_SYMBOLS(htmlToText(chapterText(CHAPTER_ID, 'remembered.youAreDeliveringAPackage', 'en') || '')),
    youAreRunningAnErrand: CODE_SYMBOLS(htmlToText(chapterText(CHAPTER_ID, 'remembered.youAreRunningAnErrand', 'en') || '')),
  }),
  fatigue: Object.freeze({
    title: 'Fatigue',
    body: 'The fatigue from the long night catches up to you. Two non-symbol tokens drawn at random are '
      + 'replaced with a chaos token of a value 1 lower for the remainder of the campaign:',
  }),
  actBack: Object.freeze({
    title: 'The Bliss',
    madness: CODE_SYMBOLS(htmlToText(chapterText(CHAPTER_ID, 'label.dawnOfTheFinalDay.searchForRandomBasicMadnessWeakness', 'en') || '')),
    trauma: 'Suffer 1 mental trauma',
  }),
  agendaBack: Object.freeze({
    title: 'Bertie’s Choice',
    bertieEpiphany: 'If Bertie had an epiphany, proceed to Resolution 2.',
    otherwise: 'Otherwise, proceed to Resolution 1.',
  }),
  keepAssetForNextSurvey: CODE_SYMBOLS(htmlToText(chapterText(CHAPTER_ID, 'label.chooseAssetToKeepForNextSurvey', 'en') || '')),
})

// ---------------------------------------------------------------------------
// 章节数据
// ---------------------------------------------------------------------------
const definitions = encounterDefinitions([
  // 敌人：Frenzied Reveler、Miasmatic Shadow、居民敌人面（法典 7 会生成 Miasmatic Shadow）。
  FRENZIED_REVELER_CODE, MIASMATIC_SHADOW_CODE, ...RESIDENT_ENEMY_CODES,
  // 诡计：Otherworldly Visions、Alien Whispers（放一边/无遭遇牌库，仅登记定义）。
  OTHERWORLDLY_VISIONS_CODE, ALIEN_WHISPERS_CODE,
  // 剧情：第三日时间标记 + 11 张居民资产面（放一边或入场）。
  TIME_MARKER_CODE, ...RESIDENT_ASSET_CODES,
])

export const ENEMY_DEFINITIONS = Object.freeze(definitions.enemies)
export const TREACHERY_DEFINITIONS = Object.freeze(definitions.treacheries)
export const STORY_ASSET_DEFINITIONS = Object.freeze(definitions.storyAssets)

export const CARD_DATA = Object.freeze(Object.fromEntries([
  REFERENCE_CODE, TIME_MARKER_CODE, ...ACT_CODES, ...AGENDA_CODES,
  ...LOCATION_TABLE.flatMap(row => [row.code, row.backCode]),
  ...RESIDENT_ASSET_CODES, ...RESIDENT_ENEMY_CODES,
  FRENZIED_REVELER_CODE, MIASMATIC_SHADOW_CODE, OTHERWORLDLY_VISIONS_CODE, ALIEN_WHISPERS_CODE,
  ...HEIRLOOM_CODES, ...REMOVED_CARDS,
].map(code => [code, ALL_CARDS[code]])))

export const scenario = {
  id: CHAPTER_ID,
  kind: 'prelude',
  isPrelude: true,
  originalCode: REFERENCE_CODE,
  referenceCode: REFERENCE_CODE,
  stepCode: STEP_CODE,
  encounterCode: ENCOUNTER_CODE,
  name: '最终日黎明 · Dawn of the Final Day',
  nameEn: 'Dawn of the Final Day',
  intro: SCENARIO_TEXT.intro.intro3,
  setup: SCENARIO_TEXT.setupSteps.map(step => step.text).filter(Boolean).join('\n'),
  specialRules: SCENARIO_TEXT.specialRules,
  startLocation: START_LOCATION,
  locations: LOCATIONS,
  setAsideLocations: [],
  acts: ACTS,
  agendas: AGENDAS,
  ...definitions,
  encounterDeck: [...ENCOUNTER_DECK],
  resolutions: Object.fromEntries(RESOLUTION_KEYS.map(key => [key, SCENARIO_TEXT.resolutions[key].body])),
  resolutionTitles: Object.fromEntries(RESOLUTION_KEYS.map(key => [key, SCENARIO_TEXT.resolutions[key].title || key])),
  tokenMeanings: {
    easy: { ...PRELUDE_TOKEN_MEANINGS.easy },
    standard: { ...PRELUDE_TOKEN_MEANINGS.standard },
    hard: { ...PRELUDE_TOKEN_MEANINGS.hard },
    expert: { ...PRELUDE_TOKEN_MEANINGS.expert },
  },
  // 引擎机制读点（content/registry.js 的 normalizeScenarioMechanics 校验形状）：
  //   · noEncounterDeck：序曲没有遭遇牌库（Haskell hasEncounterDeckL .~ False）；
  //   · calendar：第 3 日/白昼（写入 campaign.records.hemlockDate = '3:day'）；
  //   · survey：resolution2「Make preparations for your final survey」由引擎 finishScenario 自动
  //     结算（保留 1 张支援 / 弃到开手牌 / 资源上限），候选列表由战役层按「未勘察区域」过滤。
  mechanics: {
    noEncounterDeck: true,
    calendar: { maximumDay: 3, record: RECORD_KEYS.hemlockDate, periodByLocationTrait: null },
    // 三种结局（noResolution / resolution1 / resolution2）都收敛到 Resolution 2 的勘察整备。
    survey: { destinations: [...SURVEY_DESTINATIONS] },
  },
  textLanguage: SCENARIO_TEXT.textLanguage,
  textStatus: SCENARIO_TEXT.textStatus,
}

export const identities = identitiesFor(scenario)
// 双面地点：manifest 的 backCode 指向另一面（第 3 日面 / 夜面；十字路口是 Morning/Evening）。
for (const row of LOCATION_TABLE) {
  if (identities.locations[row.id]) {
    identities.locations[row.id] = { ...identities.locations[row.id], linkedOriginalCode: row.backCode }
  }
}
bindScenarioIdentities(scenario, identities)
