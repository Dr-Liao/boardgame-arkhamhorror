// 60382 灯下黑（升级版，André Patel，3 XP）
// 卡面：快速。在你成功躲避一个敌人后打出。
//       发现你所在地点的 1 个线索（如果你成功且超过难度至少 2 点，你可以一并发现一个连接地点的 1 个线索）。
import { ownSeat } from '../../engine/matcher.js'

export default {
  code: '60382',
  abilities: [{
    kind: 'played',
    fast: true,
    trigger: 'evadeSuccess',
    label: '成功躲避后：发现所在地点 1 个线索；超过 2 点可另发现连接地点 1 个线索',
    criteria: [ownSeat()],
    resolve: ({ state, inv, context, api }) => {
      api.discoverClue(inv.seat, 1)
      if ((context?.successBy ?? 0) < 2) return
      const location = state.locations.find(item => item.id === inv.location)
      const targets = (location?.connections || []).filter(id => state.locations.some(item => item.id === id))
      if (!targets.length) return
      const answer = api.choice({
        kind: 'location', source: '60382', seat: inv.seat, canSkip: true,
        prompt: '成功超过 2 点：是否发现一个连接地点的 1 个线索？',
        options: [{ id: 'skip', label: '不发现' },
          ...targets.map(id => ({ id, label: state.locations.find(item => item.id === id)?.name || id }))],
      })
      if (answer !== 'skip' && targets.includes(answer)) api.discoverClue(inv.seat, 1, answer)
    },
  }],
}
