import { fixture, asset } from './core-fixture.mjs'
import { registerCardAbilities, registeredEntry } from '../src/engine/ability.js'
import { createMechanicsApi } from '../src/engine/api-mechanics.js'
import { scenarioReferenceEntry } from '../src/cards/encounter-entries/_shared.js'
import { legalMoves } from '../src/engine/engine.js'
const code = 'testTicP7Interaction'
if (!registeredEntry(code)) registerCardAbilities([{ code, abilities: [
  { kind: 'free', label: '清除路障', cost: { action: false, groupClues: 2 },
    criteria: ({ state, inv }) => (state.scenarioFlags.mechanics?.barriers || []).some(e => [e.a, e.b].includes(inv.location)),
    resolve: ({ inv, api }) => { const edge = api.barriers.edges(inv.location)[0]; api.barriers.change(edge.a, edge.b, -1) } },
  { kind: 'free', label: '支付钥匙：领取资源', cost: { exhaust: true }, additionalKeyCost: { colors: ['red', 'white'] },
    resolve: ({ inv, api }) => api.gainResources(inv.seat, 1) },
  { kind: 'action', label: '调查线索', resolve: ({ inv, api }) => api.scenarioDecks.revealChooseDraw('leads', inv.seat, 2, { mixEncounterTop: true }) },
] }])
const reference='testTicScenarioUIReference'
if(!registeredEntry(reference))registerCardAbilities([scenarioReferenceEntry({code:reference})])
export function scenarioInteractionFixture() {
  const state = fixture('01001', 2), here = state.investigators[0].location
  Object.assign(state.scenario,{code:reference,originalCode:reference,referenceCode:'07041'})
  state.locations[0].clues=0
  state.humanSeats = [0, 1]
  state.investigators[1].location = here
  for (const inv of state.investigators) inv.clues = 1
  state.locations[0].connections = ['next']
  state.locations.push({ id: 'next', code: '01112', originalCode: '01112', name: '阁楼', revealed: true,
    clues: 0, shroud: 1, connections: [here] })
  const host = asset(state, code, { name: '调查现场', slots: [] })
  state.cards[code] = { code, name: host.name, nameZh: host.name, type: 'asset', klass: 'neutral', slots: [], text: '' }
  const api = createMechanicsApi(state)
  api.keys.initialize([{ color: 'red', holder: 'investigator:0', revealed: true }, { color: 'white', holder: 'investigator:0', revealed: true },{color:'blue',holder:`location:${here}`,revealed:false}])
  api.barriers.set(here, 'next', 1, { setup: true })
  api.scenarioDecks.initialize('leads', ['dissonantVoices', 'ghoulMinion'], { shuffle: false })
  state.encounterDeck = ['dissonantVoices']
  state.legalMoves = legalMoves(state, 0)
  return state
}
