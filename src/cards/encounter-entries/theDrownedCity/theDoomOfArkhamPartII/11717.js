// 11717 伊克雷希特之眼 · 诡计
// 归属：关卡专属 · theDrownedCity/theDoomOfArkhamPartII（P7 终章下篇）。

// 险境。显现 - 意志(X) 检定；失败受到 1 点直接恐惧并随机弃 1 张手牌。
// 读点：单卡 encounterResolve → api.resolveScenarioEvent；behavior.events 结算（检定难度 = 克苏鲁狂怒值，
//       flags.test 由 behavior.runRageTest 读取）。
export default {
  code: '11717',
  scope: 'treachery',
  implemented: true,
  flags: { test: { skill: 'willpower', difficulty: 'rage' } },
  encounterResolve(state, inv, card, api) {
    return api.resolveScenarioEvent('doomOfArkhamPartTwoEyesOfYchlecht', { seat: inv.seat }) === true
  },
  note: 'approximation：恶心可塑性的三选一由 behavior.grossPlasticity 处理；其余按卡面结算。',
}
