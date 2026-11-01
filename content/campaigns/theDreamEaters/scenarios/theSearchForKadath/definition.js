// 寻觅卡达斯（The Search for Kadath · A2 · 06119）· 剧本数据（scenario 对象只含数据，不含函数）。
//
// 来源：
//   · 剧情正文（P8-T）：中文自译生成物 `content/campaigns/theDreamEaters/story-text.js` 的
//     `chapterStory('theSearchForKadath').sections`（intro / setup / regionSetup / rules / flavorText /
//     resolutions 与 en locale 顶层键一一对应）；`textLanguage:'zh-CN'` + `textStatus:'translated (self-translated)'`。
//   · 印刷数据：`content/campaigns/theDreamEaters/card-data.js`（本文件不重复录入卡面）
//   · 行为对齐：Haskell `Scenario/Scenarios/TheDreamEaters/TheSearchForKadath.hs` 与各 `CardDefs` 同名文件。
//
// 铁律：state.scenario = structuredClone(definition)，本文件只能有数据 + 卡号常量。
import { bindScenarioIdentities } from '../../../../identities.js'
import {
  location, veiledLocation, stages, encounterCards, encounterDefinitions, encounterDeck, storyCards,
  storyFace, veiledStoryFaces, identitiesFor,
} from '../../card-data.js'
import { chapterStory, flattenStory } from '../../story-access.js'
import { THE_SEARCH_FOR_KADATH_TOKEN_MEANINGS } from './chaos.js'

// ---------------------------------------------------------------------------
// 卡号常量（行为里只用常量，不写裸卡号）
// ---------------------------------------------------------------------------
export const REFERENCE_CODE = '06119'
export const VIRGIL_GRAY = '06144'
export const CATS_OF_ULTHAR = '06145'
export const STALKING_MANTICORE = '06146'
export const HORDE_OF_NIGHT = '06147'
export const BEINGS_OF_IB = '06148'
export const PRIEST_OF_A_THOUSAND_MASKS = '06149'
export const TENEBROUS_NIGHTGAUNT = '06150'
export const PACK_OF_VOONITHS = '06151'
export const NIGHTRIDERS = '06152'
export const SONG_OF_THE_MAGAH_BIRD = '06153'
export const WONDROUS_LANDS = '06154'
export const CRAWLING_MIST = '06086'
export const CORSAIR_OF_LENG = '06105'
export const ZOOG_SET = Object.freeze(['06106', '06107', '06108', '06109'])

// 区域（4 个）：键与 Haskell Region 构造子一致。
export const REGIONS = Object.freeze([
  { id: 'oriab', actIndex: 1, hub: 'baharna', locations: ['baharna', 'mtNgranek', 'namelessRuins'], label: '奥瑞巴岛（南）' },
  { id: 'mnar', actIndex: 2, hub: 'kadatheron', locations: ['kadatheron', 'sarnath', 'ruinsOfIb'], label: '米纳尔古地（西）' },
  { id: 'forbiddenLands', actIndex: 3, hub: 'ilekVad', locations: ['ilekVad', 'forbiddenLands', 'zulanThek'], label: '禁闭之地（北）' },
  { id: 'timelessRealm', actIndex: 4, hub: 'celephais', locations: ['celephais', 'serannian', 'hazuthKleg'], label: '永恒之国（东）' },
])
export const REGION_BY_ID = Object.freeze(Object.fromEntries(REGIONS.map(region => [region.id, region])))

// 港口地点（印刷 [[Port]]；正面议程的「撤退」行动由这些地点的 resign 提供）。
export const PORT_LOCATIONS = Object.freeze([
  'dylathLeen', 'kadatheron', 'ilekVad', 'baharna', 'celephais', 'serannian',
])

// ---------------------------------------------------------------------------
// 地点（17）：15 张 Veiled + 斯凯河 / 禁闭之地（由自身能力翻面）
// ---------------------------------------------------------------------------
// 5×6 网格的正交邻接（Haskell 地图文本，见 layout.js 注释）。
const CONNECTIONS = Object.freeze({
  baharna: ['ulthar', 'mtNgranek'],
  ulthar: ['baharna', 'skaiRiver'],
  serannian: ['celephais'],
  namelessRuins: ['mtNgranek'],
  mtNgranek: ['namelessRuins', 'skaiRiver', 'baharna'],
  skaiRiver: ['mtNgranek', 'dylathLeen', 'ulthar', 'sarnath'],
  dylathLeen: ['skaiRiver', 'celephais', 'kadatheron'],
  celephais: ['dylathLeen', 'cityWhichAppearsOnNoMap', 'serannian', 'hazuthKleg'],
  cityWhichAppearsOnNoMap: ['celephais', 'templeOfUnattainableDesires'],
  sarnath: ['skaiRiver', 'kadatheron', 'ruinsOfIb'],
  kadatheron: ['sarnath', 'dylathLeen', 'hazuthKleg'],
  hazuthKleg: ['kadatheron', 'celephais', 'templeOfUnattainableDesires'],
  templeOfUnattainableDesires: ['hazuthKleg', 'cityWhichAppearsOnNoMap'],
  ruinsOfIb: ['sarnath', 'ilekVad'],
  zulanThek: ['forbiddenLands'],
  forbiddenLands: ['zulanThek', 'ilekVad'],
  ilekVad: ['forbiddenLands', 'ruinsOfIb'],
})

const V = (id, code, extra = {}) => veiledLocation(id, code, {
  connections: CONNECTIONS[id],
  ...(PORT_LOCATIONS.includes(id) ? { resign: true } : {}),
  ...extra,
})

const locations = {
  ulthar: V('ulthar', '06127'),
  skaiRiver: location('skaiRiver', '06128', {
    connections: CONNECTIONS.skaiRiver, backCode: '06128b',
  }),
  dylathLeen: V('dylathLeen', '06129'),
  kadatheron: V('kadatheron', '06130'),
  sarnath: V('sarnath', '06131'),
  ruinsOfIb: V('ruinsOfIb', '06132'),
  ilekVad: V('ilekVad', '06133'),
  forbiddenLands: location('forbiddenLands', '06134', {
    connections: CONNECTIONS.forbiddenLands, backCode: '06134b',
  }),
  zulanThek: V('zulanThek', '06135'),
  baharna: V('baharna', '06136'),
  mtNgranek: V('mtNgranek', '06137'),
  namelessRuins: V('namelessRuins', '06138'),
  celephais: V('celephais', '06139'),
  serannian: V('serannian', '06140'),
  hazuthKleg: V('hazuthKleg', '06141'),
  templeOfUnattainableDesires: V('templeOfUnattainableDesires', '06142'),
  cityWhichAppearsOnNoMap: V('cityWhichAppearsOnNoMap', '06143'),
}

// 开局在场的 3 处；其余 14 处放在一边（区域设置才入场）。
export const START_LOCATION_IDS = Object.freeze(['ulthar', 'skaiRiver', 'dylathLeen'])
export const SET_ASIDE_LOCATION_IDS = Object.freeze(Object.keys(locations).filter(id => !START_LOCATION_IDS.includes(id)))

// 背面故事卡：15 张 Veiled 地带出 + 斯凯河 / 禁闭之地由自身翻面能力带出。
const storyFaces = {
  ...veiledStoryFaces(locations),
  '06128b': storyFace('06128b'),
  '06134b': storyFace('06134b'),
}

// ---------------------------------------------------------------------------
// 幕 / 议程
// ---------------------------------------------------------------------------
const ACT_CODES = Object.freeze(['06122', '06123', '06124', '06125', '06126'])
const AGENDA_CODES = Object.freeze(['06120', '06121'])

// 幕 1：轮末、位于[[港口]]地点的调查员团队花费 2×人数线索推进（引擎 objective + roundEndActIndex）。
const ACT_EXTRA = Object.freeze({
  '06122': { objective: { type: 'clues', perInvestigator: 2, atLocation: 'dylathLeen' } },
})
const AGENDA_EXTRA = Object.freeze({
  '06120': {},
  '06121': {},
})

// ---------------------------------------------------------------------------
// 遭遇牌库（6 个组）：单个卡号在 definition 与 manifest 区域里只出现一次
// ---------------------------------------------------------------------------
const DECK_GROUPS = Object.freeze([
  'theSearchForKadath', 'agentsOfNyarlathotep', 'corsairs', 'dreamlands', 'whispersOfHypnos', 'zoogs',
])
// setup 放在一边的敌人（数量按印刷 quantity）。
export const SET_ASIDE_ALIASES = Object.freeze([
  CATS_OF_ULTHAR, STALKING_MANTICORE, CRAWLING_MIST, HORDE_OF_NIGHT, BEINGS_OF_IB,
  TENEBROUS_NIGHTGAUNT, TENEBROUS_NIGHTGAUNT, CORSAIR_OF_LENG, CORSAIR_OF_LENG,
  PRIEST_OF_A_THOUSAND_MASKS, PRIEST_OF_A_THOUSAND_MASKS, PRIEST_OF_A_THOUSAND_MASKS,
])
const SET_ASIDE_ENEMY_CODE_SET = new Set(SET_ASIDE_ALIASES)
const deckCards = encounterCards(DECK_GROUPS).filter(card => !SET_ASIDE_ENEMY_CODE_SET.has(card.code))
const definitions = encounterDefinitions(encounterCards(DECK_GROUPS))

// ---------------------------------------------------------------------------
// 剧情正文（P8-T 自译；生成物 story-text.js → 本章 sections）
// ---------------------------------------------------------------------------
const story = chapterStory('theSearchForKadath')
const sections = story.sections
const text = value => flattenStory(value)
const sentence = (...parts) => parts.map(text).filter(Boolean).join('')

// en `intro` = 开场 1 正文 + 战役日志分支（story-text: sections.flavorText.intro1.body）。
const INTRO = text(sections.flavorText.intro1.body)

// en `setup` = 7 段步骤；story-text: sections.setup.*（en 里 putLocations 与 beginInUlthar 同段）。
const SETUP = [
  text(sections.setup.gatherSets),
  sentence(sections.setup.putLocations, sections.setup.beginInUlthar),
  text(sections.setup.setOtherLocationsAside),
  text(sections.setup.setEnemiesAside),
  text(sections.setup.spawnVooniths),
  text(sections.setup.takeControlOfVirgil),
  text(sections.setup.buildEncounterDeck),
].filter(Boolean).join('\n')

// en `regionSetup` = 4 个区域的步骤数组；story-text: sections.regionSetup.<region>.*
// （en 里 putLocations + placeInvestigators 同段；禁闭之地的两个生成步骤同段。）
const REGION_SETUP = {
  oriab: [
    text(sections.regionSetup.oriab.loseClues),
    text(sections.regionSetup.oriab.removeLocations),
    sentence(sections.regionSetup.oriab.putLocations, sections.regionSetup.oriab.placeInvestigators),
    text(sections.regionSetup.oriab.spawnNightriders),
    text(sections.regionSetup.oriab.advanceAct),
  ],
  mnar: [
    text(sections.regionSetup.mnar.loseClues),
    text(sections.regionSetup.mnar.removeLocations),
    sentence(sections.regionSetup.mnar.putLocations, sections.regionSetup.mnar.placeInvestigators),
    text(sections.regionSetup.mnar.spawnBeingsOfIb),
    text(sections.regionSetup.mnar.advanceAct),
  ],
  forbiddenLands: [
    text(sections.regionSetup.forbiddenLands.loseClues),
    text(sections.regionSetup.forbiddenLands.removeLocations),
    sentence(sections.regionSetup.forbiddenLands.putLocations, sections.regionSetup.forbiddenLands.placeInvestigators),
    sentence(sections.regionSetup.forbiddenLands.spawnManticore, sections.regionSetup.forbiddenLands.spawnHorde),
    text(sections.regionSetup.forbiddenLands.advanceAct),
  ],
  timelessRealm: [
    text(sections.regionSetup.timelessRealm.loseClues),
    text(sections.regionSetup.timelessRealm.removeLocations),
    sentence(sections.regionSetup.timelessRealm.putLocations, sections.regionSetup.timelessRealm.placeInvestigators),
    text(sections.regionSetup.timelessRealm.shuffleCrawlingMist),
    text(sections.regionSetup.timelessRealm.spawnPriests),
    text(sections.regionSetup.timelessRealm.advanceAct),
  ],
}

// en `rules` = 三条规则正文；story-text: sections.rules.<key>（标题留给 specialRules）。
const RULES = {
  locations: text(sections.rules.locations.body),
  veiled: text(sections.rules.veiled.body),
  swarmingAndVictory: text(sections.rules.swarmingAndVictory.body),
}

// en `specialRules` = 3 条 {id,title,body}；标题与正文均来自 story-text sections.rules.*。
const SPECIAL_RULES = [
  { id: 'locations', title: text(sections.rules.locations.title), body: RULES.locations },
  { id: 'veiled', title: text(sections.rules.veiled.title), body: RULES.veiled },
  { id: 'swarmingAndVictory', title: text(sections.rules.swarmingAndVictory.title), body: RULES.swarmingAndVictory },
]

// en `resolutions` 的正文；story-text 的 body 已含「结局 N：…」引导句（en 原文也没有独立标题行），
// 因此直接取 body 保持原有版式，避免再拼一遍 title。
const resolutionBody = key => text(sections.resolutions[key]?.body)
const RESOLUTION_1 = resolutionBody('resolution1')
const RESOLUTION_2 = resolutionBody('resolution2')
const NO_RESOLUTION = resolutionBody('noResolution')

// en `flavorText.investigatorDefeat`；story-text: sections.flavorText.investigatorDefeat.body。
const INVESTIGATOR_DEFEAT = text(sections.flavorText.investigatorDefeat.body)

// ---------------------------------------------------------------------------
// 剧本对象
// ---------------------------------------------------------------------------
export const scenario = {
  id: 'theSearchForKadath',
  originalCode: REFERENCE_CODE,
  name: '寻觅卡达斯',
  nameEn: 'The Search for Kadath',
  // P8-T：正文已切到 story-text.js 中文自译（textLanguage/textStatus 供审计）。
  textLanguage: 'zh-CN',
  textStatus: 'translated (self-translated)',
  intro: INTRO,
  setup: SETUP,
  startLocation: 'ulthar',
  locations,
  setAsideLocations: SET_ASIDE_LOCATION_IDS,
  acts: stages(ACT_CODES, 'act').map(act => ({
    ...act,
    reveal: { type: 'campaignRule' },
    ...(ACT_EXTRA[act.originalCode] || {}),
  })),
  agendas: stages(AGENDA_CODES, 'agenda').map(agenda => ({
    ...agenda,
    reveal: { type: 'campaignRule' },
    ...(AGENDA_EXTRA[agenda.originalCode] || {}),
  })),
  ...definitions,
  storyAssets: storyCards([VIRGIL_GRAY]),
  storyFaces,
  encounterDeck: encounterDeck(deckCards),
  tokenMeanings: THE_SEARCH_FOR_KADATH_TOKEN_MEANINGS,
  rules: RULES,
  regionSetup: REGION_SETUP,
  specialRules: SPECIAL_RULES,
  flavorText: {
    investigatorDefeat: INVESTIGATOR_DEFEAT,
  },
  resolutions: {
    noResolution: NO_RESOLUTION,
    resolution1: RESOLUTION_1,
    resolution2: RESOLUTION_2,
  },
}

export const identities = identitiesFor(scenario)
bindScenarioIdentities(scenario, identities)


// P8：本章 behavior.js 引用的印刷卡号统一放数据表（content 章节流程不写卡号字面量）。
export const RAW_CODES = Object.freeze({
  c06120: '06120',
  c06121: '06121',
  c06122: '06122',
  c06123: '06123',
  c06124: '06124',
  c06125: '06125',
  c06126: '06126',
  c06127: '06127',
  c06127b: '06127b',
  c06128: '06128',
  c06128b: '06128b',
  c06129: '06129',
  c06129b: '06129b',
  c06130: '06130',
  c06130b: '06130b',
  c06131: '06131',
  c06131b: '06131b',
  c06132: '06132',
  c06132b: '06132b',
  c06133: '06133',
  c06133b: '06133b',
  c06134: '06134',
  c06134b: '06134b',
  c06135: '06135',
  c06135b: '06135b',
  c06136: '06136',
  c06136b: '06136b',
  c06137: '06137',
  c06137b: '06137b',
  c06138: '06138',
  c06138b: '06138b',
  c06139: '06139',
  c06139b: '06139b',
  c06140: '06140',
  c06140b: '06140b',
  c06141: '06141',
  c06141b: '06141b',
  c06142: '06142',
  c06142b: '06142b',
  c06143: '06143',
  c06143b: '06143b',
  c06144: '06144',
  c06145: '06145',
  c06146: '06146',
  c06147: '06147',
  c06148: '06148',
  c06149: '06149',
  c06150: '06150',
  c06151: '06151',
  c06152: '06152',
  c06153: '06153',
  c06154: '06154',
})
