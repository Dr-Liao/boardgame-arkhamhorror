export default { code: '07269', additionalTokenCost: { token: 'bless', operation: 'pay', count: 5, sealed: true },
  abilities: [{ kind: 'played', fast: true, trigger: 'mythosEncounterStep', label: '跳过本次抽取遭遇牌步骤',
    criteria: ({ state }) => state.phase === 'mythos' && state.mythosEncounterReplacementRound !== state.round,
    resolve: ({ context, api }) => api.playerTools.skipEncounterStep(context),
  }] }
