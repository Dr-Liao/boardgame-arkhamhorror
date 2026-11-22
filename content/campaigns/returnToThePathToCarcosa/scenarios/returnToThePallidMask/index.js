// 重返苍白面具（returnToThePallidMask）· 章节装配与注册期清单。
import { scenario, identities, CARD_DATA } from './definition.js'
import { layout } from './layout.js'
import { behavior } from './behavior.js'
import { scenarioManifest } from '../../../../scenario-manifest.js'

export { scenario, identities, layout, behavior, CARD_DATA }
export const manifest = scenarioManifest(scenario, identities, {
  campaignId: 'returnToThePathToCarcosa',
  status: 'playable',
  layout,
  requiredPackIds: ['core', 'carcosaCampaign', 'rtptcCampaign'],
  requiredEncounterGroupIds: [
    'thePallidMask', 'ghouls', 'hauntings', 'chillingCold', 'returnToThePallidMask',
  ],
  requiredMechanicIds: ['carcosaEncounterEffects', 'carcosaDoubtConviction', 'carcosaChaosEffects', 'catacombsDeck'],
  setAsideAliases: ['03059', '03256', '03257', ...CARD_DATA.RETURN_CATACOMB_CODES],
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
manifest.referenceCode = CARD_DATA.REFERENCE_CODE
