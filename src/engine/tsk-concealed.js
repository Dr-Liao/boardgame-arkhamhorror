// 八循环《绯红密钥》P2 原语：阴影区域（In the Shadows）与隐匿迷你卡（Concealed X）。
//
// 覆盖 P1 原语目录：
//   · new.concealedEntity            —— 隐匿迷你卡/诱饵虚拟实体（无卡表卡号，按 kind 标识）
//   · new.concealedDistribution      —— 进入阴影时拿取 X×调查员张迷你卡/诱饵、正面朝下混洗分配
//   · new.concealedExpose            —— 揭露（Expose）：翻面并取出；真身返回给调用方入场
//   · new.concealedExposeRange       —— 攻防目标范围裁决（见 clampScope 说明）
//   · new.shadowPositions            —— 地点进入阴影 + 左/中/右三位置阴影区域
//   · new.concealedRoundEnd          —— 轮末重新混洗隐匿迷你卡位置
//   · new.windowExposed              —— 揭露后的 exposed 时机窗口
//   · new.concealedIdentityProjection—— 未揭露迷你卡只投影「有卡/数量」，不泄露真身
//
// 状态存放：`state.scenarioFlags.mechanics.tsk.concealed`（存在才校验，读点不初始化）：
//   { version: 1, nextId: 1, miniCards: [{ id, kind, decoy, locationId, position, flipped, known }],
//     shadows: { [locationId]: true } }
// 约定：
//   · position 为 'left' | 'middle' | 'right' | null；null 表示直接在该地点（不进入阴影位置）。
//   · decoy=true 是诱饵；kind 仍是字符串（内容层用真实敌人标记）。
//   · 迷你卡不是卡表卡号：不与 state.enemies/state.locations 混用，出场由内容层解析后完成。
//   · 轮末混洗只在「同一批迷你卡」之间重排 location/position，不增删（fail closed）。
import { randomValue } from './rules-state.js'
import { registeredEntry } from './ability.js'
import { registerWindow } from './windows.js'
import { locationAt } from './mechanic-state.js'
import { assertTskFields, assertTskObject, tskScenarioState } from './tsk-state.js'

export const CONCEALED_STATE_VERSION = 1
export const SHADOW_POSITIONS = Object.freeze(['left', 'middle', 'right'])
// 揭露（Expose）时机窗口：真身入场/诱饵进弃牌堆之后，卡牌与剧本可以响应。
export const EXPOSED_WINDOW = 'tskExposed'
registerWindow(EXPOSED_WINDOW, { label: '揭露隐匿迷你卡后', kind: 'reaction', order: 410 })

const KIND_PATTERN = /^[A-Za-z][A-Za-z0-9]{0,63}$/

// 迷你卡附加字段 `code`（2026-11-13 P1-4 跨条目标识契约）：印刷卡号（敌人/地点），
// 由内容层在生成时给出；引擎只存/读，不解释。跨章条目按 code 判身份，不再依赖各章自造的 kind 名。
const CARD_CODE_PATTERN = /^\d{5}[a-z]?$/
// 2026-11-13 P1-15：`knownBy` 按座位记录「谁合法看过这一面」。
// `known` 仍是公开可见的旧口径（内容层可整体公开），`knownBy` 只影响对应座位的投影。
function normalizeKnownBy(value) {
  if (value == null) return []
  if (!Array.isArray(value) || value.some(seat => !Number.isSafeInteger(seat) || seat < 0)) {
    throw new TypeError('迷你卡 knownBy 必须是座位号数组')
  }
  return [...new Set(value)]
}

function normalizeMiniCode(code) {
  if (code == null) return null
  if (typeof code !== 'string' || !CARD_CODE_PATTERN.test(code)) throw new TypeError('迷你卡 code 必须是印刷卡号或 null')
  return code
}

function stateOf(state, create = false) {
  const data = tskScenarioState(state, create)
  if (!data) return null
  return data.concealed ||= create ? { version: CONCEALED_STATE_VERSION, nextId: 1, miniCards: [], shadows: {} } : null
}

/** 只读视图：全部迷你卡（含已翻面的）；不初始化容器。 */
export function concealedMiniCards(state) {
  return [...(stateOf(state)?.miniCards || [])]
}

/** 某地点（可选位置）上的迷你卡；不初始化容器。 */
export function concealedAt(state, locationId, position = undefined) {
  locationAt(state, locationId)
  return (stateOf(state)?.miniCards || []).filter(card =>
    card.locationId === locationId && (position === undefined || card.position === position))
}

/** 按 id 读取迷你卡；不存在返回 null。 */
export function concealedById(state, id) {
  return (stateOf(state)?.miniCards || []).find(card => card.id === id) || null
}

/** 该地点是否处于阴影（In the Shadows）；不初始化容器。 */
export function isInShadows(state, locationId) {
  locationAt(state, locationId)
  return Boolean(stateOf(state)?.shadows?.[locationId])
}

/** 地点进入/离开阴影（三位置阴影区域归属；位置本身由 placeMiniCard 的 position 表达）。 */
export function setInShadows(state, locationId, inShadows = true) {
  locationAt(state, locationId)
  const container = stateOf(state, true)
  if (inShadows) container.shadows[locationId] = true
  else delete container.shadows[locationId]
  return inShadows
}

/**
 * 直接放置一张迷你卡（供 setup 用；分配混洗用 distributeConcealed）。
 * spec: { kind, decoy?, locationId, position? }；返回创建的迷你卡（副本）。
 * 负数/重复 id/非法地点/非法位置全部拒绝且不写入。
 */
export function placeMiniCard(state, spec) {
  assertTskObject(spec, '迷你卡')
  assertTskFields(spec, ['kind', 'decoy', 'locationId', 'position', 'known', 'knownBy', 'code'], '迷你卡')
  if (typeof spec.kind !== 'string' || !KIND_PATTERN.test(spec.kind)) throw new TypeError('迷你卡 kind 非法')
  const locationId = spec.locationId
  locationAt(state, locationId)
  const position = spec.position ?? null
  if (position !== null && !SHADOW_POSITIONS.includes(position)) throw new TypeError('迷你卡位置必须是 left/middle/right')
  if (spec.decoy != null && typeof spec.decoy !== 'boolean') throw new TypeError('迷你卡 decoy 必须是布尔值')
  const container = stateOf(state, true)
  const card = {
    id: `tskconcealed${container.nextId++}`,
    kind: spec.kind,
    code: normalizeMiniCode(spec.code),
    decoy: spec.decoy === true,
    locationId,
    position,
    flipped: false,
    known: spec.known === true,
    knownBy: normalizeKnownBy(spec.knownBy),
  }
  container.miniCards.push(card)
  return { ...card }
}

/**
 * 分配混洗（Concealed X 入场）：给定待放置的迷你卡（含诱饵）与各地点数量，
 * 正面朝下洗牌后按顺序分配；顺序由 `state.rngState` 决定（可重放），也可注入 shuffle 回调。
 *   spec: { cards: [{kind, decoy?}], placements: [{locationId, count}], position?, shuffle? }
 * 校验：卡数必须等于 placements 数量之和；任何非法值在写入前抛错（不产生部分分配）。
 * 返回按分配顺序的迷你卡副本数组（调用方/测试用；观察者只看张数）。
 */
export function distributeConcealed(state, spec) {
  assertTskObject(spec, '阴阳分配')
  assertTskFields(spec, ['cards', 'placements', 'position', 'shuffle'], '阴阳分配')
  if (!Array.isArray(spec.cards) || !spec.cards.length) throw new TypeError('分配需要至少一张迷你卡')
  if (!Array.isArray(spec.placements) || !spec.placements.length) throw new TypeError('分配需要放置地点')
  const position = spec.position ?? null
  if (position !== null && !SHADOW_POSITIONS.includes(position)) throw new TypeError('迷你卡位置必须是 left/middle/right')
  const placements = spec.placements.map(entry => {
    assertTskFields(entry, ['locationId', 'count'], '分配地点')
    locationAt(state, entry.locationId)
    if (!Number.isSafeInteger(entry.count) || entry.count < 1) throw new TypeError('分配数量必须是正整数')
    return { locationId: entry.locationId, count: entry.count }
  })
  const total = placements.reduce((sum, entry) => sum + entry.count, 0)
  if (total !== spec.cards.length) throw new TypeError(`分配数量 ${total} 与迷你卡数 ${spec.cards.length} 不一致`)
  const ordered = spec.cards.map((card, index) => {
    assertTskObject(card, '迷你卡定义')
    assertTskFields(card, ['kind', 'decoy', 'code', 'knownBy'], '迷你卡定义')
    if (typeof card.kind !== 'string' || !KIND_PATTERN.test(card.kind)) throw new TypeError(`迷你卡 #${index} kind 非法`)
    if (card.decoy != null && typeof card.decoy !== 'boolean') throw new TypeError(`迷你卡 #${index} decoy 必须是布尔值`)
    return { kind: card.kind, code: normalizeMiniCode(card.code), decoy: card.decoy === true, knownBy: normalizeKnownBy(card.knownBy) }
  })
  if (spec.shuffle != null && typeof spec.shuffle !== 'function') throw new TypeError('shuffle 必须是函数')
  const shuffled = (spec.shuffle || (cards => fisherYates(state, cards)))(ordered.map(card => ({ ...card })))
  validateShuffle(ordered, shuffled)
  const container = stateOf(state, true)
  const created = []
  let cursor = 0
  for (const placement of placements) {
    for (let index = 0; index < placement.count; index += 1) {
      const card = shuffled[cursor++]
      const mini = {
        id: `tskconcealed${container.nextId++}`,
        kind: card.kind,
        code: card.code,
        decoy: card.decoy === true,
        locationId: placement.locationId,
        position,
        flipped: false,
        known: false,
        knownBy: card.knownBy,
      }
      container.miniCards.push(mini)
      created.push({ ...mini })
    }
  }
  return created
}

function fisherYates(state, cards) {
  const list = [...cards]
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(randomValue(state) * (i + 1))
    ;[list[i], list[j]] = [list[j], list[i]]
  }
  return list
}

function validateShuffle(original, shuffled) {
  if (!Array.isArray(shuffled) || shuffled.length !== original.length) throw new TypeError('shuffle 回调必须返回同一数量的迷你卡')
  const key = card => `${card.kind}:${card.code ?? '-'}:${card.decoy ? 1 : 0}`
  const left = original.map(key).sort().join('|')
  const right = shuffled.map(card => {
    assertTskObject(card, 'shuffle 结果')
    return key(card)
  }).sort().join('|')
  if (left !== right) throw new TypeError('shuffle 回调不得增删或改写迷你卡')
}

/**
 * 揭露（Expose）：把迷你卡翻面并取出，返回受信任结果 `{ id, kind, decoy }`。
 * 真身是否入场、诱饵进哪个弃牌堆由内容层按返回值决定（引擎不认卡号）。
 * 已翻面/不存在/未知 id 一律拒绝，不产生写入。
 */
export function exposeMiniCard(state, id) {
  const container = stateOf(state, true)
  const index = container.miniCards.findIndex(card => card.id === id)
  if (index < 0) throw new RangeError(`未知隐匿迷你卡 ${JSON.stringify(id)}`)
  const card = container.miniCards[index]
  if (card.flipped) throw new Error('该隐匿迷你卡已翻面')
  container.miniCards.splice(index, 1)
  // locationId/position 一并返回：内容层用它组成 tskExposed 窗口上下文（是否入场由内容层决定）。
  return { id: card.id, kind: card.kind, code: card.code ?? null, decoy: card.decoy, locationId: card.locationId, position: card.position }
}

/** 已经翻面的迷你卡（记录保留在容器外的场景不适用；本原语揭露即取出，因此恒为空）。 */
// 2026-11-13 P1-16（09740 阴霾日食）：场上/密谋旁声明
// `treacheryRule.exposeLimitPerInvestigatorPerRound` 的卡，限制每位调查员每轮揭露数。
// 账本写在 concealed 容器的 `exposeRound: { round, bySeat }`（随存档持久化，按轮清零）。
export function exposeLimitPerInvestigator(state) {
  let limit = 0
  for (const card of state.agendaAside || []) {
    const declared = registeredEntry(card?.originalCode || card?.code || card)
      ?.treacheryRule?.exposeLimitPerInvestigatorPerRound
    if (Number.isSafeInteger(declared) && declared > 0) {
      limit = limit ? Math.min(limit, declared) : declared
    }
  }
  return limit
}

function exposeLedger(state, create = false) {
  const container = stateOf(state, create)
  if (!container) return null
  const round = Number(state.round) || 0
  if (!container.exposeRound || container.exposeRound.round !== round) {
    if (!create) return { round, bySeat: {} }
    container.exposeRound = { round, bySeat: {} }
  }
  return container.exposeRound
}

export function exposuresThisRound(state, seat) {
  if (!Number.isSafeInteger(seat)) return 0
  return Number(exposeLedger(state)?.bySeat?.[seat]) || 0
}

export function recordExposure(state, seat) {
  if (!Number.isSafeInteger(seat)) return
  const ledger = exposeLedger(state, true)
  ledger.bySeat[seat] = (Number(ledger.bySeat[seat]) || 0) + 1
}

/** 已经翻面的迷你卡（记录保留在容器外的场景不适用；本原语揭露即取出，因此恒为空）。 */
export function flippedMiniCards(state) {
  return (stateOf(state)?.miniCards || []).filter(card => card.flipped)
}

/**
 * 攻防目标范围裁决（P1 标记 blocked 的 new.concealedExposeRange 在 P2 的裁决）：
 * 参考实现把阴影位置上的迷你卡放在相邻地点视为可攻防目标（Concealed.hs 的 adjacentPositions 限制），
 * 不进入阴影位置的迷你卡必须同地点；揭露（Expose）本身只能同地点。
 * 本函数返回给定迷你卡允许的攻防观测地点集合，供 content 的目标选择/合法动作使用。
 */
export function concealTargetScope(state, miniCardId) {
  const card = concealedById(state, miniCardId)
  if (!card) throw new RangeError(`未知隐匿迷你卡 ${JSON.stringify(miniCardId)}`)
  const location = locationAt(state, card.locationId)
  if (card.position === null) return { expose: [location.id], fightOrEvade: [location.id], adjacentOnly: false }
  return { expose: [location.id], fightOrEvade: [location.id, ...(location.connections || [])], adjacentOnly: true }
}

/**
 * 轮末重新混洗：把全部迷你卡打乱后重新分配到「当前占用的地点/位置」上（不增删、不跨出当前地点集合）。
 * `shuffle` 可注入确定性回调；任何非法结果在写入前抛错。
 * 返回重排后的迷你卡副本数组（含 location 归属）。
 */
export function reshuffleConcealed(state, { shuffle } = {}) {
  if (shuffle != null && typeof shuffle !== 'function') throw new TypeError('shuffle 必须是函数')
  const container = stateOf(state)
  if (!container || container.miniCards.length < 2) return concealedMiniCards(state)
  const slots = container.miniCards.map(card => ({ locationId: card.locationId, position: card.position }))
  const mixed = (shuffle || (cards => fisherYates(state, cards)))(container.miniCards.map(card => ({ ...card })))
  validateShuffle(container.miniCards, mixed)
  mixed.forEach((card, index) => {
    const slot = slots[index]
    container.miniCards[index] = { ...container.miniCards[index], locationId: slot.locationId, position: slot.position }
  })
  return concealedMiniCards(state)
}

/**
 * 观察投影：未翻面且未被合法获知的迷你卡只暴露「数量/位置」，不泄露 kind 与 decoy。
 * flipped/known 的卡才给出 kind/decoy（由内容层标明哪些座位合法获知）。
 */
export function concealedProjection(state, { revealAll = false, observerSeat = null } = {}) {
  return concealedMiniCards(state).map(card => {
    const visible = revealAll || card.flipped || card.known
      || (Number.isSafeInteger(observerSeat) && (card.knownBy || []).includes(observerSeat))
    return {
      locationId: card.locationId,
      position: card.position,
      visible,
      ...(visible ? { id: card.id, kind: card.kind, code: card.code ?? null, decoy: card.decoy } : {}),
    }
  })
}

/**
 * 标记某些座位「合法看过」这张迷你卡（09889/09545 的「查看已揭示面（不揭露）」等）。
 * 只改观察投影可见性；不改变 flipped/decoy 等身份字段。返回更新后的副本。
 */
export function markMiniKnownFor(state, id, seats) {
  const container = stateOf(state, true)
  const card = container.miniCards.find(item => item.id === id)
  if (!card) throw new RangeError(`未知隐匿迷你卡 ${JSON.stringify(id)}`)
  const merged = normalizeKnownBy([...(card.knownBy || []), ...(Array.isArray(seats) ? seats : [seats])])
  card.knownBy = merged
  return { ...card }
}

/** 读档校验：concealed 容器的形状（存在才校验；地点必须已入场）。 */
export function validateTskConcealed(state, value = stateOf(state)) {
  if (value == null) return true
  assertTskFields(value, ['version', 'nextId', 'miniCards', 'shadows', 'exposeRound'], '隐匿迷你卡状态')
  if (value.version !== CONCEALED_STATE_VERSION) throw new TypeError(`不支持的隐匿迷你卡版本 ${value.version}`)
  if (!Number.isSafeInteger(value.nextId) || value.nextId < 1) throw new TypeError('隐匿迷你卡序号无效')
  if (!Array.isArray(value.miniCards)) throw new TypeError('隐匿迷你卡列表无效')
  const ids = new Set()
  for (const card of value.miniCards) {
    assertTskFields(card, ['id', 'kind', 'code', 'decoy', 'locationId', 'position', 'flipped', 'known', 'knownBy'], '隐匿迷你卡记录')
    if (typeof card.id !== 'string' || !card.id || ids.has(card.id)) throw new TypeError('隐匿迷你卡 id 重复或无效')
    ids.add(card.id)
    if (typeof card.kind !== 'string' || !KIND_PATTERN.test(card.kind)) throw new TypeError('隐匿迷你卡 kind 无效')
    normalizeMiniCode(card.code ?? null)
    if (typeof card.decoy !== 'boolean' || typeof card.flipped !== 'boolean' || typeof card.known !== 'boolean') throw new TypeError('隐匿迷你卡标记无效')
    normalizeKnownBy(card.knownBy ?? null)
    locationAt(state, card.locationId)
    if (card.position !== null && !SHADOW_POSITIONS.includes(card.position)) throw new TypeError('隐匿迷你卡位置无效')
  }
  assertTskObject(value.shadows, '阴影地点表')
  for (const locationId of Object.keys(value.shadows)) locationAt(state, locationId)
  return true
}
