// 05104 被困的灵魂
// 归属：战役共用 · theCircleUndone；遭遇组：trapped_spirits
// 卡面：显现 - 检定[agility](3)。你检定失败且每低于难度 1 点，受到 1 点伤害。
// 卡面：如果你所在地点闹鬼，一位调查员如要在本次技能检定投入 1 张或多张卡牌，
//   作为额外费用，该调查员必须结算你所在地点的每个闹鬼能力。
//
// 第二段是「投入卡牌的额外费用」：引擎在投入循环前调用 behavior.beforeCommitCard
//（src/engine/tests.js 的 tests.js:227-229；本轮新增 commit-extra-cost-hook）。
// 本条目在自身检定期间把「闹鬼地点的额外费用」写进 state.hauntedCommitCost（纯 JSON，
// 检定结束即清除）；共享 encounter-rules.js 的 beforeCommitCard 负责对首次投入的 owner
// 调用 api.haunted 结算该地点每个闹鬼能力（每名调查员每次检定只一次）。

function hauntedAbilitiesAt(state, inv, api) {
  if (!inv?.location) return []
  if (typeof api?.hauntedAt === 'function') return api.hauntedAt(inv.location) || []
  const location = (state.locations || []).find(entry => entry.id === inv.location)
  return location?.haunted || (state.scenario?.locations?.[inv.location]?.haunted) || []
}

export default {
  code: '05104',
  scope: 'treachery',
  implemented: true,
  encounterResolve(state, inv, card, api) {
    let failedBy = 0
    // 闹鬼地点的额外费用只在「本次技能检定」期间有效：结算入口写入，finally 清除。
    if (hauntedAbilitiesAt(state, inv, api).length) {
      api.setHauntedCommitCost(inv.location)
    }
    try {
      api.test(inv.seat, 'agility', 3, result => {
        if (result.success) return
        failedBy = Math.max(0, (result.difficulty ?? 3) - (result.value ?? 0))
      })
      if (failedBy > 0) {
        api.info?.(`被困的灵魂：检定失败 ${failedBy} 点，受到 ${failedBy} 点伤害。`)
        api.damage(inv.seat, failedBy)
      }
    } finally {
      api.clearHauntedCommitCost()
    }
    return false // 进遭遇弃牌堆
  },
}
