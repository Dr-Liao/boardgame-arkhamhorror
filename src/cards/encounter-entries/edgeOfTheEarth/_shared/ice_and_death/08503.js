// 08503 冰冻海岸：有遭遇卡牌附属时，帷幕 +2。庇护 2。
import { ALL_CARDS } from '../../../_shared.js'

export default {
  code: '08503', scope: 'location', implemented: true,
  flags: { shelter: 2, campCandidate: true },
  modifiers: [{ target: 'locationShroud', amount: ({ entity }) => entity.revealed && entity.attachments?.some(card =>
    ALL_CARDS[card.originalCode || card.code]?.encounterCode) ? 2 : 0 }],
}
