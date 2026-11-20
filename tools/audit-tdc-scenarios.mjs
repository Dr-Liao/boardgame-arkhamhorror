#!/usr/bin/env node
// 十循环《沉没之城》P7 逐章验收账本。
//
//   node tools/audit-tdc-scenarios.mjs --write   生成 audit/tdc-p7-scenarios.json
//   node tools/audit-tdc-scenarios.mjs --check   逐字节复算（结论漂移即失败）
//
// 事实源：audit/tdc-scope.json（范围/卡号/组）、audit/tdc-p7.json（P7 总账）、
// 内容注册表（content/registered.js）、章节模块与单卡条目、authored 指南源与生成物、
// 章节/战役 Node 测试的实际输出。账本只记录可复算事实；近似与缺口显式列入 remaining。
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { contentRegistry } from '../content/registered.js'
import { buildAuthoredScenarioGuide } from './authored-scenario-guide.mjs'
import { inspectFlow } from './tdc-p7-readiness.mjs'

const MOD = fileURLToPath(new URL('..', import.meta.url))
const CAMPAIGN_ID = 'theDrownedCity'
const LEDGER = join(MOD, 'audit/tdc-p7-scenarios.json')
const read = path => readFileSync(join(MOD, path), 'utf8')
const readJson = path => JSON.parse(read(path))
const exists = path => existsSync(join(MOD, path))
const sha = text => createHash('sha256').update(text).digest('hex')

const scope = readJson('audit/tdc-scope.json')
const p7 = readJson('audit/tdc-p7.json')
const chapterCodes = new Map(Object.entries(scope.cards).map(([code, card]) => [code, card.group]))
const scenarioByGroup = new Map(scope.scenarios.map(scenario => [scenario.group, scenario]))
const chapterCards = scenario => Object.entries(scope.cards)
  .filter(([code, card]) => card.group === scenario.group && code !== scenario.code)
  .map(([code, card]) => ({ code, type: card.type }))
const sharedGroups = [...new Set(scope.partitions.shared.map(code => scope.cards[code].group))]
const sharedCards = code => scope.cards[code]
const entryPath = (chapterId, code) => `src/cards/encounter-entries/theDrownedCity/${chapterId}/${code}.js`
const sharedEntryPath = (group, code) => `src/cards/encounter-entries/theDrownedCity/_shared/${group}/${code}.js`

// 归属算法允许「同一战役多章共用卡」只落在其中一章目录（如 11687 判给 Doom II），
// 因此条目存在性以战役目录内任意位置为准；章节专有卡仍优先核对本章路径。
function entryFileIndex() {
  const files = new Map()
  const walk = (absolute, relative) => {
    for (const item of readdirSync(absolute, { withFileTypes: true })) {
      const nextAbsolute = join(absolute, item.name)
      const nextRelative = `${relative}${item.name}`
      if (item.isDirectory()) walk(nextAbsolute, `${nextRelative}/`)
      else if (item.name.endsWith('.js')) files.set(item.name.replace(/\.js$/, ''), nextRelative)
    }
  }
  walk(join(MOD, 'src/cards/encounter-entries/theDrownedCity'), '')
  return files
}
const campaignEntryFiles = entryFileIndex()
const findEntry = (chapterId, code) => exists(entryPath(chapterId, code))
  ? entryPath(chapterId, code) : campaignEntryFiles.get(code) ?? null

function runNodeTests(files) {
  const existing = files.filter(file => exists(file))
  if (!existing.length) return { status: 1, passed: 0, failed: 0, cancelled: 0, results: [], missing: files }
  const env = { ...process.env }
  delete env.NODE_TEST_CONTEXT
  const result = spawnSync(process.execPath,
    ['--test', '--test-reporter=./tools/core-test-reporter.mjs', ...existing],
    { cwd: MOD, env, encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 })
  const rows = []
  for (const line of String(result.stdout || '').trim().split('\n').filter(Boolean)) {
    try { rows.push(JSON.parse(line)) } catch { /* 非 JSON 行忽略 */ }
  }
  const passed = rows.filter(row => row.type === 'test:pass' && !row.skipped && !row.todo).length
  const failed = rows.filter(row => row.type === 'test:fail').length
  return { status: result.status ?? 1, passed, failed, cancelled: 0, results: rows,
    missing: files.filter(file => !exists(file)) }
}

const scenarioTestFiles = scope.scenarios.map(scenario => `tests/tdc-scenario-${scenario.id}.test.mjs`)
const scenarioTests = runNodeTests(scenarioTestFiles)
const campaignTestFiles = ['tests/tdc-p7-campaign-layer.test.mjs', 'tests/tdc-p7-story.test.mjs']
const campaignTests = runNodeTests(campaignTestFiles)
const sharedTestFiles = ['tests/tdc-p7-shared-encounters.test.mjs', 'tests/tdc-p7-shared-assets.test.mjs']
const sharedTests = runNodeTests(sharedTestFiles)

function guideCheck(manifest) {
  const sourcePath = `content/scenario-guide-sources/${manifest.id}.json`
  const outputPath = `web/scenario-guides/${manifest.id}.json`
  if (!exists(sourcePath)) return { status: 'missing-source', sourcePath, outputPath }
  if (!exists(outputPath)) return { status: 'missing-output', sourcePath, outputPath }
  let expected
  try {
    expected = JSON.stringify(buildAuthoredScenarioGuide(manifest, readJson(sourcePath)), null, 2) + '\n'
  } catch (error) {
    return { status: 'invalid-source', sourcePath, outputPath, error: String(error.message || error) }
  }
  const actual = read(outputPath)
  return {
    status: actual === expected ? 'ready' : 'stale-output', sourcePath, outputPath,
    sourceSha256: sha(read(sourcePath)), outputSha256: sha(actual),
  }
}

const scenarios = []
for (const source of scope.scenarios) {
  const modulePath = `content/campaigns/theDrownedCity/scenarios/${source.id}/index.js`
  let module = null
  let loadError = null
  if (exists(modulePath)) {
    try {
      module = await import(pathToFileURL(join(MOD, modulePath)).href)
    } catch (error) {
      loadError = String(error?.message || error)
    }
  }
  const registered = (() => {
    try { return contentRegistry.getScenario(source.id) } catch { return null }
  })()
  const manifest = module?.manifest || registered || null
  const cards = chapterCards(source)
  const entryFiles = cards.map(card => ({ code: card.code, type: card.type,
    path: entryPath(source.id, card.code), foundPath: findEntry(source.id, card.code) }))
  const missingEntries = entryFiles.filter(entry => !entry.foundPath)
  const guide = guideCheck({
    id: source.id, campaignId: CAMPAIGN_ID, referenceCode: source.code,
    resolutionIds: manifest?.resolutionIds || [],
  })
  const tests = scenarioTests.results.filter(row => row.type === 'test:pass'
    && String(row.file || '').replaceAll('\\', '/').endsWith(`tests/tdc-scenario-${source.id}.test.mjs`))
  const checks = {
    moduleLoaded: Boolean(module?.scenario && module?.behavior && module?.layout),
    manifestComplete: Boolean(manifest && Array.isArray(manifest.locations) && manifest.locations.length
      && Array.isArray(manifest.acts) && manifest.acts.length
      && Array.isArray(manifest.agendas) && manifest.agendas.length
      && Array.isArray(manifest.resolutionIds) && manifest.resolutionIds.length
      && manifest.startLocationId),
    registered: Boolean(registered && registered.campaignId === CAMPAIGN_ID && registered.status !== 'catalog-only'),
    cardEntries: cards.length > 0 && missingEntries.length === 0,
    behaviorFile: exists(`content/campaigns/theDrownedCity/scenarios/${source.id}/behavior.js`),
    chaosFile: exists(`content/campaigns/theDrownedCity/scenarios/${source.id}/chaos.js`),
    layoutFile: exists(`content/campaigns/theDrownedCity/scenarios/${source.id}/layout.js`),
    guide: guide.status === 'ready',
    tests: tests.length > 0,
  }
  scenarios.push({
    id: source.id, referenceCode: source.code, group: source.group, modulePath,
    cardCount: cards.length,
    checks,
    // 本账本只证明「结构/条目/测试/指南」层内容完整；逐卡 literalCardBehavior、saveReplay 与
    // browserAcceptance 仍由 audit/tdc-migration.json 的确认项单独把关，故这里不写 verified。
    status: Object.values(checks).every(Boolean) ? 'content-complete' : 'pending',
    guide,
    tests: { count: tests.length, titles: tests.map(row => row.name) },
    ...(loadError ? { loadError } : {}),
    ...(missingEntries.length ? { missingEntries: missingEntries.map(entry => entry.code) } : {}),
  })
}

const shared = sharedGroups.map(group => {
  const codes = scope.partitions.shared.filter(code => scope.cards[code].group === group)
  const entries = codes.map(code => ({ code, type: scope.cards[code].type, path: sharedEntryPath(group, code) }))
  const missing = entries.filter(entry => !exists(entry.path))
  return {
    group, cards: codes.length, missing: missing.map(entry => entry.code),
    status: missing.length ? 'pending' : 'present',
  }
})

const campaign = (() => { try { return contentRegistry.getCampaign(CAMPAIGN_ID) } catch { return null } })()
const campaignPack = (() => { try { return contentRegistry.getPack('tdcCampaign') } catch { return null } })()
const expectedIds = scope.scenarios.map(scenario => scenario.id)
const flowCoverage = campaign ? inspectFlow(campaign, expectedIds) : {
  explicit: false, terminalReachable: false, reachableChapters: [], missingChapters: expectedIds,
}
const campaignChecks = {
  campaignRegistered: Boolean(campaign),
  campaignPackDevelopment: campaignPack?.status === 'development',
  flowExplicit: flowCoverage.explicit,
  allChaptersReachable: flowCoverage.missingChapters.length === 0,
  terminalReachable: flowCoverage.terminalReachable,
  prologue: exists('content/campaigns/theDrownedCity/prologue.js'),
  interludes: exists('content/campaigns/theDrownedCity/interludes.js'),
  epilogue: exists('content/campaigns/theDrownedCity/epilogue.js'),
  records: exists('content/campaigns/theDrownedCity/records.js'),
  storyText: exists('content/campaigns/theDrownedCity/story-text.js'),
  storyCheck: (() => {
    const result = spawnSync(process.execPath, ['tools/import-tdc-story.mjs', '--check'],
      { cwd: MOD, encoding: 'utf8' })
    return result.status === 0
  })(),
  campaignTests: campaignTests.status === 0 && campaignTests.passed > 0,
  sharedEntries: shared.every(group => group.status === 'present'),
  sharedTests: sharedTests.status === 0 && sharedTests.passed > 0,
}
const scenarioTestsPassed = scenarioTests.failed === 0 && scenarioTests.passed > 0
const verification = {
  scenarioTests: { files: scenarioTestFiles, passed: scenarioTests.passed, failed: scenarioTests.failed, missing: scenarioTests.missing },
  campaignTests: { files: campaignTestFiles, passed: campaignTests.passed, failed: campaignTests.failed, missing: campaignTests.missing },
  sharedTests: { files: sharedTestFiles, passed: sharedTests.passed, failed: sharedTests.failed, missing: sharedTests.missing },
  p7LedgerSha256: sha(read('audit/tdc-p7.json')),
}
const ledger = {
  schemaVersion: 1,
  campaignId: CAMPAIGN_ID,
  phase: 'P7',
  phaseName: '共享遭遇、剧本与战役流程',
  status: scenarios.every(scenario => scenario.status === 'content-complete')
    && campaignChecks.storyCheck && scenarioTestsPassed ? 'content-complete' : 'content-in-progress',
  counts: {
    chapters: scenarios.length,
    chaptersContentComplete: scenarios.filter(scenario => scenario.status === 'content-complete').length,
    moduleLoaded: scenarios.filter(scenario => scenario.checks.moduleLoaded).length,
    manifestComplete: scenarios.filter(scenario => scenario.checks.manifestComplete).length,
    registered: scenarios.filter(scenario => scenario.checks.registered).length,
    cardEntries: scenarios.reduce((sum, scenario) => sum + scenario.cardCount, 0),
    missingCardEntries: scenarios.reduce((sum, scenario) => sum + (scenario.missingEntries?.length || 0), 0),
    guidesReady: scenarios.filter(scenario => scenario.checks.guide).length,
    scenarioTests: scenarioTests.passed,
    sharedGroups: shared.length,
    sharedCards: shared.reduce((sum, group) => sum + group.cards, 0),
    sharedMissing: shared.reduce((sum, group) => sum + group.missing.length, 0),
  },
  checks: campaignChecks,
  flowCoverage,
  scenarios,
  shared,
  verification,
  evidence: [
    'audit/tdc-scope.json', 'audit/tdc-p7.json', 'artifacts/migration/tdc/p7/CONTRACT.md',
    'content/campaigns/theDrownedCity/', 'src/cards/encounter-entries/theDrownedCity/',
    'content/scenario-guide-sources/', 'web/scenario-guides/',
  ],
}

const parsed = process.argv[2]
if (parsed === '--write') {
  writeFileSync(LEDGER, JSON.stringify(ledger, null, 2) + '\n')
  console.log(`TDC P7 逐章账本：${ledger.counts.chaptersRegistered ?? ledger.counts.registered}/${ledger.counts.chapters} 章已注册 · `
    + `${ledger.counts.guidesReady} 份指南就绪 · 缺失条目 ${ledger.counts.missingCardEntries} · 状态 ${ledger.status}`)
} else if (parsed === '--check') {
  const actual = read('audit/tdc-p7-scenarios.json')
  const expected = JSON.stringify(ledger, null, 2) + '\n'
  if (actual !== expected) {
    console.error('TDC P7 逐章账本漂移：重新运行 node tools/audit-tdc-scenarios.mjs --write')
    process.exit(1)
  }
  console.log(`TDC P7 逐章账本一致：${ledger.counts.registered}/${ledger.counts.chapters} 章已注册 · `
    + `${ledger.counts.guidesReady} 份指南 · ${ledger.counts.sharedCards} 张共享卡`)
} else {
  console.log(JSON.stringify(ledger.counts, null, 2))
}
