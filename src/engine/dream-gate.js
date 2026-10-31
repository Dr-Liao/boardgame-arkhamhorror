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
export function placeDreamGate(state, code, { connectToRevealed = false, asideHorror = 0, ownerCode = null, flipAfterInvestigate = null } = {}) {
  const existing = dreamGateInPlay(state, code)
  if (existing) return existing
  const previous = dreamGates(state)
  const occupants = (state.investigators || []).filter(inv => previous.some(gate => gate.id === inv.location))
  for (const gate of previous) stripLinks(state, gate)
  if (previous.length) state.locations = state.locations.filter(location => !previous.includes(location))
  const gate = makeGate(state, code)
  gate.asideHorror = asideHorror
  gate.dreamGateOwner = ownerCode
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
  if (!location?.dreamGate || !location.dreamGateOwner) return null
  return inv?.code === location.dreamGateOwner ? null : '除该调查员外不能进入梦境之门'
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
    const luke = (state.investigators || []).find(inv => gate.dreamGateOwner && inv.code === gate.dreamGateOwner && inv.location === gate.id && !inv.defeated)
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
