// TDE P3 批次 2：按调查员计数器（counter.investigator）的 Node 验收。
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  ALARM_LEVEL_MAX, COUNTER_IDS, addCounter, counterAtLeast, counterMax, counterOf, counterSummary,
  highestCounter, resetCounter, setCounter, setCounterMax,
} from '../src/engine/counters.js'

const state = () => ({ numInvestigators: 3 })

test('默认 0；COUNTER_IDS 固定', () => {
  const s = state()
  assert.equal(counterOf(s, 0, 'alarmLevel'), 0)
  assert.equal(highestCounter(s, 'alarmLevel'), null)
  assert.deepEqual([...COUNTER_IDS], ['alarmLevel', 'bounty'])
})

test('加/减计数器：0 下限、按上限 clamp', () => {
  const s = state()
  setCounterMax(s, 'alarmLevel', ALARM_LEVEL_MAX)
  assert.equal(addCounter(s, 1, 'alarmLevel', 2), 2)
  assert.equal(addCounter(s, 1, 'alarmLevel', 10), 5)
  assert.equal(addCounter(s, 1, 'alarmLevel', -3), 2)
  assert.equal(addCounter(s, 1, 'alarmLevel', -99), 0)
  assert.equal(counterMax(s, 'alarmLevel'), 5)
})

test('「5 或更高」用 >= 判定', () => {
  const s = state()
  setCounterMax(s, 'alarmLevel', ALARM_LEVEL_MAX)
  addCounter(s, 0, 'alarmLevel', 5)
  assert.equal(counterAtLeast(s, 0, 'alarmLevel', 5), true)
  setCounter(s, 0, 'alarmLevel', 7)
  assert.equal(counterOf(s, 0, 'alarmLevel'), 5, 'setCounter 也按上限 clamp')
})

test('全桌最高值与逐座位摘要', () => {
  const s = state()
  addCounter(s, 0, 'alarmLevel', 1)
  addCounter(s, 2, 'alarmLevel', 4)
  assert.equal(highestCounter(s, 'alarmLevel'), 4)
  assert.deepEqual(counterSummary(s, 'alarmLevel', 3), [1, 0, 4])
  assert.deepEqual(counterSummary(s, 'alarmLevel', 4), [1, 0, 4, 0])
})

test('无上限的计数（赏金）与上限解除', () => {
  const s = state()
  addCounter(s, 0, 'bounty', 3)
  addCounter(s, 0, 'bounty', 4)
  assert.equal(counterOf(s, 0, 'bounty'), 7)
  setCounterMax(s, 'bounty', 2)
  assert.equal(counterMax(s, 'bounty'), 2)
  setCounter(s, 0, 'bounty', 2)
  setCounterMax(s, 'bounty', null)
  addCounter(s, 0, 'bounty', 6)
  assert.equal(counterOf(s, 0, 'bounty'), 8)
})

test('非法输入抛错、未知 id 不抛', () => {
  const s = state()
  assert.throws(() => counterOf(s, -1, 'alarmLevel'), /非法座位/)
  assert.throws(() => counterOf(s, 1.5, 'alarmLevel'), /非法座位/)
  assert.throws(() => counterOf(s, 0, ''), /需要 id/)
  assert.equal(counterOf(s, 0, 'unknownCounter'), 0)
})

test('resetCounter 删除整张表并返回旧值', () => {
  const s = state()
  addCounter(s, 0, 'alarmLevel', 2)
  const previous = resetCounter(s, 'alarmLevel')
  assert.deepEqual(previous.seats, [2])
  assert.equal(counterOf(s, 0, 'alarmLevel'), 0)
})

test('JSON 往返后计数保持；未用过的 state 不产生字段', () => {
  const s = state()
  addCounter(s, 1, 'bounty', 2)
  const restored = JSON.parse(JSON.stringify(s))
  assert.equal(counterOf(restored, 1, 'bounty'), 2)
  const plain = {}
  assert.equal('investigatorCounters' in plain, false)
  assert.equal(counterOf(plain, 0, 'bounty'), 0)
  assert.equal('investigatorCounters' in plain, false, '只读不写')
})
