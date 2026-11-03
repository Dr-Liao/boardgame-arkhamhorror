export default { code: '07156', abilities: [
  { kind: 'reaction', trigger: 'assetEnteredPlay', label: '添加 3 枚祝福',
    limit: { scope: 'perWindow', owner: 'instance' },
    criteria: ({ source, context }) => context.assetId === source.id,
    resolve: ({ api }) => api.chaosTokens.add('bless', 3) },
  { kind: 'forced', trigger: 'upkeepEnd', label: '添加 1 诅咒或弃掉双信仰牧师', resolve: ({ inv, source, api }) => {
    const options = [{ id: 'discard', label: '弃掉双信仰牧师' }]
    if (api.chaosTokens.room('curse') >= 1) options.unshift({ id: 'curse', label: '添加 1 枚诅咒' })
    const choice = options.length === 1 ? 'discard' : api.choice({ kind: 'effect', source: '07156', seat: inv.seat,
      prompt: '添加诅咒或弃掉牧师。', options })
    if (choice === 'curse') api.chaosTokens.add('curse', 1, { exact: true })
    else api.discardAsset(inv.seat, source)
  } },
] }
