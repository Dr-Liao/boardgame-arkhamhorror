// Area dictionary fragment: misc (image host validation, deckbuilding errors, ArkhamDB import, catalog loading).
// Maintained by the Lead; see en.js for the aggregator.

export default {
  // Image host validation (images.js)
  'misc.imageHost.invalid': 'The image host must be a complete http(s) URL',
  'misc.imageHost.protocol': 'The image host must use http or https',
  'misc.imageHost.credentials': 'The image host must not include credentials, a query string or a fragment',

  // Catalog loading (catalog.js)
  'misc.catalog.loadFailed': 'Failed to load the catalog',

  // Deckbuilding validation (deck-rules.js)
  'misc.deckRules.invalid': 'Invalid deckbuilding rules',
  'misc.deckRules.limit': 'Invalid deckbuilding limit',
  'misc.deckRules.levelRange': 'Invalid card level range',
  'misc.deck.unknownCard': 'Unknown card: {code}',
  'misc.deck.excluded': '{name} is excluded by deckbuilding restrictions',
  'misc.deck.size': 'The deck needs {size} player cards; it has {count}',
  'misc.deck.overLimit': '{name} exceeds its copy limit',
  'misc.deck.myriadLimit': '{name} exceeds the Myriad same-title limit (up to {limit} copies)',
  'misc.deck.restriction': '{name} does not satisfy deckbuilding restrictions or limits',
  'misc.deck.atleastInvalid': 'Invalid faction-count requirement',
  'misc.deck.atleast': 'The deck must include at least {minimum} cards from each of {factions} different factions',
  'misc.cardPool.all': 'All',
  'misc.cardPool.progressive': 'Progressive',
  'misc.upgrade.quote': 'Card XP {printed} − same-name upgrade credit {credit}, minimum 1 XP',
  'misc.upgrade.discount': ', discount {discount}',

  // ArkhamDB deck import (arkhamdb-import.js)
  'misc.import.empty': 'Paste an ArkhamDB deck link, deck id or exported JSON.',
  'misc.import.missingFields': 'The JSON is missing the investigator_code or slots field.',
  'misc.import.badJson': 'Invalid JSON. Copy the complete deck data.',
  'misc.import.badUrl': 'Unrecognized link.',
  'misc.import.host': 'Only arkhamdb.com deck links are supported.',
  'misc.import.noDeckId': 'No deck id found in the link, e.g. https://arkhamdb.com/decklist/view/12345.',
  'misc.import.timeout': 'The import timed out. Try again shortly.',
  'misc.import.network': 'Could not reach the hall service.',
  'misc.import.badResponse': 'Invalid response from the import service.',
  'misc.import.failed': 'Import failed.',
  'misc.import.investigatorMissing': 'This investigator is not implemented yet',
  'misc.import.autoSignature': 'Signature card; added automatically when saving',
  'misc.import.autoWeakness': 'Basic weakness; drawn at random by the system',
  'misc.import.notInCatalog': 'This card is not in the catalog',
  'misc.import.otherSignature': "Another investigator's signature card",
  'misc.import.notPlayerCard': 'Not a normal player card that can go into a deck',
  'misc.import.notImplemented': 'Not implemented yet',
  'misc.import.xpTooHigh': '{xp}-XP card; starting decks may only use level 0 cards',
  'misc.import.restriction': 'Does not satisfy deckbuilding restrictions for {name}',
  'misc.import.taboo': 'This deck uses the taboo list; cards are imported with their original rules.',
  'misc.import.side': 'Ignored {count} cards in the side deck.',
  'misc.import.ignoreLimit': 'The ArkhamDB "does not count toward deck size" flag is not kept.',
}
