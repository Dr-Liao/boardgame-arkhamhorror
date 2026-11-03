export default { code: '07270', uses: 2, usesType: 'resources', abilities: [
  { kind: 'forced', trigger: 'roundStarts', label: '轮初补充至2资源',
    resolve: ({ source, api }) => api.playerTools.replenishResources(source.id, 2) },
  ...['willpower', 'agility'].map(skill => ({ kind: 'free', duringOwnSkillTest: true,
    label: `花费支援或资源池中的1资源：${skill} +1`,
    criteria: ({ state, source, helpers }) => [].concat(state.skillTest?.skill || []).includes(skill)
      && (helpers.availableResources() > 0 || source.uses > 0),
    resolve: ({ inv, source, api }) => api.playerTools.resourceBoost(inv.seat, source.id, skill) })),
] }
