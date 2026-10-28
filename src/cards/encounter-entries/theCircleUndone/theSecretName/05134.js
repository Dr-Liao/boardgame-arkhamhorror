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
        // 返回哪张弃牌由该调查员选择（不是固定堆顶）。
        const options = (other.discard || []).map((code, index) => ({
          id: String(index), label: ALL_CARDS[originalOf(code)]?.nameZh || String(code),
        }))
        const pickedIndex = api.choose?.({
          kind: 'card', source: '05134', seat: other.seat,
          prompt: '选择 1 张弃牌堆中的卡牌返回手牌。',
          options,
        })
        const index = Number(pickedIndex)
        const index2 = Number.isInteger(index) && index >= 0 && index < other.discard.length ? index : other.discard.length - 1
        other.hand.push(other.discard.splice(index2, 1)[0])
        // 参考实现 `remember $ MeddledWithThePast $ Name.labeled name iid`：写入战役记录
        // （按调查员卡号；后续章节/结局可读）。
        const key = String(other.code || other.name)
        const current = api.campaignRecord?.('meddledWithThePast')
        const meddled = Array.isArray(current) ? [...current] : []
        if (!meddled.includes(key)) meddled.push(key)
        api.setCampaignRecord?.('meddledWithThePast', meddled)
        api.info?.(`⏳ ${other.name} 向过去的自己求助。`)
      }
      return true
    },
  },
}
