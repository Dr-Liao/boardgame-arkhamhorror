import { assertFields, integer } from './mechanic-state.js'

export function normalizePrintedLocationFace(face) {
  assertFields(face, ['code', 'name', 'nameEn', 'shroud', 'traits'])
  if (typeof face.code !== 'string' || !face.code || typeof face.name !== 'string' || !face.name
    || face.nameEn != null && typeof face.nameEn !== 'string' || !Array.isArray(face.traits)
    || face.traits.some(trait => typeof trait !== 'string' || !trait)) throw new TypeError('无效印刷地点面')
  integer(face.shroud)
  return structuredClone(face)
}

export function replacePrintedLocationFace(location, face) {
  const next = normalizePrintedLocationFace(face)
  if ((location.originalCode || location.code) === next.code) return false
  Object.assign(location, next, { originalCode: next.code, artCode: next.code })
  if (next.nameEn == null) delete location.nameEn
  return true
}

// Sinkholes are damage counters on the location, not on its occupants. Encounter
// attachments stay, while player attachments use the ordinary discard pipeline.
export function sinkLocation(state, id, face, { threshold = 3, discardPlayer } = {}) {
  const next = normalizePrintedLocationFace(face)
  integer(threshold, 1)
  const location = state.locations.find(location => location.id === id)
  if (!location || (location.damage || 0) < threshold || (location.originalCode || location.code) === next.code) return false
  const global = (state.playerLocationAttachments || []).filter(card => card.location === id)
  const local = (location.attachments || []).filter(card => card.ownerSeat != null && !card.encounterAttached)
  const discarded = [...global, ...local]
  if (discarded.length && (typeof discardPlayer !== 'function' || discarded.some(card => !state.investigators[card.ownerSeat]))) {
    throw new TypeError('地点玩家附属需要有效弃牌管线与座位')
  }
  replacePrintedLocationFace(location, next)
  location.damage = 0
  if (global.length) state.playerLocationAttachments = state.playerLocationAttachments.filter(card => !global.includes(card))
  if (local.length) location.attachments = location.attachments.filter(card => !local.includes(card))
  for (const card of new Set(discarded)) discardPlayer(card.ownerSeat, card.code)
  return true
}
