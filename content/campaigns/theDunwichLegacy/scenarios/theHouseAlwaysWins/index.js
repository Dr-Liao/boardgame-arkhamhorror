import { scenario, identities } from './definition.js'
import { layout } from './layout.js'
import { behavior } from './behavior.js'
import { scenarioManifest } from '../../../../scenario-manifest.js'

export { scenario, identities, layout, behavior }
export const manifest = scenarioManifest(scenario, identities, {
  campaignId: 'theDunwichLegacy', status: 'playable', layout,
  requiredPackIds: ['core', 'dunwichCampaign'],
  requiredEncounterGroupIds: ['theHouseAlwaysWins', 'badLuck', 'naomisCrew', 'rats', 'hideousAbominations', 'strikingFear'],
  requiredMechanicIds: ['dunwichEncounterEffects', 'cloverClubGambling', 'dunwichChaosEffects'],
  setAsideAliases: ['02079', '02080', ...scenario.setAsideEncounterCards],
  inPlayAliases: ['02078'],
  recordWrites: ['drFrancisMorganWasKidnapped', 'theInvestigatorsRescuedDrFrancisMorgan',
    'naomiHasTheInvestigatorsBacks', 'oBannionGangHasABoneToPickWithTheInvestigators', 'investigatorsWereUnconsciousForSeveralHours'],
  behaviorIds: [behavior.id],
})
manifest.contentVersion = '1.0.0'
