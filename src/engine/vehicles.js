import { assertFields, integer, investigatorAt, locationAt, mechanicState } from './mechanic-state.js'
import { checkAirAfterMove } from './flood.js'
import { cardName } from './card-lookup.js'
export function vehicleName(state, id) {
  const asset = [...(state.storyAssets || []), ...(state.investigators || []).flatMap(inv => inv.assets || [])].find(item => item.id === id)
  return asset?.name || (asset?.code ? cardName(asset.code) : null) || id
}
export function registerVehicle(state, id, spec) {
  assertFields(spec, ['location', 'capacity', 'running', 'protectsFromFlood', 'driverRequired'])
  if (typeof id !== 'string' || !id) throw new TypeError('载具需要实例 id')
  locationAt(state, spec.location); integer(spec.capacity, 1)
  for (const key of ['running', 'protectsFromFlood', 'driverRequired']) if (spec[key] != null && typeof spec[key] !== 'boolean') throw new TypeError(`无效载具 ${key}`)
  const data = mechanicState(state, true); data.vehicles ||= {}
  if (data.vehicles[id]) throw new Error('载具实例重复')
  data.vehicles[id] = { location: spec.location, capacity: spec.capacity, running: spec.running === true,
    protectsFromFlood: spec.protectsFromFlood === true, driver: null, passengers: [],
    ...(spec.driverRequired != null ? { driverRequired: spec.driverRequired } : {}) }
  return id
}
export function vehicleOf(state, seat) { return Object.entries(mechanicState(state)?.vehicles || {}).find(([, v]) => v.passengers.includes(seat))?.[0] || null }
export function vehicleAccessError(state, seat, id, entering = true) {
  const inv = investigatorAt(state, seat), data = mechanicState(state), vehicle = data?.vehicles?.[id]
  if (!vehicle || inv.defeated || inv.resigned || inv.location !== vehicle.location) return '无法在此进入或离开载具'
  if (data.vehicleAccess?.[seat] === state.round) return '本轮已经进入或离开过载具'
  if (entering && (vehicleOf(state, seat) || vehicle.passengers.length >= vehicle.capacity)) return '载具已满或调查员已在载具中'
  if (!entering && !vehicle.passengers.includes(seat)) return '调查员不在该载具中'
  return null
}
export function enterVehicle(state, seat, id, { setup = false } = {}) {
  if (vehicleAccessError(state, seat, id)) return false
  const data = mechanicState(state), vehicle = data.vehicles[id]
  vehicle.passengers.push(seat)
  if (vehicle.driverRequired !== false) vehicle.driver ??= seat
  if (!setup) { data.vehicleAccess ||= {}; data.vehicleAccess[seat] = state.round }
  checkAirAfterMove(state, seat)
  return true
}
export function setVehicleDriver(state, id, seat) {
  const vehicle = mechanicState(state)?.vehicles?.[id]
  if (!vehicle || vehicle.driverRequired === false || !vehicle.passengers.includes(seat)) return false
  vehicle.driver = seat
  return true
}
export function leaveVehicle(state, seat, id, { forced = false, nextDriver = null } = {}) {
  if (!forced && vehicleAccessError(state, seat, id, false)) return false
  const data = mechanicState(state), vehicle = data?.vehicles?.[id]
  if (!vehicle?.passengers.includes(seat)) return false
  const remaining = vehicle.passengers.filter(value => value !== seat && !state.investigators[value].defeated && !state.investigators[value].resigned)
  if (vehicle.driver === seat && remaining.length > 1 && nextDriver == null) return false
  if (nextDriver != null && !remaining.includes(nextDriver)) return false
  vehicle.passengers = remaining
  if (vehicle.driver === seat) vehicle.driver = nextDriver ?? remaining[0] ?? null
  if (!forced) { data.vehicleAccess ||= {}; data.vehicleAccess[seat] = state.round }
  return true
}
export function setVehicleRunning(state, id, running) {
  const vehicle = mechanicState(state)?.vehicles?.[id]
  if (!vehicle || typeof running !== 'boolean') return false
  vehicle.running = running; return true
}
export function moveVehicle(state, id, destination, { moveInvestigator, entryError = () => null } = {}) {
  const vehicle = mechanicState(state)?.vehicles?.[id]
  if (!vehicle || !vehicle.running || !state.locations.some(loc => loc.id === destination)) return false
  const current = locationAt(state, vehicle.location)
  if (!current.connections?.includes(destination)) return false
  if (vehicle.passengers.some(seat => entryError(seat, destination))) return false
  if (typeof moveInvestigator !== 'function') throw new TypeError('载具移动需要权威位移入口')
  for (const seat of vehicle.passengers) {
    const inv = investigatorAt(state, seat)
    if (inv.defeated || inv.resigned || inv.location !== vehicle.location) return false
  }
  vehicle.location = destination
  for (const seat of vehicle.passengers.slice()) {
    moveInvestigator(seat, destination)
    if (state.investigators[seat].location !== destination) throw new Error('载具移动中止：必须回滚整个规则事务')
  }
  return true
}
export function removeVehicle(state, id) {
  const data = mechanicState(state), vehicle = data?.vehicles?.[id]
  if (!vehicle) return false
  delete data.vehicles[id]
  return true
}
