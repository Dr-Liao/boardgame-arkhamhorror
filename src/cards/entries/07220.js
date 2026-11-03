export default {
  code: '07220', modifiers: [{ target: 'skill:willpower', amount: 1 }],
  abilities: [{ kind: 'reaction', trigger: 'treacheryTestSuccess', label: '诡计意志检定成功：加入 2 个祝福', cost: { exhaust: true },
    criteria: ({ context, helpers }) => (Array.isArray(context.skill) ? context.skill : [context.skill]).includes('willpower')
      && helpers.poolTokenRoom('bless') > 0,
    resolve: ({ api }) => api.chaosTokens.add('bless', 2) }],
}
