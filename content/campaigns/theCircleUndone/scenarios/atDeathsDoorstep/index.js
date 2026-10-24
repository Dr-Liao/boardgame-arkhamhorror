import { scenario, identities } from './definition.js'
import { layout } from './layout.js'
import { behavior, implementedEncounterCodes } from './behavior.js'
import { scenarioManifest } from '../../../../scenario-manifest.js'

export { scenario, identities, layout, behavior, implementedEncounterCodes }

// 放在一边的物理卡：Josef（05085，双面含 05085b）、幽灵看守人、看守人的攫噬 ×2、
// 冥界组 05105 ×2 / 05106 ×2、7 张幽灵地点（05078–05084）。
// 幽灵面不是独立地点定义，而是 7 个普通地点的 `back`；区域账本仍按印刷卡号登记，
// 供 P9 的 setAside 展示与审计核对。
export const manifest = scenarioManifest(scenario, identities, {
  campaignId: 'theCircleUndone',
  status: 'playable',
  layout,
  requiredPackIds: ['core', 'tcuCampaign'],
  requiredEncounterGroupIds: [
    'atDeathsDoorstep', 'silverTwilightLodge', 'spectralPredators', 'trappedSpirits',
    'inexorableFate', 'realmOfDeath', 'theWatcher', 'chillingCold',
  ],
  requiredMechanicIds: ['tcuHaunted', 'tcuSpectral', 'tcuWatcher', 'tcuChaos'],
  setAsideAliases: [
    '05085', '05086', '05087', '05087', '05105', '05105', '05106', '05106',
    '05078', '05079', '05080', '05081', '05082', '05083', '05084',
  ],
  recordReads: ['missingPersons', 'piecesOfEvidenceWereLeftBehind'],
  recordWrites: [
    'theInvestigatorsAreOnGavriellasTrail', 'theInvestigatorsAreOnJeromesTrail',
    'theInvestigatorsAreOnPennysTrail', 'theInvestigatorsAreOnValentinosTrail',
    'theInvestigatorsEscapedTheSpectralRealm', 'theInvestigatorsLearnedNothingOfTheLodgesSchemes',
    'theInvestigatorsAreNeverSeenOrHeardFromAgain',
  ],
  behaviorIds: [behavior.id],
})
manifest.contentVersion = '1.0.0'
