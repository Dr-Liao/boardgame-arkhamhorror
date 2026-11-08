// 重新生成 EOTE P8 replay 基线（内容正文改变导致状态指纹变化；脚本与 tests/replay-eote-p8.test.mjs 一致）。
// 用法：node docs/edgeOfTheEarth/translate/tools/regen-eote-replay-baseline.mjs
import fs from 'node:fs'
import {
  loadEoteWorld, INVESTIGATOR_CODES, createHubGame, hubSetup, finishScenario,
  continueFromResult, beginChapter, hashState,
} from '../../../../tests/eote-p8-fixture.mjs'

const BASELINE = 'G:/boardgame-hall-ai/games/arkhamhorror/tests/fixtures/replay/eote-p8-baseline.json'
const SCRIPT = {
  seed: 'eote-p8-replay-baseline', seats: 2, difficulty: 'standard', upgrades: false,
  answer: { checkpoint2Choice: 'stand', interlude1DoorChoice: 'ignore' },
}

const world = await loadEoteWorld()
function storySelect(choice, state) {
  const wanted = SCRIPT.answer[state.campaign?.flow?.nodeId]
  if (!wanted) return null
  return choice.options.some(option => option.id === wanted) ? wanted : null
}
const codes = INVESTIGATOR_CODES.slice(0, 2)
const state = createHubGame(world, { seats: SCRIPT.seats, seed: SCRIPT.seed, difficulty: SCRIPT.difficulty, investigatorCodes: codes })
const steps = []
const snap = (label, extra = {}) => steps.push({ label, hash: hashState(state), uiState: state.uiState, scenarioId: state.scenario?.id ?? null, ...extra })
snap('create')
hubSetup(world, state, { investigatorCodes: codes })
snap('chapter1:start')
const scenarios = []
for (let index = 0; index < 3; index += 1) {
  scenarios.push(state.scenario.id)
  finishScenario(world, state, Object.keys(state.scenario.resolutions)[0])
  snap(`chapter${index + 1}:result`)
  const info = continueFromResult(world, state, { upgrades: SCRIPT.upgrades, storySelect })
  snap(`chapter${index + 1}:continue`, { nodes: info.nodes })
  if (index < 2) {
    beginChapter(world, state)
    snap(`chapter${index + 1}:next`)
  }
}
const baseline = { schemaVersion: 1, script: SCRIPT, scenarios, steps }
fs.writeFileSync(BASELINE, JSON.stringify(baseline, null, 2) + '\n')
console.log('written', BASELINE, 'steps', steps.length, 'scenarios', scenarios)
