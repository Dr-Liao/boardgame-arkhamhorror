// 07211a 托马斯·道森的车（运行面）· 高度惊魂
//
// 印刷（中文）：
//   载具。本载具上仅限2位调查员。
//   本载具正在运行。调查员不能进入或离开本载具。
//   [action]如果你是本载具的司机：抽取遭遇牌库顶的卡牌。然后，将本载具移动到一个连接的[[道路]]地点。
//          (每轮最多一次。)
//   [action]如果你是本载具的司机：你把车停下。将本载具翻面。
//
// 引擎读点：
//   · 「调查员不能进入或离开本载具」= `assetRule.vehicleAccessLocked: true`，读点在
//     vehicles.js#vehicleAccessError（按**当前物理面**判定，翻到 07211b 的熄火面后自动失效）。
//   · 「如果你是本载具的司机」= `_shared.js#vehicleDriverOf(state, source.id)` 与 `inv.seat` 比较
//     （司机记在 mechanicState.vehicles[id].driver 上）。
//   · 行驶 = `api.drawEncounter(seat)` → `api.mechanics.vehicles.move(id, 道路地点)`；
//     每轮一次用描述子的 `limit: { scope: 'perRound', owner: 'instance' }`。
//   · 停车/启动 = `_shared.js#flipVehicleFace`（普通物理面入口换面 + 同步载具 running 状态）。

import { flipVehicleFace, hasTrait, vehicleDriverOf } from '../../_shared.js'

const STOPPED_FACE = '07211b'

export default {
  code: '07211a', scope: 'storyAsset', implemented: true,
  assetRule: { vehicleAccessLocked: true },
  abilities: [
    {
      kind: 'action', actionKind: 'activate',
      label: '司机：抽遭遇牌，然后把车开到一个连接的[[道路]]地点（每轮最多一次）',
      limit: { scope: 'perRound', owner: 'instance' },
      criteria: ({ state, inv, source }) => vehicleDriverOf(state, source?.id) === inv.seat,
      target: {
        kind: 'location',
        query: ({ entity, source }) => entity.id !== source?.location && hasTrait(entity, 'Road'),
      },
      resolve: ({ inv, source, target, api }) => {
        api.drawEncounter(inv.seat)
        api.mechanics.vehicles.move(source.id, target.entity.id)
      },
    },
    {
      kind: 'action', actionKind: 'activate',
      label: '司机：把车停下（翻到熄火面）',
      criteria: ({ state, inv, source }) => vehicleDriverOf(state, source?.id) === inv.seat,
      resolve: ({ state, source, api }) => {
        flipVehicleFace(state, api, source.id, STOPPED_FACE, false)
        api.info?.(`🚗 ${source.name || '载具'}停下了。`)
      },
    },
  ],
}
