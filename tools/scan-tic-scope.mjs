import { join } from 'node:path'
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { CARD_PARTITIONS, CYCLE_CODES, CHAOS_BAGS, chapters, ENCOUNTER_GROUPS, INVESTIGATOR_CODES } from '../content/campaigns/theInnsmouthConspiracy/shared.js'
import { MOD, REFERENCE, emit, readJson, referenceFiles, sourceLock } from './tic-migration-lib.mjs'

export function buildScope() {
  const locks = referenceFiles().map(path => sourceLock(path))
  const sourceIds = readJson(join(REFERENCE, 'frontend/src/arkham/data/theInnsmouthConspiracy.json'))
  const normalized = value => typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : value ?? null
  const identityFields = ['name', 'type', 'subname', 'xp', 'cost', 'text', 'backText', 'icons', 'traits', 'slot',
    'willpower', 'intellect', 'combat', 'agility', 'health', 'sanity', 'fight', 'evade', 'damage', 'horror', 'shroud']
  const identityKey = card => JSON.stringify(identityFields.map(field => normalized(card[field])))
  const identities = new Map()
  for (const card of Object.values(ALL_CARDS)) {
    const key = identityKey(card); const codes = identities.get(key) || []; codes.push(card.code); identities.set(key, codes)
  }
  const reprintGroups = [...identities.values()].filter(codes => codes.some(code => CYCLE_CODES.includes(code)) && codes.length > 1)
    .map(values => {
      const codes = values.sort()
      return { canonicalCode: codes[0], codes, basis: 'identical-printed-behavior-stable-code-order',
        aliasRegistration: 'P5–P6；本次只锁定映射，不新建行为或别名实现' }
    }).sort((a, b) => a.canonicalCode.localeCompare(b.canonicalCode))
  const cards = CYCLE_CODES.map(code => {
    const card = ALL_CARDS[code]
    const owner = Object.keys(CARD_PARTITIONS).find(pack => CARD_PARTITIONS[pack].includes(code))
    return { code, name: card.name, type: card.type, pack: card.pack, owner, encounterCode: card.encounterCode || null,
      face: /[a-z]$/.test(code), duplicateOfCode: card.duplicateOfCode || null, duplicatedBy: card.duplicatedBy || [],
      linked: [card.linkedToCode, card.linkedCode].filter(Boolean),
      canonicalCode: reprintGroups.find(group => group.codes.includes(code))?.canonicalCode || card.duplicateOfCode || code,
      sourceCard: `frontend/public/cards.json#${code}`, text: card.text || '', backText: card.backText || '' }
  })
  const gather = Object.fromEntries(chapters.map(chapter => {
    const file = `backend/arkham-api/library/Arkham/Scenario/Scenarios/TheInnsmouthConspiracy/${chapter.id[0].toUpperCase() + chapter.id.slice(1)}.hs`
    const text = readFileSync(join(REFERENCE, file), 'utf8')
    return [chapter.id, { source: file, sets: [...new Set([...text.matchAll(/gather(?:AndSetAside)? Set\.(\w+)/g)].map(m => m[1]))].sort() }]
  }))
  const ownSets = new Set(ENCOUNTER_GROUPS.map(group => group.split('_').map(word => word[0].toUpperCase() + word.slice(1)).join('')))
  const externalDependencies = [...new Set(Object.values(gather).flatMap(row => row.sets).filter(set => !ownSets.has(set)))].sort().map(set => ({
    set, codes: Object.values(ALL_CARDS).filter(card => !CYCLE_CODES.includes(card.code)
      && card.encounterName?.replace(/[^a-z]/gi, '').toLowerCase() === set.toLowerCase()).map(card => card.code).sort(),
    usedBy: chapters.filter(ch => gather[ch.id].sets.includes(set)).map(ch => ch.id),
  }))
  const groups = ENCOUNTER_GROUPS.map(id => ({ id, chapterId: chapters.find(ch => ch.encounterCode === id)?.id || null,
    codes: cards.filter(card => card.encounterCode === id).map(card => card.code) }))
  const shards = Object.entries(CARD_PARTITIONS).flatMap(([pack, codes]) => {
    const subsets = pack === 'ticCampaign' ? groups.map(g => ({ id: g.id, codes: g.codes })) : [{ id: pack, codes }]
    return subsets.flatMap(group => Array.from({ length: Math.ceil(group.codes.length / 35) }, (_, n) => ({
      id: `${group.id}-${n + 1}`, pack, codes: group.codes.slice(n * 35, (n + 1) * 35) })))
  })
  const flat = shards.flatMap(shard => shard.codes)
  const sourceTokens = readFileSync(join(REFERENCE, 'backend/arkham-api/library/Arkham/Campaigns/TheInnsmouthConspiracy/ChaosBag.hs'), 'utf8')
  const tokenNames = { PlusOne: '+1', Zero: '0', MinusOne: '-1', MinusTwo: '-2', MinusThree: '-3', MinusFour: '-4', MinusFive: '-5', MinusSix: '-6', MinusEight: '-8', Skull: 'skull', Cultist: 'cultist', Tablet: 'tablet', ElderThing: 'elderthing', AutoFail: 'autofail', ElderSign: 'eldersign' }
  const parsedBags = Object.fromEntries([...sourceTokens.matchAll(/(Easy|Standard|Hard|Expert)\s*->\s*\[([^\]]+)\]/g)].map(m => [m[1].toLowerCase(), m[2].split(',').map(t => tokenNames[t.trim()])]))
  return { schemaVersion: 1, cycle: 'tic', campaignId: 'theInnsmouthConspiracy', status: 'catalog-only',
    sourceRoot: '参考资源/ArkhamHorror-main', sources: locks, cards, partitions: CARD_PARTITIONS, groups, shards,
    investigators: INVESTIGATOR_CODES, chapters: chapters.map(ch => ({ ...ch, gather: gather[ch.id],
      chaosReference: { easyStandard: ALL_CARDS[ch.code].text, hardExpert: ALL_CARDS[ch.code].backText },
      guideSources: ['en', 'zh'].map(lang => `frontend/src/locales/${lang}/theInnsmouthConspiracy/scenarios/${ch.id}.json`) })),
    externalDependencies, reprintGroups, chaosBags: CHAOS_BAGS,
    imagePolicy: { english: 'web/img/cards/', chinese: 'web/img/zh/cards/', remoteFallback: ['imagesrc', 'backimagesrc'], cycleCopies: false },
    baseline: readJson(join(MOD, 'audit/tic-baseline.json')),
    gates: { allCardsPartitioned: cards.every(c => c.owner), noOverlap: flat.length === new Set(flat).size,
      unionConserved: flat.length === CYCLE_CODES.length && CYCLE_CODES.every(c => flat.includes(c)),
      scenarioIdentities: chapters.every((ch, i) => ch.code === sourceIds[i].id && ALL_CARDS[ch.code].type === 'scenario'),
      initialChaosBagsMatchSource: JSON.stringify(parsedBags) === JSON.stringify(CHAOS_BAGS),
      sourcesPresent: locks.length > 0 && locks.every(lock => lock.bytes > 0),
      crossCycleGroupsResolved: externalDependencies.every(group => group.codes.length > 0),
    } }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) emit('scope', buildScope())
