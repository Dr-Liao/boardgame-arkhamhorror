import { scenario, identities } from './definition.js'
import { layout } from './layout.js'
import { behavior } from './behavior.js'
import { scenarioManifest } from '../../../../scenario-manifest.js'

export { scenario, identities, layout, behavior }
export const manifest = scenarioManifest(scenario, identities, {
  campaignId: 'thePathToCarcosa',
  status: 'verified',
  layout,
  requiredPackIds: ['core', 'carcosaCampaign'],
  requiredEncounterGroupIds: [
    'dimCarcosa', 'delusions', 'cultOfTheYellowSign',
    'inhabitantsOfCarcosa', 'strikingFear',
  ],
  requiredMechanicIds: [],
  setAsideAliases: [
    '03059', '03088', '03332', '03333', '03334',
    '03326c', '03327c', '03327e', '03328c', '03328e', '03329c',
  ],
  recordReads: [
    'doubt', 'conviction', 'chasingTheStranger', 'youOpenedThePathBelow', 'youOpenedThePathAbove',
  ],
  recordWrites: [
    'possessed', 'theInvestigatorsPreventedHasturFromEscapingHisPrison',
    'theRealmOfCarcosaMergedWithOurOwnAndHasturRulesOverThemBoth', 'hasturHasYouInHisGrasp',
  ],
  behaviorIds: [behavior.id],
})
manifest.contentVersion = '1.0.0'
