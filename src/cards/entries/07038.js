export default { code: '07038', scope: 'enemy', weaknessSpawnsAtFarthestLocation: true,
  enemyWeakness: { aloof: true }, abilities: [{ kind: 'forced', trigger: 'enemyPhaseEnds',
    label: '敌人阶段结束：加入1个诅咒',
    criteria: ({ helpers }) => helpers.poolTokenRoom('curse') > 0,
    resolve: ({ api }) => api.chaosTokens.add('curse', 1),
}] }
