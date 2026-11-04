// 载具状态的**只读**入口（叶子模块）。
//
// 为什么要单独一个文件：卡条目经由 `encounter-entries/_shared.js` 读「我在哪辆载具上」时，
// 不能 import `vehicles.js`——它为了校验与敌人限制会拉进 `ability.js`，而 `ability.js` 又
// 转进 `deck/availability.js`，形成 ESM 循环（表现为 `Cannot access 'strictAcceptedCodes'
// before initialization`）。这里只依赖 mechanic-state.js，读写分离：
//   · 读（本文件）：vehicleOf / vehiclePassengers / vehicleRecord
//   · 写（vehicles.js）：register / enter / leave / move / remove，内部复用本文件的读。
import { mechanicState } from './mechanic-state.js'

// 调查员当前乘坐的载具 id（不在载具上返回 null）。
export function vehicleOf(state, seat) {
  return Object.entries(mechanicState(state)?.vehicles || {}).find(([, vehicle]) => vehicle.passengers.includes(seat))?.[0] || null
}

// 载具上的乘客座位号快照（遍历时不会被改动影响）。
export function vehiclePassengers(state, id) {
  return [...(mechanicState(state)?.vehicles?.[id]?.passengers || [])]
}

// 载具的运行期记录（只读视图；没有该载具时返回 null）。
export function vehicleRecord(state, id) {
  const vehicle = mechanicState(state)?.vehicles?.[id]
  return vehicle ? { ...vehicle, passengers: [...vehicle.passengers] } : null
}

// 载具的**物理卡**实例（剧情支援或受控支援）：卡面条件（「本载具正在运行」这类
// 按当前面判定的规则）要读它当前的面，而不是 mechanicState 里的登记。
export function vehicleCard(state, id) {
  if (!id) return null
  const carriers = [...(state.storyAssets || []), ...(state.investigators || []).flatMap(inv => inv.assets || [])]
  return carriers.find(asset => asset?.id === id) || null
}
