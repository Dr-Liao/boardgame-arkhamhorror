// 05137 巫宅遗址（Witch House Ruins）
// 归属：关卡专用 · theSecretName（P8 w-witch）。卡面：[action] 每场一次调查成功改为治愈 2 点恐惧；闹鬼：失去 1 次行动。
// 一卡一文件：规则只在这里维护；跨章共享规则在 content/campaigns/theCircleUndone/encounter-rules.js。
import { ALL_CARDS, activeInvestigators, originalOf } from '../../_shared.js'

export default {
  code: '05137', scope: 'location', implemented: true,
  locationRule: {
    actions({ moves, state, inv, location }) {
      if (inv.location !== location.id) return
      // 每名调查员每场一次（不是团队共享一次）。
      const usedBySeat = state.scenarioFlags?.ruinsHealUsedBySeat || {}
      if (usedBySeat[inv.seat]) return
      moves.push({ action: 'scenarioAction', rule: 'investigateRuins', label: '🔍 调查巫宅遗址（成功改为治愈 2 点恐惧，每名调查员每场一次）' })
    },
    performAction(state, inv, move, api) {
      if (move.rule !== 'investigateRuins') return false
      // 「每场游戏仅限一次」：能力一旦使用就消耗次数（失败也算），不是只在成功时置位。
      state.scenarioFlags ||= {}
      state.scenarioFlags.ruinsHealUsedBySeat = {
        ...(state.scenarioFlags.ruinsHealUsedBySeat || {}), [inv.seat]: true,
      }
      // 参考 WitchHouseRuins.hs：investigateAbility（标准调查管线）+ 成功时治愈 2 恐惧。
      // 地点 0 线索，所以 allowNoClues；成功改为不发现线索。
      api.investigate?.(inv.seat, {
        allowNoClues: true,
        noClueDiscovery: true,
        onInvestigateSuccess: () => {
          api.healHorror?.(inv.seat, 2)
          api.info?.(`🏚️ ${inv.name} 在巫宅遗址挖掘出往事：治愈 2 点恐惧。`)
        },
      })
      return true
    },
  },
}
