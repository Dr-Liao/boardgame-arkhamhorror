// 淹没城区（theDrownedQuarter · 11536）· 引擎钩子（章节流程）。
//
// 参考：Scenario/Scenarios/TheDrownedCity/TheDrownedQuarter.hs +
//       Act/Agenda/Location/Enemy/Story/Cards/TheDrownedCity/TheDrownedQuarter/*.hs +
//       Campaigns/TheDrownedCity/Helpers.hs（strugglesForAir / translateGlyph / RlyehMap）。
//
// 引擎读点（全部走既有钩子，不改引擎）：
//   introduction / preScenarioSetup → 东西向分支记录与开场
//   setupLocations / locationPlaced → 屏障核心 + 随机 3×3 海床布局（网格坐标写 mechanicState.grid）
//   afterDeckSetup → 放一边（屏障节点/水下寄生虫/黑曜石遗物）、东向初始淹没、核心同步
//   locationRevealed → [[海底]]地点揭示/进入时的强制提高淹没（本地点 + 一处相邻）
//   actions / performAction → 幕 1 [fast] 降淹没；屏障核心未激活/已激活行动
//   phaseBegan → 水母 / 海底利维坦「敌军阶段开始时若重整则提高所在地点淹没，否则放毁灭」
//   enemyAttackResolved / enemyDefeated → 水下寄生虫翻面（攻击后 / 离场）与符文 X
//   actReveal / agendaReveal / checkObjectives → 幕 1 背面分流结局、议程背面、屏障核心翻面
//   resolveChaosToken / applyTokenEffect / testAutoFail → 11536 四档混乱标记
//   resolution → 结局 1/2/3 + 无结局，写战役记录与下一章（东西向）
//
// 状态写入只经 api.* 或本层 helper（scenarioFlags / scenarioZones / campaign.records /
// mechanicState.grid / 引擎 water 原语），卡条目只读状态。
import { registeredEntry } from '../../../../../src/engine/ability.js'
import { mechanicState } from '../../../../../src/engine/mechanic-state.js'
import { connectGrid, gridPosition } from '../../../../../src/engine/grid-map.js'
import {
  canChangeFloodLevel as canChangeFlood, changeFloodLevel, floodLevel,
} from '../../../../../src/engine/flood.js'
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import {
  ACT1_CODE, AGENDA1_CODE, AGENDA2_CODE, BARRIER_CORE_ACTIVE, BARRIER_CORE_ACTIVE_CODE,
  BARRIER_CORE_INACTIVE, BARRIER_CORE_INACTIVE_CODE, BARRIER_NODE_CODE, ENCOUNTER_DECK,
  ENCOUNTER_DECK_CODES, LOCATIONS, LOCATION_IDS, MEDUSA_CODE, NEXT_SCENARIO_IDS, OBSIDIAN_RELIC_CODE,
  OBSIDIAN_RELIC_STORY_CODE, RESOLUTION_CHAIN, RESOLUTION_KEYS, SEA_FLOOR_CELLS,
  SEA_FLOOR_EXCLUSIVE_PAIRS, SEA_FLOOR_POOL_IDS, SEAFLOOR_LEVIATHAN_CODE, SET_ASIDE_CARDS,
  START_LOCATION, UNDESEA_PARASITE_CODE, UNDESEA_PARASITE_STORY_CODE, scenario,
} from './definition.js'
import {
  drownedQuarterChaosToken, drownedQuarterChaosTokenValue, investigatorCount,
  investigatorFloodLevel, isHardSide, isFullyFlooded, revealedLocationCount, skullValue,
} from './chaos.js'

const CHAPTER_ID = 'theDrownedQuarter'
const BARRIER_CORE_LOCATION_ID = 'barrierCore'

// ---------------------------------------------------------------------------
// 基础工具
// ---------------------------------------------------------------------------
const activeInvestigators = state => (state.investigators || [])
  .filter(inv => inv && !inv.defeated && !inv.resigned)
const info = (api, message) => api?.info?.(message)
const codeOf = value => String(value?.originalCode || value?.code || '')
const clone = value => structuredClone(value)
const recordsFor = state => {
  state.campaign ||= {}
  state.campaign.records ||= {}
  return state.campaign.records
}
const flagsFor = state => (state.scenarioFlags ||= {})
const setFlag = (state, key, value = true) => {
  flagsFor(state)[key] = value
  return value
}
const zonesFor = state => (state.scenarioZones ||= {})
export const locationOf = (state, id) => (state?.locations || []).find(location => location.id === id) || null
const entryOf = code => (code ? registeredEntry(String(code)) : null)
const flagsOf = code => entryOf(code)?.flags || {}
const flagIs = (code, key) => flagsOf(code)[key] === true
const currentAct = state => (state.acts || [])[state.actIndex ?? 0] || null
const currentActCode = state => codeOf(currentAct(state))
const currentActStage = state => scenario.acts[(state.actIndex ?? 0)] || null
const currentAgenda = state => (state.agendas || [])[state.agendaIndex ?? 0] || null
const currentAgendaCode = state => codeOf(currentAgenda(state))
const inPlayBarrierCore = state => locationOf(state, BARRIER_CORE_LOCATION_ID)
const barrierCoreIsActive = state => inPlayBarrierCore(state)?.face === 'active'
  || codeOf(inPlayBarrierCore(state)) === BARRIER_CORE_ACTIVE_CODE
export function isSeaFloorLocation(state, location) {
  return Boolean(location) && (
    Boolean(flagsOf(codeOf(location)).seaFloor)
    || (location.traits || []).some(trait => String(trait).toLowerCase() === 'seafloor')
    || SEA_FLOOR_POOL_IDS.includes(location.id))
}

// ---------------------------------------------------------------------------
// 淹没（引擎原语 api.mechanics.water；内容层直调时退回 flood.js）
// ---------------------------------------------------------------------------
export function floodLevelOf(state, locationId) {
  if (!locationId || !locationOf(state, locationId)) return 0
  return floodLevel(state, locationId)
}

export function canChangeFloodOf(state, locationId, delta = 1) {
  if (!locationOf(state, locationId)) return false
  return canChangeFlood(state, locationId, delta)
}

export function changeFloodOf(state, locationId, delta, api = {}) {
  if (!locationOf(state, locationId)) return false
  const water = api?.mechanics?.water
  if (water?.change) return water.change(locationId, delta)
  return changeFloodLevel(state, locationId, delta)
}

/** 相邻且可提高淹没的地点（网格邻接由 connectGrid 写入 location.connections）。 */
export function adjacentFloodable(state, locationId) {
  const location = locationOf(state, locationId)
  if (!location) return []
  return [...new Set(location.connections || [])]
    .filter(id => locationOf(state, id) && canChangeFloodOf(state, id, 1))
}

// ---------------------------------------------------------------------------
// 网格 / 地点入场
// ---------------------------------------------------------------------------
function syncConnections(state) {
  try {
    connectGrid(state)
  } catch {
    // 纯数据测试没有网格容器时忽略：连接由静态 LOCATION_CONNECTIONS 表覆盖。
  }
  return (state.locations || []).map(location => location.id)
}

export function writeGridCell(state, locationId, cell) {
  const data = mechanicState(state, true)
  data.grid ||= {}
  const existing = data.grid[locationId]
  data.grid[locationId] = {
    x: cell.x, y: cell.y, isolated: false,
    ...(existing?.ports ? { ports: existing.ports } : {}),
    connections: [...(existing?.connections || [])],
  }
  const location = locationOf(state, locationId)
  if (location) location.grid = { x: cell.x, y: cell.y }
  return data.grid[locationId]
}

function locationInstance(state, locationId, { revealed }) {
  const base = state.scenario?.locations?.[locationId] || LOCATIONS[locationId]
  if (!base) return null
  const definition = clone(base)
  const clues = definition.cluesFixed ?? (definition.cluesPerInvestigator != null
    ? definition.cluesPerInvestigator * investigatorCount(state)
    : Number(definition.clues) || 0)
  return {
    ...definition, id: locationId, revealed,
    clues: revealed ? clues : 0, maxClues: clues,
    connections: [...(definition.connections || [])],
    symbolLinks: [], attachments: [], damage: 0, horror: 0, resources: 0, doom: 0,
  }
}

/** 把地点放进网格（直调路径；引擎路径由 locationPlaced 只写坐标）。 */
export function placeLocationAt(state, locationId, cell, api = {}, { revealed = false } = {}) {
  writeGridCell(state, locationId, cell)
  const inPlay = locationOf(state, locationId)
  if (!inPlay) {
    const placed = typeof api?.mechanics?.map?.place === 'function'
      ? api.mechanics.map.place(locationId, cell.x, cell.y)
      : null
    if (!placed && !locationOf(state, locationId)) {
      const instance = locationInstance(state, locationId, { revealed })
      if (!instance) return null
      state.locations ||= []
      state.locations.push(instance)
      locationPlaced(state, instance, api)
    }
  }
  const location = locationOf(state, locationId)
  if (location) location.grid = { x: cell.x, y: cell.y }
  if (revealed && location && location.revealed !== true) {
    location.revealed = true
    location.clues = Math.max(0, Number(location.maxClues) || 0)
    delete location.hiddenIdentity
  }
  syncConnections(state)
  return locationId
}

// ---------------------------------------------------------------------------
// 随机海床布局
// ---------------------------------------------------------------------------
const randomOf = api => (typeof api?.random === 'function' ? api.random : () => 0.5)
function localShuffle(list, random = Math.random) {
  const result = [...list]
  for (let index = result.length - 1; index > 0; index--) {
    const pick = Math.floor(random() * (index + 1))
    ;[result[index], result[pick]] = [result[pick], result[index]]
  }
  return result
}
function resolveShuffle(api, helper = {}) {
  if (typeof api?.shuffle === 'function') return list => api.shuffle([...list])
  if (typeof helper?.shuffle === 'function') return list => helper.shuffle([...list])
  return null
}
function shuffled(list, shuffle, random) {
  return shuffle ? [...shuffle([...list])] : localShuffle(list, random)
}

/** Setup 的随机布局：两组二选一地点各随机移出 1 张；其余 8 张洗牌进环位。 */
export function planLayout(state, { shuffle = null } = {}) {
  const existing = state.scenarioFlags?.drownedQuarterLayout
  if (existing) return existing
  const random = () => 0.5
  const removed = []
  for (const pair of SEA_FLOOR_EXCLUSIVE_PAIRS) {
    const picked = shuffle ? shuffled(pair, shuffle, random)[0] : pair[0]
    removed.push(picked)
  }
  const pool = SEA_FLOOR_POOL_IDS.filter(id => !removed.includes(id))
  const inPlay = shuffled(pool, shuffle, random).slice(0, SEA_FLOOR_CELLS.length)
  const cells = { [BARRIER_CORE_LOCATION_ID]: { ...{ x: 0, y: 0 } } }
  for (const [index, id] of inPlay.entries()) cells[id] = { ...SEA_FLOOR_CELLS[index] }
  const plan = { cells, removed, pool: [...pool], inPlay, order: [...inPlay] }
  setFlag(state, 'drownedQuarterLayout', plan)
  return plan
}

export function layoutPlan(state) {
  return state.scenarioFlags?.drownedQuarterLayout || null
}

/** 运行期真实网格坐标（placeLocationAt / setupLocations 写入）。 */
export function cellOf(state, locationId) {
  return gridPosition(state, locationId)
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------
export function headedWest(state) {
  return recordsFor(state).theExpeditionHeadedWest === true
}

export function prepareScenario(state, api = {}) {
  if (state.scenarioFlags?.drownedQuarterPrepared) return state.scenarioFlags.drownedQuarterReport
  const west = headedWest(state)
  setFlag(state, 'drownedQuarterHeadedWest', west)
  setFlag(state, 'drownedQuarterIntro', west ? 'headedWest' : 'headedEast')
  const actSource = state.scenario?.acts || scenario.acts
  state.acts = actuate(actSource)
  const agendaSource = state.scenario?.agendas || scenario.agendas
  state.agendas = [clone(agendaSource[0]), clone(agendaSource[1])]
  state.actIndex = Number.isInteger(state.actIndex) ? state.actIndex : 0
  state.agendaIndex = Number.isInteger(state.agendaIndex) ? state.agendaIndex : 0
  const report = {
    headedWest: west,
    nextScenarioId: west ? NEXT_SCENARIO_IDS.west : NEXT_SCENARIO_IDS.east,
    actCodes: [ACT1_CODE],
    agendaCodes: [AGENDA1_CODE, AGENDA2_CODE],
  }
  setFlag(state, 'drownedQuarterReport', report)
  setFlag(state, 'drownedQuarterPrepared', true)
  info(api, `淹没城区：远征队${west ? '向西' : '向东'}；下一步 ${report.nextScenarioId}。`)
  return report
}

function actuate(actSource) {
  return [clone(actSource[0])]
}

export function preScenarioSetup(state, events = null, helperOrApi = {}) {
  void events
  const api = helperOrApi?.api || helperOrApi || {}
  return { ...prepareScenario(state, api), introText: introFor(state) }
}

export function introFor(state) {
  const key = headedWest(state) ? 'headedWest' : 'headedEast'
  return { key, text: scenario.introBranches[key] || '' }
}

export function introduction(sc, records = {}, context = null) {
  const state = context?.campaign ? context : { campaign: { records }, scenarioFlags: context?.scenarioFlags || {} }
  const west = recordsFor({ ...state, campaign: { records } }).theExpeditionHeadedWest === true
  const sections = [{
    title: scenario.name,
    paragraphs: [scenario.intro, west ? scenario.introBranches.headedWest : scenario.introBranches.headedEast]
      .filter(Boolean),
  }]
  return { version: 3, title: sc?.name || scenario.name, sections, paragraphs: sections[0].paragraphs, code: ACT1_CODE }
}

/**
 * Setup 地点（引擎钩子）：随机移出二选一地点、洗牌、写网格坐标；
 * 返回本关 Setup 时全部入场的地点 id（屏障核心 + 8 张海床）。
 */
export function setupLocations(state, events = null, helper = {}) {
  void events
  const api = helper?.api || {}
  state.__api = api
  const prepare = prepareScenario(state, api)
  const plan = planLayout(state, { shuffle: resolveShuffle(api, helper) })
  for (const [id, cell] of Object.entries(plan.cells)) writeGridCell(state, id, cell)
  setFlag(state, 'drownedQuarterSetup', { ...prepare, inPlay: [...plan.inPlay], removed: [...plan.removed] })
  info(api, `淹没城区布置：${plan.inPlay.length} 张海床入环位，移出 ${plan.removed.join('、')}。`)
  return [BARRIER_CORE_LOCATION_ID, ...plan.inPlay]
}

export function locationPlaced(state, location, api = {}, seat = null) {
  void seat
  if (!location) return
  const plan = layoutPlan(state)
  if (location.id === BARRIER_CORE_LOCATION_ID) {
    if (!gridPosition(state, location.id)) writeGridCell(state, location.id, plan?.cells?.[location.id] || { x: 0, y: 0 })
    // Setup：屏障核心（未激活面）正面朝上入场。
    location.revealed = true
    location.face = 'inactive'
    location.clues = Math.max(0, Number(location.maxClues) || investigatorCount(state) * 1)
  } else if (!gridPosition(state, location.id)) {
    const cell = plan?.cells?.[location.id]
    if (cell) writeGridCell(state, location.id, cell)
    // Setup 时入场的海床地点保持未揭示（背面 = 海床）。
    if (plan?.inPlay?.includes(location.id)) location.revealed = false
  }
  const cell = gridPosition(state, location.id)
  if (cell) location.grid = { x: cell.x, y: cell.y }
  syncConnections(state)
}

/** 海床地点揭示时的「进入海床」强制：提高本地点与一处相邻地点的淹没。 */
export function locationRevealed(state, location, api = {}, seat = null) {
  void seat
  if (!location) return false
  syncConnections(state)
  if (!isSeaFloorLocation(state, location)) return false
  const marker = `drownedQuarterFloodHandled:${location.id}`
  if (state.scenarioFlags?.[marker]) return false
  setFlag(state, marker, true)
  if (canChangeFloodOf(state, location.id, 1)) changeFloodOf(state, location.id, 1, api)
  const candidates = adjacentFloodable(state, location.id)
  const target = candidates[0]
  if (target) changeFloodOf(state, target, 1, api)
  info(api, `进入海床「${location.name}」：本地点${target ? '与一处相邻地点' : ''}的淹没等级提高。`)
  return true
}

export function afterDeckSetup(state, events = null, helper = {}) {
  void events
  const api = helper?.api || {}
  state.__api = api
  const zones = zonesFor(state)
  zones.setAside = [...SET_ASIDE_CARDS]
  setFlag(state, 'drownedQuarterRemoved', [...(layoutPlan(state)?.removed || [])])
  if (!headedWest(state)) {
    // 东向：提高 1/每名调查员处[[海底]]地点的淹没等级（环位地点；核心由自身行动处理）。
    const seaFloor = (state.locations || [])
      .filter(location => location.id !== START_LOCATION && isSeaFloorLocation(state, location))
    const count = Math.min(seaFloor.length, investigatorCount(state))
    for (const location of seaFloor.slice(0, count)) changeFloodOf(state, location.id, 1, api)
    info(api, `东向：${count} 处海床地点的淹没等级提高。`)
  }
  syncBarrierCore(state, api)
  syncConnections(state)
  return { setAside: [...zones.setAside], inPlay: [...(layoutPlan(state)?.inPlay || [])] }
}

/** 直调/单测入口：等价于引擎 Setup 全流程。 */
export function setupScenario(state, api = {}) {
  state.locations = []
  state.enemies ||= []
  state.storyAssets ||= []
  state.scenarioFlags ||= {}
  delete state.scenarioFlags.drownedQuarterPrepared
  delete state.scenarioFlags.drownedQuarterReport
  delete state.scenarioFlags.drownedQuarterLayout
  const report = prepareScenario(state, api)
  const inPlay = setupLocations(state, null, { api })
  const plan = layoutPlan(state)
  for (const id of inPlay) placeLocationAt(state, id, plan.cells[id], api, { revealed: id === START_LOCATION })
  state.investigators ||= []
  for (const inv of state.investigators) if (!inv.location) inv.location = START_LOCATION
  if (!state.encounterDeck?.length) state.encounterDeck = [...(state.scenario?.encounterDeck || ENCOUNTER_DECK)]
  afterDeckSetup(state, null, { api })
  syncBarrierCore(state, api)
  info(api, `淹没城区：${state.locations.length} 处地点入场。`)
  return { ...report, placedIds: [...inPlay], removed: [...(plan.removed || [])] }
}

// ---------------------------------------------------------------------------
// 屏障核心（未激活 ↔ 已激活）
// ---------------------------------------------------------------------------
export function revealedUnfloodedSeaFloorCount(state) {
  return (state.locations || []).filter(location => location.revealed === true
    && isSeaFloorLocation(state, location) && floodLevelOf(state, location.id) === 0).length
}

/** 强制（任意窗口）：≥6 处已揭示且未淹没的海底地点 → 翻到已激活；≤5 → 翻回未激活。 */
export function syncBarrierCore(state, api = {}) {
  const core = inPlayBarrierCore(state)
  if (!core) return false
  const count = revealedUnfloodedSeaFloorCount(state)
  const active = barrierCoreIsActive(state)
  if (!active && count >= 6) return flipBarrierCore(state, true, api)
  if (active && count <= 5) return flipBarrierCore(state, false, api)
  return false
}

export function flipBarrierCore(state, toActive, api = {}) {
  const core = inPlayBarrierCore(state)
  if (!core) return false
  const already = barrierCoreIsActive(state)
  if (already === toActive) return false
  core.face = toActive ? 'active' : 'inactive'
  core.code = toActive ? BARRIER_CORE_ACTIVE_CODE : BARRIER_CORE_INACTIVE_CODE
  core.originalCode = core.code
  core.artCode = core.code
  core.subname = toActive ? '已激活' : '未激活'
  core.clues = toActive ? 0 : Math.max(0, Number(core.maxClues) || investigatorCount(state) * 1)
  setFlag(state, 'drownedQuarterBarrierCoreActive', toActive)
  info(api, `屏障核心翻面：${toActive ? '已激活' : '未激活'}（已揭示且未淹没海床 ${revealedUnfloodedSeaFloorCount(state)}）。`)
  return true
}

export function barrierCoreSummary(state) {
  return {
    inPlay: Boolean(inPlayBarrierCore(state)),
    active: barrierCoreIsActive(state),
    face: inPlayBarrierCore(state)?.face || null,
    revealedUnfloodedSeaFloor: revealedUnfloodedSeaFloorCount(state),
  }
}

// ---------------------------------------------------------------------------
// 行动
// ---------------------------------------------------------------------------
const groupCluesAt = (state, locationId) => (state.investigators || [])
  .filter(inv => inv.location === locationId && !inv.defeated && !inv.resigned)
  .reduce((sum, inv) => sum + (Number(inv.clues) || 0), 0)

function spendGroupClues(state, locationId, amount) {
  let remaining = amount
  for (const inv of state.investigators || []) {
    if (remaining <= 0) break
    if (inv.location !== locationId || inv.defeated || inv.resigned) continue
    const pay = Math.min(Number(inv.clues) || 0, remaining)
    inv.clues = (Number(inv.clues) || 0) - pay
    remaining -= pay
  }
  return remaining === 0
}

/** 屏障节点是否已被某位调查员控制（放一边 → 入场）。 */
export function controlledBarrierNode(state) {
  return (state.investigators || []).some(inv => (inv.assets || []).some(asset => codeOf(asset) === BARRIER_NODE_CODE))
    || (state.storyAssets || []).some(asset => codeOf(asset) === BARRIER_NODE_CODE && asset.controllerSeat != null)
}

export function actions(state, inv) {
  if (!inv || inv.defeated || inv.resigned) return []
  const here = locationOf(state, inv.location)
  if (!here) return []
  const moves = []
  const required = investigatorCount(state)
  const actCode = currentActCode(state)
  // 幕 1 正面 [fast]：在淹没地点，团队共同花费 1[per_investigator] 线索降低你所在地点的淹没等级。
  if (actCode === ACT1_CODE && floodLevelOf(state, here.id) > 0) {
    const available = groupCluesAt(state, here.id)
    moves.push({
      action: 'scenarioAction', rule: 'drownedQuarterDecreaseFlood', locationId: here.id, actions: 0,
      label: `共同花费 ${required} 个线索：降低「${here.name}」的淹没等级`,
      reason: available >= required ? null : `需要本地点共 ${required} 个线索（现有 ${available}）`,
    })
  }
  // 屏障核心（未激活）：降低核心淹没并选择一处相邻地点提高淹没，然后放置 3/人线索（团队每轮一次）。
  if (here.id === BARRIER_CORE_LOCATION_ID && !barrierCoreIsActive(state) && floodLevelOf(state, here.id) > 0) {
    const canRound = !state.scenarioFlags?.[`drownedQuarterCoreAction:${state.round}`]
    moves.push({
      action: 'scenarioAction', rule: 'drownedQuarterCoreDivert', locationId: here.id, actions: 1,
      label: '降低屏障核心的淹没等级，并选择一处相邻地点提高其淹没等级，然后在上面放置 3/每名调查员线索',
      reason: canRound ? null : '团队每轮限一次',
    })
  }
  // 屏障核心（已激活）：团队共同花费 2[per_investigator] 线索，把放一边的屏障节点放入场由你控制（每场一次）。
  if (here.id === BARRIER_CORE_LOCATION_ID && barrierCoreIsActive(state)
    && !controlledBarrierNode(state) && !state.scenarioFlags?.drownedQuarterBarrierNodeTaken) {
    const available = groupCluesAt(state, here.id)
    moves.push({
      action: 'scenarioAction', rule: 'drownedQuarterTakeBarrierNode', locationId: here.id, actions: 1,
      label: `共同花费 ${required * 2} 个线索：把放一边的屏障节点放入场，由你控制`,
      reason: available >= required * 2 ? null : `需要本地点共 ${required * 2} 个线索（现有 ${available}）`,
    })
  }
  return moves
}

export function performAction(state, inv, move, api = {}) {
  if (!move || !inv || inv.defeated || inv.resigned) return false
  if (move.rule === 'drownedQuarterDecreaseFlood') return decreaseFloodAction(state, inv, api)
  if (move.rule === 'drownedQuarterCoreDivert') return coreDivertAction(state, inv, api)
  if (move.rule === 'drownedQuarterTakeBarrierNode') return takeBarrierNodeAction(state, inv, api)
  return false
}

function decreaseFloodAction(state, inv, api) {
  const here = locationOf(state, inv.location)
  if (!here || floodLevelOf(state, here.id) <= 0) return false
  const required = investigatorCount(state)
  if (groupCluesAt(state, here.id) < required) return false
  spendGroupClues(state, here.id, required)
  changeFloodOf(state, here.id, -1, api)
  info(api, `${inv.name} 共同支付线索：降低「${here.name}」的淹没等级。`)
  syncBarrierCore(state, api)
  return true
}

function coreDivertAction(state, inv, api) {
  const core = locationOf(state, BARRIER_CORE_LOCATION_ID)
  if (!core || barrierCoreIsActive(state)) return false
  const roundKey = `drownedQuarterCoreAction:${state.round}`
  if (state.scenarioFlags?.[roundKey]) return false
  if (floodLevelOf(state, core.id) <= 0) return false
  const candidates = adjacentFloodable(state, core.id)
  if (!candidates.length) return false
  const target = candidates[0]
  setFlag(state, roundKey, true)
  changeFloodOf(state, core.id, -1, api)
  changeFloodOf(state, target, 1, api)
  const targetLocation = locationOf(state, target)
  if (targetLocation) {
    const per = investigatorCount(state) * 3
    targetLocation.clues = (Number(targetLocation.clues) || 0) + per
  }
  info(api, `屏障核心：降低自身淹没、提高「${targetLocation?.name || target}」的淹没并在其上放置 ${investigatorCount(state) * 3} 个线索。`)
  syncBarrierCore(state, api)
  return true
}

function takeBarrierNodeAction(state, inv, api) {
  const core = locationOf(state, BARRIER_CORE_LOCATION_ID)
  if (!core || !barrierCoreIsActive(state)) return false
  if (controlledBarrierNode(state) || state.scenarioFlags?.drownedQuarterBarrierNodeTaken) return false
  const required = investigatorCount(state) * 2
  if (groupCluesAt(state, core.id) < required) return false
  spendGroupClues(state, core.id, required)
  setFlag(state, 'drownedQuarterBarrierNodeTaken', true)
  const zones = zonesFor(state)
  if (Array.isArray(zones.setAside)) {
    const index = zones.setAside.indexOf(BARRIER_NODE_CODE)
    if (index >= 0) zones.setAside.splice(index, 1)
  }
  let asset = null
  if (typeof api.giveAsset === 'function') asset = api.giveAsset(inv.seat, BARRIER_NODE_CODE)
  if (!asset) {
    const card = ALL_CARDS[BARRIER_NODE_CODE] || {}
    asset = {
      id: `drownedQuarter-barrierNode-${inv.seat}`, code: BARRIER_NODE_CODE, originalCode: BARRIER_NODE_CODE,
      name: card.nameZh || card.name || BARRIER_NODE_CODE, controllerSeat: inv.seat, ownerSeat: inv.seat,
      exhausted: false, damage: 0, horror: 0, tokens: 0, attachments: [],
    }
    inv.assets ||= []
    inv.assets.push(asset)
  }
  info(api, `${inv.name} 控制屏障节点。`)
  return true
}

// ---------------------------------------------------------------------------
// 敌军阶段强制（水母 / 海底利维坦）
// ---------------------------------------------------------------------------
function raiseFloodOrDoom(state, enemy, api) {
  const locationId = enemy.location
  if (locationId && canChangeFloodOf(state, locationId, 1)) {
    changeFloodOf(state, locationId, 1, api)
    info(api, `「${enemy.name}」重整：提高「${locationOf(state, locationId)?.name || locationId}」的淹没等级。`)
    return true
  }
  if (typeof api.placeDoomOnCard === 'function') api.placeDoomOnCard(enemy, 1)
  else enemy.doom = (Number(enemy.doom) || 0) + 1
  info(api, `「${enemy.name}」无法提高淹没：在其上放置 1 个毁灭标记。`)
  return true
}

export function phaseBegan(state, phase, api = {}) {
  if (String(phase) !== 'enemy') return false
  let handled = false
  for (const enemy of [...(state.enemies || [])]) {
    const code = codeOf(enemy)
    if (enemy.exhausted === true) continue
    if (code === MEDUSA_CODE || code === SEAFLOOR_LEVIATHAN_CODE) handled = raiseFloodOrDoom(state, enemy, api) || handled
  }
  syncBarrierCore(state, api)
  return handled
}

// ---------------------------------------------------------------------------
// 水下寄生虫 / 黑曜石遗物（翻面与符文）
// ---------------------------------------------------------------------------
const GLYPH_LETTER = rune => String(rune).replace(/^.*rune_/, '').replace(/[^a-z]/gi, '').toUpperCase()

/** 记录一枚已译字形（campaign.records.discoveredGlyphs 是 §4 的 string[] 记录键）。 */
export function translateGlyph(state, rune, meaning, api = {}) {
  const letter = GLYPH_LETTER(rune)
  if (!letter) return false
  const records = recordsFor(state)
  records.discoveredGlyphs ||= []
  const added = !records.discoveredGlyphs.includes(letter)
  if (added) records.discoveredGlyphs.push(letter)
  info(api, `发现符文 [${letter}]${meaning ? `（「${meaning}」）` : ''}${added ? '' : '（已记录）'}。`)
  return true
}

export function glyphsKnown(state, letters) {
  const want = String(letters).toUpperCase().split('').filter(Boolean)
  const known = new Set(recordsFor(state).discoveredGlyphs || [])
  return want.every(letter => known.has(letter))
}

/** 水下寄生虫翻面故事（11549b）：攻击后翻面 → 移动到连接地点；离场翻面 → 符文 X + 胜利区。 */
export function flipUnderseaParasite(state, enemy, flippedBy, api = {}) {
  if (!enemy) return false
  if (flippedBy === 'attack') {
    const origin = enemy.location
    const from = locationOf(state, origin)
    const candidates = (from?.connections || []).filter(id => locationOf(state, id))
    const empty = candidates.filter(id => !activeInvestigators(state).some(inv => inv.location === id))
    const target = (empty.length ? empty : candidates)[0] || origin
    if (typeof api.moveEnemy === 'function') api.moveEnemy(enemy, target)
    else enemy.location = target
    enemy.exhausted = true
    info(api, `水下寄生虫咬伤后消失在珊瑚迷宫中（移动到「${locationOf(state, target)?.name || target}」）。`)
    return true
  }
  translateGlyph(state, 'rune_x', '总和', api)
  const code = UNDESEA_PARASITE_STORY_CODE
  state.victoryDisplay ||= []
  if (!state.victoryDisplay.some(entry => codeOf(entry) === code)) {
    state.victoryDisplay.push({
      id: enemy.id, code, originalCode: code,
      name: ALL_CARDS[code]?.nameZh || ALL_CARDS[code]?.name || code,
      victory: 1,
    })
  }
  const index = (state.enemies || []).indexOf(enemy)
  if (index >= 0) state.enemies.splice(index, 1)
  info(api, '水下寄生虫被压碎：发现符文 [X]，卡牌加入胜利区。')
  return true
}

export function enemyAttackResolved(state, enemy, inv, api = {}, attack = null) {
  void inv
  void attack
  if (!enemy) return false
  if (codeOf(enemy) === UNDESEA_PARASITE_CODE) return flipUnderseaParasite(state, enemy, 'attack', api)
  return false
}

export function enemyDefeated(state, enemy, api = {}) {
  if (!enemy) return false
  // 「将要离场时」近似为「被击败时」：同一张双面故事的离场分支。
  if (codeOf(enemy) === UNDESEA_PARASITE_CODE) return flipUnderseaParasite(state, enemy, 'leave', api)
  return false
}

/** 黑曜石遗物（11550）→ 故事面（11550b）：检定成功翻面，记录符文 Y 并加入胜利区。 */
export function flipObsidianRelic(state, inv, asset, api = {}) {
  if (!asset || !inv) return false
  const spec = flagsOf(OBSIDIAN_RELIC_CODE).test || { skill: 'intellect', difficulty: 8 }
  const run = finish => {
    translateGlyph(state, 'rune_y', '知识', api)
    const code = OBSIDIAN_RELIC_STORY_CODE
    state.victoryDisplay ||= []
    if (!state.victoryDisplay.some(entry => codeOf(entry) === code)) {
      state.victoryDisplay.push({
        id: asset.id, code, originalCode: code,
        name: ALL_CARDS[code]?.nameZh || ALL_CARDS[code]?.name || code, victory: 1,
      })
    }
    const assets = inv.assets || []
    const index = assets.indexOf(asset)
    if (index >= 0) assets.splice(index, 1)
    info(api, '黑曜石遗物打开：发现符文 [Y]，卡牌加入胜利区。')
    finish?.()
  }
  if (typeof api.test !== 'function') { run(); return true }
  api.test(inv.seat, spec.skill, spec.difficulty, result => { if (result?.success === true) run() },
    0, { label: '黑曜石遗物：智力(8)' })
  return true
}

/** 屏障节点：不能离场 + 回合开始自愈 1 点 + 字形集齐 +2 生命。 */
export function barrierNodeInPlay(state) {
  return (state.investigators || []).flatMap(inv => inv.assets || [])
    .find(asset => codeOf(asset) === BARRIER_NODE_CODE) || null
}

export function turnBegins(state, inv, api = {}) {
  if (!inv) return false
  let handled = false
  const node = (inv.assets || []).find(asset => codeOf(asset) === BARRIER_NODE_CODE)
  if (node && (Number(node.damage) || 0) > 0) {
    if (typeof api.healAsset === 'function') api.healAsset(node, 1)
    else node.damage = Math.max(0, (Number(node.damage) || 0) - 1)
    handled = true
  }
  return handled
}

// ---------------------------------------------------------------------------
// 幕 / 议程
// ---------------------------------------------------------------------------
export function actReveal(state, act, api = {}) {
  const code = codeOf(act)
  if (code !== ACT1_CODE) return false
  // 幕 1 背面：如果有调查员控制屏障节点 → 结局 1；否则 → 结局 2。
  const key = controlledBarrierNode(state) ? 'resolution1' : 'resolution2'
  info(api, `重新激活核心（背面）：${controlledBarrierNode(state) ? '控制屏障节点 → 结局 1' : '未控制屏障节点 → 结局 2'}。`)
  if (typeof api.finish === 'function') { api.finish(key); return true }
  state.resolution = key
  return true
}

export function agendaReveal(state, agenda, api = {}) {
  const code = codeOf(agenda)
  if (code === AGENDA1_CODE) {
    // 议题 1 背面 = 海底利维坦（双面议程的另一面）：在屏障核心生成。
    spawnEnemy(state, SEAFLOOR_LEVIATHAN_CODE, BARRIER_CORE_LOCATION_ID, api)
    info(api, '沉没遗迹（背面）：海底利维坦在屏障核心生成。')
    return true
  }
  if (code === AGENDA2_CODE) {
    for (const inv of activeInvestigators(state)) {
      if (typeof api.addTrauma === 'function') api.addTrauma(inv.seat, 'physical', 1)
      else {
        state.campaign ||= {}
        state.campaign.trauma ||= {}
        state.campaign.trauma[inv.seat] ||= { physical: 0, mental: 0 }
        state.campaign.trauma[inv.seat].physical += 1
      }
      if (typeof api.defeat === 'function') api.defeat(inv, 'physical')
      else { inv.defeated = true; inv.defeatCause = 'physical' }
    }
    state.resolution = 'noResolution'
    info(api, '崩塌圆顶（背面）：每位存活调查员被击败并承受 1 点肉体创伤。')
    return true
  }
  return false
}

export function checkObjectives(state, api = {}) {
  if (state.status && state.status !== 'playing') return false
  syncBarrierCore(state, api)
  if (currentActCode(state) !== ACT1_CODE) return false
  if (state._roundEndWindow !== true) return false
  const alive = activeInvestigators(state)
  if (!alive.length) return false
  if (!barrierCoreIsActive(state)) return false
  if (!alive.every(inv => inv.location === BARRIER_CORE_LOCATION_ID)) return false
  const act = currentAct(state)
  info(api, '轮末：每位未击败调查员都在屏障核心（已激活），推进幕 1。')
  if (typeof api.advanceAct === 'function') { api.advanceAct(); return true }
  return actReveal(state, act, api)
}

export function allResigned(state, api = {}) {
  syncBarrierCore(state, api)
  return false
}

export function roundEnded(state, api = {}) {
  syncBarrierCore(state, api)
  return undefined
}

// ---------------------------------------------------------------------------
// 敌人
// ---------------------------------------------------------------------------
let enemySerial = 0
export function enemyDefinitionFor(code) {
  const definition = scenario.enemies?.[code] || {}
  const card = ALL_CARDS[code] || {}
  return { ...card, ...definition, code, type: 'enemy', traits: [...(definition.traits || card.traits || [])] }
}

export function seafloorLeviathanHealth(state) {
  const bonus = Number(scenario.enemies?.[SEAFLOOR_LEVIATHAN_CODE]?.healthPerInvestigatorBonus) || 3
  return 4 + investigatorCount(state) * bonus
}

export function spawnEnemy(state, code, locationId, api = {}, options = {}) {
  const spawned = typeof api.spawn === 'function' ? api.spawn(code, locationId, options) : null
  if (spawned) {
    if (code === SEAFLOOR_LEVIATHAN_CODE) spawned.health = seafloorLeviathanHealth(state)
    return spawned
  }
  const definition = enemyDefinitionFor(code)
  if (!definition.name && !definition.fight && !definition.health) return null
  enemySerial += 1
  const enemy = {
    id: `drownedQuarter-${code}-${enemySerial}`, code, originalCode: code,
    name: definition.nameZh || definition.name || code, location: locationId,
    fight: definition.fight ?? 0, evade: definition.evade ?? 0,
    health: code === SEAFLOOR_LEVIATHAN_CODE ? seafloorLeviathanHealth(state) : (definition.health ?? 1),
    damage: definition.damage || 0, horror: definition.horror || 0,
    traits: [...(definition.traits || [])], exhausted: false, engagedSeat: null,
    damageTaken: 0, doom: 0, clues: 0, attachments: [], victory: Number(definition.victory) || 0,
    ...(definition.elite ? { elite: true } : {}),
    ...(definition.massive ? { massive: true } : {}),
    ...(definition.patrol ? { patrol: true } : {}),
  }
  state.enemies ||= []
  state.enemies.push(enemy)
  return enemy
}

export function enemyStatModifier(state, enemy, stat) {
  if (!enemy || stat !== 'fight') return 0
  void state
  return 0
}

// ---------------------------------------------------------------------------
// 混乱标记
// ---------------------------------------------------------------------------
export function resolveChaosToken(state, inv, token) {
  return drownedQuarterChaosToken(state, inv, token)
}

export function chaosTokenValue(state, tokenFace) {
  return drownedQuarterChaosTokenValue(state, tokenFace)
}

export function applyTokenEffect(state, inv, effect = {}, api = {}) {
  if (!inv || !effect) return false
  const mode = effect.mode
  const test = effect.test || null
  const failedBy = Math.max(0, Number(test?.failedBy) || 0)
  const succeeded = failedBy <= 0
  const placeClues = amount => {
    const clues = Math.max(0, Number(inv.clues) || 0)
    const moved = Math.min(amount, clues)
    if (moved <= 0) return false
    inv.clues = clues - moved
    const here = locationOf(state, inv.location)
    if (here) here.clues = (Number(here.clues) || 0) + moved
    info(api, `[tablet]：把 ${moved} 个线索放到「${here?.name || inv.location}」。`)
    return true
  }
  if (effect.token === 'cultist') {
    if (mode === 'damageIfFlooded') {
      if (investigatorFloodLevel(state, inv) < 1) return false
      if (typeof api.damage === 'function') api.damage(inv.seat, 1)
      else inv.damage = (Number(inv.damage) || 0) + 1
      info(api, '[cultist]：你所在地点已淹没，受到 1 点伤害。')
      return true
    }
    if (mode === 'damageOnFailFullyFlooded') {
      if (!isFullyFlooded(state, inv)) return false
      if (typeof api.damage === 'function') api.damage(inv.seat, 1)
      else inv.damage = (Number(inv.damage) || 0) + 1
      info(api, '[cultist]：检定失败且地点完全淹没，受到 1 点伤害。')
      return true
    }
    return false
  }
  if (effect.token === 'tablet') {
    if (mode === 'placeClueOnFail') return succeeded ? false : placeClues(1)
    if (mode === 'placeCluesPerFailure') return succeeded ? false : placeClues(failedBy)
    return false
  }
  if (effect.token === 'elderthing') return false
  return false
}

export function testAutoFail() {
  return false
}

// ---------------------------------------------------------------------------
// 结局
// ---------------------------------------------------------------------------
const RESOLUTION_STEPS = Object.freeze({
  noResolution: { log: '无结局：每位调查员尽量擦除其任务下的 1 点进度。', record: null },
  resolution1: { record: 'barrierNode', log: '结局 1：勾选已获得神器「屏障节点」。' },
  resolution2: { record: 'thePowerWasDiverted', log: '结局 2：记录「供能被改道」，每名调查员 +2 奖励经验。' },
  resolution3: { log: '结局 3：划掉拉莱耶地图上的「淹没城区」。' },
})

export function resolutionChainForKey(key) {
  return [...(RESOLUTION_CHAIN[key] || [])]
}

export function nextScenarioFor(state) {
  return headedWest(state) ? NEXT_SCENARIO_IDS.west : NEXT_SCENARIO_IDS.east
}

export function resolution(state, key, events = null, api = {}) {
  void events
  const infoApi = api?.info ? api : api?.api || {}
  const finalKey = RESOLUTION_KEYS.includes(String(key)) ? String(key) : 'noResolution'
  const chain = resolutionChainForKey(finalKey)
  if (!chain.length) throw new RangeError(`未知结局：${key}`)
  const records = recordsFor(state)
  records.drownedQuarterResolution = finalKey
  records.drownedQuarterResolvedTo = chain[chain.length - 1]
  records.drownedQuarterNoResolution = finalKey === 'noResolution'
  records.drownedQuarterNextScenario = nextScenarioFor(state)
  for (const step of chain) {
    const config = RESOLUTION_STEPS[step]
    if (!config) continue
    if (config.record) records[config.record] = true
    info(infoApi, config.log)
    // 结局 3：若「供能被改道」已记录，每名调查员获得 2 点奖励经验（印刷：结局 2 的
    // 奖励经验实际在结局 3 结算；无结局链不会带这条记录）。
    if (step === 'resolution3' && records.thePowerWasDiverted === true) {
      for (const inv of state.investigators || []) {
        if (typeof api.addScenarioXpBonus === 'function') api.addScenarioXpBonus(inv.seat, 2)
        else inv.scenarioXpBonus = (Number(inv.scenarioXpBonus) || 0) + 2
      }
      info(infoApi, '结局 3：供能被改道，每名调查员 +2 奖励经验。')
    }
  }
  // 结局 3：把「淹没城区」从拉莱耶地图划掉（rlyehMap 是 string[] 记录键）。
  records.rlyehMap ||= []
  if (!records.rlyehMap.includes('RlyehDrownedQuarter')) records.rlyehMap.push('RlyehDrownedQuarter')
  return { bonus: 0, award: true, nextScenarioId: records.drownedQuarterNextScenario }
}

// ---------------------------------------------------------------------------
// 事件（单卡条目 / 指南用）
// ---------------------------------------------------------------------------
export const events = {
  drownedQuarterTranslateGlyph(state, payload = {}, api = {}) {
    return translateGlyph(state, payload.rune, payload.meaning, api)
  },
  drownedQuarterSpawnUnderseaParasite(state, payload = {}, api = {}) {
    const locationId = payload.locationId || (state.investigators || [])[payload.seat]?.location
    const zones = zonesFor(state)
    if (Array.isArray(zones.setAside)) {
      const index = zones.setAside.indexOf(UNDESEA_PARASITE_CODE)
      if (index >= 0) zones.setAside.splice(index, 1)
    }
    return spawnEnemy(state, UNDESEA_PARASITE_CODE, locationId, api, { engagedSeat: payload.seat ?? null })
  },
  drownedQuarterTakeObsidianRelic(state, payload = {}, api = {}) {
    const inv = (state.investigators || [])[payload.seat]
    if (!inv) return false
    const zones = zonesFor(state)
    if (Array.isArray(zones.setAside)) {
      const index = zones.setAside.indexOf(OBSIDIAN_RELIC_CODE)
      if (index >= 0) zones.setAside.splice(index, 1)
    }
    if (typeof api.giveAsset === 'function') return api.giveAsset(inv.seat, OBSIDIAN_RELIC_CODE)
    const card = ALL_CARDS[OBSIDIAN_RELIC_CODE] || {}
    const asset = {
      id: `drownedQuarter-obsidianRelic-${inv.seat}`, code: OBSIDIAN_RELIC_CODE,
      originalCode: OBSIDIAN_RELIC_CODE, name: card.nameZh || card.name || OBSIDIAN_RELIC_CODE,
      controllerSeat: inv.seat, ownerSeat: inv.seat, exhausted: false, damage: 0, horror: 0,
      tokens: 0, attachments: [],
    }
    inv.assets ||= []
    inv.assets.push(asset)
    return asset
  },
  drownedQuarterTakeBarrierNode(state, payload = {}, api = {}) {
    const inv = (state.investigators || [])[payload.seat]
    if (!inv) return false
    const zones = zonesFor(state)
    if (Array.isArray(zones.setAside)) {
      const index = zones.setAside.indexOf(BARRIER_NODE_CODE)
      if (index >= 0) zones.setAside.splice(index, 1)
    }
    setFlag(state, 'drownedQuarterBarrierNodeTaken', true)
    if (typeof api.giveAsset === 'function') return api.giveAsset(inv.seat, BARRIER_NODE_CODE)
    const card = ALL_CARDS[BARRIER_NODE_CODE] || {}
    const asset = {
      id: `drownedQuarter-barrierNode-${inv.seat}`, code: BARRIER_NODE_CODE,
      originalCode: BARRIER_NODE_CODE, name: card.nameZh || card.name || BARRIER_NODE_CODE,
      controllerSeat: inv.seat, ownerSeat: inv.seat, exhausted: false, damage: 0, horror: 0,
      tokens: 0, attachments: [],
    }
    inv.assets ||= []
    inv.assets.push(asset)
    return asset
  },
  drownedQuarterFlipObsidianRelic(state, payload = {}, api = {}) {
    const inv = (state.investigators || [])[payload.seat]
    const asset = (inv?.assets || []).find(item => codeOf(item) === OBSIDIAN_RELIC_CODE)
    return asset ? flipObsidianRelic(state, inv, asset, api) : false
  },
  drownedQuarterSpawnMedusa(state, payload = {}, api = {}) {
    return spawnEnemy(state, MEDUSA_CODE, payload.locationId || null, api)
  },
  drownedQuarterSeaFloorFlood(state, payload = {}, api = {}) {
    const target = payload.locationId
    if (!target || !canChangeFloodOf(state, target, 1)) return false
    return changeFloodOf(state, target, 1, api)
  },
}

// ---------------------------------------------------------------------------
// 只读投影（测试 / 主进程验收）
// ---------------------------------------------------------------------------
export function scenarioSummary(state) {
  return {
    headedWest: headedWest(state),
    act: currentActCode(state),
    agenda: currentAgendaCode(state),
    barrierCore: barrierCoreSummary(state),
    revealedLocations: revealedLocationCount(state),
    skull: skullValue(state),
    flood: Object.fromEntries((state.locations || []).map(location => [location.id, floodLevelOf(state, location.id)])),
    layout: layoutPlan(state),
    setAside: [...(state.scenarioZones?.setAside || [])],
    glyphs: [...(recordsFor(state).discoveredGlyphs || [])],
    nextScenarioId: nextScenarioFor(state),
  }
}

export function implementedEntryFlags(code) {
  return entryOf(code)?.flags || {}
}

export const behavior = {  id: CHAPTER_ID,
  startLocation: () => START_LOCATION,
  // 屏障核心在 locationPlaced 里显式正面入场；海床地点保持未揭示。
  locationsStartRevealed: false,
  // 幕 1 目标只在轮末（每位未击败调查员都在已激活的屏障核心）检查推进。
  roundEndActIndex: 0,
  introduction,
  preScenarioSetup,
  prepareScenario,
  setupScenario,
  setupLocations,
  locationPlaced,
  locationRevealed,
  afterDeckSetup,
  actions,
  performAction,
  turnBegins,
  phaseBegan,
  roundEnded,
  actReveal,
  agendaReveal,
  checkObjectives,
  allResigned,
  enemyAttackResolved,
  enemyDefeated,
  enemyStatModifier,
  resolveChaosToken,
  chaosTokenValue,
  applyTokenEffect,
  testAutoFail,
  resolution,
  events,
  scenarioSummary,
  // 具名助手（测试 / 主进程验收）
  planLayout,
  layoutPlan,
  writeGridCell,
  placeLocationAt,
  cellOf,
  floodLevelOf,
  canChangeFloodOf,
  changeFloodOf,
  adjacentFloodable,
  syncBarrierCore,
  flipBarrierCore,
  barrierCoreSummary,
  revealedUnfloodedSeaFloorCount,
  controlledBarrierNode,
  headedWest,
  introFor,
  translateGlyph,
  glyphsKnown,
  flipUnderseaParasite,
  flipObsidianRelic,
  barrierNodeInPlay,
  spawnEnemy,
  seafloorLeviathanHealth,
  resolutionChainForKey,
  nextScenarioFor,
  locationOf,
  isSeaFloorLocation,
}

export {
  ACT1_CODE, AGENDA1_CODE, AGENDA2_CODE, BARRIER_NODE_CODE, ENCOUNTER_DECK, ENCOUNTER_DECK_CODES,
  LOCATION_IDS, OBSIDIAN_RELIC_CODE, SEA_FLOOR_POOL_IDS, SET_ASIDE_CARDS, START_LOCATION,
  UNDESEA_PARASITE_CODE,
}
