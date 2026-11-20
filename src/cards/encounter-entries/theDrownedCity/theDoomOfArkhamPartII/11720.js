// 11720 阿卡姆遭袭 · 诡计
// 归属：关卡专属 · theDrownedCity/theDoomOfArkhamPartII（P7 终章下篇）。

// 显现 - 每位调查员意志(X) 检定；1 人以上失败则抽克苏鲁牌库顶 1 张。
// 读点：单卡 encounterResolve → api.resolveScenarioEvent；behavior.events 结算（检定难度 = 克苏鲁狂怒值，
//       flags.test 由 behavior.runRageTest 读取）。
export default {
  code: '11720',
  scope: 'treachery',
  implemented: true,
  flags: { test: { skill: 'willpower', difficulty: 'rage' } },
  encounterResolve(state, inv, card, api) {
    return api.resolveScenarioEvent('doomOfArkhamPartTwoArkhamUnderAssault', { seat: inv.seat }) === true
  },
  note: 'approximation：恶心可塑性的三选一由 behavior.grossPlasticity 处理；其余按卡面结算。',
}
