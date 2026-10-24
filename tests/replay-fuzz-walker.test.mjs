// Phase 4 · 重放安全网门禁（slow tier）之「随机走子器」：
//   用现成合法动作列表长时间乱走（路线 §8 的结构性短板），断言状态不变量、JSON 幂等与关键步重放。
//
// 2026-10-24 P0 从 replay-fuzz.test.mjs 拆出，并把"每步 stateHash"从乱走主循环里去掉：
//   旧实现复用 playGame，每一步都做一次整份 state 的稳定哈希（实测 ~265ms/步），
//   但乱走阶段的不变量检查根本不需要逐步骤哈希——哈希只在最后"日志能重放出同一状态"时用两次。
//   改为直接用 nextMove/applyMove 驱动（单步成本 ~50ms），默认 400 步；
//   完整口径（2,000 步）：
//     REPLAY_FUZZ_FULL=1 node --test tests/replay-fuzz-walker.test.mjs
//   拆分后与"随机对局重放"并行，slow tier 墙钟取两者较大者而非相加。
//
// 不变量取的是"真的恒成立"的那一组。**牌数守恒**没有按区域计数实现：
// 本引擎允许敌人从遭遇牌库入场（encounterDeck → enemies）、遭遇卡加入手牌/威胁区、
// 剧情资产入场与"移出游戏"，按区域做 multiset 守恒会被这些合法机制误报；
// 这里用"卡号可解析 + 逐步重放等价 + 状态 JSON 幂等"来守住同一类损坏（凭空造卡/丢卡）。

import test from 'node:test'
import assert from 'node:assert/strict'
import { createGameState, applyMove, unknownCardCodes } from '../src/engine/engine.js'
import { captureReplayLog, replayLog, stateHash, stableStringify } from '../src/engine/replay.js'
import { createRandomPolicy, nextMove } from '../tools/replay-games.mjs'

const FULL = process.env.REPLAY_FUZZ_FULL === '1'
const TARGET_STEPS = FULL ? 2000 : 400
const MAX_GAMES = FULL ? 12 : 4
const MIN_GAMES = FULL ? 6 : 2
const CAMPAIGNS = ['nightOfTheZealot', 'theDunwichLegacy', 'thePathToCarcosa', 'theForgottenAge']
const playersFor = count => Array.from({ length: count }, (_, seat) => ({ seat, role: seat === 0 ? 'human' : 'ai' }))

test(`${TARGET_STEPS} 步随机走子器：不变量、JSON 幂等与关键步重放`, { timeout: 900000 }, () => {
  const totals = { steps: 0, games: 0, jsonChecks: 0, cardChecks: 0 }
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

  for (let game = 0; game < MAX_GAMES && totals.steps < TARGET_STEPS; game++) {
    const campaignId = CAMPAIGNS[game % CAMPAIGNS.length]
    const seed = `walker-${game}`
    const state = createGameState(
      { campaignHub: true, campaignId, seed, rulesMode: game % 2 ? 'strict' : 'simplified' },
      playersFor(1 + (game % 4)),
    )
    const policy = createRandomPolicy(seed)
    totals.games++
    for (let index = 0; state.status === 'playing' && index < 400 && totals.steps < TARGET_STEPS; index++) {
      const selection = nextMove(state, policy)
      assert.ok(selection, `${seed}#${index}：仍有合法动作却拿不到下一步`)
      const before = state.revision
      applyMove(state, selection.seat, selection.move)
      totals.steps++
      const where = `${seed}#${totals.steps}`
      assert.equal(state.revision, before + 1, `${where}：每次成功动作必须恰好 +1 revision`)
      checkState(state, where)
      if (totals.steps % 100 === 0) {
        totals.jsonChecks++
        assert.equal(stableStringify(JSON.parse(JSON.stringify(state))), stableStringify(state),
          `${where}：状态 JSON 往返必须幂等`)
        totals.cardChecks++
        assert.deepEqual(unknownCardCodes(state), [], `${where}：状态里出现无法解析的卡号`)
      }
    }
    if (violations.length) break
  }
  assert.deepEqual(violations, [], `随机走子器发现 ${violations.length} 条不变量违反`)
  assert.ok(totals.steps >= TARGET_STEPS, `走子总步数不足（${totals.steps}/${TARGET_STEPS}）`)
  assert.ok(totals.games >= MIN_GAMES, `至少应跨多局乱走（当前 ${totals.games} 局）`)
  assert.ok(totals.jsonChecks >= 4, `JSON 幂等检查点不足：${JSON.stringify(totals)}`)

  // 走子器的状态本身也要能被日志重放（抽一局短局整局校验，避免只验证到局部）。
  const replayState = createGameState(
    { campaignHub: true, campaignId: CAMPAIGNS[0], seed: 'walker-replay' },
    playersFor(2),
  )
  const replayPolicy = createRandomPolicy('walker-replay')
  let applied = 0
  for (let index = 0; replayState.status === 'playing' && applied < 80; index++) {
    const selection = nextMove(replayState, replayPolicy)
    if (!selection) break
    applyMove(replayState, selection.seat, selection.move)
    applied++
  }
  assert.ok(applied > 0, '关键步重放：短局至少要走一步')
  const log = JSON.parse(JSON.stringify(captureReplayLog(replayState)))
  assert.equal(stateHash(replayLog(log)), stateHash(replayState), '日志重放出的状态指纹必须与实时执行一致')
})
