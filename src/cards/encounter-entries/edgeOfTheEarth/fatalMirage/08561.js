// 08561 荒废车站
import { ALL_CARDS } from '../../_shared.js'

export default {
  code: '08561', scope: 'location', implemented: true,
  flags: { mirageId: 'desertedStation', tier: 2 },
  modifiers: [{ target: 'locationShroud', amount: ({ entity }) => entity.revealed && entity.attachments?.some(card =>
    ALL_CARDS[card.originalCode || card.code]?.type === 'treachery') ? 3 : 0 }],
}
