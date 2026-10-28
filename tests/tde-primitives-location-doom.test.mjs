// TDE P3 批次 3：地点毁灭（location.doom）的 Node 验收。
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  addLocationDoom, destroyLocation, locationDoomOf, locationDoomThreshold, normalizeLocationDoom,
  shouldDestroyLocation, totalLocationDoom,
} from '../src/engine/location-doom.js'

const loc = (overrides = {}) => ({ id: 'web1', code: '06350', doomThreshold: 3, ...overrides })

test('默认 0；阈值未声明为 null', () => {
  assert.equal(locationDoomOf(loc()), 0)
  assert.equal(locationDoomThreshold(loc()), 3)
  assert.equal(locationDoomThreshold({ id: 'x' }), null)
})

test('加/减毁灭：0 下限，达到阈值才可毁灭', () => {
  const location = loc()
  assert.equal(addLocationDoom(location, 2), 2)
  assert.equal(shouldDestroyLocation(location), false)
  assert.equal(addLocationDoom(location, 2), 4)
  assert.equal(shouldDestroyLocation(location), true)
  assert.equal(addLocationDoom(location, -9), 0)
  assert.equal(shouldDestroyLocation(location), false)
})

test('destroyLocation：满足阈值才移除，记入 destroyedLocations', () => {
  const state = { locations: [loc(), loc({ id: 'web2', code: '06351', doomThreshold: 5 })] }
  addLocationDoom(state.locations[0], 3)
  const result = destroyLocation(state, 'web1')
  assert.deepEqual(result, { destroyed: true, code: '06350', doom: 3 })
  assert.equal(state.locations.length, 1)
  assert.deepEqual(state.destroyedLocations, ['06350'])
})

test('未达阈值/不存在：不移除，返回 destroyed:false', () => {
  const state = { locations: [loc()] }
  addLocationDoom(state.locations[0], 1)
  assert.deepEqual(destroyLocation(state, 'web1'), { destroyed: false, code: '06350', doom: 1 })
  assert.equal(state.locations.length, 1)
  assert.deepEqual(destroyLocation(state, 'nope'), { destroyed: false, code: null, doom: 0 })
})

test('毁灭时把毁灭加到议程（addDoom 注入）', () => {
  const state = { locations: [loc()], doom: 0 }
  addLocationDoom(state.locations[0], 3)
  const addDoom = (target, n) => { target.doom += n }
  destroyLocation(state, 'web1', { addDoom })
  assert.equal(state.doom, 3)
})

test('totalLocationDoom 汇总全桌地点毁灭', () => {
  const state = { locations: [loc(), loc({ id: 'web2' })] }
  addLocationDoom(state.locations[0], 2)
  addLocationDoom(state.locations[1], 1)
  assert.equal(totalLocationDoom(state), 3)
  assert.equal(totalLocationDoom({}), 0)
})

test('注册期校验：阈值必须正整数；返回用到的阈值集合', () => {
  assert.deepEqual(normalizeLocationDoom([{ doomThreshold: 3 }, { doomThreshold: 5 }, {}]),
    { ok: true, thresholds: [3, 5], problems: [] })
  const bad = normalizeLocationDoom([{ code: '06350', doomThreshold: 0 }, { code: '06351', doomThreshold: -2 }])
  assert.equal(bad.ok, false)
  assert.equal(bad.problems.length, 2)
  assert.match(bad.problems[0], /正整数/)
})

test('未使用地点毁灭的战役不产生字段（只读零写入）', () => {
  const plain = { locations: [{ id: 'x' }] }
  assert.equal(totalLocationDoom(plain), 0)
  assert.equal('destroyedLocations' in plain, false)
  assert.equal('doomOnLocation' in plain.locations[0], false)
})
