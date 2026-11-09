// 05294 地点条目（ICC）
// 归属：关卡专用 · inTheClutchesOfChaos（P8 w-clutches）。卡面：[fast] 弃遭遇牌库顶 3 张；如可能，选择其中 1 张「力量」诡计并结算其显现能力；移除此处 1 个裂口并移到当前幕。
// 一卡一文件：地点行动由 locationRule.actions / performAction 提供，章节 behavior 按
// locationRuleFor(卡号) 通用分派；裂口读写只走 api（breach / moveBreachesToAct）。
import { ALL_CARDS } from '../../_shared.js'

const locationOf = (state, id) => (state.locations || []).find(location => location.id === id) || null
const isPower = code => (ALL_CARDS[code]?.traits || []).some(trait => String(trait).toLowerCase() === 'power')

export default {
  code: '05294',
  scope: 'location',
  implemented: true,
  locationRule: {
    actions({ moves, state }) {
      // 卡面不要求此处有裂口，但要求遭遇牌库有牌可弃。
      if ((state.encounterDeck || []).length) {
        moves.push({ rule: 'locSouthsideDiscard', label: '🎴 弃遭遇牌库顶 3 张：如可能结算其中 1 张力量诡计的显现；移除 1 个裂口并移到当前幕', actions: 0, fast: true })
      }
    },
    performAction(state, inv, move, api) {
      if (move.rule !== 'locSouthsideDiscard') return false
      const location = locationOf(state, move.locationId || inv.location)
      if (!location) return true
      const discarded = api.discardEncounterTop?.(3, { reshuffle: false }) || []
      const powers = discarded.filter(isPower)
      api.info?.(`🎴 弃掉遭遇牌库顶 ${discarded.length} 张：${discarded.map(code => ALL_CARDS[code]?.nameZh || code).join('、') || '（空）'}。`)
      if (powers.length) {
        const chosen = powers.length === 1 ? powers[0] : api.choose?.({
          kind: 'card', source: '05294', seat: inv.seat, prompt: '选择 1 张力量诡计结算其显现能力。',
          options: powers.map(code => ({ id: code, label: ALL_CARDS[code]?.nameZh || code })),
        })
        const code = powers.includes(chosen) ? chosen : powers[0]
        // 卡面是「结算其显现能力」而不是「抽这张牌」：在弃牌堆就地结算。
        api.replayEncounterRevelation?.(inv.seat, code)
      }
      api.moveBreachesToAct?.(location.id, 1)
      return true
    },
  },
}
