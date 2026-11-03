// Allowlisted public summaries. Never send scenarioFlags.mechanics or future story/road decks.
import { mechanicState } from '../engine/mechanic-state.js'
import { isPublicBeneath } from '../engine/commit-origins.js'
import { effectiveFloodLevel } from '../engine/flood.js'
import { vehicleAccessError, vehicleName } from '../engine/vehicles.js'
export function mechanicView(state, observer = null) {
  const data = mechanicState(state)
  if (!data && !state.skillTest?.tokenResults?.length) return null
  const revealed = state.skillTest && (state.skillTest.helpRequested || state.skillTest.seat === observer)
    ? (state.chaos?.revealed || []).flatMap((face, index) => {
      if (index < (state.chaos?.frames?.at(-1) || 0)) return []
      const result = state.skillTest.tokenResults?.find(item => item.index === index)
      return [{ index, face, as: state.skillTest.tokenTreatments?.[index]?.as, modifier: result?.modifier ?? (/^[+-]?\d+$/.test(face) ? Number(face) : undefined),
        cancelled: !!state.skillTest.tokenTreatments?.[index]?.cancel }]
    }) : []
  const view = {}
  if (data?.barriers?.length) view.barriers = data.barriers.map(({ a, b, count }) => ({ a, b, count }))
  if (data?.scenarioDecks) view.scenarioDecks = Object.fromEntries(Object.entries(data.scenarioDecks).map(([id, pile]) => [id, { count: pile.deck.length }]))
  if (data?.flood || data?.air) {
    view.water = {
      locations: (state.locations || []).filter(loc => loc.revealed).map(loc => ({ id: loc.id, level: data.flood?.[loc.id] || 0 })),
      investigators: (state.investigators || []).map(inv => ({ seat: inv.seat, level: state.locations.some(loc => loc.id === inv.location) ? effectiveFloodLevel(state, inv.seat) : 0,
        airRequired: !!data.air?.[inv.seat], damage: data.air?.[inv.seat]?.damage || 0 })),
    }
  }
  if (data?.keys) {
    const publicHolders = new Set([
      'reference', ...(state.locations || []).filter(loc => loc.revealed).map(loc => `location:${loc.id}`),
      ...(state.investigators || []).map(inv => `investigator:${inv.seat}`),
      ...(state.enemies || []).map(enemy => `enemy:${enemy.id}`),
      ...(state.storyAssets || []).map(asset => `asset:${asset.id}`),
      ...(state.investigators || []).flatMap(inv => (inv.assets || []).map(asset => `asset:${asset.id}`)),
    ])
    view.keys = Object.entries(data.keys).filter(([, key]) => publicHolders.has(key.holder))
      .map(([color, key]) => ({ holder: key.holder, color: key.revealed ? color : 'unrevealed' }))
  }
  if (data?.vehicles) view.vehicles = Object.entries(data.vehicles).map(([id, vehicle]) => ({
    id, name: vehicleName(state, id), location: vehicle.location, capacity: vehicle.capacity, running: vehicle.running,
    driver: vehicle.driver, passengers: [...vehicle.passengers], protectsFromFlood: vehicle.protectsFromFlood,
    ...(Number.isInteger(observer) && state.investigators[observer] ? {
      enterReason: vehicleAccessError(state, observer, id), leaveReason: vehicleAccessError(state, observer, id, false),
    } : {}),
  }))
  if (data?.beneath) view.beneath = Object.entries(data.beneath).flatMap(([seat, hosts]) => Object.entries(hosts)
    .map(([host, cards]) => ({ seat: Number(seat), host, count: cards.length,
      ...(isPublicBeneath(state, Number(seat), host) ? { public: true } : {}),
      ...(Number(seat) === observer || isPublicBeneath(state, Number(seat), host) ? { codes: [...cards] } : {}) })))
  if (revealed?.length) view.tokens = revealed.map(({ index, face, as, modifier, cancelled }) => ({ index, face, as, modifier, cancelled: !!cancelled }))
  return Object.keys(view).length ? view : null
}

// Animation snapshots may contain all owners' beneath cards, just like hands. Mask them again per recipient.
export function maskMechanicSnapshot(model, observer) {
  if (!model) return model
  const copy = structuredClone(model)
  for (const item of copy.beneath || []) if (item.seat !== observer && !item.public) delete item.codes
  if (copy.tokenSeat != null && copy.tokenSeat !== observer) delete copy.tokens
  delete copy.tokenSeat
  return copy
}

export function mechanicSnapshot(state) {
  const model = mechanicView(state, state.skillTest?.seat)
  if (!model) return null
  for (const item of model.beneath || []) item.codes = [...(mechanicState(state)?.beneath?.[item.seat]?.[item.host] || [])]
  if (model.tokens && !state.skillTest?.helpRequested) model.tokenSeat = state.skillTest.seat
  return model
}
