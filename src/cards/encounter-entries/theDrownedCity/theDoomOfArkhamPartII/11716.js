// 11716 夷为平地 · 诡计
// 归属：关卡专属 · theDrownedCity/theDoomOfArkhamPartII（P7 终章下篇）。

// 显现 - 敏捷(X) 检定，X 为克苏鲁的狂怒值；失败受到 2 点伤害。
// 读点：单卡 encounterResolve → api.resolveScenarioEvent；behavior.events 结算（检定难度 = 克苏鲁狂怒值，
//       flags.test 由 behavior.runRageTest 读取）。
export default {
  code: '11716',
  scope: 'treachery',
  implemented: true,
  flags: { test: { skill: 'agility', difficulty: 'rage' } },
  encounterResolve(state, inv, card, api) {
    return api.resolveScenarioEvent('doomOfArkhamPartTwoLayWaste', { seat: inv.seat }) === true
  },
  note: 'approximation：恶心可塑性的三选一由 behavior.grossPlasticity 处理；其余按卡面结算。',
}
