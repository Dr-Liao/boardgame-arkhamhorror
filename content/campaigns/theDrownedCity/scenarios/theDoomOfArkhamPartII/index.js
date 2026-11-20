// 阿卡姆的毁灭 第二部分（theDoomOfArkhamPartII · 11688a）· 章节装配。
//
// 引擎钩子契约见 behavior.js 文件头。本章 status 为 development：单卡条目齐全、
// 结构/manifest/克苏鲁面板多部位/独立牌库/怒气/四档结局与最终封印勘误已接线；
// 若干卡面细节如实记为近似（见 artifacts/migration/tdc/p7/workers/scenario-epsilon.md）。
import {
  scenario, identities, CARD_DATA, SCENARIO_TEXT, RESOLUTION_KEYS,
  CHAPTER_ID, REFERENCE_CODE, ENCOUNTER_CODE, ACT_CODES, ACT_FIGHT_BACK_CODE, ACT_BANISH_HIM_CODE,
  AGENDA_CODES, AGENDA_DOOM_CODE, AGENDA_FINAL_SEAL_CODE, AGENDA_STAGES, ACT_STAGES, STAGE_CARDS,
  START_LOCATION, LOCATIONS, LOCATION_CONNECTIONS, LOCATION_COORDINATES, LOCATION_VARIANTS,
  BASE_LOCATION_IDS, ROOFTOP_LOCATION_IDS, SET_ASIDE_LOCATION_IDS, SET_ASIDE_CARDS,
  ENCOUNTER_DECK, ENCOUNTER_DECK_CODES, GATHER_GROUPS, CTHULHU_DECK, CTHULHU_DECK_ID,
  CTHULHU_BODY_CODE, CTHULHU_FACET_CODES, CTHULHU_FACET_PAIRS, CTHULHU_ENEMY_CODES,
  CTHULHU_STORY_CODES, IMPLEMENTED_ENTRY_CODES, TREACHERY_CODES, ALLY_CODES,
  RUINED_SWAP_CODES, SET_ASIDE_STAR_SPAWN_CODES, DEMOLITION_CODE, FIFTH_EYE_CODE, HOPE_FADES_CODE,
  SIGIL_REQUIRED, RUINED_LOCATION_LIMIT, CTHULHU_RAGE_MAX, CTHULHU_BANISH_RAGE_THRESHOLD,
  CTHULHU_FIGHT_BACK_RAGE_THRESHOLD,
} from './definition.js'
import { layout } from './layout.js'
import { behavior, implementedEntryFlags, scenarioSummary, setupCthulhuBoard, drawCthulhuCard } from './behavior.js'
import {
  DOOM_OF_ARKHAM_PART_II_TOKEN_MEANINGS, doomOfArkhamPartTwoChaosToken,
  doomOfArkhamPartTwoChaosTokenValue, doomOfArkhamPartTwoTokenText, skullValue,
  cthulhuRage, setCthulhuRage, increaseCthulhuRage, isHardSide, CHAOS_TOKEN_FACES,
  canDrawCthulhuFromToken, markCthulhuDrawnFromToken,
} from './chaos.js'
import { scenarioManifest } from '../../../../scenario-manifest.js'

export {
  scenario, identities, layout, behavior, implementedEntryFlags, scenarioSummary, CARD_DATA,
  SCENARIO_TEXT, RESOLUTION_KEYS, CHAPTER_ID, REFERENCE_CODE, ENCOUNTER_CODE,
  ACT_CODES, ACT_FIGHT_BACK_CODE, ACT_BANISH_HIM_CODE, AGENDA_CODES, AGENDA_DOOM_CODE,
  AGENDA_FINAL_SEAL_CODE, AGENDA_STAGES, ACT_STAGES, STAGE_CARDS, START_LOCATION,
  LOCATIONS, LOCATION_CONNECTIONS, LOCATION_COORDINATES, LOCATION_VARIANTS, BASE_LOCATION_IDS,
  ROOFTOP_LOCATION_IDS, SET_ASIDE_LOCATION_IDS, SET_ASIDE_CARDS, ENCOUNTER_DECK, ENCOUNTER_DECK_CODES,
  GATHER_GROUPS, CTHULHU_DECK, CTHULHU_DECK_ID, CTHULHU_BODY_CODE, CTHULHU_FACET_CODES,
  CTHULHU_FACET_PAIRS, CTHULHU_ENEMY_CODES, CTHULHU_STORY_CODES, IMPLEMENTED_ENTRY_CODES,
  TREACHERY_CODES, ALLY_CODES, RUINED_SWAP_CODES, SET_ASIDE_STAR_SPAWN_CODES,
  DEMOLITION_CODE, FIFTH_EYE_CODE, HOPE_FADES_CODE, SIGIL_REQUIRED, RUINED_LOCATION_LIMIT,
  CTHULHU_RAGE_MAX, CTHULHU_BANISH_RAGE_THRESHOLD, CTHULHU_FIGHT_BACK_RAGE_THRESHOLD,
  DOOM_OF_ARKHAM_PART_II_TOKEN_MEANINGS, doomOfArkhamPartTwoChaosToken,
  doomOfArkhamPartTwoChaosTokenValue, doomOfArkhamPartTwoTokenText, skullValue,
  cthulhuRage, setCthulhuRage, increaseCthulhuRage, isHardSide, CHAOS_TOKEN_FACES,
  canDrawCthulhuFromToken, markCthulhuDrawnFromToken,
  setupCthulhuBoard, drawCthulhuCard,
}

// 本章实现行为的非玩家条目：35 张（议程 2 / 幕 2 / 地点 9 / 敌人 7 / 行动卡 11 / 诡计 4）。
export const implementedEncounterCodes = [...IMPLEMENTED_ENTRY_CODES]
// 有引擎读点的条目：议程、幕、地点、克苏鲁本体/部位、行动卡（克苏鲁牌库）、诡计。
export const behaviorEntryCodes = Object.freeze([
  '11689', '11690', '11691a', '11691b',
  '11692', '11693', '11694', '11695', '11696', '11697', '11698', '11699', '11700',
  '11701', '11702', '11702b', '11703', '11703b', '11704', '11704b',
  ...CTHULHU_STORY_CODES, ...TREACHERY_CODES,
])

export const manifest = scenarioManifest(scenario, identities, {
  campaignId: 'theDrownedCity',
  status: 'playable',
  layout,
  requiredPackIds: ['core', 'tdcCampaign'],
  requiredEncounterGroupIds: [
    'theDoomOfArkhamPart2', 'domination', 'elderMist', 'tdcFlood', 'starSpawn',
    'agentsOfCthulhu', 'arkham',
  ],
  requiredInvestigatorIds: [],
  requiredMechanicIds: [],
  setAsideLocations: [...SET_ASIDE_LOCATION_IDS],
  setAsideAliases: [...SET_ASIDE_CARDS],
  recordReads: [
    'theInvestigatorsStoodTogether', 'yourAlliesHaveAPlan', 'barrierNode', 'obsidianClaw',
    'shardOfYchlecht', 'tidalTablet', 'grislyMask', 'horrorInClay', 'floodedNeighborhoods',
  ],
  recordWrites: [
    'cthulhuWasDrivenAway', 'cthulhuWasBanished', 'arkhamWasDestroyed',
    'cthulhuAnnihilatedTheCityOfArkham',
  ],
  behaviorIds: [behavior.id],
})
manifest.contentVersion = '0.1.0'
manifest.referenceCode = REFERENCE_CODE
// 克苏鲁面板：本体 + 3 张双面部位（多部位敌人原语 linkEnemyParts）。
manifest.cthulhuBoard = {
  bodyCode: CTHULHU_BODY_CODE,
  facetPairs: CTHULHU_FACET_PAIRS.map(pair => [...pair]),
  facetCodes: [...CTHULHU_FACET_CODES],
}
// 独立克苏鲁牌库（18 张 action 卡）。
manifest.scenarioDecks = [{ id: CTHULHU_DECK_ID, cards: [...CTHULHU_DECK], shuffle: true }]
manifest.finalSeal = { agendaCode: AGENDA_FINAL_SEAL_CODE, sigils: SIGIL_REQUIRED, ruinedLimit: RUINED_LOCATION_LIMIT }
manifest.errata = { ...SCENARIO_TEXT.errata }
