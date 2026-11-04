// P8《印斯茅斯暗潮》生产注册验收：注册表事实、八章 manifest 契约、真实 layout、
// 卡包遭遇组/记录/机制闭包、大厅枚举、混乱袋与战役流程。
//
// 与 tests/tic-migration.test.mjs 的分工：那边守 P0/P1 迁移输入与包发布口径，
// 这里守「注册进生产组合根之后」每个 manifest 字段的可启动性与一致性。
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  chapters, CAMPAIGN_ID, CHAOS_BAGS, ENCOUNTER_GROUPS,
} from '../content/campaigns/theInnsmouthConspiracy/shared.js'
import { RECORD_TYPES } from '../content/campaigns/theInnsmouthConspiracy/records.js'
import { manifest as campaignManifest } from '../content/campaigns/theInnsmouthConspiracy/manifest.js'
import { productionChapter } from '../content/campaigns/theInnsmouthConspiracy/chapter-entry.js'
import { registerContentBundle, contentRegistry, ensureInnsmouthCatalogRegistered, currentContentBundle } from '../content/registered.js'
import { campaignListForUi } from '../content/registry.js'
import { assertUiLayout } from '../content/schema.js'
import { missingMechanics } from '../content/mechanics.js'
import { validateCampaignGraph, campaignGraph } from '../src/campaign/campaign-flow.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'

const PACK_IDS = ['core', 'notz', 'ticCampaign', 'ticInvestigators', 'ticPlayer']
const packGroupIds = () => new Set(PACK_IDS.flatMap(id => contentRegistry.getPack(id).encounterGroupIds))

test('P8 生产注册：战役与八章在组合根静态可见，无需惰性注册即可启动', async () => {
  // 不调用 ensureInnsmouthCatalogRegistered 时组合根里就必须有 TIC（否则又退回 P7 惰性注册）。
  assert.ok(contentRegistry.getCampaign(CAMPAIGN_ID), 'registered.js 必须静态注册 TIC')
  assert.equal(contentRegistry.assertLaunchable(CAMPAIGN_ID).id, CAMPAIGN_ID)
  // 兼容导出仍可用、且返回同一份生产清单（不重复注册、不追加 development 章节）。
  const ensured = await ensureInnsmouthCatalogRegistered()
  assert.equal(ensured.id, CAMPAIGN_ID)
  assert.equal(ensured.status, 'playable')
  assert.equal(contentRegistry.listScenarios(CAMPAIGN_ID).length, chapters.length)
  // 组合根快照保持只读镜像语义：追加注册不得影响已导出的注册表。
  const bundle = currentContentBundle()
  assert.ok(bundle.campaigns.some(campaign => campaign.id === CAMPAIGN_ID))
  assert.equal(bundle.scenarios.filter(scenario => scenario.manifest.campaignId === CAMPAIGN_ID).length, chapters.length)
  // 重复注册同一批 ID 必须被注册表拒绝（防止任何惰性/重复注册路径回归）。
  assert.throws(() => registerContentBundle({ campaigns: [campaignManifest], scenarios: [] }), /重复 ID/)
})

test('P8 八章 manifest：playable、referenceCode、遭遇组/卡包/记录/机制闭包', () => {
  const groups = packGroupIds()
  for (const chapter of chapters) {
    const scenario = contentRegistry.getScenario(chapter.id)
    assert.equal(scenario.id, chapter.id)
    assert.equal(scenario.campaignId, CAMPAIGN_ID)
    assert.equal(scenario.status, 'playable')
    assert.equal(scenario.referenceCode, chapter.code)
    assert.ok(ALL_CARDS[chapter.code], `参考卡 ${chapter.code} 必须在目录中`)
    // 所需卡包：core 与 ticCampaign 提供本循环印刷记录，notz 提供 harper 复用的 01135/01136。
    assert.deepEqual([...scenario.requiredPackIds].sort(), ['core', 'notz', 'ticCampaign'])
    // 遭遇组必须是所需卡包声明组的子集（registry 同口径）。
    for (const groupId of scenario.requiredEncounterGroupIds) {
      assert.ok(groups.has(groupId), `${chapter.id} 的遭遇组 ${groupId} 未被任何所需卡包声明`)
    }
    // 本章自己的遭遇组必须被声明（gatherSets 与 ticCampaign 的 camelCase 组对齐）。
    const ownGroup = ENCOUNTER_GROUPS.find(group =>
      group === ALL_CARDS[chapter.code].encounterCode)?.replace(/_([a-z])/g, (_, lower) => lower.toUpperCase())
    if (ownGroup) assert.ok(scenario.requiredEncounterGroupIds.includes(ownGroup), `${chapter.id} 缺少本章遭遇组 ${ownGroup}`)
    // 机制：必须是已登记能力的子集（注册期 assertLaunchable 也会检查）。
    assert.deepEqual(missingMechanics(scenario.requiredMechanicIds), [])
    // 记录：全部是战役 recordSchema 的键，且满足 schema#refs 的小写 ASCII id 约束。
    for (const key of [...scenario.recordReads, ...scenario.recordWrites]) {
      assert.ok(Object.hasOwn(RECORD_TYPES, key), `${chapter.id} 未声明战役记录 ${key}`)
      assert.match(key, /^[a-z][A-Za-z0-9-]*$/, `${chapter.id} 的记录键 ${key} 不能作为场景依赖 id`)
    }
    assert.equal(scenario.requiredInvestigatorIds.length, 0)
    assert.deepEqual(scenario.behaviorIds, [chapter.id])
  }
})

test('P8 真实 layout：每个声明地点都有有限坐标，edges 只镜像已声明连接', () => {
  for (const chapter of chapters) {
    const entry = contentRegistry.getScenarioData(chapter.id)
    const scenarioManifest = contentRegistry.getScenario(chapter.id)
    const locationIds = new Set(Object.keys(entry.locations))
    const coordinates = scenarioManifest.layout.locations
    // 每个声明地点都有坐标（不允许漏摆）；坐标不允许引用未知地点。
    assert.deepEqual([...locationIds].sort(), [...Object.keys(coordinates)].sort(), `${chapter.id} 布局未覆盖全部地点`)
    for (const [locationId, point] of Object.entries(coordinates)) {
      assert.ok(Number.isFinite(point.x) && Number.isFinite(point.y), `${chapter.id}.${locationId} 坐标必须是有限数字`)
    }
    // 重复坐标会叠卡：同关内坐标必须唯一（确定性补全按格填，不允许重叠）。
    const used = new Set()
    for (const point of Object.values(coordinates)) {
      const key = `${point.x},${point.y}`
      assert.equal(used.has(key), false, `${chapter.id} 存在重叠坐标 ${key}`)
      used.add(key)
    }
    const connections = new Set(Object.values(entry.locations).flatMap(location =>
      (location.connections || []).map(target => `${location.id}>${target}`)))
    assert.deepEqual(scenarioManifest.layout.edges, [], `${chapter.id} 当前没有静态规则连接，edges 必须为空`)
    assertUiLayout(scenarioManifest.layout, locationIds, connections)
  }
})

test('P8 章节行为钩子与开发期完全一致（tic 全套测试与大厅 setup 依赖）', () => {
  const earlyIds = ['thePitOfDespair', 'theVanishingOfElinaHarper', 'inTooDeep']
  const lateIds = ['aLightInTheFog', 'theLairOfDagon', 'intoTheMaelstrom']
  for (const chapter of chapters) {
    const behavior = contentRegistry.getBehavior(chapter.id)
    const expected = productionChapter(chapter.id).behavior
    assert.equal(behavior.id, chapter.id)
    assert.equal(behavior.deferStartingLocationReveal, true)
    // 键集合必须与开发期装配完全一致（新增/缺失钩子都会让 58 个 tic 夹具测试漂移）。
    assert.deepEqual(Object.keys(behavior).sort(), Object.keys(expected).sort(), `${chapter.id} 行为钩子形状漂移`)
    assert.equal(typeof behavior.setupLocations, 'function')
    assert.equal(typeof behavior.afterDeckSetup, 'function')
    assert.equal(behavior.startLocation === undefined, !['devilReef', 'horrorInHighGear'].includes(chapter.id))
    assert.equal(behavior.afterChaosBagSetup === undefined, !lateIds.includes(chapter.id))
    const companions = ['devilReef', 'theLairOfDagon'].includes(chapter.id)
    assert.equal(behavior.setupBeforeOpeningHands, companions || undefined)
    assert.equal(behavior.preScenarioSetup === undefined, !companions)
    if (earlyIds.includes(chapter.id)) assert.equal(behavior.startLocation, undefined)
  }
})

test('P8 大厅与战役流程：八章枚举、解锁链、flow 图与结局表完整', () => {
  // 大厅可启动列表：TIC 必须出现，earlyAccess:false，八章顺序一致。
  const tic = campaignListForUi(contentRegistry).find(campaign => campaign.id === CAMPAIGN_ID)
  assert.ok(tic, 'TIC 不在大厅可启动战役列表')
  assert.equal(tic.earlyAccess, false)
  assert.equal(tic.status, 'playable')
  assert.deepEqual(tic.scenarios.map(scenario => scenario.id), campaignManifest.scenarioIds)
  assert.equal(tic.scenarios.length, chapters.length)
  // 解锁链：首章自由，其余严格依赖前一章（与 manifest.unlock 一致）。
  for (const [index, chapter] of chapters.entries()) {
    assert.deepEqual(campaignManifest.unlock[chapter.id], index ? [chapters[index - 1].id] : [])
  }
  // flow：prologue → 八章（各章 next 连贯）→ epilogue → end；八章节点都存在。
  validateCampaignGraph(campaignManifest)
  const graph = campaignGraph(campaignManifest)
  assert.equal(graph.start, 'prologue')
  assert.equal(graph.nodes.end.type, 'end')
  for (const chapter of chapters) {
    assert.equal(graph.nodes[chapter.id].type, 'scenario')
    assert.equal(graph.nodes[chapter.id].scenarioId, chapter.id)
  }
  assert.equal(graph.nodes.intoTheMaelstrom.next, 'epilogue')
  assert.equal(graph.nodes.epilogue.next, 'end')
  // 结局表：每个结局记录都是战役 recordSchema 的布尔键，id 稳定 ASCII。
  assert.ok(campaignManifest.endings.length >= 4)
  for (const ending of campaignManifest.endings) {
    assert.match(ending.id, /^[a-z][A-Za-z0-9-]*$/)
    assert.equal(RECORD_TYPES[ending.record], 'boolean', `结局 ${ending.id} 的记录 ${ending.record} 必须是布尔记录`)
    assert.ok(ending.label.length > 2)
  }
  // 幕间处理器 id 稳定（flow 里 registered 效果靠它分派）。
  assert.equal(campaignManifest.interludeHandlerId, 'innsmouthInterludes')
  assert.equal(campaignManifest.resolutionIds.length, 2)
})

test('P8 混乱袋：四档难度、标记组成与共享定义逐字节一致', () => {
  // tst/aud 的验收依赖 manifest.chaosBags 就是 shared.js#CHAOS_BAGS（同一对象，不是拷贝）。
  assert.equal(campaignManifest.chaosBags, CHAOS_BAGS)
  assert.deepEqual(Object.keys(campaignManifest.chaosBags).sort(), ['easy', 'expert', 'hard', 'standard'])
  const counts = Object.fromEntries(Object.entries(campaignManifest.chaosBags).map(([difficulty, tokens]) =>
    [difficulty, {
      total: tokens.length,
      skull: tokens.filter(token => token === 'skull').length,
      cultist: tokens.filter(token => token === 'cultist').length,
      tablet: tokens.filter(token => token === 'tablet').length,
      elderthing: tokens.filter(token => token === 'elderthing').length,
      autofail: tokens.filter(token => token === 'autofail').length,
      eldersign: tokens.filter(token => token === 'eldersign').length,
    }]))
  assert.deepEqual(counts.easy, { total: 19, skull: 2, cultist: 2, tablet: 2, elderthing: 2, autofail: 1, eldersign: 1 })
  assert.deepEqual(counts.standard, { total: 20, skull: 2, cultist: 2, tablet: 2, elderthing: 2, autofail: 1, eldersign: 1 })
  for (const difficulty of ['hard', 'expert']) {
    assert.equal(counts[difficulty].total, 22)
    assert.equal(counts[difficulty].autofail, 1)
    assert.equal(counts[difficulty].eldersign, 1)
  }
  assert.notDeepEqual(campaignManifest.chaosBags.easy, campaignManifest.chaosBags.standard)
})
