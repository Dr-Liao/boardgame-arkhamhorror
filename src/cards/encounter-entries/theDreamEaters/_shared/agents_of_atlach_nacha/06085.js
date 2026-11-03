// 06085 蛛后的意志（Will of the Spider-Mother，诡计，2 张）
// 归属：战役共用 · theDreamEaters/_shared。遭遇组：agents_of_atlach_nacha（PONR / WOC）。
// 卡面：Revelation - 检定[willpower](3)。如果你所在地点有[[蜘蛛]]敌人，你不能投入卡牌到本次
//       技能检定。如果你检定失败，你不能攻击也不能调查，直到本轮结束。
// 实现：检定发起时若同地点有蜘蛛敌人，以 blockCommitSeats 禁止本人投入；
//   失败限制由 TDE 共享层读取 scenarioFlags.failRestricts。
export default {
  code: '06085',
  scope: 'treachery',
  implemented: true,
  flags: {
    test: { skill: 'willpower', difficulty: 3 },
    failRestricts: { until: 'endOfRound', cannot: ['fight', 'investigate'] },
  },
  encounterResolve(state, inv, card, api) {
    const spiderHere = (state.enemies || []).some(enemy => enemy.location === inv.location
      && (enemy.traits || []).some(trait => String(trait).toLowerCase() === 'spider'))
    api.test?.(inv.seat, 'willpower', 3, result => {
      if (result.success) return
      const current = api.scenarioFlag?.('failRestricts') || {}
      api.setScenarioFlag?.('failRestricts', {
        ...current,
        [inv.seat]: { round: state.round, until: 'endOfRound', cannot: ['fight', 'investigate'] },
      })
      api.info?.(`🕸️ 「蛛后的意志」：${inv.name} 本轮不能攻击也不能调查。`)
    }, spiderHere ? { blockCommitSeats: [inv.seat] } : {})
    return false
  },
}
