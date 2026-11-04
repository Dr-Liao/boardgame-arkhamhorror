// 07210 蜿蜒长路 · 高度惊魂（地点，道路1）
//
// 印刷（中文）：
//   道路1。
//   强制 - 有载具进入蜿蜒长路后：在当前密谋上放置1个毁灭标记(本效果可以导致当前密谋推进)。
//          该载具不能离开蜿蜒长路，直到下一轮结束。
//
// 与其它道路不同的两点：
//   · 触发是「进入」而不是「离开」→ 读点 `locationRule.vehicleEntered`
//     （vehicles.moveVehicle 成功移动后回调，road-hazards.js#dispatchVehicleEvent）；
//   · 没有「每个载具每场游戏仅限一次」的括号条款，也没有线索费用：每次有载具进来都放 1 点毁灭。
//   · 后半句「不能离开直到下一轮结束」用 `api.mechanics.vehicles.lockUntil(id, round)` 记账，
//     读点是 moveVehicle 的离开校验（`state.round <= lockedUntilRound` 时拒绝移动）。
//     「直到下一轮结束」= 本轮 + 下一轮，故锁定到 `state.round + 1`。

export default {
  code: '07210', scope: 'location', implemented: true,
  locationRule: {
    vehicleEntered(state, location, event, api) {
      api.addDoom(1)
      api.mechanics.vehicles.lockUntil(event.vehicleId, state.round + 1)
      api.info?.(`🚗 蜿蜒长路：载具驶入后道路开始崩塌，毁灭 +1，载具直到下一轮结束都无法离开。`)
      return true
    },
  },
}
