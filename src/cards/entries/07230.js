export default { code: '07230', abilities: [{ kind: 'played', label: '移除诅咒并获得资源',
  resolve: ({ inv, state, api }) => {
    const bless = state.chaosBag.filter(token => token === 'bless').length
    const count = Math.min(bless, state.chaosBag.filter(token => token === 'curse').length)
    if (count > 0 && api.chaosTokens.pay('curse', count) === count) api.gainResources(inv.seat, count)
  } }] }
