// 扭曲空洞（theTwistedHollow）· 章节装配。
//
// 引擎钩子契约见 behavior.js 文件头；真实引擎读点：startLocation / preScenarioSetup /
// setupLocations / locationPlaced / locationRevealed / afterDeckSetup / investigateResult /
// locationShroudModifier / enemyStatModifier / preyRank / actions + performAction / phaseBegan /
// enemySpawned / enemyMoved / enemyAttackStarted / enemyAttackResolved / enemyDefeated /
// actReveal / agendaReveal / checkObjectives / allResigned / resolveChaosToken / applyTokenEffect /
// afterTest / resolution + events。
//
// 本文件只做汇总与 manifest；卡面数据在 definition.js，规则在 behavior.js，
// 单卡条目在 src/cards/encounter-entries/theFeastOfHemlockVale/theTwistedHollow/。
import {
  scenario, identities, ACT_CODES, AGENDA_CODES, SPECIAL_AGENDA_CODE, URSINE_HYBRID_CODE,
  ACT_CODE_BY_STAGE, AGENDA_CODE_BY_STAGE, ACT_STAGES, AGENDA_STAGES, STAGE_CARDS,
  ENCOUNTER_DECK, GATHER_GROUPS, GATHER_SET_ASIDE_GROUPS, LANTERN_SPEC, LANTERN_CODES,
  LOCATIONS, LOCATION_CONNECTIONS, LOCATION_IDS, WESTERN_WOODS_IDS,
  SET_ASIDE_CARDS, SET_ASIDE_LOCATIONS, STORY_CODES, RESIDENTS, SCENARIO_TEXT, CARD_DATA,
  START_SLOT, DIRECTION_VECTORS, ACT2_GRID_OFFSETS,
} from './definition.js'
import { layout, OPENING_SLOTS, areAdjacent, projectGrid } from './layout.js'
import { behavior, implementedEntryFlags, PURSUIT_ZONE } from './behavior.js'
import { TWISTED_HOLLOW_TOKEN_MEANINGS } from './chaos.js'
import { scenarioManifest } from '../../../../scenario-manifest.js'

export {
  scenario, identities, layout, behavior, implementedEntryFlags,
  ACT_CODES, AGENDA_CODES, SPECIAL_AGENDA_CODE, URSINE_HYBRID_CODE, ACT_CODE_BY_STAGE, AGENDA_CODE_BY_STAGE,
  ACT_STAGES, AGENDA_STAGES, STAGE_CARDS, ENCOUNTER_DECK, GATHER_GROUPS, GATHER_SET_ASIDE_GROUPS,
  LANTERN_SPEC, LANTERN_CODES, LOCATIONS, LOCATION_CONNECTIONS, LOCATION_IDS, WESTERN_WOODS_IDS,
  SET_ASIDE_CARDS, SET_ASIDE_LOCATIONS, STORY_CODES, RESIDENTS, SCENARIO_TEXT, CARD_DATA,
  START_SLOT, DIRECTION_VECTORS, ACT2_GRID_OFFSETS, OPENING_SLOTS, areAdjacent, projectGrid,
  PURSUIT_ZONE, TWISTED_HOLLOW_TOKEN_MEANINGS,
}

// 本章全部 24 条卡记录（含双面 a/b 与四张提灯剧情资产）：单卡条目一一对应。
export const implementedEncounterCodes = Object.freeze([
  '10606', '10607a', '10607b', '10608', '10609',
  '10610a', '10610b', '10611a', '10611b',
  '10612', '10613', '10614', '10615', '10616', '10617', '10618', '10619', '10620', '10621',
  '10622', '10623', '10624', '10625',
])

export const manifest = scenarioManifest(scenario, identities, {
  campaignId: 'theFeastOfHemlockVale',
  status: 'playable',
  layout,
  requiredPackIds: ['core', 'fhvCampaign'],
  requiredEncounterGroupIds: ['theTwistedHollow', 'theFirstDay', 'theForest', 'myconids'],
  requiredInvestigatorIds: [],
  requiredMechanicIds: [],
  setAsideLocations: scenario.setAsideLocations,
  setAsideAliases: [...SET_ASIDE_CARDS],
  // 读取的战役记录：引言分支（母亲瑞秋指路 / 调查员迷失方向）与居民关系等级。
  recordReads: [
    'motherRachelShowedTheWay', 'theInvestigatorsLostThePath',
    'theoPetersRelationshipLevel', 'judithParkRelationshipLevel',
  ],
  // 写出的战役记录：引言分支、法典、结局与经验奖励。
  recordWrites: [
    'motherRachelShowedTheWay', 'theInvestigatorsLostThePath', 'motherRachelIntervened',
    'bertieWasRescued', 'bertieWasLostInTheWoods', 'theBearWasWounded', 'areasSurveyedWesternWoods',
    'judithSavedYourAss', 'theoDistractedTheBear',
    'theTwistedHollowResolution', 'theTwistedHollowTimes', 'theTwistedHollowBonusXp',
  ],
  behaviorIds: [behavior.id],
})
manifest.contentVersion = '0.1.0'
manifest.referenceCode = '10605'
