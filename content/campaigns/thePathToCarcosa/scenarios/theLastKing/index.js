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
    'theLastKing', 'hastursGift', 'decay', 'stranger', 'ancientEvils',
  ],
  requiredMechanicIds: ['carcosaEncounterEffects', 'carcosaChaosEffects', 'lastKingBystanders'],
  setAsideAliases: ['03081', '03065', '03066', '03067', '03068', '03069'],
  inPlayAliases: ['03076a', '03077', '03078', '03079', '03080'],
  recordWrites: ['vipsInterviewed', 'vipsSlain'],
  behaviorIds: [behavior.id],
})
manifest.contentVersion = '1.0.0'
