#!/usr/bin/env node
// P8 注册校验（《印斯茅斯暗潮》版）：把 8 章真实模块 + 三个 TIC 内容包 + 战役 manifest
// 交给与 content/registered.js 相同的 createContentRegistry 走一遍注册期校验。
//
// 检查项：
//   · 三个内容包 manifest（playable/遭遇组/卡数/卡号范围）与战役/八章 manifest 契约；
//   · 八章真实 layout（每个声明地点有限坐标、edges 只镜像已声明连接）；
//   · 每章 requiredEncounterGroupIds ⊆ 所需卡包声明组、requiredMechanicIds 已登记、
//     recordReads/recordWrites ⊆ 战役 recordSchema；
//   · 战役 flow 图、四档混乱袋、剧本参考卡与桌面提示卡映射；
//   · 生产组合根事实：TIC 已注册 + assertLaunchable 通过 + 大厅可见 + 八章全 playable。
//
//   node tools/check-tic-registry.mjs [--json]
import { existsSync, readdirSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

const MOD = fileURLToPath(new URL('../', import.meta.url))
const CAMPAIGN = 'theInnsmouthConspiracy'
const PACK_IDS = ['ticCampaign', 'ticInvestigators', 'ticPlayer']
const REQUIRED_PACKS = ['core', 'notz', 'ticCampaign']
const load = relative => import(pathToFileURL(resolve(MOD, relative)).href)
const { createContentRegistry, campaignListForUi } = await load('content/registry.js')
const { currentContentBundle } = await load('content/registered.js')
const { assertPackManifest, assertCampaignManifest, assertUiLayout } = await load('content/schema.js')
const { missingMechanics } = await load('content/mechanics.js')
const { validateCampaignGraph } = await load('src/campaign/campaign-flow.js')
const { scenarioZoneReport } = await load('content/scenario-manifest.js')
const { sharedEncounterIdentities } = await load('content/packs/shared-identities.js')
const { manifest: campaignManifest, ENDINGS } = await load(`content/campaigns/${CAMPAIGN}/manifest.js`)
const { chapters, ENCOUNTER_GROUPS, SCENARIO_REFERENCE_CODES, CHAOS_BAGS, toCamelCase } =
  await load(`content/campaigns/${CAMPAIGN}/shared.js`)
const { RECORD_TYPES } = await load(`content/campaigns/${CAMPAIGN}/records.js`)
const { ALL_CARDS } = await load('src/cards/cards-data.js')
const { UI_CARDS } = await load('web/ui-cards.js')

const current = currentContentBundle()
const registered = current.campaigns.some(campaign => campaign.id === CAMPAIGN) &&
  current.scenarios.some(scenario => scenario?.manifest?.campaignId === CAMPAIGN)
const report = { registered, chapters: [], failed: [], warnings: [], packs: {}, registry: null, launch: null }

// 真实章节模块：index.js + layout.js 必须存在（docs/arkham-content-migration.md §3）。
const scenarioDir = resolve(MOD, 'content/campaigns', CAMPAIGN, 'scenarios')
const chapterDirs = existsSync(scenarioDir)
  ? readdirSync(scenarioDir, { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => entry.name).sort()
  : []
const scenarioModules = []
for (const chapter of chapterDirs) {
  const index = resolve(scenarioDir, chapter, 'index.js')
  const layout = resolve(scenarioDir, chapter, 'layout.js')
  if (!existsSync(index)) {
    report.chapters.push({ id: chapter, source: 'missing-index' })
    report.failed.push({ id: chapter, error: '缺少 index.js' })
    continue
  }
  if (!existsSync(layout)) {
    report.chapters.push({ id: chapter, source: 'missing-layout' })
    report.failed.push({ id: chapter, error: '缺少 layout.js（P8 要求真实桌面坐标）' })
    continue
  }
  try {
    const module = await load(`content/campaigns/${CAMPAIGN}/scenarios/${chapter}/index.js`)
    scenarioModules.push(module)
    report.chapters.push({ id: chapter, source: registered ? 'registered' : 'real' })
  } catch (error) {
    report.chapters.push({ id: chapter, source: 'import-failed' })
    report.failed.push({ id: chapter, error: error.message })
  }
}
if (chapterDirs.length !== chapters.length) {
  report.failed.push({ stage: 'chapters', error: `章节目录 ${chapterDirs.length} 个，manifest 声明 ${chapters.length} 章` })
}

// 组装校验用 bundle：生产已注册时用组合根快照；否则把真实模块补进快照（不改生产注册表）。
const packs = [...current.packs]
const campaigns = [...current.campaigns]
const scenarios = [...current.scenarios]
if (!registered) {
  for (const pack of PACK_IDS) {
    try {
      const module = await load(`content/packs/${pack}/manifest.js`)
      packs.push(module.manifest)
    } catch (error) {
      report.failed.push({ id: pack, error: `内容包 manifest 无法导入：${error.message}` })
    }
  }
  campaigns.push(campaignManifest)
  scenarios.push(...scenarioModules)
} else {
  report.warnings.push('TIC 已在 content/registered.js 中（P8 发布态）：本工具校验既有注册，不重复注册。')
}

// ---- 包与战役清单 ----------------------------------------------------------
for (const packId of PACK_IDS) {
  const pack = packs.find(entry => entry.id === packId)
  if (!pack) { report.failed.push({ id: packId, error: '缺少内容包' }); continue }
  try {
    assertPackManifest(pack)
    if (pack.status !== 'playable') report.failed.push({ id: packId, error: `发布状态 ${pack.status} 不是 playable` })
    report.packs[packId] = {
      status: pack.status, cards: pack.cards.length,
      implemented: pack.cards.filter(card => card.rulesImplemented).length,
      deckbuilding: pack.cards.filter(card => card.deckbuilding).length,
      encounterGroups: pack.encounterGroupIds.length,
    }
  } catch (error) {
    report.failed.push({ id: packId, error: `pack manifest 非法：${error.message}` })
  }
}
try {
  assertCampaignManifest(campaignManifest)
  if (campaignManifest.status !== 'playable') report.failed.push({ stage: 'campaignStatus', error: `战役 status=${campaignManifest.status}` })
} catch (error) {
  report.failed.push({ stage: 'assertCampaignManifest', error: error.message })
}
try {
  validateCampaignGraph(campaignManifest)
} catch (error) {
  report.failed.push({ stage: 'validateCampaignGraph', error: error.message })
}
// 混乱袋：四档难度且与 shared.js#CHAOS_BAGS 一致。
const bagKeys = Object.keys(campaignManifest.chaosBags || {}).sort()
if (bagKeys.join(',') !== 'easy,expert,hard,standard') {
  report.failed.push({ stage: 'chaosBags', error: `难度必须为 easy/standard/hard/expert，实际 ${bagKeys.join(',')}` })
}
if (campaignManifest.chaosBags !== CHAOS_BAGS) {
  report.warnings.push('manifest.chaosBags 不是 shared.js#CHAOS_BAGS 的同一对象')
}
// 结局表：记录键必须存在。
for (const ending of ENDINGS || []) {
  if (!Object.hasOwn(RECORD_TYPES, ending.record)) {
    report.failed.push({ stage: 'endings', error: `结局 ${ending.id} 的记录 ${ending.record} 未在 recordSchema 中` })
  }
}
// 剧本参考卡 ↔ 桌面提示卡映射。
for (const chapter of chapters) {
  if (!ALL_CARDS[chapter.code]) report.failed.push({ id: chapter.id, error: `参考卡 ${chapter.code} 不在目录中` })
  if (UI_CARDS.scenarioCards[chapter.id] !== chapter.code) {
    report.failed.push({ id: chapter.id, error: `桌面提示卡映射 ${chapter.id} → ${UI_CARDS.scenarioCards[chapter.id]}，应为 ${chapter.code}` })
  }
}

try {
  const registry = createContentRegistry({ packs, campaigns, scenarios })
  const ticScenarios = registry.listScenarios(CAMPAIGN)
  const packGroups = new Set(REQUIRED_PACKS.flatMap(packId => registry.getPack(packId)?.encounterGroupIds || []))
  const records = new Set(Object.keys(RECORD_TYPES))
  report.registry = {
    scenarios: ticScenarios.length,
    playable: ticScenarios.filter(entry => ['playable', 'verified'].includes(entry.status)).length,
    zones: [],
  }
  for (const scenario of ticScenarios) {
    const data = registry.getScenarioData(scenario.id)
    // layout：覆盖全部地点 + 有限坐标 + edges 只镜像已声明连接。
    const locationIds = new Set(Object.keys(data.locations))
    try {
      assertUiLayout(scenario.layout, locationIds, new Set(Object.values(data.locations)
        .flatMap(location => (location.connections || []).map(target => `${location.id}>${target}`))))
      const missingLayout = [...locationIds].filter(id => !Number.isFinite(scenario.layout.locations[id]?.x)
        || !Number.isFinite(scenario.layout.locations[id]?.y))
      if (missingLayout.length) throw new Error(`地点缺坐标 ${missingLayout.join('、')}`)
    } catch (error) {
      report.failed.push({ id: scenario.id, error: `layout 非法：${error.message}` })
    }
    if (scenario.status !== 'playable') report.failed.push({ id: scenario.id, error: `status=${scenario.status}` })
    if (scenario.referenceCode !== chapters.find(chapter => chapter.id === scenario.id)?.code) {
      report.failed.push({ id: scenario.id, error: `referenceCode=${scenario.referenceCode}` })
    }
    for (const groupId of scenario.requiredEncounterGroupIds) {
      if (!packGroups.has(groupId)) report.failed.push({ id: scenario.id, error: `遭遇组 ${groupId} 未被所需卡包声明` })
    }
    for (const key of [...scenario.recordReads, ...scenario.recordWrites]) {
      if (!records.has(key)) report.failed.push({ id: scenario.id, error: `记录键 ${key} 未在 recordSchema 中` })
    }
    if (missingMechanics(scenario.requiredMechanicIds).length) {
      report.failed.push({ id: scenario.id, error: `缺少机制 ${missingMechanics(scenario.requiredMechanicIds).join('、')}` })
    }
    try {
      const zone = scenarioZoneReport(data, scenario, sharedEncounterIdentities)
      if (zone.duplicateActiveZoneCodes.length || zone.optionalZoneCollisions.length) {
        report.failed.push({ id: scenario.id, error: '区域重复入牌' })
      }
      report.registry.zones.push({
        id: scenario.id, locations: data ? Object.keys(data.locations).length : scenario.locations.length,
        acts: scenario.acts.length, agendas: scenario.agendas.length, resolutionIds: scenario.resolutionIds.length,
        encounterCards: zone.encounterCards, setAsideCards: zone.declaredSetAsideCards,
        layoutEdges: scenario.layout.edges.length,
      })
    } catch (error) {
      report.failed.push({ id: scenario.id, error: `区域报告非法：${error.message}` })
    }
  }
  // 发布门禁：注册 + 大厅可见 + assertLaunchable + 八章全 playable。
  report.launch = { registered, lobbyVisible: false, launchEnabled: false }
  try {
    report.launch.campaignStatus = registry.assertLaunchable(CAMPAIGN).status
    report.launch.launchEnabled = true
  } catch (error) {
    report.failed.push({ stage: 'assertLaunchable', error: error.message })
  }
  report.launch.lobbyVisible = campaignListForUi(registry).some(campaign => campaign.id === CAMPAIGN)
  if (!report.launch.lobbyVisible) report.failed.push({ stage: 'lobbyVisible', error: 'TIC 不在大厅可启动战役列表' })
  if (report.registry.playable !== chapters.length) {
    report.failed.push({ stage: 'chaptersLaunchable', error: `要求 ${chapters.length} 章 playable，实际 ${report.registry.playable}` })
  }
  // 战役遭遇组 = ticCampaign 包声明组（一致性）。
  const campaignPack = registry.getPack('ticCampaign')
  const expectedGroups = ENCOUNTER_GROUPS.map(toCamelCase).sort()
  if (JSON.stringify([...campaignPack.encounterGroupIds].sort()) !== JSON.stringify(expectedGroups)) {
    report.failed.push({ stage: 'encounterGroups', error: 'ticCampaign 包遭遇组与 shared.js#ENCOUNTER_GROUPS 不一致' })
  }
  // 八张参考卡都在 ticCampaign 分区内（卡号范围校验已由 pack manifest 覆盖）。
  for (const code of SCENARIO_REFERENCE_CODES) {
    if (!campaignPack.cards.some(card => card.code === code)) report.failed.push({ stage: 'referenceCode', error: `${code} 不在 ticCampaign 包卡表` })
  }
} catch (error) {
  report.failed.push({ stage: 'createContentRegistry', error: error.message, stack: error.stack?.split('\n').slice(0, 8) })
}
report.ok = report.failed.length === 0

if (process.argv.includes('--json')) console.log(JSON.stringify(report, null, 2))
else {
  console.log(`P8 注册校验（印斯茅斯暗潮）：${report.ok ? 'PASS' : 'FAIL'}（真实章节 ${report.chapters.filter(c => !/missing|import-failed/.test(c.source)).length}/${report.chapters.length}；registered=${report.registered}）`)
  for (const chapter of report.chapters) console.log(`  ${/missing|import-failed/.test(chapter.source) ? '·' : '✓'} ${chapter.id} (${chapter.source})`)
  for (const [packId, pack] of Object.entries(report.packs)) {
    console.log(`  pack ${packId}: [${pack.status}] 卡 ${pack.cards} / 已实现 ${pack.implemented} / 可构筑 ${pack.deckbuilding} / 遭遇组 ${pack.encounterGroups}`)
  }
  if (report.registry) {
    console.log(`  registry: ${report.registry.scenarios} 章 / playable ${report.registry.playable}`)
    for (const zone of report.registry.zones) {
      console.log(`    ${zone.id}: 地点 ${zone.locations} / 幕 ${zone.acts} / 议程 ${zone.agendas} / 结局 ${zone.resolutionIds} / 遭遇牌 ${zone.encounterCards} / 放一边 ${zone.setAsideCards} / 布局连线 ${zone.layoutEdges}`)
    }
  }
  if (report.launch) {
    console.log(`  launch: registered=${report.launch.registered} lobbyVisible=${report.launch.lobbyVisible} launchEnabled=${report.launch.launchEnabled} campaign=${report.launch.campaignStatus || '-'}`)
  }
  for (const warning of report.warnings) console.log(`  ⚠ ${warning}`)
  for (const failure of report.failed) console.log(`  ✗ ${failure.id || failure.stage}: ${failure.error}`)
}
process.exit(report.ok ? 0 : 1)
