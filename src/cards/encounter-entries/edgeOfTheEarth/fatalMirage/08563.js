// 08563 古老者厅室
export default {
  code: '08563', scope: 'location', implemented: true,
  flags: { mirageId: 'elderChamber', tier: 2 },
  abilities: [{
    kind: 'forced', trigger: 'clueDiscovered', label: '一次发现至少 2 个线索：洗入 1 张忒咳哩-哩',
    criteria: ({ inv, source, context }) => context.seat === inv.seat && context.location === source.id && context.amount >= 2,
    resolve: ({ inv, api }) => api.mechanics.tekeli.shuffleIn(inv.seat, 1),
  }],
}
