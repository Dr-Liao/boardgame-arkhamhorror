// 05300 地点条目（ICC）
// 归属：关卡专用 · inTheClutchesOfChaos（P8 w-clutches）。卡面：弃牌库顶 5/10/15 张：每 5 张移 1 个裂口到当前幕；以此弃掉的弱点会被抽取。
// 一卡一文件：地点行动由 locationRule.actions / performAction 提供，章节 behavior 按
// locationRuleFor(卡号) 通用分派；裂口读写只走 api（breach / moveBreachesToAct）。
import { ALL_CARDS } from '../../_shared.js'

const locationOf = (state, id) => (state.locations || []).find(location => location.id === id) || null
const isWeakness = code => ['weakness', 'basicweakness'].includes(ALL_CARDS[code]?.subtype)

export default {
  code: '05300',
  scope: 'location',
  implemented: true,
  locationRule: {
    actions({ moves, inv }) {
      if ((inv.deck || []).length) moves.push({ rule: 'locMerchantDiscardTop', label: '🃏 弃牌库顶 5/10/15 张：每 5 张移除 1 个裂口，抽到弱点则入手' })
    },
    performAction(state, inv, move, api) {
      if (move.rule !== 'locMerchantDiscardTop') return false
      const location = locationOf(state, move.locationId || inv.location)
      if (!location) return true
      const available = (inv.deck || []).length
      const choices = [5, 10, 15]
      const picked = Number(api.choose?.({
        kind: 'number', source: '05300', seat: inv.seat, prompt: '选择弃掉牌库顶多少张。',
        options: choices.map(value => ({ id: String(value), label: `弃 ${value} 张（牌库 ${available} 张）` })),
      }))
      const count = Math.min(choices.includes(picked) ? picked : choices[0], available)
      const discarded = count > 0 ? (api.discardTop?.(inv.seat, count) || []) : []
      const remove = Math.min(Number(location.breaches || 0), Math.floor(count / 5))
      api.moveBreachesToAct?.(location.id, remove)
      // 以此方式弃掉的弱点走抽牌管线（drawDiscard），让弱点揭示效果正常结算。
      for (const code of discarded.filter(isWeakness)) {
        const index = (inv.discard || []).lastIndexOf(code)
        if (index < 0) continue
        api.drawDiscard?.(inv.seat, index)
        api.info?.(`🃏 弃牌中的弱点「${ALL_CARDS[code]?.nameZh || code}」被抽取。`)
      }
      return true
    },
  },
}
