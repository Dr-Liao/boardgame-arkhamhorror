// 欢迎来到铁杉谷 · 桌面坐标。
//
// 印刷地图是 6 行 × 3 列的符号格（每个符号占上下两格），压成 3 × 3 整数网格后左上角为空：
//   .            教堂(三角)     杂货店(方形)
//   阿特伍德宅(月)  十字路口(菱形)  集会厅(星形)
//   老磨坊(心)      旅舍(圆形)      学校(黑桃)
// 本序曲「只按印刷图标连接」（指南 setup.locationsNote），所以 layout 的连线 = 图标连接，
// 不是网格正交相邻（与《寂静荒野》《汉洛克庄园》的网格规则不同）。
import { layoutFor } from '../../../../scenario-manifest.js'
import {
  LOCATION_COORDINATES, LOCATION_GRID, PRELUDE_SYMBOLS, SYMBOL_BY_LOCATION, scenario,
} from './definition.js'

export const GRID = Object.freeze({
  columns: Object.freeze([0, 1, 2]),
  rows: Object.freeze([0, 1, 2]),
  // 左上角在印刷地图上没有地点。
  empty: Object.freeze([Object.freeze({ x: 0, y: 0 })]),
  layout: LOCATION_GRID,
})

// 展示用符号（card-data.SYMBOLS 没有黑桃，definition 里补了这一条）。
export const SYMBOLS = Object.freeze(Object.fromEntries(
  Object.entries(SYMBOL_BY_LOCATION).map(([id, symbol]) => [id, PRELUDE_SYMBOLS[symbol]])))

export const layout = {
  ...layoutFor(scenario, LOCATION_COORDINATES),
  coordinateSystem: 'grid',
  connectionMode: 'icons',
  grid: GRID,
  symbols: SYMBOLS,
}
