// 重返迷失时空 · 专项引擎测试。
import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from './ret-dunwich-harness.mjs'
import * as chapter from '../content/campaigns/returnToTheDunwichLegacy/scenarios/returnToLostInTimeAndSpace/index.js'

const CH = 'returnToLostInTimeAndSpace'

test('重返迷失时空：幕/密谋替换版本与参考卡号', () => {
  assert.equal(chapter.scenario.originalCode, '51053')
  assert.equal(chapter.manifest.campaignId, 'returnToTheDunwichLegacy')
  assert.deepEqual(chapter.ACT_ORDER, ['02316', '51055', '02318', '02319'])
  assert.deepEqual(chapter.AGENDA_ORDER, ['02312', '02313', '51054', '02315'])
  assert.deepEqual(chapter.manifest.resolutionIds, Object.keys(chapter.scenario.resolutions))
})

test('重返迷失时空：真实引擎 setup 放置彼端领域并生成犹格·索托斯', () => {
  const state = fixture(chapter, { chapterId: CH })
  assert.equal(state.status, 'playing')
  assert.ok(state.locations.some(location => location.id === 'location51057'), '彼端领域应入场')
  assert.ok(state.enemies.some(enemy => (enemy.originalCode || enemy.code) === '02323'), '犹格·索托斯应在场')
  assert.ok(state.agendas.some(agenda => agenda.originalCode === '51054'))
  assert.equal(state.acts[1].originalCode, state.campaign.records.theRitualWasCompleted ? '51055' : '02317')
})
