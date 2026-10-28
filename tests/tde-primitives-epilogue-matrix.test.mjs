// TDE P3 批次 3：双线结局矩阵（campaign.epilogueMatrix）的 Node 验收。
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  epilogueFor, epiloguesForA, flattenEpilogueMatrix, isEpilogueMatrix, locateEpilogue, normalizeEpilogueMatrix,
} from '../src/campaign/epilogue-matrix.js'

const A = ['a1', 'a2', 'a3', 'a4']
const B = ['b1', 'b2', 'b3', 'b4']

function matrix({ drop = [], extra = false } = {}) {
  const entries = {}
  for (const a of A) {
    for (const b of B) {
      if (drop.includes(`${a}|${b}`)) continue
      entries[`${a}|${b}`] = { title: `${a}-${b}`, textKey: `tde-epilogue-${a}-${b}` }
    }
  }
  if (extra) entries['a9|b9'] = { title: 'extra' }
  return { a: A.map(id => ({ id })), b: B.map(id => ({ id })), entries }
}

test('4×4=16 格完整 → ok；缺格/多格被点名', () => {
  const complete = normalizeEpilogueMatrix(matrix())
  assert.deepEqual(complete, { ok: true, expected: 16, found: 16, missing: [], extra: [], broken: false })
  const missing = normalizeEpilogueMatrix(matrix({ drop: ['a4|b4'] }))
  assert.equal(missing.ok, false)
  assert.deepEqual(missing.missing, ['a4|b4'])
  const extra = normalizeEpilogueMatrix(matrix({ extra: true }))
  assert.equal(extra.ok, false)
  assert.deepEqual(extra.extra, ['a9|b9'])
})

test('坏矩阵不崩：返回 broken 标记', () => {
  assert.deepEqual(normalizeEpilogueMatrix(null), { ok: false, expected: 0, found: 0, missing: [], extra: [], broken: true })
  assert.equal(isEpilogueMatrix({}), false)
  assert.equal(isEpilogueMatrix(matrix()), true)
  assert.equal(epilogueFor(null, 'a1', 'b1'), null)
})

test('查表：命中返回条目，未知组合返回 null 不抛错', () => {
  const m = matrix({ drop: ['a2|b3'] })
  assert.deepEqual(epilogueFor(m, 'a1', 'b1'), { title: 'a1-b1', textKey: 'tde-epilogue-a1-b1' })
  assert.equal(epilogueFor(m, 'a2', 'b3'), null)
  assert.throws(() => epilogueFor(m, '', 'b1'), /两个轴的 id/)
})

test('按 a 轴分组与扁平展开（顺序稳定）', () => {
  const m = matrix()
  assert.deepEqual(epiloguesForA(m, 'a2').map(item => item.b), B)
  const flat = flattenEpilogueMatrix(m)
  assert.equal(flat.length, 16)
  assert.deepEqual(flat[0], { a: 'a1', b: 'b1', title: 'a1-b1', textKey: 'tde-epilogue-a1-b1' })
  assert.deepEqual(flat.at(-1), { a: 'a4', b: 'b4', title: 'a4-b4', textKey: 'tde-epilogue-a4-b4' })
})

test('反查：结局正文 key → 轴坐标；找不到返回 null', () => {
  const m = matrix()
  assert.deepEqual(locateEpilogue(m, 'tde-epilogue-a3-b2'), { a: 'a3', b: 'b2' })
  assert.equal(locateEpilogue(m, 'nope'), null)
  assert.equal(locateEpilogue(m, ''), null)
})

test('JSON 往返后矩阵可查', () => {
  const m = JSON.parse(JSON.stringify(matrix()))
  assert.equal(normalizeEpilogueMatrix(m).ok, true)
  assert.equal(epilogueFor(m, 'a4', 'b4').title, 'a4-b4')
})
