// Phase 4 · 重放安全网门禁（slow tier）之「随机对局重放」：
//   N 局随机对局，replay 与实时执行逐步一致（路线 §6 Phase 4 的门禁）。
//   「5,000 步随机走子器」拆到 replay-fuzz-walker.test.mjs（路线 §8 的结构性短板），两文件按文件并行。
//
// 2026-10-24 P0 拆分与减量（引擎变重后实测：100 局单跑 ≈111s）：
// - 默认 40 局；完整口径用环境变量恢复：
//     REPLAY_FUZZ_FULL=1 node --test tests/replay-fuzz.test.mjs tests/replay-fuzz-walker.test.mjs
//   40 局仍保持 4 战役 × 4 座位 × 3 难度轮转，覆盖"重放与实时执行逐步一致 / 日志 JSON 往返一致"。
// - 为什么在 slow tier：几百次建局与上万次规则结算，放 fast 会把日常回归拖慢；
//   fast 里保留同构的缩小版（tests/replay.test.mjs 的 4 局随机走子 + golden 基线）。

import test from 'node:test'
import assert from 'node:assert/strict'
import { replayHashes } from '../src/engine/replay.js'
import { createRandomPolicy, playGame } from '../tools/replay-games.mjs'

const FULL = process.env.REPLAY_FUZZ_FULL === '1'
const GAMES = FULL ? 100 : 40
const MIN_STEPS = FULL ? 900 : 350
const MIN_CHOICES = FULL ? 100 : 40
const CAMPAIGNS = ['nightOfTheZealot', 'theDunwichLegacy', 'thePathToCarcosa', 'theForgottenAge']
const playersFor = count => Array.from({ length: count }, (_, seat) => ({ seat, role: seat === 0 ? 'human' : 'ai' }))

test(`${GAMES} 局随机对局：重放与实时执行逐步一致`, { timeout: 600000 }, () => {
  const report = { games: 0, steps: 0, choices: 0, scenarios: new Set(), campaignResults: 0, scenarioResults: 0 }
  for (let index = 0; index < GAMES; index++) {
    const campaignId = CAMPAIGNS[index % CAMPAIGNS.length]
    const seats = 1 + (index % 4)
    const seed = `fuzz-${index}`
    const game = playGame({
      settings: {
        campaignHub: true,
        campaignId,
        seed,
        rulesMode: index % 3 === 0 ? 'strict' : 'simplified',
        aiStoryAwareness: index % 5 === 0 ? 'on' : 'off',
        difficulty: ['easy', 'standard', 'hard'][index % 3],
      },
      players: playersFor(seats),
      policy: createRandomPolicy(seed),
      // 局外准备按席位线性增长（4 人局要 23 步才进关）；这样每条对局都能走到"进关 + 场景行动"。
      steps: 8 + 5 * seats,
    })
    const moves = game.hashes.length - 1
    assert.ok(moves > 0, `${seed}：随机走子一局都没走成`)
    assert.equal(game.state.revision, moves, `${seed}：每次成功动作必须恰好 +1 revision`)
    assert.deepEqual(replayHashes(game.log), game.hashes, `${seed}：重放与实时执行的逐步指纹必须一致`)
    if (index % 10 === 0) {
      const restored = JSON.parse(JSON.stringify(game.log))
      assert.deepEqual(replayHashes(restored), game.hashes, `${seed}：日志 JSON 往返后仍要一致`)
    }
    const scenario = game.state.scenario?.id ?? null
    if (scenario) report.scenarios.add(scenario)
    if (game.state.uiState === 'campaignResult') report.campaignResults++
    if (game.state.uiState === 'scenarioResult') report.scenarioResults++
    report.choices += game.log.moves.filter(entry => entry.move.action === 'choose').length
    report.games++
    report.steps += moves
  }
  assert.equal(report.games, GAMES)
  assert.ok(report.steps >= MIN_STEPS, `${GAMES} 局合计步数不应过少（当前 ${report.steps}）`)
  assert.ok(report.scenarios.size >= 3, `${GAMES} 局至少覆盖 3 个关卡（当前 ${[...report.scenarios].join('、')}）`)
  assert.ok(report.choices >= MIN_CHOICES, `随机对局应产生大量待决选择（当前 ${report.choices}）`)
  // P1 起全员败退不再立刻结束战役；短局不一定走到结算，结算覆盖由 golden recipe 与战役用例保证。
})
