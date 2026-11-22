// 《时间阴谋》· 章节装配。
import { scenarioManifest } from '../../../../scenario-manifest.js'
import {
  scenario, identities, SET_ASIDE_ALIASES, ENCOUNTER_DECK, ACT_CODES, AGENDA_CODES,
  ERAS, REFERENCE_CODE, SCENARIO_ID,
} from './definition.js'
import { behavior } from './behavior.js'
import { layout } from './layout.js'

// 规则实现先集中在 behavior（幕/密谋/剧情链/结局/token）；敌人/诡计/资产有 scaffold 骨架，
// 待后续批次补单卡规则，不虚报 verified。
export const implementedEncounterCodes = Object.freeze([])
export const behaviorEntryCodes = Object.freeze(['87002', '87003', '87004'])

export const manifest = scenarioManifest(scenario, identities, {
  campaignId: 'machinationsThroughTime',
  status: 'playable',
  layout,
  requiredPackIds: ['core', 'mttCampaign'],
  requiredEncounterGroupIds: ['machinationsThroughTime'],
  requiredInvestigatorIds: [],
  requiredMechanicIds: [],
  setAsideLocations: [...scenario.setAsideLocations],
  setAsideAliases: [...SET_ASIDE_ALIASES],
  recordReads: ['thomasAndMaryHaveMet'],
  recordWrites: [
    'thomasAndMaryHaveMet', 'thomasAndMaryAreInspiredByNikolaTesla', 'fundingForAnObservatoryHasBegun',
    'theObservatoryIsBuilt', 'teleportationResearchHasBegun', 'corriganIndustriesHasBeenFounded',
    'thomasAndMaryHaveMadeAHistoricDiscovery', 'thomasAndMaryHaveWonANobelPrize',
    'aTreeSeedHasBeenPlanted', 'thomasAndMaryHaveMarried', 'theDebtHasBeenPaid',
  ],
  behaviorIds: [behavior.id],
})
manifest.contentVersion = '0.1.0'
manifest.referenceCode = REFERENCE_CODE
manifest.eras = [...ERAS]
manifest.actCodes = [...ACT_CODES]
manifest.agendaCodes = [...AGENDA_CODES]
manifest.epicMultiplayer = Object.freeze({ enabled: true, tables: 3, eraTables: [...ERAS] })

export {
  scenario, identities, layout, behavior, ENCOUNTER_DECK, ACT_CODES, AGENDA_CODES, ERAS,
  REFERENCE_CODE, SCENARIO_ID,
}

export default { scenario, identities, layout, behavior, manifest }
