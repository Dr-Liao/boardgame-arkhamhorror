// 汉洛克庄园（hemlockHouse · 提示卡 10523）· 章节数据（scenario 只含数据）。
//
// 参考：Scenario/Scenarios/TheFeastOfHemlockVale/HemlockHouse.hs +
//       Scenarios/TheFeastOfHemlockVale/HemlockHouse/{Helpers,PredationBag}.hs +
//       Act|Agenda|Location|Enemy|Treachery|Story/CardDefs|Cards/TheFeastOfHemlockVale/HemlockHouse/*.hs +
//       EnemyLocation/Cards.hs（10532b–10543b、10547）+
//       frontend/src/locales/en/theFeastOfHemlockVale/hemlockHouse.json（经 story-access.js 读取）。
//
// 卡号归属（input.cards，38 条）：10524/10524b 双面剧情卡（猎杀之屋 / 猎杀检定）、10525–10528 议程、
// 10529–10531 幕、10532–10543 十二间房（正/背 12 对地点↔敌人-地点）、10544 敌人、10545/10546 诡计、
// 10547 失形地窖（单面敌人-地点）、10548 小西尔维。
//
// 印刷事实一律从 card-data.js 读取（`printed/location/stage/encounterDefinitions`）；地点是 3 列 × 4 层
// 网格（地窖 0 层在门厅下方），除第一层三间房固定外，其余房间的坐标由 behavior 在布置时随机分配，
// 因此 `LOCATION_CONNECTIONS` 只声明**印刷确定**的第一层走廊（客厅↔门厅↔餐厅），其余连接是网格
// 正交相邻规则（`GRID_ADJACENCY`，见 layout.js），由 behavior.syncConnections 在入场/滑动后重算。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { bindScenarioIdentities } from '../../../../identities.js'
import {
  encounterDefinitions, encounterGroupDeck, identitiesFor, location, printed, stage,
} from '../../card-data.js'
import { chapterChineseGaps, chapterLeaves, flattenStory } from '../../story-access.js'
import { HEMLOCK_TOKEN_MEANINGS } from './chaos.js'

export const CHAPTER_ID = 'hemlockHouse'
export const REFERENCE_CODE = '10523'

// ---------------------------------------------------------------------------
// 卡号常量
// ---------------------------------------------------------------------------

export const PREDATORY_HOUSE_CODE = '10524'
export const PREDATION_TEST_CODE = '10524b'
export const STORY_CODES = Object.freeze([PREDATORY_HOUSE_CODE, PREDATION_TEST_CODE])

export const EERIE_SILENCE_CODE = '10525'
export const HOUSE_STIRS_V1_CODE = '10526'
export const HOUSE_STIRS_V2_CODE = '10527'
export const LIVING_WALLS_CODE = '10528'
export const STRANGE_INFESTATION_CODE = '10529'
export const AGAINST_THE_HOUSE_CODE = '10530'
export const HEART_OF_THE_HOUSE_CODE = '10531'
export const GRAPPLING_SPAWN_CODE = '10544'
export const OUT_OF_THE_WALLS_CODE = '10545'
export const PULLED_IN_CODE = '10546'
export const SHAPELESS_CELLAR_CODE = '10547'
export const LITTLE_SYLVIE_CODE = '10548'
export const FIRE_CODE = '10743'
// 居民（*Residents* 遭遇组，由共享组 worker 建条目）：本关只在布置/法典里按卡号放置。
export const WILLIAM_HEMLOCK_CODE = '10696'
export const GIDEON_MIZRAH_CODE = '10698'
export const JUDITH_PARK_CODE = '10699'
export const THEO_PETERS_CODE = '10700'
export const RESIDENT_CODES = Object.freeze([GIDEON_MIZRAH_CODE, WILLIAM_HEMLOCK_CODE,
  JUDITH_PARK_CODE, THEO_PETERS_CODE])

export const ACT_CODES = Object.freeze([STRANGE_INFESTATION_CODE, HEART_OF_THE_HOUSE_CODE])
export const SET_ASIDE_ACT_CODES = Object.freeze([AGAINST_THE_HOUSE_CODE])
export const AGENDA_CODES = Object.freeze([EERIE_SILENCE_CODE, HOUSE_STIRS_V1_CODE, LIVING_WALLS_CODE])
export const AGENDA_VARIANT_CODES = Object.freeze({ v1: HOUSE_STIRS_V1_CODE, v2: HOUSE_STIRS_V2_CODE })

// ---------------------------------------------------------------------------
// 遭遇组（Setup：Hemlock House / Agents of the Colour / Blight / Fire! / Transfiguration /
// Locked Doors / Rats + 当日组；Residents 整组收集后放一边，按日/时段把个别居民放入场）
// ---------------------------------------------------------------------------

export const GATHER_GROUPS = Object.freeze([
  'hemlockHouse', 'agentsOfTheColour', 'blight', 'fire', 'transfiguration', 'lockedDoors', 'rats',
])
export const GATHER_SET_ASIDE_GROUPS = Object.freeze(['residents'])
export const DAY_ENCOUNTER_GROUPS = Object.freeze({
  1: 'theFirstDay', 2: 'theSecondDay', 3: 'theFinalDay',
})
// Setup：「Set all five Fire! treacheries and all copies of the Out of the Walls and Pulled In
// treacheries aside, out of play.」——它们不进初始牌库，由议程 1b/2b 洗入。
export const SET_ASIDE_TREACHERY_CODES = Object.freeze([FIRE_CODE, OUT_OF_THE_WALLS_CODE, PULLED_IN_CODE])
export const FIRE_COPIES = Math.max(1, Number(ALL_CARDS[FIRE_CODE]?.quantity) || 5)
export const OUT_OF_THE_WALLS_COPIES = Math.max(1, Number(ALL_CARDS[OUT_OF_THE_WALLS_CODE]?.quantity) || 4)
export const PULLED_IN_COPIES = Math.max(1, Number(ALL_CARDS[PULLED_IN_CODE]?.quantity) || 2)

export const ENCOUNTER_DECK = Object.freeze(encounterGroupDeck(GATHER_GROUPS, {
  exclude: [...SET_ASIDE_TREACHERY_CODES],
}))
export const ENCOUNTER_DECK_CODES = Object.freeze([...new Set(ENCOUNTER_DECK)])
export const DAY_ENCOUNTER_DECKS = Object.freeze(Object.fromEntries([1, 2, 3].map(day => [
  day, Object.freeze(encounterGroupDeck([DAY_ENCOUNTER_GROUPS[day]])),
])))

// 放一边（out of play）的物理卡：5 张 Fire!、全部 Out of the Walls / Pulled In、猎杀之屋剧情卡、
// 放一边的幕 2a「Against the House」。随机放一边的那一张卧室（4 选 1）只能在布置时确定，
// 因此不进这张静态表（见 behavior.prepareScenario 的 `asideBedroom`）。
export const SET_ASIDE_CARDS = Object.freeze([
  ...Array(FIRE_COPIES).fill(FIRE_CODE),
  ...Array(OUT_OF_THE_WALLS_COPIES).fill(OUT_OF_THE_WALLS_CODE),
  ...Array(PULLED_IN_COPIES).fill(PULLED_IN_CODE),
  PREDATORY_HOUSE_CODE,
  AGAINST_THE_HOUSE_CODE,
])

// ---------------------------------------------------------------------------
// 地点（12 间房正/背 + 失形地窖）
// ---------------------------------------------------------------------------

// [id, 地点卡号, 敌人-地点卡号, 房间种类]
export const LOCATION_TABLE = Object.freeze([
  ['bedroom32', '10532', '10532b', 'bedroom'],
  ['bedroom33', '10533', '10533b', 'bedroom'],
  ['bedroom34', '10534', '10534b', 'bedroom'],
  ['bedroom35', '10535', '10535b', 'bedroom'],
  ['washroom36', '10536', '10536b', 'washroom'],
  ['washroom37', '10537', '10537b', 'washroom'],
  ['washroom38', '10538', '10538b', 'washroom'],
  ['library39', '10539', '10539b', 'library'],
  ['library40', '10540', '10540b', 'library'],
  ['parlor', '10541', '10541b', 'parlor'],
  ['diningRoom', '10542', '10542b', 'diningRoom'],
  ['foyer', '10543', '10543b', 'foyer'],
])
export const CELLAR_ID = 'shapelessCellar'

export const ROOM_IDS = Object.freeze(LOCATION_TABLE.map(([id]) => id))
export const ALL_LOCATION_IDS = Object.freeze([...ROOM_IDS, CELLAR_ID])
export const ENEMY_LOCATION_CODE_BY_LOCATION = Object.freeze(Object.fromEntries(
  LOCATION_TABLE.map(([id, , enemyCode]) => [id, enemyCode]),
))
export const LOCATION_CODE_BY_ID = Object.freeze({
  ...Object.fromEntries(LOCATION_TABLE.map(([id, code]) => [id, code])),
  [CELLAR_ID]: SHAPELESS_CELLAR_CODE,
})

// 第一层固定三间房（Setup: place the Parlor, Foyer, and Dining Room in a row exactly as shown）。
export const FIRST_FLOOR = Object.freeze({
  parlor: Object.freeze({ x: -1, y: 0 }),
  foyer: Object.freeze({ x: 0, y: 0 }),
  diningRoom: Object.freeze({ x: 1, y: 0 }),
})
// 第二、三层：随机 6 间（三层 3 间 + 四层 3 间，`x` 从左到右）。
export const RANDOM_SLOTS = Object.freeze([
  Object.freeze({ x: -1, y: 1 }), Object.freeze({ x: 0, y: 1 }), Object.freeze({ x: 1, y: 1 }),
  Object.freeze({ x: -1, y: 2 }), Object.freeze({ x: 0, y: 2 }), Object.freeze({ x: 1, y: 2 }),
])
// 四层中列：放一边的卧室（Setup: put the set-aside Bedroom into play in the middle column on the
// 4th Floor）。
export const TOP_BEDROOM_SLOT = Object.freeze({ x: 0, y: 3 })
// 地窖层（Locations 10547：放置位置「as close to the middle column as possible」→ 中列下方）。
export const CELLAR_SLOT = Object.freeze({ x: 0, y: -1 })
export const START_LOCATION = 'foyer'

// 随机池：除第一层三间房外的 9 个房间；其中随机 1 间卧室放到四层中列，其余 8 间洗匀后取 6 间
// 放到第二/三层，剩 2 间移出游戏。
export const SHUFFLE_POOL_IDS = Object.freeze(ROOM_IDS.filter(id => !Object.hasOwn(FIRST_FLOOR, id)))
export const BEDROOM_IDS = Object.freeze(LOCATION_TABLE.filter(([, , , kind]) => kind === 'bedroom').map(([id]) => id))

// 印刷确定的连接：第一层走廊（客厅↔门厅↔餐厅）。第二层以上都是「与相邻地点相连」（网格正交
// 相邻，见 layout.js#GRID_ADJACENCY），连接随房间随机分配与滑动重算，不写死在表里。
export const LOCATION_CONNECTIONS = Object.freeze({
  parlor: Object.freeze(['foyer']),
  foyer: Object.freeze(['parlor', 'diningRoom']),
  diningRoom: Object.freeze(['foyer']),
  [CELLAR_ID]: Object.freeze([]),
})
export const GRID_ADJACENCY = 'orthogonal'

// 每间房的 clues：卧室/盥洗室/藏书室/门厅 1[per_investigator]；客厅 2[per_investigator]；
// 餐厅 3[per_investigator]；失形地窖印刷 3（固定值，入场时放置）。victory 取印刷值。
// 卧室帷幕 = 楼层 + 1（印刷 X），definition 里先给 1 层占位值，布置/滑动时由 behavior 重算。
const ROOM_CLUES_PER_INVESTIGATOR = Object.freeze({
  bedroom32: 1, bedroom33: 1, bedroom34: 1, bedroom35: 1,
  washroom36: 1, washroom37: 1, washroom38: 1,
  library39: 1, library40: 1, parlor: 2, diningRoom: 3, foyer: 1,
})
export const BEDROOM_SHROUD_RULE = 'floorPlusOne'

function roomDefinition(id, code, kind) {
  const card = ALL_CARDS[code]
  const bedrooms = kind === 'bedroom'
  return location({
    id, code,
    clues: ROOM_CLUES_PER_INVESTIGATOR[id],
    hasVictory: Object.hasOwn(card, 'victory'),
    victory: Number(card.victory) || 0,
    links: [],
    connections: [...(LOCATION_CONNECTIONS[id] || [])],
    ...(bedrooms ? { shroud: 1, printedShroud: Number(card.shroud) || 0, shroudRule: BEDROOM_SHROUD_RULE } : {}),
    ...(id === START_LOCATION ? { resign: true } : {}),
  })
}

export const LOCATIONS = Object.freeze(Object.fromEntries([
  ...LOCATION_TABLE.map(([id, code, , kind]) => [id, roomDefinition(id, code, kind)]),
  [CELLAR_ID, (() => {
    const cellar = location({
      id: CELLAR_ID, code: SHAPELESS_CELLAR_CODE, clues: 3, cluesFixed: true,
      hasVictory: true, victory: Number(ALL_CARDS[SHAPELESS_CELLAR_CODE]?.victory) || 1,
      links: [], connections: [...LOCATION_CONNECTIONS[CELLAR_ID]],
    })
    // 失形地窖没有地点面：它一入场就是敌人-地点（EnemyLocation/Cards.hs#shapelessCellarDef）。
    cellar.enemyLocationOnly = true
    cellar.cannotBeFlipped = true
    cellar.cannotBeSealed = true
    return cellar
  })()],
]))

// 敌人-地点面（背面）数据：名称/特性取印刷，数值取印刷字段。behavior 翻面时把这份数据交给
// 引擎 `api.turnLocationIntoEnemy`（或直调路径的本地实现）。
function enemyLocationFace(locationId) {
  const code = ENEMY_LOCATION_CODE_BY_LOCATION[locationId]
  const card = code ? ALL_CARDS[code] : null
  if (!card) return null
  const facet = printed(code)
  return Object.freeze({
    code, name: facet.name, nameEn: facet.nameEn,
    fight: Number(card.fight) || 0, evade: Number(card.evade) || 0,
    health: Number(card.health) || 1, damage: Number(card.damage) || 0, horror: Number(card.horror) || 0,
    victory: Number(card.victory) || 0, shroud: Number(card.shroud) || 0,
    traits: [...(card.traits || [])],
    retaliate: /Retaliate\./.test(String(card.text || '')),
    elite: true,
  })
}
export const ENEMY_LOCATION_FACES = Object.freeze(Object.fromEntries(
  ROOM_IDS.map(id => [id, enemyLocationFace(id)]).filter(([, face]) => face),
))
export const CELLAR_ENEMY_FACE = Object.freeze({
  code: SHAPELESS_CELLAR_CODE,
  ...printed(SHAPELESS_CELLAR_CODE),
  fight: Number(ALL_CARDS[SHAPELESS_CELLAR_CODE]?.fight) || 3,
  evade: Number(ALL_CARDS[SHAPELESS_CELLAR_CODE]?.evade) || 2,
  health: Number(ALL_CARDS[SHAPELESS_CELLAR_CODE]?.health) || 5,
  damage: Number(ALL_CARDS[SHAPELESS_CELLAR_CODE]?.damage) || 1,
  horror: Number(ALL_CARDS[SHAPELESS_CELLAR_CODE]?.horror) || 2,
  victory: Number(ALL_CARDS[SHAPELESS_CELLAR_CODE]?.victory) || 1,
  shroud: Number(ALL_CARDS[SHAPELESS_CELLAR_CODE]?.shroud) || 4,
  traits: [...(ALL_CARDS[SHAPELESS_CELLAR_CODE]?.traits || [])],
  massive: true, retaliate: true, elite: true, singleSided: true,
})

// 敌人-地点背面被揭示时的强制效果（卡面 Forced；读点：behavior.flipToEnemySide）。
export const ENEMY_LOCATION_REVEAL_EFFECTS = Object.freeze({
  '10532b': 'doomOnIt',
  '10533b': 'attacksHere',
  '10534b': 'predationTest',
  '10535b': 'attacksHere',
  '10536b': 'attacksHereIfClues',
  '10537b': 'attacksHereIfClues',
  '10538b': 'discardRandomPerClue',
  '10539b': 'loseResources',
  '10540b': 'horror',
  '10541b': 'attacksHere',
  '10542b': 'predationTest',
  '10543b': 'attacksHere',
  [SHAPELESS_CELLAR_CODE]: null,
})
// 按地点 id 的读表（翻面时只知道地点 id）。
export const ENEMY_LOCATION_REVEAL_EFFECT_BY_LOCATION = Object.freeze(Object.fromEntries(
  Object.entries(ENEMY_LOCATION_CODE_BY_LOCATION)
    .map(([id, code]) => [id, ENEMY_LOCATION_REVEAL_EFFECTS[code] || null]),
))

// ---------------------------------------------------------------------------
// 幕 / 议程
// ---------------------------------------------------------------------------

export const ACT_STAGES = Object.freeze({
  strangeInfestation: Object.freeze(stage(STRANGE_INFESTATION_CODE, {
    objective: { type: 'seals', count: 7 },
  })),
  heartOfTheHouse: Object.freeze(stage(HEART_OF_THE_HOUSE_CODE, {
    objective: { type: 'cellarVictory' },
  })),
  againstTheHouse: Object.freeze(stage(AGAINST_THE_HOUSE_CODE, {
    objective: { type: 'noLocations' },
  })),
})
export const AGENDA_STAGES = Object.freeze({
  eerieSilence: Object.freeze(stage(EERIE_SILENCE_CODE)),
  houseStirsV1: Object.freeze(stage(HOUSE_STIRS_V1_CODE)),
  houseStirsV2: Object.freeze(stage(HOUSE_STIRS_V2_CODE)),
  livingWalls: Object.freeze(stage(LIVING_WALLS_CODE)),
})

/** Setup：Day/Night 1 或 Day 3 用议程 2a v.I，其余用 v.II（另一张移出游戏）。 */
export function agendaUseV1({ day, period }) {
  return Number(day) === 1 || (Number(day) === 3 && period === 'day')
}
export function agendaDeckForDate(date) {
  // 返回可变副本：identities.js 会把原卡身份写回定义对象（AGENDA_STAGES 自身是冻结常量）。
  return Object.freeze([
    structuredClone(AGENDA_STAGES.eerieSilence),
    structuredClone(agendaUseV1(date) ? AGENDA_STAGES.houseStirsV1 : AGENDA_STAGES.houseStirsV2),
    structuredClone(AGENDA_STAGES.livingWalls),
  ])
}
export const AGENDAS = Object.freeze(agendaDeckForDate({ day: 1, period: 'day' }))
export const ACTS = Object.freeze([
  structuredClone(ACT_STAGES.strangeInfestation),
  structuredClone(ACT_STAGES.heartOfTheHouse),
])
export const SET_ASIDE_ACTS = Object.freeze([structuredClone(ACT_STAGES.againstTheHouse)])

// ---------------------------------------------------------------------------
// 居民 / 法典（居民规则：布置时按日/时段入场；法典由 behavior 结算，见 behavior.codex）
// ---------------------------------------------------------------------------

// Setup「residents」：只有在时段为 Day 时才收集 *Residents* 并放入对应居民。
export const RESIDENT_SETUP = Object.freeze({
  gideon: Object.freeze({ code: GIDEON_MIZRAH_CODE, days: [1], location: 'parlor' }),
  william: Object.freeze({ code: WILLIAM_HEMLOCK_CODE, days: [1, 2], location: 'topBedroom' }),
  judith: Object.freeze({ code: JUDITH_PARK_CODE, days: [2, 3], location: 'parlor' }),
  theo: Object.freeze({ code: THEO_PETERS_CODE, days: [3], location: 'foyer' }),
})
// 「found Little Sylvie」记录（Resolution 2：「If the investigators 'found Little Sylvie'…」）。
export const RECORD_KEYS = Object.freeze({
  foundLittleSylvie: 'foundLittleSylvie',
  youAreHelpingGideon: 'youAreHelpingGideon',
  judithIsRemodeling: 'judithIsRemodeling',
  gideonRelationship: 'gideonMizrahRelationshipLevel',
  williamRelationship: 'williamHemlockRelationshipLevel',
  judithRelationship: 'judithParkRelationshipLevel',
  areasSurveyed: 'areasSurveyed',
  resolution: 'hemlockHouseResolution',
  seals: 'hemlockHouseSeals',
  enemyLocations: 'hemlockHouseEnemyLocations',
  predationTokens: 'hemlockHousePredationTokens',
})
export const AREAS_SURVEYED_HEMLOCK_HARBOR = 'hemlockHarbor'

export const CODEX_ENTRY_IDS = Object.freeze(['william', 'gideon', 'judith', 'theo', 'marquez', 'argument'])
export const CODEX_BRANCH_IDS = Object.freeze({
  william: Object.freeze(['day1FoundSylvie', 'day1Otherwise', 'day2Argument', 'day2Otherwise']),
  gideon: Object.freeze(['helping', 'otherwise']),
  judith: Object.freeze(['day2Argument', 'day2Otherwise', 'day3']),
  theo: Object.freeze(['theo']),
  marquez: Object.freeze(['marquez']),
  argument: Object.freeze(['argument1', 'argument2', 'argument3']),
})

// ---------------------------------------------------------------------------
// 掠食袋（The Predatory House 正面 + 猎杀检定背面）
// ---------------------------------------------------------------------------

export const PREDATION_BAG_ID = 'predation'
// 基础袋 = [cultist, tablet, elder_thing]；再加当日份数的 cultist（PredationBag.hs#initPredationBag +
// 10524 正面「Day 1: add 2 cultist / Day 2: add 1 cultist / Day 3: none」）。
export const PREDATION_BASE_TOKENS = Object.freeze(['cultist', 'tablet', 'elderthing'])
export const PREDATION_DAY_CULTISTS = Object.freeze({ 1: 2, 2: 1, 3: 0 })
export function predationBagTokens(day) {
  const extra = Number(PREDATION_DAY_CULTISTS[Number(day)] ?? 0)
  return [...PREDATION_BASE_TOKENS, ...Array(Math.max(0, extra)).fill('cultist')]
}

// ---------------------------------------------------------------------------
// 结局
// ---------------------------------------------------------------------------

export const RESOLUTION_KEYS = Object.freeze(['noResolution', 'resolution1', 'resolution2'])
// Resolution 1 与 No Resolution 都「proceed/skip to Resolution 2」；Resolution 2 是唯一结算页。
export const RESOLUTION_RECORD = Object.freeze({
  noResolution: 'resolution2',
  resolution1: 'resolution2',
  resolution2: 'resolution2',
})

// ---------------------------------------------------------------------------
// 剧本正文（story-text.js 是生成物；本关没有本地中译，叶子全部回退英文并在 chineseGaps 披露）
// ---------------------------------------------------------------------------

const LEAVES = chapterLeaves(CHAPTER_ID)
const LEAF = new Map(LEAVES.map(leaf => [leaf.key, leaf]))
const text = key => {
  const leaf = LEAF.get(key)
  return leaf ? (leaf.zh || leaf.en || '') : ''
}
const blocks = (...keys) => keys.map(text).filter(Boolean).join('\n\n')
export const CHINESE_GAPS = Object.freeze(chapterChineseGaps(CHAPTER_ID))
export const TEXT_LANGUAGE = LEAVES.some(leaf => leaf.translated) ? 'zh-CN' : 'en'
export const TEXT_STATUS = TEXT_LANGUAGE === 'zh-CN'
  ? 'partially self-translated (see chineseGaps)'
  : 'source text only (en; chineseGaps lists every untranslated leaf)'

const SETUP_KEYS = Object.freeze([
  'gatherSets', 'currentDaySet', 'currentDayMarker', 'againstTheHouse', 'houseStirsV1', 'houseStirsV2',
  'locations', 'firstFloor', 'shuffleFloors', 'topBedroom', 'removeRemaining', 'startAtFoyer',
  'startAtBedroom', 'residents', 'gideonAndSylvie', 'william', 'judith', 'theo', 'removeResidents',
  'predatoryHouse', 'setOutOfPlay', 'shuffleEncounter',
])
const ENEMY_LOCATION_RULE_KEYS = Object.freeze(['noMove', 'keepEntities', 'sealed', 'unsealed', 'defeat',
  'noAbove', 'middleEmpty'])
const PREDATION_TEST_KEYS = Object.freeze(['cultist', 'tablet', 'elderthing', 'unknown'])

export const SCENARIO_TEXT = Object.freeze({
  textLanguage: TEXT_LANGUAGE,
  textStatus: TEXT_STATUS,
  chineseGaps: CHINESE_GAPS,
  heading: text('intro.title'),
  intro: Object.freeze({
    title: text('intro.title'),
    body: text('intro.body'),
    nightSkip: text('intro.nightSkip'),
    day1: text('intro.day1'),
    day2: text('intro.day2'),
    day3: text('intro.day3'),
    intro1: Object.freeze({ title: text('intro.intro1.title'), body: text('intro.intro1.body') }),
    intro2: Object.freeze({ title: text('intro.intro2.title'), body: text('intro.intro2.body') }),
    intro3: Object.freeze({ title: text('intro.intro3.title'), body: text('intro.intro3.body') }),
    intro4: Object.freeze({ title: text('intro.intro4.title'), body: text('intro.intro4.body') }),
  }),
  setup: blocks(...SETUP_KEYS.map(key => `setup.${key}`)),
  setupSteps: Object.freeze(SETUP_KEYS.map(key => Object.freeze({ key, text: text(`setup.${key}`) }))
    .filter(step => step.text)),
  specialRules: Object.freeze([
    Object.freeze({ title: text('specialRules[0].title'), body: text('specialRules[0].body') }),
    Object.freeze({
      title: text('enemyLocations.title'),
      body: blocks('enemyLocations.body', ...ENEMY_LOCATION_RULE_KEYS.map(key => `enemyLocations.${key}`)),
    }),
  ].filter(rule => rule.title || rule.body)),
  enemyLocations: Object.freeze({
    title: text('enemyLocations.title'),
    body: text('enemyLocations.body'),
    rules: Object.freeze(Object.fromEntries(ENEMY_LOCATION_RULE_KEYS.map(key => [key, text(`enemyLocations.${key}`)]))),
  }),
  predationTest: Object.freeze({
    title: text('predationTest.title'),
    ...Object.fromEntries(PREDATION_TEST_KEYS.map(key => [key, text(`predationTest.${key}`)])),
  }),
  cost: Object.freeze({ removeSeal: text('cost.removeSeal') }),
  tokens: Object.freeze({
    easyStandard: Object.freeze({
      skull: text('tokens.easyStandard.skull'), cultist: text('tokens.easyStandard.cultist'),
      tablet: text('tokens.easyStandard.tablet'), elderThing: text('tokens.easyStandard.elderThing'),
    }),
    hardExpert: Object.freeze({
      skull: text('tokens.hardExpert.skull'), cultist: text('tokens.hardExpert.cultist'),
      tablet: text('tokens.hardExpert.tablet'), elderThing: text('tokens.hardExpert.elderThing'),
    }),
  }),
  codex: Object.freeze({
    labels: Object.freeze({
      judithRight: text('codex.label.judithRight'),
      williamRight: text('codex.label.williamRight'),
    }),
    william: Object.freeze({
      title: text('codex.william.title'),
      day1FoundSylvie: text('codex.william.day1FoundSylvie'),
      day1Otherwise: text('codex.william.day1Otherwise'),
      day2Argument: text('codex.william.day2Argument'),
      day2Otherwise: text('codex.william.day2Otherwise'),
    }),
    gideon: Object.freeze({
      title: text('codex.gideon.title'),
      helping: text('codex.gideon.helping'),
      otherwise: text('codex.gideon.otherwise'),
    }),
    judith: Object.freeze({
      title: text('codex.judith.title'),
      day2Argument: text('codex.judith.day2Argument'),
      day2Otherwise: text('codex.judith.day2Otherwise'),
      day3: text('codex.judith.day3'),
    }),
    theo: Object.freeze({ title: text('codex.theo.title'), body: text('codex.theo.body') }),
    marquez: Object.freeze({ title: text('codex.marquez.title'), body: text('codex.marquez.body') }),
    argument1: Object.freeze({ title: text('codex.argument1.title'), body: text('codex.argument1.body') }),
    argument2: Object.freeze({ title: text('codex.argument2.title'), body: text('codex.argument2.body') }),
    argument3: Object.freeze({ title: text('codex.argument3.title'), body: text('codex.argument3.body') }),
  }),
  resolutions: Object.freeze({
    noResolution: Object.freeze({
      title: text('resolutions.noResolution.title'),
      body: text('resolutions.noResolution.body'),
    }),
    resolution1: Object.freeze({
      title: text('resolutions.resolution1.title'), body: text('resolutions.resolution1.body'),
    }),
    resolution2: Object.freeze({
      title: text('resolutions.resolution2.title'), body: text('resolutions.resolution2.body'),
    }),
    xp: Object.freeze({
      bonus: text('resolutions.xp.bonus'),
      sealsBonus: text('resolutions.xp.sealsBonus'),
      enemyLocationsBonus: text('resolutions.xp.enemyLocationsBonus'),
    }),
  }),
})

// ---------------------------------------------------------------------------
// scenario
// ---------------------------------------------------------------------------

const definitions = encounterDefinitions([
  ...ENCOUNTER_DECK_CODES, ...SET_ASIDE_TREACHERY_CODES,
  GRAPPLING_SPAWN_CODE,
  LITTLE_SYLVIE_CODE,
  PREDATORY_HOUSE_CODE,
  PREDATION_TEST_CODE,
])

export const scenario = {
  id: CHAPTER_ID,
  originalCode: REFERENCE_CODE,
  name: '汉洛克庄园 · Hemlock House',
  intro: flattenStory(SCENARIO_TEXT.intro.intro1.title) + '\n\n' + flattenStory(SCENARIO_TEXT.intro.intro1.body),
  setup: SCENARIO_TEXT.setup,
  specialRules: SCENARIO_TEXT.specialRules,
  rules: { enemyLocations: SCENARIO_TEXT.enemyLocations, predationTest: SCENARIO_TEXT.predationTest },
  startLocation: START_LOCATION,
  locations: LOCATIONS,
  setAsideLocations: [CELLAR_ID],
  acts: ACTS,
  agendas: AGENDAS,
  ...definitions,
  encounterDeck: [...ENCOUNTER_DECK],
  resolutions: {
    noResolution: SCENARIO_TEXT.resolutions.noResolution.body || '',
    resolution1: SCENARIO_TEXT.resolutions.resolution1.body || '',
    resolution2: SCENARIO_TEXT.resolutions.resolution2.body || '',
  },
  tokenMeanings: {
    easy: { ...HEMLOCK_TOKEN_MEANINGS.easy },
    standard: { ...HEMLOCK_TOKEN_MEANINGS.standard },
    hard: { ...HEMLOCK_TOKEN_MEANINGS.hard },
    expert: { ...HEMLOCK_TOKEN_MEANINGS.expert },
  },
  textLanguage: SCENARIO_TEXT.textLanguage,
  textStatus: SCENARIO_TEXT.textStatus,
}

export const identities = identitiesFor(scenario)
// 12 间房是双面卡：地点面 ↔ 敌人-地点面（manifest 的 backCode 读 linkedOriginalCode）。
for (const [id, identity] of Object.entries(identities.locations || {})) {
  const back = ENEMY_LOCATION_CODE_BY_LOCATION[id]
  if (back) identity.linkedOriginalCode = back
}
bindScenarioIdentities(scenario, identities)

export const CARD_DATA = Object.freeze(Object.fromEntries([
  REFERENCE_CODE,
  ...Object.keys(identities.locations || {}).map(id => LOCATION_CODE_BY_ID[id]).filter(Boolean),
  ...Object.values(ENEMY_LOCATION_CODE_BY_LOCATION),
  ...ACT_CODES, ...SET_ASIDE_ACT_CODES, ...AGENDA_CODES, HOUSE_STIRS_V2_CODE,
  GRAPPLING_SPAWN_CODE, OUT_OF_THE_WALLS_CODE, PULLED_IN_CODE, SHAPELESS_CELLAR_CODE,
  LITTLE_SYLVIE_CODE, PREDATORY_HOUSE_CODE, PREDATION_TEST_CODE,
].map(code => [code, ALL_CARDS[code]])))
