// 阿卡姆的毁灭 第一部分（theDoomOfArkhamPartI · 提示卡 11682，十循环终章上篇）· 章节数据。
//
// 权威来源（只读）：
//   Scenario/Scenarios/TheDrownedCity/TheDoomOfArkhamPartI.hs +
//   Act|Agenda|Location|Enemy|Treachery/CardDefs/TheDrownedCity/TheDoomOfArkham.hs +
//   各卡 Cards/TheDrownedCity/TheDoomOfArkham/*.hs +
//   frontend/src/locales/en/theDrownedCity/theDoomOfArkhamPartI.json（印刷文本）。
//
// 本关是终章上篇：午夜假面地图（外部遭遇组 arkham 的 01124–01136 地点/诡计）+ 幽灵商店。
// 卡号归属（chapter-inventory.json）：11683（议程）/11684（幕）/11685（地点）/11686（敌人）/
// 11687（盟友剧情资产）/11688（黏土恐怖）= 6 张；11682 是提示卡，不建单卡条目。
// 地点数值从本地卡表读取；地点/幕/议程建数据型条目，行为读点在 behavior.js。
//
// 印刷正文内嵌在 story.js（英文原文；中文正文由 narrative-guides 的 story-text.js 生成）。
import { ALL_CARDS } from './card-helpers.js'
import { bindScenarioIdentities } from '../../../../identities.js'
import {
  printed, location, stage, encounterDefinitions, identitiesFor, encounterGroupDeck, flagsOf,
} from './card-helpers.js'
import { DOOM_OF_ARKHAM_PART_I_TOKEN_MEANINGS } from './chaos.js'
import { STORY } from './story.js'
import { chapterStory } from '../../story-access.js'

export const CHAPTER_ID = 'theDoomOfArkhamPartI'
export const REFERENCE_CODE = '11682'
export const ENCOUNTER_CODE = 'the_doom_of_arkham_part_1'

// 剧情正文：优先 narrative-guides 生成的自译中文（story-text.js，按指南文件根路径取键），
// 缺译回退内嵌的英文印刷原文（story.js）。两章 definition 不各自拼正文。
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
export const ACT_CODES = Object.freeze(['11684'])
export const AGENDA_CODES = Object.freeze(['11683'])
export const ACT1_CODE = ACT_CODES[0]
export const AGENDA1_CODE = AGENDA_CODES[0]
export const RESOLUTION_KEYS = Object.freeze(['noResolution', 'resolution1', 'resolution2', 'resolution3'])
// 幕 1 背面：控制 ≥5 张[[神器]]支援 → 结局 1，否则每名调查员 +1 额外经验并 → 结局 2。
export const RESOLUTION_ARTIFACT_COUNT = 5

// ---------------------------------------------------------------------------
// 单卡（本章专属 6 张）
// ---------------------------------------------------------------------------
export const PHANTOM_SHOP_ACT_CODE = '11684'
export const TILLINGHAST_ESOTERICA_CODE = '11685'
export const RANDALL_TILLINGHAST_CODE = '11686'
export const LEGRASSE_CODE = '11687'
export const HORROR_IN_CLAY_CODE = '11688'
export const IMPLEMENTED_ENTRY_CODES = Object.freeze([
  '11683', '11684', '11685', '11686', '11687', '11688',
])

// 午夜假面外部队列（gather Set.TheMidnightMasks）：地点 01124–01134、诡计 01135/01136。
// 本关只取地点 + 诡计；幕/议程不取。
export const MIDNIGHT_MASKS_LOCATION_CODES = Object.freeze([
  '01124', '01125', '01126', '01127', '01128', '01129', '01130', '01131', '01132', '01133', '01134',
])
export const MIDNIGHT_MASKS_TREACHERY_CODES = Object.freeze(['01135', '01136'])

// ---------------------------------------------------------------------------
// 地点
// ---------------------------------------------------------------------------
// 网格（Haskell 布局）：午夜假面 3×4 图 + 每处藏牌地点旁的幽灵商店空位。
//   row0:  .            esotericaNorthside  esotericaDowntown   esotericaEasttown
//   row1:  .            northside           downtown            easttown
//   row2:  esotericaMU  miskatonicUniversity rivertown          .
//   row3:  esotericaSM  stMarysHospital     southside           esotericaSouthside
// 商店是单面地点，同一时间只有一张：入口在其被抽出的地点旁；本模块用动态连接表达
// （definition.connections 为空，behavior.drawBeneath 抽到商店时把 host ↔ 商店相连）。
export const START_LOCATION = 'rivertown'
export const HIDING_LOCATION_IDS = Object.freeze([
  'northside', 'downtown', 'easttown', 'miskatonicUniversity', 'stMarysHospital', 'southside',
])
// 商业区/南区各有两个印刷版本：Setup 随机选一个，未选中的版本从游戏中移除。
// 地点 id 固定为 downtown/southside，运行期 code 换成选中的印刷卡号。
export const LOCATION_VARIANTS = Object.freeze({
  downtown: Object.freeze(['01130', '01131']),
  southside: Object.freeze(['01126', '01127']),
})
export const BASE_LOCATION_IDS = Object.freeze([
  'northside', 'downtown', 'easttown', 'miskatonicUniversity', 'rivertown', 'stMarysHospital', 'southside',
])
export const SET_ASIDE_LOCATION_IDS = Object.freeze(['graveyard', 'yourHouse'])

// 印刷连接（Midnight Masks 卡面符号表；见 card-helpers 的 printed 数据与参考 CardDefs）。
// 商业区/南区各有两个印刷版本，Setup 随机选一个；地点 id 固定为 downtown/southside，
// 运行期由 behavior 把 code 换成选中的版本（A/B 版本数值见 LOCATION_VARIANTS）。
const BASE_CONNECTIONS = Object.freeze({
  northside: Object.freeze(['downtown', 'miskatonicUniversity']),
  downtown: Object.freeze(['northside', 'easttown']),
  easttown: Object.freeze(['downtown', 'rivertown']),
  rivertown: Object.freeze(['easttown', 'miskatonicUniversity', 'southside']),
  miskatonicUniversity: Object.freeze(['northside', 'rivertown', 'stMarysHospital', 'southside']),
  stMarysHospital: Object.freeze(['miskatonicUniversity', 'southside']),
  southside: Object.freeze(['rivertown', 'miskatonicUniversity', 'stMarysHospital']),
})
export const LOCATION_CONNECTIONS = Object.freeze({
  ...BASE_CONNECTIONS,
  tillinghastEsoterica: Object.freeze([]),
  graveyard: Object.freeze([]),
  yourHouse: Object.freeze([]),
})
export const LOCATION_COORDINATES = Object.freeze({
  northside: { x: 1, y: 0 },
  downtown: { x: 2, y: 0 },
  easttown: { x: 3, y: 0 },
  miskatonicUniversity: { x: 1, y: 1 },
  rivertown: { x: 2, y: 1 },
  stMarysHospital: { x: 1, y: 2 },
  southside: { x: 2, y: 2 },
  tillinghastEsoterica: { x: 4, y: 1 },
  graveyard: { x: 3, y: 1 },
  yourHouse: { x: 3, y: 2 },
})

const LOCATION_DEFS = Object.freeze({
  northside: { code: '01134' },
  downtown: { code: '01130', variantCodes: ['01130', '01131'] },
  easttown: { code: '01132' },
  miskatonicUniversity: { code: '01129' },
  rivertown: { code: '01125' },
  stMarysHospital: { code: '01128' },
  southside: { code: '01126', variantCodes: ['01126', '01127'] },
  tillinghastEsoterica: { code: TILLINGHAST_ESOTERICA_CODE, singleSided: true },
  graveyard: { code: '01133' },
  yourHouse: { code: '01124' },
})
export const LOCATIONS = Object.fromEntries(
  Object.entries(LOCATION_DEFS).map(([id, def]) => [id, location({
    id, code: def.code,
    clues: Number(ALL_CARDS[def.code]?.clues) || 1,
    ...(ALL_CARDS[def.code]?.victory ? { hasVictory: true, victory: ALL_CARDS[def.code].victory } : {}),
    connections: [...LOCATION_CONNECTIONS[id]],
    ...(def.singleSided ? { singleSided: true } : {}),
  })]),
)

// 商店格（幽灵商店被抽到后放在 host 地点相邻的空格；引擎 mechanics.map.place 用）。
export const SHOP_LOCATION_ID = 'tillinghastEsoterica'
export const SET_ASIDE_LOCATIONS = Object.freeze([...SET_ASIDE_LOCATION_IDS])

// ---------------------------------------------------------------------------
// 遭遇牌库（gather 7 组：本章 + Deep Ones + Domination + Dreams + Star Spawn +
// Agents of Cthulhu + The Midnight Masks）
// ---------------------------------------------------------------------------
export const GATHER_GROUPS = Object.freeze([
  'theDoomOfArkhamPart1', 'deepOnes', 'domination', 'dreams', 'starSpawn', 'agentsOfCthulhu',
])
// 午夜假面的 5 张诡计（01135×3、01136×2）不进遭遇牌库：Setup 与商店一起洗到 6 处地点底下。
export const MIDNIGHT_MASKS_DECK_CODES = Object.freeze(
  MIDNIGHT_MASKS_TREACHERY_CODES.flatMap(code => Array(Math.max(1, Number(ALL_CARDS[code].quantity) || 1)).fill(code)),
)
// 星之眷族敌人：Setup 随机移除 2 张（简单难度 3 张）。
export const STAR_SPAWN_REMOVAL_CODES = Object.freeze(
  ['11725', '11726', '11727', '11728'],
)
export const STAR_SPAWN_REMOVAL_COUNT = 2
export const STAR_SPAWN_REMOVAL_COUNT_EASY = 3
export const ENCOUNTER_DECK = Object.freeze(encounterGroupDeck(GATHER_GROUPS, {
  exclude: [RANDALL_TILLINGHAST_CODE, ...MIDNIGHT_MASKS_DECK_CODES],
}))
export const ENCOUNTER_DECK_CODES = Object.freeze([...new Set(ENCOUNTER_DECK)])

// 放在一边：兰道尔·蒂林哈斯特（商店抽到时生成）、黏土恐怖（本关争夺目标）、
// 已获得的[[神器]]支援（campaign.records 里按战役记录动态读取，运行期在 behavior 处理）。
export const SET_ASIDE_CARDS = Object.freeze([RANDALL_TILLINGHAST_CODE, HORROR_IN_CLAY_CODE])

// ---------------------------------------------------------------------------
// 遭遇定义（数值/关键词取印刷数据）
// ---------------------------------------------------------------------------
const DEFINITION_EXTRA_CODES = [...SET_ASIDE_CARDS, ...MIDNIGHT_MASKS_DECK_CODES]
const DEFINITION_CODES = [...ENCOUNTER_DECK_CODES, ...DEFINITION_EXTRA_CODES]
const PATCHES = {
  // 11686：无情、反击；不能移动；商店下方每有 1 张牌 +1 战斗、+1[每调查员]生命。
  '11686': { immobile: true, relentless: true, retaliate: true, fightPerBeneath: 1 },
  // 11687/11688 是剧情资产，不参与遭遇牌库。
  '11687': { storyAlly: true, allySlotExempt: true },
  '11688': { artifact: true, runes: ['u', 'x', 'o', 'o', 'd', 'f', 'z'] },
  '01135': { midnightMasks: true },
  '01136': { midnightMasks: true },
}
const definitions = encounterDefinitions(DEFINITION_CODES, PATCHES)

// ---------------------------------------------------------------------------
// 幕 / 议程阶段（objective 由 behavior.checkObjectives / roundEnded 读）
// ---------------------------------------------------------------------------
export const ACT_STAGES = Object.freeze({
  1: Object.freeze({
    ...stage(PHANTOM_SHOP_ACT_CODE, { stage: 1 }),
    objective: Object.freeze({
      type: 'phantomShop', roundEnd: true,
      atLocation: SHOP_LOCATION_ID, artifacts: 1,
      instruction: '一轮结束时，如果蒂林哈斯特密所的调查员控制至少 1 张[[神器]]支援，调查员可以推进。',
    }),
    shopAction: true,
  }),
})
export const AGENDA_STAGES = Object.freeze({
  1: Object.freeze({
    ...stage(AGENDA1_CODE, { stage: 1, doom: ALL_CARDS[AGENDA1_CODE]?.doom ?? 14 }),
    resignAnywhere: true,
    floodOnDoom: 'lead',
  }),
})
export const ACTS = Object.freeze([structuredClone(ACT_STAGES[1])])
export const AGENDAS = Object.freeze([structuredClone(AGENDA_STAGES[1])])
export const STAGE_CARDS = Object.freeze({
  [AGENDA1_CODE]: structuredClone(AGENDA_STAGES[1]),
  [PHANTOM_SHOP_ACT_CODE]: structuredClone(ACT_STAGES[1]),
})

// ---------------------------------------------------------------------------
// 剧情正文 / 指南
// ---------------------------------------------------------------------------
const paragraphs = value => (Array.isArray(value?.paragraphs) ? value.paragraphs : [])
const blocks = value => (value ? [value.title, ...paragraphs(value)].filter(Boolean).join('\n\n') : '')
const joinBlocks = (...values) => values.map(blocks).filter(Boolean).join('\n\n')

export const SCENARIO_TEXT = Object.freeze({
  textLanguage: hasTranslatedStory ? 'zh' : 'en',
  textStatus: hasTranslatedStory
    ? '自译中文（narrative-guides story-text.js），缺译回退英文印刷原文'
    : STORY.textStatus,
  heading: storyText('intro.title', STORY.title),
  intro: storyText('intro.intro1', paragraphs(STORY.intro.intro1).join('\n\n')),
  introBranches: Object.freeze(Object.fromEntries(
    Object.entries(STORY.intro).filter(([key]) => key !== 'proceedToSetup')
      .map(([key, value]) => [key, storyText(`intro.${key}`, paragraphs(value).join('\n\n'))]),
  )),
  proceedToSetup: storyText('intro.proceedToSetup', paragraphs(STORY.intro.proceedToSetup).join('\n\n')),
  setup: Object.keys(STORY.setup)
    .map(key => storyText(`setup.${key}`, paragraphs(STORY.setup[key]).join('\n\n')))
    .filter(Boolean).join('\n\n'),
  setupSteps: Object.freeze(Object.keys(STORY.setup).map(key => ({
    key, text: storyText(`setup.${key}`, paragraphs(STORY.setup[key]).join('\n\n')),
  }))),
  specialRules: Object.freeze([]),
  rules: Object.freeze(Object.fromEntries(Object.entries(STORY.rules).map(([key, value]) => {
    const body = storyText(`rules.${key}.body`, paragraphs(value).join('\n\n'))
    return [key, { title: storyText(`rules.${key}.title`, value.title), paragraphs: body.split(/\n{2,}/).filter(Boolean) }]
  }))),
  tooltips: STORY.tooltips,
  labels: STORY.labels,
  tokens: Object.freeze({
    easy: Object.freeze({ ...DOOM_OF_ARKHAM_PART_I_TOKEN_MEANINGS.easy }),
    standard: Object.freeze({ ...DOOM_OF_ARKHAM_PART_I_TOKEN_MEANINGS.standard }),
    hard: Object.freeze({ ...DOOM_OF_ARKHAM_PART_I_TOKEN_MEANINGS.hard }),
    expert: Object.freeze({ ...DOOM_OF_ARKHAM_PART_I_TOKEN_MEANINGS.expert }),
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
  name: '阿卡姆的毁灭 · 第一部分',
  nameEn: 'The Doom of Arkham Part I',
  encounterCode: ENCOUNTER_CODE,
  intro: SCENARIO_TEXT.intro,
  introBranches: SCENARIO_TEXT.introBranches,
  setup: SCENARIO_TEXT.setup,
  setupSteps: SCENARIO_TEXT.setupSteps,
  specialRules: SCENARIO_TEXT.specialRules,
  rules: SCENARIO_TEXT.rules,
  tokens: SCENARIO_TEXT.tokens,
  startLocation: START_LOCATION,
  locations: LOCATIONS,
  // 议程 1 正面印刷 [action]：撤退（引擎读 scenario.resignAnywhere）。
  resignAnywhere: true,
  // 起始地点正面入场；商店在 Revelation 时以未揭示面入场。
  locationsStartRevealed: true,
  setAsideLocations: [...SET_ASIDE_LOCATION_IDS],
  setAsideAliases: [...SET_ASIDE_CARDS],
  midnightMasksDeckCodes: [...MIDNIGHT_MASKS_DECK_CODES],
  hidingLocationIds: [...HIDING_LOCATION_IDS],
  locationVariants: LOCATION_VARIANTS,
  acts: ACTS,
  agendas: AGENDAS,
  stageCards: STAGE_CARDS,
  ...definitions,
  encounterDeck: [...ENCOUNTER_DECK],
  resolutions: { ...SCENARIO_TEXT.resolutions },
  tokenMeanings: SCENARIO_TEXT.tokens,
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
  ...MIDNIGHT_MASKS_DECK_CODES,
].map(code => [code, ALL_CARDS[code]])))

export { printed, flagsOf }
