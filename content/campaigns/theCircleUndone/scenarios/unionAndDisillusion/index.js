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
  requiredEncounterGroupIds: [
    'unionAndDisillusion', 'anettesCoven', 'inexorableFate', 'realmOfDeath',
    'silverTwilightLodge', 'spectralPredators', 'theWatcher',
  ],
  requiredMechanicIds: [
    'tcuCircle', 'tcuBraziers', 'tcuChaos', 'tcuSpectral', 'tcuWatcher',
    'tcuHaunted', 'tcuHeretics', 'tcuCampaignAssets',
  ],
  setAsideLocations: scenario.setAsideLocations,
  setAsideAliases: [
    // 灵怪陷阱已由 setAsideLocations 声明；这里只列看守人组（05272/05086/05087）。
    '05272', '05086', '05087', '05087',
    // 安妮特的女巫集会（整组放在一边，act 3 背面洗回）
    '05090', '05090', '05090', '05091',
    // 银暮秘社（整组放在一边）
    '05095', '05095', '05095', '05096', '05097', '05097',
    // 失踪者剧情支援（按记录只用其中一部分；静态声明全部 4 张）
    '05258', '05259', '05260', '05261',
  ],
  recordReads: [
    'theInvestigatorsSidedWithTheLodge', 'theInvestigatorsSidedWithTheCoven',
    'missingPersons', 'wasTakenByTheWatcher', 'wasClaimedBySpecters', 'disappearedIntoTheMist',
    'theInvestigatorsAreOnGavriellasTrail', 'theInvestigatorsAreOnJeromesTrail',
    'theInvestigatorsAreOnPennysTrail', 'theInvestigatorsAreOnValentinosTrail',
    'theInvestigatorsAreDeceivingTheLodge', 'theInvestigatorsWereInductedIntoTheInnerCircle',
    'theInvestigatorsHidTheirKnowledgeOfTheCoven', 'theInvestigatorsKeptsTheirMementosHidden',
    'erynnJoinedTheInvestigators', 'josefIsAliveAndWell', 'josefDisappearedIntoTheMist',
    'theWitchesSpellWasCast', 'hereticsWereUnleashedUntoArkham',
    'gavriellaIsAlive', 'jeromeIsAlive', 'pennyIsAlive', 'valentinoIsAlive',
  ],
  recordWrites: [
    'theInvestigatorsSidedWithTheLodge', 'theInvestigatorsSidedWithTheCoven',
    'gavriellaIsAlive', 'jeromeIsAlive', 'pennyIsAlive', 'valentinoIsAlive',
    'gavriellaIsDead', 'jeromeIsDead', 'pennyIsDead', 'valentinoIsDead',
    'theTrueWorkOfTheSilverTwilightLodgeHasBegun', 'carlSanfordPossessesTheSecretsOfTheUniverse',
    'anetteMasonIsPossessedByEvil', 'theCovenOfKeziahHoldsTheWorldInItsGrasp',
  ],
  behaviorIds: [behavior.id],
})
manifest.contentVersion = '1.0.0'
