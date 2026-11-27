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
        const controlled = api.controlledPlayerCards(inv.seat)
        if (!controlled.length) return
        const key = card => card === inv ? `investigator:${inv.seat}` : card.id
        const targetId = controlled.length === 1 ? key(controlled[0]) : api.choice({
          kind: 'card', source: CODE, seat: inv.seat,
          prompt: '选择要放置 1 个毁灭标记的玩家卡牌。',
          options: controlled.map(card => ({ id: key(card), label: api.cardName(card.code), cardCode: card.code })),
        })
        const target = controlled.find(card => key(card) === targetId)
        if (!target) return
        const previousDoom = target.doom || 0
        if (api.placeDoomOnCard(target, 1) <= previousDoom) return
        api.info(`🌌「宇宙意志」：在「${api.cardName(target.code)}」上放置 1 个毁灭标记。`)
        const here = state.locations.find(location => location.id === inv.location)
        if (here) api.discoverClue(inv.seat, 1)
        const others = state.locations.filter(location => location.id !== inv.location && location.revealed
          && location.clues > 0 && api.scenario.canDiscoverClueAt(inv.seat, location.id))
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
