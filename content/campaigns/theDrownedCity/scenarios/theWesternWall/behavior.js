// 西墙（theWesternWall · 11517）· 引擎钩子（章节流程）。
//
// 参考：Scenario/Scenarios/TheDrownedCity/TheWesternWall.hs +
//       Act|Agenda|Location|Enemy|Treachery|Story/Cards/TheDrownedCity/TheWesternWall/*.hs +
//       Campaigns/TheDrownedCity/{CampaignSteps,Helpers,ChaosBag}.hs +
//       frontend/src/locales/en/theDrownedCity/theWesternWall.json。
//
// 引擎读点（全部走既有钩子/已登记原语，不改引擎）：
//   startLocation / preScenarioSetup → 方向（西/东）、幕牌库、Do No Harm 选择、远征装备
//   setupLocations / locationPlaced / afterDeckSetup → 5 层网格（P7 `mechanics.map.configure({adjacency:'rows'})`）、
//     行走路线洗牌（2 张移出游戏）、初始淹没（P7 `mechanics.water`）、Sunken Stairway / Shallow Den 揭示
//   locationRevealed / locationEntered / beforeMove → 险恶道路进入强制效果、破碎遗迹/沉没阶梯/水下秘库
//   actions / performAction → 幕的 [fast] 降淹没、黑曜石地基抽海底壁画、西墙抽 3 张、
//     破碎遗迹符文 V、水下秘库翻面符文 Z、海底壁画翻面符文 W
//   enemySpawned / enemyMoved → 深潜者主母进场搜深潜者敌人、淹没棚屋与完全淹没地点的动态相连
//   actReveal / agendaReveal / checkObjectives → 幕目标（全员抵达另一端）、议程背面（全员被击败 + 无结局）
//   resolveChaosToken / applyTokenEffect / testAutoFail → 11517 混乱标记（skull/cultist/tablet/elder_thing）
//   resolution → 结局 1/2/3 与无结局的跳章（淹没城区 / 养育场 / 沉睡者之墓）、Do No Harm 结算、拉莱耶地图划除
//
// 本章状态只写 state.scenarioFlags / state.scenarioZones / state.campaign.records / mechanicState。
import { registeredEntry } from '../../../../../src/engine/ability.js'
import { mechanicState } from '../../../../../src/engine/mechanic-state.js'
import { configureGrid, connectGrid, gridPosition, placeGridLocation, relocateGridCells } from '../../../../../src/engine/grid-map.js'
import { changeFloodLevel, floodLevel, setFloodLevel } from '../../../../../src/engine/flood.js'
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import {
  isHardSide, locationLevel as chaosLocationLevel, floodLevelOf, theWesternWallChaosToken,
  theWesternWallTokenValue, testAutoFail as chaosTestAutoFail, THE_WESTERN_WALL_TOKEN_MEANINGS, hasTrait,
} from './chaos.js'
import {
  ACT_WEST_CODE, ACT_EAST_CODE, ACT_STAGES, STAGE_CARDS, AGENDA_CODE, AGENDA_STAGES,
  ENCOUNTER_DECK, ENCOUNTER_GROUPS, SET_ASIDE_ALIASES, SET_ASIDE_LOCATION_IDS,
  LOCATIONS, LOCATION_TABLE, LOCATION_COORDINATES, LOCATION_CODES, LEVEL_BY_LOCATION,
  LEVEL_UPPER_SLOTS, LEVEL_BOTTOM_SLOTS, LEVEL_GROUPS_BY_LEVEL, PATH_LOCATION_IDS,
  REMOVED_PATH_COUNT, SPECIAL_LOCATION_IDS, START_LOCATION_WEST, START_LOCATION_EAST,
  REMOVED_STAR_SPAWN_CODES, RESOLUTION_KEYS, RESOLUTION3_CHAPTERS, NEXT_CHAPTER_EAST,
  FLOOD_SETUP, SCENARIO_TEXT, SEAFLOOR_FRIEZE_CODE, UNDERSEA_VAULT_CODE,
  DEEP_ONE_MATRON_CODE, CORAL_STAR_SPAWN_CODE, HUNTING_PARASITE_CODE, INESCAPABLE_CODE, UNDERSEA_VAULT_ID,
  DO_NO_HARM_TASK_CODES, scenario,
} from './definition.js'

const CHAPTER_ID = 'theWesternWall'
const PATH_CODE_SET = new Set(['11521', '11522', '11523', '11524', '11525'])

// ---------------------------------------------------------------------------
// 基础工具
// ---------------------------------------------------------------------------
const activeInvestigators = state => (state.investigators || []).filter(inv => inv && !inv.defeated && !inv.resigned)
const investigatorCount = state => Number(state?.numInvestigators) || (state?.investigators || []).length || 1
const info = (api, message) => api?.info?.(message)
const codeOf = value => String(value?.originalCode || value?.code || '')
const clone = value => structuredClone(value)
const recordsFor = state => {
  state.campaign ||= {}
  state.campaign.records ||= {}
  return state.campaign.records
}
const flagsFor = state => (state.scenarioFlags ||= {})
const setFlag = (state, key, value = true) => { flagsFor(state)[key] = value; return value }
const flagValue = (state, key) => flagsFor(state)[key]
const safeCall = (api, name, ...args) => (typeof api?.[name] === 'function' ? api[name](...args) : null)
const locationOf = (state, id) => (state?.locations || []).find(location => location.id === id) || null
const entryOf = code => (code ? registeredEntry(String(code)) : null)
const flagsOf = code => entryOf(code)?.flags || {}
const randomOf = api => (typeof api?.random === 'function' ? api.random : () => Math.random())
function localShuffle(list, random) {
  const out = [...list]
  for (let index = out.length - 1; index > 0; index -= 1) {
    const pick = Math.floor(random() * (index + 1))
    ;[out[index], out[pick]] = [out[pick], out[index]]
  }
  return out
}
const shuffleWith = (api, list) => (typeof api?.shuffle === 'function' ? api.shuffle([...list]) : localShuffle(list, randomOf(api)))

function setRecord(api, state, key, value) {
  if (typeof api?.setCampaignRecord === 'function') return api.setCampaignRecord(key, value)
  recordsFor(state)[key] = value
  return value
}

export function headedWestOf(state) {
  const records = recordsFor(state)
  if (records.theExpeditionHeadedWest === true) return true
  if (records.theExpeditionHeadedEast === true) return false
  return true // 未记录时按西线（v.I）开发态默认
}

export function directionOf(state) {
  return headedWestOf(state) ? 'west' : 'east'
}

export function startLocation(state) {
  return headedWestOf(state) ? START_LOCATION_WEST : START_LOCATION_EAST
}

// ---------------------------------------------------------------------------
// 淹没读写（P7 原语优先，直调测试退回引擎函数）
// ---------------------------------------------------------------------------
function waterSet(state, api, locationId, level) {
  if (typeof api?.mechanics?.water?.set === 'function') return api.mechanics.water.set(locationId, level)
  return setFloodLevel(state, locationId, level)
}
function waterChange(state, api, locationId, delta) {
  if (typeof api?.mechanics?.water?.change === 'function') return api.mechanics.water.change(locationId, delta)
  return changeFloodLevel(state, locationId, delta)
}
function waterLevel(state, api, locationId) {
  if (typeof api?.mechanics?.water?.level === 'function') return api.mechanics.water.level(locationId)
  if (state?.mechanicState?.flood || mechanicState(state)?.flood) return floodLevel(state, locationId)
  return floodLevelOf(state, locationId)
}
function fullyFlooded(state, api, locationId) {
  return waterLevel(state, api, locationId) >= 2
}

// ---------------------------------------------------------------------------
// 地点网格
// ---------------------------------------------------------------------------
const rowForLevel = (level, headedWest) => {
  const offset = level - 1
  if (offset === 0) return 0
  return headedWest ? -offset : offset
}
const cellForSlot = (slot, headedWest) => ({ x: slot.column, y: rowForLevel(slot.level, headedWest) })

function writeGridCell(state, id, x, y) {
  const data = mechanicState(state, true)
  data.grid ||= {}
  data.grid[id] = { x, y, isolated: false, connections: [] }
  const location = locationOf(state, id)
  if (location) location.grid = { x, y }
  return data.grid[id]
}

function gridCellOf(state, id) {
  const cell = mechanicState(state)?.grid?.[id] || gridPosition(state, id)
  return cell ? { x: cell.x, y: cell.y } : null
}

function rowLevelOf(state, locationId) {
  const location = locationOf(state, locationId)
  if (location && Number.isSafeInteger(location.level)) return location.level
  const cell = gridCellOf(state, locationId)
  return cell ? Math.abs(cell.y) + 1 : null
}

export function rowConnectionsOf(state, locationId) {
  const cell = gridCellOf(state, locationId)
  if (!cell) return []
  return (state.locations || [])
    .filter(location => location.id !== locationId)
    .filter(location => {
      const other = gridCellOf(state, location.id)
      return other && Math.abs(other.y - cell.y) === 1
    })
    .map(location => location.id)
}

/** 淹没棚屋：有深潜者敌人「移动时」视为与每处完全淹没地点相连（简化：持续相连）。 */
export function syncShantyConnections(state, api = {}) {
  const shanty = locationOf(state, 'drownedShanty')
  if (!shanty) return false
  const rule = flagsOf(codeOf(shanty))
  if (rule.deepOneMovingConnectsFlooded === false) return false
  const deepOne = (state.enemies || []).some(enemy => !enemy.defeated && hasTrait(enemy, 'DeepOne'))
  const base = rowConnectionsOf(state, 'drownedShanty')
  const flooded = deepOne
    ? (state.locations || []).filter(location => location.id !== 'drownedShanty' && fullyFlooded(state, api, location.id)).map(location => location.id)
    : []
  shanty.connections = [...new Set([...base, ...flooded])]
  const cell = mechanicState(state, true)?.grid?.drownedShanty
  if (cell) cell.connections = [...shanty.connections]
  return true
}

// ---------------------------------------------------------------------------
// 布置计划
// ---------------------------------------------------------------------------
export function buildPlacement(state, api = {}) {
  if (flagValue(state, 'twwPlacement')) return flagValue(state, 'twwPlacement')
  const headedWest = headedWestOf(state)
  const shuffledPaths = shuffleWith(api, PATH_LOCATION_IDS)
  const removedPaths = shuffledPaths.slice(0, REMOVED_PATH_COUNT)
  const remainingPaths = shuffledPaths.slice(REMOVED_PATH_COUNT)
  const mixed = shuffleWith(api, [...remainingPaths, ...SPECIAL_LOCATION_IDS])
  const upper = mixed.slice(0, 6)
  const bottomMixed = mixed.slice(6)
  const counterpart = headedWest ? 'obsidianFoundations' : 'westernWall'
  const bottom = shuffleWith(api, [counterpart, ...bottomMixed])
  const start = headedWest ? START_LOCATION_WEST : START_LOCATION_EAST
  const plan = {
    headedWest,
    direction: headedWest ? 'west' : 'east',
    startLocationId: start,
    upper: upper.map((id, index) => ({ id, ...LEVEL_UPPER_SLOTS[index], ...cellForSlot(LEVEL_UPPER_SLOTS[index], headedWest) })),
    bottom: bottom.map((id, index) => ({ id, ...LEVEL_BOTTOM_SLOTS[index], ...cellForSlot(LEVEL_BOTTOM_SLOTS[index], headedWest) })),
    removedPaths,
    setAsideLocations: [...SET_ASIDE_LOCATION_IDS],
  }
  setFlag(state, 'twwPlacement', plan)
  return plan
}

export function placedLocationIds(state, api = {}) {
  const plan = buildPlacement(state, api)
  return [plan.startLocationId, ...plan.upper.map(slot => slot.id), ...plan.bottom.map(slot => slot.id)]
}

function findSlot(plan, id) {
  if (plan.startLocationId === id) return { id, level: 1, column: 1, x: 1, y: rowForLevel(1, plan.headedWest) }
  return [...plan.upper, ...plan.bottom].find(slot => slot.id === id) || null
}

// ---------------------------------------------------------------------------
// 布置流程
// ---------------------------------------------------------------------------
export function preScenarioSetup(state, events, helperOrApi = {}) {
  void events
  if (flagValue(state, 'twwPrepared')) return flagValue(state, 'twwPrepared')
  const api = helperOrApi?.api || helperOrApi || {}
  const headedWest = headedWestOf(state)
  const stageSource = state.scenario?.stageCards || STAGE_CARDS
  state.acts = [clone(stageSource[headedWest ? ACT_WEST_CODE : ACT_EAST_CODE] || ACT_STAGES[headedWest ? 'west' : 'east'])]
  state.agendas = [clone((state.scenario?.agendas || [])[0] || AGENDA_STAGES[1])]
  state.actIndex = 0
  state.agendaIndex = 0
  // Do No Harm 任务：拥有该任务（进度面资产）的调查员在开场选择带/留下朝圣者。
  const taskHolders = (state.investigators || []).filter(inv =>
    (inv.assets || []).some(asset => DO_NO_HARM_TASK_CODES.includes(codeOf(asset))))
  if (taskHolders.length) {
    const choice = typeof api.choose === 'function'
      ? api.choose({
        kind: 'story', source: '11517', seat: taskHolders[0].seat,
        prompt: '“不伤害他人”任务：你要如何处置这名重伤的朝圣者？',
        options: [
          { id: 'bringAlong', label: '带上他。我们还能救他。' },
          { id: 'leaveBehind', label: '把他留下。' },
        ],
      })
      : 'bringAlong'
    if (choice === 'leaveBehind') setRecord(api, state, 'theExpeditionLeftThePilgrim', true)
    else setRecord(api, state, 'theExpeditionHelpedThePilgrim', true)
    setFlag(state, 'twwDoNoHarmDecision', choice === 'leaveBehind' ? 'leaveBehind' : 'bringAlong')
    recordsFor(state)
  }
  // 远征装备：每名调查员可选 1 张“远征”物品（东线还可选已获得的文物）。
  chooseExpeditionAssets(state, api, headedWest)
  const report = {
    direction: headedWest ? 'west' : 'east',
    actCode: headedWest ? ACT_WEST_CODE : ACT_EAST_CODE,
    agendaCode: AGENDA_CODE,
    startLocationId: headedWest ? START_LOCATION_WEST : START_LOCATION_EAST,
    helpedThePilgrim: recordsFor(state).theExpeditionHelpedThePilgrim === true,
    leftThePilgrim: recordsFor(state).theExpeditionLeftThePilgrim === true,
  }
  setFlag(state, 'twwPrepared', report)
  info(api, `西墙：${headedWest ? '西线（下潜）' : '东线（攀上）'}；幕 ${report.actCode}。`)
  return report
}

export const prepareScenario = preScenarioSetup

export function expeditionAssetChoices(state, headedWest) {
  const items = Object.entries(ALL_CARDS)
    .filter(([, card]) => card.encounterCode === 'tdc_expedition' && card.type === 'asset')
    .filter(([, card]) => !/露比|安迪/.test(card.nameZh || '') || true)
    .map(([code]) => code)
    .sort()
  const artifacts = headedWest
    ? []
    : ((state?.campaign?.recordSets?.tdcArtifactsEarned) || [])
  return { items, artifacts: [...artifacts] }
}

function chooseExpeditionAssets(state, api, headedWest) {
  const { items, artifacts } = expeditionAssetChoices(state, headedWest)
  const pool = [...new Set([...items, ...artifacts])]
  if (!pool.length) return []
  const chosen = []
  for (const inv of state.investigators || []) {
    if (inv.defeated || inv.resigned) continue
    const options = [{ id: 'none', label: '不选择远征装备' }, ...pool.map(code => ({
      id: code, label: ALL_CARDS[code]?.nameZh || code, cardCode: code,
    }))]
    const pick = typeof api.choose === 'function'
      ? api.choose({ kind: 'card', source: '11517', seat: inv.seat, prompt: '选择一张在你的控制下开始游戏的远征装备。', options })
      : 'none'
    if (!pick || pick === 'none' || !pool.includes(pick)) continue
    if (typeof api.giveAsset === 'function') api.giveAsset(inv.seat, pick)
    else {
      inv.assets ||= []
      inv.assets.push({ id: `asset-${pick}-${inv.assets.length + 1}`, code: pick, originalCode: pick, controllerSeat: inv.seat })
    }
    chosen.push({ seat: inv.seat, code: pick })
  }
  setFlag(state, 'twwExpeditionAssets', chosen)
  return chosen
}

export function setupLocations(state, events = null, helper = {}) {
  void events
  const api = helper?.api || {}
  preScenarioSetup(state, null, { api })
  state.scenarioZones ||= {}
  state.scenarioZones.setAside = [...SET_ASIDE_ALIASES]
  state.scenarioZones.setAsideLocations = [...SET_ASIDE_LOCATION_IDS]
  state.scenarioZones.removed = [...REMOVED_STAR_SPAWN_CODES]
  state.encounterDeck ||= [...ENCOUNTER_DECK]
  // 先声明「按行相连」；地点入场时由 afterDeckSetup 统一重算连接。
  if (typeof api?.mechanics?.map?.configure === 'function') api.mechanics.map.configure({ adjacency: 'rows' })
  else configureGrid(state, { adjacency: 'rows' })
  const plan = buildPlacement(state, api)
  info(api, `西墙布置：行走路线 ${PATH_LOCATION_IDS.length} 张中移出 ${plan.removedPaths.length} 张；`
    + `入场 ${1 + plan.upper.length + plan.bottom.length} 处地点。`)
  return placedLocationIds(state, api)
}

export function locationPlaced(state, location, api = {}, seat = null) {
  void seat
  if (!location) return
  const plan = flagValue(state, 'twwPlacement') || buildPlacement(state, api)
  const slot = findSlot(plan, location.id)
  if (slot) {
    writeGridCell(state, location.id, slot.x, slot.y)
    location.level = slot.level
    location.grid = { x: slot.x, y: slot.y }
    const card = ALL_CARDS[codeOf(location)] || {}
    if (PATH_CODE_SET.has(codeOf(location))) location.shroud = slot.level
    else if (Number(card.shroud) >= 0) location.shroud = Number(card.shroud)
    else location.shroud = slot.level
    const perPlayer = Number(location.cluesPerInvestigator)
    if (Number.isFinite(perPlayer)) location.clues = perPlayer * investigatorCount(state)
    else if (Number.isFinite(Number(card.clues))) location.clues = Number(card.clues)
    if (codeOf(location) === UNDERSEA_VAULT_CODE) {
      location.revealed = true
      location.shroud = 5
      location.clues = 1
    }
  }
  void api
}

export function afterDeckSetup(state, events = null, helper = {}) {
  void events
  const api = helper?.api || {}
  const prepared = flagValue(state, 'twwPrepared') || preScenarioSetup(state, null, { api })
  const plan = buildPlacement(state, api)
  // 1) 网格 + 按行相连（同层不连通、相邻整层全互通）。
  if (typeof api?.mechanics?.map?.configure === 'function') api.mechanics.map.configure({ adjacency: 'rows' })
  else configureGrid(state, { adjacency: 'rows' })
  // 2) 地点层级与淹没初始值。
  const flood = FLOOD_SETUP[prepared.direction] || FLOOD_SETUP.west
  const placed = placedLocationIds(state, { ...api, shuffle: api.shuffle })
  for (const id of placed) {
    const location = locationOf(state, id)
    if (!location) continue
    const level = location.level ?? rowLevelOf(state, id) ?? 1
    // 西线：2–5 层提高 1 级、4–5 层再提高 1 级；东线：1–4 层 +1、1–2 层再 +1。
    let target = 0
    if (flood.floodLevels.includes(level)) target += 1
    if (flood.fullyFloodLevels.includes(level)) target += 1
    if (target > 0) waterSet(state, api, id, target)
  }
  // 3) 连接重算：connectGrid 按「相差一行」重写每处地点的 connections（同层不连通）。
  connectGrid(state)
  // 4) 「远征队抛弃了朝圣者」：起始地点不放线索。
  if (recordsFor(state).theExpeditionLeftThePilgrim === true) {
    const startId = prepared.startLocationId || startLocation(state)
    const start = locationOf(state, startId)
    if (start) start.clues = 0
  }
  // 5) 「远征队帮助了朝圣者」：布置后在议程上放 1 个毁灭标记。
  if (recordsFor(state).theExpeditionHelpedThePilgrim === true) {
    if (typeof api.addDoom === 'function') api.addDoom(1)
    else state.doom = (Number(state.doom) || 0) + 1
  }
  syncShantyConnections(state, api)
  setFlag(state, 'twwSetup', { ...prepared, placedIds: placed, removedPaths: [...plan.removedPaths] })
  info(api, `西墙布置完成：${placed.length} 处地点入场；淹没等级按${prepared.direction === 'west' ? '西' : '东'}线规则设置。`)
  return { ...prepared, placedIds: placed, removedPaths: [...plan.removedPaths] }
}

/** 单测/直调入口：完整布置（不依赖引擎 placeLocation 管线）。 */
export function setupScenario(state, api = {}) {
  state.locations = []
  state.scenarioFlags ||= {}
  delete state.scenarioFlags.twwPrepared
  delete state.scenarioFlags.twwPlacement
  delete state.scenarioFlags.twwSetup
  const prepared = preScenarioSetup(state, null, { api })
  const plan = buildPlacement(state, api)
  const ids = placedLocationIds(state, api)
  for (const id of ids) {
    const definition = LOCATIONS[id]
    const instance = {
      ...clone(definition),
      revealed: codeOf(definition) === UNDERSEA_VAULT_CODE,
      connections: [...definition.connections],
      clues: 0,
      attachments: definition.attachments || [],
    }
    const card = ALL_CARDS[codeOf(definition)] || {}
    if (card.victory != null) instance.victory = card.victory
    state.locations.push(instance)
    locationPlaced(state, instance, api)
  }
  state.investigators ||= []
  const startId = prepared.startLocationId || startLocation(state)
  for (const inv of state.investigators) if (!inv.location) inv.location = startId
  if (!state.encounterDeck?.length) state.encounterDeck = [...ENCOUNTER_DECK]
  state.scenarioZones ||= {}
  state.scenarioZones.setAside = [...SET_ASIDE_ALIASES]
  state.scenarioZones.setAsideLocations = [...SET_ASIDE_LOCATION_IDS]
  state.scenarioZones.removed = [...REMOVED_STAR_SPAWN_CODES, ...plan.removedPaths.map(id => LOCATIONS[id].code)]
  const report = afterDeckSetup(state, null, { api })
  return {
    ...report,
    startLocationId: startId,
    levelCounts: countLevels(state),
    floodByLevel: floodLevelsByLevel(state, api),
  }
}

export function countLevels(state) {
  const counts = {}
  for (const location of state.locations || []) {
    const level = location.level ?? rowLevelOf(state, location.id)
    if (level == null) continue
    counts[level] = (counts[level] || 0) + 1
  }
  return counts
}

export function floodLevelsByLevel(state, api = {}) {
  const out = {}
  for (const location of state.locations || []) {
    const level = location.level ?? rowLevelOf(state, location.id)
    if (level == null) continue
    out[level] ||= {}
    out[level][location.id] = waterLevel(state, api, location.id)
  }
  return out
}

// ---------------------------------------------------------------------------
// 移动/进入
// ---------------------------------------------------------------------------
export function beforeMove(state, inv, destination, api = {}, options = {}) {
  void options
  if (!inv || !destination) return true
  flagsFor(state).twwPreviousLocation ||= {}
  flagsFor(state).twwPreviousLocation[inv.seat] = inv.location
  // 险恶道路背面：如果你所在地点有线索，你不能进入险恶道路。
  const entry = flagsOf(codeOf(destination))
  if (entry.cannotEnterFromClues === true) {
    const here = locationOf(state, inv.location)
    if (here && (Number(here.clues) || 0) > 0) {
      info(api, `${inv.name} 不能从有线索的「${here.name}」进入险恶道路。`)
      return false
    }
  }
  return true
}

export function locationEntered(state, inv, location, api = {}) {
  if (!inv || !location || inv.defeated || inv.resigned) return false
  const flags = flagsOf(codeOf(location))
  if (!flags.treacherousPath) return false
  const previousId = (flagValue(state, 'twwPreviousLocation') || {})[inv.seat]
  const previous = locationOf(state, previousId)
  const prevLevel = previous ? (previous.level ?? rowLevelOf(state, previous.id)) : null
  const level = location.level ?? rowLevelOf(state, location.id) ?? 1
  // 11521 Slick Steps：从上方进来受 1 伤害、从下方进来受 1 恐惧。
  if (flags.enterFromAbove && prevLevel != null && prevLevel > level) {
    safeCall(api, 'damage', inv.seat, flags.enterFromAbove.damage || 1)
    info(api, `险恶道路（湿滑台阶）：${inv.name} 从上方进入，受到 1 点伤害。`)
  }
  if (flags.enterFromBelow && prevLevel != null && prevLevel < level) {
    safeCall(api, 'horror', inv.seat, flags.enterFromBelow.horror || 1)
    info(api, `险恶道路（湿滑台阶）：${inv.name} 从下方进入，受到 1 点恐惧。`)
  }
  // 11522：敏捷(层) 失败 → 1 伤害 + 提高淹没。
  if (flags.enterTest?.skill) {
    const spec = flags.enterTest
    runEnterTest(state, inv, location, api, spec, level)
  }
  return true
}

function runEnterTest(state, inv, location, api, spec, level) {
  const difficulty = Number(spec.difficultyPerLevel) ? level + Number(spec.difficultyPerLevel) - 1 : level
  const onFail = () => {
    if (spec.failDamage) safeCall(api, 'damage', inv.seat, spec.failDamage)
    if (spec.failHorror) safeCall(api, 'horror', inv.seat, spec.failHorror)
    if (spec.increaseFlood) {
      if (waterLevel(state, api, location.id) < 2) waterChange(state, api, location.id, 1)
      else if (spec.discardAllyIfNoFlood) safeCall(api, 'discardRandom', inv.seat, 1)
    }
    info(api, `险恶道路（${location.subname || location.name}）：${inv.name} 检定失败。`)
  }
  if (typeof api.test === 'function') {
    api.test(inv.seat, spec.skill, difficulty, result => { if (!result?.success) onFail() })
  }
}

// ---------------------------------------------------------------------------
// 地点揭示（11525 / 11526）
// ---------------------------------------------------------------------------
export function locationRevealed(state, location, api = {}, seat = null) {
  if (!location) return false
  const flags = flagsOf(codeOf(location))
  if (flags.spawnCoralStarSpawnOnReveal) {
    const enemy = spawnAt(state, CORAL_STAR_SPAWN_CODE, location.id, api, { exhausted: true })
    if (enemy) {
      enemy.doesNotReadyDuringUpkeep = true
      setFlag(state, 'twwCoralStarSpawnNotReady', true)
    }
    info(api, `险恶道路（浅滩巢穴）被揭示：珊瑚星之眷族以横置状态生成。`)
    return true
  }
  if (flags.revealUnderseaVault) {
    const cell = gridCellOf(state, location.id) || { x: 1, y: 0 }
    const candidates = []
    for (const rowOffset of [1, -1]) {
      const row = cell.y + rowOffset
      for (let column = 0; column <= 2; column += 1) {
        const occupied = (state.locations || []).some(item => {
          const other = gridCellOf(state, item.id)
          return other && other.x === column && other.y === row
        })
        if (!occupied) candidates.push({ x: column, y: row, label: rowOffset > 0 ? '上方一行' : '下方一行' })
      }
    }
    if (!candidates.length) {
      info(api, '沉没阶梯：上下方没有空格可放置水下秘库。')
      return false
    }
    const choice = typeof api.choose === 'function'
      ? api.choose({
        kind: 'location', source: '11526', seat: seat ?? 0,
        prompt: '把放到一边的水下秘库放在沉没阶梯上方还是下方的一行？',
        options: candidates.map((candidate, index) => ({ id: String(index), label: `${candidate.label}（${candidate.x}, ${candidate.y}）` })),
      })
      : '0'
    const picked = candidates[Number(choice) || 0] || candidates[0]
    placeLocationAtCell(state, UNDERSEA_VAULT_ID, picked, api)
    info(api, `沉没阶梯被揭示：水下秘库放在${picked.label}。`)
    return true
  }
  return false
}

export function placeLocationAtCell(state, locationId, cell, api = {}) {
  if (locationOf(state, locationId)) return locationOf(state, locationId)
  const definition = LOCATIONS[locationId]
  if (!definition) return null
  const instance = {
    ...clone(definition), revealed: true, connections: [], clues: 0, attachments: [],
  }
  state.locations ||= []
  state.locations.push(instance)
  writeGridCell(state, locationId, cell.x, cell.y)
  instance.revealed = true
  instance.shroud = 5
  instance.clues = 1
  setFlag(state, `twwPlaced_${locationId}`, { x: cell.x, y: cell.y })
  connectGrid(state)
  syncShantyConnections(state, api)
  return instance
}

// ---------------------------------------------------------------------------
// 敌人
// ---------------------------------------------------------------------------
function spawnAt(state, code, locationId, api, options = {}) {
  if (typeof api.spawn === 'function') return api.spawn(code, locationId, options)
  const definition = (state.scenario?.enemies || scenario.enemies)?.[code] || {}
  const enemy = {
    id: `${code}-${(state.enemies || []).length + 1}`, code, originalCode: code,
    name: definition.name, location: locationId, fight: definition.fight ?? null,
    evade: definition.evade ?? null, health: definition.health ?? null,
    damage: definition.damage || 0, horror: definition.horror || 0,
    traits: [...(definition.traits || [])], exhausted: options.exhausted === true,
    engagedSeat: options.engagedSeat ?? null, damageTaken: 0, doom: 0, clues: 0,
    attachments: [], victory: Number(definition.victory) || 0,
  }
  state.enemies ||= []
  state.enemies.push(enemy)
  return enemy
}

/** 深潜者主母：「生成 - 任意已揭示地点（尽可能淹没棚屋）」+ 进场搜深潜者敌人。 */
export function spawnLocation(state, code, fallback, engagedSeat, api = {}) {
  if (String(code) !== DEEP_ONE_MATRON_CODE) return null
  const shanty = locationOf(state, 'drownedShanty')
  if (shanty && shanty.revealed) return 'drownedShanty'
  void fallback
  void engagedSeat
  void api
  return null
}

export function enemySpawned(state, enemy, api = {}) {
  if (!enemy) return false
  const flags = flagsOf(codeOf(enemy))
  if (flags.searchDeepOneOnEnter !== true) return false
  const isDeepOneEnemy = code => {
    const card = ALL_CARDS[code] || {}
    return card.type === 'enemy' && hasTrait(card, 'DeepOne')
  }
  let found = null
  const deck = state.encounterDeck || []
  const deckCode = [...deck].reverse().find(isDeepOneEnemy)
  if (deckCode) {
    if (typeof api.takeEncounterDeckCard === 'function') api.takeEncounterDeckCard(deckCode)
    else state.encounterDeck = deck.filter((code, index) => !(code === deckCode && index === deck.lastIndexOf(deckCode)))
    found = deckCode
  } else {
    const discard = state.encounterDiscard || []
    const discardCode = [...discard].reverse().find(isDeepOneEnemy)
    if (discardCode) {
      if (typeof api.takeEncounterDiscard === 'function') api.takeEncounterDiscard(discardCode)
      else state.encounterDiscard = discard.filter(code => code !== discardCode || false)
      found = discardCode
    }
  }
  if (found) {
    spawnAt(state, found, enemy.location, api)
    info(api, `深潜者主母进场：从遭遇牌库/弃牌堆找出「${ALL_CARDS[found]?.nameZh || found}」并生成。`)
  }
  return Boolean(found)
}

export function enemyMoved(state, enemy, previous, api = {}) {
  void previous
  if (enemy && hasTrait(enemy, 'DeepOne')) syncShantyConnections(state, api)
  return false
}

// ---------------------------------------------------------------------------
// 行动
// ---------------------------------------------------------------------------
const groupCluesAt = (state, locationId) => activeInvestigators(state)
  .filter(inv => inv.location === locationId)
  .reduce((sum, inv) => sum + (Number(inv.clues) || 0), 0)
const spendGroupClues = (state, locationId, amount) => {
  let remaining = Math.max(0, Number(amount) || 0)
  for (const inv of activeInvestigators(state).filter(item => item.location === locationId)) {
    if (remaining <= 0) break
    const spend = Math.min(Number(inv.clues) || 0, remaining)
    inv.clues -= spend
    remaining -= spend
  }
  return remaining === 0
}

function attachedFriezeAt(state, locationId) {
  const location = locationOf(state, locationId)
  return (location?.attachments || []).find(attachment => codeOf(attachment) === SEAFLOOR_FRIEZE_CODE) || null
}

export function actions(state, inv) {
  if (!inv || inv.defeated || inv.resigned) return []
  const here = locationOf(state, inv.location)
  if (!here) return []
  const moves = []
  const required = investigatorCount(state)
  const available = groupCluesAt(state, here.id)
  const flags = flagsOf(codeOf(here))
  // 幕的 [fast]：调查员共同花费 1[per_investigator] 线索，降低所在地点的淹没等级。
  const actRule = flagsOf(codeOf((state.acts || [])[state.actIndex ?? 0]))
  moves.push({
    action: 'scenarioAction', rule: 'twwDecreaseFlood', locationId: here.id, actions: 0,
    label: `团队共同花费 ${required} 个线索：降低「${here.name}」的淹没等级`,
    reason: actRule.fastDecreaseFlood !== true
      ? '当前幕没有该行动'
      : waterLevel(state, {}, here.id) <= 0
        ? '本地点没有淹没等级可降低'
        : (available >= required ? null : `需要本地点共 ${required} 个线索（现有 ${available}）`),
  })
  // 黑曜石地基：[action] 智力(3) 成功 → 抽取放到一边的海底壁画。
  if (flags.drawFriezeAction === true) {
    moves.push({
      action: 'scenarioAction', rule: 'twwObsidianFoundations', locationId: here.id, actions: 1,
      label: '检定智力(3)：成功则抽取放到一边的海底壁画[tdc_rune_w]',
    })
  }
  // 西墙：[action][action] 抽 3 张（每场游戏限一次）。
  if (Number(flags.doubleActionDraw) > 0) {
    moves.push({
      action: 'scenarioAction', rule: 'twwWesternWallDraw', locationId: here.id, actions: 2,
      label: `抽取 ${flags.doubleActionDraw} 张卡牌（每场游戏限一次）`,
      reason: flagValue(state, 'twwWesternWallDrew') ? '本场游戏已经抽过' : null,
    })
  }
  // 破碎遗迹：未淹没时发现符文 V。
  if (flags.glyphAction?.letter) {
    const flooded = waterLevel(state, {}, here.id) > 0
    moves.push({
      action: 'scenarioAction', rule: 'twwLocationGlyph', locationId: here.id, actions: 1,
      label: `如果本地未淹没，发现符文 ${flags.glyphAction.letter}（${flags.glyphAction.meaning}）`,
      reason: flooded ? '本地已被淹没，不能发现符文' : null,
    })
  }
  // 水下秘库：智力(层级) 成功则翻面结算符文 Z。
  if (flags.vaultFlipAction === true && flagValue(state, 'twwVaultFlipped') !== true) {
    moves.push({
      action: 'scenarioAction', rule: 'twwUnderseaVault', locationId: here.id, actions: 1,
      label: `检定智力(${here.level ?? rowLevelOf(state, here.id) ?? 1})：成功则翻开水面秘库，发现符文 Z（城市）`,
    })
  }
  // 海底壁画：两次检定（战斗力 2、意志 2）成功后翻面。
  const frieze = attachedFriezeAt(state, here.id)
  if (frieze && flagsOf(SEAFLOOR_FRIEZE_CODE).friezeAction === true) {
    moves.push({
      action: 'scenarioAction', rule: 'twwSeafloorFrieze', locationId: here.id, actions: 1,
      label: '检定战斗力(2)再检定意志(2)：两次成功则翻面结算海底壁画（符文 W 寄生虫）',
    })
  }
  return moves
}

export function performAction(state, inv, move, api = {}) {
  if (!move || !inv || inv.defeated || inv.resigned) return false
  if (move.rule === 'twwDecreaseFlood') return decreaseFloodAction(state, inv, api)
  if (move.rule === 'twwObsidianFoundations') return drawFriezeAction(state, inv, api)
  if (move.rule === 'twwWesternWallDraw') return drawThreeAction(state, inv, api)
  if (move.rule === 'twwLocationGlyph') return locationGlyphAction(state, inv, api)
  if (move.rule === 'twwUnderseaVault') return vaultFlipAction(state, inv, api)
  if (move.rule === 'twwSeafloorFrieze') return friezeFlipAction(state, inv, api)
  return false
}

function decreaseFloodAction(state, inv, api) {
  const here = locationOf(state, inv.location)
  if (!here) return false
  const required = investigatorCount(state)
  if (groupCluesAt(state, here.id) < required) return false
  if (waterLevel(state, api, here.id) <= 0) return false
  spendGroupClues(state, here.id, required)
  waterChange(state, api, here.id, -1)
  info(api, `${inv.name} 与同伴花费 ${required} 个线索，降低「${here.name}」的淹没等级。`)
  return true
}

function drawFriezeAction(state, inv, api) {
  const here = locationOf(state, inv.location)
  if (!here) return false
  const draw = () => {
    const setAside = state.scenarioZones?.setAside || (state.scenarioZones ||= {}).setAside || []
    const index = setAside.indexOf(SEAFLOOR_FRIEZE_CODE)
    if (index >= 0) setAside.splice(index, 1)
    if (typeof api.drawEncounter === 'function') {
      if (typeof api.putOnEncounterDeck === 'function') api.putOnEncounterDeck([SEAFLOOR_FRIEZE_CODE])
      api.drawEncounter(inv.seat)
    } else {
      const location = here
      location.attachments ||= []
      location.attachments.push({
        id: `${SEAFLOOR_FRIEZE_CODE}:${location.id}`, code: SEAFLOOR_FRIEZE_CODE,
        originalCode: SEAFLOOR_FRIEZE_CODE, name: ALL_CARDS[SEAFLOOR_FRIEZE_CODE]?.nameZh,
      })
    }
  }
  if (typeof api.test === 'function') {
    api.test(inv.seat, 'intellect', 3, result => { if (result?.success) draw() })
    return true
  }
  return false
}

function drawThreeAction(state, inv, api) {
  if (flagValue(state, 'twwWesternWallDrew')) return false
  setFlag(state, 'twwWesternWallDrew', true)
  if (typeof api.drawCards === 'function') api.drawCards(inv.seat, 3)
  else {
    inv.hand ||= []
    for (let index = 0; index < 3; index += 1) inv.hand.push(`tww-draw-${index}`)
  }
  info(api, `${inv.name} 在西墙抽取 3 张卡牌。`)
  return true
}

function locationGlyphAction(state, inv, api) {
  const here = locationOf(state, inv.location)
  if (!here) return false
  const flags = flagsOf(codeOf(here))
  const glyph = flags.glyphAction
  if (!glyph?.letter) return false
  if (waterLevel(state, api, here.id) > 0) return false
  addGlyph(state, api, glyph.letter, glyph.meaning)
  info(api, `${inv.name} 在「${here.name}」发现符文 ${glyph.letter}（${glyph.meaning}）。`)
  return true
}

function vaultFlipAction(state, inv, api) {
  const here = locationOf(state, inv.location)
  if (!here || flagValue(state, 'twwVaultFlipped') === true) return false
  const flags = flagsOf(UNDERSEA_VAULT_CODE)
  if (flags.vaultFlipAction !== true) return false
  const glyph = flags.glyph || { letter: 'Z', meaning: '城市' }
  const level = here.level ?? rowLevelOf(state, here.id) ?? 1
  const succeed = () => {
    setFlag(state, 'twwVaultFlipped', true)
    addGlyph(state, api, glyph.letter, glyph.meaning)
    here.flipped = true
    info(api, `${inv.name} 打开水下秘库，发现符文 ${glyph.letter}（${glyph.meaning}）；卡牌翻回地点面且不能再翻。`)
  }
  if (typeof api.test === 'function') {
    api.test(inv.seat, 'intellect', level, result => { if (result?.success) succeed() })
    return true
  }
  return false
}

function friezeFlipAction(state, inv, api) {
  const here = locationOf(state, inv.location)
  if (!here) return false
  const frieze = attachedFriezeAt(state, here.id)
  if (!frieze) return false
  const storyFlags = flagsOf('11531b')
  const glyph = storyFlags.glyph || { letter: 'W', meaning: '寄生虫' }
  const finish = () => {
    here.attachments = (here.attachments || []).filter(item => item !== frieze)
    addGlyph(state, api, glyph.letter, glyph.meaning)
    if (typeof api.addStoryToVictory === 'function') api.addStoryToVictory('11531b', { sourceId: frieze.id })
    else {
      state.victoryDisplay ||= []
      state.victoryDisplay.push({ id: frieze.id, code: '11531b', originalCode: '11531b', victory: 1 })
    }
    info(api, `${inv.name} 翻面海底壁画，发现符文 ${glyph.letter}（${glyph.meaning}），本卡加入胜利区。`)
  }
  const second = () => {
    if (typeof api.test !== 'function') return
    api.test(inv.seat, 'willpower', 2, result => { if (result?.success) finish() })
  }
  if (typeof api.test !== 'function') return false
  api.test(inv.seat, 'combat', 2, result => { if (result?.success) second() })
  return true
}

export function addGlyph(state, api, letter, meaning) {
  const records = recordsFor(state)
  const glyphs = new Set(Array.isArray(records.discoveredGlyphs) ? records.discoveredGlyphs : [])
  glyphs.add(letter)
  records.discoveredGlyphs = [...glyphs]
  setFlag(state, 'twwGlyphTranslation', { ...(flagsFor(state).twwGlyphTranslation || {}), [letter]: meaning })
  if (typeof api?.mechanics?.recordSets?.add === 'function') api.mechanics.recordSets.add('tdcGlyphs', letter)
  return true
}

// ---------------------------------------------------------------------------
// 幕 / 议程
// ---------------------------------------------------------------------------
export function checkObjectives(state, api = {}) {
  if (state.status && state.status !== 'playing') return false
  const act = (state.acts || [])[state.actIndex ?? 0]
  if (!act) return false
  const actCode = codeOf(act)
  const actRule = flagsOf(actCode)
  const west = actCode === ACT_WEST_CODE
  const east = actCode === ACT_EAST_CODE
  if (!west && !east) return false
  const target = actRule.objectiveAllAt || (west ? 'obsidianFoundations' : 'westernWall')
  const alive = activeInvestigators(state)
  if (!alive.length) return false
  if (alive.every(inv => inv.location === target)) {
    info(api, `幕目标达成：所有存活调查员抵达「${locationOf(state, target)?.name || target}」。`)
    safeCall(api, 'advanceAct')
    return true
  }
  return false
}

export function roundEnded(state, api = {}) {
  syncShantyConnections(state, api)
  return false
}

export function actReveal(state, act, api = {}) {
  const code = codeOf(act)
  if (code === ACT_WEST_CODE) {
    // 参考实现：西线下潜的幕背面是 R1（海洋深处），R1 页「跳过至结局 3」。
    // 战役层把「西线的跳章选择」绑在结局 3（见 flow.js 注释），因此这里直接结算为 resolution3。
    info(api, '幕 1 背面（海洋深处）：R1 → 跳过至结局 3（跳章选择由战役流程结算）。')
    safeCall(api, 'finish', 'resolution3')
    setFlag(state, 'twwResolution', 'resolution3')
    setFlag(state, 'twwResolutionEntry', 'resolution1')
    return true
  }
  if (code === ACT_EAST_CODE) {
    info(api, '幕 1 背面（返回水面）：进入结局 2。')
    safeCall(api, 'finish', 'resolution2')
    setFlag(state, 'twwResolution', 'resolution2')
    return true
  }
  return false
}

export function agendaReveal(state, agenda, api = {}) {
  if (codeOf(agenda) !== AGENDA_CODE) return false
  let count = 0
  for (const inv of activeInvestigators(state)) {
    safeCall(api, 'addTrauma', inv.seat, 'mental', 1)
    if (typeof api.defeat === 'function') api.defeat(inv)
    else inv.defeated = true
    count += 1
  }
  // 无结局：西线同样「跳过至结局 3」（战役跳章），东线直接无结局进入沉睡者之墓。
  const key = headedWestOf(state) ? 'resolution3' : 'noResolution'
  info(api, `议程背面（走错一步）：${count} 位调查员被击败并各承受 1 点精神创伤；结局键 ${key}。`)
  safeCall(api, 'finish', key)
  setFlag(state, 'twwResolution', key)
  if (key === 'resolution3') setFlag(state, 'twwResolutionEntry', 'noResolution')
  return true
}

// ---------------------------------------------------------------------------
// 混乱标记
// ---------------------------------------------------------------------------
export function resolveChaosToken(state, inv, token) {
  return theWesternWallChaosToken(state, inv, token)
}

export function chaosTokenValue(state, inv, tokenFace) {
  return theWesternWallTokenValue(state, inv, tokenFace)
}

export function tokenMeanings() {
  return THE_WESTERN_WALL_TOKEN_MEANINGS
}

export function testAutoFail(state, inv, context = {}) {
  return chaosTestAutoFail(state, inv, context)
}

export function applyTokenEffect(state, inv, effect = {}, api = {}) {
  const mode = String(effect.mode || '')
  const locationId = inv?.location
  if (!locationId) return false
  if (mode === 'floodedDamage') {
    if (!fullyFlooded(state, api, locationId)) {
      info(api, '标记效果：你所在地点并非完全淹没，不受伤。')
      return true
    }
    safeCall(api, 'damage', inv.seat, 1)
    info(api, `标记效果：${inv.name} 位于完全淹没地点，受到 1 点伤害。`)
    return true
  }
  if (mode === 'increaseFloodLevel') {
    if (waterLevel(state, api, locationId) >= 2) {
      info(api, '标记效果：你所在地点的淹没等级无法再提高。')
      return true
    }
    waterChange(state, api, locationId, 1)
    syncShantyConnections(state, api)
    info(api, `标记效果：提高「${locationOf(state, locationId)?.name || locationId}」的淹没等级。`)
    return true
  }
  return false
}

// ---------------------------------------------------------------------------
// 结局
// ---------------------------------------------------------------------------
export function resolution3Choices() {
  return RESOLUTION3_CHAPTERS.map(id => ({ id, label: id === 'theDrownedQuarter' ? '前往《淹没城区》' : '前往《养育场》' }))
}

export function chooseResolution3(state, api = {}) {
  const options = resolution3Choices()
  if (typeof api.choose !== 'function') return NEXT_CHAPTER_EAST
  const pick = api.choose({
    kind: 'story', source: '11517', seat: state?.campaign?.leadSeat ?? 0,
    prompt: '海床圆顶与拉莱耶地下入口都在眼前：你们要前往哪里？',
    options,
  })
  return options.some(option => option.id === pick) ? pick : null
}

export function nextChapterFor(state, key) {
  const west = headedWestOf(state)
  if (key === 'resolution2') return NEXT_CHAPTER_EAST
  if (key === 'resolution3') return (flagsFor(state).twwResolution3Chapter) || null
  if (key === 'resolution1') return (flagsFor(state).twwResolution3Chapter) || null
  // noResolution
  return west ? (flagsFor(state).twwResolution3Chapter || null) : NEXT_CHAPTER_EAST
}

/** Do No Harm 任务：按“是否帮助朝圣者”结算（经验/创伤/进度/寄生虫弱点入牌库）。 */
export function resolveDoNoHarm(state, api = {}) {
  const helped = recordsFor(state).theExpeditionHelpedThePilgrim === true
  const applied = []
  for (const inv of state.investigators || []) {
    const task = (inv.assets || []).find(asset => DO_NO_HARM_TASK_CODES.includes(codeOf(asset)))
    if (!task) continue
    if (helped) {
      if (typeof api.putOnTopOfDeck === 'function') api.putOnTopOfDeck(inv.seat, HUNTING_PARASITE_CODE)
      else {
        inv.deck ||= []
        inv.deck.push(HUNTING_PARASITE_CODE)
      }
      if (typeof api?.mechanics?.progress?.change === 'function'
        && api.mechanics.progress.forSeat?.('tdcTask', inv.seat)?.option === 'doNoHarm') {
        api.mechanics.progress.change('tdcTask', inv.seat, 2, 'western-wall-do-no-harm')
      }
      info(api, `${inv.name} 的“不伤害他人”：猎食寄生虫永久加入牌库；标记 2 点进度。`)
    } else {
      safeCall(api, 'addTrauma', inv.seat, 'mental', 1)
      if (typeof api?.mechanics?.progress?.change === 'function'
        && api.mechanics.progress.forSeat?.('tdcTask', inv.seat)?.option === 'doNoHarm') {
        api.mechanics.progress.change('tdcTask', inv.seat, -1, 'western-wall-do-no-harm')
      }
      info(api, `${inv.name} 的“不伤害他人”：承受 1 点精神创伤；擦除 1 点进度。`)
    }
    applied.push({ seat: inv.seat, helped })
  }
  return applied
}

export function resolution(state, key, events = null, api = {}) {
  void events
  const infoApi = api?.info ? api : api?.api || {}
  const finalKey = RESOLUTION_KEYS.includes(String(key)) ? String(key) : 'noResolution'
  const records = recordsFor(state)
  // 拉莱耶地图：划掉「西墙」（战役记录集合的规范 id，见 records.js#TDC_RLYEH_MAP_IDS）。
  const map = new Set(Array.isArray(records.rlyehMap) ? records.rlyehMap : [])
  map.add('rlyehWesternWall')
  records.rlyehMap = [...map]
  setFlag(state, 'twwResolution', finalKey)
  // Do No Harm（任何结局都结算）。
  const doNoHarm = resolveDoNoHarm(state, infoApi)
  // 跳章由战役流程（westernWallShortcut / routeRouter）按 resolution 键与路线记录决定；
  // 这里只给 flowData 一份只读提示，方便账本/测试读取。
  const nextChapter = finalKey === 'resolution2' || (finalKey === 'noResolution' && !headedWestOf(state))
    ? NEXT_CHAPTER_EAST
    : null
  info(infoApi, `西墙结局 ${finalKey}：拉莱耶地图划掉「西墙」；Do No Harm 结算 ${doNoHarm.length} 人；`
    + `跳章 ${nextChapter ? `→ ${nextChapter}` : '由战役流程的结局 3 选择决定'}。`)
  return {
    bonus: 0,
    award: true,
    flowData: {
      resolution: finalKey,
      resolutionEntry: flagValue(state, 'twwResolutionEntry') || finalKey,
      ...(nextChapter ? { nextChapter } : {}),
      resolution3Choices: RESOLUTION3_CHAPTERS,
    },
  }
}

// ---------------------------------------------------------------------------
// 只读投影
// ---------------------------------------------------------------------------
export function scenarioSummary(state, api = {}) {
  return {
    direction: directionOf(state),
    act: codeOf((state.acts || [])[state.actIndex ?? 0]),
    agenda: codeOf((state.agendas || [])[state.agendaIndex ?? 0]),
    startLocationId: startLocation(state),
    locations: (state.locations || []).length,
    levelCounts: countLevels(state),
    flood: floodLevelsByLevel(state, api),
    doNoHarm: flagsFor(state).twwDoNoHarmDecision || null,
    boostedParasite: recordsFor(state).theExpeditionHelpedThePilgrim === true,
  }
}

export function implementedEntryFlags(code) {
  return flagsOf(code)
}

export const events = {
  theWesternWallGlyph(state, payload = {}, api = {}) {
    const location = locationOf(state, payload.locationId)
    const flags = flagsOf(codeOf(location))
    if (!flags.glyphAction?.letter) return false
    addGlyph(state, api, flags.glyphAction.letter, flags.glyphAction.meaning)
    return true
  },
}

export const behavior = {
  id: CHAPTER_ID,
  startLocation,
  locationsStartRevealed: false,
  preScenarioSetup,
  prepareScenario,
  setupScenario,
  setupLocations,
  locationPlaced,
  locationRevealed,
  afterDeckSetup,
  beforeMove,
  locationEntered,
  actions,
  performAction,
  enemySpawned,
  enemyMoved,
  spawnLocation,
  checkObjectives,
  roundEnded,
  actReveal,
  agendaReveal,
  resolveChaosToken,
  chaosTokenValue,
  tokenMeanings,
  testAutoFail,
  applyTokenEffect,
  resolution,
  events,
  scenarioSummary,
  // 具名助手（测试/验收）
  headedWestOf,
  directionOf,
  buildPlacement,
  placedLocationIds,
  countLevels,
  floodLevelsByLevel,
  waterLevel,
  waterSet,
  waterChange,
  fullyFlooded,
  syncShantyConnections,
  placeLocationAtCell,
  resolveDoNoHarm,
  chooseResolution3,
  resolution3Choices,
  nextChapterFor,
  addGlyph,
  codeOf,
  rowLevelOf,
  locationOf,
}

export { ACT_WEST_CODE, ACT_EAST_CODE, AGENDA_CODE, START_LOCATION_WEST, START_LOCATION_EAST, RESOLUTION3_CHAPTERS, NEXT_CHAPTER_EAST }
