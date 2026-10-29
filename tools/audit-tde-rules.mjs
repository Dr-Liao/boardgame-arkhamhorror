// 食梦者（TDE）第 3 步 P4 审计：关键词与规则书的 5 项 / 6 项确认。
//
//   node tools/audit-tde-rules.mjs --write    重写 audit/tde-rules.json
//   node tools/audit-tde-rules.mjs --check    复算并逐字节比对（内容、判据或证据变化即失败）
//
// 口径（路线图 §6 / §11.2，规范 §6–§8）：
// - **不是自证**：关键词来自 content/campaigns/theDreamEaters/keywords.js，规则条目来自
//   web/rulebook-data.js，卡面来自 src/cards/cards-data.js，第 1 步扫描来自
//   artifacts/migration/tde/mechanism-scan.json——本工具逐项重算，不读「已冻结的结论」再复制；
// - 关键词 5 项：sourceInventoried / engineBehavior / nodeAcceptance / rulebookEntry / cardLinks；
// - 规则书 6 项：campaignOverview / scenarioMechanics / keywordEntries / cardLinks /
//   desktopBrowser / mobileBrowser（后两项只认 tools/playwright-tde-reporter.mjs 生成的账本）；
// - 状态只有 `pending` 与 `verified`，按证据计算，不能手写（规范 §8）。
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { ALL_CARDS } from '../src/cards/cards-data.js'
import { RULES, RULE_INDEX, cardRuleIds, ruleById } from '../web/rulebook-data.js'
import { UI_CARDS } from '../web/ui-cards.js'
import {
  TDE_KEYWORDS, TDE_RULE_IDS, TDE_SCANNED_KEYWORD_MECHANISMS,
} from '../content/campaigns/theDreamEaters/keywords.js'
import { PARTS, chapters } from '../content/campaigns/theDreamEaters/shared.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
const OUT_PATH = join(ROOT, 'audit', 'tde-rules.json')
const SCAN_PATH = 'artifacts/migration/tde/mechanism-scan.json'
const KEYWORDS_PATH = 'content/campaigns/theDreamEaters/keywords.js'
const RULEBOOK_PATH = 'web/rulebook-data.js'
const UI_CARDS_PATH = 'web/ui-cards.js'
const CHAPTERS_PATH = 'content/campaigns/theDreamEaters/shared.js'
const MECHANICS_PATH = 'content/mechanics.js'
const RULES_TEST_PATH = 'tests/tde-rules.test.mjs'
const BROWSER_SPEC_PATH = 'tests/tde-rules.browser.mjs'
const BROWSER_PATH = 'audit/tde-browser-acceptance.json'
const MODE = process.argv.includes('--write') ? 'write' : process.argv.includes('--check') ? 'check' : 'report'

const rel = path => relative(ROOT, path).replaceAll('\\', '/')
const abs = path => resolve(ROOT, path)
const fileHash = path => (existsSync(abs(path)) ? createHash('sha256').update(readFileSync(abs(path))).digest('hex') : null)
const readJson = path => (existsSync(abs(path)) ? JSON.parse(readFileSync(abs(path), 'utf8')) : null)
const stableJson = value => `${JSON.stringify(value, null, 2)}\n`

const scan = readJson(SCAN_PATH) || { mechanisms: [] }
const scanMechanisms = scan.mechanisms || []
const scannedKeywordIds = scanMechanisms.filter(item => item.keyword).map(item => item.id).sort()
const keywordMechanismIds = TDE_KEYWORDS.map(keyword => keyword.mechanismId).sort()
const TDE_CARDS = Object.entries(ALL_CARDS).filter(([code]) => /^06\d{3}[a-z]?$/.test(code))
const ruleIds = new Set(RULES.map(rule => rule.id))
const indexedRules = new Map(RULE_INDEX.map(rule => [rule.id, rule]))
const cardTextOf = card => [card?.text, card?.textZh, (card?.traits || []).join(' '), card?.slot].filter(Boolean).join('\n')
// 幕/议程在 cardRuleIds 里会额外连通用条目 script；TDE 卡不允许连到其他循环的条目。
const SHARED_RULE_IDS = ['alert', 'hidden', 'script']

// ---------------------------------------------------------------- Node 验收（实跑测试文件）

function runNodeTest(path) {
  if (!existsSync(abs(path))) return { path, exists: false, ok: false, tests: 0, fail: 0, note: '测试文件缺失' }
  const run = spawnSync(process.execPath, ['--test', abs(path)], { cwd: ROOT, encoding: 'utf8', timeout: 180000 })
  const output = `${run.stdout || ''}\n${run.stderr || ''}`
  const tests = Number((output.match(/^ℹ tests (\d+)$/m) || output.match(/^# tests (\d+)$/m) || [])[1] || 0)
  const fail = Number((output.match(/^ℹ fail (\d+)$/m) || output.match(/^# fail (\d+)$/m) || [])[1] || 0)
  return { path, exists: true, ok: run.status === 0 && fail === 0 && tests > 0, tests, fail, exitCode: run.status }
}

const nodeAcceptance = runNodeTest(RULES_TEST_PATH)

// ---------------------------------------------------------------- 关键词 5 项

const moduleCache = new Map()
async function loadModule(modulePath) {
  if (!moduleCache.has(modulePath)) moduleCache.set(modulePath, await import(new URL(`../${modulePath}`, import.meta.url)))
  return moduleCache.get(modulePath)
}

async function engineProblems(keyword) {
  const problems = []
  for (const entry of keyword.engine || []) {
    let mod
    try {
      mod = await loadModule(entry.module)
    } catch (error) {
      problems.push(`${entry.module} 无法 import：${error.message}`)
      continue
    }
    for (const name of entry.names || []) if (typeof mod[name] !== 'function') problems.push(`${entry.module} 的 ${name} 不是函数`)
    for (const value of entry.values || []) {
      const actual = mod[value.name]
      if (actual === undefined) problems.push(`${entry.module} 缺少导出 ${value.name}`)
      else if (typeof value.length === 'number' && actual.length !== value.length)
        problems.push(`${entry.module} 的 ${value.name} 长度应为 ${value.length}，实际 ${actual.length}`)
    }
  }
  return problems
}

const ruleMentions = (rule, word) => Boolean(rule)
  && `${rule.title} ${rule.aliases.join(' ')} ${rule.body.join('')}`.toLowerCase().includes(String(word).toLowerCase())

const keywordItems = []
for (const keyword of TDE_KEYWORDS) {
  const rule = ruleById(keyword.ruleId)
  const pattern = new RegExp(keyword.pattern, 'i')
  // 1) 卡面来源
  const sourceProblems = []
  if (!keyword.cardCodes.length) sourceProblems.push('没有列任何卡号')
  for (const code of keyword.cardCodes) {
    const card = ALL_CARDS[code]
    if (!card) sourceProblems.push(`卡号 ${code} 不存在`)
    else if (!pattern.test(cardTextOf(card))) sourceProblems.push(`${code} 的卡面没有印刷该关键词`)
  }
  // 2) 引擎行为
  const engineProblemsList = await engineProblems(keyword)
  // 3) 规则书条目
  const ruleProblems = []
  if (!rule || rule.id !== keyword.ruleId) ruleProblems.push(`规则条目 ${keyword.ruleId} 不存在`)
  else {
    if (keyword.ruleOwned && rule.group !== '食梦者') ruleProblems.push(`${keyword.ruleId} 不在「食梦者」分组`)
    if (rule.body.join('').length < 80) ruleProblems.push(`${keyword.ruleId} 正文过短`)
    if (!ruleMentions(rule, keyword.zh)) ruleProblems.push(`${keyword.ruleId} 搜不到「${keyword.zh}」`)
    if (!indexedRules.has(keyword.ruleId)) ruleProblems.push(`${keyword.ruleId} 不在拼音索引里`)
  }
  // 4) 卡文直达：列出的卡号必须连到该条目；判据方向覆盖全部 06 卡。
  const linkProblems = []
  for (const code of keyword.cardCodes) {
    const card = ALL_CARDS[code]
    if (card && !cardRuleIds(card).includes(keyword.ruleId)) linkProblems.push(`${code} 没有连到 ${keyword.ruleId}`)
  }
  for (const [code, card] of TDE_CARDS) {
    if (pattern.test(cardTextOf(card)) && !cardRuleIds(card).includes(keyword.ruleId))
      linkProblems.push(`${code} 卡面命中判据但没有连到 ${keyword.ruleId}`)
  }
  const checks = {
    sourceInventoried: sourceProblems.length === 0,
    engineBehavior: engineProblemsList.length === 0,
    nodeAcceptance: nodeAcceptance.ok,
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
    problems: [...sourceProblems, ...engineProblemsList, ...ruleProblems, ...linkProblems],
  })
}

const keywordFailures = keywordItems.filter(item => item.status !== 'verified')
const keywordsStatus = keywordFailures.length === 0 ? 'verified' : 'pending'

// 机制扫描对齐
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

// ---------------------------------------------------------------- 规则书 6 项

const rulebookIds = new Set(TDE_RULE_IDS)
const tdeRules = RULES.filter(rule => rule.group === '食梦者')
const missingRuleEntries = TDE_RULE_IDS.filter(id => !ruleIds.has(id))
const orphanTdeRules = tdeRules.map(rule => rule.id).filter(id => !rulebookIds.has(id))
const unindexedRuleIds = TDE_RULE_IDS.filter(id => !indexedRules.has(id))
const badRelated = TDE_RULE_IDS.flatMap(id => (ruleById(id)?.related || []).filter(related => !ruleIds.has(related)).map(related => `${id}->${related}`))

// campaignOverview：只写规则本身（章节名、两套袋、章对与尾声）。
const campaignRule = ruleById('tdeCampaign')
const campaignBody = campaignRule && campaignRule.group === '食梦者' ? campaignRule.body.join('') : ''
const campaignOverviewChecks = {
  entryPresent: Boolean(campaignRule) && campaignRule.group === '食梦者',
  listsEveryChapter: chapters.every(chapter => campaignBody.includes(chapter.name)),
  statesTwoParts: Object.keys(PARTS).every(part => campaignBody.includes(PARTS[part].name) || campaignBody.includes(PARTS[part].nameEn)),
  statesChaosBagSizes: campaignBody.includes('14、14、15、16') && campaignBody.includes('17、17、18、19'),
  statesPairAndInterlude: campaignBody.includes('章对') && campaignBody.includes('幕间'),
  statesEpilogueMatrix: campaignBody.includes('16 段尾声'),
  relatedRulesExist: (campaignRule?.related || []).every(id => ruleIds.has(id)),
  rulesOnly: !/本局|本 Mod|引擎|实现|界面|按钮|面板|拖动|点击|演出|存档|投影|原语|读点|接线|验收|审计|playable|earlyAccess|audit|src\/|content\/|behavior/.test(campaignBody),
}

// scenarioMechanics：8 张章节参考卡 + 线路条目 + 混乱符号 + 提示卡按线登记。
const chapterItems = chapters.map(chapter => {
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
  chapters: chapterItems.length,
  allChaptersOk: chapterItems.every(item => item.status === 'ok'),
  chapterCodesMatchShared: JSON.stringify(UI_CARDS.rulebookReferences.tdeDreamQuestChapters.concat(UI_CARDS.rulebookReferences.tdeWebOfDreamsChapters).sort())
    === JSON.stringify(chapters.map(chapter => chapter.code).sort()),
}

// keywordEntries：每条关键词都指向真实条目，且中文名可搜到。
const keywordEntriesChecks = {
  entries: keywordItems.length,
  entriesPresent: keywordItems.every(item => ruleIds.has(item.ruleId)),
  searchable: keywordItems.every(item => ruleMentions(ruleById(item.ruleId), item.zh)),
  status: keywordsStatus,
}

// cardLinks：388 张 06 卡都连到战役条目，且不误连其他循环的条目；关键词判据逐张覆盖。
const foreignLinks = []
const unlinkedCards = []
for (const [code, card] of TDE_CARDS) {
  const ids = cardRuleIds(card)
  if (!ids.length) unlinkedCards.push(code)
  for (const id of ids) if (!rulebookIds.has(id) && !SHARED_RULE_IDS.includes(id)) foreignLinks.push(`${code}:${id}`)
}
const cardLinksChecks = {
  cards: TDE_CARDS.length,
  everyCardLinked: unlinkedCards.length === 0,
  noForeignCycleLinks: foreignLinks.length === 0,
  unlinkedCards,
  foreignLinks,
}

// 浏览器证据：只认 runner 生成的账本。
const browserReport = readJson(BROWSER_PATH)
const browserScreenshots = Array.isArray(browserReport?.screenshots) ? browserReport.screenshots : []
const browserTests = Array.isArray(browserReport?.tests) ? browserReport.tests : []
const specReported = Array.isArray(browserReport?.specs) && browserReport.specs.includes(BROWSER_SPEC_PATH)
const passedFor = viewport => browserTests.some(item => item.spec === BROWSER_SPEC_PATH && item.viewport === viewport && item.status === 'passed')
// 截图路径以仓库根为基准（reporter 记为 base: 'repo-root'）：工具在 games/arkhamhorror/tools/，
// 包内路径 '../' 落回 games/arkhamhorror/，仓库根要再上两层。
const browserShotExists = shot => Boolean(shot?.path)
  && existsSync(new URL((shot.base === 'repo-root' ? '../../../' : '../') + shot.path, import.meta.url))
const shotFor = viewport => browserScreenshots.some(item => item.viewport === viewport && browserShotExists(item))
const browserChecks = {
  reportPresent: Boolean(browserReport),
  generatedByRunner: typeof browserReport?.generatedBy === 'string' && /playwright/i.test(browserReport.generatedBy),
  specReported,
  statusPassed: browserReport?.status === 'passed',
  desktopBrowser: Boolean(browserReport?.checks?.desktopBrowser) && passedFor('desktop') && shotFor('desktop'),
  mobileBrowser: Boolean(browserReport?.checks?.mobileBrowser) && passedFor('mobile') && shotFor('mobile'),
  screenshots: browserScreenshots.filter(browserShotExists).length,
}

const rulebookChecks = {
  campaignOverview: Object.values(campaignOverviewChecks).every(Boolean),
  scenarioMechanics: Object.values(scenarioMechanicsChecks).every(Boolean),
  keywordEntries: Object.values(keywordEntriesChecks).every(Boolean),
  cardLinks: Object.values(cardLinksChecks).every(Boolean),
  desktopBrowser: browserChecks.desktopBrowser,
  mobileBrowser: browserChecks.mobileBrowser,
}
const rulebookStatus = Object.values(rulebookChecks).every(Boolean) ? 'verified' : 'pending'

// ---------------------------------------------------------------- 账本

const gate = {
  keywordsVerified: { verified: keywordItems.filter(item => item.status === 'verified').length, total: keywordItems.length, pass: keywordsStatus === 'verified' },
  rulebookVerified: { checks: rulebookChecks, pending: Object.entries(rulebookChecks).filter(([, value]) => !value).map(([key]) => key), pass: rulebookStatus === 'verified' },
  keywordScanAligned: { ...scanAlignment, pass: scanAlignment.pass },
  rulebookEntries: { expected: TDE_RULE_IDS.length, present: TDE_RULE_IDS.filter(id => ruleIds.has(id)).length, missing: missingRuleEntries, orphan: orphanTdeRules, unindexed: unindexedRuleIds, pass: missingRuleEntries.length === 0 && orphanTdeRules.length === 0 && unindexedRuleIds.length === 0 && badRelated.length === 0 },
  nodeAcceptance: { path: RULES_TEST_PATH, ...nodeAcceptance, pass: nodeAcceptance.ok },
}

const audit = {
  schemaVersion: 1,
  cycle: 'tde',
  cycleName: 'The Dream Eaters',
  cycleNameZh: '食梦者',
  campaignId: 'theDreamEaters',
  step: 3,
  stepName: '关键词与规则书',
  milestone: 'P4',
  generatedBy: 'tools/audit-tde-rules.mjs',
  sources: {
    keywords: KEYWORDS_PATH,
    rulebook: RULEBOOK_PATH,
    uiCards: UI_CARDS_PATH,
    chapters: CHAPTERS_PATH,
    mechanics: MECHANICS_PATH,
    scan: SCAN_PATH,
    nodeTest: RULES_TEST_PATH,
    browserSpec: BROWSER_SPEC_PATH,
    browserReport: BROWSER_PATH,
  },
  keywords: {
    total: keywordItems.length,
    verified: keywordItems.filter(item => item.status === 'verified').length,
    status: keywordsStatus,
    items: keywordItems,
  },
  rulebook: {
    entries: tdeRules.length,
    status: rulebookStatus,
    checks: rulebookChecks,
    details: {
      campaignOverview: campaignOverviewChecks,
      scenarioMechanics: { ...scenarioMechanicsChecks, items: chapterItems },
      keywordEntries: keywordEntriesChecks,
      cardLinks: cardLinksChecks,
      browser: browserChecks,
    },
    related: badRelated,
  },
  confirmations: {
    keywords: {
      status: keywordsStatus,
      total: keywordItems.length,
      verified: keywordItems.filter(item => item.status === 'verified').length,
      items: keywordItems.map(item => ({ id: item.id, zh: item.zh, ruleId: item.ruleId, checks: item.checks, status: item.status })),
    },
    rulebook: {
      status: rulebookStatus,
      checks: rulebookChecks,
      entries: tdeRules.map(rule => rule.id).sort(),
    },
  },
  files: Object.fromEntries([KEYWORDS_PATH, RULEBOOK_PATH, UI_CARDS_PATH, CHAPTERS_PATH, MECHANICS_PATH,
    RULES_TEST_PATH, BROWSER_SPEC_PATH, BROWSER_PATH].map(path => [path, fileHash(path)])),
  gate,
}
audit.gate.pass = gate.keywordsVerified.pass && gate.rulebookVerified.pass
  && gate.keywordScanAligned.pass && gate.rulebookEntries.pass && gate.nodeAcceptance.pass

// ---------------------------------------------------------------- CLI

mkdirSync(join(ROOT, 'audit'), { recursive: true })
if (MODE === 'write') {
  writeFileSync(OUT_PATH, stableJson(audit), 'utf8')
  console.log(`tde-rules: ${rel(OUT_PATH)}`)
  console.log(`关键词 ${audit.keywords.verified}/${audit.keywords.total} verified · 规则书 ${rulebookStatus}（${TDE_RULE_IDS.length} 条）`
    + ` · Node ${nodeAcceptance.tests} 例 / ${nodeAcceptance.fail} 失败 · 浏览器 ${browserChecks.desktopBrowser ? '桌面' : '—'}/${browserChecks.mobileBrowser ? '移动' : '—'}`
    + ` · gate ${audit.gate.pass ? 'pass' : 'fail'}`)
  if (!audit.gate.pass) {
    for (const item of keywordItems.filter(entry => entry.status !== 'verified')) console.log(`  pending ${item.id}: ${item.problems.slice(0, 4).join(' | ')}`)
    for (const [key, value] of Object.entries(rulebookChecks)) if (!value) console.log(`  rulebook pending ${key}`)
  }
} else if (MODE === 'check') {
  if (!existsSync(OUT_PATH)) {
    console.error('audit/tde-rules.json 不存在：先运行 node tools/audit-tde-rules.mjs --write')
    process.exit(1)
  }
  if (readFileSync(OUT_PATH, 'utf8') !== stableJson(audit)) {
    console.error('audit/tde-rules.json 与内容不一致（重新 --write 并审阅 diff）')
    process.exit(1)
  }
  console.log(`tde-rules 复算一致：关键词 ${audit.keywords.verified}/${audit.keywords.total} verified`
    + ` · 规则书 ${rulebookStatus}（${TDE_RULE_IDS.length} 条）· Node ${nodeAcceptance.tests} 例`
    + ` · 浏览器 ${browserChecks.desktopBrowser ? '桌面' : '—'}/${browserChecks.mobileBrowser ? '移动' : '—'} · gate ${audit.gate.pass ? 'pass' : 'fail'}`)
  if (!audit.gate.pass) {
    for (const item of keywordItems.filter(entry => entry.status !== 'verified')) console.log(`  pending ${item.id}: ${item.problems.slice(0, 4).join(' | ')}`)
    for (const [key, value] of Object.entries(rulebookChecks)) if (!value) console.log(`  rulebook pending ${key}`)
    process.exit(1)
  }
} else {
  console.log(JSON.stringify(audit, null, 2))
}
