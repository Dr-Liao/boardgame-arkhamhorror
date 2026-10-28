// TDE P3 批次 3：地点型 Bonded（location.placeBondedLocation）的 Node 验收。
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  bondedCodesOf, bondedPartnerOf, normalizeBondedLocations, placeBondedLocation, removeBondedLocation,
} from '../src/engine/bonded-location.js'

const spawn = (state, seq) => def => {
  const location = { ...def, id: `${def.code}-${(seq.n += 1)}`, originalCode: def.code, revealed: true }
  state.locations.push(location)
  return location
}

const hostDef = { code: '06015a', name: 'Dream Gate', text: 'Bonded (06015b).' }

test('解析 Bonded 卡号：卡文 / 字段 / 多张', () => {
  assert.deepEqual(bondedCodesOf({ text: 'Bonded (06015b).' }), ['06015b'])
  assert.deepEqual(bondedCodesOf({ bonded: ['06015b', '06016a'] }), ['06015b', '06016a'])
  assert.deepEqual(bondedCodesOf({ bonded: '06015b' }), ['06015b'])
  assert.deepEqual(bondedCodesOf({ text: 'Bonded (06015b, 06016a).' }), ['06015b', '06016a'])
  assert.deepEqual(bondedCodesOf({ text: 'No bonded here.' }), [])
  assert.deepEqual(bondedCodesOf(null), [])
})

test('放下一面时把伙伴一起放进场并互相链接', () => {
  const state = { locations: [] }
  const seq = { n: 0 }
  const result = placeBondedLocation(state, hostDef, { spawnLocation: spawn(state, seq) })
  assert.equal(state.locations.length, 2)
  assert.equal(result.placed.code, '06015a')
  assert.equal(result.partner.code, '06015b')
  assert.equal(result.placed.bondedPartnerId, result.partner.id)
  assert.equal(result.partner.bondedPartnerId, result.placed.id)
  assert.equal(result.placed.bondedCode, '06015b')
  assert.equal(bondedPartnerOf(state, result.placed.id), result.partner)
})

test('伙伴已在场：默认链接复用，不重复生成；onExisting=throw 抛错', () => {
  const state = { locations: [] }
  const seq = { n: 0 }
  placeBondedLocation(state, { code: '06015b', text: 'Bonded (06015a).' }, { spawnLocation: spawn(state, seq) })
  assert.equal(state.locations.length, 2)
  const before = state.locations.length
  const again = placeBondedLocation(state, hostDef, { spawnLocation: spawn(state, seq) })
  assert.equal(state.locations.length, before)
  assert.equal(bondedPartnerOf(state, again.placed.id), again.partner)
  assert.throws(() => placeBondedLocation(state, hostDef, { spawnLocation: spawn(state, seq), onExisting: 'throw' }), /伙伴已在场/)
})

test('成对移除：返回顺序 [本体, 伙伴]', () => {
  const state = { locations: [] }
  const seq = { n: 0 }
  const { placed } = placeBondedLocation(state, hostDef, { spawnLocation: spawn(state, seq) })
  const removed = removeBondedLocation(state, placed.id)
  assert.deepEqual(removed, [placed.id, '06015b-2'])
  assert.equal(state.locations.length, 0)
  assert.deepEqual(removeBondedLocation(state, placed.id), [], '重复移除是空操作')
})

test('非法输入与缺伙伴：抛错/点名', () => {
  assert.throws(() => placeBondedLocation({}, hostDef), /spawnLocation/)
  assert.throws(() => placeBondedLocation({}, { code: '06015a', text: '无' }, { spawnLocation: () => ({}) }), /没有 Bonded 卡号/)
  assert.throws(() => placeBondedLocation({}, null, { spawnLocation: () => ({}) }), /带 code/)
  const normalized = normalizeBondedLocations([{ code: '06015a', text: 'Bonded (09999).' }])
  assert.deepEqual(normalized, { total: 1, missing: ['06015a→09999'] })
  assert.deepEqual(normalizeBondedLocations([{ code: '06015a', text: 'Bonded (06015b).' }, { code: '06015b' }]), { total: 1, missing: [] })
})

test('JSON 往返后链接保持', () => {
  const state = { locations: [] }
  const seq = { n: 0 }
  const { placed } = placeBondedLocation(state, hostDef, { spawnLocation: spawn(state, seq) })
  const restored = JSON.parse(JSON.stringify(state))
  assert.equal(bondedPartnerOf(restored, placed.id).code, '06015b')
})
