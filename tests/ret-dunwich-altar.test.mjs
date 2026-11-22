// 重返血色祭坛 · 专项引擎测试。
import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from './ret-dunwich-harness.mjs'
import * as chapter from '../content/campaigns/returnToTheDunwichLegacy/scenarios/returnToBloodOnTheAltar/index.js'

const CH = 'returnToBloodOnTheAltar'

test('重返血色祭坛：manifest 与三选一地点的参考卡号', () => {
  assert.equal(chapter.scenario.originalCode, '51032')
  assert.equal(chapter.scenario.startLocation, 'location51033')
  assert.equal(chapter.manifest.campaignId, 'returnToTheDunwichLegacy')
  assert.deepEqual(chapter.manifest.resolutionIds, Object.keys(chapter.scenario.resolutions))
})

test('重返血色祭坛：真实引擎 setup 放置公共空地与 5 个村庄地点、卡牌压在下面', () => {
  const state = fixture(chapter, { chapterId: CH })
  assert.equal(state.status, 'playing')
  assert.ok(state.locations.some(location => location.id === 'location51033'), '公共空地应入场')
  assert.equal(state.locations.length, 6, '公共空地 + 5 个村庄地点')
  const under = Object.values(state.scenarioZones.underLocations || {})
  assert.equal(under.length, 5, '每处村庄地点下应有 1 张牌')
  assert.ok(under.includes('02214'), '隐藏密室应压在某个地点下')
  assert.ok(under.includes('02215'), '密室的钥匙应压在某个地点下')
})
