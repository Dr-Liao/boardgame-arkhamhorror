// Source: Arkham/Campaigns/TheForgottenAge/ChaosBag.hs (original campaign).
// This cycle uses two skulls, one elder thing and no cultist/tablet symbol.
export const CHAOS_BAGS = {
  easy: ['+1', '+1', '0', '0', '0', '-1', '-1', '-2', '-3',
    'skull', 'skull', 'elderthing', 'autofail', 'eldersign'],
  standard: ['+1', '0', '0', '0', '-1', '-2', '-2', '-3', '-5',
    'skull', 'skull', 'elderthing', 'autofail', 'eldersign'],
  hard: ['+1', '0', '0', '-1', '-2', '-3', '-3', '-4', '-6',
    'skull', 'skull', 'elderthing', 'autofail', 'eldersign'],
  expert: ['0', '-1', '-2', '-2', '-3', '-3', '-4', '-4', '-6', '-8',
    'skull', 'skull', 'elderthing', 'autofail', 'eldersign'],
}

// Source: Arkham/Campaigns/TheForgottenAge/CampaignSteps.hs (original campaign only).
// Heart of the Elders is played in two parts that share the printed scenario card.
export const chapters = [
  { id: 'theUntamedWilds', code: '04043', name: '荒莽密林', sourceName: 'TheUntamedWilds', packCodes: ['tfa'] },
  { id: 'theDoomOfEztli', code: '04054', name: '埃兹特里的覆灭', sourceName: 'TheDoomOfEztli', packCodes: ['tfa'] },
  { id: 'threadsOfFate', code: '04113', name: '命运之线', sourceName: 'ThreadsOfFate', packCodes: ['tof'] },
  { id: 'theBoundaryBeyond', code: '04161', name: '界限彼端', sourceName: 'TheBoundaryBeyond', packCodes: ['tbb'] },
  { id: 'heartOfTheEldersPart1', code: '04205', name: '久远腹地（上）', sourceName: 'HeartOfTheElders', packCodes: ['hote'] },
  { id: 'heartOfTheEldersPart2', code: '04205', name: '久远腹地（下）', sourceName: 'HeartOfTheElders', packCodes: ['hote'] },
  { id: 'theCityOfArchives', code: '04237', name: '天机之城', sourceName: 'TheCityOfArchives', packCodes: ['tcoa'] },
  { id: 'theDepthsOfYoth', code: '04277', name: '幽嘶深渊', sourceName: 'TheDepthsOfYoth', packCodes: ['tdoy'] },
  { id: 'shatteredAeons', code: '04314', name: '破碎永世', sourceName: 'ShatteredAeons', packCodes: ['sha'] },
  { id: 'turnBackTime', code: '04344', name: '时间倒流（尾声）', sourceName: 'TurnBackTime', packCodes: ['sha'] },
]

// Source: Arkham/Campaigns/TheForgottenAge/Key.hs. Yig's Fury is the only
// numeric record; the jungle watch list is a set of card codes.
export const recordTypes = {
  theInvestigatorsWereForcedToWaitForAdditionalSupplies: 'boolean',
  ichtacaObservedYourProgressWithKeenInterest: 'boolean',
  alejandroFollowedTheInvestigatorsIntoTheRuins: 'boolean',
  ichtacaIsWaryOfTheInvestigators: 'boolean',
  theInvestigatorsHaveEarnedIchtacasTrust: 'boolean',
  alejandroChoseToRemainAtCamp: 'boolean',
  theInvestigatorsClearedAPathToTheEztliRuins: 'boolean',
  yigsFury: 'number',
  theInvestigatorsRecoveredTheRelicOfAges: 'boolean',
  alejandroRecoveredTheRelicOfAges: 'boolean',
  theHarbingerIsStillAlive: 'number',
  theHarbingerIsAlive: 'boolean',
  theInvestigatorsGaveCustodyOfTheRelicToAlejandro: 'boolean',
  theInvestigatorsHaveEarnedAlejandrosTrust: 'boolean',
  theInvestigatorsGaveCustodyOfTheRelicToHarlanEarnstone: 'boolean',
  alejandroIsContinuingHisResearchOnHisOwn: 'boolean',
  youAreForgingYourOwnWay: 'boolean',
  theInvestigatorsFoundTheMissingRelic: 'boolean',
  theRelicIsMissing: 'boolean',
  theInvestigatorsRescuedAlejandro: 'boolean',
  alejandroIsMissing: 'boolean',
  theInvestigatorsForgedABondWithIchtaca: 'boolean',
  ichtacaIsInTheDark: 'boolean',
  pathsAreKnownToYou: 'number',
  ichtacaHasConfidenceInYou: 'boolean',
  theInvestigatorsMappedOutTheWayForward: 'boolean',
  ichtacasFaithIsRestored: 'boolean',
  theJungleWatches: 'string[]',
  theInvestigatorsCooperatedWithTheYithians: 'boolean',
  theInvestigatorsResistedCaptivity: 'boolean',
  theInvestigatorsHadTheirMemoriesExpunged: 'boolean',
  theProcessWasPerfected: 'boolean',
  theProcessWasSuccessful: 'boolean',
  theProcessBackfired: 'boolean',
  theProcessBackfiredSpectacularly: 'boolean',
  alejandroRemembersEverything: 'boolean',
  alejandroIsSetAgainstYou: 'boolean',
  ichtacaIsSetAgainstYou: 'boolean',
  theInvestigatorsFellIntoTheDepths: 'boolean',
  theNexusIsNear: 'boolean',
  theBraziersAreLit: 'boolean',
  theBraziersRemainUnlit: 'boolean',
  theInvestigatorsMendedTheTearInTheFabricOfTime: 'boolean',
  theInvestigatorsSavedTheCivilizationOfTheSerpents: 'boolean',
  theInvestigatorsSavedTheCivilizationOfTheYithians: 'boolean',
  theFabricOfTimeIsUnwoven: 'boolean',
  theInvestigatorsTurnedBackTime: 'boolean',
  theInvestigatorsSealedTheRelicOfAgesForever: 'boolean',
  theInvestigatorsRecruitedTheHelpOfAnotherExpedition: 'boolean',
}

export const recordDefaults = Object.freeze(Object.fromEntries(Object.entries(recordTypes).map(([key, type]) =>
  [key, type === 'boolean' ? false : type === 'number' ? 0 : []])))

export const SUPPLIES = Object.freeze([
  'provisions', 'medicine', 'rope', 'blanket', 'canteen', 'torches', 'compass', 'map',
  'binoculars', 'chalk', 'pendant', 'gasoline', 'pocketknife', 'pickaxe', 'keyOfEztli',
  'mysteriousScepter', 'stickyGoop', 'journal', 'satchel',
])
