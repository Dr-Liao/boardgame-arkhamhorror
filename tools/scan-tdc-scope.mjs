import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { ALL_CARDS } from '../src/cards/cards-data.js'

export const mod = fileURLToPath(new URL('../', import.meta.url))
export const referenceRoot = '参考资源/ArkhamHorror-main'
export const reference = join(mod, '../..', referenceRoot)
export const arkham = 'backend/arkham-api/library/Arkham'
export const guideRoot = 'frontend/src/locales/en/theDrownedCity'
export const campaignSource = `${arkham}/Campaign/Campaigns/TheDrownedCity.hs`
export const cardSource = 'frontend/public/cards_en.json'
export const ref = path => readFileSync(join(reference, path), 'utf8').replace(/^\uFEFF/, '')
export const refJson = path => JSON.parse(ref(path))
export const sha = bytes => createHash('sha256').update(bytes).digest('hex')
export const sorted = items => [...items].sort()
export const json = value => JSON.stringify(value, null, 2) + '\n'

const packCodes = ['tdcp', 'tdcc']
const difficulties = ['easy', 'standard', 'hard', 'expert']
const common = `${arkham}/Campaigns/TheDrownedCity`
const stepSource = `${common}/CampaignSteps.hs`
const bagSource = `${common}/ChaosBag.hs`
// Manual transcription from the rendered publisher guide, p. 3. The numeric
// and symbol counts are separate so a missing PDF text glyph cannot affect them.
export const printedBagSource = {
  url: 'https://hobbygames.ru/download/rules/uzhas-arkhema-zatonuvshij-gorod-kampanija-rules.pdf',
  page: 3, edition: 'ru', sha256: '5d1382eefd731f880e4f973f65e39f77d8f83ec40066ea72c70bd891d8f35b46',
}
const printedBagNumbers = {
  easy: '+1 +1 0 0 0 -1 -1 -1 -2 -2',
  standard: '+1 0 0 -1 -1 -1 -2 -2 -3 -4',
  hard: '0 0 0 -1 -1 -2 -2 -3 -3 -4 -5',
  expert: '0 -1 -1 -2 -2 -3 -3 -4 -4 -5 -6 -8',
}
const printedBagSymbols = ['skull', 'skull', 'tablet', 'elderThing', 'autoFail', 'elderSign']
const identities = 'frontend/src/arkham/data/theDrownedCity.json'
const cardFiles = ['cards_en', 'cards_zh-cn', 'cards_zh', 'cards'].map(name => `frontend/public/${name}.json`)
const externalGroups = {
  AgentsOfCthulhu: 'agents_of_cthulhu', AncientEvils: 'ancient_evils', ChillingCold: 'chilling_cold', DarkCult: 'pentagram',
  Ghouls: 'ghouls', LockedDoors: 'locked_doors', Nightgaunts: 'nightgaunts', Rats: 'rats', StrikingFear: 'striking_fear',
  TheMidnightMasks: 'arkham',
}
const internalGroups = {
  Flood: 'tdc_flood', Expedition: 'tdc_expedition', Rlyeh: 'rlyeh',
  TheDoomOfArkhamPartI: 'the_doom_of_arkham_part_1', TheDoomOfArkhamPartII: 'the_doom_of_arkham_part_2',
}
const snake = name => name.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase()
const tdcRows = cards => cards.filter(card => packCodes.includes(card.pack_code))
const symbols = ['skull', 'cultist', 'tablet', 'elder_thing']
const printFields = ['name', 'subname', 'type_code', 'faction_code', 'xp', 'cost', 'text', 'back_text', 'traits', 'slot',
  'health', 'sanity', 'enemy_fight', 'enemy_evade', 'shroud']
const printKey = card => JSON.stringify(printFields.map(field => {
  const value = card[field]
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : value ?? null
}))

export function writeOrCheck(path, value, mode) {
  assert(['--write', '--check'].includes(mode), '请传入 --write 或 --check')
  const file = join(mod, path)
  if (mode === '--write') writeFileSync(file, json(value))
  else assert.equal(sha(readFileSync(file, 'utf8').replaceAll('\r\n', '\n')), sha(json(value)), `${path} 账本漂移`)
}

function initialBags() {
  const tokens = {
    PlusOne: '+1', Zero: '0', MinusOne: '-1', MinusTwo: '-2', MinusThree: '-3', MinusFour: '-4',
    MinusFive: '-5', MinusSix: '-6', MinusEight: '-8', Skull: 'skull', Tablet: 'tablet',
    ElderThing: 'elderThing', AutoFail: 'autoFail', ElderSign: 'elderSign',
  }
  const rows = [...ref(bagSource).matchAll(/(Easy|Standard|Hard|Expert)\s*->\s*\[([^\]]+)\]/g)]
  assert.deepEqual(rows.map(row => row[1].toLowerCase()), difficulties)
  const bags = Object.fromEntries(rows.map(([, level, bag]) => [level.toLowerCase(), bag.split(',').map(value => {
    const token = tokens[value.trim()]
    assert(token, `未知混乱标记 ${value}`)
    return token
  })]))
  for (const level of difficulties) {
    const printed = [...printedBagNumbers[level].split(' '), ...printedBagSymbols]
    assert.deepEqual(sorted(bags[level]), sorted(printed), `${level} 初始袋与发行商印刷指南不一致`)
  }
  return bags
}

function lockSymbols(card) {
  return Object.fromEntries(difficulties.map((level, index) => {
    const field = index < 2 ? 'text' : 'back_text'
    const text = card[field]
    assert.match(text, index < 2 ? /^Easy \/ Standard/ : /^Hard \/ Expert/)
    const lines = [...text.matchAll(/^\[(skull|cultist|tablet|elder_thing)\]:\s*(.+)$/gm)]
    const printed = card.code === '11501' ? symbols.filter(symbol => symbol !== 'cultist') : symbols
    assert.deepEqual(sorted(lines.map(line => line[1])), sorted(printed), card.code)
    return [level, { field, effects: Object.fromEntries(lines.map(([, symbol, effect]) => [symbol, sha(effect.trim())])) }]
  }))
}

function gatherGroups(file, cards, groupCodes) {
  const source = ref(file)
  const groups = source.split(/\r?\n/).flatMap((text, index) => {
    if (text.trimStart().startsWith('--')) return []
    return [...text.matchAll(/\b(gather|gatherJust|gatherJustMatching) Set\.(\w+)/g)].map((match, call) => {
      const [invocation, action, set] = match
      const prefix = text.slice(0, match.index).trim()
      const suffix = text.slice(match.index + invocation.length)
      const condition = call ? `else: ${prefix.split(' then ')[0]}` : prefix
      const group = externalGroups[set] || internalGroups[set] || snake(set)
      const candidates = groupCodes.get(group)
      assert(candidates?.length, `${file} 的遭遇组 ${set} 缺少卡号`)
      let codes = candidates
      if (set === 'TheMidnightMasks') {
        codes = candidates.filter(code => cards.get(code).type_code === 'location'
          || (action === 'gather' && cards.get(code).type_code === 'treachery'))
      } else if (action === 'gatherJust') {
        assert.match(suffix, /Enemies\.infectedStarSpawn/)
        codes = candidates.filter(code => cards.get(code).name === 'Infected Star Spawn')
        assert.equal(codes.length, 1)
      }
      return { action, set, group, external: Object.hasOwn(externalGroups, set), codes,
        ...(condition ? { condition } : {}), line: index + 1 }
    })
  })
  if (file.endsWith('/OneLastJob.hs')) {
    const candidates = groupCodes.get('arkham').filter(code => cards.get(code).type_code === 'location')
    const placed = {
      northside: '01134', downtownFirstBankOfArkham: '01130', easttown: '01132', rivertown: '01125', miskatonicUniversity: '01129',
    }
    for (const [binding, code] of Object.entries(placed)) assert(source.includes(`Locations.${binding}`) && candidates.includes(code))
    groups.push({ action: 'explicitPlacement', set: 'TheMidnightMasks', group: 'arkham', external: true,
      codes: sorted(Object.values(placed)), candidates, guideDifference: '指南随机选 Downtown，参考后端固定其中一面；其余未用地点在设置中移除。' })
  }
  return groups
}

export function buildScope() {
  const english = refJson(cardSource)
  const all = new Map(english.map(card => [card.code, card]))
  const rows = tdcRows(english).sort((a, b) => a.code.localeCompare(b.code, 'en'))
  const codes = rows.map(card => card.code)
  assert.equal(new Set(codes).size, rows.length)
  const normalized = sorted(Object.entries(ALL_CARDS).filter(([, card]) => packCodes.includes(card.pack)).map(([code]) => code))
  assert.deepEqual(normalized, codes, '本地卡表范围漂移')
  assert(codes.every(code => ALL_CARDS[code].availability === 'catalog-only'), '本地卡表开放状态漂移')
  const cardTables = Object.fromEntries(cardFiles.map(file => {
    const localized = new Map(tdcRows(refJson(file)).map(card => [card.code, card]))
    const missingCodes = codes.filter(code => !localized.has(code))
    assert([...localized.keys()].every(code => codes.includes(code)), file)
    const missingText = rows.flatMap(card => ['text', 'back_text', 'customization_text', 'customization_change']
      .filter(field => card[field] && !localized.get(card.code)?.[field] && localized.has(card.code))
      .map(field => ({ code: card.code, field })))
    return [file, { counts: Object.fromEntries(packCodes.map(pack => [pack, [...localized.values()].filter(card => card.pack_code === pack).length])),
      missingCodes, missingText,
      englishFallback: rows.filter(card => file.includes('_zh') && card.text && localized.get(card.code)?.text === card.text).map(card => card.code) }]
  }))
  const investigatorDependencies = Object.fromEntries(rows.filter(card => card.type_code === 'investigator' && !card.linked_to_code && card.deck_requirements?.card)
    .map(card => [card.code, Object.values(card.deck_requirements.card).map(alts => sorted(Object.keys(alts)))]))
  const signatures = new Set(Object.values(investigatorDependencies).flat(2))
  const partitions = { investigators: [], signatures: [], player: [], basicWeaknesses: [], scenarios: [], shared: [], references: [] }
  const steps = [...ref(stepSource).matchAll(/^pattern (\w+) <- ScenarioStep "(\d{5}[a-z]?)"/gm)]
  const ids = refJson(identities)
  assert.deepEqual(steps.map(step => step[2]), ids.map(id => id.id))
  assert(ids.every(id => id.campaign === '11'))
  const groupCodes = new Map([...Map.groupBy(english.filter(card => card.encounter_code && ['core', 'tdcc'].includes(card.pack_code)), card => card.encounter_code)]
    .map(([group, cards]) => [group, sorted(new Set(cards.map(card => card.code)))]))
  const scenarios = steps.map(([, name, code]) => {
    const id = name[0].toLowerCase() + name.slice(1)
    const guide = `${guideRoot}/${id}.json`
    const file = `${arkham}/Scenario/Scenarios/TheDrownedCity/${name}.hs`
    const card = all.get(code)
    assert.equal(card?.type_code, 'scenario', code)
    return { id, code, group: card.encounter_code, file, guide, chaosSymbols: lockSymbols(card), gather: gatherGroups(file, all, groupCodes) }
  })
  assert.deepEqual(sorted(scenarios.map(row => row.code)), rows.filter(card => card.type_code === 'scenario').map(card => card.code))
  const chapterGroups = new Set(scenarios.map(row => row.group))
  for (const card of rows) {
    const owner = Object.hasOwn(investigatorDependencies, card.code) ? 'investigators'
      : signatures.has(card.code) ? 'signatures'
        : card.subtype_code === 'basicweakness' ? 'basicWeaknesses'
          : card.pack_code === 'tdcp' ? 'player'
            : card.type_code === 'scenario' ? 'references'
              : chapterGroups.has(card.encounter_code) ? 'scenarios' : 'shared'
    partitions[owner].push(card.code)
  }
  assert.deepEqual(sorted(Object.values(partitions).flat()), codes)
  const linkedFaces = rows.filter(card => card.linked_card).map(card => {
    const back = all.get(card.linked_card.code)
    assert.equal(back?.pack_code, card.pack_code, card.code)
    return [card.code, back.code]
  })
  const linkedBacks = new Set(linkedFaces.map(([, back]) => back))
  const positions = Map.groupBy(codes, code => code.slice(0, 5))
  const explicitReprints = Object.fromEntries(english.flatMap(card => [
    ...(card.duplicate_of_code ? [[card.code, card.duplicate_of_code]] : []),
    ...(card.duplicated_by || []).map(code => [code, card.code]),
  ]).filter(([code, parent]) => codes.includes(code) || codes.includes(parent)))
  const printedMatches = Map.groupBy(english, printKey)
  const reprintCandidates = rows.flatMap(card => {
    const candidates = printedMatches.get(printKey(card)).filter(other => other.pack_code !== card.pack_code)
    return candidates.length ? [{ code: card.code, matches: sorted(candidates.map(other => other.code)),
      differingDeckRequirements: candidates.some(other => JSON.stringify(other.deck_requirements) !== JSON.stringify(card.deck_requirements)) }] : []
  })
  const crossPackInvestigatorCodes = sorted(new Set(['98019', ...[...signatures].filter(code => !codes.includes(code))]))
  for (const code of crossPackInvestigatorCodes) assert(all.has(code) && ALL_CARDS[code], code)
  const behaviorCandidates = codes.filter(code => !partitions.references.includes(code) && !Object.hasOwn(explicitReprints, code))

  const hsPaths = readdirSync(join(reference, arkham), { recursive: true })
    .map(path => path.replaceAll('\\', '/')).filter(path => path.endsWith('.hs'))
  const sources = new Set([...cardFiles, identities, ...readdirSync(join(reference, guideRoot)).map(file => `${guideRoot}/${file}`)])
  const modulesByName = Map.groupBy(hsPaths, path => path.split('/').at(-1).slice(0, -3).toLowerCase())
  const behaviorSources = {}
  const outsideCodes = new Set([...crossPackInvestigatorCodes,
    ...reprintCandidates.flatMap(entry => entry.matches),
    ...scenarios.flatMap(row => row.gather.filter(group => group.external).flatMap(group => group.candidates || group.codes))])
  for (const code of outsideCodes) assert(ALL_CARDS[code], `本地缺少范围外依赖 ${code}`)
  const wanted = new Set([...codes, ...outsideCodes])
  for (const path of hsPaths) {
    const file = `${arkham}/${path}`
    const inCampaign = /(?:^|\/)TheDrownedCity(?:\/|\.hs$)/.test(path)
    if (inCampaign) sources.add(file)
    if (!inCampaign && !/\/CardDefs\/|\/Cards\.hs$/.test(path)) continue
    const source = ref(file)
    const definitions = [...source.matchAll(/^(\w+)\s*::\s*([^=\n]+)$/gm)]
    for (const [index, definition] of definitions.entries()) {
      const [, name, signature] = definition
      if (!/^CardDef\b/.test(signature)) continue
      const body = source.slice(definition.index, definitions[index + 1]?.index ?? source.length)
      const hits = new Set([...body.matchAll(/"(\d{5}[a-z]?)"/g)].map(([, code]) => code).filter(code => wanted.has(code)))
      if (!hits.size) continue
      const implementations = (modulesByName.get(name.toLowerCase()) || []).map(module => `${arkham}/${module}`)
      sources.add(file)
      implementations.forEach(module => sources.add(module))
      for (const code of hits) {
        const list = behaviorSources[code] ||= []
        list.push({ definition: file, binding: name, implementations })
      }
    }
  }
  const locked = Object.fromEntries(sorted(sources).map(path => {
    const bytes = readFileSync(join(reference, path))
    return [path, { sha256: sha(bytes), bytes: bytes.length }]
  }))
  const counts = {
    records: rows.length,
    numberedPositions: positions.size,
    printedCardCopies: rows.filter(card => !linkedBacks.has(card.code)).reduce((sum, card) => sum + (card.quantity || 0), 0),
    potentialBehaviorCodes: behaviorCandidates.length,
    partitions: Object.fromEntries(Object.entries(partitions).map(([owner, owned]) => [owner, owned.length])),
  }
  return {
    schemaVersion: 1, campaignId: 'theDrownedCity', status: 'catalog-only', sourceCampaignId: '11', referenceRoot,
    counts, codes, partitions, behaviorCandidates, cardTables, investigatorDependencies, crossPackInvestigatorCodes, explicitReprints, reprintCandidates, linkedFaces,
    embeddedBacks: rows.filter(card => card.double_sided && !card.linked_card).map(card => card.code),
    multiRecordPositions: Object.fromEntries([...positions].filter(([, entries]) => entries.length > 1)),
    cards: Object.fromEntries(rows.map(card => [card.code, { pack: card.pack_code, type: card.type_code, quantity: card.quantity ?? null,
      group: card.encounter_code ?? null, availability: 'catalog-only', behaviorSources: behaviorSources[card.code] || [] }])),
    scenarios, externalEncounterDependencies: sorted(outsideCodes).filter(code => !crossPackInvestigatorCodes.includes(code)),
    campaignSource, stepSource, bagSource, initialBags: initialBags(), printedBagSource,
    guides: { english: sorted([...sources].filter(path => path.startsWith(guideRoot) && path.endsWith('.json'))),
      chineseUpstream: ['zh', 'zh-CN'].filter(language => existsSync(join(reference, `frontend/src/locales/${language}/theDrownedCity`))) },
    sources: locked,
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const scope = buildScope()
  if (process.argv[2] === '--check') {
    const saved = JSON.parse(readFileSync(join(mod, 'audit/tdc-scope.json'), 'utf8'))
    const files = sorted(new Set([...Object.keys(saved.sources), ...Object.keys(scope.sources)]))
    const changed = files.filter(file => saved.sources[file]?.sha256 !== scope.sources[file]?.sha256)
    assert.equal(changed.length, 0, `TDC 来源漂移\n${changed.join('\n')}`)
  }
  writeOrCheck('audit/tdc-scope.json', scope, process.argv[2])
  console.log(`TDC P0 ${process.argv[2]} · ${scope.counts.records} 条卡表记录 · ${scope.scenarios.length} 张提示卡 · ${Object.keys(scope.sources).length} 个来源`)
}
