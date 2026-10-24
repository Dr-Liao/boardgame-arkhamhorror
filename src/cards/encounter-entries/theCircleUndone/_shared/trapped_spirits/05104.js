// 05104 被困的灵魂
// 归属：战役共用 · theCircleUndone；遭遇组：trapped_spirits
// 卡面：显现 - 检定[agility](3)。你检定失败且每低于难度 1 点，受到 1 点伤害。
// 卡面：如果你所在地点闹鬼，一位调查员如要在本次技能检定投入 1 张或多张卡牌，
//   作为额外费用，该调查员必须结算你所在地点的每个闹鬼能力。
//
// 显式简化：第二段是「投入卡牌时的额外费用」，引擎没有投入费用钩子
//（canCommitCard 只能整体禁止，无法挂「先结算闹鬼」的额外费用），因此只实现第一段。
// 已在 status.json 的 gaps 与本条目的 simplified/note 中记录。

export default {
  code: '05104',
  scope: 'treachery',
  implemented: true,
  simplified: true,
  note: '「投入 1+ 张牌时作为额外费用结算所在地点每个闹鬼能力」缺少引擎钩子（canCommitCard 只能禁止投入），只实现显现的伤害段。',
  encounterResolve(state, inv, card, api) {
    let failedBy = 0
    api.test(inv.seat, 'agility', 3, result => {
      if (result.success) return
      failedBy = Math.max(0, (result.difficulty ?? 3) - (result.value ?? 0))
    })
    if (failedBy > 0) {
      api.info?.(`被困的灵魂：检定失败 ${failedBy} 点，受到 ${failedBy} 点伤害。`)
      api.damage(inv.seat, failedBy)
    }
    return false // 进遭遇弃牌堆
  },
}
