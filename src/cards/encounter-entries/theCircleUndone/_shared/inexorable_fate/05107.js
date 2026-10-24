// 05107 恐怖夜色
// 归属：战役共用 · theCircleUndone；遭遇组：inexorable_fate
// 卡面：显现 - 检定[willpower](4)。如果你失败，将恐怖夜色放置入场，放在密谋牌库旁。
//   如果你检定失败且低于难度至少 3 点，恐怖夜色获得涌动。
//   如果密谋牌库旁有 3 张恐怖夜色，将其全部弃掉，每位调查员受到 3 点恐惧。
//
// 「放在密谋牌库旁边」与 05089 共用 state.scenarioZones.agendaAside（纯 JSON）。
// 第三张触发时：牌库旁的前 2 张 + 当前这张共 3 张一起弃掉。当前这张由引擎在 encounterResolve
// 返回 false 后丢进「本次抽牌的遭遇牌堆」弃牌堆；本条目只把牌库旁的 2 张推进同一个主弃牌堆
// （幽灵牌堆归属是已知近似，见 primitive-requests/fix-c7shared.json）。
// 涌动在结算末尾抽取（不再在放置/触发之前插入，避免新抽到的牌先于本卡结算）。

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
    let placed = true
    let surge = failedBy >= 3
    if (existing.length >= 2) {
      // 第三张：牌库旁 2 张 + 当前这张共 3 张全部弃掉；当前这张交给引擎弃置。
      zones.agendaAside = aside.filter(entry => entry.code !== '05107')
      state.encounterDiscard.push('05107', '05107')
      api.info?.('密谋牌库旁集齐 3 张「恐怖夜色」：全部弃掉，每位调查员受到 3 点恐惧。')
      for (const target of state.investigators || []) {
        if (target.defeated) continue
        api.horror(target.seat, 3)
      }
      placed = false
    } else {
      aside.push({ id: `05107:${state.round}:${aside.length}`, code: '05107' })
      api.info?.('「恐怖夜色」被放到密谋牌库旁边。')
    }
    if (surge) {
      api.info?.('恐怖夜色：检定失败不少于 3 点，获得涌动。')
      api.drawEncounter?.(inv.seat)
    }
    return placed // true = 已放置入场（牌库旁）；false = 本卡进遭遇弃牌堆（由引擎弃置）
  },
}
