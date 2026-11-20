// 最长一夜（theLongestNight · 提示卡 10626，Atwood Farm）· 章节数据（scenario 只含数据）。
//
// 参考：Scenario/Scenarios/TheFeastOfHemlockVale/TheLongestNight.hs +
//       Act/Agenda/Location/Enemy/Treachery/Story/CardDefs/TheFeastOfHemlockVale/TheLongestNight.hs +
//       Story/Cards/.../BarriersDecoysAndTraps.hs + Asset/Cards/TheFeastOfHemlockVale.hs（10641/10642）+
//       Campaigns/TheFeastOfHemlockVale/Key.hs（战役记录键）+
//       frontend/src/locales/en/theFeastOfHemlockVale/theLongestNight.json（印刷规则文本）。
//
// 卡号归属（input.cards，31 条）：10626（提示卡）–10650，含 a/b/c 三种敌人面。
// 卡面数据一律从 card-data.js 的 printed()/location()/stage()/encounterDefinitions() 读取。
//
// 地图（参考 Haskell grid）：农庄 (0,0) 居中，五处 Atwood Farm 地点洗到
// (-1,0)/(-2,0)/(1,0)/(0,-1)/(0,1) 五个「农场格」，四处外围农田占 (-3,0)/(2,0)/(0,-2)/(0,2)。
// 五张外围农田随机移除一张（本实现固定移除 Rancid Crops，见 behavior 披露）。
// 地点印刷能力全部是「连接相邻地点」，因此连接表由格位正交邻接生成，不写第二份符号表。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { bindScenarioIdentities } from '../../../../identities.js'
import { location, stage, encounterDefinitions, identitiesFor } from '../../card-data.js'
import { chapterStory, flattenStory } from '../../story-access.js'
import { THE_LONGEST_NIGHT_TOKEN_MEANINGS } from './chaos.js'

export const CHAPTER_ID = 'theLongestNight'
export const REFERENCE_CODE = '10626'

// 单一幕 / 单一议程（参考 setActDeck [theLongestNight] / setAgendaDeck [theOnslaught]）。
export const ACT_CODES = Object.freeze(['10629'])
export const AGENDA_CODES = Object.freeze(['10628'])
export const ACT_CODE_BY_STAGE = Object.freeze({ 1: ACT_CODES[0] })
export const AGENDA_CODE_BY_STAGE = Object.freeze({ 1: AGENDA_CODES[0] })

// 参考 Setup 的 8 个 gather 组（The Second Day / The Longest Night / Blight / Transfiguration /
// Fire! / Chilling Cold / The Midnight Masks / Striking Fear）。
export const GATHER_GROUPS = Object.freeze([
  'theSecondDay', 'theLongestNight', 'blight', 'transfiguration', 'fire', 'chillingCold',
  'theMidnightMasks', 'strikingFear',
])
// Fire! 五张整组放在一边（参考 `setAsideEvery (cardIs Treacheries.fire)`），不是整组放一边的
// 遭遇组；保留常量统一形状。
export const GATHER_SET_ASIDE_GROUPS = Object.freeze([])

export const START_LOCATION = 'theFarmhouse'
export const FARMHOUSE_ID = START_LOCATION
export const FARMHOUSE_CODE = '10630'

// 五处 Atwood Farm 地点（农庄周围的五个农场格）；坐标见 SLOT_COORDINATES。
export const FARM_LOCATION_TABLE = Object.freeze([
  // [id, code, slot, 印刷线索/每位调查员]
  ['milkhouse', '10631', 'westInner', 1],
  ['vineyard', '10632', 'farWest', 1],
  ['coop', '10633', 'eastInner', 1],
  ['barn', '10634', 'northInner', 1],
  ['pasture', '10635', 'southInner', 1],
])
export const FARM_LOCATION_IDS = Object.freeze(FARM_LOCATION_TABLE.map(([id]) => id))

// 五处外围农田（Outer Fields）：参考把五张洗混后随机移除一张，其余四张放到四个
// 外围格（西 (-3,0) / 东 (2,0) / 北 (0,-2) / 南 (0,2)）。
export const OUTER_FIELD_TABLE = Object.freeze([
  // [id, code, 方向, slot, 印刷线索/每位调查员, 是否本实现的默认移除项]
  ['outerFieldsBloodiedPaths', '10636', 'west', 'westOuter', 3, false],
  ['outerFieldsDesolateHills', '10637', 'east', 'eastOuter', 3, false],
  ['outerFieldsBlightedCornfields', '10638', 'north', 'northOuter', 2, false],
  ['outerFieldsScorchedKnoll', '10639', 'south', 'southOuter', 2, false],
  ['outerFieldsRancidCrops', '10640', 'removed', null, 2, true],
])
export const OUTER_FIELD_IDS = Object.freeze(OUTER_FIELD_TABLE.map(([id]) => id))
// 印刷规则是「随机移除 1 张 Outer Fields」：本实现固定移除此卡（manifest/存档可复现），
// 随机移除由 behavior 的 setup 披露说明。
export const REMOVED_OUTER_FIELD_ID = 'outerFieldsRancidCrops'
export const REMOVED_OUTER_FIELD_CODE = '10640'
export const PLAYED_OUTER_FIELD_IDS = Object.freeze(
  OUTER_FIELD_IDS.filter(id => id !== REMOVED_OUTER_FIELD_ID))
// 方向 → 外围农田格（入场后被洗到该格的实际地点卡可能不同，behavior 按格位读取）。
export const OUTER_FIELD_SLOT_BY_DIRECTION = Object.freeze({
  west: 'westOuter', east: 'eastOuter', north: 'northOuter', south: 'southOuter',
})
export const DIRECTIONS = Object.freeze(['west', 'east', 'north', 'south'])

// 格位坐标（Haskell#Pos 的投影）：X 向东为正、Y 向南为正。
export const SLOT_COORDINATES = Object.freeze({
  theFarmhouse: Object.freeze({ x: 0, y: 0 }),
  westInner: Object.freeze({ x: -1, y: 0 }),
  farWest: Object.freeze({ x: -2, y: 0 }),
  eastInner: Object.freeze({ x: 1, y: 0 }),
  northInner: Object.freeze({ x: 0, y: -1 }),
  southInner: Object.freeze({ x: 0, y: 1 }),
  westOuter: Object.freeze({ x: -3, y: 0 }),
  eastOuter: Object.freeze({ x: 2, y: 0 }),
  northOuter: Object.freeze({ x: 0, y: -2 }),
  southOuter: Object.freeze({ x: 0, y: 2 }),
})

// 格位正交邻接（`connectsToAdjacent`）：每处地点连接其上下左右四个格中的在场地点。
// 地图是一横一纵两条走廊：农庄—西内—远西—西外，农庄—东内—东外，农庄—北内—北外，
// 农庄—南内—南外；移除一张外围农田只是少一格，不改变其余邻接。
export const SLOT_ADJACENCY = Object.freeze({
  theFarmhouse: Object.freeze(['westInner', 'eastInner', 'northInner', 'southInner']),
  westInner: Object.freeze(['theFarmhouse', 'farWest']),
  farWest: Object.freeze(['westInner', 'westOuter']),
  eastInner: Object.freeze(['theFarmhouse', 'eastOuter']),
  northInner: Object.freeze(['theFarmhouse', 'northOuter']),
  southInner: Object.freeze(['theFarmhouse', 'southOuter']),
  westOuter: Object.freeze(['farWest']),
  eastOuter: Object.freeze(['eastInner']),
  northOuter: Object.freeze(['northInner']),
  southOuter: Object.freeze(['southInner']),
})

const LOCATION_ROWS = Object.freeze([
  // [id, code, slot, 每位调查员线索]
  [FARMHOUSE_ID, FARMHOUSE_CODE, 'theFarmhouse', 2],
  ...FARM_LOCATION_TABLE,
  ...OUTER_FIELD_TABLE.map(([id, code, , slot, clues]) => [id, code, slot, clues]),
])
const SLOT_BY_ID = Object.freeze(Object.fromEntries(LOCATION_ROWS.map(([id, , slot]) => [id, slot])))
const ID_BY_SLOT = Object.freeze(Object.fromEntries(LOCATION_ROWS
  .filter(([, , slot]) => slot).map(([id, , slot]) => [slot, id])))

/** 地点 id → 格位 id（连通语义按格位计算；被移除的外围农田没有格位）。 */
export const slotOf = id => SLOT_BY_ID[id] || null
/** 格位 id → 当前内容层里的地点 id。 */
export const locationAtSlot = slot => ID_BY_SLOT[slot] || null

/** 地点连接：按格位邻接生成；被移除的那张外围农田没有格位/连接。 */
export const LOCATION_CONNECTIONS = Object.freeze(Object.fromEntries(LOCATION_ROWS.map(([id]) => {
  const slot = SLOT_BY_ID[id]
  if (!slot) return [id, Object.freeze([])]
  return [id, Object.freeze(SLOT_ADJACENCY[slot].map(next => ID_BY_SLOT[next]).filter(Boolean))]
})))

export const LOCATION_COORDINATES = Object.freeze(Object.fromEntries(LOCATION_ROWS
  .filter(([id]) => SLOT_BY_ID[id])
  .map(([id, , slot]) => [id, { ...SLOT_COORDINATES[slot] }])))

function makeLocation([id, code, slot, clues]) {
  const point = slot ? SLOT_COORDINATES[slot] : null
  // 农庄：印刷「不能有玩家卡牌附属、陷阱、诱饵」。`noLocationDefenses` 是引擎
  // location-defenses.js#placeLocationDefense 的真实读点。
  const extra = id === FARMHOUSE_ID
    ? { noLocationDefenses: true, cannotHaveAttachments: true, sanctum: true }
    : {}
  return location({
    id, code, clues, ...(point ? { x: point.x, y: point.y, slot } : { removed: true }),
    connections: [...LOCATION_CONNECTIONS[id]], ...extra,
  })
}

export const LOCATIONS = Object.freeze(Object.fromEntries(LOCATION_ROWS.map(row => [row[0], makeLocation(row)])))
// 地点卡号 → 地点 id（洗牌后按卡号找实际位置）。
export const LOCATION_ID_BY_CODE = Object.freeze(Object.fromEntries(LOCATION_ROWS.map(([id, code]) => [code, id])))

// 放一边的地点：随机移除的那张外围农田（印刷规则随机、本实现固定，见行为披露）。
export const SET_ASIDE_LOCATIONS = Object.freeze([REMOVED_OUTER_FIELD_ID])

// ---------------------------------------------------------------------------
// 敌人牌库（The Enemy Deck）：15 张红背敌人；Ursine Hybrid 开局在场，其余 14 张洗成敌人牌库。
// ---------------------------------------------------------------------------
export const URSINE_CODE = '10643'
export const ENEMY_CARD_CODES = Object.freeze([
  '10643', '10644a', '10644b', '10644c', '10645a', '10645b', '10645c',
  '10646', '10647a', '10647b', '10647c', '10648',
])
const physical = (code, times) => Array(times ?? (ALL_CARDS[code]?.quantity || 1)).fill(code)
// 15 张红背敌人：Ursine ×1 开局在场；Molting/Lupine/Equine 各 3 面；Capra ×3；Slithering ×2。
export const ENEMY_CARDS = Object.freeze(ENEMY_CARD_CODES.flatMap(code => physical(code)))
export const ENEMY_DECK = Object.freeze(ENEMY_CARD_CODES
  .filter(code => code !== URSINE_CODE).flatMap(code => physical(code)))
export const ENEMY_DECK_CODES = Object.freeze([...new Set(ENEMY_DECK)])
// 印刷「生成 - 外围农田(某方向)」与「敌人最少/最多的外围农田」。
export const ENEMY_SPAWN_DIRECTION = Object.freeze({
  '10644a': 'east', '10644b': 'south', '10644c': 'west',
  '10645a': 'north', '10645b': 'east', '10645c': 'south',
  '10647a': 'north', '10647b': 'east', '10647c': 'west',
})
export const ENEMY_SPAWN_FEWEST = Object.freeze(['10646'])
export const ENEMY_SPAWN_MOST = Object.freeze(['10648'])
export const ENEMY_CODES_BY_TRAIT_IGNORED = Object.freeze({
  // 印刷「忽略屏障/诱饵/陷阱」（enemyRule.ignoreDefenses 的唯一事实源在单卡条目里）。
  '10643': Object.freeze(['barrier', 'decoy']),
  '10644a': Object.freeze(['barrier']),
  '10644b': Object.freeze(['barrier']),
  '10644c': Object.freeze(['barrier']),
  '10646': Object.freeze(['decoy']),
  '10647a': Object.freeze(['trap']),
  '10647b': Object.freeze(['trap']),
  '10647c': Object.freeze(['trap']),
  '10648': Object.freeze(['barrier', 'decoy', 'trap']),
})
// 伤害降为 1 的敌人（Molting / Equine）。
export const ENEMY_DAMAGE_CAPPED = Object.freeze(['10644a', '10644b', '10644c', '10647a', '10647b', '10647c'])
// 攻击后自愈 1 点伤害的敌人（Lupine）。
export const ENEMY_HEALS_AFTER_ATTACK = Object.freeze(['10645a', '10645b', '10645c'])
// 巡逻目标（Patrol (The Farmhouse)）；Ursine 是猎人、其余用巡逻。
export const ENEMY_PATROL_TARGET = Object.freeze({ kind: 'named', locationId: FARMHOUSE_ID })
// Ursine：+3[per_investigator] 生命值、唯一、胜利 2。
export const URSINE_HEALTH_PER_INVESTIGATOR = 3
export const URSINE_VICTORY = 2

// 剧情资产：病俘（10 生命，开局在农庄）与埃阿斯（谷仓揭示时入场）。
export const CAPTIVES_CODE = '10641'
export const CAPTIVES_HEALTH = 10
export const AJAX_CODE = '10642'
export const BARRIER_TOKENS_CODE = '10627'
export const STORY_CODES = Object.freeze([BARRIER_TOKENS_CODE, CAPTIVES_CODE, AJAX_CODE])

// ---------------------------------------------------------------------------
// 遭遇牌库：8 个 gather 组的敌人/诡计，按印刷份数展开。
// · The Longest Night 只取两张诡计（15 张红背敌人进敌人牌库）；
// · Fire! 五张整组放在一边（不进牌库）；
// · The Midnight Masks 只取猎影/伪线索两张诡计（本卡表把它们记在 core 的 arkham 组，见下）。
// ---------------------------------------------------------------------------
export const FIRE_CODE = '10743'
export const FIRE_CARDS = Object.freeze(physical(FIRE_CODE, 5))
export const MIDNIGHT_MASKS_CODES = Object.freeze(['01135', '01136'])
export const DECK_GROUP_CODES = Object.freeze({
  theSecondDay: Object.freeze(['10678']),
  theLongestNight: Object.freeze(['10649', '10650']),
  blight: Object.freeze(['10728', '10729']),
  transfiguration: Object.freeze(['10726', '10727']),
  fire: Object.freeze([]),
  chillingCold: Object.freeze(['01167', '01168']),
  theMidnightMasks: MIDNIGHT_MASKS_CODES,
  strikingFear: Object.freeze(['01163', '01164', '01165']),
})
export const ENCOUNTER_DECK = Object.freeze(Object.values(DECK_GROUP_CODES)
  .flat().flatMap(code => physical(code)))
export const ENCOUNTER_DECK_CODES = Object.freeze([...new Set(ENCOUNTER_DECK)])

// 放一边：五张 Fire! 诡计 + 埃阿斯剧情资产（参考 `setAsideEvery (cardIs fire)` / `setAside [ajax]`）。
export const SET_ASIDE_CARDS = Object.freeze([...FIRE_CARDS, AJAX_CODE])

// 遭遇定义也包含从放一边区域抽取的 Fire!。
const definitions = encounterDefinitions([
  ...ENCOUNTER_DECK_CODES, ...ENEMY_CARD_CODES, FIRE_CODE, BARRIER_TOKENS_CODE, CAPTIVES_CODE, AJAX_CODE,
])

// 幕/议程阶段：本章单幕单议程，都没有自动目标（幕面「不要推进场景，直到你受到指示」）。
export const ACT_STAGES = Object.freeze({
  1: Object.freeze(stage(ACT_CODE_BY_STAGE[1], { number: 1 })),
})
export const AGENDA_STAGES = Object.freeze({
  1: Object.freeze(stage(AGENDA_CODE_BY_STAGE[1], { number: 1 })),
})
// scenario 里的幕/议程实例必须是可变副本：identities.js 会把原卡身份写回定义对象。
export const ACTS = Object.freeze([1].map(number => structuredClone(ACT_STAGES[number])))
export const AGENDAS = Object.freeze([1].map(number => structuredClone(AGENDA_STAGES[number])))

// ---------------------------------------------------------------------------
// 印刷文本（唯一事实源：story-text.js → story-access.js）
// ---------------------------------------------------------------------------
const safeChapterStory = id => {
  try {
    return chapterStory(id)
  } catch {
    return { sections: {}, sectionsEn: {}, chineseGaps: [] }
  }
}
const STORY = safeChapterStory(CHAPTER_ID)
const SECTIONS = STORY.sections || {}
const SECTIONS_EN = STORY.sectionsEn || {}
// 本章中文正文尚未回填（story-text 的 chineseGaps 覆盖整章）：逐键回退英文，不伪造译文。
const text = key => flattenStory(SECTIONS[key] ?? SECTIONS_EN[key] ?? '')
const block = (...keys) => keys.map(text).filter(Boolean).join('\n\n')
const sectionEntries = prefix => Object.keys(SECTIONS_EN)
  .filter(key => key === prefix || key.startsWith(`${prefix}.`))
  .sort()
const hasChinese = Object.keys(SECTIONS).some(key => SECTIONS[key] != null)

export const SCENARIO_TEXT = Object.freeze({
  textLanguage: hasChinese ? 'zh-CN' : 'en',
  textStatus: hasChinese ? 'translated' : 'pending translation (en fallback)',
  heading: text('intro.title'),
  intro: block('intro.intro1'),
  introLabels: Object.freeze({
    confront: text('intro.label.confront'),
    keepHidden: text('intro.label.keepHidden'),
  }),
  introBranches: Object.freeze({
    confront: block('intro.intro2'),
    keepHidden: block('intro.intro3'),
    intro4: block('intro.intro4', 'intro.checkDance'),
    danceTwo: block('intro.intro5'),
    danceOne: block('intro.intro6'),
    danceNone: block('intro.intro7'),
    intro8: block('intro.intro8'),
  }),
  introConditions: Object.freeze({
    danceTwo: text('intro.danceTwo'),
    danceOne: text('intro.danceOne'),
    danceNone: text('intro.danceNone'),
  }),
  setup: Object.freeze(sectionEntries('setup').map(key => ({ key, text: text(key) }))),
  specialRules: Object.freeze(['barriers', 'decoys', 'traps', 'enemyDeckRules'].map(key => ({
    key, title: text(`${key}.title`), body: text(`${key}.body`),
  }))),
  rules: Object.freeze({
    barriers: text('barriers.body'),
    decoys: text('decoys.body'),
    traps: text('traps.body'),
    enemyDeck: text('enemyDeckRules.body'),
  }),
  codex: Object.freeze(Object.fromEntries(
    ['leahAtwood', 'simeonAtwood', 'williamHemlock', 'riverHawthorne', 'gideonMizrah',
      'judithPark', 'theoPeters', 'drRosaMarquez', 'ajax']
      .map(key => [key, { title: text(`codex.${key}.title`), body: text(`codex.${key}.body`) }]))),
  resolutions: Object.freeze(Object.fromEntries(['investigatorDefeat', 'resolution1', 'resolution2',
    'resolution3', 'resolution4'].map(key => [key, {
    title: text(`resolutions.${key}.title`), body: text(`resolutions.${key}.body`),
  }]))),
  resolutionNotes: Object.freeze({
    xp5: text('resolutions.resolution1.xp5'),
    xp4: text('resolutions.resolution1.xp4'),
    xp3: text('resolutions.resolution1.xp3'),
    captivesSaved: text('resolutions.resolution1.captivesSaved'),
    resolution2Xp3: text('resolutions.resolution2.xp3'),
    resolution2Xp2: text('resolutions.resolution2.xp2'),
    resolution2Xp1: text('resolutions.resolution2.xp1'),
    captivesLost: text('resolutions.resolution2.captivesLost'),
    skipToResolution4: text('resolutions.resolution1.skipToResolution4'),
  }),
  chineseGaps: [...(STORY.chineseGaps || [])],
})

// 结局键：4 个结局、调查员败北，以及引擎全员离场使用的无结局。
export const RESOLUTION_KEYS = Object.freeze(['resolution1', 'resolution2', 'resolution3', 'resolution4'])
export const NO_RESOLUTION = 'noResolution'
export const INVESTIGATOR_DEFEAT = 'investigatorDefeat'

export const scenario = {
  id: CHAPTER_ID,
  originalCode: REFERENCE_CODE,
  name: '最长一夜 · The Longest Night',
  intro: SCENARIO_TEXT.intro,
  setup: SCENARIO_TEXT.setup,
  specialRules: SCENARIO_TEXT.specialRules,
  rules: SCENARIO_TEXT.rules,
  startLocation: START_LOCATION,
  resignAnywhere: true,
  locations: LOCATIONS,
  setAsideLocations: [...SET_ASIDE_LOCATIONS],
  acts: ACTS,
  agendas: AGENDAS,
  ...definitions,
  encounterDeck: [...ENCOUNTER_DECK],
  resolutions: Object.fromEntries([NO_RESOLUTION, INVESTIGATOR_DEFEAT, ...RESOLUTION_KEYS]
    .map(key => [key, SCENARIO_TEXT.resolutions[key]?.body || ''])),
  tokenMeanings: {
    easy: { ...THE_LONGEST_NIGHT_TOKEN_MEANINGS.easy },
    standard: { ...THE_LONGEST_NIGHT_TOKEN_MEANINGS.standard },
    hard: { ...THE_LONGEST_NIGHT_TOKEN_MEANINGS.hard },
    expert: { ...THE_LONGEST_NIGHT_TOKEN_MEANINGS.expert },
  },
  // 工事（屏障/诱饵/陷阱）走引擎 defenses 原语：置位、进入时结算、跨轮不能重整。
  mechanics: { defenses: true },
  textLanguage: SCENARIO_TEXT.textLanguage,
  textStatus: SCENARIO_TEXT.textStatus,
}

export const identities = identitiesFor(scenario)
bindScenarioIdentities(scenario, identities)

export const CARD_DATA = Object.freeze(Object.fromEntries([
  REFERENCE_CODE, ...ACT_CODES, ...AGENDA_CODES, BARRIER_TOKENS_CODE,
  ...LOCATION_ROWS.map(([, code]) => code),
  CAPTIVES_CODE, AJAX_CODE, ...ENEMY_CARD_CODES, '10649', '10650',
].map(code => [code, ALL_CARDS[code]])))

// 战役记录键（Campaigns/TheFeastOfHemlockVale/Key.hs 的 TheFeastOfHemlockValeKey）。
// 内容层 ID 必须是稳定 ASCII 小驼峰（content/schema.js 的 /^[a-z][A-Za-z0-9-]*$/），
// 因此把参考实现的 PascalCase 枚举名转成 lowerCamel 后再写入战役日志。
export const RECORD_KEYS = Object.freeze({
  facedAlone: 'theInvestigatorsFacedTheLongestNightAlone',
  captivesSaved: 'theCaptivesWereSaved',
  captivesLost: 'manyCaptivesWereLost',
  allCaptivesLost: 'allTheCaptivesWereLost',
  drMarquezHasAPlan: 'drMarquezHasAPlan',
  bearWounded: 'theBearWasWounded',
  areasSurveyedSouthernFields: 'areasSurveyedSouthernFields',
  resolution: 'theLongestNightResolution',
  captivesDamage: 'theLongestNightCaptivesDamage',
})
export const DANCE_RECORDS = Object.freeze([
  'simeonSharedADance', 'leahSharedADance', 'theoSharedADance', 'gideonSharedADance',
  'judithSharedADance', 'williamSharedADance', 'riverSharedADance', 'helenSharedADance',
])
