export default { code: '07195', abilities: [{ kind: 'reaction', trigger: 'tokenEffectWouldResolve', cost: { exhaust: true },
  label: '将第二枚诅咒视为骷髅，可将两枚标记移回标记池',
  criteria: ({ state, inv, context }) => context.location === inv.location && context.token === 'curse'
    && state.chaos.revealed.slice(state.chaos.frames.at(-1), context.tokenIndex).includes('curse'),
  resolve: ({ inv, context, api }) => {
    const remove = api.choice({ kind: 'effect', source: '07195', seat: inv.seat,
      prompt: '是否在检定结束后将两枚标记移回标记池？', options: [{ id: 'yes', label: '移回标记池' }, { id: 'no', label: '保留视为骷髅的标记' }] }) === 'yes'
    api.chaosTokens.treat({ index: context.tokenIndex, as: 'skull', retain: !remove })
    api.noteCancelled('chaosToken')
  },
}] }
