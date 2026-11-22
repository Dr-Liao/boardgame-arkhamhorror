// 60555 丹尼尔·詹姆森 · 独特盟友（3 费，敏捷图标，2/2）
// 卡面：你得到 +1[agility]。
//       [reaction]你攻击或躲避失败后，横置本卡：以技能值 +1 再次尝试该技能检定。
const CODE = '60555'

export default {
  code: CODE,
  modifiers: [{ target: 'skill:agility', amount: 1 }],
  abilities: [{
    kind: 'reaction',
    trigger: ['attackFail', 'evadeFail'],
    label: '横置丹尼尔·詹姆森：以技能值 +1 再次尝试该攻击/躲避检定',
    cost: { exhaust: true },
    criteria: [({ inv, context }) => !context?.seat || context.seat === inv.seat],
    resolve: ({ inv, api }) => {
      api.retryTest(inv.seat, { bonus: 1 })
      api.info(`丹尼尔·詹姆森：${inv.name} 以技能值 +1 再次尝试该检定。`)
    },
  }],
}
