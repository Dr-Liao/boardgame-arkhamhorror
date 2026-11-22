// 重返无人知晓 · 章节装配。
import { scenarioManifest } from '../../../../scenario-manifest.js'
import { scenario, identities, SET_ASIDE_ALIASES, RECORDS, REFERENCE_CODE } from './definition.js'
import { chapterGroups } from '../../shared.js'
import { behavior } from './behavior.js'
import { layout } from './layout.js'

export { scenario, identities, behavior, layout, REFERENCE_CODE }
export { BROOD_POOL, BROOD_PER_PLAYER, FORMULA_CODE } from './definition.js'

export const manifest = scenarioManifest(scenario, identities, {
  campaignId: 'returnToTheDunwichLegacy', status: 'playable', layout,
  requiredPackIds: ['core', 'dunwichCampaign', 'rtdwlCampaign'],
  requiredEncounterGroupIds: chapterGroups('returnToUndimensionedAndUnseen'),
  requiredMechanicIds: ['dunwichEncounterEffects', 'broodHunt', 'esotericFormula', 'broodLocationEffects', 'dunwichChaosEffects'],
  setAsideAliases: SET_ASIDE_ALIASES,
  recordReads: RECORDS.reads, recordWrites: RECORDS.writes,
  behaviorIds: [behavior.id],
})
manifest.contentVersion = '1.0.0'
manifest.referenceCode = REFERENCE_CODE
