export default {
  code: '07264', uses: 2, usesType: 'resources',
  abilities: [
    { kind: 'forced', trigger: 'roundStarts', label: '轮初补满至 2 资源',
      resolve: ({ source, api }) => api.playerTools.replenishResources(source.id, 2) },
    ...['intellect', 'agility'].map(skill => ({ kind: 'free', label: `花费 1 资源：本次检定 ${skill} +1`,
      cost: { action: false }, duringOwnSkillTest: true,
      criteria: ({ state, source, helpers }) => [].concat(state.skillTest?.skill || []).includes(skill)
        && (helpers.availableResources() > 0 || source.uses > 0),
      resolve: ({ inv, source, api }) => api.playerTools.resourceBoost(inv.seat, source.id, skill) })),
  ],
}
