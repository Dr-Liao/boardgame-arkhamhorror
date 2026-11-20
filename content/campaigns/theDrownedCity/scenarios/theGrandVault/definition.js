// 大秘库（theGrandVault · 提示卡 11587）· 章节数据（scenario 只含数据）。
//
// 权威来源（只读参考资源）：
//   Scenario/Scenarios/TheDrownedCity/TheGrandVault.hs +
//   Scenarios/TheDrownedCity/TheGrandVault/Helpers.hs（网格坐标 / 已激活判定 / 幻灯片）+
//   Act|Agenda|Location|Enemy|Treachery/CardDefs/TheDrownedCity/TheGrandVault.hs +
//   Location|Enemy|Treachery/Cards/TheDrownedCity/TheGrandVault/*.hs +
//   frontend/src/locales/en/theDrownedCity/theGrandVault.json（印刷正文，已固化在 text.js）+
//   src/cards/cards-data.js（简中卡名/卡文/数值）。
//
// 本关口径：
//   1. 网格（3 列 × 3 行）：大阶梯 (-2,0)、移动平台 (-1,0)、秘库核心 (0,0)、碑匾腔室 (2,0) 固定；
//      7 个秘库腔室洗牌后放进 (-1,1)/(0,1)/(1,1)/(1,0)/(-1,-1)/(0,-1)/(1,-1)。卡面只印
//      「经连接图标/移动平台相连」，卡表没有连接图标数据，因此用正交网格相邻作为近似，
//      并在 behavior 里把移动平台/碑匾腔室的印刷连接并入同一份网格邻接。
//   2. 随机秘库房间：8 张候选（隐蔽蓄水池 ×2、档案室 ×2、异界机械 ×4）中随机移出 1 张异界机械，
//      其余 7 张洗牌按槽位入场（未揭示，背面 = 「秘库腔室 / Vault Chamber」）。
//   3. 「已激活」= 地点上有 1 个资源标记；Haskell 以 LocationWithResources 判定。本 Mod 用
//      scenarioFlags.grandVaultActivated（地点 id 数组）作为同一份账本，由 behavior 统一读写。
//   4. 供能分支：thePowerWasDiverted 时只激活左下腔室，否则激活左下/右下/右上三处。
//   5. 内殿解封：秘库核心的幕间故事「按下按钮」写 theInnerSanctumWasUnsealed（后续章节读）。
//   6. Tidal Tablet（11611）与 Good Money：结局里若仍被调查员控制则写 tidalTablet；
//      Good Money 任务分支用 P7 startingAdjustments.defer 给下一章资源（另一支无引擎读点，见报告）。
//
// 中文叙事：本地无官方中文源，text.js 固化英文权威正文；中文翻译由 narrative-guides worker 的
// story-text.js 提供。本文件的 SCENARIO_TEXT 只承载模块自用的印刷文本（离线测试/指南兜底）。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { bindScenarioIdentities } from '../../../../identities.js'
import { TEXT } from './text.js'
import { GRAND_VAULT_TOKEN_MEANINGS } from './chaos.js'

export const CHAPTER_ID = 'theGrandVault'
export const REFERENCE_CODE = '11587'
export const ENCOUNTER_CODE = 'the_grand_vault'
export const CAMPAIGN_ID = 'theDrownedCity'

// ---------------------------------------------------------------------------
// 印刷数据读取（唯一事实源 = src/cards/cards-data.js）
// ---------------------------------------------------------------------------
export function printed(code) {
  const card = ALL_CARDS[code]
  if (!card) throw new RangeError(`Unknown The Grand Vault card: ${code}`)
  return {
    code, originalCode: code,
    name: card.nameZh || card.name, nameEn: card.name,
    subname: card.subnameZh || card.subname || '',
    text: card.textZh || card.text || '', textEn: card.text || '',
    type: card.type, traits: [...(card.traits || [])],
    ...(card.backText || card.backTextZh ? { backText: card.backTextZh || card.backText } : {}),
  }
}

function location(data) {
  const { id, code, clues, hasVictory, victory, connections = [], ...rest } = data
  const card = ALL_CARDS[code]
  if (!card) throw new RangeError(`Unknown The Grand Vault location: ${code}`)
  return {
    ...printed(code), id, shroud: card.shroud, connections: [...connections], ...rest,
    cluesPerInvestigator: clues ?? card.clues ?? 0,
    ...(hasVictory ? { victory: victory ?? card.victory ?? 1 } : {}),
  }
}

function stage(code, extra = {}) {
  const card = ALL_CARDS[code]
  if (!card) throw new RangeError(`Unknown The Grand Vault stage: ${code}`)
  const { doom, stage: number, ...rest } = extra
  return {
    ...printed(code), id: `${card.type}${code}`, type: card.type, stage: `${number ?? card.stage ?? 1}a`,
    reveal: { type: 'campaignRule' }, ...rest,
    ...(card.type === 'agenda' ? { doomThreshold: doom ?? card.doom } : {}),
  }
}

export function encounterDefinitions(codes) {
  const enemies = {}, treacheries = {}, storyAssets = {}
  for (const code of new Set(codes)) {
    const card = ALL_CARDS[code]
    if (!card) throw new RangeError(`Unknown The Grand Vault encounter card: ${code}`)
    const base = printed(code)
    if (card.type === 'enemy') {
      enemies[code] = {
        ...base, fight: card.fight ?? null, evade: card.evade ?? null, health: card.health ?? null,
        damage: card.damage || 0, horror: card.horror || 0,
        ...(Object.hasOwn(card, 'victory') ? { victory: card.victory } : {}),
        elite: (card.traits || []).includes('Elite'),
        hunter: /Hunter\./.test(card.text || ''), aloof: /Aloof\./.test(card.text || ''),
        massive: /Massive\./.test(card.text || ''), retaliate: /Retaliate\./.test(card.text || ''),
      }
      if (/Prey - Most clues/i.test(card.text || '')) enemies[code].prey = 'mostClues'
    } else if (card.type === 'treachery') {
      treacheries[code] = { ...base, entryRevelation: true, surge: /^Surge\./m.test(card.text || '') }
    } else if (card.type === 'story' || card.type === 'asset') {
      storyAssets[code] = { ...base, ...(card.type === 'asset' ? { global: true } : {}) }
    }
  }
  return { enemies, treacheries, storyAssets }
}

function identitiesFor(scenario) {
  const identity = value => {
    const code = value.originalCode || value.code
    const linked = ALL_CARDS[code]?.linkedCardCode || ALL_CARDS[code]?.linkedToCode || null
    return { originalCode: code, artCode: code, ...(linked ? { linkedOriginalCode: linked } : {}) }
  }
  return Object.fromEntries(['locations', 'enemies', 'treacheries', 'storyAssets', 'acts', 'agendas'].map(category => [category,
    Object.fromEntries(Object.values(scenario[category] || {}).map(value => [value.id || value.code, identity(value)]))]))
}

// ---------------------------------------------------------------------------
// 幕 / 议程 / 结局
// ---------------------------------------------------------------------------
export const ACT_CODES = Object.freeze(['11591', '11592'])
export const AGENDA_CODES = Object.freeze(['11588', '11589', '11590'])
export const ACT1_CODE = ACT_CODES[0]
export const ACT2_CODE = ACT_CODES[1]
export const AGENDA1_CODE = AGENDA_CODES[0]
export const AGENDA2_CODE = AGENDA_CODES[1]
export const AGENDA3_CODE = AGENDA_CODES[2]
export const RESOLUTION_KEYS = Object.freeze(['noResolution', 'resolution1', 'resolution2'])

// ---------------------------------------------------------------------------
// 敌人 / 诡计 / 剧情资产
// ---------------------------------------------------------------------------
export const SLITHERER_CODE = '11605'
export const VAULT_ATTENDANT_CODE = '11606'
export const DEADLY_MECHANISMS_CODE = '11607'
export const ANCIENT_VAULT_CODES = Object.freeze(['11608', '11609', '11610'])
export const ANCIENT_VAULT_BACK_CODES = Object.freeze(['11608b', '11609b', '11610b'])
export const TIDAL_TABLET_CODE = '11611'

// 符文（Glyph）记录：翻译后写入 campaign.records.discoveredGlyphs（string[]，§4 规范键）。
export const GLYPH_RECORDS = Object.freeze({
  '11598': { rune: 'rune_l', word: 'Arm', wordZh: '手臂' },
  '11599': { rune: 'rune_m', word: 'Earth', wordZh: '大地' },
  '11608': { rune: 'rune_o', word: 'Power', wordZh: '力量' },
  '11609': { rune: 'rune_n', word: 'Destruction', wordZh: '毁灭' },
  '11610': { rune: 'rune_p', word: 'Weather', wordZh: '天气' },
})
export const GLYPH_RUNE_ORDER = Object.freeze(['rune_l', 'rune_m', 'rune_n', 'rune_o', 'rune_p'])
export const GLYPH_TRANSLATION_TARGET = 3

export const SET_ASIDE_ENEMY_CODES = Object.freeze([VAULT_ATTENDANT_CODE])
export const TREACHERY_CODES = Object.freeze([DEADLY_MECHANISMS_CODE, ...ANCIENT_VAULT_CODES])
export const ENEMY_CODES = Object.freeze([SLITHERER_CODE, VAULT_ATTENDANT_CODE])
export const STORY_ASSET_CODES = Object.freeze([TIDAL_TABLET_CODE, ...ANCIENT_VAULT_BACK_CODES])

// ---------------------------------------------------------------------------
// gather 组（Setup：The Grand Vault / Alien Machinery / Flood / The Inescapable / R'lyeh / Star Spawn）
// ---------------------------------------------------------------------------
export const GATHER_GROUPS = Object.freeze([
  'theGrandVault', 'alienMachinery', 'tdcFlood', 'theInescapable', 'rlyeh', 'starSpawn',
])
const snake = value => String(value).replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase()
const cardGroups = new Set(GATHER_GROUPS.map(snake))
const deckCardTypes = ['enemy', 'treachery']
const expand = rows => rows
  .sort(([a], [b]) => a.localeCompare(b))
  .flatMap(([code, card]) => Array(Math.max(1, Number(card.quantity) || 1)).fill(code))
const cardsOfGroups = groups => Object.entries(ALL_CARDS)
  .filter(([, card]) => new Set(groups.map(snake)).has(card.encounterCode))

// 放一边（Setup #7 + Star Spawn 处理 + Inescapable 组）：
//   Ancient Vault 双面诡计 ×3、Vault Attendant ×3、Tidal Tablet、The Inescapable 组、Star Spawn 4 名敌人
//   （其中 2 名在 Setup 随机移出游戏，其余放一边；见 behavior.prepareScenario）。
export const STAR_SPAWN_ENEMY_CODES = Object.freeze(['11725', '11726', '11727', '11728'])
export const INESCAPABLE_SET_CODES = Object.freeze(['11744', '11745'])
export const SET_ASIDE_ALIASES = Object.freeze([
  ...ANCIENT_VAULT_CODES,
  VAULT_ATTENDANT_CODE, VAULT_ATTENDANT_CODE, VAULT_ATTENDANT_CODE,
  TIDAL_TABLET_CODE,
  ...INESCAPABLE_SET_CODES, '11745', '11745',
  ...STAR_SPAWN_ENEMY_CODES,
])
export const SET_ASIDE_DECK_CODES = Object.freeze([
  ...ANCIENT_VAULT_CODES, VAULT_ATTENDANT_CODE, ...INESCAPABLE_SET_CODES, ...STAR_SPAWN_ENEMY_CODES,
])
export const STAR_SPAWN_REMOVED_COUNT = 2

export const ENCOUNTER_DECK = Object.freeze(expand(cardsOfGroups(GATHER_GROUPS)
  .filter(([, card]) => deckCardTypes.includes(card.type))
  .filter(([code]) => !SET_ASIDE_DECK_CODES.includes(code))))
export const ENCOUNTER_DECK_CODES = Object.freeze([...new Set(ENCOUNTER_DECK)])

// ---------------------------------------------------------------------------
// 地点（12 个规则地点：4 固定 + 8 候选秘库房间，其中 1 张异界机械在 Setup 被移出游戏）
// ---------------------------------------------------------------------------
export const START_LOCATION = 'theGreatStair'
export const FIXED_LOCATION_IDS = Object.freeze([
  'theGreatStair', 'movingPlatform', 'coreOfTheVault', 'chamberOfTheTablet',
])
export const SHROUDED_CISTERN_A = 'shroudedCisternA'
export const SHROUDED_CISTERN_B = 'shroudedCisternB'
export const CHAMBER_OF_RECORDS_ARM = 'chamberOfRecordsArm'
export const CHAMBER_OF_RECORDS_EARTH = 'chamberOfRecordsEarth'
export const MECHANISM_IDS = Object.freeze([
  'otherworldlyMechanismsObsidian', 'otherworldlyMechanismsSluice',
  'otherworldlyMechanismsGears', 'otherworldlyMechanismsApparatus',
])
export const VAULT_POOL_IDS = Object.freeze([
  SHROUDED_CISTERN_A, SHROUDED_CISTERN_B, CHAMBER_OF_RECORDS_ARM, CHAMBER_OF_RECORDS_EARTH, ...MECHANISM_IDS,
])
// 7 个秘库腔室槽位（Haskell vaultChamberPositions：左→右、上→下）。
export const VAULT_SLOT_CELLS = Object.freeze([
  Object.freeze({ x: -1, y: 1 }), Object.freeze({ x: 0, y: 1 }), Object.freeze({ x: 1, y: 1 }),
  Object.freeze({ x: 1, y: 0 }), Object.freeze({ x: -1, y: -1 }), Object.freeze({ x: 0, y: -1 }),
  Object.freeze({ x: 1, y: -1 }),
])
export const VAULT_BOTTOM_ROW_CELLS = Object.freeze([
  Object.freeze({ x: -1, y: -1 }), Object.freeze({ x: 0, y: -1 }), Object.freeze({ x: 1, y: -1 }),
])
// 供能分支：默认预激活 = 左下/右下/右上；thePowerWasDiverted = 只有左下。
export const VAULT_PREACTIVATED_CELLS = Object.freeze([
  Object.freeze({ x: -1, y: -1 }), Object.freeze({ x: 1, y: -1 }), Object.freeze({ x: 1, y: 1 }),
])
export const VAULT_BOTTOM_LEFT_CELL = Object.freeze({ x: -1, y: -1 })

export const LOCATION_CELLS = Object.freeze({
  theGreatStair: Object.freeze({ x: -2, y: 0 }),
  movingPlatform: Object.freeze({ x: -1, y: 0 }),
  coreOfTheVault: Object.freeze({ x: 0, y: 0 }),
  chamberOfTheTablet: Object.freeze({ x: 2, y: 0 }),
})
// 桌面展示坐标：候选秘库房间各给一个确定性槽位（被移出的异界机械用备用槽位展示）。
export const LOCATION_COORDINATES = Object.freeze({
  ...LOCATION_CELLS,
  shroudedCisternA: Object.freeze({ x: -1, y: 1 }),
  chamberOfRecordsArm: Object.freeze({ x: 0, y: 1 }),
  chamberOfRecordsEarth: Object.freeze({ x: 1, y: 1 }),
  otherworldlyMechanismsObsidian: Object.freeze({ x: 1, y: 0 }),
  shroudedCisternB: Object.freeze({ x: -1, y: -1 }),
  otherworldlyMechanismsSluice: Object.freeze({ x: 0, y: -1 }),
  otherworldlyMechanismsGears: Object.freeze({ x: 1, y: -1 }),
  otherworldlyMechanismsApparatus: Object.freeze({ x: 3, y: -1 }),
})

const FIXED_TABLE = Object.freeze([
  Object.freeze(['theGreatStair', '11593', { clues: 2, resign: true }]),
  Object.freeze(['movingPlatform', '11594', { clues: 2 }]),
  Object.freeze(['coreOfTheVault', '11595', { clues: 3, unrevealed: true, cannotEnterWhileUnrevealed: true }]),
  Object.freeze(['chamberOfTheTablet', '11604', {
    clues: 2, unrevealed: true, cannotEnterWhileUnrevealed: true,
    unrevealedName: '封印腔室 Sealed Chamber', unrevealedNameEn: 'Sealed Chamber',
    revealedName: '碑匾腔室 Chamber of the Tablet', revealedSubname: '已解封 Unsealed',
  }]),
])
const CHAMBER_TABLE = Object.freeze([
  Object.freeze([SHROUDED_CISTERN_A, '11596', { clues: 2 }]),
  Object.freeze([SHROUDED_CISTERN_B, '11596', { clues: 2 }]),
  Object.freeze([CHAMBER_OF_RECORDS_ARM, '11598', { clues: 1, victory: 1 }]),
  Object.freeze([CHAMBER_OF_RECORDS_EARTH, '11599', { clues: 1, victory: 1 }]),
  Object.freeze(['otherworldlyMechanismsObsidian', '11600', { clues: 2 }]),
  Object.freeze(['otherworldlyMechanismsSluice', '11601', { clues: 3 }]),
  Object.freeze(['otherworldlyMechanismsGears', '11602', { clues: 1 }]),
  Object.freeze(['otherworldlyMechanismsApparatus', '11603', { clues: 1 }]),
])

function makeLocation(id, code, extra) {
  const card = ALL_CARDS[code]
  const base = location({
    id, code,
    clues: extra.clues ?? card.clues,
    ...(extra.hasVictory || extra.victory != null ? { hasVictory: true, victory: extra.victory } : {}),
    ...extra,
  })
  if (extra.unrevealed) {
    base.unrevealedName = extra.unrevealedName || card.backNameZh || card.backName || '秘库腔室 Vault Chamber'
    base.unrevealedNameEn = extra.unrevealedNameEn || card.backName || 'Vault Chamber'
  }
  return base
}

export const LOCATIONS = Object.freeze(Object.fromEntries([
  ...FIXED_TABLE.map(([id, code, extra]) => [id, makeLocation(id, code, extra)]),
  ...CHAMBER_TABLE.map(([id, code, extra]) => [id, makeLocation(id, code, extra)]),
]))
export const LOCATION_IDS = Object.freeze(Object.keys(LOCATIONS))
export const CHAMBER_LOCATION_IDS = Object.freeze(CHAMBER_TABLE.map(([id]) => id))
// 印刷规则：地点之间只经连接图标 / 移动平台相连；卡表不携带连接图标，运行期以正交网格相邻近似。
export const CONNECTION_POLICY = 'orthogonal'
export const LOCATION_CONNECTIONS = Object.freeze(Object.fromEntries(LOCATION_IDS.map(id => [id, Object.freeze([])])))

export const SET_ASIDE_LOCATION_IDS = Object.freeze([])

// 秘库腔室洗牌 + 移出 1 张异界机械（Haskell：pickN 3 四种 Otherworldly Mechanisms）。
export function vaultChamberPool(random = () => 0.5) {
  const [removed] = MECHANISM_IDS.slice().sort(() => random() - 0.5)
  const mechanisms = MECHANISM_IDS.filter(id => id !== removed)
  const chambers = [SHROUDED_CISTERN_A, SHROUDED_CISTERN_B, CHAMBER_OF_RECORDS_ARM, CHAMBER_OF_RECORDS_EARTH, ...mechanisms]
  for (let index = chambers.length - 1; index > 0; index -= 1) {
    const pick = Math.floor(random() * (index + 1))
    ;[chambers[index], chambers[pick]] = [chambers[pick], chambers[index]]
  }
  return { removed, chambers, slots: [...VAULT_SLOT_CELLS] }
}

// ---------------------------------------------------------------------------
// 幕 / 议程阶段
// ---------------------------------------------------------------------------
// 幕 1 反应门槛：翻译任意 3 个符文 → 揭示封印腔室（act 1 正面 reaction）。
export const GLYPH_RUNES_UNSEAL_THRESHOLD = GLYPH_TRANSLATION_TARGET

export const ACT_STAGES = Object.freeze({
  1: Object.freeze({
    ...stage(ACT1_CODE, { stage: 1 }),
    objective: { type: 'manual', roundEnd: true },
    translateGlyphs: GLYPH_RUNES_UNSEAL_THRESHOLD,
  }),
  2: Object.freeze({
    ...stage(ACT2_CODE, { stage: 2 }),
    objective: { type: 'resignedAll' },
  }),
})
export const AGENDA_STAGES = Object.freeze({
  1: Object.freeze({ ...stage(AGENDA1_CODE, { stage: 1 }), inescapableHealthPerInvestigator: 0 }),
  2: Object.freeze({
    ...stage(AGENDA2_CODE, { stage: 2 }),
    inescapableHealthPerInvestigator: 1,
    inescapableHunterAdjacent: true,
  }),
  3: Object.freeze({
    ...stage(AGENDA3_CODE, { stage: 3 }),
    inescapableHealthPerInvestigator: 2,
    inescapableHunterAdjacent: true,
  }),
})
export const ACTS = Object.freeze([1, 2].map(number => structuredClone(ACT_STAGES[number])))
export const AGENDAS = Object.freeze([1, 2, 3].map(number => structuredClone(AGENDA_STAGES[number])))
export const STAGE_CARDS = Object.freeze({
  [ACT1_CODE]: structuredClone(ACT_STAGES[1]),
  [ACT2_CODE]: structuredClone(ACT_STAGES[2]),
  [AGENDA1_CODE]: structuredClone(AGENDA_STAGES[1]),
  [AGENDA2_CODE]: structuredClone(AGENDA_STAGES[2]),
  [AGENDA3_CODE]: structuredClone(AGENDA_STAGES[3]),
})

// 幕 1 反应门槛：翻译任意 3 个符文 → 揭示封印腔室（act 1 正面 reaction）。
export const SEALED_CHAMBER_ID = 'chamberOfTheTablet'
// 幕间「秘库核心」：共同花费 3[per_investigator] 线索 → 二选一。
export const VAULT_CORE_INTERLUDE = Object.freeze({
  clueCostPerInvestigator: 3,
  title: '剧本幕间：秘库核心 The Vault Core',
  pushTheButton: '按键：在剧本日志中记录「内殿已解封」(the inner sanctum was unsealed)。',
  leaveItAlone: '不碰它：每位调查员获得 1 点奖励经验。',
})
// 结局里 Good Money 任务：下一章起始资源 +3 / 下一章维护阶段不能获得资源（近似）。
export const GOOD_MONEY_NEXT_SCENARIO_RESOURCES = 3

// ---------------------------------------------------------------------------
// 遭遇定义（数值/关键词取印刷数据）
// ---------------------------------------------------------------------------
export const ENCOUNTER_DEFINITION_CODES = Object.freeze([
  ...ENCOUNTER_DECK_CODES, ...ENEMY_CODES, ...TREACHERY_CODES, ...STORY_ASSET_CODES,
])
export const { enemies, treacheries, storyAssets } = encounterDefinitions(ENCOUNTER_DEFINITION_CODES)
export const ENEMY_DEFINITIONS = enemies
export const TREACHERY_DEFINITIONS = treacheries
export const STORY_ASSET_DEFINITIONS = storyAssets

// ---------------------------------------------------------------------------
// 剧情正文（英文权威印刷文本；中文由 narrative-guides 的 story-text.js 提供）
// ---------------------------------------------------------------------------
const text = value => (value == null ? '' : String(value))
const blocks = (...parts) => parts.map(text).filter(Boolean).join('\n\n')
export const INTRO_BRANCHES = Object.freeze({
  grandVault1: blocks(TEXT.intro.grandVault1),
  grandVault2: blocks(TEXT.intro.grandVault2),
  grandVault3: blocks(TEXT.intro.grandVault3),
})
export const SETUP_STEPS = Object.freeze(TEXT.setup.steps.map(step => ({
  key: step.key, text: text(step.text),
  when: step.key === 'powerWasDiverted' ? 'powerDiverted'
    : step.key === 'otherwise' ? 'powerNotDiverted' : undefined,
})))
export const SCENARIO_TEXT = Object.freeze({
  textLanguage: 'en',
  textStatus: TEXT.textStatus,
  heading: TEXT.heading,
  intro: blocks(TEXT.intro.checkCampaignLog, TEXT.intro.headedWest, TEXT.intro.headedEast),
  introBranches: INTRO_BRANCHES,
  introLeadIn: Object.freeze({
    headedWest: text(TEXT.intro.headedWest),
    headedEast: text(TEXT.intro.headedEast),
    toeTheLine: text(TEXT.intro.resolveToeTheLine),
    proceedToSetup: text(TEXT.intro.proceedToSetup),
  }),
  toeTheLine: TEXT.intro.toeTheLine,
  setup: SETUP_STEPS.map(step => step.text).filter(Boolean).join('\n\n'),
  setupSteps: SETUP_STEPS,
  specialRules: Object.freeze([]),
  interlude: TEXT.interlude,
  labels: TEXT.labels,
  tooltips: TEXT.tooltips,
  tokens: Object.freeze({
    easyStandard: Object.freeze({ ...TEXT.tokens.easyStandard }),
    hardExpert: Object.freeze({ ...TEXT.tokens.hardExpert }),
  }),
  resolutions: Object.freeze(Object.fromEntries(RESOLUTION_KEYS
    .map(key => [key, blocks(TEXT.resolutions[key]?.title, TEXT.resolutions[key]?.body)]))),
  goodMoney: TEXT.resolutions.goodMoney,
})

export const scenario = {
  id: CHAPTER_ID,
  originalCode: REFERENCE_CODE,
  referenceCode: REFERENCE_CODE,
  name: '大秘库 · The Grand Vault',
  nameEn: 'The Grand Vault',
  encounterCode: ENCOUNTER_CODE,
  intro: SCENARIO_TEXT.intro,
  introBranches: SCENARIO_TEXT.introBranches,
  setup: SCENARIO_TEXT.setup,
  setupSteps: SCENARIO_TEXT.setupSteps,
  specialRules: SCENARIO_TEXT.specialRules,
  interlude: SCENARIO_TEXT.interlude,
  tokens: SCENARIO_TEXT.tokens,
  startLocation: START_LOCATION,
  locations: LOCATIONS,
  setAsideLocations: [...SET_ASIDE_LOCATION_IDS],
  setAsideAliases: [...SET_ASIDE_ALIASES],
  connectByGrid: CONNECTION_POLICY,
  acts: ACTS,
  agendas: AGENDAS,
  stageCards: STAGE_CARDS,
  enemies,
  treacheries,
  storyAssets,
  encounterDeck: [...ENCOUNTER_DECK],
  resolutions: { ...SCENARIO_TEXT.resolutions },
  tokenMeanings: {
    easy: { ...GRAND_VAULT_TOKEN_MEANINGS.easy },
    standard: { ...GRAND_VAULT_TOKEN_MEANINGS.standard },
    hard: { ...GRAND_VAULT_TOKEN_MEANINGS.hard },
    expert: { ...GRAND_VAULT_TOKEN_MEANINGS.expert },
  },
  // 引擎通用「求取空气」原语（turn.js 读 scenario.mechanics.water.air）：
  // 三张议程正面共有的「完全淹没地点的回合开始/结束」强制能力。
  mechanics: {
    water: { air: true, damage: 5 },
  },
  textLanguage: SCENARIO_TEXT.textLanguage,
  textStatus: SCENARIO_TEXT.textStatus,
}

export const identities = identitiesFor(scenario)
bindScenarioIdentities(scenario, identities)

export const CARD_DATA = Object.freeze(Object.fromEntries([
  REFERENCE_CODE,
  ...ACT_CODES, ...AGENDA_CODES,
  ...LOCATION_IDS.map(id => LOCATIONS[id].code),
  ...ENCOUNTER_DEFINITION_CODES,
].map(code => [code, ALL_CARDS[code]])))
