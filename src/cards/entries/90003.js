export default {
  code: '90003',
  threatCannotLeaveWhileCounters: true,
  abilities: [{
    kind: 'weakness',
    label: '进入威胁区并改变旧印的结算',
    weakness: {
      type: 'threat',
      horror: 3,
      purgeAbility: true,
      tokenFaceReplacements: { eldersign: ['cultist', 'tablet', 'elderthing'] },
    },
  }],
}
