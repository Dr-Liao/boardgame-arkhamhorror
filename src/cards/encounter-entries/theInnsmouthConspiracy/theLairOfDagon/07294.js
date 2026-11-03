// Hunter and lowestWillpower prey are printed definition data.
export default {
  code: '07294', scope: 'enemy',
  abilities: [{
    kind: 'forced', trigger: 'enemyEngaged', label: '瑟瑞尼连海深潜者交战后：加入2个诅咒',
    limit: { scope: 'perWindow', owner: 'instance' },
    criteria: ({ inv, source, context, helpers }) => source.id === context.enemy?.id
      && inv.seat === context.seat && helpers.poolTokenRoom('curse') > 0,
    resolve: ({ api }) => api.chaosTokens.add('curse', 2),
  }],
}
