// 血海深仇（badBlood）· 章节装配。
import {
  scenario, identities, CARD_DATA, SCENARIO_TEXT, SCENARIO_ACT_TEXT, SCENARIO_AGENDA_TEXT,
  RESOLUTION_KEYS, ENCOUNTER_DECK, ENCOUNTER_DECK_CODES, ENCOUNTER_GROUPS, REMOVED_CODES,
  LOCATIONS, ALL_LOCATIONS, RANDOM_LOCATIONS, RANDOM_LOCATION_TABLE, RANDOM_LOCATION_IDS,
  FIXED_LOCATION_IDS, LOCATION_COORDINATES, START_LOCATION, ACT_CODE, AGENDA_CODE,
  ELSPETH_CODE, ELSPETH_BACK_CODE, KEY_INVESTIGATOR, TOKEN_MEANINGS, MONSTROUS_MEMORY_LOCATIONS,
} from './definition.js'
import { behavior, scenarioSummary, findAgnes, findElspeth } from './behavior.js'
import { layout, CONNECTIONS } from './layout.js'
import { scenarioManifest } from '../../../../scenario-manifest.js'

export const implementedEncounterCodes = Object.freeze([
  '90020', '90021', '90022', '90023', '90023b',
])

export const manifest = scenarioManifest(scenario, identities, {
  campaignId: 'badBlood',
  status: 'playable',
  layout,
  requiredPackIds: ['core', 'notz', 'tfaCampaign', 'badCampaign'],
  requiredEncounterGroupIds: [
    'badBlood', 'threadsOfFate', 'pnakoticBrotherhood', 'lockedDoors', 'nightgaunts', 'darkCult', 'arkham',
  ],
  requiredInvestigatorIds: [],
  requiredMechanicIds: [],
  recordReads: [],
  recordWrites: ['badBloodResolution', 'badBloodAgnesMemories', 'badBloodElspethMemories'],
  behaviorIds: [behavior.id],
})
manifest.contentVersion = '0.1.0'
manifest.referenceCode = '90020'
manifest.zones.removed = REMOVED_CODES.map(cardCode => ({ cardCode, count: 1 }))
// 四张随机地点是「放一边/移出」的候选，不写进 zones；按 Setup 随机放 1 张。
manifest.zones.setAside = []

void LOCATIONS
void MONSTROUS_MEMORY_LOCATIONS

export {
  scenario, identities, layout, behavior, CARD_DATA, SCENARIO_TEXT, SCENARIO_ACT_TEXT,
  SCENARIO_AGENDA_TEXT, RESOLUTION_KEYS, ENCOUNTER_DECK, ENCOUNTER_DECK_CODES, ENCOUNTER_GROUPS,
  REMOVED_CODES, LOCATIONS, ALL_LOCATIONS, RANDOM_LOCATIONS, RANDOM_LOCATION_TABLE,
  RANDOM_LOCATION_IDS, FIXED_LOCATION_IDS, LOCATION_COORDINATES, START_LOCATION,
  ACT_CODE, AGENDA_CODE, ELSPETH_CODE, ELSPETH_BACK_CODE, KEY_INVESTIGATOR, TOKEN_MEANINGS,
  CONNECTIONS, scenarioSummary, findAgnes, findElspeth,
}

export default { scenario, identities, layout, behavior, manifest, CARD_DATA }
