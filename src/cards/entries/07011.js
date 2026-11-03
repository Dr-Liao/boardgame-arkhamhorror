export default { code: '07011', scope: 'enemy', enemyWeakness: { hunter: true, prey: true },
  enemyRule: { cluesOnlyByInvestigating: true },
  abilities: [{ kind: 'forced', trigger: 'evadeSuccess', label: '被躲避后弃掉影子特工',
    criteria: ({ source, context, state }) => state.enemies.includes(source) && (context.enemy?.id === source.id || context.enemyId === source.id),
    resolve: ({ source, api }) => api.discardEnemy(source) }] }
