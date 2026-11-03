export default { code: '07014', abilities: [
  { kind: 'action', label: '攻击：战斗 +1，投入技能时伤害 +1', cost: { action: true }, countsAs: 'fight', target: { kind: 'enemy' },
    resolve: ({ inv, target, api }) => api.fight(inv.seat, target.id, { combatBonus: 1, damageIfCommittedSkill: 1 }) },
  { kind: 'reaction', trigger: 'testEnds', label: '收回鱼叉与自己投入的技能',
    criteria: ({ inv, source, context }) => context.seat === inv.seat && context.source?.assetId === source.id,
    resolve: ({ inv, source, api }) => api.investigatorTools.returnWeaponSkills(inv.seat, source.id) },
] }
