export default {
  code: '60504',
  teamActivatable: true,
  abilities: [{
    kind: 'weakness',
    label: '显现：放入你的威胁区域',
    weakness: { type: 'threat' },
  }, {
    kind: 'forced',
    trigger: 'skillTestFail',
    limit: 'oncePerTest',
    label: '检定失败后：受到 1 点恐惧',
    criteria: ({ state, inv }) => state.skillTest?.seat === inv.seat,
    resolve: ({ api, inv }) => api.harm(inv.seat, { horror: 1 }),
  }, {
    kind: 'action',
    label: '花费 2 个行动：弃掉本卡',
    cost: { action: 2 },
    resolve: ({ api, source }) => api.removeThreat(source),
  }],
}
