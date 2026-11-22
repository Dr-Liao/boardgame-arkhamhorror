// 60463 巴尔的恩赐（Favor of Baalshandor，Marie Lambeau）
// 卡面：作为打出巴尔的恩赐的额外费用，受到 1 点伤害。
//       从你的手牌打出一张[[法术]]或[[仪式]]支援，其费用减 3。打出本卡牌不会引起借机攻击。
import { ownSeat } from '../../engine/matcher.js'
import { ALL_CARDS } from '../cards-data.js'

const traitCard = card => (ALL_CARDS[card.code]?.traits || [])
  .some(trait => ['spell', 'ritual'].includes(String(trait).toLowerCase()))

export default {
  code: '60463',
  abilities: [{
    kind: 'played',
    noOpportunityAttack: true,
    label: '受到 1 点伤害；从手牌打出法术/仪式支援，费用 -3',
    resolve: ({ inv, api }) => {
      api.directDamage(inv.seat, 1)
      const cards = [...new Set((inv.hand || []).filter(code => ALL_CARDS[code]
        && traitCard({ code }) && ['asset'].includes(ALL_CARDS[code].type)))]
      if (!cards.length) {
        api.info('手牌里没有法术或仪式支援。')
        return
      }
      const options = cards.map(code => ({ id: code, cardCode: code, label: api.cardName(code) }))
      const chosen = cards.length === 1 ? cards[0] : api.choice({
        kind: 'card', source: '60463', seat: inv.seat,
        prompt: '选择要打出的法术/仪式支援（费用 -3）。', options,
      })
      const code = cards.includes(chosen) ? chosen : cards[0]
      api.playCard(inv.seat, code, { discount: 3, noAction: true })
    },
  }],
  flags: { additionalCostDamage: 1 },
}
