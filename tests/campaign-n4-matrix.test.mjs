// N4 合法战役失败流程矩阵：只提交合法动作/选择，把 1、2、4 人（标准难度）各跑完一整局。
//
// 2026-10-24 P0 从 campaign-n4.test.mjs 拆出：
// - 原 7 组（1 人 × easy/standard/hard/expert，2/3/4 人 × standard）里 4 人组单跑就 ~13s、整组 30s+；
//   难度差异主要由混沌袋决定（有独立用例覆盖），这里保留 1/2/4 人 + standard，4 人组覆盖多人交错行动。
// - 每步深拷贝改为每 20 步抽样一次（命令仍逐步 clone）：保留"仅靠合法命令行进"的检测，
//   同时避免 7×900 次整份 state JSON 往返（引擎重活，见 P0 审计）。
// 独立文件让矩阵与 campaign-n4 其余用例按文件并行。
import test from 'node:test'
import assert from 'node:assert/strict'
import { createGameState, applyMove, legalMoves, validateMove, decisionSeat } from '../src/engine/engine.js'
import { clone } from './campaign-n4-fixture.mjs'

for (const [count, difficulty] of [[1, 'standard'], [2, 'standard'], [4, 'standard']]) test(`N4 合法战役失败流程 ${count}人/${difficulty}：从正式开局仅提交动作与选择，不改状态`, () => {
  let state = createGameState({ playerInvestigator: '01001', seed: 'n4-legal-campaign', difficulty }, Array.from({ length: count }, (_, seat) => ({ seat })))
  const commands = []
  for (let i = 0; state.status === 'playing' && i < 900; i++) {
    const choices = legalMoves(state)
    assert.ok(choices.length)
    const command = state.pendingChoice
      ? choices.find(item => ['done', 'skip', 'self'].includes(item.optionId)) || choices[0]
      : choices.find(item => item.action === 'resign') || choices.find(item => item.action === 'endTurn')
    assert.ok(command)
    commands.push(clone(command))
    const seat = decisionSeat(state)
    assert.equal(validateMove(state, seat, command), null)
    applyMove(state, seat, command)
    if ((i + 1) % 20 === 0) state = clone(state)
  }
  assert.equal(state.status, 'over', `未完成，命令数 ${commands.length}`)
  assert.deepEqual(state.campaign.scenarioResults.map(result => result.scenarioId), ['theGathering', 'theMidnightMasks', 'theDevourerBelow'])
  assert.equal(state.outcome, 'defeat')
  assert.ok(commands.length > 10)
})
