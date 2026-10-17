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
  requiredEncounterGroupIds: ['thePallidMask', 'ghouls', 'hauntings', 'chillingCold'],
  requiredMechanicIds: ['carcosaEncounterEffects', 'carcosaDoubtConviction', 'carcosaChaosEffects', 'catacombsDeck'],
  setAsideAliases: ['03059', '03256', '03257'],
  recordReads: [
    'youDidNotEscapeTheGazeOfThePhantom', 'youWereUnableToFindNigel',
    'vipsInterviewed', 'vipsSlain',
  ],
  recordWrites: [
    'youAwokeInsideTheCatacombs', 'youEnteredTheCatacombsOnYourOwn',
    'youKnowTheSiteOfTheGate', 'conviction', 'doubt', 'chasingTheStranger',
    'readActII', 'vipsSlain',
  ],
  behaviorIds: [behavior.id],
})
manifest.contentVersion = '1.0.0'
