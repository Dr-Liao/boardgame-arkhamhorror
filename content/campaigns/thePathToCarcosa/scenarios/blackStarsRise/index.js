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
    'blackStarsRise', 'evilPortents', 'byakhee', 'inhabitantsOfCarcosa',
    'stranger', 'darkCult', 'ancientEvils',
  ],
  requiredMechanicIds: [],
  setAsideAliases: ['03088', '03300', '03300', '03301', '03301', '03281', '03282'],
  recordReads: ['vipsInterviewed', 'vipsSlain'],
  recordWrites: [
    'doubt', 'conviction', 'vipsSlain', 'youOpenedThePathBelow', 'youOpenedThePathAbove',
    'theRealmOfCarcosaMergedWithOurOwnAndHasturRulesOverThemBoth',
  ],
  behaviorIds: [behavior.id],
})
manifest.contentVersion = '1.0.0'
