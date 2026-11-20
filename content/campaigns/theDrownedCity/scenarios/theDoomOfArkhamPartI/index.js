// 阿卡姆的毁灭 第一部分（theDoomOfArkhamPartI · 11682）· 章节装配。
//
// 引擎钩子契约见 behavior.js 文件头。本章 status 为 development：单卡条目齐全、
// 结构/manifest/混乱标记/结局与主要流程已接线；若干卡面细节如实记为近似
// （见 artifacts/migration/tdc/p7/workers/scenario-epsilon.md）。
import {
  scenario, identities, CARD_DATA, SCENARIO_TEXT, RESOLUTION_KEYS,
  CHAPTER_ID, REFERENCE_CODE, ENCOUNTER_CODE, ACT_CODES, AGENDA_CODES, ACT_STAGES, AGENDA_STAGES,
  ACTS, AGENDAS, STAGE_CARDS, START_LOCATION, LOCATIONS, LOCATION_CONNECTIONS, LOCATION_COORDINATES,
  LOCATION_VARIANTS, BASE_LOCATION_IDS, HIDING_LOCATION_IDS, SET_ASIDE_LOCATION_IDS, SET_ASIDE_CARDS,
  ENCOUNTER_DECK, ENCOUNTER_DECK_CODES, GATHER_GROUPS, MIDNIGHT_MASKS_DECK_CODES,
  IMPLEMENTED_ENTRY_CODES, PHANTOM_SHOP_ACT_CODE, TILLINGHAST_ESOTERICA_CODE,
  RANDALL_TILLINGHAST_CODE, LEGRASSE_CODE, HORROR_IN_CLAY_CODE, RESOLUTION_ARTIFACT_COUNT,
  STAR_SPAWN_REMOVAL_CODES, STAR_SPAWN_REMOVAL_COUNT,
} from './definition.js'
import { layout } from './layout.js'
import { behavior, implementedEntryFlags, scenarioSummary, placeShop, artifactsControlled, stackAt } from './behavior.js'
import {
  DOOM_OF_ARKHAM_PART_I_TOKEN_MEANINGS, doomOfArkhamPartOneChaosToken,
  doomOfArkhamPartOneChaosTokenValue, doomOfArkhamPartOneTokenText, skullValue,
  locationsWithoutBeneath, isHardSide, CHAOS_TOKEN_FACES,
} from './chaos.js'
import { scenarioManifest } from '../../../../scenario-manifest.js'

export {
  scenario, identities, layout, behavior, implementedEntryFlags, scenarioSummary, CARD_DATA,
  SCENARIO_TEXT, RESOLUTION_KEYS, CHAPTER_ID, REFERENCE_CODE, ENCOUNTER_CODE,
  ACT_CODES, AGENDA_CODES, ACT_STAGES, AGENDA_STAGES, ACTS, AGENDAS, STAGE_CARDS,
  START_LOCATION, LOCATIONS, LOCATION_CONNECTIONS, LOCATION_COORDINATES, LOCATION_VARIANTS,
  BASE_LOCATION_IDS, HIDING_LOCATION_IDS, SET_ASIDE_LOCATION_IDS, SET_ASIDE_CARDS,
  ENCOUNTER_DECK, ENCOUNTER_DECK_CODES, GATHER_GROUPS, MIDNIGHT_MASKS_DECK_CODES,
  IMPLEMENTED_ENTRY_CODES, PHANTOM_SHOP_ACT_CODE, TILLINGHAST_ESOTERICA_CODE,
  RANDALL_TILLINGHAST_CODE, LEGRASSE_CODE, HORROR_IN_CLAY_CODE, RESOLUTION_ARTIFACT_COUNT,
  STAR_SPAWN_REMOVAL_CODES, STAR_SPAWN_REMOVAL_COUNT,
  DOOM_OF_ARKHAM_PART_I_TOKEN_MEANINGS, doomOfArkhamPartOneChaosToken,
  doomOfArkhamPartOneChaosTokenValue, doomOfArkhamPartOneTokenText, skullValue,
  locationsWithoutBeneath, isHardSide, CHAOS_TOKEN_FACES,
  placeShop, artifactsControlled, stackAt,
}

// 本章实现行为的非玩家条目：6 张（议程 1 / 幕 1 / 地点 1 / 敌人 1 / 剧情资产 2）。
export const implementedEncounterCodes = [...IMPLEMENTED_ENTRY_CODES]
// 真正有规则行为读点的条目：议程/幕/地点/敌人；两张剧情资产只有数据与 flag（近似见 note）。
export const behaviorEntryCodes = Object.freeze(['11683', '11684', '11685', '11686'])

export const manifest = scenarioManifest(scenario, identities, {
  campaignId: 'theDrownedCity',
  status: 'development',
  layout,
  requiredPackIds: ['core', 'tdcCampaign'],
  requiredEncounterGroupIds: [
    'theDoomOfArkhamPart1', 'deepOnes', 'domination', 'dreams', 'starSpawn',
    'agentsOfCthulhu', 'arkham',
  ],
  requiredInvestigatorIds: [],
  requiredMechanicIds: [],
  setAsideLocations: [...SET_ASIDE_LOCATION_IDS],
  setAsideAliases: [...SET_ASIDE_CARDS],
  recordReads: ['barrierNode', 'obsidianClaw', 'shardOfYchlecht', 'tidalTablet', 'grislyMask'],
  recordWrites: [
    'barrierNode', 'obsidianClaw', 'shardOfYchlecht', 'tidalTablet', 'grislyMask',
    'horrorInClay', 'floodedNeighborhoods',
  ],
  behaviorIds: [behavior.id],
})
manifest.contentVersion = '0.1.0'
manifest.referenceCode = REFERENCE_CODE
// 星之眷族随机移除与地点变体是运行期决定，静态 zones 声明完整候选。
manifest.dynamicRemovalCodes = [...STAR_SPAWN_REMOVAL_CODES]
manifest.locationVariantPools = { ...LOCATION_VARIANTS }
