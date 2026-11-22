// 60468 宇宙指引（Cosmic Guidance，Marie Lambeau）
// 卡面：如果本次技能检定成功，治疗执行检定的调查员 1 点伤害。
export default {
  code: '60468',
  abilities: [{
    kind: 'commit',
    label: '检定成功则治疗执行者 1 点伤害',
    skill: {
      onSuccessResolve: ({ inv, api }) => api.healDamage(inv.seat, 1),
    },
  }],
}
