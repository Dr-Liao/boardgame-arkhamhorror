// 05106 雾中身形
// 归属：战役共用 · theCircleUndone；遭遇组：realm_of_death
// 卡面：涌动。（由 definition.js 从印刷文本解析）
// 卡面：显现 - 结算你所在地点的每个闹鬼能力。

export default {
  code: '05106',
  scope: 'treachery',
  implemented: true,
  encounterResolve(state, inv, card, api) {
    api.info?.('雾中身形：结算你所在地点的每个闹鬼能力。')
    api.haunted?.(inv.seat, { locationId: inv.location, kind: 'effect', source: '05106' })
    return false // 显露检定后进遭遇弃牌堆
  },
}
