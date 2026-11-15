import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { inventoryGuides } from './fhv-guide-scan.mjs'
import { chapterCandidates, keyMechanismGroups, mechanisms } from './fhv-mechanisms.mjs'

const mod = fileURLToPath(new URL('../', import.meta.url))
const hall = join(mod, '../..')
const scopeFile = 'audit/fhv-scope.json'
const target = join(mod, 'audit/fhv-mechanism-scan.json')
const run = join(hall, 'artifacts/migration/fhv')
const cardSource = 'frontend/public/cards_en.json'
const sha = value => createHash('sha256').update(value).digest('hex')
const sorted = values => [...values].sort()
const unique = values => [...new Set(values)]
const json = value => JSON.stringify(value, null, 2) + '\n'
const clean = value => value.replace(/<[^>]+>/g, '').trim()
const types = ['primitive', 'keyword', 'rulebook', 'interaction', 'scenario', 'content']
const icons = new Set('action reaction fast skill willpower intellect combat agility wild elder_sign auto_fail skull cultist tablet elder_thing bless curse day night codex guardian seeker rogue mystic survivor per_investigator name'.split(' '))

const sourceFields = ['text', 'back_text', 'customization_text', 'customization_change']
const metadataFields = ['deck_options', 'deck_requirements', 'restrictions', 'bonded_cards', 'uses', 'keywords', 'traits', 'real_traits', 'real_slot']
const flavor = /^\s*(?:<blockquote>\s*)?<i>[^<]*(?:<[^>]+>[^<]*)*<\/i>\s*(?:<\/blockquote>)?\s*$/i
const heading = /^(?:Easy\s*\/\s*Standard|Hard\s*\/\s*Expert)(?:\s*-\s*Act \d+)?$/i

function backendIndex(scope, readReference) {
  const cards = new Map(scope.codes.map(code => [code, []]))
  const backendVariants = new Map()
  const anchors = {}
  const modules = Map.groupBy(Object.keys(scope.sources).filter(path => path.endsWith('.hs')),
    path => path.split('/').at(-1).slice(0, -3).toLowerCase())
  const scenarioPaths = new Set([scope.campaignFlow.source, ...scope.scenarios.map(entry => entry.source)])
  for (const file of [...modules.values()].flat()) {
    const lines = readReference(file).split(/\r?\n/)
    const hits = []
    let definition = null
    for (const [index, raw] of lines.entries()) {
      const line = raw.replace(/--.*$/, '')
      if (/^\S.*::/.test(line)) definition = line.match(/^(\w+)\s*::\s*CardDef\b/)?.[1] || null
      for (const [, code] of line.matchAll(/"(\d{5}[a-z]?)"/g)) {
        const behavior = definition ? (modules.get(definition.toLowerCase()) || []).filter(path => path !== file) : []
        const entry = { file, line: index + 1, ...(behavior.length ? { behavior } : {}) }
        if (cards.has(code)) {
          cards.get(code).push(entry)
        } else if (code.length === 6 && definition) {
          const parent = code.slice(0, 5)
          const printedName = scope.cardsByCode[parent]?.name
          if (printedName && line.includes(`"${printedName}"`)) {
            if (!backendVariants.has(parent)) backendVariants.set(parent, [])
            backendVariants.get(parent).push({ ...entry, viaCode: code })
          }
        }
      }
      if (!scenarioPaths.has(file)) continue
      for (const [kind, pattern] of [
        ['codex', /ScenarioSpecific "codex"|\bcodexFinished\w*\b|noCodexEntry|scope "(?:codex|prelude\.the\w+Evening)"|Unknown codex/],
        ['setup', /\b(?:gather\w* Set\.|setupHemlockDay|setChaosTokens|[Pp]reScenarioSetup)\b/],
        ['resolution', /\b(?:ScenarioResolution|Resolution \d|makePreparationsForNextSurvey|interludeXpAll)\b/],
        ['tokens', /\b(?:getChaosTokenValue|ResolveChaosToken|[Pp]redationTest)\b/],
        ['campaign', /\b(?:UpgradeDeckStep|CampaignSpecificStep|noUpgrade|nextStep|record|[Gg]etRelationshipLevel)\b/],
      ]) {
        if (pattern.test(line)) hits.push({ kind, line: index + 1 })
      }
    }
    if (scenarioPaths.has(file)) {
      const codexHandlers = []
      for (const [index, line] of lines.entries()) {
        if (!/^    .*ScenarioSpecific "codex".*->.*scope "codex"/.test(line)) continue
        const entries = []
        for (let at = index + 1; at < lines.length && !/^    \S/.test(lines[at]); at++) {
          const id = lines[at].match(/^        (\d+|Theta|Sigma|Omega|Pi|Gamma|Delta)\s*(?:\|[^-]+)?->/)?.[1]
          if (id) entries.push({ entry: id, line: at + 1 })
        }
        codexHandlers.push({ line: index + 1, entries })
      }
      anchors[file] = { hits, codexHandlers }
    }
  }
  for (const [code, refs] of cards) {
    if (!refs.length) refs.push(...(backendVariants.get(code) || []))
  }
  return { cards, anchors }
}

function collectCards(scope, original, backend) {
  const definitions = new Map(mechanisms.map(definition => [definition.id, definition]))
  const byCode = new Map(original.map(card => [card.code, card]))
  const owners = new Map(Object.entries(scope.partitions).flatMap(([id, codes]) => codes.map(code => [code, id])))
  const local = new Map(Object.entries(scope.chapterGroups).flatMap(([id, codes]) => codes.map(code => [code, [id]])))
  for (const { id, referenceCodes } of scope.scenarios) {
    for (const code of referenceCodes) local.set(code, unique([...(local.get(code) || []), id]))
  }
  const residents = new Set(scope.residentFaces.flatMap(pair => [pair.front, pair.back]))
  const linked = new Map(scope.linkedFaces.flatMap(pair => [[pair.front, pair.back], [pair.back, pair.front]]))
  const unsupported = []
  const cards = scope.codes.map(code => {
    const card = byCode.get(code)
    assert(card && ALL_CARDS[code], `Card missing in source or catalog: ${code}`)
    const assigned = new Set(mechanisms.filter(definition => definition.codes.includes(code)).map(definition => definition.id))
    if (residents.has(code)) assigned.add('campaign.residents')
    if (card.type_code === 'enemy_location') assigned.add('locations.enemyLocation')
    if (card.faction_code && !card.encounter_code || card.restrictions || card.type_code === 'investigator') assigned.add('content.cardIdentity')
    if (linked.has(code) || card.double_sided || ['location', 'story', 'scenario', 'agenda', 'act'].includes(card.type_code)) assigned.add('content.layoutAndFaces')
    for (const id of local.get(code) || []) assigned.add(`scenario.${id}`)
    const units = []
    const codexTriggers = []
    for (const field of sourceFields) {
      let quotedStory = false
      for (const [index, value] of (card[field] || '').split(/\r?\n/).entries()) {
        const narrative = quotedStory || /<blockquote>\s*<i>/i.test(value) || flavor.test(value)
        if (/<blockquote>\s*<i>/i.test(value)) quotedStory = true
        if (/<\/blockquote>/i.test(value)) quotedStory = false
        const text = clean(value)
        if (!text) continue
        const found = mechanisms.filter(definition => definition.pattern?.test(text)).map(definition => definition.id)
        const line = index + 1
        for (const [, entry] of text.matchAll(/\[codex\]\s*(\d+|[ΩΘΣΨΦФωθσψφ])(?=\W|$)/g)) codexTriggers.push({ field, line, entry })
        const unknownIcons = unique([...text.matchAll(/(?<!\[)\[([\p{L}_\d]+)\](?!\])/gu)].map(([, icon]) => icon)).filter(icon => !icons.has(icon))
        if (narrative || heading.test(text)) found.push('content.layoutAndFaces')
        const ids = sorted(unique(found))
        if (!ids.length || unknownIcons.length) unsupported.push({ code, field, line, text, unknownIcons, status: 'blocked' })
        for (const id of ids) assigned.add(id)
        units.push({ field, line, sha256: sha(value), mechanisms: ids })
      }
    }
    const metadata = Object.fromEntries(metadataFields.filter(field => Object.hasOwn(card, field)).map(field => [field, card[field]]))
    const metadataText = typeof metadata.traits === 'string' ? metadata.traits : ''
    for (const definition of definitions.values()) {
      if (definition.pattern?.test(metadataText)) assigned.add(definition.id)
    }
    if (metadata.deck_options) assigned.add('campaign.deckProgression')
    if (metadata.uses) assigned.add('assets.uses')
    if (metadata.bonded_cards) assigned.add('cards.bondedFaces')
    return {
      code, name: card.name, type: card.type_code, owner: owners.get(code), encounterGroup: card.encounter_code || null,
      printedLink: linked.get(code) || null, hasEmbeddedBack: Boolean(card.double_sided),
      fields: Object.fromEntries(sourceFields.filter(key => card[key]).map(key => [key, sha(card[key])])),
      metadataSha256: sha(json(metadata)), backend: backend.cards.get(code),
      mechanisms: sorted(assigned), units, ...(codexTriggers.length ? { codexTriggers } : {}), behaviorStatus: 'pending',
    }
  })
  return { cards, unsupported }
}

export function buildScan() {
  const scopeText = readFileSync(join(mod, scopeFile), 'utf8')
  const scope = JSON.parse(scopeText)
  const readReference = file => readFileSync(join(hall, scope.referenceRoot, file), 'utf8').replace(/^\uFEFF/, '')
  const backend = backendIndex(scope, readReference)
  const guides = inventoryGuides(scope, readReference, sha)
  const { cards, unsupported } = collectCards(scope, JSON.parse(readReference(cardSource)), backend)
  const sourcesFor = id => guides.groups.flatMap(group => group.ruleCoverage
    .filter(rule => rule.candidatePrimitives.includes(id)).map(rule => `${group.file}#${rule.path}`))
  const scenarioDefinitions = scope.scenarios.map(scenario => ({
    id: `scenario.${scenario.id}`, type: 'scenario', title: scenario.name,
    candidatePrimitives: chapterCandidates[scenario.id], source: [scenario.source, scenario.guide],
  }))
  const mechanismsWithCards = [...mechanisms, ...scenarioDefinitions].map(({ pattern, codes, candidatePrimitives, ...definition }) => {
    const matches = cards.filter(card => card.mechanisms.includes(definition.id)).map(card => card.code)
    const guideSources = unique([definition.id, ...(candidatePrimitives || [])].flatMap(sourcesFor))
    const representativeCards = unique([...(codes || []), ...matches.slice(0, 6)]).filter(code => scope.codes.includes(code))
    const evidence = representativeCards.flatMap(code => backend.cards.get(code).slice(0, 2).map(({ file, line }) => `${file}:${line}`))
    const source = unique([...(definition.source || []), ...guideSources,
      ...representativeCards.map(code => `${cardSource}#${code}`), ...evidence])
    const primitive = definition.type === 'primitive'
    return { ...definition, status: definition.status || (definition.type === 'content' ? 'cataloged' : 'pending'),
      existing: definition.status === 'reuse' || definition.status === 'extend',
      source, representativeCards, cards: matches,
      candidatePrimitives: primitive ? [definition.id] : candidatePrimitives,
      gap: definition.gap ?? (definition.type === 'content' || primitive ? null : '按关联原语及来源核对，保留该内容的独立验收。'),
    }
  })
  const lookup = new Map(mechanismsWithCards.map(row => [row.id, row]))
  assert.equal(lookup.size, mechanismsWithCards.length, 'Duplicate mechanism ID')
  const nextPhase = mechanismsWithCards.filter(row => row.type === 'primitive').map(row => ({
    id: row.id, disposition: row.status, status: 'pending', gap: row.gap, readPoints: row.readPoints,
    cards: row.representativeCards,
    mechanisms: mechanismsWithCards.filter(mechanism => mechanism.candidatePrimitives.includes(row.id)).map(mechanism => mechanism.id),
  }))
  const keyMechanisms = Object.entries(keyMechanismGroups).map(([id, primitiveIds]) => ({
    id, primitiveIds, classifications: Object.fromEntries(primitiveIds.map(id => [id, lookup.get(id).status])),
    cards: sorted(unique(primitiveIds.flatMap(id => lookup.get(id).cards))),
  }))
  const unclassified = cards.filter(card => card.mechanisms.length === 0).map(card => card.code)
  const unknownGuideRules = guides.groups.flatMap(group => group.ruleCoverage.filter(rule => rule.status === 'blocked')
    .map(rule => ({ file: group.file, path: rule.path, text: rule.title, status: 'blocked' })))
  const allCandidatesKnown = [...mechanismsWithCards.flatMap(row => row.candidatePrimitives),
    ...guides.groups.flatMap(group => group.ruleCoverage.flatMap(rule => rule.candidatePrimitives))]
    .every(id => lookup.get(id)?.type === 'primitive')
  for (const row of nextPhase) for (const file of row.readPoints) assert(existsSync(join(mod, file)), `Missing engine read point ${file}`)
  const gaps = nextPhase.filter(row => row.disposition !== 'reuse')
  return {
    schemaVersion: 1, cycle: 'fhv', campaignId: scope.campaignId, status: scope.status, scope: scopeFile, scopeSha256: sha(scopeText),
    counts: { cards: cards.length, ruleUnits: cards.reduce((total, card) => total + card.units.length, 0),
      mechanisms: mechanismsWithCards.length, byType: Object.fromEntries(types.map(type => [type, mechanismsWithCards.filter(row => row.type === type).length])),
      guides: guides.groups.filter(group => group.kind === 'scenario').length, files: scope.guides.english.length,
      guideLeaves: guides.groups.reduce((total, group) => total + group.sections.length, 0),
      codexGroups: guides.groups.reduce((total, group) => total + group.codex.filter(entry => entry.kind === 'entry').length, 0),
      codexLeaves: guides.groups.reduce((total, group) => total + group.codex.flatMap(entry => entry.paths).length, 0),
      primitiveGaps: gaps.length, blocked: unsupported.length + unknownGuideRules.length },
    mechanisms: mechanismsWithCards, cards, keyMechanisms, guides, backend: backend.anchors,
    primitiveQueue: nextPhase, primitiveGaps: gaps, unclassified, blocked: [...unsupported, ...unknownGuideRules],
    gates: { allCardsClassified: !unclassified.length, allCardsHaveBackendEvidence: cards.every(card => card.backend.length),
      sixTypesCovered: types.every(type => mechanismsWithCards.some(row => row.type === type)),
      allCandidatesKnown, allPrimitiveGapsQueued: gaps.every(row => row.gap && row.mechanisms.length > 0),
      noUnknownMechanisms: !(unsupported.length || unknownGuideRules.length),
      guidesComplete: guides.groups.filter(group => group.kind === 'scenario').length === scope.scenarios.length },
  }
}

function main(mode) {
  assert([undefined, '--write', '--check'].includes(mode), '用法：node tools/scan-fhv-mechanisms.mjs --write | --check')
  const scope = spawnSync(process.execPath, ['tools/scan-fhv-scope.mjs', '--check'], { cwd: mod, stdio: ['ignore', 'pipe', 'inherit'], encoding: 'utf8' })
  if (scope.error) throw scope.error
  assert.equal(scope.status, 0, 'FHV P0 scope 校验失败')
  const scan = buildScan()
  const output = json(scan)
  if (!mode) process.stdout.write(output)
  if (scan.blocked.length) {
    if (mode === '--write') {
      mkdirSync(run, { recursive: true })
      writeFileSync(join(run, 'mechanism-blocked.json'), json(scan.blocked))
    }
    for (const item of scan.blocked.slice(0, 30)) console.error(`${item.code || item.file}:${item.field || item.path}:${item.line || ''} ${item.text}`)
  }
  if (!scan.gates.allCardsHaveBackendEvidence) console.error('缺少参考实现锚点：', scan.cards.filter(card => !card.backend.length).map(card => card.code).join(', '))
  assert(Object.values(scan.gates).every(Boolean), `FHV P1 门禁失败：${Object.keys(scan.gates).filter(key => !scan.gates[key]).join(', ')}`)
  if (mode === '--write') {
    mkdirSync(run, { recursive: true })
    writeFileSync(target, output)
    writeFileSync(join(run, 'mechanism-scan.json'), output)
  } else if (mode === '--check') {
    assert(readFileSync(target, 'utf8').replaceAll('\r\n', '\n') === output, 'FHV 机制账本漂移，核对范围、卡面、指南和扫描词表后复算')
  }
  if (mode) console.log(`fhv mechanism scan ${mode}: ${scan.counts.cards} cards, ${scan.counts.mechanisms} mechanisms, ${scan.counts.primitiveGaps} P2 gaps, ${scan.counts.guideLeaves} guide leaves, ${scan.counts.blocked} blocked`)
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) main(process.argv[2])
