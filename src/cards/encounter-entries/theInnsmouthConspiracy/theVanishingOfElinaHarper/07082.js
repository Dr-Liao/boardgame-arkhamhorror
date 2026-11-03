// 托马斯·道森：攻击被取消仍可触发；抽牌者是实际被攻击且位于同地点的调查员。
export default {
  code: '07082', scope: 'storyAsset', implemented: true,
  modifiers: [
    { target: 'skill:willpower', amount: 1 },
    { target: 'skill:combat', amount: 1 },
  ],
  abilities: [{
    kind: 'reaction', trigger: 'enemyAttacked', label: '横置托马斯·道森：被攻击的调查员抽1张牌',
    cost: { exhaust: true },
    criteria: [({ state, inv, context, helpers }) => {
      const attacked = state.investigators[context.seat]
      return !!attacked && attacked.location === inv.location && helpers.canDrawCards(attacked.seat)
    }],
    resolve: ({ context, api }) => api.drawCards(context.seat, 1),
  }],
}
