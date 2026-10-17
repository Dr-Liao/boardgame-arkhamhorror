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
    'theUnspeakableOath', 'hastursGift', 'inhabitantsOfCarcosa',
    'delusions', 'decay', 'agentsOfHastur',
  ],
  setAsideAliases: ['03182a', ...scenario.monsterDeck, ...scenario.lunaticsDeck],
  recordReads: ['vipsInterviewed', 'vipsSlain', 'youTookTheOnyxClasp', 'theFollowersOfTheSignHaveFoundTheWayForward'],
  recordWrites: [
    'vipsSlain', 'theKingClaimedItsVictims',
    'theInvestigatorsWereAttackedAsTheyEscapedTheAsylum',
    'theInvestigatorsEscapedTheAsylum', 'danielStatus',
  ],
  behaviorIds: [behavior.id],
})
manifest.contentVersion = '1.0.0'
