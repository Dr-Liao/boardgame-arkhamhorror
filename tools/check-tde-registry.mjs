#!/usr/bin/env node
// P8/P10 注册校验（食梦者版）：把 8 章真实模块 + 三个 TDE 内容包 + 战役 manifest 组装成一个
// 内容注册表，用与 content/registered.js 相同的 `createContentRegistry` 走一遍注册期校验。
//
// P8：在 P10 改 composition root 之前发现 id 不一致、区域卡号不在卡包、遭遇组未登记、
//     掩藏地点注册期非法、记录键未声明、战役 flow 图非法等问题。
// P10：真实 TDE 已注册进 registered.js，本工具同时验证「已注册」事实：不再追加重复条目，
//     并要求大厅可见 + assertLaunchable 通过 + 8 章全 playable（launchable = 章节数）。
//
//   node tools/check-tde-registry.mjs [--json]
import { existsSync, readdirSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

const MOD = fileURLToPath(new URL('../', import.meta.url))
const CAMPAIGN = 'theDreamEaters'
const PACK_IDS = ['tdeCampaign', 'tdeInvestigators', 'tdePlayer']
const load = relative => import(pathToFileURL(resolve(MOD, relative)).href)
const { createContentRegistry, campaignListForUi } = await load('content/registry.js')
const { currentContentBundle } = await load('content/registered.js')
const { manifest: campaignManifest } = await load(`content/campaigns/${CAMPAIGN}/manifest.js`)
const { validatePartManifest } = await load('src/campaign/part-flow.js')
const { validateCampaignGraph } = await load('src/campaign/campaign-flow.js')
const current = currentContentBundle()
const registered = current.campaigns.some(campaign => campaign.id === CAMPAIGN)

const scenarioDir = resolve(MOD, 'content/campaigns', CAMPAIGN, 'scenarios')
const chapterDirs = existsSync(scenarioDir)
  ? readdirSync(scenarioDir, { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => entry.name)
  : []
const report = { registered, chapters: [], failed: [], warnings: [] }
const scenarios = registered ? [...current.scenarios] : []
for (const chapter of chapterDirs) {
  const index = resolve(scenarioDir, chapter, 'index.js')
  if (!existsSync(index)) {
    report.chapters.push({ id: chapter, source: 'missing-index' })
    report.failed.push({ id: chapter, error: '缺少 index.js' })
    continue
  }
  try {
    const module = await load(`content/campaigns/${CAMPAIGN}/scenarios/${chapter}/index.js`)
    if (!registered) scenarios.push(module)
    report.chapters.push({ id: chapter, source: registered ? 'registered' : 'real' })
  } catch (error) {
    report.chapters.push({ id: chapter, source: 'import-failed' })
    report.failed.push({ id: chapter, error: error.message })
  }
}

const packs = [...current.packs]
if (!registered) {
  for (const pack of PACK_IDS) {
    try {
      const module = await load(`content/packs/${pack}/manifest.js`)
      packs.push(module.manifest)
    } catch (error) {
      report.failed.push({ id: pack, error: `内容包 manifest 无法导入：${error.message}` })
    }
  }
}
const campaigns = [...current.campaigns]
if (!registered) campaigns.push(campaignManifest)
else report.warnings.push('TDE 已在 registered.js 中（P10 发布态）：本工具只校验既有注册，不重复注册。')

// 战役层双线声明（路线图 §8.3 / §11.2）。
const partReport = validatePartManifest(campaignManifest)
if (!partReport.ok) report.failed.push({ stage: 'validatePartManifest', error: partReport.problems.join('；') })
if (!Array.isArray(campaignManifest.modes) || !['singleA', 'singleB', 'pick', 'parallel'].every(mode => campaignManifest.modes.includes(mode))) {
  report.failed.push({ stage: 'modes', error: 'TDE manifest 必须声明 modes: singleA/singleB/pick/parallel' })
}
try {
  validateCampaignGraph(campaignManifest)
} catch (error) {
  report.failed.push({ stage: 'validateCampaignGraph', error: error.message })
}

try {
  const registry = createContentRegistry({ packs, campaigns, scenarios })
  const tdeScenarios = registry.listScenarios(CAMPAIGN)
  report.registry = {
    scenarios: tdeScenarios.length,
    development: tdeScenarios.filter(entry => entry.status === 'development').length,
    launchable: tdeScenarios.filter(entry => ['playable', 'verified'].includes(entry.status)).length,
    zones: tdeScenarios.map(entry => ({
      id: entry.id,
      status: entry.status,
      locations: entry.locations.length,
      acts: entry.acts.length,
      agendas: entry.agendas.length,
      resolutionIds: entry.resolutionIds.length,
      encounterCards: entry.zones.encounterDeck.reduce((sum, item) => sum + item.count, 0),
      setAsideCards: entry.zones.setAside.reduce((sum, item) => sum + item.count, 0),
    })),
  }
  // P10 发布门禁：注册 + 大厅可见 + assertLaunchable + 8 章全 launchable。
  report.launch = { registered, lobbyVisible: false, launchEnabled: false }
  try {
    const campaign = registry.assertLaunchable(CAMPAIGN)
    report.launch.launchEnabled = true
    report.launch.campaignStatus = campaign.status
  } catch (error) {
    report.failed.push({ stage: 'assertLaunchable', error: error.message })
  }
  report.launch.lobbyVisible = campaignListForUi(registry).some(campaign => campaign.id === CAMPAIGN)
  if (!report.launch.lobbyVisible) report.failed.push({ stage: 'lobbyVisible', error: 'TDE 不在大厅可启动战役列表' })
  if (!report.launch.launchEnabled) report.failed.push({ stage: 'launchEnabled', error: 'assertLaunchable 未通过' })
  if (registered && report.registry.launchable !== chapterDirs.length) {
    report.failed.push({
      stage: 'chaptersLaunchable',
      error: `P10 要求 ${chapterDirs.length} 章全 playable/verified，实际 ${report.registry.launchable}`,
    })
  }
  if (registered && report.registry.development > 0) {
    report.failed.push({ stage: 'chaptersLaunchable', error: `${report.registry.development} 章仍是 development` })
  }
  report.ok = report.failed.length === 0
} catch (error) {
  report.ok = false
  report.failed.push({ stage: 'createContentRegistry', error: error.message, stack: error.stack?.split('\n').slice(0, 8) })
}

if (process.argv.includes('--json')) console.log(JSON.stringify(report, null, 2))
else {
  console.log(`P8/P10 注册校验（食梦者）：${report.ok ? 'PASS' : 'FAIL'}（真实章节 ${report.chapters.filter(c => c.source !== 'missing-index' && c.source !== 'import-failed').length}/${report.chapters.length}；registered=${report.registered}）`)
  for (const chapter of report.chapters) console.log(`  ${chapter.source === 'missing-index' || chapter.source === 'import-failed' ? '·' : '✓'} ${chapter.id} (${chapter.source})`)
  if (report.registry) {
    console.log(`  registry: ${report.registry.scenarios} 章 / development ${report.registry.development} / launchable ${report.registry.launchable}`)
    for (const zone of report.registry.zones) {
      console.log(`    ${zone.id}: [${zone.status}] 地点 ${zone.locations} / 幕 ${zone.acts} / 议程 ${zone.agendas} / 结局 ${zone.resolutionIds} / 遭遇牌 ${zone.encounterCards} / 放一边 ${zone.setAsideCards}`)
    }
  }
  if (report.launch) {
    console.log(`  launch: registered=${report.launch.registered} lobbyVisible=${report.launch.lobbyVisible} launchEnabled=${report.launch.launchEnabled} campaign=${report.launch.campaignStatus || '-'}`)
  }
  for (const warning of report.warnings) console.log(`  ⚠ ${warning}`)
  for (const failure of report.failed) console.log(`  ✗ ${failure.id || failure.stage}: ${failure.error}`)
}
process.exit(report.ok ? 0 : 1)
