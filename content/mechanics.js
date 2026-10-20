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
])
export const missingMechanics = ids => (ids || []).filter(id => !supportedMechanics.has(id))
