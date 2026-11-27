// 验收 11-a 分片 3（tdcp 11088–11129）补充证据：
// 本分片 42 张里 40 张已有标题含卡号用例；11127 / 11128 只在「四张基础弱点」循环里被部分覆盖，
// 标题不含卡号，故在此各补一条真实执行（引擎 fixture + legalMoves/move/settle）。
// 主进程合并时需登记进 tests/suites.mjs 与 tests/node-suite.mjs（未登记会使 suite-manifest 红）。
import test from 'node:test'
import assert from 'node:assert/strict'

import { drawCards } from '../src/engine/engine.js'
import { asset, enemy, fixture, legalMoves, move, settle } from './core-fixture.mjs'

const hero = state => state.investigators[0]

test('11115 两个符号累加为对同一选择目标的 2 点伤害；可以跳过且保持重整', () => {
  for (const skip of [false, true]) {
    const state = fixture('11014')
    state.chaosBag = ['skull', 'cultist']
    const inv = hero(state)
    inv.combat = 8
    inv.willpower = 8
    inv.deck.push('11010')
    drawCards(state, inv, 1, [])
    const sword = asset(state, '11115')
    const target = enemy(state)
    const other = enemy(state, { engagedSeat: null })
    const attack = legalMoves(state).find(entry => entry.assetId === sword.id && entry.targetId === target.id)
    assert.ok(attack)
    move(state, attack)
    let choices = 0
    settle(state, choice => {
      if (choice.source !== sword.code || choice.kind !== 'enemy') return null
      choices++
      return skip ? 'skip' : other.id
    })
    assert.deepEqual([...state.lastTestResult.drawn].sort(), ['cultist', 'skull'])
    assert.equal(choices, 1)
    assert.equal(state.enemies.find(card => card.id === target.id).damageTaken, 1)
    assert.equal(state.enemies.find(card => card.id === other.id).damageTaken, skip ? 0 : 2)
    assert.equal(hero(state).assets.find(card => card.id === sword.id).exhausted, !skip)
  }
})

test('11127 病态好奇：成功调查后回合结束不受伤；未成功调查则受 1 伤害并洗回牌库', () => {
  const state = fixture('01001', 2)
  const inv = hero(state)
  inv.deck.push('11127')
  drawCards(state, inv, 1, [])
  assert.ok(hero(state).threat.some(card => card.code === '11127'), '显现后应进入威胁区')

  const investigate = legalMoves(state).find(candidate => candidate.action === 'investigate')
  assert.ok(investigate, '应有调查行动')
  move(state, investigate)
  settle(state)
  assert.ok(hero(state).roundActionHistory.successes.includes('investigate'), '应记录本轮成功调查')
  move(state, { action: 'endTurn' })
  settle(state)
  assert.equal(hero(state).damage + hero(state).horror, 0, '成功调查过则不受伤')
  assert.ok(hero(state).threat.some(card => card.code === '11127'), '满足条件时留在威胁区')

  // 失败分支：另一局不调查直接结束回合 → 1 伤害 + 洗回牌库。
  const state2 = fixture('01001', 2)
  const inv2 = hero(state2)
  inv2.deck.push('11127')
  drawCards(state2, inv2, 1, [])
  move(state2, { action: 'endTurn' })
  settle(state2)
  assert.equal(hero(state2).damage + hero(state2).horror, 1, '未成功调查应受 1 伤害')
  assert.ok(!hero(state2).threat.some(card => card.code === '11127'), '受伤后应离开威胁区')
  assert.ok(hero(state2).deck.includes('11127'), '应洗回牌库')
})

test('11128 骚灵为祸：成功躲避后回合结束不受伤；未成功躲避则受 1 伤害并洗回牌库', () => {
  const state = fixture('01001', 2)
  const inv = hero(state)
  inv.deck.push('11128')
  drawCards(state, inv, 1, [])
  assert.ok(hero(state).threat.some(card => card.code === '11128'), '显现后应进入威胁区')
  enemy(state)

  const evade = legalMoves(state).find(candidate => candidate.action === 'evade')
  assert.ok(evade, '应有躲避行动')
  move(state, evade)
  settle(state)
  assert.ok(hero(state).roundActionHistory.successes.includes('evade'), '应记录本轮成功躲避')
  move(state, { action: 'endTurn' })
  settle(state)
  assert.equal(hero(state).damage + hero(state).horror, 0, '成功躲避过则不受伤')
  assert.ok(hero(state).threat.some(card => card.code === '11128'), '满足条件时留在威胁区')

  const state2 = fixture('01001', 2)
  const inv2 = hero(state2)
  inv2.deck.push('11128')
  drawCards(state2, inv2, 1, [])
  move(state2, { action: 'endTurn' })
  settle(state2)
  assert.equal(hero(state2).damage + hero(state2).horror, 1, '未成功躲避应受 1 伤害')
  assert.ok(!hero(state2).threat.some(card => card.code === '11128'), '受伤后应离开威胁区')
  assert.ok(hero(state2).deck.includes('11128'), '应洗回牌库')
})
