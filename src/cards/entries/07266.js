const boosts = ({ state, inv }) => state.skillTest?.seat === inv.seat
  && [state.skillTest.skill].flat().some(skill => ['combat', 'agility'].includes(skill))
export default { code: '07266', uses: 2, usesType: 'resources', abilities: [
  { kind: 'forced', trigger: 'roundStarts', label: '补充至至少 2 资源',
    resolve: ({ source, api }) => api.setAssetUses(source, Math.max(2, source.uses || 0)) },
  { kind: 'free', trigger: ['test.beforeCommit', 'test.afterCommit'], label: '花费自己 1 资源：战斗或敏捷 +1',
    cost: { resources: 1 }, criteria: boosts, resolve: ({ api }) => api.addTestPendingBonus(1) },
  { kind: 'free', trigger: ['test.beforeCommit', 'test.afterCommit'], label: '花费老练探员上 1 资源：战斗或敏捷 +1',
    cost: { uses: 1 }, criteria: boosts, resolve: ({ api }) => api.addTestPendingBonus(1) },
] }
