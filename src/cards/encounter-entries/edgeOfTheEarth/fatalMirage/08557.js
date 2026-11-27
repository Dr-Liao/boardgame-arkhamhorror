// 08557 大本营
export default {
  code: '08557', scope: 'location', implemented: true,
  flags: { mirageId: 'baseCamp', tier: 1 },
  abilities: [{
    kind: 'reaction', trigger: 'testWouldFail', label: '受到 1 恐惧：本次调查的技能值 +1',
    cost: { horror: 1 },
    criteria: ({ state, inv, source, context }) => context.seat === inv.seat
      && state.skillTest?.actionKind === 'investigate' && state.skillTest?.target?.id === source.id
      && context.difficulty - (context.testValue + (context.testBonus || 0)) === 1,
    resolve: ({ context }) => { context.testBonus = (context.testBonus || 0) + 1 },
  }],
}
