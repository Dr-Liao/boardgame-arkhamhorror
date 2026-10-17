// Source: Arkham/Campaigns/ThePathToCarcosa/ChaosBag.hs (original campaign).
// Symbol tokens are added later by campaign resolutions.
export const CHAOS_BAGS = {
  easy: ['+1', '+1', '0', '0', '0', '-1', '-1', '-1', '-2', '-2',
    'skull', 'skull', 'skull', 'autofail', 'eldersign'],
  standard: ['+1', '0', '0', '-1', '-1', '-1', '-2', '-2', '-3', '-4',
    'skull', 'skull', 'skull', 'autofail', 'eldersign'],
  hard: ['0', '0', '0', '-1', '-1', '-2', '-2', '-3', '-3', '-4', '-5',
    'skull', 'skull', 'skull', 'autofail', 'eldersign'],
  expert: ['0', '-1', '-1', '-2', '-2', '-3', '-3', '-4', '-4', '-5', '-6', '-8',
    'skull', 'skull', 'skull', 'autofail', 'eldersign'],
}

export const chapters = [
  { id: 'curtainCall', code: '03043', name: '谢幕', sourceName: 'CurtainCall' },
  { id: 'theLastKing', code: '03061', name: '最后的王者', sourceName: 'TheLastKing' },
  { id: 'echoesOfThePast', code: '03120', name: '往事回声', sourceName: 'EchoesOfThePast' },
  { id: 'theUnspeakableOath', code: '03159', name: '邪秽誓约', sourceName: 'TheUnspeakableOath' },
  { id: 'aPhantomOfTruth', code: '03200', name: '真相幻影', sourceName: 'APhantomOfTruth' },
  { id: 'thePallidMask', code: '03240', name: '苍白面具', sourceName: 'ThePallidMask' },
  { id: 'blackStarsRise', code: '03274', name: '黑星升起', sourceName: 'BlackStarsRise' },
  { id: 'dimCarcosa', code: '03316', name: '卡城幽影', sourceName: 'DimCarcosa' },
]

export const recordTypes = {
  theStrangerIsOnToYou: 'boolean',
  chasingTheStranger: 'number',
  pallidMaskBearer: 'string',
  youTriedToWarnThePolice: 'boolean',
  thePoliceAreSuspiciousOfYou: 'boolean',
  youChoseNotToGoToThePolice: 'boolean',
  doubt: 'number',
  conviction: 'number',
  vipsInterviewed: 'string[]',
  vipsSlain: 'string[]',
  youIntrudedOnASecretMeeting: 'boolean',
  youFledTheDinnerParty: 'boolean',
  youSlayedTheMonstersAtTheDinnerParty: 'boolean',
  youTookTheOnyxClasp: 'boolean',
  youLeftTheOnyxClaspBehind: 'boolean',
  youDestroyedTheOathspeaker: 'boolean',
  theFollowersOfTheSignHaveFoundTheWayForward: 'boolean',
  theKingClaimedItsVictims: 'boolean',
  theInvestigatorsWereAttackedAsTheyEscapedTheAsylum: 'boolean',
  theInvestigatorsEscapedTheAsylum: 'boolean',
  youIgnoredDanielsWarning: 'boolean',
  youHeadedDanielsWarning: 'boolean',
  danielStatus: 'string',
  youDidNotEscapeTheGazeOfThePhantom: 'boolean',
  youFoundNigelsHome: 'boolean',
  youFoundNigelEngram: 'boolean',
  youWereUnableToFindNigel: 'boolean',
  youAwokeInsideTheCatacombs: 'boolean',
  youEnteredTheCatacombsOnYourOwn: 'boolean',
  youKnowTheSiteOfTheGate: 'boolean',
  readActII: 'string[]',
  youOpenedThePathBelow: 'boolean',
  youOpenedThePathAbove: 'boolean',
  theRealmOfCarcosaMergedWithOurOwnAndHasturRulesOverThemBoth: 'boolean',
  theInvestigatorsPreventedHasturFromEscapingHisPrison: 'boolean',
  hasturHasYouInHisGrasp: 'boolean',
  possessed: 'string[]',
}

export const recordDefaults = Object.freeze(Object.fromEntries(Object.entries(recordTypes).map(([key, type]) =>
  [key, type === 'boolean' ? false : type === 'number' ? 0 : type === 'string[]' ? [] : ''])))

export const VIP_INTERVIEWED_CODES = Object.freeze(['03076a', '03077', '03078', '03079', '03080'])
export const VIP_SLAIN_CODES = Object.freeze(['03065', '03066', '03067', '03068', '03069'])
