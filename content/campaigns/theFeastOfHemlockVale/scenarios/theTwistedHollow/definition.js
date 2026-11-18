// 扭曲空洞（theTwistedHollow · 提示卡 10605，西部树林）· 章节数据（scenario 只含数据）。
//
// 参考：Scenario/Scenarios/TheFeastOfHemlockVale/TheTwistedHollow.hs +
//       Act|Agenda|Location|Enemy|Treachery/CardDefs/TheFeastOfHemlockVale/TheTwistedHollow.hs +
//       Act|Agenda|Location|Enemy|Treachery/Cards/TheFeastOfHemlockVale/TheTwistedHollow/*.hs +
//       Asset/Assets/ValeLantern{BeaconOfHope,AFaintHope}.hs +
//       frontend/src/locales/en/theFeastOfHemlockVale/theTwistedHollow.json（印刷指南）+
//       story-text.js（经 story-access.js 读取）。
//
// 卡号归属：本章专属组 the_twisted_hollow（10605–10625 含 a/b 面；顺序号 10607a=幕 1、
// 10607b=类熊混种背面、10609=特殊议程「回到山谷！」）。地点/幕/议程按本批约定不建行为条目，
// 地点规则与剧本流程在 behavior.js；敌人/诡计/剧情资产/地点/幕/议程的数据型单卡条目在
// src/cards/encounter-entries/theFeastOfHemlockVale/theTwistedHollow/。
//
// 三个关键形状（与参考实现一致）：
//   · 地点连接不是印刷连线，而是「网格相邻即相连」（Haskell 每张地点都 connectsToAdjacent）。
//     因此 LOCATION_CONNECTIONS 全为空表，运行期由 behavior.syncConnections 按网格重算；
//     坐标同样在运行期确定（layout.js 只声明「起始格 + 四方向」的槽位规则）。
//   · 西部树林（Western Woods）共 15 张地点（含扭曲空洞与荧光草地），构成独立「树林牌库」；
//     未揭示面统一是 Western Woods，翻面即各自的已揭示面。
//   · 黑暗等级（Darkness Level）不是引擎标记池，唯一读点是 scenarioFlags.twistedHollowDarkness
//     （见 chaos.js）。
import { bindScenarioIdentities } from '../../../../identities.js'
import { location, stage, encounterDefinitions, identitiesFor, encounterGroupDeck } from '../../card-data.js'
import { chapterStory, flattenStory } from '../../story-access.js'
import { TWISTED_HOLLOW_TOKEN_MEANINGS } from './chaos.js'

export const CHAPTER_ID = 'theTwistedHollow'
export const REFERENCE_CODE = '10605'

// 幕牌库：幕 1「冥思苦想」10607a（背面就是类熊混种 10607b），幕 2「伯蒂在哪儿？」10608；
// 特殊议程「回到山谷！」10609 在幕 2 背面之后同时作为当前幕与当前议程（stage 3）。
export const ACT_CODES = Object.freeze(['10607a', '10608'])
export const AGENDA_CODES = Object.freeze(['10606'])
export const SPECIAL_AGENDA_CODE = '10609'
export const ACT_CODE_BY_STAGE = Object.freeze({ 1: ACT_CODES[0], 2: ACT_CODES[1], 3: SPECIAL_AGENDA_CODE })
export const AGENDA_CODE_BY_STAGE = Object.freeze({ 1: AGENDA_CODES[0], 3: SPECIAL_AGENDA_CODE })
// 类熊混种（发光异形）10607b：放一边的剧本敌人（幕 1 的物理背面）。
export const URSINE_HYBRID_CODE = '10607b'
export const URSINE_HYBRID_CODES = Object.freeze(['10607b'])
// 剧情资产：山谷提灯两个版本（Boon=母亲瑞秋指路 / 无 Boon=调查员迷失方向），各双面。
export const LANTERN_SPEC = Object.freeze({
  boon: Object.freeze({ lit: '10610a', unlit: '10610b', traits: ['Item', 'Tool', 'Lit', 'Boon'] }),
  plain: Object.freeze({ lit: '10611a', unlit: '10611b', traits: ['Item', 'Tool', 'Lit'] }),
})
export const LANTERN_CODES = Object.freeze(['10610a', '10610b', '10611a', '10611b'])
export const STORY_CODES = Object.freeze([...LANTERN_CODES])
// 居民遭遇组（resident，由共享遭遇组 worker 落条目）：本章只引用身份，不重复定义。
export const RESIDENTS = Object.freeze({
  motherRachel: '10693', judithPark: '10699', theoPeters: '10700', bertieMusgrave: '10701', drRosaMarquez: '10702',
})
export const DR_MARQUEZ_CODE = RESIDENTS.drRosaMarquez
export const BERTIE_CODE = RESIDENTS.bertieMusgrave
export const JUDITH_CODE = RESIDENTS.judithPark
export const THEO_CODE = RESIDENTS.theoPeters

// Setup 的四个 gather 组（指南 setup.gatherSets）：先遣之日 / 扭曲空洞 / 森林 / 菌类。
export const GATHER_GROUPS = Object.freeze(['theFirstDay', 'theTwistedHollow', 'theForest', 'myconids'])
// 本章没有「整组收集后整体放一边」的遭遇组（放一边的是个别剧本卡），保留常量统一形状。
export const GATHER_SET_ASIDE_GROUPS = Object.freeze([])
// 牌库里的普通敌人/诡计（按印刷份数展开）——放一边的类熊混种不进牌库。
export const ENCOUNTER_DECK = Object.freeze(encounterGroupDeck(GATHER_GROUPS, { exclude: [...URSINE_HYBRID_CODES] }))
export const ENCOUNTER_DECK_CODES = Object.freeze([...new Set(ENCOUNTER_DECK)])

// 放一边（setup 起始状态）：类熊混种、特殊议程、伯蒂、提灯两面各一版、关系等级不足的居民。
export const SET_ASIDE_CARDS = Object.freeze([
  URSINE_HYBRID_CODE, SPECIAL_AGENDA_CODE, BERTIE_CODE, JUDITH_CODE, THEO_CODE, ...LANTERN_CODES,
])

// ---------------------------------------------------------------------------
// 地点：15 张西部树林（同一印刷卡多份时按份数各给一个物理 id）。
// [id, code, 是否固定线索, 线索数, 额外字段]
// ---------------------------------------------------------------------------
export const LOCATION_TABLE = Object.freeze([
  ['glimmeringWoods', '10612', true, 0],
  ['blightedGlade', '10613', false, 1],
  ['blightedGlade2', '10613', false, 1],
  ['poisonedMarsh', '10614', false, 1],
  ['poisonedMarsh2', '10614', false, 1],
  ['fecundThicket', '10615', false, 1],
  ['mushroomGrove', '10616', false, 1],
  ['mushroomGrove2', '10616', false, 1],
  ['moonlitClearing', '10617', false, 1],
  ['crookedPath', '10618', true, 1],
  ['crookedPath2', '10618', true, 1],
  ['crookedPath3', '10618', true, 1],
  ['corpseGrove', '10619', false, 1],
  ['bearDen', '10620', false, 1],
  ['theTwistedHollow', '10621', false, 1],
])

const CODE_BY_LOCATION = Object.freeze(Object.fromEntries(LOCATION_TABLE.map(([id, code]) => [id, code])))
export const LOCATION_IDS = Object.freeze(LOCATION_TABLE.map(([id]) => id))
// 西部树林（可进树林牌库的地点；扭曲空洞默认放一边，荧光草地按分支决定是否在场）。
export const WESTERN_WOODS_IDS = Object.freeze(LOCATION_IDS.filter(id => id !== 'theTwistedHollow'))
export const TWISTED_HOLLOW_LOCATION_ID = 'theTwistedHollow'
export const GLIMMERING_WOODS_ID = 'glimmeringWoods'
export const SET_ASIDE_LOCATIONS = Object.freeze([TWISTED_HOLLOW_LOCATION_ID])

// 印刷连接为空表：每张地点都按「与相邻格共享边即相连」结算（Haskell connectsToAdjacent）。
// 运行期唯一重算入口是 behavior.syncConnections；表本身只用于「这张地点有没有印刷连线」。
export const LOCATION_CONNECTIONS = Object.freeze(Object.fromEntries(LOCATION_IDS.map(id => [id, Object.freeze([])])))
// 坐标在布置时按网格写入 scenarioFlags（layout.js 声明槽位规则）；这里不放静态坐标。
export const LOCATION_COORDINATES = Object.freeze({})

// 坐标/网格常量（layout.js 与 behavior 共用）。
export const DIRECTION_VECTORS = Object.freeze({
  north: Object.freeze({ x: 0, y: -1 }), east: Object.freeze({ x: 1, y: 0 }),
  south: Object.freeze({ x: 0, y: 1 }), west: Object.freeze({ x: -1, y: 0 }),
})
export const START_SLOT = Object.freeze({ x: 0, y: 0 })
// 幕 2 背面「按第 36 页示意图」放置 13 张树林地点（相对扭曲空洞 (0,0) 的偏移）。
export const ACT2_GRID_OFFSETS = Object.freeze([
  { x: -1, y: 0 }, { x: 1, y: 0 },
  { x: -2, y: -1 }, { x: -1, y: -1 }, { x: 0, y: -1 }, { x: 1, y: -1 }, { x: 2, y: -1 },
  { x: -2, y: 1 }, { x: -1, y: 1 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 },
  { x: 0, y: 2 },
])

// 地点定义：印刷数据（名字/卡文/特性/帷幕）全部来自 card-data 的 location()；
// 帷幕的剧本修正（含 X=黑暗等级）在 behavior.locationShroudModifier。
function makeLocation([id, code, cluesFixed, clues], extra = {}) {
  return location({ id, code, cluesFixed, clues, connections: [], ...extra })
}
export const LOCATIONS = Object.freeze(Object.fromEntries(LOCATION_TABLE.map(row => {
  const [id, code] = row
  const extra = {}
  if (id === GLIMMERING_WOODS_ID) extra.resign = true
  // 扭曲空洞的胜利点（Haskell: victory 1）。
  if (code === '10621') { extra.hasVictory = true; extra.victory = 1 }
  // 扭曲小路印刷「Shroud: X（X=黑暗等级）」：卡表把 X 记成 -2，运行期以 behavior 的
  // locationShroudModifier 给 0 + 黑暗等级，这里把基数改成 0，避免 -2 + X 的错值。
  if (code === '10618') extra.shroud = 0
  return [id, makeLocation(row, extra)]
})))

// 幕/议程阶段。幕 1 的目标（轮末、全员同一[[巢穴]]地点、共同支付 3[per_investigator] 线索）
// 由 behavior.checkObjectives 结算（「同一巢穴」不是引擎 objective 能表达的谓词），
// 因此 roundEndActIndex 保留 null（不交给引擎的线索支付窗口），objective 只作展示数据。
export const ACT_STAGES = Object.freeze({
  1: Object.freeze({ ...stage(ACT_CODES[0]), objective: Object.freeze({ type: 'clues', perInvestigator: 3, lairOnly: true }) }),
  2: Object.freeze(stage(ACT_CODES[1])),
  3: Object.freeze({
    ...stage(SPECIAL_AGENDA_CODE), id: `act${SPECIAL_AGENDA_CODE}`, type: 'act',
    objective: Object.freeze({ type: 'allResigned' }),
  }),
})
export const AGENDA_STAGES = Object.freeze({
  1: Object.freeze({ ...stage(AGENDA_CODES[0]), stageNumber: 1 }),
  3: Object.freeze({ ...stage(SPECIAL_AGENDA_CODE), stageNumber: 3 }),
})

// scenario 里的幕/议程实例必须是可变副本：identities.js 会把原卡身份写回定义对象。
export const ACTS = Object.freeze([structuredClone(ACT_STAGES[1]), structuredClone(ACT_STAGES[2])])
export const AGENDAS = Object.freeze([structuredClone(AGENDA_STAGES[1])])
// `api.setActDeckCards` / `api.setAgendaDeckCards` 从 state.scenario.stageCards 实例化卡牌；
// 特殊议程同时需要「作为幕」的实例（Haskell: it is both the current act and the current agenda）。
export const STAGE_CARDS = Object.freeze(Object.fromEntries([
  ...['10607a', '10608'].map(code => [code, Object.freeze(stage(code))]),
  [SPECIAL_AGENDA_CODE, Object.freeze(stage(SPECIAL_AGENDA_CODE))],
]))
export const SPECIAL_ACT_STAGE = Object.freeze(structuredClone(ACT_STAGES[3]))

// 遭遇定义：牌库卡 + 放一边的类熊混种 + 提灯剧情资产。
// 数值修正：卡表把猎踪混种的「X 生命值」记成 -2、伤害/恐惧记成 0（印刷是 1/1），
// 生命值 X 由 behavior.enemyStatModifier('health') 按黑暗等级补上；类熊混种的
// +2[per_investigator] 生命值同样由该钩子提供。
const ENEMY_OVERRIDES = Object.freeze({
  '10625': Object.freeze({ health: 0, damage: 1, horror: 1 }),
})
const rawDefinitions = encounterDefinitions([...ENCOUNTER_DECK_CODES, URSINE_HYBRID_CODE, ...LANTERN_CODES])
const definitions = {
  ...rawDefinitions,
  enemies: Object.fromEntries(Object.entries(rawDefinitions.enemies)
    .map(([code, def]) => [code, ENEMY_OVERRIDES[code] ? { ...def, ...ENEMY_OVERRIDES[code] } : def])),
}

// ---------------------------------------------------------------------------
// 剧情正文（story-access 生成物）：本指南目前只有英文源（zh locale 缺失），
// 因此 textLanguage 标 'en' 而不是伪装成中文；卡面数据仍是中文印刷。
// ---------------------------------------------------------------------------
const safeChapterStory = id => {
  try {
    return chapterStory(id) || {}
  } catch {
    return {}
  }
}
const STORY = safeChapterStory(CHAPTER_ID)
const SECTIONS = STORY.sectionsEn || {}
const text = value => flattenStory(value)
const blocks = (...parts) => parts.map(text).filter(Boolean).join('\n\n')
/** 把 `setup.valeLantern.showedTheWay` 这类点号键收成嵌套对象。 */
function nest(entries) {
  const out = {}
  for (const [key, value] of entries) {
    const parts = String(key).split('.')
    let node = out
    for (const part of parts.slice(0, -1)) node = node[part] ||= {}
    node[parts[parts.length - 1]] = value
  }
  return out
}
const group = prefix => Object.freeze(nest(Object.entries(SECTIONS)
  .filter(([key]) => key === prefix || key.startsWith(`${prefix}.`))
  .map(([key, value]) => [key === prefix ? 'body' : key.slice(prefix.length + 1), text(value)])))
const specialRuleKeys = Object.keys(SECTIONS).filter(key => /^specialRules\[\d+\]\./.test(key))
const specialRuleIndexes = [...new Set(specialRuleKeys.map(key => Number(/^specialRules\[(\d+)\]/.exec(key)[1])))].sort((a, b) => a - b)

const SETUP_SECTIONS = group('setup')
export const SCENARIO_TEXT = Object.freeze({
  textLanguage: 'en',
  textStatus: 'english-only (source zh locale missing)',
  heading: text(SECTIONS['intro.title']),
  intro: text(SECTIONS['intro.intro1']),
  labels: Object.freeze({
    tellTheTruth: text(SECTIONS['intro.label.tellTheTruth']),
    lie: text(SECTIONS['intro.label.lie']),
  }),
  introBranches: Object.freeze({
    showedTheWay: text(SECTIONS['intro.intro2']),
    lostThePath: text(SECTIONS['intro.intro3']),
  }),
  setup: Object.values(SETUP_SECTIONS).map(value => text(value)).filter(Boolean).join('\n\n'),
  setupSections: SETUP_SECTIONS,
  specialRules: Object.freeze(specialRuleIndexes.map(index => Object.freeze({
    title: text(SECTIONS[`specialRules[${index}].title`]),
    body: text(SECTIONS[`specialRules[${index}].body`]),
  })).filter(rule => rule.title || rule.body)),
  rules: Object.freeze({
    darknessLevel: Object.freeze({ title: text(SECTIONS['specialRules[0].title']), body: text(SECTIONS['specialRules[0].body']) }),
    adjacency: Object.freeze({ title: text(SECTIONS['specialRules[1].title']), body: text(SECTIONS['specialRules[1].body']) }),
    pursuit: Object.freeze({ title: text(SECTIONS['specialRules[2].title']), body: text(SECTIONS['specialRules[2].body']) }),
  }),
  codex: group('codex'),
  setupTooltips: group('tooltips'),
  labels2: group('label'),
  poisonedMarsh: group('poisonedMarsh'),
  resolutions: Object.freeze(nest(Object.entries(SECTIONS)
    .filter(([key]) => key.startsWith('resolutions.'))
    .map(([key, value]) => [key.slice('resolutions.'.length), text(value)]))),
})
const resolutionText = key => {
  const entry = SCENARIO_TEXT.resolutions[key]
  if (!entry) return ''
  return typeof entry === 'string' ? entry : blocks(entry.title, entry.body)
}

export const scenario = {
  id: CHAPTER_ID,
  originalCode: REFERENCE_CODE,
  referenceCode: REFERENCE_CODE,
  name: '扭曲空洞 · The Twisted Hollow',
  nameEn: 'The Twisted Hollow',
  intro: SCENARIO_TEXT.intro,
  setup: SCENARIO_TEXT.setup,
  specialRules: SCENARIO_TEXT.specialRules,
  rules: SCENARIO_TEXT.rules,
  startLocation: GLIMMERING_WOODS_ID,
  locations: LOCATIONS,
  setAsideLocations: [...SET_ASIDE_LOCATIONS],
  acts: ACTS,
  agendas: AGENDAS,
  stageCards: STAGE_CARDS,
  ...definitions,
  encounterDeck: [...ENCOUNTER_DECK],
  resolutions: {
    noResolution: resolutionText('noResolution'),
    resolution1: resolutionText('resolution1'),
    resolution2: resolutionText('resolution2'),
    resolution3: resolutionText('resolution3'),
    standalone: resolutionText('standalone'),
  },
  tokenMeanings: {
    easy: { ...TWISTED_HOLLOW_TOKEN_MEANINGS.easy }, standard: { ...TWISTED_HOLLOW_TOKEN_MEANINGS.standard },
    hard: { ...TWISTED_HOLLOW_TOKEN_MEANINGS.hard }, expert: { ...TWISTED_HOLLOW_TOKEN_MEANINGS.expert },
  },
  textLanguage: SCENARIO_TEXT.textLanguage,
  textStatus: SCENARIO_TEXT.textStatus,
}

export const identities = identitiesFor(scenario)
bindScenarioIdentities(scenario, identities)

export const CARD_DATA = Object.freeze(Object.fromEntries([
  REFERENCE_CODE, ...ACT_CODES, SPECIAL_AGENDA_CODE, URSINE_HYBRID_CODE, ...LANTERN_CODES, ...LOCATION_IDS.map(id => CODE_BY_LOCATION[id]),
].map(code => [code, { code, originalCode: code }])))

export { CODE_BY_LOCATION, definitions }
