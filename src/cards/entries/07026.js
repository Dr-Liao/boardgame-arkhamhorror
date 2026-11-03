export default { code: '07026', abilities: [
  { kind: 'entersPlay', label: '封印至多 5 枚诅咒', resolve: ({ inv, source, api }) => api.playerTools.sealUpTo(inv.seat, source.id, 'curse', 5) },
  { kind: 'forced', trigger: 'mythosEnd', label: '花费 1 资源或弃掉黑暗仪式', resolve: ({ inv, source, api }) => {
    const options = [{ id: 'discard', label: '弃掉黑暗仪式' }]
    if (api.availableResources(inv.seat) >= 1) options.unshift({ id: 'pay', label: '花费 1 资源' })
    const answer = options.length === 1 ? 'discard' : api.choice({ kind: 'effect', source: '07026', seat: inv.seat,
      prompt: '花费资源维持仪式，或弃掉它。', options })
    if (answer === 'pay') api.spendResources(inv.seat, 1)
    else api.discardAsset(inv.seat, source)
  } },
] }
