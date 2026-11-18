// 汉洛克庄园 · 桌面坐标（Location Placement 图，指南第 15 页 / Haskell#placeInGrid）。
//
// 网格是 3 列 × 4 层，地窖层在门厅正下方：
//   4 层  .  卧室(放一边的随机卧室→中列) .
//   3 层  随机 随机 随机
//   2 层  随机 随机 随机
//   1 层  客厅 门厅 餐厅      ← 印刷固定，永远同一格
//   地窖  .  失形地窖 .
// 随机分配的房间（第二/三层 6 间）没有静态坐标，因此 `locations` 只放**坐标确定**的房间，
// 其余以 `slots` 声明格子；运行时坐标写在 `state.scenarioFlags.mechanics.grid`（behavior 放置）。
// 玩家地点/敌人-地点的「与相邻地点相连」= 网格正交相邻（adjacency: 'orthogonal'）。
import { layoutFor } from '../../../../scenario-manifest.js'
import {
  FIRST_FLOOR, RANDOM_SLOTS, TOP_BEDROOM_SLOT, CELLAR_SLOT, CELLAR_ID, GRID_ADJACENCY, scenario,
} from './definition.js'

export const FLOOR_CELLS = Object.freeze({
  1: Object.freeze([{ x: -1, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 }]),
  2: Object.freeze(RANDOM_SLOTS.filter(cell => cell.y === 1)),
  3: Object.freeze(RANDOM_SLOTS.filter(cell => cell.y === 2)),
  4: Object.freeze([TOP_BEDROOM_SLOT]),
  0: Object.freeze([CELLAR_SLOT]),
})

export const SLOTS = Object.freeze([
  ...Object.entries(FIRST_FLOOR).map(([id, cell]) => Object.freeze({ id: `slot:${id}`, x: cell.x, y: cell.y })),
  ...RANDOM_SLOTS.map((cell, index) => Object.freeze({ id: `slot:random${index + 1}`, x: cell.x, y: cell.y })),
  Object.freeze({ id: 'slot:topBedroom', x: TOP_BEDROOM_SLOT.x, y: TOP_BEDROOM_SLOT.y }),
  Object.freeze({ id: 'slot:cellar', x: CELLAR_SLOT.x, y: CELLAR_SLOT.y }),
])

const COORDINATES = Object.freeze({
  ...FIRST_FLOOR,
  [CELLAR_ID]: CELLAR_SLOT,
})

/** 网格坐标 → 楼层号（1 层 y=0；地窖 y<0 记 0 层）。 */
export const floorOfCell = cell => (cell && Number(cell.y) >= 0 ? Number(cell.y) + 1 : 0)

export const layout = {
  ...layoutFor(scenario, COORDINATES),
  coordinateSystem: 'grid',
  adjacency: GRID_ADJACENCY,
  grid: Object.freeze({
    columns: Object.freeze([-1, 0, 1]),
    floors: Object.freeze([1, 2, 3, 4]),
    cellarFloor: 0,
    topBedroom: TOP_BEDROOM_SLOT,
    cellar: CELLAR_SLOT,
  }),
  floorCells: FLOOR_CELLS,
  fixed: FIRST_FLOOR,
  slots: SLOTS,
}
