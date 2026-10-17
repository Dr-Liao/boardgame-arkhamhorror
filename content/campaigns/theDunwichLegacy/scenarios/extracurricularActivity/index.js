import { scenario, identities } from './definition.js'
import { layout } from './layout.js'
import { behavior } from './behavior.js'
import { scenarioManifest } from '../../../../scenario-manifest.js'

export { scenario, identities, layout, behavior }
export const manifest = scenarioManifest(scenario, identities, {
  campaignId: 'theDunwichLegacy', status: 'playable', layout,
  requiredPackIds: ['core', 'dunwichCampaign'],
  requiredEncounterGroupIds: ['extracurricularActivity', 'sorcery', 'theBeyond', 'bishopsThralls', 'whippoorwills', 'ancientEvils', 'lockedDoors', 'agentsOfYogSothoth'],
  requiredMechanicIds: ['dunwichEncounterEffects', 'extracurricularObjectives', 'dunwichChaosEffects'],
  setAsideAliases: ['02055', '02058', '02059', '02060', '02061'],
  recordWrites: ['professorWarrenRiceWasKidnapped', 'theInvestigatorsRescuedProfessorWarrenRice',
    'theInvestigatorsFailedToSaveTheStudents', 'theStudentsWereRescued', 'theExperimentWasDefeated', 'investigatorsWereUnconsciousForSeveralHours'],
  behaviorIds: [behavior.id],
})
manifest.contentVersion = '1.0.0'
