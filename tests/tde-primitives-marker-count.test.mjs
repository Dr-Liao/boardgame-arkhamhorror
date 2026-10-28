// TDE P3 批次 3：剧本参考卡计数（scenario.markerCount）的 Node 验收。
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  REFERENCE_MARKER_ID, addMarker, markerCountOf, markerSummary, referenceMarkerCount,
  resetMarkerCount, setMarkerCount,
} from '../src/engine/marker-count.js'

test('默认 0；只读不建字段', () => {
  const state = {}
  assert.equal(markerCountOf(state), 0)
  assert.equal(referenceMarkerCount(state), 0)
  assert.equal('markerCounts' in state, false)
  assert.equal(REFERENCE_MARKER_ID, 'reference')
})

test('加/减计数：0 下限，按命名 id 分开记', () => {
  const state = {}
  assert.equal(addMarker(state, REFERENCE_MARKER_ID, 2), 2)
  assert.equal(addMarker(state, REFERENCE_MARKER_ID), 3)
  assert.equal(addMarker(state, 'signsOfTheGods', 1), 1)
  assert.equal(referenceMarkerCount(state), 3)
  assert.equal(addMarker(state, REFERENCE_MARKER_ID, -9), 0)
})

test('setMarkerCount 取整、负数归零', () => {
  const state = {}
  assert.equal(setMarkerCount(state, 'x', 2.9), 2)
  assert.equal(setMarkerCount(state, 'y', -5), 0)
  assert.equal(markerCountOf(state, 'y'), 0)
})

test('resetMarkerCount 返回旧值并删除该计数', () => {
  const state = {}
  addMarker(state, REFERENCE_MARKER_ID, 4)
  assert.equal(resetMarkerCount(state), 4)
  assert.equal(referenceMarkerCount(state), 0)
  assert.equal(markerSummary(state).length, 0)
})

test('markerSummary 暴露全部命名计数', () => {
  const state = {}
  addMarker(state, 'reference', 2)
  addMarker(state, 'signsOfTheGods', 1)
  assert.deepEqual(markerSummary(state), [
    { id: 'reference', count: 2 },
    { id: 'signsOfTheGods', count: 1 },
  ])
})

test('JSON 往返后计数保持', () => {
  const state = {}
  addMarker(state, 'reference', 5)
  const restored = JSON.parse(JSON.stringify(state))
  assert.equal(referenceMarkerCount(restored), 5)
})
