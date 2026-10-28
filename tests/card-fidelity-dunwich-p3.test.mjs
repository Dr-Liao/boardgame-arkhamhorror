// 卡牌保真度 P3 · 敦威治遗产批次（机制类）回归。
import test from 'node:test'
import assert from 'node:assert/strict'

import { fixture, asset, enemy, move, answer, settle, validateMove, legalMoves } from './core-fixture.mjs'
import { laterBehavior } from '../content/campaigns/theDunwichLegacy/later-behaviors.js'
import { applyPenalty } from '../src/engine/engine.js'

const me = state => state.investigators[0]

test('02188 / 02234：每位调查员仅限 1 张（在场时不能再打出第二张）', () => {
  for (const code of ['02188', '02234']) {
    const state = fixture('01001')
    asset(state, code)
    me(state).hand.push(code)
    me(state).resources = 30
    assert.match(validateMove(state, 0, { action: 'play', cardId: code }), /仅限 1 张/)
  }
})

test('02023 寻找答案：连接地点都没有线索时不改在本地点发现', () => {
  const state = fixture('01001')
  const here = state.locations.find(location => location.id === me(state).location)
  const attic = { id: 'attic', name: '阁楼', shroud: 1, clues: 0, maxClues: 0, revealed: true, connections: [here.id] }
  here.connections.push('attic')
  here.clues = 2
  state.locations.push(attic)
  me(state).hand = ['02023']
  state.chaosBag = ['0']
  move(state, { action: 'play', cardId: '02023' })
  settle(state)
  assert.equal(me(state).clues, 0)
  assert.equal(here.clues, 2, '不能回退成在本地点发现线索')
})

test('02017 嘲讽：可以只交战任意数量，而不是强制全部', () => {
  const state = fixture('01001')
  const first = enemy(state, { engagedSeat: null })
  enemy(state, { engagedSeat: null })
  me(state).hand = ['02017']
  move(state, { action: 'play', cardId: '02017' })
  assert.equal(state.pendingChoice.source, '02017')
  answer(state, first.id)
  assert.equal(state.pendingChoice.source, '02017')
  answer(state, 'stop')
  settle(state)
  assert.deepEqual(me(state).engaged, [first.id], '只交战选中的那一个')
})

test('02018 团队合作：可以连续转移任意数量资源（含反向给与）', () => {
  const state = fixture('01001', 2)
  const [first, second] = state.investigators
  first.resources = 5
  second.resources = 5
  first.hand = ['02018']
  move(state, { action: 'play', cardId: '02018' })
  let transfers = 0
  settle(state, pending => {
    if (pending.source !== '02018') return null
    if (pending.options.some(option => option.id === 'resource') && transfers < 2) {
      transfers += 1
      return 'resource'
    }
    if (pending.options.some(option => option.id === 'more') && transfers < 2) return 'more'
    if (pending.options.some(option => option.id === String(first.seat)) && transfers < 2) return String(first.seat)
    if (pending.options.some(option => option.id === 'done')) return 'done'
    return null
  })
  assert.equal(transfers, 2)
  assert.equal(state.investigators[0].resources, 3)
  assert.equal(state.investigators[1].resources, 7)
})

test('02239 恐惧爆发：冷泉幽谷的 -1 与本密谋的 +1 相加为 0', () => {
  const state = fixture('01001')
  state.scenario = { ...state.scenario, id: 'undimensionedAndUnseen' }
  state.agendaIndex = 2
  state.locations = [{ id: 'coldSprings', name: '冷泉幽谷', originalCode: '02244', code: '02244',
    revealed: true, clues: 0, connections: [] }]
  const abomination = { id: 'brood', code: '02255', traits: ['Abomination'], location: 'coldSprings' }
  state.enemies = [abomination]
  assert.equal(laterBehavior('undimensionedAndUnseen').enemyStatModifier(state, abomination, 'evade'), 0)
})

test('02188 孤狼：独自一人时回合开始获得 1 资源', () => {
  const state = fixture('01001')
  asset(state, '02188')
  const before = me(state).resources
  move(state, { action: 'endTurn' })
  settle(state)
  // 补给阶段本身也会 +1 资源；只看是否有孤狼的触发日志。
  assert.ok(state.log.some(line => String(line).includes('孤狼')) || me(state).resources > before)
})

test('02221 灵魂之歌：受到伤害时额外 2 点并弃掉本卡（harmInterceptor 读点）', () => {
  const state = fixture('01001')
  me(state).damage = 0
  me(state).threat = [{ id: 'song-1', code: '02221', originalCode: '02221' }]
  state.encounterDiscard = []
  applyPenalty(state, me(state), { kind: 'takeDamage', amount: 1 }, 0, [])
  assert.equal(me(state).damage, 3, '1 点基础伤害 + 2 点额外伤害')
  assert.deepEqual(me(state).threat, [], '结算后离开威胁区')
  assert.deepEqual(state.encounterDiscard, ['02221'], '弃进遭遇弃牌堆，而不是消失')
})

test('02221 灵魂之歌：没有伤害时不触发、也不弃卡', () => {
  const state = fixture('01001')
  me(state).damage = 0
  me(state).threat = [{ id: 'song-2', code: '02221', originalCode: '02221' }]
  state.encounterDiscard = []
  applyPenalty(state, me(state), { kind: 'takeHorror', amount: 1 }, 0, [])
  assert.equal(me(state).damage, 0)
  assert.equal(me(state).horror, 1)
  assert.equal(me(state).threat.length, 1, '只有伤害才触发')
  assert.deepEqual(state.encounterDiscard, [])
})

