// 重新生成 tests/fixtures/replay/eote-p8-baseline.json。
//
// 背景：本轮 P0 修复有意改变了 EOTE 章节 setup/推进/结算行为（P0-1..P0-8/12/13），
// replay-eote-p8.test.mjs 的「逐步状态指纹与基线一致」按设计会失败；这是**预期变化**，
// 不是回归。该测试文件开头明确要求「基线由同一条真实大厅脚本生成，内容/脚本版本不一致时
// 重新生成，不要手改基线」。本脚本复制该测试的 runScript 逻辑（真实引擎路径），
// 断言同 seed 两次运行一致后写盘。
//
// 运行（在 games/arkhamhorror 下）：
//   node docs/edgeOfTheEarth/eote-scan/repair/regen-eote-p8-baseline.mjs [--write]
// 不带 --write 时只打印新基线摘要（dry run）。
import fs from 'node:fs'
import assert from 'node:assert/strict'
import {
  loadEoteWorld, INVESTIGATOR_CODES, createHubGame, hubSetup, finishScenario,
  continueFromResult, beginChapter, hashState,
} from '../../../../tests/eote-p8-fixture.mjs'

const SCRIPT = Object.freeze({
  seed: 'eote-p8-replay-baseline', seats: 2, difficulty: 'standard', upgrades: false,
  answer: { checkpoint2Choice: 'stand', interlude1DoorChoice: 'ignore' },
})
const BASELINE = new URL('../../../../tests/fixtures/replay/eote-p8-baseline.json', import.meta.url)

const world = await loadEoteWorld()

function storySelect(choice, state) {
  const wanted = SCRIPT.answer[state.campaign?.flow?.nodeId]
  if (!wanted) return null
  return choice.options.some(option => option.id === wanted) ? wanted : null
}

function runScript() {
  const codes = INVESTIGATOR_CODES.slice(0, 2)
  const state = createHubGame(world, {
    seats: SCRIPT.seats, seed: SCRIPT.seed, difficulty: SCRIPT.difficulty, investigatorCodes: codes,
  })
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
      assert.equal(state.uiState, 'scenarioSetup', `第 ${index + 1} 章之后应进入下一章准备`)
      beginChapter(world, state)
      snap(`chapter${index + 1}:next`)
    }
  }
  return { steps, scenarios, finalUiState: state.uiState }
}

const first = runScript()
const second = runScript()
assert.deepEqual(first.steps.map(step => step.hash), second.steps.map(step => step.hash), '同 seed 两次运行指纹必须一致')
assert.deepEqual(first.scenarios, second.scenarios, '两次运行的章节序列必须一致')

const baseline = {
  schemaVersion: 1,
  script: SCRIPT,
  scenarios: first.scenarios,
  steps: first.steps,
}

const rendered = `${JSON.stringify(baseline, null, 2)}\n`
const current = fs.existsSync(BASELINE) ? fs.readFileSync(BASELINE, 'utf8') : null
console.log('scripts:', first.scenarios.join(' -> '))
console.log('steps:', baseline.steps.length)
console.log('steps[0]:', JSON.stringify(baseline.steps[0]))
console.log('steps[last]:', JSON.stringify(baseline.steps.at(-1)))
if (current === rendered) {
  console.log('与现有基线的规范化内容一致，无需写盘。')
} else if (process.argv.includes('--write')) {
  fs.writeFileSync(BASELINE, rendered, 'utf8')
  console.log('已写入', BASELINE.pathname)
} else {
  console.log('与现有基线不同；加 --write 写盘。')
}
