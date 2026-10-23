// 万象无终（TCU）第 2 步 P2.3 原语验收：幽灵地点与翻面。
//
// 覆盖路线图 §4.1 的必测项：翻面、连接、线索/毁灭保留、离开、存档；外加
// 「单面幽灵地点只读标志」与「非幽灵地点不会误判」。
//
// 数据形状（关卡 definition 的地点里，纯 JSON）：
//   单面：{ spectral: true }
//   双面：{ back: { code, name, subname, clues } }  —— back 是幽灵面
// 读点：spectralFaceOf / isSpectralLocation（locations.js）、
//       scenarioRuntime.flipSpectral / isSpectral / spectralFace。

import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture, move, settle } from './core-fixture.mjs'
import { flipLocationFace } from '../src/engine/engine.js'
import { isSpectralLocation, spectralFaceOf } from '../src/engine/locations.js'

function spectralFixture(back) {
  const state = fixture('01001', 1)
  const inv = state.investigators[0]
  const loc = state.locations.find(location => location.id === inv.location)
  if (back) loc.back = back
  return { state, inv, loc }
}

test('P2.3 读点：普通地点默认 normal，单面幽灵地点声明 spectral: true', () => {
  const plain = { id: 'loc', name: '普通地点' }
  assert.equal(spectralFaceOf(plain), 'normal')
  const single = { id: 'loc', name: '幽灵地点', spectral: true }
  assert.equal(spectralFaceOf(single), 'spectral')
  const flipped = { id: 'loc', name: '地点', spectralFace: 'spectral' }
  assert.equal(spectralFaceOf(flipped), 'spectral')
  assert.equal(spectralFaceOf(null), 'normal')

  const { state, loc } = spectralFixture(null)
  assert.equal(isSpectralLocation(state, loc.id), false)
  assert.equal(isSpectralLocation(state, 'nowhere'), false)
  loc.spectral = true
  assert.equal(isSpectralLocation(state, loc.id), true)
})

test('P2.3 翻面：双面地点翻到幽灵面，保留线索并换掉印刷字段', () => {
  const { state, loc } = spectralFixture({
    code: '05166b', name: '绞刑者河（幽灵面）', subname: '幽灵界', clues: 2,
  })
  loc.clues = 2
  const before = { code: loc.originalCode || loc.code, name: loc.name }
  assert.equal(flipLocationFace(state, loc.id, 0, []), true)
  const after = state.locations.find(location => location.id === loc.id)
  assert.equal(after.code, '05166b')
  assert.equal(after.originalCode, '05166b')
  assert.equal(after.name, '绞刑者河（幽灵面）')
  assert.equal(after.subname, '幽灵界')
  assert.equal(after.spectral, true)
  assert.equal(after.spectralFace, 'spectral')
  // 线索保留（幽灵面不重置线索）。
  assert.equal(after.clues, 2)
  assert.equal(after.front.code, before.code)
  assert.equal(after.front.name, before.name)
  assert.ok(state.log.some(line => line.includes('翻到了幽灵面')))
})

test('P2.3 翻面：翻回正常面恢复正面字段', () => {
  const { state, loc } = spectralFixture({ code: '05166b', name: '幽灵面', clues: 1 })
  flipLocationFace(state, loc.id, 0, [])
  assert.equal(flipLocationFace(state, loc.id, 0, []), true)
  const after = state.locations.find(location => location.id === loc.id)
  assert.equal(after.code, loc.front.code)
  assert.equal(after.spectral, false)
  assert.equal(after.spectralFace, 'normal')
  assert.ok(state.log.some(line => line.includes('回到了正常面')))
})

test('P2.3 翻面：单面幽灵地点只改标志，不再翻回时也保持可读', () => {
  const { state, loc } = spectralFixture(null)
  assert.equal(flipLocationFace(state, loc.id, 0, []), true)
  const after = state.locations.find(location => location.id === loc.id)
  assert.equal(after.spectralFace, 'spectral')
  assert.equal(after.code, loc.code, '没有 back 数据时不改卡号')
  // 再次调用会翻回正常面（单面地点没有正面快照，只清标志）。
  assert.equal(flipLocationFace(state, loc.id, 0, []), true)
  const back = state.locations.find(location => location.id === loc.id)
  assert.equal(back.spectralFace, 'normal')
  // 目标面与当前相同：显式指定 face 时不翻面、不写日志。
  const logSize = state.log.length
  assert.equal(flipLocationFace(state, loc.id, 0, [], { face: 'normal' }), false)
  assert.equal(state.log.length, logSize)
})

test('P2.3 翻面：未知地点返回 false，不改状态', () => {
  const { state } = spectralFixture(null)
  assert.equal(flipLocationFace(state, 'no-such-location', 0, []), false)
})

test('P2.3 集成：翻面后的地点仍可调查，线索数与连接不变', () => {
  const { state, inv, loc } = spectralFixture({ code: '05166b', name: '幽灵面', clues: 2 })
  loc.clues = 2
  const connections = [...loc.connections]
  flipLocationFace(state, loc.id, 0, [])
  const after = state.locations.find(location => location.id === loc.id)
  assert.deepEqual(after.connections, connections)
  assert.equal(after.clues, 2)
  // 调查一次（必定成功：+1 vs 帷幕）后线索减少，说明地点仍是可交互实体。
  state.chaosBag = ['+1']
  move(state, { action: 'investigate' })
  settle(state)
  assert.equal(state.investigators[0].clues, 1)
})

test('P2.3 存档：翻面状态与正面快照随存档往返', () => {
  const { state, loc } = spectralFixture({ code: '05166b', name: '幽灵面' })
  const frontCode = loc.originalCode || loc.code
  flipLocationFace(state, loc.id, 0, [])
  const restored = JSON.parse(JSON.stringify(state))
  const after = restored.locations.find(location => location.id === loc.id)
  assert.equal(after.spectralFace, 'spectral')
  assert.equal(after.code, '05166b')
  assert.equal(after.front.code, frontCode)
  // 往返后仍能翻回正常面。
  assert.equal(flipLocationFace(restored, loc.id, 0, []), true)
  assert.equal(restored.locations.find(location => location.id === loc.id).spectralFace, 'normal')
})
