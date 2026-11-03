// P9.5：并行 4 人 2+2 全四个章对的真实引擎验收（补齐矩阵/门禁 10 的「多章对」边界）。
//
// 只驱动 mod 边界（mod.applyMove / advanceParallelPair），不 mock 引擎：
//   · 两条线各 2 个座位，分别跑《梦境门外》/《清醒噩梦》起步；
//   · 每个章对：两线分别用 debug endScenario 真实结算 → 双封盘 → advanceParallelPair 自动走完
//     本线幕间 I（单线 flow 变体）并开下一章；
//   · 章对 1–3 断章对屏障与 `interludeApplied` 幂等；章对 4 两线各自走到 `campaignResult`/end。
// 注：parallel 两条线当前各跑自己的单线 flow（4 章 + 幕间 I + 单线尾声），共享幕间 II/III 与
// 16 段尾声矩阵只在 pick 双线 flow 接线——这是 P9.5 报告 §8 的已知边界，不是本用例的断言目标。
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  loadTdeCampaignWorld, hubSetup, hubBegin, finishParallelSharedStory, settleParallelLaneChoices, serializeContainer, restoreContainer,
} from './tde-p95-fixture.mjs'

const LANES = ['A', 'B']

function resolutionKeyOf(laneState) {
  const scenario = laneState.scenario || {}
  const resolutions = scenario.resolutions
  const keys = Array.isArray(resolutions)
    ? resolutions.map(item => item.key ?? item.id ?? item)
    : Object.keys(resolutions || {})
  return keys.includes('resolution1') ? 'resolution1' : keys[0]
}

test('P9.5 G10 并行 4 人 2+2 四个章对全流程：双封盘、幕间单次、终局各自 campaignResult', async () => {
  const world = await loadTdeCampaignWorld()
  const { engine, mod, parallelRuntime } = world
  const state = hubSetup(engine, { seats: 4, mode: 'parallel', seed: 'p95-parallel-full' })
  hubBegin(engine, state, { viaMod: true, mod })
  assert.deepEqual(LANES.map(lane => state.parallel.lanes[lane].scenario.id),
    ['beyondTheGatesOfSleep', 'wakingNightmare'])
  assert.deepEqual(LANES.map(lane => state.parallel.lanes[lane].laneRuntime.roomSeats),
    [[0, 1], [2, 3]])

  const expectedNext = {
    1: ['theSearchForKadath', 'aThousandShapesOfHorror'],
    2: ['darkSideOfTheMoon', 'pointOfNoReturn'],
    3: ['whereTheGodsDwell', 'weaverOfTheCosmos'],
  }
  for (let pair = 1; pair <= 4; pair += 1) {
    for (const lane of LANES) {
      const laneState = state.parallel.lanes[lane]
      settleParallelLaneChoices(engine, mod, state)
      mod.applyMove(state, laneState.laneRuntime.roomSeats[0],
        { action: 'debug', kind: 'endScenario', resolutionKey: resolutionKeyOf(laneState) })
      settleParallelLaneChoices(engine, mod, state)
      if (pair < 4) assert.equal(laneState.uiState, 'scenarioResult')
    }
    if (pair === 4) {
      parallelRuntime.advanceParallelPair(state,pair)
      finishParallelSharedStory(engine,mod,state,{beginNext:false})
      assert.equal(state.parallel.ending.campaign.finished,true)
      // 两线已完成，协调器结算共享尾声。
      for (const lane of LANES) {
        assert.equal(state.parallel.lanes[lane].uiState, 'campaignResult')
        assert.equal(state.parallel.lanes[lane].status, 'over')
        assert.ok(state.parallel.lanes[lane].campaign.epilogueNumber)
      }
      break
    }
    assert.deepEqual(Object.keys(state.parallel.sealed).sort(), ['1', '2', '3'].slice(0, pair))
    const advanced = parallelRuntime.advanceParallelPair(state, pair)
    assert.equal(advanced.ok, true, JSON.stringify(advanced))
    finishParallelSharedStory(engine,mod,state)
    const second = parallelRuntime.advanceParallelPair(state, pair)
    assert.deepEqual(second, { ok: true, alreadyApplied: true, pairId: pair, advanced: {} })
    LANES.forEach((lane, index) => {
      const laneState = state.parallel.lanes[lane]
      assert.equal(laneState.scenario.id, expectedNext[pair][index])
      assert.equal(laneState.uiState, 'inScenario')
      assert.equal(laneState.campaign.scenarioIndex, pair)
    })
    assert.deepEqual(Object.keys(state.parallel.interludeApplied).map(Number).sort(), [1, 2, 3].slice(0, pair))
  }

  assert.equal(state.status, 'ended')
  assert.equal(state.uiState, 'campaignResult')
  // 单文件存档 → 读档逐字节一致，且读档后仍是终局（读档不重新结算封盘/幕间）。
  const text = serializeContainer(world, state)
  const restored = restoreContainer(world, text)
  assert.equal(serializeContainer(world, restored), text)
  assert.deepEqual(Object.keys(restored.parallel.interludeApplied).map(Number).sort(), [1, 2, 3, 4])
})
