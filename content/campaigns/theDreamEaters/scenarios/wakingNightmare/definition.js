// 清醒噩梦（Waking Nightmare · 06063）· 剧本数据（scenario 对象只含数据，不含函数）。
//
// 参考：Scenario/Scenarios/TheDreamEaters/WakingNightmare.hs + Location/Act/Agenda/Enemy/
// Story/Treachery/Cards/TheDreamEaters/WakingNightmare/*。
// 文本来源（P8-T）：中文自译生成物 `content/campaigns/theDreamEaters/story-text.js` 的
// `chapterStory('wakingNightmare').sections`（en locale 顶层键一一对应）；本文件不写死剧情正文。
// textLanguage/textStatus 标 `zh-CN` + `translated (self-translated)`。
import { bindScenarioIdentities } from '../../../../identities.js'
import {
  location, stages, encounterCards, encounterDefinitions, encounterDeck, storyCards,
  linkSymbolLocations, storyFace, identitiesFor,
} from '../../card-data.js'
import { chapterStory, flattenStory, flattenResolution } from '../../story-access.js'
import { WAKING_NIGHTMARE_TOKEN_MEANINGS } from './chaos.js'

// 本章遭遇组（camelCase；目录 encounterCode 由 card-data 反查）。
export const GATHER_GROUPS = ['wakingNightmare', 'mergingRealities', 'whispersOfHypnos', 'lockedDoors', 'strikingFear']
export const SET_ASIDE_GROUPS = ['agentsOfAtlachNacha', 'spiders']
export const ALL_GROUPS = [...GATHER_GROUPS, ...SET_ASIDE_GROUPS]

export const WAITING_ROOM = '06070'
export const EMERGENCY_ROOM = '06071'
export const EXPERIMENTAL_THERAPIES_WARD = '06072'
export const RECORDS_OFFICE = '06073'
export const STAIRWELL = '06074'
export const MORGUE = '06075'
export const OPERATING_ROOM = '06076'
export const PRIVATE_ROOM = '06077'
export const INFESTATION_BEGINS = '06078'
export const RANDOLPH_CARTER = '06079'
export const DR_MAHESWARAN = '06080'
export const SUSPICIOUS_ORDERLY = '06081'
export const CORRUPTED_ORDERLY = '06082'
export const OUTBREAK = '06083'

export const ACT_CODES = ['06067', '06068', '06069']
export const AGENDA_CODES = ['06064', '06065', '06066']

// 开局放一边的「其余地点」：梯井 + 三张地下室门（揭示后为太平间/手术室/私人病房）。
export const SET_ASIDE_LOCATIONS = ['stairwell', 'morgue', 'operatingRoom', 'privateRoom']

// 开局放一边的卡（卡面 setup 逐句）：伦道夫·卡特、3 张爆发、2 张堕落的护工、蛛群入侵故事卡，
// 以及 Agents of Atlach-Nacha / Spiders 两个遭遇组的全部卡牌。
const SET_ASIDE_ALIASES_FIXED = [RANDOLPH_CARTER, OUTBREAK, OUTBREAK, OUTBREAK,
  CORRUPTED_ORDERLY, CORRUPTED_ORDERLY, INFESTATION_BEGINS]
const setAsideGroupCards = encounterCards(SET_ASIDE_GROUPS)
export const SET_ASIDE_ALIASES = Object.freeze([
  ...SET_ASIDE_ALIASES_FIXED,
  ...setAsideGroupCards.flatMap(card => Array(card.quantity || 1).fill(card.code)),
])

// 初始遭遇牌库：收齐 5 个组后剔除「放一边」的爆发与堕落的护工（其余全部洗成遭遇牌库）。
const SET_ASIDE_DECK_CODES = new Set([OUTBREAK, CORRUPTED_ORDERLY])
const deckCards = encounterCards(GATHER_GROUPS).filter(card => !SET_ASIDE_DECK_CODES.has(card.code))
export const ENCOUNTER_DECK = encounterDeck(deckCards)

// 遭遇牌定义：7 个组的全部敌人/诡计（含放一边的两组；它们会随议程推进进入牌库）。
const allEncounterCards = encounterCards(ALL_GROUPS)
const definitions = encounterDefinitions(allEncounterCards)

// 地点符号图（卡面左下角符号；Layout 与连接由 linkSymbolLocations 生成）。
const locations = {
  waitingRoom: location('waitingRoom', WAITING_ROOM, { symbol: 'circle', links: ['diamond', 'triangle', 'square'] }),
  emergencyRoom: location('emergencyRoom', EMERGENCY_ROOM, { symbol: 'square', links: ['circle', 'triangle'] }),
  experimentalTherapiesWard: location('experimentalTherapiesWard', EXPERIMENTAL_THERAPIES_WARD, {
    symbol: 'triangle', links: ['circle', 'square', 'heart'],
  }),
  recordsOffice: location('recordsOffice', RECORDS_OFFICE, { symbol: 'diamond', links: ['circle'] }),
  stairwell: location('stairwell', STAIRWELL, {
    symbol: 'heart', links: ['triangle', 'plus', 'hourglass', 't', 'moon'],
  }),
  // 三张「地下室的门」：印刷正面是门（背面揭示面为太平间/手术室/私人病房）；本章把揭示面属性
  // 直接写成地点数据（引擎用普通地点承载；「门」的叙事面不参与规则）。
  morgue: location('morgue', MORGUE, { symbol: 'hourglass', links: ['heart'] }),
  operatingRoom: location('operatingRoom', OPERATING_ROOM, { symbol: 't', links: ['heart'] }),
  privateRoom: location('privateRoom', PRIVATE_ROOM, { symbol: 'moon', links: ['heart'] }),
}
linkSymbolLocations(locations)

// 幕/议程的章节流程数据（纯数据；behavior 读这些字段，不按卡号分支）。
const ACT_EXTRA = Object.freeze({
  '06067': { chapterFlow: 'lookingForAnswers', objective: { type: 'clues', perInvestigator: 4 } },
  '06068': { chapterFlow: null },
  '06069': {},
})
const AGENDA_EXTRA = Object.freeze({
  '06064': { chapterFlow: 'theInfestationBegins' },
  '06065': {},
  '06066': {},
})

// —— 剧情正文（P8-T 自译；生成物 story-text.js → 本章 sections）——
const story = chapterStory('wakingNightmare')
const sections = story.sections
const setup = sections.setup
const text = value => flattenStory(value)
const blocks = (...parts) => parts.map(text).filter(Boolean).join('\n\n')

export const SCENARIO_TEXT = Object.freeze({
  textLanguage: 'zh-CN',
  textStatus: 'translated (self-translated)',
  // en `introTitle` = 章节标题（story-text: sections.intro.title）。
  introTitle: text(sections.intro.title),
  // en `intro` = 章节标题 + 开场 1 正文（含医生同行/留守二选一；story-text: sections.flavorText.intro1.body）。
  intro: blocks(sections.intro.title, sections.flavorText.intro1.body),
  // en `intro2` / `intro3` = 开场 2 / 开场 3 正文（story-text: sections.flavorText.intro2/3.body）。
  intro2: text(sections.flavorText.intro2.body),
  intro3: text(sections.flavorText.intro3.body),
  // en `setup` = setup 步骤（story-text: sections.setup.*；战役日志检查与两个医生分支保持单换行）。
  setup: blocks(
    text(setup.gatherSets),
    text(setup.setEncounterSetsAside),
    text(setup.putLocations),
    text(setup.beginInWaitingRoom),
    [setup.checkCampaignLog, setup.doctorJoined, setup.doctorStayed].map(text).filter(Boolean).join('\n'),
    text(setup.setRemainingLocationsAside),
    text(setup.setCardsAside),
    text(setup.setInfestationBeginsAside),
    text(setup.buildEncounterDeck),
  ),
  // en `resolutions` = 「标题 + 正文」字符串（story-text: sections.resolutions.<key>）。
  resolutions: Object.freeze(Object.fromEntries(
    Object.entries(sections.resolutions).map(([key, value]) => [key, flattenResolution(value)]),
  )),
})


export const scenario = {
  id: 'wakingNightmare',
  originalCode: '06063',
  name: '清醒噩梦 · Waking Nightmare',
  intro: SCENARIO_TEXT.intro,
  setup: SCENARIO_TEXT.setup,
  startLocation: 'waitingRoom',
  locations,
  setAsideLocations: SET_ASIDE_LOCATIONS,
  // 放一边的非地点卡（manifest 区域对账用；运行时由 behavior.setupLocations 写 scenarioZones）。
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
  storyAssets: storyCards([RANDOLPH_CARTER, DR_MAHESWARAN]),
  // 蛛群入侵（06078）是 33 张背面故事卡之外的「正面故事参考卡」：条目 scope storyAsset，
  // 规则（滋生袋/蛛巢）在条目 flags + 本章 behavior；definition 里登记故事面供 UI 查表。
  storyFaces: { [INFESTATION_BEGINS]: storyFace(INFESTATION_BEGINS) },
  encounterDeck: ENCOUNTER_DECK,
  resolutions: { ...SCENARIO_TEXT.resolutions },
  tokenMeanings: {
    standard: { ...WAKING_NIGHTMARE_TOKEN_MEANINGS.standard },
    hard: { ...WAKING_NIGHTMARE_TOKEN_MEANINGS.hard },
    expert: { ...WAKING_NIGHTMARE_TOKEN_MEANINGS.hard },
    easy: { ...WAKING_NIGHTMARE_TOKEN_MEANINGS.standard },
  },
  textLanguage: SCENARIO_TEXT.textLanguage,
  textStatus: SCENARIO_TEXT.textStatus,
}

// 供 chaos.js 引用（避免 definition ↔ chaos 循环依赖：chaos.js 不 import definition）。
export const TOKEN_MEANING_SOURCE = 'cards-data:06063'

export const identities = identitiesFor(scenario)
bindScenarioIdentities(scenario, identities)


// P8：本章 behavior.js 引用的印刷卡号统一放数据表（content 章节流程不写卡号字面量）。
export const RAW_CODES = Object.freeze({
  c06064: '06064',
  c06065: '06065',
  c06066: '06066',
  c06067: '06067',
  c06068: '06068',
  c06069: '06069',
  c06070: '06070',
  c06071: '06071',
  c06072: '06072',
  c06073: '06073',
  c06074: '06074',
  c06075: '06075',
  c06076: '06076',
  c06077: '06077',
  c06078: '06078',
  c06079: '06079',
  c06080: '06080',
  c06081: '06081',
  c06082: '06082',
  c06083: '06083',
})
