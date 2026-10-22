// 04045 入侵者
// 归属：关卡专用 · theUntamedWilds（失落的时代 · 荒莽密林）
// 遭遇组：wilds
// 卡面：[action]：探索。抽取探索牌库顶的一张卡牌。如果该卡牌是一个连接地点，将其放置入场，并移动到该地点。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 密谋 04045「入侵者」：未中毒者获得中毒弱点，随后所有调查员被击败。

import { isPoisonedInvestigator } from '../../_shared.js'

export default {
  code: '04045', scope: 'agenda',
  agendaRule: {
    onReveal(state, agenda, api) {
      for (const inv of state.investigators.filter(item => !item.defeated && !item.resigned)) {
        if (!isPoisonedInvestigator(inv)) {
          const list = state.campaign.investigators
          const entry = Array.isArray(list) ? list[inv.seat] : list?.[inv.seat]
          if (entry) {
            entry.removedCards ||= []
            entry.deck?.push?.('04102')
          }
          // 卡面只写「加入牌库」；不能同时放进威胁区域。
        }
        api.defeat(inv, null)
      }
    },
  },
}
