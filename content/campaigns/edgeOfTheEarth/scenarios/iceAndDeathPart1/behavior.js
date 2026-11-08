// 亡命冰原 第 I 部分 · 引擎钩子（章节流程 + 地点/议程/结局）。
//
// 约定同 TDE/Part3 章节：behavior 只做章节分派与本章机制；逐卡规则在单卡条目里。
// 本文件同时服务引擎 scenarioBehavior 分派与单测（测试直接调用这些函数）。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { actRuleFor, agendaRuleFor } from '../../../../../src/cards/card-rules.js'
import { initializeTekeliDeck, tekeliShuffleIn } from '../../../../../src/engine/eote-tekeli.js'
import {
  campLocationId, recordRevealedLocation, revealedLocations, setCampLocation,
} from '../../../../../src/engine/eote-camp.js'
import { CAMP_SHELTER } from '../../records.js'
import {
  LOCATIONS, LOCATION_CONNECTIONS, CHAPTER_ID, RAW_CODES as RAW, SET_ASIDE_ALIASES,
  UNCHARTED_ENTRY_COST, UNCHARTED_LOCATION_IDS, INITIAL_LOCATION_IDS, START_LOCATION, scenario,
} from './definition.js'
import { part1ChaosFailureSpec, part1ChaosTokenValue, shelterValueOf } from './chaos.js'

const codeOf = card => card?.originalCode || card?.code || card
const activeInvestigators = state => (state.investigators || []).filter(inv => !inv.defeated && !inv.resigned)
const recordsOf = state => {
  state.campaign ||= {}
  state.campaign.records ||= {}
  return state.campaign.records
}
const leadSeat = state => Number(state.campaign?.leadSeat ?? 0)
const locationOf = (state, id) => (state.locations || []).find(location => location.id === id)
const setAside = state => (state.scenarioZones ||= {}).setAside ||= []
const takeFromSetAside = (state, code) => {
  const list = setAside(state)
  const index = list.indexOf(code)
  if (index < 0) return false
  list.splice(index, 1)
  return true
}
const count = (state, codes) => codes.reduce((sum, code) => sum + codes.filter(item => item === code).length, 0)
const numInvestigators = state => Math.max(1, Number(state.numInvestigators) || (state.investigators || []).length || 1)

// 检查点 I 读的是 `Camp_*` 记录（records.js#campShelterFromRecords）；章节行为写营地时
// 必须同时写这条印刷记录键，否则检查点拿到庇护值 0、全部队员失踪（审计 A#5）。
const campRecordKey = id => {
  if (!id) return null
  const key = `camp${String(id).charAt(0).toUpperCase()}${String(id).slice(1)}`
  return Object.hasOwn(CAMP_SHELTER, key) ? key : null
}
const writeCampRecords = (state, locationId) => {
  const records = recordsOf(state)
  records.camp = locationId
  const key = campRecordKey(locationId)
  if (key) records[key] = true
  records.eoteShelterValue = shelterValueOf(state, locationId)
}

function makeRuntimeLocation(state, id, { revealed = false } = {}) {
  const data = LOCATIONS[id]
  if (!data) return null
  const clues = data.cluesFixed != null
    ? data.cluesFixed
    : (data.cluesPerInvestigator || 0) * numInvestigators(state)
  return {
    ...structuredClone(data), id, revealed, clues: revealed ? clues : 0, maxClues: clues, doom: 0,
    connections: [...(LOCATION_CONNECTIONS[id] || [])],
  }
}

const putLocation = (state, id, options) => {
  if (locationOf(state, id)) return locationOf(state, id)
  const placed = makeRuntimeLocation(state, id, options)
  if (placed) state.locations.push(placed)
  return placed
}

const symbolPlaced = (state, locationId) => LOCATIONS[locationId]?.symbol || null

// Haskell#placeSetAsideConnectedLocations：把与刚进入地点「印刷连接」的未探索地点放到场上（未揭示）。
export function placeConnectedSetAsideLocations(state, locationId, api = {}) {
  const symbol = symbolPlaced(state, locationId)
  if (!symbol) return []
  const connected = UNCHARTED_LOCATION_IDS.filter(id => {
    if (locationOf(state, id)) return false
    if (!setAside(state).includes(LOCATIONS[id].originalCode || LOCATIONS[id].code)) return false
    const links = LOCATIONS[id].connections || []
    return (PUBLIC_LINKS[id] || []).includes(symbol) || (PUBLIC_LINKS[locationId] || []).includes(LOCATIONS[id].symbol)
      || links.includes(locationId) || (LOCATION_CONNECTIONS[id] || []).includes(locationId)
  })
  for (const id of connected) {
    putLocation(state, id, { revealed: false })
    takeFromSetAside(state, LOCATIONS[id].originalCode || LOCATIONS[id].code)
  }
  if (connected.length) api.info?.(`❄️ 进入「${LOCATIONS[locationId]?.name || locationId}」：放置相连地点 ${connected.length} 个。`)
  return connected
}

// 印刷「相邻符号」表（用于判定 set-aside 地点的连接；与 location.connections 同源）。
const PUBLIC_LINKS = Object.freeze({
  crashSite: ['diamond', 'triangle', 'heart'],
  frozenShores: ['circle', 'triangle', 'heart', 'square'],
  treacherousPath: ['circle', 'diamond', 'heart', 'equals'],
  precariousIceSheet: ['circle', 'diamond', 'triangle', 'droplet'],
  broadSnowdrifts: ['diamond', 'hourglass', 'star', 'squiggle'],
  icyWastes: ['heart', 'star', 'moon', 'trefoil'],
  rockyCrags: ['triangle', 'hourglass', 'moon', 'plus'],
  snowGraves: ['square'], icebreakerLanding: ['droplet'], frigidCave: ['equals'],
  barrierCamp: ['droplet', 'equals'], remnantsOfLakesCamp: ['square', 'droplet'],
  crystallineCavern: ['equals', 'square'],
})

/** Haskell#Setup：本章开局（地点、放一边、遭遇牌库、忒咳哩-哩牌库、议程/幕、难度毁灭）。 */
export function setupScenario(state, api = {}) {
  state.scenarioFlags ||= {}
  state.scenarioZones ||= {}
  state.campaign ||= {}
  state.acts = structuredClone(scenario.acts)
  state.agendas = structuredClone(scenario.agendas)
  state.actIndex = 0
  state.agendaIndex = 0
  state.doom = 0
  state.round = 1
  state.locations = []
  for (const id of INITIAL_LOCATION_IDS) putLocation(state, id, { revealed: true })
  for (const inv of state.investigators || []) inv.location = START_LOCATION
  state.scenarioZones.setAside = [
    ...UNCHARTED_LOCATION_IDS.map(id => LOCATIONS[id].originalCode || LOCATIONS[id].code),
    ...SET_ASIDE_ALIASES,
  ]
  state.encounterDeck = [...scenario.encounterDeck]
  state.encounterDiscard ||= []
  state.victoryDisplay ||= []
  state.enemies ||= []
  state.scenarioZones.putIntoPlay = [...INITIAL_LOCATION_IDS]
  initializeTekeliDeck(state, { cards: [...RAW.tekeliliFaces], copies: [...RAW.tekeliliCopies] })
  if (String(state.difficulty) === 'hard') state.doom = 1
  if (String(state.difficulty) === 'expert') state.doom = 2
  api.info?.(`🧊 亡命冰原 I：从「${LOCATIONS[START_LOCATION].name}」开始；${state.scenarioZones.setAside.length} 张放一边，遭遇牌库 ${state.encounterDeck.length} 张。`)
  return {
    startLocation: START_LOCATION,
    placed: [...INITIAL_LOCATION_IDS],
    setAside: state.scenarioZones.setAside.length,
    encounterDeck: state.encounterDeck.length,
    tekeliliDeck: RAW.tekeliliCopies.reduce((sum, value) => sum + value, 0),
  }
}

/**
 * 移动前钩子（movement.js:283，在揭示地点之前调用）：
 * 未探索地点（08506–08514 背面）的「进入额外费用」必须在揭示前收取。
 * 引擎在 `revealLocation` **之后**才调用 `locationEntered`，旧实现在那里收费是死代码；
 * 这里按印刷文本「作为你进入本地点的额外费用，你所在地点的调查员必须共同花费
 * N[per_investigator] 个线索」先收费、再揭示，不足则返回 false 取消本次移动。
 */
export function beforeMove(state, inv, destination, api = {}) {
  const placed = typeof destination === 'string' ? locationOf(state, destination) : destination
  if (!placed || placed.revealed !== false) return undefined
  const costPerInvestigator = UNCHARTED_ENTRY_COST[placed.id]
  if (!costPerInvestigator) return undefined
  const total = costPerInvestigator * numInvestigators(state)
  const group = activeInvestigators(state).filter(other => other.location === inv?.location)
  const available = group.reduce((sum, other) => sum + (other.clues || 0), 0)
  if (available < total) {
    api.info?.(`「${placed.name || placed.id}」尚未探索：需要你所在地点的调查员共同花费 ${total} 个线索才能进入（当前 ${available}）。`)
    return false
  }
  let left = total
  for (const other of group) {
    const spend = Math.min(left, other.clues || 0)
    other.clues -= spend
    left -= spend
  }
  api.info?.(`未探索地点「${placed.name || placed.id}」：你所在地点的调查员共同花费 ${total} 个线索。`)
  // 在揭示前完成收费；揭示仍交给引擎（`revealLocation` 会按 maxClues 放置线索并触发地点揭示钩子）。
  api.reveal?.(placed.id)
  return undefined
}

/** 合法移动过滤：线索不足时不出现在 legalMoves（validateMove 读同一份理由）。 */
export function moveError(state, inv, destination, id) {
  const placed = typeof destination === 'string' ? locationOf(state, destination) : destination
  const locationId = placed?.id || id
  if (!locationId || !placed || placed.revealed !== false) return null
  const costPerInvestigator = UNCHARTED_ENTRY_COST[locationId]
  if (!costPerInvestigator) return null
  const total = costPerInvestigator * numInvestigators(state)
  const group = activeInvestigators(state).filter(other => other.location === inv?.location)
  const available = group.reduce((sum, other) => sum + (other.clues || 0), 0)
  return available < total ? `线索不足，无法进入未探索地点「${placed.name || locationId}」（需要共同花费 ${total} 个线索）` : null
}

/** 首次进入地点：议程 I–III 的正面强制（放置相连的放一边地点），并记录已揭示地点。 */
export function locationEntered(state, inv, location, api = {}) {
  const placed = typeof location === 'string' ? locationOf(state, location) : location
  if (!placed) return true
  if (!placed.visited) {
    placed.visited = true
    if (Number(state.agendaIndex) <= 2) placeConnectedSetAsideLocations(state, placed.id, api)
  }
  if (placed.revealed === true) {
    recordRevealedLocation(state, placed.id)
    ;(recordsOf(state).locationsRevealed ||= [])
    if (!recordsOf(state).locationsRevealed.includes(placed.id)) recordsOf(state).locationsRevealed.push(placed.id)
  }
  return true
}

function spawnFromSetAside(state, code, locationId, api, extra = {}) {
  if (!takeFromSetAside(state, code)) return null
  const card = ALL_CARDS[code] || {}
  const enemy = {
    id: `${code}-${state.enemies.length + 1}`,
    code, originalCode: code, name: card.nameZh || card.name || code,
    location: locationId, engagedSeat: null, exhausted: false, damageTaken: 0,
    fight: card.fight ?? null, evade: card.evade ?? null, health: card.health ?? null,
    damage: card.damage || 0, horror: card.horror || 0,
    traits: [...(card.traits || [])], ...extra,
  }
  state.enemies.push(enemy)
  api.info?.(`👹 生成「${enemy.name}」在「${LOCATIONS[locationId]?.name || locationId}」。`)
  return enemy
}

const highestShelterLocation = (state, predicate = () => true) => (state.locations || [])
  .filter(location => predicate(location))
  .sort((a, b) => shelterValueOf(state, b.id) - shelterValueOf(state, a.id))[0] || null

/** 议程 I 背面：在队长所在地点生成疾行谬物；其余疾行谬物 + 冰中生物洗入遭遇牌库。 */
export function resolveColdWelcomeBack(state, api = {}) {
  const lead = state.investigators?.[leadSeat(state)] || state.investigators?.[0]
  const locationId = lead?.location || START_LOCATION
  const spawned = spawnFromSetAside(state, RAW.skitteringNonsense, locationId, api, { hunter: true })
  const skittering = setAside(state).filter(code => code === RAW.skitteringNonsense)
  const creatures = setAside(state).filter(code => (ALL_CARDS[code]?.encounterCode || '') === 'creatures_in_the_ice')
  for (const code of [...skittering, ...creatures]) takeFromSetAside(state, code)
  state.encounterDeck.push(...skittering, ...creatures)
  api.info?.(`🌨️ 冷遇背面：生成疾行谬物；${skittering.length + creatures.length} 张洗入遭遇牌库。`)
  return { spawned, shuffled: [...skittering, ...creatures] }
}

/** 议程 II 背面：在已揭示且庇护值最高的地点生成星之恐怖。 */
export function resolveIntoTheWhiteBack(state, api = {}) {
  const target = highestShelterLocation(state, location => location.revealed === true)
  if (!target) return { spawned: null }
  const spawned = spawnFromSetAside(state, RAW.terrorOfTheStars, target.id, api, { hunter: true, massive: true })
  return { spawned, location: target.id }
}

/**
 * 议程 III 背面（08520）：每位调查员（含已退场者）把忒咳哩-哩牌库顶 1 张洗入自己牌库；
 * 选择场上一个没有线索且庇护值最高的地点，每位未被击败的调查员移动到该地点并立即撤退；
 * 然后结算场景 1a 的目标（全部未被击败者撤退 → 推进场景 → 幕背面 → 结局 1）。
 */
export function resolveRunningOutOfTimeBack(state, api = {}) {
  // 「包括已退场的」：已经 defeated/resigned 的调查员也要洗入（牌库仍在）。
  for (const inv of state.investigators || []) {
    try { tekeliShuffleIn(state, inv.seat, 1) } catch { /* 未初始化时忽略 */ }
  }
  const target = highestShelterLocation(state, location => (location.clues || 0) === 0)
    || locationOf(state, START_LOCATION)
  for (const inv of activeInvestigators(state)) {
    if (target) inv.location = target.id
    inv.resigned = true
    recordCampFromResignation(state, inv, api)
  }
  api.info?.(`⏳ 没时间了背面：调查队撤往「${LOCATIONS[target?.id]?.name || target?.id || '坠机点'}」并扎营。`)
  // 「然后，结算场景 1a 上的目标」：交给引擎推进场景（actReveal 会写入结局 1）。
  if (actObjectiveMet(state).met) api.advanceAct?.()
  return { location: target?.id || null }
}

function recordCampFromResignation(state, inv, api = {}) {
  const camp = campLocationId(state)
  const locationId = inv.location || START_LOCATION
  if (camp == null && locationOf(state, locationId)) {
    setCampLocation(state, locationId)
    writeCampRecords(state, locationId)
    api.info?.(`⛺ 营地设在「${LOCATIONS[locationId]?.name || locationId}」（庇护值 ${shelterValueOf(state, locationId)}）。`)
  }
}

/** 幕 I 目标：所有未被击败的调查员撤退后推进（全灭走 noResolution，不算达成）。 */
export function actObjectiveMet(state) {
  const investigators = state.investigators || []
  const active = activeInvestigators(state)
  const resigned = investigators.filter(inv => inv.resigned).length
  if (!active.length && resigned > 0) return { met: true, reason: 'allResigned' }
  return { met: false, reason: null }
}

/** 引擎读点（act-agenda.js#checkLinearAct）：目标达成即由引擎推进场景（actReveal 写结局 1）。 */
export function checkObjectives(state, api = {}) {
  if (!actObjectiveMet(state).met) return false
  api.advanceAct?.()
  return true
}

// 幕 I：[action] 如果所有调查员都在同一地点，且该地点没有线索：撤退。
export function actions(state, inv) {
  const active = activeInvestigators(state)
  const here = locationOf(state, inv?.location)
  if (!here || active.length === 0) return []
  if (!active.every(other => other.location === here.id) || (here.clues || 0) > 0) return []
  // 星之恐怖处于重整状态时不能在其地点撤退。
  const blocked = (state.enemies || []).some(enemy => codeOf(enemy) === RAW.terrorOfTheStars
    && !enemy.exhausted && enemy.location === here.id)
  if (blocked) return []
  return [{
    action: 'scenarioAction', rule: 'campResign', actions: 1,
    label: '⛺ 寻找扎营点：所有调查员同处无线索地点，撤退',
  }]
}

export function performAction(state, inv, move, api = {}) {
  if (move?.rule !== 'campResign') return false
  const active = activeInvestigators(state)
  const here = locationOf(state, inv?.location)
  if (!here || !active.every(other => other.location === here.id) || (here.clues || 0) > 0) {
    api.info?.('无法撤退：必须所有未被击败的调查员在同一地点，且该地点没有线索。')
    return false
  }
  const blocked = (state.enemies || []).some(enemy => codeOf(enemy) === RAW.terrorOfTheStars
    && !enemy.exhausted && enemy.location === here.id)
  if (blocked) {
    api.info?.('无法撤退：星之恐怖处于重整状态，封锁了此地的撤退。')
    return false
  }
  for (const other of active) {
    other.resigned = true
    recordCampFromResignation(state, other, api)
  }
  api.info?.('⛺ 调查员们扎起营地并撤退。')
  return true
}

/** 星之恐怖处于重整状态时：不能发现其所在地点的线索。 */
export function canDiscoverClues(state, inv, location) {
  const locationId = typeof location === 'string' ? location : location?.id
  const terror = (state.enemies || []).find(enemy => codeOf(enemy) === RAW.terrorOfTheStars
    && !enemy.exhausted && enemy.location === locationId)
  return !terror
}

export function investigationError(state, inv, location) {
  if (canDiscoverClues(state, inv, location)) return undefined
  return '星之恐怖处于重整状态：不能发现它所在地点的线索。'
}

/** 敌人数值修正：星之恐怖 +3 生命值/调查员（印刷 per_investigator）。 */
export function enemyStatModifier(state, enemy, stat) {
  const code = codeOf(enemy)
  if (code === RAW.terrorOfTheStars && stat === 'health') return 3 * numInvestigators(state)
  return 0
}

/** 敌人被击败：疾行谬物 → 把忒咳哩-哩牌库顶 1 张洗入击败者牌库（不能则它攻击你）。 */
export function enemyDefeated(state, enemy, api = {}) {
  if (codeOf(enemy) !== RAW.skitteringNonsense) return false
  const seat = Number(enemy.defeatedBy ?? state.campaign?.leadSeat ?? 0)
  const shuffled = tekeliShuffleIn(state, seat, 1)
  if (!shuffled) {
    const owner = state.investigators?.[seat]
    if (owner) owner.horror = (owner.horror || 0) + 1
    api.info?.('疾行谬物：忒咳哩-哩牌库已空，它攻击了你（1 点恐惧）。')
  }
  return true
}

/** 检定失败：执行 [cultist]/[tablet] 后果。 */
export function afterTest(state, inv, result, api = {}) {
  if (!result || result.success) return []
  const failedBy = Math.max(0, Number(result.difficulty || 0) - Number(result.value || 0))
  const tokens = result.drawn || []
  const applied = []
  if (tokens.includes('cultist')) {
    const spec = part1ChaosFailureSpec(state, 'cultist', failedBy)
    if (spec) {
      const shuffled = tekeliShuffleIn(state, inv.seat, spec.count)
      const missing = spec.count - (shuffled ? Number(shuffled.length ?? spec.count) : 0)
      if (missing > 0) inv.horror = (inv.horror || 0) + missing
      applied.push({ token: 'cultist', count: spec.count, shuffled })
    }
  }
  if (tokens.includes('tablet')) {
    const spec = part1ChaosFailureSpec(state, 'tablet', failedBy)
    // 真实 runtime 的「弃牌库顶」入口是 api.discardTop(seat, n)（scenario-runtime.js）；
    // 弃到的弱点按卡面「抽取所有以此效果弃掉的弱点」回到手牌。
    if (spec && typeof api.discardTop === 'function') {
      const discarded = api.discardTop(inv.seat, spec.count) || []
      for (const code of discarded) {
        if (!['weakness', 'basicweakness'].includes(ALL_CARDS[code]?.subtype)) continue
        const index = (inv.discard || []).lastIndexOf(code)
        if (index < 0) continue
        inv.discard.splice(index, 1)
        api.putInHand?.(inv.seat, code)
      }
      applied.push({ token: 'tablet', count: spec.count, discarded })
    }
  }
  return applied
}

/** 结局：写入战报记录（营地、已揭示地点、本章结局）。 */
export function scenarioResolution(state, key = 'resolution1', events = [], api = {}) {
  const records = recordsOf(state)
  let camp = campLocationId(state) || records.camp || null
  if (!camp) {
    const lead = state.investigators?.[leadSeat(state)] || state.investigators?.[0]
    const target = highestShelterLocation(state, location => location.revealed === true)
      || locationOf(state, lead?.location || START_LOCATION)
    if (target) {
      try { setCampLocation(state, target.id); camp = target.id } catch { camp = null }
    }
  }
  if (camp) writeCampRecords(state, camp)
  const revealed = [...new Set([
    ...(revealedLocations(state) || []),
    ...((state.locations || []).filter(location => location.revealed === true).map(location => location.id)),
  ])]
  records.locationsRevealed = revealed
  records.iceAndDeathPart1Resolution = key
  const shelter = camp ? shelterValueOf(state, camp) : 0
  if (key === 'resolution1') records.iceAndDeathPart1CampShelter = shelter
  // 结算由引擎 finishScenario 驱动（本函数在 applyResolutionEffects 内执行；
  // 不能再调用 api.finish，否则会递归重入 finishScenario）。
  api.info?.(`📖 亡命冰原 I 结局：${key}；营地「${LOCATIONS[camp]?.name || camp || '无'}」庇护值 ${shelter}。`)
  return { key, camp, shelter, locationsRevealed: revealed }
}

// 引擎读点：treachery-tokens.js#resolveSpecialToken → behavior.resolveChaosToken。
export function resolveChaosToken(state, inv, token) {
  return part1ChaosTokenValue(state, token, inv)
}

/** 议程背面分派：读单卡条目 agendaRule.chapterFlow（08518/08519/08520），回退到 definition 数据。 */
// 议程背面的分发表：条目 `agendaRule.onAdvance` 给出处理函数名（声明即读点），
// 未注册条目（部分单测直接 import 章节）时退回 definition 的 `chapterFlow`。
const AGENDA_BACK_HANDLERS = Object.freeze({
  resolveColdWelcomeBack, resolveIntoTheWhiteBack, resolveRunningOutOfTimeBack,
})
const AGENDA_FLOW_HANDLERS = Object.freeze({
  coldWelcome: 'resolveColdWelcomeBack',
  intoTheWhite: 'resolveIntoTheWhiteBack',
  runningOutOfTime: 'resolveRunningOutOfTimeBack',
  [RAW.agendaColdWelcome]: 'resolveColdWelcomeBack',
  [RAW.agendaIntoTheWhite]: 'resolveIntoTheWhiteBack',
  [RAW.agendaRunningOutOfTime]: 'resolveRunningOutOfTimeBack',
})

export function resolveAgendaBack(state, agenda, api = {}) {
  const code = codeOf(agenda) || String(agenda || '')
  const stage = (state.agendas || [])[state.agendaIndex] || (state.scenario?.agendas || [])[state.agendaIndex]
  const rule = agendaRuleFor(code)
  const handlerName = rule?.onAdvance
    || AGENDA_FLOW_HANDLERS[rule?.chapterFlow || stage?.chapterFlow || code]
  const handler = handlerName && AGENDA_BACK_HANDLERS[handlerName]
  return handler ? handler(state, api) : null
}

/** 引擎读点：phases.js#runAgendaReveal → behavior.agendaReveal(state, agenda, runtime, type)。 */
export function agendaReveal(state, agenda, api = {}) {
  return resolveAgendaBack(state, agenda, api) != null
}

/** 引擎读点：reveal.js#runActReveal → behavior.actReveal(state, act, runtime, type)。幕 08521 背面 (→结局 1)。 */
export function actReveal(state, act, api = {}) {
  const code = codeOf(act) || String(act || '')
  const stage = (state.acts || [])[state.actIndex] || (state.scenario?.acts || [])[state.actIndex]
  const flow = actRuleFor(code)?.chapterFlow || stage?.chapterFlow
  if (code === RAW.actSearchForACampSite || flow === 'searchForACampSite') {
    api.finish?.('resolution1')
    return true
  }
  return false
}

export const behavior = {
  id: CHAPTER_ID,
  preScenarioSetup() {},
  setupScenario,
  // 引擎真实路径：preScenarioSetup 后调用 setupLocations(state, events, helper)。
  // 本章 setupScenario 自行建立 state.locations/幕/议程/遭遇牌库/忒咳哩-哩，引擎不再重复放置。
  setupLocations(state, events, helper = {}) {
    setupScenario(state, { info: text => helper.info?.(state, events, text) })
    return []
  },
  setupEnemies() {},
  locationEntered,
  beforeMove,
  moveError,
  placeConnectedSetAsideLocations,
  actObjectiveMet,
  checkObjectives,
  // 引擎读点：moves.js#legalMoves / dispatch.js#executeAction → behavior.actions / performAction。
  actions,
  performAction,
  agendaReveal,
  actReveal,
  resolveAgendaBack,
  resolveColdWelcomeBack,
  resolveIntoTheWhiteBack,
  resolveRunningOutOfTimeBack,
  resolution: scenarioResolution,
  scenarioResolution,
  canDiscoverClues,
  investigationError,
  enemyStatModifier,
  enemyDefeated,
  afterTest,
  resolveChaosToken,
}

export const implementedEntryCodes = Object.freeze(['08518', '08519', '08520', '08521', '08522'])

