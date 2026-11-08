// 复现古老者之城（cityOfTheElderThings）真实引擎 scenarioAction 崩溃：抓完整堆栈 + 待决选择形状。
import {
  loadEoteWorld, createHubGame, hubSetup, settleChoices, legalFor, decisionSeat,
  playMove, beginChapter, finishScenario, continueFromResult, INVESTIGATOR_CODES,
} from '../../../../../tests/eote-p8-fixture.mjs'

const world = await loadEoteWorld()
const codes = INVESTIGATOR_CODES.slice(0, 2)
const state = createHubGame(world, { seats: 2, seed: 'probe-city', investigatorCodes: codes })
hubSetup(world, state, { investigatorCodes: codes })
const answers = { checkpoint1Choice: 'search', checkpoint2Choice: 'stand', interlude1DoorChoice: 'ignore', interlude2Night2: 'ignore', interlude3Night4Choice: 'ignore' }
const storySelect = (choice, st) => {
  const wanted = answers[st.campaign?.flow?.nodeId]
  if (!wanted) return null
  return choice.options.some(option => option.id === wanted) ? wanted : null
}
const priority = ['resolution1', 'victory', 'noResolution']
function keyFor (st) {
  const keys = Object.keys(st.scenario?.resolutions || {})
  for (const key of priority) if (keys.includes(key)) return key
  return keys[0]
}
for (let guard = 0; guard < 12 && state.scenario?.id !== 'cityOfTheElderThings'; guard++) {
  if (!state.uiState.includes('ScenarioReason') && state.uiState !== 'inScenario') break
  finishScenario(world, state, keyFor(state), storySelect)
  continueFromResult(world, state, { upgrades: false, storySelect })
  if (state.status !== 'playing') break
  if (state.uiState === 'scenarioSetup') beginChapter(world, state)
  console.log('reached', state.scenario?.id, state.uiState)
}
settleChoices(world, state)
console.log('city state:', state.uiState, state.scenario?.id)
const seat = decisionSeat(world, state)
const moves = legalFor(world, state, seat)
console.log('moves:', moves.map(move => `${move.action}${move.rule ? ':' + move.rule : ''}${move.locationId ? ':' + move.locationId : ''}`).join(', '))
const target = moves.find(move => move.action === 'scenarioAction') || moves.find(move => move.action === 'investigate')
console.log('playing', JSON.stringify(target))
try {
  playMove(world, state, target, seat)
  console.log('ok uiState=', state.uiState, 'pending=', JSON.stringify(state.pendingChoice?.kind))
} catch (error) {
  console.log('THROWN:', error?.message)
  console.log(String(error?.stack || '').split('\n').slice(0, 25).join('\n'))
}
settleChoices(world, state)
console.log('after settle pending=', JSON.stringify(state.pendingChoice && { kind: state.pendingChoice.kind, source: state.pendingChoice.source, options: state.pendingChoice.options?.length }))
