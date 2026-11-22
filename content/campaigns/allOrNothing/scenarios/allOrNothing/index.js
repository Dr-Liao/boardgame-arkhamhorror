// 破釜沉舟（allOrNothing）· 章节装配。
import {
  scenario, identities, CARD_DATA, SCENARIO_TEXT, SCENARIO_ACT_TEXT, SCENARIO_AGENDA_TEXT,
  RESOLUTION_KEYS, ENCOUNTER_DECK, ENCOUNTER_DECK_CODES, ENCOUNTER_GROUPS, EXCLUDED_DECK_CODES,
  REMOVED_CODES, SET_ASIDE_CODES, LOCATIONS, LOCATION_COORDINATES, LOCATION_TABLE, LOCATION_IDS,
  START_LOCATION, ACT1_CODE, ACT2_CODE, AGENDA_CODE, SIOBHAN_CODE, BOUNCER_CODE, PIT_BOSS_CODE,
  KEY_INVESTIGATOR, TOKEN_MEANINGS, printed,
} from './definition.js'
import { behavior, scenarioSummary, findSkids, criminals, actTwoResources } from './behavior.js'
import { layout, CONNECTIONS } from './layout.js'
import { scenarioManifest } from '../../../../scenario-manifest.js'

export const implementedEncounterCodes = Object.freeze([
  '90011', '90012', '90013', '90014', '90015', '90016',
])

export const manifest = scenarioManifest(scenario, identities, {
  campaignId: 'allOrNothing',
  status: 'playable',
  layout,
  requiredPackIds: ['core', 'notz', 'dunwichCampaign', 'aonCampaign'],
  requiredEncounterGroupIds: [
    'allOrNothing', 'theHouseAlwaysWins', 'badLuck', 'naomisCrew', 'rats', 'arkham',
  ],
  requiredInvestigatorIds: [],
  requiredMechanicIds: [],
  recordReads: [],
  recordWrites: ['allOrNothingResolution', 'allOrNothingResourcesOnAct'],
  behaviorIds: [behavior.id],
})
manifest.contentVersion = '0.1.0'
manifest.referenceCode = '90011'
manifest.zones.removed = REMOVED_CODES.map(cardCode => ({ cardCode, count: 1 }))
// 放一边：3 张地点 + 西尔班 + 4 名保安（Setup 固定）。
manifest.zones.setAside = [
  ...[SET_ASIDE_CODES[0], SET_ASIDE_CODES[1], SET_ASIDE_CODES[2]].map(cardCode => ({ cardCode, count: 1 })),
  { cardCode: SIOBHAN_CODE, count: 1 },
  { cardCode: BOUNCER_CODE, count: 4 },
]
void LOCATION_TABLE
void printed
void EXCLUDED_DECK_CODES

export {
  scenario, identities, layout, behavior, CARD_DATA, SCENARIO_TEXT, SCENARIO_ACT_TEXT,
  SCENARIO_AGENDA_TEXT, RESOLUTION_KEYS, ENCOUNTER_DECK, ENCOUNTER_DECK_CODES, ENCOUNTER_GROUPS,
  REMOVED_CODES, SET_ASIDE_CODES, LOCATIONS, LOCATION_COORDINATES, LOCATION_IDS, START_LOCATION,
  ACT1_CODE, ACT2_CODE, AGENDA_CODE, SIOBHAN_CODE, BOUNCER_CODE, PIT_BOSS_CODE, KEY_INVESTIGATOR,
  TOKEN_MEANINGS, CONNECTIONS, scenarioSummary, findSkids, criminals, actTwoResources,
}

export default { scenario, identities, layout, behavior, manifest, CARD_DATA }
