export default {
  code: '07146', scope: 'enemy', implemented: true,
  enemyRule: { revelationSpawnOptions: (state, inv, locationId, api) =>
    api.mechanics.water.level(locationId) < 2 ? { exhausted: true } : {} },
  abilities: [{
    kind: 'forced', trigger: 'enemyEngaged', label: '浮现的深潜者：在淹没地点交战后立即攻击',
    limit: { scope: 'perWindow', owner: 'instance' },
    criteria: ({ inv, source, context, helpers }) => context.enemy?.id === source.id && context.seat === inv.seat
      && helpers.effectiveFloodLevel(inv.seat) > 0,
    resolve: ({ inv, source, api }) => api.scenario.attack(source, inv),
  }],
}
