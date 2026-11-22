// 精益酒店谋杀案（murderAtTheExcelsiorHotel）· 章节装配。
//
// 引擎钩子契约见 behavior.js 文件头；真实引擎读点：startLocation / preScenarioSetup / setupLocations /
// locationPlaced / afterDeckSetup / actions + performAction / actReveal / agendaReveal /
// checkObjectives / enemyDefeated / resolveChaosToken / applyTokenEffect / tokenMeanings / resolution。
import {
  scenario, identities, CARD_DATA, SCENARIO_TEXT, LOCATIONS, LOCATION_TABLE, LOCATION_COORDINATES,
  SETUP_LOCATION_IDS, SET_ASIDE_LOCATION_IDS, ENCOUNTER_DECK, ENCOUNTER_DECK_CODES, ENCOUNTER_GROUPS,
  SET_ASIDE_CODES, SET_ASIDE_ALIASES, ACT_CODES, AGENDA1_CODE, AGENDA2_CODE, CULPRIT_CODES,
  ACT_STAGES, AGENDA_STAGES, CULPRIT_STAGES, ACTS, AGENDAS, STAGE_CARDS, RESOLUTION_KEYS, START_LOCATION,
  LEADS, LEAD_CODES, MINI_SET_ENEMIES, CULPRIT_TARGETS, DAGGER_CODE, MONROE_CODE,
  WHAT_HAVE_YOU_DONE_CODE, OFFICER_CODE,
} from './definition.js'
import { layout, CONNECTIONS } from './layout.js'
import { behavior, scenarioSummary, implementedEntryFlags } from './behavior.js'
import { scenarioManifest } from '../../../../scenario-manifest.js'

// 本关 51 张非玩家条目（84001 是提示卡本身，不建条目）。
export const implementedEncounterCodes = Object.freeze([
  '84002', '84003', '84004', '84005', '84006', '84007', '84008', '84009',
  '84010', '84011', '84012', '84013', '84014', '84015', '84016', '84017', '84018', '84019',
  '84020', '84021', '84022', '84023', '84024', '84025', '84026', '84027',
  '84028', '84029', '84030', '84031', '84032', '84033', '84034', '84035', '84036',
  '84037', '84038', '84039', '84040', '84041', '84042',
  '84043', '84044', '84045', '84046', '84047', '84048', '84049', '84050', '84051', '84052',
])
export const behaviorEntryCodes = Object.freeze([
  '84002', '84003', '84004', '84005', ...CULPRIT_CODES,
  '84028', '84031', '84034', '84037', '84040',
])

export const manifest = scenarioManifest(scenario, identities, {
  campaignId: 'murderAtTheExcelsiorHotel',
  status: 'playable',
  layout,
  requiredPackIds: ['core', 'hotelCampaign'],
  requiredEncounterGroupIds: [...ENCOUNTER_GROUPS],
  requiredInvestigatorIds: [],
  requiredMechanicIds: [],
  setAsideAliases: [...SET_ASIDE_ALIASES],
  recordReads: ['thePoliceAreOnYourSide'],
  recordWrites: [
    'theExcelsiorIsQuietForNow', 'theMurdersContinueUnsolved',
    'theInvestigatorsFledTheSceneOfTheCrime', 'theExcelsiorClaimsAnotherVictim',
    'theTrueCulpritWasIdentified', 'excelsiorReplays',
  ],
  behaviorIds: [behavior.id],
})
manifest.contentVersion = '0.1.0'
manifest.referenceCode = '84001'

export {
  scenario, identities, layout, behavior, CARD_DATA, SCENARIO_TEXT,
  LOCATIONS, LOCATION_TABLE, LOCATION_COORDINATES, CONNECTIONS,
  SETUP_LOCATION_IDS, SET_ASIDE_LOCATION_IDS, ENCOUNTER_DECK, ENCOUNTER_DECK_CODES, ENCOUNTER_GROUPS,
  SET_ASIDE_CODES, SET_ASIDE_ALIASES, ACT_CODES, AGENDA1_CODE, AGENDA2_CODE, CULPRIT_CODES,
  ACT_STAGES, AGENDA_STAGES, CULPRIT_STAGES, ACTS, AGENDAS, STAGE_CARDS, RESOLUTION_KEYS, START_LOCATION,
  LEADS, LEAD_CODES, MINI_SET_ENEMIES, CULPRIT_TARGETS, DAGGER_CODE, MONROE_CODE,
  WHAT_HAVE_YOU_DONE_CODE, OFFICER_CODE,
  scenarioSummary, implementedEntryFlags,
}

export default { scenario, identities, layout, behavior, manifest, CARD_DATA }
