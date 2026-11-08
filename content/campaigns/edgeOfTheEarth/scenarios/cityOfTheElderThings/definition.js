// 古老者之城（City of the Elder Things · 08621）· 剧本数据（scenario 对象只含数据，不含函数）。
//
// 参考：参考实现 `Scenarios/EdgeOfTheEarth/CityOfTheElderThings/Helpers.hs`（三套 city grid
// setup1Positions/setup2Positions/setup3Positions，16 格）、locale
// `scenarios/cityOfTheElderThings.json`（setup v1/v2/v3、specialRules.Keys、resolutions）、
// `Campaigns/EdgeOfTheEarth/Helpers.hs`（记录键）。卡面事实源 `src/cards/cards-data.js`。
//
// 城市景观（16 张）＝ 08631–08640 的印刷地点卡（含 3×石桥、2×迷宫房间、2×破败街道、
// 2×埋没通路、2×古老者之庙 = 16 张）；08630 隐秘隧道单独放在地图外。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { location, stage, identitiesFor, encounterDefinitions, encounterGroupCode } from '../../card-data.js'
import { chapterStory } from '../../story-access.js'
import { storySections, citySetupText, storyTextOf, resolutionTextOf, sectionCountOf } from './texts.js'
import { CITY_OF_THE_ELDER_THINGS_TOKEN_MEANINGS } from './chaos.js'

export const CHAPTER_ID = 'cityOfTheElderThings'
export const REFERENCE_CODE = '08621'

export const RAW_CODES = Object.freeze({
  scenario: '08621', agenda1: '08622', agenda2: '08623',
  act1v1: '08624', act1v2: '08625', act1v3: '08626',
  act2v1: '08627', act2v2: '08628', act2v3: '08629',
  hiddenTunnel: '08630', ancientPlanetarium: '08631', stoneBridge: '08632', cylindricalTower: '08633',
  labyrinthineChamber: '08634', mapRoom: '08635', rooflessRampart: '08636', ruinousStreets: '08637',
  cyclopeanSpires: '08638', submergedPassageway: '08639', templeOfTheElderThings: '08640',
  terrorOfTheStars: '08641', benignElderThing: '08642', reawakenedElderThing: '08643',
  dawningOfTheTruth: '08644', crumblingRuins: '08645', frostbitten: '08646', possessed: '08647',
})

export const GATHER_GROUPS = Object.freeze(['cityOfTheElderThings'])
export const SHARED_GROUPS = Object.freeze([
  'elderThings', 'miasma', 'namelessHorrors', 'penguins', 'shoggoths', 'tekelili', 'lockedDoors',
  'creaturesInTheIce', 'silenceAndMystery', 'chillingCold',
])

// 16 张城市景观地点：id → 印刷卡号（重复卡各给独立 id）。
const CITY_LOCATION_SLOTS = Object.freeze([
  ['ancientPlanetarium', RAW_CODES.ancientPlanetarium],
  ['stoneBridge1', RAW_CODES.stoneBridge], ['stoneBridge2', RAW_CODES.stoneBridge], ['stoneBridge3', RAW_CODES.stoneBridge],
  ['cylindricalTower', RAW_CODES.cylindricalTower],
  ['labyrinthineChamber1', RAW_CODES.labyrinthineChamber], ['labyrinthineChamber2', RAW_CODES.labyrinthineChamber],
  ['mapRoom', RAW_CODES.mapRoom], ['rooflessRampart', RAW_CODES.rooflessRampart],
  ['ruinousStreets1', RAW_CODES.ruinousStreets], ['ruinousStreets2', RAW_CODES.ruinousStreets],
  ['cyclopeanSpires', RAW_CODES.cyclopeanSpires],
  ['submergedPassageway1', RAW_CODES.submergedPassageway], ['submergedPassageway2', RAW_CODES.submergedPassageway],
  ['templeOfTheElderThings1', RAW_CODES.templeOfTheElderThings], ['templeOfTheElderThings2', RAW_CODES.templeOfTheElderThings],
])
export const CITY_LOCATION_IDS = Object.freeze(CITY_LOCATION_SLOTS.map(([id]) => id))
export const HIDDEN_TUNNEL = 'hiddenTunnel'
export const CITYSCAPE_IDS = CITY_LOCATION_IDS

// 参考 setup1Positions（Pos 的第一个分量是列、第二个是行；-2..2 → 归一化 0..4）。
// 三套 setup 的格子数都是 16；本实现按版本提供三套坐标，行为层用 eote-city/grid-map 原语建图。
const positions1 = [
  [-1, -2], [0, -2], [-1, -1], [0, -1], [1, -1], [2, -1],
  [-2, 0], [-1, 0], [1, 0], [2, 0], [-2, 1], [-1, 1], [0, 1], [1, 1], [0, 2], [1, 2],
]
const positions2 = [
  [-1, -1], [0, -1], [1, -1],
  [-2, -2], [-1, -2], [0, -2], [1, -2], [2, -2],
  [-3, -3], [-2, -3], [2, -3], [3, -3],
  [-4, -4], [-3, -4], [3, -4], [4, -4],
]
const positions3 = [
  [-7, 4], [-6, 4], [-7, 3], [-6, 3], [-5, 3], [-4, 3],
  [-5, 2], [-4, 2], [-3, 2], [-2, 2], [-4, 1], [-3, 1], [-2, 1], [-1, 1], [-2, 0], [-1, 0],
]
const normalize = positions => {
  const minX = Math.min(...positions.map(([x]) => x))
  const minY = Math.min(...positions.map(([, y]) => y))
  return positions.map(([x, y]) => ({ column: x - minX, row: y - minY }))
}
export const CITY_LAYOUTS = Object.freeze({
  v1: normalize(positions1),
  v2: normalize(positions2),
  v3: normalize(positions3),
})

const locationData = id => {
  const code = CITY_LOCATION_SLOTS.find(([slot]) => slot === id)?.[1] || RAW_CODES.hiddenTunnel
  const card = ALL_CARDS[code]
  return location({
    id, code,
    cluesFixed: false, clues: card.clues || 0,
    // `card-data.js#location()` 目前不复制印刷帷幕；这里显式带上，避免真实调查难度 NaN。
    ...(card.shroud != null ? { shroud: card.shroud } : {}),
    ...(Object.hasOwn(card, 'victory') ? { hasVictory: true, victory: card.victory } : {}),
    connections: [],
  })
}
export const LOCATIONS = Object.freeze(Object.fromEntries([
  [HIDDEN_TUNNEL, location({
    id: HIDDEN_TUNNEL, code: RAW_CODES.hiddenTunnel, cluesFixed: true,
    clues: ALL_CARDS[RAW_CODES.hiddenTunnel].clues || 0,
    ...(ALL_CARDS[RAW_CODES.hiddenTunnel].shroud != null
      ? { shroud: ALL_CARDS[RAW_CODES.hiddenTunnel].shroud } : {}),
    hasVictory: true, victory: ALL_CARDS[RAW_CODES.hiddenTunnel].victory || 1, connections: [],
  })],
  ...CITY_LOCATION_SLOTS.map(([id]) => [id, locationData(id)]),
]))

export const START_LOCATION = 'stoneBridge1'
export const START_LOCATION_BY_VERSION = Object.freeze({ v1: 'stoneBridge1', v2: 'cyclopeanSpires', v3: 'stoneBridge3' })

// 遭遇牌：本章段内的敌人/诡计（共享组由 requiredEncounterGroupIds 声明）。
export const ENEMY_CODES = Object.freeze([RAW_CODES.terrorOfTheStars, RAW_CODES.benignElderThing, RAW_CODES.reawakenedElderThing])
export const TREACHERY_CODES = Object.freeze([
  RAW_CODES.dawningOfTheTruth, RAW_CODES.crumblingRuins, RAW_CODES.frostbitten, RAW_CODES.possessed,
])
export const ASSET_CODES = Object.freeze([])

const enemyDefinition = code => {
  const card = ALL_CARDS[code]
  return {
    code, originalCode: code, name: card.nameZh || card.name, nameEn: card.name,
    subname: card.subnameZh || card.subname || '', text: card.textZh || card.text || '',
    traits: [...(card.traits || [])], fight: card.fight ?? null, evade: card.evade ?? null,
    health: card.health ?? null, ...(card.healthPerInvestigator ? { healthPerInvestigator: true } : {}),
    damage: card.damage || 0, horror: card.horror || 0,
    ...(Object.hasOwn(card, 'victory') ? { victory: card.victory } : {}),
    elite: (card.traits || []).includes('Elite'),
    hunter: /\bHunter\b/.test(card.text || ''), massive: /\bMassive\b/.test(card.text || ''),
  }
}
const treacheryDefinitions = encounterDefinitions(TREACHERY_CODES).treacheries
const treacheryDefinition = code => ({
  ...treacheryDefinitions[code],
  // 引擎（treachery-tokens.js#resolveTreacheryBody）只对 `entry.encounterResolve` /
  // `entry.treacheryRule.test` / `effect.kind === 'campaignRule'` 走内容结算：本章 4 张
  // 诡计由 behavior.TREACHERY_HANDLERS（treacheryRule.resolveKind）分派，因此必须声明
  // `effect.kind = 'campaignRule'`，否则真实遭遇抽到后与「零结算」相同。
  effect: { kind: 'campaignRule' },
})
export const enemies = Object.freeze(Object.fromEntries(ENEMY_CODES.map(code => [code, enemyDefinition(code)])))
export const treacheries = Object.freeze(Object.fromEntries(TREACHERY_CODES.map(code => [code, treacheryDefinition(code)])))
export const storyAssets = Object.freeze({})

export const VERSIONS = Object.freeze(['v1', 'v2', 'v3'])

// —— 遭遇牌：按版本 gather（参考 locale setup.v1/v2/v3 与 CityOfTheElderThings.hs DoStep 1/2/3）——
// gather 组 → 卡号：权威来源是卡表 encounterCode + 印刷 quantity，不抄第二份卡表。
function groupCardsOf(group) {
  const code = encounterGroupCode(group)
  return Object.entries(ALL_CARDS)
    .filter(([, card]) => card.encounterCode === code && ['enemy', 'treachery'].includes(card.type))
}
function expandGroupCards(group) {
  return groupCardsOf(group).flatMap(([code, card]) => Array(card.quantity || 1).fill(code))
}
export const ENCOUNTER_GROUPS_BY_VERSION = Object.freeze({
  v1: Object.freeze(['cityOfTheElderThings', 'elderThings', 'miasma', 'namelessHorrors', 'penguins', 'shoggoths', 'lockedDoors']),
  v2: Object.freeze(['cityOfTheElderThings', 'creaturesInTheIce', 'elderThings', 'namelessHorrors', 'penguins', 'silenceAndMystery', 'chillingCold']),
  v3: Object.freeze(['cityOfTheElderThings', 'creaturesInTheIce', 'miasma', 'penguins', 'shoggoths', 'chillingCold', 'lockedDoors']),
})
export const SET_ASIDE_GROUPS_BY_VERSION = Object.freeze({
  v1: Object.freeze(['shoggoths']),
  v2: Object.freeze(['creaturesInTheIce']),
  v3: Object.freeze(['shoggoths']),
})
// 各版本从游戏中移除的敌人（removeEvery：整组所有印刷份数一起移除；参考 setup.removals）。
export const REMOVED_BY_VERSION = Object.freeze({
  v1: Object.freeze([RAW_CODES.benignElderThing]),
  v2: Object.freeze([RAW_CODES.terrorOfTheStars, RAW_CODES.benignElderThing]),
  v3: Object.freeze([RAW_CODES.terrorOfTheStars, RAW_CODES.reawakenedElderThing]),
})
// setup 通用步骤 removeUnearnedWeaknesses：序幕未获得的冻伤/附身副本全部移出游戏，永不进遭遇牌库
// （它们是序幕按伙伴生死加入调查员牌库的弱点，参考 CityOfTheElderThings.hs DoStep 0）。
export const ALWAYS_REMOVED_CODES = Object.freeze([RAW_CODES.frostbitten, RAW_CODES.possessed])
// 「放一边」的具体卡号（整组按印刷份数展开；v1 另含 08641 星之恐怖，参考 setup.v1「setAside」）。
export const SET_ASIDE_BY_VERSION = Object.freeze(Object.fromEntries(VERSIONS.map(version => [version,
  Object.freeze([
    ...SET_ASIDE_GROUPS_BY_VERSION[version].flatMap(group => expandGroupCards(group)),
    ...(version === 'v1' ? [RAW_CODES.terrorOfTheStars] : []),
  ])])))
export const SET_ASIDE_ALIASES = Object.freeze([...new Set(Object.values(SET_ASIDE_BY_VERSION).flat())])

// Tekeli-li 弱点牌库（7 个卡面 × 印刷份数 = 16 张；EOTE 战役级独立牌库，不进入遭遇牌库）。
export const TEKELI_CODES = Object.freeze(groupCardsOf('tekelili').map(([code]) => code).sort())
export const TEKELI_COPIES = Object.freeze(TEKELI_CODES.map(code => ALL_CARDS[code].quantity || 1))

function deckForVersion(version) {
  const removed = new Set([...REMOVED_BY_VERSION[version], ...ALWAYS_REMOVED_CODES])
  const aside = new Set(SET_ASIDE_BY_VERSION[version])
  const codes = []
  for (const group of ENCOUNTER_GROUPS_BY_VERSION[version]) {
    for (const [code, card] of groupCardsOf(group)) {
      if (removed.has(code) || aside.has(code)) continue
      for (let index = 0; index < (card.quantity || 1); index += 1) codes.push(code)
    }
  }
  return codes
}
// 真实开局牌库（behavior.modifyDeck 按 flags.cityVersion 选择；引擎 setup 只读 scenario.encounterDeck）。
export const ENCOUNTER_DECK_BY_VERSION = Object.freeze(Object.fromEntries(
  VERSIONS.map(version => [version, Object.freeze(deckForVersion(version))])))
// 静态声明/manifest 用：三套 setup 可能出现的全部实体卡的并集（开局时再按版本收窄）。
const declaredEncounterCodes = new Set()
for (const version of VERSIONS) {
  for (const code of ENCOUNTER_DECK_BY_VERSION[version]) declaredEncounterCodes.add(code)
  for (const code of SET_ASIDE_BY_VERSION[version]) declaredEncounterCodes.add(code)
}
export const ENCOUNTER_DECK = Object.freeze([...declaredEncounterCodes]
  .flatMap(code => Array(ALL_CARDS[code].quantity || 1).fill(code)))

// 16 把钥匙：两套 skull/cultist/tablet/elderthing/0/-1/-2/-3。
export const CITY_KEY_VALUES = Object.freeze([
  'skull', 'skull', 'cultist', 'cultist', 'tablet', 'tablet', 'elderthing', 'elderthing',
  0, 0, -1, -1, -2, -2, -3, -3,
])

// —— 幕 / 议程：三套版本（v1/v2/v3），运行时按 scenarioFlags.cityVersion 选择 ——
const actDefinition = (code, number, extra = {}) => {
  const card = ALL_CARDS[code]
  return {
    ...stage(code, { number }), id: `act${number}`, originalCode: code,
    name: card.nameZh || card.name, nameEn: card.name, text: card.textZh || card.text || '',
    ...extra,
  }
}
const agendaDefinition = (code, number) => {
  const card = ALL_CARDS[code]
  return {
    ...stage(code, { number, doom: card.doom }), id: `agenda${number}`, originalCode: code,
    name: card.nameZh || card.name, nameEn: card.name,
    text: card.textZh || card.text || '', backText: card.backTextZh || card.backText || '',
    chapterFlow: 'cityOfTheElderThings',
  }
}
const ACT_CODES_BY_VERSION = Object.freeze({
  v1: RAW_CODES.act1v1, v2: RAW_CODES.act1v2, v3: RAW_CODES.act1v3,
})
const ACT2_CODES_BY_VERSION = Object.freeze({
  v1: RAW_CODES.act2v1, v2: RAW_CODES.act2v2, v3: RAW_CODES.act2v3,
})
export function actsForVersion(version = 'v1') {
  const key = ACT_CODES_BY_VERSION[version] ? version : 'v1'
  return [
    actDefinition(ACT_CODES_BY_VERSION[key], 1, { version: key, objective: { type: 'cityKeys' }, chapterFlow: 'sprawlingCity' }),
    actDefinition(ACT2_CODES_BY_VERSION[key], 2, { version: key, objective: { type: 'hiddenTunnel' }, chapterFlow: 'pursuitOfTheUnknown' }),
  ]
}
export const agendas = Object.freeze([
  agendaDefinition(RAW_CODES.agenda1, 1),
  agendaDefinition(RAW_CODES.agenda2, 2),
])
export const acts = Object.freeze(actsForVersion('v1'))

const sections = storySections(CHAPTER_ID) || {}
export const resolutions = Object.freeze({
  noResolution: resolutionTextOf(CHAPTER_ID, 'resolutions.noResolution', '所有调查员都被击败。'),
  resolution1: resolutionTextOf(CHAPTER_ID, 'resolutions.resolution1', '队伍找到了隐秘隧道。'),
  resolution2: resolutionTextOf(CHAPTER_ID, 'resolutions.resolution2', '队伍被引导至隐秘隧道。'),
})

export const SCENARIO_TEXT = Object.freeze({
  textLanguage: 'zh-CN',
  textStatus: 'translated (self-translated)',
  sectionCount: sectionCountOf(CHAPTER_ID),
  introTitle: sections.intro?.title || '古老者之城',
  intro: sections.intro?.body || storyTextOf(CHAPTER_ID, 'intro', ''),
  setup: citySetupText('v1'),
  specialRules: storyTextOf(CHAPTER_ID, 'specialRules', ''),
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
  setAsideLocations: [],
  enemies, treacheries, storyAssets,
  acts, agendas, resolutions,
  encounterDeck: ENCOUNTER_DECK,
  tokenMeanings: CITY_OF_THE_ELDER_THINGS_TOKEN_MEANINGS,
  ...SCENARIO_TEXT,
})

export const identities = Object.freeze(identitiesFor(scenario))

export const CHAPTER_ENTRY_CODES = Object.freeze([
  RAW_CODES.agenda1, RAW_CODES.agenda2,
  RAW_CODES.act1v1, RAW_CODES.act1v2, RAW_CODES.act1v3,
  RAW_CODES.act2v1, RAW_CODES.act2v2, RAW_CODES.act2v3,
  ...Object.values(LOCATIONS).map(item => item.originalCode),
  ...ENEMY_CODES, ...TREACHERY_CODES,
])
export const entryCodes = () => CHAPTER_ENTRY_CODES
export const enemyCodesFor = () => ENEMY_CODES
export const RECORD_READS = Object.freeze([
  'theTeamStudiedTheHistoryOfTheElderThings', 'theTeamDiscernedTheOriginOfTheShoggoths',
  'theTeamDiscoveredAHiddenPower', 'theInvestigatorsScoutedTheCityOutskirts',
])
export const RECORD_WRITES = Object.freeze([
  'theTeamStudiedTheHistoryOfTheElderThings', 'theTeamDiscernedTheOriginOfTheShoggoths',
  'theTeamDiscoveredAHiddenPower', 'theTeamFoundTheHiddenTunnel', 'theTeamWasGuidedToTheHiddenTunnel',
])
