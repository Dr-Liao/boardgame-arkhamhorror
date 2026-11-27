// 岩间密语（writtenInRock · 提示卡 10501，北角矿坑）· 章节数据（scenario 只含数据）。
//
// 参考（权威）：Scenario/Scenarios/TheFeastOfHemlockVale/WrittenInRock.hs +
//   Act|Agenda|Location|Enemy|Treachery/CardDefs|Cards/TheFeastOfHemlockVale/WrittenInRock/*.hs +
//   Asset/Cards/TheFeastOfHemlockVale.hs（10507 矿车 / 10522 棱柱碎片）+
//   frontend/src/locales/en/theFeastOfHemlockVale/writtenInRock.json（权威印刷文本）。
//
// 本关两段式地图：
//   1. 幕 1（洞穴段）：4 张 [[洞穴]] 地点在 (1,1)–(4,1)，控制站在 (5,1)，正交相邻；
//      调查员从最左侧（列 1）的洞穴开始。
//   2. 幕间「塌方」后（轨道段）：控制站移到 (1,1)、轨道出口在 (5,5)，15 张 [[轨道]] 地点
//      按 Location Placement 图摆放（7 个固定位 + 7 个 "?" 位 + 1 张随机变体位）。
//      连接改为「对齐的轨道图标」：相邻两格的轨道出口互为对方方向才相连（behavior.syncConnections）。
//
// 卡号归属（input.entryPaths）：10503–10522 共 22 条记录；10501/10502 是剧本参考卡（非本组条目）。
// 地点/幕/议程建数据型条目，逐卡规则在 behavior.js 与单卡条目里。
//
// 剧情正文来自内容生成物 story-text.js（经 story-access.js 读取）。本循环**没有官方中文**
// （guide 只有 en；story-summary.json 的 chineseGaps = 全部叶子），因此正文取英文印刷文本并
// 显式声明 textStatus：不冒充中文。缺章节时 safeStory 兜底空对象，章节结构/manifest 仍可 import。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { bindScenarioIdentities } from '../../../../identities.js'
import { location, stage, encounterDefinitions, identitiesFor } from '../../card-data.js'
import { chapterStory } from '../../story-access.js'
import { WRITTEN_IN_ROCK_TOKEN_MEANINGS } from './chaos.js'

export const CHAPTER_ID = 'writtenInRock'
export const REFERENCE_CODE = '10501'
// 难度 10501（简单/普通）/ 10502（困难/专家）是同一张剧本参考卡的两面。
export const REFERENCE_CODES = Object.freeze(['10501', '10502'])
export const ENCOUNTER_CODE = 'written_in_rock'

// ---------------------------------------------------------------------------
// 幕 / 议程
// ---------------------------------------------------------------------------
// 固定两幕两议程（Haskell setActDeck/setAgendaDeck）；Standalone Mode 只用幕 2/议程 2。
export const ACT_CODES = Object.freeze(['10505', '10506'])
export const AGENDA_CODES = Object.freeze(['10503', '10504'])
export const ACT1_CODE = ACT_CODES[0]
export const ACT2_CODE = ACT_CODES[1]
export const AGENDA1_CODE = AGENDA_CODES[0]
export const AGENDA2_CODE = AGENDA_CODES[1]
export const ACT_CODE_BY_STAGE = Object.freeze({ 1: ACT1_CODE, 2: ACT2_CODE })
export const AGENDA_CODE_BY_STAGE = Object.freeze({ 1: AGENDA1_CODE, 2: AGENDA2_CODE })

// ---------------------------------------------------------------------------
// 剧情资产 / 敌人 / 诡计代码
// ---------------------------------------------------------------------------
export const MINE_CART_CODE = '10507'
export const PRISMATIC_SHARD_CODE = '10522'
export const SUBTERRANEAN_BEAST_CODE = '10517'
export const BURROWING_HYBRID_CODE = '10518'
export const FRENZIED_MINER_CODE = '10519'
export const CAVE_IN_CODE = '10520'
export const WILD_RIDE_CODE = '10521'
export const CRYSTAL_PARASITE_CODE = '10721'
export const STORY_CODES = Object.freeze([MINE_CART_CODE, PRISMATIC_SHARD_CODE])
export const ENEMY_CODES = Object.freeze([SUBTERRANEAN_BEAST_CODE, BURROWING_HYBRID_CODE, FRENZIED_MINER_CODE])
export const TREACHERY_CODES = Object.freeze([CAVE_IN_CODE, WILD_RIDE_CODE])

// Residents（居民）遭遇组：本关按日期/时段放入的剧情支援（10694 莉亚 / 10695 席米恩 /
// 10697 瑞玟 / 10702 罗莎·马奎兹博士）。它们属于共享组 residents，单卡条目不在本章。
export const RESIDENT_ASSETS = Object.freeze({
  leah: '10694', simeon: '10695', river: '10697', rosa: '10702',
})

// ---------------------------------------------------------------------------
// gather 组（Setup：Written in Rock / Horrors in the Rock / Refractions /
// Chilling Cold / Ghouls + 当日组）
// ---------------------------------------------------------------------------
export const GATHER_GROUPS = Object.freeze([
  'writtenInRock', 'horrorsInTheRock', 'refractions', 'chillingCold', 'ghouls',
])
export const DAY_GATHER_GROUPS = Object.freeze({
  1: 'theFirstDay', 2: 'theSecondDay', 3: 'theFinalDay',
})
export const DAY_NUMBERS = Object.freeze([1, 2, 3])
// 「把 Written in Rock 遭遇组里除地点外的每张卡放一边，位于场外」：本关的敌人/诡计在
// 幕间「塌方」第 4 步之前不进遭遇牌库（10517 在夜晚改为直接放在控制站）。
export const WRITTEN_IN_ROCK_ASIDE_CODES = Object.freeze([
  '10517', '10518', '10518', '10518', '10519', '10519', '10519',
  '10520', '10520', '10521', '10521', '10521',
])
// Setup「Set both copies of the Crystal Parasite enemy and each other card from the
// Written in Rock encounter set aside, out of play」——水晶寄生虫 ×2 也放一边（永不洗入）。
export const SET_ASIDE_ENEMY_CODES = Object.freeze([SUBTERRANEAN_BEAST_CODE])
export const SET_ASIDE_CARDS = Object.freeze([
  ...WRITTEN_IN_ROCK_ASIDE_CODES,
  CRYSTAL_PARASITE_CODE, CRYSTAL_PARASITE_CODE,
  MINE_CART_CODE, PRISMATIC_SHARD_CODE,
])

// ---------------------------------------------------------------------------
// 洞穴地点（Horrors in the Rock 遭遇组）：6 张实体，随机移出 2 张，其余 4 张入列。
// ---------------------------------------------------------------------------
export const CAVE_TABLE = Object.freeze([
  ['dryBurrow1', '10716'],
  ['dryBurrow2', '10716'],
  ['alkalineForest', '10717'],
  ['iridescentPassage', '10718'],
  ['overgrownTunnel', '10719'],
  ['mineralTunnel', '10720'],
])
export const CAVE_LOCATION_IDS = Object.freeze(CAVE_TABLE.map(([id]) => id))
export const CAVES_IN_PLAY = 4
export const CAVES_REMOVED = 2

// ---------------------------------------------------------------------------
// 轨道地点（Written in Rock 遭遇组）：15 张放一边 + 控制站在场（= 16 张 [[轨道]] 地点）。
// railIcons 是印刷卡左下/右侧的轨道图标方向（Haskell Location/CardDefs 的 railIcons）；
// 卡表（cards-data）不含轨道图标，因此这是本章几何数据的唯一事实源。
// 10512/10513/10514 在卡表里是一号两复制，但两张实体印刷的轨道图标不同（A/B 面），
// 所以定义两个实例 id 共用同一卡号（layout/manifest 的 setAside 会合并成 2 张）。
// ---------------------------------------------------------------------------
export const RAIL_TABLE = Object.freeze([
  ['controlStation', '10508', ['north', 'east']],
  ['railExit', '10509', ['south']],
  ['leftTurnA', '10510a', ['north', 'west']],
  ['leftTurnB', '10510b', ['north', 'west']],
  ['rightTurnA', '10511a', ['east', 'south']],
  ['rightTurnB', '10511b', ['east', 'south']],
  ['alkalineRailA', '10512', ['east', 'west']],
  ['alkalineRailB', '10512', ['north', 'south']],
  ['warpedRailA', '10513', ['east', 'west']],
  ['warpedRailB', '10513', ['north', 'east', 'south']],
  ['sunkenRailA', '10514', ['east', 'south', 'west']],
  ['sunkenRailB', '10514', ['north', 'east', 'south']],
  ['forkedRailA', '10515', ['north', 'east', 'south', 'west']],
  ['forkedRailB', '10515', ['north', 'east', 'south', 'west']],
  ['forkedRailC', '10515', ['north', 'east', 'south', 'west']],
  ['railBridge', '10516', ['north', 'south']],
])
export const RAIL_LOCATION_IDS = Object.freeze(RAIL_TABLE.map(([id]) => id))
export const CONTROL_STATION_ID = 'controlStation'
export const RAIL_EXIT_ID = 'railExit'
export const RAIL_PORTS = Object.freeze(Object.fromEntries(
  RAIL_TABLE.map(([id, , ports]) => [id, Object.freeze([...ports])]),
))
// 放一边的 15 张轨道地点（控制站开场就在场）。
export const SET_ASIDE_RAIL_LOCATION_IDS = Object.freeze(
  RAIL_LOCATION_IDS.filter(id => id !== CONTROL_STATION_ID),
)
// 显示坐标（layout）：只影响桌面摆位展示；规则坐标由 behavior 写入剧本网格。
// 轨道段 5×5：控制站 (1,1)、轨道出口 (5,5)，其余 14 张按固定位就近排布。
export const LOCATION_COORDINATES = Object.freeze({
  // 洞穴段（幕 1，显示在轨道图上方的第 6 行，不与轨道段格子冲突）
  dryBurrow1: { x: 1, y: 6 }, dryBurrow2: { x: 2, y: 6 },
  alkalineForest: { x: 3, y: 6 }, iridescentPassage: { x: 4, y: 6 },
  overgrownTunnel: { x: 5, y: 6 }, mineralTunnel: { x: 6, y: 6 },
  // 轨道段
  controlStation: { x: 1, y: 1 }, railExit: { x: 5, y: 5 },
  sunkenRailA: { x: 2, y: 4 }, sunkenRailB: { x: 5, y: 3 },
  forkedRailA: { x: 2, y: 2 }, forkedRailB: { x: 3, y: 3 }, forkedRailC: { x: 3, y: 1 },
  alkalineRailA: { x: 4, y: 2 }, alkalineRailB: { x: 3, y: 2 },
  warpedRailA: { x: 4, y: 4 }, warpedRailB: { x: 1, y: 2 },
  rightTurnA: { x: 2, y: 3 }, rightTurnB: { x: 1, y: 3 },
  leftTurnA: { x: 5, y: 1 }, leftTurnB: { x: 2, y: 1 },
  railBridge: { x: 4, y: 3 },
})

// 轨道段的固定摆放位（Haskell：theCaveIn）。
// candidates 是印刷图给出的「二选一/固定」候选；实际由 behavior 用剧本 RNG 抽。
export const RAIL_FIXED_SLOTS = Object.freeze([
  Object.freeze({ x: 2, y: 4, candidates: Object.freeze(['sunkenRailA']) }),
  Object.freeze({ x: 2, y: 2, candidates: Object.freeze(['forkedRailA']) }),
  Object.freeze({ x: 3, y: 3, candidates: Object.freeze(['forkedRailB']) }),
  Object.freeze({ x: 4, y: 2, candidates: Object.freeze(['alkalineRailA', 'warpedRailA']) }),
  Object.freeze({ x: 4, y: 4, candidates: Object.freeze(['rightTurnA', 'rightTurnB']) }),
  Object.freeze({ x: 5, y: 1, candidates: Object.freeze(['leftTurnA', 'leftTurnB']) }),
  Object.freeze({ x: 5, y: 3, candidates: Object.freeze(['railBridge', 'alkalineRailB']) }),
])
// 7 个 "?" 空格（剩余轨道地点随机放入）。
export const RAIL_OPEN_SLOTS = Object.freeze([
  Object.freeze({ x: 1, y: 2 }), Object.freeze({ x: 1, y: 3 }), Object.freeze({ x: 1, y: 4 }),
  Object.freeze({ x: 2, y: 1 }), Object.freeze({ x: 3, y: 4 }), Object.freeze({ x: 4, y: 1 }),
  Object.freeze({ x: 5, y: 2 }),
])
// 可滑动/交换的合法空格范围：印刷图 5 列 × 4 行；第 5 行只有轨道出口（不可滑入）。
export const SLIDE_BOUNDS = Object.freeze({ minX: 1, maxX: 5, minY: 1, maxY: 4 })
export const RAIL_EXIT_CELL = Object.freeze({ x: 5, y: 5 })
export const CONTROL_STATION_CELL = Object.freeze({ x: 1, y: 1 })
// 幕 1 洞穴段：控制站初始格（Haskell Setup placeInGrid (Pos 5 1)）。
export const CAVE_STAGE_CONTROL_CELL = Object.freeze({ x: 5, y: 1 })
export const CAVE_ROW = 1
// 居民/棱柱碎片的固定落点列（指南 Cave-In 4）：席米恩/莉亚在列 2 最上方，
// 棱柱碎片在列 4 最下方（参考实现把它写在列 5；此处按指南印刷文本取列 4，见 note）。
export const ATWOOD_COLUMN = 2
export const SHARD_COLUMN = 4

// ---------------------------------------------------------------------------
// 地点
// ---------------------------------------------------------------------------
const caveCards = new Set(CAVE_LOCATION_IDS.map(([id]) => id))
function makeLocation(id, code, extra = {}) {
  const card = ALL_CARDS[code]
  if (!card) throw new RangeError(`Unknown Written in Rock location: ${code}`)
  const base = location({
    id, code, clues: Math.max(0, Number(card.clues) || 0), connections: [], ...extra,
  })
  base.printedTraits = [...(card.traits || [])]
  return base
}

export const LOCATIONS = Object.freeze(Object.fromEntries([
  ...CAVE_TABLE.map(([id, code]) => {
    const base = makeLocation(id, code, { cave: true })
    base.revealed = true
    return [id, base]
  }),
  ...RAIL_TABLE.map(([id, code, ports]) => {
    // 轨道隧道印刷有未揭示面（背面「Rail Tunnel」）：入场时未揭示，进入时揭示。
    // 轨道出口入场即揭示；控制站从未揭示面入场。
    const extra = { rail: true, railIcons: [...ports], revealed: id === RAIL_EXIT_ID }
    if (id === CONTROL_STATION_ID) Object.assign(extra, {
      // 控制站：shroud 1 / 每调查员 2 条线索；背面是「进入额外费用」。
      clues: 2, enterCostCluesPerInvestigator: 2,
    })
    if (id === RAIL_EXIT_ID) Object.assign(extra, {
      clues: 0, hintsFixedClues: true, hasVictory: true, victory: 1,
      cannotBeSlidOrSwapped: true, revealed: true,
    })
    if (code === '10512') extra.alkaline = true
    if (code === '10513') Object.assign(extra, { warped: true, hasVictory: true, victory: 1 })
    if (code === '10514') extra.sunken = true
    if (code === '10515') extra.forked = true
    if (code === '10516') {
      // 印刷：X 为该地点的列号；卡表把 X 记成 -2 占位，运行期由 locationShroudModifier 给列号。
      extra.shroud = 0
      extra.shroudByColumn = true
    }
    if (id === 'leftTurnA' || id === 'rightTurnA') Object.assign(extra, { turnSwap: true })
    if (id === 'leftTurnB' || id === 'rightTurnB') Object.assign(extra, { turnSlide: true })
    return [id, makeLocation(id, code, extra)]
  }),
]))

// 显式限定：洞穴地点的线索是「每调查员」（card-data 的 cluesPerInvestigator）。
for (const [id] of CAVE_TABLE) {
  const value = LOCATIONS[id]
  if (caveCards.has(id)) {
    const card = ALL_CARDS[value.code]
    delete value.cluesFixed
    value.cluesPerInvestigator = Math.max(0, Number(card.clues) || 0)
  }
}
// 轨道出口的线索固定为 0（静态度量）。
LOCATIONS[RAIL_EXIT_ID].cluesFixed = 0
LOCATIONS[RAIL_EXIT_ID].clues = 0

// 地点连接：两段地图都由运行期网格/轨道重算，静态表为空（Haskell 也是 connectToAdjacent /
// railIcons 运行期连接）。layout.edges 因此为空，桌面连线由 behavior.syncConnections 写 connections。
export const LOCATION_CONNECTIONS = Object.freeze({})
export const CONNECTION_POLICY = 'orthogonal'
export const RAIL_CONNECTION_POLICY = 'rail'

// ---------------------------------------------------------------------------
// 遭遇牌库
// ---------------------------------------------------------------------------
const snake = value => String(value).replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase()
const cardsOfGroups = groups => {
  const codes = new Set(groups.map(snake))
  return Object.entries(ALL_CARDS).filter(([, card]) => codes.has(card.encounterCode))
}
const fixedDeckGroups = ['horrorsInTheRock', 'refractions', 'chillingCold', 'ghouls']
export const ENCOUNTER_DECK = Object.freeze(cardsOfGroups(fixedDeckGroups)
  .filter(([code, card]) => ['enemy', 'treachery'].includes(card.type))
  .filter(([code]) => code !== CRYSTAL_PARASITE_CODE)
  .sort(([a], [b]) => a.localeCompare(b))
  .flatMap(([code, card]) => Array(Math.max(1, Number(card.quantity) || 1)).fill(code)))
export const ENCOUNTER_DECK_CODES = Object.freeze([...new Set(ENCOUNTER_DECK)])

// 当日组（第一日/第二日/最终日）的诡计：开局按 campaign.records.day（缺省 1）并入遭遇牌库。
export function dayGroupCards(day) {
  const group = DAY_GATHER_GROUPS[Number(day) || 1] || DAY_GATHER_GROUPS[1]
  return cardsOfGroups([group])
    .filter(([, card]) => ['enemy', 'treachery'].includes(card.type))
    .sort(([a], [b]) => a.localeCompare(b))
    .flatMap(([code, card]) => Array(Math.max(1, Number(card.quantity) || 1)).fill(code))
}
export const DAY_TREACHERY_CODES = Object.freeze(Object.fromEntries(
  DAY_NUMBERS.map(day => [day, [...new Set(dayGroupCards(day))]]),
))
export function encounterDeckForDay(day) {
  return [...ENCOUNTER_DECK, ...dayGroupCards(day)]
}
// 幕间「塌方」第 4 步：把放一边的 Written in Rock 遭遇卡洗回遭遇牌库。
// 10517 地下野兽永远不在其中：白天它已被移出游戏，夜晚它被直接放在控制站。
export function writtenInRockAsideCards(state) {
  void state
  return WRITTEN_IN_ROCK_ASIDE_CODES.filter(code => code !== SUBTERRANEAN_BEAST_CODE)
}

// ---------------------------------------------------------------------------
// 遭遇定义（数值/关键词取印刷数据；per-investigator 血量按印刷文补）
// ---------------------------------------------------------------------------
const definitionCodes = [
  ...ENCOUNTER_DECK_CODES,
  ...DAY_NUMBERS.flatMap(day => dayGroupCards(day)),
  ...WRITTEN_IN_ROCK_ASIDE_CODES, CRYSTAL_PARASITE_CODE,
  ...STORY_CODES, ...Object.values(RESIDENT_ASSETS),
]
const definitions = encounterDefinitions(definitionCodes)
// 10517「地下野兽得到 +3[per_investigator] 生命」：卡表没有 per-investigator 血量标志，按印刷文补。
if (definitions.enemies[SUBTERRANEAN_BEAST_CODE]) {
  definitions.enemies[SUBTERRANEAN_BEAST_CODE].healthPerInvestigatorBonus = 3
}
// 10519 的战斗/躲避值 = 列号（卡表把 X 记成 -2 占位）；运行期由 behavior.enemyStatModifier 换成列号。
if (definitions.enemies[FRENZIED_MINER_CODE]) {
  definitions.enemies[FRENZIED_MINER_CODE].fightByColumn = true
  definitions.enemies[FRENZIED_MINER_CODE].evadeByColumn = true
}

// ---------------------------------------------------------------------------
// 幕 / 议程阶段
// ---------------------------------------------------------------------------
export const ACT_STAGES = Object.freeze({
  1: Object.freeze({
    ...stage(ACT_CODE_BY_STAGE[1]),
    // 目标：轮末时每位存活调查员都在控制站。
    objective: { type: 'allAtLocation', locationId: CONTROL_STATION_ID, when: 'roundEnd' },
    back: { type: 'caveIn' },
  }),
  2: Object.freeze({
    ...stage(ACT_CODE_BY_STAGE[2]),
    // 目标：矿车进入轨道出口时立即推进。
    objective: { type: 'vehicleEnters', vehicleCode: MINE_CART_CODE, locationId: RAIL_EXIT_ID },
    abilities: Object.freeze([
      Object.freeze({ kind: 'fast', type: 'slideOrSwap', cluesPerInvestigator: 1, groupLimit: 'perTurn' }),
      Object.freeze({ kind: 'action', type: 'slide', resourcesPerInvestigator: 1, groupLimit: 'perRound' }),
      Object.freeze({ kind: 'action', type: 'takePrismaticShard' }),
    ]),
  }),
})
export const AGENDA_STAGES = Object.freeze({
  1: Object.freeze({
    ...stage(AGENDA_CODE_BY_STAGE[1]),
    // 正面 [action]：抽 1 张遭遇牌，把你所在地点的 1 个碎片（资源）移到参考卡；抽到 [[力量]] 诡计则 +5 资源。
    ability: { type: 'surveyForScrap', action: true },
    back: { type: 'cavedIn' },
  }),
  2: Object.freeze({
    ...stage(AGENDA_CODE_BY_STAGE[2]),
    // 正面：带剧情资产的地点不能被滑动/交换；每个敌人获得猎手并在敌人阶段额外结算一次猎手；
    // 敌人移动时，相邻地点视为与其相连。
    staticRules: Object.freeze(['protectStoryAssetLocations', 'hunterTwice', 'adjacentWhileEnemyMoving']),
    back: { type: 'utterCollapse' },
  }),
})
export const ACTS = Object.freeze([1, 2].map(number => structuredClone(ACT_STAGES[number])))
export const AGENDAS = Object.freeze([1, 2].map(number => structuredClone(AGENDA_STAGES[number])))

// ---------------------------------------------------------------------------
// 剧情正文（指南）：story-text.js 的键是相对指南文件根的路径。
// ---------------------------------------------------------------------------
const safeStory = id => {
  try {
    return chapterStory(id)
  } catch {
    return { sections: {}, sectionsEn: {} }
  }
}
const STORY = safeStory(CHAPTER_ID)
// story-access 同时给出 `en`（嵌套原始 JSON）与 `sectionsEn`（扁平点路径）。优先用嵌套结构，
// 缺失时把扁平键还原成嵌套（其它循环的 story-text.js 可能是扁平形态）。
function nestedFromFlat(flat) {
  const root = {}
  for (const [key, value] of Object.entries(flat || {})) {
    const parts = key.split('.')
    let node = root
    for (let index = 0; index < parts.length; index++) {
      const part = parts[index]
      const last = index === parts.length - 1
      if (last) { node[part] = value; break }
      const next = parts[index + 1]
      if (/^\d+$/.test(next)) {
        node[part] ||= []
      } else {
        node[part] ||= {}
      }
      node = node[part]
    }
  }
  return root
}
const SECTIONS = STORY.en && Object.keys(STORY.en).length
  ? STORY.en
  : nestedFromFlat(STORY.sectionsEn || STORY.sections || {})
const text = value => {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.map(text).filter(Boolean).join('\n\n')
  if (!value || typeof value !== 'object') return ''
  const parts = []
  if (typeof value.title === 'string') parts.push(value.title)
  if (typeof value.body === 'string') parts.push(value.body)
  return parts.filter(Boolean).join('\n\n')
}
const blocks = (...parts) => parts.map(text).filter(Boolean).join('\n\n')
const rule = key => ({ title: text(SECTIONS[key]?.title), body: text(SECTIONS[key]?.body) })

// Setup 的 15 个印刷步骤（顺序即面板展示顺序）；when 是显示条件，实际布置在 behavior。
export const SETUP_STEPS = Object.freeze([
  { key: 'gatherSets', text: text(SECTIONS.setup?.gatherSets) },
  { key: 'currentDaySet', text: text(SECTIONS.setup?.currentDaySet) },
  { key: 'currentDayMarker', text: text(SECTIONS.setup?.currentDayMarker) },
  { key: 'caves', text: text(SECTIONS.setup?.caves) },
  { key: 'otherLocations', text: text(SECTIONS.setup?.otherLocations) },
  { key: 'scrap', text: text(SECTIONS.setup?.scrap) },
  { key: 'startAt', text: text(SECTIONS.setup?.startAt) },
  { key: 'residents', text: text(SECTIONS.setup?.residents), when: 'day' },
  { key: 'riverHawthorne', text: text(SECTIONS.setup?.riverHawthorne), when: 'day1' },
  { key: 'simeonAtwood', text: text(SECTIONS.setup?.simeonAtwood), when: 'day1or2' },
  { key: 'leahAtwood', text: text(SECTIONS.setup?.leahAtwood), when: 'day3' },
  { key: 'remainingResidents', text: text(SECTIONS.setup?.remainingResidents), when: 'day' },
  { key: 'subterraneanBeast', text: text(SECTIONS.setup?.subterraneanBeast), when: 'day' },
  { key: 'scenarioReference', text: text(SECTIONS.setup?.scenarioReference) },
  { key: 'setOutOfPlay', text: text(SECTIONS.setup?.setOutOfPlay) },
])

export const THE_CAVE_IN = Object.freeze({
  title: text(SECTIONS.theCaveIn),
  theCaveIn1: text(SECTIONS.theCaveIn1),
  proceedToTheCaveIn2: text(SECTIONS.proceedToTheCaveIn2),
  skipToTheCaveIn3: text(SECTIONS.skipToTheCaveIn3),
  theCaveIn2: text(SECTIONS.theCaveIn2),
  theCaveIn3: text(SECTIONS.theCaveIn3),
  theCaveIn4: text(SECTIONS.theCaveIn4),
  slidingAndSwappingLocations: rule('slidingAndSwappingLocations'),
  theMineCart: rule('theMineCart'),
})

export const MINE_CART_LABELS = Object.freeze({
  facing: text(SECTIONS.label?.mineCart?.facing),
  faceNorth: text(SECTIONS.label?.mineCart?.faceNorth),
  faceSouth: text(SECTIONS.label?.mineCart?.faceSouth),
  faceEast: text(SECTIONS.label?.mineCart?.faceEast),
  faceWest: text(SECTIONS.label?.mineCart?.faceWest),
  cancelMove: text(SECTIONS.label?.mineCart?.cancelMove),
  moveAgain: text(SECTIONS.label?.mineCart?.moveAgain),
  wildRideMoveAgain: text(SECTIONS.label?.wildRide?.moveAgain),
  wildRideDamage: text(SECTIONS.label?.wildRide?.damage),
})

export const SCENARIO_TEXT = Object.freeze({
  textLanguage: 'en',
  textStatus: 'printed-text (en; zh translation pending in story-text.js)',
  heading: text(SECTIONS.intro?.title),
  intro: text(SECTIONS.intro?.body),
  setup: SETUP_STEPS.map(step => step.text).filter(Boolean).join('\n\n'),
  setupSteps: SETUP_STEPS,
  specialRules: Object.freeze([
    { id: 'railLine', title: text(SECTIONS.specialRules?.[0]?.title), body: text(SECTIONS.specialRules?.[0]?.body) },
    { id: 'slidingAndSwapping', title: text(SECTIONS.specialRules?.[1]?.title), body: text(SECTIONS.specialRules?.[1]?.body) },
    { id: 'theMineCart', title: text(SECTIONS.specialRules?.[2]?.title), body: text(SECTIONS.specialRules?.[2]?.body) },
  ]),
  rules: Object.freeze({
    railLine: { title: text(SECTIONS.specialRules?.[0]?.title), body: text(SECTIONS.specialRules?.[0]?.body) },
    slidingAndSwappingLocations: THE_CAVE_IN.slidingAndSwappingLocations,
    theMineCart: THE_CAVE_IN.theMineCart,
  }),
  mineCartLabels: MINE_CART_LABELS,
  tooltips: Object.freeze({
    theUndergroundMaze: Object.freeze({
      slide: text(SECTIONS.tooltips?.theUndergroundMaze?.slide),
      prismaticShard: text(SECTIONS.tooltips?.theUndergroundMaze?.prismaticShard),
    }),
  }),
  caveIn: THE_CAVE_IN,
  codex: Object.freeze({
    leahAtwood: Object.freeze({ title: text(SECTIONS.codex?.leahAtwood?.title), body: text(SECTIONS.codex?.leahAtwood?.body) }),
    simeonAtwood: Object.freeze({ title: text(SECTIONS.codex?.simeonAtwood?.title), body: text(SECTIONS.codex?.simeonAtwood?.body) }),
    riverHawthorne: Object.freeze({ title: text(SECTIONS.codex?.riverHawthorne?.title), body: text(SECTIONS.codex?.riverHawthorne?.body) }),
    drRosaMarquez: Object.freeze({ title: text(SECTIONS.codex?.drRosaMarquez?.title), body: text(SECTIONS.codex?.drRosaMarquez?.body) }),
  }),
  xp: Object.freeze({
    simeon: text(SECTIONS.resolutions?.xp?.bonus?.simeon),
    leah: text(SECTIONS.resolutions?.xp?.bonus?.leah),
    river: text(SECTIONS.resolutions?.xp?.bonus?.river),
  }),
  resolutions: Object.freeze(Object.fromEntries(
    ['noResolution', 'resolution1', 'resolution2', 'resolution3', 'resolution4', 'resolution5', 'resolution6', 'standalone']
      .map(key => [key, blocks(SECTIONS.resolutions?.[key]?.title, SECTIONS.resolutions?.[key]?.body)]),
  )),
  resolutionBranches: Object.freeze({
    skipToResolution6: text(SECTIONS.resolutions?.noResolution?.skipToResolution6),
    skipToResolution3: text(SECTIONS.resolutions?.noResolution?.skipToResolution3),
    skipToResolution4: text(SECTIONS.resolutions?.noResolution?.skipToResolution4),
  }),
})

export const RESOLUTION_KEYS = Object.freeze([
  'noResolution', 'resolution1', 'resolution2', 'resolution3', 'resolution4', 'resolution5', 'resolution6', 'standalone',
])
export const RESOLUTION_RECORD_KEYS = Object.freeze([
  'simeonSurvived', 'leahSawSomethingInTheMine', 'simeonDisappeared', 'leahAndSimeonWereReunited',
  'theInvestigatorsSurvivedTheHorrorsInTheRock', 'simeonCrossedOut', 'leahCrossedOut',
  'riverHawthorneHelped', 'riverHawthorneRelationship', 'simeonAtwoodRelationship', 'leahAtwoodRelationship',
  'areaNorthPointMineSurveyed', 'prismaticShardToDeck', 'writtenInRockResolution', 'writtenInRockTimes',
])

export const scenario = {
  id: CHAPTER_ID,
  originalCode: REFERENCE_CODE,
  name: '岩间密语 · Written in Rock',
  nameEn: 'Written in Rock',
  referenceCode: REFERENCE_CODE,
  referenceCodes: [...REFERENCE_CODES],
  encounterCode: ENCOUNTER_CODE,
  intro: SCENARIO_TEXT.intro,
  setup: SCENARIO_TEXT.setup,
  setupSteps: SCENARIO_TEXT.setupSteps,
  specialRules: SCENARIO_TEXT.specialRules,
  rules: SCENARIO_TEXT.rules,
  caveIn: SCENARIO_TEXT.caveIn,
  mineCartLabels: SCENARIO_TEXT.mineCartLabels,
  tooltips: SCENARIO_TEXT.tooltips,
  codex: SCENARIO_TEXT.codex,
  startLocation: 'dryBurrow1',
  locations: LOCATIONS,
  // 机制声明：10517 的「本轮不能重整」写入引擎既有的 location-defenses.cannotReady 读点。
  mechanics: Object.freeze({ defenses: true }),
  setAsideLocations: [...SET_ASIDE_RAIL_LOCATION_IDS],
  setAsideAliases: [...SET_ASIDE_CARDS],
  connectByGrid: CONNECTION_POLICY,
  connectByRail: RAIL_CONNECTION_POLICY,
  acts: ACTS,
  agendas: AGENDAS,
  ...definitions,
  encounterDeck: [...ENCOUNTER_DECK],
  dayEncounterDecks: Object.freeze(Object.fromEntries(
    DAY_NUMBERS.map(day => [day, dayGroupCards(day)]),
  )),
  resolutions: { ...SCENARIO_TEXT.resolutions },
  resolutionBranches: { ...SCENARIO_TEXT.resolutionBranches },
  tokenMeanings: {
    easy: { ...WRITTEN_IN_ROCK_TOKEN_MEANINGS.easy },
    standard: { ...WRITTEN_IN_ROCK_TOKEN_MEANINGS.standard },
    hard: { ...WRITTEN_IN_ROCK_TOKEN_MEANINGS.hard },
    expert: { ...WRITTEN_IN_ROCK_TOKEN_MEANINGS.expert },
  },
  textLanguage: SCENARIO_TEXT.textLanguage,
  textStatus: SCENARIO_TEXT.textStatus,
}

export const identities = identitiesFor(scenario)
bindScenarioIdentities(scenario, identities)

export const CARD_DATA = Object.freeze(Object.fromEntries([
  REFERENCE_CODE, REFERENCE_CODES[1], ...ACT_CODES, ...AGENDA_CODES,
  ...CAVE_LOCATION_IDS.map(id => LOCATIONS[id].code),
  ...RAIL_LOCATION_IDS.map(id => LOCATIONS[id].code),
  ...ENCOUNTER_DECK_CODES, ...WRITTEN_IN_ROCK_ASIDE_CODES, ...STORY_CODES,
  ...Object.values(RESIDENT_ASSETS), CRYSTAL_PARASITE_CODE,
].map(code => [code, ALL_CARDS[code]])))
