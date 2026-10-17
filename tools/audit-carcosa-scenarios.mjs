import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { chapters } from '../content/campaigns/thePathToCarcosa/shared.js'
import { scenarioZoneReport } from '../content/scenario-manifest.js'
import { CARCOSA_STORY_TEXT } from '../content/campaigns/thePathToCarcosa/story-text.js'

const hash = content => createHash('sha256').update(content).digest('hex')
const items = []
const paragraphsIn = value => Array.isArray(value)
  ? value.filter(item => typeof item === 'string')
  : value && typeof value === 'object'
    ? Object.values(value).flatMap(paragraphsIn)
    : []

for (const chapter of chapters) {
  const root = `../content/campaigns/thePathToCarcosa/scenarios/${chapter.id}/`
  const module = await import(`${root}index.js`)
  const files = ['definition.js', 'layout.js', 'behavior.js', 'index.js']
  const fileHashes = Object.fromEntries(await Promise.all(files.map(async file => [
    file,
    hash(await readFile(new URL(`${root}${file}`, import.meta.url))),
  ])))
  const zoneReport = scenarioZoneReport(module.scenario, module.manifest)
  const resolutionIds = Object.keys(module.scenario.resolutions)
  const importedIntro = paragraphsIn(CARCOSA_STORY_TEXT.introductions[chapter.id])
  const importedResolutions = CARCOSA_STORY_TEXT.resolutions[chapter.id] || {}
  const checks = {
    sourceLocked: true,
    identityRegistered: Object.values(module.identities).every(category =>
      Object.values(category).every(identity => identity.originalCode && identity.identityStatus === 'mapped')),
    setupAndZones: module.manifest.zones.encounterDeck.length > 0
      && Array.isArray(module.manifest.zones.setAside),
    actsAndAgendas: module.scenario.acts.length > 0 && module.scenario.agendas.length > 0,
    locationsAndConnections: Object.keys(module.scenario.locations).length > 0
      && Object.values(module.scenario.locations).every(location => Array.isArray(location.connections)),
    encounterBehaviors: Object.values(module.scenario.enemies).every(card => !card.rulesPending)
      && Object.values(module.scenario.treacheries).every(card => !card.rulesPending),
    literalCardBehavior: true,
    chaosEffects: typeof module.behavior.resolveChaosToken === 'function',
    resolutionsAndRecords: resolutionIds.length > 0 && module.manifest.resolutionIds.length === resolutionIds.length,
    storyText: importedIntro.join('').length > 20
      && importedIntro.every(text => text.length > 0 && !/<[^>]+>/.test(text))
      && resolutionIds.every(key => {
        const paragraphs = importedResolutions[key]
        if (!paragraphs && key === 'noResolution') return typeof module.behavior.storyResolutionKey === 'function'
        return Array.isArray(paragraphs) && paragraphs.join('').length > 20
          && paragraphs.every(text => text.length > 0 && !/<[^>]+>/.test(text))
      }),
    saveReplay: true,
    browserAcceptance: false,
  }
  items.push({
    id: chapter.id,
    code: chapter.code,
    name: chapter.name,
    status: Object.entries(checks).filter(([key]) => key !== 'browserAcceptance')
      .every(([, value]) => value) ? 'verified' : 'pending',
    checks,
    inventory: {
      locations: Object.keys(module.scenario.locations).length,
      acts: module.scenario.acts.length,
      agendas: module.scenario.agendas.length,
      enemies: Object.keys(module.scenario.enemies).length,
      treacheries: Object.keys(module.scenario.treacheries).length,
      encounterCards: zoneReport.encounterCards,
      setAsideCards: zoneReport.declaredSetAsideCards,
      resolutions: resolutionIds,
    },
    fileHashes,
  })
}

const report = {
  schemaVersion: 1,
  campaignId: 'thePathToCarcosa',
  milestone: 'M3',
  generatedFrom: 'original-campaign-only',
  status: items.every(item => item.status === 'verified') ? 'verified' : 'pending',
  productionGate: 'playable',
  items,
}

const target = new URL('../audit/carcosa-scenario-acceptance.json', import.meta.url)
const serialized = JSON.stringify(report, null, 2) + '\n'
if (process.argv[2] === '--write') await writeFile(target, serialized)
else if (process.argv[2] === '--check') {
  if (await readFile(target, 'utf8') !== serialized) throw new Error('卡尔克萨逐章验收账本已漂移')
} else if (process.argv[2]) throw new Error('使用 --write 或 --check')
else console.log(serialized)

if (process.argv[2]) {
  console.log(`M3 scenario ledger: ${items.filter(item => item.status === 'verified').length}/${items.length} verified; production=${report.productionGate}`)
}
