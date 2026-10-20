import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture, asset, enemy, legalMoves, move } from './core-fixture.mjs'
import { actionPreview } from '../src/engine/engine.js'
import { EFFECTS } from '../src/cards/card-effects.js'

// P1 玩家卡一次修：快速卡不再白花行动；攻击/躲避能力不再引发借机攻击。
// 这些是 docs/tfa-card-audit.md §2.7 第 1、2 项的系统性偏差。
const me = state => state.investigators[0]
const abilityMove = (state, code, index = 0) => {
  const card = asset(state, code)
  const found = legalMoves(state).find(move => move.action === 'ability' && move.assetId === card.id && move.abilityIndex === index)
  assert.ok(found, `找不到 ${code} 的能力动作`)
  return found
}

test('快速卡：打出不消耗行动点', () => {
  for (const code of ['04019', '04020', '04193', '04270']) {
    assert.equal(EFFECTS[code]?.fast, true, `${code} 应登记 fast`)
    const state = fixture('04005')
    me(state).hand.push(code)
    const play = legalMoves(state).find(move => move.action === 'play' && (move.cardId === code))
    assert.ok(play, `${code} 应可打出`)
    assert.equal(actionPreview(state, 0, play).actions, 0, `${code} 打出不应花行动`)
  }
})

test('攻击 / 躲避能力不引发借机攻击，普通能力仍然引发', () => {
  const expected = [
    ['04229', 0, 'fight'], // 勃朗宁
    ['04265', 0, 'evade'], // 手铐
    ['04271', 0, 'evade'], // 诱饵躲避（充能）
    ['04273', 0, 'fight'], // 陈旧猎枪
    ['04276', 1, 'fight'], // 蓄力斩
    ['04305', 0, 'fight'], // 火焰喷射器
    ['04310', 0, 'fight'], // 第七印记碎片
    ['04029', 0, 'evade'], // 诱饵躲避（意志）
  ]
  for (const [code, index, kind] of expected) {
    const state = fixture('01001')
    enemy(state, { engagedSeat: 0, traits: ['humanoid'] })
    const ability = abilityMove(state, code, index)
    assert.equal(actionPreview(state, 0, ability).opportunityAttacks.length, 0, `${code}（${kind}）不应引发借机攻击`)
    assert.equal(EFFECTS[code].abilities[index].effect.kind, kind, `${code} 需要声明 kind`)
  }
  // 对照：普通支援能力（重新搭箭）仍会引发借机攻击。
  const control = fixture('01001')
  enemy(control, { engagedSeat: 0 })
  const reload = abilityMove(control, '04204', 1)
  assert.equal(actionPreview(control, 0, reload).opportunityAttacks.length, 1)
})

test('芬恩的可靠 .38 按攻击结算，不引发借机攻击', () => {
  const state = fixture('04003')
  enemy(state, { engagedSeat: 0 })
  const card = asset(state, '04011')
  const found = legalMoves(state).find(move => move.action === 'ability' && move.assetId === card.id)
  assert.ok(found)
  assert.equal(EFFECTS['04011'].abilities[0].effect.kind, 'fight')
  assert.equal(actionPreview(state, 0, found).opportunityAttacks.length, 0)
})

test('攻击能力结算时不再先吃一次借机攻击', () => {
  const state = fixture('01001')
  const attacker = enemy(state, { engagedSeat: 0, traits: ['humanoid'], damage: 1 })
  state.chaosBag = ['0']
  const card = asset(state, '04305', { uses: 4, usesType: 'ammo' })
  const before = me(state).damage
  move(state, { action: 'ability', assetId: card.id, abilityIndex: 0, enemyId: attacker.id })
  assert.equal(me(state).damage, before, '不应被交战敌人借机攻击')
})
