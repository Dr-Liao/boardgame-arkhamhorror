// 60470 仪式长袍（Ceremonial Robes，Marie Lambeau，1 XP）
// 卡面：你每轮打出的第一张[[法术]]或[[仪式]]卡牌的费用减 1。
import { ALL_CARDS } from '../cards-data.js'

export default {
  code: '60470',
  abilities: [{
    kind: 'reaction',
    trigger: 'beforePlayCost',
    label: '横置：本轮第一张法术/仪式卡牌费用 -1',
    cost: { exhaust: true },
    criteria: [({ context }) => {
      const code = context?.playedCardCode || context?.cardCode
      const card = code ? ALL_CARDS[code] : null
      return Boolean(card) && (card.traits || []).some(trait =>
        ['spell', 'ritual'].includes(String(trait).toLowerCase()))
    }],
    resolve: ({ api, context }) => api.playerTools.modifyPlay(context, { discount: 1 }),
  }],
}
