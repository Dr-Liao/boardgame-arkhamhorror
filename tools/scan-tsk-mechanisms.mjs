#!/usr/bin/env node
// 八循环《绯红密钥》（The Scarlet Keys）P1 机制扫描账本：P2 原语计划的唯一事实源。
//
//   node tools/scan-tsk-mechanisms.mjs --write   生成 audit/tsk-mechanism-scan.json（镜像 artifacts/migration/tsk/）
//   node tools/scan-tsk-mechanisms.mjs --check   复算并与磁盘逐字节比对（卡文 / 来源 / 归属 / 依赖变化即失败）
//   node tools/scan-tsk-mechanisms.mjs           打印 JSON（report 模式，不写盘）
//
// 口径（docs/campaign/theScarletKeys/README.md §3 P1、§4、§5）：
//   · 439 条印刷记录逐条分类：name+subname+text+backText+customizationText+customizationChange+traits
//     正则命中所有机制（内容型兜底可再用 type/owner/face/字段/显式卡号谓词），每条至少 1 个机制、
//     unclassified = 0；behaviorStatus 恒为 pending（分类 != 逐卡行为验收）；
//   · 机制词表见 tools/tsk-mechanisms.mjs；原语目录 / 引擎盘点 / 8 个关键机制由
//     tools/tsk-mechanism-primitives.mjs 提供（P1-A/B），指南、地图密档与规则来源由
//     tools/tsk-guide-scan.mjs 提供（P1-C）；
//   · 本文件只做分类与缺口登记，不写卡、不改引擎；P2 的原语计划从 primitiveGaps 出发。
import { pathToFileURL } from 'node:url'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

import { ALL_CARDS } from '../src/cards/cards-data.js'
import { CYCLE_CODES } from '../content/campaigns/theScarletKeys/shared.js'
import { emit, json, sha, MOD } from './tsk-migration-lib.mjs'
import { MECHANISMS, MECHANISM_TYPES } from './tsk-mechanisms.mjs'
import { BLOCKED_PRIMITIVES, ENGINE_INVENTORY, KEY_MECHANISMS, PRIMITIVE_CATALOG } from './tsk-mechanism-primitives.mjs'
import { TSK_GUIDE_LAYERS, buildGuides, buildStoryScan } from './tsk-guide-scan.mjs'
import { buildScope } from './scan-tsk-scope.mjs'

// P1 硬口径：439 条记录、8 个关键机制（README §5）、10 章指南、原语目录 77 项（P1-A/B 目录契约）。
// 439 与 8/10 来自路线图；77 是 P1-A/B 目录快照（测试同口径），偏离即证明依赖漂移。
const EXPECTED = Object.freeze({
  cards: 439,
  keyMechanisms: 8,
  guides: 10,
  primitiveCatalog: 77,
  dossiers: 14,
  interludes: 17,
  statusReports: 8,
  recordKeys: 81,
  specialRules: 6,
})

// 数据事实核对表：用于核对分类口径（不修改数据；cards/occurrences 同时记录，差异显式可见）。
// 数字取自 2026-11-10 P1 首次扫描的卡表实测值（cards*.json 不可变），漂移即证明数据或词表被改。
const DATA_FACTS = Object.freeze([
  ['concealed', '\\bConcealed\\b', 90, 148], ['concealedX', '\\bConcealed \\d', 27, 28],
  ['shift', '\\bShift\\b', 23, 23], ['hollow', '\\b[Hh]ollow', 39, 70], ['erase', 'Erased from Existence', 2, 2],
  ['customizable', '\\bCustomizable\\b', 17, 26], ['patrol', '\\bPatrol\\b', 9, 12],
  ['hunter', '\\bHunter\\b', 38, 51], ['aloof', '\\bAloof\\b', 13, 14], ['retaliate', '\\bRetaliate\\b', 20, 21],
  ['alert', '\\bAlert\\b', 13, 14], ['massive', '\\bMassive\\b', 5, 5], ['surge', '\\bSurge\\b', 14, 14],
  ['peril', '\\bPeril\\b', 7, 7], ['victory', '\\bVictory\\b', 16, 23], ['objective', '\\bObjective\\b', 36, 38],
  ['prey', '\\bPrey\\b', 4, 4], ['spawn', '\\bSpawn\\b', 24, 32], ['parley', '\\bParley\\b', 19, 23],
  ['resign', '\\bResign\\b', 12, 13], ['fast', '\\[fast\\]', 42, 53], ['permanent', '\\bPermanent\\b', 4, 4],
  ['exceptional', '\\bExceptional\\b', 3, 3], ['elite', '\\bElite\\b', 62, 69], ['revelation', '\\bRevelation\\b', 51, 52],
  ['hidden', '\\bHidden\\b', 6, 7], ['bonded', '\\bBonded\\b', 1, 1], ['uses', '\\bUses \\(', 17, 23],
  ['doom', '\\bdoom\\b', 57, 86], ['evidence', '\\bevidence\\b', 10, 31], ['miniCard', 'mini-card', 68, 114],
  ['decoy', '\\bDecoy\\b', 15, 19], ['expose', 'expose', 42, 51], ['flip', '\\bflip\\b', 58, 69],
  ['trait', '\\[\\[[^\\]]+\\]\\]', 158, 272], ['tokenSymbol', '\\[(?:skull|cultist|tablet|elder_thing|elder_sign|auto_fail)\\]', 33, 126],
])
// 卡牌类型分布（内容型兜底机制覆盖核对）。
const TYPE_FACTS = Object.freeze({
  investigator: 6, skill: 9, treachery: 42, asset: 73, enemy: 66, event: 47,
  scenario: 10, agenda: 28, act: 35, location: 93, key: 20, story: 10,
})

const stableSort = values => [...values].sort()
const isFace = code => /^\d{5}[a-z]$/.test(code)
// 扫描语料：正面 + 背面 + 定制栏 + 特质（P1 要求「全量扫描卡面、背面、定制栏」）。
const corpusOf = code => {
  const card = ALL_CARDS[code]
  return [
    card.name || '', card.subname || '', card.text || '', card.backText || '',
    card.customizationText || '', card.customizationChange || '', (card.traits || []).join(' '),
  ].join('\n')
}
const textSha256Of = code => sha(json({
  text: ALL_CARDS[code].text || '',
  backText: ALL_CARDS[code].backText || '',
  customizationText: ALL_CARDS[code].customizationText || '',
}))

export function buildScan() {
  const scope = buildScope()
  const ownerByCode = new Map()
  for (const [pack, codes] of Object.entries(scope.partitions)) for (const code of codes) ownerByCode.set(code, pack)
  const corpus = new Map(CYCLE_CODES.map(code => [code, corpusOf(code)]))
  const occurrences = (code, pattern) => (corpus.get(code).match(new RegExp(pattern, 'gi')) || []).length

  // ── 机制匹配：显式卡号 / 数据字段 / 类型 / 归属 / 关联面 / 正则，五类谓词 ─────────────────
  const matches = (def, code) => {
    const card = ALL_CARDS[code]
    if (def.codes && def.codes.includes(code)) return true
    if (def.fields && def.fields.some(field => String(card[field] || '').trim())) return true
    if (def.types && def.types.includes(card.type)) return true
    if (def.owners && def.owners.includes(ownerByCode.get(code))) return true
    if (def.faces && isFace(code)) return true
    return (def.patterns || []).some(pattern => new RegExp(pattern, 'i').test(corpus.get(code)))
  }

  // ── 生成型机制：10 章（scenario）+ 战役流程节点（rulebook）────────────────────────────
  const chapterGroupCodes = new Map(scope.sets.chapterGroups.map(entry => [entry.chapterId, entry.codes]))
  const chapterMechanisms = scope.chapters.map(chapter => ({
    id: `scenario.${chapter.id}`,
    type: 'scenario',
    title: `${chapter.name}（${chapter.nameEn}）`,
    patterns: [],
    candidatePrimitives: ['core.scenarioDecks', 'core.physicalFaces', 'core.hiddenInfo', 'core.choices'],
    fixedCodes: chapterGroupCodes.get(chapter.id) || [],
    source: chapter.source,
    evidence: {
      stepId: chapter.stepId,
      referenceCode: chapter.referenceCode,
      promptCardCode: chapter.promptCard.code,
      mapLocationId: chapter.mapLocationId,
      archiveLabel: chapter.archiveLabel,
      gatherSets: chapter.gatherSets.map(gather => gather.set),
      guideSources: chapter.guideSources.map(source => source.path),
    },
  }))
  const interludeMechanisms = scope.campaignFlow.interludes.map(entry => ({
    id: `flow.interlude${entry.number}`,
    type: 'rulebook',
    title: `战役流程：密档幕间 ${entry.number}（${entry.nameEn || entry.scopeId}）`,
    patterns: [],
    candidatePrimitives: ['core.campaignFlow', 'core.records', 'new.dossierReading', 'extend.records'],
    fixedCodes: [],
    source: scope.campaignFlow.source,
    evidence: { scopeId: entry.scopeId, triggerLocations: entry.triggerLocations, archiveLabel: entry.archiveLabel },
  }))
  const flowMechanisms = [
    {
      id: 'flow.worldMapEmbark', type: 'rulebook', title: '战役流程：世界地图启程循环（Embark & Travel）', patterns: [],
      candidatePrimitives: ['new.worldMap', 'new.travelTime', 'new.embarkChoice', 'new.statusReports', 'new.expeditedTicket',
        'new.mapNodeUnlocks', 'new.sideStories', 'core.mapGraph', 'extend.campaignFlow', 'core.records', 'core.recordCount', 'extend.choices'],
      fixedCodes: [], source: scope.campaignFlow.source,
      evidence: { travelDestinations: scope.campaignFlow.travelDestinations.length, rules: scope.campaignFlow.travelRules },
    },
    {
      id: 'flow.statusReports', type: 'rulebook', title: '战役流程：状况报告 α–ω', patterns: [],
      candidatePrimitives: ['new.statusReports', 'core.tokens', 'new.dossierReading', 'core.records'],
      fixedCodes: [], source: scope.campaignFlow.source, evidence: { reports: scope.campaignFlow.statusReports },
    },
    {
      id: 'flow.epilogue', type: 'rulebook', title: '战役流程：尾声 trust/deception 分支', patterns: [],
      candidatePrimitives: ['extend.campaignFlow', 'core.records', 'core.recordCount', 'new.invalidCards'],
      fixedCodes: [], source: scope.campaignFlow.source, evidence: scope.campaignFlow.epilogue,
    },
    {
      id: 'flow.redCoterieInjection', type: 'rulebook', title: '战役流程：红色同志会遭遇注入', patterns: [],
      candidatePrimitives: ['new.redCoterie', 'new.coterieEncounterInjection', 'core.encounter', 'extend.records'],
      fixedCodes: [], source: scope.campaignFlow.source,
      evidence: { coterie: scope.campaignFlow.redCoterie.map(entry => entry.code) },
    },
    {
      id: 'flow.invalidCards', type: 'rulebook', title: '战役流程：禁用卡与存在抹除构筑限制', patterns: [],
      candidatePrimitives: ['new.invalidCards', 'new.erasedFromExistence', 'core.deck', 'core.records'],
      fixedCodes: [], source: scope.campaignFlow.source, evidence: scope.campaignFlow.invalidCards,
    },
    {
      id: 'flow.sideStories', type: 'rulebook', title: '战役流程：绿地 side story 跳跃', patterns: [],
      candidatePrimitives: ['new.sideStories', 'extend.campaignFlow', 'new.travelTime'],
      fixedCodes: [], source: scope.campaignFlow.source, evidence: { locations: scope.campaignFlow.travelDestinations.filter(row => row.step === 'sideStory').map(row => row.location) },
    },
  ]

  const mechanismRows = [...MECHANISMS, ...chapterMechanisms, ...interludeMechanisms, ...flowMechanisms].map(def => {
    const cards = def.fixedCodes
      ? stableSort(def.fixedCodes.filter(code => ALL_CARDS[code]))
      : stableSort(CYCLE_CODES.filter(code => matches(def, code)))
    const candidatePrimitives = [...new Set(def.candidatePrimitives)]
    const kinds = candidatePrimitives.map(id => PRIMITIVE_CATALOG[id]?.kind || null)
    const known = kinds.every(kind => kind !== null)
    const gap = candidatePrimitives.filter((id, index) => kinds[index] === 'new')
    const { fixedCodes, ...rest } = def
    return {
      ...rest,
      candidatePrimitives,
      cards,
      source: def.source || ['frontend/public/cards.json', 'backend/arkham-api/library/Arkham/'],
      existing: kinds.every(kind => kind !== 'new'),
      gap,
      blocked: !known,
    }
  })

  // ── 关键机制（README §5 的 8 条）：用同一语料重算代表卡，分类由原语目录 kind 派生 ─────────
  const keyMechanisms = KEY_MECHANISMS.map(entry => {
    const explicit = stableSort(entry.explicitCodes || [])
    const matched = stableSort(CYCLE_CODES.filter(code => (entry.patterns || []).some(pattern => new RegExp(pattern, 'i').test(corpus.get(code)))))
    const cards = stableSort([...new Set([...explicit, ...matched])])
    const primitiveIds = [...new Set(entry.primitiveIds)]
    const kinds = Object.fromEntries(primitiveIds.map(id => [id, PRIMITIVE_CATALOG[id]?.kind || null]))
    const unknownIds = primitiveIds.filter(id => !kinds[id])
    const reuse = primitiveIds.filter(id => kinds[id] === 'reuse')
    const extend = primitiveIds.filter(id => kinds[id] === 'extend')
    const next = primitiveIds.filter(id => kinds[id] === 'new')
    const classification = unknownIds.length ? 'unknown'
      : next.length === 0 ? (extend.length ? 'extend' : 'reuse')
        : reuse.length + extend.length === 0 ? 'gaps' : 'reuse+gaps'
    const { explicitCodes, ...rest } = entry
    return {
      ...rest,
      cards,
      primitiveIds,
      classification,
      classificationDetail: { reuse, extend, new: next },
      unknownPrimitives: unknownIds,
      existing: unknownIds.length === 0 && next.length === 0,
    }
  })

  // ── 原语缺口：目录里所有 kind=new/extend 的条目（P2 计划的输入），并回填引用它的机制 ─────
  const gapReferences = new Map()
  const referenceGap = (id, mechanismId) => {
    if (!gapReferences.has(id)) gapReferences.set(id, [])
    gapReferences.get(id).push(mechanismId)
  }
  for (const row of mechanismRows) for (const id of row.candidatePrimitives) referenceGap(id, row.id)
  for (const row of keyMechanisms) for (const id of row.primitiveIds) referenceGap(id, row.id)
  const catalogGapIds = Object.entries(PRIMITIVE_CATALOG)
    .filter(([, entry]) => entry.kind === 'new' || entry.kind === 'extend')
    .map(([id]) => id)
    .sort()
  const primitiveGaps = catalogGapIds.map(id => {
    const entry = PRIMITIVE_CATALOG[id]
    return {
      id,
      kind: entry.kind,
      modules: [...(entry.modules || [])],
      names: [...(entry.names || [])],
      reason: entry.note || (entry.kind === 'new' ? 'P1 扫描登记：P2 需新增原语' : 'P1 扫描登记：P2 需扩展现有原语'),
      blocked: entry.blocked === true,
      mechanisms: stableSort([...new Set(gapReferences.get(id) || [])]),
    }
  })

  // ── 439 条记录的反向索引：每条卡拿到排好序的机制 id 列表 ─────────────────────────────
  const mechanismsByCard = new Map(CYCLE_CODES.map(code => [code, []]))
  for (const row of mechanismRows) for (const code of row.cards) mechanismsByCard.get(code).push(row.id)
  const cards = CYCLE_CODES.map(code => ({
    code,
    textSha256: textSha256Of(code),
    mechanisms: stableSort(mechanismsByCard.get(code)),
    behaviorStatus: 'pending',
  }))
  const unclassified = cards.filter(card => card.mechanisms.length === 0).map(card => card.code)

  // ── P1-C 的纯数据依赖（逐字透传，不在本层改写）────────────────────────────────────────
  const guides = buildGuides()
  const rules = buildStoryScan()
  const engine = ENGINE_INVENTORY
  const primitives = PRIMITIVE_CATALOG

  // ── 数据事实核对（门禁：首次扫描基线，漂移即证明卡表或词表被改）─────────────────────────
  const dataFacts = [
    ...DATA_FACTS.map(([id, pattern, expectedCards, expectedOccurrences]) => {
      const matchedCards = CYCLE_CODES.filter(code => new RegExp(pattern, 'i').test(corpus.get(code))).length
      const matchedOccurrences = CYCLE_CODES.reduce((total, code) => total + occurrences(code, pattern), 0)
      return {
        kind: 'mechanism', id, pattern, expectedCards, expectedOccurrences,
        cards: matchedCards, occurrences: matchedOccurrences,
        matchesCards: matchedCards === expectedCards, matchesOccurrences: matchedOccurrences === expectedOccurrences,
      }
    }),
    ...Object.entries(TYPE_FACTS).map(([type, expected]) => {
      const derived = CYCLE_CODES.filter(code => ALL_CARDS[code].type === type).length
      return { kind: 'cardType', id: type, expected, cards: derived, occurrences: null, matchesCards: derived === expected, matchesOccurrences: null }
    }),
  ]

  // ── 待办 / 阻断：P0 scope 待 P1 复核项 + 扫描发现的未知机制 / 未裁决原语 ────────────────
  const blockedMechanisms = mechanismRows.filter(row => row.blocked).map(row => row.id)
  // P0 scope 的 verify-in-P1 项：P1 扫描没有静默关闭它们，统一结转成 P2 前置裁决项。
  const pending = scope.pending
    .filter(entry => entry.status === 'verify-in-P1')
    .map(entry => ({ ...entry, status: 'verify-in-P2', source: 'audit/tsk-scope.json#pending' }))
  if (blockedMechanisms.length) {
    pending.push({
      id: 'unknownMechanisms', status: 'blocked', mechanisms: blockedMechanisms,
      detail: '扫描发现引用了未登记原语的机制，P1 不得静默放行；需先补 PRIMITIVE_CATALOG 或修正词表',
    })
  }
  if (BLOCKED_PRIMITIVES.length) {
    pending.push({
      id: 'blockedPrimitives', status: 'blocked', primitives: [...BLOCKED_PRIMITIVES],
      detail: 'P1-A/B 原语目录中规则边界未确认的条目；P2 前需对照规则书裁决，不得按已实现计入',
    })
  }
  const unresolvedByScan = primitiveGaps.filter(gap => gap.mechanisms.length === 0).map(gap => gap.id)
  if (unresolvedByScan.length) {
    pending.push({
      id: 'unreferencedPrimitiveGaps', status: 'blocked', primitives: unresolvedByScan,
      detail: '原语缺口没有被任何机制引用，说明词表与目录脱节；P2 前必须修正',
    })
  }
  const recordKeysMissingZh = rules.recordKeys.keys.filter(entry => !entry.zh).map(entry => entry.zhLabelPath)
  if (recordKeysMissingZh.length) {
    pending.push({
      id: 'recordKeysMissingZh', status: 'verify-in-P7',
      paths: recordKeysMissingZh,
      detail: `参考 Key.hs 的 ${rules.recordKeys.totals.keys} 个记录键里有 ${recordKeysMissingZh.length} 个中文标签缺失；P7 生成完整叙事/指南时补译，不在 P1 改数据。`,
    })
  }
  const dossierWithoutTarget = rules.archiveLabels.mapDossiers
    .filter(dossier => dossier.label && dossier.locations.length === 0 && !dossier.chapterId && !dossier.interludeNumber)
  if (dossierWithoutTarget.length) {
    pending.push({
      id: 'mapDossiersWithoutTarget', status: 'verify-in-P7',
      keys: dossierWithoutTarget.map(dossier => dossier.key),
      detail: '地图密档没有匹配到地图节点/章节/幕间；P7 按参考剧情核对，不静默丢弃。',
    })
  }

  // ── 计数 ─────────────────────────────────────────────────────────────────────────────
  const byType = Object.fromEntries(MECHANISM_TYPES.map(type => [type, mechanismRows.filter(row => row.type === type).length]))
  const guideSections = guides.reduce((total, guide) => total + guide.sections.length, 0)
  const guideGaps = guides.reduce((total, guide) => total + guide.summary.missing + guide.summary.untranslated, 0)
  const storyGaps = rules.campaignStory.totals.missing + rules.campaignStory.totals.untranslated
  const interludeGaps = rules.interludes.reduce((total, entry) => total + entry.summary.missing + entry.summary.untranslated, 0)
  const statusReportGaps = rules.statusReports.reduce((total, entry) => total + entry.summary.missing + entry.summary.untranslated, 0)
  const specialRuleGaps = rules.specialRules.sections.filter(section => section.chinese === 'missing' || section.chinese === 'untranslated').length
  const chineseGaps = {
    guides: guideGaps, story: storyGaps, interludes: interludeGaps, statusReports: statusReportGaps, specialRules: specialRuleGaps,
    total: guideGaps + storyGaps + interludeGaps + statusReportGaps + specialRuleGaps,
  }
  const counts = {
    cards: cards.length,
    mechanisms: mechanismRows.length,
    byType,
    keyMechanisms: keyMechanisms.length,
    primitiveCatalog: Object.keys(PRIMITIVE_CATALOG).length,
    primitiveGaps: primitiveGaps.length,
    primitiveCatalogByKind: Object.fromEntries(['reuse', 'extend', 'new'].map(kind => [kind, Object.values(PRIMITIVE_CATALOG).filter(entry => entry.kind === kind).length])),
    guides: guides.length,
    guideSections,
    chineseGaps,
    missingTranslations: chineseGaps.total,
    specialRules: guides.reduce((total, guide) => total + guide.summary.specialRules, 0),
    campaignSpecialRules: rules.specialRules.entries,
    dossiers: rules.archiveLabels.dossierCount,
    interludes: rules.interludes.length,
    statusReports: rules.statusReports.length,
    recordKeys: rules.recordKeys.totals.keys,
  }

  // ── 门禁：布尔值，必须全为 true；emit() 在任一非 true 时抛错 ──────────────────────────
  const referencedPrimitiveIds = [
    ...mechanismRows.flatMap(row => row.candidatePrimitives),
    ...keyMechanisms.flatMap(row => row.primitiveIds),
  ]
  const allPrimitiveIds = stableSort([...new Set(referencedPrimitiveIds)])
  const chineseStates = ['present', 'present-needs-review', 'untranslated', 'missing']
  const guideShaValid = lock => Boolean(lock && lock.sha256 && /^[0-9a-f]{64}$/.test(lock.sha256))
  const storyGroupIds = rules.campaignStory.groups.map(group => group.id)
  const requiredStoryGroups = ['prologue', 'interlude1', 'embarkingAndTravel', 'theFoundationDossiers',
    'campaignMapDossiers', 'interludes', 'statusReports', 'specialRules', 'epilogue']
  const allGuideSections = guides.flatMap(guide => guide.sections)
  const requiredGuideLayers = ['heading', 'tokens', 'setup', 'intro', 'resolutions', 'labels', 'specialRules', 'rules']
  const engineFilesExist = Object.values(engine.keywordSupport).every(entry =>
    entry.files.every(file => existsSync(join(MOD, file))))
    && Object.keys(engine.precedentModules).every(file => existsSync(join(MOD, file)))
  const gapsListed = catalogGapIds.join('|') === primitiveGaps.map(gap => gap.id).join('|')
  const gates = {
    scopePassed: Object.values(scope.gates).every(value => value === true),
    allCardsClassified: cards.length === EXPECTED.cards && unclassified.length === 0
      && cards.every(card => card.mechanisms.length > 0),
    sixTypesCovered: MECHANISM_TYPES.every(type => mechanismRows.some(row => row.type === type)),
    keyMechanismsClassified: keyMechanisms.length === EXPECTED.keyMechanisms
      && keyMechanisms.every(row => row.cards.length > 0 && row.primitiveIds.length > 0
        && /reuse|extend|gap/i.test(row.classification)
        && row.unknownPrimitives.length === 0)
      && stableSort(keyMechanisms.map(row => row.id)).join('|') === stableSort(KEY_MECHANISMS.map(row => row.id)).join('|'),
    primitiveCandidatesKnown: allPrimitiveIds.every(id => Boolean(PRIMITIVE_CATALOG[id])),
    primitiveCatalog: Object.keys(PRIMITIVE_CATALOG).length === EXPECTED.primitiveCatalog,
    primitiveGapsListed: gapsListed && primitiveGaps.every(gap => gap.kind === 'new' || gap.kind === 'extend')
      && primitiveGaps.every(gap => gap.mechanisms.length > 0),
    blockedPrimitivesRecorded: BLOCKED_PRIMITIVES.every(id => primitiveGaps.some(gap => gap.id === id && gap.blocked === true))
      && pending.some(entry => entry.status === 'blocked' && (entry.primitives || []).length > 0),
    guidesInventoried: guides.length === EXPECTED.guides
      && guides.map(guide => guide.id).join('|') === scope.chapters.map(chapter => chapter.id).join('|')
      && guides.every(guide => guideShaValid(guide.sources.en) && guideShaValid(guide.sources.zh)
        && guide.sections.some(section => section.layer === 'setup')
        && guide.sections.some(section => section.layer === 'resolutions')
        && guide.archiveLabelMatched === true)
      && requiredGuideLayers.every(layer => allGuideSections.some(section => section.layer === layer)),
    chineseGapsRecorded: counts.missingTranslations > 0
      && allGuideSections.every(section => chineseStates.includes(section.chinese))
      && rules.specialRules.sections.every(section => chineseStates.includes(section.chinese))
      && rules.interludes.every(entry => entry.sections.every(section => chineseStates.includes(section.chinese))),
    storyInventoried: requiredStoryGroups.every(group => storyGroupIds.includes(group))
      && rules.archiveLabels.dossierCount === EXPECTED.dossiers
      && rules.interludes.length === EXPECTED.interludes
      && rules.statusReports.length === EXPECTED.statusReports
      && rules.specialRules.entries === EXPECTED.specialRules
      && rules.recordKeys.totals.keys === EXPECTED.recordKeys
      && rules.recordKeys.keys.length === rules.recordKeys.totals.keys,
    archiveLabelsInventoried: rules.archiveLabels.expected.chapters.every(entry =>
      rules.archiveLabels.mapDossiers.some(dossier => dossier.label === entry.label)
      || rules.guides.generated.some(guide => guide.id === entry.chapterId && guide.archiveLabelMatched))
      && rules.guides.archiveLabelMatched === EXPECTED.guides
      && rules.archiveLabels.expected.interludes.every(entry =>
        rules.interludes.some(interlude => interlude.number === entry.interludeNumber && interlude.archiveLabel === entry.label)),
    cardsBehaviorPending: cards.every(card => card.behaviorStatus === 'pending'),
    dataFactsStable: dataFacts.every(fact => fact.matchesCards === true && (fact.matchesOccurrences === true || fact.matchesOccurrences === null)),
    engineInventory: engine.effectPrimitives.count > 0 && engine.apiModules.length > 0
      && engine.windows.count > 0 && engine.matchers.count > 0 && engine.abilityKinds.length > 0
      && engine.playChannels.channels.length > 0 && engineFilesExist,
    noUnknownMechanismSilentlyApproved: unclassified.length === 0
      && blockedMechanisms.every(id => pending.some(entry => entry.status === 'blocked' && (entry.mechanisms || []).includes(id))),
  }
  if (!gates.dataFactsStable) {
    const drifted = dataFacts.filter(fact => fact.matchesCards !== true || (fact.matchesOccurrences !== null && fact.matchesOccurrences !== true))
    console.error(`tsk mechanism-scan 数据事实漂移：${drifted.map(fact => `${fact.kind}:${fact.id}(${fact.expectedCards}/${fact.expectedOccurrences}→${fact.cards}/${fact.occurrences})`).join(', ')}`)
  }

  return {
    schemaVersion: 1,
    cycle: 'tsk',
    campaignId: scope.campaignId,
    milestone: 'P1',
    step: 'P1 机制扫描',
    generatedBy: 'tools/scan-tsk-mechanisms.mjs',
    docs: 'docs/campaign/theScarletKeys/README.md',
    status: 'catalog-only',
    scopeSha256: sha(json(scope)),
    guideLayers: [...TSK_GUIDE_LAYERS],
    counts,
    engine,
    primitives,
    keyMechanisms,
    mechanisms: mechanismRows,
    cards,
    unclassified,
    guides,
    rules,
    primitiveGaps,
    dataFacts,
    pending,
    gates,
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) emit('mechanism-scan', buildScan())
