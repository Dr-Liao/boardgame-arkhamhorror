#!/usr/bin/env node
// 七循环《地球边缘》（Edge of the Earth）P3 关键词与规则书审计账本。
//
//   node tools/audit-eote-rules.mjs --write   生成 audit/eote-rules.json（镜像 artifacts/migration/eote/rules.json）
//   node tools/audit-eote-rules.mjs --check   复算并与磁盘逐字节比对（关键词 / 规则 / 证据漂移即失败）
//   node tools/audit-eote-rules.mjs           打印 JSON（report 模式，不写盘；门禁失败时抛错）
//
// 事实源（全部现场复算，不复制结论）：
//   · 关键词身份 = content/campaigns/edgeOfTheEarth/keywords.js（38 个，cardCodes 与 P1 扫描逐条一致）；
//   · 关键词行为 = tools/scan-eote-mechanisms.mjs 的 keyword 机制 + P2 计划（audit/eote-primitive-plan.json）；
//   · 规则条目 = web/eote-rules.js（23 条）经 web/rulebook-data.js 注册后的 ruleById / RULE_INDEX / matchingRules；
//   · 卡文直达 = web/rulebook-data.js#cardRuleIds（/^08/ 派发）+ EOTE_CARD_RULE_PATTERNS 反向核对；
//   · Node 验收 = audit/eote-node-acceptance.json；浏览器验收 = audit/eote-browser-acceptance.json（P3-C 产出）。
//
// P3 裁决（Lead）：keyword.* 七个原语由本阶段「关键词清单 + 规则条目 + 卡文直达」交付，不要求引擎改动；
// interaction.tekeliShuffle 记录为 P4 排期（非阻塞），但必须在 deferredPrimitives.p4 显式登记。
// 确定性：无时间戳、排序稳定；`--check` 逐字节复算。
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import { ALL_CARDS } from '../src/cards/cards-data.js'
import { CYCLE_CODES, chapters } from '../content/campaigns/edgeOfTheEarth/shared.js'
import { EOTE_KEYWORDS } from '../content/campaigns/edgeOfTheEarth/keywords.js'
import { KEYWORD_MIGRATION_CHECKS, RULEBOOK_MIGRATION_CHECKS } from '../content/migration-confirmation.js'
import { RULE_INDEX, cardRuleIds, matchingRules, ruleById } from '../web/rulebook-data.js'
import { EOTE_CARD_RULE_PATTERNS, EOTE_RULE_IDS, EOTE_RULES } from '../web/eote-rules.js'
import { MOD, emit, readJson, sourceLock } from './eote-migration-lib.mjs'
import { buildScan } from './scan-eote-mechanisms.mjs'
import { buildPrimitivePlan } from './audit-eote-primitives.mjs'

const CYCLE = 'eote'
const DOCS = 'docs/edgeOfTheEarth/primitives.md'
const SOURCE_PATHS = Object.freeze([
  'audit/eote-mechanism-scan.json',
  'audit/eote-primitive-plan.json',
  'web/eote-rules.js',
  'content/campaigns/edgeOfTheEarth/keywords.js',
  'audit/eote-node-acceptance.json',
  'audit/eote-browser-acceptance.json',
])
// P3 裁决：keyword.* 七项由规则层交付；tekeli 的 P4 交互显式排期。
const P3_DELIVERED_PRIMITIVES = Object.freeze([
  'keyword.mirage', 'keyword.shelter', 'keyword.partner', 'keyword.resolute', 'keyword.expedition', 'keyword.level', 'keyword.key',
])
const P4_SCHEDULED_PRIMITIVES = Object.freeze(['interaction.tekeliShuffle'])
const ENGINEERING_WORDS = /引擎|实现|依赖|源码|审计|界面|按钮|\b(?:verified|pending|engine|implementation)\b|src\//i
const CARD_TEXT = code => [ALL_CARDS[code]?.name || '', ALL_CARDS[code]?.text || '', ALL_CARDS[code]?.backText || ''].join('\n')

const existsAt = path => existsSync(join(MOD, path))
const readRepoJson = path => (existsAt(path) ? readJson(join(MOD, path)) : null)
const safeSha256 = path => {
  if (!existsAt(path)) return null
  return sourceLock(path, MOD).sha256
}
const booleanMap = (checks, keys) => {
  for (const key of keys) if (typeof checks[key] !== 'boolean') checks[key] = Boolean(checks[key])
  return checks
}

export async function buildRulesAudit () {
  const scan = buildScan()
  const plan = await buildPrimitivePlan()
  const nodeReport = readRepoJson('audit/eote-node-acceptance.json')
  const browserReport = readRepoJson('audit/eote-browser-acceptance.json')
  const sources = SOURCE_PATHS.map(path => ({ path, sha256: safeSha256(path) }))

  // ── 关键词：身份 / 扫描 / 原语 / 规则条目 / 卡文直达 五重对账 ─────────────────────────────
  const scanKeywords = scan.mechanisms.filter(row => row.type === 'keyword')
  const p2Rows = new Map([...plan.reuse, ...plan.new].map(row => [row.id, row]))
  const deferredRows = new Map(plan.deferred.map(row => [row.id, row]))
  const keywordItems = EOTE_KEYWORDS.map(keyword => {
    const scanned = scanKeywords.find(row => row.id === keyword.id)
    const baseChecks = {
      sourceInventoried: Boolean(scanned) && (scanned?.cards || []).length > 0
        && JSON.stringify(scanned?.cards || []) === JSON.stringify(keyword.cardCodes),
      rulebookEntry: ruleById(keyword.ruleId)?.id === keyword.ruleId,
      cardLinks: keyword.cardCodes.every(code => cardRuleIds(ALL_CARDS[code]).includes(keyword.ruleId)),
    }
    const engineBehavior = keyword.primitives.every(id => {
      const p2 = p2Rows.get(id)
      if (p2) return p2.status === 'done'
      const deferred = deferredRows.get(id)
      if (!deferred) return false
      if (deferred.phase === 'P3') {
        return P3_DELIVERED_PRIMITIVES.includes(id)
          && baseChecks.rulebookEntry && baseChecks.cardLinks && baseChecks.sourceInventoried
      }
      if (deferred.phase === 'P4') return P4_SCHEDULED_PRIMITIVES.includes(id)
      return false
    })
    const checks = booleanMap({
      ...baseChecks,
      engineBehavior,
      nodeAcceptance: nodeReport?.status === 'passed',
    }, KEYWORD_MIGRATION_CHECKS)
    const complete = KEYWORD_MIGRATION_CHECKS.every(key => checks[key] === true)
    return {
      id: keyword.id,
      ruleId: keyword.ruleId,
      zh: keyword.zh,
      kind: keyword.kind,
      cards: [...keyword.cardCodes],
      primitives: [...keyword.primitives],
      p3Delivered: keyword.primitives.filter(id => P3_DELIVERED_PRIMITIVES.includes(id)),
      scheduledP4: keyword.primitives.filter(id => P4_SCHEDULED_PRIMITIVES.includes(id)),
      checks,
      status: complete ? 'verified' : 'pending',
      evidence: [
        'audit/eote-mechanism-scan.json',
        'audit/eote-primitive-plan.json',
        'audit/eote-node-acceptance.json',
        'content/campaigns/edgeOfTheEarth/keywords.js',
        'web/eote-rules.js',
      ],
    }
  })
  const verifiedKeywords = keywordItems.filter(item => item.status === 'verified').length
  const keywordsStatus = verifiedKeywords === keywordItems.length ? 'verified' : 'pending'

  // ── 规则条目：中英 / 分组 / 拼音 / 相关跳转 / 搜索 / 卡文直达 ───────────────────────────────
  const patternByRule = new Map(EOTE_CARD_RULE_PATTERNS.map(([ruleId, pattern]) => [ruleId, pattern]))
  const ruleItems = EOTE_RULES.map(rule => {
    const pattern = patternByRule.get(rule.id)
    const matchedCards = pattern ? CYCLE_CODES.filter(code => pattern.test(CARD_TEXT(code))) : []
    const checks = {
      entryPresent: ruleById(rule.id)?.id === rule.id,
      bilingual: Array.isArray(rule.body) && Array.isArray(rule.bodyEn)
        && rule.body.length >= 2 && rule.bodyEn.length === rule.body.length
        && Boolean(rule.titleEn) && Boolean(rule.groupEn),
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
      evidence: ['web/eote-rules.js', 'web/rulebook-data.js', 'tests/eote-rules.test.mjs'],
    }
  })
  const verifiedRules = ruleItems.filter(item => item.status === 'verified').length
  const rulesStatus = verifiedRules === ruleItems.length ? 'verified' : 'pending'

  // ── 规则书分区确认（战役概述 / 场景机制 / 卡文直达 / 浏览器）───────────────────────────────
  const overviewRule = EOTE_RULES.find(rule => rule.id === 'eoteCampaign')
    || EOTE_RULES.find(rule => /战役/.test(rule.title) && String(rule.group).includes('地球边缘')) || null
  const overviewZh = overviewRule ? overviewRule.body.join('\n') : ''
  const overviewEn = overviewRule ? (overviewRule.bodyEn || []).join('\n') : ''
  // 八章单元按「章族」核对：拆分篇章在概述里写作「亡命冰原 第 I、II、III 部分」，不能要求命中完整
  // 章节名（如「亡命冰原 第 I 部分」）。同时要求中英文正文各自覆盖。
  const CHAPTER_FAMILIES = Object.freeze([
    ['冰原', '亡命冰原', 'Ice and Death'],
    ['致命幻景', '致命幻景', 'Fatal Mirage'],
    ['失落之峰', '失落之峰', 'Forbidden Peaks'],
    ['古老者之城', '古老者之城', 'City of the Elder Things'],
    ['疯狂之心', '疯狂之心', 'Heart of Madness'],
  ])
  const campaignOverview = {
    entryPresent: Boolean(overviewRule),
    ruleId: overviewRule?.id || null,
    listsEveryChapter: Boolean(overviewRule)
      && CHAPTER_FAMILIES.every(([, zh, en]) => overviewZh.includes(zh) && overviewEn.includes(en)),
    listsInterludes: /幕间/.test(overviewZh) && /检查点/.test(overviewZh) && /尾声/.test(overviewZh)
      && /Interlude/i.test(overviewEn) && /Checkpoint/i.test(overviewEn) && /Epilogue/i.test(overviewEn),
    statesScenarioOrder: Boolean(overviewRule)
      && ['序幕', '尾声'].every(token => overviewZh.includes(token))
      && ['prologue', 'epilogue'].every(token => overviewEn.toLowerCase().includes(token))
      && overviewZh.indexOf('亡命冰原') >= 0 && overviewZh.indexOf('亡命冰原') < overviewZh.indexOf('疯狂之心'),
    relatedRulesExist: Boolean(overviewRule) && (overviewRule.related || []).every(id => ruleById(id)?.id === id),
  }
  const scenarioMechanics = {
    requiredRuleEntries: EOTE_RULES.length,
    entriesPresent: EOTE_RULES.every(rule => ruleById(rule.id)?.id === rule.id),
    entriesInGroup: EOTE_RULES.every(rule => String(rule.group).includes('地球边缘')),
    relatedResolved: EOTE_RULES.every(rule => (rule.related || []).every(id => ruleById(id)?.id === id)),
    keywordEntriesPresent: EOTE_KEYWORDS.every(keyword => ruleById(keyword.ruleId)?.id === keyword.ruleId),
    scenarioReferenceCards: chapters.every(chapter => Boolean(ALL_CARDS[chapter.code]) && ALL_CARDS[chapter.code].type === 'scenario'),
    scenarioCardsLinkCampaignRule: chapters.every(chapter => cardRuleIds(ALL_CARDS[chapter.code]).includes('eoteCampaign')),
  }
  const unlinked = CYCLE_CODES.filter(code => cardRuleIds(ALL_CARDS[code]).length === 0)
  const cardLinks = {
    total: CYCLE_CODES.length,
    linked: CYCLE_CODES.length - unlinked.length,
    unlinked,
    keywordLinkTargets: EOTE_KEYWORDS.every(keyword => keyword.cardCodes
      .every(code => cardRuleIds(ALL_CARDS[code]).includes(keyword.ruleId))),
  }
  const browserChecks = browserReport?.checks || {}
  const browserAcceptance = Boolean(browserReport) && browserReport.status === 'passed'
    && ['desktop', 'mobile', 'zh', 'en', 'cardLink', 'noHorizontalScroll'].every(key => browserChecks[key] === true)
    && Array.isArray(browserReport.screenshots) && browserReport.screenshots.length > 0
  const ruleChecks = booleanMap({
    campaignOverview: Object.values(campaignOverview).filter(value => typeof value === 'boolean').every(Boolean),
    scenarioMechanics: scenarioMechanics.entriesPresent && scenarioMechanics.entriesInGroup
      && scenarioMechanics.relatedResolved && scenarioMechanics.scenarioReferenceCards
      && scenarioMechanics.scenarioCardsLinkCampaignRule,
    keywordEntries: keywordsStatus === 'verified',
    cardLinks: cardLinks.unlinked.length === 0 && cardLinks.keywordLinkTargets
      && scenarioMechanics.scenarioCardsLinkCampaignRule,
    desktopBrowser: Boolean(browserChecks.desktop),
    mobileBrowser: Boolean(browserChecks.mobile),
  }, RULEBOOK_MIGRATION_CHECKS)
  const rulebookStatus = Object.values(ruleChecks).every(Boolean) ? 'verified' : 'pending'
  const rulebook = {
    status: rulebookStatus,
    entries: EOTE_RULES.length,
    requiredRuleIds: [...EOTE_RULE_IDS],
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
      'web/eote-rules.js',
      'content/campaigns/edgeOfTheEarth/keywords.js',
      'tests/eote-rules.test.mjs',
      'audit/eote-mechanism-scan.json',
      'audit/eote-primitive-plan.json',
      'audit/eote-node-acceptance.json',
      'audit/eote-browser-acceptance.json',
    ],
  }

  // ── P3 规则层交付 / P4 排期：显式登记，供 P2 账本回写与发布审计引用 ─────────────────────────
  const referencedDeferred = new Set(EOTE_KEYWORDS.flatMap(keyword => keyword.primitives
    .filter(id => deferredRows.has(id))))
  const deliveredPrimitives = P3_DELIVERED_PRIMITIVES.filter(id => {
    const users = EOTE_KEYWORDS.filter(keyword => keyword.primitives.includes(id))
    if (!users.length) return false
    return users.every(keyword => {
      const item = keywordItems.find(entry => entry.id === keyword.id)
      return item.checks.sourceInventoried && item.checks.rulebookEntry && item.checks.cardLinks
    })
  })
  const p4ScheduledRecorded = P4_SCHEDULED_PRIMITIVES.every(id =>
    deferredRows.get(id)?.phase === 'P4' && EOTE_KEYWORDS.some(keyword => keyword.primitives.includes(id)))
  const deferredPrimitives = {
    p3: P3_DELIVERED_PRIMITIVES.filter(id => referencedDeferred.has(id)),
    p4: P4_SCHEDULED_PRIMITIVES.filter(id => referencedDeferred.has(id)),
  }

  // ── 门禁：全部为 true 时 emit() 才写盘 / 复算通过 ───────────────────────────────────────
  const sourcesStable = sources.every(source => /^[0-9a-f]{64}$/.test(String(source.sha256)))
  const noImplementationProse = EOTE_RULES.every(rule => !ENGINEERING_WORDS.test([...rule.body, ...rule.bodyEn].join('')))
  // P2 计划用 audit/eote-rules.json 的 deliveredPrimitives 回填 7 个 P3 keyword.*（见 audit-eote-primitives.mjs）。
  // 首次 --write 时该账本尚不存在：允许 p3Delivered 处于「待本账本写入后回填」的引导状态，其余计划门禁必须全真；
  // 写入后重算时 p3Delivered 必须为 true，口径才闭环（后续 --check 不受影响）。
  const rulesAuditExists = existsAt('audit/eote-rules.json')
  const planGatesPassed = Object.entries(plan.gates).every(([key, value]) =>
    key === 'p3Delivered' ? (value === true || !rulesAuditExists) : value === true)
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
    nodeAcceptance: nodeReport?.status === 'passed',
    browserAcceptance,
    sourcesStable,
    p4ScheduledRecorded,
    deliveredPrimitivesRecorded: deliveredPrimitives.length === P3_DELIVERED_PRIMITIVES.length,
  }

  return {
    schemaVersion: 1,
    cycle: CYCLE,
    milestone: 'P3',
    step: 'P3 关键词与规则书',
    generatedBy: 'tools/audit-eote-rules.mjs',
    docs: DOCS,
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

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = await buildRulesAudit()
  emit('rules', report)
}
