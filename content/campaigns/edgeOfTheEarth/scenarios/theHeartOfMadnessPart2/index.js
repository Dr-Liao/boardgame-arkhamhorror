// 疯狂之心 第 II 部分（The Heart of Madness, Part II · 08648b）· 章节装配。
// P7 章节状态 = development：单测直接 import 本章五件套，不依赖 content/registered.js。
import { scenario, identities } from './definition.js'
import { layout } from './layout.js'
import { behavior, implementedEncounterCodes } from './behavior.js'
import { scenarioManifest } from '../../../../scenario-manifest.js'

export { scenario, identities, layout, behavior, implementedEncounterCodes }
export const manifest = scenarioManifest(scenario, identities, {
  campaignId: 'edgeOfTheEarth',
  status: 'playable',
  layout,
  requiredPackIds: ['core', 'eoteCampaign'],
  requiredEncounterGroupIds: ['stirringInTheDeep', 'agentsOfTheUnknown', 'chillingCold', 'strikingFear',
    'theHeartOfMadness'],
  requiredMechanicIds: ['eoteSeals', 'eoteFacilities'],
  requiredInvestigatorIds: [],
  recordReads: ['drKenslerUnderstandsTheTrueNatureOfTheMiasma'],
  // 08672/P0-7：开场按「肯斯勒博士存活 + 已明了真相」写 drKenslerHasAPlan，否则写
  // theTruthOfTheMirageEludesYou（参考实现 PreScenarioSetup）；两条记录决定结局 R1/R2。
  recordWrites: ['drKenslerHasAPlan', 'theTruthOfTheMirageEludesYou',
    'theNamelessMadnessIsContainedSafelyWithinItsHostForNow', 'theFacilityWasDestroyed',
    'theTeamEscapedTheFacility', 'theSurvivorsOfTheExpeditionWere'],
  behaviorIds: [behavior.id],
  setAsideAliases: scenario.setAsideAliases,
  setAsideLocations: scenario.setAsideLocations,
})
manifest.contentVersion = '1.0.0'
manifest.referenceCode = '08648'
