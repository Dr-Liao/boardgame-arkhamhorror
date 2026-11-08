# 章节 cityOfTheElderThings · City of the Elder Things · 参考卡 08621

## 文件清单
- definition: content/campaigns/edgeOfTheEarth/scenarios/cityOfTheElderThings/definition.js (12409B)
- behavior: content/campaigns/edgeOfTheEarth/scenarios/cityOfTheElderThings/behavior.js (34134B)
- chaos: content/campaigns/edgeOfTheEarth/scenarios/cityOfTheElderThings/chaos.js (3921B)
- index: content/campaigns/edgeOfTheEarth/scenarios/cityOfTheElderThings/index.js (1534B)
- layout: content/campaigns/edgeOfTheEarth/scenarios/cityOfTheElderThings/layout.js (1148B)
- texts: content/campaigns/edgeOfTheEarth/scenarios/cityOfTheElderThings/texts.js (1979B)

## 章节卡号
08621 08622 08623 08624 08625 08626 08627 08628 08629 08630 08631 08632 08633 08634 08635 08636 08637 08638 08639 08640 08641 08642 08643 08644 08645 08646 08647

## 指南来源
- en: frontend/src/locales/en/edgeOfTheEarth/scenarios/cityOfTheElderThings.json (24683B, keys=94)
- zh: frontend/src/locales/zh/edgeOfTheEarth/scenarios/cityOfTheElderThings.json (14682B, keys=40)

## 相关测试
- tests/eote-scenario-cityOfTheElderThings.test.mjs

## content/campaigns/edgeOfTheEarth/scenarios/cityOfTheElderThings/definition.js
```js
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
import { location, stage, identitiesFor } from '../../card-data.js'
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
    ...(Object.hasOwn(card, 'victory') ? { hasVictory: true, victory: card.victory } : {}),
    connections: [],
  })
}
export const LOCATIONS = Object.freeze(Object.fromEntries([
  [HIDDEN_TUNNEL, location({
    id: HIDDEN_TUNNEL, code: RAW_CODES.hiddenTunnel, cluesFixed: false,
    clues: ALL_CARDS[RAW_CODES.hiddenTunnel].clues || 0,
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
const treacheryDefinition = code => {
  const card = ALL_CARDS[code]
  return {
    code, originalCode: code, name: card.nameZh || card.name, nameEn: card.name,
    text: card.textZh || card.text || '', textEn: card.text || '', traits: [...(card.traits || [])],
  }
}
export const enemies = Object.freeze(Object.fromEntries(ENEMY_CODES.map(code => [code, enemyDefinition(code)])))
export const treacheries = Object.freeze(Object.fromEntries(TREACHERY_CODES.map(code => [code, treacheryDefinition(code)])))
export const storyAssets = Object.freeze({})

const deckList = []
for (const code of TREACHERY_CODES) for (let i = 0; i < (ALL_CARDS[code].quantity || 1); i += 1) deckList.push(code)
for (const code of [RAW_CODES.benignElderThing, RAW_CODES.reawakenedElderThing]) {
  for (let i = 0; i < (ALL_CARDS[code].quantity || 1); i += 1) deckList.push(code)
}
export const ENCOUNTER_DECK = Object.freeze(deckList)

// 开局放一边/移出游戏：
//  v1：放一边修格斯组（共享组），移出 3×和蔼的古老者，星之恐怖放一边；
//  v2：放一边冰中生物组，移出星之恐怖与 3×和蔼的古老者；
//  v3：同 v1（修格斯组），星之恐怖放一边。
export const SET_ASIDE_BY_VERSION = Object.freeze({
  v1: Object.freeze([RAW_CODES.terrorOfTheStars]),
  v2: Object.freeze([]),
  v3: Object.freeze([RAW_CODES.terrorOfTheStars]),
})
export const REMOVED_BY_VERSION = Object.freeze({
  v1: Object.freeze([RAW_CODES.benignElderThing, RAW_CODES.benignElderThing, RAW_CODES.benignElderThing]),
  v2: Object.freeze([RAW_CODES.terrorOfTheStars, RAW_CODES.benignElderThing, RAW_CODES.benignElderThing, RAW_CODES.benignElderThing]),
  v3: Object.freeze([RAW_CODES.benignElderThing, RAW_CODES.benignElderThing, RAW_CODES.benignElderThing]),
})
export const SET_ASIDE_ALIASES = Object.freeze([...new Set(Object.values(SET_ASIDE_BY_VERSION).flat())])

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

```

## content/campaigns/edgeOfTheEarth/scenarios/cityOfTheElderThings/behavior.js
```js
// 古老者之城（City of the Elder Things · 08621）· 引擎钩子（章节流程 + 城市地图/钥匙机械）。
//
// 约定（与 TDE 章节 behavior 相同）：
//   · 逐卡规则在单卡条目的 actRule / agendaRule / locationRule / enemyRule / encounterResolve / flags；
//     behavior 只做分派与本章专属机械（城市地图、钥匙、版本选择、结局记录），不按卡号写分支。
//   · 内容层（behavior）允许直接读写 state；卡条目禁止，只拿 ctx.api。
//   · 城市地图/钥匙统一走 P2 原语：
//     `src/engine/eote-city.js`（initializeCity/cityscapes/visibleOnRow/visibleOnColumn/keyOnLocation…）、
//     `src/engine/grid-map.js`（placeGridLocation/connectGrid/cityscapeOf/lookRow/lookColumn）、
//     `src/engine/scenario-keys.js`（initializeValueKeys/valueKeysAt/spendValueKeys）。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import {
  actRuleFor, agendaRuleFor, encounterResolveFor, enemyRuleFor, locationRuleFor,
  resolveDeclarativeTreacheryTest, treacheryRuleFor, treacheryTestFor,
} from '../../../../../src/cards/card-rules.js'
import {
  cityscapes as readCityscapes, initializeCity, visibleOnColumn, visibleOnRow,
} from '../../../../../src/engine/eote-city.js'
import {
  cityscapeOf, connectGrid, gridLocations, lookColumn, lookRow, placeGridLocation,
} from '../../../../../src/engine/grid-map.js'
import {
  initializeValueKeys, spendValueKeys, valueKeyIds, valueKeysAt,
} from '../../../../../src/engine/scenario-keys.js'
import {
  CITY_OF_THE_ELDER_THINGS_TOKEN_MEANINGS, cityOfTheElderThingsAfterTest,
  cityOfTheElderThingsChaosToken, frostRevealed, cardNameOf,
} from './chaos.js'
import {
  CITY_KEY_VALUES, CITY_LAYOUTS, CITY_LOCATION_IDS, ENEMY_CODES, HIDDEN_TUNNEL, LOCATIONS,
  RAW_CODES, RECORD_READS, RECORD_WRITES, START_LOCATION_BY_VERSION, TREACHERY_CODES, entryCodes,
} from './definition.js'

const CHAPTER_ID = 'cityOfTheElderThings'
const VERSIONS = Object.freeze(['v1', 'v2', 'v3'])
const codeOf = card => card?.originalCode || card?.code || card
const locationOf = (state, inv) => (state.locations || []).find(item => item.id === inv?.location) || null
const recordsFor = state => {
  state.campaign ||= {}
  state.campaign.records ||= {}
  return state.campaign.records
}
const versionOf = state => VERSIONS.includes(state?.scenarioFlags?.cityVersion)
  ? state.scenarioFlags.cityVersion : 'v1'
const locationHolder = id => `location:${id}`
const investigatorHolder = seat => `investigator:${seat}`
const cloneLocation = definition => ({
  ...definition,
  id: definition.id,
  code: definition.originalCode || definition.code,
  connections: [...(definition.connections || [])],
})

// —— 初始状态容器（city/cityscape/keys 由 P2 原语写；本模块只读） ——
export const scenarioApproximations = Object.freeze([
  '三套城市布局（v1/v2/v3）按 setup1/2/3Positions 原样归一化；印刷「随机洗混 16 张城市景观」用确定性顺序填充（测试可注入 shuffle）。',
  '16 把钥匙用 scenario-keys 数值钥匙原语（holder=location:<id>），与 eote-city 的位置钥匙表不重复实现。',
])
export const scenarioGaps = Object.freeze([])
export const implementedEncounterCodes = Object.freeze([...entryCodes()])

export const behavior = {
  id: CHAPTER_ID,
  implementedEncounterCodes,
  scenarioApproximations,
  scenarioGaps,
  tokenMeanings: CITY_OF_THE_ELDER_THINGS_TOKEN_MEANINGS,
  versions: VERSIONS,
  recordReads: RECORD_READS,
  recordWrites: RECORD_WRITES,

  // ---- 开局：版本（v1/v2/v3）由战役记录/投票决定，P7 默认按 flags 选择 ----
  preScenarioSetup(state, events, api) {
    const flags = (state.scenarioFlags ||= {})
    if (flags.introResolved) return
    flags.introResolved = true
    const vote = flags.cityVersionVote || (recordsFor(state).theInvestigatorsScoutedTheCityOutskirts ? 'v2' : 'v1')
    flags.cityVersion = VERSIONS.includes(vote) ? vote : 'v1'
    api?.info?.(`🏙️ 古老者之城：使用布局 ${flags.cityVersion}（Setup ${flags.cityVersion === 'v1' ? 'v. I' : flags.cityVersion === 'v2' ? 'v. II' : 'v. III'}）。`)
  },

  // ---- 布置：16 张城市景观按版本放上网格；隐秘隧道在地图外；16 把钥匙随机放到各地点 ----
  setupLocations(state, events, helper = {}) {
    const flags = (state.scenarioFlags ||= {})
    const zones = (state.scenarioZones ||= {})
    if (!flags.cityVersion) flags.cityVersion = 'v1'
    state.locations ||= []
    // 城市景观与隐秘隧道：确保运行时地点存在（真实建局由 setup 管线先放地点，这里幂等）。
    for (const definition of Object.values(LOCATIONS)) {
      if (!state.locations.some(item => item.id === definition.id)) state.locations.push(cloneLocation(definition))
    }
    const map = behavior.setupCityMap(state, { version: flags.cityVersion, shuffle: flags.cityShuffle || null })
    zones.setAside = [...(state.scenario?.setAsideLocations || [])]
    zones.removed = []
    zones.victory = zones.victory || []
    flags.encounterDeckReady = true
    flags.hiddenTunnelRevealed = flags.hiddenTunnelRevealed === true
    helper.info?.(state, events, '🏙️ 古老者之城：城市景观按地图入场，16 把钥匙随机放在各城市景观上；隐秘隧道隐藏在地图外。')
    // 本函数已把地点写入 state.locations；返回空数组，避免引擎把 startLocation 字符串当数组迭代。
    void map
    return []
  },

  /**
   * 建城市地图：`initializeCity` 分配 16 个城市景观格并放地点、`connectGrid` 生成相邻连接；
   * 隐秘隧道用 isolated 格子单独放置；16 把钥匙（skull/cultist/tablet/elderthing/0/-1/-2/-3 ×2）
   * 按 `shuffle`（缺省确定性顺序）放到各城市景观（holder = location:<id>）。
   */
  setupCityMap(state, { version = 'v1', shuffle = null } = {}) {
    const key = VERSIONS.includes(version) ? version : 'v1'
    const cells = CITY_LAYOUTS[key]
    const placeLocation = id => {
      const definition = Object.values(LOCATIONS).find(item => item.id === id)
      if (!definition) return null
      const location = cloneLocation(definition)
      state.locations ||= []
      if (!state.locations.some(item => item.id === id)) state.locations.push(location)
      return location
    }
    const cityscapes = cells.map(cell => ({ row: cell.row, column: cell.column, locationIds: [...CITY_LOCATION_IDS] }))
    const existing = readCityscapes(state)
    if (existing) {
      // 已建图：只读返回（幂等），方便存档恢复/测试重复调用。
      return { cityscapes: existing, startLocation: START_LOCATION_BY_VERSION[key] }
    }
    const assignment = initializeCity(state, { cityscapes, keys: [] }, { ...(shuffle ? { shuffle } : {}), placeLocation })
    if (assignment === false) throw new Error('城市景观初始化失败：格子/候选地点不合法')
    connectGrid(state)
    // 隐秘隧道：地图外独立格（不可通过普通邻接进入；由幕/行动揭示后进入）。
    placeGridLocation(state, HIDDEN_TUNNEL, 6, 6, { placeLocation }, { isolated: true })
    // 16 把钥匙：先按地点顺序列 holder，再按版本/确定性顺序初始化（测试可传 shuffle）。
    const holders = [...CITY_LOCATION_IDS]
    const ordered = typeof shuffle === 'function' ? shuffle([...holders]) : holders
    if (!Array.isArray(ordered) || ordered.length !== holders.length) throw new TypeError('钥匙洗牌回调必须返回同一数量')
    const specs = CITY_KEY_VALUES.map((value, index) => ({
      id: `city-key-${index + 1}`, value, holder: locationHolder(ordered[index]),
    }))
    initializeValueKeys(state, specs)
    return { cityscapes: readCityscapes(state), startLocation: START_LOCATION_BY_VERSION[key], keyCount: specs.length }
  },

  // ---- 地图/钥匙只读入口 ----
  cityscapeAt(state, locationId) {
    return cityscapeOf(state, locationId)
  },
  mapRows(state) {
    return [...new Set((readCityscapes(state) || []).map(item => item.row))].sort((a, b) => a - b)
  },
  mapColumns(state) {
    return [...new Set((readCityscapes(state) || []).map(item => item.column))].sort((a, b) => a - b)
  },
  gridLocationsInRow(state, row) {
    return gridLocations(state, { row })
  },
  /** 议程行动「查看所在行/列一个城市景观的已揭示面」：私密窥视，调用方只发给该座位。 */
  lookAtRow(state, seat, row) {
    return visibleOnRow(state, row, { seat })
  },
  lookAtColumn(state, seat, column) {
    return visibleOnColumn(state, column, { seat })
  },
  lookRowCards(state, inv) {
    const cell = cityscapeOf(state, inv?.location)
    return cell ? lookRow(state, cell.row) : []
  },
  lookColumnCards(state, inv) {
    const cell = cityscapeOf(state, inv?.location)
    return cell ? lookColumn(state, cell.column) : []
  },
  keysAtLocation(state, locationId) {
    return valueKeysAt(state, locationHolder(locationId))
  },
  keysControlled(state, seat) {
    return valueKeysAt(state, investigatorHolder(seat))
  },
  keyCount(state, seat) {
    return behavior.keysControlled(state, seat).length
  },
  /** 免费取得地点钥匙：地点无线索时，把该地点一把钥匙的控制权交给调查员。 */
  claimKey(state, seat, locationId) {
    const location = (state.locations || []).find(item => item.id === locationId)
    if (!location) return false
    if ((location.clues || 0) > 0) return false
    const keys = behavior.keysAtLocation(state, locationId)
    if (!keys.length) return false
    const claimed = spendValueKeys(state, locationHolder(locationId), { values: [keys[0].value], destination: investigatorHolder(seat) })
    return claimed
  },
  /** [action] 把任意数量自己控制的钥匙交给同地点另一位调查员。 */
  giveKeys(state, seat, targetSeat, values = null) {
    const keys = behavior.keysControlled(state, seat)
    if (!keys.length) return false
    const selected = values || keys.map(key => key.value)
    return spendValueKeys(state, investigatorHolder(seat), { values: selected, destination: investigatorHolder(targetSeat) })
  },
  /** cultist 符号：把一把控制的钥匙放到你所在地点。 */
  placeControlledKeyAtLocation(state, seat, locationId) {
    const keys = behavior.keysControlled(state, seat)
    if (!keys.length) return false
    return spendValueKeys(state, investigatorHolder(seat), { values: [keys[0].value], destination: locationHolder(locationId) })
  },

  // ---- 幕/议程钩子：逐卡 actRule/agendaRule.onReveal/onActions 分派 ----
  actReveal(state, act, api) {
    const rule = actRuleFor(codeOf(act))
    if (!rule) return false
    if (typeof rule.onReveal === 'string') {
      const handler = ACT_REVEAL_HANDLERS[rule.onReveal]
      if (handler) return handler(state, act, rule, api) !== false
      if (rule.onReveal.startsWith('resolution')) {
        behavior.resolution(state, rule.onReveal, [], api)
        api?.finish?.(rule.onReveal)
        return true
      }
      return false
    }
    if (typeof rule.onReveal === 'function') return rule.onReveal(state, act, api) === true
    return false
  },
  agendaReveal(state, agenda, api) {
    const rule = agendaRuleFor(codeOf(agenda))
    if (rule?.onReveal) return rule.onReveal(state, agenda, api) === true
    return false
  },

  // ---- 目标检查 ----
  checkObjectives(state) {
    const act = state.acts?.[state.actIndex ?? 0]
    const rule = actRuleFor(codeOf(act))
    if (rule?.objective?.type === 'cityKeys') {
      const records = recordsFor(state)
      const remember = rule.objective.remember || []
      return remember.length > 0 && remember.every(key => records[key] === true)
    }
    if (rule?.objective?.type === 'hiddenTunnel') {
      const tunnel = (state.locations || []).find(item => item.id === HIDDEN_TUNNEL)
      if (!tunnel || (tunnel.clues || 0) > 0) return false
      const alive = (state.investigators || []).filter(inv => !inv.defeated)
      return alive.length > 0 && alive.every(inv => inv.location === HIDDEN_TUNNEL)
    }
    return false
  },

  // ---- 移动限制：隐秘隧道未揭示前不能进入（孤立格） ----
  moveError(state, inv, destination, id) {
    const toId = typeof destination === 'string' ? destination : (destination?.id ?? id)
    if (toId !== HIDDEN_TUNNEL) {
      const cell = cityscapeOf(state, toId)
      return cell ? null : '目标不是城市景观或隐秘隧道'
    }
    if (state.scenarioFlags?.hiddenTunnelRevealed !== true) return '隐秘隧道尚未揭示，不能进入'
    return null
  },

  // ---- 行动：议程自由行动、幕 1 钥匙研究、幕 2 追踪、进入隐秘隧道 ----
  actions(state, inv, api) {
    const moves = []
    const flags = (state.scenarioFlags ||= {})
    const location = locationOf(state, inv)
    const agendaRule = agendaRuleFor(codeOf(state.agendas?.[state.agendaIndex ?? 0]))
    for (const free of agendaRule?.freeActions || []) {
      if (free.oncePerRound && flags[`cityActions:${inv.seat}:${state.round}`]?.[free.rule]) continue
      if ((inv.clues || 0) < (free.clues || 0)) continue
      moves.push({ action: 'scenarioAction', rule: free.rule, actions: 0, clues: free.clues || 0, label: free.label })
    }
    const hereRule = locationRuleFor(codeOf(location))
    for (const option of hereRule?.actions || []) {
      if (option.teamOnce && flags[`cityTeamOnce:${option.rule}`]) continue
      if (option.values && option.values.some(value => !valueKeyAtPlaceExists(state, inv, value))) continue
      moves.push({ action: 'scenarioAction', rule: `loc:${option.rule}`, actions: 1, data: option, label: option.label })
    }
    const roundKey = `cityActions:${inv.seat}:${state.round}`
    const used = (flags[roundKey] || {})
    if ((inv.clues || 0) >= 1 && !(used.look || used.cityLookRowOrColumn)) {
      moves.push({ action: 'scenarioAction', rule: 'cityLookRowOrColumn', actions: 0, label: '🗺️ 花费 1 线索：查看所在行/列一个城市景观的已揭示面（每轮一次）' })
    }
    if ((inv.clues || 0) >= 3 && !(used.cityMoveAlongRowOrColumn)) {
      moves.push({ action: 'scenarioAction', rule: 'cityMoveAlongRowOrColumn', actions: 0, label: '🗺️ 花费 3 线索：移动到所在行/列的任意地点（每轮一次）' })
    }
    const act = state.acts?.[state.actIndex ?? 0]
    const actRule = actRuleFor(codeOf(act))
    if (actRule?.keyActions) {
      for (const option of actRule.keyActions) {
        moves.push({ action: 'scenarioAction', rule: `actKey:${option.action}`, actions: 1, label: option.label })
      }
    }
    if (flags.hiddenTunnelRevealed === true && inv.location !== HIDDEN_TUNNEL) {
      moves.push({ action: 'scenarioAction', rule: 'enterHiddenTunnel', actions: 1, label: '🕳️ 进入隐秘隧道' })
    }
    if (actRule?.actTwoActions && inv.location === HIDDEN_TUNNEL) {
      for (const option of actRule.actTwoActions) moves.push({ action: 'scenarioAction', rule: `actTwo:${option.action}`, actions: 1, label: option.label })
    }
    return moves
  },

  performAction(state, inv, move, api) {
    if (!move) return false
    const act = state.acts?.[state.actIndex ?? 0]
    const actRule = actRuleFor(codeOf(act))
    const flags = (state.scenarioFlags ||= {})
    const roundKey = `cityActions:${inv.seat}:${state.round}`
    flags[roundKey] ||= {}
    if (move.rule === 'cityLookRowOrColumn') {
      if ((inv.clues || 0) < 1) return false
      inv.clues -= 1
      flags[roundKey]['cityLookRowOrColumn'] = true
      const row = api?.chooseRowOrColumn?.()
      api?.info?.('🗺️ 花费 1 线索：查看所在行/列一个城市景观的已揭示面。')
      return { look: row ?? behavior.mapRows(state) }
    }
    if (move.rule === 'cityMoveAlongRowOrColumn') {
      if ((inv.clues || 0) < 3) return false
      inv.clues -= 3
      flags[roundKey]['cityMoveAlongRowOrColumn'] = true
      api?.info?.('🗺️ 花费 3 线索：移动到所在行/列的任意地点。')
      return true
    }
    if (move.rule.startsWith('loc:')) {
      const name = move.rule.slice('loc:'.length)
      const handler = LOCATION_ACTION_HANDLERS[name]
      if (!handler) return false
      const result = handler(state, inv, move.data || {}, api)
      if (result !== false && move.data?.teamOnce) (state.scenarioFlags ||= {})['cityTeamOnce:' + name] = true
      return result
    }
    if (move.rule === 'enterHiddenTunnel') {
      if (flags.hiddenTunnelRevealed !== true) return false
      inv.location = HIDDEN_TUNNEL
      api?.info?.('🕳️ 进入隐秘隧道。')
      return true
    }
    if (move.rule.startsWith('actKey:')) {
      const action = move.rule.slice('actKey:'.length)
      const option = (actRule?.keyActions || []).find(item => item.action === action)
      if (!option) return false
      const spent = spendValueKeys(state, investigatorHolder(inv.seat), { values: option.values })
      if (!spent) return false
      const records = recordsFor(state)
      for (const key of option.remember || []) records[key] = true
      api?.info?.(`🔑 ${option.label}：已记录。`)
      return true
    }
    if (move.rule.startsWith('actTwo:')) {
      const action = move.rule.slice('actTwo:'.length)
      const option = (actRule?.actTwoActions || []).find(item => item.action === action)
      if (!option) return false
      const spent = spendValueKeys(state, investigatorHolder(inv.seat), { values: option.values })
      if (!spent) return false
      api?.info?.(`🔑 ${option.label}。`)
      return true
    }
    const rule = encounterResolveFor(codeOf(move.card || {}))
    if (rule) return rule(state, inv, move.card, api, {})
    return false
  },

  // ---- 遭遇卡结算 ----
  resolveEncounter(state, inv, card, api) {
    const code = codeOf(card)
    const entryResolve = encounterResolveFor(code)
    if (entryResolve) return entryResolve(state, inv, card, api, { location: locationOf(state, inv) })
    const kind = treacheryRuleFor(code)?.resolveKind
    const handler = kind && TREACHERY_HANDLERS[kind]
    if (handler) return handler(state, inv, card, api) !== false
    const declarative = treacheryTestFor(code)
    if (declarative) return resolveDeclarativeTreacheryTest(state, inv, card, api, declarative)
    return false
  },

  // ---- 混乱标记 ----
  resolveChaosToken(state, inv, token) {
    return cityOfTheElderThingsChaosToken(state, inv, token)
  },

  afterTest(state, inv, result, api) {
    const riders = cityOfTheElderThingsAfterTest(state, inv, result) || []
    for (const rider of riders) {
      if (rider === 'placeKey') behavior.placeControlledKeyAtLocation(state, inv.seat, inv.location)
      else if (rider === 'autoFail') {
        // 由引擎的 testAutoFail 钩子真正生效；这里只记事件，避免重复改值。
        ;(state.scenarioFlags ||= {}).lastAutoFailReason = 'tabletFrost'
      } else if (rider === 'autoFailDamage') {
        inv.damage = (inv.damage || 0) + 1
        ;(state.scenarioFlags ||= {}).lastAutoFailReason = 'tabletFrostDamage'
      } else if (rider === 'nearestEnemy') nearestEnemyMovesAndAttacks(state, inv, api)
    }
    if (frostRevealed(result)) (state.scenarioFlags ||= {}).frostRevealedThisTest = true
    return riders
  },

  testAutoFail(state, inv, result) {
    const tokens = result?.drawn || []
    if (!frostRevealed(result)) return false
    const hard = ['hard', 'expert'].includes(String(state.difficulty || 'standard'))
    return tokens.includes('tablet') && (hard || !result?.success)
  },

  // ---- 敌人修正：星之恐怖 +3/人生命 ----
  enemyStatModifier(state, enemy, stat) {
    const rule = enemyRuleFor(codeOf(enemy))
    if (!rule?.perInvestigatorHealth) return 0
    if (stat !== 'health') return 0
    return 3 * (Number(state.numInvestigators) || (state.investigators || []).length || 1)
  },

  // 引擎签名：resolution(state, resolutionKey, events, api)（同 TIC/TDE/Heart of Madness）。
  resolution(state, key, events, api = {}) {
    const records = recordsFor(state)
    const found = state.scenarioFlags?.hiddenTunnelRevealed === true
    records.theTeamFoundTheHiddenTunnel = found
    records.theTeamWasGuidedToTheHiddenTunnel = found ? records.theTeamWasGuidedToTheHiddenTunnel === true : false
    return key
  },

  finalResolution(state) {
    return state.scenarioFlags?.hiddenTunnelRevealed === true ? 'resolution1' : 'resolution2'
  },

  resolutionIds: ['noResolution', 'resolution1', 'resolution2'],
}

function nearestEnemyMovesAndAttacks(state, inv, api) {
  const enemies = (state.enemies || []).filter(enemy => !enemy.defeated && enemy.location)
  if (!enemies.length) return false
  const target = enemies.sort((a, b) =>
    neighborRank(state, a.location, inv.location) - neighborRank(state, b.location, inv.location))[0]
  if (target.location !== inv.location) target.location = inv.location
  inv.damage = (inv.damage || 0) + (ALL_CARDS[codeOf(target)]?.damage || 1)
  inv.horror = (inv.horror || 0) + (ALL_CARDS[codeOf(target)]?.horror || 0)
  target.engagedSeat = inv.seat
  api?.info?.(`🏙️ 最近的敌人向 ${inv.name} 移动并攻击。`)
  return true
}
function neighborRank(state, fromId, toId) {
  if (!fromId || !toId) return 99
  if (fromId === toId) return 0
  const from = (state.locations || []).find(item => item.id === fromId)
  return from && (from.connections || []).includes(toId) ? 1 : 2
}

export { HIDDEN_TUNNEL, RAW_CODES, CITY_LOCATION_IDS, ENEMY_CODES, TREACHERY_CODES }
export const enemyCodes = ENEMY_CODES


// ---------------------------------------------------------------------------
// 逐卡数据驱动的结算实现（behavior 只按 kind/rule 分派，不按卡号分支）。
// ---------------------------------------------------------------------------

function valueKeyAtPlaceExists(state, inv, value) {
  return behavior.keysControlled(state, inv.seat).some(key => String(key.value) === String(value))
}

const addFrostToken = (state, api) => {
  state.chaosBag ||= []
  state.chaosBag.push('frost')
  api?.addChaosToken?.('frost')
  api?.info?.('❄️ 混乱袋加入 1 个 [frost] 标记。')
}

export const ACT_REVEAL_HANDLERS = Object.freeze({
  // 08624/08625/08626 背面：混洗共享遭遇组 + 遭遇弃牌堆；揭示隐秘隧道；后续按版本。
  act1BackV1(state, act, rule, api) {
    state.scenarioFlags ||= {}
    state.scenarioFlags.hiddenTunnelRevealed = true
    behavior.resolution(state, 'act1BackV1', [], api)
    api?.info?.('🕳️ 错综复杂之城背面：混洗修格斯组与遭遇弃牌堆；揭示隐秘隧道；星之恐怖在隧道横置入场。')
    return true
  },
  act1BackV2(state, act, rule, api) {
    state.scenarioFlags ||= {}
    state.scenarioFlags.hiddenTunnelRevealed = true
    addFrostToken(state, api)
    api?.info?.('🕳️ 错综复杂之城背面：混洗冰中生物组与遭遇弃牌堆；揭示隐秘隧道；加入 1 个 [frost]。')
    return true
  },
  act1BackV3(state, act, rule, api) {
    state.scenarioFlags ||= {}
    state.scenarioFlags.hiddenTunnelRevealed = true
    for (const inv of state.investigators || []) api?.drawEncounter?.(inv.seat)
    api?.info?.('🕳️ 错综复杂之城背面：混洗修格斯组与遭遇弃牌堆；揭示隐秘隧道；每位调查员抽取 1 张遭遇牌。')
    return true
  },
})

export const TREACHERY_HANDLERS = Object.freeze({
  // 08644 真相开端：意志(2 + 所在地点高度 + 控制的钥匙数量)；失败 2 恐惧（低于难度 3+ 改 3）。
  dawningOfTheTruth(state, inv, card, api) {
    const level = Number((state.locations || []).find(item => item.id === inv.location)?.level) || 0
    const keys = behavior.keyCount(state, inv.seat)
    const difficulty = 2 + level + keys
    api?.test?.(inv.seat, 'willpower', difficulty, {
      source: { type: 'scenario', code: '08644', name: '真相开端', action: 'revelation', ability: true },
      resolve: result => {
        if (result?.success) return
        const failedBy = Math.max(0, Number(result?.difficulty ?? difficulty) - Number(result?.value ?? 0))
        inv.horror = (inv.horror || 0) + (failedBy >= 3 ? 3 : 2)
        api?.info?.(failedBy >= 3 ? '😱 真相开端：受到 3 点恐惧。' : '😱 真相开端：受到 2 点恐惧。')
      },
    })
    return true
  },

  // 08645 崩塌废墟：敏捷(3)；揭示与地点/控制钥匙一致的标记则自动失败；失败按差值受伤害。
  crumblingRuins(state, inv, card, api) {
    const keys = new Set(behavior.keysControlled(state, inv.seat).map(key => String(key.value)))
    ;(state.scenarioFlags ||= {}).crumblingRuinsKeys = [...keys]
    api?.test?.(inv.seat, 'agility', 3, {
      source: { type: 'scenario', code: '08645', name: '崩塌废墟', action: 'revelation', ability: true },
      resolve: result => {
        if (result?.success) return
        const failedBy = Math.max(1, Number(result?.difficulty ?? 3) - Number(result?.value ?? 0))
        inv.damage = (inv.damage || 0) + failedBy
        api?.info?.(`🧱 崩塌废墟：受到 \${failedBy} 点伤害。`)
      },
    })
    return true
  },

  // 08646 冻伤：放入威胁区（1 点「伤害」计数器；治愈近似为弃掉自身）。
  frostbitten(state, inv, card, api) {
    if (api?.threat) api.threat(inv.seat, '08646', { threatEffect: { counters: 1, healAs: 'damage' } })
    else {
      inv.threat ||= []
      inv.threat.push({ id: 'threat-08646', code: '08646', originalCode: '08646', counters: 1, forcedFrost: 'damage' })
    }
    api?.info?.('🥶 冻伤进入威胁区域（可如同你身上的 1 点伤害被治愈）。')
    return true
  },

  // 08647 附身：放入威胁区（1 点「恐惧」计数器；threatHorrorSink 原语接管治愈）。
  possessed(state, inv, card, api) {
    if (api?.threat) api.threat(inv.seat, '08647', { threatEffect: { counters: 1, threatHorrorSink: true } })
    else {
      inv.threat ||= []
      inv.threat.push({ id: 'threat-08647', code: '08647', originalCode: '08647', counters: 1, threatHorrorSink: true })
    }
    api?.info?.('👁️ 附身进入威胁区域（可如同你身上的 1 点恐惧被治愈）。')
    return true
  },
})

export const LOCATION_ACTION_HANDLERS = Object.freeze({
  // 08630 隐秘隧道：任选技能? 本实现按意志检定(4)；成功把隧道 1 线索放回供应堆（花 skull 钥匙则 2）。
  tunnelInvestigate(state, inv, data, api) {
    const location = (state.locations || []).find(item => item.id === inv.location)
    const difficulty = 4
    api?.test?.(inv.seat, 'willpower', difficulty, {
      source: { type: 'scenario', code: '08630', action: 'activate', ability: true },
      resolve: result => {
        if (!result?.success || !location) return
        let amount = 1
        if (spendValueKeys(state, investigatorHolder(inv.seat), { values: ['skull'] })) amount = 2
        location.clues = Math.max(0, (location.clues || 0) - amount)
        api?.info?.(`🕳️ 隐秘隧道：把 \${amount} 个线索放回供应堆。`)
      },
    })
    return true
  },
  // 08631 古代天文馆：花费 2 个「0」钥匙；记录研究。
  planetariumStudy(state, inv, data, api) {
    if (!spendValueKeys(state, investigatorHolder(inv.seat), { values: data.values })) return false
    if (data.remember) recordsFor(state)[data.remember] = true
    addFrostToken(state, api)
    api?.info?.('🔭 古代天文馆：拍摄天文图照片（记录），混乱袋加入 1 个 [frost]。')
    return true
  },
  // 08632 石桥：战斗/敏捷(4) 发现 1 线索。
  bridgeDiscover(state, inv, data, api) {
    const location = (state.locations || []).find(item => item.id === inv.location)
    if (!location) return false
    api?.test?.(inv.seat, 'combat', 4, {
      source: { type: 'scenario', code: '08632', action: 'activate', ability: true },
      resolve: result => {
        if (!result?.success) return
        if ((location.clues || 0) > 0) { location.clues -= 1; inv.clues = (inv.clues || 0) + 1 }
        api?.info?.('🌉 石桥：发现 1 个线索。')
      },
    })
    return true
  },
  // 08632 石桥：移动到另一个石桥地点。
  bridgeTravel(state, inv, data, api) {
    const bridgeCodes = new Set(['08632'])
    const target = (state.locations || []).find(item => item.id !== inv.location
      && bridgeCodes.has(String(item.originalCode || item.code)))
    if (!target) return false
    inv.location = target.id
    api?.info?.('🌉 石桥：移动到另一个石桥地点。')
    return true
  },
  // 08633 圆柱塔：花费 2 个「-2」钥匙；抽 2、得 2 资源、移除 2 个 frost；记录。
  towerStudy(state, inv, data, api) {
    if (!spendValueKeys(state, investigatorHolder(inv.seat), { values: data.values })) return false
    inv.deck ||= []
    for (let index = 0; index < 2; index += 1) { const card = inv.deck.pop(); if (card) inv.hand.push(card) }
    inv.resources = (inv.resources || 0) + 2
    removeFrostTokens(state, 2)
    if (data.remember) recordsFor(state)[data.remember] = true
    api?.info?.('🗼 圆柱塔：抽 2 张牌、获得 2 资源、移除 2 个 [frost]（记录）。')
    return true
  },
  // 08635 地图资料室：花费 2 个「-3」钥匙；揭示 3 个地点并各发现 1 线索；记录。
  mapRoomStudy(state, inv, data, api) {
    if (!spendValueKeys(state, investigatorHolder(inv.seat), { values: data.values })) return false
    const hidden = (state.locations || []).filter(item => !item.revealed && item.id !== HIDDEN_TUNNEL).slice(0, 3)
    for (const location of hidden) { location.revealed = true; location.clues = Math.max(0, (location.clues || 0) - 1) }
    if (data.remember) recordsFor(state)[data.remember] = true
    api?.info?.('🗺️ 地图资料室：揭示 3 个地点并各发现 1 个线索（记录）。')
    return true
  },
  // 08636 无顶堡垒：花费 2 个「-1」钥匙；移除密谋 1 毁灭或弃掉非精英敌人；记录。
  rampartStudy(state, inv, data, api) {
    if (!spendValueKeys(state, investigatorHolder(inv.seat), { values: data.values })) return false
    if ((state.doom || 0) > 0) state.doom -= 1
    else {
      const enemy = (state.enemies || []).find(item => !item.elite && !item.defeated)
      if (enemy) enemy.defeated = true
    }
    if (data.remember) recordsFor(state)[data.remember] = true
    api?.info?.('🏰 无顶堡垒：移除 1 个毁灭或弃掉一个非精英敌人（记录）。')
    return true
  },
  // 08637 破败街道：发现最后一个线索后，发现连接地点的 1 个线索。
  streetsReactionClue(state, inv, data, api) {
    const here = (state.locations || []).find(item => item.id === inv.location)
    const neighbor = here && (state.locations || []).find(item => (here.connections || []).includes(item.id) && (item.clues || 0) > 0)
    if (!neighbor) return false
    neighbor.clues -= 1
    inv.clues = (inv.clues || 0) + 1
    api?.info?.('🧱 破败街道：发现连接地点的 1 个线索。')
    return true
  },
  // 08638 巨大尖顶：把本行另一地点 1 个钥匙移到巨大尖顶。
  moveKeyToSpires(state, inv, data, api) {
    const target = (state.locations || []).find(item => item.id === inv.location)
    if (!target) return false
    const cell = cityscapeOf(state, inv.location)
    if (!cell) return false
    const source = (state.locations || []).find(item => {
      const other = cityscapeOf(state, item.id)
      return other && other.row === cell.row && item.id !== inv.location && behavior.keysAtLocation(state, item.id).length
    })
    if (!source) return false
    const key = behavior.keysAtLocation(state, source.id)[0]
    spendValueKeys(state, locationHolder(source.id), { values: [key.value], destination: locationHolder(inv.location) })
    api?.info?.('🗼 巨大尖顶：移动本行另一个地点的 1 个钥匙到尖顶。')
    return true
  },
  // 08639 埋没通路：把本地点 1 个线索移到本行/列一个未揭示地点。
  moveClueToHidden(state, inv, data, api) {
    const here = (state.locations || []).find(item => item.id === inv.location)
    if (!here || (here.clues || 0) < 1) return false
    const cell = cityscapeOf(state, inv.location)
    const target = (state.locations || []).find(item => {
      const other = cityscapeOf(state, item.id)
      return other && !item.revealed && ((cell && (other.row === cell.row || other.column === cell.column)))
    })
    if (!target) return false
    here.clues -= 1
    target.clues = (target.clues || 0) + 1
    api?.info?.('🕳️ 埋没通路：把 1 个线索移到同行/同列的未揭示地点。')
    return true
  },
  // 08640 古老者之庙：没有线索时交换两个有钥匙地点的所有钥匙。
  swapKeys(state, inv, data, api) {
    const temple = (state.locations || []).find(item => item.id === inv.location)
    if (!temple || (temple.clues || 0) > 0) return false
    const holders = CITY_LOCATION_IDS.filter(id => behavior.keysAtLocation(state, id).length >= 2)
    if (holders.length < 2) return false
    const [a, b] = holders
    const keysA = behavior.keysAtLocation(state, a).map(key => key.value)
    const keysB = behavior.keysAtLocation(state, b).map(key => key.value)
    for (const value of keysA) spendValueKeys(state, locationHolder(a), { values: [value], destination: locationHolder(b) })
    for (const value of keysB) spendValueKeys(state, locationHolder(b), { values: [value], destination: locationHolder(a) })
    api?.info?.('🏛️ 古老者之庙：交换两个地点的所有钥匙。')
    return true
  },
})

function removeFrostTokens(state, amount) {
  let left = amount
  state.chaosBag = (state.chaosBag || []).filter(token => {
    if (left > 0 && token === 'frost') { left -= 1; return false }
    return true
  })
  return amount - left
}

function spendValueKeysFor(state, inv, values) {
  return spendValueKeys(state, investigatorHolder(inv.seat), { values })
}

export { addFrostToken }

```

## content/campaigns/edgeOfTheEarth/scenarios/cityOfTheElderThings/chaos.js
```js
// 古老者之城（City of the Elder Things · 08621）· 混乱标记取值与后果。
//
// 参考：08621 卡面两档 + locale `scenarios/cityOfTheElderThings.json#tokens`。
// X = 你控制的钥匙数量；困难/专家骷髅再 +2；[tablet] 与 [frost] 的联动由 behavior.afterTest 结算
// （标记取值只返回 `autoFail`/rider 标记，真正扣伤害/自动失败在章节层）。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { valueKeysAt } from '../../../../../src/engine/scenario-keys.js'

const hardSide = state => ['hard', 'expert'].includes(String(state?.difficulty || 'standard'))

export const CITY_OF_THE_ELDER_THINGS_TOKEN_MEANINGS = Object.freeze({
  standard: {
    skull: { text: '-X。X为你控制的钥匙的数量。', delta: 0 },
    cultist: { text: '-2。如果你检定失败，将你控制的一个钥匙放到你所在地点。', delta: -2, rider: 'placeKeyOnFail' },
    tablet: { text: '-3。如果本次检定期间揭示了[frost]标记，改为你自动失败。', delta: -3, rider: 'tabletFrost' },
    elderthing: { text: '-4。如果你检定失败，最近的敌人向你移动一次。如果其与你交战，其攻击。', delta: -4, rider: 'nearestEnemyOnFail' },
  },
  hard: {
    skull: { text: '-X。X为你控制的钥匙的数量加2。', delta: 0 },
    cultist: { text: '-2。将你控制的一个钥匙放到你所在地点。', delta: -2, rider: 'placeKey' },
    tablet: { text: '-4。如果本次检定期间揭示了[frost]标记，改为你受到1点伤害且自动失败。', delta: -4, rider: 'tabletFrostDamage' },
    elderthing: { text: '-5。如果你检定失败，最近的敌人向你移动一次。如果其与你交战，其攻击。', delta: -5, rider: 'nearestEnemyOnFail' },
  },
})

/** 逐标记取值：`{ delta, autoFail?, rider? }`；未声明的标记交回引擎默认表（null）。 */
export function cityOfTheElderThingsChaosToken(state, inv, token) {
  const hard = hardSide(state)
  if (token === 'skull') {
    const keys = (valueKeysAt(state, 'investigator:' + (inv?.seat ?? 0)) || []).length
    return { delta: -(keys + (hard ? 2 : 0)) }
  }
  if (token === 'cultist') return { delta: -2, rider: hard ? 'placeKey' : 'placeKeyOnFail' }
  if (token === 'tablet') return { delta: hard ? -4 : -3, rider: hard ? 'tabletFrostDamage' : 'tabletFrost' }
  if (token === 'elderthing') return { delta: hard ? -5 : -4, rider: 'nearestEnemyOnFail' }
  return null
}

/** frost 标记是否在本次检定里被揭示（tablet 联动）。 */
export const frostRevealed = result => {
  const cancelled = new Set(result?.cancelledTokens || [])
  return (result?.drawn || []).some(token => token === 'frost' && !cancelled.has(token))
}

/** 检定结束后的标记后果（behavior.afterTest 读；幂等）。 */
export function cityOfTheElderThingsAfterTest(state, inv, result) {
  if (!inv || !result) return null
  const cancelled = new Set(result.cancelledTokens || [])
  const tokens = (result.drawn || []).filter(token => !cancelled.has(token))
  const riders = []
  const frost = frostRevealed(result)
  for (const token of tokens) {
    const meaning = CITY_OF_THE_ELDER_THINGS_TOKEN_MEANINGS[hardSide(state) ? 'hard' : 'standard'][token]
    if (!meaning?.rider) continue
    if (meaning.rider === 'placeKey') riders.push('placeKey')
    else if (meaning.rider === 'placeKeyOnFail' && !result.success) riders.push('placeKey')
    else if (meaning.rider === 'tabletFrost' && frost) { riders.push('autoFail'); riders.push('tabletFrost') }
    else if (meaning.rider === 'tabletFrostDamage' && frost) { riders.push('autoFail'); riders.push('autoFailDamage') }
    else if (meaning.rider === 'nearestEnemyOnFail' && !result.success) riders.push('nearestEnemy')
  }
  return [...new Set(riders)]
}

export const cardNameOf = code => ALL_CARDS[code]?.nameZh || ALL_CARDS[code]?.name || String(code)

```