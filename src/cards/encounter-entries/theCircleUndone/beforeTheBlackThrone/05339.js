// 05339 宇宙门扉
// 宇宙 -：与任意一个已揭示地点的任意方向连接（由 behavior.placeCosmosLocation 按
// definition.locations[].cosmos 指令表执行）。
// 进入时强制：花费 1 个线索，或受到 1 点恐惧。引擎直读 locationRule.onEnter.effect。
export default {
  code: '05339',
  scope: 'location',
  implemented: true,
  locationRule: {
    onEnter: {
      effect(state, location, api, inv) {
        const options = []
        if ((inv.clues || 0) >= 1) options.push({ id: 'clue', label: '花费 1 个线索' })
        options.push({ id: 'horror', label: '受到 1 点恐惧' })
        const answer = api.choose({
          kind: 'location', source: location.id, seat: inv.seat,
          prompt: '进入宇宙门扉：花费 1 个线索，或受到 1 点恐惧。', options,
        })
        if (answer === 'clue' && (inv.clues || 0) >= 1) inv.clues -= 1
        else api.horror(inv.seat, 1)
      },
    },
  },
}