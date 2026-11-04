import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildScope } from '../tools/scan-tic-scope.mjs'
import { buildScan } from '../tools/scan-tic-mechanisms.mjs'
import { json, readJson, sourceLock, MOD } from '../tools/tic-migration-lib.mjs'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import {
  chapters, CYCLE_CODES, CARD_PARTITIONS, CHAOS_BAGS, ENCOUNTER_GROUPS, SCENARIO_REFERENCE_CODES, toCamelCase,
} from '../content/campaigns/theInnsmouthConspiracy/shared.js'
import { manifest } from '../content/campaigns/theInnsmouthConspiracy/manifest.js'
import { createContentRegistry, campaignListForUi } from '../content/registry.js'
import { contentRegistry } from '../content/registered.js'
import { assertCampaignManifest, assertPackManifest } from '../content/schema.js'
import { getAvailability } from '../src/deck/availability.js'
import * as thePitOfDespair from '../content/campaigns/theInnsmouthConspiracy/scenarios/thePitOfDespair/index.js'
import * as theVanishingOfElinaHarper from '../content/campaigns/theInnsmouthConspiracy/scenarios/theVanishingOfElinaHarper/index.js'
import * as inTooDeep from '../content/campaigns/theInnsmouthConspiracy/scenarios/inTooDeep/index.js'
import * as devilReef from '../content/campaigns/theInnsmouthConspiracy/scenarios/devilReef/index.js'
import * as horrorInHighGear from '../content/campaigns/theInnsmouthConspiracy/scenarios/horrorInHighGear/index.js'
import * as aLightInTheFog from '../content/campaigns/theInnsmouthConspiracy/scenarios/aLightInTheFog/index.js'
import * as theLairOfDagon from '../content/campaigns/theInnsmouthConspiracy/scenarios/theLairOfDagon/index.js'
import * as intoTheMaelstrom from '../content/campaigns/theInnsmouthConspiracy/scenarios/intoTheMaelstrom/index.js'

const PRODUCTION_SCENARIOS = [thePitOfDespair, theVanishingOfElinaHarper, inTooDeep, devilReef,
  horrorInHighGear, aLightInTheFog, theLairOfDagon, intoTheMaelstrom]

// 用生产模块本身再组装一份注册表：验证组合根不是唯一能通过注册期校验的路径
//（与 tools/check-tic-registry.mjs 同一口径），并能独立复算「可启动 + 大厅可见」。
function productionInputRegistry() {
  return createContentRegistry({
    packs: contentRegistry.listPacks(),
    campaigns: [manifest],
    scenarios: PRODUCTION_SCENARIOS,
  })
}

test('P0 来源逐文件锁定，范围与章节身份可复算；关联面不遗漏、不重复分片', () => {
  const scope = buildScope()
  assert.ok(Object.values(scope.gates).every(Boolean), json(scope.gates))
  assert.equal(json(scope), readFileSync(new URL('../audit/tic-scope.json', import.meta.url), 'utf8'))
  const flat = Object.values(CARD_PARTITIONS).flat(); assert.equal(new Set(flat).size, flat.length)
  assert.deepEqual([...flat].sort(), [...CYCLE_CODES]); assert.ok(flat.some(code => /[a-z]$/.test(code)))
  assert.ok(scope.sources.every(lock => lock.sha256.length === 64 && lock.bytes > 0))
  for (const group of scope.reprintGroups) {
    assert.ok(group.codes.includes(group.canonicalCode))
    assert.ok(group.codes.every(code => ALL_CARDS[code]))
    for (const card of scope.cards.filter(card => group.codes.includes(card.code))) assert.equal(card.canonicalCode, group.canonicalCode)
  }
  for (const ch of chapters) {
    assert.ok(ALL_CARDS[ch.code].backText.includes('Hard'))
    assert.ok(scope.chapters.find(entry => entry.id === ch.id).guideSources.length === 2)
  }
  assert.equal(CHAOS_BAGS.easy.includes('bless'), false)
})

test('P8 发布：三个内容包与八章 playable，生产组合根可启动且大厅可见', () => {
  // 三个包：P8 起全部 playable；卡数、旗标与遭遇组必须与 scope 分片一致。
  const campaignPack = contentRegistry.getPack('ticCampaign')
  const investigatorsPack = contentRegistry.getPack('ticInvestigators')
  const playerPack = contentRegistry.getPack('ticPlayer')
  for (const pack of [campaignPack, investigatorsPack, playerPack]) {
    assertPackManifest(pack)
    assert.equal(pack.status, 'playable')
    assert.deepEqual(pack.dependencies, ['core'])
  }
  assert.equal(campaignPack.cards.length, CARD_PARTITIONS.ticCampaign.length)
  assert.ok(campaignPack.cards.every(card => card.cataloged && card.rulesImplemented && card.deckbuilding === false))
  assert.deepEqual([...campaignPack.encounterGroupIds].sort(),
    ENCOUNTER_GROUPS.map(toCamelCase).sort())
  assert.equal(investigatorsPack.cards.length, CARD_PARTITIONS.ticInvestigators.length)
  assert.ok(investigatorsPack.cards.every(card => card.cataloged && card.rulesImplemented && card.deckbuilding === false))
  assert.equal(investigatorsPack.cards.filter(card => card.dependencyOnly).length, 11)
  assert.equal(playerPack.cards.length, CARD_PARTITIONS.ticPlayer.length)
  assert.equal(playerPack.cards.filter(card => card.deckbuilding).length, 90)
  assert.deepEqual(playerPack.cards.filter(card => card.dependencyOnly).map(card => card.code).sort(),
    [...CARD_PARTITIONS.ticPlayer].filter(code => ALL_CARDS[code].subtype === 'basicweakness').sort())

  // 战役清单：playable + 八章顺序 + 四档混乱袋 + 结局表。
  assertCampaignManifest(manifest)
  assert.equal(manifest.status, 'playable')
  assert.deepEqual(manifest.scenarioIds, chapters.map(chapter => chapter.id))
  assert.equal(Object.keys(manifest.chaosBags).length, 4)
  assert.ok(manifest.endings.length >= 1)
  for (const ending of manifest.endings) assert.ok(Object.hasOwn(manifest.recordSchema, ending.record), ending.record)

  // 生产注册表：可启动 + 八章 playable + 大厅列表（earlyAccess:false）。
  const registry = productionInputRegistry()
  assert.equal(registry.assertLaunchable(manifest.id).id, manifest.id)
  const scenarios = registry.listScenarios(manifest.id)
  assert.equal(scenarios.length, chapters.length)
  for (const [index, chapter] of chapters.entries()) {
    const scenarioManifest = registry.getScenario(chapter.id)
    assert.equal(scenarioManifest.status, 'playable')
    assert.equal(scenarioManifest.referenceCode, chapter.code)
    assert.equal(scenarioManifest.requiredPackIds.includes('notz'), true, 'harper 的 01135/01136 需要 notz 包')
    assert.equal(registry.getScenarioData(chapter.id).originalCode, chapter.code)
    assert.equal(registry.getScenarioData(chapter.id).id, chapter.id)
    assert.equal(PRODUCTION_SCENARIOS[index].behavior.id, chapter.id)
    // 章节模块必须导出五件套（manifest/scenario/identities/layout/behavior），P8 要求 layout 进模块。
    assert.equal(PRODUCTION_SCENARIOS[index].layout, scenarioManifest.layout)
    assert.equal(Object.keys(PRODUCTION_SCENARIOS[index].layout.locations).length,
      Object.keys(registry.getScenarioData(chapter.id).locations).length)
  }
  const lobby = campaignListForUi(registry)
  const tic = lobby.find(campaign => campaign.id === manifest.id)
  assert.ok(tic, 'TIC 必须出现在大厅可启动战役列表')
  assert.equal(tic.status, 'playable')
  assert.equal(tic.earlyAccess, false)
  assert.deepEqual(tic.scenarios.map(scenario => scenario.id), manifest.scenarioIds)

  // 参考卡一一对应（桌面剧本提示卡反查依赖这条）。
  assert.deepEqual([...SCENARIO_REFERENCE_CODES].sort(), chapters.map(chapter => chapter.code).sort())

  // 玩家/调查员可用性分层不变：P6 玩家卡可构筑，三张基础弱点只作依赖。
  for (const code of CYCLE_CODES) assert.equal(getAvailability(code).deckbuilding,
    CARD_PARTITIONS.ticPlayer.includes(code) && ALL_CARDS[code].subtype !== 'basicweakness')
})

test('P0 原始基线保留提交、旧失败与 replay 指纹；源码或资源改变可检测', () => {
  const baseline = readJson(new URL('../audit/tic-baseline.json', import.meta.url))
  assert.match(baseline.gitHead, /^[0-9a-f]{40}$/)
  const before = sourceLock(baseline.replayFile, MOD)
  assert.equal(before.sha256, baseline.replaySha256)
  assert.ok(baseline.fastFailures.length > 0)
  assert.notEqual(before.sha256, '0'.repeat(64))
})

test('P1 每张卡的正背面需求都有分类，所有新增原语有计划，八章指南逐段盘点', () => {
  const scan = buildScan(); assert.ok(Object.values(scan.gates).every(Boolean), json(scan.gates))
  assert.equal(json(scan), readFileSync(new URL('../audit/tic-mechanism-scan.json', import.meta.url), 'utf8'))
  assert.deepEqual(scan.unclassified, [])
  assert.deepEqual(scan.cards.map(card => card.code), [...CYCLE_CODES])
  for (const guide of scan.guides) {
    assert.ok(guide.sections.some(row => row.specialRule))
    assert.ok(guide.sections.every(row => row.sourceSha256.length === 64 && row.chinese))
  }
  assert.ok(scan.guides.some(guide => guide.sections.some(section => ['missing', 'untranslated'].includes(section.chinese))))
  assert.ok(scan.cards.every(card => card.behaviorStatus === 'pending'), '分类不能冒充卡牌已迁移')
})
