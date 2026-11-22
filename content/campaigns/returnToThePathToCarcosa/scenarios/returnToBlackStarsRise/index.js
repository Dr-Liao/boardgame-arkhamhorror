// 重返黑星升起（returnToBlackStarsRise）· 章节装配与注册期清单。
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
    'blackStarsRise', 'evilPortents', 'byakhee', 'inhabitantsOfCarcosa', 'stranger', 'darkCult',
    'delusoryEvils', 'returnToBlackStarsRise',
  ],
  requiredMechanicIds: [],
  setAsideAliases: ['03088', '03300', '03301', '03281', '03282', '52055', '52056'],
  recordReads: ['vipsInterviewed', 'vipsSlain'],
  recordWrites: [
    'doubt', 'conviction', 'vipsSlain', 'youOpenedThePathBelow', 'youOpenedThePathAbove',
    'theRealmOfCarcosaMergedWithOurOwnAndHasturRulesOverThemBoth',
  ],
  behaviorIds: [behavior.id],
})
manifest.contentVersion = '1.0.0'
manifest.referenceCode = CARD_DATA.REFERENCE_CODE
