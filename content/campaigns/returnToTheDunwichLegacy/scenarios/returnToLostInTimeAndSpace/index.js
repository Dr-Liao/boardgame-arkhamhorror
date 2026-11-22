// 重返迷失时空 · 章节装配。
import { scenarioManifest } from '../../../../scenario-manifest.js'
import {
  scenario, identities, SET_ASIDE_ALIASES, RECORDS, REFERENCE_CODE,
  ACT_ORDER, AGENDA_ORDER, REALMS_BEYOND, SETH_BISHOP_CODE, ACT_V2_CODE, AGENDA_V2_CODE, STAGE_CARDS,
} from './definition.js'
import { chapterGroups } from '../../shared.js'
import { behavior } from './behavior.js'
import { layout } from './layout.js'

export {
  scenario, identities, behavior, layout, REFERENCE_CODE,
  ACT_ORDER, AGENDA_ORDER, REALMS_BEYOND, SETH_BISHOP_CODE, ACT_V2_CODE, AGENDA_V2_CODE, STAGE_CARDS,
}

export const manifest = scenarioManifest(scenario, identities, {
  campaignId: 'returnToTheDunwichLegacy', status: 'playable', layout,
  requiredPackIds: ['core', 'dunwichCampaign', 'rtdwlCampaign'],
  requiredEncounterGroupIds: chapterGroups('returnToLostInTimeAndSpace'),
  requiredMechanicIds: ['dunwichEncounterEffects', 'encounterLocations', 'dimensionalLocationEffects', 'yogSothoth', 'dunwichChaosEffects'],
  setAsideAliases: SET_ASIDE_ALIASES,
  inPlayAliases: ['02323'],
  recordReads: RECORDS.reads, recordWrites: RECORDS.writes,
  behaviorIds: [behavior.id],
})
manifest.contentVersion = '1.0.0'
manifest.referenceCode = REFERENCE_CODE
