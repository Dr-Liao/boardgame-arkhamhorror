// 阿卡姆的毁灭 第二部分（theDoomOfArkhamPartII · 提示卡 11688a，十循环终章下篇）· 章节数据。
//
// 权威来源（只读）：
//   Scenario/Scenarios/TheDrownedCity/TheDoomOfArkhamPartII.hs +
//   Scenario/Scenarios/TheDrownedCity/TheDoomOfArkhamPartII/Helpers.hs（克苏鲁面板/牌库/怒气）+
//   Act|Agenda|Enemy|Location|Story|Treachery/CardDefs/TheDrownedCity/TheDoomOfArkham.hs +
//   各卡 Cards/TheDrownedCity/TheDoomOfArkham/*.hs +
//   frontend/src/locales/en/theDrownedCity/theDoomOfArkhamPartII.json（印刷文本）。
//
// 卡号归属（chapter-inventory.json）：11689（议程）/11690、11691a（幕二选一）/11691b（特殊议程）/
// 11692–11700（地点 9）/11701–11704b（克苏鲁本体 + 3 张双面部位）/11705–11715（克苏鲁牌库行动卡 18 张）/
// 11716–11720（诡计 4）= 35 张；11688a 是提示卡，不建单卡条目。
// 数据入口沿用 Part I 的 card-helpers.js（同一场游戏的前后两部分）。
import { ALL_CARDS } from '../theDoomOfArkhamPartI/card-helpers.js'
import { bindScenarioIdentities } from '../../../../identities.js'
import {
  printed, location, stage, encounterDefinitions, identitiesFor, encounterGroupDeck, flagsOf,
} from '../theDoomOfArkhamPartI/card-helpers.js'
import { DOOM_OF_ARKHAM_PART_II_TOKEN_MEANINGS } from './chaos.js'
import { STORY } from './story.js'
import { chapterStory } from '../../story-access.js'

export const CHAPTER_ID = 'theDoomOfArkhamPartII'
export const REFERENCE_CODE = '11688a'
export const ENCOUNTER_CODE = 'the_doom_of_arkham_part_2'

// 剧情正文：优先 narrative-guides 生成的自译中文（story-text.js），缺译回退内嵌英文印刷原文。
const CHAPTER_STORY = (() => {
  try { return chapterStory(CHAPTER_ID) } catch { return null }
})()
const decodeText = value => String(value || '')
  .replace(/<\/(?:p|li|h\d|ul|ol)>/gi, '\n\n')
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<[^>]+>/g, '')
  .replace(/&(amp|lt|gt|quot|#39|rsquo|lsquo|ldquo|rdquo|mdash|ndash|nbsp);/g, (match, name) => ({
    amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", rsquo: '’', lsquo: '‘',
    ldquo: '“', rdquo: '”', mdash: '—', ndash: '–', nbsp: ' ',
  })[name] || match)
  .replace(/[ \t]+/g, ' ')
  .trim()
const storyText = (key, fallback = '') => decodeText(CHAPTER_STORY?.sections?.[key])
  || decodeText(CHAPTER_STORY?.sectionsEn?.[key]) || decodeText(fallback)
const hasTranslatedStory = Boolean(CHAPTER_STORY?.sections
  && Object.keys(CHAPTER_STORY.sections).some(key => decodeText(CHAPTER_STORY.sections[key])))

// ---------------------------------------------------------------------------
// 幕 / 议程 / 结局
// ---------------------------------------------------------------------------
export const ACT_FIGHT_BACK_CODE = '11690'
export const ACT_BANISH_HIM_CODE = '11691a'
export const ACT_CODES = Object.freeze([ACT_FIGHT_BACK_CODE, ACT_BANISH_HIM_CODE])
export const AGENDA_DOOM_CODE = '11689' // 阿卡姆的毁灭（正面）；背面 = AGENDA_DOOM_BACK_CODE
export const AGENDA_DOOM_BACK_CODE = '11689b'
export const AGENDA_FINAL_SEAL_CODE = '11691b' // 特殊议程「最终封印」
export const AGENDA_CODES = Object.freeze([AGENDA_DOOM_CODE, AGENDA_FINAL_SEAL_CODE, AGENDA_DOOM_BACK_CODE])
export const RESOLUTION_KEYS = Object.freeze(['noResolution', 'resolution1', 'resolution2', 'resolution3'])
export const CTHULHU_FINAL_SEAL_DOOM = { perInvestigator: 1 }
export const CTHULHU_BANISH_RAGE_THRESHOLD = 4 // 放逐他！：怒气 ≥4 才推进到最终封印
export const CTHULHU_FIGHT_BACK_RAGE_THRESHOLD = 5 // 反击！：怒气 ≥5 → 结局 1
export const CTHULHU_RAGE_MAX = 5
export const SIGIL_REQUIRED = 5
export const RUINED_LOCATION_LIMIT = 7

// ---------------------------------------------------------------------------
// 单卡（本章专属 35 张）
// ---------------------------------------------------------------------------
export const CTHULHU_BODY_CODE = '11701'
export const CTHULHU_FACET_CODES = Object.freeze(['11702', '11703', '11704'])
export const CTHULHU_FACET_PAIRS = Object.freeze([
  Object.freeze(['11702', '11702b']),
  Object.freeze(['11703', '11703b']),
  Object.freeze(['11704', '11704b']),
])
export const CTHULHU_ENEMY_CODES = Object.freeze([
  '11702', '11702b', '11703', '11703b', '11704', '11704b',
])
export const CTHULHU_STORY_CODES = Object.freeze([
  '11705', '11706', '11707', '11708', '11709', '11710',
  '11711', '11712', '11713', '11714', '11715',
])
export const CTHULHU_DECK_ID = 'cthulhu'
export const DEMOLITION_CODE = '11709'
export const FIFTH_EYE_CODE = '11710'
export const HOPE_FADES_CODE = '11715'
export const TREACHERY_CODES = Object.freeze(['11716', '11717', '11719', '11720'])
export const ALLY_CODES = Object.freeze(['11687', '11765', '11766'])
export const IMPLEMENTED_ENTRY_CODES = Object.freeze([
  '11689', '11690', '11691a', '11691b',
  '11692', '11693', '11694', '11695', '11696', '11697', '11698', '11699', '11700',
  '11701', '11702', '11702b', '11703', '11703b', '11704', '11704b',
  '11705', '11706', '11707', '11708', '11709', '11710', '11711', '11712', '11713', '11714', '11715',
  '11716', '11717', '11719', '11720',
])
export const RUINED_SWAP_CODES = Object.freeze({
  northside: '11692', downtown: '11693', easttown: '11694',
  miskatonicUniversity: '11695', stMarysHospital: '11697', southside: '11698',
})
export const SET_ASIDE_STAR_SPAWN_CODES = Object.freeze(['11725', '11726', '11727', '11728'])

// ---------------------------------------------------------------------------
// 地点（午夜假面废墟地图 + 屋顶；废墟版本放在一边，随淹没替换入场）
// ---------------------------------------------------------------------------
export const START_LOCATION = 'rivertownRuined'
// 商业区/南区各有两个印刷版本：Setup 随机选一个，未选中的版本从游戏中移除。
// 地点 id 固定为 downtown/southside，运行期 code 换成选中的印刷卡号。
export const LOCATION_VARIANTS = Object.freeze({
  downtown: Object.freeze(['01130', '01131']),
  southside: Object.freeze(['01126', '01127']),
})
export const BASE_LOCATION_IDS = Object.freeze([
  'northside', 'downtown', 'easttown', 'miskatonicUniversity', 'stMarysHospital', 'southside',
])
export const ROOFTOP_LOCATION_IDS = Object.freeze(['westernRooftops', 'easternRooftops'])
export const SET_ASIDE_LOCATION_IDS = Object.freeze([
  'northsideRuined', 'downtownRuined', 'easttownRuined',
  'miskatonicUniversityRuined', 'stMarysHospitalRuined', 'southsideRuined',
])
// 参考布局（Haskell 3 行 × 4 列）：屋顶在两侧，与印刷连接一致。
//   row0: .                 northside            downtown   easttown
//   row1: westernRooftops   miskatonicUniversity rivertown  easternRooftops
//   row2: .                 stMarysHospital      southside  .
const CONNECTIONS = Object.freeze({
  northside: Object.freeze(['downtown', 'miskatonicUniversity', 'westernRooftops']),
  downtown: Object.freeze(['northside', 'easttown']),
  easttown: Object.freeze(['downtown', 'rivertownRuined', 'easternRooftops']),
  rivertownRuined: Object.freeze(['easttown', 'miskatonicUniversity', 'southside', 'easternRooftops']),
  miskatonicUniversity: Object.freeze(['northside', 'rivertownRuined', 'stMarysHospital', 'southside', 'westernRooftops']),
  stMarysHospital: Object.freeze(['miskatonicUniversity', 'southside', 'westernRooftops']),
  southside: Object.freeze(['rivertownRuined', 'miskatonicUniversity', 'stMarysHospital', 'easternRooftops']),
  westernRooftops: Object.freeze(['northside', 'miskatonicUniversity', 'stMarysHospital']),
  easternRooftops: Object.freeze(['easttown', 'rivertownRuined', 'southside']),
  northsideRuined: Object.freeze(['downtown', 'miskatonicUniversity', 'westernRooftops']),
  downtownRuined: Object.freeze(['northside', 'easttown']),
  easttownRuined: Object.freeze(['downtown', 'rivertownRuined', 'easternRooftops']),
  miskatonicUniversityRuined: Object.freeze(['northside', 'rivertownRuined', 'stMarysHospital', 'southside', 'westernRooftops']),
  stMarysHospitalRuined: Object.freeze(['miskatonicUniversity', 'southside', 'westernRooftops']),
  southsideRuined: Object.freeze(['rivertownRuined', 'miskatonicUniversity', 'stMarysHospital', 'easternRooftops']),
})
export const LOCATION_CONNECTIONS = CONNECTIONS
export const LOCATION_COORDINATES = Object.freeze({
  northside: { x: 1, y: 0 },
  downtown: { x: 2, y: 0 },
  easttown: { x: 3, y: 0 },
  westernRooftops: { x: 0, y: 1 },
  miskatonicUniversity: { x: 1, y: 1 },
  rivertownRuined: { x: 2, y: 1 },
  easternRooftops: { x: 3, y: 1 },
  stMarysHospital: { x: 1, y: 2 },
  southside: { x: 2, y: 2 },
  northsideRuined: { x: 4, y: 0 }, downtownRuined: { x: 4, y: 1 }, easttownRuined: { x: 4, y: 2 },
  miskatonicUniversityRuined: { x: 5, y: 0 }, stMarysHospitalRuined: { x: 5, y: 1 },
  southsideRuined: { x: 5, y: 2 },
})
export const RUINED_TRAIT = 'Ruined'
export const ROOFTOP_TRAIT = 'Rooftop'
// 印刷「不能完全淹没」的废墟地点（水位上限 1）与屋顶（不能淹没，水位上限 0）。
export const NON_FULLY_FLOODABLE_IDS = Object.freeze([
  'northsideRuined', 'easttownRuined', 'miskatonicUniversityRuined', 'stMarysHospitalRuined',
])
export const UNFLOODABLE_IDS = Object.freeze([...ROOFTOP_LOCATION_IDS])

const LOCATION_DEFS = Object.freeze({
  northside: { code: '01134' },
  downtown: { code: '01130', variantCodes: ['01130', '01131'] },
  easttown: { code: '01132' },
  miskatonicUniversity: { code: '01129' },
  stMarysHospital: { code: '01128' },
  southside: { code: '01126', variantCodes: ['01126', '01127'] },
  rivertownRuined: { code: '11696', cluesPerInvestigator: 1 },
  westernRooftops: { code: '11699' },
  easternRooftops: { code: '11700' },
  northsideRuined: { code: '11692', cluesPerInvestigator: 1, ruinedSwap: 'northside' },
  downtownRuined: { code: '11693', cluesPerInvestigator: 1, ruinedSwap: 'downtown' },
  easttownRuined: { code: '11694', cluesPerInvestigator: 1, ruinedSwap: 'easttown' },
  miskatonicUniversityRuined: { code: '11695', cluesPerInvestigator: 1, ruinedSwap: 'miskatonicUniversity' },
  stMarysHospitalRuined: { code: '11697', cluesPerInvestigator: 1, ruinedSwap: 'stMarysHospital' },
  southsideRuined: { code: '11698', cluesPerInvestigator: 1, ruinedSwap: 'southside' },
})
export const LOCATIONS = Object.fromEntries(Object.entries(LOCATION_DEFS).map(([id, def]) => [id, location({
  id, code: def.code,
  ...(def.cluesPerInvestigator ? { clues: def.cluesPerInvestigator } : { clues: Number(ALL_CARDS[def.code]?.clues) || 1 }),
  ...(ALL_CARDS[def.code]?.victory ? { hasVictory: true, victory: ALL_CARDS[def.code].victory } : {}),
  connections: [...(CONNECTIONS[id] || [])],
  ...(def.ruinedSwap ? { ruinedSwapOf: def.ruinedSwap } : {}),
})]))

// ---------------------------------------------------------------------------
// 遭遇牌库（gather The Doom of Arkham Part II / Domination / Elder Mist / Flood /
// Star Spawn / Agents of Cthulhu / The Midnight Masks 地点）
// ---------------------------------------------------------------------------
export const GATHER_GROUPS = Object.freeze([
  'theDoomOfArkhamPart2', 'domination', 'elderMist', 'tdcFlood', 'starSpawn', 'agentsOfCthulhu',
])
export const ENCOUNTER_DECK = Object.freeze(encounterGroupDeck(GATHER_GROUPS, {
  exclude: [...CTHULHU_STORY_CODES, ...SET_ASIDE_STAR_SPAWN_CODES],
}))
export const ENCOUNTER_DECK_CODES = Object.freeze([...new Set(ENCOUNTER_DECK)])
// 星之眷族整组 + 克苏鲁行动卡（18 张实物）放在一边；行动卡在 Setup 组成独立牌库。
export const SET_ASIDE_CARDS = Object.freeze([
  ...CTHULHU_FACET_CODES,
  ...CTHULHU_STORY_CODES.flatMap(code => Array(Math.max(1, Number(ALL_CARDS[code].quantity) || 1)).fill(code)),
  ...SET_ASIDE_STAR_SPAWN_CODES,
])

// ---------------------------------------------------------------------------
// 遭遇定义
// ---------------------------------------------------------------------------
const DEFINITION_CODES = [...new Set([
  ...ENCOUNTER_DECK_CODES, ...CTHULHU_ENEMY_CODES, ...CTHULHU_STORY_CODES,
  ...SET_ASIDE_STAR_SPAWN_CODES, ...ALLY_CODES, ...TREACHERY_CODES,
])]
const PATCHES = {
  // 克苏鲁本体：只有地点/交战结构，本身不作为攻击目标（部位才可被攻击/击败）。
  '11701': {
    fight: 0, evade: 0, health: 99, damage: 0, horror: 0, victory: 0,
    massive: true, cannotBeDefeated: true, immobile: false,
  },
  // 非狂怒面部位：不能受到伤害/被击败/横置（近似：cannotBeDefeated + 高生命）。
  '11702': { health: 99, cannotBeDefeated: true, alert: true },
  '11703': { health: 99, cannotBeDefeated: true, alert: true, retaliate: true },
  '11704': { health: 99, cannotBeDefeated: true, retaliate: true },
  // 狂怒面部位：生命 = 怒气（behavior.enemyStatModifier 动态补正）。
  '11702b': { health: 0, alert: true },
  '11703b': { health: 0, alert: true, retaliate: true },
  '11704b': { health: 0, retaliate: true },
  // 盟友剧情资产：不占盟友槽。
  '11687': { storyAlly: true, allySlotExempt: true },
  '11765': { storyAlly: true, allySlotExempt: true },
  '11766': { storyAlly: true, allySlotExempt: true },
}
const definitions = encounterDefinitions(DEFINITION_CODES, PATCHES)
// 克苏鲁牌库 18 张 = 印刷份数展开（story 卡不进遭遇牌库）。
export const CTHULHU_DECK = Object.freeze(CTHULHU_STORY_CODES
  .flatMap(code => Array(Math.max(1, Number(ALL_CARDS[code].quantity) || 1)).fill(code)))

// ---------------------------------------------------------------------------
// 幕 / 议程阶段
// ---------------------------------------------------------------------------
const agendaFront = ALL_CARDS[AGENDA_DOOM_CODE] || {}
export const STAGE_CARDS = Object.freeze({
  [ACT_FIGHT_BACK_CODE]: Object.freeze({
    ...stage(ACT_FIGHT_BACK_CODE, { stage: 1 }),
    objective: Object.freeze({ type: 'cthulhuInVictory', amount: 3 }),
  }),
  [ACT_BANISH_HIM_CODE]: Object.freeze({
    ...stage(ACT_BANISH_HIM_CODE, { stage: 1 }),
    objective: Object.freeze({ type: 'cthulhuInVictory', amount: 3 }),
  }),
  [AGENDA_DOOM_CODE]: Object.freeze({
    ...stage(AGENDA_DOOM_CODE, { stage: 1, doom: agendaFront.doom ?? 3 }),
    enemyPhaseEndDrawCthulhu: true,
    roundEndFullyFlooded: true,
  }),
  [AGENDA_DOOM_BACK_CODE]: Object.freeze({
    ...stage(AGENDA_DOOM_CODE, { stage: 1 }),
    id: `agenda${AGENDA_DOOM_BACK_CODE}`, backFace: true,
    enemyPhaseEndDrawCthulhu: true,
    roundEndFullyFlooded: true,
  }),
  [AGENDA_FINAL_SEAL_CODE]: Object.freeze({
    ...stage(AGENDA_FINAL_SEAL_CODE, { stage: 2, doom: ALL_CARDS[AGENDA_FINAL_SEAL_CODE]?.doom ?? 10 }),
    finalSeal: true,
    enemyPhaseEndDrawCthulhu: true,
    objective: Object.freeze({ type: 'finalSeal', sigils: SIGIL_REQUIRED }),
  }),
})
export const ACT_STAGES = Object.freeze({
  fightBack: STAGE_CARDS[ACT_FIGHT_BACK_CODE],
  banishHim: STAGE_CARDS[ACT_BANISH_HIM_CODE],
})
export const AGENDA_STAGES = Object.freeze({
  doom: STAGE_CARDS[AGENDA_DOOM_CODE],
  doomBack: STAGE_CARDS[AGENDA_DOOM_BACK_CODE],
  finalSeal: STAGE_CARDS[AGENDA_FINAL_SEAL_CODE],
})

// ---------------------------------------------------------------------------
// 剧情正文 / 指南
// ---------------------------------------------------------------------------
const paragraphs = value => (Array.isArray(value?.paragraphs) ? value.paragraphs : [])
const blocks = value => (value ? [value.title, ...paragraphs(value)].filter(Boolean).join('\n\n') : '')
const ruleEntry = (key, value) => ({
  title: storyText(`rules.${key}.title`, value.title),
  paragraphs: storyText(`rules.${key}.body`, paragraphs(value).join('\n\n')).split(/\n{2,}/).filter(Boolean),
})
export const SCENARIO_TEXT = Object.freeze({
  textLanguage: hasTranslatedStory ? 'zh' : 'en',
  textStatus: hasTranslatedStory
    ? '自译中文（narrative-guides story-text.js），缺译回退英文印刷原文'
    : STORY.textStatus,
  heading: storyText('intro.title', STORY.title),
  intro: storyText('intro.theDoomOfArkham1', paragraphs(STORY.intro.theDoomOfArkham1).join('\n\n')),
  introBranches: Object.freeze(Object.fromEntries(Object.entries(STORY.intro)
    .filter(([key]) => key !== 'title' && key !== 'theDoomOfArkham1')
    .map(([key, value]) => [key, storyText(`intro.${key}`, paragraphs(value).join('\n\n'))]))),
  setup: Object.keys(STORY.setup)
    .map(key => storyText(`setup.${key}`, paragraphs(STORY.setup[key]).join('\n\n')))
    .filter(Boolean).join('\n\n'),
  setupSteps: Object.freeze(Object.keys(STORY.setup).map(key => ({
    key, text: storyText(`setup.${key}`, paragraphs(STORY.setup[key]).join('\n\n')),
  }))),
  specialRules: Object.freeze([
    ruleEntry('cthulhuBoard', STORY.rules.cthulhuBoard),
    ruleEntry('cthulhuDeck', STORY.rules.cthulhuDeck),
    ruleEntry('cthulhusRage', STORY.rules.cthulhusRage),
  ]),
  rules: Object.freeze(Object.fromEntries(Object.entries(STORY.rules).map(([key, value]) => [key, ruleEntry(key, value)]))),
  errata: Object.freeze({
    theFinalSeal: storyText('errata.theFinalSeal', STORY.errata?.theFinalSeal || ''),
  }),
  labels: STORY.labels,
  tokens: Object.freeze({
    easy: Object.freeze({ ...DOOM_OF_ARKHAM_PART_II_TOKEN_MEANINGS.easy }),
    standard: Object.freeze({ ...DOOM_OF_ARKHAM_PART_II_TOKEN_MEANINGS.standard }),
    hard: Object.freeze({ ...DOOM_OF_ARKHAM_PART_II_TOKEN_MEANINGS.hard }),
    expert: Object.freeze({ ...DOOM_OF_ARKHAM_PART_II_TOKEN_MEANINGS.expert }),
  }),
  xp: STORY.xp,
  resolutions: Object.freeze(Object.fromEntries(RESOLUTION_KEYS.map(key => [key,
    [storyText(`resolutions.${key}.title`, STORY.resolutions[key]?.title || ''),
      storyText(`resolutions.${key}.body`, blocks(STORY.resolutions[key]))].filter(Boolean).join('\n\n')]))),
})

// ---------------------------------------------------------------------------
// scenario
// ---------------------------------------------------------------------------
export const scenario = {
  id: CHAPTER_ID,
  originalCode: REFERENCE_CODE,
  referenceCode: REFERENCE_CODE,
  name: '阿卡姆的毁灭 · 第二部分',
  nameEn: 'The Doom of Arkham Part II',
  encounterCode: ENCOUNTER_CODE,
  intro: SCENARIO_TEXT.intro,
  introBranches: SCENARIO_TEXT.introBranches,
  setup: SCENARIO_TEXT.setup,
  setupSteps: SCENARIO_TEXT.setupSteps,
  specialRules: SCENARIO_TEXT.specialRules,
  rules: SCENARIO_TEXT.rules,
  errata: SCENARIO_TEXT.errata,
  tokens: SCENARIO_TEXT.tokens,
  startLocation: START_LOCATION,
  locations: LOCATIONS,
  locationsStartRevealed: true,
  setAsideLocations: [...SET_ASIDE_LOCATION_IDS],
  setAsideAliases: [...SET_ASIDE_CARDS],
  locationVariants: LOCATION_VARIANTS,
  rooftopLocationIds: [...ROOFTOP_LOCATION_IDS],
  ruinedSwapCodes: { ...RUINED_SWAP_CODES },
  cthulhuBoard: {
    bodyCode: CTHULHU_BODY_CODE,
    facetPairs: CTHULHU_FACET_PAIRS.map(pair => [...pair]),
  },
  cthulhuDeck: {
    id: CTHULHU_DECK_ID,
    cards: [...CTHULHU_DECK],
    drawPerRound: 1,
  },
  // 剧情「Add 1 {elderThing} token to the chaos bag for the remainder of the campaign」。
  chaosBagExtra: ['elder_thing'],
  acts: [structuredClone(STAGE_CARDS[ACT_FIGHT_BACK_CODE])],
  agendas: [structuredClone(STAGE_CARDS[AGENDA_DOOM_CODE])],
  stageCards: STAGE_CARDS,
  ...definitions,
  encounterDeck: [...ENCOUNTER_DECK],
  resolutions: { ...SCENARIO_TEXT.resolutions },
  tokenMeanings: SCENARIO_TEXT.tokens,
  // 淹没标记加入标记池由 behavior/setup 用 api.flood 处理；registry 的 scenario.mechanics
  // 不接受 water.floodTokens。
  textLanguage: SCENARIO_TEXT.textLanguage,
  textStatus: SCENARIO_TEXT.textStatus,
}

export const identities = identitiesFor(scenario)
bindScenarioIdentities(scenario, identities)

export const CARD_DATA = Object.freeze(Object.fromEntries([
  REFERENCE_CODE,
  ...IMPLEMENTED_ENTRY_CODES,
  ...Object.keys(LOCATIONS).map(id => LOCATIONS[id].code),
  ...ENCOUNTER_DECK_CODES,
].map(code => [code, ALL_CARDS[code]])))

export { printed, flagsOf }
