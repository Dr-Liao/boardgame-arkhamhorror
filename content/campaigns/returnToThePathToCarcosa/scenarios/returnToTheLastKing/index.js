// 重返最后的王者（returnToTheLastKing）· 章节装配与注册期清单。
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
    'theLastKing', 'hastursGift', 'stranger',
    'decayingReality', 'delusoryEvils', 'returnToTheLastKing',
  ],
  requiredMechanicIds: ['carcosaEncounterEffects', 'carcosaChaosEffects', 'lastKingBystanders'],
  setAsideAliases: ['52025', '52027', '03065', '03066', '03067', '03068', '03069', '52023b', '52024b'],
  inPlayAliases: ['03076a', '03077', '03078', '03079', '03080'],
  recordWrites: ['vipsInterviewed', 'vipsSlain'],
  behaviorIds: [behavior.id],
})
manifest.contentVersion = '1.0.0'
manifest.referenceCode = CARD_DATA.REFERENCE_CODE
