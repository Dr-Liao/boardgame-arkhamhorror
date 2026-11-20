export default {
  code: '11089',
  uses: 2,
  usesType: 'supplies',
  limitPerInvestigator: true,
  abilities: [{
    kind: 'reaction', trigger: 'handCardDiscarded', cost: { exhaust: true },
    label: '弃掉手牌后：横置，放置 1 补给',
    criteria: ({ inv, context }) => context.seat === inv.seat,
    resolve: ({ source, api }) => api.addUses(source, 1),
  }, {
    kind: 'free', cost: { discardSelf: true },
    label: '弃掉本卡：将其上的补给转为资源',
    criteria: ({ source }) => source.uses > 0,
    resolve: ({ inv, source, api }) => api.gainResources(inv.seat, source.uses),
  }],
}
