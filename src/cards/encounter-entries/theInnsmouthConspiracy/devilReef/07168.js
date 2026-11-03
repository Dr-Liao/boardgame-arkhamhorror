// 07168 急涡水域（Churning Waters）· 地点 · 魔鬼礁石 第四章
//
// 印刷（中文）：
//   [action] 如果你在渔船上：撤退。渔船上的每位调查员撤退。将渔船从游戏中移除。
//   每位撤退的调查员将其每个紫色、黑色或白色钥匙放在当前场景上。
//   其他每位调查员被抛下，自力更生。
//
// 引擎读点：
//   · 地点 action 描述子 → parleyMovesFor → doEntityAbility（actionKind:'resign' 按撤退结算、
//     不引发借机攻击）；地点实体默认「此处」范围（实体在 07168 才可执行）。
//   · 渔船 = 剧情资产 07178 的实例；载具登记由 middle-setup.js 完成，
//     读 state.scenarioFlags.mechanics.vehicles（与 07178/07150 同口径）。
//   · 钥匙：ctx.api.keys.transfer（abilityApi 把 keys 挂顶层）把紫/黑/白钥匙移到 act:<当前幕实例 id>。
//   · 移除渔船：api.mechanics.vehicles.remove（取消载具登记）+ api.removeStoryAsset（剧情资产实例，
//     P7 新原语）；顺序先移钥匙、再移除渔船、最后 resignMany（末位撤退触发的 ScenarioEnded 在
//     所有可见状态变更之后抛出）。
//   · resignMany：P7 新原语，逐个 doResign 并把「全员撤退」的 ScenarioEnded 收集到最后抛出，
//     保证「每位乘客撤退」不会因为第一位就中断循环。

import { keysAt } from '../../_shared.js'

const RESIGN_KEYS = ['purple', 'black', 'white']

function vehicleOfSeat(state, seat) {
  const vehicles = state.scenarioFlags?.mechanics?.vehicles || {}
  return Object.entries(vehicles).find(([, vehicle]) => (vehicle.passengers || []).includes(seat)) || null
}

export default {
  code: '07168', scope: 'location', implemented: true,
  abilities: [{
    kind: 'action', actionKind: 'resign',
    label: '撤退：渔船上的每位调查员撤退，渔船移出游戏，紫/黑/白钥匙放到当前场景',
    criteria: ({ state, inv }) => Boolean(vehicleOfSeat(state, inv.seat)),
    resolve: ({ state, inv, api }) => {
      const found = vehicleOfSeat(state, inv.seat)
      if (!found) return
      const [vesselId, vehicle] = found
      const act = state.acts?.[state.actIndex]
      const passengers = [...(vehicle.passengers || [])]
      for (const seat of passengers) {
        const held = keysAt(state, `investigator:${seat}`)
        for (const color of RESIGN_KEYS) {
          if (!act || !held.includes(color)) continue
          api.keys.transfer(color, `investigator:${seat}`, `act:${act.id}`, { reveal: true })
        }
      }
      api.vehicles.remove(vesselId)
      api.scenario.removeStoryAsset(vesselId)
      api.info?.('⛵ 渔船上的调查员撤向安全处；渔船被移出游戏，其他调查员被抛下、自力更生。')
      api.scenario.resignMany(passengers)
    },
  }],
}
