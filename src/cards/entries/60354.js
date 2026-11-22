// 60354 情景娴熟（Know the Scene，André Patel 专属技能）
// 卡面：安德烈·帕特尔牌库专用。本卡牌投入到调查或谈判时，其获得 [wild][wild]。
export default {
  code: '60354',
  abilities: [{
    kind: 'commit',
    label: '投入调查/谈判时获得 2 个万能图标',
    skill: {
      onCommit: ({ test, api }) => {
        if (['investigate', 'parley'].includes(test?.actionKind)) api.addTestValue(2)
      },
    },
  }],
}
