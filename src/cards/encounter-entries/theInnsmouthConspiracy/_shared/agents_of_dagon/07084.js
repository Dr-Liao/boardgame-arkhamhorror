export default {
  code: '07084', scope: 'enemy', implemented: true,
  enemyRule: { spawnAnyEmpty: true },
  abilities: [
    {
      kind: 'forced', trigger: ['enemyWouldBeDefeated', 'enemyWouldBeEvaded'],
      label: '无毁灭时改为治愈全部伤害、重整并放置1毁灭',
      limit: { scope: 'perWindow', owner: 'instance' },
      criteria: ({ source, context }) => context.enemy?.id === source.id && !(source.doom > 0),
      resolve: ({ context, api }) => api.enemyOutcomes.replace(context, { healAllDamage: true, ready: true, doom: 1 }),
    },
    {
      kind: 'forced', trigger: 'roundEnds', label: '轮末直立且无毁灭：放置1毁灭',
      limit: { scope: 'perWindow', owner: 'instance' },
      criteria: ({ source }) => !source.exhausted && !(source.doom > 0),
      resolve: ({ source, api }) => api.placeDoomOnCard(source, 1),
    },
  ],
}
