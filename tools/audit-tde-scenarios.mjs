#!/usr/bin/env node
// 食梦者（The Dream Eaters）P8 逐章验收账本：8 章 × 12 项检查，全部由代码与实跑证据计算。
//
//   node tools/audit-tde-scenarios.mjs --write   写 audit/tde-scenario-acceptance.json（+ 来源锁）
//   node tools/audit-tde-scenarios.mjs --check   逐字节复算，漂移即失败
//   node tools/audit-tde-scenarios.mjs           打印 JSON
//
// 证据口径（路线图 §8.3 / §11.2）：
//   · 一个事实源：章节来自 content/campaigns/theDreamEaters/shared.js，数据从各章 index.js 动态 import；
//     遭遇卡「是否已实现」读 src/cards/card-rules.js 的 implementedFor（单卡条目的 implemented 声明）；
//   · sourceLocked：8 章剧本 + 战役参考实现 + en locale 的 SHA-256 与 audit/tde-scenario-source-lock.json 比对；
//   · 覆盖：本章遭遇组（scope.json）的每条记录必须有落点（definition 集合 / 单卡条目 / 背面故事卡的正面 / 参考卡）；
//   · literalCardBehavior：P8 口径**保持 false**（逐卡等价核对属 P9）；pendingEncounterCodes 单独列出；
//   · storyText：P8-T 未完成，一律 false 并记 pending 原因；story-text.js 变成 translated 后自动切换；
//   · saveReplay：spawnSync 实跑该章测试，并要求用例名里出现「存档/回放/重放/往返」且通过；
//   · browserAcceptance：只读 runner 产物 audit/tde-browser-acceptance.json（P9 补）。
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { chapters } from '../content/campaigns/theDreamEaters/shared.js'
import { TDE_STORY_TEXT } from '../content/campaigns/theDreamEaters/story-text.js'
import { scenarioZoneReport } from '../content/scenario-manifest.js'
import { implementedFor } from '../src/cards/card-rules.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { normalizeVeiledScenario } from '../src/engine/veiled.js'

const MOD = new URL('../', import.meta.url)
const ROOT = MOD.pathname.replace(/^\/([A-Za-z]:)/, '$1').replaceAll('/', '\\')
const REFERENCE = 'G:\\boardgame-hall-ai\\参考资源\\ArkhamHorror-main'
const MODE = process.argv.includes('--write') ? 'write' : process.argv.includes('--check') ? 'check' : 'report'
const LEDGER = new URL('../audit/tde-scenario-acceptance.json', import.meta.url)
const LOCK = new URL('../audit/tde-scenario-source-lock.json', import.meta.url)
const BROWSER = new URL('../audit/tde-browser-acceptance.json', import.meta.url)
const scope = JSON.parse(readFileSync(new URL('../artifacts/migration/tde/scope.json', import.meta.url), 'utf8'))
const scan = JSON.parse(readFileSync(new URL('../artifacts/migration/tde/mechanism-scan.json', import.meta.url), 'utf8'))
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')
const readJson = (url, fallback) => {
  try {
    return JSON.parse(readFileSync(url, 'utf8'))
  } catch {
    return fallback
  }
}
const originalOf = card => card?.originalCode || card?.code

// ---------------------------------------------------------------- 来源锁
const SCENARIO_HS = {
  beyondTheGatesOfSleep: 'BeyondTheGatesOfSleep.hs',
  wakingNightmare: 'WakingNightmare.hs',
  theSearchForKadath: 'TheSearchForKadath.hs',
  aThousandShapesOfHorror: 'AThousandShapesOfHorror.hs',
  darkSideOfTheMoon: 'DarkSideOfTheMoon.hs',
  pointOfNoReturn: 'PointOfNoReturn.hs',
  whereTheGodsDwell: 'WhereTheGodsDwell.hs',
  weaverOfTheCosmos: 'WeaverOfTheCosmos.hs',
}
const EN_LOCALES = {
  beyondTheGatesOfSleep: 'beyondTheGatesOfSleep.json',
  wakingNightmare: 'wakingNightmare.json',
  theSearchForKadath: 'theSearchForKadath.json',
  aThousandShapesOfHorror: 'aThousandShapesOfHorror.json',
  darkSideOfTheMoon: 'darkSideOfTheMoon.json',
  pointOfNoReturn: 'pointOfNoReturn.json',
  whereTheGodsDwell: 'whereTheGodsDwell.json',
  weaverOfTheCosmos: 'weaverOfTheCosmos.json',
}
const COMMON_SOURCES = [
  'backend/arkham-api/library/Arkham/Campaign/Campaigns/TheDreamEaters.hs',
  'backend/arkham-api/library/Arkham/Campaigns/TheDreamEaters/ChaosBag.hs',
  'backend/arkham-api/library/Arkham/Campaigns/TheDreamEaters/Key.hs',
  'backend/arkham-api/library/Arkham/Campaigns/TheDreamEaters/Meta.hs',
  'backend/arkham-api/library/Arkham/Campaigns/TheDreamEaters/CampaignSteps.hs',
  'backend/arkham-api/library/Arkham/Campaigns/TheDreamEaters/Helpers.hs',
  'frontend/src/locales/en/theDreamEaters/base.json',
  'frontend/src/locales/zh/theDreamEaters/base.json',
]
const referenceFile = relative => `${REFERENCE}/${relative}`
const sourceEntry = relative => {
  const full = referenceFile(relative)
  if (!existsSync(full)) return { path: relative, ok: false, sha256: null, reason: '参考文件缺失' }
  const digest = sha256(readFileSync(full))
  return { path: relative, ok: true, sha256: digest }
}
function computeSourceLock() {
  if (!existsSync(REFERENCE)) {
    return {
      schemaVersion: 1,
      campaignId: 'theDreamEaters',
      generatedBy: 'tools/audit-tde-scenarios.mjs --write',
      reference: REFERENCE,
      available: false,
      files: [],
      chapters: Object.fromEntries(chapters.map(chapter => [chapter.id, []])),
    }
  }
  const scenarioDir = 'backend/arkham-api/library/Arkham/Scenario/Scenarios/TheDreamEaters'
  const enDir = 'frontend/src/locales/en/theDreamEaters/scenarios'
  const chaptersLock = {}
  for (const chapter of chapters) {
    chaptersLock[chapter.id] = [
      sourceEntry(`${scenarioDir}/${SCENARIO_HS[chapter.id]}`),
      sourceEntry(`${enDir}/${EN_LOCALES[chapter.id]}`),
    ]
  }
  return {
    schemaVersion: 1,
    campaignId: 'theDreamEaters',
    generatedBy: 'tools/audit-tde-scenarios.mjs --write',
    reference: REFERENCE,
    available: true,
    files: COMMON_SOURCES.map(sourceEntry),
    chapters: chaptersLock,
  }
}
const sourceLock = readJson(LOCK, null) || computeSourceLock()
const lockCheck = entry => {
  if (!existsSync(REFERENCE)) return { ...entry, ok: false, reason: '缺少参考实现目录' }
  const full = referenceFile(entry.path)
  if (!existsSync(full)) return { ...entry, ok: false, reason: '参考文件缺失' }
  const actual = sha256(readFileSync(full))
  return { ...entry, ok: actual === entry.sha256, actual }
}

// ---------------------------------------------------------------- 单卡条目索引
const entryFiles = new Map()
const entryRoots = [
  new URL('../src/cards/encounter-entries/theDreamEaters/', import.meta.url),
  new URL('../src/cards/encounter-entries/shared/', import.meta.url),
]
for (const root of entryRoots) {
  const directory = root.pathname.replace(/^\/([A-Za-z]:)/, '$1').replaceAll('/', '\\')
  if (!existsSync(directory)) continue
  const stack = [directory]
  while (stack.length) {
    const current = stack.pop()
    for (const item of readdirSync(current, { withFileTypes: true })) {
      const full = `${current}\\${item.name}`
      if (item.isDirectory()) stack.push(full)
      else if (item.name.endsWith('.js') && item.name !== 'index.js' && !item.name.startsWith('_')) {
        entryFiles.set(item.name.replace(/\.js$/, ''), full)
      }
    }
  }
}

// ---------------------------------------------------------------- 测试实跑
const testDir = new URL('../tests/', import.meta.url)
const kebab = id => id.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
const testSourceFor = async chapterId => {
  const candidates = [
    `tde-scenario-${chapterId}.test.mjs`,
    `tde-scenario-${kebab(chapterId)}.test.mjs`,
    `tde-${chapterId}.test.mjs`,
  ]
  for (const name of candidates) {
    const url = new URL(name, testDir)
    if (existsSync(url)) return { name: `tests/${name}`, source: await readFile(url, 'utf8') }
  }
  for (const name of readdirSync(testDir).filter(item => /^tde-.*\.test\.mjs$/.test(item))) {
    const source = await readFile(new URL(name, testDir), 'utf8')
    if (source.includes(`scenarios/${chapterId}/`)) return { name: `tests/${name}`, source }
  }
  return { name: null, source: '' }
}
const testRunCache = new Map()
function runTestFile(name) {
  if (testRunCache.has(name)) return testRunCache.get(name)
  const result = spawnSync(process.execPath, ['--test', '--test-reporter=tap', name], {
    cwd: ROOT, encoding: 'utf8', timeout: 240_000,
  })
  const output = `${result.stdout || ''}\n${result.stderr || ''}`
  const titles = [...output.matchAll(/^\s*ok \d+ - (.+)$/gm)].map(match => match[1].trim())
  const failedTitles = [...output.matchAll(/^\s*not ok \d+ - (.+)$/gm)].map(match => match[1].trim())
  const entry = { name, ok: result.status === 0, titles, failedTitles }
  testRunCache.set(name, entry)
  return entry
}
const SAVE_REPLAY_TITLES = /存档|回放|重放|往返|serialize/i

// ---------------------------------------------------------------- 浏览器证据（P9）
const browserReport = readJson(BROWSER, null)
const browserChecks = browserReport?.tests || []
function browserAcceptanceFor(chapterId) {
  const tests = browserChecks.filter(entry => entry.scenario === chapterId)
  const desktop = tests.some(entry => entry.viewport === 'desktop' && entry.status === 'passed')
  const mobile = tests.some(entry => entry.viewport === 'mobile' && entry.status === 'passed')
  return { pass: desktop && mobile, desktop, mobile }
}

// ---------------------------------------------------------------- 逐章记录覆盖
const cardsByCode = new Map(scan.cards.map(card => [card.code, card]))
const scanGroups = new Map(scan.encounterGroups.map(group => [group.id, group]))
function coverageFor(chapterId, scenario, manifest) {
  const group = scope.encounterGroups.find(item => item.chapterId === chapterId)
  const scanGroup = group ? scanGroups.get(group.encounterCode) : null
  const records = (scanGroup?.codes || []).map(code => ({ code, type: cardsByCode.get(code)?.type || 'unknown' }))
  const definitionCodes = new Set([
    ...Object.values(scenario.locations || {}).map(originalOf),
    ...(scenario.acts || []).map(originalOf),
    ...(scenario.agendas || []).map(originalOf),
    ...Object.values(scenario.enemies || {}).map(originalOf),
    ...Object.values(scenario.treacheries || {}).map(originalOf),
    ...Object.values(scenario.storyAssets || {}).map(originalOf),
    ...Object.values(scenario.storyFaces || {}).map(originalOf),
  ].filter(Boolean))
  const frontCodes = new Set(Object.values(ALL_CARDS)
    .filter(card => card.linkedCardCode && definitionCodes.has(card.code))
    .map(card => card.linkedCardCode))
  const covered = []
  const uncovered = []
  for (const record of records) {
    const { code, type } = record
    let ok = false
    if (type === 'scenario') ok = manifest.referenceCode === code
    else if (definitionCodes.has(code)) ok = true
    else if (frontCodes.has(code)) ok = true
    else if (entryFiles.has(code) || implementedFor(code)) ok = true
    if (ok) covered.push(code)
    else uncovered.push(code)
  }
  const pendingEncounterCodes = records.filter(record => ['enemy', 'treachery'].includes(record.type))
    .map(record => record.code)
    .filter(code => !entryFiles.has(code) && !implementedFor(code))
  return {
    scopeGroup: group?.id || null,
    encounterCode: group?.encounterCode || null,
    records: records.length,
    covered: covered.length,
    uncovered,
    pendingEncounterCodes,
  }
}

// ---------------------------------------------------------------- 逐章计算
const storyTextPending = TDE_STORY_TEXT.meta.status !== 'translated'
const items = []
for (const chapter of chapters) {
  const chapterRoot = `../content/campaigns/theDreamEaters/scenarios/${chapter.id}/`
  const moduleDir = new URL(chapterRoot, import.meta.url)
  if (!existsSync(moduleDir)) {
    items.push({
      id: chapter.id, code: chapter.code, name: chapter.name, status: 'pending',
      checks: Object.fromEntries(['sourceLocked', 'identityRegistered', 'setupAndZones', 'actsAndAgendas',
        'locationsAndConnections', 'encounterBehaviors', 'literalCardBehavior', 'chaosEffects',
        'resolutionsAndRecords', 'storyText', 'saveReplay', 'browserAcceptance'].map(key => [key, false])),
      inventory: null, coverage: null, gaps: ['章节目录缺失'], remaining: ['章节目录缺失'],
    })
    continue
  }
  let module
  try {
    module = await import(chapterRoot + 'index.js')
  } catch (error) {
    items.push({
      id: chapter.id, code: chapter.code, name: chapter.name, status: 'pending',
      checks: Object.fromEntries(['sourceLocked', 'identityRegistered', 'setupAndZones', 'actsAndAgendas',
        'locationsAndConnections', 'encounterBehaviors', 'literalCardBehavior', 'chaosEffects',
        'resolutionsAndRecords', 'storyText', 'saveReplay', 'browserAcceptance'].map(key => [key, false])),
      inventory: null, coverage: null, gaps: [`章节目录无法导入：${error.message}`],
      remaining: [`章节目录无法导入：${error.message}`],
    })
    continue
  }
  const files = ['index.js', 'definition.js', 'layout.js', 'behavior.js', 'chaos.js']
    .filter(file => existsSync(new URL(chapterRoot + file, import.meta.url)))
  const fileHashes = Object.fromEntries(files.map(file =>
    [file, sha256(readFileSync(new URL(chapterRoot + file, import.meta.url)))]))
  const zoneReport = scenarioZoneReport(module.scenario, module.manifest)
  const resolutionIds = Object.keys(module.scenario.resolutions || {})
  const encounterCodes = [...new Set([
    ...Object.values(module.scenario.enemies || {}),
    ...Object.values(module.scenario.treacheries || {}),
  ].map(originalOf))]
  const coverage = coverageFor(chapter.id, module.scenario, module.manifest)
  const pendingEncounterCodes = coverage.pendingEncounterCodes
  const gaps = [...(module.behavior?.scenarioGaps || [])]
  const approximations = [...(module.behavior?.scenarioApproximations || [])]
  const veiledReport = normalizeVeiledScenario({
    ...module.scenario,
    locations: Object.values(module.scenario.locations || {}),
  })
  const testFileInfo = await testSourceFor(chapter.id)
  const testRun = testFileInfo.name ? runTestFile(testFileInfo.name) : null
  const testTitles = testRun?.titles || []
  const coveredCodes = encounterCodes.filter(code => testTitles.some(title => title.includes(code)))
  const chapterLock = sourceLock?.chapters?.[chapter.id] || []
  const sources = chapterLock.map(lockCheck)
  const commonSources = (sourceLock?.files || []).map(lockCheck)
  const browser = browserAcceptanceFor(chapter.id)
  const checks = {
    sourceLocked: existsSync(REFERENCE) && sources.length > 0 && sources.every(entry => entry.ok === true)
      && commonSources.every(entry => entry.ok === true),
    identityRegistered: Object.values(module.identities || {}).every(category =>
      Object.values(category).every(identity => identity.originalCode && identity.identityStatus === 'mapped')),
    // 区域守恒：遭遇牌库（可能按规则在 setup 后段才形成，如 A1 开局没有遭遇牌库）+ 放在一边区都要声明。
    setupAndZones: Array.isArray(module.manifest.zones.encounterDeck)
      && Array.isArray(module.manifest.zones.setAside)
      && zoneReport.encounterCards + zoneReport.declaredSetAsideCards > 0,
    actsAndAgendas: module.scenario.acts.length > 0 && module.scenario.agendas.length > 0
      && typeof module.behavior.actReveal === 'function'
      && typeof module.behavior.agendaReveal === 'function',
    locationsAndConnections: Object.keys(module.scenario.locations).length > 0
      && Object.values(module.scenario.locations).every(location =>
        Array.isArray(location.connections)
        && (location.connections.length > 0 || location.fromDeck === true || location.setAside === true
          || location.veiled === true || location.backCode != null)),
    // 敌人/诡计都有单卡条目、没有被标记 rulesPending 的卡；剧本参考卡/背面故事面不算。
    encounterBehaviors: encounterCodes.length > 0
      && Object.values(module.scenario.enemies).every(card => !card.rulesPending)
      && Object.values(module.scenario.treacheries).every(card => !card.rulesPending)
      && pendingEncounterCodes.length === 0,
    // P8 口径：逐卡等价核对属 P9，保持 false（路线图 §8.3）。
    literalCardBehavior: false,
    chaosEffects: typeof module.behavior.resolveChaosToken === 'function'
      || typeof module.behavior.afterTest === 'function'
      || module.scenario.tokenMeanings != null,
    resolutionsAndRecords: resolutionIds.length > 0
      && module.manifest.resolutionIds.length === resolutionIds.length
      && typeof module.behavior.resolution === 'function',
    storyText: !storyTextPending && Boolean(TDE_STORY_TEXT.chapters[chapter.id]?.status === 'translated'),
    saveReplay: Boolean(testRun?.ok) && testTitles.some(title => SAVE_REPLAY_TITLES.test(title)),
    browserAcceptance: browser.pass,
  }
  const structuralKeys = ['identityRegistered', 'setupAndZones', 'actsAndAgendas', 'locationsAndConnections',
    'encounterBehaviors', 'chaosEffects', 'resolutionsAndRecords', 'saveReplay']
  const structuralOk = structuralKeys.every(key => checks[key] === true) && coverage.uncovered.length === 0
  const status = structuralOk ? 'development' : 'pending'
  const remaining = []
  for (const key of structuralKeys) if (!checks[key]) remaining.push(`${chapter.id}：检查项 ${key} 未通过`)
  for (const code of coverage.uncovered) remaining.push(`${chapter.id}：遭遇记录 ${code} 尚未落地`)
  for (const gap of gaps) remaining.push(`${chapter.id}：${gap}`)
  for (const approximation of approximations) remaining.push(`${chapter.id}（近似实现）：${approximation}`)
  if (!checks.sourceLocked) remaining.push(`${chapter.id}：参考实现来源锁未通过（缺参考资源或哈希漂移）`)
  if (!checks.storyText) remaining.push(`${chapter.id}：剧情正文待 P8-T 自译（storyText pending）`)
  if (!checks.literalCardBehavior) remaining.push(`${chapter.id}：逐卡等价核对属 P9（literalCardBehavior=false）`)
  if (!checks.browserAcceptance) remaining.push(`${chapter.id}：浏览器验收属 P9（browserAcceptance=false）`)
  items.push({
    id: chapter.id,
    code: chapter.code,
    name: chapter.name,
    part: chapter.part,
    pair: chapter.pair,
    status,
    checks,
    intentionallyPending: ['literalCardBehavior', 'storyText', 'browserAcceptance'],
    notes: {
      testCoveredCodes: `${coveredCodes.length}/${encounterCodes.length}`,
      uncoveredCodes: encounterCodes.filter(code => !coveredCodes.includes(code)),
      storyText: { status: TDE_STORY_TEXT.meta.status, sourceKind: TDE_STORY_TEXT.meta.sourceKind, officialChinese: TDE_STORY_TEXT.meta.officialChinese },
      browser,
      veiled: veiledReport,
    },
    inventory: {
      locations: Object.keys(module.scenario.locations).length,
      veiledLocations: veiledReport.total,
      acts: module.scenario.acts.length,
      agendas: module.scenario.agendas.length,
      enemies: Object.keys(module.scenario.enemies).length,
      treacheries: Object.keys(module.scenario.treacheries).length,
      storyAssets: Object.keys(module.scenario.storyAssets || {}).length,
      storyFaces: Object.keys(module.scenario.storyFaces || {}).length,
      encounterCards: zoneReport.encounterCards,
      setAsideCards: zoneReport.declaredSetAsideCards,
      resolutions: resolutionIds,
      encounterCodes: encounterCodes.length,
      chapterRecords: coverage.records,
      chapterRecordsCovered: coverage.covered,
    },
    coverage,
    pendingEncounterCodes,
    gaps,
    approximations,
    testFile: testFileInfo.name,
    testCases: testRun ? { passed: testRun.titles.length, failed: testRun.failedTitles.length } : null,
    sources,
    commonSources: commonSources.filter(entry => entry.ok === false),
    fileHashes,
    remaining,
  })
}

// ---------------------------------------------------------------- remaining（计算，不硬编码）
const remaining = []
for (const item of items) remaining.push(...(item.remaining || []))
if (!existsSync(REFERENCE)) remaining.push('缺少参考实现目录，sourceLocked 无法核对')
if (!browserReport) remaining.push('P9：浏览器证据待补（audit/tde-browser-acceptance.json）')
if (storyTextPending) remaining.push('P8-T：中文剧情自译未开工（story-text.js status=pending）')

const totalRecords = items.reduce((sum, item) => sum + (item.coverage?.records || 0), 0)
const report = {
  schemaVersion: 1,
  campaignId: 'theDreamEaters',
  milestone: 'M3',
  generatedFrom: 'original-campaign-only',
  status: items.every(item => item.status !== 'pending') ? 'development' : 'pending',
  // P8 交付口径：章节 development；playable/verified 由 P9/P10 升。
  productionGate: 'development',
  summary: {
    chapters: items.length,
    verified: items.filter(item => item.status === 'verified').length,
    development: items.filter(item => item.status === 'development').length,
    pending: items.filter(item => item.status === 'pending').length,
    totalEncounterCards: items.reduce((sum, item) => sum + (item.inventory?.encounterCards || 0), 0),
    totalChapterRecords: totalRecords,
    coveredChapterRecords: items.reduce((sum, item) => sum + (item.coverage?.covered || 0), 0),
    pendingEncounterCards: items.reduce((sum, item) => sum + (item.pendingEncounterCodes?.length || 0), 0),
    gaps: items.reduce((sum, item) => sum + (item.gaps?.length || 0), 0),
    testCases: items.reduce((sum, item) => sum + (item.testCases?.passed || 0), 0),
    storyText: TDE_STORY_TEXT.meta.status,
    literalCardBehavior: false,
  },
  items,
  remaining,
}

const serialized = `${JSON.stringify(report, null, 2)}\n`
if (MODE === 'write') {
  await writeFile(LEDGER, serialized)
  await writeFile(LOCK, `${JSON.stringify(computeSourceLock(), null, 2)}\n`)
  console.log(`P8 scenario ledger written: ${report.summary.development}/${report.summary.chapters} 章 development；`
    + `${report.summary.pendingEncounterCards} 张遭遇卡待实现；${report.summary.gaps} 条显式简化；`
    + `记录覆盖 ${report.summary.coveredChapterRecords}/${report.summary.totalChapterRecords}；${report.remaining.length} 条 remaining`)
} else if (MODE === 'check') {
  const current = readFileSync(LEDGER, 'utf8')
  if (current !== serialized) throw new Error('食梦者逐章验收账本已漂移：重新 --write 并审阅 diff')
  console.log(`P8 scenario ledger OK: ${report.summary.development}/${report.summary.chapters} 章 development；`
    + `记录覆盖 ${report.summary.coveredChapterRecords}/${report.summary.totalChapterRecords}；${report.remaining.length} 条 remaining`)
} else {
  console.log(serialized)
}
process.exit(0)
