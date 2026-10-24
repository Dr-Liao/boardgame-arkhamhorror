// 万象无终 · 序章《暮色庄园失踪事件》（05043）· 关卡装配。
//
// 交付物：{ scenario, identities, layout, behavior, implementedEncounterCodes, manifest }。
// 注册进 content/registered.js 由 Lead 合并（worker 不动注册表/索引）。
import { scenario, identities } from './definition.js'
import { layout } from './layout.js'
import { behavior, implementedEncounterCodes } from './behavior.js'
import { scenarioManifest } from '../../../../scenario-manifest.js'

export { scenario, identities, layout, behavior, implementedEncounterCodes }

export const manifest = scenarioManifest(scenario, identities, {
  campaignId: 'theCircleUndone',
  // P10 口径：9 章从 development 升到 playable（可由测试/审计读取，并可从大厅启动）。
  status: 'playable',
  layout,
  requiredPackIds: ['core', 'tcuCampaign'],
  // 本章组 + 5 个循环共享组 + 核心「寒冷刺骨」；共享组条目归 W-shared，本章只负责引用与布置。
  requiredEncounterGroupIds: [
    'disappearanceAtTheTwilightEstate', 'inexorableFate', 'realmOfDeath', 'spectralPredators',
    'trappedSpirits', 'theWatcher', 'chillingCold',
  ],
  requiredMechanicIds: ['tcuPrologue', 'tcuTarot', 'tcuSpectral', 'tcuHaunted', 'tcuWatcher'],
  // 幽灵看守人开局入场：放在一边（不进遭遇牌库），由 behavior.setupEnemies 生成到入口大厅。
  setAsideAliases: ['05086'],
  recordReads: ['missingPersons', 'wasTakenByTheWatcher', 'wasClaimedBySpecters',
    'disappearedIntoTheMist', 'wasPulledIntoTheSpectralRealm', 'piecesOfEvidenceWereLeftBehind'],
  recordWrites: ['missingPersons', 'wasTakenByTheWatcher', 'wasClaimedBySpecters',
    'disappearedIntoTheMist', 'wasPulledIntoTheSpectralRealm', 'piecesOfEvidenceWereLeftBehind',
    'youAreBeingHunted'],
  behaviorIds: [behavior.id],
})

manifest.contentVersion = '1.0.0'
