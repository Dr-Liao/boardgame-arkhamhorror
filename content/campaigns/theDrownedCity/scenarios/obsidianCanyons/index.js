// 黑曜石峡谷（obsidianCanyons）· 章节装配（P7 development）。
//
// 引擎钩子契约见 behavior.js 文件头；真实引擎读点：preScenarioSetup / setupLocations /
// locationPlaced / locationRevealed / modifyDeck / afterDeckSetup / roundEnded / turnBegins /
// turnEnded / actions + performAction / afterInvestigate / movementError / enemyAttackResolved /
// actReveal / agendaReveal / checkObjectives / allResigned / resolveChaosToken / applyTokenEffect /
// resolution。
//
// 与 campaign-core 的接线约定：`scenario.acts` 是两条远征分支的并集（静态注册看不到战役记录），
// behavior.prepareScenario 按 records.theExpeditionHeadedWest 选择实际幕/议程牌库；
// `manifest.expeditionBranches` 给出两条分支的实际放一边/移除/牌库差异，静态 zones 以 v.I（西征）为准。
import {
  scenario, identities, CARD_DATA, LOCATION_IDS, LOCATION_CODE, LOCATION_COORDINATES, LOCATION_OPTIONS,
  LOCATIONS, START_LOCATION, START_LOCATION_IDS, SUMMIT_LOCATION_IDS, IMMOVABLE_LOCATION_IDS,
  ACT_STAGES, AGENDA_STAGES, STAGE_CARDS, ACTS, AGENDAS,
  ENCOUNTER_DECK, ENCOUNTER_DECK_CODES, COMMON_GATHER_GROUPS, GATHER_GROUPS,
  EXPEDITIONS, SET_ASIDE_CARDS, SET_ASIDE_LOCATION_IDS, STAR_SPAWN_SET_ASIDE_CODES, INESCAPABLE_SET_CODES,
  OPEN_SKY_POOL_IDS, RESOLUTION_KEYS, RESOLUTIONS, WEST_ACT_CODES, EAST_ACT_CODES,
  WEST_AGENDA_CODE, EAST_AGENDA_CODE, WEST_WINDS_CODE, EAST_WINDS_CODE,
  ACT_TWO_LAYOUT, ACT_THREE_LAYOUT, INITIAL_OPEN_SKY_CELLS, INITIAL_FILL_CELLS, START_CELL,
  GLYPH_BY_LOCATION, ERODED_FRIEZE_CODE, SKY_RELIC_CODE, OBSIDIAN_CLAW_CODES,
  PRIMEVAL_TERROR_CODE, STAR_VAMPIRE_CODE, INESCAPABLE_CODE, STAR_SPAWN_CODES,
} from './definition.js'
import { layout } from './layout.js'
import { behavior, implementedEntryFlags, scenarioSummary, branchOf, expeditionOf } from './behavior.js'
import {
  OBSIDIAN_TOKEN_MEANINGS, obsidianCanyonChaosToken, obsidianCanyonChaosTokenValue, skullValue,
  tabletValue, stormIntensity, isHardSide, adjacentOpenSkyCount, OPEN_SKY_CODE, CHAOS_TOKEN_FACES,
} from './chaos.js'
import { scenarioManifest } from '../../../../scenario-manifest.js'

export {
  scenario, identities, layout, behavior, implementedEntryFlags, scenarioSummary, CARD_DATA,
  LOCATION_IDS, LOCATION_CODE, LOCATION_COORDINATES, LOCATION_OPTIONS, LOCATIONS,
  START_LOCATION, START_LOCATION_IDS, SUMMIT_LOCATION_IDS, IMMOVABLE_LOCATION_IDS,
  ACT_STAGES, AGENDA_STAGES, STAGE_CARDS, ACTS, AGENDAS, WEST_ACT_CODES, EAST_ACT_CODES,
  WEST_AGENDA_CODE, EAST_AGENDA_CODE, WEST_WINDS_CODE, EAST_WINDS_CODE,
  ENCOUNTER_DECK, ENCOUNTER_DECK_CODES, COMMON_GATHER_GROUPS, GATHER_GROUPS, EXPEDITIONS,
  SET_ASIDE_CARDS, SET_ASIDE_LOCATION_IDS, STAR_SPAWN_SET_ASIDE_CODES, INESCAPABLE_SET_CODES,
  OPEN_SKY_POOL_IDS, RESOLUTION_KEYS, RESOLUTIONS, ACT_TWO_LAYOUT, ACT_THREE_LAYOUT,
  INITIAL_OPEN_SKY_CELLS, INITIAL_FILL_CELLS, START_CELL, GLYPH_BY_LOCATION,
  ERODED_FRIEZE_CODE, SKY_RELIC_CODE, OBSIDIAN_CLAW_CODES, PRIMEVAL_TERROR_CODE, STAR_VAMPIRE_CODE,
  INESCAPABLE_CODE, STAR_SPAWN_CODES, OPEN_SKY_CODE,
  OBSIDIAN_TOKEN_MEANINGS, obsidianCanyonChaosToken, obsidianCanyonChaosTokenValue, skullValue,
  tabletValue, stormIntensity, isHardSide, adjacentOpenSkyCount, CHAOS_TOKEN_FACES,
  branchOf, expeditionOf,
}

// 本章实现行为的非玩家条目：37 张（地点 21 / 幕 5 / 议程 2 / 敌人 2 / 诡计 5 / 剧情资产 5 / 风 2）。
// 11639 是本关提示卡（scenario 自身，按 chapter-inventory 不建单卡条目）。
export const implementedEncounterCodes = Object.freeze([
  '11640', '11640b', '11641', '11642', '11643', '11644', '11645', '11646', '11647',
  '11648', '11649', '11650', '11651', '11652', '11653', '11654', '11655', '11656', '11657',
  '11658', '11659', '11660', '11661', '11662', '11662b', '11663', '11663b', '11664', '11664b',
  '11665', '11666', '11667', '11669', '11670', '11671', '11672a', '11672b',
])
// 有明确引擎读点（behavior 钩子）的条目；其余是数据型条目（数值/身份来自卡表）。
export const behaviorEntryCodes = Object.freeze([
  '11640', '11640b', '11641', '11642', '11643', '11644', '11645', '11646', '11647',
  '11648', '11649', '11650', '11651', '11652', '11653', '11654', '11655', '11656', '11657',
  '11658', '11659', '11660', '11661', '11662', '11665', '11666', '11667', '11669', '11670', '11671',
  '11672a', '11672b',
])

// v.I（西征）静态基线：CONTRACT §6 的结局键；两条分支差异见 manifest.expeditionBranches。
export const manifest = scenarioManifest(scenario, identities, {
  campaignId: 'theDrownedCity',
  status: 'development',
  layout,
  requiredPackIds: ['core', 'tdcCampaign'],
  requiredEncounterGroupIds: [
    'obsidianCanyons', 'cosmicLegacy', 'elderMist', 'rlyeh', 'nightgaunts',
    'starSpawn', 'theInescapable', 'chillingCold', 'strikingFear', 'ancientEvils',
  ],
  requiredInvestigatorIds: [],
  requiredMechanicIds: [],
  setAsideLocations: [...SET_ASIDE_LOCATION_IDS],
  setAsideAliases: [
    ...SET_ASIDE_CARDS, ...STAR_SPAWN_SET_ASIDE_CODES, ...INESCAPABLE_SET_CODES,
    ...EXPEDITIONS.west.openSkyCodes,
  ],
  recordReads: [
    'theExpeditionHeadedWest', 'theExpeditionHeadedEast', 'theCreatureWasDefeated',
    'helpedWithTheRopes', 'wasHelpedWithTheRopes',
  ],
  recordWrites: [
    'obsidianClaw', 'rlyehMap', 'helpedWithTheRopes', 'wasHelpedWithTheRopes',
    'discoveredGlyphs',
  ],
  behaviorIds: [behavior.id],
})
manifest.contentVersion = '0.1.0'
manifest.referenceCode = '11639'
// 两条远征分支的差异（静态 zones 以 v.I 为准；v.II 在 setup 时由 behavior 现算）。
manifest.expeditionBranches = {
  west: {
    label: EXPEDITIONS.west.label,
    actCodes: [...EXPEDITIONS.west.actCodes],
    agendaCode: EXPEDITIONS.west.agendaCode,
    windsStoryCode: EXPEDITIONS.west.storyCode,
    removedLocationCodes: EXPEDITIONS.west.removedLocationIds.map(id => LOCATION_CODE[id]),
    asideLocationCodes: EXPEDITIONS.west.asideLocationIds.map(id => LOCATION_CODE[id]),
    openSkyCodes: [...EXPEDITIONS.west.openSkyCodes],
    openSkyCards: EXPEDITIONS.west.openSkyCodes.length,
    removeStarSpawn: EXPEDITIONS.west.removeStarSpawn,
    inescapable: EXPEDITIONS.west.inescapable,
    encounterDeckCodes: ['11745', '11745', '11745'],
  },
  east: {
    label: EXPEDITIONS.east.label,
    actCodes: [...EXPEDITIONS.east.actCodes],
    agendaCode: EXPEDITIONS.east.agendaCode,
    windsStoryCode: EXPEDITIONS.east.storyCode,
    removedLocationCodes: EXPEDITIONS.east.removedLocationIds.map(id => LOCATION_CODE[id]),
    asideLocationCodes: EXPEDITIONS.east.asideLocationIds.map(id => LOCATION_CODE[id]),
    openSkyCodes: [...EXPEDITIONS.east.openSkyCodes],
    openSkyCards: EXPEDITIONS.east.openSkyCodes.length,
    removeStarSpawn: EXPEDITIONS.east.removeStarSpawn,
    inescapable: EXPEDITIONS.east.inescapable,
    encounterDeckCodes: [],
  },
}
// 峰顶牌库（独立牌库 summit，从底抽）：静态登记候选地点码，数量=物理张数。
manifest.summitLocationDeck = {
  deckId: 'summit',
  from: 'bottom',
  candidateCodes: LOCATION_IDS.filter(id => !['rlyehStreets', 'centralSpire'].includes(id)
    && !EXPEDITIONS.west.removedLocationIds.includes(id)
    && !EXPEDITIONS.west.asideLocationIds.includes(id)).map(id => LOCATION_CODE[id]),
  openSkyPoolIds: [...OPEN_SKY_POOL_IDS],
  initialOpenSkyCells: [...INITIAL_OPEN_SKY_CELLS],
  actRebuilds: { act1: ACT_TWO_LAYOUT, act2: ACT_THREE_LAYOUT },
}
