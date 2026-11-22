export default {
  code: '60404',
  teamActivatable: true,
  abilities: [{
    kind: 'weakness',
    label: '显现：放入你的威胁区域',
    weakness: { type: 'threat' },
  }, {
    kind: 'forced',
    trigger: ['chaosTokenPhysicallyRevealed', 'chaosTokenChanged'],
    label: '揭示、取消或忽略自动失败标记后：受到 1 点伤害和 1 点恐惧',
    criteria: ({ inv, context }) => (context.tokenOwnerSeat ?? context.seat) === inv.seat && context.token === 'autofail'
      && (context.when === 'chaosTokenPhysicallyRevealed' || ['cancel', 'ignore'].includes(context.change)),
    resolve: ({ api, inv }) => api.harm(inv.seat, { damage: 1, horror: 1 }),
  }, {
    kind: 'action',
    label: '花费 2 个行动：弃掉本卡',
    cost: { action: 2 },
    resolve: ({ api, source }) => api.removeThreat(source),
  }],
}
