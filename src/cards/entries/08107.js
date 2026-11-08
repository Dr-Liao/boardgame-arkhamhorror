// 08107 破冰锥（3 级）
// 卡面：快速。
//       [free]攻击或调查时的技能检定期间，横置破冰锥：你本次检定得到技能值+1。
//       如果你成功，你可以弃掉破冰锥来使得本次攻击造成+1伤害(如果你攻击)，或发现你所在地点的额外1个线索(如果你调查)。
//
// 读点：
//   · +1 技能值走技能检定内的玩家窗口 + api.addTestPendingBonus(1)；
//   · 「攻击或调查检定」用引擎的 `assetRule.trackTestTarget` 声明写进 state.skillTest.actionKind
//     （src/engine/tests.js:166-176；EotE 正常 fight/investigate 只写 testInitiated.context）。
//     该声明只在破冰锥在场时生效，其它战役的 skillTest 形状/重放指纹不变；
//   · 第二子句走引擎 P6 原语 api.playerTools.onTestSuccess（src/engine/api-misc.js:1512-1528，
//     引擎注释即点名 08107）：在检定窗口登记「成功后弃掉来源 + 本次攻击 +1 伤害 / 额外 1 线索」，
//     由 tests.js 成功结算段统一消费（先弃置来源，再把伤害并入本次攻击；失败则不弃卡）。
//
// 一张卡一个文件：这张卡的行为只在这里维护。

export default {
  code: '08107',
  fast: true,
  assetRule: { trackTestTarget: true },
  abilities: [
    { kind: 'free', trigger: ['test.beforeCommit', 'test.afterCommit'], duringOwnSkillTest: true,
      label: '横置：本次攻击/调查检定 +1 技能值', cost: { action: false, exhaust: true },
      criteria: ({ state }) => ['fight', 'investigate'].includes(state.skillTest?.actionKind),
      resolve: ({ api }) => api.addTestPendingBonus(1) },
    { kind: 'free', trigger: ['test.beforeCommit', 'test.afterCommit'], duringOwnSkillTest: true,
      label: '弃掉破冰锥：成功后本次攻击 +1 伤害/额外 1 线索', cost: { action: false },
      limit: 'oncePerTest',
      // 第二子句是同一句卡文的续写：必须先发动第一子句（横置破冰锥）才允许在成功后弃置它。
      criteria: ({ state, source }) => Boolean(source) && source.exhausted === true
        && ['fight', 'investigate'].includes(state.skillTest?.actionKind),
      resolve: ({ state, inv, source, api }) => {
        if (!source) return
        if (state.skillTest?.actionKind === 'investigate') {
          api.playerTools.onTestSuccess(inv.seat, { extraClue: 1, discardSelf: true, sourceId: source.id })
        } else {
          api.playerTools.onTestSuccess(inv.seat, { attackDamageBonus: 1, discardSelf: true, sourceId: source.id })
        }
      } },
  ],
  modifiers: [],
}
