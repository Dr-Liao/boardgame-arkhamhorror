// 古代议庭（courtOfTheAncients · 提示卡 11612）· 章节数据（scenario 只含数据）。
//
// 权威来源（只读参考资源）：
//   Scenario/Scenarios/TheDrownedCity/CourtOfTheAncients.hs +
//   Scenarios/TheDrownedCity/CourtOfTheAncients/Helpers.hs（层级 / 大升降机滑轨 / 符文数）+
//   Act|Agenda|Location|Enemy|Treachery/CardDefs/TheDrownedCity/CourtOfTheAncients.hs +
//   Location|Enemy|Treachery/Cards/TheDrownedCity/CourtOfTheAncients/*.hs +
//   frontend/src/locales/en/theDrownedCity/courtOfTheAncients.json（印刷正文，已固化在 text.js）+
//   src/cards/cards-data.js（简中卡名/卡文/数值）。
//
// 本关口径：
//   1. 竖直 4 层网格：层 = 网格行 + 1（第 1 层 = row 0，塔向上生长）。第 1 层：
//      西侧前厅 (0,0)、大升降机竖井 (1,0)、东侧前厅 (2,0)、古代祭坛 (3,0)（祭坛在环外）；
//      第 4 层：扭曲栈桥 (0,3)；崩塌档案库洗牌后放进 (2,3)/(0,2)/(2,2)/(0,1)/(2,1) 五个环位。
//      6 张崩塌档案库里随机移出 1 张（Haskell：第六张不入场）。
//   2. 「地点之间除大升降机、连接图标或卡牌效果外都不相连」：网格邻接策略设为 none；
//      静态连接只有东侧前厅 ↔ 古代祭坛（Heart ↔ Plus 图标）；大升降机与左右相邻地点
//      的连接由 behavior 按其实时层级写入网格（升降机移动后立即重算）。
//   3. 大升降机（未激活 11622 / 已激活 11622b）在 1–4 层之间滑动；卡牌与标记随地点保留
//      （地点 ID 不变，实体原地附着），邻接与寻路即时更新（P7 mechanics.map.relocate 原语）。
//   4. 线路分支（theExpeditionHeadedWest）：向西 → 大升降机第 1 层、东侧前厅开场、
//      议程 1「废墟档案塔」、幕 2「逃离高塔 v.I」、Stowaways 组；向东 → 大升降机第 4 层、
//      扭曲栈桥开场、议程 1「淹没档案塔」、幕 2「逃离高塔 v.II」、Pilgrims 组。
//   5. 符文（Glyph）：胜利区符文卡数量驱动 [skull] 与多张卡；已翻译符文记入
//      campaign.records.discoveredGlyphs（string[]，§4 规范键）。
//   6. 宇宙预兆（11636）与伊克雷希特碎片（11638）按印刷文本在 behavior/条目里结算。
//
// 中文叙事：本地无官方中文源，text.js 固化英文权威正文；中文翻译由 narrative-guides worker 提供。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { bindScenarioIdentities } from '../../../../identities.js'
import { TEXT } from './text.js'
import { COURT_TOKEN_MEANINGS } from './chaos.js'

export const CHAPTER_ID = 'courtOfTheAncients'
export const REFERENCE_CODE = '11612'
export const ENCOUNTER_CODE = 'court_of_the_ancients'
export const CAMPAIGN_ID = 'theDrownedCity'

// ---------------------------------------------------------------------------
// 印刷数据读取
// ---------------------------------------------------------------------------
export function printed(code) {
  const card = ALL_CARDS[code]
  if (!card) throw new RangeError(`Unknown Court of the Ancients card: ${code}`)
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
  if (!card) throw new RangeError(`Unknown Court of the Ancients location: ${code}`)
  const base = {
    ...printed(code), id, shroud: card.shroud, connections: [...connections], ...rest,
    cluesPerInvestigator: clues ?? card.clues ?? 0,
    ...(hasVictory || card.victory ? { victory: victory ?? card.victory ?? 1 } : {}),
  }
  if (card.backName) {
    base.unrevealedName = card.backNameZh || card.backName
    base.unrevealedNameEn = card.backName
  }
  return base
}

function stage(code, extra = {}) {
  const card = ALL_CARDS[code]
  if (!card) throw new RangeError(`Unknown Court of the Ancients stage: ${code}`)
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
    if (!card) throw new RangeError(`Unknown Court of the Ancients encounter card: ${code}`)
    const base = printed(code)
    if (card.type === 'enemy') {
      enemies[code] = {
        ...base, fight: card.fight ?? null, evade: card.evade ?? null, health: card.health ?? null,
        damage: card.damage || 0, horror: card.horror || 0,
        ...(Object.hasOwn(card, 'victory') ? { victory: card.victory } : {}),
        elite: (card.traits || []).includes('Elite'),
        hunter: /Hunter\./.test(card.text || ''), aloof: /Aloof\./.test(card.text || ''),
        alert: /Alert\./.test(card.text || ''), massive: /Massive\./.test(card.text || ''),
        retaliate: /Retaliate\./.test(card.text || ''),
      }
      if (/Prey - Lowest \[agility\]/i.test(card.text || '')) enemies[code].prey = 'lowestAgility'
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
// 幕 / 议程 / 结局（路线分支：向西/向东）
// ---------------------------------------------------------------------------
export const ACT_CODES = Object.freeze(['11616', '11617', '11618'])
export const AGENDA_CODES = Object.freeze(['11613', '11614', '11615'])
export const ACT1_CODE = '11616'
export const ESCAPE_V1_CODE = '11617'
export const ESCAPE_V2_CODE = '11618'
export const RUINED_ARCHIVES_CODE = '11613'
export const FLOODED_ARCHIVES_CODE = '11614'
export const UNSTABLE_FOUNDATIONS_CODE = '11615'
export const RESOLUTION_KEYS = Object.freeze(['noResolution', 'resolution1', 'resolution2'])
export const RESOLUTION_BY_ROUTE = Object.freeze({ west: 'resolution1', east: 'resolution2' })

// ---------------------------------------------------------------------------
// 敌人 / 诡计 / 剧情资产
// ---------------------------------------------------------------------------
export const KEEPER_DREAMS_CODE = '11630'
export const KEEPER_SLEEP_CODE = '11631'
export const COLOSSAL_TYRANT_CODE = '11635'
export const WINGED_KEEPER_CODE = '11637'
export const GLYPH_TREACHERY_CODES = Object.freeze(['11632', '11633', '11634'])
export const COSMIC_OMEN_CODE = '11636'
export const SHARD_CODE = '11638'
export const ENEMY_CODES = Object.freeze([KEEPER_DREAMS_CODE, KEEPER_SLEEP_CODE, COLOSSAL_TYRANT_CODE, WINGED_KEEPER_CODE])
export const TREACHERY_CODES = Object.freeze([...GLYPH_TREACHERY_CODES, COSMIC_OMEN_CODE])
export const STORY_ASSET_CODES = Object.freeze([SHARD_CODE])
export const SET_ASIDE_ENEMY_CODES = Object.freeze([COLOSSAL_TYRANT_CODE])

// 符文（Glyph）：发现后写 discoveredGlyphs（string[]）；胜利区符文卡驱动 [skull]。
export const GLYPH_RECORDS = Object.freeze({
  '11630': { rune: 'rune_k', word: 'Dreams', wordZh: '梦境', source: 'enemy' },
  '11631': { rune: 'rune_j', word: 'Sleep', wordZh: '睡眠', source: 'enemy' },
  '11632': { rune: 'rune_g', word: 'Life', wordZh: '生命', source: 'treachery', test: { skill: 'willpower', difficulty: 3 } },
  '11633': { rune: 'rune_i', word: 'Cthulhu', wordZh: '克苏鲁', source: 'treachery', test: { skill: 'combat', difficulty: 3 } },
  '11634': { rune: 'rune_h', word: "Y'ch'lecht", wordZh: '伊克雷希特', source: 'treachery', test: { skill: 'intellect', difficulty: 3 } },
})
export const GLYPH_RUNE_ORDER = Object.freeze(['rune_k', 'rune_j', 'rune_g', 'rune_i', 'rune_h'])
export const TRANSLATED_GLYPHS_FOR_ELITE = 10
export const GLYPHS_FOR_ALTAR = 3
export const ALTAR_CLUE_COST_PER_INVESTIGATOR = 4

// ---------------------------------------------------------------------------
// gather 组（Setup：Court of the Ancients / Domination / Dreams / Elder Mist /
// The Inescapable / R'lyeh / Star Spawn + 路线组 Stowaways / Pilgrims）
// ---------------------------------------------------------------------------
export const GATHER_GROUPS = Object.freeze([
  'courtOfTheAncients', 'domination', 'dreams', 'elderMist', 'theInescapable', 'rlyeh', 'starSpawn',
])
export const ROUTE_GATHER_GROUPS = Object.freeze({ west: 'stowaways', east: 'pilgrims' })
export const REQUIRED_ENCOUNTER_GROUPS = Object.freeze([
  'courtOfTheAncients', 'domination', 'dreams', 'elderMist', 'theInescapable', 'rlyeh', 'starSpawn',
  'stowaways', 'pilgrims',
])
const snake = value => String(value).replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase()
const deckCardTypes = ['enemy', 'treachery']
const expand = rows => rows
  .sort(([a], [b]) => a.localeCompare(b))
  .flatMap(([code, card]) => Array(Math.max(1, Number(card.quantity) || 1)).fill(code))
const cardsOfGroups = groups => Object.entries(ALL_CARDS)
  .filter(([, card]) => new Set(groups.map(snake)).has(card.encounterCode))

export const STAR_SPAWN_OBSERVER_CODE = '11728'
export const STAR_SPAWN_OTHER_CODES = Object.freeze(['11725', '11726', '11727'])
export const INESCAPABLE_ENEMY_CODE = '11744'
export const INESCAPABLE_SET_CODES = Object.freeze(['11744', '11745'])
// 放一边（Setup）：Shard、Colossal Tyrant、Star Spawn Observer、The Inescapable 敌人（默认未击败）。
export const SET_ASIDE_ALIASES = Object.freeze([
  '11622b', SHARD_CODE, COLOSSAL_TYRANT_CODE, STAR_SPAWN_OBSERVER_CODE, INESCAPABLE_ENEMY_CODE,
])
// 不进（静态）遭遇牌库的卡：放一边的敌人/资产 + Star Spawn 观察者 + 路线组 + 移出游戏的卡。
export const SET_ASIDE_DECK_CODES = Object.freeze([
  SHARD_CODE, COLOSSAL_TYRANT_CODE, STAR_SPAWN_OBSERVER_CODE, ...STAR_SPAWN_OTHER_CODES,
  INESCAPABLE_ENEMY_CODE,
  ...Object.entries(ALL_CARDS).filter(([, card]) => ['stowaways', 'pilgrims'].includes(card.encounterCode)).map(([code]) => code),
])
export const STAR_SPAWN_REMOVE_COUNT_WEST = 2

export const ENCOUNTER_DECK = Object.freeze(expand(cardsOfGroups(GATHER_GROUPS)
  .filter(([, card]) => deckCardTypes.includes(card.type))
  .filter(([code]) => !SET_ASIDE_DECK_CODES.includes(code))))
export const ENCOUNTER_DECK_CODES = Object.freeze([...new Set(ENCOUNTER_DECK)])

/** 路线组（向西 Stowaways / 向东 Pilgrims）。 */
export function routeGroupDeck(route) {
  const group = ROUTE_GATHER_GROUPS[route] || ROUTE_GATHER_GROUPS.west
  return expand(cardsOfGroups([group]).filter(([, card]) => deckCardTypes.includes(card.type)))
}
/** 固定组之外的 Star Spawn 残余：向西留 1 张（随机移出 2 张），向东全部移出。 */
export function starSpawnRemainder(route, random = () => 0.5) {
  const pool = [...STAR_SPAWN_OTHER_CODES]
  if (route === 'east') return []
  const shuffled = [...pool]
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const pick = Math.floor(random() * (index + 1))
    ;[shuffled[index], shuffled[pick]] = [shuffled[pick], shuffled[index]]
  }
  return shuffled.slice(STAR_SPAWN_REMOVE_COUNT_WEST)
}
/** 完整遭遇牌库（静态 + 路线组 + Star Spawn 残余）。 */
export function encounterDeckFor(route = 'west', random = () => 0.5) {
  return [...ENCOUNTER_DECK, ...routeGroupDeck(route), ...starSpawnRemainder(route, random)]
}

// ---------------------------------------------------------------------------
// 地点（4 固定 + 大升降机 + 6 张崩塌档案库，其中 1 张在 Setup 随机移出游戏）
// ---------------------------------------------------------------------------
export const GREAT_LIFT_ID = 'greatLift'
export const WEST_ANTECHAMBER_ID = 'westAntechamber'
export const EAST_ANTECHAMBER_ID = 'eastAntechamber'
export const ANCIENT_ALTAR_ID = 'ancientAltar'
export const TWISTING_CATWALKS_ID = 'twistingCatwalks'
export const START_LOCATION_BY_ROUTE = Object.freeze({
  west: EAST_ANTECHAMBER_ID, east: TWISTING_CATWALKS_ID,
})
export const START_LOCATION = EAST_ANTECHAMBER_ID
export const FIXED_LOCATION_IDS = Object.freeze([
  WEST_ANTECHAMBER_ID, EAST_ANTECHAMBER_ID, ANCIENT_ALTAR_ID, TWISTING_CATWALKS_ID, GREAT_LIFT_ID,
])
export const ARCHIVE_IDS = Object.freeze([
  'archiveOfTheStars', 'archiveOfTheAncients', 'archiveOfDreams',
  'archiveOfConflict', 'archiveOfHistory', 'archiveOfMemory',
])
export const ARCHIVE_CODES = Object.freeze({
  archiveOfTheStars: '11624', archiveOfTheAncients: '11625', archiveOfDreams: '11626',
  archiveOfConflict: '11627', archiveOfHistory: '11628', archiveOfMemory: '11629',
})
// Haskell placeInGrid 顺序：归档洗牌后依次放进这 5 个环位。
export const ARCHIVE_SLOT_CELLS = Object.freeze([
  Object.freeze({ x: 2, y: 3 }), Object.freeze({ x: 0, y: 2 }), Object.freeze({ x: 2, y: 2 }),
  Object.freeze({ x: 0, y: 1 }), Object.freeze({ x: 2, y: 1 }),
])
export const LIFT_LEVELS = Object.freeze([1, 2, 3, 4])
export const LIFT_CELL_BY_LEVEL = Object.freeze({
  1: Object.freeze({ x: 1, y: 0 }), 2: Object.freeze({ x: 1, y: 1 }),
  3: Object.freeze({ x: 1, y: 2 }), 4: Object.freeze({ x: 1, y: 3 }),
})
export const LIFT_LEVEL_BY_ROUTE = Object.freeze({ west: 1, east: 4 })
export function levelOfCell(cell) { return Number(cell?.y) + 1 }
export function levelOfLocation(state, locationId) {
  const cell = state?.locations?.find(loc => loc.id === locationId)?.grid
  return cell ? Number(cell.y) + 1 : null
}

export const LOCATION_CELLS = Object.freeze({
  westAntechamber: Object.freeze({ x: 0, y: 0 }),
  eastAntechamber: Object.freeze({ x: 2, y: 0 }),
  ancientAltar: Object.freeze({ x: 3, y: 0 }),
  twistingCatwalks: Object.freeze({ x: 0, y: 3 }),
  greatLift: Object.freeze({ x: 1, y: 0 }),
})
// 桌面展示坐标：6 张档案库都有确定性槽位（被移出的一张用备用槽位展示）。
export const LOCATION_COORDINATES = Object.freeze({
  ...LOCATION_CELLS,
  archiveOfTheStars: Object.freeze({ x: 2, y: 3 }),
  archiveOfTheAncients: Object.freeze({ x: 0, y: 2 }),
  archiveOfDreams: Object.freeze({ x: 2, y: 2 }),
  archiveOfConflict: Object.freeze({ x: 0, y: 1 }),
  archiveOfHistory: Object.freeze({ x: 2, y: 1 }),
  archiveOfMemory: Object.freeze({ x: 4, y: 1 }),
})

const FIXED_TABLE = Object.freeze([
  Object.freeze([WEST_ANTECHAMBER_ID, '11619', { clues: 1, revealed: true }]),
  Object.freeze([EAST_ANTECHAMBER_ID, '11620', { clues: 1, revealed: true }]),
  Object.freeze([ANCIENT_ALTAR_ID, '11623', { clues: 2, revealed: true, hasVictory: true, victory: 1 }]),
  Object.freeze([TWISTING_CATWALKS_ID, '11621', { clues: 1, revealed: true }]),
  Object.freeze([GREAT_LIFT_ID, '11622', { clues: 1, revealed: true }]),
])
const ARCHIVE_TABLE = Object.freeze(ARCHIVE_IDS.map(id => Object.freeze([id, ARCHIVE_CODES[id], { clues: null, unrevealed: true, archive: true }])))

function makeLocation(id, code, extra) {
  const card = ALL_CARDS[code]
  const base = location({
    id, code,
    clues: extra.clues ?? card.clues,
    ...(extra.hasVictory || extra.victory != null ? { hasVictory: true, victory: extra.victory } : {}),
    ...extra,
  })
  if (extra.unrevealed) {
    base.unrevealedName = card.backNameZh || card.backName || '崩塌档案库 Crumbling Archives'
    base.unrevealedNameEn = card.backName || 'Crumbling Archives'
    // 未揭示面（崩塌档案库）的印刷数值：线索 0、隐藏值 2。
    base.unrevealedClues = 0
  }
  return base
}

export const LOCATIONS = Object.freeze(Object.fromEntries([
  ...FIXED_TABLE.map(([id, code, extra]) => [id, makeLocation(id, code, extra)]),
  ...ARCHIVE_TABLE.map(([id, code, extra]) => [id, makeLocation(id, code, extra)]),
]))
export const LOCATION_IDS = Object.freeze(Object.keys(LOCATIONS))
// 「地点之间除大升降机、连接图标或卡牌效果外都不相连」：网格邻接策略 none；静态连接只有祭坛图标。
export const CONNECTION_POLICY = 'none'
export const LOCATION_CONNECTIONS = Object.freeze({
  westAntechamber: Object.freeze([]),
  eastAntechamber: Object.freeze([ANCIENT_ALTAR_ID]),
  ancientAltar: Object.freeze([EAST_ANTECHAMBER_ID]),
  twistingCatwalks: Object.freeze([]),
  greatLift: Object.freeze([]),
  ...Object.fromEntries(ARCHIVE_IDS.map(id => [id, Object.freeze([])])),
})
// 印刷图标连接写进地点定义（layoutFor 只投影真实规则连接）。
for (const [id, connections] of Object.entries(LOCATION_CONNECTIONS)) {
  if (LOCATIONS[id]) LOCATIONS[id].connections = [...connections]
}
export const SET_ASIDE_LOCATION_IDS = Object.freeze([])

/** 崩塌档案库：6 张洗牌，随机移出 1 张，其余 5 张按环位入场。 */
export function archivesDeck(random = () => 0.5) {
  const pool = [...ARCHIVE_IDS]
  for (let index = pool.length - 1; index > 0; index -= 1) {
    const pick = Math.floor(random() * (index + 1))
    ;[pool[index], pool[pick]] = [pool[pick], pool[index]]
  }
  return { removed: pool[0], inPlay: pool.slice(1), slots: [...ARCHIVE_SLOT_CELLS] }
}

// ---------------------------------------------------------------------------
// 幕 / 议程阶段（路线分支）
// ---------------------------------------------------------------------------
export const ACT_STAGES = Object.freeze({
  1: Object.freeze({
    ...stage(ACT1_CODE, { stage: 1 }),
    objective: { type: 'liftActive' },
    discardCount: 5,
    discardCountSolo: 8,
  }),
  2: Object.freeze({
    ...stage(ESCAPE_V1_CODE, { stage: 2 }),
    objective: { type: 'resignedAll' },
    route: 'west',
  }),
  2.5: Object.freeze({
    ...stage(ESCAPE_V2_CODE, { stage: 2 }),
    objective: { type: 'resignedAll' },
    route: 'east',
  }),
})
export const AGENDA_STAGES = Object.freeze({
  1: Object.freeze({
    ...stage(RUINED_ARCHIVES_CODE, { stage: 1 }),
    route: 'west',
    shuffleOmenGlyph: true,
  }),
  1.5: Object.freeze({
    ...stage(FLOODED_ARCHIVES_CODE, { stage: 1 }),
    route: 'east',
    shuffleOmenGlyph: true,
    lowerFloodAll: true,
  }),
  2: Object.freeze({
    ...stage(UNSTABLE_FOUNDATIONS_CODE, { stage: 2 }),
    enemyPhaseVerticalConnections: true,
    liftMovedAgilityTest: { difficulty: 2, damage: 1 },
  }),
})
export const ACTS_BY_ROUTE = Object.freeze({
  west: Object.freeze([ACT_STAGES[1], ACT_STAGES[2]]),
  east: Object.freeze([ACT_STAGES[1], ACT_STAGES[2.5]]),
})
export const AGENDAS_BY_ROUTE = Object.freeze({
  west: Object.freeze([AGENDA_STAGES[1], AGENDA_STAGES[2]]),
  east: Object.freeze([AGENDA_STAGES[1.5], AGENDA_STAGES[2]]),
})
export const ACT_CODE_BY_ROUTE = Object.freeze({
  west: ACT_STAGES[2].code, east: ACT_STAGES[2.5].code,
})
export const STAGE_ROUTE_BY_CODE = Object.freeze({
  [RUINED_ARCHIVES_CODE]: 'west', [FLOODED_ARCHIVES_CODE]: 'east',
  [ESCAPE_V1_CODE]: 'west', [ESCAPE_V2_CODE]: 'east',
})

// ---------------------------------------------------------------------------
// 遭遇定义（数值/关键词取印刷数据）
// ---------------------------------------------------------------------------
export const ENCOUNTER_DEFINITION_CODES = Object.freeze([
  ...ENCOUNTER_DECK_CODES, ...ENEMY_CODES, ...TREACHERY_CODES, ...STORY_ASSET_CODES,
  ...Object.keys(ARCHIVE_CODES).map(id => ARCHIVE_CODES[id]),
])
export const { enemies, treacheries, storyAssets } = encounterDefinitions(ENCOUNTER_DEFINITION_CODES)
export const ENEMY_DEFINITIONS = enemies
export const TREACHERY_DEFINITIONS = treacheries
export const STORY_ASSET_DEFINITIONS = storyAssets

// ---------------------------------------------------------------------------
// 剧情正文
// ---------------------------------------------------------------------------
const text = value => (value == null ? '' : String(value))
const blocks = (...parts) => parts.map(text).filter(Boolean).join('\n\n')
export const INTRO_BRANCHES = Object.freeze({
  courtOfTheAncients1: blocks(TEXT.intro.courtOfTheAncients1),
  courtOfTheAncients2: blocks(TEXT.intro.courtOfTheAncients2, TEXT.intro.courtOfTheAncients2Ruby, TEXT.intro.courtOfTheAncients2Conclusion),
})
export const SETUP_STEPS = Object.freeze(TEXT.setup.steps.map(step => ({
  key: step.key, text: text(step.text),
  when: step.key.startsWith('west') ? 'headedWest'
    : step.key.startsWith('east') ? 'headedEast'
      : step.key === 'creatureWasDefeated' ? 'creatureDefeated'
        : step.key === 'otherwise' ? 'creatureNotDefeated' : undefined,
})))
const specialRules = Object.values(TEXT.rules || {}).map(rule => ({ title: text(rule.title), body: text(rule.body) }))
export const SCENARIO_TEXT = Object.freeze({
  textLanguage: 'en',
  textStatus: TEXT.textStatus,
  heading: TEXT.heading,
  intro: blocks(TEXT.intro.checkCampaignLog, TEXT.intro.headedWest, TEXT.intro.headedEast),
  introBranches: INTRO_BRANCHES,
  introLeadIn: Object.freeze({
    headedWest: text(TEXT.intro.headedWest),
    headedEast: text(TEXT.intro.headedEast),
    plumbTheDepths: text(TEXT.intro.resolvePlumbTheDepths),
    proceedToSetup: text(TEXT.intro.proceedToSetup),
    plumbTheDepthsStory: TEXT.intro.plumbTheDepths,
  }),
  setup: SETUP_STEPS.map(step => step.text).filter(Boolean).join('\n\n'),
  setupSteps: SETUP_STEPS,
  specialRules: Object.freeze(specialRules),
  rules: TEXT.rules,
  labels: TEXT.labels,
  cosmicOmen: TEXT.cosmicOmen,
  tokens: Object.freeze({
    easyStandard: Object.freeze({ ...TEXT.tokens.easyStandard }),
    hardExpert: Object.freeze({ ...TEXT.tokens.hardExpert }),
  }),
  resolutions: Object.freeze(Object.fromEntries(RESOLUTION_KEYS
    .map(key => [key, blocks(TEXT.resolutions[key]?.title, TEXT.resolutions[key]?.body)]))),
  xp: TEXT.resolutions.xp,
})

export const scenario = {
  id: CHAPTER_ID,
  originalCode: REFERENCE_CODE,
  referenceCode: REFERENCE_CODE,
  name: '古代议庭 · Court of the Ancients',
  nameEn: 'Court of the Ancients',
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
  setAsideLocations: [...SET_ASIDE_LOCATION_IDS],
  setAsideAliases: [...SET_ASIDE_ALIASES],
  connectByGrid: CONNECTION_POLICY,
  acts: ACTS_BY_ROUTE.west.map(act => structuredClone(act)),
  agendas: AGENDAS_BY_ROUTE.west.map(agenda => structuredClone(agenda)),
  stageCards: Object.freeze(Object.fromEntries([
    ...Object.values(ACT_STAGES), ...Object.values(AGENDA_STAGES),
  ].map(stageCard => [stageCard.code, structuredClone(stageCard)]))),
  enemies,
  treacheries,
  storyAssets,
  encounterDeck: [...ENCOUNTER_DECK],
  resolutions: { ...SCENARIO_TEXT.resolutions },
  tokenMeanings: {
    easy: { ...COURT_TOKEN_MEANINGS.easy },
    standard: { ...COURT_TOKEN_MEANINGS.standard },
    hard: { ...COURT_TOKEN_MEANINGS.hard },
    expert: { ...COURT_TOKEN_MEANINGS.expert },
  },
  // 求取空气（淹没档案塔正面强制）走引擎通用 water.air 原语。
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
  ...Object.values(ACT_STAGES).map(act => act.code),
  ...Object.values(AGENDA_STAGES).map(agenda => agenda.code),
  ...LOCATION_IDS.map(id => LOCATIONS[id].code),
  ...ENCOUNTER_DEFINITION_CODES,
].map(code => [code, ALL_CARDS[code]])))
