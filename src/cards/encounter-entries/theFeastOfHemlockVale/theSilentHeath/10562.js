// 10562 保卫虫巢 · 诡计（寂静荒野，×2）
// 归属：关卡专用 · theFeastOfHemlockVale/theSilentHeath（P7 寂静荒野）。
// 卡面：Revelation - 检定[智识](2)。场上每有一个[[巢穴]]地点，此次检定的难度提高 1 点。
//       如果你检定失败，在最近的[[昆虫]]敌人上放置 1 个毁灭标记。（如果你不能这么做，改为受到 2 点恐惧。）
// 读点：encounterResolve 经 api.resolveScenarioEvent 交给 behavior.events.silentHeathDefendTheNest
//       → behavior.defendTheNest（读 flags.test 的 difficulty/difficultyPerLair；毁灭走
//       api.placeDoomOnCard，因此会触发议程的 doomPlaced 强制）。
export default {
  code: '10562',
  scope: 'treachery',
  implemented: true,
  flags: { test: { skill: 'intellect', difficulty: 2, difficultyPerLair: 1 } },
  encounterResolve(state, inv, card, api) {
    return api.resolveScenarioEvent('silentHeathDefendTheNest', { seat: inv.seat }) === true
  },
  note: '「最近的[[昆虫]]敌人」按同地点 → 连接地点 → 其余的顺序排序（与《消失的姐妹》同一口径）。',
}
