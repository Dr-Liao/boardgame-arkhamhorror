export default { code: '07160', abilities: [{ kind: 'played', fast: true, trigger: 'tokenEffectWouldResolve',
  label: '你或检定者可以投入或收回1张牌',
  // 「带有符号的混乱标记」= skull / cultist / tablet / elderthing（审计 M33：修复前放宽到
  // 任何非数字标记，bless/curse/old sign/autofail/frost 都会误触发）。
  criteria: ({ inv, state, context }) => state.investigators[context.seat]?.location === inv.location
    && ['skull', 'cultist', 'tablet', 'elderthing'].includes(context.token),
  resolve: ({ inv, context, api }) => api.playerTools.lateCommitOrReturn(inv.seat, context.seat),
}] }
