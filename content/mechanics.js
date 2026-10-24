// Explicit capabilities with behavioral coverage. Catalog data cannot add one.
export const supportedMechanics = new Set([
  'assetEnteredPlay', 'handSizeBonus', 'draw', 'targetedEffect', 'heal', 'uses',
  'dunwichEncounterEffects', 'dunwichChaosEffects',
  'extracurricularObjectives', 'cloverClubGambling',
  'museumExhibitDeck', 'huntingHorrorVoid', 'museumLocationEffects',
  'devouredTrainCars', 'trainCarEffects',
  'hiddenChamber', 'potentialSacrifices', 'altarLocationEffects',
  'broodHunt', 'esotericFormula', 'broodLocationEffects',
  'divergingPaths', 'hillLocationEffects',
  'encounterLocations', 'dimensionalLocationEffects', 'yogSothoth',
  'carcosaEncounterEffects', 'carcosaChaosEffects', 'carcosaDoubtConviction',
  'curtainCallHazards', 'lastKingBystanders', 'catacombsDeck',
  // 失落的时代（三循环）循环专属机制，M3-A 层已实现并有单元测试。
  'tfaExploration', 'tfaSupplies', 'tfaVengeance', 'tfaYigsFury',
  'tfaPoisoned', 'tfaRelicOfAges', 'tfaExpeditionLeader',
  // 万象无终（四循环）第 2 步原语已实现并有测试，P4 登记为能力项；名字与规则书条目 id 一致。
  // P8 起 tcuChaos（逐章混乱符号表）随场景 chaos.js / tcu-chaos.js 落地并登记。
  'tcuHaunted', 'tcuSpectral', 'tcuCircle', 'tcuTarot', 'tcuTarotSlot', 'tcuBonded',
  'tcuMemento', 'tcuWatcher', 'tcuPrologue', 'tcuBreaches', 'tcuHeretics', 'tcuCosmos',
  'tcuBraziers', 'tcuCampaignAssets', 'tcuChaos',
])
export const missingMechanics = ids => (ids || []).filter(id => !supportedMechanics.has(id))
