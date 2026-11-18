// 10586 重属自然（Reclaimed by Nature）· 诡计（印刷 3 张，遭遇牌库）
// 归属：关卡专用 · theFeastOfHemlockVale/theLostSister（P7 消失的姐妹）。
// 卡面：(白日) 显现 - 检定[combat](3)。失败：受到 2 点伤害，或选择最近的敌人，该敌人攻击你。
//       (黑夜) 显现 - 检定[willpower](3)。失败：受到 2 点恐惧，或你所在地点和每个连接地点的
//       每个敌人治愈 1 点伤害。
//
// 一张卡一个文件：显现检定与失败二选一由 encounterResolve 交给章节 behavior.events
// （昼夜口径走 behavior.isDarkLocation：本关「黑暗地点的卡用(黑夜)效果」）。
export default {
  code: '10586',
  scope: 'treachery',
  implemented: true,
  flags: {
    timeBasedRevelation: {
      day: { skill: 'combat', difficulty: 3 },
      night: { skill: 'willpower', difficulty: 3 },
    },
    failChoice: {
      day: [{ damage: 2 }, { nearestEnemyAttacks: true }],
      night: [{ horror: 2 }, { healEnemiesHereAndConnected: 1 }],
    },
  },
  encounterResolve(state, inv, card, api) {
    const dusk = typeof api?.isDarkLocationHere === 'function'
      ? api.isDarkLocationHere(inv)
      : false
    return api.resolveScenarioEvent('lostSisterReclaimedByNature', { seat: inv.seat, night: dusk }) === true
  },
  note: '近似：昼夜按「调查员所在地点是否黑暗」判定（本关规则），不是战役时间标记；events 读点在 behavior。',
}
