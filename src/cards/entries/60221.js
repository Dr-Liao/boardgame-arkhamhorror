// 60221 窥看不思议之事
// 卡面：抽取1张卡牌。将你手牌中任意数量的非弱点卡牌混洗入你的牌库。然后，抽取等量卡牌。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

import { ALL_CARDS } from '../cards-data.js'

const isWeakness = code => ['weakness', 'basicweakness'].includes(ALL_CARDS[code]?.subtype)

export default {
  code: '60221',
  abilities: [{
    kind: 'played',
    label: '抽 1 张；将任意张非弱点手牌洗回牌库，再抽等量',
    resolve: ({ inv, api }) => {
      api.drawCards(inv.seat, 1)
      const selected = []
      const candidates = inv.hand.filter(card => !isWeakness(card) && !(inv.hiddenCards || []).includes(card))
      while (candidates.length) {
        const answer = api.choice({
          kind: 'card', source: '60221', seat: inv.seat, canSkip: true,
          prompt: '选择一张要洗回牌库的手牌，或完成。',
          options: [{ id: 'done', label: '完成' }, ...candidates.map((card, index) => ({
            id: String(index), cardCode: card, label: api.cardName(card),
          }))],
        })
        if (answer === 'done') break
        const [card] = candidates.splice(Number(answer), 1)
        if (card) selected.push(card)
      }
      let returned = 0
      for (const card of selected) {
        if (api.moveCard({ code: card, from: 'hand', to: 'deckTop' }, { seat: inv.seat })) returned++
      }
      if (returned > 0) {
        api.shuffleDeck(inv.seat)
        api.drawCards(inv.seat, returned)
      }
    },
  }],
}
