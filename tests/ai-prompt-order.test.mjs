// 观察顺序契约：决策块必须落在提示词末尾。
//
// 大厅在 mod.describeState 之后会接「回合进度 / 对局进程 / 输出要求」。若把可执行行动放在
// 【决策资料】之前，满场局面下它离输出要求能有 1.4 万 token，模型容易被中间的卡面资料稀释。
// 因此组合顺序固定为：局势 body → 【决策资料】JSON → 决策块 tail。

import test from 'node:test'
import assert from 'node:assert/strict'
import arkham from '../index.js'
import {
  applyMove, createGameState, decisionSeat, describeState, spawnEnemy,
} from '../src/engine/engine.js'

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
    legacyAutoStart: true, playerInvestigator: '01001', playerCount: 2, teammates: 1, opponents: [],
    seed: 'ai-prompt-order', difficulty: 'standard',
  }, [{ seat: 0 }, { seat: 1 }])
  settle(state)
  state.currentSeat = 0
  spawnEnemy(state, '01161', state.investigators[0].location, 0, true)
  spawnEnemy(state, '03081', state.investigators[0].location, null, true)
  return state
}

test('决策块排在观察末尾：推进条件 → 敌人 → 借机攻击 → 可执行行动', () => {
  const state = fixture()
  const text = arkham.describeState(state, decisionSeat(state))
  const at = marker => {
    const index = text.indexOf(marker)
    assert.ok(index >= 0, `观察里应有 ${marker}`)
    return index
  }
  const json = at('【决策资料】')
  const objective = at('【当前场景推进条件】')
  const enemies = at('【敌人意图】')
  const opportunity = at('【借机攻击】')
  const moves = at('【可执行行动】')
  assert.ok(json < objective, '推进条件要在决策资料之后')
  assert.ok(objective < enemies, '先目标后敌人')
  assert.ok(enemies < opportunity, '先敌人后借机攻击')
  assert.ok(opportunity < moves, '可执行行动必须是最后一块')
  assert.equal(text.indexOf('【', moves + 1), -1, '可执行行动之后不应再有任何段落')
})

test('局势段（队伍/地点/最近局势）留在决策资料之前', () => {
  const state = fixture()
  const text = arkham.describeState(state, decisionSeat(state))
  const json = text.indexOf('【决策资料】')
  for (const marker of ['【调查员队伍】', '【地点与连接图】', '【最近局势】']) {
    const index = text.indexOf(marker)
    assert.ok(index >= 0, `观察里应有 ${marker}`)
    assert.ok(index < json, `${marker} 应留在决策资料之前`)
  }
})

test('引擎侧 describeState 仍是完整观察（body + tail）', () => {
  const state = fixture()
  const text = describeState(state, decisionSeat(state))
  assert.ok(text.includes('【调查员队伍】'), 'body 段在')
  assert.ok(text.includes('【敌人意图】'), 'tail 段在')
  assert.ok(text.indexOf('【调查员队伍】') < text.indexOf('【敌人意图】'), 'body 在 tail 之前')
  assert.ok(!text.includes('【决策资料】'), '引擎侧不带 AI 决策资料（那是 src/ai 的投影）')
})
