export default {
  code: '51010',
  abilities: [{
    kind: 'commit',
    label: '投入自己的检定，按其难度超过基础值的差值增加至多 3 个万能图标',
    skill: {
      selfTestOnly: true,
      commitCondition: ({ test, baseSkillValue }) => test.difficulty > baseSkillValue,
      iconBonus: ({ test, baseSkillValue }) => test ? Math.max(0, Math.min(3, test.difficulty - baseSkillValue)) : 0,
    },
  }],
}
