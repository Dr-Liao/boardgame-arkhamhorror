#!/usr/bin/env node
// 印斯茅斯暗潮（The Innsmouth Conspiracy）P8 逐章验收账本：N 章 × 12 项检查，全部由代码与实跑证据计算。
// P8 起章节来自生产注册表的 chapter-entry（generatedFrom='production registration'），
// 发布门禁由 tools/audit-tic.mjs 的发布账本裁定；本账本是它的逐章证据输入。
//
//   node tools/audit-tic-scenarios.mjs           打印 JSON 账本（不落盘）
//   node tools/audit-tic-scenarios.mjs --write   写 audit/tic-scenario-acceptance.json
//   node tools/audit-tic-scenarios.mjs --check   复算并比对账本；漂移退出码 2，账本不完整退出码 1
//
// 口径（docs/arkham-content-migration.md §5 / §5.1 / §5.2、§4.5.2、§4.5.1）：
//   · 一个事实源：章节来自 content/campaigns/theInnsmouthConspiracy/shared.js（不写死章数）；
//     章节数据从各章 scenarios/<id>/index.js 动态 import，准备/区域守恒由 content/scenario-manifest.js
//     的 scenarioZoneReport 机械复算；剧本卡（幕/议程）规则从单卡条目读 actRule/agendaRule。
//   · sourceLocked：参考实现目录存在，audit/tic-scope.json 登记的本章剧本 + 中英 locale 源文件
//     与磁盘 SHA-256 一致，story-text.js 与 audit/tic-story-acceptance.json 的来源锁一致。
//   · identityRegistered：身份表全部 mapped、真实卡号在卡表、章节 id/referenceCode 对齐。
//   · storyText：剧情生成器的三个检查（完整中译 / 全章 / 无缺失）+ 本章中英正文（开场、设置、
//     特别规则、每个结局键）非空 + 战役级序章/幕间/尾声 + 中英冒险指南完整（§4.5.2）。
//     叙事正文里不允许出现 <script>/<iframe>/on*= 等 HTML 控制标记；表现性标签（<p>/<img>）
//     由运行时 textBlocks 与指南生成器剥离，只在 notes 里计数。
//   · 行为类检查（setupAndZones / actsAndAgendas / locationsAndConnections / encounterBehaviors /
//     chaosEffects / resolutionsAndRecords / saveReplay）：结构信号（引擎读点、单卡条目、覆盖）
//     只进 notes.subsignals，不能单独把检查标 true；必须存在**本章验收测试文件**
//     tests/tic-scenario-<chapterId>.test.mjs（或 kebab 变体），已登记 tests/suites.mjs 的任一 tier、
//     显式引用本章（chapterFixture('<id>') 或 scenarios/<id>/），实跑通过，且通过用例标题命中该项
//     的验收断言关键词。本轮 8 章均无该文件 → 行为类检查 false（不伪造）。
//   · literalCardBehavior：只认逐卡验收账本 audit/tic-all-card-acceptance.json（口径同
//     tools/audit-tde-all-cards.mjs 的 TDE 账本）；账本缺失 = false，单个卡号出现在源码或测试里
//     一律不算证据（§5.2 事故备忘）。
//   · browserAcceptance：只读 audit/tic-browser-acceptance.json；该章必须同时有 desktop 与 mobile
//     两条 passed 用例（含截图），不手工写布尔。
//   · 现有 tests/tic-*.test.mjs 只作为 static 部分证据写进 notes.existingEvidence（供差距矩阵引用），
//     不参与 gate；定向夹具不能替代逐章验收（§5）。
//
// 退出码：0 = 账本完整且 --check 一致；1 = 账本不完整（--check/--write 都会提示）；2 = --check 漂移或用法错误。
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { chapters } from '../content/campaigns/theInnsmouthConspiracy/shared.js'
import { STORY_TEXT, STORY_META } from '../content/campaigns/theInnsmouthConspiracy/story-text.js'
import { scenarioZoneReport } from '../content/scenario-manifest.js'
import { SCENARIO_MIGRATION_CHECKS } from '../content/migration-confirmation.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { implementedFor } from '../src/cards/card-rules.js'
import { coreCardVerified } from '../src/cards/core-acceptance.js'
import { FAST_TESTS, SLOW_TESTS, ASSET_TESTS } from '../tests/suites.mjs'
import { manifest as campaignManifest } from '../content/campaigns/theInnsmouthConspiracy/manifest.js'
import { flow } from '../content/campaigns/theInnsmouthConspiracy/flow.js'
import { currentEvidence } from './tic-evidence.mjs'

const MOD = fileURLToPath(new URL('../', import.meta.url))
const WORKSPACE = fileURLToPath(new URL('../../../', import.meta.url))
const REFERENCE = resolve(WORKSPACE, '参考资源/ArkhamHorror-main')
const LEDGER = resolve(MOD, 'audit/tic-scenario-acceptance.json')
const CAMPAIGN_ID = 'theInnsmouthConspiracy'
const CHAPTER_TEST_DIR = resolve(MOD, 'tests')
const MODE = process.argv.includes('--write') ? 'write'
  : process.argv.includes('--check') ? 'check' : 'report'
const CAMPAIGN_DIR = resolve(MOD, 'content/campaigns/theInnsmouthConspiracy')

// ---------------------------------------------------------------- 基础工具
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')
const shaFile = relative => sha256(readFileSync(resolve(MOD, relative)))
const readJson = (relative, fallback = null) => {
  const path = resolve(MOD, relative)
  if (!existsSync(path)) return fallback
  try { return JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, '')) } catch { return fallback }
}
const rel = absolute => absolute.slice(MOD.length).replaceAll('\\', '/')
const clean = value => typeof value === 'string' ? value.trim() : ''
const json = value => JSON.stringify(value, null, 2) + '\n'
const sum = values => values.reduce((total, value) => total + value, 0)
const uniq = values => [...new Set(values)]
const walkFiles = (directory, predicate, out = []) => {
  if (!existsSync(directory)) return out
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const full = resolve(directory, entry.name)
    if (entry.isDirectory()) walkFiles(full, predicate, out)
    else if (predicate(full)) out.push(full)
  }
  return out
}
// 章节 id → kebab-case（验收测试文件命名兼容 tests/tic-scenario-<ChapterId>.test.mjs）
const kebab = id => id.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
// 段落/对象结构里的纯文本长度：用于判断正文是否只是空壳。
function textLength(value) {
  if (typeof value === 'string') return value.replace(/<[^>]*>/g, '').replace(/\[[a-z_]+\]/gi, '').trim().length
  if (Array.isArray(value)) return sum(value.map(textLength))
  if (value && typeof value === 'object') return sum(Object.values(value).map(textLength))
  return 0
}
const CONTROL_MARKERS = /<\s*(?:script|style|iframe|object|embed|link|meta)\b|javascript\s*:|on(?:error|load|click|mouseover)\s*=/i
const SAVE_REPLAY_MARKER = /存档|保存|恢复|回放|重放|往返|serialize/i
const PRIVACY_MARKER = /隐私投影|不投影|未触发.*投影|投影.*未触发|剧情.*投影|私密.*投影/i
// 行为类检查的「本章验收测试断言关键词」。只作用于**通过用例的标题**，是「存在该章验收用例」
// 的机械证据；逐条语义仍需 Lead 审阅测试正文。
const CHECK_TITLE_MARKERS = {
  setupAndZones: /setup|初始|设置|配置|放置|摆放|布局|区域|牌库|牌堆|旁置|放在一边|守恒/i,
  actsAndAgendas: /幕|议程|\bact\b|agenda|推进|目标|scriptCard|剧本卡|objective/i,
  locationsAndConnections: /地点|location|连接|连结|邻接|地图|布局|移动|\bmove\b|adjacency/i,
  encounterBehaviors: /敌人|enemy|诡计|treacher|遭遇|encounter|显现|revelation|谈判|parley|猎手|hunter/i,
  chaosEffects: /混乱|标记|token|symbol|难度|提示卡|skull|cultist|tablet|elder/i,
  resolutionsAndRecords: /结局|结算|resolution|经验|\bxp\b|创伤|trauma|记录|record|日志|campaign log/i,
  saveReplay: SAVE_REPLAY_MARKER,
}
const BEHAVIOR_CHECKS = ['setupAndZones', 'actsAndAgendas', 'locationsAndConnections', 'encounterBehaviors',
  'chaosEffects', 'resolutionsAndRecords', 'saveReplay']
const CONTENT_CHECKS = ['sourceLocked', 'identityRegistered', 'storyText']
const LEDGER_CHECKS = ['literalCardBehavior']
for (const check of SCENARIO_MIGRATION_CHECKS) {
  if (![...BEHAVIOR_CHECKS, ...CONTENT_CHECKS, ...LEDGER_CHECKS, 'browserAcceptance'].includes(check)) {
    throw new Error(`未归类的剧本迁移检查项：${check}`)
  }
}

// ---------------------------------------------------------------- 静态索引
const SUITE_FILES = new Set([...FAST_TESTS, ...SLOW_TESTS, ...ASSET_TESTS])
const chapterMeta = new Map(chapters.map(chapter => [chapter.id, chapter]))
const scope = readJson('audit/tic-scope.json')
const storyAcceptance = readJson('audit/tic-story-acceptance.json')
const browserReport = readJson('audit/tic-browser-acceptance.json')
const chapterSourceAudit = readJson('audit/tic-chapter-sources.json')
const chapterData = readJson('content/campaigns/theInnsmouthConspiracy/chapter-data.json', {})
const allCardLedger = readJson('audit/tic-all-card-acceptance.json')
// 原语请求队列：pending = 引擎读点尚未实现，相关卡只能降级/blocked（§4.6.3）。只读，不参与分数。
const PRIMITIVE_REQUEST_DIR = resolve(MOD, 'artifacts/migration/tic/p7/primitive-requests')
const primitiveRequests = existsSync(PRIMITIVE_REQUEST_DIR)
  ? readdirSync(PRIMITIVE_REQUEST_DIR).filter(name => name.endsWith('.json')).sort().flatMap(name => {
    try {
      const request = JSON.parse(readFileSync(resolve(PRIMITIVE_REQUEST_DIR, name), 'utf8'))
      return [{ file: `artifacts/migration/tic/p7/primitive-requests/${name}`, id: request.id ?? name,
        status: request.status ?? 'unknown', primitive: request.primitive ?? request.missingPrimitive ?? null,
        cards: request.cards ?? (request.card ? [request.card] : []) }]
    } catch { return [] }
  })
  : []
const pendingPrimitiveRequests = primitiveRequests.filter(request => request.status !== 'done' && request.status !== 'rejected')

// 单卡条目索引（战役目录 + shared）：code → mod 相对路径
const ENTRY_ROOTS = [
  resolve(MOD, 'src/cards/encounter-entries/theInnsmouthConspiracy'),
  resolve(MOD, 'src/cards/encounter-entries/shared'),
]
const entryFiles = new Map()
for (const root of ENTRY_ROOTS) {
  for (const full of walkFiles(root, file => file.endsWith('.js')
    && !file.endsWith('index.js') && !file.split(/[\\/]/).at(-1).startsWith('_'))) {
    entryFiles.set(full.split(/[\\/]/).at(-1).slice(0, -3), rel(full))
  }
}
// 遭遇卡按 encounterCode 建索引，用于「本章共享遭遇组守恒」
const cardsByEncounterCode = new Map()
for (const card of Object.values(ALL_CARDS)) {
  if (!card.encounterCode) continue
  if (!cardsByEncounterCode.has(card.encounterCode)) cardsByEncounterCode.set(card.encounterCode, [])
  cardsByEncounterCode.get(card.encounterCode).push(card.code)
}
const cardsByCode = new Map(Object.entries(ALL_CARDS))
const originalOf = card => card?.originalCode || card?.code
// 背面故事卡：linkedCardCode 反查（正面在章节定义里也算有落点）
const frontCodesOf = new Map()
for (const card of Object.values(ALL_CARDS)) {
  if (!card.linkedCardCode) continue
  if (!frontCodesOf.has(card.linkedCardCode)) frontCodesOf.set(card.linkedCardCode, [])
  frontCodesOf.get(card.linkedCardCode).push(card.code)
}

// TIC 全部测试（静态部分证据）：文件名 → 标题 / 是否引用本章
const ticTestFiles = readdirSync(CHAPTER_TEST_DIR).filter(name => /^tic-.*\.test\.mjs$/.test(name)).sort()
const ticTestIndex = ticTestFiles.map(name => {
  const source = readFileSync(resolve(CHAPTER_TEST_DIR, name), 'utf8')
  return {
    name: `tests/${name}`,
    source,
    titles: [...source.matchAll(/\btest\(\s*[`'"]([^`'"]+)[`'"]/g)].map(match => match[1]),
    chapterRefs: chapters.filter(chapter => source.includes(`chapterFixture('${chapter.id}'`)
      || source.includes(`chapterFixture("${chapter.id}"`) || source.includes(`scenarios/${chapter.id}/`)).map(chapter => chapter.id),
  }
})

// 测试实跑缓存：只有本章验收测试文件会被执行（见 buildChapterAcceptance）
const testRunCache = new Map()
function runTestFile(relative) {
  if (testRunCache.has(relative)) return testRunCache.get(relative)
  const result = spawnSync(process.execPath, ['--test', '--test-reporter=tap', relative], {
    cwd: MOD, encoding: 'utf8', timeout: 240_000, maxBuffer: 32 * 1024 * 1024,
  })
  const output = `${result.stdout || ''}\n${result.stderr || ''}`
  const entry = {
    file: relative,
    ok: result.status === 0,
    titles: [...output.matchAll(/^\s*ok \d+ - (.+)$/gm)].map(match => match[1].trim()),
    failedTitles: [...output.matchAll(/^\s*not ok \d+ - (.+)$/gm)].map(match => match[1].trim()),
  }
  testRunCache.set(relative, entry)
  return entry
}

// ---------------------------------------------------------------- 来源锁
const referenceOk = existsSync(REFERENCE)
function referenceEntry(relativePath) {
  if (!referenceOk) return { path: relativePath, ok: false, reason: '缺少参考实现目录' }
  const full = resolve(REFERENCE, relativePath)
  if (!existsSync(full)) return { path: relativePath, ok: false, reason: '参考文件缺失' }
  return { path: relativePath, ok: true, sha256: sha256(readFileSync(full)) }
}
function scopeSourceEntry(relativePath) {
  const registered = (scope?.sources || []).find(entry => entry.path === relativePath)
  const actual = referenceEntry(relativePath)
  const base = {
    path: relativePath,
    registeredSha256: registered?.sha256 ?? null,
    actualSha256: actual.sha256 ?? null,
  }
  if (!registered) return { ...base, ok: false, reason: '未在 audit/tic-scope.json 登记' }
  if (!actual.ok) return { ...base, ok: false, reason: actual.reason }
  return { ...base, ok: registered.sha256 === actual.sha256 }
}
// 剧情生成器来源：audit/tic-story-acceptance.json 的 sourceFiles 必须与参考实现一致
const storySourceChecks = (storyAcceptance?.sourceFiles || []).map(entry => {
  const actual = referenceEntry(entry.path)
  return {
    path: entry.path,
    ok: actual.ok && actual.sha256 === entry.sha256,
    registeredSha256: entry.sha256,
    actualSha256: actual.sha256 ?? null,
  }
})
const storySourceOk = Boolean(storyAcceptance) && storySourceChecks.length > 0
  && storySourceChecks.every(entry => entry.ok)
const storyMetaOk = Boolean(STORY_META?.sha256)
  && STORY_META.sha256 === sha256(json(STORY_TEXT))
const storyGatesOk = Boolean(storyAcceptance?.gates?.completeChinese)
  && Boolean(storyAcceptance?.gates?.allChapters)
  && (storyAcceptance?.missing || []).length === 0
// audit/tic-chapter-sources.json 是「已复核的章节定义/准备事实」清单；它指向的 4 个文件不存在时
// 只作证据完整性告警（不冒充来源锁失败，来源本体仍由 scope 逐文件哈希锁定）。
const danglingChapterSources = (chapterSourceAudit?.files || []).filter(entry => {
  const candidates = [
    resolve(WORKSPACE, 'artifacts/migration/tic/p7', entry.file),
    resolve(MOD, 'artifacts/migration/tic/p7', entry.file),
    resolve(WORKSPACE, 'artifacts/migration/tic', entry.file),
    resolve(MOD, 'artifacts/migration/tic', entry.file),
  ]
  return !candidates.some(candidate => existsSync(candidate))
}).map(entry => ({ file: entry.file, expectedSha256: entry.sha256, reason: '审计引用的复核事实文件在仓库内不存在' }))

// ---------------------------------------------------------------- 指南 / 浏览器 / 逐卡账本
function guideFor(chapterId) {
  const relative = `web/scenario-guides/${chapterId}.json`
  const guide = readJson(relative)
  if (!guide) return { path: relative, exists: false, ok: false, reason: '指南 JSON 缺失' }
  const localeOk = language => {
    const locale = guide.locales?.[language]
    if (!locale) return false
    const has = section => Array.isArray(locale[section]) && locale[section].length > 0
    return has('intro') && has('setup') && has('specialRules') && has('resolutions')
      && textLength(locale.intro) > 20 && textLength(locale.setup) > 80
      && textLength(locale.specialRules) > 80 && textLength(locale.resolutions) > 40
  }
  const zh = localeOk('zh'), en = localeOk('en')
  return {
    path: relative,
    exists: true,
    campaignId: guide.campaignId ?? null,
    sourceKind: guide.sourceKind ?? null,
    officialChinese: guide.officialChinese ?? null,
    zh, en,
    // horrorInHighGear / theLairOfDagon 的源文本没有独立「后续剧情」段（见 story-text 键）；
    // 「后续剧情」为空是来源事实，不单独判失败。闪回/回忆在各章的 story 段或剧情文本里。
    storyBlocks: { zh: (guide.locales?.zh?.story || []).length, en: (guide.locales?.en?.story || []).length },
    ok: guide.id === chapterId && guide.campaignId === CAMPAIGN_ID && zh && en,
    reason: guide.id !== chapterId ? '指南 id 与章节不一致' : !zh ? '中文指南缺少 intro/setup/specialRules/resolutions 正文' : !en ? '英文指南缺少 intro/setup/specialRules/resolutions 正文' : null,
  }
}
function browserEvidenceFor(chapterId) {
  const audits = ['audit/tic-browser-acceptance.json', 'audit/tic-interactions-browser.json']
  const tests = []
  const reportStates = []
  for (const audit of audits) {
    const report = readJson(audit, null)
    if (!report) continue
    reportStates.push({ audit, status: report.status ?? null, coverage: report.coverage ?? null,
      tests: (report.tests || []).length, chapterTests: (report.tests || []).filter(test => test.scenario === chapterId).length })
    for (const test of report.tests || []) {
      if (test.scenario !== chapterId) continue
      tests.push({ audit, title: test.title, viewport: test.viewport, status: test.status })
    }
  }
  const desktop = tests.some(test => test.viewport === 'desktop' && test.status === 'passed')
  const mobile = tests.some(test => test.viewport === 'mobile' && test.status === 'passed')
  return {
    desktop, mobile, tests, reports: reportStates,
    ok: desktop && mobile,
    evidence: uniq(tests.map(test => test.audit)).concat(['tests/scenario-guides.browser.mjs', 'tests/playwright/playwright.tic.config.mjs']),
    reason: !tests.length
      ? `浏览器验收证据里没有本章 desktop/mobile 用例（${reportStates.map(report => `${report.audit}:status=${report.status},tests=${report.tests},chapterTests=${report.chapterTests}`).join('；') || '审计文件缺失'}）`
      : desktop && mobile ? null : `缺少${desktop ? '' : 'desktop'}${desktop !== mobile ? '' : '/'}${mobile ? '' : 'mobile'}通过用例`,
  }
}
function literalLedgerFor(chapterCodes) {
  if (!allCardLedger) {
    return { ok: false, ledger: 'audit/tic-all-card-acceptance.json', missing: chapterCodes.slice(0, 20),
      reason: '逐卡验收账本缺失；按 §5.2 不能用源码/测试出现卡号代替' }
  }
  const entries = Array.isArray(allCardLedger.entries) ? allCardLedger.entries : []
  // 通过状态：verified（有测试证据且实现了卡面行为）、simplified（已书面简化的近似实现）、
  // no-behavior（印刷无行为、按「一张有行为的卡=一个文件」不需要条目的卡，如门扉地点）。
  // 只有 missing / blocked 计入缺口（与 §5.2 的「简化必须入账」口径一致）。
  const passing = new Set(entries
    .filter(entry => ['verified', 'simplified', 'no-behavior'].includes(entry.status))
    .map(entry => entry.code))
  const missing = chapterCodes.filter(code => !passing.has(code))
  return {
    ok: missing.length === 0 && chapterCodes.length > 0,
    ledger: 'audit/tic-all-card-acceptance.json',
    missing,
    entries: entries.length,
    summary: allCardLedger.summary || null,
    reason: missing.length ? `未在逐卡账本通过（verified/simplified/no-behavior）：${missing.slice(0, 30).join(', ')}${missing.length > 30 ? ' …' : ''}` : null,
  }
}
const privacyEvidence = ticTestIndex
  .filter(file => file.titles.some(title => PRIVACY_MARKER.test(title)))
  .map(file => ({ file: file.name, titles: file.titles.filter(title => PRIVACY_MARKER.test(title)) }))

// ---------------------------------------------------------------- 逐章验收测试
function chapterTestFor(chapterId) {
  const candidates = uniq([
    `tests/tic-scenario-${chapterId}.test.mjs`,
    `tests/tic-scenario-${kebab(chapterId)}.test.mjs`,
  ])
  const file = candidates.find(candidate => existsSync(resolve(MOD, candidate)))
  if (!file) {
    return {
      file: candidates[0], candidates, exists: false, registered: false, referencesChapter: false,
      ok: false, titles: [], failedTitles: [],
      missingReasons: ['缺少本章验收测试文件；建议实现 ' + candidates[0]],
      acceptance: Object.fromEntries(BEHAVIOR_CHECKS.map(check => [check, { pass: false, titles: [] }])),
    }
  }
  const source = readFileSync(resolve(MOD, file), 'utf8')
  const referencesChapter = source.includes(`chapterFixture('${chapterId}'`)
    || source.includes(`chapterFixture("${chapterId}"`) || source.includes(`scenarios/${chapterId}/`)
  const name = file.split('/').at(-1)
  const registered = SUITE_FILES.has(name)
  const run = runTestFile(file)
  const acceptance = {}
  const missingReasons = []
  if (!referencesChapter) missingReasons.push('验收测试没有引用本章（chapterFixture/scenarios 路径均未出现）')
  if (!registered) missingReasons.push('验收测试未登记 tests/suites.mjs 的任一 tier')
  if (!run.ok) missingReasons.push(`验收测试实跑失败：${run.failedTitles.slice(0, 3).join('；') || '退出码非 0'}`)
  for (const check of BEHAVIOR_CHECKS) {
    const titles = run.titles.filter(title => CHECK_TITLE_MARKERS[check].test(title))
    acceptance[check] = { pass: run.ok && referencesChapter && registered && titles.length > 0, titles }
    if (run.ok && referencesChapter && registered && !titles.length) {
      missingReasons.push(`验收测试缺少 ${check} 断言（标题需命中 ${CHECK_TITLE_MARKERS[check].source}）`)
    }
  }
  return { file, candidates, exists: true, registered, referencesChapter, ok: run.ok && referencesChapter && registered,
    titles: run.titles, failedTitles: run.failedTitles, acceptance, missingReasons }
}

// 现有 tests/tic-*.test.mjs 的静态部分证据（不参与 gate）：标题命中关键词且能归到本章。
// 每个检查最多保留 6 条标题，避免账本膨胀；完整测试清单以 tests/suites.mjs 为准。
function existingEvidenceFor(chapter, chapterDefinitionCodes) {
  const chapterCodes = new Set([...chapterDefinitionCodes])
  const evidence = Object.fromEntries(BEHAVIOR_CHECKS.map(check => [check, []]))
  for (const file of ticTestIndex) {
    const dedicated = file.chapterRefs.includes(chapter.id)
    for (const title of file.titles) {
      const codes = [...title.matchAll(/\b(0\d{4}[ab]?)\b/g)].map(match => match[1])
      if (!dedicated && !codes.some(code => chapterCodes.has(code))) continue
      for (const check of BEHAVIOR_CHECKS) {
        if (evidence[check].length >= 6) continue
        if (CHECK_TITLE_MARKERS[check].test(title)) evidence[check].push({ file: file.name, title })
      }
    }
  }
  return evidence
}

// ---------------------------------------------------------------- 源码稳定性（审计只在源码冻结时可信）
// 对「本账本会读取的内容源码」做一次快照；--write/--check 期间若被并发修改，账本不可信。
function sourceSnapshot() {
  const roots = [
    CAMPAIGN_DIR,
    resolve(MOD, 'src/cards/encounter-entries/theInnsmouthConspiracy'),
    resolve(MOD, 'src/cards/encounter-entries/shared'),
    resolve(MOD, 'src/cards/card-rules.js'),
    resolve(MOD, 'src/cards/core-acceptance.js'),
    resolve(MOD, 'content/scenario-manifest.js'),
    resolve(MOD, 'content/migration-confirmation.js'),
    resolve(MOD, 'tests/suites.mjs'),
  ]
  const lines = []
  for (const root of roots) {
    if (!existsSync(root)) continue
    const files = statSync(root).isDirectory()
      ? walkFiles(root, file => file.endsWith('.js') || file.endsWith('.json')).sort()
      : [root]
    for (const file of files) lines.push(`${rel(file)}:${sha256(readFileSync(file))}`)
  }
  return sha256(lines.join('\n'))
}
const sourceSnapshotAtStart = sourceSnapshot()
// ---------------------------------------------------------------- 逐章计算
const CAMPAIGN_SHARED_FILES = ['chapter-definition.js', 'entry-rules.js', 'chapter-setup.js', 'middle-setup.js',
  'late-setup.js', 'resolutions.js', 'introduction.js', 'flashbacks.js', 'interludes.js', 'manifest.js',
  'flow.js', 'story-text.js', 'chapter-data.json']
const sharedFileHashes = Object.fromEntries(CAMPAIGN_SHARED_FILES
  .filter(file => existsSync(resolve(CAMPAIGN_DIR, file)))
  .map(file => [`content/campaigns/theInnsmouthConspiracy/${file}`, shaFile(`content/campaigns/theInnsmouthConspiracy/${file}`)]))
const items = []
for (const chapter of chapters) {
  const chapterId = chapter.id
  const scenarioRoot = `content/campaigns/theInnsmouthConspiracy/scenarios/${chapterId}/index.js`
  const guide = guideFor(chapterId)
  const meta = chapterMeta.get(chapterId)
  const spec = chapterData[chapterId] || {}
  const files = {}
  const noteFiles = (key, relative) => { if (relative && existsSync(resolve(MOD, relative))) files[key] = shaFile(relative) }
  noteFiles('scenarioIndex', scenarioRoot)
  noteFiles('guide', guide.path)
  const baseMissing = !existsSync(resolve(MOD, scenarioRoot)) || !meta
  if (baseMissing) {
    items.push({
      id: chapterId, code: chapter.code, name: chapter.name, status: 'pending',
      checks: Object.fromEntries(SCENARIO_MIGRATION_CHECKS.map(check => [check, false])),
      evidence: Object.fromEntries(SCENARIO_MIGRATION_CHECKS.map(check => [check, []])),
      notes: {}, inventory: null, gaps: ['章节目录或章节清单缺失'], remaining: ['章节目录或章节清单缺失'],
      fileHashes: files,
    })
    continue
  }
  const module = await import(`../content/campaigns/theInnsmouthConspiracy/scenarios/${chapterId}/index.js`)
  const { scenario, manifest, identities, behavior } = module
  const chapterScopeCodes = uniq((scope?.groups || []).filter(group => group.chapterId === chapterId)
    .flatMap(group => group.codes || []))
  // 条目源码里显式标注的降级/未接线：这是「引擎读点缺口」的真实证据，不能当已实现。
  const chapterEntryDir = resolve(MOD, `src/cards/encounter-entries/theInnsmouthConspiracy/${chapterId}`)
  const engineGaps = []
  for (const file of walkFiles(chapterEntryDir, path => path.endsWith('.js')).sort()) {
    const lines = readFileSync(file, 'utf8').split('\n')
    for (const [index, line] of lines.entries()) {
      if (!/未接线|尚未接线|降级路径|降级为|待主进程|TODO|FIXME/.test(line)) continue
      engineGaps.push({ file: rel(file), line: index + 1, text: line.trim().slice(0, 180) })
    }
  }
  const chapterPendingRequests = pendingPrimitiveRequests.filter(request =>
    request.cards.some(code => chapterScopeCodes.includes(code)) || request.cards.length === 0)
  const zoneReport = (() => { try { return scenarioZoneReport(scenario, manifest) } catch (error) { return { error: error.message } } })()
  const resolutionIds = Object.keys(scenario.resolutions || {})
  const locationDefinitions = Object.values(scenario.locations || {})
  const definitionCodes = new Set([
    ...locationDefinitions.map(originalOf),
    ...(scenario.acts || []).map(originalOf),
    ...(scenario.agendas || []).map(originalOf),
    ...Object.values(scenario.enemies || {}).map(originalOf),
    ...Object.values(scenario.treacheries || {}).map(originalOf),
    ...Object.values(scenario.storyAssets || {}).map(originalOf),
    ...Object.values(scenario.storyFaces || {}).map(originalOf),
  ].filter(Boolean))
  const chapterTest = chapterTestFor(chapterId)
  noteFiles('acceptanceTest', chapterTest.exists ? chapterTest.file : null)

  // ---------- 1. sourceLocked：本章剧本 + 中英 locale 源文件逐文件哈希
  const chapterScope = (scope?.chapters || []).find(entry => entry.id === chapterId)
  const chapterSourcePaths = uniq([
    chapterScope?.gather?.source,
    ...(chapterScope?.guideSources || []),
  ].filter(Boolean))
  const chapterSources = chapterSourcePaths.map(scopeSourceEntry)
  const sourceLocked = referenceOk && chapterSources.length >= 3 && chapterSources.every(entry => entry.ok === true)
    && storySourceOk && storyMetaOk
  const sourceEvidence = uniq([
    'audit/tic-scope.json',
    'audit/tic-story-acceptance.json',
    'content/campaigns/theInnsmouthConspiracy/story-text.js',
    'audit/tic-chapter-sources.json',
    ...chapterSources.map(entry => entry.path),
  ])

  // ---------- 2. identityRegistered：身份表 + 真实卡号 + 章节身份
  const identityCategories = Object.entries(identities || {})
  const identityEntries = identityCategories.flatMap(([, category]) => Object.values(category || {}))
  const identityMapped = identityEntries.length > 0 && identityEntries.every(identity =>
    Boolean(identity?.originalCode) && identity.identityStatus === 'mapped' && Boolean(ALL_CARDS[identity.originalCode]))
  const identityRegistered = identityMapped
    && scenario.id === chapterId && manifest.id === chapterId && (behavior?.id ?? chapterId) === chapterId
    && scenario.referenceCode === chapter.code && manifest.referenceCode === chapter.code
    && ALL_CARDS[chapter.code]?.type === 'scenario'
    && (scope?.chapters || []).some(entry => entry.id === chapterId && entry.code === chapter.code)
  const identityEvidence = uniq([
    scenarioRoot,
    'content/campaigns/theInnsmouthConspiracy/shared.js',
    'content/campaigns/theInnsmouthConspiracy/card-data.js',
    `src/cards/encounter-entries/theInnsmouthConspiracy/${chapterId}/${chapter.code}.js`,
    'audit/tic-scope.json',
  ])

  // ---------- 3. setupAndZones：准备声明 + 区域守恒 + 阶段准备钩子（结构信号）
  const setup = spec.setup || {}
  const gatherSets = Array.isArray(spec.gatherSets) ? spec.gatherSets : []
  const phaseIndex = chapters.findIndex(entry => entry.id === chapterId)
  const phaseModule = phaseIndex < 3 ? 'chapter-setup.js' : phaseIndex < 5 ? 'middle-setup.js' : 'late-setup.js'
  const phaseSource = readFileSync(resolve(MOD, `content/campaigns/theInnsmouthConspiracy/${phaseModule}`), 'utf8')
  const phaseHookLine = phaseSource.split('\n').findIndex(line => line.includes(chapterId)) + 1
  const setupSubsignals = {
    specSetupKeys: Object.keys(setup).length,
    gatherSets: gatherSets.length,
    encounterDeck: (spec.encounterDeck || []).length,
    reservedEncounter: (spec.reservedEncounter || []).length,
    zonesDeclared: Array.isArray(manifest?.zones?.encounterDeck) && Array.isArray(manifest?.zones?.setAside),
    encounterCards: zoneReport?.encounterCards ?? null,
    setAsideCards: zoneReport?.declaredSetAsideCards ?? null,
    optionalSets: Object.keys(zoneReport?.optionalSets || {}),
    duplicateActiveZoneCodes: zoneReport?.duplicateActiveZoneCodes || [],
    optionalZoneCollisions: zoneReport?.optionalZoneCollisions || [],
    phaseHooks: typeof behavior?.setupLocations === 'function' || typeof behavior?.afterDeckSetup === 'function',
    phaseModule,
    phaseHookLines: phaseHookLine > 0 ? [phaseHookLine] : [],
    zoneReportError: zoneReport?.error || null,
  }
  const setupStructural = Object.keys(setup).length >= 8 && gatherSets.length > 0
    && (spec.encounterDeck || []).length > 0 && Array.isArray(spec.reservedEncounter)
    && setupSubsignals.zonesDeclared && (zoneReport?.encounterCards || 0) > 0
    && !zoneReport?.error && setupSubsignals.optionalZoneCollisions.length === 0
    && setupSubsignals.duplicateActiveZoneCodes.length === 0
    && setupSubsignals.phaseHooks && phaseHookLine > 0
  const setupEvidence = uniq([
    scenarioRoot, 'content/campaigns/theInnsmouthConspiracy/chapter-data.json',
    `content/campaigns/theInnsmouthConspiracy/${phaseModule}:${phaseHookLine || 1}`,
    'content/scenario-manifest.js',
    chapterTest.exists ? chapterTest.file : null,
  ].filter(Boolean))

  // ---------- 4. actsAndAgendas：全部幕/议程的剧本规则 + 剧本行动归属
  const stageCards = [...(scenario.acts || []), ...(scenario.agendas || [])]
  const stageRules = []
  for (const card of stageCards) {
    const code = originalOf(card)
    const entryPath = entryFiles.get(code)
    let rule = null, loadError = null
    if (entryPath) {
      try { rule = (await import(`../${entryPath.replace(/^src\//, 'src/')}`)).default } catch (error) { loadError = error.message }
    }
    // 「揭示钩子」有三种合法落地（数据驱动，内容层不写卡号分支）：
    //   · actRule/agendaRule.onReveal —— 普通幕/议程；
    //   · actRule.chapterSetup（字符串数据键）—— 条目声明章节布置键，content entry-rules#actReveal
    //     优先走 chapterActBackSetup，onReveal 永远不会被读（07315 即此形态）；
    //   · actRule.objective + actRule.onComplete —— 并行幕（07317/07318 没有「翻开」路径，
    //     由 flashback14 入场、目标达成后 onComplete 结算）。
    const revealHookOf = rule => {
      const actRule = rule?.actRule
      if (typeof actRule?.onReveal === 'function') return true
      if (typeof actRule?.chapterSetup === 'string' && actRule.chapterSetup) return true
      if (typeof actRule?.objective === 'function' && typeof actRule?.onComplete === 'function') return true
      return typeof rule?.agendaRule?.onReveal === 'function'
    }
    const onReveal = revealHookOf(rule)
    const printed = `${ALL_CARDS[code]?.text || ''}\n${ALL_CARDS[code]?.textZh || ''}`
    const needsObjective = /objective|目标/i.test(printed)
    // objective 有两种合法落地：actRule.objective 函数；或条目原生 abilities 的 groupClues 费用
    // （07236 的正面向目标就是后者，见该文件注释）。
    const hasObjective = typeof rule?.actRule?.objective === 'function' || typeof rule?.agendaRule?.objective === 'function'
      || (Array.isArray(rule?.abilities) && rule.abilities.some(ability => ability?.cost?.groupClues != null))
    stageRules.push({
      code, type: card.type, entry: entryPath || null, onReveal,
      needsObjective, hasObjective: needsObjective ? hasObjective : null,
      loadError,
    })
  }
  const stageRulesWithHook = stageRules.filter(rule => rule.loadError || !rule.onReveal
    || (rule.needsObjective && !rule.hasObjective))
  // 章节遭遇组里的其它幕/议程（变体/未被 scenario.acts/agendas 选中的印刷卡）：它们仍在牌堆里，
  // 揭示时同样走 entry-rules 的 actReveal/agendaReveal，缺条目或缺 onReveal 都会 throw。
  const mainStageCodes = new Set(stageCards.map(originalOf))
  const variantStageCards = chapterScopeCodes.filter(code => ['act', 'agenda'].includes(ALL_CARDS[code]?.type)
    && !mainStageCodes.has(code))
  const variantGaps = []
  for (const code of variantStageCards) {
    const entryPath = entryFiles.get(code)
    if (!entryPath) { variantGaps.push({ code, reason: '缺单卡条目' }); continue }
    let rule = null
    try { rule = (await import(`../${entryPath}`)).default } catch (error) { variantGaps.push({ code, reason: `导入失败：${error.message}` }); continue }
    // 变体幕/议程同样接受 chapterSetup 数据键与并行幕的 objective+onComplete 形态（07315/07317/07318）。
    const variantRevealHook = (() => {
      const actRule = rule?.actRule
      if (typeof actRule?.onReveal === 'function') return true
      if (typeof actRule?.chapterSetup === 'string' && actRule.chapterSetup) return true
      if (typeof actRule?.objective === 'function' && typeof actRule?.onComplete === 'function') return true
      return typeof rule?.agendaRule?.onReveal === 'function'
    })()
    if (!variantRevealHook) variantGaps.push({ code, reason: '缺揭示钩子（onReveal / chapterSetup / objective+onComplete）' })
  }
  // §4.5.1：剧本卡行动归属。TIC 的幕/议程行动实现为单卡条目的原生 abilities（注册在幕/议程实体上），
  // 不使用 scenarioAction/encounterAction 规则；这里检查「印刷带 [action]/[fast]/[free] 的幕/议程确实有声明的
  // abilities」，避免条目只剩 onReveal 而卡面行动无人读。若将来改走 scriptCards 声明，需要在关卡数据里登记。
  const scriptCardsDeclared = Boolean(scenario.scriptCards && typeof scenario.scriptCards === 'object')
  const stageActionGaps = []
  for (const card of stageCards) {
    const code = originalOf(card)
    const printed = `${ALL_CARDS[code]?.text || ''}\n${ALL_CARDS[code]?.textZh || ''}`
    // 只认「行首的自身能力标记」：例如 07167 正文只是引用「on those locations 的 [fast] 能力」，
    // 不是它自己的行动，不能按缺 abilities 计。
    if (!/(?:^|\n)\s*(?:\[(?:action|fast|free|reaction)\]|(?:Action|Fast|Free|Reaction)\s*[.:：])/i.test(printed)) continue
    const entryPath = entryFiles.get(code)
    if (!entryPath) continue // 缺条目已在 stageRules 里计缺口
    let rule = null
    try { rule = (await import(`../${entryPath}`)).default } catch { rule = null }
    if (!Array.isArray(rule?.abilities) || rule.abilities.length === 0) stageActionGaps.push(code)
  }
  const scriptCardsOk = stageActionGaps.length === 0
  const nativeStageAbilities = stageRules.filter(rule => rule.entry).length
  const actsStructural = (scenario.acts || []).length > 0 && (scenario.agendas || []).length > 0
    && typeof behavior?.actReveal === 'function' && typeof behavior?.agendaReveal === 'function'
    && stageRules.length > 0 && stageRulesWithHook.length === 0 && variantGaps.length === 0 && scriptCardsOk
  const actsEvidence = uniq([
    scenarioRoot, 'content/campaigns/theInnsmouthConspiracy/entry-rules.js',
    'content/campaigns/theInnsmouthConspiracy/chapter-data.json',
    ...stageRules.map(rule => rule.entry || `src/cards/encounter-entries/<missing>/${rule.code}.js`),
    chapterTest.exists ? chapterTest.file : null,
  ].filter(Boolean))

  // ---------- 5. locationsAndConnections：地点身份/正反面 + 摆放/连接来源 + 有印刷行为的地点条目
  const missingLocationRules = locationDefinitions.filter(location => {
    const code = originalOf(location)
    if (entryFiles.has(code)) return false
    const printed = `${ALL_CARDS[code]?.text || ''}\n${ALL_CARDS[code]?.textZh || ''}`
    return /\[action\]|\[fast\]|\[reaction\]|\[free\]|Forced|强制|Objective|目标|Parley|谈判|cannot|不能|禁止/i.test(printed)
  }).map(location => originalOf(location))
  const connectivityKeys = ['connections', 'grid', 'adjacentInitialPositions', 'randomInitialSlots',
    'initialLocations', 'initialRandomLocations', 'initialTunnelPool', 'randomTunnelPhysicalPool', 'roadDeck',
    'tidalTunnelDeck', 'expandedMap', 'longWayPool']
  const connectivitySource = connectivityKeys.filter(key => key in setup)
  const placementCalls = ['map.place(', 'map.initializeRoad(', 'initialPosition(', 'map.expand(', 'initialTunnelPositions']
  const placementWired = placementCalls.some(call => phaseSource.includes(call))
  const locationsStructural = locationDefinitions.length > 0
    && locationDefinitions.every(location => Boolean(originalOf(location)) && Boolean(ALL_CARDS[originalOf(location)]))
    && connectivitySource.length > 0 && placementWired
    && missingLocationRules.length === 0
  const locationsEvidence = uniq([
    scenarioRoot, 'content/campaigns/theInnsmouthConspiracy/chapter-data.json',
    `content/campaigns/theInnsmouthConspiracy/${phaseModule}`,
    ...missingLocationRules.slice(0, 8).map(code => `src/cards/encounter-entries/<missing>/${code}.js`),
    ...locationDefinitions.slice(0, 8).map(location => entryFiles.get(originalOf(location))).filter(Boolean),
    chapterTest.exists ? chapterTest.file : null,
  ].filter(Boolean))

  // ---------- 6. encounterBehaviors：本章敌人/诡计/剧情资产 + 共享遭遇组全部落地
  const chapterGroupCodes = chapterScopeCodes
  const sharedEncounterCodes = uniq((gatherSets || []).flatMap(set => {
    const camel = set.replace(/_([a-z])/g, (_, char) => char.toUpperCase())
    return cardsByEncounterCode.get(camel) || []
  }))
  const encounterDefinitionCodes = uniq([
    ...Object.values(scenario.enemies || {}).map(originalOf),
    ...Object.values(scenario.treacheries || {}).map(originalOf),
    ...Object.values(scenario.storyAssets || {}).map(originalOf),
  ])
  const implemented = code => entryFiles.has(code) || implementedFor(code) || coreCardVerified(code)
  const recordCodes = uniq([
    ...chapterGroupCodes,
    ...sharedEncounterCodes,
    ...(spec.encounterDeck || []),
    ...(spec.reservedEncounter || []),
    chapter.code,
  ])
  const records = recordCodes.map(code => ({ code, type: ALL_CARDS[code]?.type || 'unknown' }))
  const coveredRecords = records.filter(record => record.type === 'scenario'
    ? scenario.referenceCode === record.code
    : definitionCodes.has(record.code) || implemented(record.code)
      || (frontCodesOf.get(record.code) || []).some(front => definitionCodes.has(front)))
  const uncoveredRecords = records.filter(record => !coveredRecords.includes(record)).map(record => record.code)
  // 幕/议程/地点/剧本参考卡的落点由各自检查负责；encounterBehaviors 只对敌人/诡计/剧情资产+共享组负责。
  const ENCOUNTER_TYPES = ['enemy', 'treachery', 'story', 'asset']
  const uncoveredEncounterRecords = records.filter(record => !coveredRecords.includes(record)
    && ENCOUNTER_TYPES.includes(record.type) && !encounterDefinitionCodes.includes(record.code))
    .map(record => record.code)
  const encounterPending = uniq([...encounterDefinitionCodes, ...sharedEncounterCodes
    .filter(code => ['enemy', 'treachery', 'asset', 'story'].includes(ALL_CARDS[code]?.type))])
    .filter(code => !implemented(code))
  const rulesPending = [...Object.values(scenario.enemies || {}), ...Object.values(scenario.treacheries || {})]
    .filter(card => card.rulesPending).map(originalOf)
  const encounterStructural = encounterDefinitionCodes.length > 0 && encounterPending.length === 0
    && rulesPending.length === 0 && uncoveredEncounterRecords.length === 0
  const encounterEvidence = uniq([
    scenarioRoot, 'audit/tic-scope.json', 'audit/tic-mechanism-scan.json',
    'src/cards/core-acceptance.js',
    ...encounterDefinitionCodes.slice(0, 10).map(code => entryFiles.get(code)).filter(Boolean),
    ...encounterPending.slice(0, 8).map(code => `src/cards/encounter-entries/<missing>/${code}.js`),
    chapterTest.exists ? chapterTest.file : null,
  ].filter(Boolean))

  // ---------- 7. chaosEffects：本章提示卡的 scenarioRule + 四档提示文本 + 章节行为读点
  const referenceCode = chapter.code
  const referenceEntryPath = entryFiles.get(referenceCode)
  let referenceRule = null
  if (referenceEntryPath) {
    try { referenceRule = (await import(`../${referenceEntryPath}`)).default?.scenarioRule ?? null } catch { referenceRule = null }
  }
  const chaosReference = chapterScope?.chaosReference || {}
  const chaosSubsignals = {
    behaviorResolveChaosToken: typeof behavior?.resolveChaosToken === 'function',
    behaviorAfterTest: typeof behavior?.afterTest === 'function',
    referenceEntry: referenceEntryPath || null,
    resolveChaosToken: typeof referenceRule?.resolveChaosToken === 'function',
    applyTokenEffect: typeof referenceRule?.applyTokenEffect === 'function',
    easyStandard: clean(chaosReference.easyStandard).length > 40,
    hardExpert: clean(chaosReference.hardExpert).length > 40,
  }
  const chaosStructural = chaosSubsignals.behaviorResolveChaosToken
    && chaosSubsignals.referenceEntry
    && chaosSubsignals.resolveChaosToken
    && chaosSubsignals.easyStandard && chaosSubsignals.hardExpert
  const chaosEvidence = uniq([
    scenarioRoot, 'content/campaigns/theInnsmouthConspiracy/entry-rules.js',
    referenceEntryPath,
    'audit/tic-scope.json',
    chapterTest.exists ? chapterTest.file : null,
  ].filter(Boolean))

  // ---------- 8. literalCardBehavior：逐卡账本（§5.2）
  // 逐卡账本只覆盖 TIC 范围（scope.cards）；章节遭遇定义里会收进跨循环核心卡（011xx），
  // 它们的字面行为归核心卡账本，不能要求出现在 TIC 账本里（否则 literalCardBehavior 永远 false）。
  const ticScopeCodes = new Set((scope.cards || []).map(card => card.code))
  const literalScope = uniq([...chapterGroupCodes, ...encounterDefinitionCodes])
    .filter(code => ALL_CARDS[code] && code !== chapter.code && ticScopeCodes.has(code))
  const literal = literalLedgerFor(literalScope)

  // ---------- 9. resolutionsAndRecords：结局键 + 结算读点 + 记录/混乱袋写入
  const narrativeResolutionKeys = resolutionIds.filter(key => /^resolution/i.test(key))
  const missingResolutionStory = narrativeResolutionKeys.filter(key => {
    const zh = textLength(STORY_TEXT?.zh?.scenarios?.[chapterId]?.resolutions?.[key])
    const en = textLength(STORY_TEXT?.en?.scenarios?.[chapterId]?.resolutions?.[key])
    return zh < 40 || en < 40
  })
  const campaignResolutionsSource = readFileSync(resolve(MOD, 'content/campaigns/theInnsmouthConspiracy/resolutions.js'), 'utf8')
  const recordSchema = campaignManifest?.recordSchema && Object.keys(campaignManifest.recordSchema).length > 0
  const flowNode = flow?.nodes?.[chapterId]
  const resolutionsSubsignals = {
    resolutionIds: narrativeResolutionKeys,
    resolutionsInSpec: Object.keys(spec.resolutions || {}).length,
    behaviorResolution: typeof behavior?.resolution === 'function',
    missingResolutionStory,
    chapterBranchInResolutions: campaignResolutionsSource.includes(`'${chapterId}'`),
    flowNode: flowNode ? { type: flowNode.type, next: flowNode.next } : null,
    recordSchema: Boolean(recordSchema),
    manifestResolutionIds: (manifest?.resolutionIds || []).length,
  }
  const resolutionsStructural = narrativeResolutionKeys.length > 0 && missingResolutionStory.length === 0
    && resolutionsSubsignals.behaviorResolution && resolutionsSubsignals.chapterBranchInResolutions
    && Boolean(flowNode?.next) && recordSchema
  const resolutionsEvidence = uniq([
    scenarioRoot, 'content/campaigns/theInnsmouthConspiracy/resolutions.js',
    'content/campaigns/theInnsmouthConspiracy/story-text.js',
    'content/campaigns/theInnsmouthConspiracy/flow.js',
    'content/campaigns/theInnsmouthConspiracy/manifest.js',
    chapterTest.exists ? chapterTest.file : null,
  ].filter(Boolean))

  // ---------- 10. storyText：导入检查 + 本章中英正文 + 战役序章/幕间/尾声 + 指南 + 隐私投影证据
  const storyZh = STORY_TEXT?.zh?.scenarios?.[chapterId]
  const storyEn = STORY_TEXT?.en?.scenarios?.[chapterId]
  const narrativeKeys = keys => Object.keys(keys || {}).filter(key => /^(intro|townInfo|flashback)/i.test(key))
  const narrativeComplete = language => {
    const story = language === 'zh' ? storyZh : storyEn
    if (!story) return false
    const introKeys = narrativeKeys(story)
    const introText = sum(introKeys.map(key => textLength(story[key])))
    return introKeys.length > 0 && introText > 80
  }
  const baseNarrative = language => {
    const base = STORY_TEXT?.[language]?.base || {}
    const interludes = ['interlude1', 'interlude2', 'interlude3', 'interlude4'].every(key => textLength(base[key]) > 80)
    return interludes && textLength(base.epilogue) > 80
  }
  const narrativeRaw = JSON.stringify([
    ...narrativeKeys(storyZh).map(key => storyZh[key]),
    ...narrativeKeys(storyEn).map(key => storyEn[key]),
    ...narrativeResolutionKeys.map(key => [storyZh?.resolutions?.[key], storyEn?.resolutions?.[key]]),
  ])
  const controlMarkers = CONTROL_MARKERS.test(narrativeRaw)
  const presentationTags = [...new Set([...narrativeRaw.matchAll(/<([a-zA-Z][a-zA-Z0-9-]*)/g)].map(match => match[1].toLowerCase()))]
  const storySubsignals = {
    importGates: storyGatesOk && storySourceOk && storyMetaOk,
    sourceFiles: storySourceChecks.length,
    zhChapter: Boolean(storyZh), enChapter: Boolean(storyEn),
    narrativeCompleteZh: narrativeComplete('zh'), narrativeCompleteEn: narrativeComplete('en'),
    baseNarrativeZh: baseNarrative('zh'), baseNarrativeEn: baseNarrative('en'),
    narrativeResolutionKeys,
    missingResolutionStoryBothLanguages: missingResolutionStory,
    guide: { path: guide.path, ok: guide.ok, zh: guide.zh, en: guide.en, storyBlocks: guide.storyBlocks, reason: guide.reason },
    controlMarkers,
    presentationTags,
    privacyEvidence,
  }
  const storyOk = storySubsignals.importGates && storyZh && storyEn
    && narrativeComplete('zh') && narrativeComplete('en')
    && baseNarrative('zh') && baseNarrative('en')
    && missingResolutionStory.length === 0 && !controlMarkers
    && guide.ok && privacyEvidence.length > 0
  const storyEvidence = uniq([
    'content/campaigns/theInnsmouthConspiracy/story-text.js',
    'audit/tic-story-acceptance.json',
    'content/campaigns/theInnsmouthConspiracy/introduction.js',
    'content/campaigns/theInnsmouthConspiracy/resolutions.js',
    'content/campaigns/theInnsmouthConspiracy/interludes.js',
    guide.path,
    ...privacyEvidence.map(entry => entry.file),
  ])

  // ---------- 11. saveReplay：本章验收测试里的存档/恢复确定性断言
  const saveReplayEvidence = uniq([chapterTest.exists ? chapterTest.file : null,
    'tests/fixtures/replay/tic-p7-baseline.json', 'audit/tic-p7-baseline.json'].filter(Boolean))

  // ---------- 12. browserAcceptance：实机浏览器证据
  const browser = browserEvidenceFor(chapterId)
  const browserAcceptance = browser.ok
  const browserEvidence = browser.evidence

  // ---------- 组装 checks / evidence
  const chapterChecks = {
    sourceLocked: Boolean(sourceLocked),
    identityRegistered: Boolean(identityRegistered),
    setupAndZones: Boolean(setupStructural && chapterTest.acceptance.setupAndZones.pass),
    actsAndAgendas: Boolean(actsStructural && chapterTest.acceptance.actsAndAgendas.pass),
    locationsAndConnections: Boolean(locationsStructural && chapterTest.acceptance.locationsAndConnections.pass),
    encounterBehaviors: Boolean(encounterStructural && chapterTest.acceptance.encounterBehaviors.pass),
    literalCardBehavior: Boolean(literal.ok),
    chaosEffects: Boolean(chaosStructural && chapterTest.acceptance.chaosEffects.pass),
    resolutionsAndRecords: Boolean(resolutionsStructural && chapterTest.acceptance.resolutionsAndRecords.pass),
    storyText: Boolean(storyOk),
    saveReplay: Boolean(chapterTest.acceptance.saveReplay.pass),
    browserAcceptance: Boolean(browserAcceptance),
  }
  const evidence = {
    sourceLocked: sourceEvidence,
    identityRegistered: identityEvidence,
    setupAndZones: setupEvidence,
    actsAndAgendas: actsEvidence,
    locationsAndConnections: locationsEvidence,
    encounterBehaviors: encounterEvidence,
    literalCardBehavior: literal.ledger ? [literal.ledger, scenarioRoot] : [scenarioRoot],
    chaosEffects: chaosEvidence,
    resolutionsAndRecords: resolutionsEvidence,
    storyText: storyEvidence,
    saveReplay: saveReplayEvidence,
    browserAcceptance: browserEvidence,
  }
  const gaps = []
  if (!sourceLocked) gaps.push('sourceLocked：来源锁/剧情来源哈希不一致或参考实现缺失')
  if (!identityRegistered) gaps.push('identityRegistered：身份表/章节身份未全部 mapped')
  const structuralByCheck = {
    setupAndZones: setupStructural,
    actsAndAgendas: actsStructural,
    locationsAndConnections: locationsStructural,
    encounterBehaviors: encounterStructural,
    chaosEffects: chaosStructural,
    resolutionsAndRecords: resolutionsStructural,
  }
  const structuralGapText = {
    setupAndZones: () => [
      zoneReport?.error ? `区域守恒复算失败：${zoneReport.error}` : null,
      setupSubsignals.phaseHooks && setupSubsignals.phaseHookLines.length ? null : `阶段准备未覆盖本章（${phaseModule} 无本章分支）`,
      setupSubsignals.zoneReportError ? `scenarioZoneReport 失败：${setupSubsignals.zoneReportError}` : null,
      setupSubsignals.duplicateActiveZoneCodes.length ? `初始区域重复入牌：${setupSubsignals.duplicateActiveZoneCodes.join(', ')}` : null,
    ].filter(Boolean).join('；') || '准备/区域声明或守恒未通过',
    actsAndAgendas: () => [
      stageRulesWithHook.map(rule => rule.code).length
        ? `缺幕/议程规则或目标：${stageRulesWithHook.map(rule => `${rule.code}(${rule.loadError ? '导入失败' : !rule.onReveal ? '缺 onReveal' : '缺 objective'})`).join(', ')}`
        : null,
      variantGaps.length ? `变体幕/议程未落地：${variantGaps.map(gap => `${gap.code}(${gap.reason})`).join(', ')}` : null,
      stageActionGaps.length ? `卡面行动缺 abilities：${stageActionGaps.join(', ')}` : null,
    ].filter(Boolean).join('；') || '幕/议程结构未通过',
    locationsAndConnections: () => [
      missingLocationRules.length ? `有印刷行为但缺地点条目：${missingLocationRules.join(', ')}` : null,
      connectivitySource.length === 0 ? '缺少连接/摆放数据（setup.connections/grid/initialLocations…）' : null,
      placementWired ? null : '阶段准备没有 map.place/initialPosition 等实际摆放调用',
    ].filter(Boolean).join('；') || '地点/连接结构未通过',
    encounterBehaviors: () => [
      encounterPending.length ? `遭遇卡未实现：${encounterPending.join(', ')}` : null,
      rulesPending.length ? `rulesPending：${rulesPending.join(', ')}` : null,
      uncoveredEncounterRecords.length ? `本章遭遇记录无落点：${uncoveredEncounterRecords.join(', ')}` : null,
    ].filter(Boolean).join('；') || '遭遇行为结构未通过',
    chaosEffects: () => [
      chaosSubsignals.referenceEntry ? null : '缺本章提示卡条目',
      chaosSubsignals.resolveChaosToken ? null : '提示卡条目缺 scenarioRule.resolveChaosToken',
      chaosSubsignals.easyStandard && chaosSubsignals.hardExpert ? null : '缺 Easy/Standard 或 Hard/Expert 四档符号文本',
    ].filter(Boolean).join('；') || '混乱符号结构未通过',
    resolutionsAndRecords: () => [
      missingResolutionStory.length ? `结局键缺中英正文：${missingResolutionStory.join(', ')}` : null,
      resolutionsSubsignals.chapterBranchInResolutions ? null : 'resolutions.js 缺本章分支',
      flowNode?.next ? null : '平台流程缺本章节点/后继',
    ].filter(Boolean).join('；') || '结局/记录结构未通过',
  }
  for (const check of BEHAVIOR_CHECKS) {
    if (chapterChecks[check]) continue
    const structural = structuralByCheck[check] ?? true
    if (!structural) {
      gaps.push(`${check}：结构缺口 — ${structuralGapText[check]()}`)
    } else if (!chapterTest.exists) {
      gaps.push(`${check}：结构信号已就绪，但缺本章验收测试文件 ${chapterTest.candidates[0]}`)
    } else if (!chapterTest.ok) {
      gaps.push(`${check}：本章验收测试未通过/未登记（${chapterTest.missingReasons[0] || '未知原因'}）`)
    } else {
      gaps.push(`${check}：验收测试缺该项通过断言（标题需命中 ${CHECK_TITLE_MARKERS[check].source}）`)
    }
  }
  if (!literal.ok) gaps.push(`literalCardBehavior：${literal.reason}`)
  if (!storyOk) gaps.push('storyText：中英正文/指南/隐私投影证据不完整')
  if (!browserAcceptance) gaps.push(`browserAcceptance：${browser.reason}`)

  const notes = {
    chapterTest: {
      file: chapterTest.file, candidates: chapterTest.candidates, exists: chapterTest.exists,
      registered: chapterTest.registered, referencesChapter: chapterTest.referencesChapter,
      passed: chapterTest.ok, passedCases: chapterTest.titles.length, failedCases: chapterTest.failedTitles.length,
      missingReasons: chapterTest.missingReasons,
    },
    subsignals: {
      /** 行为类检查的结构信号（引擎读点/单卡条目/覆盖）。false 表示即使补了验收测试也仍会失败。 */
      structural: {
        setupAndZones: setupStructural,
        actsAndAgendas: actsStructural,
        locationsAndConnections: locationsStructural,
        encounterBehaviors: encounterStructural,
        chaosEffects: chaosStructural,
        resolutionsAndRecords: resolutionsStructural,
      },
      setupAndZones: setupSubsignals,
      actsAndAgendas: {
        stageCards: stageRules,
        rulesWithHookMissing: stageRulesWithHook.map(rule => rule.code),
        /** 章节遭遇组里的其它幕/议程（变体）：缺条目或缺 onReveal 同样会在揭示时 throw。 */
        variantStageCards,
        variantGaps,
        scriptCardsDeclared,
        nativeStageAbilities,
        /**
         * 印刷带 [action]/[fast]/[free] 但条目没有声明 abilities 的幕/议程：
         * 这些卡面行动没有可执行路径（§4.5.1 按未完成计）。
         */
        stageActionGaps,
      },
      locationsAndConnections: {
        locations: locationDefinitions.length,
        connectivitySource,
        placementWired,
        missingLocationRules,
      },
      encounterBehaviors: {
        encounterDefinitionCodes: encounterDefinitionCodes.length,
        sharedEncounterCodes: sharedEncounterCodes.length,
        implementedMissing: encounterPending,
        rulesPending,
        records: records.length,
        coveredRecords: coveredRecords.length,
        uncoveredRecords,
      },
      chaosEffects: chaosSubsignals,
      resolutionsAndRecords: resolutionsSubsignals,
      storyText: storySubsignals,
      /** 源码里显式标注的降级/未接线（引擎读点缺口），例如 07236/07237 的 advanceAgendaTo。 */
      engineGaps,
    },
    pendingPrimitiveRequests: chapterPendingRequests,
    existingEvidence: existingEvidenceFor(chapter, [...chapterGroupCodes, ...definitionCodes]),
  }
  const inventory = {
    locations: locationDefinitions.length,
    acts: (scenario.acts || []).length,
    agendas: (scenario.agendas || []).length,
    enemies: Object.keys(scenario.enemies || {}).length,
    treacheries: Object.keys(scenario.treacheries || {}).length,
    storyAssets: Object.keys(scenario.storyAssets || {}).length,
    resolutions: narrativeResolutionKeys,
    encounterCards: zoneReport?.encounterCards ?? null,
    setAsideCards: zoneReport?.declaredSetAsideCards ?? null,
    chapterRecords: records.length,
    chapterRecordsCovered: coveredRecords.length,
    identities: identityEntries.length,
  }
  const status = SCENARIO_MIGRATION_CHECKS.every(check => chapterChecks[check]) ? 'verified'
    : chapterChecks.sourceLocked && chapterChecks.identityRegistered ? 'development' : 'pending'
  items.push({
    id: chapterId,
    code: chapter.code,
    name: chapter.name,
    nameEn: chapter.nameEn,
    status,
    checks: chapterChecks,
    evidence,
    notes,
    inventory,
    fileHashes: files,
    gaps,
  })
}

// ---------------------------------------------------------------- 汇总
const sourceStableDuringRun = sourceSnapshot() === sourceSnapshotAtStart
const incompleteItems = items.filter(item => !SCENARIO_MIGRATION_CHECKS.every(check => item.checks[check]))
const checkTotals = Object.fromEntries(SCENARIO_MIGRATION_CHECKS.map(check =>
  [check, items.filter(item => item.checks?.[check]).length]))
// 结构信号就绪章数（行为类）：补验收测试后这些检查才会真正可过。
const structuralTotals = Object.fromEntries(['setupAndZones', 'actsAndAgendas', 'locationsAndConnections',
  'encounterBehaviors', 'chaosEffects', 'resolutionsAndRecords'].map(check =>
  [check, items.filter(item => item.notes?.subsignals?.structural?.[check]).length]))
const missingChapterTests = items.filter(item => !item.notes?.chapterTest?.exists).map(item => item.id)
const missingChapterTestFiles = items.map(item => item.notes?.chapterTest?.file).filter(Boolean)
// P8：TIC 战役重放基线（rep 维护）。旧 tic-p7-baseline 只有跨循环 13 局；P8 新增
// tests/fixtures/replay/tic-p8-baseline.json（含 8 章 TIC recipe）后，saveReplay 的
// replayCoversTicChapters 才为 true。证据文件 audit/tic-p8-replay.json 的 fixture.path
// 也是候选（避免两份清单命名漂移）。**优先取覆盖了本战役章节的基线**（P8 基线），
// 再退回第一个可用清单——否则 p7 的跨循环基线会先命中，永远看不到 TIC 覆盖。
const replayCandidates = uniq([
  'tests/fixtures/replay/tic-p7-baseline.json',
  'tests/fixtures/replay/tic-p8-baseline.json',
  (readJson('audit/tic-p8-replay.json')?.fixture?.path || null),
].filter(Boolean))
const campaignsOfReplay = report => uniq((report?.fixtures || [])
  .map(fixture => fixture.recipe?.settings?.campaignId || fixture.recipe?.campaignId).filter(Boolean))
const replayCandidateReports = replayCandidates.map(candidate => ({ path: candidate, report: readJson(candidate) }))
  .filter(entry => entry.report?.fixtures)
const replayChosen = replayCandidateReports.find(entry => campaignsOfReplay(entry.report).includes(CAMPAIGN_ID))
  || replayCandidateReports[0]
const replayFixture = replayChosen?.report || readJson('tests/fixtures/replay/tic-p7-baseline.json')
const replayFixturePath = replayChosen?.path || 'tests/fixtures/replay/tic-p7-baseline.json'
const replayFixtureCampaigns = campaignsOfReplay(replayFixture)
const replayCoversTicChapters = replayFixtureCampaigns.includes(CAMPAIGN_ID)
const staleEvidence = []
for (const [name, relative] of [
  ['nodeAcceptance', 'audit/tic-node-acceptance.json'],
  ['regression', 'audit/tic-regression.json'],
  ['interactionRegression', 'audit/tic-interaction-regression.json'],
]) {
  if (!existsSync(resolve(MOD, relative))) { staleEvidence.push({ name, file: relative, status: 'missing' }); continue }
  const fresh = Boolean(currentEvidence(name === 'nodeAcceptance' ? 'node-acceptance'
    : name === 'regression' ? 'regression' : 'interaction-regression'))
  staleEvidence.push({ name, file: relative, status: fresh ? 'fresh' : 'stale' })
}
const report = {
  schemaVersion: 1,
  campaignId: CAMPAIGN_ID,
  milestone: 'M5',
  stage: 'P8',
  generatedFrom: 'production registration',
  productionGate: 'playable',
  generatedBy: 'node tools/audit-tic-scenarios.mjs --write',
  checks: SCENARIO_MIGRATION_CHECKS,
  summary: {
    chapters: items.length,
    completeChapters: items.filter(item => item.status === 'verified').length,
    developmentChapters: items.filter(item => item.status === 'development').length,
    pendingChapters: items.filter(item => item.status === 'pending').length,
    checkTotals,
    structuralTotals,
    missingChapterTests,
    missingChapterTestFiles,
    literalCardLedger: allCardLedger ? {
      file: 'audit/tic-all-card-acceptance.json',
      entries: (allCardLedger.entries || []).length,
      pending: allCardLedger.summary?.pending ?? null,
    } : null,
    browserEvidence: browserReport ? { status: browserReport.status, coverage: browserReport.coverage } : null,
    storyImport: storyAcceptance ? {
      gates: storyAcceptance.gates,
      missing: (storyAcceptance.missing || []).length,
      sourceFiles: (storyAcceptance.sourceFiles || []).length,
    } : null,
    referenceAvailable: referenceOk,
    replayFixtureFile: replayFixturePath,
    replayFixtures: replayFixture?.fixtures?.length ?? null,
    replayFixtureCampaigns,
    replayCoversTicChapters,
    primitiveRequests: {
      total: primitiveRequests.length,
      pending: pendingPrimitiveRequests.length,
      pendingFiles: pendingPrimitiveRequests.map(request => request.file),
    },
    engineGapNotes: items.reduce((total, item) => total + (item.notes?.subsignals?.engineGaps?.length || 0), 0),
  },
  status: items.every(item => item.status === 'verified') ? 'verified'
    : items.every(item => item.status !== 'pending') ? 'development' : 'pending',
  sourceStableDuringRun,
  evidenceSources: {
    scope: 'audit/tic-scope.json',
    story: 'audit/tic-story-acceptance.json',
    browser: 'audit/tic-browser-acceptance.json',
    chapterSourceAudit: 'audit/tic-chapter-sources.json',
    allCardLedger: allCardLedger ? 'audit/tic-all-card-acceptance.json' : null,
    guides: items.map(item => `web/scenario-guides/${item.id}.json`),
    acceptanceTests: missingChapterTestFiles,
    candidateAcceptanceTests: items.map(item => item.notes?.chapterTest?.candidates?.[0]).filter(Boolean),
    primitiveRequests: 'artifacts/migration/tic/p7/primitive-requests/',
  },
  sharedFileHashes,
  storySources: storySourceChecks,
  staleEvidence,
  pendingPrimitiveRequests,
  danglingEvidence: danglingChapterSources,
  items,
  remaining: uniq([
    ...incompleteItems.flatMap(item => item.gaps || []),
    !referenceOk ? '参考实现目录缺失，sourceLocked 无法核对' : null,
    !allCardLedger ? 'literalCardBehavior：逐卡验收账本 audit/tic-all-card-acceptance.json 缺失（需 tools/audit-tic-all-cards.mjs 风格的 TIC 版逐卡工具）' : null,
    !browserReport || (browserReport.coverage && Object.values(browserReport.coverage).every(value => !value))
      ? 'browserAcceptance：audit/tic-browser-acceptance.json status=failed/coverage 全 false，缺 8 章 desktop+mobile 实机证据与指南入口截图' : null,
    !replayCoversTicChapters
      ? `saveReplay：${replayFixturePath} 的 ${replayFixture?.fixtures?.length ?? 0} 局基线不含 TIC 章节（campaignId 仅 ${replayFixtureCampaigns.join('/') || '空'}），需补八章 replay 基线并重建 audit/tic-p8-replay.json`
      : null,
    pendingPrimitiveRequests.length
      ? `引擎原语队列仍有 ${pendingPrimitiveRequests.length} 条 pending：${pendingPrimitiveRequests.map(request => request.id).join(', ')}（${pendingPrimitiveRequests.map(request => request.file).join(', ')}）` : null,
    danglingChapterSources.length ? 'audit/tic-chapter-sources.json 引用的复核事实文件在仓库内不存在（证据链断裂）' : null,
    ...staleEvidence.filter(entry => entry.status === 'stale').map(entry =>
      `${entry.file} 与当前源码不一致（sourceFiles 哈希已漂移）：P8 发布前需重跑并重建`),
  ].filter(Boolean)),
}

// ---------------------------------------------------------------- 输出
const serialized = json(report)
const summaryLine = `TIC P8 逐章验收：${report.summary.completeChapters}/${report.summary.chapters} 章 12/12`
  + `；检查项通过章数 ${SCENARIO_MIGRATION_CHECKS.map(check => `${check}=${checkTotals[check]}`).join(' ')}`
  + `；缺本章验收测试 ${missingChapterTests.length} 章；pending 原语 ${pendingPrimitiveRequests.length} 条；`
  + `replay ${replayFixturePath}（${replayFixture?.fixtures?.length ?? 0} 局，覆盖 TIC ${replayCoversTicChapters}）；remaining ${report.remaining.length} 条`
if (MODE === 'write') {
  await writeFile(LEDGER, serialized)
  console.log(`已写入 audit/tic-scenario-acceptance.json。${summaryLine}`)
  if (!sourceStableDuringRun) {
    console.error('警告：复算期间 TIC 内容源码发生变化，本账本可能是混合快照；请在源码冻结后重跑 --write。')
  }
  if (!items.every(item => item.status === 'verified')) console.log('注意：账本尚未完整（这是预期），--check 会以退出码 1 表示未完成。')
} else if (MODE === 'check') {
  if (!existsSync(LEDGER)) {
    console.error('audit/tic-scenario-acceptance.json 不存在；先 node tools/audit-tic-scenarios.mjs --write')
    process.exit(2)
  }
  if (!sourceStableDuringRun) {
    console.error('复算期间 TIC 内容源码发生变化：请在源码冻结后重跑 --check（账本不可信）')
    process.exit(2)
  }
  if (readFileSync(LEDGER, 'utf8') !== serialized) {
    console.error('TIC 逐章验收账本已漂移：重新 --write 并审阅 diff（来源锁/条目/测试/指南变化都会复算不同）')
    process.exit(2)
  }
  console.log(`账本复算一致。${summaryLine}`)
  if (!items.every(item => SCENARIO_MIGRATION_CHECKS.every(check => item.checks[check]))) {
    console.error(`账本不完整：${incompleteItems.length} 章仍有未通过检查项（0/8 为当前预期）。`)
    process.exit(1)
  }
} else {
  console.log(serialized)
}
