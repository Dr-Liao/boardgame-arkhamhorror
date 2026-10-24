// 05052 深夜号叫（The Night Howls）
// 归属：关卡专用 · theWitchingHour（P8 w-witch）。卡面：强制 - 轮末圆环每有 1 个女巫敌人放 1 毁灭；背面 - 每位存活调查员被击败并查找基础征兆/诅咒弱点，做不到者 1 精神创伤。
// 一卡一文件：规则只在这里维护；跨章共享规则在 content/campaigns/theCircleUndone/encounter-rules.js。
import { ALL_CARDS, activeInvestigators, hasTrait, originalOf } from '../../_shared.js'

export default {
  code: '05052', scope: 'agenda', implemented: true,
  agendaRule: {
    onReveal(state, agenda, api) {
      const survivors = activeInvestigators(state)
      for (const inv of survivors) {
        api.defeat?.(inv, 'nightHowls')
        const added = typeof api.addBasicWeakness === 'function'
          ? api.addBasicWeakness(inv.seat, ['omen', 'curse'])
          : null
        if (!added) {
          api.trauma?.(inv.seat, 'mental', 1)
          api.info?.(`🌑 深夜号叫：${inv.name} 找不到合适的弱点，改为承受 1 点精神创伤。`)
        } else {
          api.info?.(`🌑 深夜号叫：${inv.name} 被击败，并从收藏中加入一张基础征兆/诅咒弱点。`)
        }
      }
      return true
    },
    forced: {
      roundEnd(state, agenda, api) {
        const circle = state.locations.find(location => originalOf(location) === '05055b')
        if (!circle) return
        const witches = state.enemies.filter(enemy =>
          (ALL_CARDS[originalOf(enemy)]?.traits || enemy.traits || [])
            .some(trait => String(trait).toLowerCase() === 'witch') && enemy.location === circle.id)
        if (!witches.length) return
        api.doomOn?.(agenda, witches.length)
        api.info?.(`🌑 深夜号叫：${witches.length} 个女巫敌人在圆环，放置 ${witches.length} 个毁灭标记。`)
      },
    },
  },
}
