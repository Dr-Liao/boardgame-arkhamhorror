// A2：AI 的敌人观察补上「卡面规则文本 + 决策字段」。
//
// 覆盖：
//   1. 卡面公开信息——冷漠/胜利/复仇/特性/所在地点/印刷规则都进观察；
//   2. 同名牌只打印一次规则（祭司 ×2 不重复整段）；
//   3. 文本空白时不给印刷规则（剧本抹掉卡面后，规则不生效）；
//   4. 没有卡面文本的敌人不产生空规则行；
//   5. 纯读——观察不写 state。

import test from 'node:test'
import assert from 'node:assert/strict'
import { applyMove, createGameState, decisionSeat, describeState, spawnEnemy } from '../src/engine/engine.js'

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
    seed: 'ai-enemy-visibility', difficulty: 'standard',
  }, [{ seat: 0 }])
  settle(state)
  state.currentSeat = 0
  return state
}

/** 【敌人意图】段（到下一个段落标题为止）。 */
const enemyBlock = text => (text.split('\n【敌人意图】\n')[1] || '').split(/\n【/)[0]
const ruleLines = block => block.split('\n').map(line => line.trim()).filter(line => line.startsWith('规则：'))
const spawn = (state, code) => {
  const enemy = spawnEnemy(state, code, state.investigators[0].location, null, true)
  assert.ok(enemy, `${code} 应能生成`)
  return enemy
}

test('敌人卡面规则与决策字段进入 AI 观察', () => {
  const state = fixture()
  spawn(state, '04062')   // 瓦卢西亚的预示者：复仇 5、横置也能反击
  spawn(state, '03081')   // 黛安娜·迪瓦恩：冷漠
  const block = enemyBlock(describeState(state, decisionSeat(state)))
  assert.match(block, /（[^）]*冷漠[^）]*）/, '冷漠必须出现在关键词里（否则 AI 只能靠攻击报错才发现）')
  assert.match(block, /复仇5/, '复仇点决定该不该打')
  assert.match(block, /特性 Humanoid\/Monster\/Serpent\/Elite/, '特性是卡面效果的判定依据')
  assert.match(block, /位于「/, '每只敌人自带所在地点')
  assert.match(block, /规则：/, '卡面规则文本要进观察')
  assert.match(block, /横置状态时能反击/, '印刷规则原文（04062）')
  assert.equal(describeState(state, 0).split('【敌人意图】').length, 2, '段落只出现一次')
})

test('胜利点敌人标出胜利 N', () => {
  const state = fixture()
  spawn(state, '10517')   // 地下野兽：胜利 2
  const block = enemyBlock(describeState(state, 0))
  assert.match(block, /胜利2/)
})

test('同名牌的规则只打印一次，第二张指向第一张', () => {
  const state = fixture()
  spawn(state, '01161')
  spawn(state, '01161')
  const block = enemyBlock(describeState(state, 0))
  const rules = ruleLines(block)
  assert.equal(rules.length, 2, '两只同名牌：一条规则 + 一条「同」引用')
  assert.match(rules[0], /猎物 - 剩余生命值最低/)
  assert.match(rules[1], /（同「饥饿的食尸鬼」）/)
  assert.equal(block.split('猎物 - 剩余生命值最低').length - 1, 1, '原文只出现一次')
})

test('文本空白时不把印刷规则当成有效规则', () => {
  const state = fixture()
  const enemy = spawn(state, '03081')
  enemy.textBlanked = { round: state.round, phase: state.phase }
  const block = enemyBlock(describeState(state, 0))
  assert.match(block, /规则：文本空白/)
  assert.ok(!block.includes('不能发现或控制线索'), '空白期间不能给原文')
})

test('没有卡面文本的敌人不产生空规则行', () => {
  const state = fixture()
  spawn(state, '01160')   // 食尸鬼爪牙：卡面无规则文本
  const block = enemyBlock(describeState(state, 0))
  assert.ok(block.includes('食尸鬼爪牙'))
  assert.deepEqual(ruleLines(block), [])
})

test('观察是纯投影：不写 state、不改变合法行动', () => {
  const state = fixture()
  spawn(state, '03081')
  const before = JSON.stringify(state)
  const first = describeState(state, 0)
  const second = describeState(state, 0)
  assert.equal(JSON.stringify(state), before, '观察不得修改 state')
  assert.equal(first, second, '重复观察结果一致')
})
