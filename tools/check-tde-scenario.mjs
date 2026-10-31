#!/usr/bin/env node
// P8 章节自检（食梦者版）：单个章节目录的结构、身份、区域、注册期校验、单卡条目覆盖率、
// 以及「本章遭遇组 283 条记录逐条有落点」的覆盖检查。
//
//   node tools/check-tde-scenario.mjs <chapterId> [--json]
//
// 为什么需要它：`content/registered.js` 只在 P10 才把 8 章接进 bundle；P8 期间 worker 在并行写
// 单章时需要一条不依赖注册表的检查路径。本工具按与 `content/registry.js` 相同的校验函数检查
// 「这一章」，并额外核对 scope.json 里本章遭遇组的每条记录：
//   · definition 的 locations/acts/agendas/enemies/treacheries/storyAssets/storyFaces 里有落点，或
//   · `src/cards/encounter-entries/theDreamEaters/**` / `shared/**` 里有单卡条目（enemy/treachery），或
//   · 剧情背面卡的正面（linkedCardCode 反查）已在本章入场，或
//   · type=scenario 的剧本参考卡由 manifest.referenceCode 承载。
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const MOD = resolve(import.meta.dirname, '..')
const CAMPAIGN = 'theDreamEaters'
const args = process.argv.slice(2)
const json = args.includes('--json')
const chapterId = args.find(argument => !argument.startsWith('--'))
if (!chapterId) {
  console.error('用法：node tools/check-tde-scenario.mjs <chapterId> [--json]')
  process.exit(2)
}

const { assertScenarioManifest, CONTENT_STATUSES } = await import(pathToFileURL(resolve(MOD, 'content/schema.js')).href)
const { scenarioZoneReport } = await import(pathToFileURL(resolve(MOD, 'content/scenario-manifest.js')).href)
const { normalizeScenarioHaunted } = await import(pathToFileURL(resolve(MOD, 'src/engine/haunted.js')).href)
const { normalizeScenarioSpectralLocations } = await import(pathToFileURL(resolve(MOD, 'src/engine/locations.js')).href)
const { normalizeStoryInvestigatorConfig } = await import(pathToFileURL(resolve(MOD, 'src/engine/story-investigators.js')).href)
const { normalizeVeiledScenario } = await import(pathToFileURL(resolve(MOD, 'src/engine/veiled.js')).href)
const { normalizeLocationDoom } = await import(pathToFileURL(resolve(MOD, 'src/engine/location-doom.js')).href)
const { ALL_CARDS } = await import(pathToFileURL(resolve(MOD, 'src/cards/cards-data.js')).href)
const { implementedFor } = await import(pathToFileURL(resolve(MOD, 'src/cards/card-rules.js')).href)
const scope = JSON.parse(readFileSync(resolve(MOD, 'artifacts/migration/tde/scope.json'), 'utf8'))

const failures = []
const warnings = []
const fail = message => failures.push(message)
const warn = message => warnings.push(message)
const originalOf = card => card?.originalCode || card?.code

const scenarioDir = resolve(MOD, 'content/campaigns', CAMPAIGN, 'scenarios', chapterId)
if (!existsSync(scenarioDir)) {
  console.error(`章节目录不存在：${scenarioDir}`)
  process.exit(1)
}
for (const file of ['index.js', 'definition.js', 'layout.js', 'behavior.js']) {
  if (!existsSync(resolve(scenarioDir, file))) fail(`缺少文件 ${file}`)
}
const hasChaos = existsSync(resolve(scenarioDir, 'chaos.js'))
if (!hasChaos) warn('缺少 chaos.js（逐章混乱符号表；若符号全部走 behavior 可忽略）')

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
if (!CONTENT_STATUSES.includes(manifest.status)) fail(`manifest.status=${manifest.status} 不在 ${CONTENT_STATUSES.join('/')}`)
if (manifest.status !== 'development') warn(`manifest.status=${manifest.status}（P8 目标 development）`)
if (manifest.catalogReferenceOnly) fail('manifest.catalogReferenceOnly 仍存在：章节还是占位')
if (manifest.campaignId !== CAMPAIGN) fail(`campaignId=${manifest.campaignId}`)
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
  ['locationDoom', () => {
    const report = normalizeLocationDoom(Object.values(scenario.locations || {}))
    if (!report.ok) throw new Error((report.problems || []).join('；'))
  }],
]) {
  try {
    run()
  } catch (error) {
    fail(`${label} 注册期校验：${error.message}`)
  }
}

// 掩藏地点：必须能翻出背面故事卡或显式声明洗回（P3 原语注册期口径）。
// 注意 `normalizeVeiledScenario` 期望 `scenario.locations` 是数组，而 TDE 章节 definition 是 id→地点对象。
const veiledReport = normalizeVeiledScenario({
  ...scenario,
  locations: Object.values(scenario.locations || {}),
})
if (veiledReport.missing.length) {
  fail(`掩藏地点缺少背面故事卡/洗回声明（${veiledReport.missing.length}）：${veiledReport.missing.join(', ')}`)
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

// ---------------------------------------------------------------- 单卡条目索引
const entryFiles = new Map()
const entryRoots = [
  resolve(MOD, 'src/cards/encounter-entries', CAMPAIGN),
  resolve(MOD, 'src/cards/encounter-entries/shared'),
]
const walk = directory => {
  if (!existsSync(directory)) return
  for (const name of readdirSync(directory)) {
    const full = resolve(directory, name)
    if (statSync(full).isDirectory()) walk(full)
    else if (name.endsWith('.js') && name !== 'index.js' && !name.startsWith('_')) {
      entryFiles.set(name.replace(/\.js$/, ''), full)
    }
  }
}
entryRoots.forEach(walk)

// ---------------------------------------------------------------- 遭遇记录覆盖（scope.json 为准）
const scopeGroup = scope.encounterGroups.find(group => group.chapterId === chapterId)
const chapterRecords = []
if (!scopeGroup) fail(`scope.json 缺少本章遭遇组（chapterId=${chapterId}）`)
else {
  const scan = JSON.parse(readFileSync(resolve(MOD, 'artifacts/migration/tde/mechanism-scan.json'), 'utf8'))
  const cards = new Map(scan.cards.map(card => [card.code, card]))
  const group = scan.encounterGroups.find(item => item.id === scopeGroup.encounterCode)
  for (const code of group?.codes || []) {
    chapterRecords.push({ code, type: cards.get(code)?.type || 'unknown', face: cards.get(code)?.face === true })
  }
  if (chapterRecords.length !== scopeGroup.records) {
    fail(`本章记录数 ${chapterRecords.length} 与 scope ${scopeGroup.records} 不一致`)
  }
  const definitionCodes = new Set([
    ...Object.values(scenario.locations || {}).map(originalOf),
    ...(scenario.acts || []).map(originalOf),
    ...(scenario.agendas || []).map(originalOf),
    ...Object.values(scenario.enemies || {}).map(originalOf),
    ...Object.values(scenario.treacheries || {}).map(originalOf),
    ...Object.values(scenario.storyAssets || {}).map(originalOf),
    ...Object.values(scenario.storyFaces || {}).map(originalOf),
  ].filter(Boolean))
  // 背面故事卡的「正面」如果在本章入场，也算有落点。
  const frontCodes = new Set(Object.values(ALL_CARDS)
    .filter(card => card.linkedCardCode && definitionCodes.has(card.code))
    .map(card => card.linkedCardCode))
  const covered = []
  for (const record of chapterRecords) {
    const { code, type } = record
    let ok = false
    if (type === 'scenario') ok = manifest.referenceCode === code
    else if (definitionCodes.has(code)) ok = true
    else if (frontCodes.has(code)) ok = true
    else if (entryFiles.has(code) || implementedFor(code)) ok = true
    else if (type === 'enemy' || type === 'treachery') ok = false
    if (ok) covered.push(code)
  }
  const missing = chapterRecords.map(record => record.code).filter(code => !covered.includes(code))
  if (missing.length) {
    fail(`遭遇记录未落地（${missing.length}/${chapterRecords.length}）：${missing.join(', ')}`)
  }
}

// ---------------------------------------------------------------- definition 敌人/诡计必须有单卡条目
if (!('enemies' in scenario) || !('treacheries' in scenario)) {
  fail('definition 必须导出 enemies 与 treacheries（可空对象）')
} else {
  const codes = [...Object.values(scenario.enemies), ...Object.values(scenario.treacheries)]
    .map(originalOf)
  const unique = [...new Set(codes)]
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
  storyFaces: Object.keys(scenario.storyFaces || {}).length,
  veiledLocations: veiledReport.total,
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
  coverage: {
    records: chapterRecords.length,
    covered: chapterRecords.length - failures.filter(message => message.startsWith('遭遇记录未落地')).length,
    pendingEncounterCodes: chapterRecords.map(record => record.code)
      .filter(code => !entryFiles.has(code) && !implementedFor(code)),
  },
  veiled: veiledReport,
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
  console.log(`  地点 ${entryCounts.locations}（掩藏 ${entryCounts.veiledLocations}）/ 幕 ${entryCounts.acts} / 议程 ${entryCounts.agendas} / 敌人 ${entryCounts.enemies} / 诡计 ${entryCounts.treacheries} / 剧情支援 ${entryCounts.storyAssets} / 剧情面 ${entryCounts.storyFaces}`)
  console.log(`  结局 ${entryCounts.resolutions.join(', ') || '（空）'}；遭遇牌 ${zoneReport?.encounterCards ?? '?'}；放在一边 ${zoneReport?.declaredSetAsideCards ?? '?'}`)
  console.log(`  记录读 ${entryCounts.recordReads} / 写 ${entryCounts.recordWrites}；本章遭遇记录 ${chapterRecords.length}`)
  for (const warning of warnings) console.log(`  ⚠ ${warning}`)
  for (const failure of failures) console.log(`  ✗ ${failure}`)
}
process.exit(failures.length === 0 ? 0 : 1)
