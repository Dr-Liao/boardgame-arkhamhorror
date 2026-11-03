export default {
  code: '07022',
  abilities: [
    { kind: 'action', label: '加入 1 个诅咒', cost: { action: true },
      criteria: ({ helpers }) => helpers.poolTokenRoom('curse') > 0,
      resolve: ({ api }) => api.chaosTokens.add('curse', 1) },
    { kind: 'action', label: '翻译魔法书：将 5 个诅咒换为祝福', cost: { action: true, discardSelf: true },
      criteria: ({ state }) => state.chaosBag.filter(token => token === 'curse').length === 10,
      resolve: ({ api }) => { api.recordResearch('youHaveTranslatedTheGrimoire'); api.chaosTokens.replace('curse', 'bless', 5) } },
  ],
}
