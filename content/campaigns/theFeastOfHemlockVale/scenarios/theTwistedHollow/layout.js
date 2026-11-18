// 扭曲空洞 · 桌面坐标（动态网格）。
//
// 参考：Haskell#theTwistedHollow（setUsesGrid / placeCardInGrid / emptyPositionsInDirections）+
//       指南 specialRules「Location Adjacency in The Twisted Hollow」：地点按固定图案摆成网格，
//       树林牌库的新地点出现在已有地点的相邻格，**相邻地点互相连接**。
//
// 与 TSK 的静态 layout.js 的差异：本章没有「每个地点一个固定坐标」——坐标在布置时由
// 起始格 (0,0) 与四方向偏移决定（behavior.placeLocationAt 写 scenarioFlags.twistedHollowGrid）。
// 因此：
//   · `layout.locations` 为空表、`layout.edges` 为空表（都是运行期数据，manifest 只是静态声明）；
//   · 槽位规则以纯数据导出（DIRECTION_VECTORS / ADJACENCY / ACT2_GRID_OFFSETS），
//     供前端与测试读取「上/下/左/右相邻」的同一份事实；
//   · `layoutFor(scenario, coordinates)` 仍然用于把运行期网格投影成 UI 需要的 {locations, edges}。
import { layoutFor } from '../../../../scenario-manifest.js'
import { scenario, DIRECTION_VECTORS, ACT2_GRID_OFFSETS, START_SLOT } from './definition.js'

/** 起始格与四方向（placeCardInGrid 的 North/East/South/West）。 */
export const OPENING_SLOTS = Object.freeze({
  start: START_SLOT,
  ...Object.fromEntries(Object.entries(DIRECTION_VECTORS).map(([name, vector]) => [name, Object.freeze({ ...vector })])),
})

/** 两个格是否共享一条边（曼哈顿距离 1）。 */
export function areAdjacent(a, b) {
  if (!a || !b) return false
  return Math.abs(Number(a.x) - Number(b.x)) + Math.abs(Number(a.y) - Number(b.y)) === 1
}

/** 四方向相邻的槽位键（与 DIRECTION_VECTORS 同序）。 */
export const ADJACENT_DIRECTIONS = Object.freeze(Object.keys(DIRECTION_VECTORS))

/** 本关没有静态地点坐标：全部由布置流程写入运行期网格。 */
export const LOCATION_COORDINATES = Object.freeze({})
export const locationSlot = (grid, locationId) => (grid || {})[locationId] || null

const staticLayout = layoutFor(scenario, LOCATION_COORDINATES)
export const layout = {
  ...staticLayout,
  // 动态网格标记：前端据此改用 state.scenarioFlags.twistedHollowGrid（没有静态坐标可用）。
  dynamic: true,
  grid: true,
  startSlot: { ...START_SLOT },
  slots: { ...OPENING_SLOTS },
  adjacency: [...ADJACENT_DIRECTIONS],
  act2Offsets: [...ACT2_GRID_OFFSETS],
}

/** 把运行期网格投影成 layoutFor 形状（地点 id → 坐标 + 相邻边），供 UI/测试复用。 */
export function projectGrid(grid = {}, connections = {}) {
  const coordinates = Object.fromEntries(Object.entries(grid).map(([id, point]) => [id, { x: point.x, y: point.y }]))
  const edges = []
  for (const [from, neighbors] of Object.entries(connections)) {
    for (const to of neighbors || []) {
      if (!coordinates[from] || !coordinates[to]) continue
      if (from < to || !(connections[to] || []).includes(from)) edges.push({ from, to })
    }
  }
  return { locations: coordinates, edges }
}
