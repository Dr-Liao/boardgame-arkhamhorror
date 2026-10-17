import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { inspectJson, compareSources, stableStringify, sha256 } from './audit-resources.mjs'
import { isCardAvailable, canSelectInvestigator } from '../src/deck/availability.js'
import { EFFECTS, INVESTIGATOR_ABILITIES } from '../src/cards/card-effects.js'
import { SCENARIO_CARD_IDENTITIES, SCENARIOS } from '../src/cards/scenarios-data.js'
import { coreCardVerified, CORE_ACCEPTANCE_PROFILE } from '../src/cards/core-acceptance.js'
import { dunwichCardVerified, DUNWICH_ACCEPTANCE_PROFILE } from '../src/cards/dunwich-acceptance.js'
import { carcosaPlayerCardVerified, CARCOSA_PLAYER_ACCEPTANCE_PROFILE } from '../src/cards/carcosa-player-acceptance.js'
import { carcosaCampaignCardVerified, CARCOSA_CAMPAIGN_ACCEPTANCE_PROFILE } from '../src/cards/carcosa-campaign-acceptance.js'
import { carcosaInvestigatorCardVerified, CARCOSA_INVESTIGATOR_ACCEPTANCE_PROFILE } from '../content/packs/carcosaInvestigators/manifest.js'

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const GAME = 'games/arkhamhorror'
const REFERENCE = '参考资源/ArkhamHorror-main'
export const SOURCE_PATHS = Object.freeze({
  en: 'frontend/public/cards_en.json',
  'zh-cn': 'frontend/public/cards_zh-cn.json',
  zh: 'frontend/public/cards_zh.json',
  legacy: 'backend/arkham-api/data/cards.json',
})
export const CARD_TYPES = Object.freeze(['investigator', 'asset', 'event', 'skill', 'treachery', 'enemy', 'location', 'scenario', 'agenda', 'act', 'story', 'key', 'enemy_location'])
const PLAYER_TYPES = new Set(['asset', 'event', 'skill'])
const DISPLAY_FIELDS = ['name', 'subname', 'text', 'traits', 'flavor', 'back_name', 'back_text', 'back_flavor', 'customization_text', 'customization_change']
const OUTPUT_FIELDS = { name: 'nameZh', subname: 'subnameZh', text: 'textZh', traits: 'traitsZh', flavor: 'flavorZh', back_name: 'backNameZh', back_text: 'backTextZh', back_flavor: 'backFlavorZh', customization_text: 'customizationTextZh', customization_change: 'customizationChangeZh' }
const clone = value => structuredClone(value)
const ordered = values => [...values].sort()
const tally = (rows, key) => rows.reduce((out, row) => { const k = row[key] ?? '(missing)'; out[k] = (out[k] || 0) + 1; return out }, {})
const at = (row, field) => field.split('.').reduce((value, key) => value?.[key], row)

export function stripHtml(value) {
  return String(value ?? '').replace(/<span\b[^>]*class=["'][^"']*icon-([\w-]+)[^"']*["'][^>]*>\s*<\/span>/gi, '[$1]')
    .replace(/<\/(?:p|div)>|<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim()
}
const splitTerms = value => String(value ?? '').split(/\.\s*|。/).map(s => s.trim()).filter(Boolean)

export function localeFields(base, simplified, traditional) {
  const fields = {}
  for (const field of DISPLAY_FIELDS) {
    const english = base[field] ?? base[`real_${field}`] ?? ''
    const cn = simplified?.[field]
    const tw = traditional?.[field]
    const translated = value => !!stripHtml(value) && /\p{Script=Han}/u.test(stripHtml(value)) && stripHtml(value) !== stripHtml(english)
    const selected = translated(cn) ? ['zh-cn', cn, 'translated']
      : translated(tw) ? ['zh', tw, 'traditional-fallback']
        : [base === simplified ? 'zh-cn' : 'en', english, stripHtml(english) ? 'english-fallback' : 'not-applicable']
    fields[field] = { source: selected[0], sourceField: field, value: selected[1], status: selected[2] }
  }
  const applicable = Object.values(fields).filter(f => f.status !== 'not-applicable')
  const translated = applicable.filter(f => f.status === 'translated').length
  return { status: translated === applicable.length && applicable.length ? 'complete' : translated ? 'partial' : 'fallback', fields }
}

export function normalizeCard(c, locale) {
  const result = {
    code: c.code, originalCode: c.code, name: c.real_name || c.name, type: c.type_code,
    typeName: c.type_name, klass: c.faction_code, factionName: c.faction_name,
    faction2: c.faction2_code, faction3: c.faction3_code, pack: c.pack_code, packName: c.pack_name,
    subtype: c.subtype_code, traits: splitTerms(c.real_traits ?? c.traits), text: stripHtml(c.real_text ?? c.text),
    flavor: c.flavor, subname: c.subname, backName: c.back_name, backText: stripHtml(c.back_text), backFlavor: c.back_flavor,
    unique: !!c.is_unique, permanent: !!c.permanent, exceptional: !!c.exceptional, exile: !!c.exile,
    doubleSided: !!c.double_sided, hidden: !!c.hidden, myriad: !!c.myriad, healthPerInvestigator: !!c.health_per_investigator,
    victory: c.victory, vengeance: c.vengeance, deckLimit: c.deck_limit, quantity: c.quantity, xp: c.xp,
    cost: c.cost, position: c.position, stage: c.stage, doom: c.doom, health: c.health, sanity: c.sanity,
    shroud: c.shroud, clues: c.clues, cluesFixed: c.clues_fixed, encounterCode: c.encounter_code,
    encounterName: c.encounter_name, encounterPosition: c.encounter_position,
    url: c.url, imagesrc: c.imagesrc, backimagesrc: c.backimagesrc, illustrator: c.illustrator,
    linkedToCode: c.linked_to_code, linkedToName: c.linked_to_name, linkedCardCode: c.linked_card?.code,
    duplicateOfCode: c.duplicate_of_code, duplicatedBy: c.duplicated_by,
    alternateOfCode: c.alternate_of_code, alternatedBy: c.alternated_by,
    bondedCards: c.bonded_cards, bondedTo: c.bonded_to, bondedCount: c.bonded_count,
    restrictions: c.restrictions, customizationOptions: c.customization_options,
    customizationText: stripHtml(c.customization_text), customizationChange: stripHtml(c.customization_change),
    localeStatus: locale.status, imageStatus: 'unresolved',
  }
  for (const [field, target] of Object.entries(OUTPUT_FIELDS)) {
    const value = locale.fields[field].value
    result[target] = field === 'traits' ? splitTerms(value) : stripHtml(value)
  }
  if (c.restrictions?.investigator) result.signatureFor = Object.keys(c.restrictions.investigator)
  if (c.deck_options) result.deckOptions = c.deck_options.map(option => ({ ...clone(option), factions: clone(option.faction || []) }))
  if (c.deck_requirements) result.deckRequirements = { ...clone(c.deck_requirements), signatureCards: Object.keys(c.deck_requirements.card || {}) }
  if (c.type_code === 'investigator') {
    for (const skill of ['willpower', 'intellect', 'combat', 'agility']) result[skill] = c[`skill_${skill}`]
  } else {
    result.icons = Object.fromEntries(['willpower', 'intellect', 'combat', 'agility', 'wild'].filter(skill => c[`skill_${skill}`] != null).map(skill => [skill, c[`skill_${skill}`]]))
  }
  if (c.slot) { result.slot = c.real_slot || c.slot; result.slots = splitTerms(result.slot) }
  if (['enemy', 'enemy_location'].includes(c.type_code)) {
    result.fight = c.enemy_fight; result.evade = c.enemy_evade
    result.damage = c.enemy_damage ?? 0; result.horror = c.enemy_horror ?? 0
  }
  return Object.fromEntries(Object.entries(result).filter(([, value]) => value !== undefined))
}

function fieldSources(row, source, prefix = '', out = {}) {
  for (const [key, value] of Object.entries(row)) {
    const field = prefix + key
    out[field] = source
    if (value && typeof value === 'object') fieldSources(value, source, `${field}.`, out)
  }
  return out
}

export function cardReferences(row) {
  const refs = []
  const add = (field, code) => { if (typeof code === 'string' && code) refs.push({ field, code }) }
  for (const key of ['linked_to_code', 'duplicate_of_code', 'alternate_of_code']) add(key, row[key])
  add('linked_card.code', row.linked_card?.code)
  for (const key of ['duplicated_by', 'alternated_by']) for (const code of row[key] || []) add(key, code)
  for (const [code, alternatives] of Object.entries(row.deck_requirements?.card || {})) {
    add('deck_requirements.card', code)
    for (const alternative of Object.values(alternatives || {})) add('deck_requirements.card.alternative', alternative)
  }
  for (const code of Object.keys(row.restrictions?.investigator || {})) add('restrictions.investigator', code)
  for (const card of row.bonded_cards || []) add('bonded_cards', card.code)
  if (row.linked_card) for (const ref of cardReferences(row.linked_card)) refs.push({ field: `linked_card.${ref.field}`, code: ref.code })
  return refs
}

export function mergeCatalog(sources) {
  const indexes = {}
  for (const [id, rows] of Object.entries(sources)) {
    const inspected = inspectJson(Buffer.from(JSON.stringify(rows)), true)
    if (inspected.status !== 'valid' || inspected.duplicates.length) throw new Error(`卡表非法或重复编号：${id}`)
    indexes[id] = new Map(rows.map(row => [row.code, row]))
  }
  const codes = ordered(new Set(Object.values(indexes).flatMap(index => [...index.keys()])))
  const cards = Object.create(null), provenance = Object.create(null), quarantined = []
  for (const code of codes) {
    const source = indexes.en?.has(code) ? 'en' : indexes.legacy?.has(code) ? 'legacy' : null
    if (!source) throw new Error(`编号 ${code} 没有英文或兼容主记录`)
    const row = indexes[source].get(code)
    for (const field of ['name', 'type_code', 'pack_code', 'faction_code']) {
      if (typeof row[field] !== 'string' || !row[field].trim()) throw new Error(`${code} 缺少必需字段 ${field}`)
    }
    const locale = localeFields(row, indexes['zh-cn']?.get(code), indexes.zh?.get(code))
    if (source === 'legacy') for (const f of Object.values(locale.fields)) if (f.source === 'en') f.source = 'legacy'
    const unknown = !CARD_TYPES.includes(row.type_code)
    const currentConflicts = compareSources(['en', 'zh-cn', 'zh'].filter(id => indexes[id]?.has(code)).map(id => ({ path: id, rows: [indexes[id].get(code)] }))).conflicts
    const reasons = [...(unknown ? [`unknown-type:${row.type_code}`] : []), ...currentConflicts.map(c => `current-source-conflict:${c.field}`)]
    const missingRefs = cardReferences(row).filter(ref => !codesSetHas(indexes, ref.code))
    reasons.push(...missingRefs.map(ref => `missing-reference:${ref.field}:${ref.code}`))
    if (row.linked_card) {
      const other = indexes.en?.get(row.linked_card.code) || indexes.legacy?.get(row.linked_card.code)
      if (other && other.type_code !== row.linked_card.type_code) reasons.push('linked-card-type-mismatch')
      if (row.linked_to_code && row.linked_to_code !== row.linked_card.code) reasons.push('linked-card-code-mismatch')
    }
    if (reasons.length) quarantined.push({ code, reasons, references: missingRefs, conflicts: currentConflicts })
    const available = !reasons.length && (canSelectInvestigator(code) || isCardAvailable(code))
    const accepted = !reasons.length && (canSelectInvestigator(code, 'strict') || isCardAvailable(code, 'strict'))
    const effect = Object.hasOwn(EFFECTS, code) ? EFFECTS[code] : null
    // Encoding/allowlisting is not behavioral acceptance. P6 keeps proof scopes
    // in the per-code ledger; no card is promoted by the existence of a key.
    const effectStatus = effect?.simplified ? 'simplified' : effect || Object.hasOwn(INVESTIGATOR_ABILITIES, code) || available ? 'unverified' : 'unimplemented'
    cards[code] = { ...normalizeCard(row, locale), dataStatus: reasons.length ? 'quarantined' : source === 'legacy' ? 'compatibility' : 'validated', availability: accepted ? 'strict' : available ? 'simplified' : 'catalog-only', effectStatus, provenanceId: code }
    provenance[code] = { canonicalSource: source, rawSources: Object.keys(indexes).filter(id => indexes[id].has(code)), fields: fieldSources(row, source), locale, isolationReasons: reasons }
  }
  return { cards, provenance, quarantined }
}
const codesSetHas = (indexes, code) => Object.values(indexes).some(index => index.has(code))

function adjudicate(entry, primary) {
  const row = primary.get(entry.code)
  const value = at(row, entry.field)
  return { ...entry, status: 'baseline-selected', nextPhase: null, selectedSource: row?.sourceId === 'legacy' ? SOURCE_PATHS.legacy : SOURCE_PATHS.en,
    selectedPresent: value !== undefined, selectedValue: value ?? null,
    resolution: value === undefined ? '新版结构明确保留字段缺省；旧版值仅保留为证据，不填回运行时。' : '采用新版英文结构；新版简中/繁中按非展示字段独立核对，旧版本原值保留。',
    rulesVerified: false }
}

export function buildImport(root = ROOT) {
  const frozenBytes = fs.readFileSync(path.join(root, GAME, 'audit/resource-report.json'))
  const frozen = JSON.parse(frozenBytes)
  const publicDir = path.join(root, REFERENCE, 'frontend/public')
  const paths = ordered([SOURCE_PATHS.legacy, ...fs.readdirSync(publicDir).filter(name => /^cards(?:_[^/]+)?\.json$/.test(name)).map(name => `frontend/public/${name}`)])
  const sources = [], manifest = []
  for (const relative of paths) {
    const bytes = fs.readFileSync(path.join(root, REFERENCE, relative))
    const parsed = inspectJson(bytes, true)
    const baseline = frozen.sourceInventory.files.find(file => file.path === relative)
    if (!baseline || baseline.sha256 !== sha256(bytes)) throw new Error(`来源偏离 N0 冻结清单：${relative}`)
    if (parsed.status === 'empty' && relative === 'frontend/public/cards_ja.json') {
      manifest.push({ path: relative, bytes: bytes.length, sha256: sha256(bytes), status: 'isolated-empty', records: 0 }); continue
    }
    if (parsed.status !== 'valid' || parsed.duplicates.length) throw new Error(`卡表非法或重复编号：${relative}`)
    manifest.push({ path: relative, bytes: bytes.length, sha256: sha256(bytes), status: 'valid', records: parsed.records, schema: parsed.schema })
    sources.push({ path: relative, rows: parsed.rows })
  }
  const damagedPath = 'backend/arkham-api/data/arkham/sets/theGathering.json'
  const damaged = fs.readFileSync(path.join(root, REFERENCE, damagedPath))
  if (sha256(damaged) !== frozen.sourceInventory.files.find(file => file.path === damagedPath)?.sha256 || inspectJson(damaged).status !== 'damaged') throw new Error('已隔离集结骨架发生漂移，需要单独审核')
  const selected = Object.fromEntries(Object.entries(SOURCE_PATHS).map(([id, relative]) => [id, sources.find(source => source.path === relative)?.rows]))
  if (Object.values(selected).some(rows => !rows)) throw new Error('主来源缺失')
  const merged = mergeCatalog(selected)
  const identities = Object.entries(SCENARIO_CARD_IDENTITIES).flatMap(([scenarioId, categories]) => Object.entries(categories).flatMap(([category, entries]) => Object.entries(entries).map(([ruleId, identity]) => ({ scenarioId, category, ruleId, ...identity }))))
  for (const [scenarioId, scenario] of Object.entries(SCENARIOS)) {
    for (const [ruleId, variants] of Object.entries(scenario.locationVariants || {})) {
      for (const variant of variants) if (!identities.some(i=>i.scenarioId===scenarioId&&i.originalCode===variant.originalCode)) {
        identities.push({scenarioId,category:'locations',ruleId,originalCode:variant.originalCode})
      }
    }
  }
  const identityTypes = { scenario: 'scenario', enemies: 'enemy', treacheries: 'treachery', locations: 'location', acts: 'act', agendas: 'agenda', storyAssets: 'asset' }
  for (const identity of identities) {
    const card = merged.cards[identity.originalCode]
    if (!card || card.type !== identityTypes[identity.category] || card.dataStatus === 'quarantined') throw new Error(`NOTZ 身份无有效目录记录：${identity.scenarioId}/${identity.category}/${identity.ruleId}`)
    if (identity.approximation && !identity.identityReason) throw new Error(`近似定义缺少说明：${identity.ruleId}`)
    ;(card.scenarioReferences ||= []).push({ scenarioId: identity.scenarioId, category: identity.category, ruleId: identity.ruleId })
    if (card.effectStatus === 'unimplemented') card.effectStatus = 'unverified'
    if (card.availability === 'catalog-only') { card.availability = 'simplified'; card.availabilityScope = 'scenario-only' }
  }
  // This allowlist is produced only after the per-card behavior suite passes.
  // Catalog presence, an effect key, or an identity mapping never grants acceptance.
  for (const card of Object.values(merged.cards)) if (coreCardVerified(card.code)) {
    card.effectStatus = 'verified'
    card.acceptanceProfile = CORE_ACCEPTANCE_PROFILE.id
    card.availability = 'strict'
  }
  for (const card of Object.values(merged.cards)) if (dunwichCardVerified(card.code)) {
    card.effectStatus = 'verified'
    card.acceptanceProfile = DUNWICH_ACCEPTANCE_PROFILE.id
  }
  for (const card of Object.values(merged.cards)) {
    const profile = carcosaPlayerCardVerified(card.code) ? CARCOSA_PLAYER_ACCEPTANCE_PROFILE
      : carcosaInvestigatorCardVerified(card.code) ? CARCOSA_INVESTIGATOR_ACCEPTANCE_PROFILE
        : carcosaCampaignCardVerified(card.code) ? CARCOSA_CAMPAIGN_ACCEPTANCE_PROFILE : null
    if (!profile) continue
    card.effectStatus = 'verified'
    card.acceptanceProfile = profile.id
  }
  const union = ordered(new Set(sources.flatMap(source => source.rows.map(row => row.code))))
  if (stableStringify(union) !== stableStringify(frozen.coverage.unionCodes)) throw new Error('来源编号并集偏离 N0')
  const missing = union.filter(code => !merged.cards[code])
  if (missing.length) throw new Error(`来源编号未进入目录：${missing.join(',')}`)
  const compared = compareSources(sources)
  if (stableStringify(compared.conflicts) !== stableStringify(frozen.coverage.conflicts) || stableStringify(compared.fieldPresenceDifferences) !== stableStringify(frozen.coverage.fieldPresenceDifferences)) throw new Error('冲突或字段有无差异偏离 N0，拒绝静默裁决')
  const primary = new Map([...selected.legacy.map(row => [row.code, { ...row, sourceId: 'legacy' }]), ...selected.en.map(row => [row.code, row])])
  const conflicts = compared.conflicts.map(entry => adjudicate(entry, primary))
  const fieldPresenceDifferences = compared.fieldPresenceDifferences.map(entry => adjudicate(entry, primary))
  for (const conflict of conflicts) {
    const details = merged.provenance[conflict.code]
    ;(details.conflictFields ||= []).push(conflict.field)
  }
  const implementationSha256 = sha256(fs.readFileSync(fileURLToPath(import.meta.url)))
  const jsFiles = directory => fs.readdirSync(path.join(root, GAME, directory), { recursive: true })
    .filter(name => name.endsWith('.js'))
    .map(name => `${directory}/${name.replaceAll('\\', '/')}`)
  const implementationFiles = ordered([
    'index.js',
    ...jsFiles('src').filter(name => name !== 'src/cards/cards-data.js'),
    ...jsFiles('content'),
    'web/deck-rules.js',
    'tools/audit-resources.mjs',
  ]).map(relative => {
    const bytes = fs.readFileSync(path.join(root, GAME, relative))
    return { path: `${GAME}/${relative}`, bytes: bytes.length, sha256: sha256(bytes) }
  })
  const version = sha256(stableStringify({ sources: manifest.map(({ path, sha256 }) => ({ path, sha256 })), implementationSha256, implementationFiles }))
  const rows = Object.values(merged.cards)
  const counts = { investigators: rows.filter(c => c.type === 'investigator').length, playerCards: rows.filter(isPlayerCard).length, weaknesses: rows.filter(c => c.subtype === 'weakness').length, basicWeaknesses: rows.filter(c => c.subtype === 'basicweakness').length, encounterCards: rows.filter(isEncounterCard).length }
  const strictAccepted = rows.filter(c => canSelectInvestigator(c.code, 'strict') || isCardAvailable(c.code, 'strict')).length
  const meta = { schemaVersion: 2, resourceVersion: version, source: `${REFERENCE}/${SOURCE_PATHS.en}`, zhSource: `${REFERENCE}/${SOURCE_PATHS['zh-cn']}`, total: rows.length, counts, types: tally(rows, 'type'), sources: manifest.map(({ schema, ...item }) => item), strictAccepted }
  const report = { phase: 'N1', schemaVersion: 1, resourceVersion: version, implementationSha256, baseline: { path: `${GAME}/audit/resource-report.json`, sha256: sha256(frozenBytes), targetCodes: frozen.summary.targetCodes, missingTargetCodes: frozen.summary.missingTargetCodes, referenceFingerprint: frozen.fingerprints.reference },
    implementationFiles, sourceManifest: manifest, isolatedSources: [{ path: 'frontend/public/cards_ja.json', reason: 'empty' }, { path: damagedPath, sha256: sha256(damaged), reason: 'damaged-json-not-consumed' }],
    summary: { total: rows.length, importedNewCodes: frozen.coverage.missingInTarget.filter(code => merged.cards[code]).length, remainingMissingCodes: missing.length, types: tally(rows, 'type'), locale: tally(rows, 'localeStatus'), structuralConflicts: conflicts.length, fieldPresenceDifferences: fieldPresenceDifferences.length, quarantined: merged.quarantined.length, compatibility: rows.filter(c => c.dataStatus === 'compatibility').length, strictAccepted, imagesImported: 0 },
    coverage: { unionCodes: union, closedMissingCodes: frozen.coverage.missingInTarget.filter(code => merged.cards[code]), missing, compatibilityCodes: rows.filter(c => c.dataStatus === 'compatibility').map(c => c.code) },
    identities, conflicts, fieldPresenceDifferences, quarantined: merged.quarantined,
    policy: { canonical: '新版英文结构；其他语言只投影展示字段；旧后端仅补独有编号。', raw: 'catalog/sources 按来源保存完整原始记录，包括 linked_card 与构筑限制；provenance 按原始字段路径定位。', locale: '按编号逐字段识别简中、繁中或英文回退；complete 是字段覆盖，不是人工语言质量验收。', conflict: '当前英/简/繁结构冲突、未知类型及断裂外键进入隔离；跨版本差异保留全部值并采用冻结新版结构，不宣称规则等价。' } }
  return { ...merged, sources: selected, meta, report }
}
const isPlayerCard = c => PLAYER_TYPES.has(c.type) && !c.subtype && c.klass !== 'mythos' && !c.encounterCode
const isEncounterCard = c => ['enemy', 'treachery', 'enemy_location'].includes(c.type) && !c.subtype

export function renderArtifacts(result) {
  const module = [
    '// 由 tools/import-cards.mjs 生成。卡名、设定与规则文本版权归 Fantasy Flight Games。',
    '// 完整原始记录和逐字段来源另存 catalog/；目录收录不代表规则已实现。',
    `export const META = ${stableStringify(result.meta, 2)}`,
    `export const ALL_CARDS = ${stableStringify(result.cards, 2)}`,
    'const select = predicate => Object.fromEntries(Object.entries(ALL_CARDS).filter(([, card]) => predicate(card)))',
    `export const CARDS_BY_TYPE = Object.fromEntries(${JSON.stringify(CARD_TYPES)}.map(type => [type, select(card => card.type === type)]))`,
    "export const INVESTIGATORS = CARDS_BY_TYPE.investigator",
    "export const PLAYER_CARDS = select(card => ['asset', 'event', 'skill'].includes(card.type) && !card.subtype && card.klass !== 'mythos' && !card.encounterCode)",
    "export const WEAKNESSES = select(card => card.subtype === 'weakness')",
    "export const BASIC_WEAKNESSES = select(card => card.subtype === 'basicweakness')",
    "export const ENCOUNTER_CARDS = select(card => ['enemy', 'treachery', 'enemy_location'].includes(card.type) && !card.subtype)",
    "export const QUARANTINED_CARDS = select(card => card.dataStatus === 'quarantined')", '',
  ].join('\n')
  return {
    'src/cards/cards-data.js': module,
    'catalog/provenance.json': stableStringify(result.provenance) + '\n',
    ...Object.fromEntries(Object.entries(result.sources).map(([id, rows]) => [`catalog/sources/${id}.json`, stableStringify(Object.fromEntries(rows.map(row => [row.code, row]))) + '\n'])),
    'audit/catalog-report.json': stableStringify(result.report, 2) + '\n',
  }
}

export function main(args = process.argv.slice(2)) {
  if (args.some(arg => !['--write', '--check', '--summary'].includes(arg)) || args.filter(arg => arg !== '--summary').length > 1) throw new Error('使用 --write 生成、--check 只读比对，默认仅输出摘要')
  const result = buildImport()
  if (args.includes('--write') || args.includes('--check')) {
    const artifacts = renderArtifacts(result)
    const drift = []
    for (const [relative, content] of Object.entries(artifacts)) {
      const target = path.join(ROOT, GAME, relative)
      if (args.includes('--write')) { fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, content, 'utf8') }
      else if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== content) drift.push(relative)
    }
    if (drift.length) throw new Error(`生成物漂移：${drift.join(', ')}`)
  }
  console.log(JSON.stringify({ mode: args.includes('--write') ? 'write' : args.includes('--check') ? 'check' : 'summary', ...result.report.summary }, null, 2))
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try { main() } catch (error) { console.error(`卡牌导入失败：${error.message}`); process.exitCode = 1 }
}
