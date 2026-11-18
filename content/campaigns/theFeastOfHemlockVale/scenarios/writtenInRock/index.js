// 岩间密语（writtenInRock）· 章节装配。
//
// 引擎钩子契约见 behavior.js 文件头；真实读点：preScenarioSetup / startLocation / setupLocations /
// locationPlaced / afterDeckSetup / locationRevealed / enemyPhaseEnd / enemySpawned /
// enemyAttackResolved / actions + fastActions + performAction / roundEnded / actReveal /
// agendaReveal / checkObjectives / resolveChaosToken / applyTokenEffect / resolution。
import {
  scenario, identities, ACT_CODES, AGENDA_CODES, ACT_CODE_BY_STAGE, AGENDA_CODE_BY_STAGE,
  ACT_STAGES, AGENDA_STAGES, ENCOUNTER_DECK, DAY_GATHER_GROUPS, GATHER_GROUPS, SET_ASIDE_CARDS,
  SET_ASIDE_RAIL_LOCATION_IDS, LOCATIONS, LOCATION_CONNECTIONS, LOCATION_COORDINATES,
  CAVE_LOCATION_IDS, RAIL_LOCATION_IDS, RAIL_PORTS, STORY_CODES, RESOLUTION_KEYS, RESOLUTION_RECORD_KEYS,
  SCENARIO_TEXT, THE_CAVE_IN, MINE_CART_CODE, PRISMATIC_SHARD_CODE, SUBTERRANEAN_BEAST_CODE,
  CAVE_IN_CODE, WILD_RIDE_CODE, RESIDENT_ASSETS, ENCOUNTER_CODE, CHAPTER_ID, REFERENCE_CODE,
  encounterDeckForDay, dayGroupCards,
} from './definition.js'
import { layout } from './layout.js'
import { behavior, implementedEntryFlags, implementedEncounterCodes } from './behavior.js'
import { scenarioManifest } from '../../../../scenario-manifest.js'

export {
  scenario, identities, layout, behavior, implementedEntryFlags, implementedEncounterCodes,
  ACT_CODES, AGENDA_CODES, ACT_CODE_BY_STAGE, AGENDA_CODE_BY_STAGE, ACT_STAGES, AGENDA_STAGES,
  ENCOUNTER_DECK, GATHER_GROUPS, DAY_GATHER_GROUPS, SET_ASIDE_CARDS, SET_ASIDE_RAIL_LOCATION_IDS,
  LOCATIONS, LOCATION_CONNECTIONS, LOCATION_COORDINATES, CAVE_LOCATION_IDS, RAIL_LOCATION_IDS,
  RAIL_PORTS, STORY_CODES, RESOLUTION_KEYS, RESOLUTION_RECORD_KEYS, SCENARIO_TEXT, THE_CAVE_IN,
  MINE_CART_CODE, PRISMATIC_SHARD_CODE, SUBTERRANEAN_BEAST_CODE, CAVE_IN_CODE, WILD_RIDE_CODE,
  RESIDENT_ASSETS, ENCOUNTER_CODE, CHAPTER_ID, REFERENCE_CODE, encounterDeckForDay, dayGroupCards,
}

export const manifest = scenarioManifest(scenario, identities, {
  campaignId: 'theFeastOfHemlockVale',
  status: 'playable',
  layout,
  requiredPackIds: ['core', 'fhvCampaign'],
  requiredEncounterGroupIds: ['writtenInRock'],
  requiredInvestigatorIds: [],
  requiredMechanicIds: [],
  setAsideLocations: scenario.setAsideLocations,
  setAsideAliases: [...SET_ASIDE_CARDS],
  recordReads: ['day', 'time', 'timeOfDay', 'night', 'leadSeat'],
  recordWrites: [...RESOLUTION_RECORD_KEYS],
  behaviorIds: [behavior.id],
})
manifest.contentVersion = '0.1.0'
manifest.referenceCode = REFERENCE_CODE
manifest.referenceCodes = ['10501', '10502']
