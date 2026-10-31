// 06085 蛛后的意志（Will of the Spider-Mother，诡计，2 张）
// 归属：战役共用 · theDreamEaters/_shared。遭遇组：agents_of_atlach_nacha（PONR / WOC）。
// 卡面：Revelation - 检定[willpower](3)。如果你所在地点有[[蜘蛛]]敌人，你不能投入卡牌到本次
//       技能检定。如果你检定失败，你不能攻击也不能调查，直到本轮结束。
// 实现：检定 + 失败限制的「不能攻击/调查」需要 canFightEnemy / investigationError 分派
//   （TDE 共享层未内置；章节各自转发太分散）→ 写成 flags + 协调请求。
export default {
  code: '06085',
  scope: 'treachery',
  implemented: true,
  simplified: true,
  note: '「所在地点有[[蜘蛛]]敌人时不能投入卡牌」需要检定期间的 commit 闸门（共享 canCommitCard 只读威胁区 flags）；失败限制已通过 scenarioFlags.failRestricts 接线（共享 canFightEnemy/investigationError 读点）。',
  flags: {
    test: { skill: 'willpower', difficulty: 3 },
    failRestricts: { until: 'endOfRound', cannot: ['fight', 'investigate'] },
  },
  encounterResolve(state, inv, card, api) {
    api.test?.(inv.seat, 'willpower', 3, result => {
      if (result.success) return
      const current = api.scenarioFlag?.('failRestricts') || {}
      api.setScenarioFlag?.('failRestricts', {
        ...current,
        [inv.seat]: { round: state.round, until: 'endOfRound', cannot: ['fight', 'investigate'] },
      })
      api.info?.(`🕸️ 「蛛后的意志」：${inv.name} 本轮不能攻击也不能调查。`)
    })
    return false
  },
}
