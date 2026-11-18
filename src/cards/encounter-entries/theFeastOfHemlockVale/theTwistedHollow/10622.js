// 10622 暗影深深 · 诡计（牌库 2 张）（theFeastOfHemlockVale/theTwistedHollow）
// 卡面：显现 - 检定[willpower](3)。如果你所在地点有[[黑暗]]特性，本次检定难度 +2（=5）。
//     如果你失败，你必须选择一项：受到 2 点恐惧；或控制山谷提灯的调查员将其翻至[[熄灭]]面并放置在一个连接地点。

export default {
  code: '10622',
  scope: 'treachery',
  implemented: true,
  encounterResolve(state, inv, card, api) {
    return api.resolveScenarioEvent('theTwistedHollowTreachery', { seat: inv.seat, code: this.code }) === true
  },
  flags: {
    "deepShadows": true,
    "test": {
      "skill": "willpower",
      "difficulty": 3,
      "darkDifficulty": 5
    },
    "failChoice": [
      "take2Horror",
      "lanternUnlitToConnecting"
    ]
  },
  note: "近似：显现交给 behavior.resolveTreacheryEvent（encounterResolve → api.resolveScenarioEvent），二选一用 api.choose；困难面难度由黑暗特性判定。",
  abilities: [],
}
