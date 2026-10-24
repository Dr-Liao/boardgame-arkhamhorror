#!/usr/bin/env node
// P8 章节自检：单个章节目录的结构、身份、区域、注册期校验、单卡条目覆盖率。
//
//   node tools/check-tcu-scenario.mjs <chapterId> [--json]
//
// 为什么需要它：`content/registered.js` 只有在 9 章全部接线后才整体校验；
// worker 在并行写单章时需要一条不依赖注册表的检查路径。本工具按与
// `content/registry.js` 相同的校验函数检查「这一章」：
//   · assertScenarioManifest（content/schema.js）—— 地点/连接/幕/议程/区域/记录/行为 id；
//   · normalizeScenarioHaunted / normalizeScenarioSpectralLocations / normalizeStoryInvestigatorConfig；
//   · scenarioZoneReport（content/scenario-manifest.js）—— 区域张数/数量上限/重复入牌；
//   · identities 的每个原卡身份都 mapped；
//   · definition 里的敌人/诡计是否都有单卡条目（先查已注册表，再退回文件系统扫描）。
import { existsSync, readdirSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const MOD = resolve(import.meta.dirname, '..')
const { assertScenarioManifest } = await import(pathToFileURL(resolve(MOD, 'content/schema.js')).href)
const { scenarioZoneReport } = await import(pathToFileURL(resolve(MOD, 'content/scenario-manifest.js')).href)
const { normalizeScenarioHaunted } = await import(pathToFileURL(resolve(MOD, 'src/engine/haunted.js')).href)
const { normalizeScenarioSpectralLocations } = await import(pathToFileURL(resolve(MOD, 'src/engine/locations.js')).href)
const { normalizeStoryInvestigatorConfig } = await import(pathToFileURL(resolve(MOD, 'src/engine/story-investigators.js')).href)
const { ALL_CARDS } = await import(pathToFileURL(resolve(MOD, 'src/cards/cards-data.js')).href)
const { implementedFor } = await import(pathToFileURL(resolve(MOD, 'src/cards/card-rules.js')).href)

const args = process.argv.slice(2)
const json = args.includes('--json')
const chapterId = args.find(argument => !argument.startsWith('--'))
if (!chapterId) {
  console.error('用法：node tools/check-tcu-scenario.mjs <chapterId> [--json]')
  process.exit(2)
}

const failures = []
const warnings = []
const fail = message => failures.push(message)
const warn = message => warnings.push(message)

const scenarioDir = resolve(MOD, 'content/campaigns/theCircleUndone/scenarios', chapterId)
if (!existsSync(scenarioDir)) {
  console.error(`章节目录不存在：${scenarioDir}`)
  process.exit(1)
}
for (const file of ['index.js', 'definition.js', 'layout.js', 'behavior.js']) {
  if (!existsSync(resolve(scenarioDir, file))) fail(`缺少文件 ${file}`)
}

let module
try {
  module = await import(pathToFileURL(resolve(scenarioDir, 'index.js')).href)
} catch (error) {
  console.error(`导入 ${chapterId}/index.js 失败：${error.message}`)
  process.exit(1)
}
const { scenario, manifest, identities, behavior } = module
if (!scenario || !manifest || !behavior) fail('index.js 必须导出 scenario/manifest/behavior')

if (manifest.id !== chapterId) fail(`manifest.id=${manifest.id} 与目录 ${chapterId} 不一致`)
if (scenario.id !== chapterId) fail(`scenario.id=${scenario.id} 与目录不一致`)
if (behavior.id !== chapterId) fail(`behavior.id=${behavior.id} 与目录不一致`)
if (manifest.status !== 'development') warn(`manifest.status=${manifest.status}（P8 目标 development）`)
if (manifest.catalogReferenceOnly) fail('manifest.catalogReferenceOnly 仍存在：章节还是占位')
if (manifest.campaignId !== 'theCircleUndone') fail(`campaignId=${manifest.campaignId}`)
for (const group of manifest.requiredEncounterGroupIds || []) {
  if (/^[a-z]+(_[a-z]+)+$/.test(group)) fail(`requiredEncounterGroupIds 应为 camelCase 组 id：${group}`)
}

try {
  assertScenarioManifest(manifest)
} catch (error) {
  fail(`assertScenarioManifest：${error.message}`)
}
for (const [label, run] of [
  ['haunted', () => normalizeScenarioHaunted(scenario.locations, `${chapterId}.locations`)],
  ['spectral', () => normalizeScenarioSpectralLocations(scenario.locations, `${chapterId}.locations`)],
  ['storyInvestigators', () => normalizeStoryInvestigatorConfig(scenario.storyInvestigators, `${chapterId}.storyInvestigators`)],
]) {
  try {
    run()
  } catch (error) {
    fail(`${label} 注册期校验：${error.message}`)
  }
}

let zoneReport = null
try {
  zoneReport = scenarioZoneReport(scenario, manifest)
} catch (error) {
  fail(`scenarioZoneReport：${error.message}`)
}

const identityCategories = Object.entries(identities || {})
if (!identityCategories.length) fail('identities 为空')
for (const [category, entries] of identityCategories) {
  for (const [id, identity] of Object.entries(entries || {})) {
    if (!identity.originalCode) fail(`身份 ${category}/${id} 缺 originalCode`)
    if (identity.identityStatus !== 'mapped') fail(`身份 ${category}/${id} identityStatus=${identity.identityStatus}`)
    if (!ALL_CARDS[identity.originalCode]) fail(`身份 ${category}/${id} 的原卡 ${identity.originalCode} 不在卡表`)
  }
}

// 单卡条目覆盖：definition 里的敌人/诡计卡必须「已实现」。
if (!('enemies' in scenario) || !('treacheries' in scenario)) {
  fail('definition 必须导出 enemies 与 treacheries（可空对象）')
} else {
  const codes = [...Object.values(scenario.enemies), ...Object.values(scenario.treacheries)]
    .map(card => card.originalCode || card.code)
  const unique = [...new Set(codes)]
  const entryFiles = new Map()
  const roots = [
    resolve(MOD, 'src/cards/encounter-entries/theCircleUndone'),
    resolve(MOD, 'src/cards/encounter-entries/shared'),
  ]
  const walk = directory => {
    if (!existsSync(directory)) return
    for (const name of readdirSync(directory)) {
      const full = resolve(directory, name)
      const info = statSync(full)
      if (info.isDirectory()) walk(full)
      else if (name.endsWith('.js')) entryFiles.set(name.replace(/\.js$/, ''), full)
    }
  }
  roots.forEach(walk)
  const missing = unique.filter(code => !implementedFor(code) && !entryFiles.has(code))
  if (missing.length) fail(`缺单卡条目（${missing.length}）：${missing.join(', ')}`)
  const pending = unique.filter(code => !implementedFor(code))
  if (pending.length && missing.length === 0) warn(`索引尚未重建，implementedFor 未命中 ${pending.length} 张（Lead 合并后重建索引即可）`)
}

const entryCounts = {
  locations: Object.keys(scenario.locations || {}).length,
  acts: (scenario.acts || []).length,
  agendas: (scenario.agendas || []).length,
  enemies: Object.keys(scenario.enemies || {}).length,
  treacheries: Object.keys(scenario.treacheries || {}).length,
  storyAssets: Object.keys(scenario.storyAssets || {}).length,
  resolutions: Object.keys(scenario.resolutions || {}),
  recordReads: manifest.recordReads?.length || 0,
  recordWrites: manifest.recordWrites?.length || 0,
}

const result = {
  chapterId,
  ok: failures.length === 0,
  failures,
  warnings,
  inventory: entryCounts,
  zones: zoneReport ? {
    encounterCards: zoneReport.encounterCards,
    declaredSetAsideCards: zoneReport.declaredSetAsideCards,
    optionalSets: Object.keys(zoneReport.optionalSets || {}),
    locationCount: zoneReport.locationCount,
  } : null,
}
if (json) console.log(JSON.stringify(result, null, 2))
else {
  console.log(`章节自检：${chapterId} — ${result.ok ? 'PASS' : 'FAIL'}`)
  console.log(`  地点 ${entryCounts.locations} / 幕 ${entryCounts.acts} / 议程 ${entryCounts.agendas} / 敌人 ${entryCounts.enemies} / 诡计 ${entryCounts.treacheries} / 剧情资产 ${entryCounts.storyAssets}`)
  console.log(`  结局 ${entryCounts.resolutions.join(', ') || '（空）'}；遭遇牌 ${zoneReport?.encounterCards ?? '?'}；放在一边 ${zoneReport?.declaredSetAsideCards ?? '?'}`)
  console.log(`  记录读 ${entryCounts.recordReads} / 写 ${entryCounts.recordWrites}`)
  for (const warning of warnings) console.log(`  ⚠ ${warning}`)
  for (const failure of failures) console.log(`  ✗ ${failure}`)
}
process.exit(failures.length === 0 ? 0 : 1)
