// 不留痕迹（Without a Trace · 09681）· 引擎钩子（异界牌库 + 阴影地点 + 空洞 + 幕/议程 + 结局）。
//
// 约定（与其它 TSK 章节 behavior 相同）：
//   · 逐卡规则在单卡条目的 enemyRule / assetRule / encounterResolve 里；
//     behavior 只做分派与本章专属机械（异界牌库、阴影三位置、空洞台账、幕/议程背面、结局记录）。
//   · 内容层（behavior）允许直接读写 state；卡条目禁止，只拿 ctx.api。
//   · 阴影/空洞统一走 P2 原语：`src/engine/tsk-concealed.js`、`tsk-hollow.js`；
//     网格邻接走 `src/engine/grid-map.js`（placeGridLocation / connectGrid / gridPosition）；
//     异界牌库走 `state.scenarioFlags.mechanics.scenarioDecks`（scenario-decks.js 的读点）。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import {
  assetRuleFor, encounterResolveFor, enemyRuleFor, resolveDeclarativeTreacheryTest, treacheryTestFor,
} from '../../../../../src/cards/card-rules.js'
import { registeredEntry } from '../../../../../src/engine/ability.js'
import { gridPosition, placeGridLocation } from '../../../../../src/engine/grid-map.js'
import { mechanicState } from '../../../../../src/engine/mechanic-state.js'
import { randomValue } from '../../../../../src/engine/rules-state.js'
import { drawFromScenarioDeck, scenarioDeckSize } from '../../../../../src/engine/scenario-decks.js'
import {
  concealedMiniCards, exposeMiniCard, isInShadows, placeMiniCard, reshuffleConcealed, setInShadows,
} from '../../../../../src/engine/tsk-concealed.js'
import { hollowCard, hollowCards, isHollowed, recallHollow } from '../../../../../src/engine/tsk-hollow.js'
import { mapTime } from '../../../../../src/engine/tsk-map.js'
import { WITHOUT_A_TRACE_TOKEN_MEANINGS, cardNameOf, withoutATraceAfterTest, withoutATraceChaosToken } from './chaos.js'
import {
  AGENDA_BACK_OPTIONS, BERMUDA_MAP_NODE, CHAPTER_ENTRY_CODES, CHAPTER_ID, CITY_OF_REMNANTS_LOCATION_IDS,
  CLIFFS_LOCATION_IDS, CONCEALED_PER_LOCATION, DECOY_MINI_KIND, EMBARK_NODES, EXPOSED_POSITION_EFFECTS,
  MAX_TABLET_HOLLOWS, MINI_KIND_BY_POSITION, OTHERWORLD_DECK_ID, OUTSIDERS_LAIR_ID, POSITION_BY_MINI_KIND,
  RAW_CODES, RESOLUTION_TABLE, SET_ASIDE_CODES, SHADOW_LABELS, SHADOW_POSITIONS, START_GRID, START_LOCATION,
  START_MINI_SPOTS, cityRemovalCount, codeOfLocationId, isOtherworldLocationId, locationIdOfCode, skullLocationCount,
} from './definition.js'

const codeOf = card => card?.originalCode || card?.code || (typeof card === 'string' ? card : null)
const aliveInvestigators = state => (state.investigators || []).filter(inv => !inv.defeated && !inv.resigned)
const investigatorCount = state => Number(state.numInvestigators) || (state.investigators || []).length || 1
const locationById = (state, id) => (state.locations || []).find(item => item.id === id) || null
const traitsOf = code => [...(ALL_CARDS[code]?.traits || [])]
const isWeakness = code => ALL_CARDS[code]?.subtype === 'weakness' || ALL_CARDS[code]?.type === 'weakness'
const entryOf = code => registeredEntry(String(code ?? '')) || null
const recordsOf = state => {
  state.campaign ||= {}
  state.campaign.records ||= {}
  return state.campaign.records
}
const zoneOf = state => (state.scenarioZones ||= {})
const num = value => (Number.isFinite(Number(value)) ? Number(value) : 0)

// —— 章节状态（只用 scenarioFlags.withoutATrace 一层，不新造顶层字段）——
const DEFAULT_FLAGS = Object.freeze({
  version: 1,
  introResolved: false,
  whistleBlown: false,
  // 阴影三位置 → 地点实体 id（null = 该位置空着，异界牌库也空了）
  shadows: Object.freeze({ left: null, middle: null, right: null }),
  // 迷你卡 id → 网格空位 { x, y }（迷你卡实体本身由 tsk-concealed 持有）
  spots: Object.freeze({}),
  removedCityIds: Object.freeze([]),
  hollowsDiscarded: Object.freeze([]),
  hollowsRemoved: Object.freeze([]),
  mimeticSpawned: false,
  reassemblerSpawned: false,
  redGlovedManInPlay: false,
  redGlovedManController: null,
  alikiController: null,
  pendingEntryCost: null,
  entryCharges: Object.freeze([]),
  lairRevealed: false,
  golems: Object.freeze([]),
  agenda3LookRound: 0,
  courtResignFailRound: 0,
  resolution: null,
})

export function withoutATraceFlags(state) {
  state.scenarioFlags ||= {}
  const current = state.scenarioFlags.withoutATrace
  if (!current) {
    state.scenarioFlags.withoutATrace = {
      ...DEFAULT_FLAGS,
      shadows: { left: null, middle: null, right: null }, spots: {}, removedCityIds: [],
      hollowsDiscarded: [], hollowsRemoved: [], entryCharges: [], golems: [],
    }
    return state.scenarioFlags.withoutATrace
  }
  for (const [key, value] of Object.entries(DEFAULT_FLAGS)) {
    if (!Object.hasOwn(current, key)) {
      current[key] = Array.isArray(value) ? [...value] : (value && typeof value === 'object' ? { ...value } : value)
    }
  }
  for (const position of SHADOW_POSITIONS) if (!Object.hasOwn(current.shadows, position)) current.shadows[position] = null
  return current
}

const flagsOf = state => withoutATraceFlags(state)

// —— 空洞（Hollow）——
// 「放一边的空洞」= 空洞区里未被本章台账移出/弃掉的卡（参考实现的 hollowed 集合）。
export function setAsideHollows(state) {
  const flags = flagsOf(state)
  const removed = new Set([...flags.hollowsDiscarded, ...flags.hollowsRemoved])
  return hollowCards(state).filter(card => !removed.has(card.code))
}
export const setAsideHollowCount = state => setAsideHollows(state).length
export function setAsideHollowsOf(state, seat) {
  return setAsideHollows(state).filter(card => card.scope === 'team' || card.seat === seat)
}
export const setAsideHollowCountOf = (state, seat) => setAsideHollowsOf(state, seat).length
// 红手套男子作为「放一边的空洞」时的归属（全队共用）。
export const redGlovedManIsHollow = state => isHollowed(state, RAW_CODES.redGlovedMan)
  && !flagsOf(state).hollowsDiscarded.includes(RAW_CODES.redGlovedMan)
  && !flagsOf(state).hollowsRemoved.includes(RAW_CODES.redGlovedMan)

function discardHollow(state, code, reason) {
  const flags = flagsOf(state)
  if (!flags.hollowsDiscarded.includes(code)) flags.hollowsDiscarded.push(code)
  return { code, reason }
}

// 把一张手牌/场上的非弱点卡放在一边作为空洞（走 api.moveCard + tsk.hollow）。
function hollowCardFromSeat(state, api, seat, code, source) {
  const inv = state.investigators?.[seat]
  if (!inv || !code || isWeakness(code) || isHollowed(state, code)) return null
  hollowCard(state, { code, source, scope: 'investigator', seat })
  if (typeof api?.moveCard === 'function') {
    api.moveCard({ code, from: 'hand', to: 'setAside', ownerSeat: seat })
  } else {
    const index = (inv.hand || []).lastIndexOf(code)
    if (index >= 0) inv.hand.splice(index, 1)
    state.setAside ||= []
    state.setAside.push({ code, ownerSeat: seat })
  }
  return code
}

function chooseHandCard(state, api, seat, prompt, source) {
  const hand = [...new Set((state.investigators?.[seat]?.hand || []).filter(code => !isWeakness(code)))]
  if (!hand.length) return null
  if (hand.length === 1 || typeof api?.choice !== 'function') return hand[0]
  const answer = api.choice({
    kind: 'card', source, seat,
    prompt,
    options: hand.map(code => ({ id: code, label: cardNameOf(code), cardCode: code })),
  })
  const picked = hand.find(code => String(code) === String(answer)) ?? null
  return picked
}

// 场上的非弱点支援（议程背面「手中或游戏区域」的第二条路径）。
function chooseControlledAsset(state, api, seat, prompt, source) {
  const assets = (state.investigators?.[seat]?.assets || []).filter(asset => !isWeakness(codeOf(asset)))
  if (!assets.length) return null
  if (assets.length === 1 || typeof api?.choice !== 'function') return assets[0]
  const answer = api.choice({
    kind: 'asset', source, seat,
    prompt,
    options: assets.map(asset => ({ id: asset.id, label: cardNameOf(codeOf(asset)) })),
  })
  return assets.find(asset => String(asset.id) === String(answer)) ?? null
}

/** 每位调查员把一张手中（没有手牌则场上）的非弱点卡放在一边作为空洞。 */
export function hollowOneCardPerInvestigator(state, api, source) {
  const made = []
  for (const inv of aliveInvestigators(state)) {
    const code = chooseHandCard(state, api, inv.seat, '选择一张非弱点手牌，放在一边作为空洞。', source)
    if (code) {
      if (hollowCardFromSeat(state, api, inv.seat, code, source)) made.push({ seat: inv.seat, code })
      continue
    }
    const asset = chooseControlledAsset(state, api, inv.seat, '没有手牌：选择一张你控制的非弱点支援放在一边作为空洞。', source)
    if (!asset) continue
    const assetCode = codeOf(asset)
    if (typeof api?.removeAsset === 'function') api.removeAsset(inv.seat, asset.id)
    else inv.assets = inv.assets.filter(item => item.id !== asset.id)
    hollowCard(state, { code: assetCode, source, scope: 'investigator', seat: inv.seat })
    if (typeof api?.moveCard === 'function') api.moveCard({ code: assetCode, from: 'discard', to: 'setAside', ownerSeat: inv.seat })
    made.push({ seat: inv.seat, code: assetCode })
  }
  if (made.length) api?.info?.(`🕳️ ${made.length} 张非弱点卡放在一边，作为空洞。`)
  return made
}

/** 把空洞卡真正交还其所有者（艾里奇 / 戴维·伊拉万等回收效果）。 */
export function recallHollowToOwner(state, api, code, to = 'hand') {
  const record = typeof api?.mechanics?.tsk?.hollow?.recall === 'function'
    ? api.mechanics.tsk.hollow.recall(code, { to })
    : recallHollow(state, code, { to })
  if (!record) return null
  const owner = record.seat != null ? state.investigators?.[record.seat] : null
  if (owner) {
    if (to === 'hand') owner.hand.push(code)
    else if (to === 'discard') owner.discard.push(code)
    else owner.deck.push(code)
  }
  api?.info?.(`🕳️ 空洞「${cardNameOf(code)}」回到${to === 'hand' ? '手牌' : to === 'discard' ? '弃牌堆' : '牌库'}。`)
  return record
}

// —— 网格与迷你卡空位 ——
const cellOf = (state, locationId) => gridPosition(state, locationId)
const sameCell = (a, b) => Boolean(a && b && a.x === b.x && a.y === b.y)
const ORTHOGONAL = Object.freeze([{ x: -1, y: 0 }, { x: 1, y: 0 }, { x: 0, y: -1 }, { x: 0, y: 1 }])
const isAdjacentCell = (a, b) => Boolean(a && b && Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1)
export const miniSpots = state => flagsOf(state).spots

function setMiniSpot(state, miniCardId, spot) {
  const flags = flagsOf(state)
  flags.spots[miniCardId] = { x: spot.x, y: spot.y }
  return flags.spots[miniCardId]
}

/** 迷你卡所在的空位：优先章节记录，其次它所依附地点的格子。 */
export function miniSpotOf(state, miniCard) {
  const recorded = flagsOf(state).spots[miniCard?.id]
  if (recorded) return { x: recorded.x, y: recorded.y }
  const anchor = miniCard?.locationId ? cellOf(state, miniCard.locationId) : null
  return anchor ? { x: anchor.x, y: anchor.y } : null
}

function occupiedCells(state) {
  const cells = new Set()
  for (const location of state.locations || []) {
    const cell = cellOf(state, location.id)
    if (cell) cells.add(`${cell.x},${cell.y}`)
  }
  return cells
}
function occupiedSpots(state) {
  const taken = new Set()
  for (const spot of Object.values(flagsOf(state).spots)) taken.add(`${spot.x},${spot.y}`)
  return taken
}

/** 某个格子周围「没有地点、也没有迷你卡」的空位（顺序固定：左、右、上、下）。 */
export function emptySpotsAround(state, cell) {
  if (!cell) return []
  const cells = occupiedCells(state)
  const taken = occupiedSpots(state)
  return ORTHOGONAL.map(offset => ({ x: cell.x + offset.x, y: cell.y + offset.y }))
    .filter(spot => !cells.has(`${spot.x},${spot.y}`) && !taken.has(`${spot.x},${spot.y}`))
}

function placeMiniAt(state, { kind, code = null, decoy, locationId, spot }) {
  const mini = placeMiniCard(state, { kind, code, decoy: decoy === true, locationId })
  if (mini && spot) setMiniSpot(state, mini.id, spot)
  return mini
}

function shuffleWith(helper, cards, state) {
  const list = [...cards]
  // 引擎 setupLocations 传入的是 deckbuilding.shuffle(arr, rng)：必须显式传 helper.randomValue，
  // 不能当作单参洗牌回调（否则 rng is not a function）。
  // 章节内补位调用（refillShadowPosition）拿不到 setup helper，回落到引擎 randomValue(state)，
  // 保证任何调用点都真的有洗牌，不会静默保留原序（真身恒在第一个空位）。
  const engineRandom = () => randomValue(state)
  const random = typeof helper?.randomValue === 'function'
    ? () => helper.randomValue(state)
    : typeof helper?.random === 'function' ? () => helper.random() : engineRandom
  if (typeof helper?.shuffle === 'function') return helper.shuffle([...list], random)
  if (typeof helper?.random === 'function') {
    const out = [...list]
    for (let index = out.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(helper.random() * (index + 1))
      ;[out[index], out[swap]] = [out[swap], out[index]]
    }
    return out
  }
  if (!state) return list
  const out = [...list]
  for (let index = out.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(engineRandom() * (index + 1))
    ;[out[index], out[swap]] = [out[swap], out[index]]
  }
  return out
}

function ensureLocation(state, api, id) {
  if ((state.locations || []).some(location => location.id === id)) return true
  if (typeof api?.mechanics?.placeLocation === 'function' && api.mechanics.placeLocation(id)) return true
  if (typeof api?.place === 'function' && api.place(id)) return true
  return (state.locations || []).some(location => location.id === id)
}

function placeOnGrid(state, api, id, x, y) {
  return placeGridLocation(state, id, x, y, {
    placeLocation: locationId => (ensureLocation(state, api, locationId) ? locationId : null),
  })
}

// —— 异界牌库（Otherworld deck）——
const otherworldPile = state => mechanicState(state)?.scenarioDecks?.[OTHERWORLD_DECK_ID] || null

/** 异界牌库张数（含弃牌/移出：牌库本身是隐藏信息，只暴露张数）。 */
export function otherworldDeckSize(state) {
  const pile = otherworldPile(state)
  if (!pile) return 0
  return pile.deck.length + (pile.discard?.length || 0) + (pile.removed?.length || 0)
}

function initializeOtherworldDeck(state, cards) {
  const data = mechanicState(state, true)
  data.scenarioDecks ||= {}
  const existing = data.scenarioDecks[OTHERWORLD_DECK_ID]
  if (existing) {
    existing.deck = [...cards]
    existing.discard = []
    existing.removed = []
    return cards.length
  }
  data.scenarioDecks[OTHERWORLD_DECK_ID] = { deck: [...cards], discard: [], removed: [] }
  return cards.length
}

/**
 * 准备异界牌库（参考 Setup 的 otherworldDeck 步骤）：
 *   底：域外来客之巢 + 两张疯狂峭壁（混洗）；
 *   顶：七张残骸之城（混洗；1/2 人时随机移出 2/1 张）——顶 3 张进阴影，其余留在牌库顶。
 * 返回 { inShadows, removed, deckSize }。
 */
export function prepareOtherworldDeck(state, helper = {}) {
  const players = investigatorCount(state)
  const bottom = shuffleWith(helper, [...CLIFFS_LOCATION_IDS, OUTSIDERS_LAIR_ID], state)
  const city = shuffleWith(helper, [...CITY_OF_REMNANTS_LOCATION_IDS], state)
  const removed = city.splice(0, cityRemovalCount(players))
  const inShadowIds = city.splice(0, 3)
  // 约定：deck 数组尾部 = 牌库顶（scenario-decks.js 的既有口径）。
  const deck = [...bottom, ...city]
  initializeOtherworldDeck(state, deck)
  const flags = flagsOf(state)
  flags.removedCityIds = [...removed]
  return {
    inShadows: { left: inShadowIds[0] ?? null, middle: inShadowIds[1] ?? null, right: inShadowIds[2] ?? null },
    removed: [...removed],
    deckSize: deck.length,
    topCount: city.length,
  }
}

function drawOtherworldTop(state) {
  const pile = otherworldPile(state)
  if (!pile || !pile.deck.length) return null
  const drawn = drawFromScenarioDeck(state, OTHERWORLD_DECK_ID, 1)
  if (drawn === false) return null
  return drawn[0] ?? null
}

/** 把一个地点放进阴影位置（左/中/右）：入游戏但未揭示、无网格格子、不可到达。 */
export function putLocationInShadows(state, api, position, locationId) {
  const flags = flagsOf(state)
  if (!SHADOW_POSITIONS.includes(position)) throw new TypeError('阴影位置必须是 left/middle/right')
  if (!ensureLocation(state, api, locationId)) return null
  setInShadows(state, locationId, true)
  flags.shadows[position] = locationId
  const location = locationById(state, locationId)
  if (location) {
    location.inShadows = true
    location.revealed = false
    delete location.grid
  }
  if (mechanicState(state)?.grid?.[locationId]) delete mechanicState(state).grid[locationId]
  return locationId
}

export const shadowLocations = state => ({ ...flagsOf(state).shadows })

// —— 阴影地点揭露（左/中/右迷你卡 → 放入场）——
function locationEntryExposed(state, inv, locationId, position, api) {
  const source = locationById(state, locationId)
  // 地点实体可能被换面（例如换成本章自有的域外来客之巢）：实例卡号优先，其次按定义表反查。
  const code = codeOf(source) || codeOfLocationId(locationId)
  const context = { when: 'tskExposed', kind: code, decoy: false, position, seat: inv?.seat ?? null, locationId }
  // 本章自有地点 09689 没有单卡条目：背面的「左/中/右」强制在 definition 里声明。
  const table = EXPOSED_POSITION_EFFECTS[code]
  if (table) {
    const effect = table[position]
    if (!effect) return { applied: false, code }
    if (effect.kind === 'damage') {
      dealTo(state, api, inv, { damage: effect.amount })
      api?.info?.(`💥 「${cardNameOf(code)}」在阴影${SHADOW_LABELS[position]}被揭露：${inv?.name || '调查员'}受到 ${effect.amount} 点伤害。`)
    } else if (effect.kind === 'horror') {
      dealTo(state, api, inv, { horror: effect.amount })
      api?.info?.(`😱 「${cardNameOf(code)}」在阴影${SHADOW_LABELS[position]}被揭露：${inv?.name || '调查员'}受到 ${effect.amount} 点恐惧。`)
    } else if (effect.kind === 'hollowFromHand') {
      const picked = chooseHandCard(state, api, inv?.seat, '选择一张非弱点手牌，放在一边作为空洞。', code)
      if (picked) hollowCardFromSeat(state, api, inv.seat, picked, code)
      api?.info?.(`🕳️ 「${cardNameOf(code)}」在阴影${SHADOW_LABELS[position]}被揭露：一张手牌成为空洞。`)
    }
    return { applied: true, code }
  }
  // 共享组的异界地点在单卡条目里声明「强制 - 揭露此地点」；章节 behavior 是它的读点。
  // 单卡条目的 P2 契约是 `api.tsk.*`（能力面把 mechanicsApi 摊平到顶层），而场景运行时只提供
  // `api.mechanics.tsk`：这里补一个别名，两条入口看到同一份状态视图。
  const entryApi = api && !api.tsk && api.mechanics?.tsk ? { ...api, tsk: api.mechanics.tsk } : api
  // 引擎派发可用时（真实对局）由 tskExposed 窗口统一结算单卡条目；本章手工结算只作为
  // 无机制面夹具（合成 state 单测）的回退，避免同一效果结算两次。
  const engineDispatches = typeof api?.mechanics?.tsk?.concealed?.expose === 'function'
  if (engineDispatches) return { applied: false, code, engineWindow: true }
  const entry = source ? entryOf(code) : null
  const abilities = Array.isArray(entry?.abilities) ? entry.abilities : []
  const applied = []
  for (const ability of abilities) {
    if (ability?.kind !== 'forced' || ability?.trigger !== 'tskExposed') continue
    if (!matchesExposedCriteria(ability.criteria, { source, context })) continue
    try {
      ability.resolve?.({ state, api: entryApi, source, context, inv, target: null, targetId: null })
      applied.push(ability.label || code)
    } catch (error) {
      api?.info?.(`⚠️ 「${cardNameOf(code)}」的揭露效果未能结算：${error.message}`)
    }
  }
  return { applied: applied.length > 0, code, abilities: applied }
}

function matchesExposedCriteria(criteria, ctx) {
  if (!criteria) return true
  if (typeof criteria === 'function') {
    try { return criteria(ctx) === true } catch { return false }
  }
  if (Array.isArray(criteria)) {
    return criteria.every(predicate => {
      try { return typeof predicate === 'function' ? predicate(ctx) !== false : true } catch { return false }
    })
  }
  return true
}

/** 把某空位上其余的迷你卡挪到新地点周围的空位（「尽可能平均」）。 */
function redistributeMinisAtSpot(state, api, spot, anchorLocationId) {
  const flags = flagsOf(state)
  const moved = []
  const others = concealedMiniCards(state).filter(card => sameCell(miniSpotOf(state, card), spot))
  for (const card of others) {
    const [nextSpot] = emptySpotsAround(state, cellOf(state, anchorLocationId))
    if (!nextSpot) continue
    const exposed = exposeMini(state, api, card.id)
    if (!exposed) continue
    delete flags.spots[card.id]
    placeMiniAt(state, {
      kind: exposed.kind, decoy: exposed.decoy, locationId: anchorLocationId, spot: nextSpot,
    })
    moved.push(card.id)
  }
  return moved
}

const exposeMini = (state, api, id, seat = null) => (typeof api?.mechanics?.tsk?.concealed?.expose === 'function'
  ? api.mechanics.tsk.concealed.expose(id, { seat })
  : exposeMiniCard(state, id))

/**
 * 揭露一张迷你卡（本章核心动作）。
 *  · 诱饵：弃掉，什么都不发生。
 *  · 残骸之城 L/M/R：把对应阴影位置的地点放入场（未揭示面朝上，落在迷你卡原来的空位），
 *    结算「揭露此地点」的强制，移除该位置的迷你卡，然后从异界牌库顶补上同一位置并结算「隐匿 1」。
 */
export function exposeMiniInShadows(state, inv, miniCardId, api) {
  const card = concealedMiniCards(state).find(item => item.id === miniCardId)
  if (!card) return null
  if (!canExpose(state, inv, card)) return null
  const spot = miniSpotOf(state, card) || cellOf(state, inv.location)
  const result = exposeMini(state, api, miniCardId, inv?.seat ?? null)
  if (!result) return null
  const flags = flagsOf(state)
  delete flags.spots[miniCardId]
  flags.exposedLog = [...(flags.exposedLog || []).slice(-19), { id: miniCardId, kind: result.kind, decoy: result.decoy, seat: inv?.seat ?? null, round: state.round }]
  if (result.decoy) {
    api?.info?.(`🃏 ${inv?.name || '调查员'} 揭露了一张诱饵：弃掉它。`)
    alikiReaction(state, api)
    return { decoy: true, miniCardId }
  }
  const position = POSITION_BY_MINI_KIND[result.kind] || null
  if (!position) {
    api?.info?.(`🃏 揭露了「${result.kind}」（本章没有对应地点）。`)
    return { decoy: false, kind: result.kind, miniCardId }
  }
  const locationId = flags.shadows[position]
  flags.shadows[position] = null
  if (!locationId) {
    api?.info?.(`🃏 阴影${SHADOW_LABELS[position]}位置没有可放入的地点：这张迷你卡移出游戏。`)
    return { decoy: false, kind: result.kind, position, locationId: null, miniCardId }
  }
  // 离开阴影 → 放入场（未揭示面朝上）、拿回它的放一边记录。
  if (isInShadows(state, locationId)) setInShadows(state, locationId, false)
  const location = locationById(state, locationId)
  if (location) {
    delete location.inShadows
    location.revealed = false
  }
  if (spot) placeOnGrid(state, api, locationId, spot.x, spot.y)
  redistributeMinisAtSpot(state, api, spot, locationId)
  locationEntryExposed(state, inv, locationId, position, api)
  // 该地点离开阴影后：异界牌库顶补上同一位置，并结算它的「隐匿 1」。
  const refilled = refillShadowPosition(state, api, position, locationId)
  api?.info?.(`🌫️ 揭露阴影${SHADOW_LABELS[position]}的「${cardNameOf(codeOfLocationId(locationId))}」：`
    + `地点放入场（未揭示面朝上）${refilled ? `；异界牌库顶补上「${cardNameOf(codeOfLocationId(refilled))}」` : '；异界牌库已空'}。`)
  alikiReaction(state, api)
  return { decoy: false, kind: result.kind, position, locationId, refilled, miniCardId }
}

/** 补位：把异界牌库顶的地点放进刚空出的阴影位置，并给它 1 张迷你卡 + 1 张诱饵。 */
function refillShadowPosition(state, api, position, anchorLocationId) {
  const nextId = drawOtherworldTop(state)
  if (!nextId) return null
  putLocationInShadows(state, api, position, nextId)
  arrangeConcealedAround(state, api, anchorLocationId, position)
  return nextId
}

/** 在 anchorLocationId 周围的空位摆 1 张「该阴影位置」的迷你卡 + 1 张诱饵。 */
function arrangeConcealedAround(state, api, anchorLocationId, position, helper = {}) {
  const spots = emptySpotsAround(state, cellOf(state, anchorLocationId))
  // 该阴影位置当前放的地点卡号就是迷你卡身份（跨章地点条目按 context.code 判来源）。
  const shadowLocationId = flagsOf(state).shadows?.[position] || null
  const shadowCode = shadowLocationId ? codeOfLocationId(shadowLocationId) : null
  const cards = shuffleWith(helper, [
    { kind: MINI_KIND_BY_POSITION[position], code: shadowCode, decoy: false },
    ...Array.from({ length: CONCEALED_PER_LOCATION }, () => ({ kind: DECOY_MINI_KIND, decoy: true })),
  ], state)
  const placed = []
  cards.forEach((card, index) => {
    const spot = spots[index]
    if (!spot) return
    placed.push(placeMiniAt(state, { ...card, locationId: anchorLocationId, spot }))
  })
  return placed
}

/** 某调查员当前可揭露的迷你卡：迷你卡空位与调查员所在地点的格子正交相邻。 */
export function exposableMiniCards(state, inv) {
  const cell = cellOf(state, inv?.location)
  if (!cell) return []
  return concealedMiniCards(state).filter(card => {
    const spot = miniSpotOf(state, card)
    return Boolean(spot) && isAdjacentCell(spot, cell)
  })
}

export function canExpose(state, inv, card) {
  if (!inv || !card) return false
  const spot = miniSpotOf(state, card)
  const cell = cellOf(state, inv.location)
  if (!spot || !cell) return false
  return isAdjacentCell(spot, cell)
}

/** 揭露时用「你所在地点」的隐藏值。 */
export function exposeShroud(state, inv) {
  const location = locationById(state, inv?.location)
  const mod = num(location?.shroudMod)
  return Math.max(0, num(location?.shroud) + mod)
}

// —— 战斗/伤害辅助（内容层写 state；有 api 时优先 api）——
function dealTo(state, api, inv, { damage = 0, horror = 0 } = {}) {
  if (!inv) return
  if (typeof api?.harm === 'function') {
    api.harm(inv.seat, { damage, horror })
    return
  }
  if (damage && typeof api?.damage === 'function') api.damage(inv.seat, damage)
  else if (damage) inv.damage = (inv.damage || 0) + damage
  if (horror && typeof api?.horror === 'function') api.horror(inv.seat, horror)
  else if (horror) inv.horror = (inv.horror || 0) + horror
}

function damageEnemy(state, api, enemy, amount) {
  if (!enemy) return 0
  const health = enemy.health == null ? null : num(enemy.health)
  enemy.damageTaken = num(enemy.damageTaken) + num(amount)
  if (health != null && enemy.damageTaken >= health && typeof api?.defeatEnemy === 'function') {
    api.defeatEnemy(enemy, { source: RAW_CODES.act2 })
  }
  return amount
}

function enemiesInPlay(state) {
  return (state.enemies || []).filter(enemy => enemy && !enemy.defeated && !enemy.removedFromGame)
}
function outsidersInPlay(state) {
  return enemiesInPlay(state).filter(enemy => traitsOf(codeOf(enemy)).includes('Outsider'))
}
function mimeticNemesis(state) {
  return enemiesInPlay(state).find(enemy => codeOf(enemy) === RAW_CODES.mimeticNemesis) || null
}

/** 两点之间的最短连接步数（BFS；阴影地点没有连接，自然不会成为目的地）。 */
export function distanceBetween(state, fromId, toId) {
  if (!fromId || !toId) return Infinity
  if (fromId === toId) return 0
  const queue = [[fromId, 0]]
  const seen = new Set([fromId])
  while (queue.length) {
    const [current, depth] = queue.shift()
    const location = locationById(state, current)
    for (const next of location?.connections || []) {
      if (next === toId) return depth + 1
      if (seen.has(next)) continue
      seen.add(next)
      queue.push([next, depth + 1])
    }
  }
  return Infinity
}

function nearestOutsider(state, inv) {
  const candidates = outsidersInPlay(state)
  if (!candidates.length) return null
  let best = null
  for (const enemy of candidates) {
    const distance = distanceBetween(state, inv.location, enemy.location)
    if (!best || distance < best.distance) best = { enemy, distance }
  }
  return best?.enemy || null
}

// —— 阶梯/时间 ——
function readTime(state, api) {
  const fromApi = Number(api?.mechanics?.tsk?.map?.time?.() ?? api?.tsk?.map?.time?.())
  if (Number.isFinite(fromApi) && fromApi > 0) return fromApi
  const recorded = num(recordsOf(state).time)
  return Math.max(mapTime(state), recorded)
}
function markTime(state, api, amount) {
  const records = recordsOf(state)
  const total = readTime(state, api) + num(amount)
  records.time = total
  const campaign = (state.campaign ||= {})
  if (campaign.tsk?.map) campaign.tsk.map.time = Math.min(35, total)
  api?.info?.(`⏱️ 记 ${amount} 时间（累计 ${total}）。`)
  return total
}

// —— 胜利区（结局判定）——
const victoryCodes = state => (state.victoryDisplay || [])
  .map(entry => (typeof entry === 'string' ? entry : codeOf(entry)))
  .filter(Boolean)
export const inVictoryDisplay = (state, code) => victoryCodes(state).includes(String(code))

/** 参考 Act 3 背面的结局分派：红手套男子 / 艾里奇 是否在胜利区。 */
export function resolutionFromVictory(state) {
  const redGlovedMan = inVictoryDisplay(state, RAW_CODES.redGlovedMan)
  const aliki = inVictoryDisplay(state, RAW_CODES.aliki)
  if (redGlovedMan && aliki) return 'resolution1'
  if (redGlovedMan) return 'resolution2'
  if (aliki) return 'resolution3'
  return 'resolution4'
}

// —— 故事支援（[[同谋]]）——
function createConspiratorAsset(state, seat, code) {
  const inv = state.investigators?.[seat]
  if (!inv) return null
  inv.assets ||= []
  const existing = inv.assets.find(asset => codeOf(asset) === code)
  if (existing) return existing
  const card = ALL_CARDS[code] || {}
  const entry = entryOf(code) || {}
  const asset = {
    id: `storyasset-${code}-${seat}`,
    code, originalCode: code,
    name: card.nameZh || card.name,
    controllerSeat: seat,
    exhausted: false, damage: 0, horror: 0,
    health: card.health ?? null, sanity: card.sanity ?? null,
    traits: traitsOf(code),
    slots: [...(entry.slots || card.slots || [])],
    storyAsset: true,
  }
  inv.assets.push(asset)
  return asset
}

function addConspiratorsToVictory(state, inv, api) {
  const added = []
  for (const asset of [...(inv.assets || [])]) {
    const code = codeOf(asset)
    if (!traitsOf(code).includes('Conspirator')) continue
    if (typeof api?.removeAsset === 'function') api.removeAsset(inv.seat, asset.id)
    else inv.assets = inv.assets.filter(item => item.id !== asset.id)
    if (typeof api?.addStoryToVictory === 'function') api.addStoryToVictory(code)
    else {
      state.victoryDisplay ||= []
      state.victoryDisplay.push({ id: `victory-${code}-${inv.seat}`, code, originalCode: code, victory: 0 })
    }
    added.push(code)
  }
  if (added.length) api?.info?.(`🏆 ${inv.name} 控制的 [[同谋]] 支援加入胜利区：${added.map(cardNameOf).join('、')}。`)
  return added
}

// ---------------------------------------------------------------------------
// 场景布置
// ---------------------------------------------------------------------------
const setAsideZone = state => {
  const zones = zoneOf(state)
  zones.setAside ||= []
  zones.removed ||= []
  zones.victory ||= []
  return zones
}

function placeStartMiniCards(state, helper = {}) {
  const cards = shuffleWith(helper, [
    { kind: DECOY_MINI_KIND, decoy: true },
    ...SHADOW_POSITIONS.map(position => ({
      kind: MINI_KIND_BY_POSITION[position],
      code: flagsOf(state).shadows?.[position] ? codeOfLocationId(flagsOf(state).shadows[position]) : null,
      decoy: false,
    })),
  ], state)
  const spots = [...START_MINI_SPOTS]
  const created = []
  cards.forEach((card, index) => {
    const spot = spots[index]
    if (!spot) return
    created.push(placeMiniAt(state, { ...card, locationId: START_LOCATION, spot }))
  })
  return created
}

export const scenarioApproximations = Object.freeze([
  '异界牌库存在引擎的 `scenarioDecks`（`mechanicState.scenarioDecks.otherworld`）里，元素是**地点实体 id**'
  + '（不是卡号）：两张疯狂峭壁印刷同号，只有一个卡号无法区分两份实体，因此牌库按实体 id 记账；'
  + '`otherworldDeckSize` 只对外暴露张数。',
  '阴影三位置记录在 `scenarioFlags.withoutATrace.shadows`（left/middle/right → 地点实体 id）；'
  + '阴影中的地点确实进 `state.locations`（未揭示、无网格格子、无连接），因此引擎的移动/线索/胜利点读点'
  + '与「场上地点数量」都按同一份数据求值（[skull] 用 `inShadows` 排除它们）。',
  '迷你卡用 `locationId` 依附在它所相邻的地点、真实空位记在 `scenarioFlags.withoutATrace.spots`：'
  + 'P2 的迷你卡记录只有 left/middle/right（阴影位置）一个位置字段，放不下「上/下/左/右」四个空位，'
  + '因此空位坐标由章节侧记账；`concealTargetScope` 的攻防范围仍按原语口径。',
  '「揭露（Expose）」在引擎里没有内置行动入口（P4 只提供选择事务）：本章用 `behavior.actions` 提供'
  + '「揭露相邻的隐匿迷你卡」剧本行动（1 行动），并把「用你所在地点的隐藏值」写进动作说明。',
  '地点背面的「强制 - 在你揭露此地点时」：本章自有地点 09689 没有单卡条目，效果表在 `definition.js`；'
  + '共享组地点（09747a–09750）在各自单卡条目里声明，本章 behavior 在揭露时按 `trigger: tskExposed` 派发'
  + '（引擎目前没有 tskExposed 的派发点，见 primitive-requests/09689.json）。',
  '[cultist] 的「最近的[[域外]]敌人重整、向你移动一次」用 `api.readyEnemy` + `api.moveEnemyToward` 结算；'
  + '距离按印刷连接做 BFS（阴影里的地图外地点因此不可达）。',
  '[tablet] 的 X 与拟态克星的强制都读「放一边的空洞」；被拟态克星弃掉/议程移出的空洞以章节台账'
  + ' `hollowsDiscarded` / `hollowsRemoved` 记账（P2 没有「移出空洞区但不是存在抹除」的写入口）。',
  '拟态克星的「造成伤害时改为弃掉等量空洞」在 `enemyDamageAmount` 读点返回 0 并按顺序弃掉台账；'
  + '官方是玩家逐张选择，这里按空洞区顺序取前 N 张（`api.choice` 只用于二选一的大分支）。',
  '原生质重组者的「生成魔像」：引擎没有无卡号的敌人实体，这里把最近的调查员牌库顶卡直接放在一边作为空洞'
  + '（魔像被击败后的去向），并把该次生成记进 `goblins` 台账；见 primitive-requests/09691.json。',
  '幕 3 正面「每个[[域外]]敌人失去冷漠」：引擎的 `loses:aloof` 实体规则只从卡条目读，而本章幕牌没有单卡条目；'
  + 'behavior 在敌军阶段开始时对「与调查员同地点的域外敌人」调用 `api.engageAtInvestigator` 近似（见 gap）。',
  '幕 2 正面「戴红手套的男子不能被弃掉或抽取」：剧情资产不在玩家牌库里，引擎没有对应读点；'
  + '本章只在放入场时保证不重复创建实例，并以 `note` 披露（见 primitive-requests/09692.json）。',
  '「记 N 时间」没有时间累加原语：章节写 `campaign.records.time` 并在世界地图已初始化时同步 `campaign.tsk.map.time`'
  + '（夹在 35 以内，与疯星乱舞同一口径）。',
  '结局的「你可以启程（百慕大/宜博市/圣胡安）」：世界地图没有「只改当前节点」的原语，章节把选择记进'
  + ' `scenarioFlags.withoutATrace.embarkFrom` 并同步 `campaign.tsk.map.current`（地图已初始化时）。',
  '域外来客之廷的撤退检定卡面是「意志或敏捷(4)」，引擎的 `api.test` 只接单一技能：本章固定检定意志，'
  + '失败后「直到回合结束此检定 -1 难度」用章节轮次记账（`courtResignFailRound`）。',
  '全体提前撤退（幕 1/2 时每位幸存者都撤退）按卡面「立即推进到幕 3b」直接进入结局分派，'
  + '不逐个结算幕 1/2 的背面；幕 3 目标达成时仍走正常 `advanceAct`。',
  '`tskExposed` 派发共享组地点条目时补 `api.tsk` 别名（能力面把 mechanicsApi 摊平到顶层、场景运行时只有 '
  + '`api.mechanics.tsk`）：两条入口看到同一份状态视图，不复制规则。',
])

export const scenarioGaps = Object.freeze([
  '缺少「揭露（Expose）」的引擎动作原语：目前由章节 actions 提供 1 行动剧本行动。',
  '缺少 `tskExposed` 窗口的引擎派发点（P2 只注册了窗口 id），共享组地点的揭露强制依赖章节派发。',
  '缺少「移出空洞区但不是存在抹除」的写入口（议程/拟态克星弃掉空洞）。',
  '缺少无卡号敌人实体（原生质重组者的魔像）。',
  '缺少战役时间累加原语（结局的记 N 时间）。',
  '缺少「只设置世界地图当前节点」的原语（结局启程选择）。',
  '幕 3 正面「每个[[域外]]敌人失去冷漠」没有 behavior 读点（`loses:aloof` 实体规则只从卡条目读，'
  + '而幕牌没有单卡条目）：目前用敌军阶段的自动交战近似。',
])

export const implementedEncounterCodes = Object.freeze([...CHAPTER_ENTRY_CODES])

export const behavior = {
  id: CHAPTER_ID,
  implementedEncounterCodes,
  scenarioApproximations,
  scenarioGaps,
  tokenMeanings: WITHOUT_A_TRACE_TOKEN_MEANINGS,
  resolutionIds: ['noResolution', 'resolution1', 'resolution2', 'resolution3', 'resolution4'],

  startLocation() {
    return START_LOCATION
  },

  // ---- 序章：吹哨 / 丢哨（参考 PreScenarioSetup 的 intro 分支）----
  preScenarioSetup(state, events, api) {
    const flags = flagsOf(state)
    if (flags.introResolved) return flags.whistleBlown
    flags.introResolved = true
    const lead = aliveInvestigators(state)[0]?.seat ?? 0
    const answer = typeof api?.choice === 'function'
      ? api.choice({
        kind: 'story', source: RAW_CODES.scenario, seat: lead,
        prompt: '调查员队长必须决定（选择一项）：',
        options: [
          { id: 'blow', label: '吹响哨子，召唤艾里奇（记录「特别小组吹响哨子」）' },
          { id: 'discard', label: '扔掉哨子，独自前行（记录「特别小组扔掉哨子」并让一位调查员获得阿丽·奎因特工）' },
        ],
      })
      : 'blow'
    const records = recordsOf(state)
    if (String(answer) === 'discard') {
      flags.whistleBlown = false
      records.theCellThrewAwayTheWhistle = true
      records.agentQuinnHasYourBack = true
      api?.info?.('📜 剧本日志：奎因特工护你左右；特别小组扔掉哨子。')
      // 「任意一位调查员可以把阿丽·奎因特工加入其牌库（不计入牌库张数）」：放进队长的牌库。
      const leadInv = state.investigators?.[lead]
      if (leadInv && !(leadInv.deck || []).includes('09763')) {
        leadInv.deck ||= []
        leadInv.deck.push('09763')
        api?.info?.(`🃏 ${leadInv.name} 的牌库加入「阿丽·奎因特工」（09763，不计入牌库张数）。`)
      }
    } else {
      flags.whistleBlown = true
      records.theCellBlewTheWhistle = true
      api?.info?.('📜 剧本日志：特别小组吹响哨子。')
    }
    return flags.whistleBlown
  },

  // ---- 布置：域外来客之廷 + 异界牌库 + 阴影三位置 + 起点周围四张迷你卡 ----
  setupLocations(state, events, helper = {}) {
    const api = helper.api || null
    const flags = flagsOf(state)
    if (!flags.introResolved) behavior.preScenarioSetup(state, events, api)
    const zones = setAsideZone(state)
    for (const code of SET_ASIDE_CODES) if (!zones.setAside.includes(code)) zones.setAside.push(code)
    // 起点：域外来客之廷在网格 (0,0)。
    ensureLocation(state, api, START_LOCATION)
    placeOnGrid(state, api, START_LOCATION, START_GRID.x, START_GRID.y)
    // 异界牌库 + 阴影三位置。
    const prepared = prepareOtherworldDeck(state, helper)
    for (const position of SHADOW_POSITIONS) {
      const id = prepared.inShadows[position]
      if (id) putLocationInShadows(state, api, position, id)
    }
    // 环绕起点：1 张诱饵 + 3 张残骸之城（L/M/R）迷你卡。
    placeStartMiniCards(state, helper)
    flags.lairRevealed = false
    helper.info?.(state, events,
      `🌫️ 布置：域外来客之廷入场；异界牌库 ${otherworldDeckSize(state)} 张（底：域外来客之巢+2 疯狂峭壁；`
      + `顶：残骸之城）。阴影左/中/右各 1 张残骸之城；起点四周 4 张隐匿迷你卡。`)
    return [START_LOCATION]
  },

  setupEnemies() {},

  // ---- 布置后：阿丽 / 放一边 ----
  afterDeckSetup(state, events, helper = {}) {
    const api = helper.api
    const flags = flagsOf(state)
    const zones = setAsideZone(state)
    flags.placed = flags.placed || [START_LOCATION]
    if (!flags.whistleBlown) {
      api?.info?.('🌊 特别小组扔掉了哨子：艾里奇·佐尼·奥佩勒曲亚从游戏中移除。')
    } else {
      const alive = aliveInvestigators(state)
      const lead = alive[0]?.seat ?? 0
      let seat = lead
      if (alive.length > 1 && typeof api?.choice === 'function') {
        const answer = api.choice({
          kind: 'story', source: RAW_CODES.aliki, seat: lead,
          prompt: '选择一位调查员控制「艾里奇·佐尼·奥佩勒曲亚」剧情支援。',
          options: alive.map(inv => ({ id: String(inv.seat), label: inv.name || `调查员 ${inv.seat + 1}` })),
        })
        const picked = Number(answer)
        if (alive.some(inv => inv.seat === picked)) seat = picked
      }
      const asset = createConspiratorAsset(state, seat, RAW_CODES.aliki)
      flags.alikiController = asset ? seat : null
      api?.info?.(`🧣 「艾里奇·佐尼·奥佩勒曲亚」由 ${state.investigators?.[seat]?.name || '一位调查员'} 控制。`)
    }
    for (const code of SET_ASIDE_CODES) {
      if (!zones.setAside.includes(code)) zones.setAside.push(code)
    }
    api?.info?.(`📦 放一边：戴红手套的男子、拟态克星、原生质重组者、天启噩兆。`)
    return { alikiController: flags.alikiController, setAside: [...SET_ASIDE_CODES] }
  },

  // ---- 行动 ----
  actions(state, inv) {
    if (!inv || inv.defeated || inv.resigned) return []
    const flags = flagsOf(state)
    const moves = []
    // 揭露：与所在地点相邻的空位上的迷你卡（用本地隐藏值）。
    for (const card of exposableMiniCards(state, inv)) {
      const spot = miniSpotOf(state, card)
      moves.push({
        action: 'scenarioAction', rule: 'exposeMiniCard', miniCardId: card.id, actions: 1,
        label: `🔍 揭露相邻空位（${spot?.x},${spot?.y}）的隐匿迷你卡（隐藏值 ${exposeShroud(state, inv)}）`,
      })
    }
    // 09688 域外来客之廷：[action] 撤退。
    if (inv.location === START_LOCATION) {
      const difficulty = 4 - (flags.courtResignFailRound === state.round ? 1 : 0)
      moves.push({
        action: 'scenarioAction', rule: 'resignCourtOfTheOutsiders', actions: 1,
        label: `🏳️ 撤退：检定意志或敏捷(${difficulty})；成功则撤退并把[[同谋]]支援加入胜利区`,
      })
    }
    // 09689 域外来客之巢：[fast] 红手套男子是唯一放一边的空洞时放入场。
    if (inv.location === OUTSIDERS_LAIR_ID) {
      const only = setAsideHollowCount(state) === 1 && redGlovedManIsHollow(state)
      moves.push({
        action: 'scenarioAction', rule: 'lairSummonRedGlovedMan', actions: 0, fast: true,
        reason: only ? null : '只有「戴红手套的男子」是唯一放一边的空洞时才能使用',
        label: '🧤 把「戴红手套的男子」放入场（置于本地一位调查员的控制下）',
      })
    }
    // 09686 红手套（幕 2 正面）：[action] 如果拟态克星在你地点，花 1 线索造成 2 点伤害。
    const mimetic = mimeticNemesis(state)
    if (state.actIndex === 1 && mimetic && mimetic.location === inv.location) {
      moves.push({
        action: 'scenarioAction', rule: 'act2StrikeMimetic', actions: 1, enemyId: mimetic.id,
        reason: num(inv.clues) < 1 ? `需要 1 个线索（当前 ${num(inv.clues)}）` : null,
        label: '⚔️ 花费 1 个线索：对拟态克星造成 2 点伤害（不引发借机攻击）',
      })
    }
    // 09684 异界的屠杀（议程 3 正面）：[fast] 受到 1 点直接伤害/恐惧：查看一张迷你卡的已揭示面。
    if (state.agendaIndex === 2) {
      moves.push({
        action: 'scenarioAction', rule: 'agenda3LookMiniCard', actions: 0, fast: true,
        reason: flags.agenda3LookRound === state.round ? '团队本轮已经使用过' : null,
        label: '👁️ 受到 1 点直接伤害或 1 点直接恐惧：查看一张隐匿迷你卡的已揭示面（不揭露）',
      })
    }
    return moves
  },

  performAction(state, inv, move, api) {
    if (!move || !inv) return false
    const flags = flagsOf(state)
    if (move.rule === 'exposeMiniCard') {
      return Boolean(exposeMiniInShadows(state, inv, move.miniCardId, api))
    }
    if (move.rule === 'resignCourtOfTheOutsiders') {
      const difficulty = 4 - (flags.courtResignFailRound === state.round ? 1 : 0)
      if (typeof api?.test !== 'function') return false
      api.test(inv.seat, 'willpower', difficulty, result => {
        if (result.success) {
          addConspiratorsToVictory(state, inv, api)
          if (typeof api?.resign === 'function') api.resign(inv.seat)
          else inv.resigned = true
          api?.info?.(`🏳️ ${inv.name} 撤退，离开域外之地。`)
          escapeWhenAllResigned(state, api)
          return
        }
        flags.courtResignFailRound = state.round
        api?.info?.(`🌀 ${inv.name} 撤退失败：直到回合结束，本地点撤退检定难度 -1。`)
      }, 0, { label: '撤退', name: cardNameOf(RAW_CODES.courtOfTheOutsiders), code: RAW_CODES.courtOfTheOutsiders })
      return true
    }
    if (move.rule === 'lairSummonRedGlovedMan') {
      if (!(setAsideHollowCount(state) === 1 && redGlovedManIsHollow(state))) return false
      const here = aliveInvestigators(state).filter(other => other.location === OUTSIDERS_LAIR_ID)
      if (!here.length) return false
      let seat = here[0].seat
      if (here.length > 1 && typeof api?.choice === 'function') {
        const answer = api.choice({
          kind: 'story', source: RAW_CODES.redGlovedMan, seat: here[0].seat,
          prompt: '选择控制「戴红手套的男子」的调查员。',
          options: here.map(other => ({ id: String(other.seat), label: other.name || `调查员 ${other.seat + 1}` })),
        })
        const picked = Number(answer)
        if (here.some(other => other.seat === picked)) seat = picked
      }
      recallHollow(state, RAW_CODES.redGlovedMan, { to: 'hand' })
      const asset = createConspiratorAsset(state, seat, RAW_CODES.redGlovedMan)
      flags.redGlovedManInPlay = Boolean(asset)
      flags.redGlovedManController = asset ? seat : null
      api?.info?.(`🧤 「戴红手套的男子」放入场：由 ${state.investigators?.[seat]?.name || '一位调查员'} 控制。`)
      behavior.checkObjectives(state, api)
      return Boolean(asset)
    }
    if (move.rule === 'act2StrikeMimetic') {
      const enemy = mimeticNemesis(state)
      if (!enemy || enemy.location !== inv.location) return false
      if (num(inv.clues) < 1) return false
      if (typeof api?.spendClues === 'function') api.spendClues(inv.seat, 1)
      else inv.clues = num(inv.clues) - 1
      damageEnemy(state, api, enemy, 2)
      api?.info?.(`⚔️ ${inv.name} 花费 1 个线索，对「拟态克星」造成 2 点伤害（不引发借机攻击）。`)
      return true
    }
    if (move.rule === 'agenda3LookMiniCard') {
      if (flags.agenda3LookRound === state.round) return false
      const cards = concealedMiniCards(state)
      if (!cards.length) return false
      const answer = typeof api?.choice === 'function'
        ? api.choice({
          kind: 'effect', source: RAW_CODES.agenda3, seat: inv.seat,
          prompt: '[fast] 受到 1 点直接伤害或 1 点直接恐惧：查看一张隐匿迷你卡的已揭示面。',
          options: [
            { id: 'damage', label: '受到 1 点直接伤害' },
            { id: 'horror', label: '受到 1 点直接恐惧' },
          ],
        })
        : 'damage'
      if (String(answer) === 'horror') dealTo(state, api, inv, { horror: 1 })
      else dealTo(state, api, inv, { damage: 1 })
      flags.agenda3LookRound = state.round
      const target = cards[0]
      target.known = true
      api?.info?.(`👁️ ${inv.name} 查看了 1 张隐匿迷你卡的已揭示面（不揭露）。`)
      return true
    }
    return false
  },

  // ---- 地点规则（本章不给地点建条目，读点都在 behavior）----
  // 09689 正面：本地每个[[域外]]敌人失去冷漠并 +1 攻击/+1 躲避（+1 走 enemyStatModifier）。
  locationShroudModifier() {
    return 0
  },

  enemyStatModifier(state, enemy, stat) {
    const code = codeOf(enemy)
    if (!code) return 0
    if (!['fight', 'evade'].includes(stat)) return 0
    if (enemy.location !== OUTSIDERS_LAIR_ID) return 0
    if (!traitsOf(code).includes('Outsider')) return 0
    return 1
  },

  // 拟态克星：造成伤害时改为弃掉等量「放一边的空洞」（enemyRule.insteadOfDamageHollows）。
  enemyDamageAmount(state, enemy, total, api) {
    if (!enemyRuleFor(codeOf(enemy))?.insteadOfDamageHollows) return undefined
    const amount = Math.max(0, num(total))
    const candidates = setAsideHollows(state).filter(card => card.code !== RAW_CODES.redGlovedMan)
    const chosen = candidates.slice(0, amount)
    for (const card of chosen) discardHollow(state, card.code, 'mimeticNemesis')
    api?.info?.(`🕳️ 「${cardNameOf(codeOf(enemy))}」受到伤害：改为弃掉 ${chosen.length} 张放一边的空洞`
      + `${chosen.length ? `（${chosen.map(card => cardNameOf(card.code)).join('、')}）` : ''}。`)
    return 0
  },

  // ---- 阶段钩子 ----
  phaseBegan(state, phase, api) {
    flagsOf(state)
    if (phase === 'enemy') {
      // 幕 3 正面：每个[[域外]]敌人失去冷漠（引擎没有行为读点 → 与调查员同地点的域外敌人自动交战）。
      if (state.actIndex >= 2) outsiderAloofRelief(state, api)
    }
    return null
  },

  // 原生质重组者：敌军阶段结束时若处于重整状态，生成魔像（enemyRule.golemSpawn）。
  enemyPhaseEnd(state, api) {
    const reassembler = enemiesInPlay(state)
      .find(enemy => enemyRuleFor(codeOf(enemy))?.golemSpawn)
    if (!reassembler || reassembler.exhausted) return null
    const alive = aliveInvestigators(state)
    if (!alive.length) return null
    const nearest = [...alive].sort((left, right) =>
      distanceBetween(state, reassembler.location, left.location) - distanceBetween(state, reassembler.location, right.location))[0]
    const top = (nearest.deck || []).slice(-1)[0] || null
    const flags = flagsOf(state)
    if (!top) {
      api?.info?.('🧱 「原生质重组者」没有可生成的魔像（最近的调查员牌库为空）。')
      return null
    }
    if (typeof api?.moveCard === 'function') {
      api.moveCard({ code: top, from: 'deck', to: 'setAside', ownerSeat: nearest.seat })
    } else {
      nearest.deck.pop()
      state.setAside ||= []
      state.setAside.push({ code: top, ownerSeat: nearest.seat })
    }
    hollowCard(state, { code: top, source: RAW_CODES.protoplasmicReassembler, scope: 'investigator', seat: nearest.seat })
    flags.golems.push({ code: top, seat: nearest.seat, locationId: reassembler.location, round: state.round })
    api?.info?.(`🧱 「原生质重组者」把 ${nearest.name} 牌库顶的「${cardNameOf(top)}」生成魔像：`
      + '本章把魔像记为「放在一边的空洞」（引擎没有无卡号敌人实体）。')
    return { golem: top, seat: nearest.seat }
  },

  roundEnded(state, api) {
    const flags = flagsOf(state)
    flags.round = state.round
    // 拟态克星（enemyRule.roundEndHollowOrAttack）：轮末该地点的每位调查员空洞化一张手牌，或被攻击。
    const endOfRound = enemiesInPlay(state)
      .filter(enemy => enemyRuleFor(codeOf(enemy))?.roundEndHollowOrAttack)
    const results = []
    for (const mimetic of endOfRound) {
      const here = aliveInvestigators(state).filter(inv => inv.location === mimetic.location)
      for (const inv of here) {
        const code = chooseHandCard(state, api, inv.seat,
          '选择一张非弱点手牌放在一边作为空洞，或让这个敌人攻击你。', codeOf(mimetic))
        if (code) {
          hollowCardFromSeat(state, api, inv.seat, code, codeOf(mimetic))
          results.push({ seat: inv.seat, hollowed: code })
          continue
        }
        if (typeof api?.attack === 'function') api.attack(mimetic, inv)
        else dealTo(state, api, inv, {
          damage: num(ALL_CARDS[codeOf(mimetic)]?.damage), horror: num(ALL_CARDS[codeOf(mimetic)]?.horror),
        })
        results.push({ seat: inv.seat, attacked: true })
      }
      if (here.length) {
        api?.info?.(`🕳️ 轮末（${cardNameOf(codeOf(mimetic))}）：本地点 ${here.length} 位调查员各自空洞化或被攻击。`)
      }
    }
    return results
  },

  // ---- 地点揭示 ----
  locationRevealed(state, location, api) {
    const code = codeOf(location)
    const flags = flagsOf(state)
    if (location?.id && isOtherworldLocationId(location.id)) {
      delete location.inShadows
      if (isInShadows(state, location.id)) setInShadows(state, location.id, false)
    }
    if (code === RAW_CODES.outsidersLair) {
      flags.lairRevealed = true
      api?.info?.('🏛️ 「域外来客之巢」被揭示：本地每个[[域外]]敌人失去冷漠并 +1 攻击/+1 躲避。')
      behavior.checkObjectives(state, api)
    }
    return null
  },

  // 剧情支援入场（红手套男子进场的幕 2 目标）。
  assetEntered(state, inv, asset, api) {
    if (codeOf(asset) !== RAW_CODES.redGlovedMan) return null
    const flags = flagsOf(state)
    flags.redGlovedManInPlay = true
    flags.redGlovedManController = inv?.seat ?? null
    api?.info?.('🧤 「戴红手套的男子」入场：幕 2 目标达成。')
    behavior.checkObjectives(state, api)
    return true
  },

  // ---- [[同谋]] 支援的反应（09692 / 09693）----
  // 09692 戴红手套的男子：攻击或躲避[[域外]]敌人成功且超过难度 2 点时，横置他：
  //   对该敌人造成 1 点伤害并发现你所在地点的 1 个线索。
  enemyAttackedSuccessfully(state, inv, enemy, api) {
    const result = typeof api?.testResult === 'function' ? api.testResult() : state.lastTestResult
    const successBy = Number(result?.successBy ?? (Number(result?.value) - Number(result?.difficulty)))
    if (!(successBy >= outsiderReactionThreshold())) return null
    return redGlovedManReaction(state, inv, enemy, api)
  },

  afterEvade(state, inv, enemy, result, api) {
    if (!result?.success) return null
    const successBy = Number(result.successBy ?? (Number(result.value) - Number(result.difficulty)))
    if (!(successBy >= outsiderReactionThreshold())) return null
    return redGlovedManReaction(state, inv, enemy, api)
  },

  // ---- 进入未揭示地点的额外费用（议程 1–3 正面）----
  // 费用预检：本地调查员的线索合计必须够 1[每人]。
  moveError(state, inv, destination) {
    if (!destination || destination.revealed !== false) return null
    if (!isOtherworldLocationId(destination.id)) return null
    const cost = investigatorCount(state)
    const group = aliveInvestigators(state).filter(other => other.location === inv.location)
    const available = group.reduce((sum, other) => sum + num(other.clues), 0)
    if (available < cost) return `进入未揭示的地点需要本地调查员共同花费 ${cost} 个线索（当前 ${available}）`
    return null
  },

  // 引擎在 revealLocation 之后才调用 locationEntered：用 lastLocationRevealed 判定「本次进入才揭示」，
  // 再把费用记成待付（真正扣款在 locationLeft 里，因为那里还能拿到出发地点）。
  locationEntered(state, inv, location, api) {
    if (!location || !isOtherworldLocationId(location.id)) return null
    const last = state.lastLocationRevealed
    if (!last || String(last.id) !== String(location.id) || last.round !== state.round) return null
    const flags = flagsOf(state)
    flags.pendingEntryCost = { locationId: location.id, cost: investigatorCount(state), round: state.round }
    return flags.pendingEntryCost
  },

  locationLeft(state, inv, prevLocation, api) {
    const flags = flagsOf(state)
    const pending = flags.pendingEntryCost
    if (!pending) return null
    flags.pendingEntryCost = null
    const group = [inv, ...aliveInvestigators(state).filter(other => other.location === prevLocation?.id && other.seat !== inv.seat)]
    let left = pending.cost
    const paid = []
    for (const member of group) {
      if (left <= 0) break
      const pay = Math.min(left, num(member.clues))
      if (pay <= 0) continue
      if (typeof api?.spendClues === 'function') api.spendClues(member.seat, pay)
      else member.clues = num(member.clues) - pay
      left -= pay
      paid.push({ seat: member.seat, clues: pay })
    }
    flags.entryCharges = [...(flags.entryCharges || []).slice(-19),
      { locationId: pending.locationId, paid, round: state.round }]
    api?.info?.(`📜 进入未揭示地点的额外费用：本地调查员共同花费 ${pending.cost - left} 个线索。`)
    return { paid, remaining: left }
  },

  // ---- 幕 ----
  actReveal(state, act, api) {
    const code = codeOf(act)
    const rule = entryOf(code)?.actRule
    if (typeof rule?.onReveal === 'function') return rule.onReveal(state, act, api) === true
    const handler = ACT_BACK_HANDLERS[code]
    if (!handler) return false
    handler(state, api)
    return true
  },

  // ---- 议程 ----
  agendaReveal(state, agenda, api) {
    const code = codeOf(agenda)
    const rule = entryOf(code)?.agendaRule
    if (typeof rule?.onReveal === 'function') return rule.onReveal(state, agenda, api) === true
    if (agenda?.backAction === 'chooseTwoOfThree') {
      if (Array.isArray(agenda.shuffleBack) && agenda.shuffleBack.length) {
        for (const back of agenda.shuffleBack) {
          state.scenarioZones ||= {}
          state.scenarioZones.setAside = (state.scenarioZones.setAside || []).filter(item => item !== back)
        }
        if (typeof api?.shuffleIntoEncounterDeck === 'function') api.shuffleIntoEncounterDeck([...agenda.shuffleBack])
        else state.encounterDeck.push(...agenda.shuffleBack)
        api?.info?.(`🔥 议程背面：把 ${agenda.shuffleBack.map(cardNameOf).join('、')} 洗回遭遇牌库。`)
      }
      chooseTwoOfThree(state, api, code)
      return true
    }
    if (agenda?.backAction === 'drivenInsane') {
      agendaDrivenInsane(state, api)
      return true
    }
    return false
  },

  // ---- 目标检查 ----
  checkObjectives(state, api) {
    const act = state.acts?.[state.actIndex]
    const objective = act?.objective
    if (!objective || objective.type !== 'campaignRule') return false
    const flags = flagsOf(state)
    if (objective.kind === 'lairRevealed') {
      const lair = state.locations?.find(location => codeOf(location) === RAW_CODES.outsidersLair)
      if (!lair?.revealed || !flags.lairRevealed) return false
      api?.info?.('🎯 域外来客之巢已揭示：推进幕 1。')
      api?.advanceAct?.()
      return true
    }
    if (objective.kind === 'redGlovedManEntersPlay') {
      if (!flags.redGlovedManInPlay) return false
      api?.info?.('🎯 戴红手套的男子入场：推进幕 2。')
      api?.advanceAct?.()
      return true
    }
    if (objective.kind === 'allResigned') {
      const alive = aliveInvestigators(state)
      if (alive.length) return false
      api?.info?.('🎯 每位幸存调查员都已撤退：推进幕 3。')
      api?.advanceAct?.()
      return true
    }
    return false
  },

  // 引擎在所有调查员离场时调用（没有撤退的失败路线）。
  allResigned(state, api) {
    if (state.status !== 'playing') return false
    api?.finish?.('noResolution')
    return true
  },

  // ---- 遭遇卡结算（共享组诡计的条目 / 声明式检定）----
  resolveEncounter(state, inv, card, api) {
    const code = codeOf(card)
    const entryResolve = encounterResolveFor(code)
    if (entryResolve) return entryResolve(state, inv, card, api, { location: locationById(state, inv.location) })
    const declarative = treacheryTestFor(code)
    if (declarative) return resolveDeclarativeTreacheryTest(state, inv, card, api, declarative)
    return false
  },

  // ---- 混乱标记 ----
  resolveChaosToken(state, inv, token) {
    return withoutATraceChaosToken(state, inv, token, {
      countLocations: value => skullLocationCount(value?.locations || []),
      countHollows: (value, seat) => setAsideHollowCountOf(value, seat),
    })
  },

  afterTest(state, inv, result, api) {
    const riders = withoutATraceAfterTest(state, inv, result) || []
    for (const rider of riders) {
      if (rider === 'cultistOutsider') cultistRider(state, inv, api)
      else if (rider === 'elderThingHollow') {
        const code = chooseHandCard(state, api, inv.seat, '选择一张非弱点手牌，放在一边作为空洞。', RAW_CODES.scenario)
        if (code) hollowCardFromSeat(state, api, inv.seat, code, RAW_CODES.scenario)
        api?.info?.(`🌀 [elderthing]：${inv.name} 把一张手牌放在一边，作为空洞。`)
      }
    }
    return riders
  },

  // ---- 结局 ----
  resolution(state, key, events, api = {}) {
    const flags = flagsOf(state)
    const table = RESOLUTION_TABLE[key] || RESOLUTION_TABLE.resolution4
    const records = recordsOf(state)
    for (const [record, value] of Object.entries(table.records)) records[record] = value
    flags.resolution = key
    if (table.time) markTime(state, api, table.time)
    if (table.embark) {
      const answers = EMBARK_NODES
      const lead = aliveInvestigators(state)[0]?.seat ?? 0
      const answer = typeof api.choice === 'function'
        ? api.choice({
          kind: 'story', source: RAW_CODES.scenario, seat: lead,
          prompt: '你可以启程（选择出发地）。',
          options: answers.map(id => ({ id, label: `从${mapNodeLabel(id)}启程` })),
        })
        : BERMUDA_MAP_NODE
      const node = answers.includes(String(answer)) ? String(answer) : BERMUDA_MAP_NODE
      flags.embarkFrom = node
      const campaign = (state.campaign ||= {})
      if (campaign.tsk?.map) {
        campaign.tsk.map.current = node
        campaign.tsk.map.visited ||= []
        if (!campaign.tsk.map.visited.includes(node)) campaign.tsk.map.visited.push(node)
      }
      api.info?.(`🧭 启程：从${mapNodeLabel(node)}出发。`)
    }
    api.info?.(`🎬 不留痕迹结算：${key}。`)
    return { bonus: table.bonus, award: table.award, resolution: key }
  },

  // 结局分派（幕 3 背面 / 议程 3 背面 / 提前全体撤退）。
  finalResolution(state) {
    const alive = aliveInvestigators(state)
    if (!alive.length) return 'noResolution'
    return resolutionFromVictory(state)
  },

  storyResolutionKey(state, key) {
    return key || 'noResolution'
  },

  // ---- 供测试 / 其它钩子复用的具名导出挂在 behavior 上 ----
  exposeMiniInShadows,
  setAsideHollows,
  prepareOtherworldDeck,
  resolutionFromVictory,
}

// ---------------------------------------------------------------------------
// 幕背面实现（参考 Act/Cards 的 AdvanceAct 分支）
// ---------------------------------------------------------------------------
export const ACT_BACK_HANDLERS = Object.freeze({
  // 幕 1 背面（09685b 幻中之幻）：
  //   · 在域外来客之巢以横置状态生成放一边的拟态克星；
  //   · 每位调查员从弃牌堆选 2 张非弱点卡放在一边作为空洞；
  //   · 把放一边的戴红手套男子与其它放一边的空洞放在一起（归全队所有；不附属任何钥匙）。
  [RAW_CODES.act1](state, api) {
    const flags = flagsOf(state)
    const lair = state.locations?.find(location => codeOf(location) === RAW_CODES.outsidersLair)
    const locationId = lair?.id || OUTSIDERS_LAIR_ID
    if (!lair) ensureLocation(state, api, OUTSIDERS_LAIR_ID)
    const spawn = typeof api?.spawn === 'function'
      ? api.spawn(RAW_CODES.mimeticNemesis, locationId, { exhausted: true })
      : null
    flags.mimeticSpawned = Boolean(spawn)
    api?.info?.('👁️ 幕 1 背面：拟态克星以横置状态在「域外来客之巢」生成。')
    // 每位调查员弃牌堆 2 张非弱点卡 → 空洞。
    for (const inv of aliveInvestigators(state)) {
      const pool = [...new Set((inv.discard || []).filter(code => !isWeakness(code) && !isHollowed(state, code)))]
      const picks = pool.slice(0, 2)
      for (const code of picks) {
        hollowCard(state, { code, source: RAW_CODES.act1, scope: 'investigator', seat: inv.seat })
        if (typeof api?.moveCard === 'function') api.moveCard({ code, from: 'discard', to: 'setAside', ownerSeat: inv.seat })
        else inv.discard = inv.discard.filter(item => item !== code)
      }
      if (picks.length) api?.info?.(`🕳️ ${inv.name} 弃牌堆的 ${picks.length} 张卡放在一边作为空洞。`)
    }
    // 红手套男子：与其它放一边的空洞放在一起（全队所有）。
    if (!isHollowed(state, RAW_CODES.redGlovedMan)) {
      hollowCard(state, { code: RAW_CODES.redGlovedMan, source: RAW_CODES.act1, scope: 'team' })
    }
    flags.redGlovedManInPlay = false
    api?.info?.('🧤 戴红手套的男子与其它放一边的空洞放在一起（归所有调查员所有；不附属任何钥匙）。')
  },
  // 幕 2 背面（09686b 才出虎口）：卡面没有额外结算。
  [RAW_CODES.act2](state, api) {
    api?.info?.('🔥 幕 2 背面：才出虎口。')
  },
  // 幕 3 背面（09687b 真实世界）：按胜利区的[[同谋]]支援进入结局 1–4。
  [RAW_CODES.act3](state, api) {
    const key = resolutionFromVictory(state)
    api?.info?.(`🎬 幕 3 背面：检查胜利区（红手套男子 / 艾里奇）→ ${key}。`)
    if (typeof api?.finish === 'function') api.finish(key)
    return key
  },
})

// ---------------------------------------------------------------------------
// 议程背面实现
// ---------------------------------------------------------------------------
function chooseTwoOfThree(state, api, source) {
  const lead = aliveInvestigators(state)[0]?.seat ?? 0
  const available = Object.keys(AGENDA_BACK_OPTIONS)
  const chosen = []
  if (typeof api?.choice === 'function') {
    const remaining = [...available]
    while (chosen.length < 2 && remaining.length) {
      const answer = api.choice({
        kind: 'story', source, seat: lead,
        prompt: `调查员必须共同选择两项（已选 ${chosen.length}/2）：`,
        options: remaining.map(id => ({ id, label: AGENDA_BACK_OPTIONS[id].label })),
      })
      const picked = remaining.find(id => String(id) === String(answer)) || remaining[0]
      chosen.push(picked)
      remaining.splice(remaining.indexOf(picked), 1)
    }
  } else {
    chosen.push(...available.slice(0, 2))
  }
  for (const id of chosen) applyAgendaBackOption(state, api, id, source)
  return chosen
}

function applyAgendaBackOption(state, api, id, source) {
  if (id === 'damageAndHorror') {
    for (const inv of aliveInvestigators(state)) dealTo(state, api, inv, { damage: 1, horror: 1 })
    api?.info?.('💥 议程背面：每位调查员受到 1 点伤害和 1 点恐惧。')
    return
  }
  if (id === 'hollows') {
    hollowOneCardPerInvestigator(state, api, source)
    return
  }
  if (id === 'shuffleConcealed') {
    reshuffleConcealed(state)
    api?.info?.('🌫️ 议程背面：混洗全部隐匿迷你卡并正面朝下放回原位。')
  }
}

function agendaDrivenInsane(state, api) {
  const resigned = (state.investigators || []).filter(inv => inv.resigned)
  for (const inv of state.investigators || []) {
    if (inv.resigned || inv.defeated) continue
    if (typeof api?.driveInsane === 'function') api.driveInsane(inv.seat)
    else {
      inv.defeated = true
      inv.drivenInsane = true
    }
    api?.info?.(`💀 ${inv.name} 发疯：所有关于其存在的记忆都从现实中被清除。`)
  }
  if (resigned.length) {
    const key = resolutionFromVictory(state)
    api?.info?.(`🏳️ 有调查员已撤退：立即推进到幕 3 背面（${key}）。`)
    if (typeof api?.finish === 'function') api.finish(key)
    return key
  }
  api?.finish?.('noResolution')
  return 'noResolution'
}

// 09692 戴红手套的男子：攻击/躲避[[域外]]敌人成功且超过难度 2 点时，横置他 → 1 点伤害 + 发现 1 线索。
// 参考卡片是 [reaction]（可选用）；本章在命中读点自动使用并横置（见 scenarioApproximations）。
function outsiderReactionThreshold() {
  return num(assetRuleFor(RAW_CODES.redGlovedMan)?.outsiderSuccessReaction?.by) || 2
}

function redGlovedManReaction(state, inv, enemy, api) {
  const rule = assetRuleFor(RAW_CODES.redGlovedMan)?.outsiderSuccessReaction
  if (!rule || !inv) return null
  if (!traitsOf(codeOf(enemy)).includes('Outsider')) return null
  const asset = (inv.assets || []).find(item => codeOf(item) === RAW_CODES.redGlovedMan && !item.exhausted)
  if (!asset) return null
  asset.exhausted = true
  damageEnemy(state, api, enemy, num(rule.damage) || 1)
  if (typeof api?.discoverClue === 'function') api.discoverClue(inv.seat, num(rule.clue) || 1)
  api?.info?.(`🧤 横置「戴红手套的男子」：对「${cardNameOf(codeOf(enemy))}」造成 ${num(rule.damage) || 1} 点伤害`
    + `并发现你所在地点的 ${num(rule.clue) || 1} 个线索。`)
  return { enemyId: enemy.id, seat: inv.seat }
}

// 09693 艾里奇：隐匿迷你卡被揭露后，横置她 → 选择一个放在一边的空洞，其所有者将其抽取。
function alikiReaction(state, api) {
  const controller = (state.investigators || []).find(inv => (inv.assets || [])
    .some(asset => codeOf(asset) === RAW_CODES.aliki && !asset.exhausted))
  if (!controller || !assetRuleFor(RAW_CODES.aliki)?.exposeRecallHollow) return null
  const hollows = setAsideHollows(state)
  if (!hollows.length) return null
  const asset = controller.assets.find(item => codeOf(item) === RAW_CODES.aliki)
  asset.exhausted = true
  const own = hollows.filter(card => card.seat === controller.seat)
  const record = (own[0] || hollows[0])
  recallHollowToOwner(state, api, record.code, 'hand')
  api?.info?.(`🧣 横置「艾里奇·佐尼·奥佩勒曲亚」：空洞「${cardNameOf(record.code)}」回到其所有者手中。`)
  return record.code
}

// 幕 3 正面：[[域外]]敌人失去冷漠（近似：与调查员同地点时自动交战）。
function outsiderAloofRelief(state, api) {
  const engaged = []
  for (const enemy of outsidersInPlay(state)) {
    if (enemy.engagedSeat != null) continue
    const here = aliveInvestigators(state).find(inv => inv.location === enemy.location)
    if (!here) continue
    if (typeof api?.engageAtInvestigator === 'function') {
      if (api.engageAtInvestigator(enemy, here.seat)) engaged.push({ enemyId: enemy.id, seat: here.seat })
    } else if (typeof api?.engage === 'function') {
      if (api.engage(enemy, here.seat)) engaged.push({ enemyId: enemy.id, seat: here.seat })
    }
  }
  if (engaged.length) api?.info?.(`👁️ 幕 3：「域外」敌人失去冷漠（${engaged.length} 个敌人自动交战）。`)
  return engaged
}

// 09688 撤退成功但还没到幕 3：卡面是「立即推进到幕 3b」，这里直接进结局分派（幕 3 背面的判定）。
function escapeWhenAllResigned(state, api) {
  const alive = aliveInvestigators(state)
  if (alive.length) return null
  if (state.actIndex >= 2) return behavior.checkObjectives(state, api)
  const key = resolutionFromVictory(state)
  api?.info?.(`🏳️ 每位幸存调查员都已撤退：立即推进到幕 3 背面（${key}）。`)
  api?.finish?.(key)
  return key
}

// [cultist] 失败：最近的[[域外]]敌人重整、向你移动一次、若在你地点则攻击你。
function cultistRider(state, inv, api) {
  const enemy = nearestOutsider(state, inv)
  if (!enemy) return null
  if (typeof api?.readyEnemy === 'function') api.readyEnemy(enemy)
  else enemy.exhausted = false
  if (enemy.location !== inv.location) {
    if (typeof api?.moveEnemyToward === 'function') api.moveEnemyToward(enemy, inv.location)
    else {
      const next = (locationById(state, enemy.location)?.connections || [])
        .map(id => ({ id, distance: distanceBetween(state, id, inv.location) }))
        .filter(entry => Number.isFinite(entry.distance))
        .sort((left, right) => left.distance - right.distance)[0]
      if (next) enemy.location = next.id
    }
  }
  if (enemy.location === inv.location && typeof api?.attack === 'function') api.attack(enemy, inv)
  api?.info?.(`🌀 [cultist]：「${cardNameOf(codeOf(enemy))}」重整并向 ${inv.name} 移动`
    + `${enemy.location === inv.location ? '，并在本地攻击' : ''}。`)
  return { enemyId: enemy.id }
}

// —— 世界地图节点显示名（只做展示，不复制地图表）——
function mapNodeLabel(id) {
  return ({ Bermuda: '百慕大', YborCity: '宜博市', SanJuan: '圣胡安' })[id] || id
}

export {
  RAW_CODES, START_LOCATION, OUTSIDERS_LAIR_ID, SHADOW_POSITIONS, MINI_KIND_BY_POSITION, DECOY_MINI_KIND,
  MINI_KIND_BY_POSITION as MINI_KIND, OTHERWORLD_DECK_ID, MAX_TABLET_HOLLOWS, locationIdOfCode, CITY_OF_REMNANTS_LOCATION_IDS,
}
export const enemyCodes = () => [RAW_CODES.mimeticNemesis, RAW_CODES.protoplasmicReassembler]
export const shadowPositionOf = (state, locationId) => Object.entries(flagsOf(state).shadows)
  .find(([, value]) => String(value) === String(locationId))?.[0] || null
export const deckRemaining = state => scenarioDeckSize(state, OTHERWORLD_DECK_ID)
