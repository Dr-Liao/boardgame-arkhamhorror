// 小利透书店：每次在此调查失败，洗入真正的遭遇牌库顶牌。
export default {
  code: '07069', scope: 'location', implemented: true,
  abilities: [{
    kind: 'forced', trigger: 'investigateFail', label: '小利透书店：将遭遇牌库顶牌洗入迹象牌堆',
    limit: { scope: 'perWindow', owner: 'instance' },
    criteria: [({ source, context }) => context.location === source.id],
    resolve: ({ api }) => api.scenarioDecks.addEncounterTop('leads'),
  }],
}
