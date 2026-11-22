// 精益酒店谋杀案 · 桌面坐标（按参考后端 ASCII 网格的 4 向相邻关系布局）。
import { layoutFor } from '../../../../scenario-manifest.js'
import { scenario, LOCATION_COORDINATES } from './definition.js'

export const layout = layoutFor(scenario, LOCATION_COORDINATES)
export const CONNECTIONS = Object.freeze(Object.fromEntries(
  Object.values(scenario.locations).map(location => [location.id, [...location.connections]]),
))
