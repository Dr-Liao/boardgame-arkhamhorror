// 沉睡者墓穴 · 桌面坐标（2 行 × 3 列，沉睡者墓穴在底行中央；印刷图标连接由 definition 声明）。
import { layoutFor } from '../../../../scenario-manifest.js'
import { scenario, LOCATION_COORDINATES } from './definition.js'

export const layout = {
  ...layoutFor(scenario, LOCATION_COORDINATES),
  coordinateSystem: 'location-group',
  grid: { rows: 2, columns: 3 },
}
