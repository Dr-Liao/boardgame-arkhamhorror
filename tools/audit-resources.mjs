import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, extname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as catalog from '../src/cards/cards-data.js'
import { EFFECTS, INVESTIGATOR_ABILITIES } from '../src/cards/card-effects.js'
import { CAMPAIGN, SCENARIOS, DIFFICULTIES } from '../src/cards/scenarios-data.js'
import { CORE_INVESTIGATOR_CODES, corePlayablePool, isPlayable } from '../src/deck/deckbuilding.js'
import { allCardDefs } from '../src/engine/engine.js'

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
export const REPORT_PATH = 'games/arkhamhorror/audit/resource-report.json'
const POLICY_PATH = 'games/arkhamhorror/audit/migration-scope.json'
const N0_REPORT_SHA256 = '42ebc83b9adc78a19217ea7174d0cd5a9f098ced7590aa9da631e911b61b4c08'
const TARGET_SUMMARY_KEYS = new Set(['targetCodes', 'missingTargetCodes', 'effectEntries', 'explicitlySimplifiedEffects', 'investigatorAbilities', 'scenarios', 'difficulties', 'corePoolCodes', 'runtimeDefinitionKeys', 'targetImages', 'strictAcceptedCards'])
const LEGACY = 'backend/arkham-api/data/cards.json'
const ENGLISH = 'frontend/public/cards_en.json'
const CHINESE = 'frontend/public/cards_zh-cn.json'
const TRADITIONAL = 'frontend/public/cards_zh.json'
const MANIFEST = 'frontend/image-manifest.json'
const ARKHAM = 'backend/arkham-api/library/Arkham/'
const IMAGE = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.svg', '.ico', '.bmp'])
const FONT = new Set(['.ttf', '.otf', '.woff', '.woff2', '.eot'])
const AUDIO = new Set(['.ogg', '.mp3', '.wav', '.m4a', '.flac'])
const SKIPPED_DIRECTORIES = new Set(['.git', '.codebuddy', 'node_modules', 'dist-newstyle', '.stack-work'])
const DISPLAY_FIELDS = new Set(['name', 'real_name', 'subname', 'text', 'real_text', 'flavor', 'traits', 'real_traits', 'slot', 'real_slot', 'back_name', 'back_text', 'back_flavor', 'type_name', 'subtype_name', 'faction_name', 'faction2_name', 'faction3_name', 'pack_name', 'encounter_name', 'linked_to_name', 'alternate_of_name', 'duplicate_of_name', 'customization_text', 'customization_change', 'illustrator', 'url', 'imagesrc', 'backimagesrc'])
const FIELD_MAP = {
  type_code: 'type', faction_code: 'klass', faction2_code: 'faction2', pack_code: 'pack',
  subtype_code: 'subtype', quantity: 'quantity', xp: 'xp', cost: 'cost', position: 'position',
  deck_limit: 'deckLimit', victory: 'victory', health: 'health', sanity: 'sanity',
  enemy_fight: 'fight', enemy_evade: 'evade', enemy_damage: 'damage', enemy_horror: 'horror',
  shroud: 'shroud', clues: 'clues', linked_to_code: 'linkedToCode', back_link: 'backLink',
  is_unique: 'unique', double_sided: 'doubleSided', permanent: 'permanent', exceptional: 'exceptional',
  health_per_investigator: 'healthPerInvestigator', encounter_code: 'encounterCode',
  encounter_position: 'encounterPosition', enemy_health: 'enemyHealth',
}

export function stableStringify(value, space = 0) {
  return JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item, space)
}
export const sha256 = value => createHash('sha256').update(value).digest('hex')
const sorted = values => [...values].sort()
const unique = values => sorted(new Set(values))
const difference = (left, right) => sorted([...left].filter(code => !right.has(code)))
const isCardTable = path => path === LEGACY || /^frontend\/public\/cards(?:_[^/]+)?\.json$/.test(path)
const tally = (items, key) => {
  const counts = new Map()
  for (const item of items) {
    const value = String(typeof key === 'function' ? key(item) : item[key] ?? '(missing)')
    counts.set(value, (counts.get(value) || 0) + 1)
  }
  return Object.fromEntries([...counts].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0))
}

function walk(root, skipped, prefix = '') {
  const paths = []
  for (const entry of readdirSync(resolve(root, prefix), { withFileTypes: true }).sort((a, b) => a.name < b.name ? -1 : 1)) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.isSymbolicLink() || (entry.isDirectory() && SKIPPED_DIRECTORIES.has(entry.name))) {
      skipped.push({ path, reason: entry.isSymbolicLink() ? '不跟随符号链接，避免越过来源边界或重复计数' : '版本控制、IDE 元数据或可重建依赖/构建缓存，不是资源来源' })
    } else if (entry.isDirectory()) paths.push(...walk(root, skipped, path))
    else if (entry.isFile()) paths.push(path)
    else skipped.push({ path, reason: '非普通文件，不读取设备或特殊文件' })
  }
  return paths
}

export function inspectJson(buffer, cardTable = false) {
  const text = buffer.toString('utf8').replace(/^\uFEFF/, '')
  if (!text.trim()) return { status: 'empty', records: null, uniqueCodes: null, codes: [], rows: [] }
  let value
  try { value = JSON.parse(text) } catch {
    return { status: 'damaged', reason: 'invalid-json', records: null, uniqueCodes: null, codes: [], rows: [] }
  }
  if (cardTable && !Array.isArray(value)) return { status: 'invalid-schema', reason: 'expected-array', records: null, uniqueCodes: null, codes: [], rows: [] }
  const rows = Array.isArray(value) ? value : []
  const invalidRecords = []
  const positions = new Map()
  if (cardTable) rows.forEach((row, index) => {
    if (!row || typeof row !== 'object' || Array.isArray(row) || typeof row.code !== 'string' || !row.code.trim() || row.code !== row.code.trim()) {
      invalidRecords.push(index)
    } else {
      if (!positions.has(row.code)) positions.set(row.code, [])
      positions.get(row.code).push(index)
    }
  })
  const shape = new Map()
  function visit(item, path) {
    const type = item === null ? 'null' : Array.isArray(item) ? 'array' : typeof item
    if (!shape.has(path)) shape.set(path, new Set())
    shape.get(path).add(type)
    if (Array.isArray(item)) item.forEach(child => visit(child, `${path}[]`))
    else if (item && typeof item === 'object') for (const [key, child] of Object.entries(item)) visit(child, `${path}.${key}`)
  }
  visit(value, '$')
  const fields = Object.fromEntries([...shape].sort(([a], [b]) => a < b ? -1 : 1).map(([key, types]) => [key, sorted(types)]))
  return {
    status: invalidRecords.length ? 'invalid-schema' : 'valid',
    records: Array.isArray(value) ? value.length : null,
    uniqueCodes: cardTable ? positions.size : null,
    codes: sorted(positions.keys()),
    duplicates: [...positions].filter(([, indexes]) => indexes.length > 1).map(([code, indexes]) => ({ code, indexes })),
    invalidRecords,
    schema: { auditVersion: 1, declaredVersion: !Array.isArray(value) && value && typeof value === 'object' ? value.schemaVersion ?? value.$schema ?? null : null, shapeSha256: sha256(stableStringify(fields)), fields },
    rows, value,
  }
}

function comparisonFields(row, prefix = '') {
  const result = {}
  for (const [key, value] of Object.entries(row)) {
    const field = prefix + key
    if (key === 'linked_card' && value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(result, comparisonFields(value, `${field}.`))
    } else result[field] = value
  }
  return result
}

export function compareSources(sources) {
  const byCode = new Map()
  for (const source of sources) for (const row of source.rows) {
    if (!row || typeof row.code !== 'string') continue
    if (!byCode.has(row.code)) byCode.set(row.code, [])
    byCode.get(row.code).push({ path: source.path, row: comparisonFields(row) })
  }
  const conflicts = []
  const fieldPresenceDifferences = []
  const displayDifferences = new Map()
  for (const code of sorted(byCode.keys())) {
    const entries = byCode.get(code)
    for (const field of unique(entries.flatMap(({ row }) => Object.keys(row)))) {
      if (field === 'code') continue
      const variants = new Map()
      const absentIn = []
      for (const { path, row } of entries) {
        if (!Object.hasOwn(row, field)) { absentIn.push(path); continue }
        const key = stableStringify(row[field])
        if (!variants.has(key)) variants.set(key, { value: row[field], sources: [] })
        variants.get(key).sources.push(path)
      }
      if (DISPLAY_FIELDS.has(field.split('.').at(-1))) {
        if (variants.size > 1) displayDifferences.set(field, (displayDifferences.get(field) || 0) + 1)
        continue
      }
      if (variants.size > 1) conflicts.push({ code, field, variants: [...variants.values()], status: 'unresolved', nextPhase: 'N1' })
      if (absentIn.length) fieldPresenceDifferences.push({ code, field, absentIn: unique(absentIn) })
    }
  }
  return { conflicts, fieldPresenceDifferences, displayDifferencesByField: Object.fromEntries(displayDifferences) }
}

export function maskHaskellComments(text, pragmas = []) {
  let out = '', depth = 0, quoted = false, lineComment = false
  for (let i = 0; i < text.length; i++) {
    const char = text[i], next = text[i + 1]
    if (lineComment) { out += char === '\n' ? '\n' : ' '; if (char === '\n') lineComment = false; continue }
    if (depth) {
      if (char === '{' && next === '-') { depth++; out += '  '; i++ }
      else if (char === '-' && next === '}') { depth--; out += '  '; i++ }
      else out += char === '\n' ? '\n' : ' '
      continue
    }
    if (quoted) {
      out += char
      if (char === '\\' && next !== undefined) out += text[++i]
      else if (char === '"') quoted = false
    } else if (char === '"') { quoted = true; out += char }
    else if (char === '-' && next === '-' && !/[!#$%&*+./<=>?@\\^|~:-]/.test(text[i + 2] || ' ')) { lineComment = true; out += '  '; i++ }
    else if (text.startsWith('{-#', i) && text.indexOf('#-}', i + 3) !== -1) {
      const end = text.indexOf('#-}', i + 3) + 3
      const pragma = text.slice(i, end)
      pragmas.push({ line: 1 + text.slice(0, i).split('\n').length - 1, pragma })
      out += pragma.replace(/[^\n]/g, ' ')
      i = end - 1
    } else if (char === '{' && next === '-') { depth = 1; out += '  '; i++ }
    else out += char
  }
  return out
}

const codeLiteral = value => /^(?:[A-Za-z]*\d{5}[A-Za-z]*|:[A-Za-z0-9-]+(?::[A-Za-z0-9-]+)*)$/.test(value)
export function scanHaskell(path, text) {
  const pragmas = []
  const clean = maskHaskellComments(text, pragmas)
  const lineAt = index => clean.slice(0, index).split('\n').length
  const declarations = [...clean.matchAll(/^([a-z][\w']*)[ \t]*(?:\r?\n[ \t]+)?::[ \t]*([^\r\n]+)/gm)]
  const definitions = [], builders = []
  for (const match of declarations) {
    const signature = match[2].trim()
    const kind = /^(CardDef|PlayerCardDef)$/.test(signature) ? 'definition'
      : /^(Act|Agenda|Asset|Enemy|EnemyLocation|Event|Investigator|Location|Skill|Story|Treachery)Card\s+[A-Z]\w*$/.test(signature) ? 'card-builder'
        : /^Difficulty\s*->\s*[A-Z]\w*$/.test(signature) ? 'scenario-or-campaign-builder' : null
    if (!kind) continue
    const rest = clean.slice(match.index + match[0].length)
    const lines = []
    for (const line of rest.split('\n')) {
      const topLevel = line.match(/^([a-z][\w']*)\b/)
      if (topLevel && topLevel[1] !== match[1]) break
      lines.push(line)
    }
    const codeCandidates = unique([...lines.join('\n').matchAll(/"([^"\r\n]*)"/g)].map(m => m[1]).filter(codeLiteral))
    const entry = { path, line: lineAt(match.index), symbol: match[1], signature, codeCandidates, identityStatus: codeCandidates.length === 1 ? 'single-literal-candidate' : codeCandidates.length ? 'multiple-literals-review-required' : 'indirect-or-no-literal', homebrew: path.includes('/Homebrew/'), returnTo: /ReturnTo/.test(path + match[1]) }
    if (kind === 'definition') definitions.push(entry)
    else builders.push({ ...entry, kind })
  }
  const registrations = []
  for (const match of clean.matchAll(/\(\s*"([^"\r\n]+)"\s*,\s*(SomeCampaign|HomebrewCampaign|HomebrewScenario)\s+([^\r\n)]+)/g)) {
    registrations.push({ path, line: lineAt(match.index), code: match[1], constructor: match[2], expression: match[3].trim(), scope: /Homebrew/.test(path) ? 'homebrew-deferred' : /returnTo/i.test(match[3]) ? 'return-to-N5' : /standaloneCampaign/.test(match[3]) ? 'standalone-wrapper' : 'campaign-N4-or-N5' })
  }
  const discovery = pragmas.filter(({ pragma }) => pragma.includes('OPTIONS_GHC') && pragma.includes('cards-discover')).map(pragma => ({ path, ...pragma }))
  return { definitions, builders, registrations, discovery }
}

function classify(path) {
  const extension = extname(path).toLowerCase()
  if (isCardTable(path)) return 'card-table'
  if (path === MANIFEST) return 'image-manifest'
  if (IMAGE.has(extension)) return 'image'
  if (FONT.has(extension)) return 'font'
  if (AUDIO.has(extension)) return 'audio'
  if (extension === '.hs' || extension === '.lhs' || extension === '.hs-boot') return 'haskell'
  if (extension === '.json') return 'other-json'
  if (/LICENSE|COPYING|GENERATED-AUDIO/i.test(path)) return 'license-or-origin'
  return 'other-source-files'
}
function jsonPurpose(path) {
  if (path.startsWith('frontend/homebrew/')) return 'homebrew-deferred'
  if (path.includes('/locales/')) return 'locale-and-story-N1-N2-N4-N5'
  if (path.startsWith('backend/arkham-api/data/')) return 'campaign-set-skeleton-N1-N4-N5'
  return 'configuration-or-other-inventory-only'
}
function mediaBucket(path) {
  if (path.startsWith('frontend/public/img/arkham/')) return 'public-arkham'
  if (path.startsWith('frontend/public/img/icons/')) return 'application-icons'
  if (path.startsWith('frontend/homebrew/dark-matter/')) return 'homebrew-dark-matter'
  if (path.startsWith('frontend/homebrew/circus-ex-mortis/')) return 'homebrew-circus-ex-mortis'
  return 'other'
}

export function inspectManifest(value, localPaths) {
  const groups = [], invalidEntries = [], all = [], seen = new Set(), duplicates = []
  if (!value || Array.isArray(value) || typeof value !== 'object') return { groups, invalidEntries: [{ reason: 'expected-object-of-arrays' }], entries: 0, uniquePaths: 0, duplicates }
  for (const group of Object.keys(value).sort()) {
    const paths = value[group]
    if (!Array.isArray(paths)) { invalidEntries.push({ group, reason: 'expected-array' }); continue }
    const presentLocally = [], remoteOnly = []
    for (const [index, path] of paths.entries()) {
      if (typeof path !== 'string' || path.startsWith('/') || path.includes('\\') || path.split('/').some(part => !part || part === '.' || part === '..') || /^[a-z]+:/i.test(path)) {
        invalidEntries.push({ group, index, reason: 'unsafe-or-invalid-relative-path' }); continue
      }
      if (seen.has(path)) duplicates.push({ group, path })
      seen.add(path); all.push(path)
      if (localPaths.has(`frontend/public/${path}`)) presentLocally.push(path)
      else remoteOnly.push(path)
    }
    groups.push({ group, entries: paths.length, presentLocally: sorted(presentLocally), remoteOnly: sorted(remoteOnly) })
  }
  return { groups, invalidEntries, entries: all.length, uniquePaths: seen.size, duplicates, localMatches: groups.reduce((n, group) => n + group.presentLocally.length, 0), remoteStatus: 'not-probed', licenseStatus: 'not-verified', reason: '清单路径不是唯一卡号、下载数量或网络可用性证明。' }
}

const plainText = value => String(value ?? '').replace(/<[^>]*>/g, '').trim()
function localeEvidence(card, zh) {
  const fields = { name: 'nameZh', subname: 'subnameZh', traits: 'traitsZh', text: 'textZh', flavor: 'flavorZh', back_text: 'backTextZh', back_flavor: 'backFlavorZh' }
  const evidence = []
  for (const [sourceField, targetField] of Object.entries(fields)) {
    const sourceValue = zh?.[sourceField]
    const targetValue = card[targetField]
    const sourceHas = sourceValue != null && String(sourceValue).trim() !== ''
    const targetHas = Array.isArray(targetValue) ? targetValue.length > 0 : targetValue != null && String(targetValue).trim() !== ''
    const expected = sourceField === 'traits' ? String(sourceValue ?? '').split('.').map(s => s.trim()).filter(Boolean) : plainText(sourceValue)
    const actual = Array.isArray(targetValue) ? targetValue : plainText(targetValue)
    evidence.push({ sourceField, targetField, status: !sourceHas ? targetHas ? 'target-without-code-source' : 'not-in-source' : !targetHas ? 'missing-target' : stableStringify(expected) === stableStringify(actual) ? 'matches-code-source' : 'differs-review-required' })
  }
  return { status: !zh ? 'fallback-or-missing' : evidence.some(item => ['missing-target', 'differs-review-required', 'target-without-code-source'].includes(item.status)) ? 'partial-or-conflicting' : 'code-source-matched-unreviewed', fields: evidence }
}

function targetProjection(card, source) {
  if (!source) return []
  return Object.entries(FIELD_MAP).flatMap(([field, targetField]) => {
    if (!Object.hasOwn(source, field)) return []
    return stableStringify(source[field]) === stableStringify(card[targetField]) ? [] : [{ sourceField: field, targetField, sourceValue: source[field], targetValue: card[targetField] ?? null, targetPresent: Object.hasOwn(card, targetField) }]
  })
}

export function buildCapabilities(policy, sources, conflicts, haskell) {
  const index = path => new Map((sources.find(source => source.path === path)?.rows || []).map(row => [row.code, row]))
  const en = index(ENGLISH), zh = index(CHINESE), legacy = index(LEGACY)
  const corePool = new Set(corePlayablePool().map(card => card.code))
  const conflicted = new Set(conflicts.map(item => item.code))
  const references = new Map()
  for (const def of haskell.definitions) for (const code of def.codeCandidates) {
    if (!references.has(code)) references.set(code, [])
    references.get(code).push({ path: def.path, symbol: def.symbol, line: def.line, identityStatus: def.identityStatus })
  }
  const cards = sorted(Object.keys(catalog.ALL_CARDS)).map(code => {
    const card = catalog.ALL_CARDS[code], effect = EFFECTS[code]
    const projection = targetProjection(card, en.get(code) || legacy.get(code))
    const findingIds = ['metadata-projection', 'locale-provenance', 'image-rendering']
    if (effect) findingIds.push('effect-not-acceptance')
    if (card.type === 'investigator') findingIds.push('investigator-selection')
    if (card.type === 'skill' && !effect && isPlayable(card)) findingIds.push('skill-implicit-admission')
    if (policy.findings.find(item => item.id === 'unmarked-core-differences').codes.includes(code)) findingIds.push('unmarked-core-differences')
    return {
      code, name: card.nameZh || card.name, type: card.type, pack: card.pack,
      dataStatus: conflicted.has(code) || projection.length ? 'conflict-or-projection-gap' : 'imported-unreviewed',
      sourcePaths: sources.filter(source => source.codeSet.has(code)).map(source => source.path),
      projectionDifferences: projection, locale: localeEvidence(card, zh.get(code)), imageStatus: 'text-only-not-verified',
      effectStatus: INVESTIGATOR_ABILITIES[code] ? 'investigator-partial-unverified' : !effect ? 'no-effect-entry-unreviewed' : effect.simplified ? 'simplified-unverified' : 'encoded-unverified',
      availability: { observedCorePool: corePool.has(code), observedCoreInvestigator: CORE_INVESTIGATOR_CODES.includes(code), observedIsPlayable: Boolean(isPlayable(card)), strictAccepted: false, enforcement: 'not-a-runtime-allowlist' },
      findingIds, haskellCandidates: references.get(code) || [],
    }
  })
  const effects = sorted(Object.keys(EFFECTS)).map(code => ({ code, inCatalog: Object.hasOwn(catalog.ALL_CARDS, code), explicitSimplified: EFFECTS[code].simplified === true, note: EFFECTS[code].note || null, encodedDefinition: EFFECTS[code], status: 'not-behavior-accepted', evidence: `games/arkhamhorror/card-effects.js#EFFECTS.${code}`, haskellCandidates: references.get(code) || [], findingIds: ['effect-not-acceptance', ...(policy.findings.filter(item => item.codes?.includes(code)).map(item => item.id))] }))
  const investigators = sorted(Object.keys(INVESTIGATOR_ABILITIES)).map(code => ({ code, status: 'partial-unverified', review: policy.investigatorReviews[code] || '新增能力未审核', encodedDefinition: INVESTIGATOR_ABILITIES[code], dependencies: (catalog.ALL_CARDS[code]?.deckRequirements?.signatureCards || []).map(dependency => ({ code: dependency, inCatalog: Object.hasOwn(catalog.ALL_CARDS, dependency), hasEffect: Object.hasOwn(EFFECTS, dependency), status: 'unverified' })), findingIds: ['investigator-selection', 'pending-choice', 'deck-pool-bypass'], evidence: `games/arkhamhorror/card-effects.js#INVESTIGATOR_ABILITIES.${code}` }))
  const scenarios = sorted(Object.keys(SCENARIOS)).map(id => {
    const scenario = SCENARIOS[id]
    const components = ['locations', 'acts', 'agendas', 'enemies', 'treacheries', 'storyAssets'].flatMap(group => Object.entries(scenario[group] || {}).map(([key, value]) => ({ group, internalId: value.id || key, runtimeCode: value.code || null, originalCode: value.code && (en.has(value.code) || legacy.has(value.code)) ? value.code : null, identityStatus: value.code && (en.has(value.code) || legacy.has(value.code)) ? 'explicit-code' : 'unmapped-N1', status: 'handwritten-unverified', definition: value })))
    return { id, scenarioCode: policy.scenarioCodes[id] || null, name: scenario.name, status: 'simplified-unverified', evidence: `games/arkhamhorror/src/cards/scenarios-data.js#SCENARIOS.${id}`, components, encounterDeck: scenario.encounterDeck, cultistDeck: scenario.cultistDeck || null, agentSets: scenario.agentSets || null, resolutions: scenario.resolutions, difficultyKeys: sorted(Object.keys(scenario.tokenMeanings || {})), findingIds: ['notz-identities', 'personal-clues-doom', 'campaign-persistence', ...policy.findings.filter(item => item.scenarios?.includes(id)).map(item => item.id)] }
  })
  return { cards, effects, investigators, scenarios, campaign: { id: CAMPAIGN.id, definition: CAMPAIGN, status: 'simplified-unverified', findingIds: ['campaign-persistence', 'replay-and-validation'] }, strictAcceptedCount: 0, reason: 'N0 为静态能力账本，无逐卡行为验收；没有效果条目也不自动断言完全没有通用引擎行为。' }
}

export function validateExpected(summary, expected) {
  return Object.entries(expected).filter(([key, value]) => summary[key] !== value).map(([key, expectedValue]) => ({ kind: 'baseline-drift', key, expected: expectedValue, actual: summary[key] ?? null }))
}

export function buildAuditReport() {
  return collectAudit(false)
}

export function buildSourceAuditReport() {
  return collectAudit(true)
}

function collectAudit(sourceOnly) {
  const policy = JSON.parse(readFileSync(resolve(ROOT, POLICY_PATH), 'utf8'))
  const referenceRoot = resolve(ROOT, policy.referenceRoot)
  const skipped = [], sourcePaths = walk(referenceRoot, skipped), localPaths = new Set(sourcePaths)
  const sources = [], files = [], supplementaryJson = [], media = [], errors = [], warnings = []
  const haskell = { definitions: [], builders: [], registrations: [], discovery: [] }
  let manifest = null, scenarioRegistry = ''
  for (const path of sourcePaths) {
    const buffer = readFileSync(resolve(referenceRoot, path)), kind = classify(path)
    files.push({ path, kind, bytes: buffer.length, sha256: sha256(buffer) })
    if (kind === 'card-table') {
      const inspected = inspectJson(buffer, true)
      const exception = policy.exceptions.find(item => item.path === path && item.expectedStatus === inspected.status)
      const { rows, value: _value, ...metadata } = inspected
      const acceptedException = Boolean(exception && inspected.status === 'empty' && buffer.length === 0)
      sources.push({ path, ...metadata, rows, codeSet: new Set(metadata.codes), exceptionId: acceptedException ? exception.id : null })
      if (metadata.status !== 'valid' && !acceptedException) errors.push({ kind: 'invalid-card-source', path, status: metadata.status })
      if (metadata.duplicates?.length) errors.push({ kind: 'duplicate-card-codes', path, codes: metadata.duplicates.map(item => item.code) })
    } else if (kind === 'image-manifest') {
      const inspected = inspectJson(buffer)
      if (inspected.status !== 'valid') errors.push({ kind: 'invalid-manifest', path, status: inspected.status })
      manifest = inspectManifest(inspected.value, localPaths)
      errors.push(...manifest.invalidEntries.map(item => ({ kind: 'invalid-manifest-entry', ...item })))
    } else if (kind === 'other-json') {
      const inspected = inspectJson(buffer)
      const exception = policy.exceptions.find(item => item.path === path && item.expectedStatus === inspected.status)
      supplementaryJson.push({ path, purpose: jsonPurpose(path), status: inspected.status, records: inspected.records, schemaSha256: inspected.schema?.shapeSha256 || null, exceptionId: exception?.id || null, reason: exception?.reason || '卡表以外的 JSON 不参与卡号并集；非 valid 项不作为已解析资源使用。' })
      if (inspected.status !== 'valid') {
        const finding = { kind: 'supplementary-json-not-valid', path, status: inspected.status, reason: exception?.reason || '未登记的附属 JSON 解析异常，必须核查并修复来源或明确隔离。' }
        if (exception) warnings.push(finding)
        else errors.push(finding)
      }
    }
    if (kind === 'haskell') {
      const scanned = scanHaskell(path, buffer.toString('utf8'))
      for (const key of Object.keys(haskell)) haskell[key].push(...scanned[key])
      if (path === `${ARKHAM}Scenario.hs`) scenarioRegistry = maskHaskellComments(buffer.toString('utf8'))
    }
    if (['image', 'font', 'audio'].includes(kind)) {
      const license = policy.mediaLicenses.find(item => item.path === path)
      media.push({ path, kind, bucket: mediaBucket(path), localStatus: 'present-in-reference-only', licenseStatus: license?.status || 'permission-review-required', licenseEvidence: license?.evidence || null, migration: path.includes('/homebrew/') ? 'deferred-homebrew' : kind === 'image' && !path.startsWith('frontend/public/img/arkham/') ? 'inventory-only-select-if-needed' : 'N2-select-if-needed' })
    }
  }
  for (const path of [LEGACY, ENGLISH, CHINESE, TRADITIONAL, MANIFEST]) if (!localPaths.has(path)) errors.push({ kind: 'missing-required-source', path })
  for (const exception of policy.exceptions.filter(item => item.path)) if (!localPaths.has(exception.path)) errors.push({ kind: 'missing-exception-source', path: exception.path })
  for (const license of policy.mediaLicenses) if (!localPaths.has(license.path) || !localPaths.has(license.evidence)) errors.push({ kind: 'missing-license-evidence', path: license.path, evidence: license.evidence })
  const valid = sources.filter(source => source.status === 'valid')
  const union = new Set(valid.flatMap(source => source.codes)), targetSet = new Set(sourceOnly ? [] : Object.keys(catalog.ALL_CARDS))
  const english = sources.find(source => source.path === ENGLISH), chinese = sources.find(source => source.path === CHINESE), legacy = sources.find(source => source.path === LEGACY)
  const compared = compareSources(valid)
  const coverage = {
    unionCodes: sorted(union),
    ...(!sourceOnly ? { missingInTarget: difference(union, targetSet), targetOnly: difference(targetSet, union) } : {}),
    legacyOnlyVsEnglish: difference(legacy?.codeSet || new Set(), english?.codeSet || new Set()),
    conflictPolicy: '所有非展示字段的不同已提供值报告为待核实冲突；缺字段单列，不把缺省与 null/false/0 视为等价。翻译及 URL 差异只作展示统计，不作规则冲突。',
    excludedDisplayFields: sorted(DISPLAY_FIELDS), ...compared,
  }
  if (stableStringify(coverage.legacyOnlyVsEnglish) !== stableStringify(policy.exceptions.filter(item => item.code).map(item => item.code).sort())) errors.push({ kind: 'legacy-compatibility-drift', actual: coverage.legacyOnlyVsEnglish })
  if (coverage.targetOnly?.length) errors.push({ kind: 'target-codes-outside-json-baseline', codes: coverage.targetOnly })
  for (const source of sources) {
    source.byType = tally(source.rows.filter(row => row && typeof row === 'object'), 'type_code')
    source.byPack = tally(source.rows.filter(row => row && typeof row === 'object'), 'pack_code')
    source.byFaction = tally(source.rows.filter(row => row && typeof row === 'object'), 'faction_code')
    source.missingFromSourceUnion = difference(union, source.codeSet)
    if (!sourceOnly) {
      source.missingInTarget = difference(source.codeSet, targetSet)
      source.targetOnly = difference(targetSet, source.codeSet)
      source.missingByType = tally(source.rows.filter(row => row && !targetSet.has(row.code)), 'type_code')
      source.missingByPack = tally(source.rows.filter(row => row && !targetSet.has(row.code)), 'pack_code')
    }
  }
  const candidateCodes = new Set(haskell.definitions.flatMap(entry => entry.codeCandidates))
  const scenarioAliases = [...scenarioRegistry.matchAll(/scenarioCardCodeAliases\s*=\s*([^\n]+)/g)].flatMap(match => [...match[1].matchAll(/\("([^"]+)",\s*"([^"]+)"\)/g)].map(item => ({ alias: item[1], canonical: item[2] })))
  const duplicateBlock = scenarioRegistry.match(/duplicatedScenarios\s*=\s*\[([^\]]+)\]/)
  const normalizations = [...scenarioRegistry.matchAll(/"([^"]+)"\s*->\s*"([^"]+)"/g)].map(match => ({ from: match[1], to: match[2] }))
  const haskellReport = {
    ...haskell,
    countingPolicy: '静态签名与字面量候选审计，不编译 Haskell。多字面量/间接定义均保留；不把候选当作有效 CardDef 编号或独立规则数。builder 按源发现器签名约定枚举，未证明所有导入/生成注册最终可达。',
    definitionLiteralCodes: sorted(candidateCodes),
    jsonAbsentDefinitionLiteralCandidates: difference(candidateCodes, union),
    nonFiveDigitDefinitionLiterals: sorted([...candidateCodes].filter(code => !/^\d{5}$/.test(code))),
    scenarioAliases, duplicatedScenarioCardExclusions: duplicateBlock ? [...duplicateBlock[1].matchAll(/"([^"]+)"/g)].map(match => match[1]) : [], scenarioCardNormalizations: normalizations,
    candidateScopeCounts: tally(haskell.builders.filter(entry => entry.kind === 'scenario-or-campaign-builder'), entry => entry.homebrew ? 'homebrew' : entry.returnTo ? 'return-to' : 'official-or-special-review-required'),
    nextPhase: 'N1 确认身份，N4/N5 逐项行为与注册可达性验收；Haskell 独有候选不改写 5930 的 JSON 口径。',
  }
  const sourceSummary = {
    jsonUnionCodes: union.size,
    validFrontendTables: valid.filter(source => source.path.startsWith('frontend/')).length,
    emptyFrontendTables: sources.filter(source => source.path.startsWith('frontend/') && source.status === 'empty').length,
    englishCodes: english?.uniqueCodes ?? 0, chineseCodes: chinese?.uniqueCodes ?? 0,
    cardTypes: Object.keys(chinese?.byType || {}).length, legacyPacks: Object.keys(legacy?.byPack || {}).length,
    referenceImages: media.filter(item => item.kind === 'image').length, referenceFonts: media.filter(item => item.kind === 'font').length,
    referenceAudio: media.filter(item => item.kind === 'audio').length,
    sourceFiles: files.length, structuralConflicts: compared.conflicts.length, fieldPresenceDifferences: compared.fieldPresenceDifferences.length,
    haskellDefinitionCandidates: haskell.definitions.length, haskellBuilderCandidates: haskell.builders.length,
    haskellJsonAbsentLiteralCandidates: haskellReport.jsonAbsentDefinitionLiteralCandidates.length,
    campaignRegistrationEntries: haskell.registrations.filter(item => item.constructor === 'SomeCampaign').length,
    homebrewCampaignRegistrationEntries: haskell.registrations.filter(item => item.constructor === 'HomebrewCampaign').length,
    homebrewScenarioRegistrationEntries: haskell.registrations.filter(item => item.constructor === 'HomebrewScenario').length,
    manifestEntries: manifest?.entries ?? 0, manifestLocalMatches: manifest?.localMatches ?? 0,
    manifestRemoteOnlyEntries: manifest?.groups.reduce((n, group) => n + group.remoteOnly.length, 0) ?? 0,
  }
  if (sourceOnly) errors.push(...validateExpected(sourceSummary, withoutKeys(policy.expected, TARGET_SUMMARY_KEYS)))
  const common = {
    schemaVersion: 1, baselineId: policy.baselineId, referenceRoot: policy.referenceRoot,
    schemaPolicy: 'auditVersion 是审计结构版本；declaredVersion 为源自报 schema（卡表没有则 null），shapeSha256 为实际字段/类型指纹，不伪造源版本。',
    summary: sourceSummary, validation: { status: errors.length ? 'failed' : 'passed-with-known-gaps', errors, warnings, meaning: '通过仅表示 N0 资源基线可复核，不代表字段冲突关闭、中文完整、图像可用或规则验收。' },
    fingerprints: { reference: sha256(stableStringify(files)), policy: sha256(stableStringify(policy)) },
    sourceInventory: { files, skipped, countsByKind: tally(files, 'kind'), pathPolicy: '所有路径相对 referenceRoot；媒体按路径计，不做内容去重；忽略项与理由逐路径列出。' },
    sources: sources.map(({ rows: _rows, codeSet: _set, ...source }) => source), coverage,
    supplementaryJson, media: { localFiles: media, imagesByBucket: tally(media.filter(item => item.kind === 'image'), 'bucket'), manifest },
    haskell: haskellReport, scope: policy,
  }
  if (sourceOnly) return sourceSnapshot(common)
  const capabilities = buildCapabilities(policy, valid, compared.conflicts, haskellReport)
  const targetSkipped = []
  const gamePaths = walk(resolve(ROOT, 'games/arkhamhorror'), targetSkipped)
  const publicPaths = walk(resolve(ROOT, 'public'), targetSkipped)
  const excludedTargetPaths = gamePaths.filter(path => /^(audit|tools|tests)\//.test(path) || path.endsWith('.md'))
  const targetPaths = [...gamePaths.filter(path => !excludedTargetPaths.includes(path)).map(path => `games/arkhamhorror/${path}`), ...publicPaths.map(path => `public/${path}`)]
  const targetFiles = targetPaths.map(path => { const buffer = readFileSync(resolve(ROOT, path)); return { path, bytes: buffer.length, sha256: sha256(buffer), kind: classify(path) } })
  const targetImagePaths = [...gamePaths.map(path => `games/arkhamhorror/${path}`), ...publicPaths.map(path => `public/${path}`)].filter(path => IMAGE.has(extname(path).toLowerCase()))
  const target = { files: targetFiles, skipped: targetSkipped, excludedFromRuntimeFingerprint: ['audit/**：审计输入和生成报告单独冻结，避免自引用', 'tools/**、tests/**：审计/导入/测试工具不是运行时资源', '*.md：行动计划和说明可独立修订'], imagePaths: sorted(targetImagePaths), byType: tally(Object.values(catalog.ALL_CARDS), 'type'), byPack: tally(Object.values(catalog.ALL_CARDS), 'pack'), categories: Object.fromEntries(['INVESTIGATORS', 'PLAYER_CARDS', 'WEAKNESSES', 'BASIC_WEAKNESSES', 'ENCOUNTER_CARDS'].map(key => [key, Object.keys(catalog[key]).length])), runtimeDefinitionKeys: sorted(Object.keys(allCardDefs())), meta: catalog.META }
  const summary = {
    ...sourceSummary, targetCodes: targetSet.size, missingTargetCodes: coverage.missingInTarget.length,
    effectEntries: Object.keys(EFFECTS).length, explicitlySimplifiedEffects: Object.values(EFFECTS).filter(effect => effect.simplified).length,
    investigatorAbilities: Object.keys(INVESTIGATOR_ABILITIES).length, scenarios: Object.keys(SCENARIOS).length, difficulties: DIFFICULTIES.length,
    corePoolCodes: corePlayablePool().length, runtimeDefinitionKeys: target.runtimeDefinitionKeys.length,
    targetImages: targetImagePaths.length, strictAcceptedCards: catalog.META.strictAccepted || 0,
  }
  errors.push(...validateExpected(summary, policy.expected))
  return {
    ...common, summary, target, capabilities,
    fingerprints: { ...common.fingerprints, target: sha256(stableStringify(targetFiles)) },
    validation: { ...common.validation, status: errors.length ? 'failed' : 'passed-with-known-gaps' },
  }
}

const withoutKeys = (value, keys) => Object.fromEntries(Object.entries(value).filter(([key]) => !keys.has(key)))

export function sourceSnapshot(report) {
  const { target: _target, capabilities: _capabilities, ...source } = report
  return {
    ...source,
    summary: withoutKeys(report.summary, TARGET_SUMMARY_KEYS),
    fingerprints: withoutKeys(report.fingerprints, new Set(['target'])),
    coverage: withoutKeys(report.coverage, new Set(['missingInTarget', 'targetOnly'])),
    sources: report.sources.map(item => withoutKeys(item, new Set(['missingInTarget', 'targetOnly', 'missingByType', 'missingByPack']))),
  }
}

export function validateFrozenReport(report) {
  const errors = []
  const equal = (section, actual, expected) => {
    if (stableStringify(actual) !== stableStringify(expected)) errors.push({ kind: 'frozen-report-integrity', section, expected, actual })
  }
  equal('reportSha256', sha256(stableStringify(report)), N0_REPORT_SHA256)
  try {
    equal('fingerprints.reference', report.fingerprints.reference, sha256(stableStringify(report.sourceInventory.files)))
    equal('fingerprints.target', report.fingerprints.target, sha256(stableStringify(report.target.files)))
    equal('fingerprints.policy', report.fingerprints.policy, sha256(stableStringify(report.scope)))
    equal('baselineId', report.baselineId, report.scope.baselineId)
    equal('referenceRoot', report.referenceRoot, report.scope.referenceRoot)
    equal('validation.errors', report.validation.errors, [])
    errors.push(...validateExpected(report.summary, report.scope.expected))
    const cards = report.capabilities.cards, targets = new Set(cards.map(card => card.code))
    const union = new Set(report.sources.filter(source => source.status === 'valid').flatMap(source => source.codes))
    equal('capabilities.cards.uniqueCodes', targets.size, cards.length)
    equal('coverage.unionCodes', report.coverage.unionCodes, sorted(union))
    equal('coverage.missingInTarget', report.coverage.missingInTarget, difference(union, targets))
    equal('coverage.targetOnly', report.coverage.targetOnly, difference(targets, union))
    equal('target.byType', report.target.byType, tally(cards, 'type'))
    equal('target.byPack', report.target.byPack, tally(cards, 'pack'))
    equal('target.categories.total', Object.values(report.target.categories).reduce((n, count) => n + count, 0), targets.size)
    equal('target.meta.total', report.target.meta.total, targets.size)
    equal('sourceInventory.countsByKind', report.sourceInventory.countsByKind, tally(report.sourceInventory.files, 'kind'))
    const accepted = cards.filter(card => card.availability.strictAccepted).length
    equal('capabilities.strictAcceptedCount', report.capabilities.strictAcceptedCount, accepted)
    for (const [key, actual] of Object.entries({
      jsonUnionCodes: union.size, targetCodes: targets.size, missingTargetCodes: difference(union, targets).length,
      effectEntries: report.capabilities.effects.length,
      explicitlySimplifiedEffects: report.capabilities.effects.filter(effect => effect.explicitSimplified).length,
      investigatorAbilities: report.capabilities.investigators.length, scenarios: report.capabilities.scenarios.length,
      corePoolCodes: cards.filter(card => card.availability.observedCorePool).length,
      runtimeDefinitionKeys: report.target.runtimeDefinitionKeys.length, targetImages: report.target.imagePaths.length,
      sourceFiles: report.sourceInventory.files.length, strictAcceptedCards: accepted,
    })) equal(`summary.${key}`, report.summary[key], actual)
    for (const source of report.sources) {
      const codes = new Set(source.codes)
      equal(`${source.path}.missingInTarget`, source.missingInTarget, difference(codes, targets))
      equal(`${source.path}.targetOnly`, source.targetOnly, difference(targets, codes))
      equal(`${source.path}.missingFromSourceUnion`, source.missingFromSourceUnion, difference(union, codes))
      if (source.schema) equal(`${source.path}.schema.shapeSha256`, source.schema.shapeSha256, sha256(stableStringify(source.schema.fields)))
    }
  } catch (error) {
    errors.push({ kind: 'frozen-report-invalid-schema', message: error.message })
  }
  return { ok: errors.length === 0, errors }
}

export function checkReport(report, baseline) {
  const changedSections = unique([...Object.keys(report), ...Object.keys(baseline)]).filter(key => stableStringify(report[key]) !== stableStringify(baseline[key]))
  return { ok: report.validation.errors.length === 0 && changedSections.length === 0, changedSections }
}

export function checkSourceReport(report, baseline) {
  const integrity = validateFrozenReport(baseline)
  const result = integrity.ok ? checkReport(report, sourceSnapshot(baseline)) : { ok: false, changedSections: ['frozen-report'] }
  return {
    ...result, mode: 'N0-source-and-frozen-history',
    historicalTarget: { status: 'frozen-N0', integrity, summary: baseline.summary, runtimeFilesVerified: false },
    currentTarget: { status: 'superseded-by-N1-not-checked', reportPath: 'games/arkhamhorror/audit/catalog-report.json', meaning: 'N0 目标是历史快照；当前目录由 N1 接管，本检查不证明当前目标无漂移。--check-current 可明确检查当前运行时相对 N0 的差异。' },
  }
}

function main(args) {
  if (args.length > 1 || (args.length && !['--summary', '--check', '--check-source', '--check-current', '--help'].includes(args[0]))) throw new Error('用法：node games/arkhamhorror/tools/audit-resources.mjs [--summary|--check|--check-source|--check-current|--help]')
  if (args[0] === '--help') {
    console.log('默认输出当前完整 JSON；--summary 输出当前摘要；两者仍按 N0 阈值报告真实目标漂移。--check-source 重新审计 N0 来源并校验冻结历史完整性，不验证由 N1 接管的当前目标；--check / --check-current 对当前运行时与 N0 冻结报告作严格比较，N1 变化也会非零退出。工具不写文件、不联网、不调用导入器。')
    return
  }
  if (args[0] === '--check-source') {
    const baseline = JSON.parse(readFileSync(resolve(ROOT, REPORT_PATH), 'utf8'))
    const report = buildSourceAuditReport()
    const result = checkSourceReport(report, baseline)
    console.log(stableStringify({ ...result, sourceSummary: report.summary, validation: report.validation }, 2))
    if (!result.ok) process.exitCode = 1
    return
  }
  const report = buildAuditReport()
  if (['--check', '--check-current'].includes(args[0])) {
    const baseline = JSON.parse(readFileSync(resolve(ROOT, REPORT_PATH), 'utf8'))
    const integrity = validateFrozenReport(baseline)
    const result = checkReport(report, baseline)
    console.log(stableStringify({ ...result, ok: result.ok && integrity.ok, mode: 'current-target-versus-N0', historicalIntegrity: integrity, summary: report.summary, validation: report.validation }, 2))
    if (!result.ok || !integrity.ok) process.exitCode = 1
  } else {
    console.log(stableStringify(args[0] === '--summary' ? { summary: report.summary, validation: report.validation, fingerprints: report.fingerprints } : report, 2))
    if (report.validation.errors.length) process.exitCode = 1
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(process.argv.slice(2)) } catch (error) { console.error(`资源审计失败：${error.message}`); process.exitCode = 1 }
}
