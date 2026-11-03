export default { code: '07015', abilities: [
  { kind: 'action', label: '躲避：敏捷 +1，投入技能时可再躲避一个交战敌人', cost: { action: true }, countsAs: 'evade', target: { kind: 'enemy', query: ({ inv, entity }) => entity.engagedSeat === inv.seat },
    resolve: ({ inv, target, api }) => api.evade(inv.seat, { enemyId: target.id, bonus: 1, extraEvadeIfCommittedSkill: true }) },
  { kind: 'reaction', trigger: 'testEnds', label: '收回渔网与自己投入的技能',
    criteria: ({ inv, source, context }) => context.seat === inv.seat && context.source?.assetId === source.id,
    resolve: ({ inv, source, api }) => api.investigatorTools.returnWeaponSkills(inv.seat, source.id) },
] }
