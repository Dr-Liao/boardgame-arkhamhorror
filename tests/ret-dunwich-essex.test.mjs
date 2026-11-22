// 重返疯狂列车 · 专项引擎测试。
import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from './ret-dunwich-harness.mjs'
import * as chapter from '../content/campaigns/returnToTheDunwichLegacy/scenarios/returnToTheEssexCountyExpress/index.js'

const CH = 'returnToTheEssexCountyExpress'

test('重返疯狂列车：6 张议程牌库与参考卡号', () => {
  assert.equal(chapter.scenario.originalCode, '51025')
  assert.equal(chapter.manifest.campaignId, 'returnToTheDunwichLegacy')
  assert.deepEqual(chapter.scenario.agendas.map(agenda => agenda.originalCode),
    ['51026', '51027', '02161', '02162', '02163', '02164'])
  assert.deepEqual(chapter.manifest.resolutionIds, Object.keys(chapter.scenario.resolutions))
})

test('重返疯狂列车：真实引擎 setup 生成 7 节车厢且首节无文本', () => {
  const state = fixture(chapter, { chapterId: CH })
  assert.equal(state.status, 'playing')
  const slots = state.scenarioZones.train || []
  assert.equal(slots.length, 7)
  assert.equal(state.locations.length, 7)
  assert.equal(state.agendas.length, 6)
  assert.ok(state.agendas[0].originalCode === '51026')
  assert.ok(state.scenarioZones.setAside.filter(code => code === '02178').length === 4)
})
