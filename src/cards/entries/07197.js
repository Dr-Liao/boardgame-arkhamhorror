export default { code: '07197', abilities: [{ kind: 'commit', label: '按难度与基础技能值之差加入祝福', skill: {
  selfTestOnly: true,
  commitCondition: ({ test, baseSkillValue }) => test.difficulty > baseSkillValue,
  onCommit: ({ state, api }) => api.chaosTokens.add('bless', Math.max(0, state.skillTest.difficulty - api.playerTools.testBaseSkillValue())),
} }] }
