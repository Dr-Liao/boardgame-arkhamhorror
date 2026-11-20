export default {
  code: '11093',
  abilities: [{
    kind: 'commit',
    label: '只能单独投入；每张手牌使本卡失去 1 百搭；成功抽 2 张牌',
    skill: { noOtherCommits: true, wildLosesPerHandCard: true, onSuccess: { draw: 2 } },
  }],
}
