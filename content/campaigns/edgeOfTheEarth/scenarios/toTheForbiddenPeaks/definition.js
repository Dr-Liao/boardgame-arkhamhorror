// 失落之峰（To the Forbidden Peaks · 08596）· 剧本数据（scenario 对象只含数据，不含函数）。
//
// 参考：参考实现 `Scenarios/EdgeOfTheEarth/ToTheForbiddenPeaks/Helpers.hs`（row = level，
// `below` = row-1）、locale `scenarios/toTheForbiddenPeaks.json`（setup/resolutions/tokens）、
// `Campaigns/EdgeOfTheEarth/Helpers.hs`（记录键）。卡面数据来自 `src/cards/cards-data.js`，
// 卡牌行为在 `src/cards/encounter-entries/edgeOfTheEarth/toTheForbiddenPeaks/<code>.js`。
//
// 文本来源（P7）：`content/campaigns/edgeOfTheEarth/story-access.js` 的 `chapterSection`；
// story-text 章节正文由 p2-flow 生成，本章不写死剧情正文（缺失时 texts.js 回退到卡片印刷文本）。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { location, stage, printed, identitiesFor, encounterDefinitions } from '../../card-data.js'
import { flattenStory } from '../../story-access.js'
import { storySections, storyTextOf, resolutionTextOf, sectionCountOf } from './texts.js'
import { TO_THE_FORBIDDEN_PEAKS_TOKEN_MEANINGS } from './chaos.js'

export const CHAPTER_ID = 'toTheForbiddenPeaks'
export const REFERENCE_CODE = '08596'

// —— 卡号常量（只做命名，不按卡号写流程分支）——
export const RAW_CODES = Object.freeze({
  scenario: '08596', agenda1: '08597', agenda2: '08598', act1: '08599',
  deepDrifts: '08600', whiteBluff: '08601', steepIncline: '08602', narrowRidge: '08603',
  rockyLedge: '08604', snowCoveredCrag: '08605', windsweptPath: '08606', summit: '08607',
  terrorOfTheStars: '08608', constrictingElderThing: '08609',
  snowfall: '08610', avalanche: '08611', hangingOnTheEdge: '08612', hypothermia: '08613',
  greenSoapstone: '08614', woodenSledge: '08615', dynamite: '08616', miasmicCrystal: '08617',
  mineralSpecimen: '08618', smallRadio: '08619', spareParts: '08620',
})

// 本章遭遇组（camelCase）：参考实现 Setup 的 gather 组合（`gather Set.ToTheForbiddenPeaks` +
// Deadly Weather / Elder Things / Hazards of Antarctica / Nameless Horrors）。Tekeli-li 组单独建
// 忒咳哩-哩牌库（本模块只做数据；牌库初始化不是本章 P0 修复范围）。
export const GATHER_GROUPS = Object.freeze(['toTheForbiddenPeaks', 'deadlyWeather', 'elderThings',
  'hazardsOfAntarctica', 'namelessHorrors'])
export const SHARED_GROUPS = Object.freeze(['deadlyWeather', 'elderThings', 'hazardsOfAntarctica',
  'namelessHorrors', 'tekelili'])

// 山腰地点里随机取 5 个排成斜线（level 0–4），其余 2 个放一边。参考实现是洗牌随机；
// 本实现固定取 08600/08602/08603/08604/08605 作为在场斜线，08601/08606 放一边
// （deterministic 开局的近似，见 behavior.scenarioApproximations）。
export const MOUNTAINSIDE_IN_PLAY = Object.freeze([
  'deepDrifts', 'steepIncline', 'narrowRidge', 'rockyLedge', 'snowCoveredCrag',
])
export const MOUNTAINSIDE_SET_ASIDE = Object.freeze(['whiteBluff', 'windsweptPath'])
export const SUMMIT = 'summit'
export const START_LOCATION = 'deepDrifts'

// 七件 Expedition 剧情支援：开局放一边；按 Campaign Log「Supplies Recovered」入场。
export const EXPEDITION_ASSETS = Object.freeze([
  'greenSoapstone', 'woodenSledge', 'dynamite', 'miasmicCrystal',
  'mineralSpecimen', 'smallRadio', 'spareParts',
])

// 地点：id → 印刷卡号 / level / 连接 / 胜负点。level 就是参考实现的 row（底部 0 → 山顶 5）。
const chain = [START_LOCATION, ...MOUNTAINSIDE_IN_PLAY.slice(1), SUMMIT]
const locationData = (id, code, level, extra = {}) => location({
  id, code,
  cluesFixed: true, clues: ALL_CARDS[code].clues || 0,
  level, connections: [], ...extra,
})
export const LOCATIONS = Object.freeze({
  deepDrifts: locationData('deepDrifts', RAW_CODES.deepDrifts, 0),
  steepIncline: locationData('steepIncline', RAW_CODES.steepIncline, 1),
  narrowRidge: locationData('narrowRidge', RAW_CODES.narrowRidge, 2),
  rockyLedge: locationData('rockyLedge', RAW_CODES.rockyLedge, 3),
  snowCoveredCrag: locationData('snowCoveredCrag', RAW_CODES.snowCoveredCrag, 4),
  summit: locationData('summit', RAW_CODES.summit, 5),
  whiteBluff: locationData('whiteBluff', RAW_CODES.whiteBluff, null),
  windsweptPath: locationData('windsweptPath', RAW_CODES.windsweptPath, null),
})
// 斜线连接：每个地点与上下相邻地点相连（参考 helpers 的 below/inRow；跨一层是攀登原语契约）。
for (let index = 0; index < chain.length; index += 1) {
  const id = chain[index]
  const next = chain[index + 1]
  if (next) {
    LOCATIONS[id].connections.push(next)
    LOCATIONS[next].connections.push(id)
  }
}
for (const [, location] of Object.entries(LOCATIONS)) {
  const card = ALL_CARDS[location.originalCode]
  if (card?.shroud != null) location.shroud = card.shroud
  if (card && Object.hasOwn(card, 'victory')) location.victory = card.victory
}

export const START_LOCATION_ID = START_LOCATION
export const SET_ASIDE_LOCATIONS = Object.freeze([...MOUNTAINSIDE_SET_ASIDE])

// —— 遭遇牌定义（按参考实现 Setup 的 gather 组合：本章组 + 四个战役共享组）——
// 定义统一走 `content/campaigns/edgeOfTheEarth/card-data.js#encounterDefinitions`：
// 诡计会带 `entryRevelation: true`（引擎真实遭遇显现通道，treachery-tokens.js:113）与
// surge/peril；敌人按印刷文本派生 Hunter/Massive/Retaliate 等关键词与猎物。
const IN_RANGE_ENEMIES = [RAW_CODES.terrorOfTheStars, RAW_CODES.constrictingElderThing]
const IN_RANGE_TREACHERIES = [RAW_CODES.snowfall, RAW_CODES.avalanche, RAW_CODES.hangingOnTheEdge, RAW_CODES.hypothermia]
const IN_RANGE_STORY_ASSETS = EXPEDITION_ASSETS.map(id => LOCATIONS[id] ? null : RAW_CODES[id]).filter(Boolean)
export const ENEMY_CODES = Object.freeze(IN_RANGE_ENEMIES)
export const TREACHERY_CODES = Object.freeze(IN_RANGE_TREACHERIES)
export const ASSET_CODES = Object.freeze(IN_RANGE_STORY_ASSETS)

const snakeOf = value => String(value).replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase()
const GATHER_SNAKES = new Set(GATHER_GROUPS.map(snakeOf))
// 共享组的卡按卡表 encounterCode 归属现算（不手抄第二份事实源）。
const gatheredCards = Object.entries(ALL_CARDS).filter(([, card]) =>
  card.pack === 'eoec' && GATHER_SNAKES.has(card.encounterCode)
  && ['enemy', 'treachery'].includes(card.type))
const gatheredCodes = gatheredCards.map(([code]) => code)
const definitions = encounterDefinitions([...gatheredCodes, ...IN_RANGE_STORY_ASSETS])

// 本章专属 4 张诡计不写 encounterResolve/test，结算在 behavior.resolveEncounter（按
// treacheryRule.resolveKind 分派）：定义里声明 `effect.kind:"campaignRule"`，引擎的
// treachery-tokens.js:124 才会把显现交给章节 behavior —— 否则真实遭遇零结算（P0-8）。
const CAMPAIGN_RULE_TREACHERIES = new Set(IN_RANGE_TREACHERIES)
export const enemies = Object.freeze({ ...definitions.enemies })
export const treacheries = Object.freeze(Object.fromEntries(Object.entries(definitions.treacheries).map(
  ([code, definition]) => [code, CAMPAIGN_RULE_TREACHERIES.has(code)
    ? { ...definition, effect: { kind: 'campaignRule' } }
    : definition])))
export const storyAssets = Object.freeze({ ...definitions.storyAssets })

// 初始遭遇牌库：gather 组里的敌人/诡计按印刷份数展开（星之恐怖是放一边的剧情敌人，不进牌库）。
// 修复前只展开本章段内 14 张，共享组（ Deadly Weather / Elder Things / Hazards of Antarctica /
// Nameless Horrors）实际零张 → 抽到共享卡即「未知遭遇卡」。
const SET_ASIDE_CARD_CODES = new Set([RAW_CODES.terrorOfTheStars, ...IN_RANGE_STORY_ASSETS])
const deckCards = gatheredCards.filter(([code]) => !SET_ASIDE_CARD_CODES.has(code))
export const ENCOUNTER_DECK = Object.freeze(deckCards.flatMap(([code, card]) =>
  Array(card.quantity || 1).fill(code)))

// 开局放一边：2 个山腰地点（地点身份，走 setAsideLocations）+ 星之恐怖 + 未回收的 7 件探险支援。
// 探险支援的入场/移出由 behavior.afterDeckSetup 按战役记录「Supplies Recovered」结算。
export const SET_ASIDE_CODES = Object.freeze([
  ...MOUNTAINSIDE_SET_ASIDE.map(id => LOCATIONS[id].code),
  RAW_CODES.terrorOfTheStars,
])
// 只有「星之恐怖」是放一边的实体卡；山腰地点由 manifest.setAsideLocations 单独声明。
export const SET_ASIDE_ALIASES = Object.freeze([RAW_CODES.terrorOfTheStars])

// —— 幕 / 议程（纯数据；chapterFlow 由 behavior 读）——
const actDefinition = (code, extra) => {
  const card = ALL_CARDS[code]
  return {
    ...stage(code, { number: 1 }), id: 'act1', originalCode: code,
    name: card.nameZh || card.name, nameEn: card.name,
    text: card.textZh || card.text || '',
    ...extra,
  }
}
const agendaDefinition = (code, number, extra) => {
  const card = ALL_CARDS[code]
  return {
    ...stage(code, { number, doom: card.doom }), id: `agenda${number}`, originalCode: code,
    name: card.nameZh || card.name, nameEn: card.name,
    text: card.textZh || card.text || '',
    backText: card.backTextZh || card.backText || '',
    ...extra,
  }
}
export const acts = Object.freeze([
  actDefinition(RAW_CODES.act1, { objective: { type: 'allResigned' }, chapterFlow: 'ascendTheMountain' }),
])
export const agendas = Object.freeze([
  agendaDefinition(RAW_CODES.agenda1, 1, { chapterFlow: 'forbiddenPeaks' }),
  agendaDefinition(RAW_CODES.agenda2, 2, { chapterFlow: 'terrorPrevails' }),
])

// —— 结局：参考 locale resolutions；正文来自 story-access（p2-flow 生成） ——
const sections = storySections(CHAPTER_ID) || {}
const introText = [flattenStory(sections.intro1), flattenStory(sections.intro2)].filter(Boolean).join('\n\n')
export const resolutions = Object.freeze({
  noResolution: resolutionTextOf(CHAPTER_ID, 'resolutions.noResolution', '所有调查员都被击败。'),
  resolution1: resolutionTextOf(CHAPTER_ID, 'resolutions.resolution1', '调查员们找到了通路。'),
  resolution2: resolutionTextOf(CHAPTER_ID, 'resolutions.resolution2', '调查员们未能到达山顶。'),
})

export const SCENARIO_TEXT = Object.freeze({
  textLanguage: 'zh-CN',
  textStatus: 'translated (self-translated)',
  sectionCount: sectionCountOf(CHAPTER_ID),
  introTitle: flattenStory(sections.heading) || '失落之峰',
  intro: introText,
  setup: storyTextOf(CHAPTER_ID, 'setup', ''),
  specialRules: storyTextOf(CHAPTER_ID, 'interlude', ''),
})

export const scenario = Object.freeze({
  id: CHAPTER_ID,
  originalCode: REFERENCE_CODE,
  name: ALL_CARDS[REFERENCE_CODE].nameZh || ALL_CARDS[REFERENCE_CODE].name,
  nameEn: ALL_CARDS[REFERENCE_CODE].name,
  referenceCode: REFERENCE_CODE,
  migrationStatus: 'development',
  startLocation: START_LOCATION,
  locations: LOCATIONS,
  setAsideLocations: SET_ASIDE_LOCATIONS,
  enemies, treacheries, storyAssets,
  acts, agendas, resolutions,
  encounterDeck: ENCOUNTER_DECK,
  tokenMeanings: TO_THE_FORBIDDEN_PEAKS_TOKEN_MEANINGS,
  ...SCENARIO_TEXT,
})

export const identities = Object.freeze(identitiesFor(scenario))

// 审计/覆盖用：本章单卡条目的原卡号（参考卡 08596 不建条目）。
export const CHAPTER_ENTRY_CODES = Object.freeze([
  RAW_CODES.agenda1, RAW_CODES.agenda2, RAW_CODES.act1,
  ...Object.values(LOCATIONS).map(location => location.originalCode),
  ...ENEMY_CODES, ...TREACHERY_CODES, ...ASSET_CODES,
])
export const entryCodes = () => CHAPTER_ENTRY_CODES
export const enemyCodesFor = () => ENEMY_CODES

// 供 manifest / 测试复用的常量。
export const RECORD_READS = Object.freeze(['suppliesRecovered', 'theInvestigatorsScoutedTheMountainPass'])
// 参考实现 ScenarioResolution：结局 1 记录「队伍爬上了山顶」，结局 2 记录「队伍找到了另一条翻山的路」
// （Key.hs 的 theTeamClimbedToTheSummit / theTeamFoundAnotherWayThroughTheMountains）。
export const RECORD_WRITES = Object.freeze(['theInvestigatorsScoutedTheMountainPass',
  'theTeamClimbedToTheSummit', 'theTeamFoundAnotherWayThroughTheMountains'])

// 忒咳哩-哩弱点牌库：参考 Setup `gather Set.Tekelili` + `addTekeliliDeck`（7 卡面 × 印刷份数
// 3+3+2+2+2+2+2 = 16）。与普通遭遇牌库分开（P0-8 的「按 gatherSets 组牌库」口径）。
export const TEKELI_FACES = Object.freeze(['08723', '08724', '08725', '08726', '08727', '08728', '08729'])
export const TEKELI_COPIES = Object.freeze([3, 3, 2, 2, 2, 2, 2])
export { printed }
