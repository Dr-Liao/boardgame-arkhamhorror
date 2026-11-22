// 重返邪秽誓约（returnToTheUnspeakableOath）· 章节装配与注册期清单。
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
    'theUnspeakableOath', 'hastursGift', 'inhabitantsOfCarcosa',
    'maddeningDelusions', 'decayingReality', 'hastursEnvoys', 'returnToTheUnspeakableOath',
  ],
  requiredMechanicIds: [],
  setAsideAliases: ['03182a', '52037', '52038', ...scenario.monsterDeck, ...scenario.lunaticsDeck],
  recordReads: ['vipsInterviewed', 'vipsSlain', 'youTookTheOnyxClasp', 'theFollowersOfTheSignHaveFoundTheWayForward',
    'conviction', 'doubt'],
  recordWrites: [
    'vipsSlain', 'theKingClaimedItsVictims',
    'theInvestigatorsWereAttackedAsTheyEscapedTheAsylum',
    'theInvestigatorsEscapedTheAsylum', 'danielStatus',
  ],
  behaviorIds: [behavior.id],
})
manifest.contentVersion = '1.0.0'
manifest.referenceCode = CARD_DATA.REFERENCE_CODE
