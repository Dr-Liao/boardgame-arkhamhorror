const sealed = (state, id) => (state.chaos?.sealed || []).filter(item => item.source === id).length
export default {
  code: '07019', assetRule: { discardWithoutSealedTokens: true, costReductionAtLocation: true },
  playCostReductionProvider: (state, inv, card, source) => source && !source.exhausted && sealed(state, source.id) ? 2 : 0,
  abilities: [
    { kind: 'entersPlay', label: '封印最多 5 个祝福', resolve: ({ inv, source, api }) => api.playerTools.sealUpTo(inv.seat, source.id, 'bless', 5) },
    { kind: 'reaction', trigger: 'beforePlayCost', label: '横置并释放 1 个标记：打出费用 -2', cost: { exhaust: true },
      criteria: ({ state, inv, source, context }) => state.investigators[context.seat]?.location === inv.location && sealed(state, source.id) > 0,
      resolve: ({ source, api, context }) => {
        if (api.chaosTokens.release(source.id, null, 1) === 1) api.playerTools.modifyPlay(context, { discount: 2 })
      } },
  ],
}
