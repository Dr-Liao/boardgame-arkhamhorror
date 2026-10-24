// 05136 古老者之城（City of Elder Things）
// 归属：关卡专用 · theSecretName（P8 w-witch）。卡面：[reaction] 揭示后受到 2 点恐惧：放置未知地点牌库顶，然后两者视为互相连接。
// 一卡一文件：规则只在这里维护；跨章共享规则在 content/campaigns/theCircleUndone/encounter-rules.js。
import { ALL_CARDS, activeInvestigators, originalOf } from '../../_shared.js'

export default {
  code: '05136', scope: 'location', implemented: true,
  locationRule: {
    onReveal(state, location, api, seat) {
      const inv = seat != null ? state.investigators[seat] : activeInvestigators(state)[0]
      if (!inv) return
      const answer = api.choose?.({
        kind: 'reaction', source: '05136', seat: inv.seat, canSkip: true,
        prompt: '是否受到 2 点恐惧，把一个未知地点放入场并与之连接？',
        options: [{ id: 'skip', label: '不发动' }, { id: 'takeHorror', label: '受到 2 点恐惧并放置未知地点' }],
      })
      if (answer !== 'takeHorror') return
      api.horror?.(inv.seat, 2)
      const id = api.cosmos?.({ id: 'unknownPlaces', draw: 1 })?.[0]
      if (!id) return
      api.place?.(id)
      const placed = state.locations.find(entry => entry.id === id)
      if (!placed) return
      if (!location.connections.includes(id)) location.connections.push(id)
      if (!placed.connections.includes(location.id)) placed.connections.push(location.id)
      api.info?.(`🌫️ 古老者之城与「${api.locName?.(id) || id}」互相连接。`)
    },
  },
}
