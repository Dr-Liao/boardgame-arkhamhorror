import { scenario, identities } from './definition.js'
import { layout } from './layout.js'
import { behavior } from './behavior.js'
import { scenarioManifest } from '../../../../scenario-manifest.js'

export { scenario, identities, layout, behavior }
export const manifest = scenarioManifest(scenario, identities, {
  campaignId: 'thePathToCarcosa',
  status: 'verified',
  layout,
  requiredPackIds: ['core', 'notz', 'carcosaCampaign'],
  requiredEncounterGroupIds: [
    'aPhantomOfTruth', 'evilPortents', 'byakhee', 'stranger', 'theMidnightMasks',
  ],
  requiredMechanicIds: ['carcosaEncounterEffects', 'carcosaDoubtConviction', 'carcosaChaosEffects'],
  setAsideAliases: ['03221'],
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
