// 07188 拖入水底 · 恶魔礁
//
// 印刷（中文）：
//   显现 - 将拖入水底放置入场，放到你的威胁区域。如果你在载具上，离开该载具。
//   你不能进入载具。
//   [action]：检定[combat](3)或[agility](3)。如果你检定成功，弃掉拖入水底。
//
// 引擎读点：
//   · 进入威胁区 = `api.threat(seat, code)` + `treacheryRule.threatArea`。
//   · 「在载具上则离开」= `vehicles.of(seat)` + `leave(seat, id, { forced: true })`（被迫离开）。
//   · 「你不能进入载具」= `treacheryRule.forbidsVehicles`：读点在 vehicles.js 的 vehicleAccessError
//     （只禁进入，不禁离开），与 07183 的敌方限制共用同一处判定。
//   · 弃牌 = `api.removeThreat`（威胁区卡的唯一弃置写入口）。

export default {
  code: '07188', scope: 'treachery', implemented: true,
  treacheryRule: { threatArea: true, forbidsVehicles: true },
  abilities: [{
    kind: 'action', actionKind: 'activate',
    label: '检定战斗(3)或敏捷(3)：成功后弃掉拖入水底',
    resolve: ({ inv, source, api }) => {
      const skill = api.choice({
        kind: 'skill', source: '07188', seat: inv.seat,
        prompt: '拖入水底：选择本次检定的技能。',
        options: [{ id: 'combat', label: '检定战斗(3)' }, { id: 'agility', label: '检定敏捷(3)' }],
      })
      api.test(inv.seat, skill === 'agility' ? 'agility' : 'combat', 3, {
        source: { type: 'scenario', action: 'activate', code: '07188', name: inv.name, ability: true },
        resolve: result => {
          if (!result.success) return
          api.removeThreat(source)
          api.info?.(`🌊 ${inv.name} 挣脱了「拖入水底」。`)
        },
      })
    },
  }],
  encounterResolve(state, inv, card, api) {
    api.threat(inv.seat, '07188')
    const vehicles = api.mechanics.vehicles
    const vehicleId = vehicles.of(inv.seat)
    if (vehicleId) vehicles.leave(inv.seat, vehicleId, { forced: true })
    api.info?.(`🌊 「拖入水底」缠住了 ${inv.name}：本轮不能进入载具。`)
    return true
  },
}
