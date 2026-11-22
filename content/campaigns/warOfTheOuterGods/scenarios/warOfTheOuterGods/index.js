// 外神之战（warOfTheOuterGods）· 章节装配。
//
// 引擎钩子契约见 behavior.js 文件头；真实引擎读点：startLocation / preScenarioSetup / setupLocations /
// locationPlaced / afterDeckSetup / actions + performAction / actReveal / agendaReveal / agendaWouldAdvance /
// phaseBegan / checkObjectives / spawnLocation / enemySpawned / enemyDefeated / resolveChaosToken /
// applyTokenEffect / tokenMeanings / resolution。
import {
  scenario, identities, CARD_DATA, SCENARIO_TEXT, LOCATION_TABLE, LOCATION_COORDINATES,
  STATIC_CONNECTIONS, HUB_CONNECTIONS, ENCOUNTER_DECK, ENCOUNTER_DECK_CODES, ENCOUNTER_GROUPS,
  SET_ASIDE_ALIASES, SET_ASIDE_CODES, ACT_CODES, AGENDA_CODES, ACT_STAGES, AGENDA_STAGES,
  ACTS, INITIAL_AGENDAS, AGENDAS, STAGE_CARDS, RESOLUTION_KEYS, START_LOCATION, HUB_CODE,
  FACTION_KEYS, FACTION_LABEL, FACTION_AGENDA_CODES, FACTION_FINAL_AGENDA, FACTION_ANCIENT_ONE,
  FACTION_ENEMIES, FACTION_TREACHERIES, STORY_ASSET_CODES, ANCIENT_ONE_CODES, FINAL_AGENDA_CODES,
  RITUAL_SITE_IDS,
} from './definition.js'
import { layout, CONNECTIONS } from './layout.js'
import { behavior, scenarioSummary } from './behavior.js'
import { scenarioManifest } from '../../../../scenario-manifest.js'

// 本关 Act/Agenda/地点/敌人/诡计/故事资产的行为全部由 behavior.js 钩子承载（数据卡在 definition 声明），
// 因此不建非玩家条目文件：implementedEncounterCodes 为空是**静态数据卡**口径（SCOPE §4.8）。
export const implementedEncounterCodes = Object.freeze([])
export const behaviorEntryCodes = Object.freeze([])

export const manifest = scenarioManifest(scenario, identities, {
  campaignId: 'warOfTheOuterGods',
  status: 'playable',
  layout,
  requiredPackIds: ['core', 'wogCampaign'],
  requiredEncounterGroupIds: [...ENCOUNTER_GROUPS],
  requiredInvestigatorIds: [],
  requiredMechanicIds: [],
  setAsideAliases: [...SET_ASIDE_ALIASES],
  recordReads: [],
  recordWrites: [
    'preventedAllOuterGods', 'theSwarmOfEzelScattered', 'silenusBanished', 'maghanArkatDestroyed',
    'redFactionWon', 'blueFactionWon', 'greenFactionWon',
  ],
  behaviorIds: [behavior.id],
})
manifest.contentVersion = '0.1.0'
manifest.referenceCode = '86001'

export {
  scenario, identities, layout, behavior, CARD_DATA, SCENARIO_TEXT,
  LOCATION_TABLE, LOCATION_COORDINATES, STATIC_CONNECTIONS, HUB_CONNECTIONS, ENCOUNTER_DECK,
  ENCOUNTER_DECK_CODES, ENCOUNTER_GROUPS, SET_ASIDE_ALIASES, SET_ASIDE_CODES,
  ACT_CODES, AGENDA_CODES, ACT_STAGES, AGENDA_STAGES, ACTS, INITIAL_AGENDAS, AGENDAS, STAGE_CARDS,
  RESOLUTION_KEYS, START_LOCATION, HUB_CODE, FACTION_KEYS, FACTION_LABEL, FACTION_AGENDA_CODES,
  FACTION_FINAL_AGENDA, FACTION_ANCIENT_ONE, FACTION_ENEMIES, FACTION_TREACHERIES,
  STORY_ASSET_CODES, ANCIENT_ONE_CODES, FINAL_AGENDA_CODES, RITUAL_SITE_IDS,
  scenarioSummary,
}

export default { scenario, identities, layout, behavior, manifest, CARD_DATA }
