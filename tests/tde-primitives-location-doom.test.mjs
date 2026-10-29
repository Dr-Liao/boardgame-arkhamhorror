// TDE P4：地点上的毁灭（location.doom）的 Node 验收（按官方卡面更正 P3 口径）。
//
// 官方口径（06341–06354 与 06333）：大网地点会累积毁灭标记；地点上的毁灭**是毁灭**，
// 计入议程阈值，也被剧本参考卡的骷髅符号读取（X 为单地点最高毁灭）。06 段没有任何
// 「毁灭达到阈值就把地点移出游戏」的规则，所以本原语只记账，不猜毁灭/阈值。
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  addLocationDoom, highestLocationDoom, locationDoomOf, normalizeLocationDoom,
  removeLocationDoom, totalLocationDoom,
} from '../src/engine/location-doom.js'

const loc = (overrides = {}) => ({ id: 'web1', code: '06341', ...overrides })

test('默认 0；只读函数不建字段', () => {
  const location = loc()
  assert.equal(locationDoomOf(location), 0)
  assert.equal('doomOnLocation' in location, false)
  assert.equal(locationDoomOf(null), 0)
})

test('加/减毁灭：0 下限，返回新值', () => {
  const location = loc()
  assert.equal(addLocationDoom(location, 2), 2)
  assert.equal(addLocationDoom(location, 2), 4)
  assert.equal(addLocationDoom(location, -9), 0)
  assert.equal(location.doomOnLocation, 0)
})

test('removeLocationDoom：卡面「移除 1 个毁灭」的读点', () => {
  const location = loc()
  addLocationDoom(location, 2)
  assert.equal(removeLocationDoom(location), 1)
  assert.equal(removeLocationDoom(location, 5), 0)
  assert.equal(addLocationDoom({}, 1), 1)
  assert.throws(() => addLocationDoom(null), /地点对象/)
})

test('totalLocationDoom 汇总全桌地点毁灭', () => {
  const state = { locations: [loc(), loc({ id: 'web2' })] }
  addLocationDoom(state.locations[0], 2)
  addLocationDoom(state.locations[1], 1)
  assert.equal(totalLocationDoom(state), 3)
  assert.equal(totalLocationDoom({}), 0)
})

test('highestLocationDoom：B4 骷髅符号读单地点最高毁灭', () => {
  const state = { locations: [loc(), loc({ id: 'web2' }), loc({ id: 'web3' })] }
  addLocationDoom(state.locations[0], 1)
  addLocationDoom(state.locations[2], 4)
  assert.equal(highestLocationDoom(state), 4)
  assert.equal(highestLocationDoom({ locations: [] }), 0)
})

test('注册期校验：地点毁灭必须非负整数', () => {
  assert.deepEqual(normalizeLocationDoom([{ doomOnLocation: 0 }, { doomOnLocation: 3 }, {}]), { ok: true, problems: [] })
  const bad = normalizeLocationDoom([{ code: '06341', doomOnLocation: -1 }, { code: '06342', doomOnLocation: 1.5 }])
  assert.equal(bad.ok, false)
  assert.equal(bad.problems.length, 2)
  assert.match(bad.problems[0], /非负整数/)
})

test('未使用地点毁灭的战役不产生字段（只读零写入）', () => {
  const plain = { locations: [{ id: 'x' }] }
  assert.equal(totalLocationDoom(plain), 0)
  assert.equal(highestLocationDoom(plain), 0)
  assert.equal('doomOnLocation' in plain.locations[0], false)
})
