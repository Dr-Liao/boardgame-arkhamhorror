#!/usr/bin/env node
// 七循环《地球边缘》（Edge of the Earth）P1 机制扫描账本：P2 原语计划的唯一事实源。
//
//   node tools/scan-eote-mechanisms.mjs --write   生成 audit/eote-mechanism-scan.json（镜像 artifacts/migration/eote/）
//   node tools/scan-eote-mechanisms.mjs --check   复算并与磁盘逐字节比对（卡文 / 来源 / 归属 / 依赖变化即失败）
//   node tools/scan-eote-mechanisms.mjs           打印 JSON（report 模式，不写盘）
//
// 口径（docs/edgeOfTheEarth/README.md §3 P1、§4、§5）：
//   · 403 条印刷记录逐条分类：name + text + backText 正则命中所有机制（内容型兜底按 type/owner/face 谓词），
//     每条至少 1 个机制、unclassified = 0；behaviorStatus 恒为 pending（分类 != 逐卡行为验收）；
//   · 机制词表见 tools/eote-mechanisms.mjs；原语目录 / 引擎盘点 / 8 个关键机制由
//     tools/eote-mechanism-primitives.mjs 提供（P1-B），指南与规则来源由 tools/eote-guide-scan.mjs 提供（P1-C）；
//   · 本文件只做分类与缺口登记，不写卡、不改引擎；P2 的原语计划从 primitiveGaps 出发。
import { pathToFileURL } from 'node:url'

import { ALL_CARDS } from '../src/cards/cards-data.js'
import { CYCLE_CODES } from '../content/campaigns/edgeOfTheEarth/shared.js'
import { emit, json, sha } from './eote-migration-lib.mjs'
import { MECHANISMS, MECHANISM_TYPES } from './eote-mechanisms.mjs'
import { ENGINE_INVENTORY, KEY_MECHANISMS, PRIMITIVE_CATALOG } from './eote-mechanism-primitives.mjs'
import { buildGuides, buildRulesScan } from './eote-guide-scan.mjs'
import { buildScope } from './scan-eote-scope.mjs'

// P1 硬口径：403 条记录、8 个关键机制（README §5）、8 个章节单元、原语目录 60 项（P1-B 约定）。
// 只有 403 与 8/8 来自路线图；60 是 P1-B 目录契约（测试同口径），偏离即证明依赖漂移。
const EXPECTED = Object.freeze({
  cards: 403,
  keyMechanisms: 8,
  guides: 8,
  primitiveCatalog: 60,
})

// Lead 提供的“数据事实”核对表：用于核对分类口径，不作为门禁（个别数字按出现次数而非卡数统计，
// 例如 [frost] 35 次 / [[Eidolon]] 7 次；本账本同时记录 cards 与 occurrences，差异显式可见）。
const DATA_FACTS = Object.freeze([
  ['hunter', 17], ['aloof', 3], ['massive', 5], ['retaliate', 11], ['alert', 6], ['surge', 8], ['peril', 3],
  ['hidden', 11], ['victory', 39], ['objective', 20], ['prey', 11], ['spawn', 22], ['parley', 17], ['resign', 8],
  ['fast', 70], ['permanent', 14], ['exceptional', 3], ['elite', 16], ['revelation', 52],
  ['mirage', 25], ['shelter', 18], ['partner', 19], ['resolute', 9], ['seal', 23], ['level', 14], ['key', 8],
  ['tekelili', 46], ['expedition', 7], ['frost', 35], ['supplies', 18], ['titanic', 6], ['hazard', 2], ['broken', 2],
  ['unbroken', 6], ['eidolon', 7], ['ancientOne', 2], ['possessed', 4],
])
// 印章标记出现次数（README §5：`[seal_a]`–`[seal_e]` 各 7 枚）。
const SEAL_TOKENS = Object.freeze(['seal_a', 'seal_b', 'seal_c', 'seal_d', 'seal_e'])
// 卡牌类型分布（Lead 提供的类型事实，用于核对内容型兜底机制覆盖）。
const TYPE_FACTS = Object.freeze({
  investigator: 5, asset: 116, event: 35, skill: 6, enemy: 41, treachery: 48,
  scenario: 5, location: 74, agenda: 20, act: 17, story: 36,
})
// 与 Lead 数字口径不一致时的说明（不修改数据，显式记录差异；不是门禁）。
const DATA_FACT_NOTES = Object.freeze({
  expedition: 'Lead 的 7 = 卡池 traits 含 [[Expedition]] 的卡数（08614–08620 七件探险物资）；本表按卡文正则统计，cards=17、occurrences=35。',
  possessed: 'Lead 的 4 与卡文正则（cards=3 / occurrences=7）不符；[[Possessed]] 特质卡另有 11 张。P1 以卡文分类为准，差异显式记录。',
})

const stableSort = values => [...values].sort()
const isFace = code => /^\d{5}[a-z]$/.test(code)
const corpusOf = code => {
  const card = ALL_CARDS[code]
  return [card.name || '', card.text || '', card.backText || ''].join('\n')
}
// 机制行 / 关键机制共用同一扫描语料；卡文哈希口径与 TIC/TDE 一致（text + backText 的 JSON）。
const textSha256Of = code => sha(json({ text: ALL_CARDS[code].text || '', backText: ALL_CARDS[code].backText || '' }))

// 关键机制兜底：若 P1-B 的行缺 primitiveIds，则按 README §5 的 8 个关键机制补齐（仅防御，不覆盖已有值）。
const KEY_MECHANISM_FALLBACK_PRIMITIVES = Object.freeze({
  frost: ['chaos.frost', 'interaction.frostReveal'],
  partnersAndMemorials: ['campaign.partner', 'keyword.partner', 'interaction.partnerSetup'],
  tekeliliDeck: ['scenario.tekeliDeck', 'interaction.tekeliShuffle'],
  campShelterCheckpoints: ['location.shelter', 'scenario.camp', 'campaign.flows', 'interaction.checkpoint'],
  suppliesAndSeals: ['campaign.supplies', 'campaign.seals', 'interaction.sealPlacement'],
  terrainGridAndHeight: ['location.grid', 'location.vertical', 'location.connections', 'scenario.climb'],
  multiclassStoryAssetsInvestigators: ['investigator.multiclass', 'investigator.rules', 'investigator.deckTop', 'investigator.discipline'],
  existingKeywords: ['core.enemy', 'core.encounter', 'core.effects'],
})

export function buildScan () {
  const scope = buildScope()
  const ownerByCode = new Map()
  for (const [pack, codes] of Object.entries(scope.partitions)) for (const code of codes) ownerByCode.set(code, pack)
  const corpus = new Map(CYCLE_CODES.map(code => [code, corpusOf(code)]))
  const occurrences = (code, pattern) => (corpus.get(code).match(new RegExp(pattern, 'gi')) || []).length

  // ── 机制匹配：正则优先；内容型机制用 type / owner / face 谓词兜底 ──────────────────────
  const matches = (def, code) => {
    const card = ALL_CARDS[code]
    if (def.types && def.types.includes(card.type)) return true
    if (def.owners && def.owners.includes(ownerByCode.get(code))) return true
    if (def.faces && isFace(code)) return true
    return (def.patterns || []).some(pattern => new RegExp(pattern, 'i').test(corpus.get(code)))
  }

  // ── 生成型机制：8 个章节单元（scenario）与战役流程节点（rulebook）──────────────────────
  const chapterGroupCodes = new Map(scope.sets.chapterGroups.map(entry => [entry.chapterId, entry.codes]))
  const chapterMechanisms = scope.chapters.map(chapter => ({
    id: `scenario.${chapter.id}`,
    type: 'scenario',
    title: `${chapter.name}（${chapter.nameEn}）`,
    patterns: [],
    candidatePrimitives: ['scenario.deck', 'physical.faces', 'content.guides'],
    fixedCards: chapterGroupCodes.get(chapter.id) || [],
    source: chapter.source,
    evidence: {
      stepId: chapter.stepId,
      referenceCode: chapter.referenceCode,
      promptCardCode: chapter.promptCard.code,
      gatherSets: chapter.gatherSets.map(gather => gather.set),
      guideSources: chapter.guideSources.map(source => source.path),
    },
  }))
  const flowMechanisms = scope.campaignFlow.steps
    .filter(step => step.kind !== 'scenario')
    .map(step => ({
      id: `flow.${step.id}`,
      type: 'rulebook',
      title: `战役流程：${step.kind} ${step.id}`,
      patterns: [],
      candidatePrimitives: ['campaign.flows', 'campaign.epilogue'],
      fixedCards: [],
      source: scope.campaignFlow.source,
      evidence: { stepType: step.stepType, next: step.next },
    }))
  flowMechanisms.push({
    id: 'flow.fatalMirageReentry',
    type: 'rulebook',
    title: '战役流程：致命幻景可选重入',
    patterns: [],
    candidatePrimitives: ['campaign.flows', 'keyword.mirage', 'scenario.mirageVersions'],
    fixedCards: [],
    source: scope.campaignFlow.source,
    evidence: { entryPoints: scope.campaignFlow.fatalMirageEntryPoints, note: '幕间 I–III 按条件进入，完成后按 campaignCompletedSteps 回到主线下一章' },
  })

  const mechanismRows = [...MECHANISMS, ...chapterMechanisms, ...flowMechanisms].map(def => {
    const cards = stableSort(def.fixedCards ? def.fixedCards.filter(code => ALL_CARDS[code]) : CYCLE_CODES.filter(code => matches(def, code)))
    const candidatePrimitives = [...new Set(def.candidatePrimitives)]
    const kinds = candidatePrimitives.map(id => PRIMITIVE_CATALOG[id]?.kind || null)
    const known = kinds.every(kind => kind !== null)
    const gap = candidatePrimitives.filter((id, index) => kinds[index] === 'new')
    const blocked = !known
    const { fixedCards, ...rest } = def
    return {
      ...rest,
      candidatePrimitives,
      cards,
      source: def.source || ['frontend/public/cards.json', 'backend/arkham-api/library/Arkham/'],
      existing: kinds.every(kind => kind !== 'new'),
      gap,
      blocked,
    }
  })

  // ── 关键机制（P1-B 的 8 条）：用同一语料重算 cards，保留 B 的分类明细并派生 existing ──────
  const keyMechanisms = KEY_MECHANISMS.map(entry => {
    const patterns = entry.patterns || []
    let cards = stableSort(CYCLE_CODES.filter(code => patterns.some(pattern => new RegExp(pattern, 'i').test(corpus.get(code)))))
    if (!cards.length) cards = stableSort(entry.cards || [])
    const detail = entry.classification && typeof entry.classification === 'object' ? entry.classification : null
    const derivedIds = detail ? [...(detail.reuse || []), ...(detail.extend || []), ...(detail.new || [])] : []
    const primitiveIds = [...new Set(entry.primitiveIds?.length ? entry.primitiveIds : derivedIds.length ? derivedIds : KEY_MECHANISM_FALLBACK_PRIMITIVES[entry.id] || [])]
    const newIds = primitiveIds.filter(id => PRIMITIVE_CATALOG[id]?.kind === 'new')
    const reuseIds = primitiveIds.filter(id => PRIMITIVE_CATALOG[id]?.kind !== 'new')
    const classification = typeof entry.classification === 'string' && entry.classification
      ? entry.classification
      : newIds.length === 0 ? 'reuse' : reuseIds.length === 0 ? 'gaps' : 'reuse+gaps'
    return {
      ...entry,
      cards,
      primitiveIds,
      existing: newIds.length === 0,
      classification,
      classificationDetail: detail,
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
  const primitiveGaps = Object.entries(PRIMITIVE_CATALOG)
    .filter(([, entry]) => entry.kind === 'new' || entry.kind === 'extend')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, entry]) => ({
      id,
      kind: entry.kind,
      modules: [...(entry.modules || [])],
      names: [...(entry.names || [])],
      reason: entry.note || (entry.kind === 'new' ? 'P1 扫描登记：P2 需新增原语' : 'P1 扫描登记：P2 需扩展现有原语'),
      mechanisms: stableSort([...new Set(gapReferences.get(id) || [])]),
    }))

  // ── 403 条记录的反向索引：每条卡拿到排好序的机制 id 列表 ─────────────────────────────
  const mechanismsByCard = new Map(CYCLE_CODES.map(code => [code, []]))
  for (const row of mechanismRows) for (const code of row.cards) mechanismsByCard.get(code).push(row.id)
  const cards = CYCLE_CODES.map(code => ({
    code,
    textSha256: textSha256Of(code),
    mechanisms: stableSort(mechanismsByCard.get(code)),
    behaviorStatus: 'pending',
  }))
  const unclassified = cards.filter(card => card.mechanisms.length === 0).map(card => card.code)

  // ── P1-B / P1-C 的纯数据依赖（逐字透传，不在本层改写）────────────────────────────────
  const guides = buildGuides()
  const rules = buildRulesScan()
  const engine = ENGINE_INVENTORY
  const primitives = PRIMITIVE_CATALOG

  // ── 数据事实核对（非门禁）：同时记录卡数与出现次数，解释与 Lead 数字的差异 ─────────────
  const dataFacts = [
    ...DATA_FACTS.map(([id, expected]) => {
      const row = mechanismRows.find(mechanism => mechanism.id === id)
      const cardsCount = row?.cards.length ?? 0
      const occurrencesCount = row?.patterns?.length
        ? CYCLE_CODES.reduce((total, code) => total + row.patterns.reduce((sum, pattern) => sum + occurrences(code, pattern), 0), 0)
        : 0
      const matchesCards = cardsCount === expected
      const matchesOccurrences = occurrencesCount === expected
      return {
        kind: 'mechanism',
        id,
        expected,
        cards: cardsCount,
        occurrences: occurrencesCount,
        matchesCards,
        matchesOccurrences,
        note: !matchesCards && !matchesOccurrences ? (DATA_FACT_NOTES[id] || '与 Lead 数字口径不一致，见 P1 报告') : null,
      }
    }),
    ...Object.entries(TYPE_FACTS).map(([type, expected]) => {
      const derived = CYCLE_CODES.filter(code => ALL_CARDS[code].type === type).length
      return { kind: 'cardType', id: type, expected, cards: derived, occurrences: null, matchesCards: derived === expected, matchesOccurrences: null }
    }),
    ...SEAL_TOKENS.map(token => {
      const derived = CYCLE_CODES.reduce((total, code) => total + occurrences(code, `\\[${token}\\]`), 0)
      return { kind: 'sealToken', id: token, expected: 7, cards: derived, occurrences: derived, matchesCards: derived === 7, matchesOccurrences: derived === 7 }
    }),
  ]

  // ── 待办 / 阻断：P0 scope 里仍待 P1 确认的来源差异 + 扫描发现无法归类的未知机制 ─────────
  const blockedMechanisms = mechanismRows.filter(row => row.blocked).map(row => row.id)
  // P1-B 原语目录里显式标记 blocked 的条目必须进入 pending（不得静默放行）。
  const blockedPrimitives = Object.values(PRIMITIVE_CATALOG).filter(entry => entry.blocked === true)
  const pending = scope.pending
    .filter(entry => entry.status === 'verify-in-P1')
    .map(entry => ({ ...entry, source: 'audit/eote-scope.json#pending' }))
  if (blockedMechanisms.length) {
    pending.push({
      id: 'unknownMechanisms',
      status: 'blocked',
      mechanisms: blockedMechanisms,
      detail: '扫描发现引用了未登记原语的机制，P1 不得静默放行；需先补 PRIMITIVE_CATALOG 或修正词表',
    })
  }
  if (blockedPrimitives.length) {
    pending.push({
      id: 'blockedPrimitives',
      status: 'blocked',
      primitives: blockedPrimitives.map(entry => entry.id),
      detail: 'P1-B 原语目录中规则边界未确认的条目；P2 前需对照规则书裁决，不得按已实现计入',
    })
  }

  // ── 计数 ─────────────────────────────────────────────────────────────────────────────
  const byType = Object.fromEntries(MECHANISM_TYPES.map(type => [type, mechanismRows.filter(row => row.type === type).length]))
  const counts = {
    cards: cards.length,
    mechanisms: mechanismRows.length,
    byType,
    keyMechanisms: keyMechanisms.length,
    primitiveGaps: primitiveGaps.length,
    guides: guides.length,
    guideSections: guides.reduce((total, guide) => total + (guide.sections?.length || 0), 0),
    missingTranslations: guides.reduce((total, guide) => total + (guide.summary?.missing || 0) + (guide.summary?.untranslated || 0), 0),
    specialRules: guides.reduce((total, guide) => total + (guide.summary?.specialRules || 0), 0),
  }

  // ── 门禁：布尔值，必须全为 true；emit() 在任一非 true 时抛错 ──────────────────────────
  const catalogGapIds = Object.entries(PRIMITIVE_CATALOG)
    .filter(([, entry]) => entry.kind === 'new' || entry.kind === 'extend')
    .map(([id]) => id)
    .sort()
  const referencedPrimitiveIds = [
    ...mechanismRows.flatMap(row => row.candidatePrimitives),
    ...keyMechanisms.flatMap(row => row.primitiveIds),
  ]
  const allPrimitiveIds = stableSort([...new Set(referencedPrimitiveIds)])
  const guideSections = guides.flatMap(guide => guide.sections || [])
  const chineseStates = ['present', 'present-needs-review', 'untranslated', 'missing']
  const guideShaValid = lock => Boolean(lock && lock.sha256 && /^[0-9a-f]{64}$/.test(lock.sha256))
  const noPrintedSpecialRules = guide => (guide.summary?.specialRules || 0) === 0 && (guide.sections || []).every(section => section.specialRule === false)
  const partOfGuide = guideId => guides.filter(guide => guide.guideId === guideId).map(guide => guide.part).filter(Boolean).sort()
  const iceParts = partOfGuide('iceAndDeath')
  const heartParts = partOfGuide('theHeartOfMadness')
  const gates = {
    scopePassed: Object.values(scope.gates).every(value => value === true),
    allCardsClassified: cards.length === EXPECTED.cards && unclassified.length === 0 && cards.every(card => card.mechanisms.length > 0),
    sixTypesCovered: MECHANISM_TYPES.every(type => mechanismRows.some(row => row.type === type)),
    keyMechanismsClassified: keyMechanisms.length === EXPECTED.keyMechanisms
      && keyMechanisms.every(row => row.cards.length > 0 && row.primitiveIds.length > 0
        && typeof row.classification === 'string' && row.classification.length > 0
        && row.primitiveIds.every(id => Boolean(PRIMITIVE_CATALOG[id]))),
    primitiveCandidatesKnown: allPrimitiveIds.every(id => Boolean(PRIMITIVE_CATALOG[id])),
    primitiveCatalog: Object.keys(PRIMITIVE_CATALOG).length === EXPECTED.primitiveCatalog,
    guidesInventoried: guides.length === EXPECTED.guides
      && guides.map(guide => guide.id).join('|') === scope.chapters.map(chapter => chapter.id).join('|')
      && guides.every(guide => guideShaValid(guide.sources?.en) && guideShaValid(guide.sources?.zh)
        && (guide.sections || []).some(section => section.layer === 'setup')
        && (guide.sections || []).some(section => section.layer === 'resolutions')
        && ((guide.summary?.specialRules || 0) > 0 || noPrintedSpecialRules(guide))),
    partMappings: iceParts.join('|') === 'part1|part2|part3' && heartParts.join('|') === 'part1|part2',
    chineseGapsRecorded: counts.missingTranslations > 0
      && guideSections.every(section => chineseStates.includes(section.chinese)),
    primitiveGapsListed: catalogGapIds.join('|') === primitiveGaps.map(gap => gap.id).join('|')
      && primitiveGaps.every(gap => gap.kind === 'new' || gap.kind === 'extend'),
    cardsBehaviorPending: cards.every(card => card.behaviorStatus === 'pending'),
    rulesInventoried: Boolean(rules?.campaignStory?.groups?.length)
      && ['prologue', 'checkpoint1', 'checkpoint2', 'checkpoint3', 'interlude1', 'interlude2', 'interlude3', 'epilogue']
        .every(group => rules.campaignStory.groups.some(entry => entry.id === group))
      && rules.recordKeys?.totals?.keys === rules.recordKeys?.keys?.length
      && rules.recordKeys.keys.length > 0
      && rules.partnerNames?.entries?.length === 9
      && rules.suppliesRecovered?.entries?.length === 7,
    noUnknownMechanismSilentlyApproved: unclassified.length === 0
      && blockedMechanisms.every(id => pending.some(entry => entry.status === 'blocked' && (entry.mechanisms || []).includes(id)))
      && blockedPrimitives.every(entry => pending.some(row => row.status === 'blocked' && (row.primitives || []).includes(entry.id))),
  }

  return {
    schemaVersion: 1,
    cycle: 'eote',
    campaignId: scope.campaignId,
    milestone: 'P1',
    step: 'P1 机制扫描',
    generatedBy: 'tools/scan-eote-mechanisms.mjs',
    docs: 'docs/edgeOfTheEarth/README.md',
    status: 'catalog-only',
    scopeSha256: sha(json(scope)),
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
