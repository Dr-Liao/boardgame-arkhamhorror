// 07208c 急转弯 · 高度惊魂（地点，道路1）
//
// 印刷（中文）：
//   道路1。
//   强制 - 在有载具离开本地点时：该载具上每有一位调查员，该地点的调查员必须共同花费2个线索。
//          每有一个线索不能花费，该载具上的一位调查员受到2点伤害。(每个载具每场游戏仅限一次。)
//
// 引擎读点：
//   · `locationRule.vehicleLeft`：载具移动**前**由 `vehicles.moveVehicle` 回调分发
//     （road-hazards.js#dispatchVehicleEvent），事件带 { vehicleId, seats, origin, destination }。
//   · 共用前半句（乘客快照 → 每场一次记账 → 共同支付线索并取差额）在
//     `_shared.js#roadHazardCharge`；每场一次的记账原语是 `api.roadHazardOnce`。
//   · 差额的后果才是这张卡自己的：每差 1 个线索，载具上一位调查员（领队选）受 2 点伤害。

import { roadHazardCharge, roadHazardSufferer } from '../../_shared.js'

export default {
  code: '07208c', scope: 'location', implemented: true,
  locationRule: {
    vehicleLeft(state, location, event, api) {
      const charge = roadHazardCharge(state, location, event, api, 2)
      if (!charge?.shortfall) return false
      for (let i = 0; i < charge.shortfall; i++) {
        const seat = roadHazardSufferer(state, api, charge.aboard, '急转弯：选择一位乘客承受 2 点伤害')
        api.damage(seat, 2)
      }
      return true
    },
  },
}
