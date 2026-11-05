export default {
  code: '07220', modifiers: [{ target: 'skill:willpower', amount: 1 }],
  abilities: [{ kind: 'reaction', trigger: 'treacheryTestSuccess', label: '诡计意志检定成功：加入 2 个祝福', cost: { exhaust: true },
    // 「**你**在诡计卡牌上的检定」：窗口对全场逐座位开放，必须确认检定的执行者是本卡控制者
    // （审计 M8：修复前别人/异地检定成功也会给本卡加祝福）。
    criteria: ({ state, inv, context, helpers }) => state.skillTest?.seat === inv.seat
      && (Array.isArray(context.skill) ? context.skill : [context.skill]).includes('willpower')
      && helpers.poolTokenRoom('bless') > 0,
    resolve: ({ api }) => api.chaosTokens.add('bless', 2) }],
}
