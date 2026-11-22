const testWindows = ['test.beforeCommit', 'test.afterCommit']
const skills = [
  ['willpower', '意志'],
  ['intellect', '智力'],
]

export default {
  code: '60428',
  uses: 2,
  usesType: 'resources',
  abilities: [{
    kind: 'forced',
    trigger: 'roundStarts',
    label: '每轮开始时补满至 2 资源',
    resolve: ({ source, api }) => api.playerTools.replenishResources(source.id, 2),
  }, ...skills.flatMap(([skill, label]) => [
    { label: '从资源池花费 1 资源：' + label + ' +1', cost: { resources: 1 } },
    { label: '从本卡花费 1 资源：' + label + ' +1', cost: { uses: 1 } },
  ].map(ability => ({
    ...ability,
    kind: 'free',
    trigger: testWindows,
    duringOwnSkillTest: true,
    criteria: ({ state }) => state.skillTest?.skill?.includes(skill),
    resolve: ({ api }) => api.addPendingTestBonus(1),
  })))],
}
