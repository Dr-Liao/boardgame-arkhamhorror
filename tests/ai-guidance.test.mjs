// AI 决策质量回归：技能检定投入的弃牌代价/图标差距、行动点浪费、借机攻击决策点标注。
//
// 背景：AI 队友是 LLM，规则只校验「合法」，不会阻止模型把武器投入检定、
// 或在与敌人交战时抽牌/调查吃借机攻击。这些错误都来自「决策点上信息不足」，
// 所以这里锁死三件事：
//   1) 投入窗口的决策资料必须带上卡名/类型/差距/弃牌警告与 commitAdvice；
//   2) 观察末尾（决策点）必须有投入说明，且【可执行行动】仍是最后一个段块；
//   3) 交战回合的行动列表必须标出行动成本、安全行动与提前结束回合的浪费。

import test from 'node:test'
import assert from 'node:assert/strict'
import arkham from '../index.js'
import {
  applyMove, createGameState, decisionSeat, performTest, spawnEnemy,
} from '../src/engine/engine.js'
import { aiDecisionContext } from '../src/ai/ai-context.js'
import { resolveTransaction } from '../src/engine/resolution.js'

function settle(state) {
  for (let i = 0; state.pendingChoice; i++) {
    assert.ok(i < 100, '开局待决选择过多')
    const choice = state.pendingChoice
    const option = choice.options.find(item => ['done', 'skip', 'self'].includes(item.id)) || choice.options[0]
    applyMove(state, choice.seat, { action: 'choose', choiceId: choice.id, optionId: option.id })
  }
}

function fixture(count = 1) {
  const state = createGameState({ playerInvestigator: '01001', seed: 'ai-guidance' },
    Array.from({ length: count }, (_, seat) => ({ seat })))
  settle(state)
  return state
}

const context = state => JSON.parse(aiDecisionContext(state, decisionSeat(state)).split('\n')[2])

/** 进入一次战斗检定投入窗口：罗兰战斗 4，难度 6 → 还差 2 个图标。 */
function commitWindow(hand = ['01020', '01091', '01025']) {
  const state = fixture(1)
  state.currentSeat = 0
  state.investigators[0].hand = [...hand]
  resolveTransaction(state, 0, { action: 'context-test' },
    draft => performTest(draft, 0, 'combat', 6, {}))
  assert.equal(state.pendingChoice?.kind, 'commit', '应进入技能检定投入窗口')
  return state
}

test('AI commit context: weapon is flagged as discard-cost, skill card is preferred, gap is explicit', () => {
  const state = commitWindow()
  const data = context(state)
  assert.equal(data.test.value, 4)
  assert.equal(data.test.difficulty, 6)

  const weapon = data.commitOptions.find(option => option.code === '01020')
  const skill = data.commitOptions.find(option => option.code === '01091')
  assert.ok(weapon, '大砍刀应出现在投入候选里（战斗图标）')
  assert.ok(skill, '压制应出现在投入候选里')

  // 卡名/类型：模型不用再去 cards 大列表里反查这张牌是什么。
  assert.equal(weapon.name, '大砍刀')
  assert.equal(weapon.cardType, 'asset')
  assert.equal(weapon.prefer, false)
  assert.match(String(weapon.warning), /弃牌堆/, '资产投入必须提示会被弃掉')
  assert.equal(weapon.icons, 1)
  assert.equal(weapon.gapBefore, 2)
  assert.equal(weapon.gapAfter, 1)

  // 纯技能卡是首选投入，且它的图标差距算得出来。
  assert.equal(skill.cardType, 'skill')
  assert.equal(skill.prefer, true)
  assert.equal(skill.icons, 2)
  assert.equal(skill.gapAfter, 0)

  // 差距/弃牌说明必须结构化地给出，而不是让模型自己从 valueAfter 推。
  assert.equal(data.commitAdvice.gap, 2)
  assert.match(data.commitAdvice.discardNote, /弃牌堆/)
  assert.match(data.commitAdvice.tokenNote, /未计混乱标记/)
  assert.match(data.commitAdvice.suggestion, /还差 2 个图标/)
  assert.ok(data.commitAdvice.preferOptionIds.includes(skill.optionId))
  assert.ok(!data.commitAdvice.preferOptionIds.includes(weapon.optionId))
  assert.equal(data.actionsLeft, state.investigators[0].actionsLeft)
})

test('AI commit context: multi-skill tests count committed icons through the engine rule', () => {
  const state = fixture(1)
  state.currentSeat = 0
  state.investigators[0].hand = ['01091']
  // 多技能合成检定（阵法类）：战斗 4 + 敏捷 2 = 6，难度 8 → 还差 2 个图标。
  resolveTransaction(state, 0, { action: 'context-test' },
    draft => performTest(draft, 0, ['combat', 'agility'], 8, {}))
  const data = context(state)
  assert.equal(data.test.value, 6)
  const skill = data.commitOptions.find(option => option.code === '01091')
  assert.equal(skill.icons, 2, '多技能检定投入图标必须按每个技能求和，不能只剩万能图标')
  assert.equal(skill.gapBefore, 2)
  assert.equal(skill.gapAfter, 0, '压制（战斗 2）投下去正好补平差距')
  assert.equal(data.commitAdvice.skillName, '战斗、敏捷')
})

test('AI commit context: already-satisfied test tells the model not to dump cards', () => {
  const state = fixture(1)
  state.currentSeat = 0
  state.investigators[0].hand = ['01020', '01091']
  resolveTransaction(state, 0, { action: 'context-test' },
    draft => performTest(draft, 0, 'combat', 4, {}))
  const data = context(state)
  assert.equal(data.commitAdvice.gap, 0)
  assert.match(data.commitAdvice.suggestion, /已达标/)
})

test('AI observation: commit window explains discard + gap at the decision point and keeps moves last', () => {
  const state = commitWindow()
  const before = JSON.stringify(state)
  const text = arkham.describeState(state, 0)
  assert.equal(JSON.stringify(state), before, 'describeState 必须保持纯投影')

  const commitAt = text.indexOf('【技能检定投入】')
  const movesAt = text.indexOf('【可执行行动】')
  assert.ok(commitAt >= 0, '观察末尾应有【技能检定投入】块')
  assert.ok(movesAt > commitAt, '投入说明必须出现在可执行行动之前')
  assert.equal(text.indexOf('【', movesAt + 1), -1, '可执行行动之后不应再有任何段块')
  assert.match(text.slice(commitAt, movesAt), /当前总值 4/)
  assert.match(text.slice(commitAt, movesAt), /难度 6/)
  assert.match(text.slice(commitAt, movesAt), /还差 2 个图标/)
  assert.match(text.slice(commitAt, movesAt), /弃牌堆/)
  assert.match(text.slice(movesAt), /投入：大砍刀/, '投入选项仍在可执行行动里')
})

test('AI observation: engaged action list marks cost, safe actions and wasted action points', () => {
  const state = fixture(1)
  state.currentSeat = 0
  const inv = state.investigators[0]
  inv.actionsLeft = 3
  spawnEnemy(state, '01161', inv.location, 0, true)

  const text = arkham.describeState(state, 0)
  assert.match(text, /【借机攻击】/, '交战时必须有借机攻击提示')
  assert.match(text, /⚠借机 \d+\/\d+/, '风险行动保留 ⚠ 标记')

  const moveLines = text.split('\n').filter(line => /^\d+\. /.test(line))
  assert.ok(moveLines.length > 0, '应有可执行行动列表')

  const fight = moveLines.find(line => line.includes('攻击「'))
  assert.ok(fight, '交战时应列出攻击行动')
  assert.match(fight, /\[1行动\]/, '攻击行应标出行动点成本')
  assert.match(fight, /✅安全/, '攻击不引发借机攻击，应标为安全')
  assert.ok(!fight.includes('借机'), '安全标记不能破坏「攻击行不含借机」的既有断言')

  const endTurn = moveLines.find(line => line.includes('结束回合'))
  assert.ok(endTurn, '应列出结束回合')
  assert.match(endTurn, /浪费 3 个行动点/, '有剩余行动点时结束回合必须提示浪费')
  assert.match(text, /本回合剩余 3 个行动点/, '行动列表段首要直接给出剩余行动点')
})

test('AI observation: commit-window hints stay private to the answering seat', () => {
  const state = fixture(2)
  state.currentSeat = 0
  state.investigators[0].hand = ['01020', '01091']
  resolveTransaction(state, 0, { action: 'context-test' },
    draft => performTest(draft, 0, 'combat', 6, {}))
  assert.equal(state.pendingChoice.seat, 0)
  assert.match(arkham.describeState(state, 0), /【技能检定投入】/)
  const teammateView = arkham.describeState(state, 1)
  assert.ok(!teammateView.includes('【技能检定投入】'), '不是回答座位时不能看到投入提示')
})

test('AI observation: endTurn waste marker and safe marker only appear when they apply', () => {
  // 没有敌人时不应出现逐行动的 ✅安全（标题图例里的 ✅ 说明不算）。
  const calm = fixture(1)
  calm.currentSeat = 0
  calm.investigators[0].actionsLeft = 3
  assert.ok(!arkham.describeState(calm, 0).includes('✅安全'))

  // 行动点已用完时，结束回合不提示「浪费」。
  const spent = fixture(1)
  spent.currentSeat = 0
  spent.investigators[0].actionsLeft = 0
  spawnEnemy(spent, '01161', spent.investigators[0].location, 0, true)
  const lines = arkham.describeState(spent, 0).split('\n').filter(line => /^\d+\. /.test(line))
  const endTurn = lines.find(line => line.includes('结束回合'))
  assert.ok(endTurn, '应列出结束回合')
  assert.ok(!endTurn.includes('浪费'), '没有剩余行动点时不提示浪费')
})

test('AI system prompt states commit-discard, action-point and self-check rules', () => {
  assert.match(arkham.agentHint, /投入的卡牌在检定结算后进入弃牌堆/)
  assert.match(arkham.agentHint, /输出前自检/)
  assert.match(arkham.agentHint, /行动点/)
  assert.match(arkham.agentHint, /技能检定投入/)
  assert.match(arkham.moveFormat, /投入手牌就是弃牌/)
  assert.match(arkham.moveFormat, /endTurn/)
})
