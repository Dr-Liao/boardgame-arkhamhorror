// 重返聚集于此（returnToTheGathering · 50011）· 章节装配。
//
// 引擎钩子契约见 behavior.js 文件头；注册期契约见 content/schema.js 与 content/scenario-manifest.js。
// 本文件只导出章节数据/行为/manifest；content/registered.js 的注册由主进程统一完成。
import {
  scenario, identities, CARD_DATA, SCENARIO_TEXT, SCENARIO_ACT_TEXT, RESOLUTION_KEYS,
  ENCOUNTER_DECK, ENCOUNTER_DECK_CODES, ENCOUNTER_GROUP_IDS, LOCATIONS, LOCATION_TABLE,
  LOCATION_COORDINATES, LOCATION_IDS, START_LOCATION, SETUP_LOCATION_IDS, SET_ASIDE_LOCATION_IDS,
  SET_ASIDE_CODES, REMOVED_CARD_CODES, ACT_CODES, ACT1_CODE, ACT2_CODE, ACT3_CODE,
  AGENDA_CODES, AGENDA1_CODE, AGENDA2_CODE, AGENDA3_CODE, ACT_STAGES, AGENDA_STAGES, ACTS, AGENDAS,
  STAGE_CARDS, GUEST_HALL,
} from './definition.js'
import { layout, CONNECTIONS } from './layout.js'
import { behavior, scenarioSummary, implementedEntryFlags, currentActCode, currentAgendaCode } from './behavior.js'
import { scenarioManifest } from '../../../../scenario-manifest.js'
import { sharedEncounterIdentities } from '../../../../packs/shared-identities.js'

// 本章有规则读点的 50xxx 卡条目（地点揭示 50017–50021、诡计显现 50024/50040）。
export const implementedEncounterCodes = Object.freeze([
  '50017', '50018', '50019', '50020', '50021', '50024', '50040',
])

export const manifest = scenarioManifest(scenario, identities, {
  campaignId: 'returnToNightOfTheZealot',
  status: 'playable',
  layout,
  sharedIdentities: sharedEncounterIdentities,
  requiredPackIds: ['core', 'notz', 'rtnotzCampaign'],
  requiredEncounterGroupIds: [
    'returnToTheGathering', 'theGathering', 'rats', 'ghoulsOfUmordhoth',
    'strikingFear', 'ancientEvils', 'chillingCold',
  ],
  requiredInvestigatorIds: [],
  requiredMechanicIds: [],
  setAsideLocations: [...SET_ASIDE_LOCATION_IDS],
  setAsideAliases: [...SET_ASIDE_CODES],
  recordReads: [],
  recordWrites: ['houseBurned', 'ghoulPriestAlive', 'litaOwner', 'litaForcedOthers'],
  behaviorIds: [behavior.id],
})
manifest.contentVersion = '0.1.0'
manifest.referenceCode = '50011'
manifest.zones.removed = REMOVED_CARD_CODES.map(cardCode => ({ cardCode, count: 1 }))
manifest.actVariants = Object.freeze({ default: [...ACT_CODES], alternate: [], randomChoice: false })
manifest.requiredEncounterGroupWarnings = Object.freeze([])

export {
  scenario, identities, layout, behavior, CARD_DATA, SCENARIO_TEXT, SCENARIO_ACT_TEXT, RESOLUTION_KEYS,
  ENCOUNTER_DECK, ENCOUNTER_DECK_CODES, ENCOUNTER_GROUP_IDS, LOCATIONS, LOCATION_TABLE,
  LOCATION_COORDINATES, LOCATION_IDS, START_LOCATION, SETUP_LOCATION_IDS, SET_ASIDE_LOCATION_IDS,
  SET_ASIDE_CODES, REMOVED_CARD_CODES, ACT_CODES, ACT1_CODE, ACT2_CODE, ACT3_CODE,
  AGENDA_CODES, AGENDA1_CODE, AGENDA2_CODE, AGENDA3_CODE, ACT_STAGES, AGENDA_STAGES, ACTS, AGENDAS,
  STAGE_CARDS, CONNECTIONS, GUEST_HALL, scenarioSummary, implementedEntryFlags,
  currentActCode, currentAgendaCode,
}

export default { scenario, identities, layout, behavior, manifest, CARD_DATA }
