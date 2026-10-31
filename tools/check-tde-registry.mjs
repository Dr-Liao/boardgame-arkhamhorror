#!/usr/bin/env node
// P8 预注册校验（食梦者版）：把 8 章真实模块 + 三个 TDE 内容包 + 战役 manifest 组装成一个
// 内容注册表，用与 content/registered.js 相同的 `createContentRegistry` 走一遍注册期校验。
// 这样可以在 P10 改 composition root 之前发现：id 不一致、区域卡号不在卡包、遭遇组未登记、
// 掩藏地点注册期非法、记录键未声明、战役 flow 图非法等问题。
//
//   node tools/check-tde-registry.mjs [--json]
import { existsSync, readdirSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

const MOD = fileURLToPath(new URL('../', import.meta.url))
const CAMPAIGN = 'theDreamEaters'
const load = relative => import(pathToFileURL(resolve(MOD, relative)).href)
const { createContentRegistry } = await load('content/registry.js')
const { currentContentBundle } = await load('content/registered.js')
const { manifest: campaignManifest } = await load(`content/campaigns/${CAMPAIGN}/manifest.js`)
const { validatePartManifest } = await load('src/campaign/part-flow.js')
const { validateCampaignGraph } = await load('src/campaign/campaign-flow.js')
const current = currentContentBundle()

const scenarioDir = resolve(MOD, 'content/campaigns', CAMPAIGN, 'scenarios')
const chapterDirs = existsSync(scenarioDir)
  ? readdirSync(scenarioDir, { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => entry.name)
  : []
const report = { chapters: [], failed: [], warnings: [] }
const scenarios = [...current.scenarios]
for (const chapter of chapterDirs) {
  const index = resolve(scenarioDir, chapter, 'index.js')
  if (!existsSync(index)) {
    report.chapters.push({ id: chapter, source: 'missing-index' })
    report.failed.push({ id: chapter, error: '缺少 index.js' })
    continue
  }
  try {
    scenarios.push(await load(`content/campaigns/${CAMPAIGN}/scenarios/${chapter}/index.js`))
    report.chapters.push({ id: chapter, source: 'real' })
  } catch (error) {
    report.chapters.push({ id: chapter, source: 'import-failed' })
    report.failed.push({ id: chapter, error: error.message })
  }
}

const packs = [...current.packs]
for (const pack of ['tdeCampaign', 'tdeInvestigators', 'tdePlayer']) {
  try {
    const module = await load(`content/packs/${pack}/manifest.js`)
    packs.push(module.manifest)
  } catch (error) {
    report.failed.push({ id: pack, error: `内容包 manifest 无法导入：${error.message}` })
  }
}
const campaigns = [...current.campaigns, campaignManifest]
if (current.campaigns.some(campaign => campaign.id === CAMPAIGN)) {
  report.warnings.push('TDE 战役已在 registered.js 中：P8 阶段应为未注册（P10 接入）')
}

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
  report.ok = report.failed.length === 0
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
} catch (error) {
  report.ok = false
  report.failed.push({ stage: 'createContentRegistry', error: error.message, stack: error.stack?.split('\n').slice(0, 8) })
}

if (process.argv.includes('--json')) console.log(JSON.stringify(report, null, 2))
else {
  console.log(`P8 预注册校验（食梦者）：${report.ok ? 'PASS' : 'FAIL'}（真实章节 ${report.chapters.filter(c => c.source === 'real').length}/${report.chapters.length}）`)
  for (const chapter of report.chapters) console.log(`  ${chapter.source === 'real' ? '✓' : '·'} ${chapter.id} (${chapter.source})`)
  if (report.registry) {
    console.log(`  registry: ${report.registry.scenarios} 章 / development ${report.registry.development} / launchable ${report.registry.launchable}`)
    for (const zone of report.registry.zones) {
      console.log(`    ${zone.id}: [${zone.status}] 地点 ${zone.locations} / 幕 ${zone.acts} / 议程 ${zone.agendas} / 结局 ${zone.resolutionIds} / 遭遇牌 ${zone.encounterCards} / 放一边 ${zone.setAsideCards}`)
    }
  }
  for (const warning of report.warnings) console.log(`  ⚠ ${warning}`)
  for (const failure of report.failed) console.log(`  ✗ ${failure.id || failure.stage}: ${failure.error}`)
}
process.exit(report.ok ? 0 : 1)
