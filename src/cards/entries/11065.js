export default {
  code: '11065',
  uses: 0,
  usesType: 'offering',
  abilities: [
    {
      kind: 'reaction', trigger: 'doomPlaced', label: '控制的牌获得毁灭时横置：放置 1 供品',
      cost: { exhaust: true },
      criteria: [({ inv, context }) => context.amount > 0 && (context.card === inv || inv.assets.includes(context.card))],
      resolve: ({ source, api }) => api.addUses(source, 1),
    },
    {
      kind: 'free', label: '横置并移除所有供品（至少 3）：使同地点的一位调查员立即执行一次行动',
      target: { kind: 'investigator' },
      cost: { exhaust: true, uses: { per: 'usesOnSource' } },
      criteria: [({ source }) => source.uses >= 3],
      resolve: ({ target, api }) => {
        if (target) api.beginImmediateAction(target.entity.seat, { source: '11065' })
      },
    },
  ],
}
