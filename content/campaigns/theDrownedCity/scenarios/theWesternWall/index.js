// 西墙（theWesternWall）· 章节装配。
//
// 引擎钩子契约见 behavior.js 文件头；真实引擎读点：startLocation / preScenarioSetup /
// setupLocations / locationPlaced / locationRevealed / afterDeckSetup / beforeMove /
// locationEntered / actions + performAction / enemySpawned / enemyMoved / roundEnded /
// actReveal / agendaReveal / checkObjectives / resolveChaosToken / applyTokenEffect /
// testAutoFail / resolution。
import {
  scenario, identities, CARD_DATA, SCENARIO_TEXT, RESOLUTION_KEYS, RESOLUTION3_CHAPTERS,
  NEXT_CHAPTER_EAST, ENCOUNTER_DECK, ENCOUNTER_DECK_CODES, ENCOUNTER_GROUPS, EXPEDITION_GROUP,
  LOCATIONS, LOCATION_TABLE, LOCATION_CODES, LOCATION_COORDINATES,
  LEVEL_BY_LOCATION, COLUMN_BY_LOCATION, LEVEL_UPPER_SLOTS, LEVEL_BOTTOM_SLOTS,
  PATH_LOCATION_IDS, SPECIAL_LOCATION_IDS, REMOVED_PATH_COUNT, REMOVED_STAR_SPAWN_CODES,
  SET_ASIDE_ALIASES, SET_ASIDE_LOCATION_IDS, START_LOCATION_WEST, START_LOCATION_EAST,
  ACT_WEST_CODE, ACT_EAST_CODE, ACT_CODES, ACT_STAGES, ACTS, AGENDA_CODE, AGENDA_CODES,
  AGENDA_STAGES, AGENDAS, STAGE_CARDS, FLOOD_SETUP, DO_NO_HARM_TASK_CODES, HUNTING_PARASITE_CODE,
} from './definition.js'
import { layout, CONNECTIONS } from './layout.js'
import { behavior, scenarioSummary, implementedEntryFlags } from './behavior.js'
import {
  THE_WESTERN_WALL_TOKEN_MEANINGS, theWesternWallChaosToken, theWesternWallTokenValue,
  theWesternWallTokenText, locationLevel, floodLevelOf, isFullyFlooded, isFlooded, isHardSide,
  testAutoFail as chaosTestAutoFail, CHAOS_TOKEN_FACES, tierOf, FLOOD_LEVELS,
} from './chaos.js'
import { scenarioManifest } from '../../../../scenario-manifest.js'

// 本章 20 张专属卡条目（11517 是提示卡本身，不建条目）。
export const implementedEncounterCodes = Object.freeze([
  '11518', '11519', '11520',
  '11521', '11522', '11523', '11524', '11525', '11526', '11527', '11528', '11529', '11530',
  '11531', '11531b', '11532', '11532b', '11533', '11534', '11535',
])
// 真正有规则读点的条目：议程 1 / 幕 2 / 地点 13（含 11531b/11532b 剧情面）/ 敌人 2 / 诡计 1。
export const behaviorEntryCodes = Object.freeze([
  '11518', '11519', '11520',
  '11521', '11522', '11523', '11524', '11525', '11526', '11527', '11528', '11529', '11530',
  '11531', '11531b', '11532', '11532b', '11533',
])

export const manifest = scenarioManifest(scenario, identities, {
  campaignId: 'theDrownedCity',
  status: 'development',
  layout,
  requiredPackIds: ['core', 'tdcCampaign'],
  // 只列 core / tdcCampaign 两个包已登记的组 id；Agents of Cthulhu（01181/01182）
  // 在 core 包里但没有被登记成组，见 artifacts 报告的集成请求。
  requiredEncounterGroupIds: [
    'theWesternWall', 'cosmicLegacy', 'deepOnes', 'tdcFlood', 'rlyeh',
    'starSpawn', 'theInescapable', 'underseaCreatures',
  ],
  requiredInvestigatorIds: [],
  requiredMechanicIds: [],
  setAsideLocations: [...SET_ASIDE_LOCATION_IDS],
  setAsideAliases: [...SET_ASIDE_ALIASES],
  recordReads: ['theExpeditionHeadedWest', 'theExpeditionHeadedEast', 'theExpeditionHelpedThePilgrim', 'theExpeditionLeftThePilgrim', 'rlyehMap'],
  // 本模块实际写入：Do No Harm 选择（helped/left）、拉莱耶地图划除、发现/翻译的符文。
  recordWrites: ['theExpeditionHelpedThePilgrim', 'theExpeditionLeftThePilgrim', 'rlyehMap', 'discoveredGlyphs'],
  behaviorIds: [behavior.id],
})
manifest.contentVersion = '0.1.0'
// 契约 §6 的结局键顺序（noResolution, resolution1, resolution2, resolution3）。
manifest.resolutionIds = [...RESOLUTION_KEYS]
manifest.referenceCode = '11517'
// 从游戏中移出：星之眷族另外 3 张敌人（固定）。行走路线随机移出 2 张，静态 zone 不虚报。
manifest.zones.removed = REMOVED_STAR_SPAWN_CODES.map(cardCode => ({ cardCode, count: 1 }))
manifest.fiveLevelMap = Object.freeze({
  levels: Object.freeze([1, 2, 3, 4, 5]),
  levelCounts: Object.freeze({ 1: 1, 2: 1, 3: 2, 4: 3, 5: 3 }),
  adjacency: 'rows',
  sameRowConnected: false,
})
manifest.initialFlood = FLOOD_SETUP.west
manifest.dynamicEncounterGroups = Object.freeze([EXPEDITION_GROUP])
// 集成备注：Agents of Cthulhu（01181/01182）在 core 包里，但 pack.encounterGroupIds 没有登记
// agentsOfCthulhu；该组仍按 Haskell 进入遭遇牌库，requiredEncounterGroupIds 里暂不声明（否则包门禁报缺组）。
manifest.requiredEncounterGroupWarnings = Object.freeze([
  'Agents of Cthulhu 组未在 packs/manifests.js 的 core.encounterGroupIds 登记；需 Lead 决定补登记后再写进 requiredEncounterGroupIds。',
])

export {
  scenario, identities, layout, behavior, CARD_DATA, SCENARIO_TEXT, RESOLUTION_KEYS, RESOLUTION3_CHAPTERS,
  NEXT_CHAPTER_EAST, ENCOUNTER_DECK, ENCOUNTER_DECK_CODES, ENCOUNTER_GROUPS, EXPEDITION_GROUP,
  LOCATIONS, LOCATION_TABLE, LOCATION_CODES, LOCATION_COORDINATES,
  LEVEL_BY_LOCATION, COLUMN_BY_LOCATION, LEVEL_UPPER_SLOTS, LEVEL_BOTTOM_SLOTS,
  PATH_LOCATION_IDS, SPECIAL_LOCATION_IDS, REMOVED_PATH_COUNT, REMOVED_STAR_SPAWN_CODES,
  SET_ASIDE_ALIASES, SET_ASIDE_LOCATION_IDS, START_LOCATION_WEST, START_LOCATION_EAST,
  ACT_WEST_CODE, ACT_EAST_CODE, ACT_CODES, ACT_STAGES, ACTS, AGENDA_CODE, AGENDA_CODES,
  AGENDA_STAGES, AGENDAS, STAGE_CARDS, FLOOD_SETUP, DO_NO_HARM_TASK_CODES, HUNTING_PARASITE_CODE,
  CONNECTIONS, scenarioSummary, implementedEntryFlags,
  THE_WESTERN_WALL_TOKEN_MEANINGS, theWesternWallChaosToken, theWesternWallTokenValue,
  theWesternWallTokenText, locationLevel, floodLevelOf, isFullyFlooded, isFlooded, isHardSide,
  chaosTestAutoFail, CHAOS_TOKEN_FACES, tierOf, FLOOD_LEVELS,
}

export default { scenario, identities, layout, behavior, manifest, CARD_DATA }
