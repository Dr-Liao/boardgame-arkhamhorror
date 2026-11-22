// 12066 宇宙意志（Will of the Cosmos）
// 卡面：在你控制的一张玩家卡牌上放置1个毁灭标记。然后，发现你所在地点的1个线索和另一个已揭示地点的1个线索。
//
// 读点：
//   · 事件结算 → kind:'played' 的 resolve；
//   · 放置毁灭 → api.placeDoomOnCard（doom-limit 的既有入口，可放在任何玩家卡上）；
//   · 发现线索 → api.discoverClue(seat, n, locationId)（09059 同一入口）；
//   · 「另一个已揭示地点」由条目枚举 state.locations 的 revealed 读点并让玩家选择。
const CODE = '12066'

export default {
  code: CODE,
  abilities: [
    {
      kind: 'played',
      label: '在你控制的一张玩家卡上放置 1 毁灭，然后在你所在地点与另一个已揭示地点各发现 1 个线索',
      resolve: ({ state, inv, api }) => {
        const controlled = (inv.assets || [])
        if (!controlled.length) {
          api.info('你没有可放置毁灭标记的玩家卡牌。')
          return
        }
        const targetId = controlled.length === 1 ? controlled[0].id : api.choice({
          kind: 'target', source: CODE, seat: inv.seat,
          prompt: '选择要放置 1 个毁灭标记的玩家卡牌。',
          options: controlled.map(asset => ({ id: asset.id, label: api.cardName(asset.code) })),
        })
        const target = controlled.find(asset => asset.id === targetId) || controlled[0]
        if (!target) return
        api.placeDoomOnCard(target, 1)
        api.info(`🌌「宇宙意志」：在「${api.cardName(target.code)}」上放置 1 个毁灭标记。`)
        const here = state.locations.find(location => location.id === inv.location)
        if (here) api.discoverClue(inv.seat, 1)
        const others = state.locations.filter(location => location.id !== inv.location && location.revealed !== false)
        if (!others.length) return
        const locationId = others.length === 1 ? others[0].id : api.choice({
          kind: 'location', source: CODE, seat: inv.seat,
          prompt: '选择另一个已揭示地点，在其中发现 1 个线索。',
          options: others.map(location => ({ id: location.id, label: location.name })),
        })
        const location = others.find(item => item.id === locationId) || others[0]
        if (!location) return
        const got = api.discoverClue(inv.seat, 1, location.id)
        api.info(`🌌「宇宙意志」：在「${location.name}」发现 ${got} 个线索。`)
      },
    },
  ],
  modifiers: [],
}
