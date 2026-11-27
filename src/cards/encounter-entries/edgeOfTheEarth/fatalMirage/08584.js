// 08584 恐惧暗影：与已破除幻景地点的调查员正常交战。
export default {
  code: '08584', scope: 'enemy', implemented: true,
  enemyRule: { losesAloofAtClearedMirage: true },
  abilities: [{
    kind: 'forced', trigger: ['clueDiscovered', 'clueControlTaken'],
    label: '在其地点发现或取得线索后，在其上放置等量毁灭',
    criteria: ({ inv, source, context }) => context.seat === inv.seat
      && context.location === source.location && context.amount > 0,
    resolve: ({ source, context, api }) => api.doomOn(source, context.amount),
  }],
}
