// 神居之所（Where the Gods Dwell · 06286）· 剧本数据（P8 / M3，A 线第 4 章）。
//
// 参考实现：Scenario/Scenarios/TheDreamEaters/WhereTheGodsDwell.hs + CardDefs/Cards
// TheDreamEaters/WhereTheGodsDwell（Act/Agenda/Enemy/Location/Treachery）。
// 卡面数据（名字/卡文/数值/特性/关键词）一律从 `../../card-data.js` 取，本文件只写「关卡怎么用这些卡」。
// 剧情文本：`./texts.js` 是锁定 en locale 的逐字原文（去 HTML）+ pending 标记；中文自译属 P8-T。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { bindScenarioIdentities } from '../../../../identities.js'
import { hiddenRuleFor } from '../../../../../src/cards/card-rules.js'
import {
  location, stages, encounterCards, encounterDefinitions, encounterDeck, storyCards,
  identitiesFor, linkSymbolLocations,
} from '../../card-data.js'
import { EN_TEXTS, TDE_WGD_TEXT_META } from './texts.js'

// ---- 卡号常量（章节行为/条目/测试共用；改卡号只改这里） ----
export const PLATEAU_OF_LENG = '06295'
export const COLD_WASTES = '06296'
export const MONASTERY_OF_LENG = '06297'
export const ONYX_GATES = '06298'
export const ONYX_CASTLE = '06299' // 未揭示面「缟玛瑙城堡」/ 揭示面「大礼堂」
export const FORSAKEN_TOWERS = Object.freeze([
  { id: 'towerOfIllusionAndMyth', code: '06300' },
  { id: 'towerOfLifeAndDeath', code: '06301' },
  { id: 'towerOfInfiniteTruth', code: '06302' },
  { id: 'towerOfEternalFlame', code: '06303' },
  { id: 'towerOfQueenOfNight', code: '06304' },
  { id: 'towerOfPrimevalLight', code: '06305' },
])
export const FORSAKEN_TOWER_IDS = Object.freeze(FORSAKEN_TOWERS.map(entry => entry.id))
export const NYARLATHOTEP_COPIES = Object.freeze(['06306', '06307', '06308', '06309', '06310'])
export const HIGH_PRIEST = '06311'
export const DHOLE_OF_THE_WASTES = '06312'
export const LIAR_WITH_NO_FACE = '06313'
export const WHISPERING_CHAOS = Object.freeze(['06314', '06315', '06316', '06317'])
export const MYRIAD_FORMS = '06318'
export const RESTLESS_JOURNEY = Object.freeze(['06319', '06320', '06321'])
export const ABANDONED_BY_THE_GODS = '06322'
export const THE_CRAWLING_MIST = '06086'
export const ACT_CODES = Object.freeze(['06290', '06291', '06292', '06293', '06294'])
export const AGENDA_CODES = Object.freeze(['06287', '06288', '06289'])
// 战役记录键（P8-CAMPAIGN-FACTS §2 的 55 键子集；behavior/resolution 读写同一份口径）。
export const RECORDS = Object.freeze({
  carriedToTheColdWastes: 'theInvestigatorsWereCarriedToTheColdWastes',
  traveledToTheColdWastes: 'theInvestigatorsTraveledToTheColdWastes',
  randolphSurvivedTheVoyage: 'randolphSurvivedTheVoyage',
  blackCatAtYourSide: 'theBlackCatIsAtYourSide',
  evidenceOfKadath: 'evidenceOfKadath',
  blackCatKnowsTheTruth: 'theBlackCatKnowsTheTruth',
  silverKey: 'theInvestigatorsPossessTheSilverKey',
  knowOfAnotherPath: 'theDreamersKnowOfAnotherPath',
  invasionHasBegun: 'nyarlathotepsInvasionHasBegun',
  escapedGrasp: 'theDreamersEscapedFromNyarlathotepsGrasp',
  banishedNyarlathotep: 'theDreamersBanishedNyarlathotep',
  awoke: 'theDreamersAwoke',
  stayedInDreamlands: 'theDreamersStayedInTheDreamlandsForever',
  traveledBeneathMonastery: 'theDreamersTraveledBeneathTheMonastery',
})

// ---- 地点 ----
// 印刷符号图来自 Location/CardDefs/TheDreamEaters/WhereTheGodsDwell.hs：
//   plateau=Diamond[Triangle]  coldWastes=Triangle[Diamond,Plus,T]  monastery=Plus[Triangle]
//   onyxGates=T[Triangle,Square]  theOnyxCastle=Square[T]（揭示面大礼堂=Square[Equals]）
//   6 座被遗忘的高塔=Equals[Square]
// 静态符号取「两面的并集」，让 act 3 前后的连接都成立（大礼堂与高塔通过 Square/Equals 相连）。
const locations = {
  plateauOfLeng: location('plateauOfLeng', PLATEAU_OF_LENG, {
    symbol: 'diamond', links: ['triangle'],
  }),
  coldWastes: location('coldWastes', COLD_WASTES, {
    symbol: 'triangle', links: ['diamond', 'plus', 't'],
  }),
  monasteryOfLeng: location('monasteryOfLeng', MONASTERY_OF_LENG, {
    symbol: 'plus', links: ['triangle'],
  }),
  onyxGates: location('onyxGates', ONYX_GATES, {
    symbol: 't', links: ['triangle', 'square'],
  }),
  theOnyxCastle: location('theOnyxCastle', ONYX_CASTLE, {
    symbol: 'square', links: ['t', 'equals'],
  }),
}
for (const tower of FORSAKEN_TOWERS) {
  locations[tower.id] = location(tower.id, tower.code, { symbol: 'equals', links: ['square'] })
}
linkSymbolLocations(locations)

// ---- 幕 / 议程 ----
// 幕目标：由引擎通用 objective / 章节 behavior.checkObjectives 读 objectiveRule。
const ACT_EXTRA = Object.freeze({
  // 幕 1：团队花费 2×人数线索推进（groupClueCost PerPlayer 2）。
  '06290': { objective: { type: 'clues', perInvestigator: 2 } },
  '06291': { objectiveRule: 'defeatHighPriest' },
  '06292': { objectiveRule: 'allAtOnyxGates' },
  '06293': { objectiveRule: 'nyarlathotepCopiesInVictory' },
  '06294': { objectiveRule: 'trueShapeDefeated' },
})

// ---- 遭遇牌库 ----
// setup：收齐本章 + Agents of Nyarlathotep + Dreamer's Curse + Whispers of Hypnos + Dark Cult。
// Dark Cult 在卡池里的 encounterCode 是 `pentagram`（ArkhamDB 组名；见 scope.json crossCycleGroups）。
const DECK_GROUPS = ['whereTheGodsDwell', 'agentsOfNyarlathotep', 'dreamersCurse', 'whispersOfHypnos', 'pentagram']
// 放在一边：大祭司、5 个奈亚拉托提普、4 张混沌低语、2 张万千化身、蠕动之雾（共 13 张）。
export const SET_ASIDE_CODES = Object.freeze([
  HIGH_PRIEST,
  ...NYARLATHOTEP_COPIES,
  ...WHISPERING_CHAOS,
  MYRIAD_FORMS,
  MYRIAD_FORMS,
  THE_CRAWLING_MIST,
])
const setAsideSet = new Set(SET_ASIDE_CODES)
const deckCards = encounterCards(DECK_GROUPS).filter(card => !setAsideSet.has(card.code))
const definitions = encounterDefinitions([
  ...deckCards,
  ...SET_ASIDE_CODES.map(code => ALL_CARDS[code]),
])
// 引擎 hidden-rules 读 definition 的 `hiddenRule`（与 TFA card-data 同口径；TDE card-data 未合并该字段）。
for (const treachery of Object.values(definitions.treacheries)) {
  const rule = hiddenRuleFor(treachery.code)
  if (rule) treachery.hiddenRule = structuredClone(rule)
}

// ---- 混乱标记含义（印刷数值；动态 X 由 behavior.resolveChaosToken 计算，这里的 delta 只作静态展示兜底） ----
const tokenMeanings = {
  standard: {
    skull: { text: '-X. X is the number of the current act.', delta: 0 },
    cultist: { text: 'Reveal another token. If you fail, place 1 doom on the current agenda.', delta: 0 },
    tablet: {
      text: '-4. If you fail, choose and reveal a copy of Nyarlathotep in your hand. It attacks you and is shuffled into the encounter deck.',
      delta: -4,
    },
    elder_thing: { text: "0. The black cat reminds you that it's all a dream.", delta: 0 },
  },
  hard: {
    skull: { text: '-X. X is the number of the current act plus the number of the current agenda.', delta: 0 },
    cultist: {
      text: 'Reveal another token. If you fail, place 1 doom on the current agenda. This effect may cause the current agenda to advance.',
      delta: 0,
    },
    tablet: {
      text: '-6. If you fail, choose and reveal a copy of Nyarlathotep in your hand. It attacks you and is shuffled into the encounter deck.',
      delta: -6,
    },
    elder_thing: { text: "-1. The black cat reminds you that it's all a dream.", delta: -1 },
  },
}

export const scenario = {
  id: 'whereTheGodsDwell',
  originalCode: '06286',
  name: '神居之所',
  nameEn: 'Where the Gods Dwell',
  part: 'A',
  pair: 4,
  campaignId: 'theDreamEaters',
  ...TDE_WGD_TEXT_META,
  intro: EN_TEXTS.intro,
  introVariants: { carried: EN_TEXTS.introOne, traveled: EN_TEXTS.introTwo },
  setup: EN_TEXTS.setup,
  startLocation: 'plateauOfLeng',
  locations,
  // 6 座「被遗忘的高塔」放在一边，act 3 背面随机取 4 座入场、其余移除。
  setAsideLocations: [...FORSAKEN_TOWER_IDS],
  acts: stages(ACT_CODES, 'act').map(act => ({
    ...act,
    reveal: { type: 'campaignRule' },
    ...(ACT_EXTRA[act.originalCode] || {}),
  })),
  agendas: stages(AGENDA_CODES, 'agenda').map(agenda => ({
    ...agenda,
    reveal: { type: 'campaignRule' },
  })),
  ...definitions,
  storyAssets: storyCards([]),
  encounterDeck: encounterDeck(deckCards),
  tokenMeanings,
  // 冒险幕间「Grand Design」的 5 段英文原文（cards-data 无独立卡；大礼堂背面/剧情流程用）。
  grandDesign: [
    EN_TEXTS.grandDesign1,
    EN_TEXTS.grandDesign2,
    EN_TEXTS.grandDesign3,
    EN_TEXTS.grandDesign4,
    EN_TEXTS.grandDesign5,
  ],
  resolutions: {
    noResolution: EN_TEXTS.noResolution,
    resolution1: EN_TEXTS.resolution1,
    resolution2: EN_TEXTS.resolution2,
    resolution3: EN_TEXTS.resolution3,
    resolution4: EN_TEXTS.resolution4,
    resolution5: EN_TEXTS.resolution5,
  },
}

export const identities = identitiesFor(scenario)
bindScenarioIdentities(scenario, identities)


// P8：本章 behavior.js 引用的印刷卡号统一放数据表（content 章节流程不写卡号字面量）。
export const RAW_CODES = Object.freeze({
  c06059: '06059',
  c06293: '06293',
})
