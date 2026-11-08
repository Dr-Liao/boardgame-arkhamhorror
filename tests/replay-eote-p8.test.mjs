// P8《地球边缘》replay 验收：固定 seed / 固定脚本 / 逐步骤状态指纹。
// 基线 `tests/fixtures/replay/eote-p8-baseline.json` 由同一条真实大厅脚本生成；
// 若基线内容与本文件脚本版本不一致，用例会显式失败并提示重新生成（不要手改基线）。
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {
  loadEoteWorld, INVESTIGATOR_CODES, createHubGame, hubSetup, finishScenario,
  continueFromResult, beginChapter, hashState,
} from './eote-p8-fixture.mjs'

const BASELINE = new URL('./fixtures/replay/eote-p8-baseline.json', import.meta.url)
const SCRIPT = Object.freeze({
  seed: 'eote-p8-replay-baseline', seats: 2, difficulty: 'standard', upgrades: false,
  answer: { checkpoint2Choice: 'stand', interlude1DoorChoice: 'ignore' },
})

const world = await loadEoteWorld()

function storySelect(choice, state) {
  const wanted = SCRIPT.answer[state.campaign?.flow?.nodeId]
  if (!wanted) return null
  return choice.options.some(option => option.id === wanted) ? wanted : null
}

/** 跑固定脚本：建局 → 大厅准备 → 前 3 章（在触发已知内容缺陷的章节之前停止）。返回逐步骤指纹。 */
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

test('P8 eote replay 固定 seed 逐步骤指纹与基线一致', () => {
  const run = runScript()
  const second = runScript()
  assert.deepEqual(run.steps.map(step => step.hash), second.steps.map(step => step.hash), '同 seed 两次运行指纹必须一致')
  assert.deepEqual(run.scenarios, second.scenarios)
  assert.deepEqual(run.scenarios.slice(0, 3), ['iceAndDeathPart1', 'iceAndDeathPart2', 'iceAndDeathPart3'])
  assert.ok(fs.existsSync(BASELINE), '缺少 replay 基线文件')
  const baseline = JSON.parse(fs.readFileSync(BASELINE, 'utf8'))
  assert.equal(baseline.script.seed, SCRIPT.seed, '基线 seed 与脚本不一致，请重新生成基线')
  assert.deepEqual(baseline.scenarios, run.scenarios, '章节序列与基线不一致')
  assert.deepEqual(baseline.steps.map(step => step.hash), run.steps.map(step => step.hash), '逐步骤状态指纹与基线不一致')
  assert.equal(baseline.steps.length, run.steps.length)
})

test('P8 eote replay 基线记录行为元数据（label/uiState/scenarioId）', () => {
  const run = runScript()
  const baseline = JSON.parse(fs.readFileSync(BASELINE, 'utf8'))
  assert.deepEqual(baseline.steps.map(step => step.label), run.steps.map(step => step.label))
  assert.deepEqual(baseline.steps.map(step => step.uiState), run.steps.map(step => step.uiState))
  assert.deepEqual(baseline.steps.map(step => step.scenarioId ?? null), run.steps.map(step => step.scenarioId ?? null))
})
