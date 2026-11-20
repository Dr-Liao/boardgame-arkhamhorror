// 古代议庭（courtOfTheAncients · 11612）· 引擎钩子（章节流程）。
//
// 权威来源：Scenario/Scenarios/TheDrownedCity/CourtOfTheAncients.hs + Helpers.hs +
//   Location|Enemy|Treachery/Cards/TheDrownedCity/CourtOfTheAncients/*.hs +
//   frontend/src/locales/en/theDrownedCity/courtOfTheAncients.json。
//
// 引擎读点（全部走既有钩子，不改引擎）：
//   preScenarioSetup → 路线分支（theExpeditionHeadedWest）、幕/议程牌库、开场分支
//   setupLocations / locationPlaced / afterDeckSetup → 固定地点、崩塌档案库洗牌（移出 1 张）、
//     大升降机初始层级、向东路线淹没布局、Star Spawn / The Inescapable / 放一边
//   actions / performAction → 大升降机滑动（前厅）/ 幕 1 弃遭遇牌找符文 / 古代祭坛破封 /
//     撤离行动 / 翻译附属的符文诡计
//   afterInvestigate / investigateResult → 大升降机最后一个线索后翻面（已激活）→ 立刻推进幕 1；
//     已激活面成功调查改为滑动升降机
//   locationRevealed → 高空栈道（梦之档案库）揭示时生成放在一边的星之眷族观察者
//   enemyDefeated → 击败议庭守护者时发现符文
//   enemyConnections → 不稳地基正面：敌军阶段上下相邻视为相连
//   checkObjectives / actReveal / agendaReveal → 路线化幕/议程背面
//   moveError → 古代祭坛进入限制（胜利区符文 ≥3）
//   resolveChaosToken / applyTokenEffect → 11612 四档混乱标记
//   resolution → 结局 1/2/无结局、R'lyeh 地图、Shard of Y'ch'lecht
//   events → 单卡条目经 api.resolveScenarioEvent 结算的复杂行为（符文诡计 / 宇宙预兆 / 破封）
//
// 近似（报告已登记）：
//   · 大升降机「已激活面被成功调查时改为滑动」通过 investigateResult 替换线索发现实现；
//     弃 1[per_investigator] 线索再滑一次的额外费用在群组线索足够时询问 api.choose。
//   · 符文诡计「从遭遇弃牌堆抽取时附属，否则弃掉并涌动」没有抽牌来源读点 → 抽到时一律附属
//     并把翻译检定做成地点行动（在报告登记为近似）。
//   · 古代祭坛的「进入前东侧前厅调查员共同花费 4[per_investigator] 线索」缺额外进入费用原语，
//     只实现「胜利区符文 <3 不能进入」的移动拦截（原语请求已登记）。
import { registeredEntry } from '../../../../../src/engine/ability.js'
import { mechanicState } from '../../../../../src/engine/mechanic-state.js'
import { connectGrid, gridPosition, relocateGridCells } from '../../../../../src/engine/grid-map.js'
import { changeFloodLevel, floodLevel } from '../../../../../src/engine/flood.js'
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import {
  courtChaosToken, glyphCardsInVictory, glyphCount, translatedGlyphCount, skullValue, cultistValue,
  stowawayAtLocation, locationFlooded, floodLevelOf, isHardSide, COURT_TOKEN_MEANINGS,
  GLYPH_TRAIT, LIFT_TRAIT,
} from './chaos.js'
import {
  ACT_CODE_BY_ROUTE, ACT_STAGES, ACTS_BY_ROUTE, AGENDA_STAGES, AGENDAS_BY_ROUTE,
  ALTAR_CLUE_COST_PER_INVESTIGATOR, ANCIENT_ALTAR_ID, ARCHIVE_CODES, ARCHIVE_IDS, ARCHIVE_SLOT_CELLS,
  CHAPTER_ID, COLOSSAL_TYRANT_CODE, COSMIC_OMEN_CODE, EAST_ANTECHAMBER_ID, ENCOUNTER_DECK,
  ESCAPE_V1_CODE, ESCAPE_V2_CODE, FIXED_LOCATION_IDS, GLYPH_RECORDS, GLYPH_TREACHERY_CODES, GLYPHS_FOR_ALTAR,
  GREAT_LIFT_ID, INESCAPABLE_ENEMY_CODE, INESCAPABLE_SET_CODES, KEEPER_DREAMS_CODE, KEEPER_SLEEP_CODE,
  LIFT_CELL_BY_LEVEL, LIFT_LEVELS, LIFT_LEVEL_BY_ROUTE, LOCATIONS, LOCATION_CELLS, RESOLUTION_BY_ROUTE,
  RESOLUTION_KEYS, ROUTE_GATHER_GROUPS, SCENARIO_TEXT, SET_ASIDE_ALIASES, SHARD_CODE, STAR_SPAWN_OBSERVER_CODE,
  START_LOCATION_BY_ROUTE, TRANSLATED_GLYPHS_FOR_ELITE, TREACHERY_CODES, TWISTING_CATWALKS_ID,
  UNSTABLE_FOUNDATIONS_CODE, WEST_ANTECHAMBER_ID, archivesDeck, encounterDefinitions, levelOfCell,
  routeGroupDeck, scenario, starSpawnRemainder,
} from './definition.js'

// ---------------------------------------------------------------------------
// 基础工具
// ---------------------------------------------------------------------------
const clone = value => (value == null ? value : structuredClone(value))
const codeOf = value => String(value?.originalCode || value?.code || '')
const info = (api, message) => api?.info?.(message)
const investigatorCount = state => Number(state?.numInvestigators) || (state?.investigators || []).length || 1
const activeInvestigators = state => (state?.investigators || []).filter(inv => inv && !inv.defeated && !inv.resigned)
const locationOf = (state, id) => (state?.locations || []).find(location => location.id === id) || null
const flagsFor = state => (state.scenarioFlags ||= {})
const setFlag = (state, key, value = true) => { flagsFor(state)[key] = value; return value }
const recordsFor = state => {
  state.campaign ||= {}
  state.campaign.records ||= {}
  return state.campaign.records
}
const hasTrait = (value, trait) => (value?.traits || [])
  .some(item => String(item).toLowerCase() === String(trait).toLowerCase())
const entryFlags = code => registeredEntry(String(code))?.flags || {}
const flagIs = (code, key) => entryFlags(code)[key] === true
const randomOf = api => (typeof api?.random === 'function' ? api.random : () => 0.5)
function localShuffle(list, random) {
  const result = [...list]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const pick = Math.floor(random() * (index + 1))
    ;[result[index], result[pick]] = [result[pick], result[index]]
  }
  return result
}
const shuffleWith = (api, list) => (typeof api?.shuffle === 'function' ? api.shuffle([...list]) : localShuffle(list, randomOf(api)))
const groupCluesAt = (state, locationId) => (state?.investigators || [])
  .filter(inv => inv.location === locationId && !inv.defeated && !inv.resigned)
  .reduce((sum, inv) => sum + (Number(inv.clues) || 0), 0)
function spendGroupClues(state, locationId, amount) {
  let remaining = amount
  for (const inv of state?.investigators || []) {
    if (remaining <= 0) break
    if (inv.location !== locationId || inv.defeated || inv.resigned) continue
    const pay = Math.min(Number(inv.clues) || 0, remaining)
    inv.clues = (Number(inv.clues) || 0) - pay
    remaining -= pay
  }
  return remaining === 0
}

function currentGrid(state) { return mechanicState(state)?.grid || {} }
function gridPos(state, id) {
  const cell = currentGrid(state)[id]
  return cell ? { x: cell.x, y: cell.y } : null
}
function locationIdAtCell(state, cell) {
  for (const [id, value] of Object.entries(currentGrid(state))) {
    if (value.x === cell.x && value.y === cell.y) return id
  }
  return null
}
function writeGridCell(state, locationId, cell) {
  const data = mechanicState(state, true)
  data.grid ||= {}
  data.grid[locationId] = {
    x: cell.x, y: cell.y, isolated: false,
    connections: [...(data.grid[locationId]?.connections || [])],
  }
  const loc = locationOf(state, locationId)
  if (loc) loc.grid = { x: cell.x, y: cell.y }
  return data.grid[locationId]
}
function syncConnections(state) {
  try { connectGrid(state) } catch { /* 无网格容器的纯数据测试忽略 */ }
}
function locationInstance(state, locationId, { revealed = false } = {}) {
  const base = state.scenario?.locations?.[locationId] || LOCATIONS[locationId]
  if (!base) return null
  const def = clone(base)
  const clues = def.cluesFixed ?? (def.cluesPerInvestigator != null
    ? def.cluesPerInvestigator * investigatorCount(state) : Number(def.clues) || 0)
  return {
    ...def, id: locationId, revealed,
    clues: revealed ? clues : 0, maxClues: clues,
    connections: [...(def.connections || [])], symbolLinks: [], attachments: [],
    damage: 0, horror: 0, resources: 0, doom: 0,
  }
}
export function placeLocationAt(state, locationId, cell, api = {}, { revealed = false } = {}) {
  writeGridCell(state, locationId, cell)
  let loc = locationOf(state, locationId)
  if (!loc) {
    const placed = typeof api?.mechanics?.map?.place === 'function'
      ? api.mechanics.map.place(locationId, cell.x, cell.y) : null
    if (!placed) {
      const instance = locationInstance(state, locationId, { revealed })
      if (!instance) return null
      state.locations ||= []
      state.locations.push(instance)
      loc = instance
    }
  }
  const current = locationOf(state, locationId)
  if (current) current.grid = { x: cell.x, y: cell.y }
  if (revealed && current && current.revealed !== true) revealLocal(state, current, api)
  syncConnections(state)
  return locationId
}
function revealLocal(state, loc, api = {}) {
  if (!loc || loc.revealed === true) return false
  loc.revealed = true
  loc.clues = Math.max(0, Number(loc.maxClues) || 0)
  delete loc.hiddenIdentity
  if (typeof api?.reveal === 'function') api.reveal(loc.id)
  info(api, `「${loc.name}」被揭示。`)
  return true
}

// ---------------------------------------------------------------------------
// 路线 / 布置
// ---------------------------------------------------------------------------
export function routeOf(state) {
  return state?.campaign?.records?.theExpeditionHeadedWest === true ? 'west' : 'east'
}
export function currentAgendaCode(state) {
  const agenda = (state.agendas || [])[state.agendaIndex ?? 0]
  return codeOf(agenda)
}
export function currentActCode(state) {
  const act = (state.acts || [])[state.actIndex ?? 0]
  return codeOf(act)
}
function agendaFrontCode(state) {
  const agenda = (state.agendas || [])[state.agendaIndex ?? 0]
  if (!agenda || agenda.face === 'back') return null
  const code = codeOf(agenda)
  return [AGENDA_STAGES[1].code, AGENDA_STAGES[1.5].code, AGENDA_STAGES[2].code].includes(code) ? code : null
}

export function prepareScenario(state, api = {}) {
  if (flagsFor(state).courtPrepared) return flagsFor(state).courtReport
  const route = routeOf(state)
  const stages = state.scenario?.stageCards || {}
  const actCodes = [ACT_STAGES[1].code, ACT_CODE_BY_ROUTE[route]]
  state.acts = actCodes.map(code => clone(stages[code] || ACTS_BY_ROUTE[route].find(act => act.code === code)))
  state.agendas = AGENDAS_BY_ROUTE[route].map(agenda => clone(stages[agenda.code] || agenda))
  state.actIndex = Number.isInteger(state.actIndex) ? state.actIndex : 0
  state.agendaIndex = Number.isInteger(state.agendaIndex) ? state.agendaIndex : 0
  const report = {
    chapterId: CHAPTER_ID, route, routeGroup: ROUTE_GATHER_GROUPS[route],
    startLocation: START_LOCATION_BY_ROUTE[route],
    liftLevel: LIFT_LEVEL_BY_ROUTE[route],
    actCodes: state.acts.map(act => codeOf(act)),
    agendaCodes: state.agendas.map(agenda => codeOf(agenda)),
    resolutionKey: RESOLUTION_BY_ROUTE[route],
    introBranch: route === 'west' ? 'courtOfTheAncients1' : 'courtOfTheAncients2',
  }
  setFlag(state, 'courtReport', report)
  setFlag(state, 'courtPrepared', true)
  info(api, `古代议庭：远征队${route === 'west' ? '向西' : '向东'}；大升降机初始在第 ${report.liftLevel} 层；`
    + `幕 2 = ${route === 'west' ? '逃离高塔 v.I' : '逃离高塔 v.II'}。`)
  return report
}

export function preScenarioSetup(state, events, api = {}) {
  void events
  return prepareScenario(state, api)
}

export function introduction(sc, records = {}, context = null) {
  const state = context?.campaign ? context : { campaign: { records }, scenarioFlags: context?.scenarioFlags || {} }
  const { route } = { ...prepareScenario(state, {}) }
  const paragraphs = [SCENARIO_TEXT.intro, SCENARIO_TEXT.introBranches[route === 'west' ? 'courtOfTheAncients1' : 'courtOfTheAncients2']]
    .filter(Boolean).flatMap(value => String(value).split(/\n{2,}/)).filter(Boolean)
  return { version: 3, title: sc?.name || scenario.name, sections: [{ title: SCENARIO_TEXT.heading, paragraphs }], paragraphs, code: ACT_STAGES[1].code }
}

export function setupLocations(state, events, helper = {}) {
  void events
  const api = helper?.api || {}
  const report = prepareScenario(state, api)
  const random = typeof helper?.randomValue === 'function' ? () => helper.randomValue(state) : randomOf(api)
  const archives = archivesDeck(random)
  setFlag(state, 'courtArchives', { removed: archives.removed, inPlay: [...archives.inPlay], slots: archives.slots })
  info(api, `崩塌档案库：随机移出「${LOCATIONS[archives.removed]?.nameZh || LOCATIONS[archives.removed]?.name || archives.removed}」，其余 5 张入场。`)
  return [...FIXED_LOCATION_IDS, ...archives.inPlay]
}

export function setupEnemies(state, events = null, helper = {}) {
  void state; void events; void helper
}

export function afterDeckSetup(state, events, helper = {}) {
  void events
  const api = helper?.api || {}
  const report = prepareScenario(state, api)
  const route = report.route
  const zones = state.scenarioZones ||= {}
  const random = typeof helper?.randomValue === 'function' ? () => helper.randomValue(state) : randomOf(api)
  const archives = flagsFor(state).courtArchives || { inPlay: [], slots: ARCHIVE_SLOT_CELLS }
  // 1) 网格：邻接策略 none（地点只经升降机/图标/卡牌效果相连）。
  mechanicState(state, true).gridAdjacency = 'none'
  for (const [id, cell] of Object.entries(LOCATION_CELLS)) {
    if (id === GREAT_LIFT_ID) continue
    if (!gridPos(state, id)) writeGridCell(state, id, cell)
    const loc = locationOf(state, id)
    if (loc) loc.revealed = true
  }
  // 2) 档案库按 Haskell 环位入场（未揭示，崩塌档案库面朝上）。
  for (const [index, id] of archives.inPlay.entries()) {
    const cell = archives.slots[index]
    if (!cell) continue
    writeGridCell(state, id, cell)
    const exists = locationOf(state, id)
    if (!exists && typeof api?.mechanics?.map?.place === 'function') api.mechanics.map.place(id, cell.x, cell.y)
    else if (!exists) placeLocationAt(state, id, cell, api, { revealed: false })
  }
  // 3) 大升降机按路线初始层级入场（未激活面朝上），并写入与左右地点的动态连接。
  const liftCell = LIFT_CELL_BY_LEVEL[report.liftLevel]
  writeGridCell(state, GREAT_LIFT_ID, liftCell)
  const lift = locationOf(state, GREAT_LIFT_ID)
  if (lift) {
    lift.revealed = true
    lift.code = '11622'
    lift.originalCode = '11622'
    lift.name = ALL_CARDS['11622']?.nameZh || '大升降机'
    lift.subname = ALL_CARDS['11622']?.subnameZh || ALL_CARDS['11622']?.subname || '未激活'
  }
  setFlag(state, 'courtLift', { level: report.liftLevel, active: false })
  setLiftConnections(state)
  // 4) 向东路线：第 1、2 层各提高一次淹没，再把第 1 层提高到完全淹没（Haskell）。
  if (route === 'east') {
    const levels = LIFT_LEVELS
    for (const level of levels) {
      if (level > 2) continue
      for (const loc of state.locations || []) {
        const atLevel = levelOfCell(gridPos(state, loc.id) || {})
        if (atLevel !== level) continue
        increaseFloodLevel(state, loc.id, api)
      }
    }
    for (const loc of state.locations || []) {
      const atLevel = levelOfCell(gridPos(state, loc.id) || {})
      if (atLevel !== 1) continue
      increaseFloodLevel(state, loc.id, api)
    }
  }
  // 5) Star Spawn：观察者放一边；其余向西随机移出 2 名、向东全部移出。
  const starSpawn = starSpawnRemainder(route, random)
  const removedStar = ['11725', '11726', '11727'].filter(code => !starSpawn.includes(code))
  zones.removed = [...removedStar]
  setFlag(state, 'courtStarSpawn', { removed: removedStar, inDeck: starSpawn })
  // 6) 放一边：Shard、Colossal Tyrant、Star Spawn Observer、The Inescapable 敌人（未被击败时）。
  const creatureDefeated = recordsFor(state).theCreatureWasDefeated === true
  const aside = ['11622b', SHARD_CODE, COLOSSAL_TYRANT_CODE, STAR_SPAWN_OBSERVER_CODE]
  if (!creatureDefeated) aside.push(INESCAPABLE_ENEMY_CODE)
  zones.setAside = aside
  zones.setAsideLocations = []
  // 7) 开场位置。
  state.investigators ||= []
  for (const inv of state.investigators) if (!inv.location) inv.location = report.startLocation
  info(api, `古代议庭布置：${(state.locations || []).length} 处地点入场；大升降机第 ${report.liftLevel} 层（未激活面）。`)
  return { route, startLocation: report.startLocation, starSpawn: { removed: removedStar, inDeck: starSpawn } }
}

export function setupScenario(state, api = {}) {
  state.locations = []
  state.scenarioFlags ||= {}
  delete state.scenarioFlags.courtPrepared
  delete state.scenarioFlags.courtReport
  state.scenario ||= scenario
  const helper = { api, randomValue: () => randomOf(api)() }
  const ids = setupLocations(state, null, helper)
  const start = START_LOCATION_BY_ROUTE[routeOf(state)]
  for (const id of ids) {
    const report = flagsFor(state).courtArchives
    let cell = LOCATION_CELLS[id]
    if (!cell) {
      const index = report?.inPlay?.indexOf(id) ?? -1
      cell = index >= 0 ? report.slots[index] : null
    }
    if (cell) placeLocationAt(state, id, cell, api, { revealed: id !== GREAT_LIFT_ID })
  }
  afterDeckSetup(state, null, helper)
  for (const inv of state.investigators || []) if (!inv.location) inv.location = start
  if (!state.encounterDeck?.length) {
    state.encounterDeck = [...(state.scenario?.encounterDeck || ENCOUNTER_DECK), ...routeGroupDeck(routeOf(state))]
  }
  return { ...flagsFor(state).courtReport, placedIds: ids }
}

export function locationPlaced(state, location, api = {}, seat = null) {
  void seat
  if (!location) return false
  const cell = LOCATION_CELLS[location.id]
  if (cell && location.id !== GREAT_LIFT_ID && !gridPos(state, location.id)) writeGridCell(state, location.id, cell)
  if (location.id !== GREAT_LIFT_ID && !location.archive && location.unrevealedName == null) {
    location.revealed = true
    location.clues = Math.max(0, Number(location.maxClues) || 0)
  }
  if (location.id === GREAT_LIFT_ID) setLiftConnections(state)
  syncConnections(state)
  return true
}

export function locationRevealed(state, location, api = {}, seat = null) {
  if (!location) return false
  // 11626 高空栈道（梦之档案库）：揭示时生成放在一边的星之眷族观察者。
  if (codeOf(location) === '11626' || flagIs(codeOf(location), 'spawnObserver')) {
    if (!flagsFor(state).courtObserverSpawned) {
      setFlag(state, 'courtObserverSpawned', true)
      spawnEnemy(state, STAR_SPAWN_OBSERVER_CODE, location.id, api, { engagedSeat: null })
      info(api, `「${location.name}」揭示：星之眷族观察者在本地点生成。`)
    }
  }
  return true
}

// ---------------------------------------------------------------------------
// 大升降机 / 层级
// ---------------------------------------------------------------------------
export function liftState(state) {
  const stored = flagsFor(state).courtLift || {}
  const pos = gridPos(state, GREAT_LIFT_ID)
  return { level: pos ? levelOfCell(pos) : (stored.level ?? 1), active: stored.active === true }
}

/** 把大升降机的左右相邻地点写进网格连接（移动后立即重算邻接与寻路）。 */
export function setLiftConnections(state) {
  const data = mechanicState(state, true)
  data.grid ||= {}
  for (const cell of Object.values(data.grid)) {
    if (!Array.isArray(cell.connections)) cell.connections = []
    cell.connections = cell.connections.filter(id => id !== GREAT_LIFT_ID)
  }
  const pos = data.grid[GREAT_LIFT_ID]
  if (!pos) return false
  const left = locationIdAtCell(state, { x: pos.x - 1, y: pos.y })
  const right = locationIdAtCell(state, { x: pos.x + 1, y: pos.y })
  const neighbors = [left, right].filter(Boolean)
  data.grid[GREAT_LIFT_ID].connections = neighbors
  for (const id of neighbors) {
    data.grid[id].connections = [...new Set([...(data.grid[id].connections || []), GREAT_LIFT_ID])]
  }
  syncConnections(state)
  return neighbors
}

export function liftNeighbors(state) {
  const pos = gridPos(state, GREAT_LIFT_ID)
  if (!pos) return []
  return [[-1, 0], [1, 0]]
    .map(([dx, dy]) => locationIdAtCell(state, { x: pos.x + dx, y: pos.y + dy }))
    .filter(Boolean)
}

/** 滑动大升降机：direction 'up' = 层数 +1（row +1），'down' = 层数 -1。 */
export function slideGreatLift(state, direction, api = {}) {
  const pos = gridPos(state, GREAT_LIFT_ID)
  if (!pos) return false
  const level = levelOfCell(pos)
  const nextLevel = direction === 'up' ? level + 1 : level - 1
  if (!LIFT_LEVELS.includes(nextLevel)) {
    info(api, `大升降机不能移动到第 ${nextLevel} 层（只能在 1–4 层之间）。`)
    return false
  }
  const target = LIFT_CELL_BY_LEVEL[nextLevel]
  const changes = [{ id: GREAT_LIFT_ID, x: target.x, y: target.y }]
  const moved = typeof api?.mechanics?.map?.relocate === 'function'
    ? api.mechanics.map.relocate(changes)
    : relocateGridCells(state, changes)
  if (!moved) return false
  if (locationOf(state, GREAT_LIFT_ID)) locationOf(state, GREAT_LIFT_ID).grid = { ...target }
  setFlag(state, 'courtLift', { ...(flagsFor(state).courtLift || {}), level: nextLevel })
  setLiftConnections(state)
  info(api, `大升降机滑到第 ${nextLevel} 层（地点上的卡片与标记随升降机保留）。`)
  afterLiftMoved(state, api)
  return true
}

/** 不稳地基正面强制：大升降机移动后，位于大升降机的每位调查员检定敏捷(2)，失败 1 伤害。 */
export function afterLiftMoved(state, api = {}) {
  const agenda = agendaFrontCode(state)
  if (agenda !== UNSTABLE_FOUNDATIONS_CODE) return false
  const spec = (state.scenario?.stageCards?.[agenda] || AGENDA_STAGES[2]).liftMovedAgilityTest || { difficulty: 2, damage: 1 }
  let tested = 0
  for (const inv of state.investigators || []) {
    if (inv.defeated || inv.resigned || inv.location !== GREAT_LIFT_ID) continue
    tested += 1
    if (typeof api.test === 'function') {
      api.test(inv.seat, 'agility', spec.difficulty, result => {
        if (result?.success) return
        if (typeof api.damage === 'function') api.damage(inv.seat, spec.damage)
        else inv.damage = (Number(inv.damage) || 0) + spec.damage
        info(api, `大升降机移动后：${inv.name} 敏捷检定失败，受到 ${spec.damage} 点伤害。`)
      })
    }
  }
  return tested > 0
}

/** 大升降机翻面（未激活 → 已激活）：保留所有标记与附属卡牌（同一地点实例只换印刷面）。 */
export function flipGreatLift(state, api = {}) {
  const lift = locationOf(state, GREAT_LIFT_ID)
  if (!lift) return false
  if (flagsFor(state).courtLift?.active) return false
  lift.code = '11622b'
  lift.originalCode = '11622b'
  lift.name = ALL_CARDS['11622b']?.nameZh || '大升降机'
  lift.subname = ALL_CARDS['11622b']?.subnameZh || ALL_CARDS['11622b']?.subname || '已激活'
  lift.clues = 0
  lift.maxClues = 0
  lift.victory = 0
  const zones = state.scenarioZones ||= {}
  if (Array.isArray(zones.setAside)) {
    const index = zones.setAside.indexOf('11622b')
    if (index >= 0) zones.setAside.splice(index, 1)
  }
  setFlag(state, 'courtLift', { ...(flagsFor(state).courtLift || {}), active: true })
  info(api, '大升降机翻至（已激活）面，保留所有标记与附属卡牌。')
  // 幕 1 目标：大升降机翻至已激活面后立刻推进。
  if (currentActCode(state) === ACT_STAGES[1].code) {
    info(api, '幕 1 目标达成：立刻推进幕 1。')
    advanceAct(state, api)
  }
  return true
}

function advanceAct(state, api = {}) {
  if (typeof api.advanceAct === 'function') { api.advanceAct(); return true }
  const act = (state.acts || [])[state.actIndex]
  if (act) actReveal(state, act, api)
  state.actIndex = Number(state.actIndex || 0) + 1
  return true
}

// ---------------------------------------------------------------------------
// 淹没
// ---------------------------------------------------------------------------
export function locationCannotFlood(state, locationId) {
  void state
  const loc = locationOf(state, locationId)
  const code = codeOf(loc) || codeOf({ code: LOCATIONS[locationId]?.code })
  return ['11593', '11594', '11595', '11604'].includes(code)
}
export function increaseFloodLevel(state, locationId, api = {}) {
  if (!locationId || locationCannotFlood(state, locationId)) return false
  if (floodLevel(state, locationId) >= 2) return false
  if (typeof api?.mechanics?.water?.change === 'function') {
    api.mechanics.water.change(locationId, 1)
  } else if (!floodChangeAllowed(state, locationId, 1)) return false
  else changeFloodLevel(state, locationId, 1)
  return true
}
export function decreaseFloodLevel(state, locationId, api = {}) {
  if (!locationId) return false
  if (typeof api?.mechanics?.water?.change === 'function') return api.mechanics.water.change(locationId, -1)
  if (!floodChangeAllowed(state, locationId, -1)) return false
  return changeFloodLevel(state, locationId, -1)
}
function floodChangeAllowed(state, locationId, delta) {
  const before = floodLevel(state, locationId)
  const after = Math.max(0, Math.min(2, before + delta))
  return after !== before
}

// ---------------------------------------------------------------------------
// 符文（Glyph）
// ---------------------------------------------------------------------------
export function translatedGlyphs(state) {
  return [...(recordsFor(state).discoveredGlyphs || [])]
}
export function isGlyphTranslated(state, rune) {
  return translatedGlyphs(state).includes(String(rune))
}
export function eliteKeeperKeywordsActive(state) {
  return translatedGlyphCount(state) >= TRANSLATED_GLYPHS_FOR_ELITE
}

/** 发现/翻译一个符文：写 discoveredGlyphs（string[]），翻译面加入胜利区。 */
export function translateGlyph(state, sourceCode, api = {}) {
  const record = GLYPH_RECORDS[String(sourceCode)]
  if (!record) return false
  const records = recordsFor(state)
  records.discoveredGlyphs ||= []
  if (records.discoveredGlyphs.includes(record.rune)) return false
  records.discoveredGlyphs.push(record.rune)
  setFlag(state, `courtGlyph:${record.rune}`, true)
  if (typeof api.addStoryToVictory === 'function') api.addStoryToVictory(String(sourceCode), { sourceId: `glyph:${record.rune}` })
  else {
    state.victoryDisplay ||= []
    if (!state.victoryDisplay.some(entry => codeOf(entry) === String(sourceCode))) {
      state.victoryDisplay.push({
        id: `glyph:${record.rune}`, code: String(sourceCode), originalCode: String(sourceCode),
        name: ALL_CARDS[String(sourceCode)]?.nameZh || String(sourceCode),
        victory: Number(ALL_CARDS[String(sourceCode)]?.victory) || 1,
      })
    }
  }
  info(api, `发现符文 ${record.rune}（${record.wordZh} / ${record.word}）：已翻译 ${translatedGlyphCount(state)} 个。`)
  return true
}

export function shardControlledBy(state) {
  return (state.investigators || []).find(inv => (inv.assets || []).some(asset => codeOf(asset) === SHARD_CODE)) || null
}
export function giveShard(state, seat, api = {}) {
  const inv = (state.investigators || [])[seat]
  if (!inv) return null
  const zones = state.scenarioZones ||= {}
  if (Array.isArray(zones.setAside)) {
    const index = zones.setAside.indexOf(SHARD_CODE)
    if (index >= 0) zones.setAside.splice(index, 1)
  }
  if (typeof api.giveAsset === 'function') {
    const asset = api.giveAsset(seat, SHARD_CODE)
    if (asset) return asset
  }
  const card = ALL_CARDS[SHARD_CODE] || {}
  const asset = {
    id: `court-shard-${seat}`, code: SHARD_CODE, originalCode: SHARD_CODE,
    name: card.nameZh || card.name || SHARD_CODE, controllerSeat: seat, ownerSeat: seat,
    exhausted: false, damage: 0, horror: 0, tokens: 0, attachments: [], assets: [],
  }
  inv.assets ||= []
  inv.assets.push(asset)
  info(api, `伊克雷希特碎片交给 ${inv.name}。`)
  return asset
}
export function altarSealDifficulty(state) {
  const reduced = Math.min(4, Math.floor(translatedGlyphCount(state) / 5))
  return 5 - reduced
}

// ---------------------------------------------------------------------------
// 行动
// ---------------------------------------------------------------------------
function attachedGlyphTreacheries(state, location) {
  return (location?.attachments || []).filter(attachment => GLYPH_TREACHERY_CODES.includes(String(attachment.originalCode || attachment.code)))
}

export function actions(state, inv) {
  if (!inv || inv.defeated || inv.resigned) return []
  const here = locationOf(state, inv.location)
  if (!here) return []
  const moves = []
  // 前厅 [fast]：共同花费线索（淹没时双倍）把大升降机向下滑一次。
  if (here.id === WEST_ANTECHAMBER_ID || here.id === EAST_ANTECHAMBER_ID) {
    const per = locationFlooded(state, inv) ? 2 : 1
    const required = per * investigatorCount(state)
    const available = groupCluesAt(state, here.id)
    moves.push({
      action: 'scenarioAction', rule: 'courtSlideLiftDown', locationId: here.id, actions: 0,
      label: `共同花费 ${required} 个线索：将大升降机向下滑动一次`,
      reason: available >= required ? null : `需要本地点共 ${required} 个线索（现有 ${available}）`,
    })
  }
  // 幕 1 正面 [action]：花费 1[per_investigator] 线索，从遭遇牌库顶弃 5 张（单人 8 张）。
  if (currentActCode(state) === ACT_STAGES[1].code) {
    const required = investigatorCount(state)
    const available = groupCluesAt(state, inv.location)
    moves.push({
      action: 'scenarioAction', rule: 'courtDiscardForGlyph', locationId: here.id, actions: 1,
      label: `共同花费 ${required} 个线索：从遭遇牌库顶弃 ${committeeDiscardCount(state)} 张，抽取其中 1 张[[符文]]卡并依次抽取[[预兆]]卡`,
      reason: available >= required ? null : `需要本地点共 ${required} 个线索（现有 ${available}）`,
    })
  }
  // 幕 2 撤离：v.I 在扭曲栈桥，v.II 在东侧前厅。
  const act2Code = currentActCode(state)
  if (act2Code === ESCAPE_V1_CODE && here.id === TWISTING_CATWALKS_ID) {
    moves.push({ action: 'scenarioAction', rule: 'courtResign', locationId: here.id, actions: 1, label: '撤离（扭曲栈桥）：你攀向天际。' })
  }
  if (act2Code !== ESCAPE_V1_CODE && currentActCode(state) !== ACT_STAGES[1].code && here.id === EAST_ANTECHAMBER_ID) {
    moves.push({ action: 'scenarioAction', rule: 'courtResign', locationId: here.id, actions: 1, label: '撤离（东侧前厅）：你爬向塔外。' })
  }
  // 古代祭坛破封 [action]。
  if (here.id === ANCIENT_ALTAR_ID && !shardControlledBy(state)) {
    moves.push({
      action: 'scenarioAction', rule: 'courtBreakSeal', locationId: here.id, actions: 1,
      label: `检定[意志]或[智识](${altarSealDifficulty(state)})破封；成功控制放在一边的伊克雷希特碎片`,
    })
  }
  // 附属到本地点的符文诡计：翻译行动。
  for (const attachment of attachedGlyphTreacheries(state, here)) {
    const code = String(attachment.originalCode || attachment.code)
    const record = GLYPH_RECORDS[code]
    if (!record || isGlyphTranslated(state, record.rune)) continue
    moves.push({
      action: 'scenarioAction', rule: 'courtTranslateGlyph', locationId: here.id, actions: 1,
      code, label: `检定[${record.test.skill}](${record.test.difficulty})：翻译符文 ${record.rune}（${record.wordZh}）`,
    })
  }
  return moves
}

function committeeDiscardCount(state) {
  const stage = state.scenario?.stageCards?.[currentActCode(state)]
  if (investigatorCount(state) === 1) return stage?.discardCountSolo ?? 8
  return stage?.discardCount ?? 5
}

export function performAction(state, inv, move, api = {}) {
  if (!move || !inv || inv.defeated || inv.resigned) return false
  if (move.rule === 'courtSlideLiftDown') return slideLiftDownAction(state, inv, api)
  if (move.rule === 'courtDiscardForGlyph') return discardForGlyphAction(state, inv, api)
  if (move.rule === 'courtResign') return resignAction(state, inv, api)
  if (move.rule === 'courtBreakSeal') return breakSealAction(state, inv, api)
  if (move.rule === 'courtTranslateGlyph') return translateOwnGlyphAction(state, inv, move, api)
  return false
}

function slideLiftDownAction(state, inv) {
  const here = locationOf(state, inv.location)
  if (!here) return false
  const per = locationFlooded(state, inv) ? 2 : 1
  const required = per * investigatorCount(state)
  if (groupCluesAt(state, here.id) < required) return false
  spendGroupClues(state, here.id, required)
  return slideGreatLift(state, 'down')
}

function resignAction(state, inv, api = {}) {
  if (typeof api.resign === 'function') api.resign(inv.seat)
  else inv.resigned = true
  info(api, `${inv.name} 撤离古代议庭。`)
  return true
}

function breakSealAction(state, inv, api = {}) {
  const difficulty = altarSealDifficulty(state)
  const skill = typeof api.choose === 'function'
    ? api.choose({
      kind: 'skill', source: '11623', seat: inv.seat, canSkip: false,
      prompt: '选择破封检定技能：意志或智识。',
      options: [{ id: 'willpower', label: '意志' }, { id: 'intellect', label: '智识' }],
    }) || 'willpower'
    : 'willpower'
  const result = typeof api.test === 'function' ? api.test(inv.seat, skill, difficulty, null) : { success: true }
  if (!result?.success) { info(api, '破除封印的检定失败。'); return true }
  giveShard(state, inv.seat, api)
  return true
}

function translateOwnGlyphAction(state, inv, move, api = {}) {
  const here = locationOf(state, inv.location)
  if (!here) return false
  const code = String(move.code || '')
  const record = GLYPH_RECORDS[code]
  if (!record || isGlyphTranslated(state, record.rune)) return false
  const result = typeof api.test === 'function' ? api.test(inv.seat, record.test.skill, record.test.difficulty, null) : { success: true }
  if (!result?.success) { info(api, `翻译符文 ${record.rune} 的检定失败。`); return true }
  const index = (here.attachments || []).findIndex(attachment => String(attachment.originalCode || attachment.code) === code)
  if (index >= 0) here.attachments.splice(index, 1)
  return translateGlyph(state, code, api)
}

/** 幕 1 行动：弃遭遇牌库顶 5/8 张；抽取其中 1 张[[符文]]卡，再依次抽取其中的[[预兆]]卡。 */
export function discardCountFor(state) {
  return currentActCode(state) === ACT_STAGES[1].code ? committeeDiscardCount(state) : 5
}
function discardForGlyphAction(state, inv, api = {}) {
  const required = investigatorCount(state)
  if (groupCluesAt(state, inv.location) < required) return false
  spendGroupClues(state, inv.location, required)
  const deck = state.encounterDeck || (state.encounterDeck = [])
  const count = Math.min(discardCountFor(state), deck.length)
  const discarded = deck.splice(Math.max(0, deck.length - count), count).reverse()
  state.encounterDiscard ||= []
  state.encounterDiscard.push(...discarded)
  info(api, `从遭遇牌库顶弃掉 ${discarded.length} 张。`)
  const glyphs = discarded.filter(code => hasTrait(ALL_CARDS[code] || {}, GLYPH_TRAIT))
  const omens = discarded.filter(code => hasTrait(ALL_CARDS[code] || {}, 'Omen'))
  if (glyphs.length) drawFromEncounterDiscard(state, inv, glyphs[glyphs.length - 1], api)
  for (const code of omens) drawFromEncounterDiscard(state, inv, code, api)
  // 地点反应（Archive of the Stars / Ancients / Lofty Walkway Archive of Conflict）：
  // 简化为对所在地点有对应条目时追加弃牌/移动（近似；见报告）。
  applyArchiveDiscardReactions(state, inv, discarded.length, api)
  return true
}
function drawFromEncounterDiscard(state, inv, code, api = {}) {
  const discard = state.encounterDiscard || (state.encounterDiscard = [])
  const index = discard.lastIndexOf(code)
  if (index >= 0) discard.splice(index, 1)
  state.encounterDeck ||= []
  state.encounterDeck.push(code)
  if (typeof api.drawEncounter === 'function') api.drawEncounter(inv.seat)
  else if (ALL_CARDS[code]?.type === 'treachery') discard.push(code)
}
function applyArchiveDiscardReactions(state, inv, discardedCount, api = {}) {
  if (!discardedCount) return
  const here = locationOf(state, inv.location)
  if (!here) return
  const code = codeOf(here)
  if (code === '11624' && (inv.hand || []).length) {
    // 群星档案库：可弃 1 张手牌，额外弃 2 张。
    const accept = typeof api.choose === 'function'
      ? api.choose({
        kind: 'effect', source: '11624', seat: inv.seat, canSkip: true,
        prompt: '群星档案库：弃 1 张手牌以额外弃 2 张遭遇牌？',
        options: [{ id: 'skip', label: '不触发' }, { id: 'trigger', label: '触发' }],
      }) === 'trigger'
      : false
    if (accept) {
      inv.discard ||= []
      inv.discard.push(inv.hand.pop())
      discardEncounterTop(state, 2, api)
    }
  } else if (code === '11625') {
    if (typeof api.horror === 'function') api.horror(inv.seat, 1)
    else inv.horror = (Number(inv.horror) || 0) + 1
    discardEncounterTop(state, 3, api)
  } else if (code === '11627') {
    const ready = (state.enemies || []).filter(enemy => !enemy.exhausted && !hasTrait(enemy, 'Elite') && enemy.engagedSeat == null)
    const nearest = ready[0]
    if (nearest) {
      nearest.location = here.id
      info(api, `冲突档案库：最近的未交战非[[精英]]敌人移动到本地点。`)
    }
  }
}
function discardEncounterTop(state, count, api = {}) {
  const deck = state.encounterDeck || (state.encounterDeck = [])
  const n = Math.min(count, deck.length)
  const cards = deck.splice(Math.max(0, deck.length - n), n).reverse()
  state.encounterDiscard ||= []
  state.encounterDiscard.push(...cards)
  info(api, `额外从遭遇牌库顶弃掉 ${cards.length} 张。`)
  return cards
}

// ---------------------------------------------------------------------------
// 调查 / 揭示
// ---------------------------------------------------------------------------
export function afterInvestigate(state, inv, location, result, api = {}) {
  if (!location || !result?.success) return false
  if ((Number(location.clues) || 0) > 0) return false
  if (location.id === GREAT_LIFT_ID && !liftState(state).active) return flipGreatLift(state, api)
  return false
}

/** 已激活大升降机：成功调查时改为不发现线索，滑动升降机一次（可花 1[per] 线索再滑一次）。 */
export function investigateResult(state, inv, location, result, api = {}) {
  if (!location || !result?.success) return undefined
  if (location.id !== GREAT_LIFT_ID || !liftState(state).active) return undefined
  const chooseDirection = () => (typeof api.choose === 'function'
    ? api.choose({
      kind: 'effect', source: '11622b', seat: inv.seat, canSkip: false,
      prompt: '大升降机：向上或向下滑动一次。',
      options: [{ id: 'up', label: '向上滑动' }, { id: 'down', label: '向下滑动' }],
    }) || 'up'
    : 'up')
  slideGreatLift(state, chooseDirection(), api)
  const required = investigatorCount(state)
  if (groupCluesAt(state, location.id) >= required && typeof api.choose === 'function') {
    const extra = api.choose({
      kind: 'effect', source: '11622b', seat: inv.seat, canSkip: true,
      prompt: `花费 ${required} 个线索再滑动一次大升降机？`,
      options: [{ id: 'skip', label: '不花费' }, { id: 'pay', label: '花费并再滑动一次' }],
    })
    if (extra === 'pay') {
      spendGroupClues(state, location.id, required)
      slideGreatLift(state, chooseDirection(), api)
    }
  }
  return false
}

/** 击败议庭守护者（11630/11631）：发现符文。 */
export function enemyDefeated(state, enemy, api = {}) {
  if (!enemy) return false
  const code = codeOf(enemy)
  if (code === KEEPER_DREAMS_CODE || code === KEEPER_SLEEP_CODE) return translateGlyph(state, code, api)
  return false
}

export function enemyDefeat(state, enemy, api = {}) {
  return enemyDefeated(state, enemy, api)
}

// ---------------------------------------------------------------------------
// 幕 / 议程
// ---------------------------------------------------------------------------
export function allUndefeatedResigned(state) {
  const alive = activeInvestigators(state)
  return alive.length === 0 && (state.investigators || []).some(inv => inv.resigned)
}

export function checkObjectives(state, api = {}) {
  if (state.status && state.status !== 'playing') return false
  const act2Code = currentActCode(state)
  if ((act2Code === ESCAPE_V1_CODE || act2Code === ESCAPE_V2_CODE) && allUndefeatedResigned(state)
    && !flagsFor(state).courtAct2Advancing) {
    setFlag(state, 'courtAct2Advancing', true)
    info(api, '所有未被击败的调查员都已撤离：推进幕 2。')
    advanceAct(state, api)
    return true
  }
  return false
}

export function allResigned(state, api = {}) {
  return checkObjectives(state, api)
}

export function actReveal(state, act, api = {}) {
  const code = codeOf(act)
  if (code === ACT_STAGES[1].code) return act1Back(state, api)
  if (code === ESCAPE_V1_CODE || code === ESCAPE_V2_CODE) return act2Back(state, code, api)
  return false
}

function act1Back(state, api = {}) {
  // Tyrant Unleashed：把放在一边的巨型暴君生成在大升降机；选一位在大升降机的调查员敏捷(3)，
  // 成功则横置暴君。
  const zones = state.scenarioZones ||= {}
  if (Array.isArray(zones.setAside) && zones.setAside.includes(COLOSSAL_TYRANT_CODE)) {
    zones.setAside.splice(zones.setAside.indexOf(COLOSSAL_TYRANT_CODE), 1)
    const tyrant = spawnEnemy(state, COLOSSAL_TYRANT_CODE, GREAT_LIFT_ID, api)
    const candidates = (state.investigators || []).filter(inv => !inv.defeated && !inv.resigned && inv.location === GREAT_LIFT_ID)
    const seat = candidates.length && typeof api.choose === 'function'
      ? Number(api.choose({
        kind: 'investigator', source: '11616', seat: candidates[0].seat,
        prompt: '选择大升降机的一位调查员检定敏捷(3)。',
        options: candidates.map(inv => ({ id: String(inv.seat), label: inv.name })),
      }))
      : candidates[0]?.seat
    if (tyrant && Number.isInteger(seat) && typeof api.test === 'function') {
      api.test(seat, 'agility', 3, result => {
        if (result?.success) {
          tyrant.exhausted = true
          info(api, '敏捷检定成功：巨型暴君被横置。')
        }
      })
    }
  }
  info(api, '幕 1 背面（暴君解放）：巨型暴君在大升降机生成。')
  return true
}

function act2Back(state, code, api = {}) {
  const key = code === ESCAPE_V1_CODE ? 'resolution1' : 'resolution2'
  info(api, `幕 2 背面：${code === ESCAPE_V1_CODE ? '飞向天空 → 结局 1' : '向下攀爬 → 结局 2'}。`)
  if (typeof api.finish === 'function') { api.finish(key); return true }
  state.resolution = key
  return true
}

export function agendaReveal(state, agenda, api = {}) {
  const code = codeOf(agenda)
  if (code === AGENDA_STAGES[1].code) return agenda1Back(state, false, api)
  if (code === AGENDA_STAGES[1.5].code) return agenda1Back(state, true, api)
  if (code === UNSTABLE_FOUNDATIONS_CODE) return agenda2Back(state, api)
  return false
}

function shuffleOmenGlyphFromDiscard(state, api = {}) {
  const discard = state.encounterDiscard || []
  const moved = discard.filter(code => {
    const card = ALL_CARDS[code] || {}
    return hasTrait(card, 'Omen') || hasTrait(card, GLYPH_TRAIT)
  })
  state.encounterDiscard = discard.filter(code => !moved.includes(code))
  state.encounterDeck = shuffleWith(api, [...(state.encounterDeck || []), ...moved])
  return moved.length
}

function agenda1Back(state, lowerFlood, api = {}) {
  if (lowerFlood) {
    let lowered = 0
    for (const loc of state.locations || []) if (decreaseFloodLevel(state, loc.id, api)) lowered += 1
    info(api, `淹没档案塔背面（拉莱耶升起）：${lowered} 处地点淹没等级降低。`)
  }
  const moved = shuffleOmenGlyphFromDiscard(state, api)
  info(api, `议程 1 背面：${moved} 张[[预兆]]/[[符文]]卡从遭遇弃牌堆洗回遭遇牌库。`)
  return true
}

function agenda2Back(state, api = {}) {
  let count = 0
  for (const inv of activeInvestigators(state)) {
    if (typeof api.addTrauma === 'function') api.addTrauma(inv.seat, 'mental', 1)
    else {
      state.campaign ||= {}
      state.campaign.trauma ||= {}
      state.campaign.trauma[inv.seat] ||= { physical: 0, mental: 0 }
      state.campaign.trauma[inv.seat].mental += 1
    }
    if (typeof api.defeat === 'function') api.defeat(inv, 'mental')
    else { inv.defeated = true; inv.defeatCause = 'mental' }
    count += 1
  }
  info(api, `不稳地基背面（不可言说的知识）：${count} 位调查员被击败并承受 1 点精神创伤（无结局）。`)
  return true
}

// ---------------------------------------------------------------------------
// 敌人 / 地点修正
// ---------------------------------------------------------------------------
export function enemyDefinitionFor(code) {
  return scenario.enemies?.[code] || encounterDefinitions([code]).enemies[code] || ALL_CARDS[code] || {}
}
export function spawnEnemy(state, code, locationId, api = {}, options = {}) {
  if (typeof api.spawn === 'function') return api.spawn(code, locationId, options)
  const def = enemyDefinitionFor(code)
  const enemy = {
    id: `${CHAPTER_ID}-${code}-${(state.enemies || []).length + 1}`, code, originalCode: code,
    name: def.nameZh || def.name || code, location: locationId,
    fight: def.fight ?? 0, evade: def.evade ?? 0, health: def.health ?? 1,
    damage: def.damage || 0, horror: def.horror || 0, traits: [...(def.traits || [])],
    exhausted: false, engagedSeat: options.engagedSeat ?? null, damageTaken: 0,
    doom: 0, clues: 0, attachments: [], victory: Number(def.victory) || 0,
  }
  state.enemies ||= []
  state.enemies.push(enemy)
  return enemy
}

export function enemyStatModifier(state, enemy, stat) {
  if (!enemy || stat !== 'health') return 0
  const code = codeOf(enemy)
  if (code === COLOSSAL_TYRANT_CODE) return 3 * investigatorCount(state)
  return 0
}

export function enemyConnections(state, enemy, location) {
  if (!enemy || !location) return []
  // 不稳地基正面：敌军阶段中每处地点视为与其上方和下方地点相连。
  if (agendaFrontCode(state) !== UNSTABLE_FOUNDATIONS_CODE) return []
  const pos = gridPos(state, location.id)
  if (!pos) return []
  return [pos.y - 1, pos.y + 1].map(y => locationIdAtCell(state, { x: pos.x, y })).filter(id => id && id !== location.id)
}

export function locationShroudModifier(state, location) {
  if (!location) return 0
  const code = codeOf(location)
  if (code === '11626') {
    const count = glyphCount(state)
    return count ? -count : 0
  }
  if (code === '11628') {
    const attachedGlyphs = (location.attachments || []).filter(attachment =>
      hasTrait(ALL_CARDS[attachment.originalCode || attachment.code] || {}, GLYPH_TRAIT)).length
    return attachedGlyphs
  }
  return 0
}

/** 古代祭坛进入限制：胜利区符文 <3 时不能进入（Haskell back_text）。 */
export function moveError(state, inv, target, neighborId) {
  void inv
  const destination = target?.id || neighborId
  if (destination !== ANCIENT_ALTAR_ID) return null
  if (glyphCount(state) >= GLYPHS_FOR_ALTAR) return null
  return '古代祭坛：除非胜利区有 3 张或更多[[符文]]卡牌，否则不能进入。'
}

// ---------------------------------------------------------------------------
// 混乱标记
// ---------------------------------------------------------------------------
export function resolveChaosToken(state, inv, token) {
  return courtChaosToken(state, inv, token)
}
export function chaosTokenValue(state, tokenFace, inv = null) {
  return courtChaosToken(state, inv, tokenFace)?.delta ?? null
}
export function applyTokenEffect(state, inv, effect, api = {}) {
  if (!inv || !effect) return false
  if (effect.mode !== 'elderThingCombat') return false
  const actionKind = effect.test?.actionKind
  if (actionKind !== 'fight' && actionKind !== 'evade') return false
  if (isHardSide(state)) {
    if (typeof api.damage === 'function') api.damage(inv.seat, 1)
    else inv.damage = (Number(inv.damage) || 0) + 1
    if (typeof api.horror === 'function') api.horror(inv.seat, 1)
    else inv.horror = (Number(inv.horror) || 0) + 1
    info(api, '[elder_thing]：攻击/躲避尝试中揭示，受到 1 点伤害和 1 点恐惧。')
    return true
  }
  const choice = typeof api.choose === 'function'
    ? api.choose({
      kind: 'token', source: '11612-token', seat: inv.seat, canSkip: false,
      prompt: '[elder_thing]：受到 1 点伤害或 1 点恐惧。',
      options: [{ id: 'damage', label: '受到 1 点伤害' }, { id: 'horror', label: '受到 1 点恐惧' }],
    })
    : 'damage'
  if (choice === 'horror') {
    if (typeof api.horror === 'function') api.horror(inv.seat, 1)
    else inv.horror = (Number(inv.horror) || 0) + 1
  } else if (typeof api.damage === 'function') api.damage(inv.seat, 1)
  else inv.damage = (Number(inv.damage) || 0) + 1
  info(api, '[elder_thing]：攻击/躲避尝试中揭示，受到 1 点伤害或恐惧。')
  return true
}

// ---------------------------------------------------------------------------
// 遭遇牌库（路线组 / Star Spawn 残余 / 击败穷途异魔后移出）
// ---------------------------------------------------------------------------
export function modifyDeck(state, deck, events = null, helper = {}) {
  void events
  const route = routeOf(state)
  const random = typeof helper?.randomValue === 'function' ? () => helper.randomValue(state) : randomOf({})
  const creatureDefeated = recordsFor(state).theCreatureWasDefeated === true
  const filtered = creatureDefeated ? deck.filter(code => !INESCAPABLE_SET_CODES.includes(String(code))) : deck
  return [...filtered, ...routeGroupDeck(route), ...starSpawnRemainder(route, random)]
}

// ---------------------------------------------------------------------------
// 结局
// ---------------------------------------------------------------------------
export function resolution(state, key, events, api = {}) {
  void events
  const records = recordsFor(state)
  records.rlyehMap ||= []
  if (!records.rlyehMap.includes(CHAPTER_ID)) records.rlyehMap.push(CHAPTER_ID)
  if (shardControlledBy(state)) records.shardOfYchlecht = true
  setFlag(state, 'courtResolution', key)
  void api
  return { award: true }
}

// ---------------------------------------------------------------------------
// 单卡事件（api.resolveScenarioEvent 派发）
// ---------------------------------------------------------------------------
export const events = Object.freeze({
  // 11632/11633/11634 古代秘库/破损星盘仪：附属到所在地点（卡面「从弃牌堆抽取时附属」的近似）。
  courtGlyphTreachery(state, payload = {}, api = {}) {
    const code = String(payload.code || '')
    if (!GLYPH_TREACHERY_CODES.includes(code)) return false
    const seat = Number.isInteger(payload.seat) ? payload.seat : (state.currentSeat ?? 0)
    const inv = (state.investigators || [])[seat]
    if (!inv) return false
    const loc = locationOf(state, inv.location)
    if (!loc) return false
    if (typeof api.attachEncounterToLocation === 'function') api.attachEncounterToLocation(code, loc.id)
    else {
      loc.attachments ||= []
      loc.attachments.push({ code, originalCode: code, name: ALL_CARDS[code]?.nameZh || code })
    }
    info(api, `「${ALL_CARDS[code]?.nameZh || code}」附属到「${loc.name}」（之后可用地点行动翻译）。`)
    return true
  },
  // 11636 宇宙预兆：意志(3)（已翻译 ≥10 符文时 +2）；失败后二选一。
  courtCosmicOmen(state, payload = {}, api = {}) {
    const seat = Number.isInteger(payload.seat) ? payload.seat : (state.currentSeat ?? 0)
    const inv = (state.investigators || [])[seat]
    if (!inv) return false
    const difficulty = 3 + (translatedGlyphCount(state) >= TRANSLATED_GLYPHS_FOR_ELITE ? 2 : 0)
    const result = typeof api.test === 'function' ? api.test(seat, 'willpower', difficulty, null) : { success: false }
    if (result?.success) { info(api, `宇宙预兆：意志(${difficulty})检定成功。`); return true }
    const inPlayGlyphs = (state.locations || []).flatMap(loc => (loc.attachments || [])
      .filter(attachment => hasTrait(ALL_CARDS[attachment.originalCode || attachment.code] || {}, GLYPH_TRAIT))
      .map(attachment => ({ location: loc, code: String(attachment.originalCode || attachment.code) })))
    const options = []
    if (inPlayGlyphs.length) options.push({ id: 'shuffleGlyph', label: '将场上一张[[符文]]卡洗回遭遇牌库' })
    options.push({ id: 'suffer', label: '受到 1 点直接恐惧并随机弃 1 张手牌' })
    const choice = typeof api.choose === 'function'
      ? api.choose({ kind: 'effect', source: COSMIC_OMEN_CODE, seat, prompt: '宇宙预兆：选择一项。', options })
      : options[0].id
    if (choice === 'shuffleGlyph' && inPlayGlyphs.length) {
      const picked = inPlayGlyphs[0]
      const index = (picked.location.attachments || []).findIndex(attachment => String(attachment.originalCode || attachment.code) === picked.code)
      if (index >= 0) picked.location.attachments.splice(index, 1)
      state.encounterDeck ||= []
      state.encounterDeck.push(picked.code)
      info(api, `宇宙预兆：场上的符文卡洗回遭遇牌库。`)
      return true
    }
    if (typeof api.horror === 'function') api.horror(seat, 1)
    else inv.horror = (Number(inv.horror) || 0) + 1
    if ((inv.hand || []).length) {
      const random = randomOf(api)
      const index = Math.floor(random() * inv.hand.length)
      inv.discard ||= []
      inv.discard.push(inv.hand.splice(index, 1)[0])
    }
    info(api, '宇宙预兆：受到 1 点直接恐惧并随机弃 1 张手牌。')
    return true
  },
})

export const behavior = {
  id: CHAPTER_ID,
  preScenarioSetup,
  introduction,
  modifyDeck,
  setupScenario,
  setupLocations,
  setupEnemies,
  locationPlaced,
  locationRevealed,
  afterDeckSetup,
  actions,
  performAction,
  afterInvestigate,
  investigateResult,
  enemyDefeated,
  checkObjectives,
  allResigned,
  actReveal,
  agendaReveal,
  enemyStatModifier,
  enemyConnections,
  locationShroudModifier,
  moveError,
  resolveChaosToken,
  applyTokenEffect,
  resolution,
  events,
}

export function implementedEntryFlags(code) {
  return registeredEntry(String(code))?.flags || {}
}

// 复用 chaos 的胜利区符文读点（测试/工具可直接从 behavior 取）。
export { glyphCount, translatedGlyphCount }

export function scenarioSummary() {
  const state = { campaign: { records: {} }, scenarioFlags: {}, investigators: [], locations: [], enemies: [], victoryDisplay: [] }
  return {
    id: CHAPTER_ID, referenceCode: '11612',
    route: routeOf(state),
    locationCount: Object.keys(LOCATIONS).length,
    archiveCount: ARCHIVE_IDS.length,
    liftLevels: [...LIFT_LEVELS],
    startLocation: START_LOCATION_BY_ROUTE[routeOf(state)],
    encounterDeckSize: ENCOUNTER_DECK.length,
    tokenFaces: Object.keys(COURT_TOKEN_MEANINGS.standard),
    glyphRunes: Object.values(GLYPH_RECORDS).map(record => record.rune),
    resolutionKeys: [...RESOLUTION_KEYS],
    skullValue,
    isHardSide,
    cultistValue,
    stowawayAtLocation,
    glyphCount,
    translatedGlyphCount,
  }
}
