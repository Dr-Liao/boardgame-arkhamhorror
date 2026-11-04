// 07209b 荒凉道路 · 高度惊魂（地点，道路1）
//
// 印刷（中文）：
//   道路1。
//   强制 - 有载具离开本地点时：该载具上每有一位调查员，该地点的调查员必须共同花费1个线索。
//          如果其不能，从遭遇牌库顶弃牌，直到弃掉一个[[载具]]敌人，将其生成在荒凉道路。
//          (每个载具每场游戏仅限一次。)
//
// 引擎读点：
//   · `locationRule.vehicleLeft`：载具移动成功后由 `vehicles.moveVehicle` 回调分发
//     （road-hazards.js#dispatchVehicleEvent），事件带 { vehicleId, seats, origin, destination }。
//   · 共用前半句（乘客快照 → 每场一次记账 → 共同支付线索并取差额）在
//     `_shared.js#roadHazardCharge`；每场一次的记账原语是 `api.roadHazardOnce`。
//   · 差额的后果才是这张卡自己的：付不齐（shortfall > 0）就从遭遇牌库顶逐张弃牌，直到弃掉一个
//     [[载具]] 敌人并让它在**本地点**生成。原语是 `api.discardEncounterUntilSpawn`
//     （scenario-runtime.js：读 `state.encounterDeck` 顶、`spawnEnemy` 入场）。

import { roadHazardCharge } from '../../_shared.js'

export default {
  code: '07209b', scope: 'location', implemented: true,
  locationRule: {
    vehicleLeft(state, location, event, api) {
      const charge = roadHazardCharge(state, location, event, api, 1)
      if (!charge?.shortfall) return false
      const spawned = api.discardEncounterUntilSpawn({ trait: 'Vehicle', location: location.id })
      if (spawned) api.info?.(`🚗 荒凉道路：失控的载具招来了「${api.cardName?.(spawned) || spawned}」。`)
      return true
    },
  },
}
