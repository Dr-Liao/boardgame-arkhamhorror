import { contentRegistry } from '../content/registered.js'
import { behavior as cityBehavior } from '../content/campaigns/theForgottenAge/scenarios/theCityOfArchives/index.js'
import { behavior as boundaryBehavior } from '../content/campaigns/theForgottenAge/scenarios/theBoundaryBeyond/index.js'
import { createGameState, legalMoves, scenarioRuntime, startScenario } from '../src/engine/engine.js'
import { resolveTransaction } from '../src/engine/resolution.js'

export const reactionOptions = { '04174': 'discover', '04179': 'discover', '04256': 'draw' }

export function reactionFixture(code, ownerSeat = 0) {
  const city = code === '04256'
  const chapter = city ? 'theCityOfArchives' : 'theBoundaryBeyond'
  const state = createGameState({
    campaignId: 'theForgottenAge', seed: `04-a-2-reaction-${code}`, campaignHub: true, playerInvestigator: '04001',
  }, [0, 1, 2].map(seat => ({ seat, role: 'human' })))
  state.campaign.records.theInvestigatorsCooperatedWithTheYithians = true
  const index = contentRegistry.getCampaign('theForgottenAge').scenarioIds.indexOf(chapter)
  const start = draft => startScenario(draft, index, [])
  resolveTransaction(state, 0, { action: 'fixtureStart' }, start)
  for (let guard = 0; state.pendingChoice; guard++) {
    if (guard >= 200) throw new Error('setup choices did not settle')
    const pending = state.pendingChoice
    const optionId = ['done', 'skip', 'self', 'cooperate'].find(id => pending.options.some(option => option.id === id))
      ?? pending.options[0].id
    resolveTransaction(state, pending.seat, { action: 'choose', choiceId: pending.id, optionId }, start)
  }
  state.status = 'playing'
  state.uiState = 'inScenario'
  state.phase = 'investigation'
  state.currentSeat = ownerSeat
  state.humanSeats = [0, 1, 2]

  const location = city
    ? state.locations.find(loc => loc.id === state.investigators[ownerSeat].location)
    : state.locations.find(loc => loc.id === (code === '04174' ? 'templeRuins' : 'chapultepecPark'))
  const otherLocationId = state.locations.find(loc => loc.id !== location.id)?.id || 'elsewhere'
  for (const inv of state.investigators) {
    inv.location = inv.seat === 2 ? otherLocationId : location.id
    inv.clues = 0
    inv.hand = []
    inv.deck = ['01020', '01021', '01022']
    inv.actionsLeft = 3
  }
  state.clues = 0
  if (city) {
    state.investigators[ownerSeat].assets.push({ id: 'custodian', code, originalCode: code, exhausted: false })
  } else {
    Object.assign(location, {
      code, originalCode: code, revealed: true, traits: ['Ancient'], clues: 3,
      name: code === '04174' ? '大神庙' : '查普尔特佩克山',
    })
  }

  const behavior = city ? cityBehavior : boundaryBehavior
  function execute(draft) {
    const inv = draft.investigators[ownerSeat]
    const api = scenarioRuntime(draft, [])
    if (city) behavior.phaseBegan(draft, 'investigation', api)
    else if (code === '04174') {
      behavior.afterEvade(draft, inv, { code: '04187', traits: ['Serpent'], location: inv.location }, { success: true }, api)
    } else behavior.encounterDrawn(draft, inv, '04090', api)
  }
  function resolve(seat, move) {
    resolveTransaction(state, seat, move, execute)
    state.legalMoves = legalMoves(state, state.currentSeat)
  }
  return {
    state,
    locationId: location.id,
    trigger: () => resolve(ownerSeat, { action: 'fixtureReaction' }),
    answer: move => resolve(state.pendingChoice.seat, move),
  }
}
