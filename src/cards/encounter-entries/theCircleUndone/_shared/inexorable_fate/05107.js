// 05107 恐怖夜色
// 归属：战役共用 · theCircleUndone；遭遇组：inexorable_fate
// 卡面：显现 - 检定[willpower](4)。如果你失败，将恐怖夜色放置入场，放在密谋牌库旁。
//   如果你检定失败且低于难度至少 3 点，恐怖夜色获得涌动。
//   如果密谋牌库旁有 3 张恐怖夜色，将其全部弃掉，每位调查员受到 3 点恐惧。
//
// 「放在密谋牌库旁边」与 05089 共用 state.scenarioZones.agendaAside（纯 JSON）。

export default {
  code: '05107',
  scope: 'treachery',
  implemented: true,
  encounterResolve(state, inv, card, api) {
    let failedBy = 0
    api.test(inv.seat, 'willpower', 4, result => {
      if (result.success) return
      failedBy = Math.max(0, (result.difficulty ?? 4) - (result.value ?? 0))
    })
    if (failedBy <= 0) return false // 成功：正常进遭遇弃牌堆
    const zones = (state.scenarioZones ||= {})
    const aside = (zones.agendaAside ||= [])
    const existing = aside.filter(entry => entry.code === '05107')
    // 先结算涌动（失败 ≥3 点）；牌库旁已有 2 张时第 3 张触发全体恐惧。
    if (failedBy >= 3) {
      api.info?.('恐怖夜色：检定失败不少于 3 点，获得涌动。')
      api.drawEncounter?.(inv.seat)
    }
    if (existing.length >= 2) {
      zones.agendaAside = aside.filter(entry => entry.code !== '05107')
      state.encounterDiscard.push('05107', '05107', '05107')
      api.info?.('密谋牌库旁集齐 3 张「恐怖夜色」：全部弃掉，每位调查员受到 3 点恐惧。')
      for (const target of state.investigators || []) {
        if (target.defeated) continue
        api.horror(target.seat, 3)
      }
      return false
    }
    aside.push({ id: `05107:${state.round}:${aside.length}`, code: '05107' })
    api.info?.('「恐怖夜色」被放到密谋牌库旁边。')
    return true // 已放置入场（牌库旁），不进弃牌堆
  },
}
