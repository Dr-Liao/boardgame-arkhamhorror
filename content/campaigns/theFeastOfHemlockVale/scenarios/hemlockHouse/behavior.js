// 汉洛克庄园（hemlockHouse · 提示卡 10523）· 引擎钩子（章节流程）。
//
// 参考：Scenario/Scenarios/TheFeastOfHemlockVale/HemlockHouse.hs +
//       Scenarios/TheFeastOfHemlockVale/HemlockHouse/{Helpers,PredationBag}.hs +
//       Act|Agenda|Location|Enemy|Treachery|Story/Cards/TheFeastOfHemlockVale/HemlockHouse/*.hs +
//       EnemyLocation/Cards.hs + EnemyLocation/Types（敌人-地点=同时在场的敌人与地点）+
//       frontend/src/locales/en/theFeastOfHemlockVale/hemlockHouse.json。
//
// 引擎读点（全部既有钩子，不改引擎）：
//   startLocation / preScenarioSetup / setupLocations / locationPlaced / afterDeckSetup
//   actions + performAction（封印行动、议程 2a/3a 的 [fast] 翻面、门厅快速移动、盥洗室搬线索、
//     客厅远程伤害、藏书室密道）
//   canDiscoverClues（幕 1a/2a「没有调查员的地点不能发现线索」）
//   mythosEnded（议程 2a/3a「神话阶段结束时进行掠食检定」）/ roundEnded（幕 1 目标：7 处封印/胜利区）
//   afterInvestigate（餐厅/藏书室最后线索、失形地窖失败攻击与无线索入胜利区）
//   enemySpawned / enemyStatModifier（紧锢孽种楼层生命、夜间报复）
//   enemyAttackResolved（幕 2a「庄园之心」：被敌人-地点攻击后移动到失形地窖）
//   actReveal / actIndexAfterAdvance / agendaReveal / checkObjectives
//   resolveChaosToken / applyTokenEffect（10523 混乱标记）
//   resolution（No Resolution→R2、R1→R2、R2 结算：掠食袋清理、小西尔维、封印/敌人-地点奖励经验、
//     「Areas Surveyed: Hemlock Harbor」记录）
//   events（条目 encounterResolve → 掠食检定/掠食袋转移）
//
// 事实源分工：印刷数值/名称一律来自 definition.js（card-data.js）；「这张卡有什么规则」来自单卡条目
// 的 flags（`revealEffect` / `afterSealReaction` / `fastMoveClueBelow` / `secretPassage` /
// `rangedStrike` / `forcedLastClueDiscard` / `cluesOnlyWithInvestigators` …），本文件按条目声明分派，
// 不写「按卡号分支」。
//
// 状态写入口径：章节行为（不是卡条目），与 TSK 各章 behavior 同一口径——读 state、经 api.* 结算效果；
// 网格坐标/连接/楼层帷幕/封印数这类「布置与本关自己的棋盘」由行为直接写（语义同引擎 connectGrid /
// turnLocationIntoEnemy，api 存在时优先走 api）。未新增战役记录以外的状态字段：网格写
// `scenarioFlags.mechanics.grid`（引擎既有容器），临时标记写 `scenarioFlags.*`。
//
// 近似（已在条目 note 与本文件注释披露）：
//   1. 敌人-地点翻面/翻回在无 api 时本地实现（与 src/engine/enemy-location.js 同形状：地点盖章
//      换面 + 同名 id 的 enemyLocation 敌人实例 + enemyLocationCondition 保留伤害）。
//   2. 混乱袋 [elder_thing]「检定结算后移入掠食袋」：掠食袋一侧即时入袋；混乱袋一侧在下一次内容
//      钩子（afterInvestigate / roundEnded / mythosEnded / resolution …）补做，因为引擎在检定结束
//      时才把标记放回 `state.chaosBag`。
//   3. 「Find the unsealed [[Dormant]] location nearest to the most investigators」用连接图 BFS
//      距离 + 最近人数评分；并列时按稳定顺序取第一个（不额外弹选择面板）。
//   4. 法典（Codex）只在 behavior 暴露 codexAvailable/codexBranchFor/resolveCodexEntry 与数据，
//      不声明 `scenario.mechanics.codex`：法典分支条件含「第几日/时段」，而引擎 codex 分支只能读
//      关系等级与笔记；事务接线由战役层（api.interactions.fhv.codex）负责。
import { registeredEntry } from '../../../../../src/engine/ability.js'
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import {
  ACT_STAGES, ALL_LOCATION_IDS,
  AREAS_SURVEYED_HEMLOCK_HARBOR, BEDROOM_IDS, BEDROOM_SHROUD_RULE, CELLAR_ENEMY_FACE, CELLAR_ID,
  CELLAR_SLOT, DAY_ENCOUNTER_GROUPS, DAY_ENCOUNTER_DECKS, ENCOUNTER_DECK, ENEMY_LOCATION_CODE_BY_LOCATION,
  ENEMY_LOCATION_FACES, ENEMY_LOCATION_REVEAL_EFFECT_BY_LOCATION, FIRST_FLOOR, FIRE_CODE,
  GRAPPLING_SPAWN_CODE, GATHER_GROUPS, LOCATIONS, LOCATION_CODE_BY_ID, LOCATION_CONNECTIONS,
  OUT_OF_THE_WALLS_CODE, PREDATION_BAG_ID, PREDATION_TEST_CODE, PREDATORY_HOUSE_CODE, PULLED_IN_CODE,
  RANDOM_SLOTS, RECORD_KEYS, RESIDENT_CODES, RESIDENT_SETUP, RESOLUTION_KEYS, RESOLUTION_RECORD, ROOM_IDS,
  SCENARIO_TEXT, SET_ASIDE_ACTS, SET_ASIDE_CARDS, SHAPELESS_CELLAR_CODE,
  SHUFFLE_POOL_IDS, START_LOCATION, STRANGE_INFESTATION_CODE, HEART_OF_THE_HOUSE_CODE,
  AGAINST_THE_HOUSE_CODE, LIVING_WALLS_CODE, EERIE_SILENCE_CODE, HOUSE_STIRS_V1_CODE, HOUSE_STIRS_V2_CODE,
  TOP_BEDROOM_SLOT, LITTLE_SYLVIE_CODE, CODEX_ENTRY_IDS, agendaDeckForDate, agendaUseV1,
  predationBagTokens,
} from './definition.js'
import {
  HEMLOCK_TOKEN_MEANINGS, hemlockHouseChaosToken, hemlockHouseChaosTokenValue, isHardSide,
  investigatorCount, tabletHealAmount,
} from './chaos.js'

const CHAPTER_ID = 'hemlockHouse'

// ---------------------------------------------------------------------------
// 读点：日期/时段、记录、剧本标记
// ---------------------------------------------------------------------------

const recordsFor = state => {
  state.campaign ||= {}
  state.campaign.records ||= {}
  return state.campaign.records
}
const flagsFor = state => (state.scenarioFlags ||= {})
const setFlag = (state, key, value = true) => { flagsFor(state)[key] = value; return value }
const clearFlag = (state, key) => { delete flagsFor(state)[key] }
const info = (api, text) => api?.info?.(text)
const safeCall = (api, name, ...args) => (typeof api?.[name] === 'function' ? api[name](...args) : null)
const activeInvestigators = state => (state.investigators || [])
  .filter(inv => inv && !inv.defeated && !inv.resigned)
const aliveInvestigatorsAt = (state, locationId) =>
  activeInvestigators(state).filter(inv => inv.location === locationId)
const leadSeat = state => {
  const active = activeInvestigators(state)
  const declared = Number(state.campaign?.leadSeat)
  if (active.some(inv => inv.seat === declared)) return declared
  return active[0]?.seat ?? declared ?? 0
}
const codeOf = value => String(value?.originalCode || value?.code || '')
const entryOf = code => (code ? registeredEntry(String(code)) : null)
const flagsOfCode = code => entryOf(code)?.flags || {}
const hasTrait = (value, trait) => (value?.traits || [])
  .some(item => String(item).toLowerCase() === String(trait).toLowerCase())

/** 当前战役天数（1–3）：`scenarioFlags.hemlockHouseDay` 优先，其次战役记录 day/currentDay。 */
export function dayNumberOf(value) {
  const raw = value != null && typeof value === 'object' ? (value.day ?? value.value) : value
  if (raw == null || raw === '') return null
  const match = /([123])/.exec(String(raw))
  return match ? Number(match[1]) : null
}
export function dayOf(state) {
  const override = dayNumberOf(flagsFor(state).hemlockHouseDay)
  const records = recordsFor(state)
  return override ?? dayNumberOf(records.day) ?? dayNumberOf(records.currentDay) ?? 1
}
const timeIsNight = value => value != null && /night/i.test(String(value))
export function isNight(state) {
  const override = flagsFor(state).hemlockHouseNight
  if (override != null) return override === true
  const records = recordsFor(state)
  return timeIsNight(records.time) || timeIsNight(records.dayTime) || timeIsNight(records.timeOfDay)
}
/** 日期（Setup 的日/时段分支唯一读点）。 */
export function dateOf(state) {
  return { day: dayOf(state), period: isNight(state) ? 'night' : 'day' }
}

// 「Remember」标记沿用战役层既有容器 `records.remembered`（与其它 FHV 章节一致）。
export function rememberedFor(state) {
  const records = recordsFor(state)
  records.remembered ||= {}
  return records.remembered
}
export const isRemembered = (state, key) => rememberedFor(state)[key] === true
export function remember(state, key, api = {}) {
  const remembered = rememberedFor(state)
  if (remembered[key]) return false
  remembered[key] = true
  info(api, `记住：${key}`)
  return true
}

// 居民关系（引擎 resident-record 规格；api.residents 可用时走 api，否则写同一记录键）。
const RESIDENT_RECORDS = {
  gideon: { level: RECORD_KEYS.gideonRelationship, notes: 'gideonMizrahNotes',
    crossedOut: 'gideonMizrahCrossedOut', max: 5 },
  william: { level: RECORD_KEYS.williamRelationship, notes: 'williamHemlockNotes',
    crossedOut: 'williamHemlockCrossedOut', max: 5 },
  judith: { level: RECORD_KEYS.judithRelationship, notes: 'judithParkNotes',
    crossedOut: 'judithParkCrossedOut', max: 5 },
}
export const residentRecord = resident => RESIDENT_RECORDS[resident] || null
export function residentLevel(state, resident) {
  const spec = RESIDENT_RECORDS[resident]
  if (!spec) return 0
  return Math.max(0, Number(recordsFor(state)[spec.level]) || 0)
}
export function addResidentRelationship(state, resident, amount = 1, api = {}) {
  const spec = RESIDENT_RECORDS[resident]
  if (!spec) return 0
  if (typeof api.residents?.change === 'function') {
    const next = api.residents.change(spec, amount)
    if (next !== false && next != null) {
      info(api, `与${resident}的关系等级 → ${next}`)
      return Number(next) || 0
    }
  }
  const records = recordsFor(state)
  records[spec.level] = Math.max(0, Math.min(spec.max, (Number(records[spec.level]) || 0) + amount))
  info(api, `与${resident}的关系等级 → ${records[spec.level]}`)
  return records[spec.level]
}

// ---------------------------------------------------------------------------
// 读点：幕/议程、封印、敌人-地点、楼层
// ---------------------------------------------------------------------------

export const currentActCode = state => codeOf(state.acts?.[state.actIndex ?? 0])
export const currentAgenda = state => state.agendas?.[state.agendaIndex ?? 0] || null
export const currentAgendaCode = state => codeOf(currentAgenda(state))
export const agendaIsFront = state => currentAgenda(state)?.face !== 'back'
/** 当前议程的阶段号（1/2/3）；背面返回 0（10523 的 [elder_thing] 读「议程 2a/3a」）。 */
export function agendaStageNumber(state) {
  const agenda = currentAgenda(state)
  if (!agenda || agenda.face === 'back') return 0
  const raw = String(agenda.stage || '')
  const match = /([123])/.exec(raw)
  if (match) return Number(match[1])
  const code = currentAgendaCode(state)
  if (code === LIVING_WALLS_CODE) return 3
  if (code === HOUSE_STIRS_V1_CODE || code === HOUSE_STIRS_V2_CODE) return 2
  if (code === EERIE_SILENCE_CODE) return 1
  return 0
}
export const isPredationAgendaStep = state => [2, 3].includes(agendaStageNumber(state))

export const locationOf = (state, id) => (state.locations || []).find(location => location.id === id) || null
export const isEnemyLocation = location => Boolean(location?.enemyLocationFace)
export const isDormant = location => !isEnemyLocation(location) && hasTrait(location, 'Dormant')
export const sealCount = location => Math.max(0, Number(location?.sealCount) || 0)
export const isSealed = location => sealCount(location) > 0
export const sealableLocations = state => (state.locations || []).filter(isDormant)
export const unsealedDormantLocations = state => sealableLocations(state).filter(location => !isSealed(location))

/** 场上封印总数（幕 1 目标与结局奖励经验共用）。 */
export function sealsInPlay(state) {
  return (state.locations || []).reduce((sum, location) => sum + sealCount(location), 0)
}
export function sealedLocationCount(state) {
  return (state.locations || []).filter(location => sealCount(location) > 0).length
}
export const isEnemyLocationCard = code => ALL_CARDS[String(code)]?.type === 'enemy_location'
/** 胜利展示区里的敌人-地点张数。 */
export function enemyLocationsInVictory(state) {
  return (state.victoryDisplay || []).filter(card => isEnemyLocationCard(codeOf(card))).length
}
export const cellarInPlay = state => Boolean(locationOf(state, CELLAR_ID))
export const cellarEnemy = state => (state.enemies || [])
  .find(enemy => enemy.enemyLocation && enemy.id === CELLAR_ID) || null
export function cellarInVictory(state) {
  return (state.victoryDisplay || []).some(card => codeOf(card) === SHAPELESS_CELLAR_CODE)
}

// ---------------------------------------------------------------------------
// 单卡条目规则读点（flags 是「这张卡有什么规则」的唯一事实源）
// ---------------------------------------------------------------------------

const locationFlags = id => flagsOfCode(LOCATION_CODE_BY_ID[id] || '')
export const hasLocationRule = (id, key) => locationFlags(id)[key] === true
const actRuleFlags = state => flagsOfCode(currentActCode(state))
const revealEffectOf = locationId => flagsOfCode(ENEMY_LOCATION_CODE_BY_LOCATION[locationId] || '')?.revealEffect
  || ENEMY_LOCATION_REVEAL_EFFECT_BY_LOCATION[locationId]
  || null

// ---------------------------------------------------------------------------
// 网格（坐标写 `scenarioFlags.mechanics.grid`，与引擎 grid-map.js 同形状）
// ---------------------------------------------------------------------------

function mechanicData(state) {
  state.scenarioFlags ||= {}
  const data = state.scenarioFlags.mechanics ||= { version: 1 }
  data.grid ||= {}
  return data
}
export function cellOf(state, id) {
  const cell = mechanicData(state).grid[id]
  return cell ? { x: cell.x, y: cell.y } : (flagsFor(state).hemlockPlacement?.[id] || null)
}
export const floorOfCell = cell => (cell && Number(cell.y) >= 0 ? Number(cell.y) + 1 : 0)
export function floorOf(state, id) {
  const location = locationOf(state, id)
  const cached = Number(location?.floor)
  if (Number.isFinite(cached) && cached >= 0) return cached
  return floorOfCell(cellOf(state, id))
}
export const floorOfLocation = (state, location) => floorOf(state, location?.id)

/** 放置/移动一个地点到网格格（引擎 api 优先）。 */
export function placeOnGrid(state, id, x, y, api = {}) {
  if (typeof api?.mechanics?.map?.place === 'function') {
    const placed = api.mechanics.map.place(id, x, y)
    if (placed) return placed
  }
  const data = mechanicData(state)
  const cell = data.grid[id] || (data.grid[id] = { x, y, isolated: false, connections: [] })
  cell.x = x
  cell.y = y
  cell.isolated = false
  cell.connections ||= []
  const location = locationOf(state, id)
  if (location) location.grid = { x, y }
  return id
}

/** 楼层写回地点（卧室帷幕 = 楼层 + 1；地窖 0 层）。 */
export function applyFloor(state, location) {
  if (!location) return null
  const cell = cellOf(state, location.id)
  if (!cell) return null
  location.floor = floorOfCell(cell)
  const rule = flagsOfCode(LOCATION_CODE_BY_ID[location.id] || '')?.shroudRule
  if (!isEnemyLocation(location) && rule === BEDROOM_SHROUD_RULE) location.shroud = location.floor + 1
  return location.floor
}

const orthogonalNeighborCells = cell => [
  { x: cell.x - 1, y: cell.y }, { x: cell.x + 1, y: cell.y },
  { x: cell.x, y: cell.y - 1 }, { x: cell.x, y: cell.y + 1 },
]

/** 连接 = 网格正交相邻（在场地点） ∪ 印刷固定连接（在场） ∪ 密道；敌人-地点同样保留连接。 */
export function syncConnections(state) {
  const secret = flagsFor(state).hemlockSecretPassage
  const inPlay = new Set((state.locations || []).map(location => location.id))
  const cellById = new Map((state.locations || []).map(location => [location.id, cellOf(state, location.id)]))
  for (const location of state.locations || []) {
    const cell = cellById.get(location.id)
    const neighbors = []
    if (cell) {
      for (const point of orthogonalNeighborCells(cell)) {
        for (const [otherId, otherCell] of cellById) {
          if (otherId === location.id || !otherCell) continue
          if (otherCell.x === point.x && otherCell.y === point.y) neighbors.push(otherId)
        }
      }
    }
    const printed = (LOCATION_CONNECTIONS[location.id] || []).filter(id => inPlay.has(id))
    const passage = secret && (location.id === secret || hasLocationRule(location.id, 'secretPassage'))
      ? [secret]
      : []
    location.connections = [...new Set([...neighbors, ...printed, ...passage])]
      .filter(id => id !== location.id && inPlay.has(id))
    applyFloor(state, location)
  }
  // 密道另一侧（被选中的地点）也必须连回所有藏书室。
  if (secret && inPlay.has(secret)) {
    const target = locationOf(state, secret)
    const libraries = (state.locations || []).filter(location => hasLocationRule(location.id, 'secretPassage'))
    if (target) {
      target.connections = [...new Set([...(target.connections || []),
        ...libraries.map(location => location.id)])].filter(id => id !== secret && inPlay.has(id))
    }
  }
  return state.locations
}

/** 连接图 BFS 距离（敌人-地点同样是节点；不可达的 id 不出现在结果里）。 */
export function distanceBetween(state, fromId, toIds) {
  if (!fromId) return new Map()
  const targets = new Set(toIds)
  const seen = new Set([fromId])
  const queue = [[fromId, 0]]
  const out = new Map()
  while (queue.length) {
    const [id, steps] = queue.shift()
    if (targets.has(id)) out.set(id, steps)
    const location = locationOf(state, id)
    for (const next of location?.connections || []) {
      if (seen.has(next) || !locationOf(state, next)) continue
      seen.add(next)
      queue.push([next, steps + 1])
    }
  }
  return out
}

/** 距离某调查员最近的敌人-地点（[tablet] 与 Pulled In 共用读点）。 */
export function nearestEnemyLocationTo(state, inv) {
  const from = inv?.location
  if (!from) return null
  const candidates = (state.locations || []).filter(isEnemyLocation)
  if (!candidates.length) return null
  const distances = distanceBetween(state, from, candidates.map(location => location.id))
  let best = null
  for (const location of candidates) {
    const steps = distances.get(location.id)
    if (steps == null) continue
    if (!best || steps < best.steps) best = { location, steps }
  }
  return best?.location || null
}

/** 「nearest to the most investigators」：按最近人数评分，平手取距离更近/更靠前的格。 */
export function nearestToMostInvestigators(state, candidates) {
  const active = activeInvestigators(state).filter(inv => inv.location)
  if (!candidates.length) return null
  if (!active.length) return candidates[0]
  const scored = candidates.map(location => {
    let count = 0
    let nearestSteps = Infinity
    for (const inv of active) {
      const distances = distanceBetween(state, inv.location, candidates.map(item => item.id))
      let best = Infinity
      for (const steps of distances.values()) best = Math.min(best, steps)
      const own = distances.get(location.id)
      if (own == null) continue
      nearestSteps = Math.min(nearestSteps, own)
      if (own === best) count += 1
    }
    const cell = cellOf(state, location.id) || { x: 0, y: 0 }
    return { location, count, nearestSteps, x: cell.x, y: cell.y }
  })
  scored.sort((a, b) => b.count - a.count || a.nearestSteps - b.nearestSteps
    || a.x - b.x || a.y - b.y || String(a.location.id).localeCompare(String(b.location.id)))
  return scored[0]?.location || null
}

// ---------------------------------------------------------------------------
// 翻面：地点 ↔ 敌人-地点（双面敌人-地点核心规则）
// ---------------------------------------------------------------------------

const cellarIdOf = location => location?.id === CELLAR_ID
  || (location?.originalCode || location?.code) === SHAPELESS_CELLAR_CODE
const sealForbidden = location => location?.cannotBeSealed === true || cellarIdOf(location)

function printedFaceOf(location) {
  return {
    code: location.originalCode || location.code || location.id,
    name: location.name,
    ...(location.nameEn != null ? { nameEn: location.nameEn } : {}),
    shroud: Number(location.shroud) || 0,
    traits: [...(location.traits || [])],
  }
}

function localTurnLocationIntoEnemy(state, location, face, { ready = false } = {}) {
  const previous = printedFaceOf(location)
  Object.assign(location, {
    code: face.code, originalCode: face.code, artCode: face.code,
    name: face.name, ...(face.nameEn != null ? { nameEn: face.nameEn } : {}),
    shroud: Number(face.shroud) || 0, traits: [...(face.traits || [])],
  })
  location.enemyLocationFace = previous
  const condition = location.enemyLocationCondition
  if (condition) delete location.enemyLocationCondition
  const enemy = {
    id: location.id, code: face.code, originalCode: face.code, name: face.name,
    traits: [...(face.traits || [])], location: location.id, enemyLocation: true,
    fight: Number(face.fight) || 0, evade: Number(face.evade) || 0,
    health: Number(face.health) || 1, damage: Number(face.damage) || 0,
    horror: Number(face.horror) || 0, victory: Number(face.victory) || 0,
    retaliate: face.retaliate === true, alert: face.alert === true, elite: face.elite !== false,
    massive: true, immobile: true, engagedSeat: null,
    exhausted: !ready && (condition?.exhausted ?? false),
    damageTaken: condition?.damageTaken ?? 0, doom: 0, clues: 0, attachments: [],
  }
  state.enemies ||= []
  state.enemies.push(enemy)
  return enemy
}

/** 把地点翻到敌人-地点面（封印/单面/已翻面的情形拒绝）。 */
export function flipToEnemySide(state, locationOrId, api = {}, { ready = false } = {}) {
  const location = typeof locationOrId === 'string' ? locationOf(state, locationOrId) : locationOrId
  if (!location || isEnemyLocation(location)) return null
  if (location.cannotBeFlipped === true || location.enemyLocationOnly === true) return null
  if (isSealed(location) || sealForbidden(location)) return null
  const face = ENEMY_LOCATION_FACES[location.id]
  if (!face) return null
  let enemy = null
  if (typeof api?.turnLocationIntoEnemy === 'function') {
    enemy = api.turnLocationIntoEnemy(location.id, face, { ready })
  }
  enemy = enemy || localTurnLocationIntoEnemy(state, location, face, { ready })
  applyFloor(state, location)
  syncConnections(state)
  applyEnemyLocationReveal(state, location, api)
  return enemy
}

function localRestoreEnemyLocation(state, location, { ready = false } = {}) {
  const index = (state.enemies || []).findIndex(enemy => enemy.id === location.id && enemy.enemyLocation)
  if (index < 0 || !location.enemyLocationFace) return false
  const enemy = state.enemies[index]
  if (enemy.attachments?.length) (location.attachments ||= []).push(...enemy.attachments)
  location.enemyLocationCondition = { exhausted: !ready && enemy.exhausted === true,
    damageTaken: Math.max(0, Number(enemy.damageTaken) || 0) }
  Object.assign(location, location.enemyLocationFace)
  delete location.enemyLocationFace
  state.enemies.splice(index, 1)
  return location
}

/** 把敌人-地点翻回地点面（保留伤害/横置状态）。 */
export function flipToLocationSide(state, locationOrId, api = {}, { ready = false } = {}) {
  const location = typeof locationOrId === 'string' ? locationOf(state, locationOrId) : locationOrId
  if (!location || !isEnemyLocation(location)) return null
  // 失形地窖一类的单面敌人-地点不能翻面（卡面「cannot be flipped」）。
  if (location.cannotBeFlipped === true || location.enemyLocationOnly === true) return null
  let result = null
  if (typeof api?.restoreEnemyLocation === 'function') result = api.restoreEnemyLocation(location.id, { ready })
  if (!result) result = localRestoreEnemyLocation(state, location, { ready })
  applyFloor(state, location)
  syncConnections(state)
  return result ? location : null
}

/** 「flip it over」：按当前面翻到另一面。 */
export function flipLocationOver(state, locationOrId, api = {}, options = {}) {
  const location = typeof locationOrId === 'string' ? locationOf(state, locationOrId) : locationOrId
  if (!location) return null
  if (isEnemyLocation(location)) return flipToLocationSide(state, location, api, options)
  return flipToEnemySide(state, location, api, options)
}

/** 敌人-地点背面被揭示时的强制效果（条目 flags.revealEffect 分派）。 */
export function applyEnemyLocationReveal(state, location, api = {}) {
  const effect = revealEffectOf(location?.id)
  if (!effect) return false
  const here = aliveInvestigatorsAt(state, location.id)
  const enemy = (state.enemies || []).find(item => item.enemyLocation && item.id === location.id) || null
  if (effect === 'attacksHere') {
    for (const inv of here) attackEnemyLocation(state, location, inv, api)
    return true
  }
  if (effect === 'attacksHereIfClues') {
    if ((Number(location.clues) || 0) > 0) for (const inv of here) attackEnemyLocation(state, location, inv, api)
    return true
  }
  if (effect === 'doomOnIt') {
    if (enemy && typeof api?.placeDoomOnCard === 'function') api.placeDoomOnCard(enemy, 1)
    else if (enemy) enemy.doom = (Number(enemy.doom) || 0) + 1
    else location.doom = (Number(location.doom) || 0) + 1
    info(api, `「${location.name}」被揭示：在其上放置 1 个毁灭。`)
    return true
  }
  if (effect === 'predationTest') {
    makePredationTest(state, api, { reason: `「${location.name}」被揭示` })
    return true
  }
  if (effect === 'discardRandomPerClue') {
    const count = Math.max(0, Number(location.clues) || 0)
    if (!count) return false
    for (const inv of here) safeCall(api, 'discardRandom', inv.seat, count)
    info(api, `「${location.name}」被揭示：此处调查员各随机弃 ${count} 张手牌。`)
    return true
  }
  if (effect === 'loseResources') {
    const targets = [...here]
    for (const inv of activeInvestigators(state)) {
      if (inv.location === location.id) continue
      const owner = locationOf(state, inv.location)
      if (owner?.connections?.includes(location.id)) targets.push(inv)
    }
    for (const inv of targets) {
      inv.resources = Math.max(0, (Number(inv.resources) || 0) - 2)
      info(api, `「${location.name}」被揭示：${inv.name} 失去 2 点资源。`)
    }
    return true
  }
  if (effect === 'horror') {
    for (const inv of here) safeCall(api, 'horror', inv.seat, 1)
    info(api, `「${location.name}」被揭示：此处调查员各承受 1 点恐惧。`)
    return true
  }
  return false
}

function attackEnemyLocation(state, location, inv, api = {}) {
  const enemy = (state.enemies || []).find(item => item.enemyLocation && item.id === location.id)
  if (!enemy || !inv || inv.defeated || inv.resigned) return false
  if (typeof api?.attack === 'function') { api.attack(enemy, inv); return true }
  const damage = Number(enemy.damage) || 0
  const horror = Number(enemy.horror) || 0
  if (damage) inv.damage = (Number(inv.damage) || 0) + damage
  if (horror) inv.horror = (Number(inv.horror) || 0) + horror
  return true
}

/** 失形地窖：单面敌人-地点，放入场时直接以敌人-地点形态出现。 */
export function placeCellar(state, api = {}) {
  const existing = locationOf(state, CELLAR_ID)
  if (existing && isEnemyLocation(existing)) return existing
  let location = existing
  if (!location) {
    if (typeof api?.place === 'function') api.place(CELLAR_ID)
    location = locationOf(state, CELLAR_ID)
  }
  if (!location) {
    const def = state.scenario?.locations?.[CELLAR_ID] || LOCATIONS[CELLAR_ID]
    location = { ...structuredClone(def), id: CELLAR_ID, revealed: true, doom: 0, damage: 0, horror: 0,
      resources: 0, attachments: [], clues: Number(def.cluesFixed) || 3 }
    location.maxClues = location.clues
    state.locations ||= []
    state.locations.push(location)
  }
  if (!isEnemyLocation(location)) {
    location.enemyLocationFace = printedFaceOf(location)
    Object.assign(location, {
      code: CELLAR_ENEMY_FACE.code, originalCode: CELLAR_ENEMY_FACE.code,
      name: CELLAR_ENEMY_FACE.name, shroud: CELLAR_ENEMY_FACE.shroud,
      traits: [...CELLAR_ENEMY_FACE.traits],
    })
    const enemy = {
      id: CELLAR_ID, code: SHAPELESS_CELLAR_CODE, originalCode: SHAPELESS_CELLAR_CODE,
      name: CELLAR_ENEMY_FACE.name, traits: [...CELLAR_ENEMY_FACE.traits], location: CELLAR_ID,
      enemyLocation: true, fight: CELLAR_ENEMY_FACE.fight, evade: CELLAR_ENEMY_FACE.evade,
      health: CELLAR_ENEMY_FACE.health, damage: CELLAR_ENEMY_FACE.damage,
      horror: CELLAR_ENEMY_FACE.horror, victory: CELLAR_ENEMY_FACE.victory,
      retaliate: true, alert: false, elite: true, massive: true, immobile: true,
      engagedSeat: null, exhausted: false, damageTaken: 0, doom: 0, clues: 0, attachments: [],
    }
    state.enemies ||= []
    state.enemies.push(enemy)
  }
  placeOnGrid(state, CELLAR_ID, CELLAR_SLOT.x, CELLAR_SLOT.y, api)
  applyFloor(state, location)
  syncConnections(state)
  info(api, '失形地窖（Shapeless Cellar）在中列下方（地窖层）入场。')
  return location
}

// ---------------------------------------------------------------------------
// 掠食袋（Predation Bag）与掠食检定
// ---------------------------------------------------------------------------

export function predationTokens(state) {
  return predationBagTokens(dayOf(state))
}
export function predationBagInfo(state, api = {}) {
  if (typeof api?.tokenBag?.info === 'function') {
    const value = api.tokenBag.info(PREDATION_BAG_ID)
    if (value?.exists) return value
  }
  const bag = state.tokenBags?.[PREDATION_BAG_ID]
  if (!bag) return { id: PREDATION_BAG_ID, exists: false, count: 0, revealed: [] }
  return { id: PREDATION_BAG_ID, exists: true, count: bag.tokens.length, revealed: [...bag.revealed] }
}

/** 按当日份数建立掠食袋（The Predatory House 正面文本）。 */
export function ensurePredationBag(state, api = {}) {
  const existing = predationBagInfo(state, api)
  if (existing.exists) return existing
  const tokens = predationTokens(state)
  if (typeof api?.tokenBag?.create === 'function') api.tokenBag.create(PREDATION_BAG_ID, tokens)
  else {
    state.tokenBags ||= {}
    state.tokenBags[PREDATION_BAG_ID] = { tokens: [...tokens], revealed: [] }
  }
  setFlag(state, 'hemlockPredationBagActive', true)
  info(api, `建立掠食袋：${tokens.length} 枚（当日 ${dayOf(state)}）。`)
  return { id: PREDATION_BAG_ID, exists: true, count: tokens.length, revealed: [] }
}

const localDrawToken = state => {
  const bag = state.tokenBags?.[PREDATION_BAG_ID]
  if (!bag || !bag.tokens.length) return null
  const roll = ((Number(state.rngState) || 1) % 1000) / 1000
  const index = Math.min(bag.tokens.length - 1, Math.floor(roll * bag.tokens.length))
  const [token] = bag.tokens.splice(index, 1)
  bag.revealed.push(token)
  return token
}
const revealPredationToken = (state, api = {}) => (typeof api?.tokenBag?.reveal === 'function'
  ? api.tokenBag.reveal(PREDATION_BAG_ID)
  : localDrawToken(state))
const returnPredationToken = (state, token, api = {}) => {
  if (typeof api?.tokenBag?.return === 'function' && api.tokenBag.return(PREDATION_BAG_ID, token)) return true
  const bag = state.tokenBags?.[PREDATION_BAG_ID]
  const index = bag?.revealed?.indexOf(token) ?? -1
  if (index < 0) return false
  bag.revealed.splice(index, 1)
  bag.tokens.push(token)
  return true
}
const addPredationToken = (state, token, api = {}) => {
  if (typeof api?.tokenBag?.add === 'function') { api.tokenBag.add(PREDATION_BAG_ID, token); return true }
  state.tokenBags ||= {}
  const bag = state.tokenBags[PREDATION_BAG_ID] ||= { tokens: [], revealed: [] }
  bag.tokens.push(token)
  return true
}

/** [tablet] / 掠食检定 tablet：把袋里「set aside」的标记与本标记都放回袋里。 */
export function returnSetAsidePredationTokens(state, api = {}) {
  const bagState = state.tokenBags?.[PREDATION_BAG_ID]
  const aside = bagState ? [...bagState.revealed] : [...(predationBagInfo(state, api).revealed || [])]
  let returned = 0
  for (const token of aside) if (returnPredationToken(state, token, api)) returned += 1
  return returned
}

/**
 * 掠食检定：从掠食袋揭示 1 枚并按 10524b 结算。
 * cultist → 放到一边；tablet → 每个敌人-地点攻击该处每名调查员（没有攻击则领队抽遭遇卡），
 * 然后把本标记与放一边的标记放回袋里；elder_thing → 放到一边并翻最近的未封印 [[Dormant]] 地点。
 */
export function makePredationTest(state, api = {}, { seat = null, reason = null } = {}) {
  if (flagsFor(state).hemlockCancelPredation === true) {
    clearFlag(state, 'hemlockCancelPredation')
    info(api, '基甸·米兹拉克的承诺：取消本次掠食检定。')
    return { cancelled: true, token: null }
  }
  const bag = ensurePredationBag(state, api)
  if (!bag.exists || bag.count <= 0) {
    info(api, '掠食袋为空：本次掠食检定无事发生。')
    return { cancelled: false, token: null }
  }
  const token = revealPredationToken(state, api)
  if (!token) return { cancelled: false, token: null }
  setFlag(state, 'hemlockPredationActive', true)
  const lead = seat == null ? leadSeat(state) : Number(seat)
  info(api, `掠食检定${reason ? `（${reason}）` : ''}：领队揭示掠食标记 [${token}]。`)
  const outcome = resolvePredationToken(state, token, api, { seat: lead })
  return { cancelled: false, token, ...outcome }
}

/** 掠食标记结算（不抽取）。 */
export function resolvePredationToken(state, token, api = {}, { seat = null } = {}) {
  if (token === 'cultist') {
    info(api, '掠食检定 [cultist]：把该标记放到一边。')
    return { effect: 'cultist', returned: 0 }
  }
  if (token === 'tablet') {
    const attacked = new Set()
    for (const location of (state.locations || []).filter(isEnemyLocation)) {
      for (const inv of aliveInvestigatorsAt(state, location.id)) {
        attackEnemyLocation(state, location, inv, api)
        attacked.add(inv.seat)
      }
    }
    if (attacked.size === 0) {
      const lead = seat == null ? leadSeat(state) : Number(seat)
      safeCall(api, 'drawEncounter', lead)
      info(api, '掠食检定 [tablet]：没有发生攻击，领队抽取遭遇牌库顶牌。')
    } else {
      info(api, `掠食检定 [tablet]：${attacked.size} 名调查员被敌人-地点攻击。`)
    }
    const returned = returnSetAsidePredationTokens(state, api)
    info(api, `掠食检定 [tablet]：把 ${returned} 枚放到一边的掠食标记放回掠食袋。`)
    return { effect: 'tablet', attacked: attacked.size, returned }
  }
  if (token === 'elderthing') {
    const target = nearestToMostInvestigators(state, unsealedDormantLocations(state))
    let flipped = false
    if (target) {
      flipped = Boolean(flipToEnemySide(state, target, api))
      if (flipped) info(api, `掠食检定 [elder_thing]：「${target.name}」翻到敌人-地点面。`)
    }
    if (!flipped) info(api, '掠食检定 [elder_thing]：没有可翻面的未封印 [[Dormant]] 地点。')
    return { effect: 'elderthing', locationId: target?.id || null, flipped }
  }
  info(api, '掠食检定：未知掠食标记。')
  return { effect: 'unknown', token }
}

/** 基甸法典：「取消下一次掠食」。 */
export function cancelNextPredation(state, api = {}) {
  setFlag(state, 'hemlockCancelPredation', true)
  info(api, '记住：你们正在帮助基甸——取消下一次掠食。')
  return true
}

/** 把掠食检定卡（10524b）连同掠食袋一起放进场（议程 1b 结算 The Predatory House）。 */
export function resolvePredatoryHouse(state, api = {}) {
  ensurePredationBag(state, api)
  state.storyAssets ||= []
  let asset = state.storyAssets.find(item => codeOf(item) === PREDATION_TEST_CODE
    || codeOf(item) === PREDATORY_HOUSE_CODE)
  if (!asset && typeof api?.storyAsset === 'function') asset = api.storyAsset(PREDATION_TEST_CODE, null)
  if (!asset) {
    const card = ALL_CARDS[PREDATION_TEST_CODE] || {}
    asset = {
      id: 'hemlock-predatory-house', code: PREDATION_TEST_CODE, originalCode: PREDATION_TEST_CODE,
      face: 'back', frontFaceCode: PREDATORY_HOUSE_CODE, name: card.nameZh || card.name || PREDATION_TEST_CODE,
      global: true, location: null, controllerSeat: null, exhausted: false,
    }
    state.storyAssets.push(asset)
  }
  setFlag(state, 'hemlockPredatoryHouseInPlay', true)
  info(api, '「猎杀之屋」进入场上：建立掠食袋与掠食检定（10524b）。')
  return asset
}

// ---------------------------------------------------------------------------
// 布置
// ---------------------------------------------------------------------------

function seededRandom(state, salt) {
  let seed = ((Number(state?.rngState) || 0) ^ hashString(salt)) >>> 0
  if (!seed) seed = 0x9e3779b9
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed / 4294967296
  }
}
function hashString(value) {
  let hash = 2166136261
  for (const ch of String(value)) {
    hash ^= ch.codePointAt(0)
    hash = Math.imul(hash, 16777619) >>> 0
  }
  return hash >>> 0
}
function shuffleWith(random, list) {
  const out = [...list]
  for (let index = out.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1))
    ;[out[index], out[swap]] = [out[swap], out[index]]
  }
  return out
}

/**
 * 地点布置计划（Setup「locations」：第一层三间固定；随机 1 间卧室放四层中列；其余 8 间洗匀取 6 间
 * 放第二/三层，剩 2 间移出游戏）。结果写 `scenarioFlags.hemlockPlacement`，幂等（startLocation 会
 * 在布置之前先算一次，因为 Day 3 从四层卧室开始）。
 */
export function ensurePlacementPlan(state) {
  const flags = flagsFor(state)
  if (flags.hemlockPlacement && flags.hemlockAsideBedroom) {
    return {
      cells: flags.hemlockPlacement,
      order: flags.hemlockPlacementOrder || [],
      topBedroom: flags.hemlockAsideBedroom,
      removed: flags.hemlockRemovedLocations || [],
    }
  }
  const random = seededRandom(state, 'hemlock-house-placement')
  const bedrooms = shuffleWith(random, BEDROOM_IDS)
  const topBedroom = bedrooms[0]
  const pool = SHUFFLE_POOL_IDS.filter(id => id !== topBedroom)
  const shuffled = shuffleWith(random, pool)
  const placed = shuffled.slice(0, RANDOM_SLOTS.length)
  const removed = shuffled.slice(RANDOM_SLOTS.length)
  const cells = { ...FIRST_FLOOR }
  RANDOM_SLOTS.forEach((slot, index) => { cells[placed[index]] = { x: slot.x, y: slot.y } })
  cells[topBedroom] = { x: TOP_BEDROOM_SLOT.x, y: TOP_BEDROOM_SLOT.y }
  const order = Object.keys(FIRST_FLOOR).concat(placed, [topBedroom])
  flags.hemlockPlacement = cells
  flags.hemlockPlacementOrder = order
  flags.hemlockAsideBedroom = topBedroom
  flags.hemlockRemovedLocations = removed
  return { cells, order, topBedroom, removed }
}

/** 布置起点：Day 3 从四层卧室开始，其余从门厅开始。 */
export function startLocation(state) {
  const plan = ensurePlacementPlan(state)
  return dayOf(state) === 3 ? plan.topBedroom : START_LOCATION
}

/** 引擎真实入口：setup.js#setupLocations。返回按顺序入场的地点 id。 */
export function setupLocations(state, events = [], helper = {}) {
  void events
  const api = helper.api || { info: () => {} }
  const report = prepareScenario(state, api)
  return [...report.order]
}

export function prepareScenario(state, api = {}) {
  state.scenarioFlags ||= {}
  state.scenarioZones ||= {}
  const date = dateOf(state)
  setFlag(state, 'hemlockHouseDay', date.day)
  setFlag(state, 'hemlockHouseNight', date.period === 'night')
  const plan = ensurePlacementPlan(state)

  state.acts = [structuredClone(ACT_STAGES.strangeInfestation), structuredClone(ACT_STAGES.heartOfTheHouse)]
  state.actIndex = 0
  state.agendas = agendaDeckForDate(date).map(agenda => structuredClone(agenda))
  state.agendaIndex = 0
  setFlag(state, 'hemlockAgendaVariant', agendaUseV1(date) ? 'v1' : 'v2')
  setFlag(state, 'hemlockSetAsideAct', AGAINST_THE_HOUSE_CODE)
  setFlag(state, 'hemlockStartLocation', date.day === 3 ? plan.topBedroom : START_LOCATION)

  state.scenarioZones.setAside = [...SET_ASIDE_CARDS]
  state.scenarioZones.setAsideLocations = [CELLAR_ID]
  state.scenarioZones.removedLocations = [...plan.removed]
  setFlag(state, 'hemlockPrepared', true)
  info(api, `汉洛克庄园：第 ${date.day} 日${date.period === 'night' ? '夜晚' : '白天'}；`
    + `地点布置完成（四层卧室：${plan.topBedroom}；移出游戏：${plan.removed.join('、') || '无'}）。`)
  return { date, order: plan.order, cells: plan.cells, topBedroom: plan.topBedroom, removed: plan.removed }
}

/** 引擎真实入口：locations.js#placeLocation 之后（写格、楼层、连接）。 */
export function locationPlaced(state, location, api = {}) {
  if (!location) return
  const cell = flagsFor(state).hemlockPlacement?.[location.id]
  if (cell) placeOnGrid(state, location.id, cell.x, cell.y, api)
  if (location.id === CELLAR_ID && !isEnemyLocation(location)) {
    placeCellar(state, api)
    return
  }
  applyFloor(state, location)
  syncConnections(state)
}

const storyAssetInstance = (state, code, locationId) => ({
  id: `hemlock-${code}`, code, originalCode: code,
  name: ALL_CARDS[code]?.nameZh || ALL_CARDS[code]?.name || code,
  global: false, location: locationId, controllerSeat: null, exhausted: false, tokens: 0,
})

function spawnStoryAsset(state, code, locationId, api = {}) {
  state.storyAssets ||= []
  const existing = state.storyAssets.find(item => codeOf(item) === code)
  if (existing) {
    if (locationId) existing.location = locationId
    return existing
  }
  let asset = null
  if (typeof api?.storyAsset === 'function') asset = api.storyAsset(code, locationId)
  if (!asset) {
    asset = storyAssetInstance(state, code, locationId)
    state.storyAssets.push(asset)
  }
  return asset
}

/** Setup「residents」：只有 Day 时才收集 *Residents* 并按日放置；其余放一边（out of play）。 */
export function placeResidents(state, api = {}) {
  const date = dateOf(state)
  const plan = ensurePlacementPlan(state)
  const planned = []
  if (date.period === 'day') {
    for (const [resident, spec] of Object.entries(RESIDENT_SETUP)) {
      if (!spec.days.includes(date.day)) continue
      const locationId = spec.location === 'topBedroom' ? plan.topBedroom : spec.location
      if (!locationOf(state, locationId)) continue
      planned.push({ resident, code: spec.code, location: locationId })
    }
    // Day 1：小西尔维放在「最底层的一间卧室」。
    if (date.day === 1) {
      const bedrooms = (state.locations || []).filter(location =>
        BEDROOM_IDS.includes(location.id) && !isEnemyLocation(location))
      if (bedrooms.length) {
        const lowest = bedrooms.reduce((best, location) =>
          floorOf(state, location.id) < floorOf(state, best.id) ? location : best, bedrooms[0])
        planned.push({ resident: 'littleSylvie', code: LITTLE_SYLVIE_CODE, location: lowest.id })
      }
    }
  }
  const placed = []
  for (const item of planned) {
    spawnStoryAsset(state, item.code, item.location, api)
    placed.push(item)
  }
  // Residents 组整组收集后：没入场的居民放一边（夜晚整组放一边）。
  state.scenarioZones ||= {}
  const used = new Set(placed.map(item => item.code))
  const setAside = new Set(state.scenarioZones.setAside || [])
  const roster = [...RESIDENT_CODES, LITTLE_SYLVIE_CODE]
  for (const code of roster) {
    if (used.has(code)) setAside.delete(code)
    else setAside.add(code)
  }
  state.scenarioZones.setAside = [...setAside]
  info(api, date.period === 'day'
    ? `居民入场：${placed.map(item => item.location).join('、') || '无'}。`
    : '时段为夜晚：Residents 整组放一边，本次不放置任何居民。')
  return placed
}

/** 引擎真实入口：setup.js#setupScenarioDecks 之后（当日遭遇组、居民）。 */
export function afterDeckSetup(state, events = [], helper = {}) {
  void events
  const api = helper.api || { info: () => {} }
  const date = dateOf(state)
  const dayCards = DAY_ENCOUNTER_DECKS[date.day] || []
  if (dayCards.length) {
    if (typeof api.shuffleIntoEncounterDeck === 'function') api.shuffleIntoEncounterDeck([...dayCards])
    else {
      state.encounterDeck ||= []
      state.encounterDeck.push(...dayCards)
    }
    info(api, `当日遭遇组（第 ${date.day} 日）${dayCards.length} 张加入遭遇牌库。`)
  }
  placeResidents(state, api)
  setFlag(state, 'hemlockDeckPrepared', true)
}

/** 直调/单测入口：准备 + 地点入场 + 当日遭遇组 + 居民。 */
export function setupScenario(state, api = {}) {
  const report = prepareScenario(state, api)
  const placed = []
  for (const id of report.order) {
    if (locationOf(state, id)) { placed.push(id); continue }
    const def = state.scenario?.locations?.[id] || LOCATIONS[id]
    if (!def) continue
    const clues = def.cluesFixed ?? (Number(def.cluesPerInvestigator) || 0) * investigatorCount(state)
    const location = {
      ...structuredClone(def), id, revealed: true, clues, maxClues: clues,
      doom: 0, damage: 0, horror: 0, resources: 0, attachments: [], sealCount: 0,
    }
    state.locations ||= []
    state.locations.push(location)
    locationPlaced(state, location, api)
    placed.push(id)
  }
  state.locations = (state.locations || []).filter(location => ALL_LOCATION_IDS.includes(location.id))
  const start = startLocation(state)
  state.investigators ||= []
  for (const inv of state.investigators) if (!inv.location) inv.location = start
  if (!state.encounterDeck?.length) state.encounterDeck = [...(state.scenario?.encounterDeck || ENCOUNTER_DECK)]
  afterDeckSetup(state, [], { api })
  syncConnections(state)
  info(api, `汉洛克庄园布置完成：${placed.length} 处地点入场（起始：${start}）。`)
  return { ...report, placedIds: placed, start }
}

// ---------------------------------------------------------------------------
// 行动
// ---------------------------------------------------------------------------

const sealActActive = state => actRuleFlags(state).sealAction === true
const groupCluesAt = (state, locationId) => aliveInvestigatorsAt(state, locationId)
  .reduce((sum, inv) => sum + Math.max(0, Number(inv.clues) || 0), 0)
const sealCost = state => investigatorCount(state)

function spendGroupClues(state, locationId, amount, api = {}) {
  let remaining = Math.max(0, Math.floor(amount))
  let spent = 0
  for (const inv of aliveInvestigatorsAt(state, locationId)) {
    if (remaining <= 0) break
    const take = Math.min(remaining, Math.max(0, Number(inv.clues) || 0))
    if (!take) continue
    if (typeof api?.spendClues === 'function') {
      try { api.spendClues(inv.seat, take) } catch { continue }
    } else {
      inv.clues -= take
    }
    remaining -= take
    spent += take
  }
  return spent
}

/** 放置 1 个封印（资源）：条目标了 `afterSealReaction` 的地点在此结算「放置封印后」反应。 */
export function placeSeal(state, locationId, placerSeat = null, api = {}) {
  const location = locationOf(state, locationId)
  if (!location || isEnemyLocation(location) || sealForbidden(location)) return false
  if (typeof api?.changeLocationSeals === 'function') {
    const ok = api.changeLocationSeals(locationId, 1)
    if (ok === false) return false
    if (!Number.isFinite(location.sealCount)) location.sealCount = 1
  } else {
    location.sealCount = sealCount(location) + 1
  }
  info(api, `「${location.name}」获得 1 个封印（累计 ${sealCount(location)}）。`)
  if (hasLocationRule(location.id, 'afterSealReaction') && placerSeat != null) {
    const inv = state.investigators?.[placerSeat]
    if (inv) {
      const choice = typeof api?.choose === 'function'
        ? api.choose({
          kind: 'card', source: 'hemlockHouseBedroom', seat: placerSeat, canSkip: true,
          prompt: '卧室：放置封印后，抽 1 张牌或获得 2 资源。',
          options: [{ id: 'draw', label: '抽 1 张牌' }, { id: 'resources', label: '获得 2 资源' }],
        })
        : 'draw'
      if (choice === 'resources') {
        inv.resources = (Number(inv.resources) || 0) + 2
        info(api, `${inv.name} 获得 2 点资源。`)
      } else if (typeof api?.drawCards === 'function') {
        api.drawCards(placerSeat, 1)
      } else if (inv.deck?.length) {
        const code = inv.deck.pop()
        ;(inv.hand ||= []).push(code)
        info(api, `${inv.name} 抽 1 张牌。`)
      }
    }
  }
  return true
}

const foyerFastMoveUsed = (state, inv) => {
  const used = flagsFor(state).hemlockFoyerMove
  return used && Number(used.round) === Number(state.round) && Number(used.seat) === inv.seat
}
const washroomUsedRound = state => Number(flagsFor(state).hemlockWashroomRound) === Number(state.round)
const parlorUsedRound = state => Number(flagsFor(state).hemlockParlorRound) === Number(state.round)
const secretPassageUsed = state => flagsFor(state).hemlockSecretPassageUsed === true

// 地点能力按单卡条目的规则标记分派（`fastMoveClueBelow` / `secretPassage` / `rangedStrike` …），
// 本文件不写卡号分支。
const isWashroom = location => hasLocationRule(location?.id, 'fastMoveClueBelow')
const isLibrary = location => hasLocationRule(location?.id, 'secretPassage')
const isParlor = location => hasLocationRule(location?.id, 'rangedStrike')

export function locationBelow(state, location) {
  const cell = cellOf(state, location.id)
  if (!cell) return null
  return (state.locations || []).find(other => {
    const otherCell = cellOf(state, other.id)
    return otherCell && otherCell.x === cell.x && otherCell.y === cell.y - 1
  }) || null
}

export function actions(state, inv) {
  if (!inv || state.status !== 'playing' || inv.defeated || inv.resigned) return []
  const moves = []
  const location = locationOf(state, inv.location)
  if (!location) return moves

  // 幕 1a / 2a：[action] 未封印且 [[Dormant]] 的地点，此处调查员共同支付 1[per_investigator] 线索封印。
  if (sealActActive(state) && isDormant(location) && !isSealed(location) && !sealForbidden(location)) {
    const cost = sealCost(state)
    const available = groupCluesAt(state, inv.location)
    if (available >= cost) {
      moves.push({ action: 'scenarioAction', rule: 'hemlockHouseSeal', actions: 1,
        label: `共同支付 ${cost} 个线索：在「${location.name}」放置 1 个封印` })
    } else {
      moves.push({ action: 'scenarioAction', rule: 'hemlockHouseSeal', actions: 1,
        reason: `封印需要此处调查员共支付 ${cost} 个线索（现有 ${available}）` })
    }
  }

  // 议程 2a/3a：[fast] 支付 1[per_investigator] 线索或移除 1 个封印：重整并翻面你所在地点。
  if (isPredationAgendaStep(state) && flagsOfCode(currentAgendaCode(state)).fastFlipLocation === true) {
    const cost = sealCost(state)
    if (groupCluesAt(state, inv.location) >= cost) {
      moves.push({ action: 'scenarioAction', rule: 'hemlockHouseAgendaFlip', mode: 'clues', actions: 0,
        label: `支付 ${cost} 个线索：重整并翻面「${location.name}」` })
    }
    if (isSealed(location)) {
      moves.push({ action: 'scenarioAction', rule: 'hemlockHouseAgendaFlip', mode: 'seal', actions: 0,
        label: `移除「${location.name}」的 1 个封印：重整并翻面它` })
    }
  }

  // 门厅：[fast] 你的回合内，移动到一个相连地点（每回合一次）。
  if (hasLocationRule(location.id, 'fastMove') && location.revealed !== false) {
    if (foyerFastMoveUsed(state, inv)) {
      moves.push({ action: 'scenarioAction', rule: 'hemlockHouseFoyerMove', actions: 0,
        reason: '本回合已经使用过门厅的快速移动' })
    } else {
      for (const destination of location.connections || []) {
        const target = locationOf(state, destination)
        if (!target) continue
        moves.push({ action: 'scenarioAction', rule: 'hemlockHouseFoyerMove', destination, actions: 0,
          label: `快速移动：门厅 →「${target.name}」（每回合一次）` })
      }
    }
  }

  // 盥洗室：[fast] 把此处的 1 个线索移到正下方地点（每回合一次）。
  if (isWashroom(location) && (Number(location.clues) || 0) > 0) {
    const below = locationBelow(state, location)
    if (below) {
      moves.push(washroomUsedRound(state)
        ? { action: 'scenarioAction', rule: 'hemlockHouseWashroomClue', actions: 0,
          reason: '本回合已经使用过盥洗室的移动线索' }
        : { action: 'scenarioAction', rule: 'hemlockHouseWashroomClue', destination: below.id, actions: 0,
          label: `把 1 个线索移到正下方的「${below.name}」（每回合一次）` })
    }
  }

  // 客厅：[action] 花费 1 线索：对相连地点的 1 个敌人造成 2 点伤害，可检定智识(4)再加 1 点（每轮一次）。
  if (isParlor(location)) {
    const targets = (state.enemies || []).filter(enemy => !enemy.defeated
      && (location.connections || []).includes(enemy.location))
    if (targets.length) {
      moves.push(parlorUsedRound(state)
        ? { action: 'scenarioAction', rule: 'hemlockHouseParlorStrike', actions: 1,
          reason: '本回合已经使用过客厅的攻击' }
        : { action: 'scenarioAction', rule: 'hemlockHouseParlorStrike', actions: 1,
          label: '花费 1 线索：对相连地点的一个敌人造成 2 点伤害（每轮一次）' })
    }
  }

  // 藏书室：[reaction] 发现此处最后一个线索后：选择任意地点放 1 个恐惧标记作为密道（每场游戏一次）。
  if (isLibrary(location) && !secretPassageUsed(state)) {
    moves.push({ action: 'scenarioAction', rule: 'hemlockHouseSecretPassage', actions: 0,
      label: '已发现最后线索：选择任意地点作为密道（每场游戏一次）' })
  }

  return moves
}

function dealEnemyDamage(state, enemy, amount, api = {}) {
  if (!enemy) return 0
  if (typeof api.damageEnemy === 'function') { api.damageEnemy(enemy, amount); return amount }
  enemy.damageTaken = (Number(enemy.damageTaken) || 0) + amount
  if (typeof api.checkEnemyDefeat === 'function') api.checkEnemyDefeat(enemy)
  else if (enemy.damageTaken >= (Number(enemy.health) || 1)) enemy.defeated = true
  return amount
}

function parlorStrike(state, inv, api) {
  const location = locationOf(state, inv.location)
  if (!location || !isParlor(location) || parlorUsedRound(state)) return false
  if ((Number(inv.clues) || 0) < 1) return false
  const targets = (state.enemies || []).filter(enemy => !enemy.defeated
    && (location.connections || []).includes(enemy.location))
  if (!targets.length) return false
  const pick = typeof api?.choose === 'function'
    ? api.choose({
      kind: 'enemy', source: 'hemlockHouseParlor', seat: inv.seat,
      prompt: '客厅：选择相连地点的一个敌人。',
      options: targets.map(enemy => ({ id: enemy.id, label: enemy.name })),
    })
    : targets[0].id
  const enemy = targets.find(item => item.id === pick) || targets[0]
  if (typeof api?.spendClues === 'function') api.spendClues(inv.seat, 1)
  else inv.clues = Math.max(0, (inv.clues || 0) - 1)
  setFlag(state, 'hemlockParlorRound', Number(state.round))
  dealEnemyDamage(state, enemy, 2, api)
  info(api, `客厅：对「${enemy.name}」造成 2 点伤害。`)
  if (typeof api?.test === 'function') {
    api.test(inv.seat, 'intellect', 4, result => {
      if (!result.success) return
      dealEnemyDamage(state, enemy, 1, api)
      info(api, '客厅：智识检定成功，追加 1 点伤害。')
    }, 0, { label: '客厅：追加伤害' })
  }
  return true
}

export function performAction(state, inv, move, api = {}) {
  if (!move || !inv) return false
  if (move.rule === 'hemlockHouseSeal') {
    const location = locationOf(state, inv.location)
    if (!location || !isDormant(location) || isSealed(location) || !sealActActive(state)) return false
    const cost = sealCost(state)
    if (groupCluesAt(state, inv.location) < cost) return false
    if (spendGroupClues(state, inv.location, cost, api) < cost) return false
    return placeSeal(state, location.id, inv.seat, api)
  }
  if (move.rule === 'hemlockHouseAgendaFlip') {
    if (!isPredationAgendaStep(state)) return false
    const location = locationOf(state, inv.location)
    if (!location) return false
    if (move.mode === 'seal') {
      if (!isSealed(location)) return false
      if (typeof api?.changeLocationSeals === 'function') api.changeLocationSeals(location.id, -1)
      else location.sealCount = Math.max(0, sealCount(location) - 1)
      info(api, `移除「${location.name}」的 1 个封印。`)
    } else {
      const cost = sealCost(state)
      if (groupCluesAt(state, inv.location) < cost) return false
      if (spendGroupClues(state, inv.location, cost, api) < cost) return false
    }
    if (isEnemyLocation(location)) {
      const enemy = (state.enemies || []).find(item => item.enemyLocation && item.id === location.id)
      if (enemy) {
        enemy.exhausted = false
        if (typeof api?.readyEnemy === 'function') api.readyEnemy(enemy)
      }
    } else if (location.exhausted === true) {
      location.exhausted = false
    }
    const flipped = flipLocationOver(state, location, api)
    info(api, `${inv.name} 重整并翻面「${location.name}」${flipped ? '' : '（无法翻面）'}。`)
    return Boolean(flipped)
  }
  if (move.rule === 'hemlockHouseFoyerMove') {
    const location = locationOf(state, inv.location)
    if (!location || !hasLocationRule(location.id, 'fastMove') || foyerFastMoveUsed(state, inv)) return false
    if (!(location.connections || []).includes(move.destination)) return false
    setFlag(state, 'hemlockFoyerMove', { round: Number(state.round), seat: inv.seat })
    if (typeof api?.moveInvestigator === 'function') api.moveInvestigator(inv.seat, move.destination)
    else inv.location = move.destination
    info(api, `${inv.name} 使用门厅的快速移动。`)
    return true
  }
  if (move.rule === 'hemlockHouseWashroomClue') {
    const location = locationOf(state, inv.location)
    if (!location || !isWashroom(location) || washroomUsedRound(state)) return false
    const below = locationBelow(state, location)
    if (!below || (Number(location.clues) || 0) < 1) return false
    location.clues = (Number(location.clues) || 0) - 1
    below.clues = (Number(below.clues) || 0) + 1
    below.maxClues = Math.max(Number(below.maxClues) || 0, below.clues)
    setFlag(state, 'hemlockWashroomRound', Number(state.round))
    info(api, `盥洗室：把 1 个线索移到正下方的「${below.name}」。`)
    return true
  }
  if (move.rule === 'hemlockHouseParlorStrike') return parlorStrike(state, inv, api)
  if (move.rule === 'hemlockHouseSecretPassage') {
    const location = locationOf(state, inv.location)
    if (!location || !isLibrary(location) || secretPassageUsed(state)) return false
    const candidates = (state.locations || []).filter(item => item.id !== location.id)
    if (!candidates.length) return false
    const pick = typeof api?.choose === 'function'
      ? api.choose({
        kind: 'location', source: 'hemlockHouseLibrary', seat: inv.seat,
        prompt: '藏书室：选择任意地点作为密道（在其上放 1 个恐惧标记）。',
        options: candidates.map(item => ({ id: item.id, label: item.name })),
      })
      : candidates[0].id
    const target = candidates.find(item => item.id === pick) || candidates[0]
    target.horror = (Number(target.horror) || 0) + 1
    setFlag(state, 'hemlockSecretPassage', target.id)
    setFlag(state, 'hemlockSecretPassageUsed', true)
    syncConnections(state)
    info(api, `藏书室：密道通向「${target.name}」。`)
    return true
  }
  return false
}

/**
 * 「Clues cannot be discovered from locations with no investigators.」（幕 1a / 2a 正面）
 * 引擎读点：locations.js#canDiscoverClueAt / discoverClueAt。
 */
export function canDiscoverClues(state, inv, location) {
  void inv
  if (!location || actRuleFlags(state).cluesOnlyWithInvestigators !== true) return true
  return aliveInvestigatorsAt(state, location.id).length > 0
}

/**
 * 10546「若场上没有敌人-地点，本卡获得涌动」（条目 flags.surgeWithoutEnemyLocation）。
 * 引擎读点：encounter.js#drawEncounter 的 finishDraw → behavior.encounterGainsSurge。
 */
export function encounterGainsSurge(state, code, inv) {
  void inv
  if (flagsOfCode(code).surgeWithoutEnemyLocation !== true) return false
  return !(state.locations || []).some(isEnemyLocation)
}

// ---------------------------------------------------------------------------
// 阶段钩子：神话阶段结束的掠食检定、轮末的幕 1 目标
// ---------------------------------------------------------------------------

/** 议程 2a/3a 正面：Forced - 神话阶段结束时进行掠食检定。 */
export function mythosEnded(state, api = {}) {
  flushElderThingTransfers(state, api)
  const agenda = currentAgenda(state)
  if (!agenda || agenda.face === 'back') return false
  if (flagsOfCode(currentAgendaCode(state)).forcedPredationAtMythosEnd !== true) return false
  makePredationTest(state, api, { reason: `议程「${agenda.name}」` })
  return true
}

/** 幕 1 目标：轮末「封印中的地点 + 胜利展示区的敌人-地点」合计 ≥7 时推进。 */
export function checkSealObjective(state, api = {}) {
  if (currentActCode(state) !== STRANGE_INFESTATION_CODE) return false
  if (flagsFor(state).hemlockAct1Advancing) return false
  const total = sealedLocationCount(state) + enemyLocationsInVictory(state)
  if (total < 7) return false
  setFlag(state, 'hemlockAct1Advancing', true)
  info(api, `场上共 ${total} 处地点已封印或已进入胜利展示区（≥7）：推进幕 1。`)
  if (typeof api?.advanceAct === 'function') api.advanceAct()
  return true
}

export function roundEnded(state, api = {}) {
  flushElderThingTransfers(state, api)
  checkCellarVictory(state, api)
  return checkSealObjective(state, api)
}

/** 失形地窖：无线索时放入胜利展示区（强制）。 */
export function checkCellarVictory(state, api = {}) {
  const location = locationOf(state, CELLAR_ID)
  if (!location || !isEnemyLocation(location)) return false
  if ((Number(location.clues) || 0) > 0) return false
  if (cellarInVictory(state)) return false
  if (flagsOfCode(SHAPELESS_CELLAR_CODE).victoryWhenNoClues !== true) return false
  const enemy = cellarEnemy(state)
  if (enemy && typeof api?.addEnemyToVictory === 'function') api.addEnemyToVictory(enemy)
  else {
    state.victoryDisplay ||= []
    state.victoryDisplay.push({
      id: `location:${CELLAR_ID}`, code: SHAPELESS_CELLAR_CODE, originalCode: SHAPELESS_CELLAR_CODE,
      name: location.name, victory: Number(location.victory) || 1,
    })
    state.victory = (Number(state.victory) || 0) + (Number(location.victory) || 1)
  }
  if (typeof api?.remove === 'function') api.remove(CELLAR_ID)
  else {
    state.locations = (state.locations || []).filter(item => item.id !== CELLAR_ID)
    state.enemies = (state.enemies || []).filter(item => item.id !== CELLAR_ID)
  }
  info(api, '失形地窖上没有线索：它被放入胜利展示区。')
  return true
}

/** 调查后脚本效果：失形地窖失败攻击、餐厅最后线索随机弃牌、藏书室最后线索提示。 */
export function afterInvestigate(state, inv, location, result, api = {}) {
  flushElderThingTransfers(state, api)
  if (!inv || !location) return false
  if (location.id === CELLAR_ID && flagsOfCode(SHAPELESS_CELLAR_CODE).attacksOnFailedInvestigation === true
    && result && result.success === false) {
    attackEnemyLocation(state, location, inv, api)
    info(api, `失形地窖：${inv.name} 调查失败，地窖攻击他们。`)
    return true
  }
  const lastClue = (Number(location.clues) || 0) === 0
  if (lastClue && hasLocationRule(location.id, 'forcedLastClueDiscard')) {
    safeCall(api, 'discardRandom', inv.seat, 1)
    info(api, '餐厅：发现最后线索后随机弃掉 1 张手牌。')
    return true
  }
  if (lastClue && hasLocationRule(location.id, 'secretPassage') && !secretPassageUsed(state)) {
    info(api, '藏书室：发现最后线索，可以找到一条密道。')
    return true
  }
  return false
}

// ---------------------------------------------------------------------------
// 敌人规则（紧锢孽种：楼层生命、夜间报复；庄园之心：被敌人-地点攻击后移动到地窖）
// ---------------------------------------------------------------------------

export function enemyStatModifier(state, enemy, stat) {
  if (!enemy) return 0
  const code = codeOf(enemy)
  if (code !== GRAPPLING_SPAWN_CODE) return 0
  if (stat === 'health') return Math.max(1, floorOf(state, enemy.location))
  return 0
}

export function enemySpawned(state, enemy, api = {}) {
  if (!enemy) return
  if (codeOf(enemy) !== GRAPPLING_SPAWN_CODE) return
  // 「Hunter.（Night [night]）Retaliate.」——只在夜晚获得报复。
  enemy.retaliate = isNight(state)
  info(api, `紧锢孽种${enemy.retaliate ? '（夜晚）获得报复。' : '（白天）没有报复。'}`)
}

/**
 * 幕 2a「庄园之心」：Forced - After an enemy-location attacks you: Move (one location at a time) to
 * Shapeless Cellar.
 */
export function enemyAttackResolved(state, enemy, inv, api = {}) {
  if (!enemy?.enemyLocation || !inv) return false
  if (actRuleFlags(state).forcedMoveToCellarOnEnemyLocationAttack !== true) return false
  if (!cellarInPlay(state) || inv.location === CELLAR_ID || inv.defeated || inv.resigned) return false
  if (typeof api?.moveInvestigator === 'function') api.moveInvestigator(inv.seat, CELLAR_ID)
  else inv.location = CELLAR_ID
  info(api, `庄园之心：${inv.name} 被敌人-地点攻击后移动到失形地窖。`)
  return true
}

// ---------------------------------------------------------------------------
// 幕 / 议程
// ---------------------------------------------------------------------------

export function actReveal(state, act, api = {}) {
  const code = codeOf(act)
  if (code === STRANGE_INFESTATION_CODE) {
    const seals = sealedLocationCount(state)
    const victory = enemyLocationsInVictory(state)
    if (victory > seals) {
      state.acts = [structuredClone(ACT_STAGES.againstTheHouse)]
      state.actIndex = 0
      setFlag(state, 'hemlockActPath', 'againstTheHouse')
      info(api, `幕 1 背面：胜利展示区的敌人-地点（${victory}）多于封印（${seals}）→ `
        + '进入幕 2a「对抗庄园」，把「庄园之心」移出游戏。')
      return true
    }
    placeCellar(state, api)
    state.acts = [structuredClone(ACT_STAGES.heartOfTheHouse)]
    state.actIndex = 0
    setFlag(state, 'hemlockActPath', 'heartOfTheHouse')
    info(api, `幕 1 背面：封印（${seals}）不少于胜利展示区的敌人-地点（${victory}）→ `
      + '失形地窖入场，进入幕 2a「庄园之心」，把「对抗庄园」移出游戏。')
    return true
  }
  if (code === AGAINST_THE_HOUSE_CODE) {
    info(api, '幕 2b「汉洛克家族的陨落」：→ 结局 1。')
    if (typeof api?.finish === 'function') api.finish('resolution1')
    else setFlag(state, 'hemlockResolve', 'resolution1')
    return true
  }
  if (code === HEART_OF_THE_HOUSE_CODE) {
    let flipped = 0
    for (const location of (state.locations || []).filter(isEnemyLocation)) {
      if (flipToLocationSide(state, location, api)) flipped += 1
    }
    let sealed = 0
    for (const location of unsealedDormantLocations(state)) {
      if (placeSeal(state, location.id, null, api)) sealed += 1
    }
    info(api, `幕 2b「安息」：${flipped} 个敌人-地点翻回地点面，${sealed} 处地点获得封印。`)
    if (typeof api?.finish === 'function') api.finish('resolution1')
    else setFlag(state, 'hemlockResolve', 'resolution1')
    return true
  }
  return false
}

/** 幕 1 背面自己换了幕牌库（acts 被替换），推进指针回到 0。 */
export function actIndexAfterAdvance(state, act) {
  void state
  return codeOf(act) === STRANGE_INFESTATION_CODE ? 0 : undefined
}

export function agendaReveal(state, agenda, api = {}) {
  const code = codeOf(agenda)
  const flags = flagsOfCode(code)
  let handled = false
  // 「along with the encounter discard pile」：议程 1b/2b 都把这些牌洗回遭遇牌库，只洗一次。
  if (flags.shuffleSetAsideTreacheriesOnBack === true || flags.flipNearestDormantOnBack === true) {
    rebuildEncounterDeck(state, api)
    handled = true
  }
  if (flags.shuffleSetAsideTreacheriesOnBack === true) {
    const returnCodes = [
      ...Array(Math.max(0, Number(ALL_CARDS[OUT_OF_THE_WALLS_CODE]?.quantity) || 4)).fill(OUT_OF_THE_WALLS_CODE),
      ...Array(Math.max(0, Number(ALL_CARDS[PULLED_IN_CODE]?.quantity) || 2)).fill(PULLED_IN_CODE),
    ]
    shuffleIntoEncounter(state, returnCodes, api)
    info(api, '议程 1b「活着的庄园」：放一边的 Out of the Walls / Pulled In 洗入遭遇牌库。')
  }
  if (flags.flipNearestDormantOnBack === true) {
    flipNearestDormantToMostInvestigators(state, api)
  }
  if (flags.attachFireOnHighestFloor === true) {
    const highest = highestFloorLocations(state)
    const target = highest[0] || null
    if (target && typeof api?.attachToLocation === 'function') {
      api.attachToLocation(target.id, { code: FIRE_CODE, originalCode: FIRE_CODE })
    } else if (target) {
      target.attachments ||= []
      target.attachments.push({ id: `attach:${FIRE_CODE}:${target.attachments.length}`,
        code: FIRE_CODE, originalCode: FIRE_CODE })
    }
    const otherFires = Math.max(0, (Number(ALL_CARDS[FIRE_CODE]?.quantity) || 5) - 1)
    shuffleIntoEncounter(state, Array(otherFires).fill(FIRE_CODE), api)
    info(api, `议程 2b「风雨大作」：「Fire!」附属到最高层最左的地点（${target?.name || '无'}），`
      + `其余 ${otherFires} 张洗入遭遇牌库。`)
    handled = true
  }
  if (flags.resolvePredatoryHouseOnBack === true) {
    resolvePredatoryHouse(state, api)
    handled = true
  }
  if (flags.backDefeatsInvestigators === true) {
    let defeated = 0
    for (const inv of activeInvestigators(state)) {
      safeCall(api, 'addTrauma', inv.seat, 'mental', 1)
      if (typeof api?.defeat === 'function') api.defeat(inv)
      else { inv.defeated = true; inv.defeatCause = 'agenda' }
      defeated += 1
    }
    info(api, `议程 3b「墙壁合拢…」：${defeated} 名未撤退的调查员被击败，各承受 1 点精神创伤。`)
    handled = true
  }
  return handled
}

export function flipNearestDormantToMostInvestigators(state, api = {}) {
  const target = nearestToMostInvestigators(state, unsealedDormantLocations(state))
  if (!target) {
    info(api, '没有可翻面的未封印 [[Dormant]] 地点。')
    return null
  }
  const enemy = flipToEnemySide(state, target, api)
  if (enemy) info(api, `「${target.name}」翻到敌人-地点面。`)
  return enemy
}

export function highestFloorLocations(state) {
  const entries = (state.locations || []).map(location => ({ location, cell: cellOf(state, location.id) }))
    .filter(entry => entry.cell)
  if (!entries.length) return []
  const highest = entries.reduce((best, entry) => Math.max(best, entry.cell.y), -Infinity)
  return entries.filter(entry => entry.cell.y === highest)
    .sort((a, b) => a.cell.x - b.cell.x)
    .map(entry => entry.location)
}

function shuffleIntoEncounter(state, codes, api = {}) {
  const list = codes.filter(Boolean)
  if (!list.length) return 0
  if (typeof api?.shuffleIntoEncounterDeck === 'function') api.shuffleIntoEncounterDeck(list)
  else {
    state.encounterDeck ||= []
    state.encounterDeck.push(...list)
  }
  return list.length
}
function rebuildEncounterDeck(state, api = {}) {
  if (typeof api?.rebuildEncounterDeckFromDiscard === 'function') return api.rebuildEncounterDeckFromDiscard()
  const discard = [...(state.encounterDiscard || [])]
  if (!discard.length) return 0
  state.encounterDeck = [...(state.encounterDeck || []), ...discard]
  state.encounterDiscard = []
  return discard.length
}

// ---------------------------------------------------------------------------
// 目标检查（幕 2 两条路线）
// ---------------------------------------------------------------------------

export function checkObjectives(state, api = {}) {
  flushElderThingTransfers(state, api)
  checkCellarVictory(state, api)
  const code = currentActCode(state)
  if (code === HEART_OF_THE_HOUSE_CODE) {
    if (cellarInVictory(state) && !flagsFor(state).hemlockAct2Advancing) {
      setFlag(state, 'hemlockAct2Advancing', true)
      info(api, '失形地窖已进入胜利展示区：推进幕 2「庄园之心」。')
      if (typeof api?.advanceAct === 'function') api.advanceAct()
      return true
    }
    return false
  }
  if (code === AGAINST_THE_HOUSE_CODE) {
    if ((state.locations || []).length === 0 && !flagsFor(state).hemlockAct2Advancing) {
      setFlag(state, 'hemlockAct2Advancing', true)
      info(api, '场上已无地点：推进幕 2「对抗庄园」。')
      if (typeof api?.advanceAct === 'function') api.advanceAct()
      return true
    }
    return false
  }
  return false
}

// ---------------------------------------------------------------------------
// 混乱标记
// ---------------------------------------------------------------------------

export function resolveChaosToken(state, inv, token) {
  return hemlockHouseChaosToken(state, inv, token)
}
export function chaosTokenValue(state, tokenFace, inv) {
  return hemlockHouseChaosTokenValue(state, tokenFace, inv)
}

/** [elder_thing] 未结算的「移入掠食袋」次数（引擎在检定结束时才把标记放回混乱袋）。 */
export function flushElderThingTransfers(state, api = {}) {
  const pending = Number(flagsFor(state).hemlockElderThingTransfers) || 0
  if (pending <= 0) return 0
  let removed = 0
  for (let index = 0; index < pending; index += 1) {
    const bag = state.chaosBag
    const at = Array.isArray(bag) ? bag.indexOf('elderthing') : -1
    if (at < 0) break
    bag.splice(at, 1)
    addPredationToken(state, 'elderthing', api)
    removed += 1
  }
  clearFlag(state, 'hemlockElderThingTransfers')
  if (removed) info(api, `${removed} 枚 [elder_thing] 从混乱袋移入掠食袋。`)
  return removed
}

function exhaustEnemyLocationAt(state, inv, api = {}) {
  const location = locationOf(state, inv.location)
  const enemy = (state.enemies || []).find(item => item.enemyLocation && item.location === inv.location)
  if (!enemy) {
    info(api, `[cultist]：${inv.name} 所在地点不是敌人。`)
    return false
  }
  enemy.exhausted = true
  safeCall(api, 'exhaustEnemy', enemy)
  info(api, `[cultist]：「${location?.name || enemy.name}」被横置。`)
  return true
}

function healNearestEnemyLocation(state, inv, api = {}) {
  const target = nearestEnemyLocationTo(state, inv)
  if (!target) {
    info(api, '[tablet]：场上没有敌人-地点。')
    return false
  }
  const enemy = (state.enemies || []).find(item => item.enemyLocation && item.id === target.id)
  if (!enemy) return false
  const amount = tabletHealAmount(state)
  if (typeof api?.healEnemy === 'function') api.healEnemy(enemy, amount)
  else enemy.damageTaken = Math.max(0, (Number(enemy.damageTaken) || 0) - amount)
  info(api, `[tablet]：治愈最近的敌人-地点「${target.name}」${amount} 点伤害。`)
  return true
}

function moveElderThingToPredationBag(state, api = {}) {
  if (!isPredationAgendaStep(state)) {
    info(api, '[elder_thing]：当前不是议程 2a/3a，不转移标记。')
    return false
  }
  setFlag(state, 'hemlockElderThingTransfers', (Number(flagsFor(state).hemlockElderThingTransfers) || 0) + 1)
  info(api, '[elder_thing]：本次检定结算后把该标记移出混乱袋并放入掠食袋。')
  return true
}

export function applyTokenEffect(state, inv, effect, api = {}) {
  if (!inv || inv.defeated || inv.resigned || !effect) return false
  if (effect.token === 'cultist') {
    const failedBy = Number(effect.test?.failedBy)
    const succeeded = effect.test == null || !Number.isFinite(failedBy) || failedBy === 0
    if (effect.mode === 'success' && !succeeded) {
      info(api, '[cultist]：检定失败，不横置地点。')
      return false
    }
    return exhaustEnemyLocationAt(state, inv, api)
  }
  if (effect.token === 'tablet') return healNearestEnemyLocation(state, inv, api)
  if (effect.token === 'elderthing') return moveElderThingToPredationBag(state, api)
  return false
}

// ---------------------------------------------------------------------------
// 法典（居民规则：只在 behavior 暴露结算，接线由战役层事务完成）
// ---------------------------------------------------------------------------

const residentAtSameLocation = state => {
  const william = (state.storyAssets || []).find(item => codeOf(item) === RESIDENT_SETUP.william.code)
  const judith = (state.storyAssets || []).find(item => codeOf(item) === RESIDENT_SETUP.judith.code)
  return Boolean(william && judith && william.location && william.location === judith.location)
}

export function codexAvailable(state, entryId) {
  return CODEX_ENTRY_IDS.includes(entryId) && codexBranchFor(state, entryId) != null
}

/** 法典条目在当前日/时段/记录下走哪一段（引擎 codex 分支读不到日/时段，这里补足）。 */
export function codexBranchFor(state, entryId) {
  const day = dayOf(state)
  const remembered = rememberedFor(state)
  if (entryId === 'william') {
    if (day === 1) return remembered.foundLittleSylvie ? 'day1FoundSylvie' : 'day1Otherwise'
    if (day === 2) return residentAtSameLocation(state) ? 'day2Argument' : 'day2Otherwise'
    return null
  }
  if (entryId === 'gideon') return remembered.youAreHelpingGideon ? 'helping' : 'otherwise'
  if (entryId === 'judith') {
    if (day === 2) return residentAtSameLocation(state) ? 'day2Argument' : 'day2Otherwise'
    if (day === 3) return 'day3'
    return null
  }
  if (entryId === 'theo') return day === 3 ? 'theo' : null
  if (entryId === 'marquez') return 'marquez'
  if (entryId === 'argument') return 'argument1'
  return null
}

/**
 * 结算一条法典（内容层效果）。返回 `{ entry, branch, ... }`；无法结算返回 false。
 * 近似：引擎没有「取得居民控制」的通用原语，这里把居民卡上的 `controllerSeat` 写为席位
 * （引擎读受控支援时读 `controllerSeat`）；经验走 api.interludeXpAll，抽牌走 api.drawCards。
 */
export function resolveCodexEntry(state, entryId, seat, api = {}) {
  if (!CODEX_ENTRY_IDS.includes(entryId)) return false
  const branch = codexBranchFor(state, entryId)
  if (!branch) return false
  const takeControl = code => {
    const asset = (state.storyAssets || []).find(item => codeOf(item) === code)
    if (!asset) return false
    asset.controllerSeat = seat
    return true
  }
  const bonusXp = amount => safeCall(api, 'interludeXpAll', amount)
  if (entryId === 'william' && branch === 'day1FoundSylvie') {
    takeControl(RESIDENT_SETUP.william.code)
    remember(state, 'foundLittleSylvie', api)
    addResidentRelationship(state, 'william', 1, api)
    bonusXp(1)
    return { entry: entryId, branch, controlled: RESIDENT_SETUP.william.code }
  }
  if (entryId === 'william' && branch === 'day1Otherwise') {
    for (const inv of activeInvestigators(state)) safeCall(api, 'gainClues', inv.seat, 1)
    return { entry: entryId, branch, clues: 1 }
  }
  if (entryId === 'william' && branch === 'day2Otherwise') {
    takeControl(RESIDENT_SETUP.william.code)
    return { entry: entryId, branch, controlled: RESIDENT_SETUP.william.code }
  }
  if (entryId === 'gideon' && branch === 'helping') {
    addResidentRelationship(state, 'gideon', 1, api)
    bonusXp(1)
    return { entry: entryId, branch }
  }
  if (entryId === 'gideon' && branch === 'otherwise') {
    remember(state, 'youAreHelpingGideon', api)
    cancelNextPredation(state, api)
    return { entry: entryId, branch, cancelPredation: true }
  }
  if (entryId === 'judith' && branch === 'day2Otherwise') {
    takeControl(RESIDENT_SETUP.judith.code)
    return { entry: entryId, branch, controlled: RESIDENT_SETUP.judith.code }
  }
  if (entryId === 'judith' && branch === 'day3') {
    takeControl(RESIDENT_SETUP.judith.code)
    remember(state, 'judithIsRemodeling', api)
    return { entry: entryId, branch, controlled: RESIDENT_SETUP.judith.code }
  }
  if (entryId === 'theo' && branch === 'theo') {
    takeControl(RESIDENT_SETUP.theo.code)
    return { entry: entryId, branch, controlled: RESIDENT_SETUP.theo.code }
  }
  if (entryId === 'marquez' && branch === 'marquez') {
    safeCall(api, 'drawCards', seat, 3)
    const enemyLocation = (state.locations || []).find(isEnemyLocation) || null
    if (enemyLocation) {
      const enemy = (state.enemies || []).find(item => item.enemyLocation && item.id === enemyLocation.id)
      if (enemy) dealEnemyDamage(state, enemy, 1, api)
    }
    return { entry: entryId, branch, damaged: enemyLocation?.id || null }
  }
  if ((entryId === 'william' || entryId === 'judith') && branch === 'day2Argument') {
    return { entry: entryId, branch: 'argument1' }
  }
  if (entryId === 'argument' && branch === 'argument1') {
    const choice = typeof api?.choose === 'function'
      ? api.choose({
        kind: 'story', source: 'hemlockHouseCodex', seat,
        prompt: '法典 Σ：争论——站朱迪斯那边，还是站威廉那边？',
        options: [
          { id: 'judithRight', label: SCENARIO_TEXT.codex.labels.judithRight || 'Judith is right.' },
          { id: 'williamRight', label: SCENARIO_TEXT.codex.labels.williamRight || "It is William's home." },
        ],
      })
      : 'williamRight'
    if (choice === 'judithRight') {
      removeResident(state, RESIDENT_SETUP.william.code, api)
      for (const inv of activeInvestigators(state)) safeCall(api, 'drawCards', inv.seat, 1)
      addResidentRelationship(state, 'judith', 1, api)
      bonusXp(1)
      return { entry: entryId, branch: 'argument2', removed: RESIDENT_SETUP.william.code }
    }
    removeResident(state, RESIDENT_SETUP.judith.code, api)
    for (const inv of activeInvestigators(state)) safeCall(api, 'drawCards', inv.seat, 1)
    addResidentRelationship(state, 'william', 1, api)
    bonusXp(1)
    return { entry: entryId, branch: 'argument3', removed: RESIDENT_SETUP.judith.code }
  }
  return false
}

function removeResident(state, code, api = {}) {
  state.storyAssets ||= []
  const index = state.storyAssets.findIndex(item => codeOf(item) === code)
  if (index < 0) return false
  const [asset] = state.storyAssets.splice(index, 1)
  state.scenarioZones ||= {}
  state.scenarioZones.removedFromGame = [...new Set([...(state.scenarioZones.removedFromGame || []), asset.code])]
  info(api, `把居民「${asset.name || code}」移出游戏。`)
  return true
}

// ---------------------------------------------------------------------------
// 掠食袋清理与结局
// ---------------------------------------------------------------------------

const predationBagList = state => state.tokenBags?.[PREDATION_BAG_ID] || null

/** Resolution 2：移出 1 枚 [elder_thing]，其余掠食袋里的 [elder_thing] 放回混乱袋。 */
export function predationCleanup(state, api = {}) {
  const bag = predationBagList(state)
  if (!bag) return { removed: 0, returned: 0 }
  const present = []
  for (const zone of ['revealed', 'tokens']) {
    if (!Array.isArray(bag[zone])) continue
    for (const token of bag[zone]) if (token === 'elderthing') present.push(zone)
  }
  if (!present.length) return { removed: 0, returned: 0 }
  let removed = 0
  let returned = 0
  present.forEach((zone, index) => {
    const list = bag[zone]
    const at = list.indexOf('elderthing')
    if (at < 0) return
    list.splice(at, 1)
    if (index === 0) { removed += 1; return }
    state.chaosBag ||= []
    state.chaosBag.push('elderthing')
    returned += 1
  })
  info(api, `掠食袋清理：移除 ${removed} 枚 [elder_thing]，${returned} 枚放回混乱袋（战役余下时间）。`)
  return { removed, returned }
}

/** 结局奖励经验：封印 ≥8/≥10 各 +1；胜利区敌人-地点 ≥8/≥10 各 +1。 */
export function bonusExperience(state) {
  const seals = sealedLocationCount(state)
  const enemyLocations = enemyLocationsInVictory(state)
  let bonus = 0
  if (seals >= 8) bonus += 1
  if (seals >= 10) bonus += 1
  if (enemyLocations >= 8) bonus += 1
  if (enemyLocations >= 10) bonus += 1
  return { bonus, seals, enemyLocations }
}

function judithRemodelReward(state, api = {}) {
  if (enemyLocationsInVictory(state) < 8) return 0
  const judith = (state.storyAssets || []).find(item => codeOf(item) === RESIDENT_SETUP.judith.code)
  if (!judith || judith.controllerSeat == null) return 0
  if (!isRemembered(state, 'judithIsRemodeling')) return 0
  addResidentRelationship(state, 'judith', 1, api)
  info(api, '朱迪斯参与了庄园改造：关系等级 +1，额外 1 点奖励经验。')
  return 1
}

export function resolution(state, key, events = [], api = {}) {
  void events
  const requested = RESOLUTION_KEYS.includes(String(key)) ? String(key) : 'noResolution'
  const finalKey = RESOLUTION_RECORD[requested] || 'resolution2'
  const records = recordsFor(state)
  flushElderThingTransfers(state, api)

  records[RECORD_KEYS.resolution] = finalKey
  records.hemlockHouseResolutionEntry = requested
  records[RECORD_KEYS.seals] = sealedLocationCount(state)
  records[RECORD_KEYS.enemyLocations] = enemyLocationsInVictory(state)
  records[RECORD_KEYS.foundLittleSylvie] = isRemembered(state, 'foundLittleSylvie')
  records.hemlockHouseBonusXp = 0

  let bonus = 0
  if (finalKey === 'resolution2') {
    const cleanup = predationCleanup(state, api)
    records[RECORD_KEYS.predationTokens] = cleanup.returned
    if (isRemembered(state, 'foundLittleSylvie')) {
      records.hemlockHouseLittleSylvie = true
      if (typeof api?.campaignCard === 'function') api.campaignCard(LITTLE_SYLVIE_CODE, 0, '小西尔维')
    }
    const xp = bonusExperience(state)
    bonus = xp.bonus + judithRemodelReward(state, api)
    records.hemlockHouseBonusXp = bonus
    records.areasSurveyed ||= {}
    records.areasSurveyed[AREAS_SURVEYED_HEMLOCK_HARBOR] = true
    records.hemlockHarborSurveyed = true
    info(api, `汉洛克庄园结算（${requested} → ${finalKey}）：`
      + `封印 ${xp.seals}、胜利区敌人-地点 ${xp.enemyLocations}，奖励经验 ${bonus}；`
      + '战役日志「Areas Surveyed」勾选 Hemlock Harbor。')
  } else {
    info(api, `汉洛克庄园结算：${requested}。`)
  }
  flagsFor(state).hemlockResolved = finalKey
  return { award: true, bonus }
}

export function scenarioResolution(state, resolutionKey = 'resolution2', api = {}) {
  resolution(state, resolutionKey, [], api)
  const records = recordsFor(state)
  return {
    resolution: records[RECORD_KEYS.resolution],
    entry: records.hemlockHouseResolutionEntry,
    seals: records[RECORD_KEYS.seals] ?? 0,
    enemyLocations: records[RECORD_KEYS.enemyLocations] ?? 0,
    bonus: records.hemlockHouseBonusXp ?? 0,
    areasSurveyed: records.areasSurveyed || {},
  }
}

// ---------------------------------------------------------------------------
// 诡计事件（条目 encounterResolve → api.resolveScenarioEvent）
// ---------------------------------------------------------------------------

/** 10545 墙外奇物：失败分支（敌人→1 伤害 1 恐惧 / 未封印 [[Dormant]]→翻面 / 封印→随机弃牌）。 */
export function outOfTheWallsFailure(state, payload = {}, api = {}) {
  const inv = state.investigators?.[payload.seat]
  if (!inv) return false
  const location = locationOf(state, inv.location)
  if (!location) return false
  if (isEnemyLocation(location)) {
    safeCall(api, 'harm', inv.seat, { damage: 1, horror: 1 })
    info(api, '墙外奇物：你所在地点是敌人——承受 1 点伤害与 1 点恐惧。')
    return true
  }
  if (sealCount(location) > 0) {
    safeCall(api, 'discardRandom', inv.seat, 1)
    info(api, '墙外奇物：你所在地点已被封印——随机弃 1 张手牌。')
    return true
  }
  if (isDormant(location)) {
    flipToEnemySide(state, location, api)
    info(api, `墙外奇物：「${location.name}」翻到敌人-地点面。`)
    return true
  }
  return false
}

/** 10546 拖离正道：失败后选择最近的敌人-地点并移动；失败 4+ 时它攻击你。 */
export function pulledInFailure(state, payload = {}, api = {}) {
  const inv = state.investigators?.[payload.seat]
  if (!inv) return false
  const target = nearestEnemyLocationTo(state, inv)
  if (!target) return false
  if (typeof api?.moveInvestigator === 'function') api.moveInvestigator(inv.seat, target.id)
  else inv.location = target.id
  info(api, `拖离正道：${inv.name} 被拖到「${target.name}」。`)
  if ((Number(payload.failedBy) || 0) >= 4) {
    attackEnemyLocation(state, target, inv, api)
    info(api, '拖离正道：失败 4 点以上，该敌人-地点攻击你。')
  }
  return true
}

export const events = Object.freeze({
  hemlockOutOfTheWalls: outOfTheWallsFailure,
  hemlockPulledIn: pulledInFailure,
  hemlockPredationTest: (state, payload = {}, api = {}) => makePredationTest(state, api, {
    seat: payload.seat, reason: payload.reason || null,
  }),
})

// ---------------------------------------------------------------------------
// 装配
// ---------------------------------------------------------------------------

/** 开场分支：夜晚 → intro4；否则按天数 intro1/2/3。 */
export function introBranchFor(state) {
  if (isNight(state)) return 'intro4'
  const day = dayOf(state)
  return day === 2 ? 'intro2' : day === 3 ? 'intro3' : 'intro1'
}

export function preScenarioSetup(state, events = [], api = {}) {
  void events
  void api
  // 日期先落到 scenarioFlags（intro/布置都读同一处），intro 分支由 definition 的正文键给出。
  const date = dateOf(state)
  setFlag(state, 'hemlockHouseDay', date.day)
  setFlag(state, 'hemlockHouseNight', date.period === 'night')
  setFlag(state, 'hemlockIntroBranch', introBranchFor(state))
  return false
}

export const implementedEncounterCodes = Object.freeze([
  '10524', '10524b', '10525', '10526', '10527', '10528', '10529', '10530', '10531',
  ...ROOM_IDS.map(id => LOCATION_CODE_BY_ID[id]),
  ...Object.values(ENEMY_LOCATION_CODE_BY_LOCATION),
  GRAPPLING_SPAWN_CODE, OUT_OF_THE_WALLS_CODE, PULLED_IN_CODE, SHAPELESS_CELLAR_CODE, LITTLE_SYLVIE_CODE,
])

export const behavior = {
  id: CHAPTER_ID,
  locationsStartRevealed: true,
  roundEndActIndex: 0,
  startLocation,
  preScenarioSetup,
  prepareScenario,
  setupScenario,
  setupLocations,
  afterDeckSetup,
  locationPlaced,
  actions,
  performAction,
  canDiscoverClues,
  encounterGainsSurge,
  mythosEnded,
  roundEnded,
  afterInvestigate,
  enemySpawned,
  enemyStatModifier,
  enemyAttackResolved,
  actReveal,
  actIndexAfterAdvance,
  agendaReveal,
  checkObjectives,
  resolveChaosToken,
  chaosTokenValue,
  applyTokenEffect,
  resolution,
  scenarioResolution,
  events,
  // 读点/工具（测试与战役层共用）
  dayOf,
  isNight,
  dateOf,
  introBranchFor,
  isRemembered,
  remember,
  sealsInPlay,
  sealedLocationCount,
  enemyLocationsInVictory,
  sealableLocations,
  unsealedDormantLocations,
  isEnemyLocation,
  isSealed,
  isDormant,
  sealCount,
  isPredationAgendaStep,
  agendaStageNumber,
  currentActCode,
  currentAgendaCode,
  hasLocationRule,
  floorOf,
  cellOf,
  locationBelow,
  syncConnections,
  distanceBetween,
  nearestEnemyLocationTo,
  nearestToMostInvestigators,
  flipToEnemySide,
  flipToLocationSide,
  flipLocationOver,
  placeCellar,
  cellarInPlay,
  cellarInVictory,
  ensurePredationBag,
  predationBagInfo,
  predationTokens,
  makePredationTest,
  resolvePredationToken,
  returnSetAsidePredationTokens,
  cancelNextPredation,
  resolvePredatoryHouse,
  placeSeal,
  placeResidents,
  checkSealObjective,
  checkCellarVictory,
  bonusExperience,
  predationCleanup,
  flushElderThingTransfers,
  codexAvailable,
  codexBranchFor,
  resolveCodexEntry,
  residentLevel,
  addResidentRelationship,
  highestFloorLocations,
  flipNearestDormantToMostInvestigators,
  outOfTheWallsFailure,
  pulledInFailure,
  tokenMeanings: HEMLOCK_TOKEN_MEANINGS,
  scenarioText: SCENARIO_TEXT,
  gatherGroups: GATHER_GROUPS,
  dayEncounterGroups: DAY_ENCOUNTER_GROUPS,
  enemyLocations: ENEMY_LOCATION_FACES,
  declaredEncounterDeck: ENCOUNTER_DECK,
  setAsideCards: SET_ASIDE_CARDS,
  setAsideAct: SET_ASIDE_ACTS,
  hardSide: isHardSide,
}

export function implementedEntryFlags(code) {
  return entryOf(code)?.flags || {}
}

export {
  HEMLOCK_TOKEN_MEANINGS, investigatorCount, isHardSide, tabletHealAmount,
  STRANGE_INFESTATION_CODE, HEART_OF_THE_HOUSE_CODE, AGAINST_THE_HOUSE_CODE, CELLAR_ID,
}
