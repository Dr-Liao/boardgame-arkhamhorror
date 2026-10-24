import { scenario, identities } from './definition.js'
import { layout } from './layout.js'
import { behavior, implementedEncounterCodes } from './behavior.js'
import { scenarioManifest } from '../../../../scenario-manifest.js'

export { scenario, identities, layout, behavior, implementedEncounterCodes }

// P10 状态：`playable`（可被测试/审计读取，并已从大厅开放；逐卡差异见全卡账本）。
export const manifest = scenarioManifest(scenario, identities, {
  campaignId: 'theCircleUndone',
  status: 'playable',
  layout,
  requiredPackIds: ['core', 'tcuCampaign'],
  requiredEncounterGroupIds: ['forTheGreaterGood', 'cityOfSins', 'silverTwilightLodge'],
  requiredMechanicIds: ['tcuCampaignAssets', 'tcuChaos'],
  setAsideLocations: scenario.setAsideLocations,
  // 双面南森·威克按分支只用一面；两面都登记，引擎区域报告按目录数量校验。
  setAsideAliases: [
    '05217', '05217b', '05220', '05227', '05228',
  ],
  recordReads: ['theInvestigatorsAreMembersOfTheLodge'],
  recordWrites: [
    'theGuardianOfTheTrapEmerged',
    'theGuardianOfTheTrapEmergedAndWasDefeated',
    'theInvestigatorsDiscoveredHowToOpenThePuzzleBox',
  ],
  behaviorIds: [behavior.id],
})
manifest.contentVersion = '1.0.0'
