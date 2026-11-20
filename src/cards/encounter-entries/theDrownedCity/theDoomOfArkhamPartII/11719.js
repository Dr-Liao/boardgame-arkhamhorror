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
  note: "显现：险境；api.choose 三选一（behavior.grossPlasticity）：密谋 +1 毁灭（api.addDoom，可导致推进）/ 提高所在地点淹没等级 / 每位调查员各自选择 1 伤或 1 恐。",
}
