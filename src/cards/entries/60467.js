// 60467 鲜血诅咒（Blood Curse，Marie Lambeau）
// 卡面：每次技能检定最多投入 1 张。如果本次技能检定成功，受到 1 点直接伤害。
export default {
  code: '60467',
  abilities: [{
    kind: 'commit',
    label: '检定成功则受到 1 点直接伤害',
    skill: {
      maxPerTest: 1,
      onSuccessResolve: ({ inv, api }) => api.directDamage(inv.seat, 1),
    },
  }],
}
