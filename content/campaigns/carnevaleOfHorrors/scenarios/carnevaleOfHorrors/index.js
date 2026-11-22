// 恐怖狂欢节（carnevaleOfHorrors）· 章节装配。
//
// 引擎钩子契约见 behavior.js 文件头；真实引擎读点：startLocation / preScenarioSetup / setupLocations /
// locationPlaced / afterDeckSetup / actions + performAction / actReveal / agendaReveal /
// agendaWouldAdvance / phaseBegan / checkObjectives / enemySpawned / enemyDefeated /
// resolveChaosToken / applyTokenEffect / tokenMeanings / resolution。
import {
  scenario, identities, CARD_DATA, SCENARIO_TEXT, LOCATIONS, LOCATION_TABLE, LOCATION_COORDINATES,
  STATIC_CONNECTIONS, RING_ORDER, ENCOUNTER_DECK, ENCOUNTER_DECK_CODES, ENCOUNTER_GROUPS,
  SET_ASIDE_ALIASES, SET_ASIDE_CODES, ACT_CODES, AGENDA_CODES, ACT_STAGES, AGENDA_STAGES, ACTS, AGENDAS,
  STAGE_CARDS, RESOLUTION_KEYS, START_LOCATION, CANAL_SIDE,
  CNIDATHQUA_CODE, MASKED_GOER_CODE, INNOCENT_REVELER_CODE, ABBESS_CODE, WRITHING_APPENDAGE_CODE,
  BALEFUL_REVELER_CODE, GONDOLA_CODE, MASK_CODES,
} from './definition.js'
import { layout, CONNECTIONS } from './layout.js'
import { behavior, scenarioSummary, implementedEntryFlags } from './behavior.js'
import { scenarioManifest } from '../../../../scenario-manifest.js'

// 本关 39 张非玩家条目（82001 是提示卡本身，不建条目）。
export const implementedEncounterCodes = Object.freeze([
  '82002', '82002b', '82003', '82004', '82005', '82006', '82006b', '82007',
  '82008', '82009', '82010', '82011', '82012', '82013', '82014', '82015', '82016',
  '82017', '82017b', '82018', '82019', '82020', '82021', '82022', '82023', '82024', '82025', '82026',
  '82027', '82028', '82029', '82030', '82031', '82032', '82033', '82034', '82035', '82036', '82037',
])
export const behaviorEntryCodes = Object.freeze([
  '82002', '82003', '82004', '82005', '82006', '82007',
  '82017b', '82021', '82022', '82027', '82030',
])

export const manifest = scenarioManifest(scenario, identities, {
  campaignId: 'carnevaleOfHorrors',
  status: 'playable',
  layout,
  requiredPackIds: ['core', 'cohCampaign'],
  requiredEncounterGroupIds: [...ENCOUNTER_GROUPS],
  requiredInvestigatorIds: [],
  requiredMechanicIds: [],
  setAsideAliases: [...SET_ASIDE_ALIASES],
  recordReads: [],
  recordWrites: [
    'manyWereSacrificedToCnidathquaDuringTheCarnivale',
    'theSunBanishedCnidathquaIntoTheDepths',
    'cnidathquaRetreatedToNurseItsWounds',
    'theInvestigatorsKeptTheirMasks',
  ],
  behaviorIds: [behavior.id],
})
manifest.contentVersion = '0.1.0'
manifest.referenceCode = '82001'

export {
  scenario, identities, layout, behavior, CARD_DATA, SCENARIO_TEXT,
  LOCATIONS, LOCATION_TABLE, LOCATION_COORDINATES, STATIC_CONNECTIONS, CONNECTIONS, RING_ORDER,
  ENCOUNTER_DECK, ENCOUNTER_DECK_CODES, ENCOUNTER_GROUPS, SET_ASIDE_ALIASES, SET_ASIDE_CODES,
  ACT_CODES, AGENDA_CODES, ACT_STAGES, AGENDA_STAGES, ACTS, AGENDAS, STAGE_CARDS, RESOLUTION_KEYS,
  START_LOCATION, CANAL_SIDE,
  CNIDATHQUA_CODE, MASKED_GOER_CODE, INNOCENT_REVELER_CODE, ABBESS_CODE, WRITHING_APPENDAGE_CODE,
  BALEFUL_REVELER_CODE, GONDOLA_CODE, MASK_CODES,
  scenarioSummary, implementedEntryFlags,
}

export default { scenario, identities, layout, behavior, manifest, CARD_DATA }
