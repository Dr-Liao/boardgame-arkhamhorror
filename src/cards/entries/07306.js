export default { code: '07306', additionalTokenCost: { token: 'curse', operation: 'add', count: 'difficulty' }, abilities: [{
  kind: 'commit', label: '添加等于难度的诅咒作为投入费用，自动成功', skill: {
    anySkill: true, onCommit: ({ api }) => api.setTestAutoSuccess(),
  },
}] }
