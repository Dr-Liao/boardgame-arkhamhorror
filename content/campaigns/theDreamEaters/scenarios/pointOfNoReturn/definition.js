// 《无归之地》（Point of No Return，06247）· 卡面数据装配。
//
// 规则事实源：
//   · 参考实现 `参考资源/ArkhamHorror-main/backend/.../Scenario/Scenarios/TheDreamEaters/PointOfNoReturn.hs`
//     与 `{Act,Agenda,Enemy,Location,Story,Treachery,Asset}/Cards/TheDreamEaters/PointOfNoReturn/*.hs`；
//   · 英文 locale `frontend/src/locales/en/theDreamEaters/scenarios/pointOfNoReturn.json`（锁定哈希）；
//     剧情正文来自 P8-T 自译生成物 `../../story-text.js`（story-source → tools/import-tde-story.mjs 生成），
//     本章只投影键名（textLanguage='zh-CN' + textStatus='translated (self-translated)'）。
//
// 本文件只做「本章怎么用这些卡」：印刷数值/卡文全部来自 `../card-data.js`（cards-data 唯一事实源）。
// 逐卡规则键放这里（行为层读；单卡条目 flags 携带同一份键，索引重建后优先读条目）。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import {
  location, veiledLocation, stages, encounterCards, encounterDefinitions, encounterDeck, storyCards,
  storyFace, veiledStoryFaces, identitiesFor, linkSymbolLocations,
} from '../../card-data.js'
import { bindScenarioIdentities } from '../../../../identities.js'
import { chapterStory, flattenStory, storyParagraphs } from '../../story-access.js'

// ---- 卡号常量（章节行为/测试共用；行为层不写卡号分支，只按数据表分派） ----
export const CODES = Object.freeze({
  scenario: '06247',
  aSinisterRealm: '06248',
  besetByMonsters: '06249',
  actOneV1: '06250',
  actOneV2: '06251',
  theDescent: '06252',
  theBlackExpanse: '06253',
  gugSentinel: '06267',
  richardUptonPickman: '06266',
  falseAwakening: '06275',
  enchantedWoods: '06053',
})

export const LOCATION_IDS = Object.freeze({
  vaultsOfZin: 'vaultsOfZin',
  cityOfGugs: 'cityOfGugs',
  towerOfKoth: 'towerOfKoth',
  plainOfTheGhouls: 'plainOfTheGhouls',
  cragOfTheGhouls: 'cragOfTheGhouls',
  seaOfBones: 'seaOfBones',
  peaksOfThok: 'peaksOfThok',
  valeOfPnath: 'valeOfPnath',
  seaOfPitch262: 'seaOfPitch262',
  seaOfPitch263: 'seaOfPitch263',
  seaOfPitch264: 'seaOfPitch264',
  seaOfPitch265: 'seaOfPitch265',
  enchantedWoods: 'enchantedWoods',
})

export const SEA_OF_PITCH_IDS = Object.freeze([
  LOCATION_IDS.seaOfPitch262, LOCATION_IDS.seaOfPitch263,
  LOCATION_IDS.seaOfPitch264, LOCATION_IDS.seaOfPitch265,
])
// 初始入场 4 地点；其余 8 张放一边（act 推进时入场）。
export const START_LOCATION = LOCATION_IDS.vaultsOfZin
export const INITIAL_LOCATIONS = Object.freeze([
  LOCATION_IDS.vaultsOfZin, LOCATION_IDS.cityOfGugs, LOCATION_IDS.towerOfKoth, LOCATION_IDS.plainOfTheGhouls,
])
export const SET_ASIDE_LOCATIONS = Object.freeze([
  LOCATION_IDS.cragOfTheGhouls, LOCATION_IDS.seaOfBones, LOCATION_IDS.peaksOfThok,
  LOCATION_IDS.valeOfPnath, ...SEA_OF_PITCH_IDS, LOCATION_IDS.enchantedWoods,
])

// ---- 地点 ----
// 符号/连线来自 Location/CardDefs/TheDreamEaters/PointOfNoReturn.hs（location code name traits symbol links set）。
// 4 张漆黑之海同为 plus 符号并互相连接（links 含 plus）；Vale of Pnath 的 equals 把它们接到山谷。
const locations = {
  vaultsOfZin: veiledLocation(LOCATION_IDS.vaultsOfZin, '06254', {
    symbol: 'heart', links: ['t', 'moon'],
  }),
  cityOfGugs: location(LOCATION_IDS.cityOfGugs, '06255', {
    symbol: 't', links: ['heart', 'squiggle', 'moon'],
  }),
  towerOfKoth: location(LOCATION_IDS.towerOfKoth, '06256', {
    symbol: 'squiggle', links: ['t', 'square'],
  }),
  plainOfTheGhouls: veiledLocation(LOCATION_IDS.plainOfTheGhouls, '06257', {
    symbol: 'moon', links: ['heart', 't', 'hourglass'],
  }),
  cragOfTheGhouls: veiledLocation(LOCATION_IDS.cragOfTheGhouls, '06258', {
    symbol: 'hourglass', links: ['equals', 'circle', 'moon'],
  }),
  seaOfBones: location(LOCATION_IDS.seaOfBones, '06259', {
    symbol: 'circle', links: ['hourglass', 'star', 'equals'],
  }),
  peaksOfThok: location(LOCATION_IDS.peaksOfThok, '06260', {
    symbol: 'star', links: ['equals', 'circle'],
  }),
  valeOfPnath: veiledLocation(LOCATION_IDS.valeOfPnath, '06261', {
    symbol: 'equals', links: ['hourglass', 'star', 'circle', 'plus'],
  }),
  seaOfPitch262: veiledLocation(LOCATION_IDS.seaOfPitch262, '06262', {
    symbol: 'plus', links: ['equals', 'plus'],
  }),
  seaOfPitch263: veiledLocation(LOCATION_IDS.seaOfPitch263, '06263', {
    symbol: 'plus', links: ['equals', 'plus'],
  }),
  seaOfPitch264: veiledLocation(LOCATION_IDS.seaOfPitch264, '06264', {
    symbol: 'plus', links: ['equals', 'plus'],
  }),
  seaOfPitch265: veiledLocation(LOCATION_IDS.seaOfPitch265, '06265', {
    symbol: 'plus', links: ['equals', 'plus'],
  }),
  // 放一边的魔幻森林（石板暗门）：由背面故事「另一条路」以已揭示状态放入场。
  enchantedWoods: location(LOCATION_IDS.enchantedWoods, '06053', {
    symbol: 'square', links: ['squiggle', 'triangle', 'diamond'],
  }),
}
// 漆黑之海的印表帷幕是「X」的 -2 占位；实例归零，X 由 behavior.locationShroudModifier 给出。
for (const id of SEA_OF_PITCH_IDS) {
  locations[id].shroud = 0
  locations[id].shroudEqualsReferenceDamage = true
}
linkSymbolLocations(locations)

// 地点规则键（行为层按 data 分派，不写卡号分支）。条目 flags 携带同一份键，索引重建后优先。
export const LOCATION_RULES = Object.freeze({
  '06254': { flipStory: '06254b' },
  '06255': { flipStory: '06255b', flipOnEnter: true },
  '06256': { flipStory: '06256b', flipAction: { skill: 'combat', difficulty: 5 } },
  '06257': { flipStory: '06257b', gugCannotEnter: true, gugSpawnRedirectTo: LOCATION_IDS.cityOfGugs },
  '06258': { flipStory: '06258b', firstMythosTreacherySurge: true },
  '06259': { flipStory: '06259b', flipOnCluesDiscovered: true },
  '06260': { flipStory: '06260b' },
  '06261': { flipStory: '06261b', blocksPlayAndCommitWhileClues: true },
  '06262': { flipStory: '06262b' },
  '06263': { flipStory: '06263b' },
  '06264': { flipStory: '06264b' },
  '06265': { flipStory: '06265b' },
})

// ---- 幕 / 议程 ----
// 幕 1 有两个版本：进入地下世界 v.I（Randolph 未生还）/ v.II（Randolph 生还）。
// v.I 的 hero 卡装备进「印刷阶段」但在 definition 里 v.II 作为备选数据放 ACT_ONE_VARIANTS。
const actOneV1 = {
  ...stages(['06250'], 'act')[0],
  id: 'act1',
  stage: '1a',
  reveal: { type: 'campaignRule' },
  advanceRule: 'enteringTheUnderworldV1',
  takeCluesOnEnemyDefeat: true,
  placeSetAsideLocations: { trait: 'Vale' },
  removeFromGameGroups: ['ghouls', 'strikingFear'],
  shuffleIntoDeckGroups: ['terrorOfTheVale', 'nightgaunts'],
  shuffleDiscardIntoDeck: true,
}
const actOneV2 = {
  ...stages(['06251'], 'act')[0],
  id: 'act1',
  stage: '1a',
  reveal: { type: 'campaignRule' },
  advanceRule: 'enteringTheUnderworldV2',
  takeCluesOnEnemyDefeat: true,
  giveStoryAsset: CODES.richardUptonPickman,
  removeStoryAssetOnLeave: CODES.richardUptonPickman,
  placeSetAsideLocations: { trait: 'Vale' },
  removeFromGameGroups: ['strikingFear'],
  shuffleIntoDeckGroups: ['terrorOfTheVale', 'nightgaunts'],
  shuffleDiscardIntoDeck: true,
}
export const ACT_ONE_VARIANTS = Object.freeze({ v1: actOneV1, v2: actOneV2 })

const actTwo = {
  ...stages(['06252'], 'act')[0],
  id: 'act2',
  stage: '2a',
  reveal: { type: 'campaignRule' },
  advanceRule: 'theDescent',
  takeCluesOnEnemyDefeat: true,
  placeSetAsideLocations: { trait: 'Depths' },
  shuffleIntoDeckGroups: ['descentIntoThePitch', 'agentsOfAtlachNacha'],
  shuffleDiscardIntoDeck: true,
}
const actThree = {
  ...stages(['06253'], 'act')[0],
  id: 'act3',
  stage: '3a',
  reveal: { type: 'campaignRule' },
  advanceRule: 'theBlackExpanse',
  takeCluesOnEnemyDefeat: true,
  finishOnAdvance: 'resolution1',
}

const agendas = [
  {
    ...stages(['06248'], 'agenda')[0],
    id: 'agenda1',
    stage: '1a',
    reveal: { type: 'campaignRule' },
    advanceRule: 'aSinisterRealm',
    shuffleDiscardOnAdvance: true,
    distortionOnAdvance: 1,
  },
  {
    ...stages(['06249'], 'agenda')[0],
    id: 'agenda2',
    stage: '2a',
    reveal: { type: 'campaignRule' },
    advanceRule: 'besetByMonsters',
    advanceChoice: { discardRandom: 1, loseResources: 2 },
    shuffleDiscardOnAdvance: true,
    distortionOnAdvance: 1,
    finishAtDistortion: 5,
    revertOnAdvance: true,
  },
]

// ---- 遭遇组 ----
const GATHER_GROUPS = ['pointOfNoReturn', 'creaturesOfTheUnderworld', 'whispersOfHypnos',
  'ancientEvils', 'ghouls', 'strikingFear']
const SET_ASIDE_GROUPS = ['descentIntoThePitch', 'terrorOfTheVale', 'agentsOfAtlachNacha', 'nightgaunts']
// 放一边的「组」：整组不洗进初始遭遇牌库，由幕推进/故事效果洗入。
const SET_ASIDE_GROUP_CARD_CODES = [...encounterDeck(encounterCards(SET_ASIDE_GROUPS))]
// 单张放一边：Gug Sentinel、Richard Upton Pickman、False Awakening。
const SET_ASIDE_SINGLE_CODES = [CODES.gugSentinel, CODES.richardUptonPickman, CODES.falseAwakening]

// False Awakening 是调查员牌组里的弱点（不进遭遇牌库，也不参与遭遇定义结算）；
// Gug Sentinel 是「放一边」的单张敌人（见 SET_ASIDE_SINGLE_CODES）。
const deckBuildingWeaknesses = new Set([CODES.falseAwakening, CODES.gugSentinel])
const gatheredCards = encounterCards(GATHER_GROUPS).filter(card => !deckBuildingWeaknesses.has(card.code))
const setAsideGroupCards = encounterCards(SET_ASIDE_GROUPS)
// 定义表要包含「放在一边」的单张敌人/弱点（生成/结算时引擎按 definition 取印刷数值）。
const definitions = encounterDefinitions([
  ...gatheredCards,
  ...setAsideGroupCards,
  ALL_CARDS[CODES.gugSentinel],
  ALL_CARDS[CODES.falseAwakening],
])
export const ENCOUNTER_DECK_CODES = Object.freeze(encounterDeck(gatheredCards))
// 幕推进/故事效果要洗入的组（code 常量，行为层读这份数据）。
export const SET_ASIDE_GROUP_DECKS = Object.freeze({
  terrorOfTheVale: Object.freeze(encounterDeck(encounterCards(['terrorOfTheVale']))),
  nightgaunts: Object.freeze(encounterDeck(encounterCards(['nightgaunts']))),
  descentIntoThePitch: Object.freeze(encounterDeck(encounterCards(['descentIntoThePitch']))),
  agentsOfAtlachNacha: Object.freeze(encounterDeck(encounterCards(['agentsOfAtlachNacha']))),
})
// 从游戏中移除的组（act 1b）：Ghouls（v.I）/ Striking Fear（两版）。
export const REMOVE_FROM_GAME_DECKS = Object.freeze({
  ghouls: Object.freeze(encounterDeck(encounterCards(['ghouls']))),
  strikingFear: Object.freeze(encounterDeck(encounterCards(['strikingFear']))),
})

// ---- 故事面（12 张背面故事卡）与故事规则键 ----
const storyFaces = {
  ...veiledStoryFaces(locations),
  '06255b': storyFace('06255b'),
  '06256b': storyFace('06256b'),
  '06259b': storyFace('06259b'),
  '06260b': storyFace('06260b'),
}
export const STORY_RULES = Object.freeze({
  '06254b': { storyRule: 'ghastlyTunnels', storyOf: '06254' },
  '06255b': { storyRule: 'theSentry', storyOf: '06255' },
  '06256b': {
    storyRule: 'anotherPath', storyOf: '06256',
    placeLocationId: LOCATION_IDS.enchantedWoods,
    campaignRecord: 'theInvestigatorsFoundAWayOutOfTheUnderworld',
  },
  '06257b': { storyRule: 'aStrangeGhoul', clueThresholdPerInvestigator: 3, spendClues: true, advanceAct: true },
  '06258b': { storyRule: 'scoutingTheVale', lookCountPerInvestigator: 2, discardUpToHalf: true,
    ignoreLocationCode: '06258' },
  '06259b': { storyRule: 'somethingBelow', attachTreachery: '06272', enemy: '06271', enemyClues: 2 },
  '06260b': { storyRule: 'inhabitantsOfTheVale', enemy: '01172',
    spawnLocationId: LOCATION_IDS.valeOfPnath, drawCards: 2, enemyClues: 2 },
  '06261b': { storyRule: 'theWayOut', clueThresholdPerInvestigator: 3, spendClues: true, advanceAct: true },
  '06262b': { storyRule: 'spiderInfestedWaters', enemyCluesPerInvestigator: 1 },
  '06263b': { storyRule: 'stillSurface' },
  '06264b': { storyRule: 'rollingPits', redistributeCluesEvenly: true, resetVeiledFlippable: true },
  '06265b': { storyRule: 'centerOfTheSea', clueThresholdPerInvestigator: 3, spendClues: true, advanceAct: true },
})

// ---- 剧情正文（P8-T 已自译；生成物 ../../story-text.js，键名与 en locale 顶层键一致） ----
// 只投影结构，不二次翻译：intro/intro1/intro2 按空行拆段；setup 按既有 8 步分组；
// specialRules/resolutions 保持原有「{title, body} 数组 / 段落数组」形状。
const story = chapterStory('pointOfNoReturn')
const section = key => story.sections[key]
const paragraphTexts = value => storyParagraphs(flattenStory(value?.body ?? value))

const introVariant = key => {
  const entry = section(key)
  return Object.freeze({ title: entry.title, paragraphs: paragraphTexts(entry) })
}

export const INTRO_VARIANTS = Object.freeze({
  intro: introVariant('intro'),
  intro1: introVariant('intro1'),
  intro2: introVariant('intro2'),
})

export const SPECIAL_RULES = Object.freeze(
  section('specialRules').map(rule => Object.freeze({ title: rule.title, body: rule.body })),
)

const resolutionParagraphs = key => Object.freeze(paragraphTexts(section('resolutions')[key]))

export const RESOLUTION_TEXT = Object.freeze({
  noResolution: resolutionParagraphs('noResolution'),
  resolution1: resolutionParagraphs('resolution1'),
  resolution2: resolutionParagraphs('resolution2'),
})

const setupText = key => flattenStory(section('setup')[key])
const setupSteps = [
  setupText('gatherSets'),
  setupText('setEncounterSetsAside'),
  [setupText('putLocations'), setupText('beginAtVaultsOfZin'), setupText('setOtherLocationsAside')].join(''),
  setupText('setEnchantedWoodsAside'),
  setupText('setCardsAside'),
  [setupText('checkAct'), setupText('useActV1'), setupText('useActV2')].join(''),
  [setupText('checkSteps'), setupText('noSteps'), setupText('oneToFourSteps'), setupText('fiveOrMoreSteps')].join(''),
  setupText('buildEncounterDeck'),
]
export const SETUP_TEXT = Object.freeze(setupSteps)

export const scenario = {
  id: 'pointOfNoReturn',
  originalCode: CODES.scenario,
  name: '无归之地',
  nameEn: 'Point of No Return',
  part: 'B',
  pair: 3,
  // P8-T：正文来自 ../../story-text.js 生成物（自译，非官方中文）。
  textLanguage: 'zh-CN',
  textStatus: 'translated (self-translated)',
  intro: INTRO_VARIANTS.intro.paragraphs.join('\n'),
  setup: SETUP_TEXT.join('\n'),
  startLocation: START_LOCATION,
  locations,
  setAsideLocations: [...SET_ASIDE_LOCATIONS],
  acts: [ACT_ONE_VARIANTS.v1, actTwo, actThree],
  agendas,
  resolutions: {
    noResolution: RESOLUTION_TEXT.noResolution,
    resolution1: RESOLUTION_TEXT.resolution1,
    resolution2: RESOLUTION_TEXT.resolution2,
  },
  storyFaces,
  ...definitions,
  storyAssets: storyCards([CODES.richardUptonPickman]),
  encounterDeck: [...ENCOUNTER_DECK_CODES],
  // 混乱标记数值/后果（引擎按 `tokenMeanings[state.difficulty]` 读；四难度各一份）。
  // skull 的 X = 参考卡上的伤害数，动态值由 behavior.resolveChaosToken 结算（这里只放展示文本）。
  // 展示文本中文逐字取自 cards-data 06247 的 textZh/backTextZh（P8-T：token 不进剧情生成物）。
  tokenMeanings: {
    easy: {
      skull: { text: '-X。X为本卡牌上的伤害数量。', delta: 0 },
      cultist: { text: '再揭示一个标记。如果你检定失败，本次技能检定结束后，抽取遭遇牌库顶的卡牌。', delta: 0, drawAnother: true },
      tablet: { text: '+1。黑猫带你走出了死亡之火。如果调查期间揭示本标记且你检定成功，抽取1张卡牌。', delta: 1 },
      elderthing: { text: '-3。如果你检定失败且低于难度至少2点，选择你所在地点或连接地点的一个重整状态的敌人。该敌人移动到你的地点，与你交战并立即进行一次攻击。', delta: -3 },
    },
    standard: {
      skull: { text: '-X。X为本卡牌上的伤害数量。', delta: 0 },
      cultist: { text: '再揭示一个标记。如果你检定失败，本次技能检定结束后，抽取遭遇牌库顶的卡牌。', delta: 0, drawAnother: true },
      tablet: { text: '+1。黑猫带你走出了死亡之火。如果调查期间揭示本标记且你检定成功，抽取1张卡牌。', delta: 1 },
      elderthing: { text: '-3。如果你检定失败且低于难度至少2点，选择你所在地点或连接地点的一个重整状态的敌人。该敌人移动到你的地点，与你交战并立即进行一次攻击。', delta: -3 },
    },
    hard: {
      skull: { text: '-X。X为本卡牌上的伤害数量+1。', delta: 0 },
      cultist: { text: '再揭示一个标记。如果你检定失败，本次技能检定结束后，抽取遭遇牌库顶的卡牌。', delta: 0, drawAnother: true },
      tablet: { text: '0。黑猫带你走出了死亡之火。如果调查期间揭示本标记且你检定成功，抽取1张卡牌。', delta: 0 },
      elderthing: { text: '-4。如果你检定失败且低于难度至少2点，选择你所在地点或连接地点的一个重整状态的敌人。该敌人移动到你的地点，与你交战并立即进行一次攻击。', delta: -4 },
    },
    expert: {
      skull: { text: '-X。X为本卡牌上的伤害数量+1。', delta: 0 },
      cultist: { text: '再揭示一个标记。如果你检定失败，本次技能检定结束后，抽取遭遇牌库顶的卡牌。', delta: 0, drawAnother: true },
      tablet: { text: '0。黑猫带你走出了死亡之火。如果调查期间揭示本标记且你检定成功，抽取1张卡牌。', delta: 0 },
      elderthing: { text: '-4。如果你检定失败且低于难度至少2点，选择你所在地点或连接地点的一个重整状态的敌人。该敌人移动到你的地点，与你交战并立即进行一次攻击。', delta: -4 },
    },
  },
}

export const identities = identitiesFor(scenario)
bindScenarioIdentities(scenario, identities)


// P8：本章 behavior.js 引用的印刷卡号统一放数据表（content 章节流程不写卡号字面量）。
export const RAW_CODES = Object.freeze({
  c01172: '01172',
  c06249: '06249',
  c06256b: '06256b',
  c06258: '06258',
  c06258b: '06258b',
  c06259b: '06259b',
  c06260b: '06260b',
  c06262b: '06262b',
  c06264b: '06264b',
  c06267: '06267',
  c06268: '06268',
  c06269: '06269',
  c06270: '06270',
  c06271: '06271',
  c06272: '06272',
  c06275: '06275',
})
