// 疯狂之心 第 II 部分（The Heart of Madness, Part II · 08648b / 提示卡 08648）· 剧本数据。
//
// 参考：Scenario/Scenarios/EdgeOfTheEarth/TheHeartOfMadnessPart2.hs、
// CardDefs/EdgeOfTheEarth/{Act,Agenda,Location,Enemy}/TheHeartOfMadness.hs、
// Scenarios/TheHeartOfMadness/{Helpers,Pylon}.hs（randomizeLocations / 迷雾高塔）。
// 文本来源：`chapterStory('theHeartOfMadnessPart2')`（story-text 生成物；本文件不写死正文）。
//
// 与第 I 部分共用同一张「三环五辐」地图（槽位 facility1–15 坐标相同），差异：
//   · 15 个槽位 = 10 座古代设施（The Heart of Madness 组）+ 5 座迷雾高塔（本组）；
//   · 内环五格不能全是迷雾高塔（setup 重排直到满足）；
//   · 伊夸之门翻到未揭示面；封印来自第 I 部分结算的战役状态（eote-seals.js）。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { bindScenarioIdentities } from '../../../../identities.js'
import { chapterStory } from '../../story-access.js'
import { HEART_OF_MADNESS_TOKEN_MEANINGS } from './chaos.js'

const cardOf = code => {
  const card = ALL_CARDS[String(code)]
  if (!card) throw new RangeError(`《疯狂之心 II》缺少印刷卡 ${code}`)
  return card
}
const printedOf = code => {
  const card = cardOf(code)
  return {
    code: String(code), originalCode: String(code),
    name: card.nameZh || card.name, nameEn: card.name,
    text: card.textZh || card.text || '', textEn: card.text || '',
    ...(card.backText ? { backText: card.backTextZh || card.backText, backTextEn: card.backText } : {}),
    ...(card.backNameZh || card.backName ? { backName: card.backNameZh || card.backName, backNameEn: card.backName || '' } : {}),
    traits: [...(card.traits || [])],
  }
}
function location(id, code, extra = {}) {
  const card = cardOf(code)
  const base = printedOf(code)
  return {
    ...base, id, type: 'location',
    shroud: card.shroud || 0,
    cluesPerInvestigator: card.clues || 0,
    ...(card.cluesFixed ? { cluesFixed: card.clues || 0 } : {}),
    victory: card.victory || 0,
    connections: [...(extra.connections || [])],
    unrevealedName: card.backNameZh || card.backName || card.nameZh || card.name,
    unrevealedNameEn: card.backName || card.name,
    ...extra,
  }
}
function stage(code, type, extra = {}) {
  const card = cardOf(code)
  return {
    ...printedOf(code), id: `${type}${code}`, type,
    stage: `${card.stage ?? extra.number ?? 1}a`,
    // 08672「无名存在」印刷没有毁灭阈值（目标型议程）：`doomThreshold: null` 是引擎
    // `checkAgenda` 的「不靠毁灭阈值推进」读点（src/engine/act-agenda.js:435）。
    // 早期写成 0 会让下一神话阶段立刻满足 doom(0) >= 0 而推进并清场（坡道场景提前触发）。
    ...(type === 'agenda' ? { doomThreshold: Number.isFinite(card.doom) ? card.doom : null } : {}),
    reveal: { type: 'campaignRule' },
    advanceText: card.backTextZh || card.backText || '',
    ...extra,
  }
}

export const GATHER_GROUPS = Object.freeze(['stirringInTheDeep', 'agentsOfTheUnknown', 'chillingCold', 'strikingFear'])
export const REMOVED_GROUPS = Object.freeze(['theGreatSeal', 'shoggoths', 'lockedDoors'])
export const FACILITY_SLOT_CODES = Object.freeze([
  '08650', '08651', '08652', '08653', '08654', '08655', '08655', '08656', '08656', '08656',
])
export const PYLON_SLOT_CODES = Object.freeze(['08674', '08675', '08676', '08677', '08678'])
export const SLOT_CODES = Object.freeze([...FACILITY_SLOT_CODES, ...PYLON_SLOT_CODES])
// 内环槽位（参考 Helpers.hs#ring3）：setup 时不得全是迷雾高塔。
export const INNER_RING_SLOTS = Object.freeze(['facility7', 'facility8', 'facility9', 'facility10', 'facility11'])
export const RAMP_CODES = Object.freeze(['08682', '08683', '08684', '08685'])

const locations = {
  theGateOfYquaa: location('theGateOfYquaa', '08649', {
    gate: true, transferred: true, connections: [],
  }),
  ...Object.fromEntries(SLOT_CODES.map((code, index) => {
    const slot = `facility${index + 1}`
    return [slot, location(slot, code, { slot: index + 1, mistPylon: PYLON_SLOT_CODES.includes(code) })]
  })),
  titanicRamp1: location('titanicRamp1', '08682', { ramp: 1, setAside: true, connections: [] }),
  titanicRamp2: location('titanicRamp2', '08683', { ramp: 2, setAside: true, connections: [] }),
  titanicRamp3: location('titanicRamp3', '08684', { ramp: 3, setAside: true, connections: [] }),
  titanicRamp4: location('titanicRamp4', '08685', { ramp: 4, setAside: true, connections: [] }),
  hiddenTunnel: location('hiddenTunnel', '08686', { tunnel: true, setAside: true, connections: [] }),
}

// 遭遇卡：四个组（Striking Fear 只保留 2×Dissonant Voices 与 2×Frozen in Fear）；
// 15 张无名的疯狂与地点/幕/议程全部放一边，不进遭遇牌库。
const ENCOUNTER_GROUPS = Object.freeze(['stirring_in_the_deep', 'agents_of_the_unknown', 'chilling_cold', 'striking_fear'])
const STRIKING_KEEP = Object.freeze(['Dissonant Voices', 'Frozen in Fear'])
const deckCodes = []
const enemyDefinitions = {}
const treacheryDefinitions = {}
const SET_ASIDE_CARD_CODES = new Set(['08679'])
for (const card of Object.values(ALL_CARDS)) {
  if (!ENCOUNTER_GROUPS.includes(card.encounterCode)) continue
  if (!['enemy', 'treachery'].includes(card.type)) continue
  const setAsideCard = SET_ASIDE_CARD_CODES.has(card.code)
  if (card.encounterCode === 'striking_fear' && !STRIKING_KEEP.includes(card.name)) continue
  if (!setAsideCard) {
    const copies = Math.min(card.quantity || 1, card.encounterCode === 'striking_fear' ? 2 : (card.quantity || 1))
    for (let index = 0; index < copies; index += 1) deckCodes.push(card.code)
  }
  const base = printedOf(card.code)
  if (card.type === 'enemy') {
    enemyDefinitions[card.code] = {
      ...base, type: 'enemy', fight: card.fight ?? 0, evade: card.evade ?? 0,
      health: card.health ?? 1, damage: card.damage ?? 0, horror: card.horror ?? 0,
      ...(card.healthPerInvestigator ? { healthPerInvestigator: true } : {}),
      ...(card.victory != null ? { victory: card.victory } : {}),
    }
  } else {
    treacheryDefinitions[card.code] = { ...base, type: 'treachery', entryRevelation: true,
      surge: /^Surge\./m.test(card.text || '') }
  }
}
export const ENCOUNTER_DECK = Object.freeze(deckCodes.sort())

// 放一边（manifest 对账）：15×无名的疯狂 + 第四幕 + 4 张泰坦坡道 + 隐藏隧道。
const SET_ASIDE_ALIASES_FIXED = ['08681', '08682', '08683', '08684', '08685', '08686', ...Array(15).fill('08679')]
export const SET_ASIDE_ALIASES = Object.freeze(SET_ASIDE_ALIASES_FIXED)
export const SET_ASIDE_LOCATIONS = Object.freeze(['titanicRamp1', 'titanicRamp2', 'titanicRamp3', 'titanicRamp4', 'hiddenTunnel'])

const story = chapterStory('theHeartOfMadnessPart2')
const resolutionTexts = Object.fromEntries(Object.entries(story.resolutions || {}).map(([key, value]) => {
  if (typeof value === 'string') return [key, value]
  return [key, [value?.title, value?.body].filter(Boolean).join('\n')]
}))
export const SCENARIO_TEXT = Object.freeze({
  textLanguage: 'zh-CN',
  textStatus: story.status === 'present' ? 'translated' : 'mixed (en fallback for missing leaves)',
  title: story.title,
  intro: flatten(story.intro),
  setup: flatten(story.setup),
  resolutions: Object.freeze(resolutionTexts),
})
function flatten(value) { return typeof value === 'string' ? value : String(value?.text || value?.body || '') }

const ACT_EXTRA = Object.freeze({
  '08673': { chapterFlow: 'collapseThePylons', objective: { type: 'collapsePylons' }, backEffect: 'rampSequence' },
  '08681': { chapterFlow: 'theFinalMirage', objective: { type: 'runToHiddenTunnel' } },
})
const AGENDA_EXTRA = Object.freeze({
  '08671': { chapterFlow: 'theSealWeakens', backEffect: 'spawnNamelessAtPylon' },
  '08672': { chapterFlow: 'thatWhichHasNoName', backEffect: 'rampSequence', finalMirageDoom: true },
})

export const scenario = {
  id: 'theHeartOfMadnessPart2',
  // 桌面提示卡 = 08648 正面；08648a/b 是双面剧本卡的背面身份，卡表不单列。
  originalCode: '08648',
  referenceCode: '08648',
  name: '疯狂之心 第 II 部分 · The Heart of Madness, Part II',
  nameEn: 'The Heart of Madness, Part II',
  intro: SCENARIO_TEXT.intro,
  setup: SCENARIO_TEXT.setup,
  startLocation: 'facility8',
  locations,
  facilitySlots: Object.freeze(Object.keys(locations).filter(id => /^facility\d+$/.test(id))),
  facilitySlotCodes: SLOT_CODES,
  pylonSlotCodes: PYLON_SLOT_CODES,
  innerRingSlots: INNER_RING_SLOTS,
  setAsideLocations: SET_ASIDE_LOCATIONS,
  setAsideAliases: SET_ASIDE_ALIASES,
  acts: [stage('08673', 'act', ACT_EXTRA['08673']), stage('08681', 'act', ACT_EXTRA['08681'])],
  agendas: [stage('08671', 'agenda', AGENDA_EXTRA['08671']), stage('08672', 'agenda', AGENDA_EXTRA['08672'])],
  enemies: enemyDefinitions,
  treacheries: treacheryDefinitions,
  storyAssets: {},
  encounterDeck: ENCOUNTER_DECK,
  resolutions: SCENARIO_TEXT.resolutions,
  tokenMeanings: {
    standard: { ...HEART_OF_MADNESS_TOKEN_MEANINGS.standard },
    hard: { ...HEART_OF_MADNESS_TOKEN_MEANINGS.hard },
    expert: { ...HEART_OF_MADNESS_TOKEN_MEANINGS.hard },
    easy: { ...HEART_OF_MADNESS_TOKEN_MEANINGS.standard },
  },
  textLanguage: SCENARIO_TEXT.textLanguage,
  textStatus: SCENARIO_TEXT.textStatus,
}

export const identities = {
  locations: Object.fromEntries(Object.values(locations).map(entry => [entry.id,
    { originalCode: entry.originalCode, artCode: entry.originalCode }])),
  acts: Object.fromEntries(scenario.acts.map(entry => [entry.id,
    { originalCode: entry.originalCode, artCode: entry.originalCode }])),
  agendas: Object.fromEntries(scenario.agendas.map(entry => [entry.id,
    { originalCode: entry.originalCode, artCode: entry.originalCode }])),
  enemies: Object.fromEntries(Object.values(enemyDefinitions).map(entry => [entry.code,
    { originalCode: entry.originalCode, artCode: entry.originalCode }])),
  treacheries: Object.fromEntries(Object.values(treacheryDefinitions).map(entry => [entry.code,
    { originalCode: entry.originalCode, artCode: entry.originalCode }])),
  storyAssets: {},
}
bindScenarioIdentities(scenario, identities)
export { story }

export const RAW_CODES = Object.freeze({
  gate: '08649',
  acts: Object.freeze(['08673', '08681']),
  agendas: Object.freeze(['08671', '08672']),
  namelessMadness: '08679',
  unsealedPhantasm: '08680',
  finalMirageAct: '08681',
  ramps: RAMP_CODES,
  hiddenTunnel: '08686',
})
