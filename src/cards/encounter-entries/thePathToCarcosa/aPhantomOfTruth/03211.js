// 03211 大木偶剧场
// 归属：关卡专用 · aPhantomOfTruth（卡尔克萨之路 · 真相幻影）
// 遭遇组：a_phantom_of_truth
// 卡面：强制 - 在你揭示大木偶剧场后：你必须受到2点恐惧，或将你全部非弱点手牌洗入你的牌库，然后抽取等量的卡牌。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 大木偶剧场（03211）：揭示时受到 2 点恐惧，或洗回全部非弱点手牌并重抽。

import { ALL_CARDS } from '../../_shared.js'

export default {
  code: '03211', scope: 'location',
  locationRule: {
    onReveal(state, location, api, seat) {
      const answer = api.choose({
        kind: 'location',
        source: '03211',
        seat: seat ?? state.currentSeat,
        prompt: '揭示大木偶剧场：选择受到2点恐惧，或洗回全部非弱点手牌并重抽。',
        options: [{ id: 'horror', label: '受到2点恐惧' }, { id: 'shuffle', label: '洗回并重抽手牌' }],
      })
      const inv = state.investigators[seat ?? state.currentSeat]
      if (!inv) return
      if (answer === 'horror') api.horror(inv.seat, 2)
      else {
        // 只洗回非弱点手牌，混洗后再抽等量。
        const cards = inv.hand.filter(code => ALL_CARDS[code]?.subtype !== 'weakness')
        for (const code of cards) inv.hand.splice(inv.hand.indexOf(code), 1)
        inv.deck.push(...cards)
        api.shuffleDeck(inv.seat)
        api.drawCards(inv.seat, cards.length)
      }
    },
  },
}
