// 07168 急涡水域 · 恶魔礁（地点）
//
// 印刷（中文）：
//   [action]如果你在渔船上：撤退。渔船上的每位调查员撤退。将渔船从游戏中移除。
//          每位撤退的调查员将其每个紫色、黑色或白色钥匙放在当前场景上。
//          其他每位调查员被抛下，自力更生。
//
// 引擎读点：
//   · 「你在渔船上」= `vehicleAssetOf(state, seat)?.code === '07178'`（_shared.js 的共享读法：
//     vehicleOf 找乘客所在载具 → 取它的物理卡，不直接读 mechanicState）。
//   · 船上的人 = `vehiclePassengers(state, id)` 的快照；「每位撤退」逐个 `api.resign(seat)`
//     （撤退的后果——退场、钥匙与线索清理、allResigned 结算——全部沿用既有入口）。
//   · 钥匙「放在当前场景上」= `keys.transfer(color, investigator:<seat>, 'reference')`，
//     只搬印刷点名的紫/黑/白三色；先搬钥匙再撤退，避免撤退清理先把钥匙带走。
//   · 「将渔船从游戏中移除」= `api.scenario.removeStoryAsset(id)`（只离场、不进弃牌堆，
//     并触发 storyAssetLeftPlay 的离场清理）+ `vehicles.remove(id)` 注销载具。
//   · 「其他每位调查员被抛下」没有额外机械动作：不在船上的调查员不撤退，照常继续游戏。

import { vehicleAssetOf, vehiclePassengers } from '../../_shared.js'

const FISHING_VESSEL = '07178'
const RESIGN_KEY_COLORS = ['purple', 'black', 'white']

export default {
  code: '07168', scope: 'location', implemented: true,
  abilities: [{
    kind: 'action', actionKind: 'resign', cost: { action: 1 },
    label: '如果你在渔船上：全体撤退、移除渔船、紫/黑/白钥匙放到当前场景',
    criteria: ({ state, inv }) => vehicleAssetOf(state, inv.seat)?.code === FISHING_VESSEL,
    resolve: ({ state, inv, api }) => {
      const vessel = vehicleAssetOf(state, inv.seat)
      if (!vessel) return
      const seats = vehiclePassengers(state, vessel.id)
      for (const seat of seats) {
        const fellow = state.investigators[seat]
        if (!fellow || fellow.defeated || fellow.resigned) continue
        for (const color of RESIGN_KEY_COLORS) {
          api.mechanics.keys.transfer(color, `investigator:${seat}`, 'reference')
        }
        api.resign(seat)
        api.info?.(`🏳️ ${fellow.name} 乘着渔船撤退，把${vessel.name || '渔船'}留在了急涡水域。`)
      }
      api.scenario.removeStoryAsset(vessel.id)
      api.mechanics.vehicles.remove(vessel.id)
    },
  }],
}
