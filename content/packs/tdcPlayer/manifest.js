import { CONTENT_SCHEMA_VERSION } from '../../schema.js'
import { ALL_CARDS } from '../../../src/cards/cards-data.js'

const player = Object.values(ALL_CARDS).filter(card => card.pack === 'tdcp' && card.code >= '11020')
const accepted = new Set([
  '11020', '11021', '11022', '11023', '11024', '11025', '11026', '11027', '11028', '11029', '11030', '11031', '11032',
  '11033', '11034', '11035', '11036', '11037', '11038', '11039', '11040', '11041', '11042', '11043', '11044', '11045',
  '11046', '11047', '11048', '11049', '11050', '11051', '11052', '11053', '11054', '11055', '11056', '11057', '11058', '11059',
  '11060', '11061', '11062', '11063', '11064', '11065', '11066', '11067', '11068a', '11068b', '11069',
  '11070', '11071', '11072', '11073', '11074', '11075', '11076', '11077', '11078', '11079', '11080',
  '11081', '11082', '11083', '11084', '11085', '11086', '11087', '11088',
  '11089', '11090', '11091', '11092', '11093', '11094', '11095', '11096', '11097', '11098', '11099', '11100', '11101',
  '11102', '11103', '11104', '11105', '11106', '11107', '11108', '11109', '11110', '11111', '11112', '11113', '11114', '11115',
  '11116', '11117', '11118', '11119', '11120', '11121', '11122', '11123', '11124', '11125',
  '11126', '11127', '11128', '11129',
])
export const TDC_PLAYER_ACCEPTED_CODES = Object.freeze(player.filter(card => accepted.has(card.code)).map(card => card.code))
export const TDC_PLAYER_BUILDABLE_CODES = Object.freeze(player.filter(card => accepted.has(card.code)
  && ['asset', 'event', 'skill'].includes(card.type) && !card.subtype && card.deckLimit !== 0
  && !/^Researched\./m.test(card.text || '')).map(card => card.code))
export const TDC_PLAYER_BASIC_WEAKNESS_CODES = Object.freeze(player.filter(card => accepted.has(card.code)
  && card.subtype === 'basicweakness').map(card => card.code))
export const TDC_PLAYER_RESEARCHED_CODES = Object.freeze(player.filter(card => accepted.has(card.code)
  && /^Researched\./m.test(card.text || '')).map(card => card.code))

export const manifest = {
  schemaVersion: CONTENT_SCHEMA_VERSION,
  id: 'tdcPlayer',
  name: '沉没之城 · 玩家卡',
  contentVersion: '1.0.0',
  minRulesVersion: 'n6.0',
  status: accepted.size === player.length ? 'playable' : 'development',
  dependencies: ['core'],
  cardRanges: [{ from: '11020', to: '11129' }, { from: '11068a', to: '11068b' }],
  basicWeaknessCodes: [...TDC_PLAYER_BASIC_WEAKNESS_CODES],
  cards: player.map(card => ({
    code: card.code,
    name: card.nameZh || card.name,
    type: 'player',
    cataloged: true,
    imageAvailable: Boolean(card.imagesrc),
    rulesImplemented: accepted.has(card.code),
    deckbuilding: TDC_PLAYER_BUILDABLE_CODES.includes(card.code),
    ...(TDC_PLAYER_RESEARCHED_CODES.includes(card.code) ? { researchGated: true } : {}),
    ...(card.type === 'investigator' || card.subtype === 'basicweakness' ? { dependencyOnly: true } : {}),
  })),
  encounterGroupIds: [],
  behaviorIds: TDC_PLAYER_ACCEPTED_CODES.map(code => `tdcPlayerCard${code}`),
  docs: ['docs/campaign/theDrownedCity/player-cards.md'],
}
