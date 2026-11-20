import { ALL_CARDS } from '../cards-data.js'

const code = '11090'

export default {
  code,
  playableFromDiscard: true,
  playableOnlyFromDiscard: true,
  returnToHandAfterPlay: true,
  abilities: [{
    kind: 'played',
    label: '将弃牌堆中的所有「希望微光」收入手牌',
    resolve: ({ inv, api }) => {
      const copies = inv.discard.filter(card => ALL_CARDS[card]?.name === ALL_CARDS[code].name)
      for (const copy of copies) api.moveCard({ code: copy, from: 'discard', to: 'hand' }, { seat: inv.seat })
    },
  }],
}
