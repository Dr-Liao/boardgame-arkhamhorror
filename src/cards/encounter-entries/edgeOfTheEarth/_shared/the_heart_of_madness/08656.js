// 08656 拱形走廊（Vaulted Corridor）· 地点（古代设施）· the_heart_of_madness
// 卡面：[free]：选择另一个拱形走廊并检定[agility](X)。X 为本地点到该走廊所需移动次数。
//   如果你检定成功，移动到该地点（每轮仅限一次）。
// 读点：abilities 的地点 free 能力（非玩家来源含已揭示地点）；距离走连接图 BFS。
import { entryDistance } from '../../../_shared.js'

const CODE = '08656'

export default {
  code: CODE, scope: 'location', implemented: true,
  flags: { ancientFacility: true },
  abilities: [{
    kind: 'free', actionKind: 'activate', label: '选择另一个拱形走廊，敏捷(X) 移动过去（每轮一次）',
    limit: { scope: 'perRound', owner: 'instance' },
    resolve: ({ state, inv, source, api }) => {
      const others = state.locations.filter(loc => loc.id !== source.id
        && (loc.originalCode || loc.code) === CODE)
      if (!others.length) {
        api.info('「拱形走廊」：场上没有另一条拱形走廊。')
        return
      }
      const chosen = others.length === 1 ? others[0] : others.find(loc => loc.id === api.choice({
        kind: 'location', source: CODE, seat: inv.seat, prompt: '选择要移动到的拱形走廊。',
        options: others.map(loc => ({ id: loc.id, label: loc.name || loc.id })),
      })) || others[0]
      const distance = entryDistance(state, source.id, chosen.id)
      if (!Number.isFinite(distance) || distance <= 0) {
        api.info('「拱形走廊」：目标不可达。')
        return
      }
      api.test(inv.seat, 'agility', distance, { source: { type: 'scenario', code: CODE, ability: true }, resolve: result => {
        if (!result.success) return
        api.moveInvestigator(inv.seat, chosen.id)
        api.info('🚪 「拱形走廊」：移动到「' + (chosen.name || chosen.id) + '」。')
      } })
    },
  }],
}

