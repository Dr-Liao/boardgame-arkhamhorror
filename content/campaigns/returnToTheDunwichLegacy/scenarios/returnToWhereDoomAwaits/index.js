// 重返毁灭之地 · 章节装配。
import { scenarioManifest } from '../../../../scenario-manifest.js'
import { scenario, identities, SET_ASIDE_ALIASES, RECORDS, REFERENCE_CODE } from './definition.js'
import { chapterGroups } from '../../shared.js'
import { behavior } from './behavior.js'
import { layout } from './layout.js'

export { scenario, identities, behavior, layout, REFERENCE_CODE }
export { DIVERGING_POOL, ALTERED_POOL, NAOMI_CODE } from './definition.js'

export const manifest = scenarioManifest(scenario, identities, {
  campaignId: 'returnToTheDunwichLegacy', status: 'playable', layout,
  requiredPackIds: ['core', 'dunwichCampaign', 'rtdwlCampaign'],
  requiredEncounterGroupIds: chapterGroups('returnToWhereDoomAwaits'),
  requiredMechanicIds: ['dunwichEncounterEffects', 'divergingPaths', 'hillLocationEffects', 'dunwichChaosEffects'],
  setAsideAliases: SET_ASIDE_ALIASES,
  recordReads: RECORDS.reads, recordWrites: RECORDS.writes,
  behaviorIds: [behavior.id],
})
manifest.contentVersion = '1.0.0'
manifest.referenceCode = REFERENCE_CODE
