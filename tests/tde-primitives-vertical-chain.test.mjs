// TDE P3 批次 2：纵向地点链（location.verticalChain）的 Node 验收。
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  chainNeighbors, linkVerticalChain, moveAlongChain, normalizeVerticalChain, orderVerticalChain, verticalIndexOf,
} from '../src/engine/vertical-chain.js'

const chain = () => ({
  locations: [
    { id: 'stairs-0', code: '06183' },
    { id: 'stairs-1', code: '06184' },
    { id: 'stairs-2', code: '06185' },
  ],
})

test('verticalIndexOf：未声明返回 null；0 是合法层号', () => {
  assert.equal(verticalIndexOf({ verticalIndex: 0 }), 0)
  assert.equal(verticalIndexOf({ verticalIndex: 3 }), 3)
  assert.equal(verticalIndexOf({}), null)
  assert.equal(verticalIndexOf(null), null)
})

test('orderVerticalChain：按层号排序，未声明的排在最后且保持顺序', () => {
  const ordered = orderVerticalChain([
    { id: 'c', verticalIndex: 2 },
    { id: 'x' },
    { id: 'a', verticalIndex: 0 },
    { id: 'y' },
    { id: 'b', verticalIndex: 1 },
  ])
  assert.deepEqual(ordered.map(item => item.id), ['a', 'b', 'c', 'x', 'y'])
})

test('linkVerticalChain：设置层号并补上/下连接（幂等）', () => {
  const state = chain()
  const result = linkVerticalChain(state, ['stairs-0', 'stairs-1', 'stairs-2'])
  assert.deepEqual(result, { linked: 3, ids: ['stairs-0', 'stairs-1', 'stairs-2'] })
  assert.deepEqual(state.locations.map(loc => loc.verticalIndex), [0, 1, 2])
  assert.deepEqual(state.locations[1].connections.sort(), ['stairs-0', 'stairs-2'])
  assert.deepEqual(state.locations[0].connections, ['stairs-1'])
  assert.deepEqual(state.locations[2].connections, ['stairs-1'])
  // 再连一次不会重复添加
  linkVerticalChain(state, ['stairs-0', 'stairs-1', 'stairs-2'])
  assert.equal(state.locations[1].connections.filter(id => id === 'stairs-0').length, 1)
})

test('linkVerticalChain：未知 id 跳过', () => {
  const state = chain()
  assert.deepEqual(linkVerticalChain(state, ['stairs-0', 'missing', 'stairs-2']), { linked: 2, ids: ['stairs-0', 'stairs-2'] })
})

test('chainNeighbors / moveAlongChain：越界返回 null，不夹到端点', () => {
  const state = chain()
  linkVerticalChain(state, ['stairs-0', 'stairs-1', 'stairs-2'])
  assert.deepEqual(chainNeighbors(state, 'stairs-1'), { above: 'stairs-0', below: 'stairs-2' })
  assert.deepEqual(chainNeighbors(state, 'nope'), { above: null, below: null })
  assert.equal(moveAlongChain(state, 'stairs-0', 2), 'stairs-2')
  assert.equal(moveAlongChain(state, 'stairs-2', -1), 'stairs-1')
  assert.equal(moveAlongChain(state, 'stairs-0', -1), null)
  assert.equal(moveAlongChain(state, 'stairs-2', 1), null)
})

test('normalizeVerticalChain：连续层号通过；缺口/重复报问题', () => {
  assert.deepEqual(normalizeVerticalChain([{ verticalIndex: 0 }, { verticalIndex: 1 }, { verticalIndex: 2 }]),
    { ok: true, levels: [0, 1, 2], problems: [] })
  const gap = normalizeVerticalChain([{ verticalIndex: 0 }, { verticalIndex: 2 }])
  assert.equal(gap.ok, false)
  assert.match(gap.problems.join(' '), /层号不连续/)
  const dup = normalizeVerticalChain([{ verticalIndex: 0 }, { verticalIndex: 0 }])
  assert.equal(dup.ok, false)
  assert.match(dup.problems.join(' '), /层号重复/)
})

test('未声明层号的地点不参与校验；空输入合法', () => {
  assert.deepEqual(normalizeVerticalChain([{}, { id: 'x' }]), { ok: true, levels: [], problems: [] })
  assert.deepEqual(normalizeVerticalChain(null), { ok: true, levels: [], problems: [] })
  assert.deepEqual(orderVerticalChain(null), [])
})
