// 月之暗面（Dark Side of the Moon · 06206）· 剧本数据。
//
// 参考实现：Scenario/Scenarios/TheDreamEaters/DarkSideOfTheMoon.hs +
// Act/Agenda/Enemy/Location/Treachery/CardDefs|Cards/TheDreamEaters/DarkSideOfTheMoon/*.hs。
// 卡面印刷数据只从 `../../card-data.js` 取；剧情/设置/结局正文只从 `./text-en.js` 取锁定英文原文
// （P8-T 自译前不写中文摘要；scenario 上标 textLanguage:'en' + textStatus:'pending-self-translation'）。
import { bindScenarioIdentities } from '../../../../identities.js'
import {
  encounterCards, encounterDefinitions, encounterDeck, location, stages, storyCards, identitiesFor,
} from '../../card-data.js'
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { INTRO, RESOLUTIONS, RULES, SETUP, SPECIAL_RULES, TOKENS } from './text-en.js'

// ---------------------------------------------------------------------------
// 卡号常量
// ---------------------------------------------------------------------------
export const SCENARIO_CODE = '06206'
export const MOON_BEAST_GALLEY = '06214'
export const OFF_THE_GALLEY = '06214b'
export const CITY_OF_THE_MOON_BEASTS = '06215'
export const THE_DARK_CRATER = '06216'
export const TEMPLE_OF_THE_MOON_LIZARD = '06217'
export const MOON_FOREST = '06218'
export const CAVERNS_BENEATH_THE_MOON_DARK_SIDE = '06219'
export const THE_BLACK_CORE = '06220'
export const CAVERNS_BENEATH_THE_MOON_LIGHT_SIDE = '06221'
export const LIGHT_SIDE_OF_THE_MOON = '06222'
export const THE_WHITE_SHIP = '06223'
export const VIRGIL_GRAY = '06224'
export const THE_CAPTAIN = '06225'
export const MOON_LIZARD = '06226'
export const MOONBOUND_BYAKHEE = '06227'
export const CATS_FROM_SATURN = '06228'
export const MOON_BEAST = '06229'
export const FALSE_AWAKENING = '06233'

export const ACT_CODES = Object.freeze(['06210', '06211', '06212', '06213'])
export const AGENDA_CODES = Object.freeze(['06207', '06208', '06209'])
export const ENCOUNTER_GROUPS = Object.freeze([
  'darkSideOfTheMoon', 'corsairs', 'dreamersCurse', 'ancientEvils',
])

// 放在一边的卡（非地点）：月蜥、维吉尔·格雷、船长、卡达斯。地点见 setAsideLocations。
export const SET_ASIDE_ALIASES = Object.freeze([MOON_LIZARD, VIRGIL_GRAY, THE_CAPTAIN, FALSE_AWAKENING])
const SET_ASIDE_CARD_CODES = new Set([...SET_ASIDE_ALIASES, MOON_BEAST_GALLEY])

// ---------------------------------------------------------------------------
// 地点：印刷地图 4 列 × 4 行（DarkSideOfTheMoon.hs:43-47）。
//   白船 / 月之亮面 / 月下洞穴（亮面）
//   月兽之城 / 漆黑深坑 / 黑暗月核
//   月蜥神庙 / 月之森林 / 月下洞穴（暗面）
//   .       / 月兽帆船 / .
// 连接按印刷地图相邻列/行的通行路线声明（月兽帆船靠岸后接月兽之城；月下洞穴接核心面）。
// ---------------------------------------------------------------------------
const connections = {
  theWhiteShip: ['lightSideOfTheMoon'],
  lightSideOfTheMoon: ['theWhiteShip', 'cavernsBeneathTheMoonLightSide', 'cityOfTheMoonBeasts'],
  cavernsBeneathTheMoonLightSide: ['lightSideOfTheMoon', 'theBlackCore'],
  cityOfTheMoonBeasts: ['templeOfTheMoonLizard', 'theDarkCrater', 'moonBeastGalley', 'lightSideOfTheMoon'],
  theDarkCrater: ['cityOfTheMoonBeasts', 'templeOfTheMoonLizard', 'theBlackCore', 'moonForest'],
  theBlackCore: ['theDarkCrater', 'cavernsBeneathTheMoonDarkSide', 'cavernsBeneathTheMoonLightSide'],
  templeOfTheMoonLizard: ['cityOfTheMoonBeasts', 'theDarkCrater', 'moonForest'],
  moonForest: ['templeOfTheMoonLizard', 'theDarkCrater', 'cavernsBeneathTheMoonDarkSide'],
  cavernsBeneathTheMoonDarkSide: ['moonForest', 'theBlackCore'],
  moonBeastGalley: ['cityOfTheMoonBeasts'],
}

function dsmLocation(id, code) {
  return location(id, code, { connections: connections[id] || [] })
}

const locations = {
  moonBeastGalley: dsmLocation('moonBeastGalley', MOON_BEAST_GALLEY),
  cityOfTheMoonBeasts: dsmLocation('cityOfTheMoonBeasts', CITY_OF_THE_MOON_BEASTS),
  theDarkCrater: dsmLocation('theDarkCrater', THE_DARK_CRATER),
  templeOfTheMoonLizard: dsmLocation('templeOfTheMoonLizard', TEMPLE_OF_THE_MOON_LIZARD),
  moonForest: dsmLocation('moonForest', MOON_FOREST),
  cavernsBeneathTheMoonDarkSide: dsmLocation('cavernsBeneathTheMoonDarkSide', CAVERNS_BENEATH_THE_MOON_DARK_SIDE),
  theBlackCore: dsmLocation('theBlackCore', THE_BLACK_CORE),
  cavernsBeneathTheMoonLightSide: dsmLocation('cavernsBeneathTheMoonLightSide', CAVERNS_BENEATH_THE_MOON_LIGHT_SIDE),
  lightSideOfTheMoon: dsmLocation('lightSideOfTheMoon', LIGHT_SIDE_OF_THE_MOON),
  theWhiteShip: dsmLocation('theWhiteShip', THE_WHITE_SHIP),
}

// 黑白月核/亮面与暗面的隐藏值 X（印刷值 0/-2 占位），运行时由 behavior.locationShroudModifier 求值。
locations.theBlackCore.shroud = 0
locations.cityOfTheMoonBeasts.shroud = 0
// 月兽帆船背面是剧情卡 06214b「下船」。
locations.moonBeastGalley.backCode = OFF_THE_GALLEY
locations.moonBeastGalley.storyCode = OFF_THE_GALLEY

export const scenario = {
  id: 'darkSideOfTheMoon',
  campaignId: 'theDreamEaters',
  originalCode: SCENARIO_CODE,
  referenceCode: SCENARIO_CODE,
  name: '月之暗面',
  nameEn: 'Dark Side of the Moon',
  part: 'A',
  pair: 3,
  textLanguage: 'en',
  textStatus: 'pending-self-translation',
  intro: INTRO.intro?.body || '',
  intros: INTRO,
  setup: Object.values(SETUP),
  setupSteps: SETUP,
  rules: RULES,
  specialRules: SPECIAL_RULES,
  startLocation: 'cityOfTheMoonBeasts',
  locations,
  // 放在一边的地点：月兽帆船（未被俘时）、两个月下洞穴、黑暗月核、月之亮面、白船。
  setAsideLocations: [
    'moonBeastGalley', 'cavernsBeneathTheMoonDarkSide', 'theBlackCore',
    'cavernsBeneathTheMoonLightSide', 'lightSideOfTheMoon', 'theWhiteShip',
  ],
  acts: stages(ACT_CODES, 'act').map(act => ({ ...act, reveal: { type: 'campaignRule' } })),
  agendas: stages(AGENDA_CODES, 'agenda').map(agenda => ({ ...agenda, reveal: { type: 'campaignRule' } })),
  storyAssets: storyCards([VIRGIL_GRAY, THE_CAPTAIN]),
  storyFaces: {},
  resolutions: Object.fromEntries(Object.entries(RESOLUTIONS).map(([key, value]) => [
    key, `**${value.title}**\n\n${value.body}`,
  ])),
  tokenMeanings: {
    standard: {
      skull: { text: TOKENS.easyStandard.skull, delta: -1 },
      cultist: { text: TOKENS.easyStandard.cultist, delta: 0 },
      tablet: { text: TOKENS.easyStandard.tablet, delta: -1 },
      elder_thing: { text: TOKENS.easyStandard.elderThing, delta: 1 },
    },
    hard: {
      skull: { text: TOKENS.hardExpert.skull, delta: -2 },
      cultist: { text: TOKENS.hardExpert.cultist, delta: 0 },
      tablet: { text: TOKENS.hardExpert.tablet, delta: -2 },
      elder_thing: { text: TOKENS.hardExpert.elderThing, delta: 0 },
    },
  },
}

// ---------------------------------------------------------------------------
// 遭遇牌库与定义：收齐 4 个组；set aside 的月蜥不进牌库。
// ---------------------------------------------------------------------------
const gathered = encounterCards(ENCOUNTER_GROUPS)
const deckCards = gathered.filter(card => !SET_ASIDE_CARD_CODES.has(card.code))
const definitionCards = [...gathered, ALL_CARDS[MOON_LIZARD]]
export const definitions = encounterDefinitions(definitionCards, {
  enemies: {
    // 月蜥的攻击/躲避是 X：未交战 5，交战时 = 该调查员的警报等级（behavior.enemyStatModifier 求值）。
    [MOON_LIZARD]: { fight: 5, evade: 5 },
    // 月之拜亚基的生成点：最近的[[月面]]地点（behavior.spawnLocation 按数据选择）。
    [MOONBOUND_BYAKHEE]: {},
  },
})
scenario.enemies = definitions.enemies
scenario.treacheries = definitions.treacheries
scenario.encounterDeck = encounterDeck(deckCards)

export const identities = identitiesFor(scenario)
bindScenarioIdentities(scenario, identities)

export default scenario


// P8：本章 behavior.js 引用的印刷卡号统一放数据表（content 章节流程不写卡号字面量）。
export const RAW_CODES = Object.freeze({
  c06214: '06214',
  c06227: '06227',
  c06228: '06228',
  c06229: '06229',
  c06230: '06230',
  c06231: '06231',
  c06232: '06232',
  c06233: '06233',
})
