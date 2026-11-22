// 60368 灯下黑（Right Under Their Noses，André Patel）
// 卡面：快速。在你成功躲避一个敌人后打出。
//       发现你所在地点的 1 个线索（如果你成功且超过难度至少 2 点，你可以改为发现一个连接地点的 1 个线索）。
import { ownSeat } from '../../engine/matcher.js'

export default {
  code: '60368',
  abilities: [{
    kind: 'played',
    fast: true,
    trigger: 'evadeSuccess',
    label: '成功躲避后：发现 1 个线索（超过 2 点可改发现连接地点的线索）',
    criteria: [ownSeat()],
    resolve: ({ state, inv, context, api }) => {
      const successBy = context?.successBy ?? 0
      if (successBy >= 2) {
        const location = state.locations.find(item => item.id === inv.location)
        const targets = (location?.connections || []).filter(id => state.locations.some(item => item.id === id))
        if (targets.length) {
          const answer = api.choice({
            kind: 'location', source: '60368', seat: inv.seat,
            prompt: '发现哪里的线索？',
            options: [{ id: inv.location, label: '所在地点' },
              ...targets.map(id => ({ id, label: state.locations.find(item => item.id === id)?.name || id }))],
          })
          if (answer && answer !== inv.location && targets.includes(answer)) {
            api.discoverClue(inv.seat, 1, answer)
            return
          }
        }
      }
      api.discoverClue(inv.seat, 1)
    },
  }],
}
