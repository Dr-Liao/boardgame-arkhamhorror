// 重返真相幻影（returnToAPhantomOfTruth）· 章节装配与注册期清单。
import { scenario, identities, CARD_DATA } from './definition.js'
import { layout } from './layout.js'
import { behavior } from './behavior.js'
import { scenarioManifest } from '../../../../scenario-manifest.js'

export { scenario, identities, layout, behavior, CARD_DATA }
export const manifest = scenarioManifest(scenario, identities, {
  campaignId: 'returnToThePathToCarcosa',
  status: 'playable',
  layout,
  // 01135/01136 属于 notz 包的午夜假面/arkham 组（基础章节同样依赖）。
  requiredPackIds: ['core', 'notz', 'carcosaCampaign', 'rtptcCampaign'],
  requiredEncounterGroupIds: [
    'aPhantomOfTruth', 'evilPortents', 'byakhee', 'stranger', 'theMidnightMasks', 'arkham',
    'hastursEnvoys', 'returnToAPhantomOfTruth',
  ],
  requiredMechanicIds: ['carcosaEncounterEffects', 'carcosaDoubtConviction', 'carcosaChaosEffects'],
  setAsideAliases: ['03221', '52047'],
  recordReads: [
    'conviction', 'doubt', 'chasingTheStranger', 'vipsInterviewed', 'vipsSlain',
    'theKingClaimedItsVictims', 'youIntrudedOnASecretMeeting',
    'youSlayedTheMonstersAtTheDinnerParty', 'thePoliceAreSuspiciousOfYou',
  ],
  recordWrites: [
    'conviction', 'doubt', 'vipsSlain', 'youDidNotEscapeTheGazeOfThePhantom',
    'youFoundNigelsHome', 'youFoundNigelEngram', 'youWereUnableToFindNigel',
  ],
  behaviorIds: [behavior.id],
})
manifest.contentVersion = '1.0.0'
manifest.referenceCode = CARD_DATA.REFERENCE_CODE
