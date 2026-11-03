import { catalogPack } from '../../campaigns/theInnsmouthConspiracy/shared.js'
const catalog = catalogPack('ticInvestigators', '印斯茅斯暗潮 · 调查员')
export const manifest = { ...catalog, contentVersion: '0.2.0', status: 'playable',
  cards: catalog.cards.map(card => ({ ...card, rulesImplemented: true, deckbuilding: true })),
  behaviorIds: ['sisterMary', 'amandaSharpe', 'trishScarborough', 'dexterDrake', 'silasMarsh',
    'guardianAngel', 'crisisOfFaith', 'obscureStudies', 'whispersFromTheDeep', 'inTheShadows', 'shadowAgents',
    'showmanship', 'occultScraps', 'seaChangeHarpoon', 'silassNet', 'sirenCall'],
}
