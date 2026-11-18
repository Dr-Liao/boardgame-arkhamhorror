// 深沼之物（theThingInTheDepths）· 章节装配。
//
// 引擎钩子契约见 behavior.js 文件头；真实引擎读点：
//   preScenarioSetup / startLocation / setupLocations / locationPlaced / afterDeckSetup / setupEnemies /
//   actions + performAction / locationShroudModifier / moveError / beforeMove / locationEntered / afterTest /
//   enemySpawned / enemyMoved / enemyEngaged / enemyPhaseStart / enemyPhaseAfterHunters / enemyDefeated /
//   enemyStatModifier / enemyConnections / spawnLocation / canOpportunityAttack / turnEnded / roundEnded /
//   checkObjectives / actReveal / agendaReveal / resolveChaosToken / applyTokenEffect / events / resolution。
import {
  scenario, identities, ACT_CODES, AGENDA_CODES, ACT_STAGES, AGENDA_STAGES, ACTS, AGENDAS,
  ENCOUNTER_DECK, ENCOUNTER_DECK_CODES, GATHER_GROUPS, EXTERNAL_GATHER_GROUPS, DAY_ENCOUNTER_GROUPS,
  DAY_STORY_CODES, dayEncounterDeck, SET_ASIDE_CARDS, SET_ASIDE_ENEMY_CODES, LOCATIONS, LOCATION_IDS,
  LOCATION_TABLE, LOCATION_CONNECTIONS, LOCATION_COORDINATES, OPEN_WATER_FACES, OPEN_WATER_CODE_BY_LOCATION,
  GRID_SLOTS, SLOT_IDS, SLOT_LABELS, GRID_ADJACENCY, DEFAULT_SLOT_ASSIGNMENT, DEFAULT_REMOVED_LOCATION,
  START_LOCATION, NORTH_SHORE_LOCATION, CRANBERRY_BOG_LOCATION, CENTER_LOCATION, START_SLOT, CENTER_SLOT,
  CARD_CODES, RESIDENT_CODES, STORY_CODES, ENEMY_CODES, TREACHERY_CODES, RECORD_KEYS, RECORD_READS,
  RECORD_WRITES, RESIDENT_RECORDS, SCENARIO_TEXT, CARD_DATA, THING_IN_THE_DEPTHS_CODE,
  CHELYDRAN_HYBRID_CODE, GRASPING_TENDRIL_CODE, connectionsForAssignment,
} from './definition.js'
import { THE_THING_IN_THE_DEPTHS_TOKEN_MEANINGS, sunkenLocationCount, skullValue } from './chaos.js'
import { layout } from './layout.js'
import { behavior, implementedEntryFlags, implementedEncounterCodes } from './behavior.js'
import { scenarioManifest } from '../../../../scenario-manifest.js'

export {
  scenario, identities, layout, behavior, implementedEntryFlags, implementedEncounterCodes,
  ACT_CODES, AGENDA_CODES, ACT_STAGES, AGENDA_STAGES, ACTS, AGENDAS, ENCOUNTER_DECK, ENCOUNTER_DECK_CODES,
  GATHER_GROUPS, EXTERNAL_GATHER_GROUPS, DAY_ENCOUNTER_GROUPS, DAY_STORY_CODES, dayEncounterDeck,
  SET_ASIDE_CARDS, SET_ASIDE_ENEMY_CODES, LOCATIONS, LOCATION_IDS, LOCATION_TABLE, LOCATION_CONNECTIONS,
  LOCATION_COORDINATES, OPEN_WATER_FACES, OPEN_WATER_CODE_BY_LOCATION, GRID_SLOTS, SLOT_IDS, SLOT_LABELS,
  GRID_ADJACENCY, DEFAULT_SLOT_ASSIGNMENT, DEFAULT_REMOVED_LOCATION, START_LOCATION, NORTH_SHORE_LOCATION,
  CRANBERRY_BOG_LOCATION, CENTER_LOCATION, START_SLOT, CENTER_SLOT, CARD_CODES, RESIDENT_CODES, STORY_CODES,
  ENEMY_CODES, TREACHERY_CODES, RECORD_KEYS, RECORD_READS, RECORD_WRITES, RESIDENT_RECORDS, SCENARIO_TEXT,
  CARD_DATA, THING_IN_THE_DEPTHS_CODE, CHELYDRAN_HYBRID_CODE, GRASPING_TENDRIL_CODE,
  connectionsForAssignment, THE_THING_IN_THE_DEPTHS_TOKEN_MEANINGS, sunkenLocationCount, skullValue,
}

// 本章有行为读点的非玩家条目：2 幕 + 2 议程 + 3 敌人 + 2 诡计（地点条目为数据型，规则在 behavior）。
export const implementedEncounterCodeList = implementedEncounterCodes

export const manifest = scenarioManifest(scenario, identities, {
  campaignId: 'theFeastOfHemlockVale',
  status: 'playable',
  layout,
  requiredPackIds: ['core', 'fhvCampaign'],
  // 固定 gather 组（当日组按日期运行时洗入，见 behavior.afterDeckSetup）。
  requiredEncounterGroupIds: ['theThingInTheDepths', 'blight', 'theForest', 'mutations'],
  requiredInvestigatorIds: [],
  requiredMechanicIds: [],
  setAsideLocations: [],
  setAsideAliases: [...SET_ASIDE_CARDS],
  recordReads: [...RECORD_READS],
  recordWrites: [...RECORD_WRITES],
  behaviorIds: [behavior.id],
})
manifest.contentVersion = '0.1.0'
manifest.referenceCode = '10588'
