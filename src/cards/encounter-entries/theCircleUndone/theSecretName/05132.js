// 05132 沃尔特·吉尔曼的房间（Walter Gilman’s Room）
// 归属：关卡专用 · theSecretName（P8 w-witch）。
// 正面：[action] 每场一次抽 3 张并受 1 恐惧；闹鬼：弃遭遇牌库顶 2 张。
// 背面：从发霉的走道进入要由该地点的调查员共同支付 1×人数线索。揭示后失效。
// 一卡一文件：规则只在这里维护；跨章共享规则在 content/campaigns/theCircleUndone/encounter-rules.js。
import { ALL_CARDS, activeInvestigators, originalOf } from '../../_shared.js'

export default {
  code: '05132', scope: 'location', implemented: true,
  locationRule: {
    entryError(state, _location, inv) {
      if (inv?.location !== 'moldyHalls') return null
      const cost = state.numInvestigators
      const available = activeInvestigators(state).filter(entry => entry.location === 'moldyHalls')
        .reduce((sum, entry) => sum + (entry.clues || 0), 0)
      if (available < cost) return `「沃尔特·吉尔曼的房间」锁着：发霉的走道上的调查员需共同花费 ${cost} 个线索。`
      return null
    },
    beforeEnter(state, _location, inv, api) {
      if (inv?.location !== 'moldyHalls') return
      const cost = state.numInvestigators
      const available = activeInvestigators(state).filter(entry => entry.location === 'moldyHalls')
        .reduce((sum, entry) => sum + (entry.clues || 0), 0)
      if (available < cost) return
      api.payClues?.(cost, 'moldyHalls')
      api.info?.(`🔒 调查员们共同花费 ${cost} 个线索打开沃尔特·吉尔曼房间的锁。`)
    },
    actions({ moves, state, inv, location }) {
      if (inv.location !== location.id) return
      // 卡面「[action] 每场一次」：每名调查员各一次（不是团队共享一次）。
      const usedBySeat = state.scenarioFlags?.walterDrawUsedBySeat || {}
      if (usedBySeat[inv.seat]) return
      moves.push({ action: 'scenarioAction', rule: 'walterDrawCards', label: '📜 沃尔特·吉尔曼的房间：抽 3 张卡牌并受到 1 点恐惧（每名调查员每场一次）' })
    },
    performAction(state, inv, move, api) {
      if (move.rule !== 'walterDrawCards') return false
      state.scenarioFlags ||= {}
      state.scenarioFlags.walterDrawUsedBySeat = { ...(state.scenarioFlags.walterDrawUsedBySeat || {}), [inv.seat]: true }
      api.drawCards?.(inv.seat, 3)
      api.horror?.(inv.seat, 1)
      api.info?.(`📜 ${inv.name} 抽 3 张卡牌并受到 1 点恐惧。`)
      return true
    },
  },
}
