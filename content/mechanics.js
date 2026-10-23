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
  // tcuChaos（逐章混乱符号表）要等 P8 的 tcu-chaos.js，在那之前不要登记——章节声明它会缺少真实能力。
  'tcuHaunted', 'tcuSpectral', 'tcuCircle', 'tcuTarot', 'tcuTarotSlot', 'tcuBonded',
  'tcuMemento', 'tcuWatcher', 'tcuPrologue', 'tcuBreaches', 'tcuHeretics', 'tcuCosmos',
  'tcuBraziers', 'tcuCampaignAssets',
])
export const missingMechanics = ids => (ids || []).filter(id => !supportedMechanics.has(id))
