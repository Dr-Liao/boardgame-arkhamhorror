// 06188 地点「神秘阶梯」（Mysterious Stairs · [[墓地]]）· 万千骇形（188）
// 归属：关卡专用 · aThousandShapesOfHorror。卡面：神秘阶梯与其上方和下方的地点连接。
// 作为你在本地点移动或撤退的额外费用，你必须弃掉你至少 1 张手牌，
// 且弃掉的手牌中必须有至少 2 个相同的技能图标。
//
// 依据 Haskell Location/Cards/.../MysteriousStairs_188.hs（AdditionalCostToLeave / AdditionalCostToResign
// = SameSkillIconCost 2）：
//   · 移动：behavior.moveError 先按数据拦截「付不起」，behavior.beforeMove 在移动前结算弃牌；
//   · 撤退：本幕的撤退行动由 behavior.actions（act2 最下层阶梯）提供，调用 locationRule.beforeResign 结算同一费用；
//   · 弃牌走 api.discardFromHand（唯一弃手牌写入口），不直写 inv.hand。
import { ALL_CARDS } from '../../_shared.js'

const MYSTERIOUS_STAIRS = '06188'
const SKILLS = ['willpower', 'intellect', 'combat', 'agility']

const iconsOf = code => ALL_CARDS[code]?.icons || {}

// 该手牌是否含「至少 2 个相同的技能图标」（狂野图标可当作任意技能）。
function hasSameSkillIcons(code) {
  const icons = iconsOf(code)
  for (const skill of SKILLS) {
    if ((Number(icons[skill]) || 0) + (Number(icons.wild) || 0) >= 2) return true
  }
  return (Number(icons.wild) || 0) >= 2
}

const qualifyingHandCards = inv => (inv?.hand || []).filter(hasSameSkillIcons)

// 结算费用：付得起返回 true；付不起返回 false（调用方据此拦截移动/撤退）。
function payStairsIconCost(state, inv, api, source = MYSTERIOUS_STAIRS) {
  const cards = qualifyingHandCards(inv)
  if (!cards.length) return false
  const chosen = cards.length === 1 ? cards[0] : cards.find(code => String(code) === String(api.choice?.({
    kind: 'discard',
    source,
    seat: inv.seat,
    prompt: '神秘阶梯：弃掉 1 张含至少 2 个相同技能图标的手牌。',
    options: cards.map(code => ({ id: code, label: ALL_CARDS[code]?.nameZh || code })),
  }))) || cards[0]
  api.discardFromHand?.(inv.seat, chosen)
  api.info?.(`🪜 神秘阶梯：${inv.name} 弃掉「${ALL_CARDS[chosen]?.nameZh || chosen}」作为移动/撤退的额外费用。`)
  return true
}

export default {
  code: MYSTERIOUS_STAIRS,
  scope: 'location',
  implemented: true,
  locationRule: {
    moveOrResignCost: {
      kind: 'sameSkillIcon',
      count: 2,
      message: '「神秘阶梯」：移动或撤退前，必须弃掉 1 张含至少 2 个相同技能图标的手牌。',
    },
    // behavior.moveError：手牌里没有合格卡时不能移动。
    moveError(state, inv, destination) {
      if (!qualifyingHandCards(inv).length) {
        return '「神秘阶梯」：你没有可弃的「含至少 2 个相同技能图标」的手牌，不能移动。'
      }
      return undefined
    },
    // behavior.beforeMove：真正移动前弃牌付费。
    beforeMove(state, inv, destination, api) {
      return payStairsIconCost(state, inv, api)
    },
    // 撤退（act2 最下层阶梯的行动）前付同一份费用；付不起则由 behavior 拦截。
    beforeResign(state, inv, api) {
      return payStairsIconCost(state, inv, api)
    },
  },
}
