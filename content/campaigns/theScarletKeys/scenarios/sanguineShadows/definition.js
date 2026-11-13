// 血色阴影（Sanguine Shadows · 09545）· 剧本数据（scenario 对象只含数据，不含函数）。
//
// 参考：参考实现 `Scenarios/TheScarletKeys/SanguineShadows.hs`（PreScenarioSetup 三选项、
// Setup 的八个地点/六个标的/隐匿迷你卡、四档混乱标记、五个结局）、
// `Act/Cards/.../TheScarletShadow.hs`（幕 1 目标＝与红衣女郎交战）、
// `Act/Cards/.../InTheSearchlight.hs`（幕 2 谈判 6 与「云开见日」幕间）、
// `Agenda/Cards/.../WhereIsShe.hs`（红衣女郎收集标的 / 重洗隐匿 / 重置双牌库）、
// `Agenda/Cards/.../SeeingRed.hs`（见红＝既是幕也是议程）、
// locale `scenarios/sanguineShadows.json`（setup/resolutions），卡面事实源 `src/cards/cards-data.js`。
//
// 八个地点＝09549–09556；09549 五月大道是中心（[[中心]]），其余七张随机移除一张后环形围绕入场。
// 地点连接由卡面连接符号决定（见 LOCATION_SYMBOLS）：中心带全部四种符号，两两同符号的地点互连。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { encounterDefinitions, encounterGroupDeck, identitiesFor, location, stage } from '../../card-data.js'
import { chapterSection, flattenResolution, flattenStory } from '../../story-access.js'
import { SANGUINE_SHADOWS_TOKEN_MEANINGS } from './chaos.js'

export const CHAPTER_ID = 'sanguineShadows'
export const REFERENCE_CODE = '09545'

export const RAW_CODES = Object.freeze({
  scenario: '09545', agenda1: '09546', act1: '09547', act2: '09548',
  avenidaDeMayo: '09549', casaRosada: '09550', catedralMetropolitana: '09551', recoleta: '09552',
  palacioErrazuriz: '09553', theCabildo: '09554', bancoDeLaProvincia: '09555', teatroColon: '09556',
  laChicaRoja: '09557', laChicaRojaAlly: '09557b', boundNightgaunt: '09558', catAndMouse: '09559',
  callingCard: '09560', outsmarted: '09561', seeingRed: '09562', sanguineWatcher: '09563',
  apportionedKa: '09564', weepingLadyStable: '09565a', weepingLadyUnstable: '09565b',
})

// 遭遇组：专属组 + 六个共享组（共享组由战役层按 requiredEncounterGroupIds 并入，本章不重复声明卡表）。
export const GATHER_GROUPS = Object.freeze([
  'sanguineShadows', 'darkVeiling', 'mysteriesAbound', 'shadowOfADoubt',
  'strangeHappenings', 'lockedDoors', 'nightgaunts',
])
export const SHARED_GROUPS = Object.freeze(GATHER_GROUPS.slice(1))

// —— 地点 ——
// 中心：五月大道（[[布宜诺斯艾利斯]]、[[中心]]）；其余七张随机移除一张后，六张环形围绕中心入场。
export const AVENIDA_DE_MAYO = 'avenidaDeMayo'
export const START_LOCATION = AVENIDA_DE_MAYO
export const CANDIDATE_LOCATION_IDS = Object.freeze([
  'casaRosada', 'catedralMetropolitana', 'recoleta', 'palacioErrazuriz',
  'theCabildo', 'bancoDeLaProvincia', 'teatroColon',
])
export const LOCATION_IDS = Object.freeze([AVENIDA_DE_MAYO, ...CANDIDATE_LOCATION_IDS])

// 卡面连接符号（参考实现 Location/CardDefs：连接符号 = 对侧地点的符号）。
// 中心带 moon/t/square/circle 四种符号；七个目标各带其中一种，因此同符号的两张互相连接。
export const LOCATION_SYMBOLS = Object.freeze({
  avenidaDeMayo: Object.freeze({ own: 'equals', connects: Object.freeze(['moon', 't', 'square', 'circle']) }),
  casaRosada: Object.freeze({ own: 'moon', connects: Object.freeze(['equals', 'moon']) }),
  catedralMetropolitana: Object.freeze({ own: 'moon', connects: Object.freeze(['equals', 'moon']) }),
  recoleta: Object.freeze({ own: 't', connects: Object.freeze(['equals', 't']) }),
  palacioErrazuriz: Object.freeze({ own: 't', connects: Object.freeze(['equals', 't']) }),
  theCabildo: Object.freeze({ own: 'square', connects: Object.freeze(['equals', 'square']) }),
  bancoDeLaProvincia: Object.freeze({ own: 'square', connects: Object.freeze(['equals', 'square']) }),
  teatroColon: Object.freeze({ own: 'circle', connects: Object.freeze(['equals']) }),
})

// 五月大道的帷幕按难度取固定值（卡面 -2 = 「简单 2 / 普通 3 / 困难 4 / 专家 5」）。
export const AVENIDA_SHROUD_BY_DIFFICULTY = Object.freeze({ easy: 2, standard: 3, hard: 4, expert: 5 })

// 同上：candidate 地点的印刷线索值。cluesFixed=true 用印刷固定值，否则印刷值 × 调查员人数。
const LOCATION_SPECS = Object.freeze([
  ['avenidaDeMayo', RAW_CODES.avenidaDeMayo, { clues: 1, cluesFixed: false }],
  ['casaRosada', RAW_CODES.casaRosada, { clues: 2, cluesFixed: true }],
  ['catedralMetropolitana', RAW_CODES.catedralMetropolitana, { clues: 1, cluesFixed: true }],
  ['recoleta', RAW_CODES.recoleta, { clues: 3, cluesFixed: true }],
  ['palacioErrazuriz', RAW_CODES.palacioErrazuriz, { clues: 1, cluesFixed: false }],
  ['theCabildo', RAW_CODES.theCabildo, { clues: 2, cluesFixed: true }],
  ['bancoDeLaProvincia', RAW_CODES.bancoDeLaProvincia, { clues: 1, cluesFixed: false }],
  ['teatroColon', RAW_CODES.teatroColon, { clues: 1, cluesFixed: false }],
])

/** 静态连接：中心 ↔ 其余七张；同符号的两两互连。运行时只保留实际入场的六张（见 behavior.setupLocations）。 */
export function staticConnections() {
  const out = {}
  for (const id of LOCATION_IDS) out[id] = []
  for (const target of CANDIDATE_LOCATION_IDS) {
    out[AVENIDA_DE_MAYO].push(target)
    out[target].push(AVENIDA_DE_MAYO)
  }
  const groups = new Map()
  for (const target of CANDIDATE_LOCATION_IDS) {
    const own = LOCATION_SYMBOLS[target].own
    groupedPush(groups, own, target)
  }
  for (const members of groups.values()) {
    if (members.length < 2) continue
    for (const from of members) for (const to of members) if (from !== to) out[from].push(to)
  }
  return out
}
function groupedPush(map, key, value) {
  if (!map.has(key)) map.set(key, [])
  map.get(key).push(value)
}

const staticEdges = staticConnections()
const locationData = ([id, code, spec]) => location({
  id, code, cluesFixed: spec.cluesFixed, clues: spec.clues,
  connections: [...staticEdges[id]],
})
export const LOCATIONS = Object.freeze(Object.fromEntries(
  LOCATION_SPECS.map(spec => [spec[0], Object.freeze(locationData(spec))])))

// 每个地点的线索值（固定值或印刷值 × 人数；参考卡面 clues / cluesFixed）。
export function clueValueOf(state, locationId) {
  const definition = LOCATIONS[locationId]
  if (!definition) return 0
  const count = Number(state?.numInvestigators) || (state?.investigators || []).length || 1
  if (definition.cluesFixed != null && definition.cluesFixed !== false) return Number(definition.cluesFixed) || 0
  return (Number(definition.cluesPerInvestigator ?? definition.clues) || 0) * count
}

// —— 遭遇牌：本章专属组的敌人/诡计（09557/09557b/09563/09564 是剧情/放置一旁卡，不进遭遇牌库） ——
export const ENEMY_CODES = Object.freeze([RAW_CODES.laChicaRoja, RAW_CODES.boundNightgaunt,
  RAW_CODES.sanguineWatcher, RAW_CODES.apportionedKa])
export const TREACHERY_CODES = Object.freeze([RAW_CODES.catAndMouse, RAW_CODES.callingCard, RAW_CODES.outsmarted])
export const STORY_ASSET_CODES = Object.freeze([RAW_CODES.laChicaRojaAlly])
export const KEY_CODES = Object.freeze([RAW_CODES.weepingLadyStable, RAW_CODES.weepingLadyUnstable])

// 隐匿 X：卡面 `Concealed X`（红衣女郎 5＝5 张诱饵 + 真身；分裂精魂 4）。
export const CONCEALED_AMOUNTS = Object.freeze({
  [RAW_CODES.laChicaRoja]: 5,
  [RAW_CODES.apportionedKa]: 4,
})
export const DECOY_KIND = 'Decoy'

// 放一边（不在场）：血色监视者、分裂精魂、见红（幕/议程）、恸哭女士（绯红密钥）。
export const SET_ASIDE_CODES = Object.freeze([RAW_CODES.sanguineWatcher, RAW_CODES.apportionedKa,
  RAW_CODES.seeingRed, RAW_CODES.weepingLadyStable])
// 开局就在场（不计入遭遇牌库）：红衣女郎以隐匿形式入场（真身迷你卡 + 5 张诱饵）。
export const IN_PLAY_CODES = Object.freeze([RAW_CODES.laChicaRoja])

// 2026-11-13 P0：遭遇牌库=专属组 + 六个共享组，按印刷份数展开。
// 旧实现只放本章 8 张（注释称「共享组由战役层按 requiredEncounterGroupIds 并入」，但引擎
// setupScenarioDecks 只读 scenario.encounterDeck → 共享组从未并入，真实牌库只有 8/30）。
export const ENCOUNTER_DECK = Object.freeze(encounterGroupDeck(GATHER_GROUPS, {
  exclude: [...SET_ASIDE_CODES, ...IN_PLAY_CODES],
}))
export const ENCOUNTER_DECK_CODES = Object.freeze([...new Set(ENCOUNTER_DECK)])

const printed = encounterDefinitions([...new Set([
  ...ENEMY_CODES, ...TREACHERY_CODES, ...STORY_ASSET_CODES, ...ENCOUNTER_DECK_CODES,
])])
const enemyDefinition = code => ({
  ...printed.enemies[code],
  code, originalCode: code,
  ...(CONCEALED_AMOUNTS[code] != null ? { concealed: CONCEALED_AMOUNTS[code] } : {}),
  traits: [...(ALL_CARDS[code].traits || [])],
})
const treacheryDefinition = code => ({
  ...printed.treacheries[code],
  code, originalCode: code,
  // 引擎 `treachery-tokens.js#resolveTreacheryBody` 只对 `effect.kind === 'campaignRule'`
  // （或 entry.encounterResolve / treacheryRule.test）走内容结算；本章三张专属诡计由
  // behavior.resolveEncounter 分派，因此必须声明 campaignRule。
  effect: { kind: 'campaignRule' },
})
// 共享组卡（黑暗笼罩/处处神秘/重重疑云/奇异现象/上锁的门/夜魔）也要进 scenario.enemies/treacheries：
// 生产组合根按章 Object.assign 到全局遭遇表，漏掉就会在真实抽取时「未知遭遇卡」。
const OWN_ENEMY_CODES = new Set(ENEMY_CODES)
const sharedEnemies = Object.fromEntries(Object.entries(printed.enemies)
  .filter(([code]) => !OWN_ENEMY_CODES.has(code))
  .map(([code, definition]) => [code, Object.freeze({ ...definition, code, originalCode: code })]))
const sharedTreacheries = Object.fromEntries(Object.entries(printed.treacheries)
  .filter(([code]) => !TREACHERY_CODES.includes(code))
  .map(([code, definition]) => [code, Object.freeze({ ...definition, code, originalCode: code })]))
export const enemies = Object.freeze({
  ...sharedEnemies,
  ...Object.fromEntries(ENEMY_CODES.map(code => [code, enemyDefinition(code)])),
})
export const treacheries = Object.freeze({
  ...sharedTreacheries,
  ...Object.fromEntries(TREACHERY_CODES.map(code => [code, treacheryDefinition(code)])),
})
export const storyAssets = Object.freeze(Object.fromEntries(STORY_ASSET_CODES.map(code => [code,
  { ...printed.storyAssets[code], code, originalCode: code }])))

// 遭遇牌库张数见上方 ENCOUNTER_DECK（专属组 8 + 六个共享组 22 = 印刷 30）。

// —— 幕 / 议程 ——
const actDefinition = (code, number, extra = {}) => {
  const card = ALL_CARDS[code]
  return {
    ...stage(code, { number }), id: `act${number}`, originalCode: code,
    name: card.nameZh || card.name, nameEn: card.name,
    text: card.textZh || card.text || '', backText: card.backTextZh || card.backText || '',
    chapterFlow: CHAPTER_ID, ...extra,
  }
}
const agendaDefinition = (code, number, extra = {}) => {
  const card = ALL_CARDS[code]
  return {
    ...stage(code, { number, doom: card.doom }), id: `agenda${number}`, originalCode: code,
    name: card.nameZh || card.name, nameEn: card.name,
    text: card.textZh || card.text || '', backText: card.backTextZh || card.backText || '',
    chapterFlow: CHAPTER_ID, ...extra,
  }
}
// 幕 1：目标「揭露窃贼所在。如果调查员与红衣女郎交战，推进。」（由 behavior.checkObjectives 判定）
export const ACT1 = Object.freeze(actDefinition(RAW_CODES.act1, 1, { objective: { type: 'campaignRule' } }))
// 幕 2：目标「红衣女郎将要被击败时改为推进 / 谈判成功后推进」。
export const ACT2 = Object.freeze(actDefinition(RAW_CODES.act2, 2, { objective: { type: 'campaignRule' } }))
// 密谋 1：毁灭阈值 7；背面「红衣女郎收集一个标的」。
export const AGENDA1 = Object.freeze(agendaDefinition(RAW_CODES.agenda1, 1))
// 见红：既是当前幕也是当前密谋（毁灭阈值 11）。
export const SEEING_RED_ACT = Object.freeze({
  ...actDefinition(RAW_CODES.seeingRed, 1, { objective: { type: 'campaignRule' } }), id: 'seeingRedAct',
})
export const SEEING_RED_AGENDA = Object.freeze(agendaDefinition(RAW_CODES.seeingRed, 1, { id: 'seeingRedAgenda' }))

export const acts = Object.freeze([ACT1, ACT2])
export const agendas = Object.freeze([AGENDA1])

// —— 结局 ——
const resolutionSection = key => chapterSection(CHAPTER_ID, `resolutions.${key}`, null)
const resolutionOf = key => {
  const section = resolutionSection(key)
  const text = section == null ? '' : flattenResolution(section)
  return text || key
}
export const resolutions = Object.freeze({
  noResolution: resolutionOf('noResolution'),
  noResolutionSeeingRed: resolutionOf('noResolutionSeeingRed'),
  resolution1: resolutionOf('resolution1'),
  resolution2: resolutionOf('resolution2'),
  resolution3: resolutionOf('resolution3'),
})

// —— 正文：intro / setup / specialRules ——
const introSection = chapterSection(CHAPTER_ID, 'intro', {}) || {}
const setupSection = chapterSection(CHAPTER_ID, 'setup', {}) || {}
const tokenMeanings = SANGUINE_SHADOWS_TOKEN_MEANINGS
const specialRulesText = [
  '【特别规则：标的（target）】标的用放在地点上的资源表示。冒险参考卡（09545）上的标的数量决定 [skull] 的负修正。',
  '【特别规则：隐匿（Concealed X）】敌人进入阴影时拿取 X 张诱饵迷你卡与它的真身迷你卡，正面朝下混洗后尽可能平均地分配到指定地点；'
    + '在有迷你卡的地点可以揭露（Expose）1 张。揭露诱饵时翻面移除；揭露真身时把对应敌人放到该地点。',
  `【特别规则：混乱标记】${Object.entries(tokenMeanings.standard).map(([token, entry]) => `[${token}] ${entry.text}`).join('；')}`,
].join('\n\n')

export const SCENARIO_TEXT = Object.freeze({
  textLanguage: 'zh-CN',
  textStatus: 'translated (self-translated)',
  introTitle: introSection.title || '档案#16-D: 血色阴影',
  intro: flattenStory(introSection.intro1 || ''),
  introChoices: Object.freeze([
    { id: 'everything', label: introSection.label?.everything || '把你知道的一切都告诉玻利瓦尔。' },
    { id: 'breadcrumbs', label: introSection.label?.breadcrumbs || '告诉玻利瓦尔一点边角料。' },
    { id: 'insist', label: introSection.label?.insist || '坚持玻利瓦尔先把他的知道的告诉你。' },
  ]),
  setup: flattenStory(setupSection),
  specialRules: specialRulesText,
})

export const scenario = Object.freeze({
  id: CHAPTER_ID,
  originalCode: REFERENCE_CODE,
  name: ALL_CARDS[REFERENCE_CODE].nameZh || ALL_CARDS[REFERENCE_CODE].name,
  nameEn: ALL_CARDS[REFERENCE_CODE].name,
  referenceCode: REFERENCE_CODE,
  migrationStatus: 'development',
  startLocation: START_LOCATION,
  locations: LOCATIONS,
  setAsideLocations: [],
  enemies, treacheries, storyAssets,
  acts, agendas, resolutions,
  encounterDeck: ENCOUNTER_DECK,
  tokenMeanings,
  ...SCENARIO_TEXT,
})

export const identities = Object.freeze(identitiesFor(scenario))

// 需要单卡条目的卡号（敌人/诡计/剧情资产/密钥）；地点/幕/议程/参考卡不建条目。
export const CHAPTER_ENTRY_CODES = Object.freeze([
  ...ENEMY_CODES, ...TREACHERY_CODES, ...STORY_ASSET_CODES, ...KEY_CODES,
])
export const RECORD_READS = Object.freeze([
  'matiasBolivarTrustsYou', 'matiasBolivarDoesntTrustYou', 'time',
])
export const RECORD_WRITES = Object.freeze([
  'matiasBolivarTrustsYou', 'matiasBolivarDoesntTrustYou', 'time',
  'youHaventSeenTheLastOfLaChicaRoja', 'youHaventSeenTheLastOfTheSanguineWatcher',
  'laChicaRojaIsOnYourSide', 'theSanguineWatchersTormentContinues',
])
// 绯红密钥「恸哭女士」（09565a/b）：稳定面/动荡面 + 归属对手（红衣女郎或血色监视者）。
export const WEEPING_LADY_KEY = Object.freeze({
  id: RAW_CODES.weepingLadyStable,
  stableFace: RAW_CODES.weepingLadyStable,
  unstableFace: RAW_CODES.weepingLadyUnstable,
  name: ALL_CARDS[RAW_CODES.weepingLadyStable].nameZh || ALL_CARDS[RAW_CODES.weepingLadyStable].name,
})
