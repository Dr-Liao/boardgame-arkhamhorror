// 重返毁灭之地 · 专项引擎测试（含存档往返）。
import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from './ret-dunwich-harness.mjs'
import * as chapter from '../content/campaigns/returnToTheDunwichLegacy/scenarios/returnToWhereDoomAwaits/index.js'

const CH = 'returnToWhereDoomAwaits'

test('重返毁灭之地：扭曲山脚/山路与扩大后的小径候选', () => {
  assert.equal(chapter.scenario.originalCode, '51047')
  assert.equal(chapter.manifest.campaignId, 'returnToTheDunwichLegacy')
  assert.equal(chapter.DIVERGING_POOL.length, 5)
  assert.equal(chapter.ALTERED_POOL.length, 5)
  assert.deepEqual(chapter.manifest.resolutionIds, Object.keys(chapter.scenario.resolutions))
})

test('重返毁灭之地：真实引擎 setup 使用扭曲版地点并保留基础行动槽位', () => {
  const state = fixture(chapter, { chapterId: CH })
  assert.equal(state.status, 'playing')
  const baseOfHill = state.locations.find(location => location.id === 'location02282')
  assert.ok(baseOfHill)
  assert.equal(baseOfHill.originalCode, '51048')
  const ascending = state.locations.find(location => location.id === 'location02283')
  assert.equal(ascending.originalCode, '51049')
  assert.equal(state.scenarioZones.divergingPaths.length, 3)
  assert.equal(state.scenarioZones.alteredPaths.length, 3)
  assert.equal(state.acts.length, 3)
  // 存档往返：布置状态可 JSON 序列化并保持关键字段。
  const restored = JSON.parse(JSON.stringify(state))
  assert.deepEqual(restored.locations.map(location => location.id), state.locations.map(location => location.id))
  assert.deepEqual(restored.acts.map(act => act.originalCode), state.acts.map(act => act.originalCode))
  assert.deepEqual(restored.scenarioZones.divergingPaths, state.scenarioZones.divergingPaths)
})
