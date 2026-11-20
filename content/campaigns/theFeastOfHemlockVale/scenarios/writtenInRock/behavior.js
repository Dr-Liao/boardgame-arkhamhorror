// 岩间密语（writtenInRock · 10501）· 引擎钩子（章节流程）。
//
// 参考：Scenario/Scenarios/TheFeastOfHemlockVale/WrittenInRock.hs +
//       Scenarios/TheFeastOfHemlockVale/WrittenInRock/Helpers.hs（空位/轨道/交换）+
//       Act|Agenda|Location|Enemy|Treachery/Cards/TheFeastOfHemlockVale/WrittenInRock/*.hs +
//       Asset/Assets/MineCartReliableButBroken.hs +
//       frontend/src/locales/en/theFeastOfHemlockVale/writtenInRock.json（权威印刷文本）。
//
// 引擎读点（全部走既有钩子/原语，不改引擎）：
//   preScenarioSetup / startLocation / setupLocations / locationPlaced / afterDeckSetup → 两段式布置
//   enemyPhaseEnd → 矿车强制移动（10507）；locationRevealed → 沉没隧道
//   actions / fastActions / performAction → 幕 1 勘察、幕 2 滑动/交换/取棱柱碎片、地点行动、敌人行动
//   roundEnded → 碱性轨道/轨道岔路/幕 1 目标；actReveal / agendaReveal / checkObjectives → 幕/议程
//   locationShroudModifier / enemyStatModifier / enemyConnections / moveError / beforeMove
//   enemySpawned / enemyAttackResolved / enemyDefeated → 深掘混种/发狂矿工/地下野兽
//   resolveChaosToken / applyTokenEffect → 10501/10502 混乱标记
//   resolution / scenarioResolution → 结局 1–5 + 结局 6 结算与剧本日志
//
// 坐标：内容层用「地理坐标」（north = y+1，和 Haskell GridUp 一致），引擎 rail-grid 的方向向量是
// 屏幕坐标（north = y-1），两者只差一次南北翻转：登记轨道时翻成引擎方位，读给玩家时翻回印刷方位。
//
// 近似（见 SIMPLIFIED 与各条目 note）：
//   · 困难/专家 [cultist]「检定成功才放碎片/道岔」在揭示时即结算（引擎没有成功回调）。
//   · 幕 2「每个敌人额外结算一次猎手」没有引擎读点：只授予 hunter。
//   · 矿车转向只在有多个可用出口时询问（由引擎 selectFacing 承接）。
//   · 10522 按指南放列 4 最下方（参考实现放列 5）；弃手替代窗口留给 P8。
//   · Standalone Mode 用 scenarioFlags.writtenInRockStandalone 显式开关（引擎没有独立模式状态）。
import { registeredEntry } from '../../../../../src/engine/ability.js'
import { addMarker, markerCountOf } from '../../../../../src/engine/marker-count.js'
import {
  connectGrid, configureGrid, gridPosition, relocateGridCells,
} from '../../../../../src/engine/grid-map.js'
import {
  advanceRailVehicle, configureRailGrid, convertRailMarkers, railNeighbors, steerRailVehicle,
} from '../../../../../src/engine/rail-grid.js'
// 只读载具登记走叶子模块（vehicle-state.js 不触达组合根）。写入口（登记/进入/移动）改走运行时
// 原语 `api.mechanics.vehicles.*`（口径同 content/campaigns/theInnsmouthConspiracy/middle-setup.js）：
// 本章若静态 import src/engine/vehicles.js，会形成
//   index.js → behavior.js → vehicles.js → card-lookup.js → content/registered.js
// 的求值环，而 card-lookup 在**模块体**里读 contentRegistry，组合根（registered.js）与本章
// 独立 import 都会因 contentRegistry/manifest 尚未初始化而 TDZ。
import { vehicleRecord } from '../../../../../src/engine/vehicle-state.js'
import { randomValue } from '../../../../../src/engine/rules-state.js'
import { mechanicState } from '../../../../../src/engine/mechanic-state.js'
import {
  ACT1_CODE, ACT2_CODE, AGENDA1_CODE, AGENDA2_CODE, ACT_CODES, AGENDA_CODES, ACT_STAGES, AGENDAS,
  ATWOOD_COLUMN, BURROWING_HYBRID_CODE, CAVE_IN_CODE, CAVE_LOCATION_IDS, CAVE_ROW,
  CAVE_STAGE_CONTROL_CELL, CAVES_IN_PLAY, CAVES_REMOVED, CONTROL_STATION_CELL, CONTROL_STATION_ID,
  FRENZIED_MINER_CODE, LOCATIONS, MINE_CART_CODE, PRISMATIC_SHARD_CODE,
  RAIL_EXIT_CELL, RAIL_EXIT_ID, RAIL_FIXED_SLOTS, RAIL_LOCATION_IDS, RAIL_OPEN_SLOTS, RAIL_PORTS,
  RESIDENT_ASSETS, SHARD_COLUMN, SLIDE_BOUNDS, SUBTERRANEAN_BEAST_CODE, WILD_RIDE_CODE,
  WRITTEN_IN_ROCK_ASIDE_CODES, dayGroupCards, encounterDeckForDay, writtenInRockAsideCards,
} from './definition.js'
import {
  columnOf, currentActStep, markerKindForAct, writtenInRockChaosToken, writtenInRockChaosTokenValue,
} from './chaos.js'

const CHAPTER_ID = 'writtenInRock'
const NO_RESOLUTION = 'noResolution'
const SCRAP = 'scrap'
const SWITCH = 'switch'

// 运行时载具入口（api.mechanics.vehicles；为何不用静态 import 见文件头 import 区注释）。
const vehicleOps = (api, operation) => {
  const ops = api?.mechanics?.vehicles
  if (typeof ops?.[operation] !== 'function') {
    throw new TypeError(`writtenInRock: 缺少引擎载具入口 api.mechanics.vehicles.${operation}`)
  }
  return ops
}

const activeInvestigators = state => (state.investigators || []).filter(inv => inv && !inv.defeated && !inv.resigned)
const investigatorCount = state => Number(state.numInvestigators) || (state.investigators || []).length || 1
const info = (api, text) => api?.info?.(text)
const safeCall = (api, name, ...args) => (typeof api?.[name] === 'function' ? api[name](...args) : null)
const hasTrait = (value, trait) => (value?.traits || [])
  .some(item => String(item).toLowerCase() === String(trait).toLowerCase())
const flagsFor = state => (state.scenarioFlags ||= {})
const recordsFor = state => {
  state.campaign ||= {}
  state.campaign.records ||= {}
  return state.campaign.records
}
const entryOf = code => (code ? registeredEntry(String(code)) : null)
const codeOf = value => String(value?.originalCode || value?.code || '')
const entryFlag = (value, key) => entryOf(codeOf(value))?.flags?.[key] === true
const locationOf = (state, id) => (state.locations || []).find(location => location.id === id) || null
const locationCode = location => String(location?.originalCode || location?.code || '')

const DIRECTION_LABELS = Object.freeze({ north: '北 ↑', east: '东 →', south: '南 ↓', west: '西 ←' })
const directionLabel = direction => DIRECTION_LABELS[direction] || direction
// 印刷方位 ↔ 引擎方位（见文件头）。
const ENGINE_FLIP = Object.freeze({ north: 'south', south: 'north', east: 'east', west: 'west' })
const toEngineDirection = direction => ENGINE_FLIP[direction] || null
const fromEngineDirection = direction => ENGINE_FLIP[direction] || null

function rng(state) {
  try {
    if (!Number.isFinite(state.rngState)) state.rngState = 0x9e3779b9
    const value = randomValue(state)
    return Number.isFinite(value) ? value : 0.5
  } catch {
    return 0.5
  }
}

function pickOne(state, list) {
  if (!Array.isArray(list) || !list.length) return null
  return list[Math.min(list.length - 1, Math.floor(rng(state) * list.length))]
}

function shuffleInPlace(state, list) {
  const array = [...list]
  for (let index = array.length - 1; index > 0; index--) {
    const pick = Math.floor(rng(state) * (index + 1))
    const swap = array[index]
    array[index] = array[pick]
    array[pick] = swap
  }
  return array
}

// ---------------------------------------------------------------------------
// 时间（战役日志）：日 1–3 + 白天/夜晚
// ---------------------------------------------------------------------------
export function campaignDay(state) {
  const override = Number(flagsFor(state).writtenInRockDay)
  if (Number.isInteger(override) && override >= 1 && override <= 3) return override
  const record = Number(state?.campaign?.records?.day)
  if (Number.isInteger(record) && record >= 1 && record <= 3) return record
  return 1
}

export function campaignTime(state) {
  const flags = flagsFor(state)
  if (flags.writtenInRockTime === 'day' || flags.writtenInRockTime === 'night') return flags.writtenInRockTime
  if (typeof flags.writtenInRockNight === 'boolean') return flags.writtenInRockNight ? 'night' : 'day'
  const records = state?.campaign?.records || {}
  if (records.time === 'day' || records.time === 'night') return records.time
  if (records.timeOfDay === 'day' || records.timeOfDay === 'night') return records.timeOfDay
  if (records.night === true) return 'night'
  return 'day'
}

export const isNight = state => campaignTime(state) === 'night'

export function introBranch(state) {
  return isNight(state) ? 'night' : `day${campaignDay(state)}`
}

// ---------------------------------------------------------------------------
// 洞穴选择 / 初始摆位（幕 1）
// ---------------------------------------------------------------------------
export function caveOrder(state) {
  const flags = flagsFor(state)
  const explicit = Array.isArray(flags.writtenInRockCaveIds) ? flags.writtenInRockCaveIds : null
  if (explicit && explicit.length === CAVES_IN_PLAY && explicit.every(id => CAVE_LOCATION_IDS.includes(id))) {
    return [...explicit]
  }
  const order = shuffleInPlace(state, CAVE_LOCATION_IDS).slice(0, CAVES_IN_PLAY)
  flags.writtenInRockCaveIds = [...order]
  return [...order]
}

export function caveRemovedIds(state) {
  const placed = new Set(caveOrder(state))
  return CAVE_LOCATION_IDS.filter(id => !placed.has(id)).slice(0, CAVES_REMOVED)
}

/** 引擎在布置地点之前询问起始地点：最左侧（列 1）的洞穴。 */
export function startLocation(state) {
  return caveOrder(state)[0] || 'dryBurrow1'
}

export function placementFor(state, id) {
  const map = flagsFor(state).writtenInRockPlacement || {}
  return map[id] || null
}

// ---------------------------------------------------------------------------
// 准备（幕/议程牌库、放一边区域、当日组）
// ---------------------------------------------------------------------------
export function prepareScenario(state, api = {}) {
  state.scenarioFlags ||= {}
  state.scenarioZones ||= {}
  const flags = flagsFor(state)
  const day = campaignDay(state)
  const time = campaignTime(state)
  const standalone = flags.writtenInRockStandalone === true
  flags.writtenInRockDay = day
  flags.writtenInRockTime = time
  flags.writtenInRockIntro = introBranch(state)
  flags.writtenInRockStandalone = standalone

  const agendaSource = state.scenario?.agendas || AGENDAS
  const agendaCodes = standalone ? [AGENDA2_CODE] : [...AGENDA_CODES]
  const currentAgendas = Array.isArray(state.agendas) ? state.agendas : []
  if (standalone || currentAgendas.length !== agendaCodes.length) {
    state.agendas = agendaCodes
      .map(code => agendaSource.find(agenda => codeOf(agenda) === code))
      .filter(Boolean).map(agenda => structuredClone(agenda))
  }
  const actSource = state.scenario?.acts || ACT_STAGES
  const actCodes = standalone ? [ACT2_CODE] : [...ACT_CODES]
  const currentActs = Array.isArray(state.acts) ? state.acts : []
  if (standalone || currentActs.length !== actCodes.length) {
    state.acts = actCodes
      .map(code => (Array.isArray(actSource)
        ? actSource.find(act => codeOf(act) === code)
        : actSource[code === ACT1_CODE ? 1 : 2]))
      .filter(Boolean).map(act => structuredClone(act))
  }
  state.agendaIndex = 0
  state.actIndex = 0

  const caveIds = caveOrder(state)
  const placement = {}
  caveIds.forEach((id, index) => { placement[id] = { x: index + 1, y: CAVE_ROW } })
  placement[CONTROL_STATION_ID] = { ...CAVE_STAGE_CONTROL_CELL }
  flags.writtenInRockPlacement = placement
  flags.writtenInRockCaveInDone = false
  flags.writtenInRockRailPlan = null

  state.scenarioZones.setAside = [...(state.scenario?.setAsideAliases || [])]
  state.scenarioZones.setAsideLocations = [...RAIL_LOCATION_IDS.filter(id => id !== CONTROL_STATION_ID)]
  state.scenarioZones.removedLocations = [...caveRemovedIds(state)]
  state.scenarioZones.setAsideResidents = []
  // 白天：地下野兽移出游戏（Setup「If it is (Day), remove the Subterranean Beast enemy from the game」）。
  state.scenarioZones.removedEnemies = []
  if (!isNight(state)) {
    state.scenarioZones.setAside = state.scenarioZones.setAside.filter(code => code !== SUBTERRANEAN_BEAST_CODE)
    state.scenarioZones.removedEnemies = [SUBTERRANEAN_BEAST_CODE]
  }
  flags.writtenInRockPrepared = true
  return {
    day, time, standalone, caveIds,
    actCodes: [...actCodes], agendaCodes: [...agendaCodes],
    intro: flags.writtenInRockIntro,
  }
}

/** 引擎真实入口：setup.js#setupLocations。返回要入场的地点 id（顺序即列顺序）。 */
export function setupLocations(state, events, helper = {}) {
  const api = helper.api || { info: text => helper.info?.(state, events, text) }
  const report = prepareScenario(state, api)
  if (report.standalone) info(api, 'Standalone Mode：只用幕 2/议程 2，轨道出口从游戏中移除。')
  return [...report.caveIds, CONTROL_STATION_ID]
}

/** 引擎真实入口：地点入场。写入网格坐标 + 每张入场地点 1 个碎片（资源）。 */
export function locationPlaced(state, location, api = {}) {
  const id = location?.id
  if (!id) return
  const point = placementFor(state, id)
  if (!point) return
  const data = mechanicState(state, true)
  data.grid ||= {}
  if (!data.grid[id]) {
    const occupied = Object.values(data.grid).some(cell => !cell.isolated && cell.x === point.x && cell.y === point.y)
    if (occupied) return
    data.grid[id] = { x: point.x, y: point.y, isolated: false, connections: [] }
    location.grid = { x: point.x, y: point.y }
  }
  // 幕 1 布置：每张入场地点放 1 个资源，作为「碎片」。
  if (!flagsFor(state).writtenInRockCaveInDone && !(Number(location.resources) > 0)) {
    location.resources = 1
  }
  syncConnections(state)
  void api
}

/** 直接调用入口（测试/单章跑）：准备 + 洞穴/控制站入场 + 居民 + 遭遇牌库。 */
export function setupScenario(state, api = {}) {
  const report = prepareScenario(state, api)
  state.locations = []
  for (const id of [...report.caveIds, CONTROL_STATION_ID]) {
    const location = placeLocationLocal(state, id, api)
    if (location) locationPlaced(state, location, api)
  }
  state.investigators ||= []
  for (const inv of state.investigators) {
    if (!inv.location) inv.location = startLocation(state)
  }
  if (!state.encounterDeck?.length) state.encounterDeck = [...encounterDeckForDay(report.day)]
  if (!state.encounterDiscard) state.encounterDiscard = []
  applyResidents(state, api)
  flagsFor(state).writtenInRockResidentsApplied = true
  syncConnections(state)
  info(api, `岩间密语（第 ${report.day} 日 · ${report.time === 'night' ? '夜晚' : '白天'}）：${report.caveIds.length} 张洞穴 + 控制站入场，每处 1 个碎片。`)
  return { ...report, placedIds: [...report.caveIds, CONTROL_STATION_ID] }
}

/** 引擎真实入口：遭遇牌库建立之后（当日组并入 + 放一边清单）。 */
export function afterDeckSetup(state, events, helper = {}) {
  const api = helper.api || { info: text => helper.info?.(state, events, text) }
  const flags = flagsFor(state)
  if (!flags.writtenInRockPrepared) prepareScenario(state, api)
  const day = campaignDay(state)
  const dayCards = dayGroupCards(day)
  state.encounterDeck ||= []
  if (dayCards.length && flags.writtenInRockDayDeckApplied !== day) {
    if (typeof api.shuffleIntoEncounterDeck === 'function') api.shuffleIntoEncounterDeck(dayCards)
    else state.encounterDeck.push(...dayCards)
    flags.writtenInRockDayDeckApplied = day
    info(api, `第 ${day} 日遭遇组：${dayCards.length} 张洗入遭遇牌库。`)
  }
  state.scenarioZones ||= {}
  state.scenarioZones.setAside = [...(state.scenario?.setAsideAliases || [])]
  state.scenarioZones.setAsideLocations = [...RAIL_LOCATION_IDS.filter(id => id !== CONTROL_STATION_ID)]
  if (!flags.writtenInRockResidentsApplied) {
    applyResidents(state, api)
    flags.writtenInRockResidentsApplied = true
  }
}

// ---------------------------------------------------------------------------
// 地点实例 / 连通
// ---------------------------------------------------------------------------
function cluesFor(state, def) {
  if (def.cluesFixed != null) return Number(def.cluesFixed) || 0
  return Math.max(0, Number(def.cluesPerInvestigator) || 0) * investigatorCount(state)
}

export function placeLocationLocal(state, id, api = {}) {
  const existing = locationOf(state, id)
  if (existing) return existing
  const def = state.scenario?.locations?.[id] || LOCATIONS[id]
  if (!def) return null
  // 真实引擎路径：走 api.placeLocation（入场日志/符号/线索由引擎统一处理）。
  if (typeof api.placeLocation === 'function') {
    api.placeLocation(id)
    const placed = locationOf(state, id)
    if (placed) return placed
  }
  const revealed = def.revealed === true
  const location = {
    ...structuredClone(def), id, revealed,
    clues: revealed ? cluesFor(state, def) : 0,
    maxClues: cluesFor(state, def),
    doom: 0, resources: 0, damage: 0, horror: 0, attachments: [], beneath: [],
  }
  state.locations ||= []
  state.locations.push(location)
  const point = placementFor(state, id)
  if (point) {
    const data = mechanicState(state, true)
    data.grid ||= {}
    if (!data.grid[id]) {
      data.grid[id] = { x: point.x, y: point.y, isolated: false, connections: [] }
      location.grid = { x: point.x, y: point.y }
    }
  }
  return location
}

export function revealRailLocation(state, id, api = {}) {
  const location = locationOf(state, id)
  if (!location || location.revealed) return false
  location.revealed = true
  const def = state.scenario?.locations?.[id] || LOCATIONS[id]
  const clues = cluesFor(state, def)
  if (!(Number(location.clues) > 0)) {
    location.clues = clues
    location.maxClues = Math.max(Number(location.maxClues) || 0, clues)
  }
  info(api, `「${location.name}」揭示${clues ? `，放置 ${clues} 条线索` : ''}。`)
  behavior.locationRevealed?.(state, location, api)
  return true
}

export function railMode(state) {
  return Boolean(mechanicState(state)?.rail)
}

/** 连接：幕 1 正交相邻；幕 2 只连「轨道图标对齐」的相邻地点。 */
export function syncConnections(state) {
  if (!mechanicState(state)?.grid) return false
  if (railMode(state)) {
    connectGrid(state)
    return true
  }
  configureGrid(state, { adjacency: 'orthogonal' })
  return true
}

export function adjacentGridLocations(state, id) {
  const from = gridPosition(state, id)
  if (!from || from.isolated) return []
  const cells = mechanicState(state)?.grid || {}
  return [[0, -1], [-1, 0], [1, 0], [0, 1]].flatMap(([dx, dy]) => {
    const point = { x: from.x + dx, y: from.y + dy }
    const hit = Object.entries(cells).find(([, cell]) => !cell.isolated && cell.x === point.x && cell.y === point.y)
    return hit ? [hit[0]] : []
  })
}

export function emptyAdjacentSpaces(state, id) {
  const from = gridPosition(state, id)
  if (!from || from.isolated) return []
  const cells = mechanicState(state)?.grid || {}
  return [[0, -1], [-1, 0], [1, 0], [0, 1]]
    .map(([dx, dy]) => ({ x: from.x + dx, y: from.y + dy }))
    .filter(point => point.x >= SLIDE_BOUNDS.minX && point.x <= SLIDE_BOUNDS.maxX
      && point.y >= SLIDE_BOUNDS.minY && point.y <= SLIDE_BOUNDS.maxY)
    .filter(point => !Object.values(cells).some(cell => !cell.isolated && cell.x === point.x && cell.y === point.y))
}

const storyAssetAt = (state, id) => (state.storyAssets || []).some(asset => asset.location === id)

export function canBeSlidOrSwapped(state, id) {
  const location = locationOf(state, id)
  if (!location) return false
  if (location.cannotBeSlidOrSwapped === true || id === RAIL_EXIT_ID) return false
  // 议程 2：带剧情资产的地点不能被滑动/交换。
  if (currentAgendaCode(state) === AGENDA2_CODE && storyAssetAt(state, id)) return false
  return Boolean(gridPosition(state, id))
}

export function slideLocation(state, id, x, y, api = {}) {
  if (!canBeSlidOrSwapped(state, id)) return false
  const spaces = emptyAdjacentSpaces(state, id)
  if (!spaces.some(space => space.x === x && space.y === y)) return false
  const moved = relocateGridCells(state, [{ id, x, y }], { protectStoryAssets: true })
  if (!moved) return false
  info(api, `「${locationOf(state, id)?.name || id}」滑动到 (${x}, ${y})。`)
  return true
}

export function swapAdjacentLocations(state, a, b, api = {}) {
  if (!canBeSlidOrSwapped(state, a) || !canBeSlidOrSwapped(state, b)) return false
  if (!adjacentGridLocations(state, a).includes(b)) return false
  const from = gridPosition(state, a)
  const to = gridPosition(state, b)
  if (!from || !to) return false
  const moved = relocateGridCells(state, [
    { id: a, x: to.x, y: to.y }, { id: b, x: from.x, y: from.y },
  ], { protectStoryAssets: true })
  if (!moved) return false
  info(api, `交换「${locationOf(state, a)?.name || a}」与「${locationOf(state, b)?.name || b}」。`)
  return true
}

// ---------------------------------------------------------------------------
// 矿车（10507）
// ---------------------------------------------------------------------------
export function mineCartAsset(state) {
  return (state.storyAssets || []).find(asset => entryFlag(asset, 'mineCart')
    || codeOf(asset) === MINE_CART_CODE) || null
}

export function mineCartId(state) {
  return mineCartAsset(state)?.id || null
}

export function mineCartVehicle(state) {
  const id = mineCartId(state)
  return id ? vehicleRecord(state, id) : null
}

export function mineCartRail(state) {
  const rail = mechanicState(state)?.rail
  return rail && rail.vehicle === mineCartId(state) ? rail : null
}

export function mineCartLocation(state) {
  return mineCartVehicle(state)?.location || null
}

export function mineCartFacing(state) {
  return fromEngineDirection(mineCartRail(state)?.facing) || null
}

function ensureStoryAsset(state, code, locationId, api = {}) {
  let asset = (state.storyAssets || []).find(item => codeOf(item) === code)
  if (asset) return asset
  if (typeof api.storyAsset === 'function') {
    asset = api.storyAsset(code, locationId)
    if (asset) {
      state.storyAssets ||= []
      if (!state.storyAssets.includes(asset)) state.storyAssets.push(asset)
      return asset
    }
  }
  const printed = state.scenario?.storyAssets?.[code] || {}
  asset = {
    id: `${CHAPTER_ID}-${code}`, code, originalCode: code,
    name: printed.name || code, global: true, location: locationId,
    controllerSeat: null, exhausted: false, tokens: 0, attachments: [], damage: 0, horror: 0,
  }
  state.storyAssets ||= []
  state.storyAssets.push(asset)
  return asset
}

/** 建立矿车（剧情资产 + 载具登记 + 全员上车）。 */
export function ensureMineCart(state, api = {}) {
  const location = mineCartLocation(state) || CONTROL_STATION_ID
  const asset = ensureStoryAsset(state, MINE_CART_CODE, location, api)
  const data = mechanicState(state, true)
  data.vehicles ||= {}
  if (!data.vehicles[asset.id]) {
    vehicleOps(api, 'register').register(asset.id, {
      location, capacity: Math.max(1, investigatorCount(state)), running: true, driverRequired: false,
    })
  }
  for (const inv of state.investigators || []) {
    if (inv.defeated || inv.resigned) continue
    if (typeof api.moveInvestigator === 'function') api.moveInvestigator(inv.seat, location)
    inv.location = location
    if (!(vehicleRecord(state, asset.id)?.passengers || []).includes(inv.seat)) {
      vehicleOps(api, 'enter').enter(inv.seat, asset.id, { setup: true })
    }
  }
  info(api, `矿车放置在「${locationOf(state, location)?.name || location}」，调查员全部上车。`)
  return asset
}

export function steerMineCart(state, direction) {
  const rail = mineCartRail(state)
  if (!rail) return false
  const engine = toEngineDirection(direction)
  return engine ? steerRailVehicle(state, engine) : false
}

function mineCartChoiceSeat(state) {
  const active = activeInvestigators(state)
  return active.find(inv => inv.seat === state.campaign?.leadSeat)?.seat ?? active[0]?.seat
}

export function chooseCartFacing(state, api = {}, options = ['north', 'east']) {
  const ports = RAIL_PORTS[CONTROL_STATION_ID] || []
  const allowed = options.filter(direction => ports.includes(direction))
  const seat = mineCartChoiceSeat(state)
  const pick = seat != null && typeof api?.choose === 'function'
    ? api.choose({
      kind: 'mineCartFacing', source: MINE_CART_CODE, seat,
      prompt: '选择矿车朝向',
      options: allowed.map(direction => ({ id: direction, label: directionLabel(direction) })),
    })
    : null
  return allowed.includes(pick) ? pick : allowed[0]
}

/** 配置轨道网格（幕间「塌方」第 4 步）：ports 只登记在场地点（引擎方位）。 */
export function configureRail(state, facing, api = {}) {
  const asset = mineCartAsset(state)
  if (!asset) return false
  const ports = {}
  for (const location of state.locations || []) {
    if (!Object.hasOwn(RAIL_PORTS, location.id)) continue
    ports[location.id] = RAIL_PORTS[location.id].map(toEngineDirection).filter(Boolean)
  }
  const engineFacing = toEngineDirection(facing)
  const vehicle = vehicleRecord(state, asset.id)
  if (!vehicle || !engineFacing) return false
  if (!ports[vehicle.location]?.includes(engineFacing)) return false
  configureRailGrid(state, asset.id, engineFacing, ports, configure => configureGrid(state, configure))
  info(api, `轨道网格建立：矿车朝向${directionLabel(facing)}，轨道连接改为「对齐图标」。`)
  return true
}

/** 矿车可移动方向（当前朝向且对齐的相邻地点；方位按印刷图给）。 */
export function cartExits(state) {
  const rail = mineCartRail(state)
  const cells = mechanicState(state)?.grid || {}
  if (!rail) return []
  return railNeighbors(rail, cells, mineCartLocation(state))
    .filter(entry => entry.direction === rail.facing)
    .map(entry => ({ direction: fromEngineDirection(entry.direction), id: entry.id }))
}

export function mineCartBlocked(state) {
  const beast = (state.enemies || []).find(enemy => entryFlag(enemy, 'blocksMineCartWhenReady')
    || codeOf(enemy) === SUBTERRANEAN_BEAST_CODE)
  if (!beast || beast.exhausted) return false
  return beast.location === mineCartLocation(state)
}

function defeatAllInvestigators(state, api = {}) {
  for (const inv of activeInvestigators(state)) {
    if (typeof api.defeatInvestigator === 'function') api.defeatInvestigator(inv.seat)
    else inv.defeated = true
    safeCall(api, 'addTrauma', inv.seat, 'physical', 1)
  }
  info(api, '矿车脱轨：每位调查员被击败并承受 1 点肉体创伤。')
}

function wildRides(state) {
  const rides = []
  for (const inv of state.investigators || []) {
    for (const card of inv.threat || []) {
      if (entryFlag(card, 'cartMoveChoice') || codeOf(card) === WILD_RIDE_CODE) rides.push({ inv, card })
    }
  }
  return rides
}

function discardThreatCard(inv, card, api = {}) {
  const index = (inv.threat || []).indexOf(card)
  if (index >= 0) inv.threat.splice(index, 1)
  ;(inv.discard ||= []).push(card.code || card.originalCode)
  safeCall(api, 'discardThreat', card)
}

function resolveWildRides(state, api = {}) {
  const rides = wildRides(state)
  if (!rides.length) return 0
  let resolved = 0
  for (const { inv, card } of rides) {
    const choice = typeof api?.choose === 'function'
      ? api.choose({
        kind: 'treachery', source: WILD_RIDE_CODE, seat: inv.seat,
        prompt: '急速狂飙：选择一项。',
        options: [
          { id: 'move', label: '矿车再移动 2 次' },
          { id: 'harm', label: '承受 1 点直接伤害与 1 点直接恐惧（每个调查员/盟友/居民）' },
        ],
      })
      : 'move'
    discardThreatCard(inv, card, api)
    if (choice === 'move') {
      for (let index = 0; index < 2; index++) {
        moveMineCartOnce(state, api, { depth: 1, skipWildRide: true })
      }
    } else {
      for (const target of activeInvestigators(state)) {
        safeCall(api, 'directDamage', target.seat, 1)
        safeCall(api, 'directHorror', target.seat, 1)
        if (!api?.directDamage) target.damage = (Number(target.damage) || 0) + 1
        if (!api?.directHorror) target.horror = (Number(target.horror) || 0) + 1
        for (const asset of target.assets || []) {
          if (!hasTrait(asset, 'Ally') && !hasTrait(asset, 'Resident')) continue
          asset.damage = (Number(asset.damage) || 0) + 1
          asset.horror = (Number(asset.horror) || 0) + 1
        }
      }
      info(api, '急速狂飙：全员与盟友/居民各承受 1 点直接伤害与 1 点直接恐惧。')
    }
    resolved += 1
  }
  return resolved
}

function locationHasCaveIn(state, id) {
  const location = locationOf(state, id)
  return (location?.attachments || []).some(card => entryFlag(card, 'cancelCartMoveDamage')
    || codeOf(card) === CAVE_IN_CODE)
}

function residentAssetsAt(state, id) {
  return (state.storyAssets || []).filter(asset => asset.location === id
    && (hasTrait(asset, 'Resident') || hasTrait(asset, 'Ally')))
}

function dealDirectToResidents(state, id, kind, amount, api = {}) {
  for (const asset of residentAssetsAt(state, id)) {
    const key = kind === 'horror' ? 'horror' : 'damage'
    asset[key] = (Number(asset[key]) || 0) + amount
    safeCall(api, key === 'horror' ? 'assetHorror' : 'assetDamage', asset, amount)
  }
}

function landOnRailExit(state, api = {}) {
  if (codeOf(state.acts?.[state.actIndex ?? 0]) !== ACT2_CODE) return false
  info(api, '矿车进入轨道出口：幕 2 目标达成。')
  if (typeof api.advanceAct === 'function') api.advanceAct()
  return true
}

/**
 * 移动矿车一次。返回 {moved, location, facing} / {derailed} / {cancelled} / {blocked}。
 * depth 用于「扭曲隧道/急速狂飙」的追加移动，避免无限递归。
 */
export function moveMineCartOnce(state, api = {}, { depth = 0, skipWildRide = false } = {}) {
  const rail = mineCartRail(state)
  if (!rail) return { blocked: true, reason: 'noRail' }
  if (rail.derailed) return { blocked: true, reason: 'derailed' }
  if (mineCartBlocked(state)) {
    info(api, '地下野兽准备中且与矿车同处：矿车不能移动。')
    return { blocked: true, reason: 'beast' }
  }
  const vehicle = mineCartVehicle(state)
  if (!vehicle) return { blocked: true, reason: 'noVehicle' }
  const cells = mechanicState(state)?.grid || {}
  const neighbor = railNeighbors(rail, cells, vehicle.location).find(entry => entry.direction === rail.facing)
  if (!neighbor) {
    mechanicState(state).rail.derailed = true
    defeatAllInvestigators(state, api)
    return { derailed: true }
  }
  if (locationHasCaveIn(state, neighbor.id)) {
    for (const inv of activeInvestigators(state)) {
      if (typeof api.damage === 'function') api.damage(inv.seat, 2)
      else inv.damage = (Number(inv.damage) || 0) + 2
    }
    dealDirectToResidents(state, mineCartLocation(state), 'damage', 2, api)
    info(api, `「${locationOf(state, neighbor.id)?.name || neighbor.id}」上的塌方取消了矿车移动：车内全员承受 2 点伤害。`)
    return { cancelled: true, location: neighbor.id }
  }
  const vehicles = vehicleOps(api, 'move')
  const result = advanceRailVehicle(state, {
    // 载具移动走运行时原语：引擎侧统一提供「移动全部乘客 / 载具离开与进入时点」的 deps，
    // 并在移动校验里跳过「在载具中不能独立移动」（movementError 的 vehicle 口径）。
    move: (vehicleId, destination) => vehicles.move(vehicleId, destination),
    connect: () => connectGrid(state),
  }, directions => {
    const printed = directions.map(fromEngineDirection).filter(Boolean)
    const seat = mineCartChoiceSeat(state)
    if (seat != null && typeof api?.choose === 'function') {
      const picked = api.choose({
        kind: 'mineCartFacing', source: MINE_CART_CODE, seat,
        prompt: '矿车进入新地点：选择朝向',
        options: printed.map(direction => ({ id: direction, label: directionLabel(direction) })),
      })
      return toEngineDirection(picked) || directions[0]
    }
    return directions[0]
  })
  if (!result) return { blocked: true }
  if (result.derailed) {
    defeatAllInvestigators(state, api)
    return { derailed: true }
  }
  const destination = result.location
  info(api, `矿车移动到「${locationOf(state, destination)?.name || destination}」。`)
  if (destination && !locationOf(state, destination)?.revealed) revealRailLocation(state, destination, api)
  // 扭曲隧道：进入后矿车再移动一次。
  if ((entryFlag(locationOf(state, destination), 'forcedMoveOnCartEnter')
    || locationCode(locationOf(state, destination)) === '10513') && depth < 2) {
    info(api, '扭曲隧道：矿车进入后再移动一次。')
    moveMineCartOnce(state, api, { depth: depth + 1, skipWildRide })
  }
  if (!skipWildRide && depth < 2) resolveWildRides(state, api)
  if (locationOf(state, destination)?.id === RAIL_EXIT_ID) landOnRailExit(state, api)
  return { moved: true, location: destination, facing: fromEngineDirection(result.facing) }
}

/** 带「花费 1 个道岔：取消/再移动一次」反应的移动（团队每阶段最多 2 次）。 */
export function moveMineCart(state, api = {}, { times = 1 } = {}) {
  const results = []
  for (let index = 0; index < times; index++) {
    const flags = flagsFor(state)
    const phaseKey = `${Number(state.round) || 1}:${String(state.phase || 'enemy')}`
    if (flags.writtenInRockCartSwitchPhase !== phaseKey) {
      flags.writtenInRockCartSwitchPhase = phaseKey
      flags.writtenInRockCartSwitches = 0
    }
    const switches = markerCountOf(state, SWITCH)
    let choice = null
    const seat = mineCartChoiceSeat(state)
    if (seat != null && switches > 0 && Number(flags.writtenInRockCartSwitches) < 2 && typeof api?.choose === 'function') {
      choice = api.choose({
        kind: 'mineCart', source: MINE_CART_CODE, seat,
        prompt: '矿车移动：可以花费 1 个道岔取消，或再移动一次。',
        options: [
          { id: 'none', label: '不花费道岔' },
          { id: 'cancel', label: '花费 1 个道岔：取消这次移动' },
          { id: 'again', label: '花费 1 个道岔：再移动一次' },
        ],
      })
    }
    if (choice === 'cancel') {
      addMarker(state, SWITCH, -1)
      flags.writtenInRockCartSwitches += 1
      info(api, '花费 1 个道岔：取消矿车移动。')
      results.push({ cancelled: true })
      continue
    }
    if (choice === 'again') {
      addMarker(state, SWITCH, -1)
      flags.writtenInRockCartSwitches += 1
      info(api, '花费 1 个道岔：矿车额外移动一次。')
      results.push(moveMineCartOnce(state, api))
      results.push(moveMineCartOnce(state, api))
      continue
    }
    results.push(moveMineCartOnce(state, api))
  }
  return results
}

/** 引擎真实入口：敌人阶段结束 → 矿车强制移动一次。 */
export function enemyPhaseEnd(state, api = {}) {
  if (!mineCartRail(state)) return false
  moveMineCart(state, api, { times: 1 })
  return true
}

/** 单独结算一次「反应：花费 1 个道岔」的额外移动（触发移动已在别处结算）。 */
export function spendSwitchOnCart(state, mode, api = {}) {
  if (markerCountOf(state, SWITCH) <= 0) return false
  const flags = flagsFor(state)
  const phaseKey = `${Number(state.round) || 1}:${String(state.phase || 'enemy')}`
  if (flags.writtenInRockCartSwitchPhase !== phaseKey) {
    flags.writtenInRockCartSwitchPhase = phaseKey
    flags.writtenInRockCartSwitches = 0
  }
  if (Number(flags.writtenInRockCartSwitches) >= 2) return false
  if (mode === 'again') {
    addMarker(state, SWITCH, -1)
    flags.writtenInRockCartSwitches += 1
    return moveMineCartOnce(state, api)
  }
  if (mode === 'cancel') {
    addMarker(state, SWITCH, -1)
    flags.writtenInRockCartSwitches += 1
    return true
  }
  return false
}

// ---------------------------------------------------------------------------
// 幕间：塌方（The Cave-In）
// ---------------------------------------------------------------------------
const slotKey = point => `${point.x},${point.y}`

export function railPlan(state) {
  const flags = flagsFor(state)
  const existing = flags.writtenInRockRailPlan
  // 7 个固定位 + 7 个 "?" 位 = 14 张轨道隧道（轨道出口单独在 (5,5)）。
  const expected = RAIL_LOCATION_IDS.length - 2
  if (existing && Array.isArray(existing.slots) && existing.slots.length === expected) return existing
  const used = new Set()
  const slots = []
  for (const slot of RAIL_FIXED_SLOTS) {
    const candidates = slot.candidates.filter(id => !used.has(id))
    const pick = pickOne(state, candidates) || candidates[0]
    if (!pick) continue
    used.add(pick)
    slots.push({ x: slot.x, y: slot.y, id: pick })
  }
  const remaining = shuffleInPlace(state, RAIL_LOCATION_IDS.filter(id => id !== CONTROL_STATION_ID && !used.has(id)))
  RAIL_OPEN_SLOTS.forEach((slot, index) => {
    const id = remaining[index]
    if (id) slots.push({ x: slot.x, y: slot.y, id })
  })
  const plan = { slots }
  flags.writtenInRockRailPlan = plan
  return plan
}

function moveGridPoint(state, id, point) {
  const data = mechanicState(state, true)
  data.grid ||= {}
  const current = data.grid[id] || { x: point.x, y: point.y, isolated: false, connections: [] }
  current.x = point.x
  current.y = point.y
  current.isolated = false
  data.grid[id] = current
  const location = locationOf(state, id)
  if (location) location.grid = { x: point.x, y: point.y }
}

export function placeRailLayout(state, api = {}) {
  const plan = railPlan(state)
  const placement = flagsFor(state).writtenInRockPlacement ||= {}
  placement[CONTROL_STATION_ID] = { ...CONTROL_STATION_CELL }
  placement[RAIL_EXIT_ID] = { ...RAIL_EXIT_CELL }
  for (const slot of plan.slots) placement[slot.id] = { x: slot.x, y: slot.y }
  for (const id of [CONTROL_STATION_ID, RAIL_EXIT_ID, ...plan.slots.map(slot => slot.id)]) {
    const existed = Boolean(locationOf(state, id))
    const location = placeLocationLocal(state, id, api)
    if (!location) continue
    if (id === CONTROL_STATION_ID || id === RAIL_EXIT_ID) {
      location.revealed = true
    } else if (!existed) {
      // 轨道隧道入场时未揭示（背面「Rail Tunnel」）；线索在揭示时才放。
      location.revealed = false
      location.clues = 0
    }
    if (id === CONTROL_STATION_ID) location.resources = 1
  }
  for (const id of RAIL_LOCATION_IDS) {
    const point = placement[id]
    if (!point || !locationOf(state, id)) continue
    moveGridPoint(state, id, point)
  }
  state.scenarioZones ||= {}
  state.scenarioZones.setAsideLocations = []
  return { placed: RAIL_LOCATION_IDS.filter(id => locationOf(state, id)), plan }
}

function atwoodResidentCodes(state) {
  const zones = state.scenarioZones ||= {}
  const aside = new Set(zones.setAsideResidents || [])
  const result = []
  for (const code of [RESIDENT_ASSETS.simeon, RESIDENT_ASSETS.leah]) {
    const asset = (state.storyAssets || []).find(item => codeOf(item) === code)
    if (aside.has(code) || (asset && asset.controllerSeat == null)) result.push(code)
  }
  return result
}

export function topmostInColumn(state, column) {
  const cells = mechanicState(state)?.grid || {}
  return state.locations
    .filter(location => cells[location.id] && !cells[location.id].isolated && cells[location.id].x === column)
    .sort((a, b) => cells[b.id].y - cells[a.id].y)[0] || null
}

export function bottommostInColumn(state, column) {
  const cells = mechanicState(state)?.grid || {}
  return state.locations
    .filter(location => cells[location.id] && !cells[location.id].isolated && cells[location.id].x === column)
    .sort((a, b) => cells[a.id].y - cells[b.id].y)[0] || null
}

/** 幕间「塌方」：幕 1 背面之后立即结算（把地图换成轨道段）。 */
export function theCaveIn(state, api = {}) {
  const flags = flagsFor(state)
  if (flags.writtenInRockCaveInDone) {
    return { title: 'theCaveIn', branch: isNight(state) ? 'theCaveIn3' : 'theCaveIn2', replay: true }
  }
  flags.writtenInRockCaveInDone = true
  const time = campaignTime(state)
  applyAgenda2FrontRules(state)
  const report = placeRailLayout(state, api)
  addMarker(state, SWITCH, 1)
  ensureMineCart(state, api)
  const facing = chooseCartFacing(state, api)
  configureRail(state, facing, api)
  // 席米恩/莉亚（放一边）→ 列 2 最上方的地点。
  const topColumn2 = topmostInColumn(state, ATWOOD_COLUMN)
  for (const code of atwoodResidentCodes(state)) {
    const assetAt = (state.storyAssets || []).find(item => codeOf(item) === code)
    if (assetAt) {
      assetAt.location = topColumn2?.id || null
    } else if (api.storyAsset) {
      api.storyAsset(code, topColumn2?.id || null)
    } else {
      state.storyAssets ||= []
      state.storyAssets.push({ id: `${CHAPTER_ID}-resident-${code}`, code, originalCode: code, location: topColumn2?.id || null })
    }
    state.scenarioZones ||= {}
    state.scenarioZones.setAsideResidents = (state.scenarioZones.setAsideResidents || []).filter(item => item !== code)
  }
  // 棱柱碎片 → 列 4 最下方。
  const bottomColumn4 = bottommostInColumn(state, SHARD_COLUMN)
  const shard = ensureStoryAsset(state, PRISMATIC_SHARD_CODE, bottomColumn4?.id || null, api)
  if (bottomColumn4) shard.location = bottomColumn4.id
  // 夜晚：放一边的地下野兽在控制站生成，横置。
  if (time === 'night') {
    const beast = (state.enemies || []).find(enemy => codeOf(enemy) === SUBTERRANEAN_BEAST_CODE)
    if (!beast) {
      const spawned = spawnEnemyLocal(state, SUBTERRANEAN_BEAST_CODE, CONTROL_STATION_ID, api)
      if (spawned) spawned.exhausted = true
    } else {
      beast.location = CONTROL_STATION_ID
      beast.exhausted = true
    }
  }
  mergeWrittenInRockIntoDeck(state, api)
  syncConnections(state)
  info(api, `幕间「塌方」：${report.placed.length} 张轨道地点入场，矿车在控制站，${time === 'night' ? '地下野兽在控制站横置' : '白天无地下野兽'}。`)
  return {
    title: 'theCaveIn',
    branch: time === 'night' ? 'theCaveIn3' : 'theCaveIn2',
    placed: report.placed,
    facing,
    shardAt: bottomColumn4?.id || null,
    atwoodsAt: topColumn2?.id || null,
  }
}

export function mergeWrittenInRockIntoDeck(state, api = {}) {
  const cards = writtenInRockAsideCards(state)
  const discard = [...(state.encounterDiscard || [])]
  state.encounterDiscard = []
  const merged = [...cards, ...discard]
  state.encounterDeck ||= []
  if (typeof api.shuffleIntoEncounterDeck === 'function') {
    api.shuffleIntoEncounterDeck(merged)
  } else {
    state.encounterDeck.push(...shuffleInPlace(state, merged))
  }
  state.scenarioZones ||= {}
  state.scenarioZones.setAside = (state.scenarioZones.setAside || [])
    .filter(code => !WRITTEN_IN_ROCK_ASIDE_CODES.includes(code))
  info(api, `放一边的 ${cards.length} 张 Written in Rock 遭遇卡与遭遇弃牌堆洗回遭遇牌库。`)
  return cards.length
}

// ---------------------------------------------------------------------------
// 居民 / 剧情资产
// ---------------------------------------------------------------------------
function putResident(state, code, locationId, api = {}) {
  const existing = (state.storyAssets || []).find(asset => codeOf(asset) === code)
  if (existing) return existing
  if (typeof api.storyAsset === 'function') {
    const created = api.storyAsset(code, locationId)
    if (created) {
      state.storyAssets ||= []
      if (!state.storyAssets.includes(created)) state.storyAssets.push(created)
      return created
    }
  }
  const printed = state.scenario?.storyAssets?.[code] || {}
  const asset = {
    id: `${CHAPTER_ID}-resident-${code}`, code, originalCode: code,
    name: printed.name || code, location: locationId, controllerSeat: null,
    exhausted: false, attachments: [], tokens: 0, traits: [...(printed.traits || [])],
  }
  state.storyAssets ||= []
  state.storyAssets.push(asset)
  return asset
}

/** Setup（白天）：收集居民剧情资产；第 1 日瑞玟在列 3，席米恩/莉亚按日期放一边。 */
export function applyResidents(state, api = {}) {
  const flags = flagsFor(state)
  state.scenarioZones ||= {}
  if (isNight(state)) {
    flags.writtenInRockResidents = 'night-none'
    state.scenarioZones.setAsideResidents = []
    return { gathered: [], aside: [] }
  }
  const day = campaignDay(state)
  const aside = []
  if (day !== 3) aside.push(RESIDENT_ASSETS.simeon)
  if (day === 3) aside.push(RESIDENT_ASSETS.leah)
  state.scenarioZones.setAsideResidents = [...aside]
  const gathered = []
  if (day === 1) {
    const target = state.locations.find(item => gridPosition(state, item.id)?.x === 3) || null
    gathered.push(putResident(state, RESIDENT_ASSETS.river, target?.id || null, api))
  }
  for (const code of aside) gathered.push(putResident(state, code, null, api))
  flags.writtenInRockResidents = `day${day}`
  info(api, `居民剧情资产：第 ${day} 日，${aside.length} 张放一边。`)
  return { gathered, aside }
}

// ---------------------------------------------------------------------------
// 敌人
// ---------------------------------------------------------------------------
function spawnEnemyLocal(state, code, locationId, api = {}, options = {}) {
  if (typeof api.spawn === 'function') {
    const spawned = api.spawn(code, locationId, options)
    if (spawned) return spawned
  }
  const def = state.scenario?.enemies?.[code] || {}
  const count = investigatorCount(state)
  const health = (Number(def.health) || 1) + (def.healthPerInvestigatorBonus ? def.healthPerInvestigatorBonus * count : 0)
  const enemy = {
    id: `${CHAPTER_ID}-enemy-${code}-${(state.enemies || []).length + 1}`,
    code, originalCode: code, name: def.name || code, location: locationId,
    fight: def.fight ?? 0, evade: def.evade ?? 0, health, healthBase: def.health ?? 1,
    damage: def.damage || 0, horror: def.horror || 0, traits: [...(def.traits || [])],
    exhausted: options.exhausted === true, engagedSeat: null, damageTaken: 0, doom: 0, clues: 0,
    attachments: [], victory: Number(def.victory) || 0,
    ...(def.hunter || /Hunter/.test(def.text || '') ? { hunter: true } : {}),
    ...(def.massive ? { massive: true } : {}),
    ...(def.elite ? { elite: true } : {}),
  }
  state.enemies ||= []
  state.enemies.push(enemy)
  info(api, `「${enemy.name}」在「${locationOf(state, locationId)?.name || locationId}」生成。`)
  return enemy
}

export function currentActCode(state) {
  return codeOf(state.acts?.[state.actIndex ?? 0])
}

export function currentAgendaCode(state) {
  return codeOf(state.agendas?.[state.agendaIndex ?? 0])
}

export function currentActNumber(state) {
  return Number(currentActStep(state))
}

/** 议程 2 正面：每个敌人获得猎手（已入场的敌人也要补上）。 */
export function applyAgenda2FrontRules(state) {
  if (currentAgendaCode(state) !== AGENDA2_CODE) return false
  for (const enemy of state.enemies || []) enemy.hunter = true
  return true
}

/** 深掘混种：入场后把矿车朝向的连接地点滑进相邻空格；不能滑就与相邻地点交换。 */
export function burrowingHybridEntered(state, enemy, api = {}) {
  const vehicle = mineCartVehicle(state)
  const cartLocation = vehicle?.location || null
  if (!cartLocation) return false
  const neighbor = railNeighbors(mineCartRail(state), mechanicState(state)?.grid || {}, cartLocation)
    .find(entry => entry.direction === mineCartRail(state)?.facing)
  if (!neighbor) return false
  const target = neighbor.id
  const seat = mineCartChoiceSeat(state)
  const spaces = emptyAdjacentSpaces(state, target)
  if (spaces.length) {
    const choice = seat != null && typeof api?.choose === 'function'
      ? api.choose({
        kind: 'slide', source: BURROWING_HYBRID_CODE, seat,
        prompt: '深掘混种：把矿车朝向的连接地点滑入相邻空格。',
        options: spaces.map(space => ({ id: slotKey(space), label: `(${space.x}, ${space.y})` })),
      })
      : slotKey(spaces[0])
    const point = spaces.find(space => slotKey(space) === choice) || spaces[0]
    if (point && slideLocation(state, target, point.x, point.y, api)) return true
  }
  const neighbors = adjacentGridLocations(state, target).filter(id => canBeSlidOrSwapped(state, id))
  if (!neighbors.length) return false
  const pick = seat != null && typeof api?.choose === 'function'
    ? api.choose({
      kind: 'swap', source: BURROWING_HYBRID_CODE, seat,
      prompt: '深掘混种：无法滑动，改为与相邻地点交换。',
      options: neighbors.map(id => ({ id, label: locationOf(state, id)?.name || id })),
    })
    : neighbors[0]
  void enemy
  return swapAdjacentLocations(state, target, neighbors.includes(pick) ? pick : neighbors[0], api)
}

// ---------------------------------------------------------------------------
// 引擎钩子：行动
// ---------------------------------------------------------------------------
const perTurnKey = state => `${Number(state.round) || 1}:${state.phase || 'investigation'}`
const canUse = (state, key) => (flagsFor(state).writtenInRockUsed || {})[key] !== true
const markUsed = (state, key, value = true) => {
  const ledger = flagsFor(state).writtenInRockUsed ||= {}
  ledger[key] = value
}
const turnKey = (state, inv) => `${perTurnKey(state)}:${inv?.seat}`
const costPerPlayer = state => Math.max(1, investigatorCount(state))

/** 支付资源：优先引擎的 spendResources，其次 loseResources（同一资源库），最后本地兜底。 */
function spendResources(state, inv, amount, api = {}) {
  void state
  if (typeof api.spendResources === 'function') return api.spendResources(inv.seat, amount)
  if (typeof api.loseResources === 'function') return api.loseResources(inv.seat, amount)
  inv.resources = Math.max(0, (Number(inv.resources) || 0) - amount)
  return true
}

function swapPairs(state) {
  const pairs = []
  for (const location of state.locations) {
    if (!canBeSlidOrSwapped(state, location.id)) continue
    for (const neighbor of adjacentGridLocations(state, location.id)) {
      if (!canBeSlidOrSwapped(state, neighbor)) continue
      const key = [location.id, neighbor].sort().join('|')
      if (pairs.some(pair => pair.key === key)) continue
      pairs.push({ key, pair: [location.id, neighbor] })
    }
  }
  return pairs.map(entry => entry.pair)
}

function slidePlans(state) {
  const plans = []
  for (const location of state.locations) {
    if (!location.revealed) continue
    if (!canBeSlidOrSwapped(state, location.id)) continue
    for (const space of emptyAdjacentSpaces(state, location.id)) {
      plans.push({ id: location.id, x: space.x, y: space.y })
    }
  }
  return plans
}

function caveInLocations(state) {
  return (state.locations || [])
    .filter(location => (location.attachments || []).some(card => entryFlag(card, 'cancelCartMoveDamage')
      || codeOf(card) === CAVE_IN_CODE))
    .map(location => location.id)
}

function choosePair(state, api, seat, prompt) {
  const pairs = swapPairs(state)
  if (!pairs.length) return null
  if (typeof api?.choose !== 'function') return pairs[0]
  const picked = api.choose({
    kind: 'swap', source: ACT2_CODE, seat, prompt,
    options: pairs.map((pair, index) => ({
      id: String(index),
      label: `「${locationOf(state, pair[0])?.name}」↔「${locationOf(state, pair[1])?.name}」`,
    })),
  })
  return pairs[Number(picked)] || null
}

export function actions(state, inv) {
  if (!inv || state.status !== 'playing') return []
  const moves = []
  const location = locationOf(state, inv.location)
  const act = currentActCode(state)
  const ledger = flagsFor(state).writtenInRockUsed || {}

  // 幕 1 议程 1 正面 [action]：抽 1 张遭遇牌，把所在地点的 1 个碎片移到参考卡。
  if (act === ACT1_CODE && currentAgendaCode(state) === AGENDA1_CODE && (Number(location?.resources) || 0) > 0) {
    moves.push({
      action: 'scenarioAction', rule: 'writtenInRockSurvey', actions: 1, fast: false,
      label: '抽 1 张遭遇牌：把你所在地点的 1 个碎片移到剧本参考卡（抽到[[力量]]诡计则 +5 资源）',
    })
  }

  if (act === ACT2_CODE) {
    const freeKey = `freeSlideSwap:${turnKey(state, inv)}`
    if (canUse(state, freeKey) && (inv.clues || 0) >= costPerPlayer(state)) {
      moves.push({
        action: 'scenarioAction', rule: 'writtenInRockFastSlideSwap', actions: 0, fast: true,
        label: `[fast] 共同花费 ${costPerPlayer(state)} 条线索：滑动一个地点，或交换 2 个相邻地点`,
      })
    }
    const slideKey = `paidSlide:${Number(state.round) || 1}`
    if (canUse(state, slideKey) && (inv.resources || 0) >= costPerPlayer(state)) {
      moves.push({
        action: 'scenarioAction', rule: 'writtenInRockPaidSlide', actions: 1,
        label: `花费 ${costPerPlayer(state)} 资源：把一个已揭示地点滑入相邻空格（团队每轮一次）`,
      })
    }
    const shard = (state.storyAssets || []).find(asset => entryFlag(asset, 'prismaticShard')
      || codeOf(asset) === PRISMATIC_SHARD_CODE)
    if (shard && shard.location === inv.location && shard.controllerSeat == null) {
      moves.push({ action: 'scenarioAction', rule: 'writtenInRockTakeShard', actions: 1, label: '取得「棱柱碎片」的控制权' })
    }
    if (location?.id === CONTROL_STATION_ID && location.revealed && !ledger.writtenInRockStationSwapUsed) {
      moves.push({
        action: 'scenarioAction', rule: 'writtenInRockStationSwap', actions: 0, fast: true,
        label: '[fast] 交换 2 个相邻[[轨道]]地点（团队每局一次）',
      })
    }
    if ((location?.turnSwap || entryFlag(location, 'turnSwap')) && !ledger[`turnSwap:${location.id}`]) {
      for (const pair of swapPairs(state).slice(0, 6)) {
        moves.push({
          action: 'scenarioAction', rule: `writtenInRockTurnSwap:${location.id}:${pair[0]}:${pair[1]}`, actions: 2,
          label: `[action][action] 交换「${locationOf(state, pair[0])?.name}」与「${locationOf(state, pair[1])?.name}」（每局一次）`,
        })
      }
    }
    if ((location?.turnSlide || entryFlag(location, 'turnSlide'))
      && !ledger[`turnSlide:${location.id}`] && (inv.resources || 0) >= 2) {
      for (const plan of slidePlans(state).slice(0, 6)) {
        moves.push({
          action: 'scenarioAction', rule: `writtenInRockTurnSlide:${location.id}:${plan.id}:${plan.x}:${plan.y}`, actions: 1,
          label: `[action] 花费 2 资源：把「${locationOf(state, plan.id)?.name}」滑入 (${plan.x}, ${plan.y})（每局一次）`,
        })
      }
    }
    if (location?.id === 'railBridge' && location.revealed && (inv.resources || 0) >= costPerPlayer(state)
      && canUse(state, `railBridge:${Number(state.round) || 1}`)) {
      moves.push({
        action: 'scenarioAction', rule: 'writtenInRockRailBridgeSwitch', actions: 1,
        label: `[action] 花费 ${costPerPlayer(state)} 资源：在参考卡上放 1 个道岔（团队每轮一次）`,
      })
    }
  }

  // 地下野兽：[action] 花费 1[per_investigator] 线索 → 横置，本轮不能重整。
  const beastHere = (state.enemies || []).find(enemy => (entryFlag(enemy, 'exhaustAction')
    || codeOf(enemy) === SUBTERRANEAN_BEAST_CODE) && enemy.location === inv.location)
  if (beastHere && (inv.clues || 0) >= costPerPlayer(state)) {
    moves.push({
      action: 'scenarioAction', rule: 'writtenInRockExhaustBeast', actions: 1,
      label: `花费 ${costPerPlayer(state)} 条线索：横置地下野兽，本轮不能重整`,
    })
  }

  // 塌方：[action] 战斗或敏捷（2）检定丢弃（在附属地点或其相邻地点）。
  for (const attached of caveInLocations(state)) {
    const here = inv.location === attached
    const adjacent = adjacentGridLocations(state, attached).includes(inv.location)
    if (!here && !adjacent) continue
    if (!canUse(state, `caveInTest:${attached}`)) continue
    moves.push({
      action: 'scenarioAction', rule: `writtenInRockCaveInTest:${attached}`, actions: 1,
      label: `[action] 检定战斗或敏捷（2）：成功则弃掉「塌方」（${locationOf(state, attached)?.name}）`,
    })
  }
  return moves
}

export function fastActions(state, inv) {
  return actions(state, inv).filter(move => move.fast === true && (move.actions ?? 1) === 0)
}

function doSlide(state, api, seat) {
  const plans = slidePlans(state)
  if (!plans.length) return false
  if (typeof api?.choose !== 'function') {
    const plan = plans[0]
    return slideLocation(state, plan.id, plan.x, plan.y, api)
  }
  const picked = api.choose({
    kind: 'slide', source: ACT2_CODE, seat, prompt: '选择要滑动的地点与空格。',
    options: plans.map((plan, index) => ({
      id: String(index), label: `「${locationOf(state, plan.id)?.name}」→ (${plan.x}, ${plan.y})`,
    })),
  })
  const plan = plans[Number(picked)] || plans[0]
  return slideLocation(state, plan.id, plan.x, plan.y, api)
}

export function discardCaveIn(state, locationId, api = {}) {
  const location = locationOf(state, locationId)
  if (!location) return false
  const index = (location.attachments || []).findIndex(card => entryFlag(card, 'cancelCartMoveDamage')
    || codeOf(card) === CAVE_IN_CODE)
  if (index < 0) return false
  const [card] = location.attachments.splice(index, 1)
  state.encounterDiscard ||= []
  state.encounterDiscard.push(card.code || CAVE_IN_CODE)
  info(api, `「${location.name}」的塌方被弃掉。`)
  return true
}

function drawEncounterCard(state, api = {}, seat = null) {
  // 引擎的遭遇牌库「顶」是数组末尾（encounter.js: deck().pop()），本地兜底与之一致。
  state.encounterDeck ||= []
  const top = state.encounterDeck.length ? state.encounterDeck[state.encounterDeck.length - 1] : null
  const definition = top == null ? null
    : (state.scenario?.treacheries?.[top] || state.scenario?.enemies?.[top] || { code: top, originalCode: top, traits: [] })
  if (top != null && Number.isInteger(seat) && typeof api.drawEncounter === 'function') {
    api.drawEncounter(seat)
    return definition
  }
  if (top == null) return null
  state.encounterDeck.pop()
  state.encounterDiscard ||= []
  state.encounterDiscard.push(top)
  return definition
}

export function performAction(state, inv, move, api = {}) {
  if (!move || !inv) return false
  const rule = String(move.rule || '')
  const tag = (prefix, rest) => rest.slice(prefix.length).split(':')
  if (rule === 'writtenInRockSurvey') {
    const location = locationOf(state, inv.location)
    if (!location || (Number(location.resources) || 0) <= 0) return false
    // 印刷顺序：抽 1 张遭遇牌是行动费用（先结算），再把所在地点的 1 个碎片移到参考卡。
    const card = drawEncounterCard(state, api, inv.seat)
    location.resources = Number(location.resources) - 1
    addMarker(state, SCRAP, 1)
    const power = hasTrait(card, 'Power')
    if (power) {
      if (typeof api.gainResources === 'function') api.gainResources(inv.seat, 5)
      else inv.resources = (Number(inv.resources) || 0) + 5
    }
    info(api, `勘察：1 个碎片移到参考卡${power ? '；抽到[[力量]]诡计，获得 5 资源' : ''}。`)
    return true
  }
  if (rule === 'writtenInRockFastSlideSwap') {
    const key = `freeSlideSwap:${turnKey(state, inv)}`
    if (!canUse(state, key)) return false
    if ((inv.clues || 0) < costPerPlayer(state)) return false
    if (typeof api.spendClues === 'function') api.spendClues(inv.seat, costPerPlayer(state))
    else inv.clues = Math.max(0, (Number(inv.clues) || 0) - costPerPlayer(state))
    markUsed(state, key)
    const mode = typeof api?.choose === 'function'
      ? api.choose({
        kind: 'slideOrSwap', source: ACT2_CODE, seat: inv.seat, prompt: '选择：滑动一个地点，或交换 2 个相邻地点。',
        options: [{ id: 'slide', label: '滑动一个地点' }, { id: 'swap', label: '交换 2 个相邻地点' }],
      })
      : 'slide'
    if (mode === 'swap') {
      const pair = choosePair(state, api, inv.seat, '交换哪 2 个相邻地点？')
      return Boolean(pair) && swapAdjacentLocations(state, pair[0], pair[1], api)
    }
    return doSlide(state, api, inv.seat)
  }
  if (rule === 'writtenInRockPaidSlide') {
    const key = `paidSlide:${Number(state.round) || 1}`
    if (!canUse(state, key)) return false
    if ((inv.resources || 0) < costPerPlayer(state)) return false
    spendResources(state, inv, costPerPlayer(state), api)
    markUsed(state, key)
    return doSlide(state, api, inv.seat)
  }
  if (rule === 'writtenInRockTakeShard') {
    const shard = (state.storyAssets || []).find(asset => entryFlag(asset, 'prismaticShard')
      || codeOf(asset) === PRISMATIC_SHARD_CODE)
    if (!shard || shard.location !== inv.location) return false
    shard.controllerSeat = inv.seat
    info(api, `${inv.name} 取得「棱柱碎片」。`)
    return true
  }
  if (rule === 'writtenInRockStationSwap') {
    if (inv.location !== CONTROL_STATION_ID || !canUse(state, 'writtenInRockStationSwapUsed')) return false
    const pair = choosePair(state, api, inv.seat, '控制站：交换 2 个相邻[[轨道]]地点（每局一次）。')
    if (!pair) return false
    markUsed(state, 'writtenInRockStationSwapUsed')
    return swapAdjacentLocations(state, pair[0], pair[1], api)
  }
  if (rule.startsWith('writtenInRockTurnSwap:')) {
    const [locationId, a, b] = tag('writtenInRockTurnSwap:', rule)
    if (inv.location !== locationId) return false
    if (!canUse(state, `turnSwap:${locationId}`)) return false
    if (!swapAdjacentLocations(state, a, b, api)) return false
    markUsed(state, `turnSwap:${locationId}`)
    return true
  }
  if (rule.startsWith('writtenInRockTurnSlide:')) {
    const [locationId, id, x, y] = tag('writtenInRockTurnSlide:', rule)
    if (inv.location !== locationId) return false
    if (!canUse(state, `turnSlide:${locationId}`)) return false
    if ((inv.resources || 0) < 2) return false
    spendResources(state, inv, 2, api)
    if (!slideLocation(state, id, Number(x), Number(y), api)) return false
    markUsed(state, `turnSlide:${locationId}`)
    return true
  }
  if (rule === 'writtenInRockRailBridgeSwitch') {
    const key = `railBridge:${Number(state.round) || 1}`
    if (!canUse(state, key)) return false
    if ((inv.resources || 0) < costPerPlayer(state)) return false
    spendResources(state, inv, costPerPlayer(state), api)
    addMarker(state, SWITCH, 1)
    markUsed(state, key)
    info(api, '轨道桥梁：在参考卡上放 1 个道岔。')
    return true
  }
  if (rule === 'writtenInRockExhaustBeast') {
    const beast = (state.enemies || []).find(enemy => (entryFlag(enemy, 'exhaustAction')
      || codeOf(enemy) === SUBTERRANEAN_BEAST_CODE) && enemy.location === inv.location)
    if (!beast) return false
    if ((inv.clues || 0) < costPerPlayer(state)) return false
    if (typeof api.spendClues === 'function') api.spendClues(inv.seat, costPerPlayer(state))
    else inv.clues = Math.max(0, (Number(inv.clues) || 0) - costPerPlayer(state))
    beast.exhausted = true
    safeCall(api, 'exhaustEnemy', beast)
    // 「本轮不能重整」：引擎读点 location-defenses.defensePreventsReady（需要 defenses 机制开启）。
    const data = mechanicState(state, true)
    data.defenses ||= { decoy: [], trap: [], cannotReady: {} }
    data.defenses.cannotReady ||= {}
    data.defenses.cannotReady[beast.id] = Number(state.round) || 1
    info(api, '地下野兽被横置，本轮不能重整。')
    return true
  }
  if (rule.startsWith('writtenInRockCaveInTest:')) {
    const locationId = rule.slice('writtenInRockCaveInTest:'.length)
    if (!caveInLocations(state).includes(locationId)) return false
    if (!canUse(state, `caveInTest:${locationId}`)) return false
    markUsed(state, `caveInTest:${locationId}`)
    const resolve = result => { if (result?.success) discardCaveIn(state, locationId, api) }
    if (typeof api?.test === 'function') {
      api.test(inv.seat, 'combat', 2, resolve, { label: '塌方：战斗或敏捷（2）', skillOptions: ['combat', 'agility'] })
    } else {
      resolve({ success: true })
    }
    return true
  }
  return false
}

// ---------------------------------------------------------------------------
// 引擎钩子：地点 / 敌人常驻
// ---------------------------------------------------------------------------
export function locationShroudModifier(state, location) {
  if (!location || !location.shroudByColumn) return 0
  return columnOf(state, location.id)
}

export function enemyStatModifier(state, enemy, stat) {
  if (!enemy) return 0
  const code = codeOf(enemy)
  const column = columnOf(state, enemy.location)
  if ((entryFlag(enemy, 'frenziedMiner') || code === FRENZIED_MINER_CODE)
    && (stat === 'fight' || stat === 'evade')) {
    // 卡表把 X 记成 -2 占位；修正到「列号」而不是叠加 -2。
    return column - (Number(enemy[stat]) || 0)
  }
  if ((entryFlag(enemy, 'subterraneanBeast') || code === SUBTERRANEAN_BEAST_CODE) && stat === 'health') {
    return 3 * investigatorCount(state)
  }
  return 0
}

export function enemyConnections(state, enemy, location) {
  void enemy
  if (!location) return []
  if (currentAgendaCode(state) !== AGENDA2_CODE) return []
  return adjacentGridLocations(state, location.id)
}

export function moveError(state, inv, location, destinationId) {
  if (!inv) return null
  if (railMode(state)) {
    const cart = mineCartVehicle(state)
    if (cart?.passengers?.includes(inv.seat) && destinationId !== cart.location) {
      return '调查员在矿车中，不能独立移动（矿车移动时随车移动）'
    }
  }
  void location
  return null
}

export function beforeMove(state, inv, destination, api = {}) {
  void state
  void inv
  void destination
  void api
  return true
}

export function locationRevealed(state, location, api = {}) {
  if (!location) return false
  if (!(entryFlag(location, 'forcedRevealDiscardUntilEnemy') || locationCode(location) === '10514')) return false
  // 沉没隧道：从遭遇牌库顶弃牌直到弃出敌人，队长抽取该敌人。
  state.encounterDeck ||= []
  const discarded = []
  let enemyCode = null
  while (state.encounterDeck.length) {
    const code = state.encounterDeck.pop()
    if (state.scenario?.enemies?.[code]) { enemyCode = code; break }
    discarded.push(code)
  }
  state.encounterDiscard ||= []
  state.encounterDiscard.push(...discarded)
  const leadSeat = Number.isInteger(state.campaign?.leadSeat) ? state.campaign.leadSeat : 0
  if (enemyCode) {
    const lead = state.investigators?.[leadSeat]
    const spawned = spawnEnemyLocal(state, enemyCode, lead?.location || location.id, api)
    info(api, `沉没隧道：弃 ${discarded.length} 张后抽出「${spawned?.name || enemyCode}」，由队长抽取。`)
    state.encounterDiscard.push(enemyCode)
  } else {
    info(api, `沉没隧道：遭遇牌库没有敌人，弃了 ${discarded.length} 张。`)
  }
  return true
}

export function enemySpawned(state, enemy, api = {}) {
  if (!enemy) return
  if (currentAgendaCode(state) === AGENDA2_CODE) enemy.hunter = true
  if ((entryFlag(enemy, 'forcedSlideOnEnter') || codeOf(enemy) === BURROWING_HYBRID_CODE) && railMode(state)) {
    burrowingHybridEntered(state, enemy, api)
  }
}

export function enemyMoved(state, enemy, previous, api = {}) {
  void state
  void enemy
  void previous
  void api
}

export function enemyAttackResolved(state, enemy, inv, api = {}) {
  if (!enemy || !inv) return
  if (!(entryFlag(enemy, 'attackSplash') || codeOf(enemy) === FRENZIED_MINER_CODE)) return
  const location = inv.location
  for (const other of activeInvestigators(state)) {
    if (other.seat === inv.seat || other.location !== location) continue
    if (typeof api.damage === 'function') api.damage(other.seat, 1)
    else other.damage = (Number(other.damage) || 0) + 1
  }
  dealDirectToResidents(state, location, 'damage', 1, api)
  info(api, '发狂矿工：攻击后，同地点的其他调查员与居民各承受 1 点伤害。')
}

export function enemyDefeated(state, enemy, api = {}) {
  void state
  void api
  void enemy
  return false
}

// ---------------------------------------------------------------------------
// 引擎钩子：轮末 / 目标
// ---------------------------------------------------------------------------
export function checkAct1Objective(state, api = {}) {
  if (currentActCode(state) !== ACT1_CODE) return false
  const active = activeInvestigators(state)
  if (!active.length) return false
  if (!active.every(inv => inv.location === CONTROL_STATION_ID)) return false
  info(api, '轮末：每位存活调查员都在控制站 → 推进幕 1。')
  if (typeof api.advanceAct === 'function') api.advanceAct()
  return true
}

export function checkAct2Objective(state, api = {}) {
  if (currentActCode(state) !== ACT2_CODE) return false
  const cart = mineCartVehicle(state)
  if (!cart || cart.location !== RAIL_EXIT_ID) return false
  return landOnRailExit(state, api)
}

export function checkObjectives(state, api = {}) {
  return checkAct1Objective(state, api) || checkAct2Objective(state, api)
}

export function roundEnded(state, api = {}) {
  const flags = flagsFor(state)
  flags.writtenInRockRoundEndRound = Number(state.round) || 0
  // 碱性轨道：在此的调查员与[[居民]]支援各承受 1 点恐惧。
  for (const location of state.locations || []) {
    if (!(entryFlag(location, 'roundEndHorror') || locationCode(location) === '10512') || !location.revealed) continue
    for (const inv of activeInvestigators(state)) {
      if (inv.location !== location.id) continue
      if (typeof api.horror === 'function') api.horror(inv.seat, 1)
      else inv.horror = (Number(inv.horror) || 0) + 1
    }
    dealDirectToResidents(state, location.id, 'horror', 1, api)
    info(api, `碱性轨道（${location.name}）：此处的调查员与居民各承受 1 点恐惧。`)
  }
  // 轨道岔路：轮末矿车在此 → 移除 1 个道岔。
  const cart = mineCartVehicle(state)
  if (cart) {
    const here = locationOf(state, cart.location)
    if (entryFlag(here, 'roundEndRemoveSwitch') || locationCode(here) === '10515') {
      addMarker(state, SWITCH, -1)
      info(api, `轨道岔路：轮末移除 1 个道岔（剩余 ${markerCountOf(state, SWITCH)}）。`)
    }
  }
  checkAct1Objective(state, api)
  return true
}

export function turnEnded(state, inv, api = {}) {
  void state
  void inv
  void api
  return false
}

// ---------------------------------------------------------------------------
// 引擎钩子：幕 / 议程
// ---------------------------------------------------------------------------
export function actReveal(state, act, api = {}) {
  const code = codeOf(act)
  if (code === ACT1_CODE) return act1Back(state, api)
  if (code === ACT2_CODE) return act2Back(state, api)
  return false
}

function act1Back(state, api = {}) {
  const flags = flagsFor(state)
  const caves = (state.locations || []).filter(location => hasTrait(location, 'Cave') || location.cave === true)
  for (const cave of caves) {
    for (const enemy of (state.enemies || []).filter(item => item.location === cave.id)) {
      state.encounterDiscard ||= []
      state.encounterDiscard.push(enemy.code || enemy.originalCode)
      state.enemies.splice(state.enemies.indexOf(enemy), 1)
    }
    for (const inv of state.investigators || []) {
      if (inv.location !== cave.id) continue
      if (typeof api.moveInvestigator === 'function') api.moveInvestigator(inv.seat, CONTROL_STATION_ID)
      inv.location = CONTROL_STATION_ID
    }
    if (typeof api.removeLocation === 'function') api.removeLocation(cave.id)
    else {
      const index = state.locations.indexOf(cave)
      if (index >= 0) state.locations.splice(index, 1)
    }
    const cells = mechanicState(state)?.grid
    if (cells) delete cells[cave.id]
  }
  // 瑞玟在场上但没有调查员控制 → 移出游戏。
  const river = (state.storyAssets || []).find(asset => codeOf(asset) === RESIDENT_ASSETS.river)
  if (river && river.controllerSeat == null) {
    river.location = null
    flags.writtenInRockRiverRemoved = true
    info(api, '瑞玟·霍桑不在任何调查员控制下：移出游戏。')
  }
  for (const inv of activeInvestigators(state)) inv.clues = Math.min(Number(inv.clues) || 0, 2)
  // 「如果是议程 1a，直接推进到议程 2a（不结算议程 1b）」：毁灭随当前议程留到新议程。
  if (currentAgendaCode(state) === AGENDA1_CODE) {
    if (typeof api.advanceAgendaTo === 'function' && api.advanceAgendaTo(1)) {
      info(api, '幕 1 背面：直接推进议程到 2a（不结算议程 1 背面）。')
    } else {
      state.agendaIndex = Math.min(1, (state.agendas || []).length - 1)
      info(api, '幕 1 背面：直接推进议程到 2a（不结算议程 1 背面）。')
    }
  }
  // 剧本参考卡翻面：碎片 → 道岔。
  convertRailMarkers(state, SCRAP, SWITCH, { per: 1 })
  flags.writtenInRockReferenceFlipped = true
  applyAgenda2FrontRules(state)
  info(api, '幕 1 背面：守住线索（各留 2 条），参考卡翻面，碎片全部转为道岔。')
  theCaveIn(state, api)
  return true
}

function controlCheck(state) {
  const assetOf = code => (state.storyAssets || []).find(asset => codeOf(asset) === code)
  const simeon = assetOf(RESIDENT_ASSETS.simeon)
  const leah = assetOf(RESIDENT_ASSETS.leah)
  if (simeon && simeon.controllerSeat != null) return 'resolution1'
  if (leah && leah.controllerSeat != null) return 'resolution2'
  const aside = state.scenarioZones?.setAsideResidents || []
  const simeonUncontrolled = aside.includes(RESIDENT_ASSETS.simeon)
    || Boolean(simeon && simeon.controllerSeat == null)
  const leahUncontrolled = aside.includes(RESIDENT_ASSETS.leah)
    || Boolean(leah && leah.controllerSeat == null)
  if (simeonUncontrolled) return 'resolution3'
  if (leahUncontrolled) return 'resolution4'
  return 'resolution5'
}

function act2Back(state, api = {}) {
  const key = controlCheck(state)
  info(api, `幕 2 背面：检查席米恩/莉亚的控制权 → 结局 ${key.slice(-1)}。`)
  if (typeof api.finish === 'function') api.finish(key)
  else state.resolution = key
  return true
}

export function agendaReveal(state, agenda, api = {}) {
  const code = codeOf(agenda)
  if (code === AGENDA1_CODE) return agenda1Back(state, api)
  if (code === AGENDA2_CODE) return agenda2Back(state, api)
  return false
}

function agenda1Back(state, api = {}) {
  // 塌方：每位调查员 2 点伤害 + 每个[[盟友]]支援 1 点直接伤害；揭示控制站并移动存活者；
  // 每位调查员失去全部线索；推进幕。
  for (const inv of activeInvestigators(state)) {
    if (typeof api.damage === 'function') api.damage(inv.seat, 2)
    else inv.damage = (Number(inv.damage) || 0) + 2
    for (const asset of inv.assets || []) {
      if (!hasTrait(asset, 'Ally')) continue
      asset.damage = (Number(asset.damage) || 0) + 1
      safeCall(api, 'assetDamage', asset, 1)
    }
    inv.clues = 0
  }
  const station = locationOf(state, CONTROL_STATION_ID)
  if (station) station.revealed = true
  for (const inv of activeInvestigators(state)) {
    if (inv.location === CONTROL_STATION_ID) continue
    if (typeof api.moveInvestigator === 'function') api.moveInvestigator(inv.seat, CONTROL_STATION_ID)
    inv.location = CONTROL_STATION_ID
  }
  info(api, '议程 1 背面（塌方）：全员 2 点伤害、失去全部线索，存活者被移到已揭示的控制站；推进幕 1。')
  if (typeof api.advanceAct === 'function') api.advanceAct()
  applyAgenda2FrontRules(state)
  checkAct1Objective(state, api)
  return true
}

function agenda2Back(state, api = {}) {
  for (const inv of activeInvestigators(state)) {
    const choice = typeof api?.choose === 'function'
      ? api.choose({
        kind: 'trauma', source: AGENDA2_CODE, seat: inv.seat,
        prompt: '彻底崩塌：承受 1 点肉体创伤或 1 点精神创伤。',
        options: [{ id: 'physical', label: '1 点肉体创伤' }, { id: 'mental', label: '1 点精神创伤' }],
      })
      : 'physical'
    safeCall(api, 'addTrauma', inv.seat, choice === 'mental' ? 'mental' : 'physical', 1)
    if (typeof api.defeatInvestigator === 'function') api.defeatInvestigator(inv.seat)
    else inv.defeated = true
  }
  info(api, '议程 2 背面（彻底崩塌）：每位存活调查员被击败并承受 1 点肉体或精神创伤。')
  return true
}

/** 法典（指南 codex）：4 条。用居民剧情资产与轨道操作结算。 */
export function codexRead(state, entry, api = {}) {
  const id = typeof entry === 'string' ? entry : entry?.id
  const inv = state.investigators?.[Number.isInteger(entry?.seat) ? entry.seat : (state.currentSeat || 0)]
  if (!inv) return false
  if (id === 'leahAtwood' || id === 'simeonAtwood') {
    const code = id === 'leahAtwood' ? RESIDENT_ASSETS.leah : RESIDENT_ASSETS.simeon
    const asset = (state.storyAssets || []).find(item => codeOf(item) === code)
    if (!asset) return false
    if (asset.controllerSeat != null) {
      addMarker(state, SWITCH, id === 'leahAtwood' ? 1 : 2)
      info(api, `法典：${asset.name} 已有控制者 → 放 ${id === 'leahAtwood' ? 1 : 2} 个道岔。`)
    } else {
      asset.controllerSeat = inv.seat
      info(api, `法典：${inv.name} 取得「${asset.name}」的控制权。`)
    }
    return true
  }
  if (id === 'riverHawthorne') {
    const asset = (state.storyAssets || []).find(item => codeOf(item) === RESIDENT_ASSETS.river)
    if (!asset) return false
    asset.controllerSeat = inv.seat
    info(api, '法典：取得瑞玟·霍桑的控制权（结局 6 检查「你帮助了瑞玟」）。')
    return true
  }
  if (id === 'drRosaMarquez' || id === 'theta') {
    if (currentActCode(state) === ACT1_CODE) {
      addMarker(state, SCRAP, 1)
      info(api, '法典 Θ（幕 1）：在参考卡上放 1 个碎片。')
      return true
    }
    const pair = choosePair(state, api, inv.seat, '法典 Θ（幕 2）：交换 2 个相邻地点。')
    return Boolean(pair) && swapAdjacentLocations(state, pair[0], pair[1], api)
  }
  return false
}

// ---------------------------------------------------------------------------
// 遭遇卡（塌方 / 急速狂飙）
// ---------------------------------------------------------------------------
export function caveInEvent(state, payload = {}, api = {}) {
  const rail = mineCartRail(state)
  const vehicle = mineCartVehicle(state)
  if (!rail || !vehicle) return false
  const cells = mechanicState(state)?.grid || {}
  const neighbor = railNeighbors(rail, cells, vehicle.location).find(entry => entry.direction === rail.facing)
  if (!neighbor) {
    info(api, '塌方：矿车没有朝向的地点 → 获得涌动。')
    return false
  }
  const location = locationOf(state, neighbor.id)
  if (!location) return false
  location.attachments ||= []
  location.attachments.push({
    id: `writtenInRock-caveIn-${location.id}`, code: CAVE_IN_CODE, originalCode: CAVE_IN_CODE,
    name: state.scenario?.treacheries?.[CAVE_IN_CODE]?.name || '塌方', attachedTo: location.id,
  })
  info(api, `塌方附属到「${location.name}」（矿车朝向的地点）。`)
  void payload
  return true
}

export function wildRideEvent(state, payload = {}, api = {}) {
  const inv = state.investigators?.[Number.isInteger(payload.seat) ? payload.seat : (state.currentSeat || 0)]
  if (!inv) return false
  const card = {
    id: `writtenInRock-wildRide-${inv.seat}-${(inv.threat || []).length}`,
    code: WILD_RIDE_CODE, originalCode: WILD_RIDE_CODE,
    name: state.scenario?.treacheries?.[WILD_RIDE_CODE]?.name || '急速狂飙',
  }
  const settle = result => {
    if (result?.success) {
      info(api, `${inv.name} 挣脱了急速狂飙。`)
      return false
    }
    inv.threat ||= []
    inv.threat.push(card)
    info(api, '急速狂飙：检定失败 → 放入威胁区。')
    return true
  }
  if (typeof api?.test === 'function') {
    return api.test(inv.seat, 'agility', 5, settle, { label: '急速狂飙：敏捷（5）' })
  }
  return settle({ success: false })
}

export function resolveEncounterCard(state, inv, code, api = {}) {
  const value = String(code || '')
  if (value === CAVE_IN_CODE) return caveInEvent(state, { seat: inv?.seat }, api)
  if (value === WILD_RIDE_CODE) return wildRideEvent(state, { seat: inv?.seat }, api)
  return false
}

export const events = Object.freeze({
  writtenInRockCaveIn: caveInEvent,
  writtenInRockWildRide: wildRideEvent,
})

export function encounterGainsSurge(state, code) {
  if (String(code || '') !== CAVE_IN_CODE) return false
  const rail = mineCartRail(state)
  if (!rail) return false
  const cells = mechanicState(state)?.grid || {}
  return !railNeighbors(rail, cells, mineCartLocation(state)).some(entry => entry.direction === rail.facing)
}

// ---------------------------------------------------------------------------
// 混乱标记
// ---------------------------------------------------------------------------
export function resolveChaosToken(state, inv, token) {
  return writtenInRockChaosToken(state, inv, token)
}

export function chaosTokenValue(state, tokenFace, inv) {
  return writtenInRockChaosTokenValue(state, tokenFace, inv)
}

export function applyTokenEffect(state, inv, effect, api = {}) {
  if (!inv || inv.defeated || inv.resigned || !effect) return false
  const marker = effect.marker || markerKindForAct(currentActStep(state))
  if (effect.token === 'cultist') {
    addMarker(state, marker === SWITCH ? SWITCH : SCRAP, 1)
    info(api, `[cultist]：在参考卡上放 1 个${marker === SWITCH ? '道岔' : '碎片'}（剩余 ${markerCountOf(state, marker)}）。`)
    return true
  }
  if (effect.token === 'tablet') {
    if (marker === SWITCH) {
      moveMineCart(state, api, { times: 1 })
      info(api, '[tablet]：移动矿车一次。')
    } else {
      addMarker(state, SCRAP, -1)
      info(api, `[tablet]：移除 1 个碎片（剩余 ${markerCountOf(state, SCRAP)}）。`)
    }
    return true
  }
  if (effect.token === 'elderthing') {
    if (marker === SWITCH) {
      addMarker(state, SWITCH, -1)
      info(api, `[elderthing]：移除 1 个道岔（剩余 ${markerCountOf(state, SWITCH)}）。`)
    } else if (typeof api.damage === 'function') {
      api.damage(inv.seat, 1)
      info(api, '[elderthing]：承受 1 点伤害。')
    } else {
      inv.damage = (Number(inv.damage) || 0) + 1
      info(api, '[elderthing]：承受 1 点伤害。')
    }
    return true
  }
  return false
}

// ---------------------------------------------------------------------------
// 结局
// ---------------------------------------------------------------------------
const RESOLUTION_RECORDS = Object.freeze({
  resolution1: { record: 'simeonSurvived', relationship: { key: 'simeonAtwoodRelationship', delta: 2 }, bonus: 2 },
  resolution2: { record: 'leahSawSomethingInTheMine', relationship: { key: 'leahAtwoodRelationship', delta: 1 }, bonus: 2 },
  resolution3: { record: 'simeonDisappeared', crossedOut: 'simeon', bonus: 0 },
  resolution4: { record: 'leahAndSimeonWereReunited', crossedOut: 'leah', bonus: 0 },
  resolution5: { record: 'theInvestigatorsSurvivedTheHorrorsInTheRock', bonus: 0 },
  resolution6: { record: null, bonus: 0 },
  standalone: { record: null, bonus: 0 },
})

function totalClues(state) {
  return activeInvestigators(state).reduce((sum, inv) => sum + (Number(inv.clues) || 0), 0)
}

export function riverControlled(state) {
  const river = (state.storyAssets || []).find(asset => codeOf(asset) === RESIDENT_ASSETS.river)
  return Boolean(river && river.controllerSeat != null)
}

/** 结局共用的「结局 6」结算：瑞玟、棱柱碎片、区域记录。 */
function finishResolution6(state, api = {}) {
  const records = recordsFor(state)
  const needed = 2 * costPerPlayer(state)
  const helpedRiver = riverControlled(state) && totalClues(state) >= needed
  let bonus = 0
  if (helpedRiver) {
    records.riverHawthorneHelped = true
    records.riverHawthorneRelationship = (Number(records.riverHawthorneRelationship) || 0) + 1
    bonus += 1
  } else if (riverControlled(state)) {
    records.riverHawthorneRelationship = (Number(records.riverHawthorneRelationship) || 0) - 1
  }
  const shard = (state.storyAssets || []).find(asset => entryFlag(asset, 'prismaticShard')
    || codeOf(asset) === PRISMATIC_SHARD_CODE)
  records.prismaticShardToDeck = Boolean(shard && shard.controllerSeat != null)
  records.areaNorthPointMineSurveyed = true
  info(api, `结局 6：${helpedRiver ? '你帮助了瑞玟' : '未帮助瑞玟'}；棱柱碎片${records.prismaticShardToDeck ? '加入调查员牌库' : '未取得'}；北角矿坑记入已勘察区域。`)
  return bonus
}

export function resolution(state, key, events = [], api = {}) {
  void events
  const records = recordsFor(state)
  let finalKey = String(key || NO_RESOLUTION)
  if (finalKey === NO_RESOLUTION) {
    if (flagsFor(state).writtenInRockStandalone) {
      finalKey = 'standalone'
      records.writtenInRockDoom = Number(state.doom) || 0
    } else if (isNight(state)) {
      records.simeonCrossedOut = true
      records.writtenInRockNoResolution = true
      finalKey = 'resolution6'
    } else if (campaignDay(state) <= 2) {
      finalKey = 'resolution3'
    } else {
      finalKey = 'resolution4'
    }
  }
  const config = RESOLUTION_RECORDS[finalKey] || RESOLUTION_RECORDS.resolution5
  let bonus = 0
  if (config.record) records[config.record] = true
  if (config.relationship) {
    const current = Number(records[config.relationship.key]) || 0
    records[config.relationship.key] = current + config.relationship.delta
  }
  if (config.crossedOut === 'simeon') records.simeonCrossedOut = true
  if (config.crossedOut === 'leah') records.leahCrossedOut = true
  bonus += Number(config.bonus) || 0
  // Resolution 1/2/5 与「无结局→3/4/6」都接结局 6。
  if (finalKey !== 'standalone') bonus += finishResolution6(state, api)
  records.writtenInRockResolution = finalKey
  records.writtenInRockTimes = (Number(records.writtenInRockTimes) || 0) + 1
  info(api, `岩间密语结算（${finalKey}）：奖励经验 ${bonus}。`)
  return { resolution: finalKey, award: true, bonus }
}

export function scenarioResolution(state, key = 'resolution1', api = {}) {
  resolution(state, key, [], api)
  const records = state.campaign?.records || {}
  return {
    resolution: records.writtenInRockResolution,
    bonus: Number(records.writtenInRockXp) || 0,
    river: records.riverHawthorneHelped === true,
    shard: records.prismaticShardToDeck === true,
  }
}

// ---------------------------------------------------------------------------
// 布置前置 / 装配
// ---------------------------------------------------------------------------
export function preScenarioSetup(state, events, api = {}) {
  void events
  const flags = flagsFor(state)
  flags.writtenInRockDay = campaignDay(state)
  flags.writtenInRockTime = campaignTime(state)
  flags.writtenInRockIntro = introBranch(state)
  info(api, `岩间密语：第 ${flags.writtenInRockDay} 日 · ${flags.writtenInRockTime === 'night' ? '夜晚' : '白天'}（${flags.writtenInRockIntro}）。`)
  return false
}

export function setupEnemies(state, events, helper = {}) {
  void state
  void events
  void helper
}

export const behavior = {
  id: CHAPTER_ID,
  // 洞穴/控制站是单面地点，布置即揭示；轨道隧道（背面 Rail Tunnel）由 placeRailLayout 显式设为
  // 未揭示，进入时 revealRailLocation 揭示。
  locationsStartRevealed: true,
  roundEndActIndex: 0,
  startLocation,
  preScenarioSetup,
  prepareScenario,
  setupScenario,
  setupLocations,
  setupEnemies,
  afterDeckSetup,
  locationPlaced,
  locationRevealed,
  locationShroudModifier,
  enemyStatModifier,
  enemyConnections,
  moveError,
  beforeMove,
  enemySpawned,
  enemyMoved,
  enemyAttackResolved,
  enemyDefeated,
  checkObjectives,
  actions,
  fastActions,
  performAction,
  encounterGainsSurge,
  resolveEncounterCard,
  events,
  enemyPhaseEnd,
  roundEnded,
  turnEnded,
  actReveal,
  agendaReveal,
  resolveChaosToken,
  chaosTokenValue,
  applyTokenEffect,
  resolution,
  scenarioResolution,
  // 章节工具（测试/后续章节复用）
  campaignDay,
  campaignTime,
  introBranch,
  caveOrder,
  caveRemovedIds,
  railPlan,
  placeRailLayout,
  theCaveIn,
  mergeWrittenInRockIntoDeck,
  applyResidents,
  applyAgenda2FrontRules,
  ensureMineCart,
  mineCartAsset,
  mineCartVehicle,
  mineCartLocation,
  mineCartFacing,
  mineCartBlocked,
  cartExits,
  steerMineCart,
  configureRail,
  moveMineCart,
  moveMineCartOnce,
  spendSwitchOnCart,
  slideLocation,
  swapAdjacentLocations,
  emptyAdjacentSpaces,
  adjacentGridLocations,
  canBeSlidOrSwapped,
  syncConnections,
  revealRailLocation,
  codexRead,
  caveInEvent,
  wildRideEvent,
  discardCaveIn,
  checkAct1Objective,
  checkAct2Objective,
  currentActCode,
  currentAgendaCode,
  currentActNumber,
  totalClues,
  riverControlled,
}

export function implementedEntryFlags(code) {
  return entryOf(code)?.flags || {}
}

// 已实现行为的非玩家条目（22 张里的全部：地点/幕/议程数据型 + 敌人/诡计/剧情资产）。
export const implementedEncounterCodes = Object.freeze([
  '10503', '10504', '10505', '10506', '10507', '10508', '10509',
  '10510a', '10510b', '10511a', '10511b', '10512', '10513', '10514', '10515', '10516',
  '10517', '10518', '10519', '10520', '10521', '10522',
])

// 近似披露（output.simplified，按受影响卡号）。
export const SIMPLIFIED = Object.freeze([
  '10502', // 困难/专家 [cultist]「检定成功才放碎片/道岔」在揭示时即结算
  '10504', // 「每个敌人额外结算一次猎手」没有引擎读点（只授予 hunter）
  '10507', // 矿车转向只在多个可用出口时询问；玩家不能独立移动由 moveError 阻止
  '10508', // 控制站背面「进入额外费用」随控制站保持已揭示而不强制（无进入费用原语）
  '10512', // 卡表把两张不同轨道图标的实体记为一个卡号，用 A/B 实例还原
  '10513',
  '10514',
  '10516', // 卡表把 X 帷幕记成 -2 占位，运行期按列号覆盖
  '10517', // 群体/猎手由印刷文补字段
  '10518', // 入场的强制滑动挂在 enemySpawned（引擎没有 VehicleEnters 入场窗口）
  '10522', // 棱柱碎片按指南放列 4 最下方（参考实现放列 5）；弃牌替代窗口留给 P8
])
