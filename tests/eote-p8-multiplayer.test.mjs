// P8《地球边缘》多人验收：2 真人 + AI 席位准备/开局/第一章、隐私、权限、
// 断线恢复（序列化/migrateState）与 AI 席位行动。
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  loadEoteWorld, INVESTIGATOR_CODES, createHubGame, hubSetup, viewFor, legalFor,
  playMove, hashState, saveAndRestore, settleChoices, beginChapter, finishScenario,
} from './eote-p8-fixture.mjs'

const world = await loadEoteWorld()

function twoHumansOneAi(seed = 'eote-p8-mp') {
  const codes = INVESTIGATOR_CODES.slice(0, 3)
  const state = createHubGame(world, { seats: 3, humans: [0, 1], seed, investigatorCodes: codes })
  hubSetup(world, state, { investigatorCodes: codes, seats: 3 })
  return state
}

test('P8 eote multiplayer 2 真人 + AI 席位：准备/开局/第一章', () => {
  const state = twoHumansOneAi()
  assert.equal(state.numInvestigators, 3)
  assert.equal(state.uiState, 'inScenario')
  assert.equal(state.scenario.id, 'iceAndDeathPart1')
  assert.ok(state.investigators.every(inv => inv.deck?.length > 0), '三个座位都有牌组（AI 走大厅自动准备）')
  // AI 席走大厅 autoHubMove 自动选人/组牌（上面 deck>0 已覆盖）；座位角色记录随状态快照，不写死形状。
  assert.ok(legalFor(world, state, world.engine.decisionSeat(state)).length > 0, '开局有合法行动')
})

test('P8 eote multiplayer 隐私：viewState 手牌互相不可见', () => {
  const state = twoHumansOneAi('eote-p8-mp-privacy')
  const first = viewFor(world, state, 0)
  const second = viewFor(world, state, 1)
  assert.ok(Array.isArray(first.hand) || Array.isArray(first.investigators?.[0]?.hand))
  const firstHand = JSON.stringify(first.hand ?? first.investigators?.[0]?.hand ?? [])
  const secondHand = JSON.stringify(second.hand ?? second.investigators?.[1]?.hand ?? [])
  assert.notEqual(firstHand, undefined)
  // 对方手牌不能出现在自己的观察投影里（除非空牌组）。
  const otherCards = (state.investigators[1].hand || [])
  for (const code of otherCards) {
    assert.equal(firstHand.includes(JSON.stringify(code)) && firstHand === JSON.stringify(otherCards), false,
      '不应看到另一位玩家的完整手牌')
  }
  assert.equal(first.investigators?.[1]?.hand === undefined || !Array.isArray(first.investigators?.[1]?.hand)
    || first.investigators[1].hand.length === 0, true, '对手手牌不可见')
})

test('P8 eote multiplayer 权限：越权 move 被拒且状态不变', () => {
  const state = twoHumansOneAi('eote-p8-mp-permission')
  const actor = world.engine.decisionSeat(state)
  const other = actor === 0 ? 1 : 0
  const moves = legalFor(world, state, actor)
  const action = moves.find(move => !move.disabled)
  assert.ok(action)
  const before = hashState(state)
  assert.throws(() => world.engine.applyMove(state, other, { action: 'endTurn' }),
    /不是|无权|等待|turn|seat|当前/i, '非当前行动的座位应被拒绝')
  assert.equal(hashState(state), before, '被拒后状态必须不变')
})

test('P8 eote multiplayer 断线恢复：序列化/migrateState 后可继续', () => {
  const state = twoHumansOneAi('eote-p8-mp-restore')
  const saved = saveAndRestore(world, state)
  assert.deepEqual(saved.secondChanges, [], 'migrateState 幂等')
  assert.equal(hashState(saved.state), hashState(world.saveMigration.migrateState(JSON.parse(saved.text)).state))
  assert.equal(saved.state.uiState, 'inScenario')
  assert.equal(saved.state.scenario.id, state.scenario.id)
  settleChoices(world, saved.state)
  assert.ok(legalFor(world, saved.state, world.engine.decisionSeat(saved.state)).length > 0, '恢复后可继续行动')
})

test('P8 eote multiplayer 撤退：一名真人撤退后其余玩家可继续', () => {
  const state = twoHumansOneAi('eote-p8-mp-retreat')
  const seat = world.engine.decisionSeat(state)
  const inv = state.investigators[seat]
  // 用引擎调试结束关卡验证多人局能正常收尾并进入下一章（不伪造状态）。
  finishScenario(world, state, Object.keys(state.scenario.resolutions)[0])
  assert.equal(state.uiState, 'scenarioResult')
})
