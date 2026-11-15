import assert from 'node:assert/strict'
import { chapterCandidates } from './fhv-mechanisms.mjs'

const preludeSections = {
  welcomeToHemlockVale: 'prelude1', dawnOfTheSecondDay: 'prelude2',
  dawnOfTheFinalDay: 'prelude3', preludeTheFinalEvening: 'prelude4',
}

const campaignRules = [
  ['additionalRulesAndClarifications.theCodex', ['campaign.codex', 'campaign.residents']],
  ['additionalRulesAndClarifications.threeDaysThreeNights', ['campaign.time', 'campaign.persist', 'campaign.deckProgression']],
  ['additionalRulesAndClarifications.residentsAndRelationshipLevels', ['campaign.residents']],
  ['additionalRulesAndClarifications.locationAdjacency', ['locations.grid']],
  ['newKeywords.body', ['enemies.alert', 'enemies.patrol', 'enemies.elusive', 'campaign.time']],
  ['fatigue', ['campaign.fatigue']],
]

const specialRules = [
  [/rail line|mine cart|sliding and swapping/i, ['scenario.rail', 'locations.grid']],
  [/enemy.locations/i, ['locations.enemyLocation', 'chaos.predationBag', 'locations.grid']],
  [/dark locations|double.sided enemies/i, ['campaign.time', 'cards.bondedFaces']],
  [/sinking locations/i, ['scenario.sinking']],
  [/darkness level/i, ['scenario.darkness', 'campaign.time']],
  [/location adjacency/i, ['locations.grid']],
  [/pursuit|enemy deck/i, ['scenario.specialZones']],
  [/barriers|decoys|traps/i, ['scenario.defenses', 'enemies.patrol']],
  [/codex/i, ['campaign.codex', 'campaign.residents']],
  [/three days|day .* and night/i, ['campaign.time', 'campaign.persist']],
  [/relationship levels/i, ['campaign.residents']],
  [/^alert$/i, ['enemies.alert']], [/^elusive$/i, ['enemies.elusive']], [/^patrol$/i, ['enemies.patrol']],
]

const scenarioRulePaths = {
  welcomeToHemlockVale: { playingPreludes: ['campaign.persist', 'combat.sourceFilter'] },
  writtenInRock: { theCaveIn: ['scenario.rail'], theMineCart: ['scenario.rail'], slidingAndSwappingLocations: ['locations.grid'] },
  hemlockHouse: { enemyLocations: ['locations.enemyLocation'], predationTest: ['chaos.predationBag'] },
  theSilentHeath: { 'setup.horrorsInTheRock': ['scenario.specialZones'], 'setup.desolationV2': ['campaign.time'] },
  theLostSister: { darkLocations: ['campaign.time'], doubleSidedEnemies: ['cards.bondedFaces'], 'setup.cavernsDeck': ['scenario.specialZones'] },
  theThingInTheDepths: { sinkingLocations: ['scenario.sinking'] },
  theTwistedHollow: { 'setup.woodsDeck': ['scenario.specialZones'], 'setup.darknessLevel': ['scenario.darkness'], poisonedMarsh: ['locations.grid'] },
  theLongestNight: { barriers: ['scenario.defenses'], decoys: ['scenario.defenses'], traps: ['scenario.defenses'], enemyDeckRules: ['scenario.specialZones'] },
  fateOfTheVale: { theAbyss: ['scenario.specialZones', 'scenario.fate'], cosmicEmissary: ['scenario.fate'], shatteredSelf: ['scenario.fate'] },
}

function leaves(value, key = '') {
  if (typeof value === 'string') return [{ key, text: value }]
  return Object.entries(value ?? {}).flatMap(([part, child]) => leaves(child, key ? `${key}.${part}` : part))
}
const inTree = (key, root) => key === root || key.startsWith(`${root}.`)

function codexGroups(id, sections, base) {
  const routes = {
    theta: /^theHemlockLegacy\d/, delta: /^bestFriends\d/, sigma: /^oldBlood\d/,
    omega: /^familyMatters(?:\.|$)/, gamma: /^theRabbit(?:\.|$)/, pi: /^friendlyStrangers$/,
  }
  const groups = Map.groupBy(sections.filter(({ key }) => {
    const local = base ? key.slice(base.length + 1) : key
    if (id === 'preludeTheFirstEvening') return Object.values(routes).some(pattern => pattern.test(local))
    if (id === 'preludeTheSecondEvening') return /^codex(?:\d+|Omega|Theta)(?:\.|$)/.test(local)
    // The four playable preludes and all eight chapters have a dedicated codex subtree.
    return /^codex\./.test(local)
  }), ({ key }) => {
    const local = base ? key.slice(base.length + 1) : key
    if (id === 'preludeTheFirstEvening') return Object.keys(routes).find(route => routes[route].test(local))
    return local.replace(/^codex\./, '').split('.')[0]
  })
  return [...groups].map(([entry, rows]) => ({ entry, kind: ['label', 'xp'].includes(entry) ? 'support' : 'entry', paths: rows.map(({ key }) => key) }))
}

export function inventoryGuides(scope, readReference, sha) {
  const sourceFiles = new Map(scope.guides.english.map(file => [file, JSON.parse(readReference(file))]))
  const base = scope.campaignFlow.guide
  const covered = new Set()
  const inventory = (id, file, prefix, kind, source, rules = []) => {
    const value = sourceFiles.get(file)
    const tree = prefix ? prefix.split('.').reduce((parent, key) => parent[key], value) : value
    const printed = (tree.specialRules || []).map(({ title }, index) => {
      const candidate = specialRules.find(([pattern]) => pattern.test(title))
      return { path: `${prefix ? `${prefix}.` : ''}specialRules.${index}`, title,
        candidatePrimitives: candidate?.[1] || [], status: candidate ? 'classified' : 'blocked' }
    })
    const requiredRules = rules.map(([path, candidatePrimitives]) => {
      assert(path.split('.').reduce((parent, key) => parent?.[key], tree), `Missing guide rule ${file}#${path}`)
      return { path: prefix ? `${prefix}.${path}` : path, candidatePrimitives, status: 'classified' }
    })
    const sections = leaves(tree, prefix).filter(({ key }) => kind !== 'campaign' || ![
      ...Object.values(preludeSections), 'prelude.theFirstEvening', 'prelude.theSecondEvening',
    ].some(root => inTree(key, root)))
    const codex = kind === 'campaign' ? [] : codexGroups(id, sections, prefix)
    const codexKeys = new Set(codex.flatMap(entry => entry.paths))
    const sectionRows = sections.map(({ key, text }) => {
      const qualified = `${file}#${key}`
      assert(!covered.has(qualified), `Guide text assigned twice: ${qualified}`)
      covered.add(qualified)
      const local = prefix ? key.slice(prefix.length + 1) : key
      const layer = codexKeys.has(key) ? 'codex'
        : /^intro(?:\.|$)|^(?:prologue|body|title)(?:\.|$)/.test(local) ? 'intro'
        : /^setup(?:\.|$)/.test(local) ? 'setup'
        : /^resolutions?\d*(?:\.|$)|^(?:xp|epilogue)(?:\.|$)/.test(local) ? 'resolution'
        : [...printed, ...requiredRules].some(rule => inTree(key, rule.path)) ? 'specialRules'
        : /^(?:tokens|label|tooltips|ui|headings)(?:\.|$)/.test(local) ? 'labelsAndSymbols' : 'branchesAndRules';
      return { key, layer, englishSha256: sha(text), chinese: 'pending-self-translation', translationKey: qualified }
    })
    if (kind === 'scenario') {
      assert(['intro', 'setup', 'resolution', 'codex'].every(layer => sectionRows.some(section => section.layer === layer)), `Incomplete guide ${id}`)
    }
    assert(kind === 'campaign' || codex.length > 0, `Missing Codex outline for ${id}`)
    return { id, kind, file, source, prefix: prefix || null, sections: sectionRows, codex, ruleCoverage: [...printed, ...requiredRules] }
  }
  const groups = [
    inventory('campaign', base, '', 'campaign', scope.campaignFlow.source, campaignRules),
    ...scope.scenarios.map(scenario => inventory(scenario.id, scenario.guide, preludeSections[scenario.id] || '', 'scenario', scenario.source,
      Object.entries(scenarioRulePaths[scenario.id] || {}))),
    ...scope.campaignFlow.narrativeOnlySteps.map(step => inventory(step.id, base, step.guideKey, 'interlude', scope.campaignFlow.source,
      step.id === 'preludeTheSecondEvening' ? [['resolution6', ['campaign.time', 'campaign.deckProgression']]] : [])),
  ]
  const expected = [...sourceFiles].flatMap(([file, value]) => leaves(value).map(({ key }) => `${file}#${key}`))
  assert.deepEqual([...covered].sort(), expected.sort(), 'English guide leaves have gaps')
  for (const group of groups.filter(group => group.kind === 'scenario')) assert(chapterCandidates[group.id])
  return {
    groups,
    translation: {
      upstreamChinese: scope.guides.upstreamChinese, language: 'zh-CN', attribution: '自译', directory: scope.guides.plannedChinese,
      registry: 'content/scenario-guide-translations.json', output: 'web/scenario-guides/<scenarioId>.json',
      batches: [
        { phase: 'P3', groups: ['campaign'], layers: ['specialRules', 'labelsAndSymbols'], remainingLayers: 'P7' },
        { phase: 'P7', groups: groups.map(group => group.id), layers: 'all remaining leaves',
          completion: '每个源键有中文、保留插值/标记并校验逐键覆盖；运行时只投影已到达的分支。' },
      ],
    },
  }
}
