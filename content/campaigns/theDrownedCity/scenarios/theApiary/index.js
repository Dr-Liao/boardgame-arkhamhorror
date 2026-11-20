// 养育场（theApiary）· 章节装配。
//
// 引擎钩子契约见 behavior.js 文件头。manifest 用 scenarioManifest 组装；
// status = 'development'（P7 内容批默认状态）。
//
// 与主进程（Lead / campaign-core）的集成约定：
//   · 单卡条目：src/cards/encounter-entries/theDrownedCity/theApiary/<code>.js（34 条）。
//   · 战役记录只用 CONTRACT §4 键：theExpeditionHeadedWest / theCreatureWasDefeated /
//     thePilgrimsWereSaved / thePilgrimsWereDevoured /
//     theInvestigatorsExterminatedTheAlienParasites / grislyMask / discoveredGlyphs / rlyehMap。
//   · 东西向双 Setup：静态 manifest.zones 以默认西向为准；东向牌库 = ENCOUNTER_DECK_BY_DIRECTION.east，
//     behavior.modifyDeck 在引擎建局时替换（主进程按远征方向接线时用 encounterDeckByDirection）。
//   · 跳章出口：结局 3 强制进入结局 4；结局 4 二选一 → theDrownedQuarter / theWesternWall。
//   · 需要 Lead 登记：scenarios/index.js 挂载、内容包 tdcCampaign 的遭遇组清单、
//     narrative-guides 的指南源与 web/scenario-guides/theApiary.json。
import {
  scenario, identities, CARD_DATA, SCENARIO_TEXT, RESOLUTION_KEYS, RESOLUTION_NEXT, RESOLUTION4_NEXT,
  ACT_CODES, ACT_CODES_BY_DIRECTION, AGENDA_CODES, ACT_STAGES, AGENDA_STAGES, STAGE_CARDS,
  ENCOUNTER_DECK, ENCOUNTER_DECK_CODES, ENCOUNTER_DECK_BY_DIRECTION, GATHER_GROUPS_BY_DIRECTION,
  LOCATIONS, LOCATION_IDS, LOCATION_CONNECTIONS, LOCATION_COORDINATES, START_LOCATION,
  SET_ASIDE_LOCATION_IDS, SET_ASIDE_ALIASES, DECK_LOCATION_IDS, ENEMY_CODES, TREACHERY_CODES,
  MOTHER_CODE, GROTESQUE_AMALGAM_CODE, APIARY_TENDER_CODE, SQUAMOUS_PARASITE_CODE,
  SQUAMOUS_PARASITE_STORY_CODE, MARIA_RIVERA_CODE, ANCIENT_RELIC_CODE, ANCIENT_RELIC_STORY_CODE,
  GRISLY_MASK_CODE, HIDDEN_VAULT_STORY_CODE, PARASITIC_TRANSFORMATION_CODE,
  CENTRAL_CHAMBER_ID, FACING_RING, INITIAL_FACING, HIDDEN_LOCATION_BY_DIRECTION, REMOVED_BY_DIRECTION,
  THE_INESCAPABLE_CODES, VICTORY_LOCATION_IDS, SANCTUM_LOCATION_IDS, ENCLAVE_LOCATION_IDS, NEST_LOCATION_IDS,
} from './definition.js'
import { layout, HIVE_MIND_RING } from './layout.js'
import { behavior, implementedEntryFlags, scenarioSummary } from './behavior.js'
import {
  APIARY_TOKEN_MEANINGS, CHAOS_TOKEN_FACES, apiaryChaosToken, apiaryChaosTokenValue, apiaryTokenText,
  skullValue, doomInPlay, cultistEnemyAtLocation, isHardSide,
} from './chaos.js'
import { scenarioManifest } from '../../../../scenario-manifest.js'

export {
  scenario, identities, layout, behavior, implementedEntryFlags, scenarioSummary, CARD_DATA,
  SCENARIO_TEXT, RESOLUTION_KEYS, RESOLUTION_NEXT, RESOLUTION4_NEXT,
  ACT_CODES, ACT_CODES_BY_DIRECTION, AGENDA_CODES, ACT_STAGES, AGENDA_STAGES, STAGE_CARDS,
  ENCOUNTER_DECK, ENCOUNTER_DECK_CODES, ENCOUNTER_DECK_BY_DIRECTION, GATHER_GROUPS_BY_DIRECTION,
  LOCATIONS, LOCATION_IDS, LOCATION_CONNECTIONS, LOCATION_COORDINATES, START_LOCATION,
  SET_ASIDE_LOCATION_IDS, SET_ASIDE_ALIASES, DECK_LOCATION_IDS, ENEMY_CODES, TREACHERY_CODES,
  MOTHER_CODE, GROTESQUE_AMALGAM_CODE, APIARY_TENDER_CODE, SQUAMOUS_PARASITE_CODE,
  SQUAMOUS_PARASITE_STORY_CODE, MARIA_RIVERA_CODE, ANCIENT_RELIC_CODE, ANCIENT_RELIC_STORY_CODE,
  GRISLY_MASK_CODE, HIDDEN_VAULT_STORY_CODE, PARASITIC_TRANSFORMATION_CODE,
  CENTRAL_CHAMBER_ID, FACING_RING, INITIAL_FACING, HIDDEN_LOCATION_BY_DIRECTION, REMOVED_BY_DIRECTION,
  THE_INESCAPABLE_CODES, VICTORY_LOCATION_IDS, SANCTUM_LOCATION_IDS, ENCLAVE_LOCATION_IDS, NEST_LOCATION_IDS,
  HIVE_MIND_RING,
  APIARY_TOKEN_MEANINGS, CHAOS_TOKEN_FACES, apiaryChaosToken, apiaryChaosTokenValue, apiaryTokenText,
  skullValue, doomInPlay, cultistEnemyAtLocation, isHardSide,
}
export {
  setupScenario, setupLocations, modifyDeck, rotateCentralChamber, resolution4Choice,
  revealApiaryLocation, checkObjectives, resolution,
} from './behavior.js'

// 本关专用单卡条目：34 张（议程 2 / 幕 3 / 地点 14 / 敌人 4 / 剧情 3 / 剧情资产 3 / 诡计 4 ……）。
// 11553 是本关提示卡（scenario 自身），按契约不建单卡条目。
export const implementedEncounterCodes = Object.freeze([
  '11554', '11555',
  '11556', '11557', '11558',
  '11559', '11559b', '11560', '11561', '11562', '11563', '11564', '11565', '11566', '11567',
  '11568', '11569', '11570', '11571', '11572',
  '11573', '11574', '11575',
  '11576', '11577', '11578',
  '11579', '11579b', '11580', '11580b', '11581', '11581b', '11582', '11583',
])
// 真正有规则行为读点的条目（敌人/诡计/剧情资产/地点显现/幕/议程）；其余是纯数据型条目。
export const behaviorEntryCodes = Object.freeze([
  '11556', '11557', '11558', '11554', '11555',
  '11559', '11559b', '11562', '11563', '11565', '11566', '11569', '11570', '11572', '11579', '11579b',
  '11573', '11574', '11575', '11576', '11577', '11578', '11580', '11580b', '11581', '11581b', '11582', '11583',
])

export const manifest = scenarioManifest(scenario, identities, {
  campaignId: 'theDrownedCity',
  status: 'playable',
  layout,
  requiredPackIds: ['core', 'tdcCampaign'],
  requiredEncounterGroupIds: [
    'theApiary', 'cosmicLegacy', 'elderMist', 'theInescapable', 'pilgrims',
    'pentagram', 'strikingFear', 'starSpawn', 'stowaways',
  ],
  requiredInvestigatorIds: [],
  requiredMechanicIds: [],
  setAsideLocations: [...SET_ASIDE_LOCATION_IDS],
  setAsideAliases: [...SET_ASIDE_ALIASES],
  recordReads: [
    'theExpeditionHeadedWest', 'theCreatureWasDefeated', 'discoveredGlyphs', 'rlyehMap',
  ],
  recordWrites: [
    'thePilgrimsWereSaved', 'thePilgrimsWereDevoured',
    'theInvestigatorsExterminatedTheAlienParasites', 'grislyMask', 'discoveredGlyphs', 'rlyehMap',
  ],
  behaviorIds: [behavior.id],
})
manifest.contentVersion = '0.1.0'
manifest.referenceCode = '11553'
// 默认西向：移出主母、放一边玛莉亚；东向 Setup 由 behavior 改写（见文件头）。
manifest.zones.removed = [{ cardCode: MOTHER_CODE, count: 1 }]
manifest.encounterDeckByDirection = {
  west: [...ENCOUNTER_DECK_BY_DIRECTION.west],
  east: [...ENCOUNTER_DECK_BY_DIRECTION.east],
}
manifest.actCodesByDirection = { west: [...ACT_CODES_BY_DIRECTION.west], east: [...ACT_CODES_BY_DIRECTION.east] }
manifest.resolutionExits = {
  noResolution: { west: 'theGrandVault', east: 'resolution4' },
  resolution1: { default: 'theGrandVault' },
  resolution2: { default: 'theGrandVault' },
  resolution3: { default: 'resolution4' },
  resolution4: { ...RESOLUTION4_NEXT },
}
manifest.nextScenarioId = 'theGrandVault'
manifest.centralChamber = { id: CENTRAL_CHAMBER_ID, facingRing: [...FACING_RING], initialFacing: INITIAL_FACING }
manifest.directionScenarios = { west: 'theApiary', east: 'theApiary' }
manifest.skipChapterOnResolution4 = { ...RESOLUTION4_NEXT }
