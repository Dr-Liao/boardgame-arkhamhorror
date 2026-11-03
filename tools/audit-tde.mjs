#!/usr/bin/env node
// 食梦者（The Dream Eaters，第五循环）P10 发布账本：把「生产内容注册表 + M0 范围账本 + P3 原语/
// P4 关键词与规则书 / P6 调查员 / P7 玩家卡 / P8 剧本与剧情 / P9 全卡 / P9.5 双线」的真实事实
// 合成一份可复算的发布审计。
//
//   node tools/audit-tde.mjs --write    重写 audit/tde-migration.json
//   node tools/audit-tde.mjs --check    复算并逐字节比对（内容、判据或证据变化即失败）
//   node tools/audit-tde.mjs            打印账本 JSON（不落盘）
//
// 证据规则（路线图 §8.3 / tde-release.md §4，从 TFA 的坏账吸取）：
// - **一个事实源**：范围/卡数来自 content/packs/tde*/manifest.js 与 src/cards/cards-data.js，
//   关键词来自 content/campaigns/theDreamEaters/keywords.js，规则条目来自 web/rulebook-data.js，
//   第 1 步扫描来自 artifacts/migration/tde/mechanism-scan.json，章节/线/模式来自
//   content/campaigns/theDreamEaters/{shared,manifest}.js——本工具逐项重算，不读「已冻结的结论」再复制。
// - **Node 验收实跑**：spawnSync 执行一组 TDE 测试文件（spawn 时清掉 NODE_TEST_CONTEXT /
//   NODE_TEST_WORKER_ID），用 tools/core-test-reporter.mjs 的 test:pass / test:fail 事件计数，
//   不用 testSource.includes(...) 字符串匹配；账本只记命令、文件与计数，不记耗时/宿主信息。
// - **浏览器/逐章/全卡/双线证据由 runner 或各自审计工具生成**：只读 audit/tde-*.json，文件缺失或
//   不自洽时对应 gate 一律 false，不手工补数字。测试数/截图数/逐卡数从账本现读，不硬编码。
// - **remaining 由计算得出**：从 checks 为 false 的项、显式简化/原语请求/证据账本漂移、以及
//   P9.5 报告登记的并行幕间/尾声、联机与调试口径边界汇总；不把未完成写成完成。
// - **输出确定性**：不写时间戳、耗时、git head、本机路径；同一干净检出复跑应逐字节一致。
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { contentRegistry } from '../content/registered.js'
import { campaignListForUi } from '../content/registry.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { RULES, RULE_INDEX, cardRuleIds, ruleById } from '../web/rulebook-data.js'
import { UI_CARDS } from '../web/ui-cards.js'
import { supportedMechanics } from '../content/mechanics.js'
import { normalizeEpilogueMatrix } from '../src/campaign/epilogue-matrix.js'
import { canSelectInvestigator } from '../src/deck/availability.js'
import {
  CAMPAIGN_CARD_CODES, CAMPAIGN_FACE_CODES,
} from '../content/packs/tdeCampaign/manifest.js'
import {
  INVESTIGATOR_CARD_CODES,
} from '../content/packs/tdeInvestigators/manifest.js'
import {
  PLAYER_CARD_CODES, TDE_PLAYER_BUILDABLE_CODES, TDE_PLAYER_DEPENDENCY_CODES,
  TDE_PLAYER_BASIC_WEAKNESS_CODES,
} from '../content/packs/tdePlayer/manifest.js'
import { TDE_PLAYER_VERIFIED_CODES } from '../src/cards/tde-player-acceptance.js'
import {
  TDE_BAG_DIFFICULTIES, TDE_CHAOS_BAGS,
} from '../content/campaigns/theDreamEaters/tde-chaos.js'
import { RECORD_LABELS, recordTypes } from '../content/campaigns/theDreamEaters/record-labels.js'
import {
  ENCOUNTER_GROUP_IDS, INVESTIGATOR_CODES, MODES, PAIR_COUNT, PARTS, SHARED_ENCOUNTER_GROUPS,
  chapters,
} from '../content/campaigns/theDreamEaters/shared.js'
import {
  TDE_CHAOS_FACTS, TDE_KEYWORDS, TDE_RULE_IDS, TDE_SCANNED_KEYWORD_MECHANISMS,
} from '../content/campaigns/theDreamEaters/keywords.js'
import { TDE_INTERLUDE_IDS } from '../content/campaigns/theDreamEaters/interludes.js'

// ---------------------------------------------------------------- 常量

const CAMPAIGN_ID = 'theDreamEaters'
const PACK_IDS = ['tdeCampaign', 'tdeInvestigators', 'tdePlayer']
const SCOPE_PATH = 'artifacts/migration/tde/scope.json'
const MECHANISM_SCAN_PATH = 'artifacts/migration/tde/mechanism-scan.json'
const PRIMITIVE_PLAN_PATH = 'artifacts/migration/tde/primitive-plan.json'
const PRIMITIVE_CATALOG_PATH = 'artifacts/migration/tde/primitive-catalog.json'
const PRIMITIVE_REQUEST_DIR = 'artifacts/migration/tde/primitive-requests'
const BROWSER_PATH = 'audit/tde-browser-acceptance.json'
const BROWSER_CONFIG_PATH = 'tests/playwright/playwright.tde.config.mjs'
const RULES_LEDGER_PATH = 'audit/tde-rules.json'
const INVESTIGATOR_LEDGER_PATH = 'audit/tde-investigators.json'
const PLAYER_LEDGER_PATH = 'audit/tde-player-acceptance.json'
const SCENARIO_LEDGER_PATH = 'audit/tde-scenario-acceptance.json'
const SCENARIO_SOURCE_LOCK_PATH = 'audit/tde-scenario-source-lock.json'
const SCENARIO_TRIAGE_PATH = 'audit/tde-scenario-gap-triage.json'
const STORY_LEDGER_PATH = 'audit/tde-story-acceptance.json'
const ALL_CARD_LEDGER_PATH = 'audit/tde-all-card-acceptance.json'
const PARALLEL_LEDGER_PATH = 'audit/tde-parallel-acceptance.json'
const TARGET = new URL('../audit/tde-migration.json', import.meta.url)
const MODE = process.argv.includes('--write') ? 'write' : process.argv.includes('--check') ? 'check' : 'report'
const LAUNCHABLE = new Set(['playable', 'verified'])
// 逐章 12 项检查（P8/P9 口径，见 tools/audit-tde-scenarios.mjs）。
const SCENARIO_CHECK_KEYS = Object.freeze([
  'sourceLocked', 'identityRegistered', 'setupAndZones', 'actsAndAgendas', 'locationsAndConnections',
  'encounterBehaviors', 'literalCardBehavior', 'chaosEffects', 'resolutionsAndRecords', 'storyText',
  'saveReplay', 'browserAcceptance',
])
// P10 Node 验收实跑的文件集合：M4 规则书、M1 调查员、M2 玩家卡（4 分片 + 账本）、P9 全卡账本 +
// 283 例战役逐卡、P9 八章逐章证据。约 645 例、<10s（不跑 test:fast 全量）。
const TEST_FILES = Object.freeze([
  'tests/tde-completion-primitives.test.mjs',
  'tests/tde-completion.test.mjs',
  'tests/tde-rules.test.mjs',
  'tests/tde-investigators.test.mjs',
  'tests/tde-all-card-ledger.test.mjs',
  'tests/tde-campaign-card-acceptance.test.mjs',
  'tests/tde-player-m2-1.test.mjs',
  'tests/tde-player-m2-2.test.mjs',
  'tests/tde-player-m2-3.test.mjs',
  'tests/tde-player-m2-4.test.mjs',
  'tests/tde-player-ledger.test.mjs',
  'tests/tde-scenario-beyondTheGatesOfSleep.test.mjs',
  'tests/tde-scenario-wakingNightmare.test.mjs',
  'tests/tde-scenario-theSearchForKadath.test.mjs',
  'tests/tde-scenario-aThousandShapesOfHorror.test.mjs',
  'tests/tde-scenario-darkSideOfTheMoon.test.mjs',
  'tests/tde-scenario-pointOfNoReturn.test.mjs',
  'tests/tde-scenario-whereTheGodsDwell.test.mjs',
  'tests/tde-scenario-weaverOfTheCosmos.test.mjs',
])
const GAME_ROOT = fileURLToPath(new URL('../', import.meta.url))

// ---------------------------------------------------------------- 通用 IO（只读；确定性哈希）

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')
const urlOf = path => new URL(`../${path}`, import.meta.url)
const readBytes = path => (existsSync(urlOf(path)) ? readFileSync(urlOf(path)) : null)
const readText = path => {
  const bytes = readBytes(path)
  return bytes === null ? null : bytes.toString('utf8')
}
const fileHash = path => {
  const bytes = readBytes(path)
  return bytes === null ? null : sha256(bytes)
}
const readJson = path => {
  const text = readText(path)
  if (text === null) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}
// 证据账本里有的文件路径是「仓库根相对」（games/arkhamhorror/tests/...），转成游戏根相对再哈希。
const gameRelative = path => (typeof path === 'string' && path.startsWith('games/arkhamhorror/')
  ? path.slice('games/arkhamhorror/'.length)
  : path)
const sortedObject = entries => Object.fromEntries([...entries].sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0)))
const sameSet = (left, right) => left.length === right.length && left.every(item => right.includes(item))

// ---------------------------------------------------------------- Node 验收实跑（tests 字段 + nodeAcceptance）

// 从 `node --test` 里再 spawn `node --test` 时，继承的 NODE_TEST_CONTEXT 会让子进程走测试子进程
// 模式（输出格式不同）；NODE_TEST_WORKER_ID 同理。删掉后子进程与直接运行口径一致。
const testEnv = { ...process.env }
delete testEnv.NODE_TEST_CONTEXT
delete testEnv.NODE_TEST_WORKER_ID
const testRun = spawnSync(process.execPath, [
  '--test',
  '--test-reporter=./tools/core-test-reporter.mjs',
  ...TEST_FILES,
], {
  cwd: GAME_ROOT,
  env: testEnv,
  encoding: 'utf8',
  timeout: 180000,
  maxBuffer: 64 * 1024 * 1024,
})
const testEvents = []
for (const line of String(testRun.stdout || '').split(/\r?\n/)) {
  if (!line.trim()) continue
  try {
    const event = JSON.parse(line)
    if (event && typeof event === 'object') testEvents.push(event)
  } catch {
    // 非 JSON 行（理论上不应出现）忽略：计数只认 reporter 的 test:pass / test:fail 事件。
  }
}
const isRecordedPass = event => event.type === 'test:pass' && event.skipped !== true && event.todo !== true
const passedEvents = testEvents.filter(isRecordedPass)
const failedEvents = testEvents.filter(event => event.type === 'test:fail')
const basenameOf = event => {
  const file = typeof event.file === 'string' ? event.file.replaceAll('\\', '/') : ''
  return file ? file.split('/').pop() : null
}
const testsPerFile = Object.fromEntries(TEST_FILES.map(file => [file.split('/').pop(), { passed: 0, failed: 0 }]))
for (const event of testEvents) {
  const name = basenameOf(event)
  const entry = name ? testsPerFile[name] : null
  if (!entry) continue
  if (isRecordedPass(event)) entry.passed += 1
  else if (event.type === 'test:fail') entry.failed += 1
}
const missingTestFiles = TEST_FILES.filter(file => {
  const entry = testsPerFile[file.split('/').pop()]
  return !entry || entry.passed + entry.failed === 0
})
const testsCommand = `node --test --test-reporter=./tools/core-test-reporter.mjs ${TEST_FILES.join(' ')}`
const nodeTests = {
  command: testsCommand,
  files: [...TEST_FILES],
  status: testRun.status,
  tests: passedEvents.length + failedEvents.length,
  passed: passedEvents.length,
  failed: failedEvents.length,
  perFile: sortedObject(Object.entries(testsPerFile)),
  missingFiles: missingTestFiles,
  note: 'spawnSync 实跑；spawn 时删除 NODE_TEST_CONTEXT / NODE_TEST_WORKER_ID；计数只来自 '
    + 'tools/core-test-reporter.mjs 的 test:pass / test:fail 事件（账本不含耗时/宿主信息）。',
}
nodeTests.ok = testRun.status === 0 && nodeTests.failed === 0
  && nodeTests.tests > 0 && nodeTests.passed === nodeTests.tests && missingTestFiles.length === 0
const testFilePassed = file => {
  const entry = testsPerFile[file.split('/').pop()]
  return Boolean(entry) && entry.failed === 0 && entry.passed > 0
}
const testFilesPassed = files => files.every(testFilePassed)

// ---------------------------------------------------------------- 生产注册事实（P10）

const scope = readJson(SCOPE_PATH)
const scopeHash = fileHash(SCOPE_PATH)
const packs = PACK_IDS.map(id => {
  const pack = contentRegistry.getPack(id)
  const faces = id === 'tdeCampaign' ? CAMPAIGN_FACE_CODES.length
    : id === 'tdeInvestigators' ? (pack?.faceCodes || []).length
      : 0
  return {
    id,
    exists: Boolean(pack),
    status: pack?.status ?? null,
    cards: pack?.cards.length ?? 0,
    faces,
    records: (pack?.cards.length ?? 0) + faces,
    ranges: (pack?.cardRanges || []).map(range => `${range.from}-${range.to}`),
    encounterGroupIds: [...(pack?.encounterGroupIds || [])],
    rulesImplemented: (pack?.cards || []).filter(card => card.rulesImplemented).length,
    deckbuilding: (pack?.cards || []).filter(card => card.deckbuilding).length,
  }
})
const packOf = id => packs.find(pack => pack.id === id)
const campaign = contentRegistry.getCampaign(CAMPAIGN_ID)
let launchBlocked = false
let launchError = null
try {
  contentRegistry.assertLaunchable(CAMPAIGN_ID)
} catch (error) {
  launchBlocked = true
  launchError = error.message
}
const lobbyEntry = campaignListForUi(contentRegistry).find(item => item.id === CAMPAIGN_ID) || null
const lobbyVisible = Boolean(lobbyEntry)
const registryScenarios = contentRegistry.listScenarios(CAMPAIGN_ID)
const scenarioOf = id => registryScenarios.find(entry => entry.id === id) || null
// 章节可以引用核心/前循环的已登记遭遇组（chillingCold 等），所以合法组集合 = 战役与各章
// requiredPackIds 闭包里所有包登记的 encounterGroupIds。
const requiredPackClosure = new Set([...(campaign?.requiredPackIds || [])])
for (const scenario of registryScenarios) for (const packId of scenario.requiredPackIds || []) requiredPackClosure.add(packId)
const groupUniverse = new Set([...requiredPackClosure]
  .flatMap(packId => contentRegistry.getPack(packId)?.encounterGroupIds || []))
// 06 号段 = 食梦者全量印刷记录（352 主卡 + 36 关联面，来自 src/cards/cards-data.js 单一事实源）。
const TDE_CARD_ENTRIES = Object.entries(ALL_CARDS).filter(([code]) => /^06\d{3}[a-z]?$/.test(code))
const TDE_CARD_CODES = TDE_CARD_ENTRIES.map(([code]) => code)
const tdeMainCodes = TDE_CARD_CODES.filter(code => /^06\d{3}$/.test(code))
const tdeFaceCodes = TDE_CARD_CODES.filter(code => /^06\d{3}[a-z]$/.test(code))
const partsManifest = [...Object.values(PARTS)]
const pairs = [1, 2, 3, 4].map(pair => {
  const members = chapters.filter(chapter => chapter.pair === pair)
  return { pair, chapters: members.map(chapter => chapter.id), parts: [...new Set(members.map(chapter => chapter.part))] }
})
const partsWithChapters = partsManifest.map(part => ({
  id: part.id,
  name: part.name,
  nameEn: part.nameEn,
  chapters: chapters.filter(chapter => chapter.part === part.id).map(chapter => chapter.id),
}))
// 16 段尾声矩阵完整性：由 src/campaign/epilogue-matrix.js 的归一化校验器逐格复核（4×4 = 16）。
const epilogueNormalized = normalizeEpilogueMatrix(campaign?.epilogueMatrix ?? {})

// ---------------------------------------------------------------- 关键词与规则书（P4）

const scan = readJson(MECHANISM_SCAN_PATH)
const scanMechanisms = Array.isArray(scan?.mechanisms) ? scan.mechanisms : []
const scannedKeywordIds = scanMechanisms.filter(item => item.keyword).map(item => item.id).sort()
const keywordMechanismIds = TDE_KEYWORDS.map(keyword => keyword.mechanismId).sort()
const cardTextOf = card => [card?.text, card?.textZh, (card?.traits || []).join(' '), card?.slot].filter(Boolean).join('\n')
const ruleMentions = (rule, word) => Boolean(rule)
  && `${rule.title} ${rule.aliases.join(' ')} ${rule.body.join('')}`.toLowerCase().includes(String(word).toLowerCase())

const moduleCache = new Map()
async function loadModule(modulePath) {
  if (!moduleCache.has(modulePath)) moduleCache.set(modulePath, await import(`../${modulePath}`))
  return moduleCache.get(modulePath)
}
async function engineProblems(keyword) {
  const problems = []
  for (const entry of keyword.engine || []) {
    let module
    try {
      module = await loadModule(entry.module)
    } catch (error) {
      problems.push(`${entry.module} 无法 import：${error.message}`)
      continue
    }
    for (const name of entry.names || []) if (typeof module[name] !== 'function') problems.push(`${entry.module} 的 ${name} 不是函数`)
    for (const value of entry.values || []) {
      const actual = module[value.name]
      if (actual === undefined) problems.push(`${entry.module} 缺少导出 ${value.name}`)
      else if (typeof value.length === 'number' && actual.length !== value.length)
        problems.push(`${entry.module} 的 ${value.name} 长度应为 ${value.length}，实际 ${actual.length}`)
    }
  }
  return problems
}
const ruleIdSet = new Set(RULES.map(rule => rule.id))
const indexedRules = new Map(RULE_INDEX.map(rule => [rule.id, rule]))
const keywordItems = []
for (const keyword of TDE_KEYWORDS) {
  const rule = ruleById(keyword.ruleId)
  const pattern = new RegExp(keyword.pattern, 'i')
  // 1) 卡面来源：列出的每个卡号都必须在卡面 text/textZh/traits/slot 命中关键词判据。
  const sourceProblems = []
  if (!keyword.cardCodes.length) sourceProblems.push('没有列任何卡号')
  for (const code of keyword.cardCodes) {
    const card = ALL_CARDS[code]
    if (!card) sourceProblems.push(`卡号 ${code} 不存在`)
    else if (!pattern.test(cardTextOf(card))) sourceProblems.push(`${code} 的卡面没有印刷该关键词`)
  }
  // 2) 引擎行为：动态 import 模块并逐个检查导出/形状（不能只看源码里出现名字）。
  const engineProblemList = await engineProblems(keyword)
  // 3) 规则书条目：存在、在「食梦者」分组、正文够长、中文词形可搜、在拼音索引里。
  const ruleProblems = []
  if (!rule || rule.id !== keyword.ruleId) ruleProblems.push(`规则条目 ${keyword.ruleId} 不存在`)
  else {
    if (keyword.ruleOwned && rule.group !== '食梦者') ruleProblems.push(`${keyword.ruleId} 不在「食梦者」分组`)
    if (rule.body.join('').length < 80) ruleProblems.push(`${keyword.ruleId} 正文过短`)
    if (!ruleMentions(rule, keyword.zh)) ruleProblems.push(`${keyword.ruleId} 搜不到「${keyword.zh}」`)
    if (!indexedRules.has(keyword.ruleId)) ruleProblems.push(`${keyword.ruleId} 不在拼音索引里`)
  }
  // 4) 卡文直达：判据命中的 06 卡必须连到该条目（方向覆盖全部 388 条 06 记录）。
  const linkProblems = []
  for (const code of keyword.cardCodes) {
    const card = ALL_CARDS[code]
    if (card && !cardRuleIds(card).includes(keyword.ruleId)) linkProblems.push(`${code} 没有连到 ${keyword.ruleId}`)
  }
  for (const [code, card] of TDE_CARD_ENTRIES) {
    if (pattern.test(cardTextOf(card)) && !cardRuleIds(card).includes(keyword.ruleId))
      linkProblems.push(`${code} 卡面命中判据但没有连到 ${keyword.ruleId}`)
  }
  const checks = {
    sourceInventoried: sourceProblems.length === 0,
    engineBehavior: engineProblemList.length === 0,
    nodeAcceptance: testFilePassed('tests/tde-rules.test.mjs'),
    rulebookEntry: ruleProblems.length === 0,
    cardLinks: linkProblems.length === 0,
  }
  keywordItems.push({
    id: keyword.id,
    printed: keyword.printed,
    zh: keyword.zh,
    kind: keyword.kind,
    ruleId: keyword.ruleId,
    mechanismId: keyword.mechanismId,
    ruleOwned: keyword.ruleOwned,
    implemented: keyword.implemented !== false,
    deferred: [...(keyword.deferred || [])],
    sourceKind: keyword.sourceKind,
    cardCodes: [...keyword.cardCodes],
    checks,
    status: Object.values(checks).every(Boolean) ? 'verified' : 'pending',
    problems: [...sourceProblems, ...engineProblemList, ...ruleProblems, ...linkProblems],
  })
}
const keywordFailures = keywordItems.filter(item => item.status !== 'verified')
const keywordsStatus = keywordFailures.length === 0 ? 'verified' : 'pending'

const scanAlignment = {
  scanMechanisms: scannedKeywordIds,
  keywordMechanisms: keywordMechanismIds,
  missing: keywordMechanismIds.filter(id => !scannedKeywordIds.includes(id)),
  extra: scannedKeywordIds.filter(id => !keywordMechanismIds.includes(id)),
  ruleIdMismatch: TDE_KEYWORDS.filter(keyword => {
    const mechanism = scanMechanisms.find(item => item.id === keyword.mechanismId)
    return mechanism?.keyword?.ruleId !== keyword.ruleId
  }).map(keyword => keyword.id),
}
scanAlignment.pass = scanAlignment.missing.length === 0 && scanAlignment.extra.length === 0
  && scanAlignment.ruleIdMismatch.length === 0

// ---------------------------------------------------------------- 浏览器证据（runner 生成，只读）

const browserReport = readJson(BROWSER_PATH)
const browserConfigText = readText(BROWSER_CONFIG_PATH) || ''
// 期望 spec 集合从 tests/playwright/playwright.tde.config.mjs 的 testMatch 声明派生（不硬编码 7 这个数字）。
const expectedBrowserSpecs = [...new Set([...browserConfigText.matchAll(/['"](tde-[a-z0-9-]+\.browser\.mjs)['"]/g)]
  .map(match => `tests/${match[1]}`))].sort()
const browserSpecs = Array.isArray(browserReport?.specs) ? [...browserReport.specs] : []
const browserTests = Array.isArray(browserReport?.tests) ? browserReport.tests : []
const browserScreenshots = Array.isArray(browserReport?.screenshots) ? browserReport.screenshots : []
const browserScenarios = Array.isArray(browserReport?.scenarios) ? browserReport.scenarios : []
const browserSpecSet = new Set(browserSpecs)
const browserSpecsComplete = expectedBrowserSpecs.length > 0 && browserSpecs.length === expectedBrowserSpecs.length
  && expectedBrowserSpecs.every(spec => browserSpecSet.has(spec))
const browserPassedFor = viewport => browserTests.some(test => test.viewport === viewport && test.status === 'passed')
// 截图路径的 base 由 reporter 决定：'repo-root' 相对仓库根，缺省相对游戏根；必须真实落盘才算证据。
const browserShotExists = shot => {
  if (!shot || !shot.path) return false
  const base = shot.base === 'repo-root' ? '../../../' : '../'
  return existsSync(new URL(base + shot.path, import.meta.url))
}
const browserShotFor = viewport => browserScreenshots.some(shot => shot.viewport === viewport
  && shot.exists !== false && browserShotExists(shot))
const browserReleaseCheck = key => browserReport?.checks?.release?.[key] === true || browserReport?.release?.[key] === true
const browserMediaCheck = key => browserReport?.checks?.media?.[key] === true || browserReport?.media?.[key] === true
const browserChecks = {
  reportPresent: Boolean(browserReport),
  generatedByRunner: /playwright/i.test(String(browserReport?.generatedBy || '')),
  status: browserReport?.status ?? null,
  specs: browserSpecs,
  expectedSpecs: expectedBrowserSpecs,
  specsComplete: browserSpecsComplete,
  tests: browserTests.length,
  screenshots: browserScreenshots.filter(shot => shot.exists !== false && browserShotExists(shot)).length,
  scenarios: browserScenarios.length,
  scenariosCovered: browserScenarios.filter(item => item && item.desktop === true && item.mobile === true).length,
  desktop: browserReport?.checks?.desktopBrowser === true && browserPassedFor('desktop') && browserShotFor('desktop'),
  mobile: browserReport?.checks?.mobileBrowser === true && browserPassedFor('mobile') && browserShotFor('mobile'),
  release: { desktop: browserReleaseCheck('desktop'), mobile: browserReleaseCheck('mobile') },
  media: { desktop: browserMediaCheck('desktop'), mobile: browserMediaCheck('mobile') },
}
browserChecks.pass = browserChecks.reportPresent && browserChecks.generatedByRunner
  && browserChecks.status === 'passed' && browserChecks.specsComplete
  && browserChecks.desktop && browserChecks.mobile
  && browserChecks.release.desktop && browserChecks.release.mobile
  && browserChecks.media.desktop && browserChecks.media.mobile
  && browserChecks.tests > 0 && browserChecks.screenshots > 0
  && browserChecks.scenariosCovered === chapters.length

// ---------------------------------------------------------------- 规则书 6 项（P4，真实数据复算）

const tdeRulebookIds = new Set(TDE_RULE_IDS)
const tdeRulebookEntries = RULES.filter(rule => rule.group === '食梦者')
const missingRuleEntries = TDE_RULE_IDS.filter(id => !ruleIdSet.has(id))
const orphanTdeRules = tdeRulebookEntries.map(rule => rule.id).filter(id => !tdeRulebookIds.has(id))
const unindexedRuleIds = TDE_RULE_IDS.filter(id => !indexedRules.has(id))
const badRelated = TDE_RULE_IDS.flatMap(id => (ruleById(id)?.related || [])
  .filter(related => !ruleIdSet.has(related)).map(related => `${id}->${related}`))

// campaignOverview：只写规则本身（章节名、两条线、两套袋、章对/幕间、16 段尾声），不写实现/界面细节。
const campaignRule = ruleById('tdeCampaign')
const campaignBody = campaignRule && campaignRule.group === '食梦者' ? campaignRule.body.join('') : ''
const campaignOverviewChecks = {
  entryPresent: Boolean(campaignRule) && campaignRule.group === '食梦者',
  listsEveryChapter: chapters.every(chapter => campaignBody.includes(chapter.name)),
  statesTwoParts: Object.values(PARTS).every(part => campaignBody.includes(part.name) || campaignBody.includes(part.nameEn)),
  statesChaosBagSizes: campaignBody.includes('14、14、15、16') && campaignBody.includes('17、17、18、19'),
  statesPairAndInterlude: campaignBody.includes('章对') && campaignBody.includes('幕间'),
  statesEpilogueMatrix: campaignBody.includes('16 段尾声'),
  relatedRulesExist: (campaignRule?.related || []).every(id => ruleIdSet.has(id)),
  rulesOnly: !/本局|本 Mod|引擎|实现|界面|按钮|面板|拖动|点击|演出|存档|投影|原语|读点|接线|验收|审计|playable|earlyAccess|audit|src\/|content\/|behavior/.test(campaignBody),
}
// scenarioMechanics：8 张章节参考卡 + 线路条目 + 混乱符号 + 提示卡按线登记。
const rulebookChapterItems = chapters.map(chapter => {
  const card = ALL_CARDS[chapter.code] || null
  const ids = card ? cardRuleIds(card) : []
  const checks = {
    referenceCardExists: Boolean(card) && card.type === 'scenario',
    linksCampaignRule: ids.includes('tdeCampaign'),
    linksChaosRule: ids.includes('tdeChaos'),
    linksPartRule: ids.includes(chapter.part === 'A' ? 'tdeDreamQuest' : 'tdeWebOfDreams'),
    listedInUiCards: (UI_CARDS.rulebookReferences[chapter.part === 'A' ? 'tdeDreamQuestChapters' : 'tdeWebOfDreamsChapters'] || []).includes(chapter.code),
  }
  return { id: chapter.id, code: chapter.code, name: chapter.name, part: chapter.part, pair: chapter.pair, checks, status: Object.values(checks).every(Boolean) ? 'ok' : 'pending' }
})
const scenarioMechanicsChecks = {
  chapters: rulebookChapterItems.length,
  allChaptersOk: rulebookChapterItems.every(item => item.status === 'ok'),
  chapterCodesMatchShared: JSON.stringify(UI_CARDS.rulebookReferences.tdeDreamQuestChapters
    .concat(UI_CARDS.rulebookReferences.tdeWebOfDreamsChapters).sort())
    === JSON.stringify(chapters.map(chapter => chapter.code).sort()),
}
const keywordEntriesChecks = {
  entries: keywordItems.length,
  entriesPresent: keywordItems.every(item => ruleIdSet.has(item.ruleId)),
  searchable: keywordItems.every(item => ruleMentions(ruleById(item.ruleId), item.zh)),
  status: keywordsStatus,
}
const foreignLinks = []
const unlinkedCards = []
const SHARED_LINK_RULE_IDS = ['alert', 'hidden', 'script']
for (const [code, card] of TDE_CARD_ENTRIES) {
  const ids = cardRuleIds(card)
  if (!ids.length) unlinkedCards.push(code)
  for (const id of ids) if (!tdeRulebookIds.has(id) && !SHARED_LINK_RULE_IDS.includes(id)) foreignLinks.push(`${code}:${id}`)
}
const cardLinksChecks = {
  cards: TDE_CARD_ENTRIES.length,
  everyCardLinked: unlinkedCards.length === 0,
  noForeignCycleLinks: foreignLinks.length === 0,
  unlinkedCards,
  foreignLinks,
}
const rulebookChecks = {
  campaignOverview: Object.values(campaignOverviewChecks).every(Boolean),
  scenarioMechanics: Object.values(scenarioMechanicsChecks).every(Boolean),
  keywordEntries: Object.values(keywordEntriesChecks).every(Boolean),
  cardLinks: Object.values(cardLinksChecks).every(Boolean),
  desktopBrowser: browserChecks.desktop,
  mobileBrowser: browserChecks.mobile,
}
const rulebookStatus = Object.values(rulebookChecks).every(Boolean) ? 'verified' : 'pending'
const rulebookGate = {
  expected: TDE_RULE_IDS.length,
  present: TDE_RULE_IDS.length - missingRuleEntries.length,
  missing: missingRuleEntries,
  orphan: orphanTdeRules,
  unindexed: unindexedRuleIds,
  badRelated,
  pass: missingRuleEntries.length === 0 && orphanTdeRules.length === 0
    && unindexedRuleIds.length === 0 && badRelated.length === 0,
}

// ---------------------------------------------------------------- 逐章证据（P9 账本；P10 重生成后 status=verified）

const scenarioLedger = readJson(SCENARIO_LEDGER_PATH)
const scenarioSourceLock = readJson(SCENARIO_SOURCE_LOCK_PATH)
const scenarioTriage = readJson(SCENARIO_TRIAGE_PATH)
const scenarioItems = Array.isArray(scenarioLedger?.items) ? scenarioLedger.items : []
const scenarioItemOf = id => scenarioItems.find(item => item.id === id) || null
const scenarioLedgerFileHashesFresh = (() => {
  const checked = scenarioItems.flatMap(item => Object.entries(item.fileHashes || {}).map(([file, hash]) => {
    const actual = fileHash(`content/campaigns/theDreamEaters/scenarios/${item.id}/${file}`)
    return actual !== null && actual === hash
  }))
  return checked.length > 0 && checked.every(Boolean)
})()
const scenarioChecksAligned = scenarioItems.length === chapters.length && scenarioItems.every(item => {
  const chapter = chapters.find(candidate => candidate.id === item.id)
  return Boolean(chapter) && item.code === chapter.code && item.part === chapter.part && item.pair === chapter.pair
})
const scenarioRecords = scenarioItems.reduce((sum, item) => sum + Number(item.inventory?.chapterRecords || 0), 0)
const scenarioRecordsCovered = scenarioItems.reduce((sum, item) => sum + Number(item.inventory?.chapterRecordsCovered || 0), 0)
// 待实现遭遇卡以逐章账本 summary 为准（由 P8/P9 逐章工具实跑计算）；缺失时回退到逐章 notes。
const scenarioPendingCards = Number.isFinite(scenarioLedger?.summary?.pendingEncounterCards)
  ? scenarioLedger.summary.pendingEncounterCards
  : scenarioItems.reduce((sum, item) => sum + Number(item.notes?.literalCardBehavior?.missing?.length || 0), 0)
const scenarioTestFiles = scenarioItems.map(item => item.testFile).filter(Boolean)
const scenarioNodeEvidence = scenarioTestFiles.filter(file => testFilePassed(file)).length
const scenarioLedgerVerified = scenarioLedger?.status === 'verified'
const scenarioConfirmationChecks = {
  sourceLocked: scenarioItems.every(item => item.checks?.sourceLocked === true),
  identityRegistered: scenarioItems.every(item => item.checks?.identityRegistered === true),
  setupAndZones: scenarioItems.every(item => item.checks?.setupAndZones === true),
  actsAndAgendas: scenarioItems.every(item => item.checks?.actsAndAgendas === true),
  locationsAndConnections: scenarioItems.every(item => item.checks?.locationsAndConnections === true),
  encounterBehaviors: scenarioItems.every(item => item.checks?.encounterBehaviors === true),
  literalCardBehavior: scenarioItems.every(item => item.checks?.literalCardBehavior === true),
  chaosEffects: scenarioItems.every(item => item.checks?.chaosEffects === true),
  resolutionsAndRecords: scenarioItems.every(item => item.checks?.resolutionsAndRecords === true),
  storyText: scenarioItems.every(item => item.checks?.storyText === true),
  saveReplay: scenarioItems.every(item => item.checks?.saveReplay === true),
  browserAcceptance: scenarioItems.every(item => item.checks?.browserAcceptance === true),
  chapterIdentity: scenarioChecksAligned,
  recordsCovered: scenarioRecords === 253 && scenarioRecordsCovered === 253,
  pendingEncounterCards: scenarioPendingCards === 0,
  ledgerVerified: scenarioLedgerVerified,
  fileHashesFresh: scenarioLedgerFileHashesFresh,
  nodeAcceptance: scenarioNodeEvidence === chapters.length,
}
const scenarioConfirmationStatus = Object.values(scenarioConfirmationChecks).every(Boolean) ? 'verified' : 'pending'

// ---------------------------------------------------------------- 全卡证据（P9 账本；P10 由主进程重生成）

const allCardLedger = readJson(ALL_CARD_LEDGER_PATH)
const allCardSummary = allCardLedger?.summary || null
const allCardEntries = Array.isArray(allCardLedger?.entries) ? allCardLedger.entries : []
const allCardCodesUnique = new Set(allCardEntries.map(entry => entry.code)).size === allCardEntries.length
const allCardTestFiles = Array.isArray(allCardLedger?.testFiles) ? allCardLedger.testFiles : []
const allCardTestFilesFresh = allCardTestFiles.length > 0 && allCardTestFiles.every(entry => {
  const hash = fileHash(gameRelative(entry.file))
  return hash !== null && hash === entry.sha256
})
const liveCardPartitions = {
  campaign: CAMPAIGN_CARD_CODES.length + CAMPAIGN_FACE_CODES.length,
  investigator: INVESTIGATOR_CARD_CODES.length + (packOf('tdeInvestigators')?.faces ?? 0),
  player: PLAYER_CARD_CODES.length,
}
const liveCardShapes = { main: tdeMainCodes.length, face: tdeFaceCodes.length, total: TDE_CARD_CODES.length }
const allCardCountsAligned = Boolean(allCardSummary)
  && allCardSummary.total === liveCardShapes.total
  && allCardSummary.main === liveCardShapes.main
  && allCardSummary.face === liveCardShapes.face
  && allCardSummary.campaign === liveCardPartitions.campaign
  && allCardSummary.investigator === liveCardPartitions.investigator
  && allCardSummary.player === liveCardPartitions.player
  && allCardSummary.verified === liveCardShapes.total
  && allCardSummary.pending === 0
  && allCardSummary.simplified === (allCardSummary.simplifiedPlayer || 0) + (allCardSummary.simplifiedCampaign || 0)
  && allCardEntries.length === liveCardShapes.total && allCardCodesUnique
const allCardGate = {
  total: allCardSummary?.total ?? 0,
  records: allCardSummary?.main ?? 0,
  faces: allCardSummary?.face ?? 0,
  verified: allCardSummary?.verified ?? 0,
  pending: allCardSummary?.pending ?? -1,
  pendingCodes: allCardEntries.filter(entry => entry.status !== 'verified').map(entry => entry.code),
  partitions: {
    campaign: allCardSummary?.campaign ?? 0,
    investigator: allCardSummary?.investigator ?? 0,
    player: allCardSummary?.player ?? 0,
    face: allCardSummary?.face ?? 0,
  },
  simplified: allCardSummary?.simplified ?? 0,
  simplifiedPlayer: allCardSummary?.simplifiedPlayer ?? 0,
  simplifiedCampaign: allCardSummary?.simplifiedCampaign ?? 0,
  testsPassed: allCardSummary?.testsPassed ?? 0,
  testFiles: allCardTestFiles.length,
  testFilesFresh: allCardTestFilesFresh,
  ledger: { path: ALL_CARD_LEDGER_PATH, sha256: fileHash(ALL_CARD_LEDGER_PATH) },
  pass: allCardCountsAligned && allCardTestFilesFresh,
}

// ---------------------------------------------------------------- 并行双线证据（P9.5 账本；P10 重生成后 registeredInProduction=true）

const parallelLedger = readJson(PARALLEL_LEDGER_PATH)
const parallelGates = Array.isArray(parallelLedger?.gates) ? parallelLedger.gates : []
const parallelFilesFresh = (() => {
  const entries = Object.entries(parallelLedger?.files || {})
  return entries.length > 0 && entries.every(([file, hash]) => {
    const actual = fileHash(gameRelative(file))
    return actual !== null && actual === hash
  })
})()
const parallelModes = [...(campaign?.modes || [])]
const parallelFlows = Object.keys(campaign?.flows || {})
const campaignFlowsComplete = sameSet([...parallelModes].sort(), [...MODES].sort())
  && sameSet([...parallelFlows].sort(), [...MODES].sort())
const parallelGate = {
  status: parallelLedger?.status ?? null,
  gates: parallelLedger?.summary?.gates ?? 0,
  gatesCovered: parallelLedger?.summary?.gatesCovered ?? 0,
  gateIds: parallelGates.map(gate => gate.id),
  gatePassCount: parallelGates.filter(gate => gate.pass === true).length,
  tests: parallelLedger?.summary?.tests ?? 0,
  testFiles: parallelLedger?.summary?.testFiles ?? 0,
  browserTests: parallelLedger?.summary?.browserTests ?? 0,
  browserScreenshots: parallelLedger?.summary?.browserScreenshots ?? 0,
  dualLineGate: campaign?.dualLineGate ?? null,
  modes: parallelModes,
  flows: parallelFlows,
  registeredInProduction: Boolean(campaign),
  ledgerRegisteredInProduction: parallelLedger?.launch?.registeredInProduction ?? null,
  filesFresh: parallelFilesFresh,
  ledger: { path: PARALLEL_LEDGER_PATH, sha256: fileHash(PARALLEL_LEDGER_PATH) },
  pass: parallelLedger?.status === 'passed'
    && parallelLedger?.summary?.gates === 10
    && parallelLedger?.summary?.gatesCovered === 10
    && parallelGates.length === 10 && parallelGates.every(gate => gate.pass === true)
    && (parallelLedger?.summary?.tests ?? 0) > 0
    && campaign?.dualLineGate === 'open' && campaignFlowsComplete
    && parallelFilesFresh,
}

// ---------------------------------------------------------------- 剧情/调查员/玩家/规则书证据账本（只读汇总）

const rulesLedger = readJson(RULES_LEDGER_PATH)
const investigatorLedger = readJson(INVESTIGATOR_LEDGER_PATH)
const playerLedger = readJson(PLAYER_LEDGER_PATH)
const storyLedger = readJson(STORY_LEDGER_PATH)
const storyChecks = storyLedger?.checks || {}
const storyInventory = storyLedger?.inventory || {}
const storyGate = {
  status: storyLedger?.status ?? null,
  checks: storyChecks,
  chapters: storyInventory.chapters ?? 0,
  epilogueCells: storyInventory.epilogueCells ?? 0,
  interludes: storyInventory.interludes ?? 0,
  recordLabels: storyInventory.recordLabels ?? 0,
  translations: storyInventory.localizations ?? 0,
  coverage: storyLedger?.coverage ?? null,
  ledger: { path: STORY_LEDGER_PATH, sha256: fileHash(STORY_LEDGER_PATH) },
  pass: storyLedger?.status === 'translated'
    && Boolean(storyLedger?.gate?.pass)
    && Object.values(storyChecks).every(Boolean)
    && Object.keys(storyChecks).length > 0
    && storyInventory.chapters === chapters.length
    && storyInventory.epilogueCells === 16
    && storyInventory.interludes === TDE_INTERLUDE_IDS.length
    && storyInventory.recordLabels === Object.keys(recordTypes).length,
}
const investigatorLedgerGate = investigatorLedger?.gate || null
const playerLedgerSummary = playerLedger?.summary || null
const rulesLedgerGate = rulesLedger?.gate || null

// ---------------------------------------------------------------- 原语与请求队列（P3–P8，计算 remaining 债务）

const primitivePlan = readJson(PRIMITIVE_PLAN_PATH)
const primitiveCatalog = readJson(PRIMITIVE_CATALOG_PATH)
const primitiveNewItems = (primitiveCatalog?.primitives?.new || []).filter(Boolean)
const unfinishedPrimitives = primitiveNewItems.filter(item => item.status !== 'done').map(item => item.id || '(未命名)')
const deferredPrimitives = (primitivePlan?.deferredPrimitives || []).filter(Boolean)
const escapePrimitives = (primitivePlan?.escape || []).filter(Boolean)
const requestFileNames = existsSync(urlOf(PRIMITIVE_REQUEST_DIR))
  ? readdirSync(urlOf(PRIMITIVE_REQUEST_DIR)).filter(name => name.endsWith('.json')).sort()
  : []
// 请求文件按 worker 前缀分组：P7（w-m2-*）与 P8（w-p8-*）；status 以文件内的最终回写为准。
const primitiveRequestItems = requestFileNames
  .map(file => ({ file, request: readJson(`${PRIMITIVE_REQUEST_DIR}/${file}`) }))
  .filter(item => Boolean(item.request))
const primitiveRequests = primitiveRequestItems.map(item => item.request)
const p7RequestItems = primitiveRequestItems.filter(item => item.file.startsWith('w-m2'))
const p8RequestItems = primitiveRequestItems.filter(item => !item.file.startsWith('w-m2'))
const rejectedRequests = primitiveRequestItems.filter(item => item.request.status === 'rejected')
const p7Rejected = p7RequestItems.filter(item => item.request.status === 'rejected')
const p8Rejected = p8RequestItems.filter(item => item.request.status === 'rejected')
const p8Withdrawn = p8RequestItems.filter(item => item.request.status === 'withdrawn')
const primitiveDebts = {
  p7Rejected: p7Rejected.length,
  p8Rejected: p8Rejected.length,
  p8Withdrawn: p8Withdrawn.length,
  p8Deferred: deferredPrimitives.length,
  p8Escape: escapePrimitives.length,
  p8Outstanding: p8Rejected.length + p8Withdrawn.length + deferredPrimitives.length + escapePrimitives.length,
}
primitiveDebts.total = primitiveDebts.p7Rejected + primitiveDebts.p8Outstanding
const primitiveGate = {
  new: primitiveNewItems.length,
  done: primitiveNewItems.filter(item => item.status === 'done').length,
  unfinished: unfinishedPrimitives,
  deferred: deferredPrimitives.length,
  escape: escapePrimitives.length,
  requests: {
    files: primitiveRequestItems.length,
    done: primitiveRequestItems.filter(item => item.request.status === 'done').length,
    rejected: rejectedRequests.length,
    withdrawn: primitiveRequestItems.filter(item => item.request.status === 'withdrawn').length,
    p7: p7RequestItems.length,
    p8: p8RequestItems.length,
  },
  outstanding: primitiveDebts,
  planGatePass: Boolean(primitivePlan?.gate?.pass),
  pass: primitiveNewItems.length > 0
    && primitiveNewItems.every(item => item.status === 'done')
    && primitivePlan?.gate?.pass === true,
}

// ---------------------------------------------------------------- 逐章（P10 生产注册事实）

const chapterChecks = chapters.map(chapter => {
  const scenario = scenarioOf(chapter.id)
  const ledgerItem = scenarioItemOf(chapter.id)
  const referenceCard = ALL_CARDS[chapter.code] || null
  const checks = {
    campaignRegistered: Boolean(campaign?.scenarioIds?.includes(chapter.id)),
    statusPlayable: LAUNCHABLE.has(scenario?.status),
    referenceCodeMatches: scenario?.referenceCode === chapter.code,
    campaignIdMatches: scenario?.campaignId === CAMPAIGN_ID,
    referenceCardExists: Boolean(referenceCard) && referenceCard.type === 'scenario',
    chapterGroupReferenced: (scenario?.requiredEncounterGroupIds || []).includes(chapter.id),
    requiredPacksExist: (scenario?.requiredPackIds || []).every(packId => Boolean(contentRegistry.getPack(packId))),
    ledgerItemPresent: Boolean(ledgerItem),
    ledgerTwelveTrue: Boolean(ledgerItem) && SCENARIO_CHECK_KEYS.every(key => ledgerItem.checks?.[key] === true),
    testFilePresent: Boolean(ledgerItem?.testFile) && testFilePassed(ledgerItem.testFile),
  }
  return {
    id: chapter.id,
    code: chapter.code,
    name: chapter.name,
    part: chapter.part,
    pair: chapter.pair,
    status: scenario?.status ?? null,
    scenarioCard: scenario?.referenceCode ?? null,
    requiredPackIds: [...(scenario?.requiredPackIds || [])],
    requiredEncounterGroupIds: [...(scenario?.requiredEncounterGroupIds || [])],
    inventory: ledgerItem?.inventory || null,
    testFile: ledgerItem?.testFile || null,
    testCases: ledgerItem?.testCases || null,
    checks,
    pass: Object.values(checks).every(Boolean),
  }
})

// ---------------------------------------------------------------- 门禁

const campaignLaunchable = LAUNCHABLE.has(campaign?.status) && !launchBlocked && lobbyVisible
const gate = {
  scopeLedger: {
    path: SCOPE_PATH,
    sha256: scopeHash,
    milestone: scope?.milestone ?? null,
    gatePass: Boolean(scope?.gate?.pass),
    registration: scope?.gate?.registration ?? null,
    pass: Boolean(scope?.gate?.pass) && scope?.gate?.registration?.pass === true && scopeHash !== null,
  },
  records: {
    total: scope?.counts?.records ?? 0,
    assigned: scope?.gate?.records?.assigned ?? 0,
    main: scope?.counts?.main ?? 0,
    faces: scope?.counts?.faces ?? 0,
    liveTotal: liveCardShapes.total,
    liveMain: liveCardShapes.main,
    liveFaces: liveCardShapes.face,
    pass: scope?.gate?.records?.pass === true
      && scope?.counts?.records === 388 && scope?.gate?.records?.assigned === 388
      && liveCardShapes.total === 388 && liveCardShapes.main === 352 && liveCardShapes.face === 36,
  },
  packsByPhase: {
    investigators: {
      status: packOf('tdeInvestigators')?.status ?? null,
      cards: packOf('tdeInvestigators')?.cards ?? 0,
      implemented: packOf('tdeInvestigators')?.rulesImplemented ?? 0,
      faces: packOf('tdeInvestigators')?.faces ?? 0,
      pass: packOf('tdeInvestigators')?.status === 'playable'
        && packOf('tdeInvestigators')?.rulesImplemented === INVESTIGATOR_CARD_CODES.length,
    },
    campaign: {
      status: packOf('tdeCampaign')?.status ?? null,
      cards: packOf('tdeCampaign')?.cards ?? 0,
      implemented: packOf('tdeCampaign')?.rulesImplemented ?? 0,
      faces: packOf('tdeCampaign')?.faces ?? 0,
      pass: packOf('tdeCampaign')?.status === 'playable'
        && packOf('tdeCampaign')?.rulesImplemented === CAMPAIGN_CARD_CODES.length,
    },
    player: {
      status: packOf('tdePlayer')?.status ?? null,
      cards: packOf('tdePlayer')?.cards ?? 0,
      implemented: packOf('tdePlayer')?.rulesImplemented ?? 0,
      buildable: packOf('tdePlayer')?.deckbuilding ?? 0,
      basicWeaknesses: TDE_PLAYER_BASIC_WEAKNESS_CODES.length,
      pass: packOf('tdePlayer')?.status === 'playable'
        && packOf('tdePlayer')?.rulesImplemented === PLAYER_CARD_CODES.length
        && packOf('tdePlayer')?.deckbuilding === TDE_PLAYER_BUILDABLE_CODES.length,
    },
    pass: false,
  },
  campaignLaunchable: {
    status: campaign?.status ?? null,
    chapters: registryScenarios.length,
    packIds: [...(campaign?.requiredPackIds || [])],
    launchable: !launchBlocked,
    lobbyVisible,
    pass: campaignLaunchable && registryScenarios.length === chapters.length,
  },
  launchEnabled: { enabled: !launchBlocked, error: launchError, pass: !launchBlocked },
  chaptersLaunchable: {
    statuses: chapterChecks.map(item => `${item.id}:${item.status}`),
    hallChapters: lobbyEntry?.scenarios?.length ?? 0,
    pass: chapterChecks.length === chapters.length && chapterChecks.every(item => item.pass)
      && (lobbyEntry?.scenarios?.length ?? 0) === chapters.length,
  },
  encounterGroups: {
    expected: ENCOUNTER_GROUP_IDS.length,
    registered: packOf('tdeCampaign')?.encounterGroupIds.length ?? 0,
    unique: new Set(packOf('tdeCampaign')?.encounterGroupIds || []).size === (packOf('tdeCampaign')?.encounterGroupIds.length ?? 0),
    sharedGroups: SHARED_ENCOUNTER_GROUPS.length,
    chapterGroups: chapters.length,
    missingChapterGroups: chapterChecks.flatMap(item => item.requiredEncounterGroupIds
      .filter(group => !groupUniverse.has(group))
      .map(group => `${item.id}:${group}`)),
    pass: false,
  },
  packCounts: {
    campaign: packOf('tdeCampaign')?.records ?? 0,
    investigators: packOf('tdeInvestigators')?.records ?? 0,
    player: packOf('tdePlayer')?.records ?? 0,
    scope: scope?.counts?.packs ?? null,
    pass: packOf('tdeCampaign')?.records === 283
      && packOf('tdeInvestigators')?.records === 18
      && packOf('tdePlayer')?.records === 87
      && (packOf('tdeCampaign')?.records ?? 0) + (packOf('tdeInvestigators')?.records ?? 0) + (packOf('tdePlayer')?.records ?? 0) === 388,
  },
  requiredPacksExist: {
    packs: [...(campaign?.requiredPackIds || [])],
    pass: (campaign?.requiredPackIds || []).every(packId => Boolean(contentRegistry.getPack(packId))),
  },
  partsAndModes: {
    parts: partsWithChapters.length,
    pairs: pairs.length,
    pairComplete: pairs.every(pair => pair.chapters.length === 2 && pair.parts.length === 2),
    modes: parallelModes,
    flows: parallelFlows,
    flowsComplete: campaignFlowsComplete,
    dualLineGate: campaign?.dualLineGate ?? null,
    interludes: TDE_INTERLUDE_IDS.length,
    endings: Array.isArray(campaign?.endings) ? campaign.endings.length : 0,
    epilogueMatrix: epilogueNormalized,
    pass: partsWithChapters.length === Object.keys(PARTS).length
      && pairs.length === PAIR_COUNT && pairs.every(pair => pair.chapters.length === 2)
      && campaignFlowsComplete && campaign?.dualLineGate === 'open'
      && TDE_INTERLUDE_IDS.length === 3
      && epilogueNormalized.ok === true && epilogueNormalized.found === 16,
  },
  keywordScanAligned: { ...scanAlignment, pass: scanAlignment.pass },
  keywordsVerified: {
    total: keywordItems.length,
    verified: keywordItems.length - keywordFailures.length,
    pending: keywordFailures.map(item => item.id),
    pass: keywordFailures.length === 0 && keywordItems.length === TDE_SCANNED_KEYWORD_MECHANISMS.length,
  },
  rulebookEntries: { ...rulebookGate, pass: rulebookGate.pass },
  rulebookVerified: {
    checks: rulebookChecks,
    pending: Object.entries(rulebookChecks).filter(([, value]) => !value).map(([key]) => key),
    entries: tdeRulebookEntries.length,
    pass: rulebookStatus === 'verified',
  },
  mechanicsRegistered: {
    expected: TDE_RULE_IDS.length,
    registered: TDE_RULE_IDS.filter(id => supportedMechanics.has(id)).length,
    mismatches: TDE_RULE_IDS.filter(id => !supportedMechanics.has(id)),
    pass: TDE_RULE_IDS.every(id => supportedMechanics.has(id)),
  },
  nodeAcceptance: {
    command: nodeTests.command,
    status: nodeTests.status,
    files: nodeTests.files,
    fileCount: nodeTests.files.length,
    tests: nodeTests.tests,
    passed: nodeTests.passed,
    failed: nodeTests.failed,
    missingFiles: nodeTests.missingFiles,
    ok: nodeTests.ok,
    pass: nodeTests.ok,
  },
  investigatorsVerified: {
    formal: INVESTIGATOR_CODES.length,
    selectable: INVESTIGATOR_CODES.filter(code => canSelectInvestigator(code)).length,
    records: packOf('tdeInvestigators')?.records ?? 0,
    mainRecords: packOf('tdeInvestigators')?.cards ?? 0,
    faces: packOf('tdeInvestigators')?.faces ?? 0,
    ledgerGatePass: Boolean(investigatorLedgerGate?.pass),
    nodeAcceptance: testFilePassed('tests/tde-investigators.test.mjs'),
    pass: false,
  },
  playerCardsVerified: {
    total: packOf('tdePlayer')?.cards ?? 0,
    verified: TDE_PLAYER_VERIFIED_CODES.length,
    buildable: TDE_PLAYER_BUILDABLE_CODES.length,
    dependencyOnly: TDE_PLAYER_DEPENDENCY_CODES.length,
    basicWeaknesses: TDE_PLAYER_BASIC_WEAKNESS_CODES.length,
    testsPassed: playerLedgerSummary?.testsPassed ?? 0,
    ledgerVerified: playerLedgerSummary?.verified ?? 0,
    nodeAcceptance: testFilesPassed([
      'tests/tde-player-m2-1.test.mjs', 'tests/tde-player-m2-2.test.mjs',
      'tests/tde-player-m2-3.test.mjs', 'tests/tde-player-m2-4.test.mjs',
    ]),
    ledgerTest: testFilePassed('tests/tde-player-ledger.test.mjs'),
    pass: false,
  },
  scenariosVerified: {
    total: scenarioItems.length,
    development: scenarioItems.filter(item => ['development', 'verified'].includes(item.status)).length,
    verified: scenarioItems.filter(item => item.status === 'verified').length,
    nodeEvidence: scenarioNodeEvidence,
    pending: scenarioItems.filter(item => item.status === 'pending').map(item => item.id),
    pendingEncounterCards: scenarioPendingCards,
    gaps: scenarioItems.reduce((sum, item) => sum + (item.gaps?.length || 0), 0),
    encounterCards: scenarioItems.reduce((sum, item) => sum + Number(item.inventory?.encounterCards || 0), 0),
    chapterRecords: scenarioRecords,
    coveredChapterRecords: scenarioRecordsCovered,
    remaining: Array.isArray(scenarioLedger?.remaining) ? scenarioLedger.remaining.length : 0,
    testFiles: scenarioTestFiles,
    ledger: { path: SCENARIO_LEDGER_PATH, sha256: fileHash(SCENARIO_LEDGER_PATH), status: scenarioLedger?.status ?? null },
    sourceLock: { path: SCENARIO_SOURCE_LOCK_PATH, sha256: fileHash(SCENARIO_SOURCE_LOCK_PATH) },
    nodeAcceptance: scenarioNodeEvidence === chapters.length,
    pass: scenarioConfirmationStatus === 'verified',
  },
  allCardsVerified: { ...allCardGate, pass: allCardGate.pass },
  parallelVerified: { ...parallelGate, pass: parallelGate.pass },
  browserAcceptance: { ...browserChecks, pass: browserChecks.pass },
  storyVerified: { ...storyGate, pass: storyGate.pass },
  primitivesDone: { ...primitiveGate, pass: primitiveGate.pass },
}
gate.packsByPhase.pass = gate.packsByPhase.investigators.pass
  && gate.packsByPhase.campaign.pass && gate.packsByPhase.player.pass
gate.encounterGroups.pass = gate.encounterGroups.registered === ENCOUNTER_GROUP_IDS.length
  && gate.encounterGroups.unique && gate.encounterGroups.missingChapterGroups.length === 0
  && gate.encounterGroups.sharedGroups + gate.encounterGroups.chapterGroups === gate.encounterGroups.expected
gate.investigatorsVerified.pass = gate.investigatorsVerified.formal === 5
  && gate.investigatorsVerified.selectable === 5
  && gate.investigatorsVerified.mainRecords === INVESTIGATOR_CARD_CODES.length
  && gate.investigatorsVerified.faces === 2
  && gate.investigatorsVerified.ledgerGatePass && gate.investigatorsVerified.nodeAcceptance
gate.playerCardsVerified.pass = gate.playerCardsVerified.total === PLAYER_CARD_CODES.length
  && gate.playerCardsVerified.verified === PLAYER_CARD_CODES.length
  && gate.playerCardsVerified.buildable === TDE_PLAYER_BUILDABLE_CODES.length
  && gate.playerCardsVerified.basicWeaknesses === TDE_PLAYER_BASIC_WEAKNESS_CODES.length
  && gate.playerCardsVerified.nodeAcceptance && gate.playerCardsVerified.ledgerTest
  && gate.playerCardsVerified.ledgerVerified === PLAYER_CARD_CODES.length
// 发布要求以实跑证据计算；正式版必须没有简化、缺口或挂起原语。
const onlineFor=viewport=>browserTests.some(test=>test.spec==='tests/tde-online.browser.mjs'
  && test.viewport===viewport && test.status==='passed')
const releaseAcceptance={required:{
  launch:gate.campaignLaunchable.pass && gate.chaptersLaunchable.pass,
  node:gate.nodeAcceptance.pass,browser:gate.browserAcceptance.pass,
  parallelSmoke:gate.parallelVerified.pass,
  onlineMultiplayer:onlineFor('desktop') && onlineFor('mobile'),
  sharedInterludes:gate.parallelVerified.pass && fileHash('tests/tde-completion.test.mjs')!==null,
},deferred:[]}
const earlyAccessRequired=(allCardSummary?.simplified ?? 0)>0
  || scenarioItems.some(item=>(item.gaps || []).length>0 || (item.approximations || []).length>0)
  || primitiveDebts.total>0 || !Object.values(releaseAcceptance.required).every(Boolean)
gate.releaseDisclosure={deferred:[],pass:!earlyAccessRequired && lobbyEntry?.earlyAccess===false}

gate.releaseGate = {
  launch: campaignLaunchable,
  lobby: lobbyVisible,
  chapters: gate.chaptersLaunchable.pass,
  keywords: gate.keywordsVerified.pass,
  rulebook: gate.rulebookVerified.pass,
  investigators: gate.investigatorsVerified.pass,
  playerCards: gate.playerCardsVerified.pass,
  scenarios: gate.scenariosVerified.pass,
  allCards: gate.allCardsVerified.pass,
  parallel: gate.parallelVerified.pass,
  browser: gate.browserAcceptance.pass,
  story: gate.storyVerified.pass,
  primitives: gate.primitivesDone.pass,
  disclosure: gate.releaseDisclosure.pass,
}
gate.releaseGate.pass = Object.entries(gate.releaseGate)
  .filter(([key]) => key !== 'pass')
  .every(([, value]) => value === true)
const gatePass = Object.values(gate).every(entry => entry.pass === true)

// ---------------------------------------------------------------- 发布确认（三组：剧本 / 关键词 / 规则书）

const confirmations = {
  scenarios: {
    status: scenarioConfirmationStatus,
    milestone: 'M3',
    stage: scenarioLedger?.stage ?? null,
    chapters: scenarioItems.length,
    checks: scenarioConfirmationChecks,
    summary: scenarioLedger?.summary ?? null,
    items: scenarioItems.map(item => ({
      id: item.id,
      code: item.code,
      name: item.name,
      part: item.part,
      pair: item.pair,
      status: item.status,
      checks: item.checks,
      inventory: item.inventory,
      gaps: item.gaps || [],
      approximations: item.approximations || [],
      testFile: item.testFile || null,
      testCases: item.testCases || null,
    })),
    ledger: { path: SCENARIO_LEDGER_PATH, sha256: fileHash(SCENARIO_LEDGER_PATH) },
    sourceLock: { path: SCENARIO_SOURCE_LOCK_PATH, sha256: fileHash(SCENARIO_SOURCE_LOCK_PATH) },
    triage: { path: SCENARIO_TRIAGE_PATH, sha256: fileHash(SCENARIO_TRIAGE_PATH), totalGaps: scenarioTriage?.totalGaps ?? 0, uniqueCodes: scenarioTriage?.uniqueCodes ?? [] },
    evidence: [
      'tools/audit-tde-scenarios.mjs', SCENARIO_LEDGER_PATH, SCENARIO_SOURCE_LOCK_PATH, SCENARIO_TRIAGE_PATH,
      ...scenarioTestFiles, 'tests/tde-scenario-interactions.test.mjs', 'tests/tde-scenarios.browser.mjs',
    ],
  },
  keywords: {
    status: keywordsStatus,
    total: keywordItems.length,
    verified: keywordItems.length - keywordFailures.length,
    items: keywordItems,
    scan: { path: MECHANISM_SCAN_PATH, sha256: fileHash(MECHANISM_SCAN_PATH) },
    evidence: ['content/campaigns/theDreamEaters/keywords.js', 'tests/tde-rules.test.mjs', RULES_LEDGER_PATH],
  },
  rulebook: {
    status: rulebookStatus,
    entries: tdeRulebookEntries.length,
    requiredRuleIds: [...TDE_RULE_IDS],
    checks: rulebookChecks,
    details: {
      campaignOverview: campaignOverviewChecks,
      scenarioMechanics: { ...scenarioMechanicsChecks, items: rulebookChapterItems },
      keywordEntries: keywordEntriesChecks,
      cardLinks: cardLinksChecks,
      browser: { desktop: browserChecks.desktop, mobile: browserChecks.mobile },
    },
    evidence: ['web/rulebook-data.js', 'web/ui-cards.js', 'content/campaigns/theDreamEaters/keywords.js', 'tests/tde-rules.test.mjs', RULES_LEDGER_PATH],
  },
}

// ---------------------------------------------------------------- remaining（算出来，不手写结论）

const remaining = []
const legend = allCardSummary?.verified === liveCardShapes.total
  ? `逐卡账本 ${allCardSummary.verified}/${allCardSummary.total} 条 verified，其中 ${allCardSummary.simplified} 条为显式简化`
  : `逐卡账本缺失或不完整（${allCardSummary?.verified ?? 0}/${liveCardShapes.total}）`
if ((allCardSummary?.simplified ?? 0)>0) remaining.push(legend)
if (primitiveDebts.total>0) remaining.push('尚有 '+primitiveDebts.total+' 项原语未完成')
for(const [key,ok] of Object.entries(releaseAcceptance.required)) if(!ok) remaining.push('发布验收未通过：'+key)
if ((scenarioLedger?.remaining || []).length) {
  remaining.push(`逐章账本 remaining ${scenarioLedger.remaining.length} 条显式近似/边界保持登记`
    + `（audit/tde-scenario-acceptance.json；summary: ${scenarioLedger.summary?.approximations ?? 0} approximations / `
    + `${scenarioLedger.summary?.gaps ?? 0} gaps；不宣称规则等价）`)
}
// baseline 维护口径（由 audit/baseline.json 的 milestone=P10 决定是否已 P10 重采）。
// 注意：**不**把 audit/baseline.json 的文件内容哈希写进 sources/evidence——发布收尾会连写两次
// baseline（#1 采快照、#2 收口），哈希会造成循环依赖；只记录 retaken 布尔与 milestone 状态。
// 半成品 baseline（milestone=P0、tdeScope/tdeMigration stale、test:fast 有失败）不算重采，不得写成已完成。
const baselineLedger = readJson('audit/baseline.json')
const baselineAudits = Array.isArray(baselineLedger?.audits) ? baselineLedger.audits : []
const tdeBaselineAudits = baselineAudits.filter(entry => /tools\/scan-tde-scope\.mjs|tools\/audit-tde\.mjs/
  .test(String(entry?.command || '')))
const baselineRecollected = baselineLedger?.milestone === 'P10'
  || (tdeBaselineAudits.length >= 2 && tdeBaselineAudits.every(entry => entry.status === 0)
    && baselineLedger?.tests?.status === 0)
if (!baselineRecollected) {
  remaining.push(`audit/baseline.json 仍是 ${baselineLedger?.milestone ?? '缺失'} 口径（未 P10 重采，R4）：`
    + '发布前需 node tools/audit-baseline.mjs --write；后续改内容需重采。')
}
for (const [key, value] of Object.entries(gate)) {
  if (key === 'pass' || key === 'releaseGate' || value.pass === true) continue
  const detail = key === 'browserAcceptance'
    ? `（报告 status=${value.status}、spec ${value.specs?.length ?? 0}/${value.expectedSpecs?.length ?? 0}、`
      + `tests ${value.tests}、screenshots ${value.screenshots}）`
    : ''
  remaining.push(`P10 门禁未通过：${key}${detail}`)
}
if (nodeTests.failed > 0 || !nodeTests.ok) {
  remaining.push(`P10 Node 验收未通过：${nodeTests.failed} 例失败 / 缺失文件 ${nodeTests.missingFiles.length} 条`
    + `（${nodeTests.command}）`)
}
if (keywordFailures.length) remaining.push(`关键词未 verified：${keywordFailures.map(item => item.id).join('、')}`)
if (rulebookStatus !== 'verified') {
  remaining.push(`规则书未 verified：${Object.entries(rulebookChecks).filter(([, value]) => !value).map(([key]) => key).join('、')}`)
}
// ---------------------------------------------------------------- 账本

const audit = {
  schemaVersion: 2,
  cycle: 'tde',
  cycleName: 'The Dream Eaters',
  cycleNameZh: '食梦者',
  campaignId: CAMPAIGN_ID,
  milestone: 'M5',
  stage: 'P10',
  generatedBy: 'tools/audit-tde.mjs',
  docs: 'docs/arkham-content-migration.md',
  scope: { path: SCOPE_PATH, sha256: scopeHash },
  // baseline 只记录「是否已 P10 重采」与 milestone，不记录文件内容哈希、也不记录逐 audit 的
  // status（发布收尾连写两次 baseline：#1 采快照、#2 收口；记哈希或逐项 status 会形成循环依赖/
  // 二次漂移。维护口径见 remaining）。
  baseline: {
    path: 'audit/baseline.json',
    retaken: baselineRecollected,
    milestone: baselineLedger?.milestone ?? null,
    note: baselineRecollected ? null : '发布前需 node tools/audit-baseline.mjs --write 正式重采',
  },
  campaign: {
    id: CAMPAIGN_ID,
    status: campaign?.status ?? null,
    name: campaign?.name ?? null,
    nameEn: campaign?.nameEn ?? null,
    chapters: registryScenarios.length,
    requiredPackIds: [...(campaign?.requiredPackIds || [])],
    parts: partsWithChapters,
    pairs,
    modes: parallelModes,
    flows: parallelFlows,
    dualLineGate: campaign?.dualLineGate ?? null,
    interludes: [...TDE_INTERLUDE_IDS],
    recordKeys: Object.keys(recordTypes).length,
    endings: Array.isArray(campaign?.endings) ? campaign.endings.length : 0,
    epilogueMatrix: epilogueNormalized,
    launchBlocked,
    launchError,
    lobbyVisible,
  },
  status: campaign?.status ?? null,
  playable: LAUNCHABLE.has(campaign?.status) && !launchBlocked,
  launchEnabled: !launchBlocked,
  earlyAccess: earlyAccessRequired,
  earlyAccessReason: earlyAccessRequired ? remaining.join('；') : null,
  equivalenceCertified: !earlyAccessRequired && gatePass,
  releaseAcceptance,
  verifiedScope: `M0 范围（${scope?.counts?.records ?? 0} 条记录 = ${liveCardShapes.main} 主卡 + ${liveCardShapes.face} 关联面，`
    + `三包 ${liveCardPartitions.campaign}/${liveCardPartitions.investigator}/${liveCardPartitions.player}，`
    + `${gate.encounterGroups.expected} 遭遇组、4 章对/2 线/4 模式）、M1 五位调查员、M2 `
    + `${PLAYER_CARD_CODES.length} 张玩家卡、M3 八章逐章 12/12 检查、M3-C 剧情自译与双线 flow、`
    + `M4 ${keywordItems.length} 条关键词与 ${tdeRulebookEntries.length} 条规则书条目、M5 生产注册与大厅启动、`
    + `逐卡 ${liveCardShapes.total}/${liveCardShapes.total}、并行双线 10 门禁、真实浏览器证据。`
    + (earlyAccessRequired ? '验收缺口见 remaining。' : '原始循环已完成，显式简化、章节缺口与挂起原语均为零。'),
  packs,
  scenarios: chapterChecks.map(item => ({
    id: item.id,
    code: item.code,
    name: item.name,
    part: item.part,
    pair: item.pair,
    status: item.status,
    referenceCode: item.scenarioCard,
    requiredPackIds: item.requiredPackIds,
    requiredEncounterGroupIds: item.requiredEncounterGroupIds,
    testFile: item.testFile,
    testCases: item.testCases,
    launchable: LAUNCHABLE.has(item.status),
    checks: item.checks,
  })),
  chapters: chapterChecks,
  encounterGroups: [...ENCOUNTER_GROUP_IDS],
  counts: scope?.counts ?? null,
  chaosBags: Object.fromEntries(Object.entries(TDE_CHAOS_BAGS).map(([part, bags]) => [part,
    Object.fromEntries(TDE_BAG_DIFFICULTIES.map(difficulty => {
      const tokens = bags[difficulty] || []
      return [difficulty, { tokens: tokens.length, skull: tokens.filter(token => token === 'skull').length }]
    }))])),
  chaosFacts: TDE_CHAOS_FACTS,
  recordSchema: sortedObject(Object.entries(recordTypes)),
  recordLabels: sortedObject(Object.entries(RECORD_LABELS)),
  investigatorCodes: [...INVESTIGATOR_CODES],
  mechanics: {
    status: TDE_RULE_IDS.every(id => supportedMechanics.has(id)) ? 'verified' : 'pending',
    items: TDE_RULE_IDS.map(ruleId => ({
      id: ruleId,
      keyword: TDE_KEYWORDS.find(keyword => keyword.ruleId === ruleId)?.id ?? null,
      registered: supportedMechanics.has(ruleId),
      evidence: 'tests/tde-rules.test.mjs',
    })),
  },
  primitives: { ...primitiveGate, requests: primitiveGate.requests, outstanding: primitiveDebts },
  sources: [
    'content/registered.js',
    'content/registry.js',
    'content/mechanics.js',
    'content/campaigns/theDreamEaters/shared.js',
    'content/campaigns/theDreamEaters/chapters.js',
    'content/campaigns/theDreamEaters/parts.js',
    'content/campaigns/theDreamEaters/manifest.js',
    'content/campaigns/theDreamEaters/keywords.js',
    'content/campaigns/theDreamEaters/record-labels.js',
    'content/campaigns/theDreamEaters/tde-chaos.js',
    'content/campaigns/theDreamEaters/interludes.js',
    'content/campaigns/theDreamEaters/dual-story.js',
    'content/campaigns/theDreamEaters/card-data.js',
    'content/campaigns/theDreamEaters/card-acceptance.js',
    'content/packs/tdeCampaign/manifest.js',
    'content/packs/tdeInvestigators/manifest.js',
    'content/packs/tdePlayer/manifest.js',
    'web/rulebook-data.js',
    'web/ui-cards.js',
    'src/cards/cards-data.js',
    'src/cards/tde-player-acceptance.js',
    'src/cards/tde-campaign-acceptance.js',
    'src/deck/availability.js',
    'src/campaign/epilogue-matrix.js',
    'src/campaign/part-flow.js',
    'tools/audit-tde.mjs',
    BROWSER_CONFIG_PATH,
    'docs/arkham-content-migration.md',
    'audit/tde-parallel-acceptance.json',
    'tests/tde-p95-interludes.test.mjs',
  ].map(path => ({ path, sha256: fileHash(path) })),
  confirmations,
  evidence: {
    files: sortedObject([
      SCOPE_PATH, MECHANISM_SCAN_PATH, PRIMITIVE_PLAN_PATH, PRIMITIVE_CATALOG_PATH, BROWSER_PATH,
      RULES_LEDGER_PATH, INVESTIGATOR_LEDGER_PATH, PLAYER_LEDGER_PATH, SCENARIO_LEDGER_PATH,
      SCENARIO_SOURCE_LOCK_PATH, SCENARIO_TRIAGE_PATH, STORY_LEDGER_PATH, ALL_CARD_LEDGER_PATH,
      PARALLEL_LEDGER_PATH,
      'src/cards/tde-campaign-acceptance.js', 'src/cards/tde-player-acceptance.js',
      'content/campaigns/theDreamEaters/story-text.js',
      ...requestFileNames.map(file => `${PRIMITIVE_REQUEST_DIR}/${file}`),
    ].map(path => [path, fileHash(path)])),
    browser: {
      path: BROWSER_PATH,
      generatedBy: browserReport?.generatedBy ?? null,
      status: browserReport?.status ?? null,
      specs: browserSpecs.length,
      expectedSpecs: expectedBrowserSpecs.length,
      tests: browserTests.length,
      screenshots: browserChecks.screenshots,
      scenarios: browserScenarios.length,
    },
    scenarioLedger: {
      path: SCENARIO_LEDGER_PATH,
      status: scenarioLedger?.status ?? null,
      summary: scenarioLedger?.summary ?? null,
    },
    allCardLedger: {
      path: ALL_CARD_LEDGER_PATH,
      generatedBy: allCardLedger?.generatedBy ?? null,
      summary: allCardSummary,
    },
    parallelLedger: {
      path: PARALLEL_LEDGER_PATH,
      status: parallelLedger?.status ?? null,
      summary: parallelLedger?.summary ?? null,
      launch: parallelLedger?.launch ?? null,
    },
    rulesLedger: {
      path: RULES_LEDGER_PATH,
      gate: rulesLedgerGate,
      keywords: rulesLedger?.keywords ? { total: rulesLedger.keywords.total, verified: rulesLedger.keywords.verified, status: rulesLedger.keywords.status } : null,
      rulebook: rulesLedger?.rulebook ? { entries: rulesLedger.rulebook.entries, status: rulesLedger.rulebook.status } : null,
    },
    investigatorLedger: {
      path: INVESTIGATOR_LEDGER_PATH,
      gate: investigatorLedgerGate,
    },
    playerLedger: {
      path: PLAYER_LEDGER_PATH,
      summary: playerLedgerSummary,
    },
    storyLedger: {
      path: STORY_LEDGER_PATH,
      status: storyLedger?.status ?? null,
      gate: storyLedger?.gate ?? null,
    },
  },
  tests: nodeTests,
  remaining,
  gate: { ...gate, pass: gatePass },
}
const json = `${JSON.stringify(audit, null, 2)}\n`

// ---------------------------------------------------------------- CLI

if (MODE === 'write') {
  mkdirSync(new URL('../audit/', import.meta.url), { recursive: true })
  writeFileSync(TARGET, json, 'utf8')
  console.log(`audit: audit/tde-migration.json · milestone ${audit.milestone} · ${audit.stage} · gate ${gatePass ? 'pass' : 'fail'}`)
  console.log(`范围 ${scope?.counts?.records ?? 0} = ${liveCardShapes.main} 主卡 + ${liveCardShapes.face} 面；`
    + `三包 ${liveCardPartitions.campaign}/${liveCardPartitions.investigator}/${liveCardPartitions.player}；`
    + `8 章 ${gate.chaptersLaunchable.pass ? 'playable' : '未齐'}；大厅 ${lobbyVisible}；assertLaunchable ${!launchBlocked}`)
  console.log(`关键词 ${gate.keywordsVerified.verified}/${gate.keywordsVerified.total} · 规则书 ${rulebookStatus}`
    + `（${tdeRulebookEntries.length} 条 / 6 项）· 机制 ${gate.mechanicsRegistered.registered}/${gate.mechanicsRegistered.expected}`)
  console.log(`剧本 ${gate.scenariosVerified.verified}/${gate.scenariosVerified.total} verified · 12 项全真 ${scenarioConfirmationChecks.ledgerVerified ? '是' : '否'}`
    + ` · 记录 ${scenarioRecordsCovered}/${scenarioRecords} · 待实现遭遇卡 ${scenarioPendingCards}`)
  console.log(`逐卡 ${gate.allCardsVerified.verified}/${gate.allCardsVerified.total} · simplified ${gate.allCardsVerified.simplified}`
    + `（P7 ${allCardSummary?.simplifiedPlayer ?? 0} + P8 ${allCardSummary?.simplifiedCampaign ?? 0}）· testsPassed ${gate.allCardsVerified.testsPassed}`)
  console.log(`并行 ${gate.parallelVerified.gatesCovered}/${gate.parallelVerified.gates} 门禁 · ${gate.parallelVerified.tests} 例 · dualLineGate ${gate.parallelVerified.dualLineGate}`)
  console.log(`浏览器 ${browserChecks.specs.length}/${browserChecks.expectedSpecs.length} spec · ${browserChecks.tests} 例 · ${browserChecks.screenshots} 截图`
    + ` · status ${browserChecks.status} · desktop ${browserChecks.desktop} / mobile ${browserChecks.mobile}`)
  console.log(`Node 验收 ${nodeTests.passed}/${nodeTests.tests} 例（${nodeTests.files.length} 文件）· earlyAccess ${audit.earlyAccess}`
    + ` · equivalenceCertified ${audit.equivalenceCertified} · baseline retaken ${audit.baseline.retaken} · remaining ${remaining.length} 条`)
  if (!gatePass) {
    for (const [key, value] of Object.entries(gate)) {
      if (key === 'pass' || value.pass === true) continue
      console.log(`  gate 未通过 ${key}: ${JSON.stringify(value).slice(0, 400)}`)
    }
  }
} else if (MODE === 'check') {
  if (!existsSync(TARGET)) {
    console.error('audit/tde-migration.json 不存在：先运行 node tools/audit-tde.mjs --write')
    process.exit(1)
  }
  const disk = readFileSync(TARGET, 'utf8')
  if (disk !== json) {
    let changed = []
    try {
      const previous = JSON.parse(disk)
      changed = Object.keys(audit).filter(key => JSON.stringify(previous[key]) !== JSON.stringify(audit[key]))
    } catch {
      changed = ['(JSON 无法解析)']
    }
    console.error(`audit/tde-migration.json 与内容不一致（重新 --write 并审阅 diff）：${changed.join(', ') || '格式/换行'}`)
    process.exit(1)
  }
  if (!gatePass) {
    console.error(JSON.stringify(gate))
    process.exit(1)
  }
  console.log(`audit 复算一致：${audit.milestone} · ${audit.stage}，范围 ${scope?.counts?.records ?? 0} 条，`
    + `关键词 ${gate.keywordsVerified.verified}/${gate.keywordsVerified.total}，规则书 ${rulebookStatus}，`
    + `逐卡 ${gate.allCardsVerified.verified}/${gate.allCardsVerified.total}，剧本 ${gate.scenariosVerified.verified}/${gate.scenariosVerified.total}，`
    + `并行 ${gate.parallelVerified.gatesCovered}/${gate.parallelVerified.gates}，gate pass`)
} else {
  console.log(json)
}
