import assert from 'node:assert/strict'
import test from 'node:test'
import { scenarioRuntime, stepToward } from '../src/engine/engine.js'
import { mechanicState, validateMechanicState } from '../src/engine/mechanic-state.js'
import { migrateState } from '../src/engine/save-migration.js'
import { fixture, legalMoves, move, settle } from './core-fixture.mjs'

function surveyGrid() {
  const state = fixture()
  const seat = state.investigators[0]
  const origin = seat.location
  const center = state.locations.find(location => location.id === origin)
  center.clues = 2
  for (const id of ['lookout', 'workbench', 'storage', 'shelter']) {
    state.locations.push({ id, name: id, connections: [], clues: 0, shroud: 1, revealed: true })
  }
  const map = scenarioRuntime(state, []).mechanics.map
  map.configure({ adjacency: 'orthogonal' })
  const ports = ['north', 'west']
  map.place(origin, 0, 0, { ports })
  ports.push('south')
  map.place('lookout', 0, -1, { ports: ['south'] })
  map.place('workbench', 1, 0, { ports: ['west'] })
  map.place('storage', -1, 0, { ports: [] })
  map.place('shelter', 4, 4)
  map.connect(origin, 'shelter', { bidirectional: false })
  return { state, map, center, origin, seat }
}

const moveDestinations = state => legalMoves(state).filter(option => option.action === 'move')
  .map(option => option.to ?? option.locationId)

test('网格地点出口旋转后立即更新合法移动与寻路，保留附着状态和显式通路', () => {
  const { state, map, center, origin, seat } = surveyGrid()
  assert.deepEqual(map.ports(origin), ['north', 'west'])
  assert.deepEqual(map.paths(origin, 'lookout'), [[origin, 'lookout']])
  assert.deepEqual(map.paths('lookout', origin), [['lookout', origin]])
  assert.deepEqual(map.paths(origin, 'storage'), [], '一端关闭时不能通行')
  assert.deepEqual(map.paths(origin, 'workbench'), [])
  assert.equal(stepToward(state, origin, 'lookout'), 'lookout')
  assert.ok(moveDestinations(state).includes('lookout'))

  const rotated = map.rotatePorts(origin)
  assert.deepEqual(rotated, ['east', 'north'])
  rotated.length = 0
  assert.deepEqual(map.rotatePorts(origin, 1), ['south', 'east'])
  assert.deepEqual(map.ports(origin), ['south', 'east'])
  assert.deepEqual(map.paths(origin, 'lookout'), [])
  assert.deepEqual(map.paths('lookout', origin), [])
  assert.deepEqual(map.paths(origin, 'workbench'), [[origin, 'workbench']])
  assert.deepEqual(map.paths(origin, 'shelter'), [[origin, 'shelter']])
  assert.deepEqual(map.paths('shelter', origin), [])
  assert.equal(center.clues, 2)
  assert.equal(seat.location, origin)
  assert.ok(!moveDestinations(state).includes('lookout'))
  assert.equal(stepToward(state, origin, 'workbench'), 'workbench')
  const destination = legalMoves(state).find(option => option.action === 'move'
    && (option.to ?? option.locationId) === 'workbench')
  assert.ok(destination)
  move(state, destination)
  settle(state)
  assert.equal(state.investigators[0].location, 'workbench')
})

test('网格出口保存四方向状态，旧连接策略与无出口存档无需新字段', () => {
  const { state, map, origin } = surveyGrid()
  assert.deepEqual(map.rotatePorts(origin, -1), ['west', 'south'])
  assert.deepEqual(map.rotatePorts(origin, 4), ['west', 'south'])
  assert.equal(map.rotatePorts('shelter'), false)
  const saved = JSON.parse(JSON.stringify(state))
  migrateState(saved)
  validateMechanicState(saved)
  const savedMap = scenarioRuntime(saved, []).mechanics.map
  assert.deepEqual(savedMap.ports(origin), ['west', 'south'])
  assert.deepEqual(savedMap.ports('storage'), [])
  assert.equal(savedMap.ports('shelter'), null)
  assert.equal(Object.hasOwn(mechanicState(saved).grid.shelter, 'ports'), false)
  assert.deepEqual(savedMap.paths(origin, 'lookout'), [])
  savedMap.configure({ adjacency: 'rows' })
  assert.deepEqual(savedMap.paths(origin, 'lookout'), [[origin, 'lookout']])
  savedMap.configure({ adjacency: 'orthogonal' })
  assert.deepEqual(savedMap.paths(origin, 'lookout'), [])

  mechanicState(saved).grid[origin].ports.push('diagonal')
  assert.throws(() => validateMechanicState(saved), /无效网格地点出口/)
})

test('网格出口和旋转参数错误时，坐标与连接不发生变化', () => {
  const { state, map, origin } = surveyGrid()
  const before = JSON.stringify(state)
  assert.throws(() => map.place(origin, 2, 2, { ports: ['north', 'north'] }), /无效网格地点出口/)
  assert.throws(() => map.place(origin, 2, 2, { ports: new Array(1) }), /无效网格地点出口/)
  assert.throws(() => map.rotatePorts(origin, 0.5), /转向次数必须是整数/)
  assert.equal(JSON.stringify(state), before)
})
