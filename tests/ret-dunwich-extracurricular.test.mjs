// 重返课外活动 · 专项引擎测试（真实 setup + 地点二选一 + 保安生成）。
import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from './ret-dunwich-harness.mjs'
import * as chapter from '../content/campaigns/returnToTheDunwichLegacy/scenarios/returnToExtracurricularActivities/index.js'

const CH = 'returnToExtracurricularActivities'

test('重返课外活动：manifest 与参考卡号', () => {
  assert.equal(chapter.scenario.id, CH)
  assert.equal(chapter.scenario.originalCode, '51012')
  assert.equal(chapter.manifest.campaignId, 'returnToTheDunwichLegacy')
  assert.equal(chapter.manifest.status, 'playable')
  assert.equal(chapter.manifest.referenceCode, '51012')
  assert.deepEqual(chapter.manifest.resolutionIds, Object.keys(chapter.scenario.resolutions))
  assert.ok(chapter.manifest.requiredEncounterGroupIds.includes('returnToExtracurricularActivities'))
  assert.ok(chapter.manifest.zones.encounterDeck.some(entry => entry.cardCode === '51014'))
})

test('重返课外活动：真实引擎 setup 完成且地点按二选一入场', () => {
  const state = fixture(chapter, { chapterId: CH })
  assert.equal(state.status, 'playing')
  const ids = state.locations.map(location => location.id)
  assert.ok(ids.includes('miskatonicQuad'))
  assert.ok(ids.includes('humanitiesBuilding'))
  assert.ok(ids.includes('studentUnion'))
  assert.ok(ids.includes('scienceBuilding'))
  assert.ok(ids.includes('administrationBuilding'))
  // 奥恩图书馆与沃伦天文台只应入场一张。
  const library = state.locations.find(location => location.id === 'orneLibrary')
  assert.ok(library, 'orneLibrary 槽位必须入场')
  assert.ok(['02050', '51013'].includes(library.originalCode))
  const other = library.originalCode === '02050' ? '51013' : '02050'
  assert.ok(!state.locations.some(location => (location.originalCode || location.code) === other), `${other} 应移出游戏`)
  const expectedGuard = state.campaign.scenarioResults.some(result =>
    result.scenarioId === 'returnToTheHouseAlwaysWins')
  assert.equal(state.enemies.some(enemy => (enemy.originalCode || enemy.code) === '51014'), expectedGuard)
})

test('重返课外活动：布置后可读写 JSON 存档', () => {
  const state = fixture(chapter, { chapterId: CH })
  const view = JSON.parse(JSON.stringify(state))
  assert.deepEqual(view.locations.map(location => location.id).sort(), state.locations.map(location => location.id).sort())
})
