#!/usr/bin/env node
// P8 预注册校验：把**已完整的** TCU 章节按真实模块、其余章节按占位组装成一个内容注册表，
// 用与 content/registered.js 相同的 `createContentRegistry` 走一遍注册期校验。
// 这样可以在改 composition root 之前发现：id 不一致、区域卡号不在卡包、遭遇组未登记、
// 幽灵地点/闹鬼/故事调查员配置非法、记录键未声明等问题。
//
//   node tools/check-tcu-registry.mjs [--json]
import { existsSync, readdirSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

const MOD = fileURLToPath(new URL('../', import.meta.url))
const chaptersModule = await import(pathToFileURL(resolve(MOD, 'content/campaigns/theCircleUndone/chapters.js')).href)
const { createContentRegistry } = await import(pathToFileURL(resolve(MOD, 'content/registry.js')).href)
const { currentContentBundle } = await import(pathToFileURL(resolve(MOD, 'content/registered.js')).href)
const placeholders = new Map(chaptersModule.catalogChapters.map(entry => [entry.manifest.id, entry]))
const current = currentContentBundle()

const scenarioDir = resolve(MOD, 'content/campaigns/theCircleUndone/scenarios')
const present = new Set(existsSync(scenarioDir) ? readdirSync(scenarioDir, { withFileTypes: true })
  .filter(entry => entry.isDirectory() && existsSync(resolve(scenarioDir, entry.name, 'index.js')) && existsSync(resolve(scenarioDir, entry.name, 'behavior.js')))
  .map(entry => entry.name) : [])

const placeholderIds = new Set(chaptersModule.catalogChapters.map(entry => entry.manifest.id))
const scenarios = current.scenarios.filter(entry => !placeholderIds.has(entry.manifest.id))
const report = { chapters: [], failed: [] }
for (const chapter of chaptersModule.catalogChapters.map(entry => entry.manifest.id)) {
  if (present.has(chapter)) {
    try {
      scenarios.push(await import(pathToFileURL(resolve(scenarioDir, chapter, 'index.js')).href))
      report.chapters.push({ id: chapter, source: 'real' })
    } catch (error) {
      report.failed.push({ id: chapter, error: error.message })
    }
  } else {
    scenarios.push(placeholders.get(chapter))
    report.chapters.push({ id: chapter, source: 'placeholder' })
  }
}

const packs = current.packs
const campaigns = current.campaigns

try {
  const registry = createContentRegistry({ packs, campaigns, scenarios })
  const tcuScenarios = registry.listScenarios('theCircleUndone')
  report.ok = report.failed.length === 0
  report.registry = {
    scenarios: tcuScenarios.length,
    development: tcuScenarios.filter(entry => entry.status === 'development').length,
    launchable: tcuScenarios.filter(entry => ['playable', 'verified'].includes(entry.status)).length,
    zones: tcuScenarios.map(entry => ({
      id: entry.id,
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
  report.failed.push({ stage: 'createContentRegistry', error: error.message, stack: error.stack?.split('\n').slice(0, 6) })
}

if (process.argv.includes('--json')) console.log(JSON.stringify(report, null, 2))
else {
  console.log(`P8 预注册校验：${report.ok ? 'PASS' : 'FAIL'}（真实章节 ${report.chapters.filter(c => c.source === 'real').length}/${report.chapters.length}）`)
  for (const chapter of report.chapters) console.log(`  ${chapter.source === 'real' ? '✓' : '·'} ${chapter.id} (${chapter.source})`)
  if (report.registry) {
    console.log(`  registry: ${report.registry.scenarios} 章 / development ${report.registry.development} / launchable ${report.registry.launchable}`)
    for (const zone of report.registry.zones) {
      if (zone.locations) console.log(`    ${zone.id}: 地点 ${zone.locations} / 幕 ${zone.acts} / 议程 ${zone.agendas} / 结局 ${zone.resolutionIds} / 遭遇牌 ${zone.encounterCards} / 放一边 ${zone.setAsideCards}`)
    }
  }
  for (const failure of report.failed) console.log(`  ✗ ${failure.id || failure.stage}: ${failure.error}`)
}
process.exit(report.ok ? 0 : 1)
