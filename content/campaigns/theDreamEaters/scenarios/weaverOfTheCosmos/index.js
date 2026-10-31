import { scenario, identities } from './definition.js'
import { layout } from './layout.js'
import { behavior, implementedEncounterCodes } from './behavior.js'
import { scenarioManifest } from '../../../../scenario-manifest.js'

export { scenario, identities, layout, behavior, implementedEncounterCodes }
export const manifest = scenarioManifest(scenario, identities, {
  campaignId: 'theDreamEaters',
  status: 'development',
  layout,
  requiredPackIds: ['core', 'tdeCampaign'], // 印刷包由 tdeCampaign 的 cardRanges 06039–06354 覆盖
  requiredEncounterGroupIds: [
    'weaverOfTheCosmos', 'agentsOfAtlachNacha', 'spiders', 'ancientEvils', 'chillingCold',
  ],
  requiredMechanicIds: ['tdeSwarming', 'tdeLocationDoom', 'tdeChaos', 'tdeRecords'],
  setAsideLocations: scenario.setAsideLocations,
  setAsideAliases: ['06346', '06347', '06348', '06349', '06350', '06352', '06352'],
  recordReads: [
    'stepsOfTheBridge',
    'theInvestigatorsFoundAWayOutOfTheUnderworld',
    'theInvestigatorsAreTrappedInAtlachNachasRealm',
    'randolphSurvivedTheDescent',
    'theBlackCatKnowsTheTruth',
  ],
  recordWrites: [
    'theBridgeWasCompleted', 'theBridgeWasDestroyed', 'theInvestigatorsReturnedToReality',
    'theInvestigatorsNeverEscaped', 'theInvestigatorsAreStillInTheDreamlands',
    'theInvestigatorsAreTrappedInAtlachNachasRealm',
  ],
  behaviorIds: [behavior.id],
})
manifest.contentVersion = '1.0.0'
// 剧本参考卡（type=scenario）不建单卡条目：用 referenceCode 记录落点（noEntry:scenario-reference-card）。
manifest.referenceCode = '06333'
