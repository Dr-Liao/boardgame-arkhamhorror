import { scenario, identities } from './definition.js'
import { layout } from './layout.js'
import { behavior, implementedEncounterCodes } from './behavior.js'
import { scenarioManifest } from '../../../../scenario-manifest.js'

export { scenario, identities, layout, behavior, implementedEncounterCodes }
export const manifest = scenarioManifest(scenario, identities, {
  campaignId: 'theForgottenAge',
  status: 'playable',
  layout,
  requiredPackIds: ['core', 'tfaCampaign'],
  requiredEncounterGroupIds: [
    'theCityOfArchives', 'agentsOfYogSothoth', 'lockedDoors', 'chillingCold', 'strikingFear',
  ],
  // 本章用到补给（挂坠）判定；毒素/复仇/远古遗物不出现。
  requiredMechanicIds: ['tfaSupplies'],
  setAsideLocations: ['greatLibrary', 'yithianOrrery', 'laboratory', 'deconstructionRoom', 'towersOfPnakotus'],
  setAsideAliases: ['04256', '04264', '04264', '04264', '04264'],
  recordReads: [
    'theInvestigatorsCooperatedWithTheYithians', 'theInvestigatorsResistedCaptivity',
  ],
  recordWrites: [
    'theInvestigatorsCooperatedWithTheYithians', 'theInvestigatorsResistedCaptivity',
    'theInvestigatorsHadTheirMemoriesExpunged', 'theProcessWasPerfected',
    'theProcessWasSuccessful', 'theProcessBackfired', 'theProcessBackfiredSpectacularly',
  ],
  behaviorIds: [behavior.id],
})
manifest.contentVersion = '1.0.0'
