import { catalogPack } from '../../campaigns/theFeastOfHemlockVale/shared.js'

export const manifest = catalogPack('fhvCampaign', '战役内容', card =>
  ['enemy', 'enemy_location', 'treachery'].includes(card.type) ? 'encounter' : 'other')
