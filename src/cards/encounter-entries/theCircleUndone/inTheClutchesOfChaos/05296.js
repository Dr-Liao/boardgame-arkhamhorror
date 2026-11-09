// 05296 地点条目（ICC）
// 归属：关卡专用 · inTheClutchesOfChaos（P8 w-clutches）。卡面：弃 1 张手牌：移除裂口（每有 1 个对应技能图标多移除 1），移到当前幕。
// 一卡一文件：地点行动由 locationRule.actions / performAction 提供，章节 behavior 按
// locationRuleFor(卡号) 通用分派；裂口读写只走 api（breach / moveBreachesToAct）。
import { ALL_CARDS } from '../../_shared.js'

const locationOf = (state, id) => (state.locations || []).find(location => location.id === id) || null
const breachesOf = location => Number(location?.breaches || 0)

export default {
  code: '05296',
  scope: 'location',
  implemented: true,
  locationRule: {
    actions({ moves, inv, location }) {
      if (breachesOf(location) > 0 && (inv.hand || []).length) moves.push({ rule: 'locDiscardIconBreach', label: '🃏 弃 1 张手牌：移除裂口（每有 1 个敏捷图标多移除 1），移到当前幕' })
    },
    performAction(state, inv, move, api) {
      if (move.rule !== 'locDiscardIconBreach') return false
      const location = locationOf(state, move.locationId || inv.location)
      if (!location) return true
      const discarded = api.discardOneFromHand?.(inv.seat, { source: '05296' })
      if (!discarded) return true
      const bonus = Number(ALL_CARDS[discarded]?.icons?.agility || 0)
      const want = 1 + Math.min(breachesOf(location), bonus)
      api.moveBreachesToAct?.(location.id, want)
      api.info?.(`🃏 ${inv.name} 弃掉「${api.cardName?.(discarded) || discarded}」：移除 ${want} 个裂口并移到当前幕。`)
      return true
    },
  },
}
