// 探针：观察真实大厅局进入第一章后的状态形状与合法动作，为 run-through 驱动策略取样。
import {
  loadEoteWorld, createHubGame, hubSetup, settleChoices, legalFor,
  decisionSeat, actingSeats, playMove, INVESTIGATOR_CODES,
} from '../../../../../tests/eote-p8-fixture.mjs'

const world = await loadEoteWorld()
const state = createHubGame(world, { seats: 2, seed: 'probe', investigatorCodes: INVESTIGATOR_CODES.slice(0, 2) })
hubSetup(world, state, { investigatorCodes: INVESTIGATOR_CODES.slice(0, 2) })

console.log('uiState=', state.uiState, 'scenario=', state.scenario?.id, 'phase=', state.phase, 'round=', state.round)
console.log('status=', state.status, 'doom=', state.doom, 'actIndex=', state.actIndex, 'agendaIndex=', state.agendaIndex)
console.log('actingSeats=', actingSeats(world, state), 'decisionSeat=', decisionSeat(world, state))
console.log('locations=', state.locations.map(location => `${location.id}${location.revealed ? '' : '(hidden)'}:clues${location.clues}`).join(','))
console.log('encounterDeck=', state.encounterDeck?.length, 'setAside=', state.scenarioZones?.setAside?.length)
console.log('chaosBag=', state.chaosBag?.join(','))
console.log('investigators=', state.investigators.map(inv => `seat${inv.seat}@${inv.location} hp${inv.damage}/${inv.horror} clues${inv.clues} res${inv.resources} actions?`).join(' | '))
const moves = legalFor(world, state, decisionSeat(world, state))
console.log('moves=' + moves.map(move => `${move.action}${move.locationId ? ':' + move.locationId : ''}${move.enemyId ? ':' + move.enemyId : ''}${move.rule ? ':' + move.rule : ''}${move.cardId ? ':' + move.cardId : ''}`).join(', '))
console.log('pendingChoice=', state.pendingChoice?.kind || null, state.pendingChoice?.options?.map(option => option.id))
