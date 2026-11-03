import { createEnemyZoneApi } from './enemy-zones.js'
import { mechanicState } from './mechanic-state.js'
import * as pool from './chaos-token-pool.js'
import * as water from './flood.js'
import * as keys from './scenario-keys.js'
import * as vehicles from './vehicles.js'
import * as graph from './map-graph.js'
import * as barriers from './edge-barriers.js'
import * as origins from './commit-origins.js'
import * as records from '../campaign/record-sets.js'
import { setTokenTreatment } from './chaos-token-effects.js'
import { moveUses, spendSharedUses } from './use-transfer.js'
import { makeTurnPromise } from './turn-promises.js'
import { createMechanicChoices } from './mechanic-choices.js'
import { createScenarioDeckApi } from './scenario-decks.js'
import * as grid from './grid-map.js'

// Composition only. Writes remain in the reusable domain primitives.
export function createMechanicsApi(state, deps = {}) {
  const changed = result => { deps.sealedChanged?.(); return result }
  const deck = createScenarioDeckApi(state, deps)
  return {
    interactions: createMechanicChoices(state, deps),
    scenarioDecks: deck,
    enemyZones:deps.enemyZones||createEnemyZoneApi(state,{mechanicState}),
    barriers: {
      count: (a, b) => barriers.barrierCount(state, a, b),
      edges: id => barriers.barrierEdges(state, id),
      set: (a, b, count, options) => barriers.setBarrierCount(state, a, b, count, options),
      change: (a, b, amount, options) => barriers.changeBarrierCount(state, a, b, amount, options),
      canPlace: (a, b) => barriers.canPlaceBarrier(state, a, b),
      removeConnected(seat, id, count = 1) {
        const edges = barriers.barrierEdges(state, id).filter(edge => edge.count >= count)
        if (!edges.length) return false
        const index = edges.length === 1 ? 0 : Number(deps.choice({ kind: 'effect', seat, source: id,
          prompt: '选择要清除路障的通道。', options: edges.map((edge, index) => ({ id: String(index),
            label: `${state.locations.find(loc => loc.id === edge.a)?.name} — ${state.locations.find(loc => loc.id === edge.b)?.name}` })) }))
        const edge = edges[index]
        return edge ? barriers.changeBarrierCount(state, edge.a, edge.b, -count) !== false : false
      },
      moveConnected(seat, id) {
        const neighbors = state.locations.find(loc => loc.id === id)?.connections || []
        const eligible = barriers.barrierEdges(state, id).filter(edge => neighbors.some(to => ![edge.a, edge.b].includes(to) && barriers.canPlaceBarrier(state, id, to)))
        if (!eligible.length) return false
        const index = eligible.length === 1 ? 0 : Number(deps.choice({ kind: 'effect', seat, source: id, prompt: '选择移走路障的通道。',
          options: eligible.map((edge, i) => ({ id: String(i), label: edge.a === id ? edge.b : edge.a })) }))
        const edge = eligible[index]
        if (!edge) return false
        const destinations = neighbors.filter(to => ![edge.a, edge.b].includes(to) && barriers.canPlaceBarrier(state, id, to))
        const to = destinations.length === 1 ? destinations[0] : deps.choice({ kind: 'effect', seat, source: id, prompt: '选择放置路障的通道。',
          options: destinations.map(id => ({ id, label: state.locations.find(loc => loc.id === id)?.name || id })) })
        if (!destinations.includes(to) || !barriers.barrierCount(state, edge.a, edge.b)) return false
        barriers.changeBarrierCount(state, edge.a, edge.b, -1)
        barriers.changeBarrierCount(state, id, to, 1)
        return true
      },
    },
    promise: (seat, source, event) => makeTurnPromise(state, seat, source, event),
    useTokens: {
      move: (from, to, type, count) => moveUses(state, from, to, type, count),
      spend: (seat, id, type, count, providers) => spendSharedUses(state, seat, id, type, count, providers),
    },
    chaosTokens: {
      count: token => pool.poolTokenCount(state, token), room: token => pool.poolTokenRoom(state, token),
      add: (token, count, options) => pool.addPoolTokens(state, token, count, options),
      candidates: (token, options) => pool.payablePoolTokens(state, token, options),
      pay: (token, count, options) => changed(pool.payPoolTokens(state, token, count, options)),
      replace: (from, to, count, options) => pool.replacePoolTokens(state, from, to, count, options),
      seal: (source, token, count, options) => pool.sealPoolTokens(state, source, token, count, options),
      release: (source, token, count, options) => changed(pool.releasePoolTokens(state, source, token, count, options)),
      revealSealed: (source, token) => pool.revealSealedToken(state, source, token),
      inspect: count => pool.inspectChaosTokens(state, count), treat: spec => setTokenTreatment(state, spec),
      scheduleReplacement: (from, to) => pool.schedulePoolReplacement(state, from, to),
    },
    water: {
      setRevealPolicy: policy => water.setRevealFloodPolicy(state, policy),
      lock: id => water.lockFloodLevel(state, id),
      level: id => water.floodLevel(state, id), effectiveLevel: (seat, options) => water.effectiveFloodLevel(state, seat, options),
      canChange: (id, amount) => water.canChangeFloodLevel(state, id, amount),
      set: (id, level, options) => water.setFloodLevel(state, id, level, { ...options, onChange: deps.floodChanged }),
      change: (id, amount, options) => water.changeFloodLevel(state, id, amount, { ...options, onChange: deps.floodChanged }),
      beginAirTurn: (seat, options) => water.beginAirTurn(state, seat, options), endAirTurn: seat => water.endAirTurn(state, seat, deps.directDamage),
    },
    keys: {
      linkAsset: (color, assetId) => keys.linkKeyAsset(state, color, assetId),
      heldAtLocation: id => keys.keysHeldAtLocation(state, id),
      heldByGroup: () => keys.keysHeldByGroup(state),
      initialize: specs => keys.initializeKeys(state, specs), at: (target, options) => keys.keysAt(state, target, options),
      transfer: (color, from, to, options) => keys.transferKey(state, color, from, to, options),
      claim: (seat, color) => keys.claimKey(state, seat, color), spend: (seat, color, to) => keys.spendKey(state, seat, color, to),
      placeRandom: to => keys.placeRandomUnrevealedKey(state, to),
      onExit: (target, location, seat) => keys.keysOnExit(state, target, location, seat), give: (from, to, colors) => keys.giveKeys(state, from, to, colors),
    },
    vehicles: {
      register: (id, spec) => vehicles.registerVehicle(state, id, spec), of: seat => vehicles.vehicleOf(state, seat),
      accessError: (seat, id, entering) => vehicles.vehicleAccessError(state, seat, id, entering),
      enter: (seat, id, options) => vehicles.enterVehicle(state, seat, id, options), leave: (seat, id, options) => vehicles.leaveVehicle(state, seat, id, options),
      setDriver: (id, seat) => vehicles.setVehicleDriver(state, id, seat),
      running: (id, running) => vehicles.setVehicleRunning(state, id, running),
      move: (id, destination) => vehicles.moveVehicle(state, id, destination, deps), remove: id => vehicles.removeVehicle(state, id),
    },
    map: {
      configure: options => grid.configureGrid(state, options),
      position: id => grid.gridPosition(state, id),
      locations: query => grid.gridLocations(state, query),
      place: (id, x, y, options) => grid.placeGridLocation(state, id, x, y, deps, options),
      connect: (a, b, options) => grid.connectGridPair(state, a, b, options),
      expand: (id, template, deckId) => grid.expandGridFrom(state, id, template, deckId, { ...deps, deck }),
      paths: (from, to, canEnter) => graph.shortestPaths(state.locations, from, to, canEnter),
      distance: (from, to) => graph.roadDistance(state.locations, from, to), neighbors: (cells, cell) => graph.orthogonalNeighbors(cells, cell),
      initializeRoad: spec => graph.initializeRoad(state, spec), extendRoad: (from, count) => graph.extendRoad(state, from, count, deps.placeLocation),
    },
    recordSets: {
      values: key => records.recordSetValues(state.campaign, key), add: (key, value) => records.recordSetAdd(state.campaign, key, value),
      remove: (key, value) => records.recordSetRemove(state.campaign, key, value), claimReward: id => records.claimRecordReward(state.campaign, id),
    },
    commitOrigins: {
      beneath: (seat, host) => origins.beneathCards(state, seat, host), store: (seat, host, code, options) => origins.storeBeneath(state, seat, host, code, options),
      take: (seat, host, code, to) => origins.takeBeneath(state, seat, host, code, to), commit: (seat, spec) => origins.commitFromOrigin(state, seat, spec, deps.commit),
      withdraw: (seat, index) => origins.withdrawCommitment(state, seat, index),
    },
  }
}
