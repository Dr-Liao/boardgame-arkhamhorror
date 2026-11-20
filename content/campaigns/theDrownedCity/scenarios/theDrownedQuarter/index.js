// 淹没城区（theDrownedQuarter）· 章节装配。
//
// 引擎钩子契约见 behavior.js 文件头。manifest 用 scenarioManifest 组装；
// status = 'development'（P7 内容批默认状态；literalCardBehavior 等确认项未齐不写 verified）。
//
// 与主进程（Lead / campaign-core）的集成约定：
//   · 单卡条目：src/cards/encounter-entries/theDrownedCity/theDrownedQuarter/<code>.js（20 条）。
//   · 战役记录只用 CONTRACT §4 键：theExpeditionHeadedWest / barrierNode / thePowerWasDiverted /
//     discoveredGlyphs / rlyehMap。
//   · 跳章出口：结局 3 → 西向 theApiary / 东向 theWesternWall（manifest.resolutionExits 与
//     definition.NEXT_SCENARIO_IDS；manifest.nextScenarioId 给默认西向）。
//   · 需要 Lead 登记：scenarios/index.js 挂载、内容包 tdcCampaign 的 encounterGroup 清单、
//     narrative-guides 的指南源与 web/scenario-guides/theDrownedQuarter.json。
import {
  scenario, identities, CARD_DATA, SCENARIO_TEXT, RESOLUTION_KEYS, RESOLUTION_CHAIN,
  ACT_CODES, AGENDA_CODES, ACT_STAGES, AGENDA_STAGES, STAGE_CARDS,
  ENCOUNTER_DECK, ENCOUNTER_DECK_CODES, GATHER_GROUPS, LOCATIONS, LOCATION_IDS,
  START_LOCATION, SEA_FLOOR_POOL_IDS, SEA_FLOOR_CELLS, LOCATION_COORDINATES,
  SET_ASIDE_CARDS, SET_ASIDE_ALIASES, ENEMY_CODES, UNDESEA_PARASITE_CODE,
  UNDESEA_PARASITE_STORY_CODE, MEDUSA_CODE, SEAFLOOR_LEVIATHAN_CODE, OBSIDIAN_RELIC_CODE,
  OBSIDIAN_RELIC_STORY_CODE, BARRIER_NODE_CODE, NEXT_SCENARIO_IDS,
} from './definition.js'
import { layout } from './layout.js'
import { behavior, implementedEntryFlags, scenarioSummary } from './behavior.js'
import {
  DROWNED_QUARTER_TOKEN_MEANINGS, CHAOS_TOKEN_FACES, drownedQuarterChaosToken,
  drownedQuarterChaosTokenValue, drownedQuarterTokenText, skullValue, revealedLocationCount,
  investigatorFloodLevel, isHardSide,
} from './chaos.js'
import { scenarioManifest } from '../../../../scenario-manifest.js'

export {
  scenario, identities, layout, behavior, implementedEntryFlags, scenarioSummary, CARD_DATA,
  SCENARIO_TEXT, RESOLUTION_KEYS, RESOLUTION_CHAIN,
  ACT_CODES, AGENDA_CODES, ACT_STAGES, AGENDA_STAGES, STAGE_CARDS,
  ENCOUNTER_DECK, ENCOUNTER_DECK_CODES, GATHER_GROUPS, LOCATIONS, LOCATION_IDS, START_LOCATION,
  SEA_FLOOR_POOL_IDS, SEA_FLOOR_CELLS, LOCATION_COORDINATES, SET_ASIDE_CARDS, SET_ASIDE_ALIASES,
  ENEMY_CODES, UNDESEA_PARASITE_CODE, UNDESEA_PARASITE_STORY_CODE, MEDUSA_CODE,
  SEAFLOOR_LEVIATHAN_CODE, OBSIDIAN_RELIC_CODE, OBSIDIAN_RELIC_STORY_CODE, BARRIER_NODE_CODE,
  NEXT_SCENARIO_IDS,
  DROWNED_QUARTER_TOKEN_MEANINGS, CHAOS_TOKEN_FACES, drownedQuarterChaosToken,
  drownedQuarterChaosTokenValue, drownedQuarterTokenText, skullValue, revealedLocationCount,
  investigatorFloodLevel, isHardSide,
}
export { setupScenario, setupLocations, planLayout, syncBarrierCore, resolution } from './behavior.js'

// 本关专用单卡条目：20 张（议程 2 / 幕 1 / 地点 11 / 敌人 3 / 剧情 2 / 剧情资产 1 …… 见下）。
// 11536 是本关提示卡（scenario 自身），按契约不建单卡条目。
export const implementedEncounterCodes = Object.freeze([
  '11537', '11537b', '11538', '11539',
  '11540', '11540b', '11541', '11542', '11543', '11544', '11545',
  '11546', '11547', '11548',
  '11549', '11549b', '11549',
  '11550', '11550b', '11551', '11552',
].filter((code, index, list) => list.indexOf(code) === index))
// 真正有规则行为读点的条目（敌人/故事/资产/核心）；其余是数据型条目。
export const behaviorEntryCodes = Object.freeze([
  '11539', '11540', '11540b', '11549', '11549b', '11550', '11550b', '11551', '11552', '11537b',
])

export const manifest = scenarioManifest(scenario, identities, {
  campaignId: 'theDrownedCity',
  status: 'playable',
  layout,
  requiredPackIds: ['core', 'tdcCampaign'],
  requiredEncounterGroupIds: [
    'theDrownedQuarter', 'alienMachinery', 'cosmicLegacy', 'deepOnes',
    'elderMist', 'tdcFlood', 'rlyeh', 'underseaCreatures',
  ],
  requiredInvestigatorIds: [],
  requiredMechanicIds: [],
  setAsideLocations: [],
  setAsideAliases: [...SET_ASIDE_ALIASES],
  recordReads: ['theExpeditionHeadedWest', 'thePowerWasDiverted', 'discoveredGlyphs', 'rlyehMap'],
  recordWrites: ['thePowerWasDiverted', 'barrierNode', 'discoveredGlyphs', 'rlyehMap'],
  behaviorIds: [behavior.id],
})
manifest.contentVersion = '0.1.0'
manifest.referenceCode = '11536'
// 结局出口：结局 3（以及无结局/结局 1/2 的链尾）按远征方向选择下一章。
manifest.resolutionExits = {
  noResolution: { ...NEXT_SCENARIO_IDS },
  resolution1: { ...NEXT_SCENARIO_IDS },
  resolution2: { ...NEXT_SCENARIO_IDS },
  resolution3: { ...NEXT_SCENARIO_IDS },
}
manifest.nextScenarioId = NEXT_SCENARIO_IDS.west
manifest.gridLocationCount = SEA_FLOOR_CELLS.length
manifest.setAsideLocationIds = []
