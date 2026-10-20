import { scenario, identities, PRESENT_LOCATIONS, ANCIENT_LOCATIONS } from './definition.js'
import { layout } from './layout.js'
import { behavior, implementedEncounterCodes } from './behavior.js'
import { scenarioManifest } from '../../../../scenario-manifest.js'

export { scenario, identities, layout, behavior, implementedEncounterCodes }
export const manifest = scenarioManifest(scenario, identities, {
  campaignId: 'theForgottenAge',
  status: 'playable',
  layout,
  requiredPackIds: ['core', 'tfaCampaign'],
  requiredEncounterGroupIds: [
    'theBoundaryBeyond', 'flux', 'poison', 'pnakoticBrotherhood', 'guardiansOfTime', 'venom',
    // 「预示者还活着」时要按记录从《埃兹特里的覆灭》里取出瓦卢西亚的预示者。
    'theDoomOfEztli',
  ],
  requiredMechanicIds: ['tfaSupplies', 'tfaVengeance', 'tfaRelicOfAges'],
  // 放在一边：帕德玛·阿姆丽塔、场景 3a、密谋 3a、4 张中毒弱点、瓦卢西亚的预示者。
  setAsideAliases: ['04186', '04167', '04164', '04102', '04102', '04102', '04102', '04062'],
  recordReads: [
    'theInvestigatorsForgedABondWithIchtaca', 'theInvestigatorsFoundTheMissingRelic',
    'theInvestigatorsRescuedAlejandro', 'theHarbingerIsStillAlive', 'yigsFury',
    'pathsAreKnownToYou', 'ichtacaHasConfidenceInYou',
  ],
  recordWrites: [
    'pathsAreKnownToYou', 'ichtacaHasConfidenceInYou', 'yigsFury', 'theHarbingerIsStillAlive',
  ],
  behaviorIds: [behavior.id],
})
// 12 张古代地点是探索牌库的卡，不是起手就在场的格位；场景只放 6 个现代格位。
manifest.explorationLocations = Object.keys(ANCIENT_LOCATIONS)
manifest.presentDayLocations = Object.keys(PRESENT_LOCATIONS)
manifest.contentVersion = '1.0.0'
