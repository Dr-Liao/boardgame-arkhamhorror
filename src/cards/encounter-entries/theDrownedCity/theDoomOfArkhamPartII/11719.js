// 11719 恶心可塑性 · 诡计
// 归属：关卡专属 · theDrownedCity/theDoomOfArkhamPartII（P7 终章下篇）。

// 险境。显现 - 选择一项：密谋 +1 毁灭 / 提高所在地点水位 / 每位调查员 1 伤或 1 恐。
// 读点：单卡 encounterResolve → api.resolveScenarioEvent；behavior.events 结算（检定难度 = 克苏鲁狂怒值，
//       flags.test 由 behavior.runRageTest 读取）。
export default {
  code: '11719',
  scope: 'treachery',
  implemented: true,
  encounterResolve(state, inv, card, api) {
    return api.resolveScenarioEvent('doomOfArkhamPartTwoGrossPlasticity', { seat: inv.seat }) === true
  },
  note: 'approximation：恶心可塑性的三选一由 behavior.grossPlasticity 处理；其余按卡面结算。',
}
