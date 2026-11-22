// 重返往事回声（returnToEchoesOfThePast）· 章节装配与注册期清单。
import { scenario, identities, CARD_DATA } from './definition.js'
import { layout } from './layout.js'
import { behavior } from './behavior.js'
import { scenarioManifest } from '../../../../scenario-manifest.js'

export { scenario, identities, layout, behavior, CARD_DATA }
export const manifest = scenarioManifest(scenario, identities, {
  campaignId: 'returnToThePathToCarcosa',
  status: 'playable',
  layout,
  requiredPackIds: ['core', 'notz', 'carcosaCampaign', 'rtptcCampaign'],
  requiredEncounterGroupIds: [
    'echoesOfThePast', 'cultOfTheYellowSign', 'lockedDoors', 'darkCult', 'pentagram', 'theMidnightMasks',
    'maddeningDelusions', 'returnToEchoesOfThePast',
  ],
  requiredMechanicIds: [],
  setAsideAliases: ['03140', '03141', '03142', '03143', '52033'],
  recordReads: ['vipsInterviewed', 'vipsSlain', 'youFledTheDinnerParty'],
  recordWrites: [
    'vipsSlain', 'youTookTheOnyxClasp', 'youLeftTheOnyxClaspBehind',
    'youDestroyedTheOathspeaker', 'theFollowersOfTheSignHaveFoundTheWayForward',
    'doubt', 'conviction',
  ],
  behaviorIds: [behavior.id],
})
manifest.contentVersion = '1.0.0'
manifest.referenceCode = CARD_DATA.REFERENCE_CODE
