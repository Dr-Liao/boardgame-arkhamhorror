// 《地球边缘》（Edge of the Earth）P8 发布浏览器证据审计：把浏览器证据账本复核成
// audit/eote-release-acceptance.json。
//
// 输入（只读）：
//   · audit/eote-release-browser.json      —— P8 浏览器验收 runner/reporter 生成（另一 worker）；
//   · audit/eote-scenario-acceptance.json  —— 8 章逐章账本（P7 维护）；
//   · audit/eote-all-card-acceptance.json  —— 全卡逐卡账本（P8 另一 worker）；
//   · audit/eote-scope.json / audit/eote-node-acceptance.json / audit/eote-regression.json
//   · 生产组合根 content/registered.js     —— assertLaunchable / campaignListForUi 实时事实。
//
// 复核内容（任一不满足 → status=failed，退出码 1）：
//   1) launch：assertLaunchable('edgeOfTheEarth') 通过且 status=playable；campaignListForUi 可见、
//      earlyAccess=false、恰好 8 章；
//   2) chapters：逐章账本 8/8 verified；
//   3) 全卡：账本 gate complete（missing/blocked=0），三包分片 266/22/115、合计 403；
//   4) 浏览器：status=passed、complete=true、sourceStableDuringRun=true；specs 覆盖 expectedSpecs；
//      12 项 checks（release/progression/online/privacy/permission/disconnect × desktop/mobile）全真；
//   5) screenshots：逐张重新 stat + sha256（只信磁盘，不信账本自报）；每个 phase × 视口 ≥4、总 ≥20；
//   6) scope.cardImages：中英卡图库存 + 远程回退 + 375/102 + cycleCopies=false + 「不依赖参考资源」；
//   7) node/regression：status=passed 且 sourceStableDuringRun=true（fast 只允许 P0 基线既有的失败）；
//   8) guides：story-text 8 章 469 段、web/scenario-guides/ 8 个指南 json 存在；
//   9) 运行时目录（content/src/web）不出现「参考资源」import/路径（扫描并报告）。
//
// 输出刻意无时间戳/耗时/宿主信息：同一份证据 + 同一份源码跑同一命令得到逐字节相同结论（--check 可证）。
//
// 用法（在 games/arkhamhorror 下）：
//   node tools/audit-eote-release.mjs --write   # 写 audit/eote-release-acceptance.json
//   node tools/audit-eote-release.mjs --check   # 复算并与现有文件逐字节比较，漂移则退出码 1
//   node tools/audit-eote-release.mjs           # 只打印 JSON
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { MOD, WORKSPACE, RUN, json, sha, readJson, writeJson } from './eote-migration-lib.mjs'
import { contentRegistry } from '../content/registered.js'
import { campaignListForUi } from '../content/registry.js'
import { chapters } from '../content/campaigns/edgeOfTheEarth/shared.js'
import { EOTE_STORY_META, EOTE_STORY_TEXT } from '../content/campaigns/edgeOfTheEarth/story-text.js'

const CAMPAIGN_ID = 'edgeOfTheEarth'
const SELF = fileURLToPath(import.meta.url)
const REPORT = join(MOD, 'audit/eote-release-acceptance.json')
const BROWSER_LEDGER = 'audit/eote-release-browser.json'
const SCENARIO_LEDGER = 'audit/eote-scenario-acceptance.json'
const ALL_CARD_LEDGER = 'audit/eote-all-card-acceptance.json'
const SCOPE_LEDGER = 'audit/eote-scope.json'
const NODE_LEDGER = 'audit/eote-node-acceptance.json'
const REGRESSION_LEDGER = 'audit/eote-regression.json'
const BASELINE_LEDGER = 'audit/eote-baseline.json'
const CHAPTER_IDS = Object.freeze(chapters.map(chapter => chapter.id))
const CHECK_GROUPS = Object.freeze([
  ['release', 'release'],
  ['progression', 'progression'],
  ['online', 'online'],
  ['privacy', 'privacy'],
  ['permission', 'permission'],
  ['disconnect', 'disconnect'],
])
const REQUIRED_KEYS = Object.freeze(CHECK_GROUPS.flatMap(([group]) =>
  [`${group}Desktop`, `${group}Mobile`]))
// TIC P8 同口径：release/online/progression 三个 phase 各视口至少 4 张；任意其它 phase 同样要求
// 双视口各 ≥4 张（screenshots 账本一旦出现该 phase 就必须有双端证据）。
const MIN_SHOTS_BY_PHASE = Object.freeze({ release: 4, progression: 4, online: 4 })
const MIN_SHOTS_TOTAL = 20
const EXPECTED_GUIDES = Object.freeze(CHAPTER_IDS.map(id => `web/scenario-guides/${id}.json`))
const EXPECTED_SECTIONS = 469
const EXPECTED_CARD_IMAGES = Object.freeze({
  english: 'web/img/cards/',
  chinese: 'web/img/zh/cards/',
  remoteFallback: Object.freeze(['imagesrc', 'backimagesrc']),
  cycleCopies: false,
  recordsWithRemoteImage: 375,
  recordsWithBackRemoteImage: 102,
  noteIncludes: '不依赖参考资源',
})
const SOURCE_EXTENSIONS = /\.(?:js|mjs|cjs|json|html|css|txt|md)$/i
const DEFERRED = Object.freeze([
  Object.freeze({
    id: 'victoryEpilogue',
    reason: '浏览器证据覆盖第一章→幕间升级→第二章→最终章失败结局（campaignResult）；胜利尾声逐段叙事由 Node 战役验收（tests/eote-campaign-flow.test.mjs）覆盖。',
    evidence: ['tests/eote-scenario-theHeartOfMadnessPart2.test.mjs', 'tests/eote-campaign-flow.test.mjs'],
  }),
  Object.freeze({
    id: 'manualUpgradePurchase',
    reason: '关间升级窗验证了真实 hubAutoUpgrade；hubPurchase 手动选择由 Node 战役流验收与既有 TIC 浏览器证据覆盖。',
    evidence: ['tests/eote-campaign-flow.test.mjs', 'audit/eote-scenario-acceptance.json'],
  }),
  Object.freeze({
    id: 'relayReconnect',
    reason: '联机断线恢复验证到页面重开 + 真实会话版本号/手牌隐私一致；中转服务级断线重连由大厅通用联机回归覆盖。',
    evidence: ['tests/eote-scenarios.browser.mjs', BROWSER_LEDGER],
  }),
  Object.freeze({
    id: 'pendingPrimitiveRequests',
    reason: 'P7 原语请求仍为 pending：卡片以已披露近似实现，逐条列在 audit/eote-migration.json 的 releaseAcceptance.deferred（P8 发布账本不把近似声明为等价）。',
    evidence: ['artifacts/migration/eote/primitive-requests/', 'audit/eote-migration.json'],
  }),
])

const fileHash = path => {
  const absolute = join(MOD, path)
  return existsSync(absolute) ? sha(readFileSync(absolute)) : null
}
const optionalJson = path => {
  const absolute = join(MOD, path)
  if (!existsSync(absolute)) return null
  try {
    return JSON.parse(readFileSync(absolute, 'utf8').replace(/^\uFEFF/, ''))
  } catch {
    return null
  }
}
const num = value => (Number.isFinite(value) ? value : 0)
const bool = value => value === true
const sorted = list => [...list].sort((left, right) => String(left).localeCompare(String(right)))

/** 逐项检查 12 项浏览器 checks；兼容 TIC 形状（privacy/permission/disconnect 扁平）与 eote 期望形状。 */
function checkValue(checks, group, viewport) {
  const direct = checks?.[group]
  if (direct && typeof direct === 'object' && !Array.isArray(direct)) return direct[viewport] === true
  const flatKey = `${group}${viewport[0].toUpperCase()}${viewport.slice(1)}`
  if (typeof checks?.[flatKey] === 'boolean') return checks[flatKey]
  // permission/disconnect 在 TIC 口径是单布尔（对两种视口都算通过）；eote 明确要求双端时可写嵌套。
  if (typeof direct === 'boolean') return direct
  const aliases = {
    permission: ['permission', 'permissionBoundary', 'permissionDesktop', 'permissionMobile'],
    disconnect: ['disconnect', 'disconnectRecovery', 'disconnectDesktop', 'disconnectMobile'],
  }
  for (const key of aliases[group] || []) {
    if (typeof checks?.[key] === 'boolean') return checks[key]
  }
  return false
}

function inferViewport(path) {
  const match = /(desktop|mobile)/i.exec(path || '')
  return match ? match[1].toLowerCase() : null
}
function inferPhase(path) {
  const normalized = String(path || '').toLowerCase()
  const found = ['release', 'progression', 'online', 'privacy', 'permission', 'disconnect']
    .find(phase => normalized.includes(phase))
  return found || null
}

function scanRuntimeReferencePaths() {
  const walk = dir => readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory()
    ? walk(join(dir, entry.name)) : [join(dir, entry.name)])
  const importLike = /import\s*(?:[^'"]*from\s*)?\(?\s*['"][^'"]*参考资源|require\s*\(\s*['"][^'"]*参考资源/
  const fsUse = /\b(?:readFileSync|readFile|statSync|existsSync|join|resolve|readdirSync|readJson|sourceLock)\s*\([^)]*参考资源/
  const allMentions = []
  const runtimeReferences = []
  const provenanceMentions = []
  const commentMentions = []
  for (const dir of ['content', 'src', 'web']) {
    const root = join(MOD, dir)
    if (!existsSync(root)) continue
    for (const file of walk(root)) {
      if (!SOURCE_EXTENSIONS.test(file)) continue
      const relativePath = relative(MOD, file).replaceAll('\\', '/')
      const lines = readFileSync(file, 'utf8').split(/\r?\n/)
      for (const line of lines) {
        if (!line.includes('参考资源')) continue
        allMentions.push(relativePath)
        const trimmed = line.trim()
        if (importLike.test(line) || fsUse.test(line)) runtimeReferences.push(relativePath)
        else if (/^(?:\/\/|\*|\/\*|#|>|-)/.test(trimmed)) commentMentions.push(relativePath)
        else provenanceMentions.push(relativePath)
      }
    }
  }
  return {
    scanned: ['content', 'src', 'web'],
    mentionFiles: sorted([...new Set(allMentions)]),
    runtimeReferences: sorted([...new Set(runtimeReferences)]),
    provenanceMentions: sorted([...new Set(provenanceMentions)]),
    commentMentions: sorted([...new Set(commentMentions)]),
  }
}

function cardImageChecks() {
  const scope = optionalJson(SCOPE_LEDGER)
  const images = scope?.cardImages || null
  const checks = {
    scopeLedger: Boolean(scope),
    english: images?.english === EXPECTED_CARD_IMAGES.english,
    chinese: images?.chinese === EXPECTED_CARD_IMAGES.chinese,
    remoteFallback: Array.isArray(images?.remoteFallback)
      && json(images.remoteFallback) === json([...EXPECTED_CARD_IMAGES.remoteFallback]),
    cycleCopies: images?.cycleCopies === EXPECTED_CARD_IMAGES.cycleCopies,
    recordsWithRemoteImage: images?.recordsWithRemoteImage === EXPECTED_CARD_IMAGES.recordsWithRemoteImage,
    recordsWithBackRemoteImage: images?.recordsWithBackRemoteImage === EXPECTED_CARD_IMAGES.recordsWithBackRemoteImage,
    note: String(images?.note || '').includes(EXPECTED_CARD_IMAGES.noteIncludes),
  }
  return {
    path: SCOPE_LEDGER,
    sha256: fileHash(SCOPE_LEDGER),
    english: images?.english ?? null,
    chinese: images?.chinese ?? null,
    remoteFallback: images?.remoteFallback ?? null,
    cycleCopies: images?.cycleCopies ?? null,
    recordsWithRemoteImage: images?.recordsWithRemoteImage ?? null,
    recordsWithBackRemoteImage: images?.recordsWithBackRemoteImage ?? null,
    note: images?.note ?? null,
    checks,
    pass: Object.values(checks).every(Boolean),
  }
}

function guideChecks() {
  const chapterIds = Object.keys(EOTE_STORY_TEXT.chapters || {})
  const sectionCount = Object.values(EOTE_STORY_TEXT.chapters || {})
    .reduce((sum, chapter) => sum + num(chapter.sectionCount), 0)
  const guideFiles = EXPECTED_GUIDES.map(path => ({ path, exists: existsSync(join(MOD, path)) }))
  const chinese = EOTE_STORY_META?.chinese || {}
  const facts = {
    storyStatus: EOTE_STORY_META?.status ?? null,
    chapters: chapterIds.length,
    chapterIds: sorted(chapterIds),
    sectionCount,
    guides: guideFiles.length,
    missingGuides: guideFiles.filter(entry => !entry.exists).map(entry => entry.path),
    chinese: {
      total: num(chinese.total),
      presentNeedsReview: num(chinese.presentNeedsReview ?? chinese.present),
      untranslated: num(chinese.untranslated),
      missing: num(chinese.missing),
    },
  }
  const checks = {
    eightChapters: chapterIds.length === CHAPTER_IDS.length
      && CHAPTER_IDS.every(id => chapterIds.includes(id)),
    sections: sectionCount === EXPECTED_SECTIONS,
    guides: guideFiles.every(entry => entry.exists),
    chineseMarked: facts.chinese.total === sectionCount
      && facts.chinese.presentNeedsReview + facts.chinese.untranslated + facts.chinese.missing === sectionCount,
  }
  return {
    ...facts,
    checks,
    storyFile: 'content/campaigns/edgeOfTheEarth/story-text.js',
    storySha256: fileHash('content/campaigns/edgeOfTheEarth/story-text.js'),
    pass: Object.values(checks).every(Boolean),
  }
}

function nodeLedgerChecks() {
  const node = optionalJson(NODE_LEDGER)
  const regression = optionalJson(REGRESSION_LEDGER)
  const baseline = optionalJson(BASELINE_LEDGER)
  const knownFastFailures = Array.isArray(baseline?.fastFailures) ? baseline.fastFailures : []
  const nodeSummary = node?.summary || {}
  const fastFailures = Array.isArray(regression?.fast?.failures) ? regression.fast.failures : []
  const unknownFastFailures = fastFailures.filter(failure => !knownFastFailures.includes(failure))
  const checks = {
    nodeLedger: Boolean(node),
    nodeStatus: node?.status === 'passed',
    nodeSourceStable: node?.sourceStableDuringRun === true,
    nodeExitCode: node?.exitCode === 0,
    nodeFailures: num(nodeSummary.fail) === 0,
    nodeTests: num(nodeSummary.tests) > 0,
    regressionLedger: Boolean(regression),
    regressionStatus: regression?.status === 'passed',
    regressionSourceStable: regression?.sourceStableDuringRun === true,
    replayMatches: regression?.replay?.matches === true && regression?.replay?.exitCode === 0,
    fastKnownFailuresOnly: unknownFastFailures.length === 0,
  }
  return {
    node: {
      path: NODE_LEDGER, status: node?.status ?? null,
      sourceStableDuringRun: node?.sourceStableDuringRun ?? null,
      tests: num(nodeSummary.tests), pass: num(nodeSummary.pass), fail: num(nodeSummary.fail),
      command: node?.command ?? null,
    },
    regression: {
      path: REGRESSION_LEDGER, status: regression?.status ?? null,
      sourceStableDuringRun: regression?.sourceStableDuringRun ?? null,
      replay: regression?.replay ?? null,
      fast: regression?.fast ? {
        exitCode: regression.fast.exitCode ?? null,
        summary: regression.fast.summary ?? null,
        failures: fastFailures,
        knownFailures: knownFastFailures,
        unknownFailures: unknownFastFailures,
      } : null,
    },
    checks,
    pass: Object.values(checks).every(Boolean),
  }
}

function allCardGate(ledger) {
  const summary = ledger?.summary || {}
  const partitions = summary.partitions || summary.packs || {}
  const pick = (...keys) => {
    for (const key of keys) {
      const value = partitions?.[key]
      if (Number.isFinite(value)) return value
      if (value && typeof value === 'object' && Number.isFinite(value.total)) return value.total
    }
    return null
  }
  const campaign = pick('eoteCampaign', 'campaign', 'campaignCards')
  const investigators = pick('eoteInvestigators', 'investigator', 'investigators', 'investigatorCards')
  const player = pick('eotePlayer', 'player', 'playerCards')
  const missing = num(summary.missing)
  const blocked = num(summary.blocked)
  const total = num(summary.total)
  const gateComplete = summary.gateComplete === true || ledger?.gate?.pass === true
    || ['verified', 'complete', 'passed'].includes(String(ledger?.status))
    || ledger?.gate?.complete === true
  const countsOk = campaign === 266 && investigators === 22 && player === 115
    && campaign + investigators + player === 403
  const checks = {
    ledger: Boolean(ledger),
    gateComplete,
    missing: missing === 0,
    blocked: blocked === 0,
    total: total === 403,
    partitions: countsOk,
  }
  return {
    path: ALL_CARD_LEDGER,
    hasLedger: Boolean(ledger),
    sha256: fileHash(ALL_CARD_LEDGER),
    generatedBy: ledger?.generatedBy ?? null,
    status: ledger?.status ?? null,
    summary: {
      total, verified: num(summary.verified), missing, blocked,
      simplified: num(summary.simplified),
      campaign, investigators, player,
    },
    checks,
    pass: Object.values(checks).every(Boolean),
  }
}

export function buildReleaseAcceptance(options = {}) {
  // ---------------------------------------------------------------- 生产事实
  const missingInputs = []
  let launch = { launchable: false, id: null, status: null, error: null }
  try {
    const campaign = contentRegistry.assertLaunchable(CAMPAIGN_ID)
    launch = { launchable: campaign?.id === CAMPAIGN_ID, id: campaign?.id || null,
      status: campaign?.status || null, error: null }
  } catch (error) {
    launch.error = String(error?.message || error)
  }
  const lobby = (() => {
    try {
      const row = campaignListForUi(contentRegistry).find(campaign => campaign.id === CAMPAIGN_ID)
      return row ? { visible: true, status: row.status, earlyAccess: row.earlyAccess,
        scenarios: (row.scenarios || []).map(scenario => scenario.id) } : { visible: false }
    } catch (error) {
      return { visible: false, error: String(error?.message || error) }
    }
  })()

  // ---------------------------------------------------------------- 逐章账本
  const scenarioLedger = optionalJson(SCENARIO_LEDGER)
  if (!scenarioLedger) missingInputs.push(SCENARIO_LEDGER)
  const scenarioItems = Array.isArray(scenarioLedger?.chapters) ? scenarioLedger.chapters : []
  const chapterRows = chapters.map(chapter => {
    const item = scenarioItems.find(entry => entry.id === chapter.id) || null
    return { id: chapter.id, code: chapter.code, name: chapter.name,
      status: item?.status || null, verified: item?.status === 'verified' }
  })
  const chaptersOk = chapterRows.length === CHAPTER_IDS.length && chapterRows.every(row => row.verified)

  // ---------------------------------------------------------------- 浏览器账本
  const ledger = options.browserLedger ?? optionalJson(BROWSER_LEDGER)
  if (!ledger) missingInputs.push(BROWSER_LEDGER)
  const checks = ledger?.checks || {}
  const requiredChecks = Object.fromEntries(REQUIRED_KEYS.map(key => {
    const group = CHECK_GROUPS.map(([name]) => name).find(name => key.startsWith(name))
    const viewport = key.endsWith('Desktop') ? 'desktop' : 'mobile'
    return [key, checkValue(checks, group, viewport)]
  }))
  const ledgerTests = Array.isArray(ledger?.tests) ? ledger.tests : []
  const expectedSpecs = Array.isArray(ledger?.expectedSpecs) ? ledger.expectedSpecs : []
  const specs = Array.isArray(ledger?.specs) ? ledger.specs : []
  const ledgerTestsPassed = ledgerTests.length === 0 || ledgerTests.every(test => test.status === 'passed')
  const specsCovered = expectedSpecs.length === 0
    || (expectedSpecs.every(spec => specs.includes(spec)) && specs.length === expectedSpecs.length)
  const sourceFiles = Array.isArray(ledger?.sourceFiles) ? ledger.sourceFiles
    : ledger?.sourceFiles && typeof ledger.sourceFiles === 'object' ? Object.keys(ledger.sourceFiles) : []
  const expectedTests = Number.isFinite(ledger?.expectedTests) ? ledger.expectedTests : null
  const blockedEntries = Array.isArray(ledger?.blocked) ? ledger.blocked : []
  const bannerOk = ledger?.status === 'passed' && ledger?.complete === true
    && ledger?.sourceStableDuringRun === true && specsCovered && ledgerTestsPassed
    && (expectedTests === null || ledgerTests.length === expectedTests)
    && blockedEntries.length === 0 && sourceFiles.length > 0

  // ---------------------------------------------------------------- 截图（只信磁盘）
  const screenshots = sorted((Array.isArray(ledger?.screenshots) ? ledger.screenshots : []).map(raw => {
    const record = typeof raw === 'string' ? { path: raw } : { ...raw }
    const path = String(record.path || '').replaceAll('\\', '/')
    const absolute = join(WORKSPACE, path)
    const exists = Boolean(path) && existsSync(absolute)
    const bytes = exists ? statSync(absolute).size : null
    const sha256 = exists ? sha(readFileSync(absolute)) : null
    const declaredBytes = Number.isFinite(record.bytes) ? record.bytes : null
    const declaredSha = typeof record.sha256 === 'string' ? record.sha256 : null
    const hashMatches = exists && (declaredSha === null || declaredSha === sha256)
      && (declaredBytes === null || declaredBytes === bytes)
    return {
      path,
      phase: record.phase || inferPhase(path),
      viewport: record.viewport || inferViewport(path),
      exists,
      bytes,
      sha256,
      declaredSha256: declaredSha,
      declaredBytes,
      hashMatches,
    }
  }), shot => shot.path) // 先按 path 排序，保证账本逐字节确定性
  const screenshotRows = screenshots.filter(shot => shot.exists && shot.hashMatches)
  const unclassified = screenshotRows.filter(shot => !shot.phase || !shot.viewport)
  const phases = sorted([...new Set(screenshotRows.map(shot => shot.phase))])
  const phaseCounts = Object.fromEntries(phases.map(phase => [phase, {
    desktop: screenshotRows.filter(shot => shot.phase === phase && shot.viewport === 'desktop').length,
    mobile: screenshotRows.filter(shot => shot.phase === phase && shot.viewport === 'mobile').length,
  }]))
  const screenshotsOk = screenshots.length > 0
    && screenshots.every(shot => shot.exists && shot.hashMatches)
    && unclassified.length === 0
    && screenshotRows.length >= MIN_SHOTS_TOTAL
    && Object.entries(MIN_SHOTS_BY_PHASE).every(([phase, minimum]) =>
      phaseCounts[phase]?.desktop >= minimum && phaseCounts[phase]?.mobile >= minimum)
    && phases.every(phase => phaseCounts[phase].desktop >= 4 && phaseCounts[phase].mobile >= 4)

  // ---------------------------------------------------------------- 其余证据
  const allCards = allCardGate(options.allCardLedger ?? optionalJson(ALL_CARD_LEDGER))
  if (!allCards.hasLedger) missingInputs.push(ALL_CARD_LEDGER)
  const cardImages = cardImageChecks()
  const guides = guideChecks()
  const nodeLedger = nodeLedgerChecks()
  const scan = scanRuntimeReferencePaths()
  const runtimeChecks = {
    contentSrcWebScanned: scan.scanned.length === 3,
    noRuntimeReferences: scan.runtimeReferences.length === 0,
    provenanceMentionsAllowed: true,
  }

  // ---------------------------------------------------------------- 发布门禁
  const requiredChecksFull = {
    ...requiredChecks,
    launch: launch.launchable && launch.status === 'playable' && lobby.visible === true
      && lobby.earlyAccess === false && Array.isArray(lobby.scenarios)
      && lobby.scenarios.length === CHAPTER_IDS.length,
    chapters: chaptersOk,
    allCards: allCards.pass,
  }
  const missing = [
    ...REQUIRED_KEYS.filter(key => requiredChecksFull[key] !== true),
    ...(chaptersOk ? [] : ['chapters']),
    ...(allCards.pass ? [] : ['allCards']),
  ]
  const featureChecks = {
    campaign: requiredChecksFull.launch,
    chapters: chaptersOk,
    allCards: allCards.pass,
    browserBanner: bannerOk,
    browserChecks: REQUIRED_KEYS.every(key => requiredChecksFull[key] === true),
    screenshots: screenshotsOk,
    cardImages: cardImages.pass,
    nodeRegression: nodeLedger.pass,
    guides: guides.pass,
    runtimePaths: runtimeChecks.noRuntimeReferences,
  }
  const status = missingInputs.length === 0 && Object.values(featureChecks).every(Boolean) ? 'passed' : 'failed'

  const report = {
    schemaVersion: 1,
    campaignId: CAMPAIGN_ID,
    milestone: 'P8',
    generatedBy: 'node tools/audit-eote-release.mjs --write',
    status,
    evidence: {
      command: ledger?.evidenceCommand ?? null,
      browserLedger: BROWSER_LEDGER,
      scenarioLedger: SCENARIO_LEDGER,
      allCardLedger: ALL_CARD_LEDGER,
      scopeLedger: SCOPE_LEDGER,
      nodeLedger: NODE_LEDGER,
      regressionLedger: REGRESSION_LEDGER,
      acceptanceLedger: 'audit/eote-release-acceptance.json',
      screenshotRoot: ledger?.screenshotRoot ?? (screenshots[0]?.path ? screenshots[0].path.split('/').slice(0, -1).join('/') + '/' : null),
      missingInputs: sorted(missingInputs),
    },
    campaign: {
      launchable: launch.launchable,
      status: launch.status,
      launchError: launch.error,
      lobbyVisible: lobby.visible === true,
      earlyAccess: lobby.earlyAccess ?? null,
      scenarios: Array.isArray(lobby.scenarios) ? lobby.scenarios : [],
      scenarioCount: Array.isArray(lobby.scenarios) ? lobby.scenarios.length : 0,
      chapterCount: CHAPTER_IDS.length,
    },
    chapters: chapterRows,
    checks: requiredChecks,
    missing: sorted([...new Set(missing)]),
    browser: {
      ledger: BROWSER_LEDGER,
      status: ledger?.status ?? null,
      complete: ledger?.complete === true,
      sourceStableDuringRun: ledger?.sourceStableDuringRun === true,
      specs,
      expectedSpecs,
      tests: ledgerTests.length,
      expectedTests,
      testsPassed: ledgerTests.filter(test => test.status === 'passed').length,
      blocked: ledger?.blocked ?? null,
      checks,
      sourceFiles: sourceFiles.length,
      sourceFilesSha256: sourceFiles.length ? sha(json(sorted(sourceFiles))) : null,
    },
    screenshots: {
      total: screenshots.length,
      verified: screenshotRows.length,
      base: 'repo-root',
      minByPhase: MIN_SHOTS_BY_PHASE,
      byPhase: phaseCounts,
      existing: screenshots.filter(shot => shot.exists).length,
      unclassified: unclassified.map(shot => shot.path),
      missing: screenshots.filter(shot => !shot.exists).map(shot => shot.path),
      mismatched: screenshots.filter(shot => shot.exists && !shot.hashMatches).map(shot => shot.path),
    },
    allCards,
    cardImages,
    guides,
    nodeRegression: nodeLedger,
    runtimePaths: { scanned: scan.scanned, mentionFiles: scan.mentionFiles, runtimeReferences: scan.runtimeReferences, provenanceMentions: scan.provenanceMentions, commentMentions: scan.commentMentions, checks: runtimeChecks, pass: runtimeChecks.noRuntimeReferences },
    deferred: DEFERRED.map(entry => ({ ...entry, evidence: [...entry.evidence] })),
    sourceFiles: sourceFiles.length,
    featureChecks,
    // 行为等价认证口径（P0-11 诚实降级）：只有全卡账本逐卡证据完整（missing/blocked=0）才可宣称等价；
    // simplified 是「已披露近似」，不等于印刷等价。修复前的账本声称 verified，独立复核结论见 independentAudit。
    equivalence: {
      certified: allCards.pass,
      basis: '行为等价认证以全卡账本逐卡可追溯证据为准；simplified 仅表示已披露近似，不宣称规则等价。',
      allCards: allCards.summary,
      independentAudit: {
        report: 'docs/edgeOfTheEarth/eote-scan/全量扫描报告.md',
        sections: ['§3 P0-11', '§5', '§5.1'],
        priorLedgerClaim: '修复前本仓 P8 账本声称 all-cards verified（verified 375 / simplified 26、missing 0 / blocked 0、everyBehaviorCardHasEvidence=true）。',
        independentVerdict: '独立复核（player-b-verify §3）按字面口径复算 135/403 条证据不可追溯，其中 129 条 scenario-ledger 全部指向 theHeartOfMadnessPart2 且 0/129 含卡号，110 条卡号在任何 tests/*.test.mjs 中都不出现；该 verified 结论不成立。',
      },
    },
    gate: { pass: status === 'passed' },
  }
  return report
}

// ---------------------------------------------------------------- 写入 / 校验
function main() {
  const report = buildReleaseAcceptance()
  const args = process.argv.slice(2)
  if (args.includes('--write')) {
    writeJson(REPORT, report)
    writeJson(join(RUN, 'release-acceptance.json'), report)
    const checks = Object.entries(report.checks)
    const passed = checks.filter(([, value]) => value === true).length
    console.log(`eote release acceptance: 已写入 audit/eote-release-acceptance.json · ${report.status}`)
    console.log(`  checks ${passed}/${checks.length} · 截图 ${report.screenshots.verified}/${report.screenshots.total}`
      + ` · 章节 ${report.chapters.filter(row => row.verified).length}/${report.chapters.length}`
      + ` · 全卡 ${report.allCards.pass ? 'complete' : 'pending'}`)
    if (report.missing.length) console.log(`  未通过：${report.missing.join(', ')}`)
    if (report.evidence.missingInputs.length) console.log(`  缺失输入：${report.evidence.missingInputs.join(', ')}`)
  } else if (args.includes('--check')) {
    const expected = json(report)
    const current = existsSync(REPORT) ? readFileSync(REPORT, 'utf8') : ''
    if (current !== expected) {
      throw new Error('audit/eote-release-acceptance.json 漂移；复核证据/源码变化后显式 --write')
    }
    console.log(`eote release acceptance: 复算一致 · ${report.status}`)
  } else {
    console.log(json(report))
  }
  if (report.status !== 'passed') {
    console.error(`eote release acceptance 未通过：${report.missing.join(', ') || 'evidence/ledger/screenshot 校验失败'}`
      + (report.evidence.missingInputs.length ? `；缺失输入：${report.evidence.missingInputs.join(', ')}` : ''))
    process.exitCode = 1
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) main()
void SELF
