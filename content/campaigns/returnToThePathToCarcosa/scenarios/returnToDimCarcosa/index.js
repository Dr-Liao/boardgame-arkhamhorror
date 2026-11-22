// 重返卡城幽影（returnToDimCarcosa）· 章节装配与注册期清单。
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
    'dimCarcosa', 'cultOfTheYellowSign', 'inhabitantsOfCarcosa',
    'maddeningDelusions', 'hastursEnvoys', 'neuroticFear', 'returnToDimCarcosa',
  ],
  requiredMechanicIds: [],
  setAsideAliases: [
    '03059', '03088', '03332', '03333', '03334',
    '03326c', '03327c', '03327e', '03328c', '03328e', '03329c',
    ...CARD_DATA.RETURN_STORY_CODES, ...Object.values(CARD_DATA.RETURN_LOCATIONS),
  ],
  recordReads: [
    'doubt', 'conviction', 'chasingTheStranger', 'youOpenedThePathBelow', 'youOpenedThePathAbove',
  ],
  recordWrites: [
    'possessed', 'theInvestigatorsPreventedHasturFromEscapingHisPrison',
    'theRealmOfCarcosaMergedWithOurOwnAndHasturRulesOverThemBoth', 'hasturHasYouInHisGrasp',
    'knowTheSecret',
  ],
  behaviorIds: [behavior.id],
})
manifest.contentVersion = '1.0.0'
manifest.referenceCode = CARD_DATA.REFERENCE_CODE
