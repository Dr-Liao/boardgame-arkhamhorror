import { scenario, identities } from './definition.js'
import { layout } from './layout.js'
import { behavior, implementedEncounterCodes } from './behavior.js'
import { scenarioManifest } from '../../../../scenario-manifest.js'

export { scenario, identities, layout, behavior, implementedEncounterCodes }
export const manifest = scenarioManifest(scenario, identities, {
  campaignId: 'theForgottenAge',
  status: 'playable',
  layout,
  // 地图使用夜之狂热（notz 卡包 01125-01141）的阿卡姆地点：遗物线在米斯卡塔尼克大学、
  // 亚历山卓线在东城区、伊塔卡线在河岸城，缺了这个卡包注册表会拒绝这些原卡。
  requiredPackIds: ['core', 'tfaCampaign', 'notz'],
  requiredEncounterGroupIds: [
    'threadsOfFate', 'pnakoticBrotherhood', 'lockedDoors', 'nightgaunts', 'pentagram',
  ],
  requiredMechanicIds: ['tfaRelicOfAges', 'tfaVengeance'],
  setAsideLocations: ['townHall'],
  setAsideAliases: ['04051', '04061', '04147', '04148'],
  recordReads: [
    'theInvestigatorsGaveCustodyOfTheRelicToHarlanEarnstone',
    'youAreForgingYourOwnWay',
  ],
  recordWrites: [
    'theInvestigatorsFoundTheMissingRelic', 'theRelicIsMissing',
    'theInvestigatorsRescuedAlejandro', 'alejandroIsMissing',
    'theInvestigatorsForgedABondWithIchtaca', 'ichtacaIsInTheDark',
    'theHarbingerIsStillAlive', 'youAreForgingYourOwnWay',
  ],
  behaviorIds: [behavior.id],
})
manifest.contentVersion = '1.0.0'
