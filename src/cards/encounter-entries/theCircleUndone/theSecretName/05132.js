// 05132 沃尔特·吉尔曼的房间（Walter Gilman’s Room）
// 归属：关卡专用 · theSecretName（P8 w-witch）。卡面：[action] 每场一次抽 3 张并受 1 恐惧；闹鬼：弃遭遇牌库顶 2 张。入场锁的团队线索费用在 behavior。
// 一卡一文件：规则只在这里维护；跨章共享规则在 content/campaigns/theCircleUndone/encounter-rules.js。
import { ALL_CARDS, activeInvestigators, originalOf } from '../../_shared.js'

export default {
  code: '05132', scope: 'location', implemented: true,
  locationRule: {
    actions({ moves, state, inv, location }) {
      if (inv.location !== location.id) return
      if (state.scenarioFlags?.walterDrawUsed) return
      moves.push({ action: 'scenarioAction', rule: 'walterDrawCards', label: '📜 沃尔特·吉尔曼的房间：抽 3 张卡牌并受到 1 点恐惧（每场一次）' })
    },
    performAction(state, inv, move, api) {
      if (move.rule !== 'walterDrawCards') return false
      state.scenarioFlags ||= {}
      state.scenarioFlags.walterDrawUsed = true
      api.drawCards?.(inv.seat, 3)
      api.horror?.(inv.seat, 1)
      api.info?.(`📜 ${inv.name} 抽 3 张卡牌并受到 1 点恐惧。`)
      return true
    },
  },
}
