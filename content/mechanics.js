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
])
export const missingMechanics = ids => (ids || []).filter(id => !supportedMechanics.has(id))
