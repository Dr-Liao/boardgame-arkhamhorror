// 梦境之门（06015a/b）：卢克的绑定地点。
//
// 06015a 与每个已揭示地点相连，除卢克外不能进入。06015b 同样禁止他人进入。
// 调查阶段结束时放在一边；卢克若在这里，移到一个已揭示地点（b 面再受 2 点恐惧）。
import { cardDef } from './card-lookup.js'

export function dreamGates(state) {
  return (state?.locations || []).filter(location => location?.dreamGate)
}

export function dreamGateInPlay(state, code = null) {
  return dreamGates(state).find(location => !code || location.code === code || location.originalCode === code) || null
}

function rememberLinks(gate, other) {
  gate.connections ||= []
  other.connections ||= []
  if (!gate.connections.includes(other.id)) gate.connections.push(other.id)
  if (!other.connections.includes(gate.id)) other.connections.push(gate.id)
  gate.dreamLinks ||= []
  if (!gate.dreamLinks.includes(other.id)) gate.dreamLinks.push(other.id)
}

function stripLinks(state, gate) {
  for (const id of gate.dreamLinks || []) {
    const other = state.locations.find(location => location.id === id)
    if (other?.connections) other.connections = other.connections.filter(item => item !== gate.id)
  }
  gate.connections = []
  gate.dreamLinks = []
}

function makeGate(state, code) {
  const card = cardDef(code) || {}
  state.instanceSeq ||= {}
  const seq = (state.instanceSeq.location || 0) + 1
  state.instanceSeq.location = seq
  const gate = {
    id: `dream-gate-${seq}`,
    code,
    originalCode: code,
    name: card.nameZh || card.name || '梦境之门',
    shroud: card.shroud ?? 1,
    clues: 0,
    revealed: true,
    connections: [],
    dreamGate: true,
  }
  state.locations ||= []
  state.locations.push(gate)
  return gate
}

/** 放置指定一面。已有梦境之门时先撤下旧的，并把站在上面的人挪到新地点。 */
export function placeDreamGate(state, code, { connectToRevealed = false, asideHorror = 0, ownerCode = null, ownerSeat = null, flipAfterInvestigate = null } = {}) {
  const existing = dreamGateInPlay(state, code)
  if (existing) return existing
  const previous = dreamGates(state)
  const occupants = (state.investigators || []).filter(inv => previous.some(gate => gate.id === inv.location))
  for (const gate of previous) stripLinks(state, gate)
  if (previous.length) state.locations = state.locations.filter(location => !previous.includes(location))
  const gate = makeGate(state, code)
  gate.asideHorror = asideHorror
  gate.dreamGateOwner = ownerCode
  // 持有者按座位记：天机之城换身后所有调查员卡号都是 04244，只比卡号会让其他伊斯人也能进门。
  gate.dreamGateOwnerSeat = Number.isInteger(ownerSeat) ? ownerSeat : null
  gate.flipAfterInvestigate = flipAfterInvestigate
  if (connectToRevealed) {
    for (const other of state.locations) {
      if (other === gate || other.dreamGate || other.revealed === false) continue
      rememberLinks(gate, other)
    }
  }
  for (const inv of occupants) inv.location = gate.id
  return gate
}

/** 指定的一面在场则换成另一面，否则放置目标面。 */
export function flipOrPlaceDreamGate(state, options) {
  if (dreamGateInPlay(state, options.from)) {
    return placeDreamGate(state, options.to, options)
  }
  return dreamGateInPlay(state, options.to) || placeDreamGate(state, options.to, options)
}

export function dreamGateEntryError(inv, location) {
  if (!location?.dreamGate) return null
  // 新放置的门记座位（换身后卡号会重名）；旧存档只有卡号时退回卡号比较。
  if (Number.isInteger(location.dreamGateOwnerSeat)) {
    return inv?.seat === location.dreamGateOwnerSeat ? null : '除该调查员外不能进入梦境之门'
  }
  if (!location.dreamGateOwner) return null
  return inv?.code === location.dreamGateOwner ? null : '除该调查员外不能进入梦境之门'
}

/** 调查员当前是否位于梦境之门（梦境之门是卢克的绑定地点）。 */
export function atDreamGate(state, inv) {
  if (!inv?.location) return false
  return dreamGates(state).some(gate => gate.id === inv.location)
}

/**
 * 清退梦境之门上的敌人（旧存档/非法状态修复）。
 *
 * 卡面：「敌人和除卢克·罗宾逊以外的调查员不能进入梦境之门。」FAQ v2.1（2023-08）：
 * 敌人不能在梦境之门生成；若有敌人会在卢克位于梦境之门时生成在他的地点，改为**弃掉该敌人**。
 * 修复按同一口径：从场上移出、解除交战、把遭遇卡放进遭遇弃牌堆，返回被清退的卡号。
 */
export function discardDreamGateIntruders(state) {
  const gates = new Set(dreamGates(state).map(gate => gate.id))
  if (!gates.size || !(state.enemies || []).some(enemy => gates.has(enemy.location))) return []
  const removed = []
  for (const enemy of [...state.enemies]) {
    if (!gates.has(enemy.location)) continue
    const engaged = state.investigators?.[enemy.engagedSeat]
    if (engaged?.engaged) engaged.engaged = engaged.engaged.filter(id => id !== enemy.id)
    state.enemies = state.enemies.filter(item => item !== enemy)
    const code = enemy.originalCode || enemy.code
    state.encounterDiscard ||= []
    state.encounterDiscard.push(code)
    removed.push(code)
  }
  return removed
}

/**
 * 调查阶段结束：把门放在一边。卢克在门上时移到一个已揭示地点。
 * `choose(inv, ids)` 在有多个目的地时返回其中一个 id。
 */
export function setDreamGatesAside(state, { choose, applyHorror, info } = {}) {
  const gates = dreamGates(state)
  if (!gates.length) return []
  const removed = []
  for (const gate of gates) {
    const ownsGate = inv => Number.isInteger(gate.dreamGateOwnerSeat)
      ? inv.seat === gate.dreamGateOwnerSeat
      : !!(gate.dreamGateOwner && inv.code === gate.dreamGateOwner)
    const luke = (state.investigators || []).find(inv => ownsGate(inv) && inv.location === gate.id && !inv.defeated)
    stripLinks(state, gate)
    state.locations = state.locations.filter(location => location !== gate)
    removed.push(gate.id)
    if (luke) {
      const options = (state.locations || []).filter(location => location.revealed !== false && !location.dreamGate).map(location => location.id)
      const destination = options.length <= 1 ? (options[0] || null) : choose?.(luke, options)
      if (destination) luke.location = destination
      if (gate.asideHorror) applyHorror?.(state, luke, gate.asideHorror)
    }
    info?.(`梦境之门被放在一边。`)
  }
  return removed
}
