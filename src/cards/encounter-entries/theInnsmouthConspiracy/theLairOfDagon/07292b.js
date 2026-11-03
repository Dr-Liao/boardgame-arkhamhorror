export default {
  code: '07292b', scope: 'enemy',
  modifiers: [{
    target: 'enemyHealth',
    condition: { when: ({ source, entity }) => source.id === entity.id },
    amount: ({ state }) => 6 * state.numInvestigators,
  }],
  abilities: [{
    kind: 'forced', trigger: 'skillTestFailed', label: '达贡：本地调查员检定失败后，重整并攻击该调查员',
    limit: { scope: 'perWindow', owner: 'instance' },
    criteria: ({ inv, source, context }) => context.seat === inv.seat && inv.location === source.location,
    resolve: ({ inv, source, api }) => {
      api.scenario.readyEnemy(source)
      api.scenario.attack(source, inv)
    },
  }],
}
