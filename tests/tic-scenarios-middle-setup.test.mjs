// Main-process review draft. Copy to tests/tic-scenarios-middle-setup.test.mjs.
// Uses the main-owned real chapterFixture; worker must not execute/import it.
import test from 'node:test'
import assert from 'node:assert/strict'
import { chapterFixture } from './tic-chapter-fixture.mjs'
import { createMechanicsApi } from '../src/engine/api-mechanics.js'
import { validateMechanicState } from '../src/engine/mechanic-state.js'
import { viewState } from '../src/integration/observation.js'

const codeOf = card => card.originalCode || card.code
const sortedSeats = seats => [...seats].sort((a, b) => a - b)
const ISLANDS = ['07169', '07170', '07171', '07172', '07173']
const DEPTH_PAIRS = [['07175a', '07175b'], ['07176a', '07176b'], ['07177a', '07177b']]

for (const count of [1, 2, 3, 4]) {
  test(`Devil Reef real ${count}p setup: six map locations, exact anchors, eight tunnels, three selected depths and unpiloted physical boat`, () => {
    const s = chapterFixture('devilReef', count), api = createMechanicsApi(s)
    const start = s.scenario.startLocation
    assert.equal(s.locations.length, 6)
    assert.equal(codeOf(s.locations.find(loc => loc.id === start)), '07168')
    assert.equal(s.locations.find(loc => loc.id === start).revealed, true)
    assert.equal(api.water.level(start), 2)
    assert.deepEqual(s.locations.map(codeOf).sort(), ['07168', ...ISLANDS].sort())
    const positions = s.locations.map(loc => {
      const p = api.map.position(loc.id)
      return `${p.x},${p.y}`
    }).sort()
    assert.deepEqual(positions, ['0,0', '0,3', '4,2', '-4,2', '4,-2', '-4,-2'].sort())
    assert.equal(api.scenarioDecks.size('tidalTunnels'), 8)
    assert.equal(api.scenarioDecks.size('unfathomableDepths'), 3)
    const tunnels = api.scenarioDecks.cards('tidalTunnels')
    const tunnelCodes = tunnels.map(id => codeOf(s.scenario.locations[id])).sort()
    assert.deepEqual(tunnelCodes, ['07102', '07102', '07103', '07103', '07104', '07104', '07174a', '07174b'].sort())
    const depths = api.scenarioDecks.cards('unfathomableDepths')
    assert.equal(new Set([...tunnels, ...depths]).size, 11)
    const depthCodes = depths.map(id => codeOf(s.scenario.locations[id]))
    for (const pair of DEPTH_PAIRS) assert.equal(depthCodes.filter(code => pair.includes(code)).length, 1)
    assert.equal(s.encounterDeck.length, 33)
    assert.equal(s.encounterDeck.some(code => ['07164b', '07165b'].includes(code)), false)
    assert.deepEqual(s.agendas.map(codeOf), ['07165', '07166'])
    assert.deepEqual(s.acts.map(codeOf), ['07167'])
    const vehicles = Object.entries(s.scenarioFlags.mechanics.vehicles)
    assert.equal(vehicles.length, 1)
    const [boatId, boat] = vehicles[0]
    assert.notEqual(boatId, '07178')
    assert.equal(codeOf(s.storyAssets.find(asset => asset.id === boatId)), '07178')
    assert.equal(boat.driver, null)
    assert.deepEqual(sortedSeats(boat.passengers), Array.from({ length: count }, (_, seat) => seat))
    for (const inv of s.investigators) {
      assert.equal(inv.location, start)
      assert.equal(api.vehicles.of(inv.seat), boatId)
      assert.equal(api.water.effectiveLevel(inv.seat), 0)
      assert.notEqual(s.scenarioFlags.mechanics.vehicleAccess?.[inv.seat], s.round)
    }
    const mapping = s.scenarioFlags.innsmouthLocations
    assert.equal(new Set(Object.values(mapping)).size, Object.keys(mapping).length)
    assert.equal(validateMechanicState(JSON.parse(JSON.stringify(s))), undefined)
  })

  test(`High Gear real ${count}p setup: exact initial enemy removals, capacity, physical running cars and drivers`, () => {
    const s = chapterFixture('horrorInHighGear', count), api = createMechanicsApi(s)
    const initialEnemies = count === 1 ? 0 : count === 4 ? 2 : 1
    assert.equal(s.encounterDeck.length, 28 - initialEnemies)
    assert.equal(s.enemies.length, initialEnemies)
    assert.ok(s.enemies.every(enemy => ['07213', '07214', '07215'].includes(codeOf(enemy))))
    const road = s.scenarioFlags.mechanics.road
    const rear = Object.keys(road.columns).find(id => road.columns[id] === 1)
    assert.ok(s.enemies.every(enemy => enemy.location === rear))
    assert.deepEqual(s.agendas.map(codeOf), ['07199', '07201'])
    assert.deepEqual(s.acts.map(codeOf), ['07202'])
    assert.equal(road.columns[s.scenario.startLocation], 3)
    assert.equal(s.locations.find(loc => loc.id === s.scenario.startLocation).revealed, true)
    for (const loc of s.locations) {
      const expected = Object.keys(road.columns).filter(id => id !== loc.id && Math.abs(road.columns[id] - road.columns[loc.id]) === 1).sort()
      assert.deepEqual([...loc.connections].sort(), expected)
    }
    const cars = Object.entries(s.scenarioFlags.mechanics.vehicles)
    assert.ok(cars.length >= Math.ceil(count / 2) && cars.length <= Math.min(count, 2))
    const allPassengers = cars.flatMap(([, car]) => car.passengers)
    assert.deepEqual(sortedSeats(allPassengers), Array.from({ length: count }, (_, seat) => seat))
    assert.equal(new Set(allPassengers).size, count)
    for (const [carId, car] of cars) {
      const physical = s.storyAssets.find(asset => asset.id === carId)
      assert.ok(physical)
      assert.ok(['07211a', '07212a'].includes(codeOf(physical)))
      assert.notEqual(carId, codeOf(physical))
      assert.equal(car.running, true)
      assert.ok(car.passengers.length > 0 && car.passengers.length <= 2)
      assert.ok(car.passengers.includes(car.driver))
      assert.equal(car.location, s.scenario.startLocation)
      for (const seat of car.passengers) {
        assert.equal(api.vehicles.of(seat), carId)
        assert.equal(s.investigators[seat].location, car.location)
        assert.notEqual(s.scenarioFlags.mechanics.vehicleAccess?.[seat], s.round)
      }
    }
    assert.equal(validateMechanicState(JSON.parse(JSON.stringify(s))), undefined)
  })
}

test('Middle agenda variants use recovered devil battle and actual Terror death record, not difficulty or an arbitrary default', () => {
  const reef = chapterFixture('devilReef', 1, { memoriesRecovered: ['ABattleWithAHorrifyingDevil'] })
  assert.deepEqual(reef.agendas.map(codeOf), ['07164', '07166'])
  const road = chapterFixture('horrorInHighGear', 1, { records: { TheTerrorOfDevilReefIsDead: true } })
  assert.deepEqual(road.agendas.map(codeOf), ['07200', '07201'])
})

test('Real Devil Reef public projection hides unrevealed island faces, future depth choices and private deck order', () => {
  const s = chapterFixture('devilReef', 2), publicView = viewState(s, null)
  for (const source of s.locations.filter(loc => !loc.revealed)) {
    const visible = publicView.locations.find(loc => loc.id === source.id)
    assert.ok(visible)
    assert.equal(visible.originalCode, undefined)
    assert.equal(visible.code, undefined)
    assert.equal(visible.symbols, undefined)
    assert.equal(visible.unrevealedActualName, undefined)
    assert.equal(visible.nameEn, 'Devil Reef')
    assert.ok(visible.shroud == null || visible.shroud === 0)
  }
  for (const [id, count] of [['tidalTunnels', 8], ['unfathomableDepths', 3]]) {
    const pile = publicView.mechanics.scenarioDecks[id]
    assert.equal(pile.count, count)
    for (const field of ['deck', 'cards', 'discard', 'removed']) assert.equal(pile[field], undefined)
  }
  assert.equal((publicView.setAsideCards || []).some(card => DEPTH_PAIRS.flat().includes(card.code)), false)
  assert.equal(publicView.scenarioFlagsPublic?.innsmouthLocations, undefined)
})
