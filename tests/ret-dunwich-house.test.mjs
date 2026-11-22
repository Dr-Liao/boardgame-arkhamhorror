// 重返百赌百胜 · 专项引擎测试。
import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from './ret-dunwich-harness.mjs'
import * as chapter from '../content/campaigns/returnToTheDunwichLegacy/scenarios/returnToTheHouseAlwaysWins/index.js'

const CH = 'returnToTheHouseAlwaysWins'

test('重返百赌百胜：manifest 与参考卡号', () => {
  assert.equal(chapter.scenario.originalCode, '51015')
  assert.equal(chapter.manifest.campaignId, 'returnToTheDunwichLegacy')
  assert.deepEqual(chapter.manifest.resolutionIds, Object.keys(chapter.scenario.resolutions))
  assert.ok(chapter.manifest.requiredEncounterGroupIds.includes('returnToTheHouseAlwaysWins'))
  assert.ok(chapter.manifest.zones.encounterDeck.some(entry => entry.cardCode === '51018'))
  assert.ok(chapter.scenario.acts.some(act => act.originalCode === '02069'))
})

test('重返百赌百胜：真实引擎 setup 完成，大厅二选一、舞台放一边', () => {
  const state = fixture(chapter, { chapterId: CH })
  assert.equal(state.status, 'playing')
  const ids = state.locations.map(location => location.id)
  for (const id of ['laBellaLuna', 'cloverClubLounge', 'cloverClubBar', 'cloverClubCardroom']) assert.ok(ids.includes(id), `${id} 应入场`)
  const lounge = state.locations.find(location => location.id === 'cloverClubLounge')
  assert.ok(['02071', '51016'].includes(lounge.originalCode))
  assert.ok(!ids.includes('cloverClubStage'), '舞台在揭示前不入场')
  assert.ok(state.enemies.some(enemy => (enemy.originalCode || enemy.code) === '02078'), '赌场管理员应生成')
  assert.ok(state.scenarioZones.setAside.includes('51017'))
})
