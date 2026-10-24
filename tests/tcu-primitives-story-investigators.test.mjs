// 万象无终（TCU）第 2 步 P2.6 原语验收：序章无牌组故事调查员。
//
// 覆盖路线图 §4.1 的必测项：1–4 人、重复选择、存档、观察投影、AI（无牌组行动）。
// 数据形状：剧本声明 setup.storyInvestigators = { codes, crossOutUnused?, setupCards? }，
// 引擎在 startScenario 里先选人（每座位各选一次），再按「无牌组」准备调查员；
// 下一章没有声明时换回原本的调查员。

import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture, move, settle } from './core-fixture.mjs'
import {
  isStoryInvestigator, normalizeStoryInvestigatorConfig, prepareStoryInvestigator,
  restoreStoryInvestigators, selectStoryInvestigators, storyInvestigatorProjection,
  storyInvestigatorSetupCards,
} from '../src/engine/story-investigators.js'
import { legalMoves } from '../src/engine/engine.js'
import { campaignProjection } from '../src/cards/campaign-view.js'

const STORY = ['05046', '05047', '05048', '05049']
const SKILLS = ['willpower', 'intellect', 'combat', 'agility']

// 一套调查员身份快照：换人会把职业与四项技能也改成卡面印刷值，换回时必须整套恢复。
function identity(inv) {
  const snapshot = { code: inv.code, name: inv.name, nameEn: inv.nameEn, klass: inv.klass }
  for (const skill of SKILLS) snapshot[skill] = inv[skill]
  return snapshot
}

function storyFixture(seats = 1) {
  const state = fixture('01001', seats)
  return state
}

function chooseFirst(answers = {}) {
  return (target, request) => {
    assert.equal(request.kind, 'storyInvestigator')
    const queue = answers[request.seat] || []
    const pick = queue.shift() || request.options[0].id
    return pick
  }
}

test('P2.6 注册期校验：codes / setupCards / 未知字段写错时立即失败', () => {
  const ok = normalizeStoryInvestigatorConfig({ codes: STORY, crossOutUnused: true, setupCards: { '05046': ['05setup'] } })
  assert.deepEqual([...ok.codes], STORY)
  assert.equal(ok.crossOutUnused, true)
  assert.equal(normalizeStoryInvestigatorConfig(null), null)
  assert.throws(() => normalizeStoryInvestigatorConfig({ codes: [] }), /codes 必须是非空数组/)
  assert.throws(() => normalizeStoryInvestigatorConfig({ codes: ['05046', '05046'] }), /codes 重复/)
  assert.throws(() => normalizeStoryInvestigatorConfig({ codes: STORY, setupCards: { '05046': [] } }), /必须是非空数组/)
  assert.throws(() => normalizeStoryInvestigatorConfig({ codes: STORY, setupCards: { '05999': ['x'] } }), /未声明调查员/)
  assert.throws(() => normalizeStoryInvestigatorConfig({ codes: STORY, extra: 1 }), /未知字段/)
})

test('P2.6 选人：每座位各选一次，已选的 code 不可重复', () => {
  const state = storyFixture(3)
  const record = selectStoryInvestigators(state, { codes: STORY }, { requestChoice: chooseFirst() })
  assert.equal(record.chosen.length, 3)
  assert.equal(new Set(record.chosen.map(entry => entry.code)).size, 3)
  assert.deepEqual(record.crossedOut, [STORY[3]])
  // 换人：座位上的 code/name 已替换
  for (const entry of record.chosen) {
    assert.equal(state.investigators[entry.seat].code, entry.code)
  }
  // 一旦选了，后续座位只看到剩下的候选。
  assert.equal(record.originals.length, 3)
})

test('P2.6 选人：少于 4 人时把未选的划掉；关闭选项时不划掉', () => {
  const two = storyFixture(2)
  const record = selectStoryInvestigators(two, { codes: STORY }, { requestChoice: chooseFirst() })
  assert.deepEqual(record.crossedOut, [STORY[2], STORY[3]])

  const three = storyFixture(1)
  const keep = selectStoryInvestigators(three, { codes: STORY, crossOutUnused: false }, { requestChoice: chooseFirst() })
  assert.deepEqual(keep.crossedOut, [])
})

test('P2.6 选人：玩家数多于故事调查员时开局即失败', () => {
  const state = storyFixture(4)
  assert.throws(() => selectStoryInvestigators(state, { codes: STORY.slice(0, 3) }, { requestChoice: chooseFirst() }),
    /多于故事调查员/)
})

test('P2.6 无牌组：准备后 deck/hand/discard 清空，专属设置卡随准备返回', () => {
  const state = storyFixture(1)
  selectStoryInvestigators(state, { codes: STORY, setupCards: { '05046': ['05setup'] } }, { requestChoice: chooseFirst() })
  const inv = state.investigators[0]
  inv.hand = ['01088']
  inv.deck = ['01088']
  inv.discard = ['01088']
  const { setupCards } = prepareStoryInvestigator(inv, { setupCards: storyInvestigatorSetupCards(state, inv.code) })
  assert.equal(inv.storyInvestigator, true)
  assert.equal(inv.noDeck, true)
  assert.deepEqual(inv.deck, [])
  assert.deepEqual(inv.hand, [])
  assert.deepEqual(inv.discard, [])
  assert.deepEqual(setupCards, ['05setup'])
  assert.equal(isStoryInvestigator(state, inv), true)
})

test('P2.6 无牌组：抽牌动作被拦下并记日志，手牌保持为空', () => {
  const state = storyFixture(1)
  selectStoryInvestigators(state, { codes: STORY }, { requestChoice: chooseFirst() })
  prepareStoryInvestigator(state.investigators[0])
  settle(state)
  // 抽 1 张牌是常规行动；故事调查员没有牌组，引擎记日志且不产生手牌。
  const moves = legalMoves(state, 0).map(move => move.action)
  if (moves.includes('draw')) move(state, { action: 'draw' })
  settle(state)
  assert.deepEqual(state.investigators[0].hand, [])
  assert.deepEqual(state.investigators[0].deck, [])
  assert.ok(state.log.some(line => line.includes('没有牌组')), '应记录「没有牌组」')
})

test('P2.6 换回：下一章没有声明时恢复原本的调查员身份（职业+四技能）并清掉状态键', () => {
  const state = storyFixture(2)
  const before = state.investigators.map(identity)
  selectStoryInvestigators(state, { codes: STORY }, { requestChoice: chooseFirst() })
  assert.notEqual(state.investigators[0].code, before[0].code)
  // 进入剧本时引擎会按卡面把职业/技能改成故事调查员的印刷值（真实开局见 tcu-prologue 用例），
  // 这里手动模拟一遍，确认换回时不是只恢复 code/name。
  for (const inv of state.investigators) {
    inv.klass = 'neutral'
    inv.nameEn = 'Story Investigator'
    for (const skill of SKILLS) inv[skill] = 9
  }
  const record = restoreStoryInvestigators(state)
  assert.ok(record)
  assert.deepEqual(state.investigators.map(identity), before)
  assert.equal(state.storyInvestigators, undefined)
  assert.equal(state.investigators[0].storyInvestigator, false)
  assert.equal(restoreStoryInvestigators(state), null)
})

test('P2.6 换回：旧存档的 originals 没有身份快照时用 cardInfo 恢复职业与技能', () => {
  const state = storyFixture(1)
  selectStoryInvestigators(state, { codes: STORY }, { requestChoice: chooseFirst() })
  // 旧存档只有 seat/code/name；同时把调查员改成故事调查员的印刷身份来模拟已换人。
  state.storyInvestigators.originals = state.storyInvestigators.originals
    .map(({ seat, code, name }) => ({ seat, code, name }))
  const inv = state.investigators[0]
  inv.klass = 'neutral'
  inv.nameEn = 'Story Investigator'
  for (const skill of SKILLS) inv[skill] = 9
  restoreStoryInvestigators(state, {
    cardInfo: code => code === '01001'
      ? { name: 'Roland Banks', klass: 'guardian', willpower: 3, intellect: 3, combat: 4, agility: 2 }
      : null,
  })
  assert.equal(inv.code, '01001')
  assert.equal(inv.nameEn, 'Roland Banks')
  assert.equal(inv.klass, 'guardian')
  assert.deepEqual(SKILLS.map(skill => inv[skill]), [3, 3, 4, 2])
  assert.equal(inv.storyInvestigator, false)
})

test('P2.6 投影：公开选人与划掉结果，未选/隐藏信息不出现', () => {
  const state = storyFixture(1)
  assert.equal(storyInvestigatorProjection(state), null)
  assert.equal('storyInvestigators' in campaignProjection(state), false)
  selectStoryInvestigators(state, { codes: STORY }, { requestChoice: chooseFirst() })
  const projection = storyInvestigatorProjection(state)
  assert.deepEqual(Object.keys(projection).sort(), ['chosen', 'crossedOut'])
  assert.equal(projection.chosen.length, 1)
  assert.deepEqual(projection.crossedOut, STORY.slice(1))
  assert.deepEqual(campaignProjection(state).storyInvestigators, projection)
})

test('P2.6 存档：选择与换人快照随存档往返，往返后仍能换回', () => {
  const state = storyFixture(2)
  const before = state.investigators.map(inv => ({ code: inv.code, name: inv.name }))
  selectStoryInvestigators(state, { codes: STORY }, { requestChoice: chooseFirst() })
  const restored = JSON.parse(JSON.stringify(state))
  restored.pendingChoice = null
  assert.equal(restored.storyInvestigators.chosen.length, 2)
  restoreStoryInvestigators(restored)
  assert.deepEqual(restored.investigators.map(inv => ({ code: inv.code, name: inv.name })), before)
})

test('P2.6 无牌组行动：仍然可以调查（AI 与人类共用同一份 legalMoves）', () => {
  const state = storyFixture(1)
  selectStoryInvestigators(state, { codes: STORY }, { requestChoice: chooseFirst() })
  prepareStoryInvestigator(state.investigators[0])
  settle(state)
  state.chaosBag = ['+1']
  const actions = legalMoves(state, 0).map(move => move.action)
  assert.ok(actions.includes('investigate'), '无牌组不影响调查行动')
  const cluesBefore = state.locations.find(location => location.id === state.investigators[0].location).clues
  move(state, { action: 'investigate' })
  settle(state)
  const after = state.locations.find(location => location.id === state.investigators[0].location).clues
  assert.equal(after, cluesBefore - 1)
  assert.equal(state.investigators[0].clues, 1)
})
