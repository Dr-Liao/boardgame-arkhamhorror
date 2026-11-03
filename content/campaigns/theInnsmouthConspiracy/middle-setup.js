import { chapterData, physicalLocationId } from './chapter-definition.js'
import { concealPhysicalLocations, locationId, shuffled } from './chapter-setup.js'
import { randomValue } from '../../../src/engine/rules-state.js'
import { shuffle } from '../../../src/deck/deckbuilding.js'

const memory = (state, id) => (state.campaign.records.memoriesRecovered || []).includes(id)
const at = (state, physical) => locationId(state, physical)
const defaultRandom = { shuffle, randomValue }

function prepareRoad(state, deps) {
  if (state.scenarioFlags.initialRoad) return
  const facts = chapterData.horrorInHighGear.setup
  concealPhysicalLocations(state, chapterData.horrorInHighGear.locations.map(loc => loc.id), deps)
  const roads = shuffled(state, facts.roadDeck.shuffleFirst, deps)
  const bottom = shuffled(state, ['07203', ...roads.splice(-2)], deps)
  const deck = [...bottom, ...roads].map(physical => at(state, physical))
  const initial = [deck.pop(), deck.pop(), deck.pop()]
  state.scenarioFlags.initialRoad = { initial, deck, detours: facts.longWayPool.physicalIds.map(physical => at(state, physical)) }
  state.scenario.startLocation = initial[2]
}

export function middleStartLocation(state) {
  if (state.scenario.id !== 'horrorInHighGear') return state.scenario.startLocation
  prepareRoad(state, defaultRandom)
  return state.scenario.startLocation
}

export function middleSetupLocations(state, events, deps) {
  const id = state.scenario.id, facts = chapterData[id].setup
  const selected = id === 'devilReef'
    ? (memory(state, 'ABattleWithAHorrifyingDevil') ? facts.agendaDeck.first.whenTrue : facts.agendaDeck.first.whenFalse)
    : state.campaign.records.TheTerrorOfDevilReefIsDead ? facts.agendaDeck.first.whenTrue : facts.agendaDeck.first.whenFalse
  state.agendas.splice(0, state.agendas.length, ...[selected, ...facts.agendaDeck.then].map(code => structuredClone(state.scenario.stageCards[code])))
  if (id === 'horrorInHighGear') {
    prepareRoad(state, deps)
    return state.scenarioFlags.initialRoad.initial
  }
  const physical = chapterData[id].locations.filter(loc => loc.code !== '07168').map(loc => loc.id)
  concealPhysicalLocations(state, physical, deps)
  const islands = shuffled(state, ['07169', '07170', '07171', '07172', '07173'], deps)
  const anchors = [[0, 3], [4, 2], [-4, 2], [4, -2], [-4, -2]]
  state.scenarioFlags.initialIslandPositions = islands.map((code, index) => ({ id: at(state, code), point: anchors[index] }))
  const selectedDepths = [], removedDepths = []
  for (const pair of facts.variantSelection.pairs) {
    const order = shuffled(state, pair, deps)
    selectedDepths.push(at(state, order[0])); removedDepths.push(order[1])
  }
  state.scenarioFlags.selectedDepths = selectedDepths
  state.scenarioZones.removed = removedDepths
  return [state.scenario.startLocation, ...islands.map(code => at(state, code))]
}

export function middleAfterDeckSetup(state, events, { api, ...deps }) {
  const id = state.scenario.id, spec = chapterData[id], facts = spec.setup, map = api.mechanics.map
  state.scenarioZones.setAside = []
  if (id === 'devilReef') {
    api.mechanics.keys.initialize(facts.initialKeys)
    map.place(state.scenario.startLocation, 0, 0)
    for (const item of state.scenarioFlags.initialIslandPositions) map.place(item.id, ...item.point)
    const tunnels = facts.tidalTunnelDeck.physicalIds.map(physical => at(state, physical))
    api.mechanics.scenarioDecks.initialize('tidalTunnels', tunnels)
    api.mechanics.scenarioDecks.initialize('unfathomableDepths', state.scenarioFlags.selectedDepths)
    state.scenarioZones.setAside.push(...facts.setAsideStoryAssets)
    api.mechanics.water.set(state.scenario.startLocation, 2)
    const boat = api.storyAsset('07178', state.scenario.startLocation)
    api.mechanics.vehicles.register(boat.id, { location: state.scenario.startLocation, capacity: state.numInvestigators,
      running: true, driverRequired: false, protectsFromFlood: true })
    for (const inv of state.investigators) api.mechanics.vehicles.enter(inv.seat, boat.id, { setup: true })
    api.reveal(state.scenario.startLocation)
  } else {
    const road = state.scenarioFlags.initialRoad
    api.mechanics.map.initializeRoad({ deck: road.deck, detours: road.detours,
      columns: Object.fromEntries(road.initial.map((id, index) => [id, index + 1])) })
    map.configure({ adjacency: 'columns' })
    for (const [index, id] of road.initial.entries()) map.place(id, index + 1, 0)
    api.reveal(road.initial[2])
    const eligible = facts.initialEncounterVehicles.eligible.flatMap(card => Array(card.quantity).fill(card.printedCode))
    const count = facts.initialEncounterVehicles.countsByPlayerCount[state.numInvestigators]
    const vehicles = shuffled(state, eligible, deps).slice(0, count)
    for (const code of vehicles) {
      const index = state.encounterDeck.indexOf(code)
      if (index < 0) throw new Error(`Missing physical initial vehicle ${code}`)
      state.encounterDeck.splice(index, 1); api.spawn(code, road.initial[0])
    }
    const seats = Object.fromEntries(facts.cars.map(car => [car.frontPrintedCode, []]))
    for (const inv of state.investigators) {
      const available = facts.cars.filter(car => seats[car.frontPrintedCode].length < car.capacity)
      const code = available.length === 1 ? available[0].frontPrintedCode : api.choose({ kind: 'vehicle', source: 'initialCars',
        seat: inv.seat, prompt: '选择开始乘坐的汽车（每辆最多2人）。',
        options: available.map(car => ({ id: car.frontPrintedCode, cardCode: car.frontPrintedCode, label: car.name })) })
      seats[code].push(inv.seat)
    }
    for (const car of facts.cars) {
      const passengers = seats[car.frontPrintedCode]
      if (!passengers.length) { state.scenarioZones.removed ||= []; state.scenarioZones.removed.push(car.frontPrintedCode); continue }
      const physical = api.storyAsset(car.frontPrintedCode, state.scenario.startLocation)
      api.mechanics.vehicles.register(physical.id, { location: state.scenario.startLocation, capacity: car.capacity, running: true, driverRequired: true })
      for (const seat of passengers) api.mechanics.vehicles.enter(seat, physical.id, { setup: true })
      const driver = passengers.length === 1 ? passengers[0] : Number(api.choose({ kind: 'investigator', source: physical.id,
        seat: state.campaign.leadSeat, prompt: '选择这辆汽车的驾驶员。', options: passengers.map(seat => ({ id: String(seat), label: state.investigators[seat].name })) }))
      api.mechanics.vehicles.setDriver(physical.id, driver)
    }
  }
  state.scenario.setAsideLocations = Object.keys(state.scenario.locations).filter(id => !state.locations.some(loc => loc.id === id))
}
