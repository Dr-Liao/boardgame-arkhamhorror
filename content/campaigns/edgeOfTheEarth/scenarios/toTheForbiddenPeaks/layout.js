// 失落之峰（To the Forbidden Peaks · 08596）· 桌面坐标。
//
// 参考布局（locale setup.placeLocations）：五个山腰地点排成斜线，底部 level 0 到顶部 level 4，
// 山顶（level 5）放在斜线顶端；每个地点占一格宽两格高（与 TDE 章节 layout 相同的纵向翻倍口径）。
import { layoutFor } from '../../../../scenario-manifest.js'
import { scenario } from './definition.js'

const coordinates = {
  deepDrifts: { x: 0, y: 10 },
  steepIncline: { x: 2, y: 8 },
  narrowRidge: { x: 4, y: 6 },
  rockyLedge: { x: 6, y: 4 },
  snowCoveredCrag: { x: 8, y: 2 },
  summit: { x: 10, y: 0 },
  // 放一边的两个山腰地点不参与开局桌面坐标（揭示后由 behavior 放到空位）。
  whiteBluff: { x: 12, y: 6 },
  windsweptPath: { x: 0, y: 4 },
}

export const layout = layoutFor(scenario, coordinates)
