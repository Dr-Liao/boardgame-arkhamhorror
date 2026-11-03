// 07178 渔船（剧情支援）· 魔鬼礁石
//
// 印刷（中文）：
//   载具。
//   你在本载具时，将你的地点视为如同未淹没。
//   [action]：将渔船移动到一个连接的[[海洋]]地点。
//
// 引擎读点：
//   · 载具实例由本章 middle-setup.js 注册（capacity=调查员人数、running:true、
//     driverRequired:false、protectsFromFlood:true），本条目不再注册第二份。
//   · 「视为未淹没」的唯一读点是 flood.js#effectiveFloodLevel 里的
//     vehicle.protectsFromFlood；该标志来自上面的注册参数，不是条目字段。
//   · 移动行动：kind 'action' + actionKind 'activate'（普通行动，会引发借机攻击）。
//     因为剧情资产实例的 location 不随 vehicles.move 同步（引擎残余，见 primitive-requests
//     p7-a1-07178-vehicle-location-sync），这里用 range:'anywhere' 绕过
//     entityAbilityInRange 的位置门，criteria 直接读
//     state.scenarioFlags.mechanics.vehicles 判断「行动者是该载具乘客且载具在运行中」
//     （与 07150/07151 读 mechanics.flood 同口径）。
//   · 目标：target.kind 'location' + target.range 'anywhere'（targets.js 支持的唯一
//     anywhere 目标），query 收窄为「渔船当前所在地点的连接地点且带 [[海洋]] 特性」。
//   · 移动走 api.vehicles.move：vehicles.moveVehicle 会把所有乘客一起移动到目的地，
//     并逐个走权威位移入口。
//
// 一卡一文件：本卡行为只在这里维护；不要写回 encounter-abilities.js。

export default {
  code: '07178', scope: 'storyAsset', implemented: true,
  abilities: [{
    kind: 'action', actionKind: 'activate', range: 'anywhere',
    label: '将渔船移动到一个连接的海洋地点',
    criteria: ({ state, inv, source }) => {
      const vehicle = state.scenarioFlags?.mechanics?.vehicles?.[source.id]
      return Boolean(vehicle?.running) && (vehicle.passengers || []).includes(inv.seat)
    },
    target: {
      kind: 'location', range: 'anywhere',
      query: ({ state, source, entity }) => {
        const vehicle = state.scenarioFlags?.mechanics?.vehicles?.[source.id]
        if (!vehicle) return false
        const here = state.locations.find(location => location.id === vehicle.location)
        return Boolean(here?.connections?.includes(entity.id))
          && (entity.traits || []).includes('Ocean')
      },
    },
    resolve: ({ source, target, api }) => {
      if (!target) return
      api.vehicles.move(source.id, target.id)
    },
  }],
}
