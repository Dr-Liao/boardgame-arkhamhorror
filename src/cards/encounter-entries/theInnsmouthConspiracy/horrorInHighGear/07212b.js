// 07212b 艾莲娜·哈珀的车（熄火面）· 高度惊魂
//
// 印刷（中文）：
//   载具。本载具上仅限2位调查员。
//   本载具已停止。
//   [action]如果你是本载具的司机：你启动了车子。将本载具翻面。
//
// 引擎读点：
//   · 熄火面**没有**「不能进入或离开」的条款，因此本条目不声明 `assetRule.vehicleAccessLocked`：
//     翻面后 vehicleAccessError 读的是当前面的条目，锁定自动消失。
//   · 「如果你是本载具的司机」= `_shared.js#vehicleDriverOf`。
//   · 启动 = `_shared.js#flipVehicleFace(state, api, id, '07212a', true)`（换回运行面并把
//     mechanicState 里的 running 同步为 true）。

import { flipVehicleFace, vehicleDriverOf } from '../../_shared.js'

export default {
  code: '07212b', scope: 'storyAsset', implemented: true,
  abilities: [{
    kind: 'action', actionKind: 'activate',
    label: '司机：启动车子（翻到运行面）',
    criteria: ({ state, inv, source }) => vehicleDriverOf(state, source?.id) === inv.seat,
    resolve: ({ state, source, api }) => {
      flipVehicleFace(state, api, source.id, '07212a', true)
      api.info?.(`🚗 ${source.name || '载具'}发动了。`)
    },
  }],
}
