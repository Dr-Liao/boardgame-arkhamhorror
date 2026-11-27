// 08710 失落的修格斯 · 猎手。交战时抽取并结算 1 张忒咳哩-哩；不能抽时攻击。
export default {
  code: '08710', scope: 'enemy', implemented: true,
  abilities: [{
    kind: 'forced', trigger: 'enemyEngaged',
    label: '交战后：结算忒咳哩-哩牌库顶牌；不能则它攻击你',
    criteria: ({ source, context }) => context.enemy?.id === source.id,
    resolve: ({ state, source, context, api }) => {
      if (api.resolveTekeliTop(context.seat)) return
      api.scenario.attack(source, state.investigators[context.seat])
    },
  }],
}
