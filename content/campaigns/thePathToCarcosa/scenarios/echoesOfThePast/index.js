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
    'echoesOfThePast', 'cultOfTheYellowSign', 'delusions', 'lockedDoors',
    'darkCult', 'theMidnightMasks',
  ],
  setAsideAliases: ['03140', '03141', '03142', '03143'],
  recordReads: ['vipsInterviewed', 'vipsSlain', 'youFledTheDinnerParty'],
  recordWrites: [
    'vipsSlain', 'youTookTheOnyxClasp', 'youLeftTheOnyxClaspBehind',
    'youDestroyedTheOathspeaker', 'theFollowersOfTheSignHaveFoundTheWayForward',
    'doubt', 'conviction',
  ],
  behaviorIds: [behavior.id],
})
manifest.contentVersion = '1.0.0'
