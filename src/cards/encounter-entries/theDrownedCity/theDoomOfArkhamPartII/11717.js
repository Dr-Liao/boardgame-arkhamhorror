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
  note: "显现：险境；检定[意志](X=狂怒值)；失败受到 1 点直接恐惧（api.scenario.directHorror）并随机弃 1 张手牌。",
}
