import { assertFields, integer, investigatorAt, locationAt, mechanicState } from './mechanic-state.js'
import { checkAirAfterMove } from './flood.js'
import { cardName } from './card-lookup.js'
import { registeredEntry } from './ability.js'
import { enemyEngagedRestricts } from './enemy-entry.js'
import { vehicleOf, vehiclePassengers, vehicleRecord, vehicleCard } from './vehicle-state.js'

// 只读入口重新导出：调用方（引擎与 _shared 的读法）共用同一份实现。
export { vehicleOf, vehiclePassengers, vehicleRecord, vehicleCard }
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
export function vehicleAccessError(state, seat, id, entering = true, { setup = false } = {}) {
  const inv = investigatorAt(state, seat), data = mechanicState(state), vehicle = data?.vehicles?.[id]
  if (!vehicle || inv.defeated || inv.resigned || inv.location !== vehicle.location) return '无法在此进入或离开载具'
  // 开局摆位不是「进入载具」：运行面锁定与敌方/威胁区限制都不适用于 setup。
  if (!setup) {
    // 「本载具正在运行。调查员不能进入或离开本载具」（07211a/07212a 的运行面）：
    // 声明在**当前物理面**的条目上（`assetRule.vehicleAccessLocked`），翻面后自动失效。
    const face = vehicleCard(state, id)
    if (registeredEntry(face?.originalCode || face?.code)?.assetRule?.vehicleAccessLocked) return '载具正在运行，不能进入或离开'
    // 「你不能进入载具」的两条来源：威胁区卡声明（07188 拖入水底）与交战中的敌人限制
    // （07183 追猎的深潜者）。离开不受这两条限制——印刷只禁「进入」。
    if (entering && (inv.threat || []).some(card =>
      registeredEntry(card.originalCode || card.code)?.treacheryRule?.forbidsVehicles)) return '当前不能进入载具'
    if (entering && enemyEngagedRestricts(state, inv, 'enterVehicle')) return '当前不能进入载具'
  }
  if (data.vehicleAccess?.[seat] === state.round) return '本轮已经进入或离开过载具'
  if (entering && (vehicleOf(state, seat) || vehicle.passengers.length >= vehicle.capacity)) return '载具已满或调查员已在载具中'
  if (!entering && !vehicle.passengers.includes(seat)) return '调查员不在该载具中'
  return null
}
export function enterVehicle(state, seat, id, { setup = false } = {}) {
  if (vehicleAccessError(state, seat, id, true, { setup })) return false
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
// 「该载具不能离开某地点，直到下一轮结束」（07210 蜿蜒长路）：记在载具记录上，
// 读点是 moveVehicle 的离开校验（`state.round <= lockedUntilRound` 时拒绝）。
export function lockVehicleUntilRound(state, id, round) {
  const vehicle = mechanicState(state)?.vehicles?.[id]
  if (!vehicle || !Number.isSafeInteger(round)) return false
  vehicle.lockedUntilRound = Math.max(Number(vehicle.lockedUntilRound) || 0, round)
  return true
}

export function moveVehicle(state, id, destination, { moveInvestigator, entryError = () => null, vehicleLeft, vehicleEntered } = {}) {
  const vehicle = mechanicState(state)?.vehicles?.[id]
  if (!vehicle || !vehicle.running || !state.locations.some(loc => loc.id === destination)) return false
  // 07210「该载具不能离开蜿蜒长路，直到下一轮结束」的读点。
  if (vehicle.lockedUntilRound != null && state.round <= vehicle.lockedUntilRound) return false
  const current = locationAt(state, vehicle.location)
  if (!current.connections?.includes(destination)) return false
  if (vehicle.passengers.some(seat => entryError(seat, destination))) return false
  if (typeof moveInvestigator !== 'function') throw new TypeError('载具移动需要权威位移入口')
  for (const seat of vehicle.passengers) {
    const inv = investigatorAt(state, seat)
    if (inv.defeated || inv.resigned || inv.location !== vehicle.location) return false
  }
  const origin = vehicle.location
  const seats = [...vehicle.passengers]
  vehicle.location = destination
  // 载具的**物理卡**本身也要跟着走：剧情支援（渔船这类）用实例上的 location 记录位置，
  // 下一次 [action] 的范围判定（entityAbilityInRange）就靠它。受控载具（汽车）挂在调查员
  // 身上、本来没有 location 字段，这里只在已有位置字段时同步，避免凭空造字段。
  const carriers = [...(state.storyAssets || []), ...(state.investigators || []).flatMap(inv => inv.assets || [])]
  for (const asset of carriers) if (asset?.id === id && asset.location != null) asset.location = destination
  for (const seat of vehicle.passengers.slice()) {
    moveInvestigator(seat, destination)
    if (state.investigators[seat].location !== destination) throw new Error('载具移动中止：必须回滚整个规则事务')
  }
  // 道路危害的两个分发口（07204–07210）：移动成功之后才结算，事件里带出发地/目的地与乘客快照。
  const event = { vehicleId: id, seats, origin, destination }
  if (typeof vehicleLeft === 'function') vehicleLeft(event)
  if (typeof vehicleEntered === 'function') vehicleEntered(event)
  return true
}
export function removeVehicle(state, id) {
  const data = mechanicState(state), vehicle = data?.vehicles?.[id]
  if (!vehicle) return false
  delete data.vehicles[id]
  return true
}
