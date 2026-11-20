// 阿卡姆的毁灭 第一部分（theDoomOfArkhamPartI · 11682）· 引擎钩子（章节流程）。
//
// 参考：Scenario/Scenarios/TheDrownedCity/TheDoomOfArkhamPartI.hs +
//       Act|Agenda|Location|Enemy/Cards/TheDrownedCity/TheDoomOfArkham/*.hs +
//       frontend/src/locales/en/theDrownedCity/theDoomOfArkhamPartI.json。
//
// 引擎读点（全部走既有钩子，不改引擎）：
//   preScenarioSetup / introduction → 变体地点与「商店在 6 处地点下方」的洗牌、幕/议程、议程初始毁灭
//   modifyDeck → 星之眷族随机移除 2 张（简单 3 张）
//   setupLocations / locationPlaced / afterDeckSetup → 午夜假面 8 地点、约翰·雷蒙德·勒格拉斯入场
//   actions / performAction → 幕 1「共同花费 1[per_investigator] 线索抽地点下方最上方的卡」、商店 [fast]
//   roundEnded → 幕 1 目标（商店调查员控制 ≥1 张神器 → 可推进）
//   actReveal → 幕 1 背面（控制 ≥5 张神器 → 结局 1，否则 +1 额外经验 → 结局 2）
//   enemyStatModifier → 兰道尔·蒂林哈斯特 +1 战斗 / +1[每调查员] 生命（按商店下方牌数）
//   doomPlaced → 议程 1「放置毁灭时提高队长所在地点淹没等级」
//   resolveChaosToken / applyTokenEffect → 11682 四档混乱标记
//   resolution → 结局 1/2/3 与无结局：神器划除、黏土恐怖、淹没街区记录
//
// 本章状态只写 state.scenarioFlags / state.scenarioZones / state.campaign.records（纯 JSON）。
import { mechanicState } from '../../../../../src/engine/mechanic-state.js'
import { registeredEntry } from '../../../../../src/engine/ability.js'
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import {
  CHAPTER_ID, REFERENCE_CODE, PHANTOM_SHOP_ACT_CODE, TILLINGHAST_ESOTERICA_CODE,
  RANDALL_TILLINGHAST_CODE, LEGRASSE_CODE, HORROR_IN_CLAY_CODE, RESOLUTION_KEYS,
  RESOLUTION_ARTIFACT_COUNT, ACT_CODES, AGENDA_CODES, ACT_STAGES, AGENDA_STAGES, ACTS, AGENDAS,
  STAGE_CARDS, START_LOCATION, BASE_LOCATION_IDS, HIDING_LOCATION_IDS, LOCATION_VARIANTS,
  LOCATIONS, LOCATION_CONNECTIONS, LOCATION_COORDINATES, SET_ASIDE_LOCATION_IDS, SET_ASIDE_CARDS,
  ENCOUNTER_DECK, MIDNIGHT_MASKS_DECK_CODES, STAR_SPAWN_REMOVAL_CODES, STAR_SPAWN_REMOVAL_COUNT,
  STAR_SPAWN_REMOVAL_COUNT_EASY, SCENARIO_TEXT, GATHER_GROUPS,
} from './definition.js'
import {
  doomOfArkhamPartOneChaosToken, doomOfArkhamPartOneChaosTokenValue, locationsWithoutBeneath,
  skullValue, isHardSide, hasTrait, codeOf, nearestEnemyWithoutDoom, CHAOS_TOKEN_FACES,
} from './chaos.js'
import { STORY } from './story.js'

// ---------------------------------------------------------------------------
// 基础工具
// ---------------------------------------------------------------------------
const activeInvestigators = state => (state.investigators || [])
  .filter(inv => inv && !inv.defeated && !inv.resigned)
const investigatorCount = state => Number(state?.numInvestigators) || (state?.investigators || []).length || 1
const info = (api, message) => api?.info?.(message)
const clone = value => structuredClone(value)
const isHardExpert = state => ['hard', 'expert'].includes(String(state?.difficulty || 'standard'))
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
const randomValue = (api, fallback = 0.5) => {
  if (typeof api?.random === 'function') return Number(api.random())
  if (typeof api?.randomValue === 'function') return Number(api.randomValue())
  return fallback
}
const shuffleWith = (api, list) => {
  if (typeof api?.shuffle === 'function') return api.shuffle([...list])
  // 确定性兜底：按传入顺序返回（单测会注入 api.shuffle）。
  return [...list]
}
const locationOf = (state, id) => (state?.locations || []).find(location => location.id === id) || null
const currentAct = state => (state?.acts || [])[state.actIndex ?? 0] || null
const currentActCode = state => codeOf(currentAct(state))
const currentAgenda = state => (state?.agendas || [])[state.agendaIndex ?? 0] || null
const currentAgendaCode = state => codeOf(currentAgenda(state))
const entryOf = code => (code ? registeredEntry(String(code)) : null)
const flagsOfCode = code => entryOf(code)?.flags || {}
const beneathFor = state => (state.scenarioZones ||= {}).beneathStacks ||= {}
const stackAt = (state, locationId) => beneathFor(state)[locationId] || []
const groupCluesAt = (state, locationId) => activeInvestigators(state)
  .filter(inv => inv.location === locationId)
  .reduce((sum, inv) => sum + (Number(inv.clues) || 0), 0)
function spendGroupClues(state, locationId, amount) {
  let remaining = amount
  for (const inv of activeInvestigators(state)) {
    if (remaining <= 0) break
    if (inv.location !== locationId) continue
    const pay = Math.min(Number(inv.clues) || 0, remaining)
    inv.clues -= pay
    remaining -= pay
  }
  return remaining === 0
}

// ---------------------------------------------------------------------------
// 淹没（水位走 mechanicState.flood；引擎有 api.mechanics.water 时优先转调）
// ---------------------------------------------------------------------------
export function floodLevelOf(state, locationId, api = {}) {
  if (api?.mechanics?.water?.level) return Number(api.mechanics.water.level(locationId)) || 0
  return Number(mechanicState(state)?.flood?.[locationId]) || 0
}
export function changeFloodLevel(state, locationId, delta, api = {}) {
  if (api?.mechanics?.water?.change) {
    const result = api.mechanics.water.change(locationId, delta)
    return result !== false
  }
  const data = mechanicState(state, true)
  data.flood ||= {}
  const before = Number(data.flood[locationId]) || 0
  const after = Math.max(0, Math.min(2, before + delta))
  data.flood[locationId] = after
  return after !== before
}
export function floodedLocationIds(state, api = {}) {
  const flood = api?.mechanics?.water?.level
    ? Object.fromEntries((state.locations || []).map(location => [location.id, api.mechanics.water.level(location.id)]))
    : (mechanicState(state)?.flood || {})
  return Object.entries(flood).filter(([, level]) => Number(level) > 0).map(([id]) => id)
}
const leadSeat = state => Number(state?.currentSeat ?? state?.campaign?.leadSeat ?? 0)

// ---------------------------------------------------------------------------
// 布置：变体地点 / 商店位置 / 6 处地点下方的暗牌
// ---------------------------------------------------------------------------
export function hiddenCardPool() {
  return [TILLINGHAST_ESOTERICA_CODE, ...MIDNIGHT_MASKS_DECK_CODES]
}

export function prepareScenario(state, api = {}) {
  if (state.scenarioFlags?.doomArkhamPartOnePrepared) return state.scenarioFlags.doomArkhamPartOneReport
  const shuffle = list => shuffleWith(api, list)
  const random = () => randomValue(api)
  const pick = list => list[Math.min(list.length - 1, Math.floor(random() * list.length))]
  const variants = {
    downtown: pick(LOCATION_VARIANTS.downtown),
    southside: pick(LOCATION_VARIANTS.southside),
  }
  const hidden = shuffle(hiddenCardPool())
  // 暗牌按地点 id 登记（商业区/南区使用固定的 downtown/southside id，卡号在运行期选定）。
  const beneath = Object.fromEntries(HIDING_LOCATION_IDS.map((id, index) => [id, hidden[index] ? [hidden[index]] : []]))
  // 起始幕/议程：商店幕固定 1 张；议程 1 开局毁灭 = 调查员人数（Setup「Place doom on the agenda…」）。
  const act = clone((state.scenario?.stageCards || STAGE_CARDS)[PHANTOM_SHOP_ACT_CODE] || ACT_STAGES[1])
  const agenda = clone((state.scenario?.stageCards || STAGE_CARDS)[AGENDA_CODES[0]] || AGENDA_STAGES[1])
  state.acts = [act]
  state.agendas = [agenda]
  state.actIndex = Number.isInteger(state.actIndex) ? state.actIndex : 0
  state.agendaIndex = Number.isInteger(state.agendaIndex) ? state.agendaIndex : 0
  state.doom = investigatorCount(state)
  state.scenarioZones ||= {}
  state.scenarioZones.beneathStacks = beneath
  state.scenarioZones.setAside = [...SET_ASIDE_CARDS]
  state.scenarioZones.setAsideLocations = [...SET_ASIDE_LOCATION_IDS]
  const report = {
    variants,
    hiddenCards: hidden,
    beneath,
    initialDoom: state.doom,
    actCodes: [...ACT_CODES],
    agendaCodes: [...AGENDA_CODES],
  }
  setFlag(state, 'doomArkhamPartOneReport', report)
  setFlag(state, 'doomArkhamPartOnePrepared', true)
  info(api, `阿卡姆的毁灭 I：商业区=${variants.downtown}，南区=${variants.southside}；`
    + `6 处地点下方各 1 张暗牌；议程初始毁灭 ${state.doom}。`)
  return report
}

export function preScenarioSetup(state, events, helperOrApi = {}) {
  void events
  const api = helperOrApi?.api || helperOrApi || {}
  const report = prepareScenario(state, api)
  return { ...report, introText: SCENARIO_TEXT.intro }
}

/** 当前实际使用的地图地点 id（商业区/南区使用固定 id，卡号由战役 Setup 随机选定）。 */
export function placedBaseLocationIds(state) {
  void state
  return [...BASE_LOCATION_IDS]
}

/** 直调/单测入口：手动把地点实例放进 state.locations，并写网格坐标。 */
export function placeLocationAt(state, locationId, cell, api = {}, { revealed = null } = {}) {
  if (locationOf(state, locationId)) return locationOf(state, locationId)
  const base = (state.scenario?.locations || LOCATIONS)[locationId]
  if (!base) return null
  const report = state.scenarioFlags?.doomArkhamPartOneReport
  const variantCode = locationId === 'downtown' ? report?.variants?.downtown
    : locationId === 'southside' ? report?.variants?.southside : null
  const code = variantCode || base.code
  const card = ALL_CARDS[code] || {}
  const clues = base.cluesPerInvestigator != null
    ? base.cluesPerInvestigator * investigatorCount(state)
    : (base.cluesFixed ?? Number(card.clues) ?? base.clues ?? 1)
  const shouldReveal = revealed == null ? true : revealed
  const location = {
    ...clone(base), id: locationId, code, originalCode: code,
    name: card.nameZh || base.name,
    shroud: Number(card.shroud) || base.shroud,
    ...(card.victory ? { victory: card.victory } : {}),
    revealed: shouldReveal,
    clues: shouldReveal ? clues : 0, maxClues: clues,
    connections: [...(base.connections || [])],
  }
  state.locations ||= []
  state.locations.push(location)
  if (cell) {
    const data = mechanicState(state, true)
    data.grid ||= {}
    data.grid[locationId] = { x: cell.x, y: cell.y, isolated: false, connections: [] }
    location.grid = { x: cell.x, y: cell.y }
  }
  info(api, `📍 「${location.name}」进入游戏。`)
  return location
}

/** 幽灵商店入场：放在 host 地点旁的空位，并建立双向连接。 */
export function placeShop(state, hostLocationId, api = {}) {
  const host = locationOf(state, hostLocationId)
  if (!host) return null
  if (locationOf(state, 'tillinghastEsoterica')) return locationOf(state, 'tillinghastEsoterica')
  const grid = mechanicState(state)?.grid || {}
  const candidates = [[0, -1], [1, 0], [0, 1], [-1, 0], [1, -1], [-1, 1]]
  const hostCell = grid[hostLocationId] || LOCATION_COORDINATES[hostLocationId] || { x: 0, y: 0 }
  let cell = null
  for (const [dx, dy] of candidates) {
    const x = hostCell.x + dx, y = hostCell.y + dy
    const occupied = Object.entries(grid).some(([id, item]) => id !== 'tillinghastEsoterica' && item.x === x && item.y === y)
    if (!occupied) { cell = { x, y }; break }
  }
  const shop = placeLocationAt(state, 'tillinghastEsoterica', cell || { x: hostCell.x, y: hostCell.y + 2 }, api, { revealed: false })
  if (!shop) return null
  shop.connections = [hostLocationId]
  host.connections = [...new Set([...(host.connections || []), 'tillinghastEsoterica'])]
  setFlag(state, 'doomArkhamPartOneShopHost', hostLocationId)
  info(api, `「${shop.name}」出现在「${host.name}」旁（未揭示）。`)
  return shop
}

export function setupLocations(state, events = null, helper = {}) {
  void events
  const api = helper?.api || {}
  prepareScenario(state, api)
  for (const id of placedBaseLocationIds(state)) {
    placeLocationAt(state, id, LOCATION_COORDINATES[id], api, { revealed: true })
  }
  // 商店不在 Setup 入场：它被洗到 6 处地点之一的下方。
  return placedBaseLocationIds(state)
}

export function setupEnemies() {
  // 兰道尔由「幽灵商店」的 Revelation 生成（drawBeneath 抽到商店时）。
}

export function modifyDeck(state, deck, events = null, helper = {}) {
  void events
  void helper
  const report = state.scenarioFlags?.doomArkhamPartOneReport || {}
  if (report.starSpawnRemoved) return deck
  const count = String(state.difficulty) === 'easy' ? STAR_SPAWN_REMOVAL_COUNT_EASY : STAR_SPAWN_REMOVAL_COUNT
  const candidates = deck.filter(code => STAR_SPAWN_REMOVAL_CODES.includes(code))
  const removed = []
  const pool = [...candidates]
  for (let index = 0; index < count && pool.length; index += 1) {
    const pick = Math.min(pool.length - 1, Math.floor(randomValue(helper?.api || {}) * pool.length))
    removed.push(pool.splice(pick, 1)[0])
  }
  setFlag(state, 'doomArkhamPartOneStarSpawnRemoved', removed)
  if (state.scenarioFlags?.doomArkhamPartOneReport) {
    state.scenarioFlags.doomArkhamPartOneReport.starSpawnRemoved = removed
  }
  return deck.filter((code, index) => {
    if (!STAR_SPAWN_REMOVAL_CODES.includes(code)) return true
    const position = deck.slice(0, index).filter(item => item === code).length
    return position >= removed.filter(item => item === code).length
  })
}

export function afterDeckSetup(state, events = null, helper = {}) {
  void events
  const api = helper?.api || {}
  // 约翰·雷蒙德·勒格拉斯：Setup 里由队长选择一名调查员，直接入场（不占盟友槽）。
  const record = recordsFor(state)
  const candidate = (state.investigators || []).find(inv => !inv.defeated && !inv.resigned)
  if (candidate && !(state.investigators || []).some(inv => (inv.assets || []).some(asset => codeOf(asset) === LEGRASSE_CODE))) {
    const asset = typeof api.giveAsset === 'function' ? api.giveAsset(candidate.seat, LEGRASSE_CODE) : null
    if (asset && flagsOfCode(LEGRASSE_CODE).allySlotExempt) {
      if (typeof api.exemptAssetSlot === 'function') api.exemptAssetSlot(asset, 'ally')
      asset.ignoredSlots = [...new Set([...(asset.ignoredSlots || []), 'ally'])]
      info(api, `约翰·雷蒙德·勒格拉斯加入 ${candidate.name} 的控制（本关不占盟友槽）。`)
    }
  }
  void record
  setFlag(state, 'doomArkhamPartOneDeckReady', true)
}

/** 直调/单测入口：准备 + 8 地点入场 + 商店暗牌 + 勒格拉斯。 */
export function setupScenario(state, api = {}) {
  state.locations = []
  delete state.scenarioFlags?.doomArkhamPartOnePrepared
  delete state.scenarioFlags?.doomArkhamPartOneReport
  state.scenarioZones ||= {}
  state.scenarioZones.beneathStacks = {}
  const report = prepareScenario(state, api)
  for (const id of placedBaseLocationIds(state)) {
    placeLocationAt(state, id, LOCATION_COORDINATES[id], api, { revealed: true })
  }
  for (const inv of state.investigators || []) if (!inv.location) inv.location = START_LOCATION
  if (!state.encounterDeck?.length) state.encounterDeck = [...(state.scenario?.encounterDeck || ENCOUNTER_DECK)]
  const kept = modifyDeck(state, state.encounterDeck, null, { api })
  state.encounterDeck = kept
  afterDeckSetup(state, null, { api })
  info(api, `阿卡姆的毁灭 I：${state.locations.length} 处地点入场；遭遇牌库 ${state.encounterDeck.length} 张。`)
  return { ...report, placedIds: state.locations.map(location => location.id) }
}

// ---------------------------------------------------------------------------
// 地点下方的暗牌（幕 1 行动）
// ---------------------------------------------------------------------------
export function takeTopBeneath(state, locationId) {
  const stack = stackAt(state, locationId)
  return stack.length ? stack.shift() : null
}
export function putBeneathBottom(state, locationId, code) {
  const stacks = beneathFor(state)
  stacks[locationId] ||= []
  stacks[locationId].push(code)
}
export function takeTopBeneathCode(state, locationId, api = {}) {
  const code = takeTopBeneath(state, locationId)
  if (!code) return null
  const location = locationOf(state, locationId)
  const card = ALL_CARDS[code] || {}
  // 幽灵商店：Revelation 放到你所在地点相邻处，生成兰道尔，并把放在一边的神器洗到其下方。
  if (code === TILLINGHAST_ESOTERICA_CODE) {
    const shop = placeShop(state, locationId, api)
    if (shop) {
      const beneath = shuffleWith(api, artifactsOnRecord(state))
      beneathFor(state)[shop.id] = beneath
      if (typeof api.spawn === 'function') {
        const enemy = api.spawn(RANDALL_TILLINGHAST_CODE, shop.id, { ignoreSpawn: true })
        void enemy
      }
      info(api, `揭示「${shop.name}」：兰道尔·蒂林哈斯特现身，其下方有 ${beneath.length} 张神器。`)
    }
    return code
  }
  if (card.type === 'asset' && typeof api.giveAsset === 'function') {
    const inv = activeInvestigators(state).find(item => item.location === locationId)
    if (inv) {
      const asset = api.giveAsset(inv.seat, code)
      if (asset && typeof api.exemptAssetSlot === 'function' && card.traits?.includes('Artifact')) {}
      info(api, `「${location?.name || locationId}」下方的「${card.nameZh || card.name || code}」由 ${inv.name} 控制。`)
      return code
    }
  }
  // 遭遇卡（午夜假面诡计）：按正常遭遇管线揭示。
  if (typeof api.drawEncounter === 'function') {
    state.encounterDeck ||= []
    state.encounterDeck.push(code)
    api.drawEncounter((activeInvestigators(state).find(item => item.location === locationId) || {}).seat ?? leadSeat(state))
  } else {
    state.encounterDiscard ||= []
    state.encounterDiscard.push(code)
  }
  info(api, `「${location?.name || locationId}」下方的「${card.nameZh || card.name || code}」被揭示（遭遇卡）。`)
  return code
}

// 战役记录里「已获得」的神器（§4 记录的布尔键 → 卡号）。
export const ARTIFACT_RECORD_KEYS = Object.freeze({
  barrierNode: '11552',
  obsidianClaw: '11672a',
  shardOfYchlecht: '11638',
  tidalTablet: '11611',
  grislyMask: '11582',
})
export function artifactsOnRecord(state) {
  const records = recordsFor(state)
  return Object.entries(ARTIFACT_RECORD_KEYS)
    .filter(([key]) => records[key] === true)
    .map(([, code]) => code)
}

// ---------------------------------------------------------------------------
// 行动
// ---------------------------------------------------------------------------
export function actions(state, inv) {
  if (!inv || inv.defeated || inv.resigned) return []
  const moves = []
  const act = currentActCode(state)
  const here = locationOf(state, inv.location)
  if (!here) return moves
  const required = investigatorCount(state)
  const beneath = stackAt(state, here.id)
  if (act === PHANTOM_SHOP_ACT_CODE && flagsOfCode(act).shopAction === true && beneath.length) {
    const available = groupCluesAt(state, here.id)
    moves.push({
      action: 'scenarioAction', rule: 'doomArkhamDrawBeneath', locationId: here.id, actions: 1,
      label: `共同花费 ${required} 个线索：抽取「${here.name}」下方最上方的 1 张卡牌`,
      reason: available >= required ? null : `需要本地点共 ${required} 个线索（现有 ${available}）`,
    })
  }
  if (here.originalCode === TILLINGHAST_ESOTERICA_CODE || herFlags(here).fastClues) {
    moves.push({
      action: 'scenarioAction', rule: 'doomArkhamShopClues', locationId: here.id, actions: 0,
      label: '快速：将线索放到本地点，直到其线索值',
    })
  }
  return moves
}
const herFlags = location => flagsOfCode(location?.originalCode || location?.code)

export function performAction(state, inv, move, api = {}) {
  if (!move || !inv || inv.defeated || inv.resigned) return false
  if (move.rule === 'doomArkhamDrawBeneath') return drawBeneathAction(state, inv, api)
  if (move.rule === 'doomArkhamShopClues') return shopCluesAction(state, inv, api)
  return false
}

export function drawBeneathAction(state, inv, api = {}) {
  const location = locationOf(state, inv.location)
  if (!location) return false
  if (!stackAt(state, location.id).length) return false
  const required = investigatorCount(state)
  if (groupCluesAt(state, location.id) < required) return false
  spendGroupClues(state, location.id, required)
  info(api, `${inv.name} 与同伴共同支付 ${required} 个线索，抽取「${location.name}」下方的卡牌。`)
  return Boolean(takeTopBeneathCode(state, location.id, api))
}

export function shopCluesAction(state, inv, api = {}) {
  const location = locationOf(state, inv.location)
  if (!location) return false
  const key = `doomArkhamShopCluesUsed:${location.id}`
  if (flagsFor(state)[key]) return false
  const target = Number(location.maxClues) || Number(ALL_CARDS[location.originalCode || location.code]?.clues) || 3
  location.clues = Math.max(Number(location.clues) || 0, target)
  flagsFor(state)[key] = true
  info(api, `「${location.name}」放置线索直到其线索值（${target}）。`)
  return true
}

// ---------------------------------------------------------------------------
// 轮末目标 / 幕推进
// ---------------------------------------------------------------------------
export function artifactsControlled(state) {
  return activeInvestigators(state).flatMap(inv => (inv.assets || []).filter(asset =>
    hasTrait(ALL_CARDS[codeOf(asset)] || asset, 'Artifact') || flagsOfCode(codeOf(asset)).artifact === true))
}

export function phantomShopObjectiveMet(state) {
  const shop = locationOf(state, 'tillinghastEsoterica')
  if (!shop) return false
  const atShop = activeInvestigators(state).filter(inv => inv.location === shop.id)
  return atShop.some(inv => (inv.assets || []).some(asset =>
    hasTrait(ALL_CARDS[codeOf(asset)] || asset, 'Artifact') || flagsOfCode(codeOf(asset)).artifact === true))
}

export function roundEnded(state, api = {}) {
  if (currentActCode(state) !== PHANTOM_SHOP_ACT_CODE) return false
  if (!phantomShopObjectiveMet(state)) return false
  const choice = typeof api.choose === 'function'
    ? api.choose({
      kind: 'act', source: PHANTOM_SHOP_ACT_CODE, seat: leadSeat(state), canSkip: true,
      prompt: '幕目标达成：是否推进「幽灵商店」？',
      options: [{ id: 'skip', label: '暂不推进' }, { id: 'advance', label: '推进场景' }],
    })
    : 'advance'
  if (choice !== 'advance') return false
  if (typeof api.advanceAct === 'function') api.advanceAct()
  else actReveal(state, currentAct(state), api)
  return true
}

export function actReveal(state, act, api = {}) {
  const code = codeOf(act)
  if (code !== PHANTOM_SHOP_ACT_CODE) return false
  const controlled = artifactsControlled(state).length
  if (controlled >= RESOLUTION_ARTIFACT_COUNT) {
    info(api, `幕 1 背面：调查员控制 ${controlled} 张神器（≥${RESOLUTION_ARTIFACT_COUNT}）→ 结局 1。`)
    if (typeof api.finish === 'function') api.finish('resolution1')
    else resolution(state, 'resolution1', null, api)
  } else {
    info(api, `幕 1 背面：调查员控制 ${controlled} 张神器（<${RESOLUTION_ARTIFACT_COUNT}）→ 结局 2，每人 +1 额外经验。`)
    for (const inv of activeInvestigators(state)) {
      if (typeof api.addScenarioXpBonus === 'function') api.addScenarioXpBonus(inv.seat, 1)
      else inv.scenarioXpBonus = (Number(inv.scenarioXpBonus) || 0) + 1
    }
    if (typeof api.finish === 'function') api.finish('resolution2')
    else resolution(state, 'resolution2', null, api)
  }
  setFlag(state, 'doomArkhamPartOneActResolved', controlled >= RESOLUTION_ARTIFACT_COUNT ? 'resolution1' : 'resolution2')
  return true
}

export function checkObjectives(state, api = {}) {
  return roundEnded(state, api)
}

// ---------------------------------------------------------------------------
// 兰道尔·蒂林哈斯特 / 议程
// ---------------------------------------------------------------------------
const shopBeneathCount = state => stackAt(state, 'tillinghastEsoterica').length

export function enemyStatModifier(state, enemy, stat) {
  const code = codeOf(enemy)
  if (code !== RANDALL_TILLINGHAST_CODE) return 0
  const beneath = shopBeneathCount(state)
  if (!beneath) return 0
  const spec = flagsOfCode(RANDALL_TILLINGHAST_CODE)
  if (stat === 'fight') return (Number(spec.fightPerBeneath) || 1) * beneath
  if (stat === 'health') return (Number(spec.healthPerInvestigatorPerBeneath) || 1) * beneath * investigatorCount(state)
  return 0
}

export function doomPlaced(state, payload = {}, api = {}) {
  if (!payload?.agenda) return false
  const agenda = currentAgenda(state)
  if (codeOf(agenda) !== AGENDA_CODES[0] && flagsOfCode(codeOf(agenda)).floodOnDoom !== 'lead') return false
  const target = (state.investigators || [])[leadSeat(state)]
  const location = target ? locationOf(state, target.location) : null
  if (!location) return false
  const changed = changeFloodLevel(state, location.id, 1, api)
  if (changed) info(api, `议程 1：提高队长所在地点「${location.name}」的淹没等级。`)
  return changed
}

// ---------------------------------------------------------------------------
// 混乱标记
// ---------------------------------------------------------------------------
export function resolveChaosToken(state, inv, token) {
  return doomOfArkhamPartOneChaosToken(state, inv, token)
}
export function chaosTokenValue(state, tokenFace) {
  return doomOfArkhamPartOneChaosTokenValue(state, tokenFace)
}
export function applyTokenEffect(state, inv, effect, api = {}) {
  if (!effect) return false
  const seat = inv?.seat ?? effect.seat ?? leadSeat(state)
  const investigator = (state.investigators || [])[seat]
  if (effect.mode === 'doomOnNearestEnemy') {
    const enemy = nearestEnemyWithoutDoom(state, investigator?.location, {
      nearest: (from, locations) => api?.mechanics?.map?.nearest?.(from, locations) ?? [],
    })
    if (!enemy) return false
    if (typeof api.placeDoomOnCard === 'function') api.placeDoomOnCard(enemy, 1)
    else enemy.doom = (Number(enemy.doom) || 0) + 1
    info(api, `[cultist] 检定失败：在「${enemy.name || codeOf(enemy)}」上放置 1 个毁灭标记。`)
    return true
  }
  if (effect.mode === 'clueOnLocation') {
    if (!investigator) return false
    const amount = Math.min(1, Number(investigator.clues) || 0)
    if (amount <= 0) return false
    if (typeof api.loseClues === 'function') api.loseClues(seat, 1)
    else investigator.clues -= 1
    if (typeof api.addCluesToLocation === 'function') api.addCluesToLocation(investigator.location, 1)
    else {
      const location = locationOf(state, investigator.location)
      if (location) location.clues = (Number(location.clues) || 0) + 1
    }
    info(api, `[tablet] 检定失败：${investigator.name} 把 1 个线索放在「${locationOf(state, investigator.location)?.name || investigator.location}」。`)
    return true
  }
  if (effect.mode === 'floodedAnotherToken') {
    if (!investigator) return false
    if (floodLevelOf(state, investigator.location, api) <= 0) return false
    if (typeof api.drawAnotherChaosToken === 'function') api.drawAnotherChaosToken(seat)
    info(api, `[elder_thing] ${investigator.name} 所在地点已淹没：再揭示一个标记。`)
    return true
  }
  return false
}

// ---------------------------------------------------------------------------
// 结局
// ---------------------------------------------------------------------------
const ARTIFACT_KEYS_BY_CODE = Object.freeze(Object.fromEntries(
  Object.entries(ARTIFACT_RECORD_KEYS).map(([key, code]) => [code, key]),
))

function recordFloodedNeighborhoods(state) {
  const records = recordsFor(state)
  const flooded = floodedLocationIds(state)
    .map(id => locationOf(state, id))
    .filter(Boolean)
  if (!flooded.length) return []
  const codes = flooded.map(location => String(location.originalCode || location.code))
  records.floodedNeighborhoods = [...new Set(codes)]
  return records.floodedNeighborhoods
}

function applyArtifactLog(state) {
  const records = recordsFor(state)
  const controlledCodes = new Set(artifactsControlled(state).map(asset => codeOf(asset)))
  for (const [code, key] of Object.entries(ARTIFACT_KEYS_BY_CODE)) {
    if (records[key] !== true) continue
    if (!controlledCodes.has(code)) records[key] = false
  }
  if (controlledCodes.has(HORROR_IN_CLAY_CODE)) records.horrorInClay = true
  return Object.fromEntries(Object.keys(ARTIFACT_RECORD_KEYS)
    .filter(key => records[key] === true).map(key => [key, true]))
}

export function resolution(state, key, events = null, api = {}) {
  void events
  const infoApi = api?.info ? api : api?.api || {}
  const finalKey = RESOLUTION_KEYS.includes(String(key)) ? String(key) : 'noResolution'
  const records = recordsFor(state)
  records.doomOfArkhamPartOneResolution = finalKey
  // 无结局：每名调查员应搜索一张随机基础创伤/疯狂弱点；引擎弱点补入在 campaign-flow，
  // 这里只记录结局（近似见 worker 报告）。
  applyArtifactLog(state)
  recordFloodedNeighborhoods(state)
  if (finalKey === 'noResolution') records.doomOfArkhamPartOneNoResolution = true
  // 结局 1/2/3 都在 Part I 结算；结局 2/3 的差别只是「立即继续 / 下次继续」。
  if (finalKey === 'resolution1' || finalKey === 'noResolution') {
    records.doomOfArkhamPartOneArtifacts = Object.keys(ARTIFACT_RECORD_KEYS).filter(artifactKey => records[artifactKey] === true)
  }
  info(infoApi, `阿卡姆的毁灭 I 结局：${finalKey}。`)
  return { bonus: finalKey === 'resolution2' ? 0 : 0, award: true }
}

// ---------------------------------------------------------------------------
// 只读投影
// ---------------------------------------------------------------------------
export function scenarioSummary(state) {
  return {
    act: currentActCode(state),
    agenda: currentAgendaCode(state),
    doom: Number(state.doom) || 0,
    locations: (state.locations || []).length,
    beneath: Object.fromEntries(Object.entries(state.scenarioZones?.beneathStacks || {})
      .map(([id, stack]) => [id, stack.length])),
    locationsWithoutBeneath: locationsWithoutBeneath(state),
    skull: skullValue(state),
    artifactsControlled: artifactsControlled(state).length,
    shopInPlay: Boolean(locationOf(state, 'tillinghastEsoterica')),
    randallInPlay: Boolean((state.enemies || []).some(enemy => codeOf(enemy) === RANDALL_TILLINGHAST_CODE)),
    starSpawnRemoved: [...(state.scenarioFlags?.doomArkhamPartOneStarSpawnRemoved || [])],
    flooded: floodedLocationIds(state),
  }
}

export function implementedEntryFlags(code) {
  return flagsOfCode(code)
}

export const behavior = {
  id: CHAPTER_ID,
  referenceCode: REFERENCE_CODE,
  startLocation: () => START_LOCATION,
  locationsStartRevealed: true,
  introduction(sc, records = {}, context = null) {
    void records
    void context
    const title = sc?.name || '阿卡姆的毁灭 · 第一部分'
    const paragraphs = [SCENARIO_TEXT.intro,
      ...Object.entries(STORY.intro).filter(([key]) => key !== 'intro1' && key !== 'proceedToSetup')
        .map(([, value]) => (value.paragraphs || []).join('\n\n')),
    ].filter(Boolean)
    const sections = [{ title, paragraphs }]
    return { version: 3, title, sections, paragraphs: sections.flatMap(section => section.paragraphs), code: ACT_CODES[0] }
  },
  preScenarioSetup,
  prepareScenario,
  setupScenario,
  setupLocations,
  setupEnemies,
  modifyDeck,
  afterDeckSetup,
  actions,
  performAction,
  roundEnded,
  checkObjectives,
  actReveal,
  doomPlaced,
  enemyStatModifier,
  resolveChaosToken,
  chaosTokenValue,
  applyTokenEffect,
  resolution,
  scenarioSummary,
  // 具名助手（测试与 Lead 验收）
  takeTopBeneath,
  putBeneathBottom,
  takeTopBeneathCode,
  placeLocationAt,
  placeShop,
  placedBaseLocationIds,
  artifactsControlled,
  artifactsOnRecord,
  phantomShopObjectiveMet,
  drawBeneathAction,
  shopCluesAction,
  floodLevelOf,
  changeFloodLevel,
  floodedLocationIds,
  stackAt,
  hiddenCardPool,
}

export {
  ACT_CODES, AGENDA_CODES, AGENDAS, ACTS, STAGE_CARDS, START_LOCATION, SET_ASIDE_CARDS,
  HIDING_LOCATION_IDS, MIDNIGHT_MASKS_DECK_CODES, CHAOS_TOKEN_FACES, stackAt,
}
