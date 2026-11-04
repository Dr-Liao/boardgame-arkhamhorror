import { validateEnemyZones,enemyForKeyHolder } from './enemy-zones.js'
// Optional JSON extension inside the existing scenarioFlags store. Reads never initialize it.
export function mechanicState(state, create = false) {
  if (!create) return state.scenarioFlags?.mechanics || null
  state.scenarioFlags ||= {}
  return state.scenarioFlags.mechanics ||= { version: 1 }
}
export function investigatorAt(state, seat) {
  if (!Number.isSafeInteger(seat) || !state.investigators?.[seat]) throw new RangeError('无效调查员座位')
  return state.investigators[seat]
}
export function locationAt(state, id) {
  const location = state.locations?.find(loc => loc.id === id)
  if (!location) throw new RangeError(`无效地点 ${id}`)
  return location
}
export function integer(value, min = 0) {
  if (!Number.isSafeInteger(value) || value < min) throw new TypeError('需要合法整数')
  return value
}
export function assertFields(value, allowed) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('机制声明必须为对象')
  for (const key of Object.keys(value)) if (!allowed.includes(key)) throw new TypeError(`未知机制字段 ${key}`)
  return value
}
export function normalizeScenarioMechanics(spec) {
  if (spec == null) return null
  assertFields(spec, ['water', 'keys', 'vehicles'])
  if (spec.water != null) {
    assertFields(spec.water, ['air', 'damage'])
    if (spec.water.air != null && typeof spec.water.air !== 'boolean') throw new TypeError('water.air 必须为布尔值')
    if (spec.water.damage != null) integer(spec.water.damage)
  }
  for (const field of ['keys', 'vehicles']) if (spec[field] != null && typeof spec[field] !== 'boolean') throw new TypeError(`${field} 必须为布尔值`)
  return structuredClone(spec)
}
export function validateMechanicState(state) {
  const data = mechanicState(state)
  if (!data) return // Old saves stay byte-for-byte unchanged.
  assertFields(data, ['version', 'flood', 'floodPolicy', 'air', 'airTurns', 'keys', 'vehicles', 'vehicleAccess', 'recordRewards', 'beneath', 'road', 'promises', 'tokenSchedules', 'barriers', 'scenarioDecks', 'grid', 'gridAdjacency','enemyZones','roadHazards'])
  validateEnemyZones(state,data.enemyZones)
  if (data.version !== 1) throw new TypeError('不支持的可选机制存档版本')
  if (data.gridAdjacency != null && !['orthogonal', 'row', 'columns', 'none'].includes(data.gridAdjacency)) throw new TypeError('Invalid grid adjacency save')
  if (data.floodPolicy != null) {
    assertFields(data.floodPolicy, ['reveal', 'locked'])
    if (data.floodPolicy.reveal != null) {
      const policy = data.floodPolicy.reveal
      assertFields(policy, ['mode', 'amount'])
      if (!['increase', 'set'].includes(policy.mode) || ![1, 2].includes(policy.amount)) throw new TypeError('Invalid reveal flood policy save')
    }
    if (data.floodPolicy.locked != null) {
      if (!Array.isArray(data.floodPolicy.locked) || new Set(data.floodPolicy.locked).size !== data.floodPolicy.locked.length) throw new TypeError('Invalid flood lock save')
      for (const id of data.floodPolicy.locked) locationAt(state, id)
    }
  }
  if (data.grid != null) {
    if (typeof data.grid !== 'object' || Array.isArray(data.grid)) throw new TypeError('Invalid grid save')
    const positions = new Set()
    for (const [id, cell] of Object.entries(data.grid)) {
      locationAt(state, id); assertFields(cell, ['x', 'y', 'isolated', 'connections'])
      if (![cell.x, cell.y].every(Number.isSafeInteger) || typeof cell.isolated !== 'boolean'
        || !Array.isArray(cell.connections) || cell.connections.some(to => typeof to !== 'string')) throw new TypeError('Invalid grid cell')
      if (!cell.isolated) {
        const key = `${cell.x},${cell.y}`
        if (positions.has(key)) throw new TypeError('Overlapping grid cells')
        positions.add(key)
      }
    }
  }
  if (data.scenarioDecks != null) {
    if (typeof data.scenarioDecks !== 'object' || Array.isArray(data.scenarioDecks)) throw new TypeError('Invalid private deck save')
    for (const [id, deck] of Object.entries(data.scenarioDecks)) {
      if (!/^[a-z][A-Za-z0-9]{0,63}$/.test(id) || ['constructor', 'prototype'].includes(id)) throw new TypeError('Invalid private deck name')
      assertFields(deck, ['deck', 'discard', 'removed'])
      for (const zone of ['deck', 'discard', 'removed']) if (!Array.isArray(deck[zone]) || deck[zone].some(code => typeof code !== 'string' || !code)) throw new TypeError('Invalid private deck cards')
    }
  }
  if (data.barriers != null) {
    if (!Array.isArray(data.barriers)) throw new TypeError('Invalid barrier save')
    const seen = new Set()
    for (const edge of data.barriers) {
      assertFields(edge, ['a', 'b', 'count']); locationAt(state, edge.a); locationAt(state, edge.b); integer(edge.count, 1)
      const key = JSON.stringify([edge.a, edge.b].sort())
      if (edge.a === edge.b || seen.has(key)) throw new TypeError('Invalid barrier edge')
      seen.add(key)
    }
  }
  for (const level of Object.values(data.flood || {})) if (![0, 1, 2].includes(level)) throw new TypeError('存档淹没等级无效')
  for (const risk of Object.values(data.air || {})) {
    if (!Number.isSafeInteger(risk.turn) || !Number.isSafeInteger(risk.damage) || risk.damage < 0) throw new TypeError('存档空气状态无效')
  }
  for (const vehicle of Object.values(data.vehicles || {})) {
    if (!Array.isArray(vehicle.passengers) || new Set(vehicle.passengers).size !== vehicle.passengers.length
      || vehicle.passengers.some(seat => !state.investigators?.[seat])
      || (vehicle.passengers.length && vehicle.driverRequired !== false && !vehicle.passengers.includes(vehicle.driver))) throw new TypeError('存档载具座位无效')
  }
  for (const key of Object.values(data.keys || {})) {
    if (!key || typeof key.holder !== 'string' || typeof key.revealed !== 'boolean' || (key.linkedAssetId != null && typeof key.linkedAssetId !== 'string')) throw new TypeError('存档钥匙状态无效')
  }
  for (const schedule of data.tokenSchedules || []) {
    if (!['bless', 'curse'].includes(schedule.from) || !['bless', 'curse'].includes(schedule.to)
      || schedule.from === schedule.to || !Number.isSafeInteger(schedule.round)) throw new TypeError('存档延后标记效果无效')
  }
}
