import { contentRegistry, registerContentBundle } from '../content/registered.js'
import { createGameState, applyMove, legalMoves } from '../src/engine/engine.js'
import { manifest as carcosaPack } from '../content/packs/carcosaCampaign/manifest.js'
import * as oath from '../content/campaigns/thePathToCarcosa/scenarios/theUnspeakableOath/index.js'

const trialPackId = 'reproCarcosaPack'
const scenarioId = 'reproOathScenario'
const campaignId = 'reproOathCampaign'
registerContentBundle({ packs: [{ ...carcosaPack, id: trialPackId, status: 'playable' }] })
const production = oath.behavior
registerContentBundle({
  campaigns: [{
    ...contentRegistry.getCampaign('thePathToCarcosa'), id: campaignId, status: 'playable',
    scenarioIds: [scenarioId], unlock: { [scenarioId]: [] }, requiredPackIds: ['core', trialPackId],
    flow: { start: scenarioId, nodes: { [scenarioId]: { type: 'scenario', scenarioId, next: 'end' }, end: { type: 'end' } } },
  }],
  scenarios: [{
    scenario: { ...oath.scenario, id: scenarioId },
    behavior: {
      ...production, id: scenarioId,
      actions(state, inv) {
        return [...(production.actions?.(state, inv) || []),
          { action: 'scenarioAction', rule: 'm4DrawEncounter', actions: 0, label: 'M4 抽遭遇牌' }]
      },
      performAction(state, inv, move, api) {
        if (move.rule === 'm4DrawEncounter') return api.drawEncounter(inv.seat)
        return production.performAction?.(state, inv, move, api)
      },
    },
    manifest: { ...oath.manifest, id: scenarioId, campaignId, status: 'playable', requiredMechanicIds: [], requiredEncounterGroupIds: [], requiredPackIds: ['core', trialPackId], behaviorIds: [scenarioId] },
  }],
})

const state = createGameState({ campaignId, seed: 'repro-hidden', playerInvestigator: '01001' }, [{ seat: 0 }])
console.log('pending after create:', state.pendingChoice?.kind)
console.log('phase', state.phase, 'seat', state.currentSeat, 'scenario', state.scenario?.id)
console.log('scenario action?', legalMoves(state).filter(m => m.action === 'scenarioAction'))
state.currentSeat = 0
state.phase = 'investigation'
state.turnSerial = 1
state.investigators[0].actionsLeft = 20
state.investigators[0].hand = []
state.encounterDeck = ['03084d']
state.encounterDiscard = []
const moves = legalMoves(state).filter(m => m.action === 'scenarioAction')
console.log('moves after reset:', moves)
try {
  const ev = applyMove(state, 0, { action: 'scenarioAction', rule: 'm4DrawEncounter' })
  console.log('events:', ev.map(e => e.text || e.kind || JSON.stringify(e)).slice(0, 10))
} catch (error) {
  console.log('applyMove ERROR:', error.message)
}
console.log('hand', state.investigators[0].hand, 'hidden', state.investigators[0].hiddenCards)
console.log('pending', state.pendingChoice?.kind)
