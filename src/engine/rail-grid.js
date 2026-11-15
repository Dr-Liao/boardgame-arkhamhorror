import { assertFields, mechanicState } from './mechanic-state.js'
import { markerCountOf, setMarkerCount } from './marker-count.js'

const directions = ['north', 'east', 'south', 'west']
const vectors = [[0, -1], [1, 0], [0, 1], [-1, 0]]
const vehicleAt = (state, id) => mechanicState(state)?.vehicles?.[id]

export function railNeighbors(rail, cells, id) {
  const origin = cells[id]
  if (!origin || origin.isolated) return []
  return (rail.ports[id] || []).flatMap(direction => {
    const index = directions.indexOf(direction)
    const [x, y] = vectors[index]
    const neighbor = Object.entries(cells).find(([, point]) => !point.isolated && point.x === origin.x + x && point.y === origin.y + y)
    if (!neighbor || !rail.ports[neighbor[0]]?.includes(directions[(index + 2) % 4])) return []
    return [{ direction, id: neighbor[0] }]
  })
}

export function validateRailGrid(state, rail) {
  if (rail == null) return
  assertFields(rail, ['vehicle', 'ports', 'facing', 'derailed'])
  const vehicle = vehicleAt(state, rail.vehicle)
  if (!vehicle || !directions.includes(rail.facing) || typeof rail.derailed !== 'boolean') throw new TypeError('无效矿车状态')
  const cells = mechanicState(state)?.grid || {}
  if (!rail.ports || typeof rail.ports !== 'object' || Array.isArray(rail.ports)) throw new TypeError('无效轨道出口')
  for (const [id, values] of Object.entries(rail.ports)) {
    if (!Object.hasOwn(cells, id) || !Array.isArray(values) || !values.length || new Set(values).size !== values.length
      || values.some(value => !directions.includes(value))) throw new TypeError('无效轨道出口')
  }
  if (!rail.ports[vehicle.location]?.includes(rail.facing) && !rail.derailed) throw new TypeError('矿车必须朝向当前轨道出口')
}

export function configureRailGrid(state, vehicle, facing, ports, configure) {
  const data = mechanicState(state)
  if (!data?.grid) throw new TypeError('轨道需要已布置网格')
  const rail = { vehicle, ports: structuredClone(ports), facing, derailed: false }
  validateRailGrid(state, rail)
  data.rail = rail
  configure({ adjacency: 'none' })
  return facing
}

export function steerRailVehicle(state, direction) {
  const rail = mechanicState(state)?.rail
  const index = directions.indexOf(direction)
  if (index < 0) throw new TypeError('未知轨道方向')
  if (!rail || rail.derailed) return false
  const diff = Math.abs(index - directions.indexOf(rail.facing))
  if (![1, 3].includes(diff) || !rail.ports[vehicleAt(state, rail.vehicle)?.location]?.includes(direction)) return false
  rail.facing = direction
  return true
}

export function endRailGrid(state, { configure, connect }, options = {}) {
  const data = mechanicState(state)
  if (!data?.rail) return false
  configure(options)
  delete data.rail
  connect()
  return true
}

export function convertRailMarkers(state, from, to, { per = 1 } = {}) {
  if (![from, to].every(key => typeof key === 'string' && /^[a-z][a-zA-Z0-9]*$/.test(key)
    && !['constructor', 'prototype'].includes(key)) || from === to || !Number.isSafeInteger(per) || per < 1) {
    throw new TypeError('无效轨道标记转换')
  }
  const supply = markerCountOf(state, from)
  const gained = Math.floor(supply / per)
  if (!gained) return 0
  const next = markerCountOf(state, to) + gained
  if (!Number.isSafeInteger(next)) throw new RangeError('轨道标记超出计数范围')
  setMarkerCount(state, from, supply % per)
  setMarkerCount(state, to, next)
  return gained
}

export function advanceRailVehicle(state, { move, connect }, selectFacing) {
  const data = mechanicState(state), rail = data?.rail
  const vehicle = rail && vehicleAt(state, rail.vehicle)
  if (!vehicle || rail.derailed) return false
  const neighbor = railNeighbors(rail, data.grid, vehicle.location).find(candidate => candidate.direction === rail.facing)
  if (!neighbor) { rail.derailed = true; return { derailed: true } }
  const back = directions[(directions.indexOf(rail.facing) + 2) % 4]
  const allowed = rail.ports[neighbor.id].filter(port => port !== back || rail.ports[neighbor.id].length === 1)
  const facing = allowed.includes(rail.facing) && allowed.length === 1 ? rail.facing
    : allowed.length === 1 ? allowed[0] : selectFacing?.([...allowed])
  if (!allowed.includes(facing)) return false
  if (!move(rail.vehicle, neighbor.id)) return false
  if (!vehicleAt(state, rail.vehicle)) {
    delete data.rail
    connect()
    return { removed: true }
  }
  rail.facing = facing
  return { location: neighbor.id, facing }
}
