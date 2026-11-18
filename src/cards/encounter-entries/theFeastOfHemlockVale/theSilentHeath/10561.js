// 10561 号令共振 · 诡计（寂静荒野，×2）
// 归属：关卡专用 · theFeastOfHemlockVale/theSilentHeath（P7 寂静荒野）。
// 卡面：Revelation - 检定[意志](3)。你检定失败且每低于难度 1 点，如可能，选择下列一个不同选项：
//       - 受到 1 点伤害。
//       - 随机弃掉你 1 张手牌。
//       - 最近的[[昆虫]]敌人重整、移动（每次一个地点）直到它抵达你的地点，与你交战，并立即攻击。
// 读点：encounterResolve 经 api.resolveScenarioEvent 交给 behavior.events.silentHeathCommandingResonance
//       → behavior.commandingResonance（读本条目 flags.test 的检定档案）。
export default {
  code: '10561',
  scope: 'treachery',
  implemented: true,
  flags: { test: { skill: 'willpower', difficulty: 3 } },
  encounterResolve(state, inv, card, api) {
    return api.resolveScenarioEvent('silentHeathCommandingResonance', { seat: inv.seat }) === true
  },
  note: 'approximation：「每次一个地点」的移动用 behavior.moveInsectToInvestigator 逐步移动'
    + '（最多 8 步），不经过引擎的敌人移动管线（没有猎人/巡逻关键字时等价）。',
}
