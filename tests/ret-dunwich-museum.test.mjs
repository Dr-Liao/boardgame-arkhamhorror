// 重返博物馆之夜 · 专项引擎测试。
import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from './ret-dunwich-harness.mjs'
import * as chapter from '../content/campaigns/returnToTheDunwichLegacy/scenarios/returnToTheMiskatonicMuseum/index.js'

const CH = 'returnToTheMiskatonicMuseum'

test('重返博物馆之夜：manifest、4 幕与展厅候选', () => {
  assert.equal(chapter.scenario.originalCode, '51020')
  assert.equal(chapter.manifest.campaignId, 'returnToTheDunwichLegacy')
  assert.equal(chapter.scenario.acts.length, 4)
  assert.ok(chapter.scenario.acts.some(act => act.originalCode === '02124'), '重返保留强行闯入')
  assert.deepEqual(chapter.manifest.resolutionIds, Object.keys(chapter.scenario.resolutions))
})

test('重返博物馆之夜：真实引擎 setup 与 7 选 5 展厅牌库', () => {
  const state = fixture(chapter, { chapterId: CH })
  assert.equal(state.status, 'playing')
  const halls = state.scenarioZones.exhibits || []
  assert.equal(halls.length, 6, '展厅牌库应为 6 张（限制展厅 + 5 张展厅）')
  assert.ok(halls.includes('02137'), '限制展厅必须在牌库底部三张中')
  assert.equal(state.acts.length, 4)
  assert.ok(state.locations.some(location => location.id === 'location02126'), '博物馆大门应入场')
  assert.ok(state.locations.some(location => location.id === 'location02127'), '博物馆大厅应入场')
})
