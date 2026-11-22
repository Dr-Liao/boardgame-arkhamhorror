import { ALL_CARDS } from '../cards-data.js'

const code = '60420'

function isMystic(cardCode) {
  const card = ALL_CARDS[cardCode]
  return (card?.factions || [card?.klass, card?.klass2, card?.klass3]).includes('mystic')
}

export default {
  code,
  abilities: [{
    kind: 'reaction',
    fromHand: true,
    quickEvent: true,
    trigger: 'chaosRevealEffectWouldResolve',
    label: '你的秘术卡将因揭示标记触发效果时：取消该效果，或额外结算一次',
    criteria: ({ inv, context }) => context.seat === inv.seat && !context.cancelled && isMystic(context.cardCode),
    resolve: ({ api, inv, context }) => {
      const answer = api.choice({
        kind: 'effect',
        source: code,
        seat: inv.seat,
        prompt: `如何处理「${api.cardName(context.cardCode)}」的效果？`,
        options: [
          { id: 'cancel', label: '取消效果' },
          { id: 'repeat', label: '额外结算一次' },
        ],
      })
      api.modifyChaosRevealEffect(context, answer === 'cancel' ? { cancel: true } : { additional: 1 })
    },
  }],
}
