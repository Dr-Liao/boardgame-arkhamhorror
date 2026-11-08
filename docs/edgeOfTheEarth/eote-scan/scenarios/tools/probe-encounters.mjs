// 探针：用引擎调试指令强制抽取 EOTE 章节专用诡计，验证章节 behavior 的遭遇处理器是否可被真实
// 引擎到达、是否会因 api.test 形参不一致抛错（toTheForbiddenPeaks 08611–08613 / city 08644–08645）。
import {
  loadEoteWorld, createHubGame, hubSetup, settleChoices, decisionSeat,
  playMove, beginChapter, finishScenario, continueFromResult, INVESTIGATOR_CODES,
} from '../../../../../tests/eote-p8-fixture.mjs'

const world = await loadEoteWorld()
const codes = INVESTIGATOR_CODES.slice(0, 2)
const answers = { checkpoint1Choice: 'search', checkpoint2Choice: 'stand', interlude1DoorChoice: 'ignore', interlude2Night2: 'ignore', interlude3Night4Choice: 'ignore' }
const storySelect = (choice, state) => {
  const wanted = answers[state.campaign?.flow?.nodeId]
  if (!wanted) return null
  return choice.options.some(option => option.id === wanted) ? wanted : null
}
const PRIORITY = ['resolution1', 'victory', 'noResolution']
const keyFor = state => {
  const keys = Object.keys(state.scenario?.resolutions || {})
  for (const key of PRIORITY) if (keys.includes(key)) return key
  return keys[0]
}

function reachScenario (targetId) {
  const state = createHubGame(world, { seats: 2, seed: `enc-${targetId}`, investigatorCodes: codes })
  hubSetup(world, state, { investigatorCodes: codes })
  for (let hop = 0; hop < 10; hop++) {
    if (state.scenario?.id === targetId) return state
    if (state.status !== 'playing' || state.uiState !== 'inScenario') return null
    settleChoices(world, state)
    finishScenario(world, state, keyFor(state), storySelect)
    if (state.status !== 'playing') return null
    continueFromResult(world, state, { upgrades: false, storySelect })
    if (state.status !== 'playing' || state.uiState !== 'scenarioSetup') return null
    beginChapter(world, state)
  }
  return null
}

function forceEncounter (state, code) {
  const before = { uiState: state.uiState, damage: state.investigators.map(inv => inv.damage), horror: state.investigators.map(inv => inv.horror) }
  try {
    playMove(world, state, { action: 'debug', kind: 'encounter', code, targetSeat: 0 }, decisionSeat(world, state) ?? 0)
    settleChoices(world, state)
    return { code, ok: true, before, after: { uiState: state.uiState, damage: state.investigators.map(inv => inv.damage), horror: state.investigators.map(inv => inv.horror) } }
  } catch (error) {
    return { code, ok: false, message: String(error?.message || error), stack: String(error?.stack || '').split('\n').slice(0, 12) }
  }
}

const out = {}
for (const [targetId, encounterCodes] of [
  ['toTheForbiddenPeaks', ['08611', '08612', '08613']],
  ['cityOfTheElderThings', ['08644', '08645']],
]) {
  const state = reachScenario(targetId)
  if (!state) { out[targetId] = { reached: false }; continue }
  out[targetId] = { reached: true, scenarioId: state.scenario?.id, results: encounterCodes.map(code => forceEncounter(state, code)) }
}
console.log(JSON.stringify(out, null, 1))
