// 鎺㈤拡 2b锛氬ぇ鍘呭缓灞€ 鈫?搴忓箷 鈫?绗竴绔狅紝瑙傚療 uiState/flow node/寰呭喅閫夋嫨锛堜慨姝ｅ姩浣滀紭鍏堢骇锛夈€?import {
  loadEoteWorld, createHubGame, settleChoices, legalFor,
  decisionSeat, playMove, INVESTIGATOR_CODES,
} from '../../../../../tests/eote-p8-fixture.mjs'

const world = await loadEoteWorld()
const codes = INVESTIGATOR_CODES.slice(0, 2)
const state = createHubGame(world, { seats: 2, seed: 'probe2b', investigatorCodes: codes })
const snap = () => `uiState=${state.uiState} node=${state.campaign?.flow?.nodeId} status=${state.status} scenario=${state.scenario?.id} pending=${state.pendingChoice?.kind || null}`
console.log('create:', snap())

const PRIORITY = ['hubSetLeader', 'hubSelectScenario', 'hubGoSetup',
  'hubSelectInvestigator', 'hubAutoDeck', 'hubDoneSeat', 'hubBeginScenario', 'hubContinue',
  'choose']

for (let guard = 0; guard < 120; guard++) {
  settleChoices(world, state)
  if (state.uiState === 'inScenario') break
  if (state.pendingChoice) {
    const choice = state.pendingChoice
    console.log(`pending choice kind=${choice.kind} options=${choice.options?.map(o => o.id).join(',')}`)
    playMove(world, state, { action: 'choose', choiceId: choice.id, optionId: choice.options[0].id }, choice.seat)
    console.log('  ->', snap())
    continue
  }
  const seat = decisionSeat(world, state)
  const moves = legalFor(world, state, seat)
  const move = PRIORITY.map(action => moves.find(m => m.action === action)).find(Boolean) || moves[0]
  if (!move) { console.log('NO MOVES', snap(), moves.map(m => m.action)); break }
  playMove(world, state, move, seat)
  console.log(`play ${move.action}${move.code ? '(' + move.code + ')' : ''} seat=${seat} ->`, snap())
}
console.log('flow history=', JSON.stringify((state.campaign?.flow?.history || []).map(h => h.nodeId || h.id || h)))
console.log('flowState=', JSON.stringify({ nodeId: state.campaign?.flow?.nodeId, pending: state.campaign?.flow?.pending, completed: state.campaign?.completedSteps }).slice(0, 500))
console.log('records=', JSON.stringify(Object.fromEntries(Object.entries(state.campaign?.records || {}).filter(([, v]) => v !== false && v !== 0 && !(Array.isArray(v) && !v.length)))).slice(0, 900))

