// 火车站：只有实际进入已淹没地点才进行检定；撤退使用普通行动。
export default {
  code: '07142', scope: 'location', implemented: true,
  locationRule: {
    onEnter: {
      effect(state, location, api, inv) {
        if (api.mechanics.water.level(location.id) === 0) return
        api.test(inv.seat, 'agility', 2, result => {
          if (!result.success) api.damage(inv.seat, 1)
        }, 0, { code: '07142', name: '火车站', ability: true })
      },
    },
  },
  abilities: [{
    kind: 'action', actionKind: 'resign', label: '撤退：逃离被淹没的村镇', cost: { action: 1 },
    resolve: ({ inv, api }) => api.resign(inv.seat),
  }],
}
