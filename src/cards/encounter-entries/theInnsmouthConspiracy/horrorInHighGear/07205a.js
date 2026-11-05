// 07205a 崖边道路 · 高度惊魂（地点，道路1）
//
// 印刷（中文）：
//   道路1。
//   强制 - 在有载具离开本地点时：该载具上每有一位调查员，该地点的调查员必须共同花费2个线索。
//          如果其不能，该载具的司机检定[willpower](X)或[agility](X)，其中X为其不能花费的线索数量。
//          如果司机检定失败，将该载具从游戏中移除，上面的每位调查员受到10点伤害。
//          (每个载具每场游戏仅限一次。)
//
// 引擎读点：
//   · `locationRule.vehicleLeft`：载具移动**前**由 `vehicles.moveVehicle` 回调分发
//     （road-hazards.js#dispatchVehicleEvent），事件带 { vehicleId, seats, origin, destination }。
//   · 共用前半句（乘客快照 → 每场一次记账 → 共同支付线索并取差额）在
//     `_shared.js#roadHazardCharge`；每场一次的记账原语是 `api.roadHazardOnce`。
//   · 差额的后果才是这张卡自己的：司机检定，难度 = 不能花费的线索数量 X。
//     司机取载具登记里的 `driver`（`enterVehicle` 记的第一位进入者），登记缺席或已不在
//     乘客名单里时回落到乘客快照的第一位；意志/敏捷由司机自己用 `api.choice` 选。
//   · 检定失败 = `api.removeVehicleFromGame`（移出游戏并注销载具登记）+ 每位乘客 10 点伤害。
//     乘客快照必须在注销登记**之前**取，否则载具记录已被删除。

import { roadHazardCharge } from '../../_shared.js'

export default {
  code: '07205a', scope: 'location', implemented: true,
  locationRule: {
    vehicleLeft(state, location, event, api) {
      const charge = roadHazardCharge(state, location, event, api, 2)
      if (!charge?.shortfall) return false
      // 司机：载具登记里的 driver；为 null 或已不在乘客名单时取乘客快照的第一位。
      const vehicle = api.mechanics.vehicles.record(event.vehicleId)
      const driver = vehicle?.passengers?.includes(vehicle?.driver) ? vehicle.driver : charge.aboard[0]
      if (driver == null) return false
      // 意志/敏捷二选一由司机本人决定（卡面「检定[意志](X)或[敏捷](X)」）。
      const skill = api.choice({ kind: 'skill', source: '07205a', seat: driver,
        prompt: '崖边道路：选择本次检定的技能。',
        options: [{ id: 'willpower', label: `检定意志(${charge.shortfall})` }, { id: 'agility', label: `检定敏捷(${charge.shortfall})` }] })
      const chosen = skill === 'agility' ? 'agility' : 'willpower'
      api.test(driver, chosen, charge.shortfall, result => {
        if (result.success) return
        // 先取乘客快照再注销登记：removeVehicleFromGame 会删掉载具记录。
        const seats = api.mechanics.vehicles.passengers(event.vehicleId)
        api.removeVehicleFromGame(event.vehicleId)
        api.info?.(`🚗 崖边道路：${state.investigators[driver]?.name ?? '司机'} 没能稳住载具，载具翻下悬崖！`)
        for (const seat of seats) api.damage(seat, 10)
      }, 0, { code: '07205a', name: location.name, ability: true })
      return true
    },
  },
}
