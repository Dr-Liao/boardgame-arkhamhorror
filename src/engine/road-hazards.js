// 道路危害：载具在[[道路]]地点之间进出时触发的强制能力（印斯茅斯「高度惊魂」一章）。
//
// 为什么需要这一层：十张道路地点（07204a–07210）印的是同一句模板——
//   「强制 - 在有载具离开本地点时：该载具上每有一位调查员，该地点的调查员必须共同花费 N 个线索…
//     （每个载具每场游戏仅限一次。）」
// 条目只声明 `locationRule.vehicleLeft` / `locationRule.vehicleEntered`，载具写入口负责分发，
// 频率记账由一个原语负责，卡牌不各自记账。
//
// 依赖方向：vehicles.js →（回调）→ 本模块 → ability.js（读条目）。本模块**不** import
// scenario-runtime.js，api 由调用方惰性提供，避免 ESM 循环。
import { registeredEntry } from './ability.js'
import { mechanicState } from './mechanic-state.js'

/**
 * 载具离开/进入地点时的分发入口。
 * event: { vehicleId, seats, origin, destination }
 * apiFactory: 惰性返回场景运行时 api（卡条目拿到的就是这个 api）。
 */
export function dispatchVehicleEvent(state, kind, event, apiFactory) {
  const locationId = kind === 'entered' ? event.destination : event.origin
  const location = (state.locations || []).find(item => item.id === locationId)
  if (!location) return false
  const rule = registeredEntry(location.originalCode || location.code)?.locationRule
  const handler = kind === 'entered' ? rule?.vehicleEntered : rule?.vehicleLeft
  if (typeof handler !== 'function') return false
  return handler(state, location, event, apiFactory()) === true
}

/**
 * 「每个载具每场游戏仅限一次」的统一记账（道路危害模板的括号条款）。
 * 返回 true 表示这一次**应该**结算（并已记账），false 表示这个载具在本地点已经触发过了。
 * 记账放在 mechanicState.roadHazards（纯 JSON：{ [locationId]: [vehicleId...] }）。
 */
export function roadHazardOnce(state, locationId, vehicleId) {
  if (!locationId || !vehicleId) return false
  const data = mechanicState(state, true)
  data.roadHazards ||= {}
  const seen = (data.roadHazards[locationId] ||= [])
  if (seen.includes(vehicleId)) return false
  seen.push(vehicleId)
  return true
}

// 只读查询：某个地点的某个载具是否已经触发过道路危害（投影/测试用）。
export function roadHazardSeen(state, locationId, vehicleId) {
  return Boolean(mechanicState(state)?.roadHazards?.[locationId]?.includes(vehicleId))
}
