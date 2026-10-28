// 地点卡面原文进 AI 决策资料（与敌人规则文本同一原则）。
//
// 覆盖：
//   1. 已揭示地点带 text（卡面上的撤退/谈判/限制句）；
//   2. 未揭示地点不泄露背面文本；
//   3. 与 entry.effects / rules 重复的整句被剔掉（阁楼、地窖只剩 entry）；
//   4. 卡面无文本的地点不产生空字段；
//   5. 纯投影——不写 state、重复调用一致。

import test from 'node:test'
import assert from 'node:assert/strict'
import { applyMove, createGameState, placeLocation } from '../src/engine/engine.js'
import { aiDecisionContext } from '../src/ai/ai-context.js'

function settle(state) {
  for (let i = 0; state.pendingChoice; i++) {
    assert.ok(i < 100, '开局待决选择过多')
    const choice = state.pendingChoice
    const option = choice.options.find(item => ['done', 'skip', 'self'].includes(item.id)) || choice.options[0]
    applyMove(state, choice.seat, { action: 'choose', choiceId: choice.id, optionId: option.id })
  }
}

function fixture() {
  const state = createGameState({
    legacyAutoStart: true, playerInvestigator: '01001', playerCount: 1, teammates: 0, opponents: [],
    seed: 'ai-location-visibility', difficulty: 'standard',
  }, [{ seat: 0 }])
  settle(state)
  state.currentSeat = 0
  for (const id of ['hallway', 'attic', 'cellar', 'parlor']) placeLocation(state, id, [])
  for (const loc of state.locations) loc.revealed = true
  return state
}

const locationsOf = state => JSON.parse(aiDecisionContext(state, 0).split('\n')[2]).locations
const rowOf = (state, id) => locationsOf(state).find(row => row.id === id)

test('已揭示地点带上卡面原文', () => {
  const state = fixture()
  const parlor = rowOf(state, 'parlor')
  assert.ok(parlor.text, '客厅卡面文本应进决策资料')
  assert.match(parlor.text, /撤退/, '卡面上的撤退行动')
  assert.match(parlor.text, /谈判/, '卡面上的谈判句')
  assert.ok(aiDecisionContext(state, 0).includes('地点条目的 text'),
    '提示词里要说明 text 是什么，否则模型不会读它')
})

test('未揭示地点不泄露卡面文本', () => {
  const state = fixture()
  state.locations.find(loc => loc.id === 'parlor').revealed = false
  const parlor = rowOf(state, 'parlor')
  assert.equal(parlor.revealed, false)
  assert.equal(parlor.text, undefined, '未揭示地点不能带背面文本')
})

test('与 entry 提示重复的整句被剔掉，不重复占位', () => {
  const state = fixture()
  for (const id of ['attic', 'cellar']) {
    const row = rowOf(state, id)
    assert.ok(row.entry?.effects, `${id} 的进入效果仍在 entry 里`)
    assert.equal(row.text, undefined, `${id} 的卡面只有进入效果，不应再重复一遍`)
  }
})

test('卡面无文本的地点没有 text 字段', () => {
  const state = fixture()
  for (const id of ['study', 'hallway']) {
    const row = rowOf(state, id)
    assert.ok(row, `${id} 应在地点列表里`)
    assert.equal(row.text, undefined, `${id} 卡面无规则文字`)
  }
})

test('观察是纯投影：不写 state，重复调用一致', () => {
  const state = fixture()
  const before = JSON.stringify(state)
  const first = aiDecisionContext(state, 0)
  const second = aiDecisionContext(state, 0)
  assert.equal(JSON.stringify(state), before, '决策资料不得修改 state')
  assert.equal(first, second, '重复生成结果一致')
})
