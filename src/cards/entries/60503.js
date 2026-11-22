export default {
  code: '60503',
  teamActivatable: true,
  abilities: [{
    kind: 'weakness',
    label: '显现：放入你的威胁区域',
    weakness: { type: 'threat' },
  }, {
    kind: 'forced',
    trigger: 'testInitiated',
    label: '发起难度至少为 4 的检定后：受到 1 点伤害',
    criteria: ({ context, inv, state }) => context.seat === inv.seat && state.skillTest?.difficulty >= 4,
    resolve: ({ api, inv }) => api.harm(inv.seat, { damage: 1 }),
  }, {
    kind: 'action',
    label: '花费 2 个行动：弃掉本卡',
    cost: { action: 2 },
    resolve: ({ api, source }) => api.removeThreat(source),
  }],
}
