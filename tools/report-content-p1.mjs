import { writeFile, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { contentRegistry } from '../content/registered.js'
import { scenarioZoneReport } from '../content/scenario-manifest.js'
import { sharedEncounterIdentities } from '../content/packs/shared-identities.js'

const target = fileURLToPath(new URL('../audit/p1-content-report.json', import.meta.url))
const report = {
  schemaVersion: 1,
  campaign: contentRegistry.getCampaign('nightOfTheZealot').id,
  packs: contentRegistry.listPacks().map(pack => ({
    id: pack.id, dependencies: pack.dependencies,
    cardCount: pack.cards.length, encounterGroupIds: pack.encounterGroupIds,
  })),
  scenarios: contentRegistry.listScenarios('nightOfTheZealot').map(manifest => ({
    id: manifest.id, status: manifest.status,
    requiredPackIds: manifest.requiredPackIds,
    requiredEncounterGroupIds: manifest.requiredEncounterGroupIds,
    requiredInvestigatorIds: manifest.requiredInvestigatorIds,
    requiredMechanicIds: manifest.requiredMechanicIds,
    zones: manifest.zones,
    conservation: scenarioZoneReport(contentRegistry.getScenarioData(manifest.id), manifest, sharedEncounterIdentities),
  })),
}
contentRegistry.assertLaunchable(report.campaign)
const serialized = JSON.stringify(report, null, 2) + '\n'
if (process.argv.includes('--check')) {
  if (await readFile(target, 'utf8') !== serialized) throw new Error('P1 依赖与区域守恒报告已漂移')
} else if (process.argv.includes('--write')) {
  await writeFile(target, serialized)
} else {
  console.log(serialized)
}
