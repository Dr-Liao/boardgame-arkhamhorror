import { ALL_CARDS } from '../cards-data.js'

const code = '52004'

export default {
  code,
  researchRequirement: 'translatedGlyphs',
  uses: 3,
  usesType: 'charges',
  abilities: [{
    kind: 'action',
    countsAs: 'investigate',
    label: '调查成功后可将符合费用的支援放置入场',
    cost: { action: true, uses: 1 },
    resolve: ({ inv, api }) => api.investigate(inv.seat, {
      onInvestigateSuccess: result => {
        const limit = result.value - result.difficulty
        const candidates = [...new Set(inv.hand)].filter(card => {
          const def = ALL_CARDS[card]
          return def?.type === 'asset' && Number.isFinite(def.cost) && def.cost <= limit
            && api.canMakeRoomForAsset(inv.seat, card)
        })
        if (!candidates.length) return
        const selected = api.choice({ kind: 'card', source: code, seat: inv.seat, canSkip: true,
          prompt: `可将印刷费用不超过 ${limit} 的支援放置入场。`,
          options: [{ id: 'skip', label: '不放置支援' }, ...candidates.map(card => ({
            id: card, cardCode: card, label: api.cardName(card),
          }))],
        })
        if (selected === 'skip') return
        api.makeRoomForAsset(inv.seat, selected)
        api.putIntoPlay(inv.seat, selected)
      },
    }),
  }],
}
