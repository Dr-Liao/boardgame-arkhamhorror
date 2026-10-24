// 05134 发霉的走道·今晚早些时候（Moldy Halls · Earlier Tonight）
// 归属：关卡专用 · theSecretName（P8 w-witch）。卡面：[action] 团队每场一次：本地每位调查员可以把弃牌堆 1 张牌返回手牌并记住「沉湎过去」。
// 一卡一文件：规则只在这里维护；跨章共享规则在 content/campaigns/theCircleUndone/encounter-rules.js。
import { ALL_CARDS, activeInvestigators, originalOf } from '../../_shared.js'

export default {
  code: '05134', scope: 'location', implemented: true,
  locationRule: {
    actions({ moves, state, inv, location }) {
      if (inv.location !== location.id) return
      if (state.scenarioFlags?.meddledRequested) return
      moves.push({ action: 'scenarioAction', rule: 'requestPastSelf', label: '⏳ 向过去的自己求助（团队每场一次）' })
    },
    performAction(state, inv, move, api) {
      if (move.rule !== 'requestPastSelf') return false
      state.scenarioFlags ||= {}
      state.scenarioFlags.meddledRequested = true
      for (const other of activeInvestigators(state).filter(entry => entry.location === inv.location)) {
        if (!(other.discard || []).length) continue
        const answer = api.choose?.({
          kind: 'story', source: '05134', seat: other.seat, canSkip: true,
          prompt: '是否从弃牌堆返回 1 张卡牌到手牌（并记住「沉湎过去」）？',
          options: [{ id: 'skip', label: '不求助' }, { id: 'request', label: '返回弃牌堆顶 1 张' }],
        })
        if (answer !== 'request') continue
        other.hand.push(other.discard.pop())
        state.scenarioFlags.meddledWithThePast = [...(state.scenarioFlags.meddledWithThePast || []), other.name]
        api.info?.(`⏳ ${other.name} 向过去的自己求助。`)
      }
      return true
    },
  },
}
