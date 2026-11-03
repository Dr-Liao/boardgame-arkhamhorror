export default {
  code: '07215',
  scope: 'enemy',
  abilities: [{
    kind: 'forced', trigger: 'enemyMoved',
    label: '混血刺客：未交战的猎手移动后再次结算猎手',
    limit: { scope: 'perRound', owner: 'instance' },
    criteria: ({ source, context, helpers }) => context.enemyId === source.id && context.cause === 'hunter'
      && helpers.isEnemyUnengaged(source),
    resolve: ({ source, api }) => {
      if (api.scenario.isEnemyUnengaged(source)) api.scenario.resolveHunterMove(source, { source: '07215' })
    },
  }],
}
