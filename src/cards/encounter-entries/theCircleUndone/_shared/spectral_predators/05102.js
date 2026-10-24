// 05102 黑暗中的低语
// 归属：战役共用 · theCircleUndone；遭遇组：spectral_predators
// 卡面：显现 - 将黑暗中的低语放置入场，放在密谋牌库旁边。
//   每个地点获得：「闹鬼 - 受到 1 点恐惧。」
// 卡面：强制 - 在一轮结束时：弃掉黑暗中的低语。
//
// 放置在 scenarioZones.agendaAside（纯 JSON）；授予能力用 api.grantHaunted（每个地点）。
// 轮末弃掉与撤销授予由 encounter-rules.js 的 roundEnded 通用分支按 treacheryRule 数据执行
//（aside 条目上的 hauntGrantId 记录要清理的授予 id）。

export default {
  code: '05102',
  scope: 'treachery',
  implemented: true,
  treacheryRule: { discardAtRoundEnd: true },
  encounterResolve(state, inv, card, api) {
    const zones = (state.scenarioZones ||= {})
    const aside = (zones.agendaAside ||= [])
    const entry = { id: `05102:${state.round}:${aside.length}`, code: '05102' }
    const grantId = `05102:haunt:${entry.id}`
    entry.hauntGrantId = grantId
    aside.push(entry)
    api.grantHaunted?.({
      locationId: 'all',
      ability: { id: grantId, text: '闹鬼 - 受到 1 点恐惧。', effect: [{ kind: 'horror', amount: 1 }] },
    })
    api.info?.('「黑暗中的低语」被放到密谋牌库旁边：每个地点获得闹鬼能力（受到 1 点恐惧）。')
    return true // 放置入场，不进弃牌堆
  },
}
