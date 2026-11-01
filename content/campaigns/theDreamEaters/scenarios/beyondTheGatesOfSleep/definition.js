// 梦境门外（Beyond the Gates of Sleep · 06039）· 剧本数据（scenario 对象只含数据，不含函数）。
//
// 参考：Scenario/Scenarios/TheDreamEaters/BeyondTheGatesOfSleep.hs + Act/Agenda/Enemy/Location/
// Story/Treachery/Cards/TheDreamEaters/BeyondTheGatesOfSleep/*。
// 文本来源（P8-T）：中文自译生成物 `content/campaigns/theDreamEaters/story-text.js` 的
// `chapterStory('beyondTheGatesOfSleep').sections`（en locale 顶层键一一对应）；本文件不写死剧情正文。
// textLanguage/textStatus 标 `zh-CN` + `translated (self-translated)`。
import { bindScenarioIdentities } from '../../../../identities.js'
import {
  location, stages, encounterCards, encounterDefinitions, storyCards, linkSymbolLocations, identitiesFor,
} from '../../card-data.js'
import { chapterStory, flattenStory, flattenResolution } from '../../story-access.js'
import { BEYOND_THE_GATES_TOKEN_MEANINGS } from './chaos.js'

// 本章收齐的 6 个遭遇组（卡面 setup 逐句）。
export const GATHER_GROUPS = [
  'beyondTheGatesOfSleep', 'agentsOfNyarlathotep', 'zoogs', 'dreamersCurse', 'dreamlands', 'chillingCold',
]

export const SEVENTY_STEPS = '06045'
export const CAVERN_OF_FLAME = '06046'
export const SEVEN_HUNDRED_STEPS = '06047'
export const BASE_OF_THE_STEPS = '06048'
export const ENCHANTED_PATH = '06049'
export const KAMAN_THAH = '06057'
export const NASHT = '06058'
export const RANDOLPH_CARTER = '06059'
export const LABORING_GUG = '06060'
export const ANCIENT_ZOOG = '06061'
export const LOST_IN_THE_WOODS = '06062'

export const ACT_CODES = ['06041', '06042', '06043', '06044']
export const AGENDA_CODES = ['06040']

// 7 张「魔幻森林」：印刷正面同名，背面（揭示面）给出具体副标题。
export const WOODS = Object.freeze([
  { id: 'mysticalForest', code: '06050', symbol: 'circle', links: ['squiggle', 'star', 'plus'] },
  { id: 'villageOfZoogs', code: '06051', symbol: 'diamond', links: ['squiggle', 'square', 'star'] },
  { id: 'greatStoneCircle', code: '06052', symbol: 'triangle', links: ['squiggle', 'plus', 'square'] },
  { id: 'stoneTrapdoor', code: '06053', symbol: 'square', links: ['squiggle', 'triangle', 'diamond'] },
  { id: 'theMoonTree', code: '06054', symbol: 'star', links: ['squiggle', 'diamond', 'circle'] },
  { id: 'fungalForest', code: '06055', symbol: 'moon', links: ['squiggle'] },
  { id: 'lostWoods', code: '06056', symbol: 'droplet', links: ['squiggle'] },
])
export const WOOD_IDS = Object.freeze(WOODS.map(entry => entry.id))
export const WOOD_CODES = Object.freeze(WOODS.map(entry => entry.code))

// 开局放一边：伦道夫·卡特、辛劳的古革巨人、两张双面敌人（纳什特/卡曼塔），以及其余地点。
export const SET_ASIDE_ENEMY_CODES = Object.freeze([KAMAN_THAH, NASHT, LABORING_GUG])
export const SET_ASIDE_LOCATIONS = Object.freeze([
  'sevenHundredSteps', 'baseOfTheSteps', 'theEnchantedPath', ...WOOD_IDS,
])
export const IN_PLAY_LOCATIONS = Object.freeze(['seventySteps', 'cavernOfFlame'])

// 遭遇牌：6 个组的全部敌人/诡计。开局没有遭遇牌库——除 3 张 set-aside 敌人外，
// 其余全部「放在一边」，由幕 3 背面洗成遭遇牌库（见 behavior.resolveTheFinalDescent）。
const allEncounterCards = encounterCards(GATHER_GROUPS)
const SET_ASIDE_ENEMY_SET = new Set(SET_ASIDE_ENEMY_CODES)
export const ENCOUNTER_PILE = Object.freeze(allEncounterCards
  .filter(card => !SET_ASIDE_ENEMY_SET.has(card.code))
  .flatMap(card => Array(card.quantity || 1).fill(card.code)))
export const ENCOUNTER_DECK = Object.freeze([])
const definitions = encounterDefinitions(allEncounterCards)

export const SET_ASIDE_ALIASES = Object.freeze([
  RANDOLPH_CARTER, ...SET_ASIDE_ENEMY_CODES, ...ENCOUNTER_PILE,
])

// —— 剧情正文（P8-T 自译；生成物 story-text.js → 本章 sections）——
const story = chapterStory('beyondTheGatesOfSleep')
const sections = story.sections
const text = value => flattenStory(value)
const blocks = (...parts) => parts.map(text).filter(Boolean).join('\n\n')

export const SCENARIO_TEXT = Object.freeze({
  textLanguage: 'zh-CN',
  textStatus: 'translated (self-translated)',
  // en `intro` = 章节标题 + 梦境选择说明（story-text: sections.dreamSelection 的 title + body）。
  intro: blocks(sections.dreamSelection.title, sections.dreamSelection.body),
  // en `setup` = 5 段 setup 步骤（story-text: sections.setup.gatherSets…setEncounterCardsAside）。
  setup: blocks(...Object.values(sections.setup)),
  // en `stepsOfSlumber` = 标题 + 规则正文（story-text: sections.rules.stepsOfSlumber）。
  stepsOfSlumber: blocks(sections.rules.stepsOfSlumber.title, sections.rules.stepsOfSlumber.body),
  // en `resolutions` = 「标题 + 正文」字符串（story-text: sections.resolutions.<key>）。
  resolutions: Object.freeze(Object.fromEntries(
    Object.entries(sections.resolutions).map(([key, value]) => [key, flattenResolution(value)]),
  )),
})

// 14 种梦境（只放可结算的效应声明；梦境正文与选项标签见 story-text.js 的
// `sections.dreams.<key>` 与 `sections.label.options.<key>`，P8-T 已自译）。
// 依据 BeyondTheGatesOfSleep.hs:2150-2236（classDreams / traitsDreams / dreamEffect）。
export const DREAMS = Object.freeze([
  { key: 'guardian', klass: 'guardian', effect: { kind: 'searchPlay', trait: 'guardian' } },
  { key: 'seeker', klass: 'seeker', effect: { kind: 'searchPlay', trait: 'seeker' } },
  { key: 'rogue', klass: 'rogue', effect: { kind: 'searchPlay', trait: 'rogue' } },
  { key: 'mystic', klass: 'mystic', effect: { kind: 'searchPlay', trait: 'mystic' } },
  { key: 'survivor', klass: 'survivor', effect: { kind: 'searchPlay', trait: 'survivor' } },
  { key: 'criminal', trait: 'criminal', effect: { kind: 'searchPlay', traitAny: ['criminal', 'illicit'] } },
  { key: 'drifter', trait: 'drifter', effect: { kind: 'replaceBasicWeakness' } },
  { key: 'hunter', trait: 'hunter', effect: { kind: 'searchPlay', trait: 'weapon' } },
  { key: 'medicOrAssistant', traitAny: ['medic', 'assistant'], effect: { kind: 'giftOther' } },
  { key: 'miskatonicOrScholar', traitAny: ['miskatonic', 'scholar'], effect: { kind: 'searchPlay', trait: 'tome' } },
  { key: 'veteran', trait: 'veteran', effect: { kind: 'startingCards', traitAny: ['tactic', 'supply'], count: 2 } },
  { key: 'wayfarer', trait: 'wayfarer', effect: { kind: 'searchPlay', traitAny: ['wayfarer', 'relic'] } },
  { key: 'neutral1', effect: { kind: 'resources', amount: 2 } },
  { key: 'neutral2', effect: { kind: 'openingHand', amount: 1 } },
])

const locations = {
  seventySteps: location('seventySteps', SEVENTY_STEPS, { symbol: 'heart', links: ['hourglass'] }),
  cavernOfFlame: location('cavernOfFlame', CAVERN_OF_FLAME, { symbol: 'hourglass', links: ['heart', 'equals'] }),
  sevenHundredSteps: location('sevenHundredSteps', SEVEN_HUNDRED_STEPS, { symbol: 'equals', links: ['hourglass', 't'] }),
  baseOfTheSteps: location('baseOfTheSteps', BASE_OF_THE_STEPS, { symbol: 't', links: ['equals', 'squiggle'] }),
  theEnchantedPath: location('theEnchantedPath', ENCHANTED_PATH, { symbol: 'squiggle', links: ['t', 'moon'] }),
  ...Object.fromEntries(WOODS.map(entry => [entry.id, location(entry.id, entry.code, {
    symbol: entry.symbol, links: entry.links,
  })])),
}
linkSymbolLocations(locations)

const ACT_EXTRA = Object.freeze({
  '06041': { objective: { type: 'enterLocation', location: 'cavernOfFlame' } },
  '06042': {},
  '06043': { chapterFlow: 'theFinalDescent' },
  '06044': { objective: { type: 'clues', perInvestigator: 5, atLocation: 'theEnchantedPath' } },
})
const AGENDA_EXTRA = Object.freeze({ '06040': {} })

export const scenario = {
  id: 'beyondTheGatesOfSleep',
  originalCode: '06039',
  name: '梦境门外 · Beyond the Gates of Sleep',
  intro: SCENARIO_TEXT.intro,
  setup: SCENARIO_TEXT.setup,
  startLocation: 'seventySteps',
  locations,
  setAsideLocations: SET_ASIDE_LOCATIONS,
  inPlayLocations: IN_PLAY_LOCATIONS,
  setAsideAliases: SET_ASIDE_ALIASES,
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
  storyAssets: storyCards([RANDOLPH_CARTER]),
  encounterDeck: [...ENCOUNTER_DECK],
  resolutions: { ...SCENARIO_TEXT.resolutions },
  tokenMeanings: {
    standard: { ...BEYOND_THE_GATES_TOKEN_MEANINGS.standard },
    hard: { ...BEYOND_THE_GATES_TOKEN_MEANINGS.hard },
    expert: { ...BEYOND_THE_GATES_TOKEN_MEANINGS.hard },
    easy: { ...BEYOND_THE_GATES_TOKEN_MEANINGS.standard },
  },
  dreams: DREAMS,
  stepsOfSlumber: SCENARIO_TEXT.stepsOfSlumber,
  textLanguage: SCENARIO_TEXT.textLanguage,
  textStatus: SCENARIO_TEXT.textStatus,
}

export const identities = identitiesFor(scenario)
bindScenarioIdentities(scenario, identities)


// P8：本章 behavior.js 引用的印刷卡号统一放数据表（content 章节流程不写卡号字面量）。
export const RAW_CODES = Object.freeze({
  c06040: '06040',
  c06041: '06041',
  c06042: '06042',
  c06043: '06043',
  c06044: '06044',
  c06045: '06045',
  c06046: '06046',
  c06047: '06047',
  c06048: '06048',
  c06049: '06049',
  c06057: '06057',
  c06058: '06058',
  c06059: '06059',
  c06060: '06060',
  c06061: '06061',
  c06062: '06062',
})
