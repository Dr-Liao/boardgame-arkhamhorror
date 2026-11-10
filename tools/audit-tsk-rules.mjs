#!/usr/bin/env node
// 八循环《绯红密钥》（The Scarlet Keys）P3 关键词与规则书审计账本。
//
//   node tools/audit-tsk-rules.mjs --write   生成 audit/tsk-rules.json（镜像 artifacts/migration/tsk/rules.json）
//   node tools/audit-tsk-rules.mjs --check   复算并与磁盘逐字节比对（关键词/规则/证据漂移即失败）
//   node tools/audit-tsk-rules.mjs           打印 JSON（report 模式，不写盘；门禁失败时抛错）
//
// 事实源（全部现场复算，不复抄结论）：
//   · 关键词身份 = content/campaigns/theScarletKeys/keywords.js（29 个，cardCodes 与 P1 扫描逐条一致）；
//   · 关键词行为 = tools/scan-tsk-mechanisms.mjs 的 keyword 机制 + P2 原语计划（audit/tsk-primitive-plan.json）；
//   · 规则条目 = web/tsk-rules.js（17 条）经 web/rulebook-data.js 注册后的 ruleById / RULE_INDEX / matchingRules；
//   · 卡文直达 = web/rulebook-data.js#cardRuleIds（^09/ 派发）与 TSK_CARD_RULE_PATTERNS 反向核对；
//   · Node 验收 = audit/tsk-node-acceptance.json；浏览器验收 = audit/tsk-browser-acceptance.json（P3 产出）。
//
// 确定性：无时间戳、排序稳定；`--check` 逐字节复算。
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import { ALL_CARDS } from '../src/cards/cards-data.js'
import { chapters, CYCLE_CODES } from '../content/campaigns/theScarletKeys/shared.js'
import { TSK_KEYWORDS } from '../content/campaigns/theScarletKeys/keywords.js'
import { KEYWORD_MIGRATION_CHECKS, RULEBOOK_MIGRATION_CHECKS } from '../content/migration-confirmation.js'
import { RULE_INDEX, cardRuleIds, matchingRules, ruleById } from '../web/rulebook-data.js'
import { TSK_CARD_RULE_PATTERNS, TSK_RULE_IDS, TSK_RULES } from '../web/tsk-rules.js'
import { MOD, emit, readJson, sourceLock } from './tsk-migration-lib.mjs'
import { buildScan } from './scan-tsk-mechanisms.mjs'
import { buildPrimitivePlan } from './audit-tsk-primitives.mjs'

const SOURCE_PATHS = Object.freeze([
  'audit/tsk-mechanism-scan.json',
  'audit/tsk-primitive-plan.json',
  'web/tsk-rules.js',
  'content/campaigns/theScarletKeys/keywords.js',
  'audit/tsk-node-acceptance.json',
  'audit/tsk-browser-acceptance.json',
])
const ENGINEERING_WORDS = /引擎|实现方式|依赖注入|源码|审计|界面|按钮|\b(?:verified|pending|engine|implementation)\b|src\//i
const CARD_TEXT = code => [
  ALL_CARDS[code]?.name || '', ALL_CARDS[code]?.subname || '', ALL_CARDS[code]?.text || '',
  ALL_CARDS[code]?.backText || '', ALL_CARDS[code]?.customizationText || '',
  ALL_CARDS[code]?.customizationChange || '', (ALL_CARDS[code]?.traits || []).join(' '),
].join('\n')

const existsAt = path => existsSync(join(MOD, path))
const readRepoJson = path => (existsAt(path) ? readJson(join(MOD, path)) : null)
const safeSha256 = path => (existsAt(path) ? sourceLock(path, MOD).sha256 : null)
const booleanMap = (checks, keys) => {
  for (const key of keys) if (typeof checks[key] !== 'boolean') checks[key] = Boolean(checks[key])
  return checks
}
const sortByCodePoint = (left, right) => (left < right ? -1 : left > right ? 1 : 0)

export async function buildRulesAudit() {
  const scan = buildScan()
  const { plan } = await buildPrimitivePlan()
  const nodeReport = readRepoJson('audit/tsk-node-acceptance.json')
  const browserReport = readRepoJson('audit/tsk-browser-acceptance.json')
  const sources = SOURCE_PATHS.map(path => ({ path, sha256: safeSha256(path) }))
  const planRows = new Map([...plan.reuse, ...plan.p2.new, ...plan.p2.extend].map(row => [row.id, row]))
  const nodeAcceptance = nodeReport?.tests?.pass === true
    && nodeReport?.gates?.testsPassed === true && nodeReport?.gates?.replayNoDrift === true

  // ── 关键词：身份 / 扫描 / 原语 / 规则条目 / 卡文直达 五重对账 ───────────────────────────
  const scanKeywords = scan.mechanisms.filter(row => row.type === 'keyword')
  const keywordItems = TSK_KEYWORDS.map(keyword => {
    const scanned = scanKeywords.find(row => row.id === keyword.id)
    const baseChecks = {
      sourceInventoried: Boolean(scanned)
        && JSON.stringify(scanned?.cards || []) === JSON.stringify([...keyword.cardCodes]),
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
      ruleId: keyword.ruleId,
      zh: keyword.zh,
      kind: keyword.kind,
      cards: [...keyword.cardCodes],
      primitives: [...keyword.primitives],
      checks,
      status: KEYWORD_MIGRATION_CHECKS.every(key => checks[key] === true) ? 'verified' : 'pending',
      evidence: [
        'audit/tsk-mechanism-scan.json',
        'audit/tsk-primitive-plan.json',
        'audit/tsk-node-acceptance.json',
        'content/campaigns/theScarletKeys/keywords.js',
        'web/tsk-rules.js',
      ],
    }
  })
  const verifiedKeywords = keywordItems.filter(item => item.status === 'verified').length
  const keywordsStatus = verifiedKeywords === keywordItems.length ? 'verified' : 'pending'

  // ── 规则条目：中英 / 分组 / 拼音 / 相关跳转 / 搜索 / 卡文直达 ─────────────────────────
  const patternByRule = new Map(TSK_CARD_RULE_PATTERNS.map(([ruleId, pattern]) => [ruleId, pattern]))
  const ruleItems = TSK_RULES.map(rule => {
    const pattern = patternByRule.get(rule.id)
    const matchedCards = pattern ? CYCLE_CODES.filter(code => pattern.test(CARD_TEXT(code))) : []
    const checks = {
      entryPresent: ruleById(rule.id)?.id === rule.id,
      bilingual: Array.isArray(rule.body) && Array.isArray(rule.bodyEn)
        && rule.body.length >= 2 && rule.bodyEn.length === rule.body.length
        && Boolean(rule.titleEn) && Boolean(rule.groupEn),
      grouped: rule.group === '绯红密钥' && rule.groupEn === 'The Scarlet Keys',
      aliases: Array.isArray(rule.aliases) && rule.aliases.includes(rule.title) && rule.aliases.includes(rule.titleEn),
      sortKey: /^[a-z]+$/.test(String(RULE_INDEX.find(item => item.id === rule.id)?.sortKey || '')),
      relatedResolved: (rule.related || []).every(id => ruleById(id)?.id === id),
      searchable: matchingRules(rule.title).some(item => item.id === rule.id)
        && matchingRules(rule.titleEn).some(item => item.id === rule.id),
      cardLinks: matchedCards.every(code => cardRuleIds(ALL_CARDS[code]).includes(rule.id)),
    }
    return {
      id: rule.id,
      title: rule.title,
      titleEn: rule.titleEn,
      group: rule.group,
      cards: matchedCards.length,
      checks,
      status: Object.values(checks).every(Boolean) ? 'verified' : 'pending',
      evidence: ['web/tsk-rules.js', 'web/rulebook-data.js', 'tests/tsk-rules.test.mjs'],
    }
  })
  const verifiedRules = ruleItems.filter(item => item.status === 'verified').length
  const rulesStatus = verifiedRules === ruleItems.length ? 'verified' : 'pending'

  // ── 规则书分区确认（战役概览 / 场景机制 / 关键词条目 / 卡文直达 / 浏览器）───────────────
  const overviewRule = TSK_RULES.find(rule => rule.id === 'tskCampaign') || null
  const overviewZh = overviewRule ? overviewRule.body.join('\n') : ''
  const overviewEn = overviewRule ? (overviewRule.bodyEn || []).join('\n') : ''
  const campaignOverview = {
    entryPresent: Boolean(overviewRule),
    ruleId: overviewRule?.id || null,
    listsEveryChapter: Boolean(overviewRule)
      && chapters.every(chapter => overviewZh.includes(chapter.name) && overviewEn.includes(chapter.nameEn)),
    listsInterludes: /幕间/.test(overviewZh) && /Interlude/i.test(overviewEn),
    statesWorldMapAndTime: /世界地图/.test(overviewZh) && /时间/.test(overviewZh)
      && /world map/i.test(overviewEn) && /\btime\b/i.test(overviewEn),
    listsStatusReports: /状况报告/.test(overviewZh) && /status report/i.test(overviewEn),
    statesScenarioOrder: chapters.every((chapter, index) => {
      const previous = index === 0 ? -1 : overviewZh.indexOf(chapters[index - 1].name)
      const current = overviewZh.indexOf(chapter.name)
      return current > previous && current >= 0
    }) && overviewEn.indexOf('Congress of the Keys') > overviewEn.indexOf('Riddles and Rain'),
    relatedRulesExist: Boolean(overviewRule) && (overviewRule.related || []).every(id => ruleById(id)?.id === id),
  }
  const scenarioMechanics = {
    requiredRuleEntries: TSK_RULES.length,
    entriesPresent: TSK_RULES.every(rule => ruleById(rule.id)?.id === rule.id),
    entriesInGroup: TSK_RULES.every(rule => rule.group === '绯红密钥'),
    relatedResolved: TSK_RULES.every(rule => (rule.related || []).every(id => ruleById(id)?.id === id)),
    keywordEntriesPresent: TSK_KEYWORDS.every(keyword => ruleById(keyword.ruleId)?.id === keyword.ruleId),
    scenarioReferenceCards: chapters.every(chapter => Boolean(ALL_CARDS[chapter.code]) && ALL_CARDS[chapter.code].type === 'scenario'),
    scenarioCardsLinkCampaignRule: chapters.every(chapter => cardRuleIds(ALL_CARDS[chapter.code]).includes('tskCampaign')),
  }
  const unlinked = CYCLE_CODES.filter(code => cardRuleIds(ALL_CARDS[code]).length === 0)
  const cardLinks = {
    total: CYCLE_CODES.length,
    linked: CYCLE_CODES.length - unlinked.length,
    unlinked,
    keywordLinkTargets: TSK_KEYWORDS.every(keyword => keyword.cardCodes
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
    entries: TSK_RULES.length,
    requiredRuleIds: [...TSK_RULE_IDS],
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
    evidence: [
      'web/rulebook-data.js',
      'web/tsk-rules.js',
      'content/campaigns/theScarletKeys/keywords.js',
      'tests/tsk-rules.test.mjs',
      'audit/tsk-mechanism-scan.json',
      'audit/tsk-primitive-plan.json',
      'audit/tsk-node-acceptance.json',
      'audit/tsk-browser-acceptance.json',
    ],
  }

  // P3 对 P2 的交付声明：TSK 的 keyword 相关原语已在 P2 全部 done，无推迟项。
  const deliveredPrimitives = [...new Set(TSK_KEYWORDS.flatMap(keyword => keyword.primitives))]
    .filter(id => ['done', 'registered'].includes(planRows.get(id)?.status))
    .sort(sortByCodePoint)
  const deferredPrimitives = { p3: [], p4: [] }

  // ── 门禁：全部为 true 时 emit() 才写盘 / 复算通过 ──────────────────────────────────────
  const sourcesStable = sources.every(source => /^[0-9a-f]{64}$/.test(String(source.sha256)))
  const noImplementationProse = TSK_RULES.every(rule => !ENGINEERING_WORDS.test([...rule.body, ...rule.bodyEn].join('')))
  const planGatesPassed = Object.values(plan.gates).every(value => value === true)
  const gates = {
    scanPassed: Object.values(scan.gates).every(value => value === true),
    planGatesPassed,
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
    keywordPrimitivesDone: TSK_KEYWORDS.every(keyword => keyword.primitives
      .every(id => ['done', 'registered'].includes(planRows.get(id)?.status))),
  }

  return {
    schemaVersion: 1,
    cycle: 'tsk',
    campaignId: 'theScarletKeys',
    milestone: 'P3',
    step: 'P3 关键词与规则书',
    generatedBy: 'tools/audit-tsk-rules.mjs',
    docs: 'docs/campaign/theScarletKeys/rulebook.md',
    sources,
    confirmations: {
      keywords: {
        status: keywordsStatus,
        checked: verifiedKeywords,
        total: keywordItems.length,
        checks: [...KEYWORD_MIGRATION_CHECKS],
        items: keywordItems,
      },
      rulebook,
    },
    deferredPrimitives,
    deliveredPrimitives,
    gates,
  }
}

const isCli = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href
if (isCli) {
  const report = await buildRulesAudit()
  const failed = Object.entries(report.gates).filter(([, value]) => value !== true).map(([key]) => key)
  if (process.argv.includes('--write')) {
    emit('rules', report)
    console.log(`tsk rules: 已写入（关键词 ${report.confirmations.keywords.checked}/${report.confirmations.keywords.total} verified；规则 ${report.confirmations.rulebook.entries} 条 ${report.confirmations.rulebook.status}）`)
  } else if (process.argv.includes('--check')) {
    const path = join(MOD, 'audit/tsk-rules.json')
    if (!existsSync(path)) throw new Error('audit/tsk-rules.json 不存在：先 --write')
    const disk = readJson(path)
    if (JSON.stringify(disk) !== JSON.stringify(report)) throw new Error('audit/tsk-rules.json 漂移；审阅变化后显式 --write')
    console.log(`tsk rules: 复算一致（关键词 ${report.confirmations.keywords.total} 个 / 规则 ${report.confirmations.rulebook.entries} 条）`)
  } else {
    console.log(JSON.stringify(report, null, 2))
  }
  if (failed.length) throw new Error(`tsk rules 门禁失败：${failed.join('、')}`)
}
