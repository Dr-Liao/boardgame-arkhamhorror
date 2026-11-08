// 08105 破冰锥（1 级）
// 卡面：快速。
//       [free]攻击或调查时的技能检定期间，横置破冰锥：你本次检定得到技能值+1。
//
// 读点：
//   · 技能检定内的玩家窗口（test.beforeCommit / test.afterCommit）+ duringOwnSkillTest；
//   · api.addTestPendingBonus(1) 加技能值；
//   · 「攻击或调查检定」用引擎的 `assetRule.trackTestTarget` 声明读取：performTest 只有在
//     scenarioRule/assetRule 声明 trackTestTarget 时才把真实检验目标写进 state.skillTest
//     （src/engine/tests.js:166-176 的 actionKind/target）。EotE 正常 fight/investigate 路径
//     只把 actionKind 写进 testInitiated.context，不会写 state.skillTest.actionKind，
//     因此本卡必须声明 trackTestTarget 才能在真实战斗/调查检定窗口里出现（与 TIC 07163/07181 同读点）。
//     该声明只在破冰锥在场时生效，其它战役的 skillTest 形状/重放指纹不变。
//
// 一张卡一个文件：这张卡的行为只在这里维护。

export default {
  code: '08105',
  fast: true,
  assetRule: { trackTestTarget: true },
  abilities: [
    { kind: 'free', trigger: ['test.beforeCommit', 'test.afterCommit'], duringOwnSkillTest: true,
      label: '横置：本次攻击/调查检定 +1 技能值', cost: { action: false, exhaust: true },
      criteria: ({ state }) => ['fight', 'investigate'].includes(state.skillTest?.actionKind),
      resolve: ({ api }) => api.addTestPendingBonus(1) },
  ],
  modifiers: [],
}
