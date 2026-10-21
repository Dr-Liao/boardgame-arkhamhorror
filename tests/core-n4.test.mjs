import test from 'node:test'
import assert from 'node:assert/strict'
import { createGameState, applyMove, legalMoves, validateMove, decisionSeat } from '../src/engine/engine.js'
import { randomValue } from '../src/engine/rules-state.js'
import { EFFECTS } from '../src/cards/card-effects.js'
import { registeredEntry } from '../src/engine/ability.js'

const clone = value => JSON.parse(JSON.stringify(value))
function move(state, command) {
  const seat = decisionSeat(state)
  assert.equal(validateMove(state, seat, command), null)
  applyMove(state, seat, command)
}
function answer(state, id) { move(state, { action: 'choose', choiceId: state.pendingChoice.id, optionId: id }) }
function settle(state) {
  for (let i = 0; state.pendingChoice; i++) {
    assert.ok(i < 80)
    const choice = state.pendingChoice
    answer(state, ['done', 'skip', 'self'].find(id => choice.options.some(option => option.id === id)) || choice.options[0].id)
  }
}
function fixture(code, count = 1) {
  const state = createGameState({ playerInvestigator: code, seed: 'n4-core' }, Array.from({ length: count }, (_, seat) => ({ seat })))
  settle(state)
  for (const inv of state.investigators) { inv.hand = []; inv.deck = ['01088', '01088', '01088']; inv.actionsLeft = 10 }
  state.chaosBag = ['0']
  state.encounterDeck = ['dissonantVoices']
  state.encounterDiscard = []
  return state
}
function asset(state, code) {
  const card = { id: 'c' + ++state.instanceSeq.c, code, exhausted: false }
  state.investigators[0].assets.push(card)
  return card
}
function enemy(state, extra = {}) {
  const card = { id: 'e' + ++state.instanceSeq.e, code: 'ghoulMinion', name: '规则测试敌人', location: 'study',
    fight: 1, evade: 1, health: 30, damageTaken: 0, damage: 0, horror: 0, engagedSeat: 0, ...extra }
  state.enemies.push(card)
  if (card.engagedSeat != null) state.investigators[card.engagedSeat].engaged.push(card.id)
  return card
}
function redrawSeed(state) {
  for (let seed = 0; seed < 1000; seed++) {
    const rng = { rngState: seed }
    if (randomValue(rng) < 0.5 && randomValue(rng) >= 0.5) { state.rngState = seed; return }
  }
  assert.fail('缺少确定性两标记样本')
}

test('N4 温蒂取消自动失败、弃指定手牌并重抽；JSON恢复不重复扣牌或行动', () => {
  const state = fixture('01005')
  state.investigators[0].hand = ['01088', '01015']
  state.chaosBag = ['autofail', '0']
  redrawSeed(state)
  move(state, { action: 'investigate' })
  answer(state, 'done')
  assert.equal(state.pendingChoice.source, 'wendyRedraw')
  answer(state, 'trigger')
  assert.equal(state.pendingChoice.kind, 'discard-hand')
  assert.deepEqual(state.pendingChoice.options.map(option => option.id), ['0'])
  const restored = clone(state)
  answer(state, '0'); answer(restored, '0')
  assert.deepEqual(clone(state), restored)
  assert.equal(state.investigators[0].clues, 1)
  assert.equal(state.investigators[0].actionsLeft, 9)
  assert.deepEqual(state.investigators[0].hand, ['01015'])
  assert.deepEqual(state.investigators[0].discard, ['01088'])
  assert.deepEqual(state.chaosBag, ['autofail', '0'])
})

test('N4 温蒂取消符号时不执行该符号效果，可抽回同一标记且每次检定只重抽一次', () => {
  const state = fixture('01005')
  enemy(state, { engagedSeat: null })
  state.investigators[0].hand = ['01088', '01088']
  state.chaosBag = ['tablet', '0']
  redrawSeed(state)
  move(state, { action: 'investigate' }); answer(state, 'done'); answer(state, 'trigger'); answer(state, '0')
  assert.equal(state.investigators[0].damage, 0)
  assert.equal(state.investigators[0].clues, 1)
  state.chaosBag = ['autofail']
  move(state, { action: 'investigate' }); answer(state, 'done'); answer(state, 'trigger'); answer(state, '0')
  assert.equal(state.pendingChoice, null)
  assert.equal(state.investigators[0].clues, 1)
  assert.equal(state.investigators[0].discard.length, 2)
})

test('N4 温蒂只有弱点时没有弃牌反应；跳过不扣牌也不消耗本次检定行动之外的成本', () => {
  const state = fixture('01005')
  state.investigators[0].hand = ['01015']
  move(state, { action: 'investigate' }); answer(state, 'done')
  assert.equal(state.pendingChoice, null)
  state.investigators[0].hand.push('01088')
  state.locations[0].clues = 2
  move(state, { action: 'investigate' }); answer(state, 'done'); answer(state, 'skip')
  assert.deepEqual(state.investigators[0].hand, ['01015', '01088'])
  assert.deepEqual(state.investigators[0].discard, [])
})

test('N4 黛西第三个普通行动打出书后仍可用书籍额外行动，不能用于抽牌或资源', () => {
  const state = fixture('01002', 2)
  state.investigators[0].actionsLeft = 3
  state.investigators[0].hand = ['01031']
  move(state, { action: 'resource' }); move(state, { action: 'resource' }); move(state, { action: 'play', cardId: '01031' })
  assert.equal(state.currentSeat, 0)
  assert.equal(state.investigators[0].actionsLeft, 0)
  assert.match(validateMove(state, 0, { action: 'draw' }), /行动点/)
  assert.ok(!legalMoves(state).some(command => command.action === 'resource'))
  const command = legalMoves(state).find(command => command.action === 'ability')
  assert.ok(command)
  move(state, command)
  const restored = clone(state)
  answer(state, '0'); answer(state, 'skip'); answer(restored, '0'); answer(restored, 'skip')
  assert.deepEqual(clone(state), restored)
  assert.equal(state.investigators[0].tomeActionUsed, true)
  assert.equal(state.investigators[0].actionsLeft, 0)
  assert.equal(state.currentSeat, 1)
})

test('N4 黛西一本书消耗额度后另一本不能重复免费；额外行动仍触发借机攻击', () => {
  const state = fixture('01002')
  const one = asset(state, '01031')
  const two = asset(state, '01031')
  enemy(state, { damage: 1 })
  move(state, { action: 'ability', assetId: one.id, abilityIndex: 0 }); settle(state)
  assert.equal(state.investigators[0].actionsLeft, 10)
  assert.equal(state.investigators[0].damage, 1)
  move(state, { action: 'ability', assetId: two.id, abilityIndex: 0 }); settle(state)
  assert.equal(state.investigators[0].actionsLeft, 9)
  assert.equal(state.investigators[0].damage, 2)
})

test('N4 黛西死灵之书行动也可消耗书籍额度，结束回合不会把余下额度转给队友', () => {
  const state = fixture('01002', 2)
  state.investigators[0].threat = [{ id: 'necronomicon', code: '01009', counters: 3 }]
  move(state, { action: 'purgeThreat', threatId: 'necronomicon' }); settle(state)
  assert.equal(state.investigators[0].actionsLeft, 10)
  assert.equal(state.investigators[0].tomeActionUsed, true)
  assert.equal(state.investigators[0].horror, 1)
  move(state, { action: 'endTurn' }); settle(state)
  assert.equal(state.currentSeat, 1)
})

test('N4 艾格尼丝每阶段一次，但下一轮同名阶段可以再次触发', () => {
  const state = fixture('01004')
  enemy(state, { horror: 1 })
  move(state, { action: 'resource' })
  assert.equal(state.pendingChoice.source, 'agnesDamage')
  answer(state, 'trigger'); settle(state)
  assert.equal(state.enemies[0].damageTaken, 1)
  move(state, { action: 'resource' }); settle(state)
  assert.equal(state.enemies[0].damageTaken, 1)
  state.round++
  move(state, { action: 'resource' })
  assert.equal(state.pendingChoice.source, 'agnesDamage')
  answer(state, 'trigger'); settle(state)
  assert.equal(state.enemies[0].damageTaken, 2)
})

test('N4 守护结界只能取消本人非弱点诡计，不替他人开窗', () => {
  // Phase 6（6e-8）：守护结界搬到 played 描述子，断言改为读描述子的反应条件。
  const ward = registeredEntry('01065').abilities.find(descriptor => descriptor.kind === 'played')
  assert.equal(ward.fast, true)
  assert.deepEqual(ward.trigger, ['treachery'])
  assert.equal(ward.criteria.selfOnly, true)
  assert.equal(ward.criteria.nonWeaknessOnly, true)
  const state = fixture('01001', 2)
  state.investigators[1].hand = ['01065']
  state.encounterDeck = ['dissonantVoices', 'rottingRemains']
  move(state, { action: 'endTurn' }); move(state, { action: 'endTurn' })
  assert.equal(state.pendingChoice.kind, 'commit')
  assert.equal(state.pendingChoice.seat, 0)
  const weak = fixture('01001')
  weak.investigators[0].hand = ['01065']
  weak.investigators[0].deck = ['01098']
  move(weak, { action: 'draw' })
  assert.equal(weak.pendingChoice, null)
  assert.ok(weak.investigators[0].threat.some(card => card.code === '01098'))
  assert.deepEqual(weak.investigators[0].hand, ['01065'])
})

test('N4 艾格尼丝受到直接恐惧仍可反应，且不能转移给资产', () => {
  const state = fixture('01004')
  asset(state, '01095')
  enemy(state, { engagedSeat: null })
  state.investigators[0].deck = ['01015']
  move(state, { action: 'draw' })
  assert.equal(state.pendingChoice.source, 'agnesDamage')
  assert.equal(state.investigators[0].horror, 2)
  answer(state, 'trigger'); settle(state)
  assert.equal(state.enemies[0].damageTaken, 1)
  assert.equal(state.investigators[0].assets[0].horror || 0, 0)
})

test('N4 被抛弃的孤单造成直接恐惧，不能分配给资产且弃牌仅本关移除', () => {
  const state = fixture('01005')
  asset(state, '01095')
  state.investigators[0].deck = ['01015']
  state.investigators[0].discard = ['01088']
  const persistent = [...state.campaign.investigators[0].deck]
  move(state, { action: 'draw' })
  assert.equal(state.pendingChoice, null)
  assert.equal(state.investigators[0].horror, 2)
  assert.equal(state.investigators[0].assets[0].horror || 0, 0)
  assert.deepEqual(state.campaign.investigators[0].deck, persistent)
  assert.ok(state.exiled.includes('01088'))
})
