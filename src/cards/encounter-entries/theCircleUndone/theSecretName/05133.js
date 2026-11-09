// 05133 凯夏的房间（Keziah’s Room）
// 归属：关卡专用 · theSecretName（P8 w-witch）。卡面：[reaction] 成功调查后：不发现线索，改为放置未知地点牌库顶，然后可以移动过去；闹鬼：弃到巫术卡并抽取。
// 一卡一文件：规则只在这里维护；跨章共享规则在 content/campaigns/theCircleUndone/encounter-rules.js。
import { ALL_CARDS, activeInvestigators, originalOf } from '../../_shared.js'

const traitsOf = card => (ALL_CARDS[originalOf(card)]?.traits || card?.traits || []).map(trait => String(trait).toLowerCase())
const hasTrait = (card, trait) => traitsOf(card).includes(String(trait).toLowerCase())

export default {
  code: '05133', scope: 'location', implemented: true,
  locationRule: {
    // behavior.investigateResult 读取；返回 false 表示「不发现线索」。
    onInvestigateSuccess({ state, location, inv, result, api }) {
      if (!result?.success) return undefined
      const deck = state.extraLocationDecks?.unknownPlaces?.deck || []
      // 牌库空：未发动 → 照常发现线索（不能取消发现）。
      if (!deck.length) {
        api.info?.('🌫️ 未知地点牌库已空：本次照常发现线索。')
        return undefined
      }
      // [reaction] 可选：不发动则照常发现线索。
      const answer = api.choose?.({
        kind: 'reaction', source: '05133', seat: inv.seat, canSkip: true,
        prompt: '凯夏的房间：是否改为放置未知地点牌库顶的地点（不发现线索）？',
        options: [{ id: 'use', label: '发动：放置未知地点，不发现线索' }, { id: 'skip', label: '不发动：照常发现线索' }],
      })
      if (answer === 'skip') return undefined
      const id = api.cosmos?.({ id: 'unknownPlaces', draw: 1 })?.[0]
      if (!id) return undefined
      api.place?.(id)
      const placed = state.locations.find(entry => entry.id === id)
      const here = state.locations.find(entry => entry.id === location.id)
      if (placed && here) {
        // 「本场冒险余下时间视为互相连接」：连接走 api（条目不直写 location.connections）。
        api.connectLocations?.(location.id, id)
      }
      api.info?.(`🌫️ 凯夏的房间：未知地点牌库顶的「${api.locName?.(id) || id}」以未揭示面入场。`)
      const moveAnswer = api.choose?.({
        kind: 'story', source: '05133', seat: inv.seat, canSkip: true,
        prompt: '是否移动到新放置的地点？',
        options: [{ id: 'stay', label: '留在凯夏的房间' }, { id: 'move', label: '移动到新地点' }],
      })
      if (moveAnswer === 'move') api.moveInvestigator?.(inv.seat, id)
      return false
    },
  },
}
