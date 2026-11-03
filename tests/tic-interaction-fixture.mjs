// Test-only seed and descriptors. Imported by the isolated HTTP runner, never the production mod.
import { fixture, asset } from './core-fixture.mjs'
import { registerCardAbilities, registeredEntry } from '../src/engine/ability.js'
import { legalMoves, scenarioRuntime } from '../src/engine/engine.js'
import { createMechanicsApi } from '../src/engine/api-mechanics.js'

export const HARNESS_CODE = 'testTicInteractions'
export const HOST = 'tic-fixture-host'
export const BOAT = 'tic-fixture-boat'
if (!registeredEntry(HARNESS_CODE)) registerCardAbilities([{
  code: HARNESS_CODE,
  abilities: [
    { kind: 'action', label: '封印标记', cost: { action: true }, resolve: ({ inv, source, api }) => api.interactions.seal(inv.seat, source.id, { tokens: ['bless', 'curse'], count: 2 }) },
    { kind: 'action', label: '释放标记', cost: { action: true }, resolve: ({ inv, source, api }) => api.interactions.release(inv.seat, source.id) },
    { kind: 'action', label: '取得钥匙', cost: { action: true }, resolve: ({ inv, api }) => api.interactions.keys(inv.seat, 'claimKey') },
    { kind: 'action', label: '转交钥匙', cost: { action: true }, resolve: ({ inv, api }) => api.interactions.keys(inv.seat, 'giveKeys', { max: 2 }) },
    { kind: 'action', label: '花费钥匙', cost: { action: true }, resolve: ({ inv, api }) => api.interactions.keys(inv.seat, 'spendKey') },
    { kind: 'action', label: '进入载具', cost: { action: true }, resolve: ({ inv, api }) => api.interactions.vehicle(inv.seat, 'enterVehicle') },
    { kind: 'action', label: '驾驶载具', cost: { action: true }, resolve: ({ inv, api }) => api.interactions.vehicle(inv.seat, 'driveVehicle') },
    { kind: 'action', label: '离开载具', cost: { action: true }, resolve: ({ inv, api }) => api.interactions.vehicle(inv.seat, 'leaveVehicle') },
    { kind: 'action', label: '特殊投入与收回', cost: { action: true }, resolve: ({ inv, source, api }) => api.test(inv.seat, 'willpower', 0, { source: { id: source.id, code: HARNESS_CODE, label: '特殊投入检定' } }) },
    { kind: 'forced', trigger: 'testBegins', criteria: ({ state, source }) => state.skillTest?.source?.id === source.id && !state.skillTest.committed.length,
      resolve: ({ inv, source, api }) => api.interactions.commit(inv.seat, { host: source.id, retain: true }) },
    { kind: 'forced', trigger: 'chaosRevealStepEnded', criteria: ({ state, source }) => state.skillTest?.source?.id === source.id,
      resolve: ({ inv, api }) => api.interactions.returnCommitment(inv.seat) },
  ],
}])

export function interactionFixture() {
  const s = fixture('01001', 2)
  s.humanSeats = [0, 1]; s.currentSeat = 0; s.turnSeat = 0
  s.investigators[1].location = s.investigators[0].location
  scenarioRuntime(s, []).place('hallway')
  s.locations[0].clues = 0
  for (const loc of s.locations) loc.revealed = true
  s.locations[1].clues = 1
  const from = s.investigators[0].location, to = s.locations.find(loc => loc.id !== from).id
  s.locations.find(loc => loc.id === from).connections = [to]
  const host = asset(s, HARNESS_CODE, { id: HOST, name: '机制交互验收', slots: [] })
  s.cards[HARNESS_CODE] = { code: HARNESS_CODE, name: host.name, nameZh: host.name, type: 'asset', klass: 'neutral', slots: [], text: '交互验收夹具' }
  ;(s.storyAssets ||= []).push({ id: BOAT, code: '01030', name: '验收载具', location: from })
  const api = createMechanicsApi(s)
  api.water.set(from, 2); api.water.set(to, 1); api.water.beginAirTurn(0)
  api.keys.initialize([
    { color: 'red', holder: 'investigator:0', revealed: true },
    { color: 'blue', holder: `location:${from}`, revealed: false },
    { color: 'green', holder: 'setAside', revealed: false },
  ])
  api.vehicles.register(BOAT, { location: from, capacity: 3, running: true, protectsFromFlood: true })
  s.investigators[0].hand.push('01089', '01093', '01091')
  for (const code of ['01089', '01093', '01091']) api.commitOrigins.store(0, HOST, code)
  s.chaosBag = ['bless', 'curse', '0']
  s.legalMoves = legalMoves(s, 0)
  return s
}

export function dexterFixture() {
  const state = fixture('07004')
  asset(state, '01030')
  state.investigators[0].hand = ['01031']
  state.legalMoves = legalMoves(state, 0)
  return state
}
