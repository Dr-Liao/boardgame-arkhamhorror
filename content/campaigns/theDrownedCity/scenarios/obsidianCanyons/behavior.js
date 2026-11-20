// 黑曜石峡谷（obsidianCanyons · 11639）· 引擎钩子（章节流程）。
//
// 参考：Scenario/Scenarios/TheDrownedCity/ObsidianCanyons.hs +
//       Scenario/Scenarios/TheDrownedCity/ObsidianCanyons/Helpers.hs +
//       Act|Agenda|Location|Enemy|Treachery|Story/Cards/TheDrownedCity/ObsidianCanyons/*.hs +
//       frontend/src/locales/en/theDrownedCity/obsidianCanyons.json。
//
// 引擎读点（全部走既有钩子，不改引擎）：
//   preScenarioSetup → 分支（西/东征）、幕/议程牌库、风暴强度 1、Task 故事（毁灭之梦/证明你的价值）
//   setupLocations / locationPlaced → 初始 3×4 网格（拉莱耶街道 + 4 开阔天空 + 7 张峰顶牌库底牌）、
//     峰顶牌库（独立牌库 summit，**只从牌库底抽**）、星之眷族移除、穷途异魔
//   modifyDeck / afterDeckSetup → 分支遭遇牌库、风故事卡、放一边
//   roundEnded → 东风/西风强制：按风暴强度揭示标记；非[elder_sign]符号 → 吹风（行列滑动）
//   actions / performAction → 每幕共有的「花 X 线索：从峰顶牌库底揭示 X 张，可放 1 张入场并移动」、
//     各地点行动（拉莱耶街道放线索、悬挂船只滑动、磁性尖塔交换、空中瀑布取黑曜石之爪…）
//   locationRevealed / afterInvestigate / turnEnded → 西方学府符文、悬挂船只/悬浮礁石回合结束、符文星盘仪翻面
//   actReveal / agendaReveal / checkObjectives / allResigned → 三次天际线重排、风暴议程翻面、结局
//   resolveChaosToken / applyTokenEffect → 四档混乱标记（风暴强度 / 相邻开阔天空 / 最近敌人毁灭 / 再揭示）
//   resolution → 结局 1/2/无结局与战役记录（obsidianClaw、rlyehMap、helpedWithTheRopes/wasHelpedWithTheRopes）
//
// 本章状态只写 state.scenarioFlags / state.scenarioZones / state.campaign.records（纯 JSON）；
// 网格坐标走 mechanicState.grid 与 **P7 原语**（grid-map + mechanics.map.place/rotatePorts、
// mechanics.scenarioDecks take/discard from bottom、mechanics.recordSets、mechanics.progress），
// 变化只经 api.* 生效。
import { registeredEntry } from '../../../../../src/engine/ability.js'
import { mechanicState } from '../../../../../src/engine/mechanic-state.js'
import { connectGrid, configureGrid, gridPosition, adjacentGridSpaces, rotateGridPorts } from '../../../../../src/engine/grid-map.js'
import { requestCurrentAgendaRevert } from '../../../../../src/engine/agenda-advance-frame.js'
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { discardEncounterAttachment } from '../../../../../src/engine/scenario-decks.js'
import { tdcCannotGainUpkeepResources } from '../../campaign-rules.js'
import {
  CHAPTER_ID, REFERENCE_CODE, START_LOCATION, START_LOCATION_IDS, LOCATIONS, LOCATION_IDS, LOCATION_CODE,
  LOCATION_OPTIONS, IMMOVABLE_LOCATION_IDS, SUMMIT_LOCATION_IDS, EXPEDITIONS, ACT_CODE_BY_BRANCH,
  ACT_STAGES, AGENDA_STAGES, WEST_AGENDA_CODE, EAST_AGENDA_CODE, WEST_WINDS_CODE, EAST_WINDS_CODE,
  INITIAL_OPEN_SKY_CELLS, INITIAL_FILL_CELLS, START_CELL, ACT_TWO_LAYOUT, ACT_THREE_LAYOUT,
  OPEN_SKY_POOL_IDS, SET_ASIDE_CARDS, SET_ASIDE_LOCATION_IDS, STAR_SPAWN_CODES, STAR_SPAWN_SET_ASIDE_CODES,
  INESCAPABLE_CODE, INESCAPABLE_SET_CODES, ERODED_FRIEZE_CODE, ERODED_FRIEZE_STORY_CODE, SKY_RELIC_CODE,
  OBSIDIAN_CLAW_SPEED_CODE, OBSIDIAN_CLAW_POWER_CODE, OBSIDIAN_CLAW_CODES,
  PRIMEVAL_TERROR_CODE, STAR_VAMPIRE_CODE, GLYPH_BY_LOCATION, SKY_RELIC_GLYPH, ERODED_FRIEZE_GLYPH,
  ENCOUNTER_DECK, encounterDeckForBranch, RESOLUTION_KEYS,
  OPEN_SKY_NAME, OPEN_SKY_NAME_EN, OPEN_SKY_TRAITS,
} from './definition.js'
import {
  isHardSide, stormIntensity, setStormIntensity, increaseStormIntensity, decreaseStormIntensity, skullValue,
  tabletValue, adjacentOpenSkies, adjacentOpenSkyCount, enemiesAt, isOpenSkyId,
  obsidianCanyonChaosToken, obsidianCanyonChaosTokenValue, OPEN_SKY_CODE, STORM_INTENSITY_KEY,
} from './chaos.js'

// ---------------------------------------------------------------------------
// 基础工具
// ---------------------------------------------------------------------------
const clone = value => structuredClone(value)
const info = (api, message) => api?.info?.(message)
const codeOf = value => String(value?.originalCode || value?.code || '')
const flagsFor = state => (state.scenarioFlags ||= {})
const setFlag = (state, key, value = true) => { flagsFor(state)[key] = value; return value }
const recordsFor = state => {
  state.campaign ||= {}
  state.campaign.records ||= {}
  return state.campaign.records
}
const activeInvestigators = state => (state.investigators || [])
  .filter(inv => inv && !inv.defeated && !inv.resigned)
const investigatorCount = state => Number(state?.numInvestigators) || (state?.investigators || []).length || 1
const locationOf = (state, id) => (state?.locations || []).find(location => location.id === id) || null
const entryOf = code => (code ? registeredEntry(String(code)) : null)
const flagsOf = code => entryOf(code)?.flags || {}
const hasTrait = (value, trait) => (value?.traits || [])
  .some(item => String(item).toLowerCase() === String(trait).toLowerCase())
const currentAct = state => (state.acts || [])[state.actIndex ?? 0] || null
const currentActCode = state => codeOf(currentAct(state))
const currentAgenda = state => (state.agendas || [])[state.agendaIndex ?? 0] || null
const currentAgendaCode = state => codeOf(currentAgenda(state))
const groupCluesAt = (state, locationId) => activeInvestigators(state)
  .filter(inv => inv.location === locationId)
  .reduce((sum, inv) => sum + (Number(inv.clues) || 0), 0)
function spendGroupClues(state, locationId, amount) {
  let remaining = Math.max(0, Math.trunc(Number(amount) || 0))
  for (const inv of activeInvestigators(state)) {
    if (inv.location !== locationId || remaining <= 0) continue
    const spend = Math.min(remaining, Number(inv.clues) || 0)
    inv.clues -= spend
    remaining -= spend
  }
  return remaining === 0
}
const randomValueOf = (api, state) => (typeof api?.random === 'function'
  ? () => Number(api.random())
  : () => Math.random())
function localShuffle(list, random = Math.random) {
  const cards = [...list]
  for (let index = cards.length - 1; index > 0; index--) {
    const swap = Math.floor(random() * (index + 1))
    ;[cards[index], cards[swap]] = [cards[swap], cards[index]]
  }
  return cards
}
const shuffleWith = (api, state, list) => (typeof api?.shuffle === 'function'
  ? api.shuffle([...list])
  : localShuffle(list, randomValueOf(api, state)))

// ---------------------------------------------------------------------------
// 分支与风暴
// ---------------------------------------------------------------------------
export function branchOf(state) {
  const records = state?.campaign?.records || {}
  if (records.theExpeditionHeadedWest === true) return 'west'
  if (records.theExpeditionHeadedEast === true) return 'east'
  return 'west'
}
export const expeditionOf = state => EXPEDITIONS[branchOf(state)]
export const isHeadedWest = state => branchOf(state) === 'west'
export { stormIntensity, increaseStormIntensity, decreaseStormIntensity, skullValue }

export function stormSummary(state) {
  return { branch: branchOf(state), stormIntensity: stormIntensity(state), skull: skullValue(state),
    openSkyPool: [...openSkyPool(state)], deckSize: summitAdapter(state).size() }
}

// ---------------------------------------------------------------------------
// 网格（P7 原语：grid-map + mechanics.map.place / relocate / rotatePorts）
// ---------------------------------------------------------------------------
export function configureMap(state, api = {}) {
  const map = api?.mechanics?.map
  try {
    if (map?.configure) map.configure({ adjacency: 'orthogonal' })
    else configureGrid(state, { adjacency: 'orthogonal' })
  } catch {
    const data = mechanicState(state, true)
    data.gridAdjacency = 'orthogonal'
  }
  return 'orthogonal'
}

function writeGridCell(state, id, cell, options = {}) {
  const data = mechanicState(state, true)
  data.grid ||= {}
  const previous = data.grid[id] || {}
  data.grid[id] = {
    x: cell.x, y: cell.y, isolated: false,
    connections: [...(previous.connections || [])],
    ...(previous.ports === undefined && options.ports === undefined ? {} : { ports: [...(options.ports ?? previous.ports ?? [])] }),
  }
  const loc = locationOf(state, id)
  if (loc) loc.grid = { x: cell.x, y: cell.y }
  return data.grid[id]
}

function syncConnections(state) {
  try { connectGrid(state) } catch { /* 纯数据测试无网格容器时忽略 */ }
  return (state.locations || []).map(location => location.id)
}

/** 把一个地点放上网格；有引擎 api 时走 api.mechanics.map.place（P7 原语）。 */
export function placeLocationInGrid(state, locationId, cell, api = {}, options = {}) {
  if (!cell || !Number.isSafeInteger(cell.x) || !Number.isSafeInteger(cell.y)) return false
  const inPlay = locationOf(state, locationId)
  if (!inPlay) {
    const map = api?.mechanics?.map
    if (map?.place) {
      const placed = map.place(locationId, cell.x, cell.y, options.ports ? { ports: [...options.ports] } : {})
      if (!placed && locationOf(state, locationId)) return false
      if (!placed) {
        // 引擎 api 只负责真实布置管线；纯内容层调用（测试/无引擎）回落到本文件的实例创建。
        const base = state.scenario?.locations?.[locationId] || LOCATIONS[locationId]
        if (!base) return false
        const def = clone(base)
        const clues = def.cluesFixed ?? (def.cluesPerInvestigator != null
          ? def.cluesPerInvestigator * investigatorCount(state) : Number(def.clues) || 0)
        const instance = {
          ...def, id: locationId, clues: options.revealed === true ? clues : 0, maxClues: clues,
          revealed: options.revealed === true, connections: [], symbolLinks: [],
          attachments: [], damage: 0, horror: 0, resources: 0, doom: 0,
        }
        state.locations ||= []
        state.locations.push(instance)
        writeGridCell(state, locationId, cell, options)
        locationPlaced(state, instance, api)
        syncConnections(state)
        return locationId
      }
    } else {
      const base = state.scenario?.locations?.[locationId] || LOCATIONS[locationId]
      if (!base) return false
      const def = clone(base)
      const clues = def.cluesFixed ?? (def.cluesPerInvestigator != null
        ? def.cluesPerInvestigator * investigatorCount(state) : Number(def.clues) || 0)
      const instance = {
        ...def, id: locationId, clues: options.revealed === true ? clues : 0, maxClues: clues,
        revealed: options.revealed === true, connections: [], symbolLinks: [],
        attachments: [], damage: 0, horror: 0, resources: 0, doom: 0,
      }
      state.locations ||= []
      state.locations.push(instance)
      writeGridCell(state, locationId, cell, options)
      locationPlaced(state, instance, api)
      syncConnections(state)
      return locationId
    }
  }
  const location = locationOf(state, locationId)
  writeGridCell(state, locationId, cell, options)
  if (location) {
    location.grid = { x: cell.x, y: cell.y }
    if (options.revealed === true) {
      location.revealed = true
      location.clues = Math.max(0, Number(location.maxClues) || 0)
    }
  }
  syncConnections(state)
  return locationId
}

/** P7 原语出口：旋转地点出口（本关地点未声明 ports，返回 false；保留给带出口的分支/测试）。 */
export function rotateLocationPorts(state, locationId, turns = 1) {
  try { return rotateGridPorts(state, locationId, turns) } catch { return false }
}

export function gridRowOf(state, locationId) {
  return gridPosition(state, locationId)?.y ?? null
}
export function rowOccupants(state, row) {
  const cells = mechanicState(state)?.grid || {}
  return (state.locations || [])
    .filter(location => cells[location.id] && !cells[location.id].isolated && cells[location.id].y === row)
    .map(location => ({ x: cells[location.id].x, id: location.id }))
    .sort((a, b) => a.x - b.x)
}
function topGridRow(state) {
  const cells = Object.values(mechanicState(state)?.grid || {})
  return cells.length ? Math.max(...cells.map(cell => cell.y)) : null
}
/** 摆放示意图行号（1 = 最上面一行）→ 引擎网格行（向上增长）。 */
export function gridRowForDiagramRow(state, diagramRow) {
  const top = topGridRow(state)
  if (top == null) return null
  const row = top - (Number(diagramRow) - 1)
  return rowOccupants(state, row).length ? row : null
}

/** 「不能被移动或离场」：读条目 locationRule（与引擎 swapLocation/removeLocationFromGame 同一份声明）。 */
export function locationCannotLeavePlay(state, id) {
  const location = locationOf(state, id)
  if (!location) return false
  const rule = entryOf(location.originalCode || location.code)?.locationRule || {}
  if (rule.cannotLeavePlay === true || rule.cannotBeMoved === true) return true
  // 兼容直调/未注册条目：definition 的 immovable 选项等价。
  return LOCATION_OPTIONS[id]?.immovable === true
}

function isSlidableLocation(state, id) {
  const location = locationOf(state, id)
  if (!location) return false
  if (location.openSky === true || String(location.code) === OPEN_SKY_CODE) return true
  // 印刷：「每处开阔天空和[[峰顶]]地点」；「不能移动」的地点由引擎/条目声明排除（不在此硬编码）。
  if (locationCannotLeavePlay(state, id)) return false
  if (location.revealed === false && LOCATION_OPTIONS[id]?.summit) return true
  return hasTrait(location, 'Summit')
}

export function openSkyLocations(state) {
  return (state.locations || []).filter(location => location.openSky === true
    || String(location.code) === OPEN_SKY_CODE || isOpenSkyId(state, location.id))
}
export const isOpenSky = location => Boolean(location && (location.openSky === true || String(location.code) === OPEN_SKY_CODE))

// ---------------------------------------------------------------------------
// 开阔天空（合成地点 openSkyN 表示棋盘上的开阔天空格）
// ---------------------------------------------------------------------------
export function openSkyPool(state) {
  const flags = flagsFor(state)
  if (!Array.isArray(flags.openSkyPool)) {
    flags.openSkyPool = [...expeditionOf(state).openSkyPoolIds]
  }
  return flags.openSkyPool
}

/** 把一张合成开阔天空地点（openSkyN / code xsky）放进网格并揭示。 */
export function placeOpenSkyAt(state, id, cell, api = {}) {
  const placed = placeLocationInGrid(state, id, cell, api, { revealed: true })
  if (!placed) return null
  const location = locationOf(state, id)
  if (location) {
    location.revealed = true
    location.clues = 0
    location.name = OPEN_SKY_NAME
    location.nameEn = OPEN_SKY_NAME_EN
    location.traits = [...OPEN_SKY_TRAITS]
  }
  syncConnections(state)
  return location
}

/** 从放一边的开阔天空池在指定格放一张开阔天空；池空时从峰顶牌库顶找一张开阔天空。 */
export function placeOpenSky(state, cell, api = {}) {
  const pool = openSkyPool(state)
  const id = pool.shift()
  if (id) return placeOpenSkyAt(state, id, cell, api)
  const adapter = summitAdapter(state, api)
  const top = adapter.cards?.() || []
  const sky = [...top].reverse().find(card => String(card).startsWith('openSky'))
  if (!sky) return null
  adapter.remove?.(sky)
  return placeOpenSkyAt(state, sky, cell, api)
}

/** 议程正面强制：调查员所在地点将要离场时 → 移动到任意[[中央]]地点并受 2 点直接伤害。 */
export function evacuateLocation(state, locationId, api = {}) {
  const location = locationOf(state, locationId)
  if (!location) return []
  const here = activeInvestigators(state).filter(inv => inv.location === locationId)
  if (!here.length) return []
  const central = (state.locations || []).filter(other => other.id !== locationId
    && !isOpenSky(other) && hasTrait(other, 'Central') && other.revealed !== false)
  const fallback = (state.locations || []).find(other => other.id !== locationId && !isOpenSky(other))
  const moved = []
  for (const inv of here) {
    let target = central[0]?.id || fallback?.id || null
    if (typeof api?.choose === 'function' && central.length > 1) {
      const choice = api.choose({ kind: 'location', source: '11639-agenda', seat: inv.seat,
        prompt: '你的地点将要离场：选择任意[[中央]]地点。',
        options: central.map(other => ({ id: other.id, label: other.name })) })
      target = central.find(other => other.id === String(choice))?.id || target
    }
    if (!target) {
      if (typeof api?.defeat === 'function') api.defeat(inv, 'physical')
      else inv.defeated = true
      moved.push({ seat: inv.seat, target: null, defeated: true })
      continue
    }
    inv.location = target
    if (typeof api?.damage === 'function') api.damage(inv.seat, 2)
    else inv.damage = (Number(inv.damage) || 0) + 2
    moved.push({ seat: inv.seat, target, damage: 2 })
  }
  return moved
}

/** 地点离场前：把带 leavesPlayTo 声明的遭遇附属交给引擎统一路由（11664 → setAside，而不是遭遇弃牌堆）。 */
function routeLeavingAttachments(state, locationId) {
  const location = locationOf(state, locationId)
  if (!location?.attachments?.length) return false
  let routed = false
  for (const attachment of [...location.attachments]) {
    const code = codeOf(attachment)
    if (entryOf(code)?.leavesPlayTo) {
      discardEncounterAttachment(state, attachment, code)
      location.attachments = location.attachments.filter(item => item !== attachment)
      routed = true
    }
  }
  return routed
}

export function removeLocationToSummitTop(state, locationId, api = {}, { victoryClause = true } = {}) {
  const location = locationOf(state, locationId)
  if (!location) return false
  if (locationCannotLeavePlay(state, locationId)) return false
  evacuateLocation(state, locationId, api)
  routeLeavingAttachments(state, locationId)
  // 地点自身声明 leavesPlayTo（11662「若将离场，放在一边（没有线索则进胜利区）」）。
  const locationEntry = entryOf(location.originalCode || location.code)
  if (locationEntry?.leavesPlayTo === 'setAside' || locationEntry?.leavesPlayTo === 'victory') {
    const zones = (state.scenarioZones ||= {})
    const noClues = (Number(location.clues) || 0) === 0
    const bucket = locationEntry.leavesPlayTo === 'victory' || noClues ? 'victory' : 'setAside'
    zones[bucket] ||= []
    zones[bucket].push(location.originalCode || location.code)
    if (typeof api?.removeLocationFromGame === 'function') {
      const removed = api.removeLocationFromGame(locationId)
      if (removed == null) return false
    } else {
      state.locations = (state.locations || []).filter(item => item.id !== locationId)
      const data = mechanicState(state, true)
      if (data.grid) delete data.grid[locationId]
    }
    syncConnections(state)
    return true
  }
  // 引擎统一入口：swapLocation / removeLocationFromGame 会按条目的 locationRule 拒绝（返回 null）。
  if (typeof api?.removeLocationFromGame === 'function') {
    const removed = api.removeLocationFromGame(locationId)
    if (removed == null) return false
    const adapterForRemoved = summitAdapter(state, api)
    adapterForRemoved.putTop([locationId])
    return true
  }
  const adapter = summitAdapter(state, api)
  const victory = Number(location.victory) || 0
  const noClues = (Number(location.clues) || 0) === 0
  if (victoryClause && victory > 0 && noClues && !isOpenSky(location)) {
    state.victoryDisplay ||= []
    state.victoryDisplay.push({ id: `${locationId}-victory`, code: location.code, originalCode: location.originalCode || location.code,
      name: location.name, victory })
  } else {
    adapter.putTop([locationId])
  }
  state.locations = (state.locations || []).filter(item => item.id !== locationId)
  const data = mechanicState(state, true)
  if (data.grid) delete data.grid[locationId]
  syncConnections(state)
  return true
}

// ---------------------------------------------------------------------------
// 峰顶牌库（独立牌库 summit；始终从牌库底抽 —— mechanics.scenarioDecks from:'bottom'）
// ---------------------------------------------------------------------------
export function summitAdapter(state, api = {}) {
  const decks = api?.mechanics?.scenarioDecks
  if (decks && typeof decks.take === 'function' && typeof decks.size === 'function') {
    return {
      engine: true,
      initialize: (codes, options = {}) => {
        try { decks.initialize('summit', [...codes], { shuffle: options.shuffle !== false }) } catch (error) {
          if (!/already initialized/i.test(String(error?.message))) throw error
        }
        return codes.length
      },
      size: () => decks.size('summit'),
      cards: () => decks.cards('summit'),
      drawBottom: count => decks.take('summit', Math.max(0, Math.trunc(count)), { from: 'bottom' }),
      drawTop: count => decks.take('summit', Math.max(0, Math.trunc(count)), { from: 'top' }),
      putTop: codes => decks.put('summit', [...codes], { top: true }),
      putBottom: codes => decks.put('summit', [...codes], { top: false }),
      remove: code => {
        const cards = decks.cards('summit')
        if (!cards.includes(code)) return false
        const kept = cards.filter(card => card !== code)
        // 重写整副牌库：take 全部再放回（保持顺序），丢弃目标卡。
        const all = decks.take('summit', cards.length, { from: 'top' })
        decks.put('summit', [...kept].reverse().filter(card => all.includes(card)), { top: true })
        return true
      },
    }
  }
  const statePile = mechanicState(state)?.scenarioDecks?.summit
  if (statePile) {
    return {
      engine: 'state',
      initialize: (codes, { shuffle: shouldShuffle = true } = {}) => {
        if (Array.isArray(statePile.deck) && statePile.deck.length) return statePile.deck.length
        statePile.deck = shouldShuffle ? shuffleWith(api, state, [...codes]) : [...codes]
        statePile.discard ||= []
        return statePile.deck.length
      },
      size: () => statePile.deck.length,
      cards: () => [...statePile.deck],
      drawBottom: count => statePile.deck.splice(0, Math.max(0, Math.trunc(count))),
      drawTop: count => statePile.deck.splice(Math.max(0, statePile.deck.length - count), count).reverse(),
      putTop: codes => { statePile.deck.push(...[...codes].reverse()); return codes.length },
      putBottom: codes => { statePile.deck.unshift(...codes); return codes.length },
      remove: code => {
        const index = statePile.deck.indexOf(code)
        if (index < 0) return false
        statePile.deck.splice(index, 1)
        return true
      },
    }
  }  const zones = (state.scenarioZones ||= {})
  const piles = zones.summitDeck || (zones.summitDeck = { deck: [], discard: [], removed: [] })
  const shuffle = options => shuffleWith(api, state, options)
  return {
    engine: false,
    initialize: (codes, { shuffle: shouldShuffle = true } = {}) => {
      piles.deck = shouldShuffle ? shuffle([...codes]) : [...codes]
      piles.discard = []
      return piles.deck.length
    },
    size: () => piles.deck.length,
    cards: () => [...piles.deck],
    drawBottom: count => piles.deck.splice(0, Math.max(0, Math.trunc(count))),
    drawTop: count => piles.deck.splice(Math.max(0, piles.deck.length - count), count).reverse(),
    putTop: codes => { piles.deck.push(...[...codes].reverse()); return codes.length },
    putBottom: codes => { piles.deck.unshift(...codes); return codes.length },
    remove: code => {
      const index = piles.deck.indexOf(code)
      if (index < 0) return false
      piles.deck.splice(index, 1)
      return true
    },
  }
}

export function summitCards(state, api = {}) {
  return summitAdapter(state, api).cards()
}
export function summitSize(state, api = {}) {
  return summitAdapter(state, api).size()
}

// ---------------------------------------------------------------------------
// 布置
// ---------------------------------------------------------------------------
export function prepareScenario(state, api = {}) {
  if (flagsFor(state).obsidianPrepared) return flagsFor(state).obsidianReport
  const branch = branchOf(state)
  const expedition = EXPEDITIONS[branch]
  configureMap(state, api)
  if (flagsFor(state)[STORM_INTENSITY_KEY] == null) setFlag(state, STORM_INTENSITY_KEY, 1)
  const actSource = state.scenario?.stageCards || { ...ACT_STAGES, ...AGENDA_STAGES }
  state.acts = expedition.actCodes.map(code => clone(actSource[code] || ACT_STAGES[code])).filter(Boolean)
  state.agendas = [clone(actSource[expedition.agendaCode] || AGENDA_STAGES[expedition.agendaCode])].filter(Boolean)
  state.actIndex = Number.isInteger(state.actIndex) ? state.actIndex : 0
  state.agendaIndex = Number.isInteger(state.agendaIndex) ? state.agendaIndex : 0
  const records = recordsFor(state)
  if (records.theExpeditionHeadedWest !== true && records.theExpeditionHeadedEast !== true) {
    records.theExpeditionHeadedEast = true
    setFlag(state, 'obsidianBranchAssumed', 'east')
  }
  const report = {
    branch, label: expedition.label,
    actCodes: [...expedition.actCodes],
    agendaCode: expedition.agendaCode,
    storyCode: expedition.storyCode,
    stormIntensity: stormIntensity(state),
    openSkyCount: expedition.openSkyCodes.length,
  }
  setFlag(state, 'obsidianPrepared', true)
  setFlag(state, 'obsidianReport', report)
  info(api, `黑曜石峡谷（${expedition.label}）：风暴强度 ${report.stormIntensity}，开阔天空 ${report.openSkyCount} 张。`)
  return report
}

function buildSummitDeck(state, api = {}) {
  const expedition = expeditionOf(state)
  const excluded = new Set([
    START_LOCATION, 'centralSpire', ...expedition.asideLocationIds, ...expedition.removedLocationIds,
  ])
  const pool = LOCATION_IDS.filter(id => !excluded.has(id) && !LOCATION_OPTIONS[id]?.openSky)
  const shuffled = shuffleWith(api, state, pool)
  const adapter = summitAdapter(state, api)
  adapter.initialize(shuffled, { shuffle: false })
  return { pool, shuffled }
}

/** 初始 3 行 × 4 列：拉莱耶街道 + 4 张开阔天空 + 7 张峰顶牌库底牌。 */
function placeInitialGrid(state, api = {}) {
  const cells = flagsFor(state).pendingSetupCells || (flagsFor(state).pendingSetupCells = {})
  const adapter = summitAdapter(state, api)
  // 4 张开阔天空：从放一边的合成地点池取 id，先登记网格坐标，由引擎/直调统一 placeLocation。
  const skyIds = []
  for (const cell of INITIAL_OPEN_SKY_CELLS) {
    const id = openSkyPool(state).shift()
    if (!id) break
    cells[id] = { ...cell }
    skyIds.push(id)
  }
  const drawn = []
  for (const cell of INITIAL_FILL_CELLS) {
    const [id] = adapter.drawBottom(1)
    if (!id) break
    if (String(id).startsWith('openSky')) {
      // 峰顶牌库里混入的开阔天空地点 id：同样先登记坐标，稍后统一放置。
      cells[id] = { ...cell }
      skyIds.push(id)
      continue
    }
    cells[id] = { ...cell }
    drawn.push({ id, cell })
  }
  // 中央尖塔洗入峰顶牌库顶 3 张。
  const topThree = adapter.drawTop(3)
  const mixed = shuffleWith(api, state, [...topThree, 'centralSpire'])
  adapter.putTop(mixed)
  setFlag(state, 'obsidianInitialPlacement', { drawn: drawn.map(entry => entry.id), openSky: [...skyIds] })
  return { skyIds, drawn }
}

function randomizeStarSpawn(state, api = {}) {
  const expedition = expeditionOf(state)
  const shuffled = shuffleWith(api, state, STAR_SPAWN_SET_ASIDE_CODES.map(code => code))
  // 每张星之眷族都是 1 张：候选 4 张，移除 2（v.I）/3（v.II），其余洗回遭遇牌库。
  const removed = shuffled.slice(0, expedition.removeStarSpawn)
  const remaining = shuffled.slice(expedition.removeStarSpawn)
  setFlag(state, 'starSpawnRemoved', removed)
  setFlag(state, 'starSpawnRemaining', remaining)
  return { removed, remaining }
}

export function setupLocations(state, events = null, helper = {}) {
  const api = helper?.api || helper || {}
  const report = prepareScenario(state, api)
  state.locations = []
  state.scenarioFlags.pendingSetupCells = {}
  state.scenarioZones ||= {}
  buildSummitDeck(state, api)
  const { skyIds, drawn } = placeInitialGrid(state, api)
  randomizeStarSpawn(state, api)
  // 引擎按返回顺序 placeLocation：起始地点 + 7 张峰顶地点 + 4 张合成开阔天空（locationPlaced 钩子写网格）。
  const engineIds = [START_LOCATION, ...drawn.map(entry => entry.id), ...skyIds]
  syncConnections(state)
  setFlag(state, 'obsidianSetup', {
    ...report, initialCells: { ...flagsFor(state).pendingSetupCells },
    drawnIds: drawn.map(entry => entry.id), openSkyIds: [...skyIds], placedIds: [...engineIds],
  })
  info(api, `黑曜石峡谷：初始网格 ${engineIds.length} 处地点 + ${openSkyLocations(state).length} 处开阔天空；峰顶牌库 ${summitSize(state, api)} 张。`)
  return engineIds
}

function ensurePendingLocation(state, id) {
  const base = state.scenario?.locations?.[id] || LOCATIONS[id]
  if (!base || locationOf(state, id)) return null
  const location = clone(base)
  location.revealed = false
  location.clues = 0
  state.locations.push(location)
  return location
}

export function setupEnemies(state, events = null, helper = {}) {
  void events
  void state
  void helper
}

export function modifyDeck(state, deck, events = null, helper = {}) {
  void events
  void helper
  const remaining = flagsFor(state).starSpawnRemaining || []
  const creatureWasDefeated = Boolean(recordsFor(state).theCreatureWasDefeated)
  const finalDeck = encounterDeckForBranch(branchOf(state), { starSpawnRemaining: remaining, creatureWasDefeated })
  setFlag(state, 'obsidianEncounterDeckCodes', [...finalDeck])
  return finalDeck
}

export function afterDeckSetup(state, events = null, helper = {}) {
  void events
  const api = helper?.api || {}
  const expedition = expeditionOf(state)
  const zones = (state.scenarioZones ||= {})
  zones.setAside ||= []
  const removed = flagsFor(state).starSpawnRemoved || []
  const aside = [
    ...SET_ASIDE_CARDS,
    ...removed,
    ...(expedition.inescapable === 'aside' ? INESCAPABLE_SET_CODES : []),
  ]
  zones.setAside = [...new Set([...zones.setAside, ...aside])]
  zones.setAsideLocations = [...expedition.asideLocationIds]
  zones.removedLocations = [...expedition.removedLocationIds]
  // 风故事卡：西征 = 东风面（11640b），东征 = 西风面（11640）。
  const story = putWindsInPlay(state, api)
  // 穷途异魔（v.I）：若上一关击败了该生物则整组移出游戏；否则以横置未交战生成在最远地点。
  if (expedition.inescapable === 'spawn') {
    if (recordsFor(state).theCreatureWasDefeated) {
      info(api, '穷途异魔：该生物已被击败，整组移出游戏。')
    } else if (!(state.enemies || []).some(enemy => codeOf(enemy) === INESCAPABLE_CODE)) {
      const spawnAt = farthestLocationFromInvestigators(state)
      if (spawnAt) {
        if (typeof api.spawn === 'function') api.spawn(INESCAPABLE_CODE, spawnAt, { exhausted: true })
        else spawnEnemyFallback(state, INESCAPABLE_CODE, spawnAt, api, { exhausted: true })
        info(api, `穷途异魔在最远地点「${locationOf(state, spawnAt)?.name || spawnAt}」横置生成。`)
      }
    }
  } else {
    info(api, '穷途异魔：本分支整组放一边，不参与本关。')
  }
  syncConnections(state)
  return { story: story ? codeOf(story) : null, setAside: [...zones.setAside], openSky: openSkyLocations(state).length }
}

function putWindsInPlay(state, api = {}) {
  const code = expeditionOf(state).storyCode
  state.storyAssets ||= []
  const existing = state.storyAssets.find(asset => [WEST_WINDS_CODE, EAST_WINDS_CODE].includes(codeOf(asset)))
  if (existing) {
    existing.code = code
    existing.originalCode = code
    existing.name = ALL_CARDS[code]?.nameZh || ALL_CARDS[code]?.name || code
    return existing
  }
  if (typeof api.storyAsset === 'function') {
    const spawned = api.storyAsset(code, null)
    if (spawned) return spawned
  }
  const card = ALL_CARDS[code] || {}
  const asset = {
    id: `obsidian-winds-${code}`, code, originalCode: code, artCode: code,
    name: card.nameZh || card.name || code, nameEn: card.name, global: true, location: null,
    controllerSeat: null, exhausted: false, tokens: 0, assets: [], attachments: [],
  }
  state.storyAssets.push(asset)
  return asset
}

function spawnEnemyFallback(state, code, locationId, api, options = {}) {
  const def = state.scenario?.enemies?.[code] || {}
  state.enemies ||= []
  const enemy = {
    id: `${code}-${(state.enemies || []).length + 1}`, code, originalCode: code,
    name: ALL_CARDS[code]?.nameZh || ALL_CARDS[code]?.name || code,
    location: locationId, fight: def.fight ?? null, evade: def.evade ?? null, health: def.health ?? 1,
    damage: def.damage || 0, horror: def.horror || 0, traits: [...(def.traits || [])],
    exhausted: options.exhausted === true, engagedSeat: options.engagedSeat ?? null,
    damageTaken: 0, doom: 0, clues: 0, attachments: [], victory: Number(def.victory) || 0,
  }
  state.enemies.push(enemy)
  void api
  return enemy
}

export function farthestLocationFromInvestigators(state, { excludeOpenSky = true } = {}) {
  const candidates = (state.locations || []).filter(location => !excludeOpenSky || !isOpenSky(location))
  if (!candidates.length) return null
  const starts = activeInvestigators(state).map(inv => inv.location).filter(Boolean)
  const distances = new Map()
  const queue = []
  for (const start of starts) { distances.set(start, 0); queue.push(start) }
  while (queue.length) {
    const current = queue.shift()
    const location = locationOf(state, current)
    for (const neighbor of location?.connections || []) {
      if (!distances.has(neighbor)) { distances.set(neighbor, distances.get(current) + 1); queue.push(neighbor) }
    }
  }
  let best = null
  for (const location of candidates) {
    const distance = distances.has(location.id) ? distances.get(location.id) : Number.POSITIVE_INFINITY
    if (!best || distance > best.distance) best = { id: location.id, distance }
  }
  return best?.id || null
}

/** 直调/单测入口：准备 + 初始网格 + 遭遇牌库 + 放一边。 */
export function setupScenario(state, api = {}) {
  state.scenario ||= clone({ id: CHAPTER_ID, originalCode: REFERENCE_CODE, locations: LOCATIONS,
    stageCards: { ...ACT_STAGES, ...AGENDA_STAGES }, enemies: {}, treacheries: {}, storyAssets: {} })
  state.locations = []
  state.scenarioFlags ||= {}
  delete state.scenarioFlags.obsidianPrepared
  delete state.scenarioFlags.obsidianReport
  const report = prepareScenario(state, api)
  const ids = setupLocations(state, null, { api })
  const cells = flagsFor(state).pendingSetupCells || {}
  for (const id of ids) {
    if (!locationOf(state, id)) placeLocationInGrid(state, id, cells[id] || START_CELL, api, { revealed: id === START_LOCATION || LOCATION_OPTIONS[id]?.openSky })
  }
  const deck = modifyDeck(state, [...ENCOUNTER_DECK])
  state.encounterDeck = shuffleWith(api, state, deck)
  afterDeckSetup(state, null, { api })
  for (const inv of state.investigators || []) if (!inv.location) inv.location = START_LOCATION
  syncConnections(state)
  info(api, `黑曜石峡谷（${report.branch === 'west' ? '西征 v.I' : '东征 v.II'}）：${state.locations.length} 处地点、峰顶牌库 ${summitSize(state, api)} 张、遭遇牌库 ${state.encounterDeck.length} 张。`)
  return { ...report, placedIds: ids, encounterDeckSize: state.encounterDeck.length, summitSize: summitSize(state, api) }
}

export function locationPlaced(state, location, api = {}, seat = null) {
  void seat
  if (!location) return
  const cells = flagsFor(state).pendingSetupCells || {}
  const cell = cells[location.id]
  if (cell && !gridPosition(state, location.id)) writeGridCell(state, location.id, cell)
  const position = gridPosition(state, location.id)
  if (position) location.grid = { x: position.x, y: position.y }
  if (location.id === START_LOCATION || LOCATION_OPTIONS[location.id]?.openSky) {
    location.revealed = true
    location.clues = 0
    if (LOCATION_OPTIONS[location.id]?.openSky) {
      location.name = OPEN_SKY_NAME
      location.nameEn = OPEN_SKY_NAME_EN
      location.traits = [...OPEN_SKY_TRAITS]
    }
  } else if (location.revealed !== true) {
    location.revealed = false
    // 未揭示的[[峰顶]]地点在地点面朝下时带 Summit 特性（滑行判定用）。
    if (LOCATION_OPTIONS[location.id]?.summit) location.traits = ['Summit']
  }
  if (!(state.locations || []).some(item => item.id === location.id)) state.locations.push(location)
  void api
  syncConnections(state)
}

export function locationRevealed(state, location, api = {}, seat = null) {
  if (!location) return false
  const options = LOCATION_OPTIONS[location.id] || {}
  if (String(location.id).startsWith('dazzlingSkyline')) return dazzlingSkylineReveal(state, location, api, seat)
  if (location.id === 'ancientCanyons') return ancientCanyonsReveal(state, location, api, seat)
  if (options.revealErodedFrieze) return drawErodedFrieze(state, location, api)
  if (options.glyphLocation === 'westernAthenaeum' && options.glyphOnLastClue) return false
  if (options.glyphLocation) return false
  void seat
  return false
}

function revealingSeat(state, seat) {
  return Number.isInteger(seat) ? seat : (state.currentSeat ?? state.campaign?.leadSeat ?? 0)
}

/** 11659：揭示后受到 1 点恐惧。 */
export function dazzlingSkylineReveal(state, location, api = {}, seat = null) {
  const actor = revealingSeat(state, seat)
  if (typeof api.horror === 'function') api.horror(actor, 1)
  else state.investigators[actor].horror = (Number(state.investigators[actor].horror) || 0) + 1
  info(api, `「${location.name}」揭示：${state.investigators[actor]?.name || actor} 受到 1 点恐惧。`)
  return true
}

/** 11658：揭示后[敏捷](1)；失败从遭遇牌库/弃牌堆找[[怪物]]敌人生成并交战（近似：直接抽取）。 */
export function ancientCanyonsReveal(state, location, api = {}, seat = null) {
  const actor = revealingSeat(state, seat)
  if (typeof api.test !== 'function') return false
  let failed = false
  api.test(actor, 'agility', 1, result => { failed = result?.success !== true })
  if (!failed) return false
  // P7 原语：按印刷数据在遭遇牌库/弃牌堆搜索，命中后洗回牌库并生成交战（引擎唯一入口）。
  if (typeof api.searchEncounterCard === 'function') {
    const found = api.searchEncounterCard({ traits: ['Monster'], type: 'enemy',
      from: ['deck', 'discard'], spawn: 'engaged', seat: actor })
    if (!found) {
      info(api, '古代峡谷：遭遇牌库与弃牌堆都没有[[怪物]]敌人。')
      return false
    }
    info(api, `古代峡谷：${state.investigators[actor]?.name || actor} 检定失败，搜索到[[怪物]]敌人「${ALL_CARDS[found]?.nameZh || found}」并与你交战。`)
    return true
  }
  const search = pile => pile.findIndex(code => ALL_CARDS[code]?.type === 'enemy' && hasTrait(ALL_CARDS[code], 'Monster'))
  state.encounterDeck ||= []
  state.encounterDiscard ||= []
  const deckIndex = search(state.encounterDeck)
  const discardIndex = deckIndex < 0 ? search(state.encounterDiscard) : -1
  const source = deckIndex >= 0 ? state.encounterDeck : (discardIndex >= 0 ? state.encounterDiscard : null)
  const index = deckIndex >= 0 ? deckIndex : discardIndex
  if (!source || index < 0) { info(api, '古代峡谷：遭遇牌库与弃牌堆都没有[[怪物]]敌人。'); return false }
  const [code] = source.splice(index, 1)
  state.encounterDeck.push(code)
  if (typeof api.drawEncounter === 'function') api.drawEncounter(actor)
  else spawnEnemyFallback(state, code, state.investigators[actor]?.location, api, { engagedSeat: actor })
  info(api, `古代峡谷：${state.investigators[actor]?.name || actor} 检定失败，抽取[[怪物]]敌人「${ALL_CARDS[code]?.nameZh || code}」并交战。`)
  return true
}

function drawErodedFrieze(state, location, api = {}) {
  if (flagsFor(state).erodedFriezeDrawnAt === location.id) return false
  setFlag(state, 'erodedFriezeDrawnAt', location.id)
  const zones = (state.scenarioZones ||= {})
  zones.setAside ||= []
  zones.setAside = zones.setAside.filter(code => code !== ERODED_FRIEZE_CODE)
  // 引擎真实遭遇附属实例（显示/文本空白/关闭行动共用同一份数据）；无 api 时退回同形状对象。
  const attachment = typeof api?.attachEncounterToLocation === 'function'
    ? api.attachEncounterToLocation(ERODED_FRIEZE_CODE, location.id, { encounterAttached: true, tokens: 0, flipped: false })
    : null
  if (!attachment) {
    const fallback = {
      id: `eroded-frieze-${location.id}`, code: ERODED_FRIEZE_CODE, originalCode: ERODED_FRIEZE_CODE,
      name: ALL_CARDS[ERODED_FRIEZE_CODE]?.nameZh || '剥蚀壁画', encounterAttached: true,
      tokens: 0, resources: 0, attachments: [], flipped: false,
    }
    location.attachments ||= []
    location.attachments.push(fallback)
  }
  info(api, `「${location.name}」揭示：抽取放一边的剥蚀壁画，附属到本地点。`)
  return true
}

export function preScenarioSetup(state, events, helperOrApi = {}) {
  void events
  const api = helperOrApi?.api || helperOrApi || {}
  const report = prepareScenario(state, api)
  const tasks = resolveIntroTasks(state, api)
  return { ...report, tasks }
}

// ---------------------------------------------------------------------------
// 开场 Task 故事（毁灭之梦 11759 / 证明你的价值 11757）
// ---------------------------------------------------------------------------
const TASK_CODES = Object.freeze({
  proveYourWorth: Object.freeze(['11757a', '11757b']),
  dreamsOfDestruction: Object.freeze(['11759a', '11759b']),
})
function heldCodes(inv) {
  const codes = []
  for (const key of ['deck', 'hand', 'discard', 'assets', 'threat']) {
    for (const item of inv?.[key] || []) codes.push(typeof item === 'string' ? item : item?.code)
  }
  return codes.filter(Boolean).map(String)
}
export function tasksOf(state, inv) {
  const codes = new Set(heldCodes(inv))
  return Object.keys(TASK_CODES).filter(track => TASK_CODES[track].some(code => codes.has(code)))
}
function recordSetValues(state, key) {
  const value = recordsFor(state)[key]
  if (Array.isArray(value)) return value
  return value ? [value] : []
}
function recordSetAdd(state, key, values) {
  const records = recordsFor(state)
  const current = recordSetValues(state, key)
  for (const value of values) if (!current.includes(value)) current.push(value)
  records[key] = current
  return current
}
function progressChange(state, api, task, seat, amount) {
  const progress = api?.mechanics?.progress
  if (progress?.change) {
    // P7 原语口径：轨道固定 'tdcTask'，任务身份由 claim 时的 option 表示；
    // change 的第三个参数是「增减量」而不是绝对值，且只对该调查员已领取的同一任务生效。
    const entry = progress.forSeat?.('tdcTask', seat)
    if (entry?.option !== task) return false
    return progress.change('tdcTask', seat, amount, `obsidianIntro:${state.scenario?.id || CHAPTER_ID}`)
  }
  const records = recordsFor(state)
  const key = `${task}Progress`
  records[key] ||= {}
  records[key][seat] = Math.max(0, (Number(records[key][seat]) || 0) + amount)
  return records[key][seat]
}

/** 开场：拥有 Task 的调查员结算「毁灭之梦 / 证明你的价值」故事。 */
export function resolveIntroTasks(state, api = {}) {
  const resolved = []
  for (const inv of state.investigators || []) {
    const tasks = tasksOf(state, inv)
    if (tasks.includes('dreamsOfDestruction') && !flagsFor(state)[`dreamsResolved-${inv.seat}`]) {
      setFlag(state, `dreamsResolved-${inv.seat}`, true)
      const choice = typeof api?.choose === 'function' ? api.choose({
        kind: 'effect', source: '11639-intro', seat: inv.seat, canSkip: false,
        prompt: '毁灭之梦：淹没低语，还是让它进来？',
        options: [
          { id: 'drownOut', label: '淹没低语（-1 进度、1 点精神创伤、+2 奖励经验）' },
          { id: 'letItIn', label: '让它进来（+2 进度；本关每名调查员首个回合开始抽遭遇卡）' },
        ],
      }) : 'letItIn'
      if (choice === 'drownOut') {
        progressChange(state, api, 'dreamsOfDestruction', inv.seat, -1)
        addMentalTrauma(state, api, inv.seat, 1)
        if (typeof api?.addScenarioXpBonus === 'function') api.addScenarioXpBonus(inv.seat, 2)
        resolved.push({ seat: inv.seat, task: 'dreamsOfDestruction', branch: 'drownOut' })
      } else {
        progressChange(state, api, 'dreamsOfDestruction', inv.seat, 2)
        state.scenarioFlags.dreamsLetItInSeats ||= []
        if (!state.scenarioFlags.dreamsLetItInSeats.includes(inv.seat)) state.scenarioFlags.dreamsLetItInSeats.push(inv.seat)
        resolved.push({ seat: inv.seat, task: 'dreamsOfDestruction', branch: 'letItIn' })
      }
    }
    if (tasks.includes('proveYourWorth') && !flagsFor(state)[`proveResolved-${inv.seat}`]) {
      setFlag(state, `proveResolved-${inv.seat}`, true)
      const others = (state.investigators || []).filter(other => other.seat !== inv.seat)
      const choice = typeof api?.choose === 'function' ? api.choose({
        kind: 'effect', source: '11639-intro', seat: inv.seat, canSkip: false,
        prompt: '证明你的价值：绳子全是错的，还是相信他们的手艺？',
        options: [
          { id: 'ropesAreWrong', label: '「这些绳子全错了。」（记录 helpedWithTheRopes / wasHelpedWithTheRopes；下关每人 -2 起始资源）' },
          { id: 'trustTheirHandiwork', label: '「我相信他们的手艺。」（下关每人 +1 起始资源）' },
        ],
      }) : 'trustTheirHandiwork'
      if (choice === 'ropesAreWrong') {
        const candidates = others.length ? others : [inv]
        const chosen = typeof api?.choose === 'function' ? api.choose({
          kind: 'investigator', source: '11639-intro', seat: inv.seat, canSkip: false,
          prompt: '选择一名你要帮助的调查员。',
          options: candidates.map(other => ({ id: String(other.seat), label: other.name || `调查员${other.seat + 1}` })),
        }) : String(candidates[0].seat)
        const chosenSeat = candidates.find(other => String(other.seat) === String(chosen))?.seat ?? candidates[0].seat
        // CONTRACT §4：这两个记录键只允许 boolean（Haskell 的 record set 语义在同章 scenarioFlags 里保留座位细节）。
        recordsFor(state).helpedWithTheRopes = true
        recordsFor(state).wasHelpedWithTheRopes = true
        flagsFor(state).proveYourWorthHelperSeats ||= []
        if (!flagsFor(state).proveYourWorthHelperSeats.includes(inv.seat)) flagsFor(state).proveYourWorthHelperSeats.push(inv.seat)
        flagsFor(state).proveYourWorthHelpedSeats ||= []
        if (!flagsFor(state).proveYourWorthHelpedSeats.includes(chosenSeat)) flagsFor(state).proveYourWorthHelpedSeats.push(chosenSeat)
        setFlag(state, 'proveYourWorthBranch', 'ropesAreWrong')
        deferStartingResources(state, api, -2)
        resolved.push({ seat: inv.seat, task: 'proveYourWorth', branch: 'ropesAreWrong', helpedSeat: chosenSeat })
      } else {
        setFlag(state, 'proveYourWorthBranch', 'trustTheirHandiwork')
        deferStartingResources(state, api, 1)
        resolved.push({ seat: inv.seat, task: 'proveYourWorth', branch: 'trustTheirHandiwork' })
      }
    }
  }
  return resolved
}

function deferStartingResources(state, api, amount) {
  const adjustments = api?.mechanics?.startingAdjustments
  for (const inv of state.investigators || []) {
    if (adjustments?.defer) {
      adjustments.defer(inv.seat, { receipt: `obsidianProveYourWorth:${inv.seat}`, scenarioId: CHAPTER_ID, resources: amount })
    } else {
      // 近似：无 startingAdjustments 原语的调用方（纯内容层测试）不落战役记录键，避免超出 CONTRACT §4。
      void amount
    }
  }
}

function addMentalTrauma(state, api, seat, amount) {
  if (typeof api?.addTrauma === 'function') return api.addTrauma(seat, 'mental', amount)
  state.campaign ||= {}
  state.campaign.trauma ||= {}
  state.campaign.trauma[seat] ||= { physical: 0, mental: 0 }
  state.campaign.trauma[seat].mental += amount
  return true
}

// ---------------------------------------------------------------------------
// 回合 / 风（东风、西风）
// ---------------------------------------------------------------------------
export function windsInPlay(state) {
  return (state.storyAssets || []).find(asset => [WEST_WINDS_CODE, EAST_WINDS_CODE].includes(codeOf(asset))) || null
}

/** 轮末强制：按风暴强度揭示标记；出现非 [elder_sign] 符号 → 吹风并翻面。 */
/** 印刷「无情」用 P7 关键词覆盖声明：入场与每轮神话阶段开始时按印刷值重新启用。 */
function setEnemyRelentless(state, enemy, enabled, api = {}) {
  const scenarioApi = api?.scenario || api
  if (typeof scenarioApi?.setEnemyKeywords !== 'function') return false
  return scenarioApi.setEnemyKeywords(enemy, ['relentless'], { enabled, throughRound: state.round })
}

export function enemySpawned(state, enemy, api = {}) {
  if (!enemy || codeOf(enemy) !== STAR_VAMPIRE_CODE) return false
  return setEnemyRelentless(state, enemy, true, api)
}

export function phaseBegan(state, phase, api = {}) {
  if (String(phase) !== 'mythos') return false
  let changed = false
  for (const enemy of state.enemies || []) {
    if (codeOf(enemy) !== STAR_VAMPIRE_CODE) continue
    changed = setEnemyRelentless(state, enemy, true, api) || changed
  }
  return changed
}

export function roundEnded(state, api = {}) {
  stElmosRoundEnd(state, api)
  const winds = windsInPlay(state)
  if (!winds) return { revealed: [], triggered: false }
  const storm = stormIntensity(state)
  const revealed = []
  const seat = state.currentSeat ?? state.campaign?.leadSeat ?? 0
  for (let index = 0; index < storm; index++) {
    const token = typeof api?.revealToken === 'function' ? api.revealToken(seat) : '0'
    revealed.push(token)
  }
  const symbols = new Set(['skull', 'cultist', 'tablet', 'elderthing'])
  const triggered = revealed.some(token => symbols.has(String(token)))
  if (!triggered) {
    info(api, `风：揭示 ${storm} 个标记（${revealed.join('、') || '无'}），没有非[elder_sign]符号标记。`)
    return { revealed, triggered: false }
  }
  const result = blowWinds(state, api)
  flipWinds(state, api)
  info(api, `风：揭示 ${revealed.join('、')}，${result.direction === 'left' ? '向东风' : '向西风'}滑动 ${result.rows.length} 行。`)
  return { revealed, triggered: true, ...result }
}

export function flipWinds(state, api = {}) {
  const winds = windsInPlay(state)
  if (!winds) return false
  const current = codeOf(winds)
  const next = current === EAST_WINDS_CODE ? WEST_WINDS_CODE : EAST_WINDS_CODE
  winds.code = next
  winds.originalCode = next
  winds.artCode = next
  winds.name = ALL_CARDS[next]?.nameZh || ALL_CARDS[next]?.name || next
  void api
  return next
}

/** 一次吹风：按示意图行号滑动每一行（东风向左、西风向右），空出的边格由峰顶牌库底补。 */
export function blowWinds(state, api = {}) {
  const expedition = expeditionOf(state)
  const direction = expedition.windsDirection
  const rows = []
  for (const diagramRow of expedition.windsRows) {
    const row = gridRowForDiagramRow(state, diagramRow)
    if (row == null) continue
    const occupants = rowOccupants(state, row).filter(({ id }) => isSlidableLocation(state, id))
    if (!occupants.length) continue
    const ordered = direction === 'left' ? occupants : [...occupants].reverse()
    const removed = ordered[0]
    const staying = ordered.slice(1)
    const openColumns = ordered.map(entry => entry.x)
    // 先移出边格卡，再把其余卡按风的方向挪到前一个可滑格（跳过不可移动格）。
    removeLocationToSummitTop(state, removed.id, api)
    const changes = staying.map((entry, index) => ({ id: entry.id, x: openColumns[index], y: row }))
    if (changes.length) relocateCells(state, changes, api)
    const gapColumn = openColumns[staying.length]
    fillGridCell(state, { x: gapColumn, y: row }, api)
    rows.push({ row, direction, removed: removed.id, slides: changes.map(change => change.id) })
  }
  syncConnections(state)
  return { direction, rows }
}

function relocateCells(state, changes, api = {}) {
  const map = api?.mechanics?.map
  if (map?.relocate) {
    const done = map.relocate(changes)
    if (done !== false) return true
  }
  for (const { id, x, y } of changes) {
    const cell = mechanicState(state, true).grid?.[id]
    if (!cell) continue
    cell.x = x
    cell.y = y
    const location = locationOf(state, id)
    if (location) location.grid = { x, y }
  }
  syncConnections(state)
  return true
}

/** 用一个峰顶牌库底牌填一个空格（地点 → 入场；开阔天空 → 合成地点）。 */
export function fillGridCell(state, cell, api = {}) {
  const adapter = summitAdapter(state, api)
  const [id] = adapter.drawBottom(1)
  if (!id) return null
  if (String(id).startsWith('openSky')) {
    const location = placeOpenSkyAt(state, id, cell, api)
    return location?.id || null
  }
  const placed = placeLocationInGrid(state, id, cell, api, { revealed: false })
  return placed || null
}

/** 缺口补齐：包围盒内没有地点的格子用峰顶牌库底补。 */
export function fillSkylineGaps(state, api = {}) {
  const cells = Object.entries(mechanicState(state)?.grid || {}).filter(([, cell]) => !cell.isolated)
  if (!cells.length) return []
  const xs = cells.map(([, cell]) => cell.x)
  const ys = cells.map(([, cell]) => cell.y)
  const occupied = new Set(cells.map(([, cell]) => `${cell.x},${cell.y}`))
  const filled = []
  for (let x = Math.min(...xs); x <= Math.max(...xs); x++) {
    for (let y = Math.min(...ys); y <= Math.max(...ys); y++) {
      if (occupied.has(`${x},${y}`)) continue
      const id = fillGridCell(state, { x, y }, api)
      if (id) filled.push({ id, x, y })
    }
  }
  return filled
}

// ---------------------------------------------------------------------------
// 幕 / 议程
// ---------------------------------------------------------------------------
function finishResolution(state, key, api = {}) {
  info(api, `进入结局：${key}。`)
  if (typeof api?.finish === 'function') { api.finish(key); return true }
  state.resolution = key
  return true
}

function removeLocationFromGame(state, locationId, api = {}) {
  const location = locationOf(state, locationId)
  if (!location) return false
  routeLeavingAttachments(state, locationId)
  if (typeof api?.removeLocationFromGame === 'function') {
    // 幕背面明示「忽略其文本框」（不能被移动/离场也照样移除）。
    const removed = api.removeLocationFromGame(locationId, { force: true })
    if (removed != null) return true
  }
  state.locations = state.locations.filter(item => item.id !== locationId)
  const data = mechanicState(state, true)
  if (data.grid) delete data.grid[locationId]
  state.removedFromGame ||= []
  state.removedFromGame.push(location.originalCode || location.code)
  syncConnections(state)
  void api
  return true
}

/** 天际线重排：除锚点外的开阔天空/峰顶地点洗回峰顶牌库，再按示意图铺开并从牌库底补空位。 */
export function rebuildSkyline(state, skyline, api = {}) {
  const anchorId = skyline.anchorId || state.locations.find(location => location.id === skyline.anchor)?.id
  const anchor = locationOf(state, anchorId)
  if (!anchor) return false
  const adapter = summitAdapter(state, api)
  const leaving = (state.locations || [])
    .filter(location => location.id !== anchorId && isSlidableLocation(state, location.id))
  const returned = leaving.map(location => location.id)
  for (const id of returned) removeLocationToSummitTop(state, id, api, { victoryClause: false })
  const anchorCell = skyline.anchorCell || skyline.anchor
  if (anchorCell) {
    const existing = mechanicState(state, true).grid?.[anchorId]
    if (existing) { existing.x = anchorCell.x; existing.y = anchorCell.y }
    anchor.grid = { x: anchorCell.x, y: anchorCell.y }
  }
  for (const cell of skyline.openSkyCells || []) {
    const location = placeOpenSky(state, cell, api)
    if (!location) fillGridCell(state, cell, api)
  }
  for (const cell of skyline.fillCells || []) fillGridCell(state, cell, api)
  if (returned.length) {
    const mixed = shuffleWith(api, state, returned)
    adapter.putTop(mixed.slice(0, Math.min(3, mixed.length)))
    adapter.putBottom(mixed.slice(Math.min(3, mixed.length)))
  }
  syncConnections(state)
  return true
}

/** 把放一边的地点/开阔天空按「洗入峰顶牌库顶 N 张」处理。 */
function shuffleAsideIntoSummitTop(state, codes, topN, api = {}) {
  const adapter = summitAdapter(state, api)
  const pool = flagsFor(state).openSkyPool || []
  const ids = []
  for (const code of codes) {
    const match = pool.find(id => id.startsWith('openSky'))
    if (match) { ids.push(match); flagsFor(state).openSkyPool = pool.filter(id => id !== match) }
  }
  for (const id of codes) if (LOCATION_IDS.includes(id)) ids.push(id)
  const top = adapter.drawTop(topN)
  adapter.putTop(shuffleWith(api, state, [...top, ...ids]))
  return ids
}

export function searchingAct1Back(state, api = {}) {
  // 东征幕 1 背面：生成穷途异魔（放一边）、其余本组 + 遭遇弃牌堆洗回；移除拉莱耶街道；
  // 以中央尖塔为重排 3×5；再把古代圆顶、空中瀑布与剩余开阔天空洗入峰顶牌库顶 5 张。
  if ((state.scenarioZones?.setAside || []).includes(INESCAPABLE_CODE)
    || !(state.enemies || []).some(enemy => codeOf(enemy) === INESCAPABLE_CODE)) {
    const central = locationOf(state, 'centralSpire')
    if (central) {
      if (typeof api.spawn === 'function') api.spawn(INESCAPABLE_CODE, 'centralSpire', { exhausted: true })
      else spawnEnemyFallback(state, INESCAPABLE_CODE, 'centralSpire', api, { exhausted: true })
    }
  }
  const rest = (state.scenarioZones?.setAside || []).filter(code => code !== INESCAPABLE_CODE && code !== ERODED_FRIEZE_CODE
    && INESCAPABLE_SET_CODES.includes(code))
  state.scenarioZones.setAside = (state.scenarioZones.setAside || []).filter(code => !INESCAPABLE_SET_CODES.includes(code))
  state.encounterDeck ||= []
  state.encounterDiscard ||= []
  state.encounterDeck = shuffleWith(api, state, [...state.encounterDeck, ...rest, ...state.encounterDiscard])
  state.encounterDiscard = []
  removeLocationFromGame(state, 'rlyehStreets', api)
  const anchor = locationOf(state, 'centralSpire')
  if (anchor) anchor.revealed = true
  rebuildSkyline(state, ACT_TWO_LAYOUT, api)
  shuffleAsideIntoSummitTop(state, ['ancientDome', 'aerialWaterfall'], 5, api)
  info(api, '东征幕 1 背面：天际线重排为 3×5（中央尖塔为锚点）。')
  return true
}

export function scouringAct1Back(state, api = {}) {
  removeLocationFromGame(state, 'rlyehStreets', api)
  const anchor = locationOf(state, 'centralSpire')
  if (anchor) anchor.revealed = true
  rebuildSkyline(state, ACT_TWO_LAYOUT, api)
  shuffleAsideIntoSummitTop(state, ['floatingSpire', 'aerialWaterfall'], 3, api)
  info(api, '西征幕 1 背面：天际线重排为 3×5（中央尖塔为锚点）。')
  return true
}

export function deadlySkiesBack(state, api = {}) {
  removeLocationFromGame(state, 'centralSpire', api)
  const anchor = locationOf(state, 'floatingSpire')
  if (anchor) anchor.revealed = true
  rebuildSkyline(state, ACT_THREE_LAYOUT, api)
  shuffleAsideIntoSummitTop(state, ['westernWall'], 3, api)
  info(api, '西征幕 2 背面：天际线重排为 4×5（漂浮尖塔为锚点）。')
  return true
}

export function actReveal(state, act, api = {}) {
  const code = codeOf(act)
  if (code === '11643') return searchingAct1Back(state, api)
  if (code === '11645') return scouringAct1Back(state, api)
  if (code === '11646') return deadlySkiesBack(state, api)
  if (code === '11644') {
    info(api, '东征幕 2 背面：前往古代圆顶 → 结局 2。')
    return finishResolution(state, 'resolution2', api)
  }
  if (code === '11647') {
    info(api, '西征幕 3 背面：返回海岸线 → 结局 1。')
    return finishResolution(state, 'resolution1', api)
  }
  return false
}

/** 风暴议程背面：风暴强度 ≥ 6 → 每位存活调查员被击败并承受 1 点肉体创伤；否则强度 +1 并翻回正面。 */
export function agendaReveal(state, agenda, api = {}) {
  const code = codeOf(agenda)
  if (code !== WEST_AGENDA_CODE && code !== EAST_AGENDA_CODE) return false
  const storm = stormIntensity(state)
  if (storm >= 6) {
    for (const inv of activeInvestigators(state)) {
      addPhysicalTrauma(state, api, inv.seat, 1)
      if (typeof api.defeat === 'function') api.defeat(inv, 'physical')
      else { inv.defeated = true; inv.defeatCause = 'physical' }
    }
    info(api, '风暴议程背面：风暴强度达到 6，每位存活调查员被击败并承受 1 点肉体创伤。')
    return true
  }
  const increased = increaseStormIntensity(state, 1)
  if (code === WEST_AGENDA_CODE) {
    // 西征背面：从遭遇牌库顶弃牌直到弃掉一名敌人，生成在队长所在地点；
    // 风暴强度（加 1 后）不超过 3 时以横置且不交战状态进场。
    const lead = state.investigators?.[state.campaign?.leadSeat ?? 0]
    const target = lead?.location || START_LOCATION
    let found = null
    state.encounterDeck ||= []
    state.encounterDiscard ||= []
    while (state.encounterDeck.length) {
      const card = state.encounterDeck.pop()
      const def = ALL_CARDS[card]
      if (def?.type === 'enemy') { found = card; break }
      state.encounterDiscard.push(card)
    }
    if (found) {
      if (typeof api.spawn === 'function') api.spawn(found, target, { exhausted: increased <= 3 })
      else spawnEnemyFallback(state, found, target, api, { exhausted: increased <= 3 })
      info(api, `逼近的风暴（背面）：弃到敌人「${ALL_CARDS[found]?.nameZh || found}」，生成在队长所在地点。`)
    }
  }
  requestCurrentAgendaRevert(state)
  info(api, `风暴议程背面：风暴强度提升到 ${increased}，翻回正面。`)
  return true
}

function addPhysicalTrauma(state, api, seat, amount) {
  if (typeof api?.addTrauma === 'function') return api.addTrauma(seat, 'physical', amount)
  state.campaign ||= {}
  state.campaign.trauma ||= {}
  state.campaign.trauma[seat] ||= { physical: 0, mental: 0 }
  state.campaign.trauma[seat].physical += amount
  return true
}

export function allUndefeatedResigned(state) {
  const alive = activeInvestigators(state)
  return alive.length === 0 && (state.investigators || []).some(inv => inv.resigned)
}

export function actObjectiveMet(state) {
  const act = currentAct(state)
  const objective = act?.objective
  if (!objective) return false
  if (objective.kind === 'allAt') {
    const alive = activeInvestigators(state)
    if (!alive.length) return false
    const location = locationOf(state, objective.location)
    return Boolean(location && location.revealed === true && alive.every(inv => inv.location === objective.location))
  }
  if (objective.kind === 'allResigned') return allUndefeatedResigned(state)
  return false
}

export function checkObjectives(state, api = {}) {
  if (state.status && state.status !== 'playing') return false
  if (!actObjectiveMet(state)) return false
  info(api, `幕目标达成（${currentActCode(state)}）。`)
  if (typeof api.advanceAct === 'function') { api.advanceAct(); return true }
  const act = currentAct(state)
  const result = actReveal(state, act, api)
  if (!state.resolution) state.actIndex = (state.actIndex ?? 0) + 1
  return result
}

export function allResigned(state, api = {}) {
  return checkObjectives(state, api)
}

// ---------------------------------------------------------------------------
// 行动（幕共有「搜寻尖塔」+ 各地点行动）
// ---------------------------------------------------------------------------
export function actions(state, inv) {
  if (!inv || inv.defeated || inv.resigned) return []
  const here = locationOf(state, inv.location)
  if (!here) return []
  if (isOpenSky(here)) return []
  const moves = []
  const adapter = summitAdapter(state)
  const groupClues = groupCluesAt(state, here.id)
  const actCode = currentActCode(state)
  if (adapter.size() > 0 && groupClues > 0) {
    moves.push({
      action: 'scenarioAction', rule: 'obsidianSearchSpires', locationId: here.id, actions: 1,
      label: `花费 X 个线索：从峰顶牌库底揭示 X 张，可将 1 处地点放进相邻开阔天空并移动到那里（${actCode}）`,
    })
  }
  const options = LOCATION_OPTIONS[here.id] || {}
  if (options.central || here.id === START_LOCATION) {
    moves.push({
      action: 'scenarioAction', rule: 'obsidianPlaceClues', locationId: here.id, actions: 1, fast: false,
      label: '花费 1-3 个资源：在任意已揭示地点放置等量线索（每轮限一次；本实现按 1 资源 1 线索）',
      reason: here.cluesPlacedThisRound === state.round ? '本地点本轮已经使用过这个行动' : null,
    })
  }
  if (options.hangingShip) {
    const openSkies = adjacentOpenSkies(state, inv)
    moves.push({
      action: 'scenarioAction', rule: 'obsidianHangingShipSlide', locationId: here.id, actions: 1,
      label: `本地点每位调查员花费 1 个线索：把悬挂船只向一处相邻开阔天空滑动一次`,
      reason: openSkies.length ? (groupClues >= activeInvestigators(state).filter(other => other.location === here.id).length ? null : '线索不足') : '没有相邻开阔天空',
    })
  }
  if (options.resign) {
    moves.push({
      action: 'scenarioAction', rule: 'obsidianResign', locationId: here.id, actions: 1,
      label: '[action]：撤退。你攀爬下去。',
    })
  }
  if (options.suspendedReef) {
    const candidates = summitEnemiesWithin(state, inv, 3)
    moves.push({
      action: 'scenarioAction', rule: 'obsidianSuspendedReefSwap', locationId: here.id, actions: 0, fast: true,
      label: '[fast] 花费 1 个线索：选择一名位于至多 3 次连接之外[[峰顶]]地点的敌人，与它交换位置（忽略其所在地点的强制效果）',
      reason: (Number(inv.clues) || 0) < 1 ? '需要 1 个线索' : (candidates.length ? null : '至多 3 次连接内没有[[峰顶]]地点的敌人'),
    })
  }
  if (options.magneticSpires) {
    moves.push({
      action: 'scenarioAction', rule: 'obsidianMagneticSwap', locationId: here.id, actions: 1,
      label: '本地点每位调查员花费 1 个线索：选择至多 2 格外的一处开阔天空，与磁性尖塔交换位置（每场游戏团队限一次）',
      reason: flagsFor(state).magneticSwapUsed ? '本场游戏已经使用过' : null,
    })
  }
  if (here.id === 'aerialWaterfall') {
    moves.push({
      action: 'scenarioAction', rule: 'obsidianAerialWaterfallFast', locationId: here.id, actions: 0, fast: true,
      label: '花费 1 个线索：移动到任意已揭示的[[峰顶]]地点（每轮限一次）',
      reason: (Number(inv.clues) || 0) >= 1 ? null : '需要 1 个线索',
    })
    if ((state.scenarioZones?.setAside || []).includes(OBSIDIAN_CLAW_SPEED_CODE)) {
      moves.push({
        action: 'scenarioAction', rule: 'obsidianTakeObsidianClaw', locationId: here.id, actions: 1,
        label: '花费 1[per_investigator] 个线索：把放一边的黑曜石之爪以（速度）面朝上放置入场',
        reason: groupClues >= investigatorCount(state) ? null : '线索不足',
      })
    }
  }
  if (here.id === 'ancientCanyons' && (state.scenarioZones?.setAside || []).includes(SKY_RELIC_CODE)) {
    moves.push({
      action: 'scenarioAction', rule: 'obsidianTakeSkyRelic', locationId: here.id, actions: 1,
      label: '将放一边的天空遗物放置入场，由你控制',
    })
  }
  if (here.id === 'obsidianCliffs' && (state.scenarioZones?.setAside || []).includes('glyphOrrery')
    && adjacentOpenSkies(state, inv).length) {
    moves.push({
      action: 'scenarioAction', rule: 'obsidianObsidianCliffs', locationId: here.id, actions: 1,
      label: '选择一处相邻开阔天空：检定[intellect](3)；成功把放一边的符文星盘仪放进该开阔天空',
    })
  }
  if (here.id === 'dazzlingSkyline' && groupClues > 0) {
    moves.push({
      action: 'scenarioAction', rule: 'obsidianDazzlingSkyline', locationId: here.id, actions: 1,
      label: '花费 1-3 个线索：每花费 1 个，从峰顶牌库底揭示 3 张，可把每张放在牌库顶或底（本实现按 1 线索）',
    })
  }
  if (here.id === 'easternAthenaeum' && !flagsFor(state).glyphRuneB) {
    moves.push({
      action: 'scenarioAction', rule: 'obsidianGlyphTranslate', locationId: here.id, actions: 1,
      label: '调查员共同花费 1[per_investigator] 个线索：发现符文 [rune_b]（植物）',
      reason: groupClues >= investigatorCount(state) ? null : '线索不足',
    })
  }
  const glyph = GLYPH_BY_LOCATION[here.id]
  if (glyph && here.id === 'glyphOrrery' && flagsFor(state).glyphOrreryFlipped !== true) {
    moves.push({
      action: 'scenarioAction', rule: 'obsidianGlyphOrreryFlip', locationId: here.id, actions: 1,
      label: '调查员共同花费 1[per_investigator] 个线索：翻面符文星盘仪，记录符文 [rune_d]（波浪）',
      reason: here.cannotFlipAgain ? '已翻面（不能再次翻面）'
        : (groupClues >= investigatorCount(state) ? null : '线索不足'),
    })
  }
  return moves
}

export function performAction(state, inv, move, api = {}) {
  if (!move || !inv || inv.defeated || inv.resigned) return false
  switch (move.rule) {
    case 'obsidianSearchSpires': return searchTheSpires(state, inv, api)
    case 'obsidianPlaceClues': return placeCluesAction(state, inv, api)
    case 'obsidianHangingShipSlide': return hangingShipSlide(state, inv, api)
    case 'obsidianMagneticSwap': return magneticSpiresSwap(state, inv, api)
    case 'obsidianAerialWaterfallFast': return aerialWaterfallFast(state, inv, api)
    case 'obsidianTakeObsidianClaw': return takeObsidianClaw(state, inv, api)
    case 'obsidianTakeSkyRelic': return takeSkyRelic(state, inv, api)
    case 'obsidianObsidianCliffs': return obsidianCliffsAction(state, inv, api)
    case 'obsidianDazzlingSkyline': return dazzlingSkylineAction(state, inv, api)
    case 'obsidianGlyphTranslate': return glyphTranslateAction(state, inv, api)
    case 'obsidianGlyphOrreryFlip': return glyphOrreryFlip(state, inv, api)
    case 'obsidianResign': return resignAction(state, inv, api)
    case 'obsidianSuspendedReefSwap': return suspendedReefSwap(state, inv, api)
    default: return false
  }
}

/** 「以任意顺序放在峰顶牌库顶」：逐张询问顺序；无 api.choose 时按揭示顺序放回。 */
function returnSummitCardsInAnyOrder(adapter, cards, inv, api = {}) {
  if (cards.length <= 1 || typeof api?.choose !== 'function') { adapter.putTop(cards); return [...cards] }
  const remaining = [...cards]
  const order = []
  while (remaining.length) {
    const answer = api.choose({ kind: 'card', source: '11639-act', seat: inv.seat,
      prompt: '选择下一张放在峰顶牌库顶的牌（最后选的在最上面）。',
      options: remaining.map((card, index) => ({ id: String(index), cardCode: card, label: ALL_CARDS[card]?.nameZh || card })) })
    const index = remaining.findIndex((_, itemIndex) => String(itemIndex) === String(answer))
    order.push(remaining.splice(Math.max(0, index), 1)[0])
  }
  adapter.putTop(order.reverse())
  return order
}

/** 每幕共有行动：花费 X 线索，从峰顶牌库底揭示 X 张；可把 1 张地点放进相邻开阔天空并移动。 */
export function searchTheSpires(state, inv, api = {}, options = {}) {
  const location = locationOf(state, inv.location)
  if (!location || isOpenSky(location)) return false
  const available = Number(inv.clues) || 0
  const adapter = summitAdapter(state, api)
  if (available <= 0 || adapter.size() <= 0) return false
  // 印刷「花费 X 个线索」：X 由玩家选择（1..min(线索, 峰顶牌库)）。
  let spend = Math.max(0, Math.min(Number(options.clues) || 0, available))
  if (!spend && typeof api?.choose === 'function') {
    const maximum = Math.max(1, Math.min(available, adapter.size()))
    const answer = api.choose({ kind: 'effect', source: '11639-act', seat: inv.seat, canSkip: false,
      prompt: `花费 X 个线索，从峰顶牌库底揭示 X 张（1-${maximum}）`,
      options: Array.from({ length: maximum }, (_, index) => ({ id: String(index + 1), label: `X=${index + 1}` })) })
    spend = Math.min(maximum, Math.max(1, Number(answer) || 1))
  }
  if (!spend) spend = 1
  inv.clues -= spend
  const revealed = adapter.drawBottom(spend)
  const placeable = revealed.filter(card => !String(card).startsWith('openSky') && LOCATION_IDS.includes(card))
  const skies = adjacentOpenSkies(state, inv)
  let sky = skies[0] || null
  if (skies.length > 1 && typeof api?.choose === 'function') {
    const answer = api.choose({ kind: 'location', source: '11639-act', seat: inv.seat,
      prompt: '选择一处相邻开阔天空放置地点。',
      options: skies.map(id => ({ id, label: locationOf(state, id)?.name || id })) })
    sky = skies.find(id => id === String(answer)) || sky
  }
  let chosen = options.placeId && placeable.includes(options.placeId) ? options.placeId : (placeable[0] || null)
  if (placeable.length > 1 && typeof api?.choose === 'function') {
    const answer = api.choose({ kind: 'card', source: '11639-act', seat: inv.seat, canSkip: true,
      prompt: '选择要放进开阔天空的一处地点（其余放回峰顶牌库顶）。',
      options: placeable.map(code => ({ id: code, cardCode: code, label: ALL_CARDS[code]?.nameZh || code })) })
    if (placeable.includes(answer)) chosen = answer
  }
  if (chosen && sky) {
    const skyLocation = locationOf(state, sky)
    const skyCell = skyLocation ? (mechanicState(state).grid?.[sky]) : null
    if (skyCell) {
      removeLocationToSummitTop(state, sky, api)
      placeLocationInGrid(state, chosen, { x: skyCell.x, y: skyCell.y }, api, { revealed: false })
      const placed = locationOf(state, chosen)
      if (placed) { placed.revealed = true; placed.clues = Math.max(0, Number(placed.maxClues) || 0) }
      const rest = revealed.filter(card => card !== chosen)
      returnSummitCardsInAnyOrder(adapter, rest, inv, api)
      inv.location = chosen
      info(api, `${inv.name} 花费 ${spend} 个线索，从峰顶牌库底揭示 ${spend} 张，把「${placed?.name || chosen}」放进开阔天空并移动过去。`)
      return { revealed, cluesSpent: spend, placed: chosen, moved: true }
    }
  }
  returnSummitCardsInAnyOrder(adapter, revealed, inv, api)
  info(api, `${inv.name} 花费 ${spend} 个线索，从峰顶牌库底揭示 ${spend} 张，未放置地点，全部放回峰顶牌库顶。`)
  return { revealed, cluesSpent: spend, placed: null, moved: false }
}

/** [action] 撤退（11651 西墙 / 11652 古代圆顶）：走引擎撤退入口。 */
function resignAction(state, inv, api = {}) {
  if (!inv || inv.defeated || inv.resigned) return false
  if (typeof api.resign === 'function') api.resign(inv.seat)
  else {
    inv.resigned = true
    inv.resignRound = state.round
  }
  info(api, `${inv.name} 撤退（攀爬下去）。`)
  return true
}

/** 至多 maxDistance 次连接内、位于[[峰顶]]地点（非开阔天空）的敌人。 */
export function summitEnemiesWithin(state, inv, maxDistance = 3) {
  const distance = new Map([[inv.location, 0]])
  const queue = [inv.location]
  while (queue.length) {
    const current = queue.shift()
    const currentDistance = distance.get(current)
    if (currentDistance >= maxDistance) continue
    const location = locationOf(state, current)
    for (const neighbor of location?.connections || []) {
      if (distance.has(neighbor)) continue
      distance.set(neighbor, currentDistance + 1)
      queue.push(neighbor)
    }
  }
  return (state.enemies || []).filter(enemy => !enemy.defeated && distance.has(enemy.location)
    && !isOpenSky(locationOf(state, enemy.location))
    && hasTrait(locationOf(state, enemy.location), 'Summit'))
}

/** 11656 [fast]：花 1 线索与至多 3 次连接内[[峰顶]]地点的敌人交换位置。 */
function suspendedReefSwap(state, inv, api = {}) {
  if ((Number(inv.clues) || 0) < 1) return false
  const candidates = summitEnemiesWithin(state, inv, 3)
  if (!candidates.length) return false
  let target = candidates[0]
  if (candidates.length > 1 && typeof api?.choose === 'function') {
    const answer = api.choose({ kind: 'enemy', source: '11656', seat: inv.seat,
      prompt: '选择一名位于至多 3 次连接之外[[峰顶]]地点的敌人，与它交换位置。',
      options: candidates.map(enemy => ({ id: enemy.id, label: enemy.name || enemy.code })) })
    target = candidates.find(enemy => enemy.id === String(answer)) || target
  }
  const from = inv.location
  const to = target.location
  inv.clues -= 1
  if (typeof api.moveEnemy === 'function') api.moveEnemy(target, from)
  else target.location = from
  if (typeof api.moveInvestigator === 'function') api.moveInvestigator(inv.seat, to)
  else inv.location = to
  info(api, `悬浮礁石：${inv.name} 花 1 个线索与「${target.name || target.code}」交换位置（${from} ↔ ${to}）。`)
  return true
}

function placeCluesAction(state, inv, api = {}) {
  const location = locationOf(state, inv.location)
  if (!location) return false
  if (location.cluesPlacedThisRound === state.round) return false
  const resources = Number(inv.resources) || 0
  if (resources < 1) return false
  // 印刷「花费 1-3 个资源」：数量由玩家选择。
  const maximum = Math.max(1, Math.min(3, resources))
  const amount = typeof api?.choose === 'function'
    ? Math.min(maximum, Math.max(1, Number(api.choose({ kind: 'effect', source: '11648', seat: inv.seat, canSkip: false,
      prompt: '花费 1-3 个资源：在任意已揭示地点放置等量线索。',
      options: Array.from({ length: maximum }, (_, index) => ({ id: String(index + 1), label: `花费 ${index + 1} 个资源` })) })) || 1))
    : 1
  const revealedLocations = (state.locations || []).filter(other => other.revealed === true)
  let target = location
  if (revealedLocations.length > 1 && typeof api?.choose === 'function') {
    const answer = api.choose({ kind: 'location', source: '11648', seat: inv.seat,
      prompt: '选择要在哪一处已揭示地点放置线索。',
      options: revealedLocations.map(other => ({ id: other.id, label: other.name })) })
    target = revealedLocations.find(other => other.id === String(answer)) || target
  }
  inv.resources -= amount
  target.clues = (Number(target.clues) || 0) + amount
  location.cluesPlacedThisRound = state.round
  setFlag(state, `placeCluesRound-${location.id}`, state.round)
  info(api, `${inv.name} 花费 ${amount} 个资源，在「${target.name}」放置 ${amount} 个线索。`)
  return true
}

function hangingShipSlide(state, inv, api = {}) {
  const location = locationOf(state, inv.location)
  if (!location) return false
  const here = activeInvestigators(state).filter(other => other.location === location.id)
  if (!spendGroupClues(state, location.id, here.length)) return false
  const openSkies = adjacentOpenSkies(state, inv)
  if (!openSkies.length) return false
  let target = openSkies[0]
  if (typeof api?.choose === 'function' && openSkies.length > 1) {
    const answer = api.choose({ kind: 'location', source: '11657', seat: inv.seat,
      prompt: '选择一处相邻开阔天空，把悬挂船只滑动过去。',
      options: openSkies.map(id => ({ id, label: locationOf(state, id)?.name || id })) })
    target = openSkies.find(id => id === String(answer)) || target
  }
  const shipCell = mechanicState(state).grid?.[location.id]
  const skyCell = mechanicState(state).grid?.[target]
  if (!shipCell || !skyCell) return false
  // 「向相邻开阔天空滑动一次」= 船只与开阔天空交换格坐标（物品/标记原地保留）。
  const data = mechanicState(state).grid
  data[location.id] = { ...data[location.id], x: skyCell.x, y: skyCell.y }
  location.grid = { x: skyCell.x, y: skyCell.y }
  data[target] = { ...data[target], x: shipCell.x, y: shipCell.y }
  const sky = locationOf(state, target)
  if (sky) sky.grid = { x: shipCell.x, y: shipCell.y }
  syncConnections(state)
  info(api, `悬挂船只滑入相邻开阔天空。`)
  return true
}

function magneticSpiresSwap(state, inv, api = {}) {
  if (flagsFor(state).magneticSwapUsed) return false
  const location = locationOf(state, inv.location)
  if (!location) return false
  const here = activeInvestigators(state).filter(other => other.location === location.id)
  if (!spendGroupClues(state, location.id, here.length)) return false
  const origin = gridPosition(state, location.id)
  if (!origin) return false
  const candidates = (state.locations || []).filter(other => isOpenSky(other)).filter(other => {
    const cell = gridPosition(state, other.id)
    return cell && Math.abs(cell.x - origin.x) + Math.abs(cell.y - origin.y) <= 2
  })
  let target = candidates.find(other => other.id === flagsFor(state).magneticSwapTarget) || candidates[0]
  if (typeof api?.choose === 'function' && candidates.length > 1) {
    const answer = api.choose({ kind: 'location', source: '11661', seat: inv.seat,
      prompt: '选择至多 2 格外的一处开阔天空，与磁性尖塔交换位置。',
      options: candidates.map(other => ({ id: other.id, label: other.name })) })
    target = candidates.find(other => other.id === String(answer)) || target
  }
  if (!target) return false
  const targetCell = gridPosition(state, target.id)
  const data = mechanicState(state).grid
  data[target.id] = { ...data[target.id], x: origin.x, y: origin.y }
  target.grid = { x: origin.x, y: origin.y }
  data[location.id] = { ...data[location.id], x: targetCell.x, y: targetCell.y }
  location.grid = { x: targetCell.x, y: targetCell.y }
  setFlag(state, 'magneticSwapUsed', true)
  syncConnections(state)
  info(api, `磁性尖塔与 ${Math.abs(targetCell.x - origin.x) + Math.abs(targetCell.y - origin.y)} 格外的开阔天空交换位置。`)
  return true
}

function aerialWaterfallFast(state, inv, api = {}) {
  if (flagsFor(state).aerialWaterfallRound === state.round) return false
  if ((Number(inv.clues) || 0) < 1) return false
  const destinations = (state.locations || []).filter(location => location.revealed
    && hasTrait(location, 'Summit') && location.id !== inv.location)
  let target = destinations.find(location => location.id === flagsFor(state).aerialWaterfallTarget) || destinations[0]
  if (typeof api?.choose === 'function' && destinations.length > 1) {
    const answer = api.choose({ kind: 'location', source: '11660', seat: inv.seat,
      prompt: '选择任意已揭示的[[峰顶]]地点并移动过去。',
      options: destinations.map(location => ({ id: location.id, label: location.name })) })
    target = destinations.find(location => location.id === String(answer)) || target
  }
  if (!target) return false
  inv.clues -= 1
  inv.location = target.id
  setFlag(state, 'aerialWaterfallRound', state.round)
  info(api, `${inv.name} 花费 1 个线索，移动到「${target.name}」。`)
  return true
}

function takeObsidianClaw(state, inv, api = {}) {
  const zones = (state.scenarioZones ||= {})
  zones.setAside ||= []
  if (!zones.setAside.includes(OBSIDIAN_CLAW_SPEED_CODE)) return false
  if (!spendGroupClues(state, inv.location, investigatorCount(state))) return false
  zones.setAside = zones.setAside.filter(code => code !== OBSIDIAN_CLAW_SPEED_CODE)
  const controller = typeof api.choose === 'function' ? api.choose({
    kind: 'investigator', source: '11660', seat: inv.seat, canSkip: true,
    prompt: '选择黑曜石之爪的控制者。',
    options: activeInvestigators(state).map(other => ({ id: String(other.seat), label: other.name || `调查员${other.seat + 1}` })),
  }) : String(inv.seat)
  const seat = activeInvestigators(state).find(other => String(other.seat) === String(controller))?.seat ?? inv.seat
  const asset = { id: `obsidian-claw-${seat}`, code: OBSIDIAN_CLAW_SPEED_CODE, originalCode: OBSIDIAN_CLAW_SPEED_CODE,
    name: ALL_CARDS[OBSIDIAN_CLAW_SPEED_CODE]?.nameZh || '黑曜石之爪', controllerSeat: seat, ownerSeat: seat,
    exhausted: false, tokens: 0, attachments: [], damage: 0, horror: 0, cannotLeavePlay: true, face: 'speed' }
  state.investigators[seat].assets ||= []
  state.investigators[seat].assets.push(asset)
  setFlag(state, 'obsidianClawOwnerSeat', seat)
  info(api, `黑曜石之爪以（速度）面朝上入场，由调查员 ${seat + 1} 控制。`)
  return true
}

function takeSkyRelic(state, inv, api = {}) {
  const zones = (state.scenarioZones ||= {})
  zones.setAside ||= []
  if (!zones.setAside.includes(SKY_RELIC_CODE)) return false
  zones.setAside = zones.setAside.filter(code => code !== SKY_RELIC_CODE)
  const asset = { id: `sky-relic-${inv.seat}`, code: SKY_RELIC_CODE, originalCode: SKY_RELIC_CODE,
    name: ALL_CARDS[SKY_RELIC_CODE]?.nameZh || '天空遗物', controllerSeat: inv.seat, ownerSeat: inv.seat,
    exhausted: false, tokens: 0, attachments: [], damage: 0, horror: 0, face: 'relic' }
  state.investigators[inv.seat].assets ||= []
  state.investigators[inv.seat].assets.push(asset)
  info(api, `${inv.name} 取得天空遗物。`)
  return true
}

function obsidianCliffsAction(state, inv, api = {}) {
  const openSkies = adjacentOpenSkies(state, inv)
  if (!openSkies.length) return false
  if (typeof api?.test !== 'function') return false
  api.test(inv.seat, 'intellect', 3, result => {
    if (result?.success !== true) return
    const zones = (state.scenarioZones ||= {})
    zones.setAside ||= []
    if (!zones.setAside.includes('glyphOrrery')) return
    zones.setAside = zones.setAside.filter(code => code !== 'glyphOrrery')
    const sky = locationOf(state, openSkies[0])
    const cell = sky ? gridPosition(state, sky.id) : null
    if (cell) {
      removeLocationToSummitTop(state, sky.id, api)
      placeLocationInGrid(state, 'glyphOrrery', cell, api, { revealed: true })
    }
  })
  return true
}

function dazzlingSkylineAction(state, inv, api = {}) {
  const clues = Number(inv.clues) || 0
  if (clues < 1) return false
  const maximum = Math.max(1, Math.min(3, clues))
  const amount = typeof api?.choose === 'function'
    ? Math.min(maximum, Math.max(1, Number(api.choose({ kind: 'effect', source: '11659', seat: inv.seat, canSkip: false,
      prompt: '花费 1-3 个线索：每花费 1 个，从峰顶牌库底揭示 3 张。',
      options: Array.from({ length: maximum }, (_, index) => ({ id: String(index + 1), label: `花费 ${index + 1} 个线索` })) })) || 1))
    : 1
  inv.clues -= amount
  const adapter = summitAdapter(state, api)
  const revealed = adapter.drawBottom(3 * amount)
  const bottom = []
  const top = []
  for (const card of revealed) {
    const choice = typeof api?.choose === 'function' ? api.choose({
      kind: 'card', source: '11659', seat: inv.seat, canSkip: true,
      prompt: '把这张牌放在峰顶牌库顶还是底？', cardCode: card,
      options: [{ id: 'top', label: '牌库顶' }, { id: 'bottom', label: '牌库底' }],
    }) : 'top'
    if (choice === 'bottom') bottom.push(card)
    else top.push(card)
  }
  if (top.length) adapter.putTop(top)
  if (bottom.length) adapter.putBottom(bottom)
  info(api, `${inv.name} 花费 ${amount} 个线索，从峰顶牌库底揭示 ${3 * amount} 张并按选择放在顶/底。`)
  return true
}

function glyphTranslateAction(state, inv, api = {}) {
  if (flagsFor(state).glyphRuneB) return false
  const location = locationOf(state, inv.location)
  if (!location) return false
  if (!spendGroupClues(state, location.id, investigatorCount(state))) return false
  translateGlyph(state, 'rune_b', 'Plant', api)
  setFlag(state, 'glyphRuneB', true)
  return true
}

function glyphOrreryFlip(state, inv, api = {}) {
  const location = locationOf(state, inv.location)
  if (!location || location.cannotFlipAgain || flagsFor(state).glyphOrreryFlipped === true) return false
  if (!spendGroupClues(state, location.id, investigatorCount(state))) return false
  if (typeof api.flipLocation === 'function') {
    // 引擎地点翻面统一入口（flipScenarioLocation）→ behavior.locationStory 结算故事面并标记不能再次翻面。
    if (!api.flipLocation(location.id, inv.seat)) return false
  } else {
    translateGlyph(state, 'rune_d', 'Wave', api)
    setFlag(state, 'glyphOrreryFlipped', true)
    location.flippedToStory = false
    location.cannotFlipAgain = true
  }
  info(api, `符文星盘仪翻面：记录符文 [rune_d]（波浪）。`)
  return true
}

/** 11662b 故事面：记录 rune_d「Wave」后翻回地点面且不能再次翻面（引擎 flipScenarioLocation → locationStory 钩子）。 */
export function locationStory(state, location, api = {}) {
  if (location?.id !== 'glyphOrrery' && String(location?.originalCode || location?.code) !== '11662') return
  translateGlyph(state, 'rune_d', 'Wave', api)
  setFlag(state, 'glyphOrreryFlipped', true)
  location.flippedToStory = false
  location.cannotFlipAgain = true
}

export function translateGlyph(state, rune, word, api = {}) {
  const records = recordsFor(state)
  const letter = String(rune).replace(/^rune_/i, '').toUpperCase()
  const glyphs = Array.isArray(records.discoveredGlyphs) ? records.discoveredGlyphs : []
  if (!glyphs.includes(letter)) glyphs.push(letter)
  records.discoveredGlyphs = glyphs
  flagsFor(state).glyphWords ||= {}
  flagsFor(state).glyphWords[letter] = word
  const recordSets = api?.mechanics?.recordSets
  if (recordSets?.add) recordSets.add('discoveredGlyphs', letter)
  setFlag(state, `translated-${letter}`, word)
  info(api, `记录符文 [${rune}]：${word}（已翻译）。`)
  return { rune, letter, word, count: glyphs.length }
}

// ---------------------------------------------------------------------------
// 回合结束 / 揭示 / 战斗
// ---------------------------------------------------------------------------
export function turnEnded(state, inv, api = {}) {
  if (!inv) return false
  const here = locationOf(state, inv.location)
  if (!here) return false
  if (LOCATION_OPTIONS[here.id]?.hangingShip) {
    const count = activeInvestigators(state).filter(other => other.location === here.id).length
    if (typeof api.test === 'function') {
      let failed = false
      api.test(inv.seat, 'agility', Math.max(1, count), result => { failed = result?.success !== true })
      if (failed) {
        removeLocationToSummitTop(state, here.id, api)
        info(api, `悬挂船只检定失败：船只从场上移出（放到峰顶牌库顶）。`)
        return true
      }
    }
  }
  if (here.id.startsWith('suspendedReef')) {
    const hasHand = (inv.hand || []).length > 0
    const choice = typeof api?.choose === 'function' ? api.choose({
      kind: 'effect', source: '11656', seat: inv.seat, canSkip: false,
      prompt: '悬浮礁石：回合结束时随机弃 1 张手牌，或受到 1 点伤害。',
      options: [...(hasHand ? [{ id: 'discard', label: '随机弃 1 张手牌' }] : []), { id: 'damage', label: '受到 1 点伤害' }],
    }) : (hasHand ? 'discard' : 'damage')
    if (choice === 'discard' && hasHand) {
      if (typeof api.discardRandom === 'function') api.discardRandom(inv.seat, 1)
      else inv.hand.pop()
    } else if (typeof api.damage === 'function') api.damage(inv.seat, 1)
    else inv.damage = (Number(inv.damage) || 0) + 1
    return true
  }
  return false
}

export function turnBegins(state, inv, api = {}) {
  const seats = state.scenarioFlags?.dreamsLetItInSeats || []
  if (!seats.includes(inv?.seat)) return false
  if (flagsFor(state)[`dreamsDrawn-${inv.seat}`] === state.turnSerial) return false
  setFlag(state, `dreamsDrawn-${inv.seat}`, state.turnSerial)
  if (typeof api.drawEncounter === 'function') api.drawEncounter(inv.seat)
  info(api, `毁灭之梦（让它进来）：${inv.name} 的回合开始，抽取遭遇牌库顶牌。`)
  return true
}

/** 检定失败后的章节强制（11667 恐怖之翼）。 */
export function afterTest(state, inv, context = {}, api = {}) {
  if (!inv || context?.success !== false) return false
  return wingsOfTerrorFailedTest(state, inv, api)
}

export function afterInvestigate(state, inv, location, api = {}) {
  if (!location) return false
  if (location.id === 'westernAthenaeum' && (Number(location.clues) || 0) === 0
    && flagsFor(state).glyphRuneC !== true) {
    setFlag(state, 'glyphRuneC', true)
    translateGlyph(state, 'rune_c', 'Elder Thing', api)
    return true
  }
  return false
}

export function enemyAttackResolved(state, enemy, inv, api = {}) {
  if (!enemy) return false
  if (codeOf(enemy) === STAR_VAMPIRE_CODE) {
    enemy.damageTaken = Math.max(0, (Number(enemy.damageTaken) || 0) - 1)
    if (enemy.health != null) enemy.health = Math.min(Number(enemy.health) || 0, (Number(enemy.health) || 0))
    info(api, `星之吸血鬼攻击后治愈 1 点伤害。`)
    return true
  }
  if (codeOf(enemy) === PRIMEVAL_TERROR_CODE && enemy.location && isOpenSky(locationOf(state, enemy.location))) {
    if (inv) {
      addPhysicalTrauma(state, api, inv.seat, 1)
      if (typeof api.defeat === 'function') api.defeat(inv, 'physical')
      else { inv.defeated = true }
    }
    info(api, '原初恐怖：在开阔天空被击败/解除交战 → 该调查员被击败并承受 1 点肉体创伤。')
    return true
  }
  return false
}

/** 11670：在开阔天空被击败时，与其交战的调查员被击败并承受 1 点肉体创伤。 */
export function enemyDefeated(state, enemy, api = {}) {
  if (!enemy || codeOf(enemy) !== PRIMEVAL_TERROR_CODE) return false
  const here = locationOf(state, enemy.location)
  if (!here || !isOpenSky(here)) return false
  const engaged = Number.isInteger(enemy.engagedSeat) ? state.investigators?.[enemy.engagedSeat] : null
  if (!engaged) return false
  addPhysicalTrauma(state, api, engaged.seat, 1)
  if (typeof api.defeat === 'function') api.defeat(engaged, 'physical')
  else engaged.defeated = true
  info(api, `原初恐怖在开阔天空被击败：${engaged.name || engaged.seat} 被击败并承受 1 点肉体创伤。`)
  return true
}

/** Good Money（11611）「下一章维护阶段不能获得资源」：跨章标记由 campaign-rules.js 统一判定（phases.js 补给阶段读点）。 */
export function canGainResources(state, inv) {
  return !tdcCannotGainUpkeepResources(state, inv)
}

/** 11663 天空遗物：[action] 检定期间投入卡牌的技能图标翻倍（tests.js#commitIconMultiplier 读点）。 */
export function commitIconMultiplier(state, owner) {
  const seat = flagsFor(state).skyRelicTestSeat
  if (seat == null) return undefined
  return Number(owner?.seat) === Number(seat) ? 2 : undefined
}

/** 11670「位于开阔天空时与该敌人解除交战 → 你被击败并承受 1 点肉体创伤」。 */
export function enemyDisengaged(state, enemy, inv, api = {}) {
  if (!enemy || codeOf(enemy) !== PRIMEVAL_TERROR_CODE) return false
  const here = locationOf(state, enemy.location)
  if (!here || !isOpenSky(here)) return false
  const actor = inv || (Number.isInteger(enemy.engagedSeat) ? state.investigators?.[enemy.engagedSeat] : null)
  if (!actor || actor.defeated) return false
  addPhysicalTrauma(state, api, actor.seat, 1)
  if (typeof api.defeat === 'function') api.defeat(actor, 'physical')
  else actor.defeated = true
  info(api, `原初恐怖在开阔天空被解除交战：${actor.name || actor.seat} 被击败并承受 1 点肉体创伤。`)
  return true
}

/** 11670 原初恐怖「不能进行趁乱攻击」：引擎 hidden-rules.js#enemyCanOpportunityAttack 读点。 */
export function canOpportunityAttack(state, enemy) {
  void state
  return codeOf(enemy) !== PRIMEVAL_TERROR_CODE
}

export function movementError(state, inv, destination, destinationId) {
  if (!destination) return null
  if (isOpenSky(destination)) {
    const engagedWithTerror = (state.enemies || []).some(enemy => enemy.engagedSeat === inv.seat
      && codeOf(enemy) === PRIMEVAL_TERROR_CODE)
    return engagedWithTerror ? null : '不能移动进开阔天空（除非剧本效果允许）'
  }
  return null
}

// ---------------------------------------------------------------------------
// 单卡结算入口（诡计 encounterResolve → api.resolveScenarioEvent → behavior.events）
// ---------------------------------------------------------------------------
/** 11665 圣艾尔摩之火：附属到最近未附属本卡的地点；轮末该地点每人 1 伤害并移到相邻（尽可能有调查员）。 */
export function stElmosFire(state, inv, api = {}) {
  if (!inv?.location) return false
  // 「最近的一处未附属圣艾尔摩之火地点」：BFS 距离，找不到时退到所在地点。
  const hasFire = location => (location.attachments || []).some(attachment => codeOf(attachment) === '11665')
  const visited = new Set([inv.location])
  const queue = [inv.location]
  let target = null
  while (queue.length) {
    const current = locationOf(state, queue.shift())
    if (current && !hasFire(current)) { target = current; break }
    for (const neighbor of current?.connections || []) {
      if (visited.has(neighbor)) continue
      visited.add(neighbor)
      queue.push(neighbor)
    }
  }
  if (!target) target = locationOf(state, inv.location)
  if (!target) return false
  target.attachments ||= []
  target.attachments.push({ id: `st-elmos-${target.id}`, code: '11665', originalCode: '11665', name: '圣艾尔摩之火',
    encounterAttached: true, tokens: 0 })
  info(api, `圣艾尔摩之火附属到最近的「${target.name}」。`)
  return true
}

export function stElmosRoundEnd(state, api = {}) {
  let triggered = false
  for (const location of [...(state.locations || [])]) {
    const fire = (location.attachments || []).find(attachment => codeOf(attachment) === '11665')
    if (!fire) continue
    triggered = true
    for (const inv of activeInvestigators(state).filter(other => other.location === location.id)) {
      if (typeof api.damage === 'function') api.damage(inv.seat, 1)
      else inv.damage = (Number(inv.damage) || 0) + 1
    }
    location.attachments = location.attachments.filter(attachment => attachment !== fire)
    // 「附属到一处相邻地点（尽可能有调查员）」：优先有调查员的相邻地点，其次第一个相邻地点。
    const adjacent = (location.connections || []).map(id => locationOf(state, id)).filter(Boolean)
    const occupied = adjacent.find(other => activeInvestigators(state).some(inv => inv.location === other.id))
    const target = occupied || adjacent[0] || null
    if (target) {
      target.attachments ||= []
      target.attachments.push(fire)
    }
  }
  return triggered
}

/** 11666 恐高症：意志(1 + 相邻开阔天空)；失败差值每 1 点失去 1 行动或 1 恐惧。 */
export function acrophobia(state, inv, api = {}) {
  if (typeof api.test !== 'function') return false
  const difficulty = 1 + adjacentOpenSkyCount(state, inv)
  const failedBy = []
  api.test(inv.seat, 'willpower', difficulty, result => {
    const value = Number(result?.failedBy)
    if (result?.success !== true) failedBy.push(Number.isFinite(value) ? value : 1)
  })
  const amount = failedBy[0] || 0
  for (let index = 0; index < amount; index++) {
    const choice = typeof api?.choose === 'function' ? api.choose({
      kind: 'effect', source: '11666', seat: inv.seat, canSkip: false,
      prompt: '恐高症：失去 1 次行动或受到 1 点恐惧。',
      options: [{ id: 'action', label: '失去 1 次行动' }, { id: 'horror', label: '受到 1 点恐惧' }],
    }) : 'horror'
    if (choice === 'action') {
      if (typeof api.loseActions === 'function') api.loseActions(inv.seat, 1)
      else inv.actionsLeft = Math.max(0, (Number(inv.actionsLeft) ?? 3) - 1)
    }
    else if (typeof api.horror === 'function') api.horror(inv.seat, 1)
    else inv.horror = (Number(inv.horror) || 0) + 1
  }
  return true
}

/** 11667 恐怖之翼：放入威胁区；之后每次检定失败，从遭遇牌库顶弃到敌人，抽该敌人或让它攻击。 */
export function wingsOfTerror(state, inv, api = {}) {
  (state.investigators || [])[inv?.seat ?? 0].threat ||= []
  state.investigators[inv.seat].threat.push({ id: `wings-of-terror-${inv.seat}`, code: '11667', originalCode: '11667',
    name: '恐怖之翼', encounterAttached: true, threatArea: true })
  info(api, `${inv.name} 的威胁区放入恐怖之翼。`)
  return true
}

export function wingsOfTerrorFailedTest(state, inv, api = {}) {
  const has = ((state.investigators || [])[inv?.seat ?? 0].threat || []).some(card => codeOf(card) === '11667')
  if (!has || typeof api.drawEncounter !== 'function') return false
  // 近似：弃到敌人后直接由该调查员抽取（走真实遭遇管线）。
  const discarded = []
  state.encounterDeck ||= []
  let found = null
  while (state.encounterDeck.length) {
    const card = state.encounterDeck.pop()
    if (ALL_CARDS[card]?.type === 'enemy') { found = card; break }
    discarded.push(card)
  }
  state.encounterDiscard ||= []
  state.encounterDiscard.push(...discarded)
  if (found) {
    const choice = typeof api?.choose === 'function' ? api.choose({ kind: 'effect', source: '11667', seat: inv.seat,
      prompt: '恐怖之翼：抽取该敌人，或让它从弃牌堆攻击你。',
      options: [{ id: 'draw', label: '抽取该敌人' }, { id: 'attack', label: '该敌人从弃牌堆攻击你' }] }) : 'draw'
    if (choice === 'attack' && typeof api.attackFromDiscard === 'function') {
      state.encounterDiscard.push(found)
      api.attackFromDiscard(found, inv.seat)
    } else {
      state.encounterDeck.push(found)
      if (typeof api.drawEncounter === 'function') api.drawEncounter(inv.seat)
    }
  }
  const threat = state.investigators[inv.seat].threat || []
  state.investigators[inv.seat].threat = threat.filter(card => codeOf(card) !== '11667')
  info(api, `恐怖之翼：检定失败，弃到并抽取敌人「${ALL_CARDS[found]?.nameZh || found || '无'}」，然后弃掉本卡。`)
  return true
}

/** 11669 迷失云中：三选一（密谋毁灭 / 每人 2 直接恐惧 / 结算风卡强制效果）。 */
export function lostInTheClouds(state, inv, api = {}) {
  const choice = typeof api?.choose === 'function' ? api.choose({
    kind: 'effect', source: '11669', seat: inv.seat, canSkip: false,
    prompt: '迷失云中：选择一项。',
    options: [
      { id: 'doom', label: '在当前密谋上放置 1 个毁灭标记（可导致推进）' },
      { id: 'horror', label: '每位调查员受到 2 点直接恐惧' },
      { id: 'winds', label: '如同揭示了非[elder_sign]符号标记般结算风卡强制效果' },
    ],
  }) : 'horror'
  if (choice === 'doom') {
    if (typeof api.addDoom === 'function') api.addDoom(1)
    else state.doom = (Number(state.doom) || 0) + 1
    info(api, '迷失云中：在当前密谋上放置 1 个毁灭标记。')
  } else if (choice === 'horror') {
    for (const other of activeInvestigators(state)) {
      if (typeof api.horror === 'function') api.horror(other.seat, 2)
      else other.horror = (Number(other.horror) || 0) + 2
    }
    info(api, '迷失云中：每位调查员受到 2 点直接恐惧。')
  } else {
    const result = blowWinds(state, api)
    flipWinds(state, api)
    info(api, `迷失云中：结算风卡强制效果（滑动 ${result.rows.length} 行）。`)
  }
  return true
}

/** 11664 剥蚀壁画：附属到地点；[action] 战斗或智识(3)；成功放 1 资源，达到每调查员 1 个时翻面记录符文。 */
export function erodedFriezeAction(state, inv, api = {}, { skill = 'intellect' } = {}) {
  const here = locationOf(state, inv?.location)
  const attachment = (here?.attachments || []).find(item => codeOf(item) === ERODED_FRIEZE_CODE)
  if (!attachment || attachment.flipped) return false
  if (typeof api.test !== 'function') return false
  let success = false
  api.test(inv.seat, skill, 3, result => { success = result?.success === true })
  if (!success) {
    if (typeof api.damage === 'function') api.damage(inv.seat, 1)
    else inv.damage = (Number(inv.damage) || 0) + 1
    return true
  }
  attachment.tokens = (Number(attachment.tokens) || 0) + 1
  if (attachment.tokens >= investigatorCount(state)) {
    attachment.flipped = true
    translateGlyph(state, ERODED_FRIEZE_GLYPH.rune, ERODED_FRIEZE_GLYPH.word, api)
    state.victoryDisplay ||= []
    state.victoryDisplay.push({ id: `eroded-frieze-${here.id}`, code: ERODED_FRIEZE_STORY_CODE, originalCode: ERODED_FRIEZE_STORY_CODE,
      name: ALL_CARDS[ERODED_FRIEZE_STORY_CODE]?.nameZh || '剥蚀壁画', victory: 1 })
    info(api, '剥蚀壁画翻面：记录符文 [rune_e]（黑暗）并加入胜利区。')
  }
  return true
}

export const events = {
  obsidianStElmosFire(state, payload = {}, api = {}) {
    return stElmosFire(state, (state.investigators || [])[payload.seat], api)
  },
  obsidianAcrophobia(state, payload = {}, api = {}) {
    return acrophobia(state, (state.investigators || [])[payload.seat], api)
  },
  obsidianWingsOfTerror(state, payload = {}, api = {}) {
    return wingsOfTerror(state, (state.investigators || [])[payload.seat], api)
  },
  obsidianLostInTheClouds(state, payload = {}, api = {}) {
    return lostInTheClouds(state, (state.investigators || [])[payload.seat], api)
  },
  obsidianErodedFrieze(state, payload = {}, api = {}) {
    return erodedFriezeAction(state, (state.investigators || [])[payload.seat], api)
  },
}

// ---------------------------------------------------------------------------
// 混乱标记
// ---------------------------------------------------------------------------
export function resolveChaosToken(state, inv, token) {
  return obsidianCanyonChaosToken(state, inv, token)
}
export function chaosTokenValue(state, tokenFace) {
  return obsidianCanyonChaosTokenValue(state, tokenFace)
}
export function applyTokenEffect(state, inv, effect = {}, api = {}) {
  const mode = effect?.mode
  if (mode === 'revealAnother') {
    if (typeof api.revealToken !== 'function') return false
    const token = api.revealToken(inv?.seat ?? 0)
    info(api, `[elder_thing]：再揭示一个标记（${token}）。`)
    return true
  }
  return false
}

// ---------------------------------------------------------------------------
// 结局
// ---------------------------------------------------------------------------
export function resolutionChainForKey(state, key) {
  void state
  return RESOLUTION_KEYS.includes(String(key)) ? [String(key)] : ['noResolution']
}

export function resolution(state, key, events = null, api = {}) {
  void events
  const branch = branchOf(state)
  const finalKey = RESOLUTION_KEYS.includes(String(key)) ? String(key) : 'noResolution'
  const records = recordsFor(state)
  records.rlyehMap = [...new Set([...(Array.isArray(records.rlyehMap) ? records.rlyehMap : []), 'obsidianCanyons'])]
  const award = { bonus: 0, award: true, next: null, branch }
  const update = (target, extra) => Object.assign(award, extra)
  if (finalKey === 'noResolution') {
    update(award, { next: branch === 'west' ? 'sepulchreOfTheSleeper' : 'courtOfTheAncients',
      weaknessSearch: true })
    info(api, '无结局：划掉拉莱耶地图上的黑曜石峡谷；每位调查员获得随机疯狂/预兆基础弱点。')
  } else {
    const claimClaw = (state.investigators || []).some(inv => (inv.assets || []).some(asset => OBSIDIAN_CLAW_CODES.includes(codeOf(asset))))
      || flagsFor(state).obsidianClawOwnerSeat != null
    if (claimClaw) {
      records.obsidianClaw = true
      info(api, '结局：勾选「黑曜石之爪」。')
    }
    update(award, finalKey === 'resolution1'
      ? { next: 'sepulchreOfTheSleeper', claimObsidianClaw: claimClaw }
      : { next: 'courtOfTheAncients', claimObsidianClaw: claimClaw })
    info(api, `结局 ${finalKey.slice(-1)}：结算胜利区经验。`)
  }
  const proveResult = resolveProveYourWorth(state, api, finalKey)
  setFlag(state, 'obsidianResolution', finalKey)
  setFlag(state, 'obsidianResolutionBranch', branch)
  if (proveResult.length) setFlag(state, 'proveYourWorthResolved', proveResult)
  return award
}

/** 结局页的「证明你的价值」Task 故事：按 helpedWithTheRopes / wasHelpedWithTheRopes 记录结算。 */
export function resolveProveYourWorth(state, api = {}, finalKey = 'noResolution') {
  const results = []
  const helperSeats = state.scenarioFlags?.proveYourWorthHelperSeats || []
  const helpedSeats = state.scenarioFlags?.proveYourWorthHelpedSeats || []
  for (const inv of state.investigators || []) {
    const tasks = tasksOf(state, inv)
    if (!tasks.includes('proveYourWorth')) continue
    const isHelper = helperSeats.includes(inv.seat)
    if (isHelper) {
      for (const other of state.investigators || []) {
        if (!helpedSeats.includes(other.seat)) continue
        addPhysicalTrauma(state, api, other.seat, 1)
        if (typeof api.addScenarioXpBonus === 'function') api.addScenarioXpBonus(other.seat, 2)
      }
      progressChange(state, api, 'proveYourWorth', inv.seat, 2)
      results.push({ seat: inv.seat, branch: 'helped', finalKey })
    } else {
      progressChange(state, api, 'proveYourWorth', inv.seat, -1)
      addMentalTrauma(state, api, inv.seat, 1)
      for (const other of state.investigators || []) {
        if (other.seat === inv.seat) continue
        if (typeof api.addScenarioXpBonus === 'function') api.addScenarioXpBonus(other.seat, 1)
      }
      results.push({ seat: inv.seat, branch: 'otherwise', finalKey })
    }
  }
  return results
}

// ---------------------------------------------------------------------------
// 只读投影（测试 / 主进程验收）
// ---------------------------------------------------------------------------
export function implementedEntryFlags(code) {
  return entryOf(code)?.flags || {}
}

export function scenarioSummary(state) {
  return {
    branch: branchOf(state),
    act: currentActCode(state),
    agenda: currentAgendaCode(state),
    storm: stormIntensity(state),
    openSky: openSkyLocations(state).length,
    summitDeck: summitSize(state),
    encounterDeck: (state.encounterDeck || []).length,
    locations: (state.locations || []).length,
    winds: windsInPlay(state) ? codeOf(windsInPlay(state)) : null,
    grid: Object.fromEntries(Object.entries(mechanicState(state)?.grid || {})
      .map(([id, cell]) => [id, { x: cell.x, y: cell.y }])),
  }
}

export function neighborsOf(state, locationId) {
  return (locationOf(state, locationId)?.connections || []).filter(id => locationOf(state, id))
}

// ---------------------------------------------------------------------------
// 引擎钩子对象
// ---------------------------------------------------------------------------
export const behavior = {
  id: CHAPTER_ID,
  startLocation: () => START_LOCATION,
  locationsStartRevealed: false,
  introduction: null,
  preScenarioSetup,
  prepareScenario,
  setupScenario,
  setupLocations,
  setupEnemies,
  modifyDeck,
  afterDeckSetup,
  locationPlaced,
  locationRevealed,
  afterInvestigate,
  afterTest,
  events,
  actions,
  performAction,
  turnBegins,
  turnEnded,
  roundEnded,
  enemySpawned,
  phaseBegan,
  movementError,
  locationStory,
  canOpportunityAttack,
  enemyDisengaged,
  commitIconMultiplier,
  canGainResources,
  enemyDefeated,
  enemyAttackResolved,
  actReveal,
  agendaReveal,
  checkObjectives,
  allResigned,
  resolveChaosToken,
  chaosTokenValue,
  applyTokenEffect,
  resolution,
  scenarioSummary,
  // 具名助手（测试与主进程验收用）
  branchOf,
  expeditionOf,
  configureMap,
  placeLocationInGrid,
  rotateLocationPorts,
  summitAdapter,
  summitCards,
  summitSize,
  fillGridCell,
  fillSkylineGaps,
  blowWinds,
  flipWinds,
  windsInPlay,
  openSkyLocations,
  openSkyPool,
  placeOpenSky,
  placeOpenSkyAt,
  removeLocationToSummitTop,
  rebuildSkyline,
  evacuateLocation,
  dazzlingSkylineReveal,
  ancientCanyonsReveal,
  farthestLocationFromInvestigators,
  searchTheSpires,
  translateGlyph,
  resolveProveYourWorth,
  resolveIntroTasks,
  tasksOf,
  isOpenSky,
  isSlidableLocation,
  locationCannotLeavePlay,
  enemyDisengaged,
  commitIconMultiplier,
  summitEnemiesWithin,
  canOpportunityAttack,
  canGainResources,
  enemySpawned,
  phaseBegan,
  locationOf,
  neighborsOf,
  advanceStorm: increaseStormIntensity,
}

export { ACT_CODE_BY_BRANCH, RESOLUTION_KEYS, START_LOCATION, REFERENCE_CODE, ENCOUNTER_DECK, LOCATION_CODE }
