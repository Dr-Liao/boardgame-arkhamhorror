// 吞噬万物（theBlobThatAteEverything · 85001）· 章节装配（单桌普通流程）。
//
// 引擎钩子契约见 behavior.js 文件头；真实引擎读点：
//   startLocation / preScenarioSetup / setupLocations / locationPlaced / afterDeckSetup /
//   actions + performAction / actReveal / actIndexAfterAdvance / agendaReveal / checkObjectives /
//   roundEnded / turnEnded / canGainResources / cluesGained / enemySpawned / enemyDefeated /
//   enemyDamaged / enemyDamageAllowed / enemyPhaseStart / storyAssetLeftPlay /
//   resolveChaosToken / applyTokenEffect / tokenMeanings / resolution。
import {
  scenario, identities, CARD_DATA, SCENARIO_TEXT, LOCATIONS, LOCATION_TABLE, QUARANTINE_TABLE,
  FIXED_LOCATION_TABLE, GRID_SLOTS, LOCATION_COORDINATES, REMOVED_SLOTS, STATIC_CONNECTIONS,
  ENCOUNTER_DECK, ENCOUNTER_DECK_CODES, ENCOUNTER_GROUPS, SET_ASIDE_ALIASES, SET_ASIDE_CODES,
  ACT_CODES, AGENDA_CODES, ACT_STAGES, AGENDA_STAGES, ACTS, AGENDAS, STAGE_CARDS, RESOLUTION_KEYS,
  START_LOCATION, SUBJECT_CODE, VULNERABLE_HEART_CODE, STORY_CODES, STORY_RULES, BLOB_X,
  OOZELING_CODE, GRASPING_OOZE_CODE, CUBIC_OOZE_CODE, OOZEWRAITH_CODE, MIGO_GENERAL_CODE,
  MIGO_DRONE_CODE, MIGO_HARVESTER_CODE, MIGO_MEDDLER_CODE, MIGO_ABDUCTOR_CODE,
  CHEMIST_CODE, SAMPLE_CODE, MILITARY_PLAN_CODE, REWARD_ASSET_CODES,
} from './definition.js'
import { layout, CONNECTIONS } from './layout.js'
import { behavior, scenarioSummary, implementedEntryFlags } from './behavior.js'
import { scenarioManifest } from '../../../../scenario-manifest.js'

// 本关 45 张非玩家条目（85001 是场景参考卡本身；85005/85008/85037 是 Epic Multiplayer 变体，
// 归跨桌流程，不在单桌条目内）。
export const implementedEncounterCodes = Object.freeze([
  '85002', '85003', '85004', '85006', '85007', '85009',
  '85010', '85011', '85012', '85013', '85014', '85015', '85016', '85017', '85018', '85019', '85020',
  '85021', '85022', '85023', '85024', '85025', '85026', '85027', '85028', '85029', '85030', '85031', '85032',
  '85033', '85034', '85035', '85036', '85038', '85039', '85040', '85041', '85042', '85043',
  '85044', '85045', '85046', '85047', '85048', '85049', '85050', '85051', '85052', '85053',
])
export const behaviorEntryCodes = Object.freeze([
  '85002', '85003', '85004', '85006', '85007', '85009',
  '85010', '85011', '85012', '85013', '85014', '85015', '85016', '85017', '85018', '85019', '85020',
  '85038', '85040', '85043', '85044', '85046', '85049', '85052',
  '85021', '85022', '85023', '85024', '85025', '85026', '85027', '85028', '85033', '85034', '85035', '85036',
])

export const manifest = scenarioManifest(scenario, identities, {
  campaignId: 'theBlobThatAteEverything',
  status: 'playable',
  layout,
  requiredPackIds: ['core', 'blobCampaign'],
  requiredEncounterGroupIds: [...ENCOUNTER_GROUPS],
  requiredInvestigatorIds: [],
  requiredMechanicIds: [],
  setAsideAliases: [...SET_ASIDE_ALIASES],
  recordReads: [],
  recordWrites: ['subject8L08DevouredTheEntireUniverse', 'theAnomalyWasContained'],
  behaviorIds: [behavior.id],
})
manifest.contentVersion = '0.1.0'
manifest.referenceCode = '85001'

export {
  scenario, identities, layout, behavior, CARD_DATA, SCENARIO_TEXT,
  LOCATIONS, LOCATION_TABLE, QUARANTINE_TABLE, FIXED_LOCATION_TABLE, GRID_SLOTS,
  LOCATION_COORDINATES, REMOVED_SLOTS, STATIC_CONNECTIONS, CONNECTIONS,
  ENCOUNTER_DECK, ENCOUNTER_DECK_CODES, ENCOUNTER_GROUPS, SET_ASIDE_ALIASES, SET_ASIDE_CODES,
  ACT_CODES, AGENDA_CODES, ACT_STAGES, AGENDA_STAGES, ACTS, AGENDAS, STAGE_CARDS, RESOLUTION_KEYS,
  START_LOCATION, SUBJECT_CODE, VULNERABLE_HEART_CODE, STORY_CODES, STORY_RULES, BLOB_X,
  OOZELING_CODE, GRASPING_OOZE_CODE, CUBIC_OOZE_CODE, OOZEWRAITH_CODE, MIGO_GENERAL_CODE,
  MIGO_DRONE_CODE, MIGO_HARVESTER_CODE, MIGO_MEDDLER_CODE, MIGO_ABDUCTOR_CODE,
  CHEMIST_CODE, SAMPLE_CODE, MILITARY_PLAN_CODE, REWARD_ASSET_CODES,
  scenarioSummary, implementedEntryFlags,
}

export default { scenario, identities, layout, behavior, manifest, CARD_DATA }
