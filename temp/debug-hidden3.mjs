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

function settle(state) {
  for (let guard = 0; state.pendingChoice; guard++) {
    if (guard > 200) throw new Error('choice loop')
    const pending = state.pendingChoice
    const optionId = pending.options.find(option => ['done', 'skip'].includes(option.id))?.id || pending.options[0].id
    applyMove(state, pending.seat, { action: 'choose', choiceId: pending.id, optionId })
  }
}

const state = createGameState({ campaignId, seed: 'repro-hidden', playerInvestigator: '01001' }, [{ seat: 0 }])
settle(state)
console.log('after settle phase:', state.phase, 'seat:', state.currentSeat, 'pending:', state.pendingChoice?.kind)
state.currentSeat = 0
state.phase = 'investigation'
state.turnSerial = 1
const inv = state.investigators[0]
inv.actionsLeft = 20
inv.hand = []
inv.discard = []
inv.hiddenCards = []
inv.assets = []
inv.threat = []
state.enemies = []
console.log('scenario id:', state.scenario?.id)
console.log('treachery 03084d def:', JSON.stringify(state.scenario?.treacheries?.['03084d'])?.slice(0, 300))
console.log('legal scenario actions:', legalMoves(state).filter(m => m.action === 'scenarioAction').map(m => m.rule))
state.encounterDeck = ['03084d']
state.encounterDiscard = []
try {
  const events = applyMove(state, 0, { action: 'scenarioAction', rule: 'm4DrawEncounter' })
  console.log('event texts:', events.map(e => e.text).filter(Boolean).slice(0, 6))
  settle(state)
} catch (error) {
  console.log('ERROR:', error.message)
}
console.log('hand:', inv.hand, 'hiddenCards:', inv.hiddenCards, 'discard:', inv.discard, 'encounterDiscard:', state.encounterDiscard)
