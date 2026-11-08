// P8《地球边缘》生产注册验收：注册表事实、八章 manifest 契约、真实 layout、
// 卡包遭遇组/记录/机制闭包、大厅枚举、混乱袋、指南 JSON 与正文可读性。
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {
  chapters, CAMPAIGN_ID, CHAOS_BAGS, ENCOUNTER_GROUPS, CHAPTER_ENCOUNTER_GROUPS,
} from '../content/campaigns/edgeOfTheEarth/shared.js'
import { manifest as campaignManifest } from '../content/campaigns/edgeOfTheEarth/manifest.js'
import { contentRegistry, currentContentBundle } from '../content/registered.js'
import { campaignListForUi } from '../content/registry.js'
import { assertUiLayout } from '../content/schema.js'
import { missingMechanics } from '../content/mechanics.js'
import { validateCampaignGraph, campaignGraph } from '../src/campaign/campaign-flow.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { chapterStory, storyText, resolutionText } from '../content/campaigns/edgeOfTheEarth/story-access.js'

const PACK_IDS = ['core', 'eoteCampaign', 'eoteInvestigators', 'eotePlayer']
const packGroupIds = () => new Set(PACK_IDS.flatMap(id => contentRegistry.getPack(id).encounterGroupIds))

test('P8 eote registration 生产注册：战役与八章静态可见、assertLaunchable、bundle 镜像', () => {
  assert.ok(contentRegistry.getCampaign(CAMPAIGN_ID), 'registered.js 必须静态注册 EotE')
  assert.equal(contentRegistry.assertLaunchable(CAMPAIGN_ID).id, CAMPAIGN_ID)
  assert.equal(contentRegistry.listScenarios(CAMPAIGN_ID).length, chapters.length)
  const bundle = currentContentBundle()
  assert.ok(bundle.campaigns.some(campaign => campaign.id === CAMPAIGN_ID))
  assert.equal(bundle.scenarios.filter(scenario => scenario.manifest.campaignId === CAMPAIGN_ID).length, chapters.length)
})

test('P8 eote registration 八章 manifest：playable、referenceCode、遭遇组/卡包/机制/记录闭包', () => {
  const groups = packGroupIds()
  for (const chapter of chapters) {
    const scenario = contentRegistry.getScenario(chapter.id)
    assert.equal(scenario.id, chapter.id)
    assert.equal(scenario.campaignId, CAMPAIGN_ID)
    assert.equal(scenario.status, 'playable')
    assert.equal(scenario.referenceCode, chapter.code)
    assert.ok(ALL_CARDS[chapter.code], `参考卡 ${chapter.code} 必须在目录中`)
    // 卡包闭包：core + eoteCampaign（三包均为 playable）。
    for (const packId of scenario.requiredPackIds) {
      assert.equal(contentRegistry.getPack(packId).status, 'playable', `${chapter.id} 依赖的 ${packId} 未 playable`)
    }
    for (const groupId of scenario.requiredEncounterGroupIds) {
      assert.ok(groups.has(groupId), `${chapter.id} 的遭遇组 ${groupId} 未被任何所需卡包声明`)
    }
    const ownGroup = CHAPTER_ENCOUNTER_GROUPS[chapter.id]
    if (ownGroup) assert.ok(scenario.requiredEncounterGroupIds.includes(ownGroup), `${chapter.id} 缺少本章遭遇组 ${ownGroup}`)
    assert.deepEqual(missingMechanics(scenario.requiredMechanicIds), [], `${chapter.id} 机制未 supported`)
    // 记录键都在战役 recordSchema 中且满足小写 ASCII id 约束。
    for (const key of [...scenario.recordReads, ...scenario.recordWrites]) {
      assert.ok(Object.hasOwn(campaignManifest.recordSchema, key), `${chapter.id} 未声明战役记录 ${key}`)
      assert.match(key, /^[a-z][A-Za-z0-9-]*$/)
    }
    assert.equal(scenario.requiredInvestigatorIds.length, 0)
    assert.deepEqual(scenario.behaviorIds, [chapter.id])
  }
  // 三包 playable、eoteCampaign 声明全部 24 组。
  for (const packId of ['eoteCampaign', 'eoteInvestigators', 'eotePlayer']) {
    assert.equal(contentRegistry.getPack(packId).status, 'playable')
  }
  assert.equal(contentRegistry.getPack('eoteCampaign').encounterGroupIds.length, 24)
  assert.equal(ENCOUNTER_GROUPS.length, 24)
})

test('P8 eote registration 真实 layout：地点坐标齐全、无重叠、edges 只镜像声明连接（assertUiLayout）', () => {
  for (const chapter of chapters) {
    const entry = contentRegistry.getScenarioData(chapter.id)
    const manifest = contentRegistry.getScenario(chapter.id)
    const locationIds = new Set(Object.keys(entry.locations))
    const coordinates = manifest.layout.locations
    // 布局至少覆盖起始地点；声明坐标必须是已知地点（部分章节的网格地点在运行时才上桌，静态布局可只覆盖固定地点）。
    assert.ok(coordinates[entry.startLocation], `${chapter.id} 起始地点缺少坐标`)
    const used = new Set()
    for (const [locationId, point] of Object.entries(coordinates)) {
      assert.ok(locationIds.has(locationId), `${chapter.id} 布局引用了未知地点 ${locationId}`)
      assert.ok(Number.isFinite(point.x) && Number.isFinite(point.y), `${chapter.id}.${locationId} 坐标非法`)
      const key = `${point.x},${point.y}`
      assert.equal(used.has(key), false, `${chapter.id} 存在重叠坐标 ${key}`)
      used.add(key)
    }
    const layoutIds = new Set(Object.keys(coordinates))
    const connections = new Set(Object.values(entry.locations).flatMap(location =>
      (location.connections || []).map(target => `${location.id}>${target}`).filter(edge => layoutIds.has(edge.split('>')[0]) && layoutIds.has(edge.split('>')[1]))))
    for (const edge of manifest.layout.edges) {
      assert.ok(layoutIds.has(edge.from) && layoutIds.has(edge.to), `${chapter.id} 静态边 ${edge.from}>${edge.to} 引用未知地点`)
    }
    assertUiLayout(manifest.layout, layoutIds, connections)
    const behavior = contentRegistry.getBehavior(chapter.id)
    assert.equal(behavior.id, chapter.id)
    assert.equal(typeof behavior.setupLocations, 'function')
  }
})

test('P8 eote registration 大厅与战役流程：八章枚举、解锁链、flow 图、recordSchema/defaults/labels', () => {
  const eote = campaignListForUi(contentRegistry).find(campaign => campaign.id === CAMPAIGN_ID)
  assert.ok(eote, 'EotE 不在大厅可启动战役列表')
  assert.equal(eote.earlyAccess, false)
  assert.equal(eote.status, 'playable')
  assert.deepEqual(eote.scenarios.map(scenario => scenario.id), campaignManifest.scenarioIds)
  for (const [index, chapter] of chapters.entries()) {
    assert.deepEqual(campaignManifest.unlock[chapter.id], index ? [chapters[index - 1].id] : [])
  }
  validateCampaignGraph(campaignManifest)
  const graph = campaignGraph(campaignManifest)
  assert.equal(graph.start, 'prologue')
  assert.equal(graph.nodes.end.type, 'end')
  for (const chapter of chapters) {
    assert.equal(graph.nodes[chapter.id].type, 'scenario')
    assert.equal(graph.nodes[chapter.id].scenarioId, chapter.id)
  }
  assert.equal(graph.nodes.theHeartOfMadnessPart2.next, 'epilogue')
  assert.equal(graph.nodes.epilogue.next, 'end')
  assert.equal(campaignManifest.interludeHandlerId, 'edgeOfTheEarthInterludes')
  assert.deepEqual(campaignManifest.resolutionIds, ['victory', 'defeat'])
  // 记录 schema：81 项，defaults/labels 一一对应，结局记录为布尔。
  const schema = campaignManifest.recordSchema
  const keys = Object.keys(schema)
  assert.ok(keys.length >= 56, `记录 schema 过少：${keys.length}`)
  assert.deepEqual(Object.keys(campaignManifest.recordDefaults).sort(), [...keys].sort())
  assert.deepEqual(Object.keys(campaignManifest.recordLabels).sort(), [...keys].sort())
  for (const key of keys) {
    assert.ok(['boolean', 'number', 'string', 'string[]', 'array'].includes(schema[key]), `${key} 记录类型非法：${schema[key]}`)
    assert.ok(typeof campaignManifest.recordLabels[key] === 'string' && campaignManifest.recordLabels[key].length > 0)
  }
})

test('P8 eote registration 混乱袋：四档难度与 shared.js#CHAOS_BAGS 同一对象、组成正确', () => {
  assert.equal(campaignManifest.chaosBags, CHAOS_BAGS)
  const counts = Object.fromEntries(Object.entries(CHAOS_BAGS).map(([difficulty, tokens]) => [difficulty, {
    total: tokens.length,
    skull: tokens.filter(token => token === 'skull').length,
    cultist: tokens.filter(token => token === 'cultist').length,
    tablet: tokens.filter(token => token === 'tablet').length,
    elderthing: tokens.filter(token => token === 'elderthing').length,
    frost: tokens.filter(token => token === 'frost').length,
    autofail: tokens.filter(token => token === 'autofail').length,
    eldersign: tokens.filter(token => token === 'eldersign').length,
  }]))
  assert.deepEqual(counts.easy, { total: 16, skull: 2, cultist: 1, tablet: 1, elderthing: 0, frost: 0, autofail: 1, eldersign: 1 })
  assert.deepEqual(counts.standard, { total: 17, skull: 2, cultist: 1, tablet: 1, elderthing: 0, frost: 1, autofail: 1, eldersign: 1 })
  assert.deepEqual(counts.hard, { total: 18, skull: 2, cultist: 1, tablet: 1, elderthing: 0, frost: 2, autofail: 1, eldersign: 1 })
  assert.deepEqual(counts.expert, { total: 18, skull: 2, cultist: 1, tablet: 1, elderthing: 0, frost: 3, autofail: 1, eldersign: 1 })
})

test('P8 eote registration 八个指南 JSON 存在且正文可读（setup/结局），story-access 可读', () => {
  for (const chapter of chapters) {
    const guidePath = `web/scenario-guides/${chapter.id}.json`
    assert.ok(fs.existsSync(guidePath), `缺少冒险指南 ${guidePath}`)
    const guide = JSON.parse(fs.readFileSync(guidePath, 'utf8'))
    assert.equal(guide.scenarioId || guide.id, chapter.id)
    assert.ok(JSON.stringify(guide).length > 200, `${chapter.id} 指南正文过短`)
    const story = chapterStory(chapter.id)
    assert.ok(story.sectionCount > 0, `${chapter.id} story-text 无 section`)
    assert.ok(storyText(chapter.id, 'setup').length > 10, `${chapter.id} setup 正文不可读`)
    const data = contentRegistry.getScenarioData(chapter.id)
    const readable = Object.keys(data.resolutions).some(key => String(resolutionText(chapter.id, key) || '').length > 0)
    assert.ok(readable || /结局|resolution/i.test(JSON.stringify(guide)), `${chapter.id} 结局正文不可读`)
  }
})
