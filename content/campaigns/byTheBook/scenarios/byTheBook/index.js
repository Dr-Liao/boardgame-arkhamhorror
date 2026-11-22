// 循规蹈矩（byTheBook）· 章节装配。
import {
  scenario, identities, CARD_DATA, SCENARIO_TEXT, SCENARIO_ACT_TEXT, SCENARIO_AGENDA_TEXT,
  RESOLUTION_KEYS, ENCOUNTER_DECK, ENCOUNTER_DECK_CODES, ENCOUNTER_GROUPS, EXCLUDED_DECK_CODES,
  REMOVED_CODES, CONSPIRATOR_CODES, LOCATIONS, LOCATION_COORDINATES, LOCATION_TABLE,
  VARIANT_LOCATION_TABLE, LOCATION_VARIANTS, PLACED_LOCATION_IDS, START_LOCATION, ACT_CODE,
  AGENDA1_CODE, AGENDA2_CODE, MR_GREY_CODE, POLICE_STATION_CODE, KEY_INVESTIGATOR, TOKEN_MEANINGS,
} from './definition.js'
import { behavior, scenarioSummary, findRoland, cultistsCaptured } from './behavior.js'
import { layout, CONNECTIONS } from './layout.js'
import { scenarioManifest } from '../../../../scenario-manifest.js'

export const implementedEncounterCodes = Object.freeze([
  '90032', '90033a', '90033b', '90034', '90035', '90036',
])

export const manifest = scenarioManifest(scenario, identities, {
  campaignId: 'byTheBook',
  status: 'playable',
  layout,
  requiredPackIds: ['core', 'notz', 'btbCampaign'],
  // core 包未声明 agentsOfShubNiggurath 组（01179/01180 直接按卡号引用），故不列入。
  requiredEncounterGroupIds: [
    'byTheBook', 'arkham', 'chillingCold', 'darkCult', 'nightgaunts', 'strikingFear', 'pentagram',
  ],
  requiredInvestigatorIds: [],
  requiredMechanicIds: [],
  recordReads: [],
  recordWrites: ['byTheBookResolution', 'byTheBookCultistsCaptured'],
  behaviorIds: [behavior.id],
})
manifest.contentVersion = '0.1.0'
manifest.referenceCode = '90032'
// 移除 Your House（01124）与两张 Mysterious Chanting（01171）。
manifest.zones.removed = REMOVED_CODES.map(cardCode => ({ cardCode, count: cardCode === '01171' ? 2 : 1 }))
manifest.zones.setAside = []

void ENCOUNTER_GROUPS
void EXCLUDED_DECK_CODES
void LOCATION_TABLE
void VARIANT_LOCATION_TABLE
void LOCATION_VARIANTS
void PLACED_LOCATION_IDS

export {
  scenario, identities, layout, behavior, CARD_DATA, SCENARIO_TEXT, SCENARIO_ACT_TEXT,
  SCENARIO_AGENDA_TEXT, RESOLUTION_KEYS, ENCOUNTER_DECK, ENCOUNTER_DECK_CODES, ENCOUNTER_GROUPS,
  REMOVED_CODES, CONSPIRATOR_CODES, LOCATIONS, LOCATION_COORDINATES, LOCATION_VARIANTS,
  PLACED_LOCATION_IDS, START_LOCATION, ACT_CODE, AGENDA1_CODE, AGENDA2_CODE, MR_GREY_CODE,
  POLICE_STATION_CODE, KEY_INVESTIGATOR, TOKEN_MEANINGS, CONNECTIONS, scenarioSummary,
  findRoland, cultistsCaptured,
}

export default { scenario, identities, layout, behavior, manifest, CARD_DATA }
