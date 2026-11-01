import test from 'node:test'
import assert from 'node:assert/strict'
import { vitalDisplay } from '../web/vitals.js'

// 生命 / 理智仪表的显示换算。核心场景：卡城幽影（Dim Carcosa）的调查员
// 不会因恐惧被击败，恐惧可以超过理智上限，剩余理智必须如实显示为负数。
test('vitalDisplay：常规剩余生命/理智与进度条比例', () => {
  const health = vitalDisplay(9, 7)
  assert.equal(health.total, 9)
  assert.equal(health.current, 7)
  assert.equal(health.overflow, false)
  assert.ok(Math.abs(health.fill - 100 * 7 / 9) < 1e-9)

  const sanity = vitalDisplay(5, 1, { allowNegative: true })
  assert.equal(sanity.total, 5)
  assert.equal(sanity.current, 1)
  assert.equal(sanity.overflow, false)
  assert.ok(Math.abs(sanity.fill - 20) < 1e-9)

  // 满值、超出上限（治疗/修正溢出）都只影响数字与进度条，不产生负值。
  assert.deepEqual(vitalDisplay(5, 5), { total: 5, current: 5, overflow: false, fill: 100 })
  assert.deepEqual(vitalDisplay(5, 9, { allowNegative: true }), { total: 5, current: 9, overflow: false, fill: 100 })
})

test('vitalDisplay：卡城幽影的剩余理智允许为负，进度条回到 0', () => {
  const overflow = vitalDisplay(5, -2, { allowNegative: true })
  assert.equal(overflow.total, 5)
  assert.equal(overflow.current, -2)
  assert.equal(overflow.overflow, true)
  assert.equal(overflow.fill, 0)

  // 恐惧恰好等于上限时剩余理智为 0：不是溢出态，但进度条同样是空的。
  const empty = vitalDisplay(5, 0, { allowNegative: true })
  assert.deepEqual(empty, { total: 5, current: 0, overflow: false, fill: 0 })
})

test('vitalDisplay：未开放负值的生命钳制在 0（伤害达到上限即被击败）', () => {
  const lethal = vitalDisplay(9, -3)
  assert.equal(lethal.current, 0)
  assert.equal(lethal.overflow, false)
  assert.equal(lethal.fill, 0)

  // 上限为 0 或字段缺失时不出现 NaN。
  assert.deepEqual(vitalDisplay(0, 0), { total: 0, current: 0, overflow: false, fill: 0 })
  assert.deepEqual(vitalDisplay(undefined, undefined, { allowNegative: true }),
    { total: 0, current: 0, overflow: false, fill: 0 })
  assert.deepEqual(vitalDisplay('5', '3'), { total: 5, current: 3, overflow: false, fill: 60 })
})
