export default { code: '07161', abilities: [{ kind: 'played', fast: true, trigger: 'testBegins',
  label: '本次检定可以取消并重抽标记两次',
  criteria: ({ inv, context, state }) => state.investigators[context.seat]?.location === inv.location,
  resolve: ({ api }) => api.playerTools.allowTokenRedraws(2),
}] }
