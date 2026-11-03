export default { code: '07224', abilities: [{ kind: 'forced', trigger: 'tokenEffectWouldResolve', label: '掷硬币：将本标记视为祝福或诅咒',
  criteria: ({ inv, context }) => context.seat === inv.seat && ['bless', 'curse'].includes(context.token),
  resolve: ({ inv, context, api }) => {
    const face = api.random() < 0.5 ? 'bless' : 'curse'
    api.info(`幸运便士：${face === 'bless' ? '正面，视为祝福' : '反面，视为诅咒'}。`)
    api.chaosTokens.treat({ index: context.tokenIndex, as: face })
    if (context.token === 'bless' && face === 'curse') api.drawCards(inv.seat, 1)
  },
}] }
