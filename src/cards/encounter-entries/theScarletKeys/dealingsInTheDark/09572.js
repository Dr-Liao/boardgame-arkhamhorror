// 09572 加拉塔码头 · 地点（dealingsInTheDark）
import { ALL_CARDS } from '../../_shared.js'

const CODE = '09572'
const ICON_COST = 3
const SKILLS = { willpower: '意志', intellect: '智力', combat: '战力', agility: '敏捷' }

function entryCostCards(inv, api) {
  const hand = (inv.hand || []).flatMap((code, index) => {
    const card = ALL_CARDS[code]
    if (['weakness', 'basicweakness'].includes(card?.subtype) || inv.hiddenCards?.includes(code)) return []
    return [{ id: `hand:${index}`, code, index, icons: card?.icons || {} }]
  })
  const assets = (inv.assets || []).flatMap(asset => {
    const card = ALL_CARDS[asset.originalCode || asset.code]
    if (card?.permanent || asset.cannotLeavePlay || (api && !api.canDiscardAsset(inv.seat, asset.id))) return []
    return [{ id: `asset:${asset.id}`, code: asset.code, assetId: asset.id, icons: card?.icons || {} }]
  })
  return [...hand, ...assets]
}

const matchingIcons = (card, skill) => (card.icons[skill] || 0) + (card.icons.wild || 0)

function affordableSkills(cards) {
  return Object.keys(SKILLS).filter(skill => cards.some(card => card.icons[skill] > 0)
    && cards.reduce((total, card) => total + matchingIcons(card, skill), 0) >= ICON_COST)
}

function canPayEntryIconCost(inv) {
  return affordableSkills(entryCostCards(inv)).length > 0
}

function payEntryIconCost(inv, api) {
  const cards = entryCostCards(inv, api)
  const skills = affordableSkills(cards)
  if (!skills.length) return false
  const skill = skills.length === 1 ? skills[0] : api.choose({
    kind: 'choice', source: CODE, seat: inv.seat,
    prompt: '加拉塔码头：选择本次支付的技能图标。',
    options: skills.map(id => ({ id, label: SKILLS[id] })),
  })
  if (!skills.includes(skill)) return false
  const available = cards.filter(card => matchingIcons(card, skill) > 0)
  const selected = []
  let total = 0
  while (total < ICON_COST) {
    const id = available.length === 1 ? available[0].id : api.choose({
      kind: 'card', source: CODE, seat: inv.seat,
      prompt: `加拉塔码头：选择从手牌或游戏区弃掉的牌（已选 ${total}/${ICON_COST} 个图标）。`,
      options: available.map(card => ({
        id: card.id, cardCode: card.code,
        label: `${ALL_CARDS[card.code]?.nameZh || card.code}（${card.assetId ? '支援' : '手牌'}，${matchingIcons(card, skill)} 个图标）`,
      })),
    })
    const index = available.findIndex(card => card.id === id)
    if (index < 0) return false
    const [card] = available.splice(index, 1)
    selected.push(card)
    total += matchingIcons(card, skill)
  }
  const hand = selected.filter(card => card.index != null)
  if (hand.length && !api.discardHandCardsAsCost(inv.seat, hand)) return false
  for (const card of selected) if (card.assetId) api.discardAsset(inv.seat, card.assetId)
  return true
}

export default {
  code: CODE,
  scope: 'location',
  implemented: true,
  flags: { victory: 1, printedShroud: 5, printedClues: 1 },
  locationRule: { canPayEntryIconCost, payEntryIconCost },
}
