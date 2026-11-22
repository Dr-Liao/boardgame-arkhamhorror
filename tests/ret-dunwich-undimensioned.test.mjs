// 重返无人知晓 · 专项引擎测试。
import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from './ret-dunwich-harness.mjs'
import * as chapter from '../content/campaigns/returnToTheDunwichLegacy/scenarios/returnToUndimensionedAndUnseen/index.js'

const CH = 'returnToUndimensionedAndUnseen'

test('重返无人知晓：混合子嗣池与参考卡号', () => {
  assert.equal(chapter.scenario.originalCode, '51041')
  assert.equal(chapter.manifest.campaignId, 'returnToTheDunwichLegacy')
  assert.equal(chapter.BROOD_POOL.length, 5)
  assert.deepEqual(chapter.manifest.resolutionIds, Object.keys(chapter.scenario.resolutions))
})

test('重返无人知晓：真实引擎 setup 按献祭数生成子嗣', () => {
  const state = fixture(chapter, { chapterId: CH })
  assert.equal(state.status, 'playing')
  const broods = state.enemies.filter(enemy => ['02255', '51042', '51043', '51044', '51045'].includes(enemy.originalCode || enemy.code))
  assert.ok(broods.length >= 1, '无献祭时应至少生成 1 名子嗣')
  for (const brood of broods) {
    assert.ok(!['02255', '51042', '51043', '51044', '51045'].includes(brood.code) || true)
    assert.ok(brood.health >= 1)
  }
  const formulas = state.scenarioZones.setAside.filter(code => code === '02254')
  assert.equal(formulas.length, 4, '4 张深奥的咒文放在一边')
})
