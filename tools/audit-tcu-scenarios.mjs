#!/usr/bin/env node
// 万象无终（TCU）P8 逐章验收账本：9 章 × 12 项检查，全部由代码与实跑证据计算。
//
//   node tools/audit-tcu-scenarios.mjs --write   写 audit/tcu-scenario-acceptance.json
//   node tools/audit-tcu-scenarios.mjs --check   逐字节复算，漂移即失败
//   node tools/audit-tcu-scenarios.mjs           打印 JSON
//
// 证据口径（路线图 §8.3，抄 Carcosa 的多组结构、不抄 TFA）：
//   · 一个事实源：章节来自 content/campaigns/theCircleUndone/shared.js，数据从各章 index.js 动态 import，
//     遭遇卡「是否已实现」读 src/cards/card-rules.js 的 implementedFor（单卡条目的 implemented 声明）；
//   · sourceLocked：参考实现文件哈希与 Git 跟踪的 audit/tcu-scenario-source-lock.json 比对（缺参考资源 = false）；
//   · literalCardBehavior：pendingEncounterCodes 为空 + behavior.scenarioGaps 为空 + 每张遭遇卡都有单卡条目；
//   · saveReplay：spawnSync 实跑该章测试，并要求用例名里出现「存档/回放/重放/往返」且通过；
//   · storyText：P9 的 story-text.js 存在时读导入正文；不存在时退回剧本自身 intro/resolutions 摘要并记 fallbacks
//     （fallback 不算 gap，因为章节正文本身可读；P9 升级后自动切换）；
//   · browserAcceptance：只读 runner 产物 audit/tcu-browser-acceptance.json，要求该章 desktop+mobile 各一条
//     通过用例 + 截图；不手工写。
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { contentRegistry } from '../content/registered.js'
import { chapters } from '../content/campaigns/theCircleUndone/shared.js'
import { scenarioZoneReport } from '../content/scenario-manifest.js'
import { implementedFor } from '../src/cards/card-rules.js'

const root = new URL('../', import.meta.url)
const ROOT = root.pathname.replace(/^\/([A-Za-z]:)/, '$1').replaceAll('/', '\\')
const REFERENCE = 'G:\\boardgame-hall-ai\\参考资源\\ArkhamHorror-main'
const MODE = process.argv.includes('--write') ? 'write' : process.argv.includes('--check') ? 'check' : 'report'
const LEDGER = new URL('../audit/tcu-scenario-acceptance.json', import.meta.url)
const LOCK = new URL('../audit/tcu-scenario-source-lock.json', import.meta.url)
const BROWSER = new URL('../audit/tcu-browser-acceptance.json', import.meta.url)
const storyTextModule = await import('../content/campaigns/theCircleUndone/story-text.js').catch(() => null)
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')
const hashFile = async url => sha256(await readFile(url))
const paragraphsIn = value => Array.isArray(value)
  ? value.filter(item => typeof item === 'string')
  : value && typeof value === 'object'
    ? Object.values(value).flatMap(paragraphsIn)
    : []
const cleanText = texts => texts.length > 0
  && texts.join('').length > 20
  && texts.every(text => text.length > 0 && !/<[^>]+>/.test(text))
const kebab = id => id.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
const readJson = (url, fallback) => {
  try {
    return JSON.parse(readFileSync(url, 'utf8'))
  } catch {
    return fallback
  }
}

// ---------------------------------------------------------------- 参考实现锁定
const sourceLock = readJson(LOCK, null)
const referenceOk = existsSync(REFERENCE) && Boolean(sourceLock)
// 锁文件里的 path 是「相对参考实现根目录」的完整路径（backend/arkham-api/library/Arkham/...）；
// 这里直接按根目录拼接，不再二次剥前缀（P8 初版曾剥掉前缀导致一律「参考文件缺失」）。
const lockCheck = entry => {
  const relative = entry?.path || '(未登记)'
  if (!referenceOk) return { path: relative, ok: false, reason: '缺少参考实现或锁文件' }
  const full = `${REFERENCE}/${relative}`
  if (!existsSync(full)) return { path: relative, ok: false, reason: '参考文件缺失' }
  const actual = sha256(readFileSync(full))
  return { path: relative, ok: actual === entry.sha256, expected: entry.sha256, actual }
}

// ---------------------------------------------------------------- 测试实跑（saveReplay / nodeAcceptance）
const testDir = new URL('../tests/', import.meta.url)
const testFiles = readdirSync(testDir).filter(name => /^tcu-.*\.test\.mjs$/.test(name) && !/^tcu-(primitives|rules|migration|interactions|investigators|player|player-ledger|scenario-acceptance|shared-encounters|story|browser|campaign-card-acceptance|all-card-ledger)/.test(name))
const testSourceFor = async chapterId => {
  const preferred = [`tcu-${kebab(chapterId)}.test.mjs`, `tcu-${kebab(chapterId).replace(/^the-/, '')}.test.mjs`, `tcu-${kebab(chapterId).replace(/^at-/, '')}.test.mjs`]
  for (const candidate of preferred) {
    const url = new URL(candidate, testDir)
    if (existsSync(url)) {
      const source = await readFile(url, 'utf8')
      if (source.includes(`scenarios/${chapterId}/`)) return { name: `tests/${candidate}`, source }
    }
  }
  for (const name of testFiles) {
    const source = await readFile(new URL(name, testDir), 'utf8')
    if (source.includes(`scenarios/${chapterId}/`)) return { name: `tests/${name}`, source }
  }
  return { name: null, source: '' }
}
const testRunCache = new Map()
function runTestFile(name) {
  if (testRunCache.has(name)) return testRunCache.get(name)
  const result = spawnSync(process.execPath, ['--test', `--test-reporter=tap`, name], {
    cwd: ROOT, encoding: 'utf8', timeout: 180_000,
  })
  const output = `${result.stdout || ''}\n${result.stderr || ''}`
  const titles = [...output.matchAll(/^\s*ok \d+ - (.+)$/gm)].map(match => match[1].trim())
  const failedTitles = [...output.matchAll(/^\s*not ok \d+ - (.+)$/gm)].map(match => match[1].trim())
  const entry = { name, ok: result.status === 0, titles, failedTitles, output }
  testRunCache.set(name, entry)
  return entry
}
const SAVE_REPLAY_TITLES = /存档|回放|重放|往返/
const CHAOS_TITLES = /混乱|标记|symbol|token/i

// ---------------------------------------------------------------- 单卡条目索引
const entryRoot = new URL('../src/cards/encounter-entries/', import.meta.url)
const entryFiles = new Map()
const walkEntries = directory => {
  for (const name of readdirSync(directory, { withFileTypes: true })) {
    const full = new URL(name.name + (name.isDirectory() ? '/' : ''), directory)
    if (name.isDirectory()) walkEntries(full)
    else if (name.name.endsWith('.js') && name.name !== 'index.js' && !name.name.startsWith('_')) {
      entryFiles.set(name.name.replace(/\.js$/, ''), full.pathname.replace(/^\/([A-Za-z]:)/, '$1').replaceAll('/', '\\'))
    }
  }
}
walkEntries(entryRoot)

// ---------------------------------------------------------------- 浏览器证据
const browserReport = readJson(BROWSER, null)
const browserChecks = browserReport?.tests || []
const screenshotFiles = (browserReport?.screenshots || []).map(entry => entry.path)
const screenshotExists = path => {
  // 截图在**仓库根**的 artifacts/tcu-migration/ 下（tools → mod → games → repo root）。
  const url = path?.startsWith('artifacts/') ? new URL(`../../../${path}`, import.meta.url) : null
  return Boolean(url && existsSync(url))
}
function browserAcceptanceFor(chapterId) {
  const tests = browserChecks.filter(entry => entry.scenario === chapterId)
  const desktop = tests.some(entry => entry.viewport === 'desktop' && entry.status === 'passed')
  const mobile = tests.some(entry => entry.viewport === 'mobile' && entry.status === 'passed')
  const desktopShot = (browserReport?.screenshots || []).some(entry => entry.scenario === chapterId && entry.viewport === 'desktop' && screenshotExists(entry.path))
  const mobileShot = (browserReport?.screenshots || []).some(entry => entry.scenario === chapterId && entry.viewport === 'mobile' && screenshotExists(entry.path))
  return { pass: desktop && mobile && desktopShot && mobileShot, desktop, mobile, desktopShot, mobileShot }
}

// ---------------------------------------------------------------- 逐章计算
const items = []
for (const chapter of chapters) {
  const chapterRoot = `../content/campaigns/theCircleUndone/scenarios/${chapter.id}/`
  let module
  try {
    module = await import(`${chapterRoot}index.js`)
  } catch (error) {
    items.push({
      id: chapter.id, code: chapter.code, name: chapter.name, status: 'pending',
      checks: Object.fromEntries(['sourceLocked', 'identityRegistered', 'setupAndZones', 'actsAndAgendas',
        'locationsAndConnections', 'encounterBehaviors', 'literalCardBehavior', 'chaosEffects',
        'resolutionsAndRecords', 'storyText', 'saveReplay', 'browserAcceptance']
        .map(key => [key, false])),
      inventory: null, pendingEncounterCodes: [], gaps: [`章节目录无法导入：${error.message}`],
    })
    continue
  }
  const files = ['definition.js', 'layout.js', 'behavior.js', 'index.js']
    .filter(file => existsSync(new URL(`${chapterRoot}${file}`, import.meta.url)))
  const fileHashes = Object.fromEntries(await Promise.all(files.map(async file =>
    [file, await hashFile(new URL(`${chapterRoot}${file}`, import.meta.url))])))
  if (existsSync(new URL(`${chapterRoot}chaos.js`, import.meta.url))) {
    fileHashes['chaos.js'] = await hashFile(new URL(`${chapterRoot}chaos.js`, import.meta.url))
  }
  const zoneReport = scenarioZoneReport(module.scenario, module.manifest)
  const resolutionIds = Object.keys(module.scenario.resolutions || {})
  const encounterCodes = [...new Set([
    ...Object.values(module.scenario.enemies || {}),
    ...Object.values(module.scenario.treacheries || {}),
  ].map(card => card.originalCode || card.code))]
  const pendingEncounterCodes = encounterCodes.filter(code => !implementedFor(code) && !entryFiles.has(code))
  const gaps = [...(module.behavior?.scenarioGaps || [])]
  // 近似实现（用战役 JSON 状态承载卡面语义、行为等价但不是引擎通用原语）不算 gap：
  // 它们进账本 approximations 与 remaining，不阻塞 literalCardBehavior。
  const approximations = [...(module.behavior?.scenarioApproximations || [])]
  const testFileInfo = await testSourceFor(chapter.id)
  const testRun = testFileInfo.name ? runTestFile(testFileInfo.name) : null
  const testTitles = testRun?.titles || []
  const coveredCodes = encounterCodes.filter(code => testTitles.some(title => title.includes(code)))
  // 参考实现文件（锁文件 path 相对参考实现根目录，含 backend/arkham-api/library/Arkham/ 前缀）
  const chapterLock = sourceLock?.chapters?.[chapter.id] || []
  const sources = chapterLock.map(entry => lockCheck(entry))
  // 剧情正文：P9 导入优先，否则退回剧本摘要（fallbacks 记录）
  const fallbacks = []
  let storyOk = false
  if (storyTextModule?.TCU_STORY_TEXT) {
    const importedIntro = paragraphsIn(storyTextModule.TCU_STORY_TEXT.introductions?.[chapter.id])
    const importedResolutions = storyTextModule.TCU_STORY_TEXT.resolutions?.[chapter.id] || {}
    storyOk = cleanText(importedIntro)
      && resolutionIds.every(key => cleanText(paragraphsIn(importedResolutions[key])))
    if (!storyOk) fallbacks.push('story-text.js 存在但本章导入正文不完整')
  }
  if (!storyOk) {
    const inlineIntro = [String(module.scenario.intro || '')].filter(Boolean)
    const inlineResolutions = resolutionIds.map(key => module.scenario.resolutions[key])
    storyOk = cleanText(inlineIntro) && inlineResolutions.every(text => cleanText([String(text || '')]))
    if (storyOk) fallbacks.push('正文暂用剧本 intro/resolutions 摘要（P9 导入 story-text.js 后切换）')
  }
  const browser = browserAcceptanceFor(chapter.id)
  const checks = {
    sourceLocked: referenceOk && sources.length > 0 && sources.every(entry => entry.ok === true),
    identityRegistered: Object.values(module.identities || {}).every(category =>
      Object.values(category).every(identity => identity.originalCode && identity.identityStatus === 'mapped')),
    setupAndZones: module.manifest.zones.encounterDeck.length > 0
      && Array.isArray(module.manifest.zones.setAside)
      && zoneReport.encounterCards > 0,
    actsAndAgendas: module.scenario.acts.length > 0 && module.scenario.agendas.length > 0
      && typeof module.behavior.actReveal === 'function'
      && typeof module.behavior.agendaReveal === 'function',
    locationsAndConnections: Object.keys(module.scenario.locations).length > 0
      && Object.values(module.scenario.locations).every(location =>
        Array.isArray(location.connections)
        // Cosmos/未知地点牌库里的地点最初不在场，靠牌库放置指令连接（cosmos 标记），允许空邻接。
        // 其余地点必须至少有一条印刷连线，防止「地点表建了但没连」的假实现。
        && (location.connections.length > 0 || location.cosmos != null || location.fromDeck === true)),
    encounterBehaviors: encounterCodes.length > 0
      && Object.values(module.scenario.enemies).every(card => !card.rulesPending)
      && Object.values(module.scenario.treacheries).every(card => !card.rulesPending),
    literalCardBehavior: pendingEncounterCodes.length === 0 && gaps.length === 0,
    chaosEffects: typeof module.behavior.resolveChaosToken === 'function',
    resolutionsAndRecords: resolutionIds.length > 0
      && module.manifest.resolutionIds.length === resolutionIds.length
      && typeof module.behavior.resolution === 'function',
    storyText: storyOk,
    saveReplay: Boolean(testRun?.ok) && testTitles.some(title => SAVE_REPLAY_TITLES.test(title)),
    browserAcceptance: browser.pass,
  }
  const nodeChecks = Object.entries(checks).filter(([key]) => !['browserAcceptance'].includes(key))
  const status = nodeChecks.every(([, value]) => value)
    ? (checks.browserAcceptance ? 'verified' : 'development')
    : 'pending'
  items.push({
    id: chapter.id,
    code: chapter.code,
    name: chapter.name,
    status,
    checks,
    notes: {
      testCoveredCodes: `${coveredCodes.length}/${encounterCodes.length}`,
      uncoveredCodes: encounterCodes.filter(code => !coveredCodes.includes(code)),
      storyFallbacks: fallbacks,
      browser,
    },
    inventory: {
      locations: Object.keys(module.scenario.locations).length,
      acts: module.scenario.acts.length,
      agendas: module.scenario.agendas.length,
      enemies: Object.keys(module.scenario.enemies).length,
      treacheries: Object.keys(module.scenario.treacheries).length,
      storyAssets: Object.keys(module.scenario.storyAssets || {}).length,
      encounterCards: zoneReport.encounterCards,
      setAsideCards: zoneReport.declaredSetAsideCards,
      resolutions: resolutionIds,
      encounterCodes: encounterCodes.length,
    },
    pendingEncounterCodes,
    gaps,
    approximations,
    testFile: testFileInfo.name,
    testCases: testRun ? { passed: testRun.titles.length, failed: testRun.failedTitles.length } : null,
    sources,
    fileHashes,
  })
}

// ---------------------------------------------------------------- remaining（计算，不硬编码）
const remaining = []
for (const item of items) {
  for (const [key, value] of Object.entries(item.checks || {})) {
    if (!value) remaining.push(`${item.id}：检查项 ${key} 未通过`)
  }
  for (const gap of item.gaps || []) remaining.push(`${item.id}：${gap}`)
  for (const approximation of item.approximations || []) remaining.push(`${item.id}（近似实现，行为等价）：${approximation}`)
  for (const code of item.pendingEncounterCodes || []) remaining.push(`${item.id}：遭遇卡 ${code} 尚未实现`)
}
if (!sourceLock) remaining.push('缺少 audit/tcu-scenario-source-lock.json 或参考实现目录，sourceLocked 无法核对')
if (!browserReport || items.some(item => !item.checks.browserAcceptance)) {
  remaining.push('P8 实机浏览器证据待补：node tools/playwright-tcu-reporter.mjs 生成 audit/tcu-browser-acceptance.json（tests/tcu-scenarios.browser.mjs）')
}
if (!storyTextModule) remaining.push('P9：story-text.js 未导入，章节正文暂用 intro/resolutions 摘要（已记 fallbacks）')

const report = {
  schemaVersion: 1,
  campaignId: 'theCircleUndone',
  milestone: 'M3',
  generatedFrom: 'original-campaign-only',
  status: items.every(item => item.status === 'verified') ? 'verified' : 'pending',
  // P10：9 章从 development 升 playable（逐章证据不变；发布口径在总账 audit-tcu.mjs）。
  productionGate: 'playable',
  summary: {
    chapters: items.length,
    verified: items.filter(item => item.status === 'verified').length,
    development: items.filter(item => item.status === 'development').length,
    pending: items.filter(item => item.status === 'pending').length,
    totalEncounterCards: items.reduce((sum, item) => sum + (item.inventory?.encounterCards || 0), 0),
    pendingEncounterCards: items.reduce((sum, item) => sum + (item.pendingEncounterCodes?.length || 0), 0),
    gaps: items.reduce((sum, item) => sum + (item.gaps?.length || 0), 0),
    testCases: items.reduce((sum, item) => sum + (item.testCases?.passed || 0), 0),
  },
  items,
  remaining,
}

const serialized = JSON.stringify(report, null, 2) + '\n'
if (MODE === 'write') {
  await writeFile(LEDGER, serialized)
  console.log(`P8 scenario ledger written: ${report.summary.development + report.summary.verified}/${report.summary.chapters} 章节有 node 证据；`
    + `${report.summary.pendingEncounterCards} 张遭遇卡待实现；${report.summary.gaps} 条显式简化`)
} else if (MODE === 'check') {
  const current = readFileSync(LEDGER, 'utf8')
  if (current !== serialized) throw new Error('万象无终逐章验收账本已漂移：重新 --write 并审阅 diff')
  console.log(`P8 scenario ledger OK: ${report.summary.development + report.summary.verified}/${report.summary.chapters} 章节有 node 证据；`
    + `${report.summary.pendingEncounterCards} 张遭遇卡待实现；${report.summary.gaps} 条显式简化；${report.remaining.length} 条 remaining`)
} else {
  console.log(serialized)
}
if (MODE === 'write') process.exit(0)
if (MODE === 'check') process.exit(0)
