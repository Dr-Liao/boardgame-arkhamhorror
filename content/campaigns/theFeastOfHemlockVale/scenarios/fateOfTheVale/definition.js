// 山谷的命运（fateOfTheVale · 提示卡 10651）· 章节数据（scenario 只含数据）。
//
// 参考：Scenario/Scenarios/TheFeastOfHemlockVale/FateOfTheVale.hs +
//       Act|Agenda|Location|Enemy|Treachery|Story/CardDefs/TheFeastOfHemlockVale/FateOfTheVale.hs +
//       Act/Cards/.../FateOfTheVale/*.hs + Agenda/Cards/.../TheSilence|TheMiasma|TheSpiral.hs +
//       frontend/src/locales/en/theFeastOfHemlockVale/fateOfTheVale.json（权威印刷文本）。
//
// 卡号归属（input.entryPaths）：本组 fate_of_the_vale 共 30 条记录（含 a/b 关联面），
// 逐卡条目在 src/cards/encounter-entries/theFeastOfHemlockVale/fateOfTheVale/。
// 卡面数据一律从 card-data.js 的 printed()/location()/stage()/encounterDefinitions() 读取。
//
// 剧情正文来自内容生成物 story-text.js（经 story-access.js 读取）。本循环**没有官方中文**
// （story-summary.json：chineseGaps = 全部叶子），因此正文取英文印刷文本并显式声明
// textStatus：不冒充中文。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { bindScenarioIdentities } from '../../../../identities.js'
import { location, stage, encounterDefinitions, identitiesFor } from '../../card-data.js'
import { chapterStory, chapterText } from '../../story-access.js'
import { FATE_TOKEN_MEANINGS } from './chaos.js'

export const CHAPTER_ID = 'fateOfTheVale'
export const REFERENCE_CODE = '10651'
export const ENCOUNTER_CODE = 'fate_of_the_vale'

// ---------------------------------------------------------------------------
// 幕 / 议程
// ---------------------------------------------------------------------------
// 幕牌库开局只有 1a/2a；幕 3a 有四个版本（v.I–v.IV），由幕 2 背面「命运的选择」决定。
export const ACT_CODES = Object.freeze(['10655', '10656'])
export const ACT3_VARIANT_CODES = Object.freeze(['10657', '10658', '10659', '10660'])
export const ALL_ACT_CODES = Object.freeze([...ACT_CODES, ...ACT3_VARIANT_CODES])
export const AGENDA_CODES = Object.freeze(['10652', '10653', '10654'])
export const ACT1_CODE = ACT_CODES[0]
export const ACT2_CODE = ACT_CODES[1]
export const ACT3_CODE_BY_CHOICE = Object.freeze({
  letsEndThis: '10657', saveTheVale: '10658', burnItAll: '10659', escape: '10660',
})
export const ACT3_CODE = ACT3_VARIANT_CODES
export const AGENDA_CODE_BY_STAGE = Object.freeze({ 1: '10652', 2: '10653', 3: '10654' })

// 幕 2 背面的四个幕间选项（条件读战役记录；见 behavior.interludeOptions）。
export const INTERLUDE_CHOICES = Object.freeze(['letsEndThis', 'saveTheVale', 'burnItAll', 'escape'])

// ---------------------------------------------------------------------------
// gather 组与放一边
// ---------------------------------------------------------------------------
// setup.gatherSets：The Final Day、Fate of the Vale、Day of the Feast、Agents of the Colour、
// Fire!、Horrors in the Rock、Refractions、Residents、Transfiguration、The Vale。
export const GATHER_GROUPS = Object.freeze([
  'theFinalDay', 'fateOfTheVale', 'dayOfTheFeast', 'agentsOfTheColour', 'fire',
  'horrorsInTheRock', 'refractions', 'residents', 'transfiguration', 'theVale',
])
// 整组放一边的三组（参考 gatherAndSetAside）：Day of the Feast / Residents / Fire!。
export const GATHER_SET_ASIDE_GROUPS = Object.freeze(['dayOfTheFeast', 'residents', 'fire'])
// 只把「地点」放一边的两组（参考 setAsideEvery (... <> #location)）：The Vale / Horrors in the Rock。
export const LOCATION_SET_ASIDE_GROUPS = Object.freeze(['theVale', 'horrorsInTheRock'])
// 进遭遇牌库的组：gather 组里排除「整组放一边」的三组（The Vale 组只有地点与提示卡，
// Horrors in the Rock 组的地点放一边、敌人/诡计留在牌库）。
export const DECK_GROUPS = Object.freeze(['theFinalDay', 'fateOfTheVale', 'agentsOfTheColour',
  'horrorsInTheRock', 'refractions', 'transfiguration'])

const codesOfGroups = (groups, type) => Object.entries(ALL_CARDS)
  .filter(([, card]) => groups.some(group => card.encounterCode === camelToSnakeLocal(group)))
  .filter(([, card]) => !type || card.type === type)
  .map(([code]) => code)
  .sort()

function camelToSnakeLocal(value) {
  return String(value).replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase()
}

export const STORY_CARD_CODE = '10670b'
export const ABYSS_LOCATION_CODE = '10670'
export const SHATTERED_SELF_CODE = '10661'
export const OLD_MEMORY_CODE = '10661b'
export const CRYSTAL_MIMIC_CODE = '10671'
export const FRENZIED_REVELER_CODE = '10692'
export const FIRE_CODE = '10743'
export const DR_MARQUEZ_CODE = '10702'
// 棱柱碎片（剧情资产，写在岩间密语组）：幕 3a v.I 背面「自己动手」的条件读点。
export const PRISMATIC_SHARD_CODE = '10522'
export const TREACHERY_CODES = Object.freeze(['10672', '10673', '10674'])

// Resident 双面卡：资产面 10693–10703、敌人面 10693b–10701b（10702/10703 只有资产面）。
export const RESIDENT_ASSET_CODES = Object.freeze([
  '10693', '10694', '10695', '10696', '10697', '10698', '10699', '10700', '10701', '10702', '10703',
])
export const RESIDENT_ENEMY_CODES = Object.freeze([
  '10693b', '10694b', '10695b', '10696b', '10697b', '10698b', '10699b', '10700b', '10701b',
])
export const RESIDENT_ENEMY_BY_ASSET = Object.freeze({
  '10693': '10693b', '10694': '10694b', '10695': '10695b', '10696': '10696b', '10697': '10697b',
  '10698': '10698b', '10699': '10699b', '10700': '10700b', '10701': '10701b',
})
export const residentAssetOf = code => {
  const enemy = String(code || '')
  return Object.keys(RESIDENT_ENEMY_BY_ASSET).find(asset => RESIDENT_ENEMY_BY_ASSET[asset] === enemy) || null
}

// The Vale 地点（双面）与 Horrors in the Rock 的 [[洞穴]] 地点（放一边）。
export const VALE_LOCATION_CODES = Object.freeze([
  '10705b', '10706b', '10707b', '10708b', '10709b', '10710b', '10711b', '10712b',
])
export const CAVE_LOCATION_CODES = Object.freeze(['10716', '10717', '10718', '10719', '10720'])
export const VALE_LOCATION_BY_ID = Object.freeze({
  boardingHouse: '10705b', theCrossroads: '10706b', hemlockChapel: '10707b', theOldMill: '10708b',
  theAtwoodHouse: '10709b', tadsGeneralStore: '10710b', valeSchoolhouse: '10711b', theCommons: '10712b',
})
export const THE_CROSSROADS_ID = 'theCrossroads'
export const BOARDING_HOUSE_ID = 'boardingHouse'
export const THE_COMMONS_ID = 'theCommons'
export const THE_ATWOOD_HOUSE_ID = 'theAtwoodHouse'

// 放一边（剧本卡/幕 3a/水晶仿体/居民/火/狂乱的赴宴者）；地点另见 setAsideLocations。
export const SET_ASIDE_CARDS = Object.freeze([
  ...ACT3_VARIANT_CODES,
  STORY_CARD_CODE,
  CRYSTAL_MIMIC_CODE, CRYSTAL_MIMIC_CODE,
  FRENZIED_REVELER_CODE,
  ...Array(Math.max(1, Number(ALL_CARDS[FIRE_CODE]?.quantity) || 5)).fill(FIRE_CODE),
  ...RESIDENT_ASSET_CODES,
  ...RESIDENT_ENEMY_CODES,
])

// ---------------------------------------------------------------------------
// 遭遇牌库
// ---------------------------------------------------------------------------
// 「Shuffle each remaining encounter card along with the top 5 cards of each investigator's deck
// together … This is The Abyss.」（遭遇牌库被深渊取代，见 behavior.abyss*。）
// 双面宇宙密使（8 个面）在布置时直接入场，不洗入牌库。
const EMISSARY_CARD_CODES = Object.freeze([
  '10662a', '10662b', '10663a', '10663b', '10664a', '10664b', '10665a', '10665b',
])
export const ENCOUNTER_DECK = Object.freeze(codesOfGroups(DECK_GROUPS, null)
  .filter(code => ['enemy', 'treachery'].includes(ALL_CARDS[code].type))
  .filter(code => !SET_ASIDE_CARDS.includes(code) && !EMISSARY_CARD_CODES.includes(code))
  .flatMap(code => Array(Math.max(1, Number(ALL_CARDS[code].quantity) || 1)).fill(code)))
export const ENCOUNTER_DECK_CODES = Object.freeze([...new Set(ENCOUNTER_DECK)])

// ---------------------------------------------------------------------------
// 地点
// ---------------------------------------------------------------------------
// 四个镜巢围成环：每个镜巢与顺时针、逆时针相邻的镜巢互相连接。
// 四个镜巢的卡面不同（10666 攻击 / 10667 躲避 / 10668 调查 / 10669 弃牌+查找深渊），
// 因此位置→卡号映射由 behavior.nestAssignment 洗牌决定（隐藏信息），这里给默认顺序。
export const MIRROR_NEST_POSITIONS = Object.freeze(['mirrorNestTop', 'mirrorNestRight', 'mirrorNestBottom', 'mirrorNestLeft'])
export const MIRROR_NEST_CODES = Object.freeze(['10666', '10667', '10668', '10669'])
export const MIRROR_NEST_CODE_BY_POSITION = Object.freeze(Object.fromEntries(
  MIRROR_NEST_POSITIONS.map((id, index) => [id, MIRROR_NEST_CODES[index]])))
export const ABYSS_LOCATION_ID = 'theAbyss'

const NEST_SYMBOLS = Object.freeze({
  mirrorNestTop: 'moon', mirrorNestRight: 'square', mirrorNestBottom: 'triangle', mirrorNestLeft: 'circle',
})
const NEST_LINKS = Object.freeze({
  mirrorNestTop: ['mirrorNestRight', 'mirrorNestLeft'],
  mirrorNestRight: ['mirrorNestTop', 'mirrorNestBottom'],
  mirrorNestBottom: ['mirrorNestRight', 'mirrorNestLeft'],
  mirrorNestLeft: ['mirrorNestTop', 'mirrorNestBottom'],
})
export const LOCATION_CONNECTIONS = Object.freeze({
  ...Object.fromEntries(MIRROR_NEST_POSITIONS.map(id => [id, [...NEST_LINKS[id]]])),
  [ABYSS_LOCATION_ID]: [],
})

// The Vale（黑夜面）与 Horrors in the Rock 的洞穴地点：放一边，幕间/深渊抽到时入场。
// 印刷地图连接不在卡表里，因此这里用「印刷顺序围成一环」的近似连线（behavior 披露）。
const VALE_RING = Object.freeze(['theCrossroads', 'boardingHouse', 'hemlockChapel', 'theOldMill',
  'theAtwoodHouse', 'tadsGeneralStore', 'valeSchoolhouse', 'theCommons'])
const VALE_RING_CONNECTIONS = Object.freeze(Object.fromEntries(VALE_RING.map((id, index) => [
  id, [VALE_RING[(index + VALE_RING.length - 1) % VALE_RING.length], VALE_RING[(index + 1) % VALE_RING.length]],
])))
const CAVE_RING = Object.freeze(['dryDen', 'alkalinePillars', 'iridescentPassage', 'overgrownTunnel', 'mineralTunnel'])
const CAVE_RING_CONNECTIONS = Object.freeze(Object.fromEntries(CAVE_RING.map((id, index) => [
  id, [CAVE_RING[(index + CAVE_RING.length - 1) % CAVE_RING.length], CAVE_RING[(index + 1) % CAVE_RING.length]],
])))

export const VALE_LOCATION_IDS = Object.freeze([...VALE_RING])
export const CAVE_LOCATION_IDS = Object.freeze([...CAVE_RING])
export const CAVE_LOCATION_CODE_BY_ID = Object.freeze(Object.fromEntries(
  CAVE_RING.map((id, index) => [id, CAVE_LOCATION_CODES[index]])))

const NEST_LOCATIONS = Object.fromEntries(MIRROR_NEST_POSITIONS.map(positionId => [positionId, location({
  id: positionId,
  code: MIRROR_NEST_CODE_BY_POSITION[positionId],
  symbol: NEST_SYMBOLS[positionId],
  cluesPerInvestigator: 2,
  connections: [...NEST_LINKS[positionId]],
  lair: true,
  shattered: true,
  mirrorNest: true,
  side: 'shattered',
})]))

const ABYSS_LOCATION = location({
  id: ABYSS_LOCATION_ID,
  code: ABYSS_LOCATION_CODE,
  cluesPerInvestigator: 2,
  connections: [],
  storyCode: STORY_CARD_CODE,
  abyss: true,
  aside: true,
  extradimensional: true,
  shattered: true,
  // 「强制 - 当你进入深渊时，如果深渊中有牌：你阵亡。」由 behavior.locationEntered 结算。
  entryKillsIfAbyssHasCards: true,
})

const VALE_LOCATIONS = Object.fromEntries(VALE_RING.map(id => [id, location({
  id,
  code: VALE_LOCATION_BY_ID[id],
  connections: [...VALE_RING_CONNECTIONS[id]],
  nightSide: true,
  aside: true,
  hemlockVale: true,
})]))

const CAVE_LOCATIONS = Object.fromEntries(CAVE_RING.map(id => [id, location({
  id,
  code: CAVE_LOCATION_CODE_BY_ID[id],
  connections: [...CAVE_RING_CONNECTIONS[id]],
  aside: true,
  cave: true,
  shattered: true,
})]))

export const LOCATIONS = Object.freeze({
  ...NEST_LOCATIONS,
  [ABYSS_LOCATION_ID]: ABYSS_LOCATION,
  ...VALE_LOCATIONS,
  ...CAVE_LOCATIONS,
})
export const SET_ASIDE_LOCATION_IDS = Object.freeze([ABYSS_LOCATION_ID, ...VALE_RING, ...CAVE_RING])
export const START_LOCATION = 'mirrorNestTop'

// 桌面坐标：Haskell#cosmicEmissaryLayout 的 6×6 网格投影（密使占据镜巢之间的格位）。
export const LOCATION_COORDINATES = Object.freeze({
  mirrorNestTop: { x: 3, y: 1 },
  mirrorNestLeft: { x: 1, y: 2 },
  [ABYSS_LOCATION_ID]: { x: 3, y: 2 },
  mirrorNestRight: { x: 4, y: 3 },
  mirrorNestBottom: { x: 2, y: 4 },
  ...Object.fromEntries(VALE_RING.map((id, index) => [id, { x: index % 4, y: 6 + Math.floor(index / 4) }])),
  ...Object.fromEntries(CAVE_RING.map((id, index) => [id, { x: index % 4, y: 9 + Math.floor(index / 4) }])),
})

// ---------------------------------------------------------------------------
// 宇宙密使阵形
// ---------------------------------------------------------------------------
// 参考 cosmicEmissaryFormation：四个密使各紧邻一个镜巢；正面 [[星之彩]]、背面 [[破碎]]。
export const EMISSARY_FORMATION = Object.freeze([
  Object.freeze({ position: 'mirrorNestTop', label: 'cosmicEmissaryAbyss', front: '10662a', back: '10662b', name: '宇宙密使·深渊', rotation: 0 }),
  Object.freeze({ position: 'mirrorNestRight', label: 'cosmicEmissaryMiasma', front: '10664a', back: '10664b', name: '宇宙密使·瘴气', rotation: 270 }),
  Object.freeze({ position: 'mirrorNestBottom', label: 'cosmicEmissaryBrilliance', front: '10665a', back: '10665b', name: '宇宙密使·光辉', rotation: 0 }),
  Object.freeze({ position: 'mirrorNestLeft', label: 'cosmicEmissaryPhantasm', front: '10663a', back: '10663b', name: '宇宙密使·幻影', rotation: 90 }),
])
export const EMISSARY_CODES = Object.freeze(EMISSARY_FORMATION.flatMap(item => [item.front, item.back]))

// ---------------------------------------------------------------------------
// 幕 / 议程阶段
// ---------------------------------------------------------------------------
// 幕 1「破碎记忆」：目标 —— 每位玩家都拿到自己「真正的」调查员卡时推进（攻击/躲避镜巢由
// Mirror Nest 自身的回合末强制效果结算）。
export const ACT_STAGES = Object.freeze({
  1: Object.freeze({ ...stage(ACT1_CODE), objective: { type: 'trueSelves', perInvestigator: 0 } }),
  2: Object.freeze({ ...stage(ACT2_CODE), objective: { type: 'caves', amount: 3, roundEnd: true } }),
  // 幕 3a 的四个版本（同一幕号，推进条件各不相同）。
  3: Object.freeze({
    ...stage('10657'),
    objective: { type: 'clues', perInvestigator: 2, roundEnd: true, allAt: ABYSS_LOCATION_ID },
  }),
  4: Object.freeze({
    ...stage('10658'),
    objective: { type: 'clues', perInvestigator: 3, noResidents: true },
  }),
  5: Object.freeze({
    ...stage('10659'),
    objective: { type: 'fire', amount: 5, roundEnd: true },
  }),
  6: Object.freeze({
    ...stage('10660'),
    objective: { type: 'resigned', resignRemembered: 5 },
  }),
})
export const ACT_STAGE_BY_CODE = Object.freeze({
  [ACT1_CODE]: 1, [ACT2_CODE]: 2, '10657': 3, '10658': 4, '10659': 5, '10660': 6,
})
export const AGENDA_STAGES = Object.freeze({
  1: Object.freeze(stage(AGENDA_CODE_BY_STAGE[1])),
  2: Object.freeze(stage(AGENDA_CODE_BY_STAGE[2])),
  3: Object.freeze(stage(AGENDA_CODE_BY_STAGE[3])),
})
export const ACTS = Object.freeze([structuredClone(ACT_STAGES[1]), structuredClone(ACT_STAGES[2])])
export const AGENDAS = Object.freeze([1, 2, 3].map(number => structuredClone(AGENDA_STAGES[number])))

// 幕 3a v.II 的居民谈判与 v.III 的引线/火势规则：数值写进 scenario 供 behavior 读取。
export const ACT3_RULES = Object.freeze({
  v2Parley: { handDiscard: 1, difficulty: 3, skills: ['willpower', 'intellect'], clueCostPerInvestigator: 1 },
  v2ObjectiveClues: 3,
  v3Kindling: { cluesPerKindling: 'perInvestigator', extraKindlingResources: 5, fireCopiesToAdvance: 5 },
  v4ResignRememberedKeys: Object.freeze(['theInvestigatorsFoundGas', 'theInvestigatorsFoundTheosTruck',
    'theRoadIsClear', 'theSurveyNotesWereRecovered', 'bertieIsFleeing', 'theSamplesWereFound']),
  v4ResignRememberedRequired: 5,
})

// ---------------------------------------------------------------------------
// 遭遇定义
// ---------------------------------------------------------------------------
const definitions = encounterDefinitions([
  ...ENCOUNTER_DECK_CODES, FIRE_CODE,
  ...RESIDENT_ENEMY_CODES,
  FRENZIED_REVELER_CODE,
  CRYSTAL_MIMIC_CODE,
  ...EMISSARY_CODES,
  STORY_CARD_CODE,
  OLD_MEMORY_CODE,
])

// 双面敌人/地点的遭遇定义只有「正面」数值来自卡表；背面由 behavior 翻面时读取。
export const ENEMY_DEFINITIONS = Object.freeze(definitions.enemies)
export const TREACHERY_DEFINITIONS = Object.freeze(definitions.treacheries)
export const STORY_ASSET_DEFINITIONS = Object.freeze(definitions.storyAssets)

// ---------------------------------------------------------------------------
// 章节正文（英文印刷文本；本循环无官方中文）
// ---------------------------------------------------------------------------
const SECTIONS_EN = (() => {
  try {
    return chapterStory(CHAPTER_ID).sectionsEn || {}
  } catch {
    return {}
  }
})()

const plain = (key, fallback = '') => {
  const raw = chapterText(CHAPTER_ID, key, 'en') || fallback
  return String(raw)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|li|h\d|div|ul)>/gi, '\n')
    .replace(/<li>/gi, '- ')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .split('\n').map(line => line.trim()).filter(Boolean).join('\n')
}

export const SCENARIO_TEXT = Object.freeze({
  textLanguage: 'en',
  textStatus: 'printed-en (official zh locale missing; falls back to en)',
  heading: plain('intro.title'),
  intro: plain('intro.body'),
  setup: Object.freeze({
    gatherSets: plain('setup.gatherSets'),
    nightThree: plain('setup.nightThree'),
    shatteredSelf: plain('setup.shatteredSelf'),
    mirrorNests: plain('setup.mirrorNests'),
    shuffleMirrorNests: plain('setup.shuffleMirrorNests'),
    connections: plain('setup.connections'),
    startingLocation: plain('setup.startingLocation'),
    setAside: plain('setup.setAside'),
    removeScenarioReference: plain('setup.removeScenarioReference'),
    createTheAbyss: plain('setup.createTheAbyss'),
    seedAbyssDeck: plain('setup.seedAbyssDeck'),
    shuffleTrueSelves: plain('setup.shuffleTrueSelves'),
    placeTheAbyss: plain('setup.placeTheAbyss'),
  }),
  specialRules: Object.freeze([
    Object.freeze({ id: 'theAbyss', title: plain('theAbyss.title'), body: plain('theAbyss.body') }),
    Object.freeze({ id: 'cosmicEmissary', title: plain('cosmicEmissary.title'), body: plain('cosmicEmissary.body') }),
    Object.freeze({ id: 'shatteredSelf', title: plain('shatteredSelf.title'), body: plain('shatteredSelf.body') }),
  ]),
  interlude: Object.freeze({
    title: plain('interlude.title'),
    labels: Object.freeze({
      letsEndThis: plain('interlude.label.letsEndThis'),
      saveTheVale: plain('interlude.label.saveTheVale'),
      burnItAll: plain('interlude.label.burnItAll'),
      escape: plain('interlude.label.escape'),
    }),
    steps: Object.freeze({
      1: plain('interlude.fateOfTheVale1'),
      2: plain('interlude.fateOfTheVale2'),
      3: plain('interlude.fateOfTheVale3'),
      4: plain('interlude.fateOfTheVale4'),
      5: plain('interlude.fateOfTheVale5'),
    }),
    removeEachMirrorNestAndCave: plain('interlude.removeEachMirrorNestAndCave'),
    putEachSetAsideHemlockValeLocationIntoPlay: plain('interlude.putEachSetAsideHemlockValeLocationIntoPlay'),
    moveEachInvestigatorToTheCrossroads: plain('interlude.moveEachInvestigatorToTheCrossroads'),
    placeCards: plain('interlude.placeCards'),
    flipCosmicEmissaryEnemies: plain('interlude.flipCosmicEmissaryEnemies'),
    resumePlaying: plain('interlude.resumePlaying'),
  }),
  resolutions: Object.freeze({
    noResolution: Object.freeze({ title: plain('resolutions.noResolution.title'), body: plain('resolutions.noResolution.body') }),
    resolution1: Object.freeze({ title: plain('resolutions.resolution1.title'), body: plain('resolutions.resolution1.body') }),
    resolution2: Object.freeze({ title: plain('resolutions.resolution2.title'), body: plain('resolutions.resolution2.body') }),
    resolution3: Object.freeze({ title: plain('resolutions.resolution3.title'), body: plain('resolutions.resolution3.body') }),
    resolution4: Object.freeze({ title: plain('resolutions.resolution4.title'), body: plain('resolutions.resolution4.body') }),
    resolution5: Object.freeze({ title: plain('resolutions.resolution5.title'), body: plain('resolutions.resolution5.body') }),
  }),
  xp: Object.freeze({
    cosmicEmissary: plain('resolutions.xp.cosmicEmissary'),
    savedTheVale: plain('resolutions.xp.savedTheVale'),
    eradicatedTheColour: plain('resolutions.xp.eradicatedTheColour'),
    survivedTheFeast: plain('resolutions.xp.survivedTheFeast'),
  }),
  codex: Object.freeze({
    leahAtwood: plain('codex.leahAtwood.title'),
    simeonAtwood: plain('codex.simeonAtwood.title'),
    williamHemlock: plain('codex.williamHemlock.title'),
    riverHawthorne: plain('codex.riverHawthorne.title'),
    gideonMizrah: plain('codex.gideonMizrah.title'),
    judithPark: plain('codex.judithPark.title'),
    theoPeters: plain('codex.theoPeters.title'),
    drRosaMarquez: plain('codex.drRosaMarquez.title'),
    bertieMusgrave: plain('codex.bertieMusgrave.title'),
  }),
})

export const RESOLUTION_KEYS = Object.freeze(['noResolution', 'resolution1', 'resolution2', 'resolution3', 'resolution4', 'resolution5'])

export const scenario = {
  id: CHAPTER_ID,
  originalCode: REFERENCE_CODE,
  encounterCode: ENCOUNTER_CODE,
  name: '山谷的命运 · Fate of the Vale',
  intro: SCENARIO_TEXT.intro,
  setup: SCENARIO_TEXT.setup.setAside,
  specialRules: SCENARIO_TEXT.specialRules,
  startLocation: START_LOCATION,
  locations: LOCATIONS,
  setAsideLocations: [...SET_ASIDE_LOCATION_IDS],
  acts: ACTS,
  agendas: AGENDAS,
  ...definitions,
  encounterDeck: [...ENCOUNTER_DECK],
  resolutions: Object.fromEntries(RESOLUTION_KEYS.map(key => [key,
    (SCENARIO_TEXT.resolutions[key]?.body || '')])),
  resolutionTitles: Object.fromEntries(RESOLUTION_KEYS.map(key => [key,
    (SCENARIO_TEXT.resolutions[key]?.title || key)])),
  tokenMeanings: {
    easy: { ...FATE_TOKEN_MEANINGS.easy }, standard: { ...FATE_TOKEN_MEANINGS.standard },
    hard: { ...FATE_TOKEN_MEANINGS.hard }, expert: { ...FATE_TOKEN_MEANINGS.expert },
  },
  textLanguage: SCENARIO_TEXT.textLanguage,
  textStatus: SCENARIO_TEXT.textStatus,
}

export const identities = identitiesFor(scenario)
bindScenarioIdentities(scenario, identities)

export const CARD_DATA = Object.freeze(Object.fromEntries([
  REFERENCE_CODE,
  ...ALL_ACT_CODES, ...AGENDA_CODES,
  ...MIRROR_NEST_CODES, ABYSS_LOCATION_CODE, STORY_CARD_CODE,
  SHATTERED_SELF_CODE, OLD_MEMORY_CODE, CRYSTAL_MIMIC_CODE, FRENZIED_REVELER_CODE,
  ...EMISSARY_CODES, ...TREACHERY_CODES, ...RESIDENT_ASSET_CODES, ...RESIDENT_ENEMY_CODES,
  ...VALE_LOCATION_CODES, ...CAVE_LOCATION_CODES,
].map(code => [code, ALL_CARDS[code]])))
