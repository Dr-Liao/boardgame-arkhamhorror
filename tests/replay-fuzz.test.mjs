// Phase 4 · 重放安全网的门禁（slow tier）：
//   1. **100 局随机对局** replay 与实时执行逐步一致（路线 §6 Phase 4 的门禁）；
//   2. **5,000 步随机走子器**：用现成合法动作列表长时间乱走，断言不变量（路线 §8 的结构性短板）。
//
// 为什么在 slow tier：这两条要跑几百次建局与上万次规则结算，放在 fast 里会把日常回归拖慢；
// fast 里保留同构的缩小版（tests/replay.test.mjs 的 4 局随机走子 + golden 基线）。
//
// 不变量取的是"真的恒成立"的那一组。**牌数守恒**没有按区域计数实现：
// 本引擎允许敌人从遭遇牌库入场（encounterDeck → enemies）、遭遇卡加入手牌/威胁区、
// 剧情资产入场与"移出游戏"，按区域做 multiset 守恒会被这些合法机制误报；
// 这里用"卡号可解析 + 逐步重放等价 + 状态 JSON 幂等"来守住同一类损坏（凭空造卡/丢卡）。

import test from 'node:test'
import assert from 'node:assert/strict'
import { unknownCardCodes } from '../src/engine/engine.js'
import { captureReplayLog, replayHashes, replayLog, stableStringify, stateHash } from '../src/engine/replay.js'
import { createRandomPolicy, playGame } from '../tools/replay-games.mjs'

const CAMPAIGNS = ['nightOfTheZealot', 'theDunwichLegacy', 'thePathToCarcosa', 'theForgottenAge']
const playersFor = count => Array.from({ length: count }, (_, seat) => ({ seat, role: seat === 0 ? 'human' : 'ai' }))

test('100 局随机对局：重放与实时执行逐步一致', { timeout: 600000 }, () => {
  const report = { games: 0, steps: 0, choices: 0, scenarios: new Set(), campaignResults: 0, scenarioResults: 0 }
  for (let index = 0; index < 100; index++) {
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
  assert.equal(report.games, 100)
  assert.ok(report.steps >= 900, `100 局合计步数不应过少（当前 ${report.steps}）`)
  assert.ok(report.scenarios.size >= 3, `100 局至少覆盖 3 个关卡（当前 ${[...report.scenarios].join('、')}）`)
  assert.ok(report.choices >= 100, `随机对局应产生大量待决选择（当前 ${report.choices}）`)
  // P1 起全员败退不再立刻结束战役；短局不一定走到结算，结算覆盖由 golden recipe 与战役用例保证。
})

test('5,000 步随机走子器：不变量、JSON 幂等与关键步重放', { timeout: 900000 }, () => {
  const TARGET_STEPS = 5000
  const totals = { steps: 0, games: 0, replayChecks: 0, jsonChecks: 0, cardChecks: 0 }
  const violations = []

  const record = (message) => { if (violations.length < 20) violations.push(message) }

  const checkState = (state, where) => {
    assert.ok(Number.isSafeInteger(state.revision), `${where}：revision 必须是安全整数`)
    if (state.uiState !== 'inScenario') return
    // 进入新关卡时 setupLocations 可能停在 preScenarioSetup 的故事选择上（locations 尚未铺开），
    // 此时调查员的 startLocation 还没进入 state.locations，不是规则违规。
    if (!state.locations.length) return
    const clueTotal = state.investigators.reduce((sum, inv) => sum + (inv.clues || 0), 0)
    if (state.clues !== clueTotal) record(`${where}：公共线索 ${state.clues} != 个人线索之和 ${clueTotal}`)
    if (state.doom < 0) record(`${where}：议程毁灭为负（${state.doom}）`)
    for (const inv of state.investigators) {
      if (!Number.isInteger(inv.actionsLeft) || inv.actionsLeft < 0) record(`${where}：座位 ${inv.seat} 行动点为负（${inv.actionsLeft}）`)
      if (!Number.isInteger(inv.resources) || inv.resources < 0) record(`${where}：座位 ${inv.seat} 资源为负（${inv.resources}）`)
      if (!inv.defeated && !inv.resigned) {
        if (inv.damage > inv.maxHealth) record(`${where}：座位 ${inv.seat} 未败北但伤害 ${inv.damage} > 上限 ${inv.maxHealth}`)
        if (inv.horror > inv.maxSanity) record(`${where}：座位 ${inv.seat} 未败北但恐惧 ${inv.horror} > 上限 ${inv.maxSanity}`)
      }
      // 已败北/撤退的调查员不再参与地点移动；地点被移除后留在原 id 不是规则违规。
      if (!inv.defeated && !inv.resigned && inv.location
        && !state.locations.some(location => location.id === inv.location)) {
        record(`${where}：座位 ${inv.seat} 在不存在的地点 ${inv.location}`)
      }
      for (const id of inv.engaged || []) {
        if (!state.enemies.some(enemy => enemy.id === id)) record(`${where}：座位 ${inv.seat} 交战了不存在的敌人 ${id}`)
      }
      for (const [zone, value] of [['hand', inv.hand], ['deck', inv.deck], ['discard', inv.discard], ['assets', inv.assets], ['threat', inv.threat]]) {
        if (!Array.isArray(value)) { record(`${where}：座位 ${inv.seat} 的 ${zone} 不是数组`); continue }
        if (value.some(item => !Number.isSafeInteger((item?.uses ?? 0)) || (item?.uses ?? 0) < 0)) record(`${where}：座位 ${inv.seat} 的 ${zone} 出现负数使用次数`)
      }
      for (const asset of inv.assets || []) {
        if ((asset.doom || 0) < 0 || (asset.uses || 0) < 0) record(`${where}：支援 ${asset.code} 的计数为负`)
      }
    }
    const enemyIds = new Set()
    for (const enemy of state.enemies) {
      if (enemyIds.has(enemy.id)) record(`${where}：敌人 id 重复 ${enemy.id}`)
      enemyIds.add(enemy.id)
      if ((enemy.doom || 0) < 0) record(`${where}：敌人 ${enemy.id} 的毁灭为负`)
      if (enemy.location && !state.locations.some(location => location.id === enemy.location)) {
        record(`${where}：敌人 ${enemy.id} 在不存在的地点 ${enemy.location}`)
      }
    }
  }

  for (let game = 0; totals.steps < TARGET_STEPS; game++) {
    const campaignId = CAMPAIGNS[game % CAMPAIGNS.length]
    const seed = `walker-${game}`
    const result = playGame({
      settings: { campaignHub: true, campaignId, seed, rulesMode: game % 2 ? 'strict' : 'simplified' },
      players: playersFor(1 + (game % 4)),
      policy: createRandomPolicy(seed),
      steps: 400,
      onStep(state, index) {
        const where = `${seed}#${index}`
        checkState(state, where)
        if (index > 0) {
          totals.steps++
          assert.equal(state.revision, index, `${where}：每次成功动作必须恰好 +1 revision`)
          if (index % 100 === 0) {
            totals.jsonChecks++
            assert.equal(stableStringify(JSON.parse(JSON.stringify(state))), stableStringify(state),
              `${where}：状态 JSON 往返必须幂等`)
          }
          if (index % 100 === 0 && state.uiState === 'inScenario') {
            totals.cardChecks++
            assert.deepEqual(unknownCardCodes(state), [], `${where}：状态里出现无法解析的卡号`)
          }
        }
      },
    })
    totals.games++
    assert.ok(result.hashes.length > 1, `${seed}：随机走子一局都没走成`)
    if (totals.games <= 3) {
      totals.replayChecks++
      assert.deepEqual(replayHashes(result.log), result.hashes, `${seed}：整局重放的逐步指纹必须一致`)
    }
    if (violations.length) break
  }
  assert.deepEqual(violations, [], `随机走子器发现 ${violations.length} 条不变量违反`)
  assert.ok(totals.steps >= TARGET_STEPS, `走子总步数不足（${totals.steps}/${TARGET_STEPS}）`)
  assert.ok(totals.games >= 5, `至少应跨多局乱走（当前 ${totals.games} 局）`)
  assert.ok(totals.replayChecks >= 1 && totals.jsonChecks >= 10, `检查点数量不足：${JSON.stringify(totals)}`)

  // 走子器的状态本身也要能被日志重放（抽一局整局校验，避免只验证到局部）。
  const last = playGame({
    settings: { campaignHub: true, campaignId: CAMPAIGNS[0], seed: 'walker-replay' },
    players: playersFor(2),
    policy: createRandomPolicy('walker-replay'),
    steps: 120,
  })
  assert.deepEqual(replayHashes(captureReplayLog(last.state)), last.hashes)
  assert.equal(stateHash(replayLog(last.log)), last.hashes[last.hashes.length - 1])
})
