// 淹没城区 · 桌面坐标。
//
// 真实布局在运行期随机：屏障核心固定 (0,0)，8 张[[海底]]地点洗牌后按
// SEA_FLOOR_CELLS 放入 3×3 环位（Haskell Setup placeInGrid 的 Pos 列表）。
// 规则连接来自网格正交邻接（幕 1 正面「每处地点与相邻地点相连」），由
// behavior.setupLocations 的 `mechanics.map.place` 建立；因此章节静态 connections
// 为空，layout.edges 也为空，展示坐标只给每个候选地点一个确定性槽位
// （二选一的两张共用同一槽位，实际只会有一张入场）。
import { layoutFor } from '../../../../scenario-manifest.js'
import { scenario, LOCATION_COORDINATES } from './definition.js'

export const layout = layoutFor(scenario, LOCATION_COORDINATES)

// 运行期网格：屏障核心 + 8 个环位。
export const GRID = Object.freeze({
  start: { x: 0, y: 0 },
  ring: Object.freeze([
    { x: -1, y: 1 }, { x: 0, y: 1 }, { x: 1, y: 1 },
    { x: -1, y: 0 }, { x: 1, y: 0 },
    { x: -1, y: -1 }, { x: 0, y: -1 }, { x: 1, y: -1 },
  ]),
})
