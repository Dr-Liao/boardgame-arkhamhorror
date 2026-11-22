// 吞噬万物 · ELSE! 变体（theBlobThatAteEverythingElse）· 章节装配。
//
// 复用普通流程的全部非玩家条目（同一批 85002–85053），并追加 ELSE! 专属条目 89005–89021。
// 引擎钩子读点同 behavior.js 文件头（普通流程全集 + locationShroudModifier / resolveEncounterCard）。
import {
  scenario, identities, CARD_DATA, SCENARIO_TEXT, LOCATIONS, LOCATION_TABLE, QUARANTINE_TABLE,
  FIXED_LOCATION_TABLE, GRID_SLOTS, LOCATION_COORDINATES, REMOVED_SLOTS, STATIC_CONNECTIONS,
  ENCOUNTER_DECK, ENCOUNTER_DECK_CODES, ENCOUNTER_GROUPS, SET_ASIDE_ALIASES, ELSE_SET_ASIDE_CODES,
  ACT_CODES, AGENDA_CODES, ACT_STAGES, AGENDA_STAGES, ACTS, AGENDAS, STAGE_CARDS, RESOLUTION_KEYS,
  START_LOCATION, SUBJECT_CODE, VULNERABLE_HEART_CODE, STORY_CODES, STORY_RULES, BLOB_X,
  REWARD_ASSET_CODES, ELSE_QUARANTINE_IDS, ELSE_LOCATION_TABLE, ELSE_LOCATION_TABLE_ALL,
} from './definition.js'
import { layout, CONNECTIONS } from './layout.js'
import { behavior, scenarioSummary, implementedEntryFlags } from './behavior.js'
import { scenarioManifest } from '../../../../scenario-manifest.js'

// 普通流程 45 张非玩家条目 + ELSE! 专属 22 张（89005–89021，含 89010a–i 复制异变体）。
export const implementedEncounterCodes = Object.freeze([
  '85002', '85003', '85004', '85006', '85007', '85009',
  '85010', '85011', '85012', '85013', '85014', '85015', '85016', '85017', '85018', '85019', '85020',
  '85021', '85022', '85023', '85024', '85025', '85026', '85027', '85028', '85029', '85030', '85031', '85032',
  '85033', '85034', '85035', '85036', '85038', '85039', '85040', '85041', '85042', '85043',
  '85044', '85045', '85046', '85047', '85048', '85049', '85050', '85051', '85052', '85053',
  '89005', '89010a', '89010b', '89010c', '89010d', '89010e', '89010f', '89010g', '89010h', '89010i',
  '89011', '89012', '89013', '89014', '89015', '89016', '89017', '89018', '89019', '89020', '89021',
])
export const behaviorEntryCodes = Object.freeze([
  '85002', '85003', '85004', '85006', '85007', '85009',
  '85010', '85011', '85012', '85013', '85014', '85015', '85016', '85017', '85018', '85019', '85020',
  '85038', '85040', '85043', '85044', '85046', '85049', '85052',
  '85021', '85022', '85023', '85024', '85025', '85026', '85027', '85028', '85033', '85034', '85035', '85036',
  '89006', '89007', '89008', '89009', '89010a', '89010b', '89010c', '89010d', '89010e', '89010f', '89010g',
  '89010h', '89010i', '89011', '89012', '89013', '89014', '89015', '89016', '89017', '89018',
  '89019', '89020', '89021',
])

export const manifest = scenarioManifest(scenario, identities, {
  campaignId: 'theBlobThatAteEverything',
  status: 'playable',
  layout,
  requiredPackIds: ['core', 'blobCampaign', 'blbeCampaign'],
  requiredEncounterGroupIds: [...ENCOUNTER_GROUPS],
  requiredInvestigatorIds: [],
  requiredMechanicIds: [],
  setAsideAliases: [...SET_ASIDE_ALIASES],
  recordReads: [],
  recordWrites: ['subject8L08DevouredTheEntireUniverse', 'theAnomalyWasContained', 'youHaveNoSoul'],
  behaviorIds: [behavior.id],
})
manifest.contentVersion = '0.1.0'
manifest.referenceCode = '85001'

export {
  scenario, identities, layout, behavior, CARD_DATA, SCENARIO_TEXT,
  LOCATIONS, LOCATION_TABLE, QUARANTINE_TABLE, FIXED_LOCATION_TABLE, GRID_SLOTS,
  LOCATION_COORDINATES, REMOVED_SLOTS, STATIC_CONNECTIONS, CONNECTIONS,
  ENCOUNTER_DECK, ENCOUNTER_DECK_CODES, ENCOUNTER_GROUPS, SET_ASIDE_ALIASES, ELSE_SET_ASIDE_CODES,
  ACT_CODES, AGENDA_CODES, ACT_STAGES, AGENDA_STAGES, ACTS, AGENDAS, STAGE_CARDS, RESOLUTION_KEYS,
  START_LOCATION, SUBJECT_CODE, VULNERABLE_HEART_CODE, STORY_CODES, STORY_RULES, BLOB_X,
  REWARD_ASSET_CODES, ELSE_QUARANTINE_IDS, ELSE_LOCATION_TABLE, ELSE_LOCATION_TABLE_ALL,
  scenarioSummary, implementedEntryFlags,
}

export default { scenario, identities, layout, behavior, manifest, CARD_DATA }
