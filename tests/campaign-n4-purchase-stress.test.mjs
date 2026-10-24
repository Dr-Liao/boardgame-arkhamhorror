// N4 取消购卡压测：连续"进升级 →（隔轮买 01094）→ 取消"，验证不累积旧事务答案、不锁局、不重复奖励。
//
// 为什么单独成文件：一次事务要克隆整份 state（引擎重活，见 2026-10-24 P0 审计），
// 实测 300 轮 ≈460s，是本仓库最重的单条用例。默认降到 50 轮——"连续多轮取消"的回归语义不变，
// 但不再拖住整个 slow tier；要跑原来的压测深度时：
//   N4_CANCEL_LOOPS=300 node --test tests/campaign-n4-purchase-stress.test.mjs
// 独立文件让它与 campaign-n4 其余用例（以及矩阵、replay-fuzz）按文件并行。
import test from 'node:test'
import assert from 'node:assert/strict'
import { clone, game, gatheringConclusion, answer, finishInterlude } from './campaign-n4-fixture.mjs'

const CANCEL_LOOPS = Number(process.env.N4_CANCEL_LOOPS ?? 50)

test(`N4 连续 ${CANCEL_LOOPS} 次取消购卡不累积旧事务答案、不锁局、不重复奖励`, () => {
  const state = game()
  gatheringConclusion(state)
  const initial = clone(state.campaign.investigators[0])
  for (let i = 0; i < CANCEL_LOOPS; i++) {
    answer(state, 'upgrade')
    if (i % 2) answer(state, '01094')
    answer(state, 'cancel')
    assert.equal(state.pendingChoice.kind, 'interlude')
    assert.equal(state.continuation.answers.length, 0)
    assert.equal(state.continuation.move.action, 'interlude')
  }
  assert.deepEqual(clone(state.campaign.investigators[0]), initial)
  const restored = clone(state)
  finishInterlude(state); finishInterlude(restored)
  assert.deepEqual(clone(state), restored)
  assert.equal(state.scenario.id, 'theMidnightMasks')
  assert.equal(state.campaign.scenarioResults.length, 1)
})
