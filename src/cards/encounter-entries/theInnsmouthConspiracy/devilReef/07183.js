// 07183 追猎的深潜者 · 恶魔礁
//
// 印刷（中文）：
//   猎手。
//   追猎的深潜者与你交战时，你不能进入载具或获得资源。
//   强制 - 追猎的深潜者与你交战后：如果你不在载具上，失去2资源。如果你在载具上，离开你的载具。
//
// 引擎读点：
//   · 「与你交战时你不能进入载具或获得资源」= `enemyRule.engagedRestrictions: ['enterVehicle', 'gainResources']`：
//     读点是 enemy-entry.js 的 enemyEngagedRestricts，接到 vehicles.js 的 vehicleAccessError（只禁进入、
//     不禁离开）与 resource-bank.js 的 gainResource（获得资源的唯一入口）。
//   · 交战后的强制：不在载具上 → `api.loseResources`；在载具上 → `vehicles.leave(..., { forced: true })`
//     （强制离开绕过「本轮已进出」的校验，与既有的被迫离开同一口径）。

export default {
  code: '07183', scope: 'enemy', implemented: true,
  enemyRule: { engagedRestrictions: ['enterVehicle', 'gainResources'] },
  abilities: [{
    kind: 'forced', trigger: 'enemyEngaged',
    label: '交战后：不在载具上则失去 2 资源；在载具上则离开载具',
    criteria: ({ state, inv, source, context }) => source.id === context.enemy?.id
      && inv && !inv.defeated && !inv.resigned,
    resolve: ({ inv, source, api }) => {
      const vehicles = api.mechanics.vehicles
      const vehicleId = vehicles.of(inv.seat)
      if (vehicleId) {
        vehicles.leave(inv.seat, vehicleId, { forced: true })
        return
      }
      api.loseResources(inv.seat, 2)
    },
  }],
}
