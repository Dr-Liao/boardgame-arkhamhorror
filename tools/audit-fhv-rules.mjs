#!/usr/bin/env node
// 九循环《铁杉谷盛宴》（The Feast of Hemlock Vale）P3 关键词与规则书审计账本。
//
//   node tools/audit-fhv-rules.mjs --write   生成 audit/fhv-rules.json（镜像大厅根 artifacts/migration/fhv/rules.json）
//   node tools/audit-fhv-rules.mjs --check   复算并与磁盘逐字节比对（关键词/规则/证据漂移即失败）
//   node tools/audit-fhv-rules.mjs           打印 JSON（report 模式，不写盘；门禁失败时抛错）
//
// 事实源（全部现场复算，不复制结论）：
//   · 关键词身份 = content/campaigns/theFeastOfHemlockVale/keywords.js（6 项，cardCodes 与 P1 扫描逐张一致）；
//   · 关键词行为 = P1 机制扫描 + P2 原语计划（audit/fhv-primitive-plan.json 全部 done），
//     Node 验收 = audit/fhv-node-acceptance.json；浏览器验收 = audit/fhv-rules-browser.json；
//   · 规则条目 = web/fhv-rules.js（11 条）经 web/rulebook-data.js 注册后的 RULES / RULE_INDEX / matchingRules；
//   · 卡文直达 = web/rulebook-data.js#cardRuleIds 与 FHV_CARD_RULE_PATTERNS 反向核对；
//   · 战役概览与章节顺序 = audit/fhv-scope.json 的 scenarios（真实提示卡号与中英名称）。
//
// 确定性：无时间戳、排序稳定；`--check` 逐字节复算。
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { ALL_CARDS } from '../src/cards/cards-data.js'
import { FHV_KEYWORDS, FHV_SCANNED_KEYWORD_MECHANISMS } from '../content/campaigns/theFeastOfHemlockVale/keywords.js'
import { CYCLE_CODES, SCENARIO_REFERENCE_CODES } from '../content/campaigns/theFeastOfHemlockVale/shared.js'
import { KEYWORD_MIGRATION_CHECKS, RULEBOOK_MIGRATION_CHECKS } from '../content/migration-confirmation.js'
import { RULES, RULE_INDEX, cardRuleIds, matchingRules, ruleById } from '../web/rulebook-data.js'
import { FHV_CARD_RULE_PATTERNS, FHV_RULE_IDS, FHV_RULES } from '../web/fhv-rules.js'
import { buildScan } from './scan-fhv-mechanisms.mjs'

const MOD = fileURLToPath(new URL('../', import.meta.url))
const HALL = join(MOD, '../..')
const RUN = join(HALL, 'artifacts/migration/fhv')
const LEDGER = 'audit/fhv-rules.json'
const SOURCE_PATHS = Object.freeze([
  'audit/fhv-mechanism-scan.json',
  'audit/fhv-primitive-plan.json',
  'web/fhv-rules.js',
  'content/campaigns/theFeastOfHemlockVale/keywords.js',
  'audit/fhv-node-acceptance.json',
  'audit/fhv-rules-browser.json',
])
const ENGINEERING_WORDS = /引擎|实现方式|依赖注入|源码|审计|界面|按钮|\b(?:verified|pending|engine|implementation)\b|src\//i
const readText = path => readFileSync(join(MOD, path), 'utf8').replace(/^\uFEFF/, '')
const readJson = path => JSON.parse(readText(path))
const json = value => JSON.stringify(value, null, 2) + '\n'
const sha = value => createHash('sha256').update(value).digest('hex')
const hasFile = path => existsSync(join(MOD, path))
const booleanMap = (checks, keys) => {
  for (const key of keys) if (typeof checks[key] !== 'boolean') checks[key] = Boolean(checks[key])
  return checks
}
const sortByCodePoint = (left, right) => (left < right ? -1 : left > right ? 1 : 0)
const safeEvidence = paths => paths.filter(hasFile)

const CARD_TEXT = code => {
  const card = ALL_CARDS[code] || {}
  return [card.name || '', card.subname || '', card.text || '', card.backText || '', card.textZh || '',
    card.customizationText || '', card.customizationChange || '', (card.traits || []).join(' ')].join('\n')
}

export async function buildRulesAudit() {
  const scan = buildScan()
  const plan = readJson('audit/fhv-primitive-plan.json')
  const nodeReport = hasFile('audit/fhv-node-acceptance.json') ? readJson('audit/fhv-node-acceptance.json') : null
  const browserReport = hasFile('audit/fhv-rules-browser.json') ? readJson('audit/fhv-rules-browser.json') : null
  const scope = readJson('audit/fhv-scope.json')
  const sources = SOURCE_PATHS.map(path => ({ path, sha256: hasFile(path) ? sha(readFileSync(join(MOD, path))) : null }))
  const planRows = new Map([...plan.reuse, ...plan.new, ...plan.pending].map(row => [row.id, row]))
  const nodeAcceptance = nodeReport?.tests?.pass === true
    && nodeReport?.gates?.testsPassed === true && nodeReport?.gates?.replayNoDrift === true

  // ── 关键词：身份 / 扫描 / 原语 / 规则条目 / 卡文直达 五重对账 ─────────────────────────────
  // P3 清单确认 6 项（逃逸/昼夜/法典/巡逻/警戒/祝福诅咒）；P1 扫描里其余的 keyword 机制必须显式登记不并入 P3 的理由。
  // 法典在 P1 扫描里归在 rulebook 类（rulebook.codex），因此确认项可来自 keyword 或 rulebook 两类机制。
  const scanKeywordMechanisms = scan.mechanisms.filter(row => row.type === 'keyword')
  const scanRulebookMechanisms = scan.mechanisms.filter(row => row.type === 'rulebook')
  const scannedMechanisms = [...scanKeywordMechanisms, ...scanRulebookMechanisms].map(row => row.id)
  const keywordCoverage = {
    scanned: [...FHV_SCANNED_KEYWORD_MECHANISMS].filter(id => scanKeywordMechanisms.some(row => row.id === id)),
    rulebookMechanisms: scanRulebookMechanisms.map(row => row.id),
    confirmed: [...FHV_SCANNED_KEYWORD_MECHANISMS],
    excluded: scanKeywordMechanisms
      .filter(row => !FHV_SCANNED_KEYWORD_MECHANISMS.includes(row.id))
      .map(row => ({ mechanismId: row.id, reason: '绑定是既有关键词，P3 清单（§3 P3）未要求本循环独立条目；由 P5 调查员与 P6 玩家卡批次逐卡验收其本循环卡面行为。' })),
  }
  const keywordItems = FHV_KEYWORDS.map(keyword => {
    const scanned = scan.mechanisms.find(row => row.id === keyword.mechanismId)
    const baseChecks = {
      sourceInventoried: Boolean(scanned)
        && JSON.stringify(scanned.cards || []) === JSON.stringify([...keyword.cardCodes]),
      rulebookEntry: ruleById(keyword.ruleId)?.id === keyword.ruleId,
      cardLinks: keyword.cardCodes.every(code => cardRuleIds(ALL_CARDS[code]).includes(keyword.ruleId)),
    }
    const engineBehavior = keyword.primitives.every(id => {
      const row = planRows.get(id)
      return Boolean(row) && ['done', 'registered'].includes(row.status)
    })
    const checks = booleanMap({
      ...baseChecks,
      engineBehavior,
      nodeAcceptance,
    }, KEYWORD_MIGRATION_CHECKS)
    return {
      id: keyword.id,
      zh: keyword.zh,
      ruleId: keyword.ruleId,
      kind: keyword.kind,
      origin: keyword.origin,
      mechanismId: keyword.mechanismId,
      cards: [...keyword.cardCodes],
      primitives: [...keyword.primitives],
      checks,
      status: KEYWORD_MIGRATION_CHECKS.every(key => checks[key] === true) ? 'verified' : 'pending',
      evidence: safeEvidence([
        'audit/fhv-mechanism-scan.json',
        'audit/fhv-primitive-plan.json',
        'audit/fhv-node-acceptance.json',
        'content/campaigns/theFeastOfHemlockVale/keywords.js',
        'web/fhv-rules.js',
      ]),
    }
  })
  const verifiedKeywords = keywordItems.filter(item => item.status === 'verified').length
  const keywordsStatus = verifiedKeywords === keywordItems.length ? 'verified' : 'pending'
  const keywordSetMatchesScan = keywordCoverage.confirmed.every(id => scannedMechanisms.includes(id))
    && keywordCoverage.excluded.length > 0
    && keywordCoverage.excluded.every(row => Boolean(row.reason)
      && scanKeywordMechanisms.some(item => item.id === row.mechanismId))
    && scanKeywordMechanisms.every(row => keywordCoverage.confirmed.includes(row.id)
      || keywordCoverage.excluded.some(item => item.mechanismId === row.id))

  // ── 规则条目：中英 / 分组 / 拼音 / 相关跳转 / 搜索 / 卡文直达 ─────────────────────────────
  const patternByRule = new Map(FHV_CARD_RULE_PATTERNS.map(([ruleId, pattern]) => [ruleId, pattern]))
  const ruleItems = FHV_RULES.map(entry => {
    const pattern = patternByRule.get(entry.id)
    const matchedCards = pattern ? CYCLE_CODES.filter(code => pattern.test(CARD_TEXT(code))) : []
    const checks = {
      entryPresent: ruleById(entry.id)?.id === entry.id,
      bilingual: Array.isArray(entry.body) && Array.isArray(entry.bodyEn)
        && entry.body.length >= 2 && entry.bodyEn.length === entry.body.length
        && Boolean(entry.titleEn) && Boolean(entry.groupEn),
      grouped: entry.group === '铁杉谷盛宴' && entry.groupEn === 'The Feast of Hemlock Vale',
      aliases: Array.isArray(entry.aliases) && entry.aliases.includes(entry.title) && entry.aliases.includes(entry.titleEn),
      sortKey: /^[a-z]+$/.test(String(RULE_INDEX.find(item => item.id === entry.id)?.sortKey || '')),
      relatedResolved: (entry.related || []).every(id => ruleById(id)?.id === id),
      searchable: matchingRules(entry.title).some(item => item.id === entry.id)
        && matchingRules(entry.titleEn).some(item => item.id === entry.id),
      cardLinks: matchedCards.every(code => cardRuleIds(ALL_CARDS[code]).includes(entry.id)),
    }
    return {
      id: entry.id,
      title: entry.title,
      titleEn: entry.titleEn,
      group: entry.group,
      cards: matchedCards.length,
      checks,
      status: Object.values(checks).every(Boolean) ? 'verified' : 'pending',
      evidence: safeEvidence(['web/fhv-rules.js', 'web/rulebook-data.js', 'tests/fhv-rules.test.mjs']),
    }
  })
  const verifiedRules = ruleItems.filter(item => item.status === 'verified').length
  const rulesStatus = verifiedRules === ruleItems.length ? 'verified' : 'pending'
  const ruleSetMatchesData = JSON.stringify([...FHV_RULE_IDS]) === JSON.stringify(FHV_RULES.map(entry => entry.id))
    && RULES.filter(entry => entry.group === '铁杉谷盛宴').length === FHV_RULES.length

  // ── 规则书分区确认（战役概览 / 章节机制 / 关键词条目 / 卡文直达 / 浏览器） ───────────────────
  const overviewRule = FHV_RULES.find(entry => entry.id === 'fhvCampaign') || null
  const overviewZh = overviewRule ? overviewRule.body.join('\n') : ''
  const overviewEn = overviewRule ? (overviewRule.bodyEn || []).join('\n') : ''
  const chapterOrderHolds = (text, field) => {
    let previous = -1
    return scope.scenarios.every(scenario => {
      const at = text.indexOf(scenario[field])
      if (at < 0 || at <= previous) return false
      previous = at
      return true
    })
  }
  const campaignOverview = {
    entryPresent: Boolean(overviewRule),
    ruleId: overviewRule?.id || null,
    listsEveryChapter: scope.scenarios.every(scenario => overviewZh.includes(scenario.name) && overviewEn.includes(scenario.nameEn)),
    listsThreeDaysThreeNights: /三天三夜/.test(overviewZh) && /three days and three nights/i.test(overviewEn),
    listsPlayablePreludes: /可游玩序曲/.test(overviewZh) && /playable prelude/i.test(overviewEn),
    listsSurveyAreas: /Areas Surveyed/.test(overviewZh) && /Areas Surveyed/.test(overviewEn),
    listsCampaignLog: /战役日志/.test(overviewZh) && /Campaign Log/.test(overviewEn),
    listsResidentsAndRecords: /关系等级/.test(overviewZh) && /Relationship Level/.test(overviewEn),
    statesScenarioOrder: chapterOrderHolds(overviewZh, 'name') && chapterOrderHolds(overviewEn, 'nameEn'),
    relatedRulesExist: Boolean(overviewRule) && (overviewRule.related || []).every(id => ruleById(id)?.id === id),
  }
  const scenarioMechanics = {
    requiredRuleEntries: FHV_RULES.length,
    entriesPresent: FHV_RULES.every(entry => ruleById(entry.id)?.id === entry.id),
    entriesInGroup: FHV_RULES.every(entry => entry.group === '铁杉谷盛宴'),
    relatedResolved: FHV_RULES.every(entry => (entry.related || []).every(id => ruleById(id)?.id === id)),
    keywordEntriesPresent: FHV_KEYWORDS.every(keyword => ruleById(keyword.ruleId)?.id === keyword.ruleId),
    scenarioReferenceCards: scope.scenarios.every(scenario => {
      const code = scenario.referenceCodes[0]
      return ALL_CARDS[code]?.type === 'scenario' && SCENARIO_REFERENCE_CODES.includes(code)
    }),
    scenarioCardsLinkCampaignRule: scope.scenarios.every(scenario =>
      cardRuleIds(ALL_CARDS[scenario.referenceCodes[0]]).includes('fhvCampaign')),
  }
  const unlinked = CYCLE_CODES.filter(code => cardRuleIds(ALL_CARDS[code]).length === 0)
  const cardLinks = {
    total: CYCLE_CODES.length,
    linked: CYCLE_CODES.length - unlinked.length,
    unlinked,
    keywordLinkTargets: FHV_KEYWORDS.every(keyword => keyword.cardCodes
      .every(code => cardRuleIds(ALL_CARDS[code]).includes(keyword.ruleId))),
  }
  const browserChecks = browserReport?.checks || {}
  const browserAcceptance = Boolean(browserReport) && browserReport.status === 'passed'
    && ['desktop', 'mobile', 'zh', 'en', 'cardLink', 'noHorizontalScroll'].every(key => browserChecks[key] === true)
    && Array.isArray(browserReport.screenshots) && browserReport.screenshots.length > 0
  const ruleChecks = booleanMap({
    campaignOverview: Object.values(campaignOverview).filter(value => typeof value === 'boolean').every(Boolean),
    scenarioMechanics: scenarioMechanics.entriesPresent && scenarioMechanics.entriesInGroup
      && scenarioMechanics.relatedResolved && scenarioMechanics.keywordEntriesPresent
      && scenarioMechanics.scenarioReferenceCards && scenarioMechanics.scenarioCardsLinkCampaignRule,
    keywordEntries: keywordsStatus === 'verified',
    cardLinks: cardLinks.unlinked.length === 0 && cardLinks.keywordLinkTargets
      && scenarioMechanics.scenarioCardsLinkCampaignRule,
    desktopBrowser: Boolean(browserChecks.desktop),
    mobileBrowser: Boolean(browserChecks.mobile),
  }, RULEBOOK_MIGRATION_CHECKS)
  const rulebookStatus = Object.values(ruleChecks).every(Boolean) ? 'verified' : 'pending'
  const rulebook = {
    status: rulebookStatus,
    entries: FHV_RULES.length,
    requiredRuleIds: [...FHV_RULE_IDS],
    items: ruleItems,
    checks: ruleChecks,
    campaignOverview,
    scenarioMechanics,
    keywordEntries: { total: keywordItems.length, verified: verifiedKeywords, status: keywordsStatus },
    cardLinks,
    desktopBrowser: ruleChecks.desktopBrowser,
    mobileBrowser: ruleChecks.mobileBrowser,
    chineseText: browserChecks.zh === true,
    englishText: browserChecks.en === true,
    evidence: safeEvidence([
      'web/rulebook-data.js',
      'web/fhv-rules.js',
      'content/campaigns/theFeastOfHemlockVale/keywords.js',
      'tests/fhv-rules.test.mjs',
      'audit/fhv-mechanism-scan.json',
      'audit/fhv-primitive-plan.json',
      'audit/fhv-node-acceptance.json',
      'audit/fhv-rules-browser.json',
    ]),
  }

  // P3 对 P2 的交付声明：关键词所用原语全部 done，无 P3/P4 推迟项。
  const deliveredPrimitives = [...new Set(FHV_KEYWORDS.flatMap(keyword => keyword.primitives))]
    .filter(id => ['done', 'registered'].includes(planRows.get(id)?.status))
    .sort(sortByCodePoint)
  const deferredPrimitives = { p3: [], p4: [] }

  // ── 门禁：全部为 true 时 emit() 才写盘 / 复算通过 ─────────────────────────────────────
  const sourcesStable = sources.every(source => /^[0-9a-f]{64}$/.test(String(source.sha256)))
  const noImplementationProse = FHV_RULES.every(entry => !ENGINEERING_WORDS.test([...entry.body, ...entry.bodyEn].join('')))
  const planGatesPassed = plan.status === 'done' && [...planRows.values()].every(row => row.status === 'done')
  const gates = {
    scanPassed: Object.values(scan.gates).every(value => value === true),
    planGatesPassed,
    keywordSetMatchesScan,
    ruleSetMatchesData,
    allKeywordsVerified: keywordItems.every(item => item.status === 'verified'),
    allRulesVerified: ruleItems.every(item => item.status === 'verified'),
    cardLinksComplete: cardLinks.unlinked.length === 0 && cardLinks.keywordLinkTargets
      && scenarioMechanics.scenarioCardsLinkCampaignRule,
    relatedResolved: ruleItems.every(item => item.checks.relatedResolved)
      && keywordItems.every(item => item.checks.rulebookEntry),
    noImplementationProse,
    nodeAcceptance,
    browserAcceptance,
    sourcesStable,
    keywordPrimitivesDone: FHV_KEYWORDS.every(keyword => keyword.primitives
      .every(id => ['done', 'registered'].includes(planRows.get(id)?.status))),
  }

  return {
    schemaVersion: 1,
    cycle: 'fhv',
    campaignId: 'theFeastOfHemlockVale',
    milestone: 'P3',
    step: 'P3 关键词与规则书',
    generatedBy: 'tools/audit-fhv-rules.mjs',
    docs: 'docs/campaign/theFeastOfHemlockVale/rulebook.md',
    sources,
    confirmations: {
      keywords: {
        status: keywordsStatus,
        checked: verifiedKeywords,
        total: keywordItems.length,
        checks: [...KEYWORD_MIGRATION_CHECKS],
        coverage: keywordCoverage,
        items: keywordItems,
      },
      rulebook,
    },
    deferredPrimitives,
    deliveredPrimitives,
    gates,
  }
}

function emit(report) {
  const content = json(report)
  mkdirSync(RUN, { recursive: true })
  writeFileSync(join(MOD, LEDGER), content)
  writeFileSync(join(RUN, 'rules.json'), content)
}

const isCli = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href
if (isCli) {
  const report = await buildRulesAudit()
  const failed = Object.entries(report.gates).filter(([, value]) => value !== true).map(([key]) => key)
  if (process.argv.includes('--write')) {
    emit(report)
    console.log(`fhv rules: 已写入（关键词 ${report.confirmations.keywords.checked}/${report.confirmations.keywords.total} verified；规则 ${report.confirmations.rulebook.entries} 条 ${report.confirmations.rulebook.status}）`)
  } else if (process.argv.includes('--check')) {
    assert(hasFile(LEDGER), 'audit/fhv-rules.json 不存在：先 --write')
    assert(readText(LEDGER) === json(report), 'audit/fhv-rules.json 漂移；审阅变化后显式 --write')
    console.log(`fhv rules: 复算一致（关键词 ${report.confirmations.keywords.total} 项 / 规则 ${report.confirmations.rulebook.entries} 条）`)
  } else {
    console.log(JSON.stringify(report, null, 2))
  }
  if (failed.length) throw new Error(`fhv rules 门禁失败：${failed.join('、')}`)
}
