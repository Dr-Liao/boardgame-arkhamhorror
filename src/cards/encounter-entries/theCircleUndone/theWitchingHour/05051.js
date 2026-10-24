// 05051 节制·XIV（TEMPERANCE · XIV）
// 归属：关卡专用 · theWitchingHour（P8 w-witch）。卡面：背面 - 遭遇牌库弃到剩 5 张；游戏区域卡牌最多的调查员从遭遇弃牌堆顶抽 1 张女巫敌人。
// 一卡一文件：规则只在这里维护；跨章共享规则在 content/campaigns/theCircleUndone/encounter-rules.js。
import { ALL_CARDS, activeInvestigators, hasTrait, originalOf } from '../../_shared.js'

export default {
  code: '05051', scope: 'agenda', implemented: true,
  agendaRule: {
    onReveal(state, agenda, api) {
      while (state.encounterDeck.length > 5) state.encounterDiscard.push(state.encounterDeck.pop())
      // 「游戏区域卡牌最多」只数场上支援（威胁区不在游戏区域，事件/技能不在区域）。
      const counts = activeInvestigators(state).map(inv => ({
        inv, count: (inv.assets || []).length,
      }))
      if (!counts.length) return true
      const most = Math.max(...counts.map(entry => entry.count))
      const candidates = counts.filter(entry => entry.count === most).map(entry => entry.inv)
      const chosen = candidates.length === 1 ? candidates[0] : candidates.find(inv =>
        String(inv.seat) === String(api.choose?.({
          kind: 'investigator', source: '05051', seat: state.campaign?.leadSeat ?? 0,
          prompt: '游戏区域卡牌最多的调查员抽取遭遇弃牌堆顶部的女巫敌人。',
          options: candidates.map(inv => ({ id: String(inv.seat), label: inv.name })),
        }))) || candidates[0]
      const isWitchEnemy = code => ALL_CARDS[code]?.type === 'enemy'
        && (ALL_CARDS[code]?.traits || []).some(trait => String(trait).toLowerCase() === 'witch')
      // 卡面：「从遭遇弃牌堆顶抽取 1 张女巫敌人」——走 drawEncounter 管线（进威胁区/生成并结算），
      // 不是直接 api.spawn 绕过遭遇结算。
      let index = -1
      for (let cursor = state.encounterDiscard.length - 1; cursor >= 0; cursor--) {
        if (!isWitchEnemy(state.encounterDiscard[cursor])) continue
        index = cursor
        break
      }
      if (index >= 0) {
        const code = state.encounterDiscard[index]
        if (typeof api.drawEncounterDiscard === 'function') {
          api.drawEncounterDiscard(chosen.seat, index)
        } else {
          state.encounterDiscard.splice(index, 1)
          api.spawn?.(code, chosen.location)
        }
        api.info?.(`🌑 节制·XIV：${chosen.name} 抽取遭遇弃牌堆顶部的「${ALL_CARDS[code]?.nameZh || code}」。`)
      } else {
        api.info?.('🌑 节制·XIV：遭遇弃牌堆里没有女巫敌人。')
      }
      return true
    },
  },
}
