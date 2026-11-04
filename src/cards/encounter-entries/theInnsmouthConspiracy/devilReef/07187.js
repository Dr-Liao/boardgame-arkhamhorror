// 07187 偷偷上船 · 恶魔礁
//
// 印刷（中文）：
//   显现 - 如果没有调查员在载具上，偷偷上船获得涌动。
//          否则，每位载具上的调查员必须受到1点伤害和1点恐惧，或离开该载具。
//          每位离开载具的调查员不能再进入该载具，直到本轮结束。
//
// 引擎读点：
//   · 「在载具上」= `api.vehicles.of(seat)`；离开 = `api.vehicles.leave(seat, id)`。
//   · 「离开后本轮不能再进入」不需要额外的单卡字段：`vehicles.leaveVehicle` 会把
//     `mechanicState.vehicleAccess[seat]` 记成当前轮，`vehicleAccessError` 因此在本轮内
//     拒绝再次进入（与「每位调查员每轮只能进出一次」共用同一份账）。
//   · 「获得涌动」= encounterResolve 返回 `{ gainSurge: true }`（encounter.js 的唯一读点）。

export default {
  code: '07187', scope: 'treachery', implemented: true,
  encounterResolve(state, inv, card, api) {
    // 显现结算拿到的是场景运行时 api：载具入口在 `api.mechanics.vehicles`。
    const vehicles = api.mechanics.vehicles
    const aboard = state.investigators.filter(each => !each.defeated && !each.resigned && vehicles.of(each.seat))
    if (!aboard.length) return { gainSurge: true }
    for (const each of aboard) {
      const vehicleId = vehicles.of(each.seat)
      if (!vehicleId) continue
      const answer = api.choice({
        kind: 'effect', source: '07187', seat: each.seat,
        prompt: '偷偷上船：受到 1 点伤害和 1 点恐惧，或离开载具？',
        options: [{ id: 'harm', label: '受到 1 点伤害和 1 点恐惧' }, { id: 'leave', label: '离开载具' }],
      })
      if (answer === 'leave' && vehicles.leave(each.seat, vehicleId)) continue
      api.damage(each.seat, 1)
      api.horror(each.seat, 1)
    }
    return false
  },
}
