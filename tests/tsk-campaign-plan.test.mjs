// 八循环《绯红密钥》（TSK）P7 战役分片计划结构性验收。
//
// 验证 tools/plan-tsk-campaign.mjs 的分片事实：10 章 + 16 共享组无交集覆盖 311 张战役卡、
// 10 张 scenario 参考卡除外、章专属组与共享组归属正确、worker 输入产物存在且可复算。
import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { buildCampaignPlan } from '../tools/plan-tsk-campaign.mjs'
import { CARD_PARTITIONS, CHAPTER_ENCOUNTER_GROUPS, ENCOUNTER_GROUPS, chapters } from '../content/campaigns/theScarletKeys/shared.js'

const ROOT = fileURLToPath(new URL('../', import.meta.url))
const RUN = fileURLToPath(new URL('../../../artifacts/migration/tsk/', import.meta.url))
const PLAN_FILE = `${ROOT}audit/tsk-campaign-plan.json`
const plan = buildCampaignPlan()

test('P7 TSK 战役分片：10 章 + 16 共享组无重叠覆盖全部战役卡（scenario 参考卡除外）', () => {
  assert.equal(plan.gates.chapterCount, true)
  assert.equal(plan.gates.sharedGroupCount, true)
  assert.equal(plan.gates.noOverlap, true)
  assert.equal(plan.gates.coversCampaignCards, true)
  assert.equal(plan.gates.scenarioCardsExcluded, true)
  assert.equal(plan.gates.noUnassigned, true)
  assert.equal(plan.summary.campaignCards, CARD_PARTITIONS.tskCampaign.length)
  assert.equal(plan.summary.scenarioReferenceCards, 10)
  assert.equal(plan.summary.assignedCards, CARD_PARTITIONS.tskCampaign.length - 10)
  assert.equal(plan.summary.entriesExpected, CARD_PARTITIONS.tskCampaign.length - 10)
  const chapterIds = plan.nodes.filter(node => node.kind === 'chapter').map(node => node.id)
  assert.deepEqual(chapterIds.sort(), chapters.map(chapter => chapter.id).sort())
  const sharedIds = plan.nodes.filter(node => node.kind === 'shared').map(node => node.id)
  assert.equal(sharedIds.length, 16)
  assert.deepEqual(sharedIds.sort(), ENCOUNTER_GROUPS.filter(group => !Object.values(CHAPTER_ENCOUNTER_GROUPS).includes(group)).sort())
})

test('P7 TSK 战役分片：章专属组/共享组卡片归属与卡表 encounterCode 一致', () => {
  for (const node of plan.nodes) {
    assert.ok(node.cards.length > 0, `${node.id} 分到 0 张卡`)
    for (const entry of node.entries) {
      assert.match(entry.path, /^src\/cards\/encounter-entries\/theScarletKeys\//)
    }
    if (node.kind === 'chapter') {
      const camel = String(node.encounterCode).replace(/_([a-z])/g, (_, lower) => lower.toUpperCase())
      assert.equal(camel, CHAPTER_ENCOUNTER_GROUPS[node.id], `${node.id} 专属组不一致`)
      assert.equal(node.testFile, `tests/tsk-scenario-${node.id}.test.mjs`)
      assert.equal(node.guideFile, `web/scenario-guides/${node.id}.json`)
    }
  }
})

test('P7 TSK 战役分片：计划产物已落盘且 worker 输入逐章存在', () => {
  assert.ok(existsSync(PLAN_FILE), '缺少 audit/tsk-campaign-plan.json（先 node tools/plan-tsk-campaign.mjs --write）')
  const disk = JSON.parse(readFileSync(PLAN_FILE, 'utf8'))
  assert.equal(disk.summary.campaignCards, plan.summary.campaignCards)
  assert.equal(disk.nodes.length, plan.nodes.length)
  for (const node of plan.nodes.filter(item => item.kind === 'chapter')) {
    assert.ok(existsSync(`${RUN}workers/campaign-${node.id}.input.json`), `缺少 worker 输入 ${node.id}`)
  }
})
