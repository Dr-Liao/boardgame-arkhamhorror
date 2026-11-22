import { ALL_CARDS } from '../../../src/cards/cards-data.js'
import { getAvailability } from '../../../src/deck/availability.js'
import { returnPlayerCards, returnResearchUpgrades, returnWeaknesses } from '../../../src/deck/return-packs.js'
import { CONTENT_SCHEMA_VERSION } from '../../schema.js'

export const returnPlayerPacks = [
  ['rtnotzPlayer', '重返夜之狂热 · 玩家卡', '50', '50010'],
  ['rtdwlPlayer', '重返敦威治遗产 · 玩家卡', '51', '51011'],
  ['rtptcPlayer', '重返卡尔克萨之路 · 玩家卡', '52', '52013'],
].map(([id, name, prefix, last]) => ({
  schemaVersion: CONTENT_SCHEMA_VERSION,
  id, name, contentVersion: '1.0.0', minRulesVersion: 'n6.0',
  status: 'playable', dependencies: ['core'],
  cardRanges: [{ from: prefix + '001', to: last }],
  basicWeaknessCodes: returnWeaknesses.filter(code => code.startsWith(prefix)),
  includeInAutomaticWeaknessPool: true,
  encounterGroupIds: [], behaviorIds: [],
  cards: [...returnPlayerCards, ...returnWeaknesses].filter(code => code.startsWith(prefix)).map(code => {
    const card = ALL_CARDS[code]
    const availability = getAvailability(code)
    return {
      code, name: card.nameZh || card.name, type: 'player',
      cataloged: true, imageAvailable: Boolean(card.imagesrc),
      rulesImplemented: availability.strictAccepted, deckbuilding: availability.deckbuilding,
      ...(availability.dependencyOnly ? { dependencyOnly: true } : {}),
      ...(returnResearchUpgrades.includes(code) ? { researchGated: true } : {}),
    }
  }),
}))
