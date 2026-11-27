// 06188 神秘阶梯：移动或撤退的额外费用是弃掉至少有两个相同技能图标的手牌。
import { ALL_CARDS, cannotLeaveHand, isWeaknessCode } from '../../_shared.js'

const CODE = '06188'
const SKILLS = ['willpower', 'intellect', 'combat', 'agility']

function matchingIcons(cards) {
  return SKILLS.reduce((best, skill) => Math.max(best, cards.reduce((total, { icons }) =>
    total + (icons[skill] || 0) + (icons.wild || 0), 0)), 0)
}

function paymentOptions(inv) {
  const cards = (inv.hand || []).map((code, index) => ({ code, index, icons: ALL_CARDS[code]?.icons || {} }))
    .filter(({ code, icons }) => !isWeaknessCode(code) && !cannotLeaveHand(code)
      && !inv.hiddenCards?.includes(code) && matchingIcons([{ icons }]) > 0)
  return cards.flatMap(card => {
    const partners = matchingIcons([card]) >= 2 ? [] : cards.filter(other => other !== card && matchingIcons([card, other]) >= 2)
    return partners.length || matchingIcons([card]) >= 2 ? [{ ...card, partners }] : []
  })
}

function chooseCard(cards, inv, api, prompt) {
  if (cards.length <= 1) return cards[0]
  const id = api.choice({
    kind: 'discard', source: CODE, seat: inv.seat, prompt,
    options: cards.map(({ index, code }) => ({ id: String(index), cardCode: code, label: ALL_CARDS[code]?.nameZh || code })),
  })
  return cards.find(card => String(card.index) === id)
}

function payStairsIconCost(inv, api) {
  const first = chooseCard(paymentOptions(inv), inv, api, '神秘阶梯：选择要弃掉的第一张手牌。')
  if (!first) return false
  const chosen = [first]
  if (first.partners.length) {
    const partner = chooseCard(first.partners, inv, api, '神秘阶梯：选择第二张具有相同技能图标的手牌。')
    if (!partner) return false
    chosen.push(partner)
  }
  return api.discardHandCardsAsCost(inv.seat, chosen.map(({ code, index }) => ({ code, index })))
}

export default {
  code: CODE,
  scope: 'location',
  implemented: true,
  locationRule: {
    moveError(state, inv) {
      if (!paymentOptions(inv).length) return '「神秘阶梯」：没有可弃掉且合计至少有两个相同图标的手牌，不能移动。'
      return undefined
    },
    beforeMove: (state, inv, destination, api) => payStairsIconCost(inv, api),
    beforeResign: (state, inv, api) => payStairsIconCost(inv, api),
  },
}
