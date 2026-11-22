// 重返午夜假面（returnToTheMidnightMasks · 50025）· 章节装配。
//
// 引擎钩子契约见 behavior.js 文件头；注册期契约见 content/schema.js 与 content/scenario-manifest.js。
// 本文件只导出章节数据/行为/manifest；content/registered.js 的注册由主进程统一完成。
import {
  scenario, identities, CARD_DATA, SCENARIO_TEXT, SCENARIO_ACT_TEXT, RESOLUTION_KEYS,
  ENCOUNTER_DECK, ENCOUNTER_DECK_CODES, ENCOUNTER_GROUP_IDS, CULTIST_GROUP_IDS, CULTIST_DECK_CODES,
  CULTIST_DECK_REMOVE, LOCATIONS, LOCATION_TABLE, LOCATION_COORDINATES, LOCATION_IDS,
  VARIANT_LOCATION_IDS, ARKHAM_LOCATION_IDS, START_LOCATION, RIVERTOWN_IF_BURNED,
  ACT_CODES, ACT1_CODE, AGENDA1_BASE_CODE, AGENDA1_RETURN_CODE, AGENDA1_LINKED_CODE, NAROGATH_CODE,
  AGENDA2_CODE, AGENDA_CODES, ACT_STAGES, AGENDAS, ACTS, AGENDA_VARIANTS, STAGE_CARDS,
  ENEMY_SPAWN_LOCATIONS, GHOUL_PRIEST_CODE, LITA_CODE,
} from './definition.js'
import { layout, CONNECTIONS } from './layout.js'
import { behavior, scenarioSummary, implementedEntryFlags, currentAgendaCode } from './behavior.js'
import { scenarioManifest } from '../../../../scenario-manifest.js'
import { sharedEncounterIdentities } from '../../../../packs/shared-identities.js'

// 本章有规则读点的 50xxx 卡条目：诡计 50031，异教徒 50044/50045/50046。
export const implementedEncounterCodes = Object.freeze(['50031', '50044', '50045', '50046'])

export const manifest = scenarioManifest(scenario, identities, {
  campaignId: 'returnToNightOfTheZealot',
  status: 'playable',
  layout,
  sharedIdentities: sharedEncounterIdentities,
  requiredPackIds: ['core', 'notz', 'rtnotzCampaign'],
  requiredEncounterGroupIds: [
    'returnToTheMidnightMasks', 'theMidnightMasks', 'chillingCold', 'nightgaunts', 'lockedDoors',
    'theDevourersCult', 'returnCult',
  ],
  requiredInvestigatorIds: [],
  requiredMechanicIds: [],
  setAsideLocations: [],
  // 异教徒牌堆（scenario.cultistDeck）与议程背面生成的敌人属于「放一边/场外」区；
  // 50041/50042 在遭遇牌库里，不能再声明为放一边。
  setAsideAliases: [NAROGATH_CODE, '01121b'],
  recordReads: ['houseBurned', 'ghoulPriestAlive'],
  recordWrites: ['cultistsInterrogated', 'cultistsEscaped', 'ghoulPriestAlive', 'pastMidnight'],
  behaviorIds: [behavior.id],
})
manifest.contentVersion = '0.1.0'
manifest.referenceCode = '50025'
// 密谋 1 两版二选一：静态声明默认重返版（50026a），另一版在 preScenarioSetup/Setup 随机切换。
manifest.agendaVariants = Object.freeze({
  default: [`agenda${AGENDA1_RETURN_CODE}`, `agenda${AGENDA2_CODE}`],
  alternate: [`agenda${AGENDA1_BASE_CODE}`, `agenda${AGENDA2_CODE}`],
  randomChoice: true,
})
manifest.requiredEncounterGroupWarnings = Object.freeze([])

export {
  scenario, identities, layout, behavior, CARD_DATA, SCENARIO_TEXT, SCENARIO_ACT_TEXT, RESOLUTION_KEYS,
  ENCOUNTER_DECK, ENCOUNTER_DECK_CODES, ENCOUNTER_GROUP_IDS, CULTIST_GROUP_IDS, CULTIST_DECK_CODES,
  CULTIST_DECK_REMOVE, LOCATIONS, LOCATION_TABLE, LOCATION_COORDINATES, LOCATION_IDS,
  VARIANT_LOCATION_IDS, ARKHAM_LOCATION_IDS, START_LOCATION, RIVERTOWN_IF_BURNED,
  ACT_CODES, ACT1_CODE, AGENDA1_BASE_CODE, AGENDA1_RETURN_CODE, AGENDA1_LINKED_CODE, NAROGATH_CODE,
  AGENDA2_CODE, AGENDA_CODES, ACT_STAGES, AGENDAS, ACTS, AGENDA_VARIANTS, STAGE_CARDS,
  CONNECTIONS, ENEMY_SPAWN_LOCATIONS, GHOUL_PRIEST_CODE, LITA_CODE,
  scenarioSummary, implementedEntryFlags, currentAgendaCode,
}

export default { scenario, identities, layout, behavior, manifest, CARD_DATA }
