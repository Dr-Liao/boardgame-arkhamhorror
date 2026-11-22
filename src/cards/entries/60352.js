// 60352 退场娴熟（Know the Exit，André Patel 专属技能）
// 卡面：安德烈·帕特尔牌库专用。本卡牌投入到攻击或躲避时，其获得 [wild][wild]。
export default {
  code: '60352',
  abilities: [{
    kind: 'commit',
    label: '投入攻击/躲避时获得 2 个万能图标',
    skill: {
      onCommit: ({ test, api }) => {
        if (['fight', 'evade'].includes(test?.actionKind)) api.addTestValue(2)
      },
    },
  }],
}
