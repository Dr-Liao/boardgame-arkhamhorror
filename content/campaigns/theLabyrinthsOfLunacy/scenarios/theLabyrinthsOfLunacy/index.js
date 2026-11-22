// 《疯狂迷宫》· 章节装配。
import { scenarioManifest } from '../../../../scenario-manifest.js'
import {
  scenario, identities, SET_ASIDE_ALIASES, ENCOUNTER_DECK, ACT_CODES, AGENDA_CODES,
  ESCAPE_ACT_CODE, GROUP_TABLE, REFERENCE_CODE, SCENARIO_ID,
} from './definition.js'
import { behavior } from './behavior.js'
import { layout } from './layout.js'

// 本关普通流程先接线幕/议程/地点/混乱袋与结局；11 张敌人/诡计条目的规则在
// src/cards/encounter-entries/theLabyrinthsOfLunacy/theLabyrinthsOfLunacy/ 下有 scaffold 骨架，
// 规则实现待后续批次（audit 前不要把它们报成 verified）。
export const implementedEncounterCodes = Object.freeze([])
export const behaviorEntryCodes = Object.freeze([
  '70048', '70050', '70052', '70053', '70054', '70055', '70056', '70057', '70058', '70060', '70061',
])

export const manifest = scenarioManifest(scenario, identities, {
  campaignId: 'theLabyrinthsOfLunacy',
  status: 'playable',
  layout,
  requiredPackIds: ['core', 'lolCampaign'],
  requiredEncounterGroupIds: ['theLabyrinthsOfLunacy'],
  requiredInvestigatorIds: [],
  requiredMechanicIds: [],
  setAsideLocations: [...scenario.setAsideLocations],
  setAsideAliases: [...SET_ASIDE_ALIASES],
  recordReads: ['currentGroup', 'playedGroups', 'escapedGroups'],
  recordWrites: [
    'currentGroup', 'miniCampaign', 'playedGroups', 'escapedGroups', 'theGroupPerished',
    'groupAOutcome', 'groupBOutcome', 'groupCOutcome',
  ],
  behaviorIds: [behavior.id],
})
manifest.contentVersion = '0.1.0'
manifest.referenceCode = REFERENCE_CODE
// 组数据供大厅/跨桌入口读取。
manifest.groups = Object.freeze(Object.fromEntries(
  Object.entries(GROUP_TABLE).map(([id, group]) => [id, Object.freeze({ ...group })])))
manifest.epicMultiplayer = Object.freeze({ enabled: true, tables: 3, groups: ['A', 'B', 'C'] })
manifest.escapeActCode = ESCAPE_ACT_CODE
manifest.actCodesByGroup = Object.freeze(Object.fromEntries(
  Object.entries(GROUP_TABLE).map(([id, group]) => [id, [...group.actCodes]])))

export {
  scenario, identities, layout, behavior, ENCOUNTER_DECK, ACT_CODES, AGENDA_CODES,
  GROUP_TABLE, REFERENCE_CODE, SCENARIO_ID,
}

export default { scenario, identities, layout, behavior, manifest }
