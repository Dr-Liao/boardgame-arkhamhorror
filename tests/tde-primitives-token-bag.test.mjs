// TDE P3 批次 2：蛛群滋生袋（tokenBag）的 Node 验收。
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  INFESTATION_BAG_ID, addTokenToBag, clearInfested, createTokenBag, infestedCount, isInfestedLocation,
  markInfested, resetTokenBag, returnTokenToBag, revealTokenFromBag, tokenBagInfo,
} from '../src/engine/token-bag.js'

const emptyBags = () => ({ tokenBags: {}, infestedLocations: [] })

test('建袋 / 读袋：只暴露张数与已揭示内容', () => {
  const state = emptyBags()
  assert.deepEqual(tokenBagInfo(state, INFESTATION_BAG_ID), { id: INFESTATION_BAG_ID, exists: false, count: 0, revealed: [] })
  assert.equal(createTokenBag(state, INFESTATION_BAG_ID, ['infestation', 'infestation', 'nothing']), 3)
  assert.deepEqual(tokenBagInfo(state, INFESTATION_BAG_ID), { id: INFESTATION_BAG_ID, exists: true, count: 3, revealed: [] })
})

test('抽取：默认随机、可从袋里移除并进入 revealed', () => {
  const state = emptyBags()
  createTokenBag(state, INFESTATION_BAG_ID, ['a', 'b', 'c'])
  const token = revealTokenFromBag(state, INFESTATION_BAG_ID)
  assert.ok(['a', 'b', 'c'].includes(token))
  assert.equal(tokenBagInfo(state, INFESTATION_BAG_ID).count, 2)
  assert.deepEqual(tokenBagInfo(state, INFESTATION_BAG_ID).revealed, [token])
})

test('抽取：注入 rng 让结果确定（0 → 第一张，0.999 → 最后一张）', () => {
  const state = emptyBags()
  createTokenBag(state, 'bag', ['first', 'middle', 'last'])
  assert.equal(revealTokenFromBag(state, 'bag', { rng: () => 0 }), 'first')
  assert.equal(revealTokenFromBag(state, 'bag', { rng: () => 0.999999 }), 'last')
  assert.equal(tokenBagInfo(state, 'bag').count, 1)
})

test('空袋/不存在的袋返回 null，不抛错', () => {
  const state = emptyBags()
  assert.equal(revealTokenFromBag(state, 'missing'), null)
  createTokenBag(state, 'bag', [])
  assert.equal(revealTokenFromBag(state, 'bag'), null)
})

test('放回与加入：return 只能放回已揭示的 token', () => {
  const state = emptyBags()
  createTokenBag(state, 'bag', ['a'])
  const token = revealTokenFromBag(state, 'bag', { rng: () => 0 })
  assert.equal(returnTokenToBag(state, 'bag', token), true)
  assert.equal(tokenBagInfo(state, 'bag').count, 1)
  assert.equal(returnTokenToBag(state, 'bag', token), false, '同一 token 不能放回两次')
  assert.equal(addTokenToBag(state, 'bag', ['b', 'c']), 3)
  assert.equal(tokenBagInfo(state, 'bag').count, 3)
})

test('重置：删袋或按新 token 重建', () => {
  const state = emptyBags()
  createTokenBag(state, 'bag', ['a', 'b'])
  assert.equal(resetTokenBag(state, 'bag').tokens.length, 2)
  assert.equal(tokenBagInfo(state, 'bag').exists, false)
  resetTokenBag(state, 'bag', ['c'])
  assert.deepEqual(tokenBagInfo(state, 'bag').revealed, [])
  assert.equal(tokenBagInfo(state, 'bag').count, 1)
})

test('infestation：标记/取消/计数/幂等', () => {
  const state = emptyBags()
  assert.equal(markInfested(state, 'loc1'), true)
  assert.equal(markInfested(state, 'loc1'), false)
  assert.equal(markInfested(state, 'loc2'), true)
  assert.equal(isInfestedLocation(state, 'loc1'), true)
  assert.equal(isInfestedLocation(state, 'loc3'), false)
  assert.equal(infestedCount(state), 2)
  assert.equal(clearInfested(state, 'loc1'), true)
  assert.equal(clearInfested(state, 'loc1'), false)
  assert.equal(infestedCount(state), 1)
})

test('JSON 往返；未使用时不产生字段', () => {
  const state = emptyBags()
  createTokenBag(state, 'bag', ['a'])
  markInfested(state, 'loc1')
  const restored = JSON.parse(JSON.stringify(state))
  assert.equal(tokenBagInfo(restored, 'bag').count, 1)
  assert.equal(isInfestedLocation(restored, 'loc1'), true)
  const untouched = {}
  assert.equal(tokenBagInfo(untouched, 'bag').exists, false)
  assert.equal('tokenBags' in untouched, false, '只读不写')
})
