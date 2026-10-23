#!/usr/bin/env node
// 万象无终（TCU）迁移账本：把「内容注册表 + M0 范围账本 + 关键词/规则书事实源 + 测试与浏览器证据」合成一份可复算的审计。
//
//   node tools/audit-tcu.mjs --write    重写 audit/tcu-migration.json
//   node tools/audit-tcu.mjs --check    复算并逐字节比对（内容、判据或证据变化即失败）
//
// 证据规则（路线图 §8.3，从 TFA 的坏账吸取）：
// - **一个事实源**：关键词来自 content/campaigns/theCircleUndone/keywords.js，规则条目来自 web/rulebook-data.js，
//   卡面来自 src/cards/cards-data.js，章节来自 content/campaigns/theCircleUndone/shared.js；
//   本工具不读「已冻结的结论 JSON」再复制，`--check` 能独立重算。
// - **Node 验收实跑**：spawnSync 执行 tests/tcu-rules.test.mjs 并读退出码，不用 testSource.includes(...) 字符串匹配。
// - **浏览器证据由 runner 生成**：只读 audit/tcu-browser-acceptance.json（tests/tcu-rules.browser.mjs 的 reporter 产物）；
//   文件缺失或未通过时 desktopBrowser/mobileBrowser 一律为 false，不手工补。
// - **remaining 由计算得出**：从 checks 为 false 的项、未 verified 的关键词、未完成原语与章节/卡牌状态汇总。

import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { contentRegistry } from '../content/registered.js'
import { CAMPAIGN_CARD_CODES } from '../content/packs/tcuCampaign/manifest.js'
import {
  INVESTIGATOR_CARD_CODES, TCU_INVESTIGATOR_CODES as PACK_INVESTIGATOR_CODES,
  TCU_SIGNATURE_CODES, tcuInvestigatorCardVerified,
} from '../content/packs/tcuInvestigators/manifest.js'
import { PLAYER_CARD_CODES } from '../content/packs/tcuPlayer/manifest.js'
import {
  CHAOS_BAGS, ENCOUNTER_GROUP_IDS, INVESTIGATOR_CODES, STORY_INVESTIGATOR_CODES,
  chapters, recordTypes,
} from '../content/campaigns/theCircleUndone/shared.js'
import { TCU_KEYWORDS, TCU_RULE_IDS, TCU_SCANNED_KEYWORD_MECHANISMS } from '../content/campaigns/theCircleUndone/keywords.js'
import { supportedMechanics } from '../content/mechanics.js'
import { RULES, RULE_INDEX, cardRuleIds } from '../web/rulebook-data.js'
import { UI_CARDS } from '../web/ui-cards.js'
import { ALL_CARDS, INVESTIGATORS } from '../src/cards/cards-data.js'
import { investigatorRule } from '../src/cards/card-rules.js'
// 能力层注册表在 engine.js 首次加载时才装配；账本要读条目，因此显式触发装配
// （与 tools/audit-abilities.mjs 同一口径，不依赖调用顺序）。
import { registerCardAbilities, registeredCodes, registeredEntry } from '../src/engine/ability.js'
import { CARD_ABILITY_ENTRIES } from '../src/cards/card-abilities.js'
import { NON_PLAYER_ABILITY_ENTRIES } from '../src/cards/encounter-abilities.js'
// 能力层注册表在 engine.js 首次加载时才装配；账本要读条目，因此显式装配（幂等）。
if (!registeredCodes().length) registerCardAbilities([...CARD_ABILITY_ENTRIES, ...NON_PLAYER_ABILITY_ENTRIES])
import { canSelectInvestigator, getAvailability, SIGNATURES_BY_INVESTIGATOR } from '../src/deck/availability.js'
import { buildDeck } from '../src/deck/deckbuilding.js'
import { normalizeHunchDeckRule } from '../src/engine/hunch-deck.js'
import { normalizeResourceBankRule } from '../src/engine/resource-bank.js'

const CAMPAIGN_ID = 'theCircleUndone'
const PACK_IDS = ['tcuCampaign', 'tcuInvestigators', 'tcuPlayer']
const SCOPE_PATH = 'artifacts/migration/tcu/scope.json'
const PRIMITIVE_CATALOG_PATH = 'artifacts/migration/tcu/primitive-catalog.json'
const MECHANISM_SCAN_PATH = 'artifacts/migration/tcu/mechanism-scan.json'
const BROWSER_PATH = 'audit/tcu-browser-acceptance.json'
const KEYWORDS_PATH = 'content/campaigns/theCircleUndone/keywords.js'
const RULEBOOK_PATH = 'web/rulebook-data.js'
const UI_CARDS_PATH = 'web/ui-cards.js'
const MECHANICS_PATH = 'content/mechanics.js'
const RULES_TEST_PATH = 'tests/tcu-rules.test.mjs'
const BROWSER_SPEC_PATH = 'tests/tcu-rules.browser.mjs'
// 第 5 步（P6）：M1 调查员的 Node 验收。
const INVESTIGATOR_TEST_PATH = 'tests/tcu-investigators.test.mjs'
const INVESTIGATOR_PACK_PATH = 'content/packs/tcuInvestigators/manifest.js'
const INVESTIGATOR_HELPERS = [
  'src/engine/hunch-deck.js', 'src/engine/resource-bank.js', 'src/engine/spell-actions.js',
  'src/engine/cancel-note.js',
]
// 第 4 步（P5）：交互面板的 Node 验收与浏览器用例。
const INTERACTIONS_TEST_PATH = 'tests/tcu-interactions.test.mjs'
const INTERACTIONS_SPEC_PATH = 'tests/tcu-interactions.browser.mjs'
const INTERACTIONS_UI_PATH = 'web/tcu-ui.js'
const INTERACTIONS_CSS_PATH = 'web/tcu-panels.css'
const TARGET = new URL('../audit/tcu-migration.json', import.meta.url)
const MODE = process.argv.includes('--write') ? 'write' : process.argv.includes('--check') ? 'check' : 'report'
const LAUNCHABLE = new Set(['playable', 'verified'])
// 只有这些「核心条目」允许出现在 05 卡的规则链接里（`script` 是幕/议程的通用条目，`parley` 是共享关键词）。
const SHARED_RULE_IDS = ['parley', 'script']

const root = new URL('../', import.meta.url)
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')
const readText = path => (existsSync(new URL(path, root)) ? readFileSync(new URL(path, root), 'utf8') : null)
const sha256File = path => {
  const text = readText(path)
  return text === null ? null : sha256(Buffer.from(text, 'utf8'))
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

// ---------------------------------------------------------------- 内容与范围基线（P1）

const scopeBytes = readFileSync(new URL('../' + SCOPE_PATH, import.meta.url))
const scope = JSON.parse(scopeBytes.toString('utf8'))

const packs = PACK_IDS.map(id => {
  const pack = contentRegistry.getPack(id)
  if (!pack) return { id, exists: false }
  return {
    id,
    exists: true,
    status: pack.status,
    cards: pack.cards.length,
    ranges: pack.cardRanges.map(range => `${range.from}-${range.to}`),
    encounterGroupIds: [...pack.encounterGroupIds],
    rulesImplemented: pack.cards.filter(card => card.rulesImplemented).length,
    deckbuildingOpen: pack.cards.filter(card => card.deckbuilding).length,
  }
})

const campaign = contentRegistry.getCampaign(CAMPAIGN_ID)
let launchBlocked = false
let launchError = null
try {
  contentRegistry.assertLaunchable(CAMPAIGN_ID)
} catch (error) {
  launchBlocked = true
  launchError = error.message
}

const scenarios = contentRegistry.listScenarios(CAMPAIGN_ID).map(entry => ({
  id: entry.id,
  status: entry.status,
  referenceCode: entry.referenceCode || null,
  requiredPackIds: [...entry.requiredPackIds],
  requiredEncounterGroupIds: [...entry.requiredEncounterGroupIds],
  launchable: LAUNCHABLE.has(entry.status),
}))

const packGroupIds = packs.find(pack => pack.id === 'tcuCampaign')?.encounterGroupIds || []
const missingChapterGroups = scenarios.flatMap(scenario =>
  scenario.requiredEncounterGroupIds.filter(group => !packGroupIds.includes(group)).map(group => `${scenario.id}:${group}`))
const packCountMismatch = [
  packs.find(pack => pack.id === 'tcuCampaign')?.cards !== CAMPAIGN_CARD_CODES.length,
  packs.find(pack => pack.id === 'tcuInvestigators')?.cards !== INVESTIGATOR_CARD_CODES.length,
  packs.find(pack => pack.id === 'tcuPlayer')?.cards !== PLAYER_CARD_CODES.length,
].some(Boolean)

// ---------------------------------------------------------------- 关键词与规则书（P4）

const ruleIds = new Set(RULES.map(rule => rule.id))
const tcuRules = RULES.filter(rule => rule.group === '万象无终')
const tcuRuleIds = new Set(tcuRules.map(rule => rule.id))
const indexedRules = new Map(RULE_INDEX.map(rule => [rule.id, rule]))
const tcuCards = Object.entries(ALL_CARDS).filter(([code]) => /^05\d{3}[a-z]?$/.test(code))

// Node 验收：实跑一次，所有关键词与规则书条目共用同一份结果（不读源码猜结论）。
// 清掉 NODE_TEST_CONTEXT：从 `node --test` 里再 spawn `node --test` 时，继承的上下文会让子进程
// 走测试子进程模式（不输出 ℹ pass/ℹ fail 汇总），账本就与直接运行的结果不一致。
const testEnv = { ...process.env }
delete testEnv.NODE_TEST_CONTEXT
const testRun = spawnSync(process.execPath, ['--test', RULES_TEST_PATH], { cwd: fileURLToPath(new URL('../', import.meta.url)), encoding: 'utf8', env: testEnv })
const testOutput = `${testRun.stdout || ''}\n${testRun.stderr || ''}`
const numberFrom = (label, output) => {
  const match = output.match(new RegExp(`(?:ℹ|#)\\s*${label}\\s+(\\d+)`))
  return match ? Number(match[1]) : -1
}
const nodeAcceptance = {
  command: `node --test ${RULES_TEST_PATH}`,
  status: testRun.status,
  tests: numberFrom('tests', testOutput),
  passed: numberFrom('pass', testOutput),
  failed: numberFrom('fail', testOutput),
  ok: testRun.status === 0 && numberFrom('fail', testOutput) === 0 && numberFrom('pass', testOutput) > 0,
}

const scan = readJson(MECHANISM_SCAN_PATH)
const scanMechanisms = scan?.mechanisms || []
const scanKeywordMechanisms = scanMechanisms.filter(item => item.keyword).map(item => item.id).sort()
const keywordMechanismIds = TCU_KEYWORDS.map(keyword => keyword.mechanismId).sort()

const cardTextOf = card => [card?.text, card?.textZh, (card?.traits || []).join(' '), card?.slot].filter(Boolean).join('\n')

function engineEvidence(keyword) {
  // 行为判据是「动态 import 后逐个检查导出与形状」（见 valueShapes），这里只做存在性初筛，避免未导出时抛错。
  return (keyword.engine || []).filter(entry => !existsSync(new URL('../' + entry.module, import.meta.url)))
    .map(entry => `缺少模块 ${entry.module}`)
}

// `values` 的形状检查需要真实运行模块；Node 侧用一次动态 import 拿全量导出。
const moduleCache = new Map()
async function loadModule(modulePath) {
  if (!moduleCache.has(modulePath)) moduleCache.set(modulePath, await import(new URL('../' + modulePath, import.meta.url)))
  return moduleCache.get(modulePath)
}

async function valueShapes(keyword) {
  const problems = []
  for (const entry of keyword.engine || []) {
    let module
    try {
      module = await loadModule(entry.module)
    } catch (error) {
      problems.push(`${entry.module} 无法 import：${error.message}`)
      continue
    }
    for (const name of entry.names || []) {
      if (typeof module[name] !== 'function') problems.push(`${entry.module} 的 ${name} 不是函数`)
    }
    for (const value of entry.values || []) {
      const actual = module[value.name]
      if (actual === undefined) {
        problems.push(`${entry.module} 缺少导出 ${value.name}`)
        continue
      }
      if (typeof value.length === 'number' && actual.length !== value.length)
        problems.push(`${entry.module} 的 ${value.name} 长度应为 ${value.length}，实际 ${actual.length}`)
      if (Array.isArray(value.keys)) {
        const keys = Object.keys(actual).sort()
        if (keys.join(',') !== [...value.keys].sort().join(','))
          problems.push(`${entry.module} 的 ${value.name} 键应为 ${value.keys.join('/')}`)
      }
    }
  }
  return problems
}

// 规则书条目在标题/别名/正文里搜得到该关键词的中文名，才算「卡文与详情页直达」。
const ruleMentions = (rule, word) => {
  if (!rule) return false
  const haystack = `${rule.title} ${rule.aliases.join(' ')} ${rule.body.join('')}`.toLowerCase()
  return haystack.includes(String(word).toLowerCase())
}

const keywordItems = []
for (const keyword of TCU_KEYWORDS) {
  const rule = RULES.find(candidate => candidate.id === keyword.ruleId) || null
  const pattern = keyword.pattern ? new RegExp(keyword.pattern, 'i') : null
  // 1) 卡面来源
  const sourceProblems = []
  if (keyword.sourceKind === 'text') {
    if (!keyword.cardCodes.length) sourceProblems.push('没有列任何代表卡号')
    for (const code of keyword.cardCodes) {
      const card = ALL_CARDS[code]
      if (!card) sourceProblems.push(`卡号 ${code} 不存在`)
      else if (!pattern.test(cardTextOf(card))) sourceProblems.push(`${code} 的卡面没有印刷该关键词`)
    }
  } else if (keyword.sourceKind === 'card-kind') {
    if (!keyword.cardCodes.length) sourceProblems.push('没有列任何代表卡号')
    for (const code of keyword.cardCodes) {
      const card = ALL_CARDS[code]
      if (!card) sourceProblems.push(`卡号 ${code} 不存在`)
      else if (!(keyword.cardTypes || []).includes(card.type)) sourceProblems.push(`${code} 的类型是 ${card.type}`)
    }
  } else if (keyword.sourceKind === 'engine') {
    if (keyword.cardCodes.length) sourceProblems.push('engine 来源不应列卡号')
    if (!(keyword.engine || []).some(entry => (entry.values || []).length)) sourceProblems.push('engine 来源必须声明至少一个数据导出')
  } else {
    sourceProblems.push(`未知的 sourceKind：${keyword.sourceKind}`)
  }
  // 2) 引擎行为（导出名 + 形状）
  const engineProblems = [...engineEvidence(keyword), ...(await valueShapes(keyword))]
  // 3) 规则书条目
  const ruleProblems = []
  if (!rule) ruleProblems.push(`规则条目 ${keyword.ruleId} 不存在`)
  else {
    if (keyword.ruleOwned && rule.group !== '万象无终') ruleProblems.push(`${keyword.ruleId} 不在「万象无终」分组`)
    if (rule.body.join('').length < 80) ruleProblems.push(`${keyword.ruleId} 正文过短`)
    if (!ruleMentions(rule, keyword.zh)) ruleProblems.push(`${keyword.ruleId} 搜不到「${keyword.zh}」`)
    if (!indexedRules.has(keyword.ruleId)) ruleProblems.push(`${keyword.ruleId} 不在拼音索引里`)
  }
  // 4) 卡文直达：列出的卡号必须连到该条目；有 pattern 的还要逐张覆盖全部 05 卡。
  const linkProblems = []
  for (const code of keyword.cardCodes) {
    const card = ALL_CARDS[code]
    if (card && !cardRuleIds(card).includes(keyword.ruleId)) linkProblems.push(`${code} 没有连到 ${keyword.ruleId}`)
  }
  if (pattern) {
    for (const [code, card] of tcuCards) {
      if (pattern.test(cardTextOf(card)) && !cardRuleIds(card).includes(keyword.ruleId))
        linkProblems.push(`${code} 卡面命中判据但没有连到 ${keyword.ruleId}`)
    }
  }
  const checks = {
    sourceInventoried: sourceProblems.length === 0,
    engineBehavior: engineProblems.length === 0,
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
    sourceKind: keyword.sourceKind,
    cardCodes: [...keyword.cardCodes],
    cardLinkMode: keyword.cardCodes.length ? 'cards' : 'none',
    status: Object.values(checks).every(Boolean) ? 'verified' : 'pending',
    checks,
    problems: [...sourceProblems, ...engineProblems, ...ruleProblems, ...linkProblems],
    evidence: [
      KEYWORDS_PATH,
      RULEBOOK_PATH,
      RULES_TEST_PATH,
      ...(keyword.engine || []).map(entry => `${entry.module}#${[...(entry.names || []), ...(entry.values || []).map(value => value.name)].join(',')}`),
      ...keyword.cardCodes.map(code => `src/cards/cards-data.js#${code}`),
    ],
  })
}

const keywordFailures = keywordItems.filter(item => item.status !== 'verified')
const keywordsStatus = keywordFailures.length === 0 ? 'verified' : 'pending'

// 机制扫描对齐：关键词表必须与第 1 步扫描的机制集合、ruleId 一一对齐。
const scanAlignment = {
  scanMechanisms: scanKeywordMechanisms,
  keywordMechanisms: keywordMechanismIds,
  missing: keywordMechanismIds.filter(id => !scanKeywordMechanisms.includes(id)),
  extra: scanKeywordMechanisms.filter(id => !keywordMechanismIds.includes(id)),
  ruleIdMismatch: TCU_KEYWORDS.filter(keyword => {
    const mechanism = scanMechanisms.find(item => item.id === keyword.mechanismId)
    return mechanism?.keyword?.ruleId !== keyword.ruleId
  }).map(keyword => keyword.id),
}
scanAlignment.pass = scanAlignment.missing.length === 0 && scanAlignment.extra.length === 0
  && scanAlignment.ruleIdMismatch.length === 0

// 规则书条目：16 条必须成对出现（条目 / 拼音索引），且不能有孤儿条目。
const rulebookIds = new Set(TCU_RULE_IDS)
const missingRuleEntries = TCU_RULE_IDS.filter(id => !ruleIds.has(id))
const orphanTcuRules = [...tcuRuleIds].filter(id => !rulebookIds.has(id))
const unindexedRuleIds = TCU_RULE_IDS.filter(id => !indexedRules.has(id))
const badSortKeys = TCU_RULE_IDS.filter(id => {
  const indexed = indexedRules.get(id)
  return !indexed || !/^[a-z]+$/.test(String(indexed.sortKey || '')) || indexed.initial !== indexed.sortKey[0].toUpperCase()
})

// 章节覆盖：章节清单、剧本参考卡、卡文直达三处必须一致。
const chapterChecks = chapters.map(chapter => {
  const referenceCard = ALL_CARDS[chapter.code] || null
  const scenarioCard = UI_CARDS.scenarioCards[chapter.id] || null
  const links = referenceCard ? cardRuleIds(referenceCard) : []
  const scenario = scenarios.find(entry => entry.id === chapter.id) || null
  const checks = {
    chapterRegistered: Boolean(scenario),
    referenceCardExists: Boolean(referenceCard) && referenceCard.type === 'scenario',
    scenarioCardMapped: scenarioCard === chapter.code,
    linksCampaignRule: links.includes('tcuCampaign'),
    linksChaosRule: links.includes('tcuChaos'),
  }
  return {
    id: chapter.id,
    code: chapter.code,
    name: chapter.name,
    status: scenario?.status ?? null,
    scenarioCard,
    status2: Object.values(checks).every(Boolean) ? 'ok' : 'pending',
    checks,
  }
})

// campaignOverview：战役条目必须写清九天章节的中文名、当前状态与审计账本位置。
const campaignRule = RULES.find(rule => rule.id === 'tcuCampaign') || null
const campaignBody = campaignRule ? campaignRule.body.join('') : ''
const expectedStatusWord = ['playable', 'verified'].includes(campaign?.status) ? 'playable' : 'catalog-only'
const campaignOverviewChecks = {
  entryPresent: Boolean(campaignRule) && campaignRule.group === '万象无终',
  listsEveryChapter: chapters.every(chapter => campaignBody.includes(chapter.name)),
  statesCurrentStatus: campaignBody.includes(expectedStatusWord),
  namesAuditLedger: campaignBody.includes('audit/tcu-migration.json'),
  statesChaosBagShape: campaignBody.includes('13 枚'),
  relatedRulesExist: (campaignRule?.related || []).every(id => ruleIds.has(id)),
}

// scenarioMechanics：每章都要有剧本参考卡、提示卡映射与两条卡文直达。
const scenarioMechanicsChecks = {
  chapters: chapterChecks.length,
  allChaptersOk: chapterChecks.every(item => item.status2 === 'ok'),
  scenarioCardCount: Object.keys(UI_CARDS.scenarioCards).filter(id => chapters.some(chapter => chapter.id === id)).length,
}

// keywordEntries：每条关键词都指向真实条目，且中文名可搜到。
const keywordEntriesChecks = {
  entries: keywordItems.length,
  entriesPresent: keywordItems.every(item => ruleIds.has(item.ruleId)),
  searchable: keywordItems.every(item => ruleMentions(RULES.find(rule => rule.id === item.ruleId), item.zh)),
  status: keywordsStatus,
}

// cardLinks：05 段每张卡至少连到战役条目，且不误连其他循环的条目。
const foreignLinks = []
const unlinkedCards = []
for (const [code, card] of tcuCards) {
  const ids = cardRuleIds(card)
  if (!ids.length) unlinkedCards.push(code)
  for (const id of ids) if (!rulebookIds.has(id) && !SHARED_RULE_IDS.includes(id)) foreignLinks.push(`${code}:${id}`)
}
const cardLinksChecks = {
  cards: tcuCards.length,
  everyCardLinked: unlinkedCards.length === 0,
  noForeignCycleLinks: foreignLinks.length === 0,
  unlinkedCards,
  foreignLinks,
}

// ---------------------------------------------------------------- 浏览器证据（runner 生成）

const browserReport = readJson(BROWSER_PATH)
// 截图放在仓库根的 artifacts/ 下（与 TFA 同一约定），路径由 reporter 以仓库相对路径记录。
// 工具在 games/arkhamhorror/tools/：包内路径 '../' 落回 games/arkhamhorror/，仓库根要再上两层。
const repoPathExists = shot => Boolean(shot?.path)
  && existsSync(new URL((shot.base === 'repo-root' ? '../../../' : '../') + shot.path, import.meta.url))
const browserScreenshots = Array.isArray(browserReport?.screenshots) ? browserReport.screenshots : []
const browserTests = Array.isArray(browserReport?.tests) ? browserReport.tests : []
const browserSpecs = Array.isArray(browserReport?.specs) ? browserReport.specs : []
const passedFor = (spec, viewport) => browserTests.some(test =>
  test.spec === spec && test.viewport === viewport && test.status === 'passed')
const shotFor = (spec, viewport) => browserScreenshots.some(shot =>
  shot.spec === spec && shot.viewport === viewport && repoPathExists(shot))
const browserChecks = {
  reportPresent: Boolean(browserReport),
  generatedByRunner: typeof browserReport?.generatedBy === 'string' && /playwright/i.test(browserReport.generatedBy),
  specs: browserTests.length ? [...new Set(browserTests.map(test => test.spec))].sort() : browserSpecs,
  specReported: browserSpecs.includes(BROWSER_SPEC_PATH) || browserTests.some(test => test.spec === BROWSER_SPEC_PATH),
  statusPassed: browserReport?.status === 'passed',
  tests: browserTests.length,
  // P4（规则书）与 P5（交互）分开取证：每个 spec × 视口都要有用例通过 + 截图。
  rulesDesktop: passedFor(BROWSER_SPEC_PATH, 'desktop') && shotFor(BROWSER_SPEC_PATH, 'desktop'),
  rulesMobile: passedFor(BROWSER_SPEC_PATH, 'mobile') && shotFor(BROWSER_SPEC_PATH, 'mobile'),
  interactionsDesktop: passedFor(INTERACTIONS_SPEC_PATH, 'desktop') && shotFor(INTERACTIONS_SPEC_PATH, 'desktop'),
  interactionsMobile: passedFor(INTERACTIONS_SPEC_PATH, 'mobile') && shotFor(INTERACTIONS_SPEC_PATH, 'mobile'),
  desktop: browserReport?.checks?.desktopBrowser === true,
  mobile: browserReport?.checks?.mobileBrowser === true,
  // 截图必须真的在仓库里存在，且桌面/移动各一张。
  screenshots: browserScreenshots.filter(repoPathExists).length,
  screenshotsComplete: browserScreenshots.length > 0 && browserScreenshots.every(repoPathExists)
    && ['desktop', 'mobile'].every(viewport => browserScreenshots.some(shot => shot.viewport === viewport && repoPathExists(shot))),
}
const browserOk = browserChecks.reportPresent && browserChecks.generatedByRunner && browserChecks.specReported
  && browserChecks.statusPassed && browserChecks.tests > 0 && browserChecks.screenshotsComplete
const interactionsBrowserOk = browserOk && browserChecks.interactionsDesktop && browserChecks.interactionsMobile

const rulebookChecks = {
  campaignOverview: Object.values(campaignOverviewChecks).every(Boolean),
  scenarioMechanics: scenarioMechanicsChecks.allChaptersOk
    && scenarioMechanicsChecks.scenarioCardCount === chapters.length
    && scenarioMechanicsChecks.chapters === chapters.length,
  keywordEntries: Object.entries(keywordEntriesChecks).every(([key, value]) => key === 'status' ? value === 'verified' : Boolean(value)),
  cardLinks: cardLinksChecks.everyCardLinked && cardLinksChecks.noForeignCycleLinks && cardLinksChecks.cards === 377,
  desktopBrowser: browserOk && browserChecks.rulesDesktop,
  mobileBrowser: browserOk && browserChecks.rulesMobile,
}
const rulebookStatus = Object.values(rulebookChecks).every(Boolean) ? 'verified' : 'pending'

// ---------------------------------------------------------------- 交互与界面（P5）

// 路线图 §6 的 11 条交互。`model` 是 web/tcu-ui.js 的导出（纯函数，Node 侧可 import），
// `keyword` 是 P4 关键词台账里对应的机制 id；两者至少命中一个才算「有界面读点」。
const INTERACTIONS = [
  { id: 'tarotPick', zh: '塔罗抽牌/选择', model: ['tarotPickerModel', 'renderTarotPicker'], keyword: 'tarotDeck' },
  { id: 'storyInvestigatorPick', zh: '序章选调查员', model: ['storyInvestigatorPickerModel', 'renderStoryInvestigatorPicker'], keyword: 'storyInvestigator' },
  { id: 'hauntedResolution', zh: '闹鬼结算', model: ['hauntedChoiceModel', 'renderHauntedChoice'], keyword: 'haunted' },
  { id: 'spectralDeck', zh: '幽灵界第二牌堆面板', model: ['tcuCampaignModel', 'renderTcuCampaignPanel'], keyword: 'spectral' },
  { id: 'circleTest', zh: '阵法多技能检定', model: ['multiSkillTestInfo'], keyword: 'circle' },
  { id: 'parleyTarget', zh: '谈判目标与豁免', model: [], keyword: 'parley' },
  { id: 'campaignRecords', zh: '遗留记忆/记录面板', model: ['tcuCampaignModel'], keyword: 'memento' },
  { id: 'watcherPanel', zh: '看守人公开提示', model: ['tcuCampaignModel'], keyword: 'watcher' },
  { id: 'breachDoom', zh: '裂口/毁灭标记', model: ['locationTcuBadges'], keyword: 'breach' },
  { id: 'hereticFaces', zh: '异端者翻面/放逐', model: ['enemyFaceBadge'], keyword: 'heretic' },
  { id: 'tarotSlot', zh: '塔罗槽位', model: [], keyword: 'tarotSlot' },
]
const interactionsNodeAcceptance = spawnSync(process.execPath, ['--test', INTERACTIONS_TEST_PATH], {
  cwd: fileURLToPath(new URL('../', import.meta.url)), encoding: 'utf8', env: testEnv,
})
const interactionsOutput = `${interactionsNodeAcceptance.stdout || ''}\n${interactionsNodeAcceptance.stderr || ''}`
const interactionsAcceptance = {
  command: `node --test ${INTERACTIONS_TEST_PATH}`,
  status: interactionsNodeAcceptance.status,
  tests: numberFrom('tests', interactionsOutput),
  passed: numberFrom('pass', interactionsOutput),
  failed: numberFrom('fail', interactionsOutput),
  ok: interactionsNodeAcceptance.status === 0 && numberFrom('fail', interactionsOutput) === 0 && numberFrom('pass', interactionsOutput) > 0,
}
const tcuUi = await import('../web/tcu-ui.js')
const interactionItems = INTERACTIONS.map(item => {
  const keyword = TCU_KEYWORDS.find(entry => entry.id === item.keyword) || null
  const modelProblems = item.model.filter(name => typeof tcuUi[name] !== 'function').map(name => `缺少导出 ${name}`)
  const keywordProblems = keyword ? [] : [`关键词台账缺少 ${item.keyword}`]
  const checks = {
    model: modelProblems.length === 0,
    engineReadPoint: keyword ? (keyword.engine || []).length > 0 : false,
    nodeAcceptance: interactionsAcceptance.ok,
    desktopBrowser: interactionsBrowserOk,
    mobileBrowser: interactionsBrowserOk,
  }
  return {
    id: item.id,
    zh: item.zh,
    keyword: item.keyword,
    model: item.model,
    status: Object.values(checks).every(Boolean) ? 'verified' : 'pending',
    checks,
    problems: [...modelProblems, ...keywordProblems],
    evidence: item.model.length ? ['web/tcu-ui.js', 'web/tcu-panels.css', INTERACTIONS_TEST_PATH, INTERACTIONS_SPEC_PATH] : [KEYWORDS_PATH, INTERACTIONS_SPEC_PATH],
  }
})
const interactionFailures = interactionItems.filter(item => item.status !== 'verified')
const interactionsStatus = interactionFailures.length === 0 ? 'verified' : 'pending'

// ---------------------------------------------------------------- 调查员（P6 · M1）

// 每位正式调查员的验收口径：可选人、可构筑、条目齐全、专属卡已实现、规则数据合法、
// 自动构筑产出与卡面契约一致。任何一项为 false 就不算 verified，并进 remaining。
function problemOf(fn) {
  try {
    fn()
    return null
  } catch (error) {
    return error.message
  }
}

function validateInvestigatorData(code) {
  const data = investigatorRule(code) || {}
  if (!data.elderSign) throw new Error('缺少 investigator.elderSign 数据体')
  if (data.hunchDeck) normalizeHunchDeckRule(data.hunchDeck, `${code}.hunchDeck`)
  if (data.resourceBank) normalizeResourceBankRule(data.resourceBank, `${code}.resourceBank`)
  if (data.spellActionCredit) {
    const doomAtLeast = data.spellActionCredit.doomAtLeast ?? 1
    if (!Number.isSafeInteger(doomAtLeast) || doomAtLeast < 1) throw new Error('spellActionCredit.doomAtLeast 必须是正整数')
  }
  for (const extra of data.openingHandExtra || []) {
    if (!ALL_CARDS[extra]) throw new Error(`openingHandExtra 指向未知卡牌：${extra}`)
  }
}

const formalInvestigatorItems = INVESTIGATOR_CODES.map(code => {
  const card = ALL_CARDS[code]
  const entry = registeredEntry(code)
  const availability = getAvailability(code)
  const signatureCodes = SIGNATURES_BY_INVESTIGATOR[code] || []
  const problems = []
  const dataProblem = problemOf(() => validateInvestigatorData(code))
  if (dataProblem) problems.push(dataProblem)
  let built = null
  const deckProblem = problemOf(() => { built = buildDeck(INVESTIGATORS[code], { seed: `audit-${code}` }) })
  if (deckProblem) problems.push(`自动构筑失败：${deckProblem}`)
  if (built) {
    if (built.playerCards.length !== card?.deckRequirements?.size) {
      problems.push(`玩家卡 ${built.playerCards.length} 张，卡面要求 ${card?.deckRequirements?.size}`)
    }
    if (built.signatureCards.length + built.signatureWeaknesses.length !== signatureCodes.length) {
      problems.push('专属卡/专属弱点数量与构筑依赖不一致')
    }
    if (built.basicWeaknesses.length !== 1) problems.push('随机基础弱点数量不为 1')
  }
  const checks = {
    selectable: canSelectInvestigator(code) && availability.selectable,
    deckbuildingOpen: availability.availability === 'strict' && !availability.dependencyOnly,
    dataDeclared: Boolean(entry?.investigator) && Boolean(entry?.elderSign),
    signaturesImplemented: signatureCodes.every(signature => tcuInvestigatorCardVerified(signature)
      && Boolean(registeredEntry(signature))),
    ruleDataValid: !dataProblem,
    deckContract: Boolean(built) && problems.length === 0,
    nodeAcceptance: false, // 由下面实测后统一回填
  }
  return { code, name: card?.nameZh || card?.name || code, klass: card?.klass || null, signatureCodes, checks, problems }
})

const storyInvestigatorItems = STORY_INVESTIGATOR_CODES.map(code => {
  const card = ALL_CARDS[code]
  const entry = registeredEntry(code)
  const checks = {
    registered: entry?.kind === 'investigator',
    notSelectable: !canSelectInvestigator(code) && getAvailability(code).selectable === false,
    elderSign: Boolean(entry?.elderSign) && Boolean(investigatorRule(code)?.elderSign),
    inCampaignPack: CAMPAIGN_CARD_CODES.includes(code),
  }
  const problems = Object.entries(checks).filter(([, value]) => !value).map(([key]) => key)
  return { code, name: card?.nameZh || card?.name || code, checks, problems }
})

const investigatorRun = spawnSync(process.execPath, ['--test', INVESTIGATOR_TEST_PATH], {
  cwd: fileURLToPath(new URL('../', import.meta.url)), encoding: 'utf8', env: testEnv,
})
const investigatorOutput = `${investigatorRun.stdout || ''}\n${investigatorRun.stderr || ''}`
const investigatorAcceptance = {
  command: `node --test ${INVESTIGATOR_TEST_PATH}`,
  status: investigatorRun.status,
  tests: numberFrom('tests', investigatorOutput),
  passed: numberFrom('pass', investigatorOutput),
  failed: numberFrom('fail', investigatorOutput),
  ok: investigatorRun.status === 0 && numberFrom('fail', investigatorOutput) === 0
    && numberFrom('pass', investigatorOutput) > 0,
}
for (const item of formalInvestigatorItems) item.checks.nodeAcceptance = investigatorAcceptance.ok
for (const item of formalInvestigatorItems) {
  item.status = Object.values(item.checks).every(Boolean) ? 'verified' : 'pending'
}
const formalPending = formalInvestigatorItems.filter(item => item.status !== 'verified')
const storyProblems = storyInvestigatorItems.filter(item => item.problems.length)
const investigatorsStatus = formalPending.length === 0 && storyProblems.length === 0
  && investigatorAcceptance.ok ? 'verified' : 'pending'

// 条目里显式声明的简化分支（`simplified: true` + note）不能静默通过：
// 它们进 remaining，并在账本里逐条列出来。
const simplifiedCards = [...new Set([...PACK_INVESTIGATOR_CODES, ...TCU_SIGNATURE_CODES, ...STORY_INVESTIGATOR_CODES])]
  .map(code => ({ code, name: ALL_CARDS[code]?.nameZh || ALL_CARDS[code]?.name || code, note: registeredEntry(code)?.note || null }))
  .filter(item => registeredEntry(item.code)?.simplified === true)


// ---------------------------------------------------------------- 机制登记与测试清单

const tcuMechanics = [...supportedMechanics].filter(id => id.startsWith('tcu')).sort()
const mechanicsItems = TCU_KEYWORDS.filter(keyword => keyword.ruleOwned)
  .map(keyword => ({
    id: keyword.ruleId,
    keyword: keyword.id,
    implemented: keyword.implemented !== false,
    registered: supportedMechanics.has(keyword.ruleId),
    evidence: RULES_TEST_PATH,
  }))
const mechanicsMismatches = mechanicsItems.filter(item => item.implemented !== item.registered).map(item => item.id)

const primitiveCatalog = readJson(PRIMITIVE_CATALOG_PATH)
// 只有 `new` 组有 status；`reuse` 组是引用既有原语，不需要完成态。
const newPrimitives = (primitiveCatalog?.primitives?.new || []).filter(Boolean)
const unfinishedPrimitives = newPrimitives.filter(item => item.status !== 'done').map(item => item.id || item.primitive || '(未命名)')
const primitiveCounts = { new: newPrimitives.length, done: newPrimitives.filter(item => item.status === 'done').length }

const testFiles = readdirSync(new URL('../tests/', import.meta.url))
  .filter(name => /^tcu-.*\.test\.mjs$/.test(name)).sort()
  .map(name => `tests/${name}`)
  .concat(existsSync(new URL('../' + BROWSER_SPEC_PATH, import.meta.url)) ? [BROWSER_SPEC_PATH] : [])
  .concat(existsSync(new URL('../' + INTERACTIONS_SPEC_PATH, import.meta.url)) ? [INTERACTIONS_SPEC_PATH] : [])

// ---------------------------------------------------------------- 门禁

const gate = {
  scopeLedger: { path: SCOPE_PATH, sha256: sha256(scopeBytes), pass: Boolean(scope?.gate?.pass) },
  records: {
    total: scope?.counts?.records ?? 0,
    assigned: (scope?.gate?.records?.assigned ?? 0),
    pass: scope?.counts?.records === 377 && scope?.gate?.records?.pass === true,
  },
  // P6：卡包按里程碑各自的状态。调查员包 M1 已 verified；战役包与玩家包仍 catalog-only。
  packsByPhase: {
    investigators: {
      status: packs.find(pack => pack.id === 'tcuInvestigators')?.status ?? null,
      cards: packs.find(pack => pack.id === 'tcuInvestigators')?.cards ?? 0,
      implemented: packs.find(pack => pack.id === 'tcuInvestigators')?.rulesImplemented ?? 0,
    },
    campaign: {
      status: packs.find(pack => pack.id === 'tcuCampaign')?.status ?? null,
      cards: packs.find(pack => pack.id === 'tcuCampaign')?.cards ?? 0,
      implemented: packs.find(pack => pack.id === 'tcuCampaign')?.rulesImplemented ?? 0,
    },
    player: {
      status: packs.find(pack => pack.id === 'tcuPlayer')?.status ?? null,
      cards: packs.find(pack => pack.id === 'tcuPlayer')?.cards ?? 0,
      implemented: packs.find(pack => pack.id === 'tcuPlayer')?.rulesImplemented ?? 0,
    },
    pass: packs.find(pack => pack.id === 'tcuInvestigators')?.status === 'verified'
      && packs.find(pack => pack.id === 'tcuInvestigators')?.rulesImplemented === 19
      && packs.find(pack => pack.id === 'tcuCampaign')?.status === 'catalog-only'
      && packs.find(pack => pack.id === 'tcuCampaign')?.rulesImplemented === STORY_INVESTIGATOR_CODES.length
      && packs.find(pack => pack.id === 'tcuPlayer')?.status === 'catalog-only'
      && packs.find(pack => pack.id === 'tcuPlayer')?.rulesImplemented === 0,
  },
  campaignCatalogOnly: {
    status: campaign?.status ?? null,
    chapters: scenarios.length,
    packIds: [...(campaign?.requiredPackIds || [])],
    pass: campaign?.status === 'catalog-only' && scenarios.length === 9,
  },
  launchBlocked: { blocked: launchBlocked, reason: launchError, pass: launchBlocked },
  chaptersNotLaunchable: {
    statuses: scenarios.map(scenario => `${scenario.id}:${scenario.status}`),
    pass: scenarios.length === 9 && scenarios.every(scenario => scenario.status === 'catalog-only' && !scenario.launchable),
  },
  encounterGroups: {
    expected: ENCOUNTER_GROUP_IDS.length,
    registered: packGroupIds.length,
    unique: new Set(packGroupIds).size === packGroupIds.length,
    missingChapterGroups,
    pass: packGroupIds.length === 21 && new Set(packGroupIds).size === 21 && missingChapterGroups.length === 0,
  },
  packCounts: {
    campaign: packs.find(pack => pack.id === 'tcuCampaign')?.cards ?? 0,
    investigators: packs.find(pack => pack.id === 'tcuInvestigators')?.cards ?? 0,
    player: packs.find(pack => pack.id === 'tcuPlayer')?.cards ?? 0,
    pass: !packCountMismatch,
  },
  requiredPacksExist: {
    packs: [...(campaign?.requiredPackIds || [])],
    pass: (campaign?.requiredPackIds || []).every(id => Boolean(contentRegistry.getPack(id))),
  },
  // P4：关键词与规则书。
  keywordScanAligned: { ...scanAlignment, pass: scanAlignment.pass },
  keywordsVerified: {
    total: keywordItems.length,
    verified: keywordItems.length - keywordFailures.length,
    pending: keywordFailures.map(item => item.id),
    pass: keywordFailures.length === 0 && keywordItems.length === TCU_SCANNED_KEYWORD_MECHANISMS.length,
  },
  rulebookEntries: {
    required: TCU_RULE_IDS.length,
    present: TCU_RULE_IDS.length - missingRuleEntries.length,
    missing: missingRuleEntries,
    orphan: orphanTcuRules,
    unindexed: unindexedRuleIds,
    badSortKeys,
    pass: missingRuleEntries.length === 0 && orphanTcuRules.length === 0
      && unindexedRuleIds.length === 0 && badSortKeys.length === 0,
  },
  rulebookVerified: {
    checks: rulebookChecks,
    pending: Object.entries(rulebookChecks).filter(([, value]) => !value).map(([key]) => key),
    pass: Object.values(rulebookChecks).every(Boolean),
  },
  nodeAcceptance: { ...nodeAcceptance, pass: nodeAcceptance.ok },
  mechanicsRegistered: {
    registered: tcuMechanics.length,
    mismatches: mechanicsMismatches,
    pass: mechanicsMismatches.length === 0,
  },
  // P5：11 条交互都有读点 + Node 验收 + 桌面/移动浏览器证据。
  interactionsVerified: {
    total: interactionItems.length,
    verified: interactionItems.length - interactionFailures.length,
    pending: interactionFailures.map(item => item.id),
    nodeAcceptance: interactionsAcceptance.ok,
    browser: { desktop: browserChecks.interactionsDesktop, mobile: browserChecks.interactionsMobile },
    pass: interactionFailures.length === 0 && interactionsAcceptance.ok && interactionsBrowserOk,
  },
  // P6：六位正式调查员 + 4 位故事调查员 + 13 张专属卡的逐人验收。
  investigatorsVerified: {
    formal: formalInvestigatorItems.length,
    selectable: formalInvestigatorItems.filter(item => item.checks.selectable).length,
    verified: formalInvestigatorItems.filter(item => item.status === 'verified').length,
    pending: formalPending.map(item => item.code),
    story: storyInvestigatorItems.length,
    storyPending: storyProblems.map(item => item.code),
    signatures: TCU_SIGNATURE_CODES.length,
    signaturesImplemented: TCU_SIGNATURE_CODES.filter(code => tcuInvestigatorCardVerified(code)).length,
    nodeAcceptance: investigatorAcceptance.ok,
    simplified: simplifiedCards.map(item => item.code),
    pass: investigatorsStatus === 'verified' && investigatorAcceptance.ok,
  },
  // 第 2 步的原语快照（worker 只读同一份 catalog）：账本只读不写，完成态由 audit:tcu:primitives 负责。
  primitivesDone: {
    new: primitiveCounts.new,
    done: primitiveCounts.done,
    unfinished: unfinishedPrimitives,
    pass: primitiveCounts.new > 0 && primitiveCounts.done === primitiveCounts.new,
  },
}
const pass = Object.values(gate).every(entry => entry.pass)

// ---------------------------------------------------------------- remaining（算出来，不手写）

const remaining = []
if (keywordFailures.length) remaining.push(`关键词未 verified：${keywordFailures.map(item => `${item.id}（${item.problems.join('；')}）`).join(' | ')}`)
if (rulebookStatus !== 'verified') {
  const pendingChecks = Object.entries(rulebookChecks).filter(([, value]) => !value).map(([key]) => key)
  remaining.push(`规则书未 verified：${pendingChecks.join('、')}${browserChecks.reportPresent ? '' : '（缺 audit/tcu-browser-acceptance.json：先跑 npm run test:tcu:rules:browser）'}`)
}
const catalogChapters = scenarios.filter(scenario => scenario.status === 'catalog-only').length
if (catalogChapters) remaining.push(`${catalogChapters} 章仍是 catalog-only（P8 剧本）：逐章 12 项验收尚未建立`)
if (formalPending.length) {
  remaining.push(`调查员未 verified：${formalPending.map(item => `${item.code}（${item.problems.join('；') || '检查未通过'}）`).join(' | ')}`)
}
if (storyProblems.length) remaining.push(`序章故事调查员未 verified：${storyProblems.map(item => `${item.code}（${item.problems.join('、')}）`).join(' | ')}`)
for (const item of simplifiedCards) {
  remaining.push(`显式简化：${item.code} ${item.name}${item.note ? `——${item.note}` : '（未写 note）'}`)
}
const unimplementedPlayer = (packs.find(pack => pack.id === 'tcuPlayer')?.cards ?? 0)
  - (packs.find(pack => pack.id === 'tcuPlayer')?.rulesImplemented ?? 0)
if (unimplementedPlayer) remaining.push(`${unimplementedPlayer} 张玩家卡没有单卡行为：M2（P7）逐张验收`)
const unimplementedCampaign = (packs.find(pack => pack.id === 'tcuCampaign')?.cards ?? 0)
  - (packs.find(pack => pack.id === 'tcuCampaign')?.rulesImplemented ?? 0)
if (unimplementedCampaign) remaining.push(`${unimplementedCampaign} 张战役卡没有单卡行为：M3（P8）逐章验收`)
if (!recordTypes || Object.keys(recordTypes).length < 64) remaining.push(`战役记录只登记 ${Object.keys(recordTypes).length} 个键（参考实现 64 个）：其余键、中文名与幕间结算属 P9`)
if (mechanicsMismatches.length) remaining.push(`机制登记与关键词表不一致：${mechanicsMismatches.join('、')}`)
if (interactionFailures.length) remaining.push(`交互面板未 verified：${interactionFailures.map(item => `${item.id}（${item.problems.join('；') || '缺少浏览器证据'}）`).join(' | ')}`)
if (!browserChecks.reportPresent) remaining.push('浏览器证据缺失：桌面 1440 / 移动 390 的规则书与交互用例必须由 tests/tcu-*.browser.mjs 的 runner 生成')
// 交互的实机路径依赖可启动的章节：战役仍 catalog-only 时只能做组件级浏览器验收。
if (catalogChapters) remaining.push(`交互实机路径待 P8：${catalogChapters} 章仍 catalog-only，序章与章节内容接通后才能在大厅里走完整条交互路径`)
if (unfinishedPrimitives.length) remaining.push(`未完成原语：${unfinishedPrimitives.join('、')}`)
if (!remaining.length) remaining.push('P4/P5 范围内无遗留；发布级剩余项见 P10')

// ---------------------------------------------------------------- 账本

const audit = {
  schemaVersion: 2,
  cycle: 'tcu',
  cycleNameZh: '万象无终',
  milestone: 'P6',
  stage: '第 5 步：批量迁移内容 · M1 调查员',
  generatedBy: 'tools/audit-tcu.mjs',
  docs: 'docs/tcu-migration-roadmap.md',
  scope: { path: SCOPE_PATH, sha256: gate.scopeLedger.sha256 },
  campaign: {
    id: CAMPAIGN_ID,
    status: campaign?.status ?? null,
    name: campaign?.name ?? null,
    nameEn: campaign?.nameEn ?? null,
    chapters: chapters.length,
    requiredPackIds: [...(campaign?.requiredPackIds || [])],
    launchBlocked,
    launchError,
  },
  status: campaign?.status ?? null,
  playable: LAUNCHABLE.has(campaign?.status),
  launchEnabled: !launchBlocked,
  earlyAccess: false,
  equivalenceCertified: false,
  verifiedScope: {
    milestone: 'P4–P6',
    keywords: keywordsStatus === 'verified',
    rulebook: rulebookStatus === 'verified',
    interactions: interactionsStatus === 'verified',
    investigators: investigatorsStatus === 'verified',
    scenarios: false,
    playerCards: false,
    story: false,
  },
  packs,
  scenarios,
  chapters: chapterChecks,
  encounterGroups: [...ENCOUNTER_GROUP_IDS],
  counts: scope.counts,
  chaosBags: Object.fromEntries(Object.entries(CHAOS_BAGS).map(([difficulty, bag]) => [difficulty, { tokens: bag.length, skulls: bag.filter(token => token === 'skull').length }])),
  recordSchema: Object.fromEntries(Object.entries(recordTypes).sort(([a], [b]) => (a < b ? -1 : 1))),
  investigatorCodes: [...INVESTIGATOR_CODES],
  storyInvestigatorCodes: [...STORY_INVESTIGATOR_CODES],
  mechanics: { status: mechanicsMismatches.length ? 'pending' : 'verified', items: mechanicsItems },
  primitives: { ...primitiveCounts, unfinished: unfinishedPrimitives },
  sources: scope.sources,
  confirmations: {
    scenarios: [],
    keywords: {
      status: keywordsStatus,
      items: keywordItems,
    },
    rulebook: {
      status: rulebookStatus,
      requiredRuleIds: [...TCU_RULE_IDS],
      checks: rulebookChecks,
      details: {
        campaignOverview: campaignOverviewChecks,
        scenarioMechanics: scenarioMechanicsChecks,
        keywordEntries: keywordEntriesChecks,
        cardLinks: cardLinksChecks,
        browser: browserChecks,
      },
      evidence: [RULEBOOK_PATH, UI_CARDS_PATH, KEYWORDS_PATH, RULES_TEST_PATH, BROWSER_SPEC_PATH, BROWSER_PATH],
    },
    // P5：11 条交互的读点、Node 验收与桌面/移动浏览器证据。
    interactions: {
      status: interactionsStatus,
      checks: {
        desktopBrowser: browserChecks.interactionsDesktop,
        mobileBrowser: browserChecks.interactionsMobile,
        nodeAcceptance: interactionsAcceptance.ok,
      },
      items: interactionItems,
      evidence: [INTERACTIONS_UI_PATH, INTERACTIONS_CSS_PATH, INTERACTIONS_TEST_PATH, INTERACTIONS_SPEC_PATH, BROWSER_PATH],
    },
    // P6：M1 调查员的逐人验收（正式 6 位 + 故事 4 位 + 13 张专属卡）。
    investigators: {
      status: investigatorsStatus,
      checks: {
        formalSelectable: formalInvestigatorItems.every(item => item.checks.selectable),
        deckbuildingOpen: formalInvestigatorItems.every(item => item.checks.deckbuildingOpen),
        entriesRegistered: formalInvestigatorItems.every(item => item.checks.dataDeclared),
        signaturesImplemented: TCU_SIGNATURE_CODES.every(code => tcuInvestigatorCardVerified(code)),
        ruleDataValid: formalInvestigatorItems.every(item => item.checks.ruleDataValid),
        deckContracts: formalInvestigatorItems.every(item => item.checks.deckContract),
        storyInvestigators: storyProblems.length === 0,
        nodeAcceptance: investigatorAcceptance.ok,
      },
      items: formalInvestigatorItems,
      storyItems: storyInvestigatorItems,
      simplified: simplifiedCards,
      evidence: [INVESTIGATOR_PACK_PATH, INVESTIGATOR_TEST_PATH, ...INVESTIGATOR_HELPERS],
    },
  },
  evidence: {
    files: {
      [KEYWORDS_PATH]: sha256File(KEYWORDS_PATH),
      [RULEBOOK_PATH]: sha256File(RULEBOOK_PATH),
      [UI_CARDS_PATH]: sha256File(UI_CARDS_PATH),
      [MECHANICS_PATH]: sha256File(MECHANICS_PATH),
      [RULES_TEST_PATH]: sha256File(RULES_TEST_PATH),
      [BROWSER_SPEC_PATH]: sha256File(BROWSER_SPEC_PATH),
      [INTERACTIONS_UI_PATH]: sha256File(INTERACTIONS_UI_PATH),
      [INTERACTIONS_CSS_PATH]: sha256File(INTERACTIONS_CSS_PATH),
      [INTERACTIONS_TEST_PATH]: sha256File(INTERACTIONS_TEST_PATH),
      [INTERACTIONS_SPEC_PATH]: sha256File(INTERACTIONS_SPEC_PATH),
      [BROWSER_PATH]: sha256File(BROWSER_PATH),
      [MECHANISM_SCAN_PATH]: sha256File(MECHANISM_SCAN_PATH),
      // P6：调查员包、逐人验收与三个调查员专属读点模块的哈希。
      [INVESTIGATOR_PACK_PATH]: sha256File(INVESTIGATOR_PACK_PATH),
      [INVESTIGATOR_TEST_PATH]: sha256File(INVESTIGATOR_TEST_PATH),
      ...Object.fromEntries(INVESTIGATOR_HELPERS.map(path => [path, sha256File(path)])),
    },
    nodeAcceptance,
    interactionsAcceptance,
    investigatorAcceptance,
    browser: { path: BROWSER_PATH, generatedBy: browserReport?.generatedBy ?? null, status: browserReport?.status ?? null },
  },
  tests: testFiles,
  remaining,
  gate: { ...gate, pass },
}

const json = `${JSON.stringify(audit, null, 2)}\n`
if (MODE === 'write') {
  mkdirSync(new URL('../audit/', import.meta.url), { recursive: true })
  writeFileSync(TARGET, json, 'utf8')
  console.log(`audit: audit/tcu-migration.json · milestone ${audit.milestone} · gate ${pass ? 'pass' : 'fail'}`)
  console.log(`关键词 ${gate.keywordsVerified.verified}/${gate.keywordsVerified.total} · 规则书 ${rulebookStatus} · 章节 ${scenarios.length} · launchBlocked ${launchBlocked}`)
  for (const [key, value] of Object.entries(gate)) if (!value.pass) console.log(`  gate 未通过 ${key}: ${JSON.stringify(value).slice(0, 400)}`)
} else if (MODE === 'check') {
  if (!existsSync(TARGET)) {
    console.error('audit/tcu-migration.json 不存在：先运行 --write')
    process.exit(1)
  }
  const disk = readFileSync(TARGET, 'utf8')
  if (disk !== json) {
    const previous = JSON.parse(disk)
    const changed = Object.keys(audit).filter(key => JSON.stringify(previous[key]) !== JSON.stringify(audit[key]))
    console.error(`audit/tcu-migration.json 与内容不一致（重新 --write 并审阅 diff）：${changed.join(', ') || '格式/换行'}`)
    process.exit(1)
  }
  if (!pass) {
    console.log(JSON.stringify(gate))
    process.exit(1)
  }
  console.log(`audit 复算一致：${audit.milestone}，关键词 ${gate.keywordsVerified.verified}/${gate.keywordsVerified.total}，规则书 ${rulebookStatus}，gate pass`)
} else {
  console.log(json)
}
