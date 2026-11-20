// 古代议庭（courtOfTheAncients · 11612）· 章节装配。
//
// 引擎钩子契约见 behavior.js 文件头；真实读点：preScenarioSetup / setupLocations /
// locationPlaced / locationRevealed / afterDeckSetup / modifyDeck / actions + performAction /
// afterInvestigate / investigateResult / enemyDefeated / checkObjectives / allResigned /
// actReveal / agendaReveal / enemyStatModifier / enemyConnections / locationShroudModifier /
// moveError / resolveChaosToken / applyTokenEffect / resolution / events。
//
// 本章 27 张非玩家条目（11612 是提示卡，不建条目）：
//   议程 3（11613–11615）/ 幕 3（11616–11618）/ 地点 12（11619–11629 + 11622b）/
//   敌人 4（11630/11631/11635/11637）/ 诡计 4（11632–11634/11636）/ 剧情资产 1（11638）。
import {
  scenario, identities, CARD_DATA, SCENARIO_TEXT, RESOLUTION_KEYS, SETUP_STEPS, INTRO_BRANCHES,
  ACT_CODES, AGENDA_CODES, ACT_STAGES, AGENDA_STAGES, ACTS_BY_ROUTE, AGENDAS_BY_ROUTE,
  ENCOUNTER_DECK, ENCOUNTER_DECK_CODES, ENCOUNTER_DEFINITION_CODES, GATHER_GROUPS,
  REQUIRED_ENCOUNTER_GROUPS, ROUTE_GATHER_GROUPS, routeGroupDeck, starSpawnRemainder, encounterDeckFor,
  LOCATIONS, LOCATION_IDS, LOCATION_CONNECTIONS, LOCATION_COORDINATES, LOCATION_CELLS,
  FIXED_LOCATION_IDS, ARCHIVE_IDS, ARCHIVE_CODES, ARCHIVE_SLOT_CELLS, GREAT_LIFT_ID,
  LIFT_LEVELS, LIFT_CELL_BY_LEVEL, START_LOCATION_BY_ROUTE, SET_ASIDE_ALIASES, SET_ASIDE_LOCATION_IDS,
  STAR_SPAWN_OBSERVER_CODE, STAR_SPAWN_OTHER_CODES, INESCAPABLE_SET_CODES, SHARD_CODE,
  COLOSSAL_TYRANT_CODE, GLYPH_RECORDS, GLYPH_RUNE_ORDER, TRANSLATED_GLYPHS_FOR_ELITE, GLYPHS_FOR_ALTAR,
  CONNECTION_POLICY, RESOLUTION_BY_ROUTE, ACT_CODE_BY_ROUTE,
} from './definition.js'
import { layout } from './layout.js'
import {
  behavior, scenarioSummary, implementedEntryFlags, liftState, liftNeighbors, slideGreatLift,
  flipGreatLift, shardControlledBy, altarSealDifficulty,
  eliteKeeperKeywordsActive, routeOf, setLiftConnections,
} from './behavior.js'
import {
  COURT_TOKEN_MEANINGS, courtChaosToken, courtChaosTokenValue, courtTokenText, skullValue, cultistValue,
  glyphCardsInVictory, glyphCount, translatedGlyphCount, stowawayAtLocation, locationFlooded,
  isHardSide, CHAOS_TOKEN_FACES, GLYPH_TRAIT, LIFT_TRAIT, STOWAWAY_TRAIT,
} from './chaos.js'
import { scenarioManifest } from '../../../../scenario-manifest.js'

export {
  scenario, identities, layout, behavior, scenarioSummary, implementedEntryFlags, CARD_DATA,
  SCENARIO_TEXT, RESOLUTION_KEYS, SETUP_STEPS, INTRO_BRANCHES,
  ACT_CODES, AGENDA_CODES, ACT_STAGES, AGENDA_STAGES, ACTS_BY_ROUTE, AGENDAS_BY_ROUTE,
  ENCOUNTER_DECK, ENCOUNTER_DECK_CODES, ENCOUNTER_DEFINITION_CODES, GATHER_GROUPS,
  REQUIRED_ENCOUNTER_GROUPS, ROUTE_GATHER_GROUPS, routeGroupDeck, starSpawnRemainder, encounterDeckFor,
  LOCATIONS, LOCATION_IDS, LOCATION_CONNECTIONS, LOCATION_COORDINATES, LOCATION_CELLS,
  FIXED_LOCATION_IDS, ARCHIVE_IDS, ARCHIVE_CODES, ARCHIVE_SLOT_CELLS, GREAT_LIFT_ID,
  LIFT_LEVELS, LIFT_CELL_BY_LEVEL, START_LOCATION_BY_ROUTE, SET_ASIDE_ALIASES, SET_ASIDE_LOCATION_IDS,
  STAR_SPAWN_OBSERVER_CODE, STAR_SPAWN_OTHER_CODES, INESCAPABLE_SET_CODES, SHARD_CODE,
  COLOSSAL_TYRANT_CODE, GLYPH_RECORDS, GLYPH_RUNE_ORDER, TRANSLATED_GLYPHS_FOR_ELITE, GLYPHS_FOR_ALTAR,
  CONNECTION_POLICY, RESOLUTION_BY_ROUTE, ACT_CODE_BY_ROUTE,
  liftState, liftNeighbors, slideGreatLift, flipGreatLift, translatedGlyphCount, glyphCount,
  shardControlledBy, altarSealDifficulty, eliteKeeperKeywordsActive, routeOf, setLiftConnections,
  COURT_TOKEN_MEANINGS, courtChaosToken, courtChaosTokenValue, courtTokenText, skullValue, cultistValue,
  glyphCardsInVictory, stowawayAtLocation, locationFlooded, isHardSide, CHAOS_TOKEN_FACES,
  GLYPH_TRAIT, LIFT_TRAIT, STOWAWAY_TRAIT,
}

// 本章实现行为的非玩家条目：27 张（议程 3 / 幕 3 / 地点 12 / 敌人 4 / 诡计 4 / 剧情资产 1）。
export const implementedEncounterCodes = Object.freeze([
  '11613', '11614', '11615', '11616', '11617', '11618',
  '11619', '11620', '11621', '11622', '11622b', '11623', '11624', '11625',
  '11626', '11627', '11628', '11629',
  '11630', '11631', '11632', '11633', '11634', '11635', '11636', '11637', '11638',
])
// 真正有规则行为读点的条目（其余是数据型条目，数值取卡表）。
export const behaviorEntryCodes = Object.freeze([
  '11613', '11614', '11615', '11616', '11617', '11618',
  '11619', '11620', '11621', '11622', '11622b', '11623', '11624', '11625',
  '11626', '11627', '11628', '11629',
  '11630', '11631', '11632', '11633', '11634', '11635', '11636', '11637', '11638',
])

export const manifest = scenarioManifest(scenario, identities, {
  campaignId: 'theDrownedCity',
  status: 'playable',
  layout,
  requiredPackIds: ['core', 'tdcCampaign'],
  requiredEncounterGroupIds: [...REQUIRED_ENCOUNTER_GROUPS],
  requiredInvestigatorIds: [],
  requiredMechanicIds: [],
  setAsideLocations: [...SET_ASIDE_LOCATION_IDS],
  setAsideAliases: [...SET_ASIDE_ALIASES],
  recordReads: [
    'theExpeditionHeadedWest', 'theCreatureWasDefeated', 'discoveredGlyphs', 'rlyehMap', 'shardOfYchlecht',
  ],
  recordWrites: ['discoveredGlyphs', 'rlyehMap', 'shardOfYchlecht'],
  behaviorIds: [behavior.id],
})
manifest.contentVersion = '0.1.0'
manifest.referenceCode = '11612'
manifest.textLanguage = SCENARIO_TEXT.textLanguage
manifest.textStatus = SCENARIO_TEXT.textStatus
// 路线相关的动态遭遇组（向西 Stowaways / 向东 Pilgrims）与 Star Spawn 残余。
manifest.dynamicEncounterGroups = [ROUTE_GATHER_GROUPS.west, ROUTE_GATHER_GROUPS.east]
// 崩塌档案库：6 张洗牌后随机移出 1 张，其余 5 张入场。
manifest.archiveDeck = {
  pool: [...ARCHIVE_IDS],
  slotCells: ARCHIVE_SLOT_CELLS.map(cell => ({ ...cell })),
  removedCount: 1,
  inPlayCount: 5,
}
// 大升降机：竖直 4 层；未激活/已激活两个印刷面。
manifest.greatLift = {
  id: GREAT_LIFT_ID,
  levels: [...LIFT_LEVELS],
  cells: Object.fromEntries(Object.entries(LIFT_CELL_BY_LEVEL).map(([level, cell]) => [level, { ...cell }])),
  inactiveCode: '11622',
  activeCode: '11622b',
}
