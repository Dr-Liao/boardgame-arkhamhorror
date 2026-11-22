// 血海深仇 · 桌面坐标（随机地点始终占位；只展示实际入场地点）。
import { layoutFor } from '../../../../scenario-manifest.js'
import { scenario, LOCATION_COORDINATES } from './definition.js'

export const layout = layoutFor(scenario, LOCATION_COORDINATES)

export const CONNECTIONS = Object.freeze(Object.fromEntries(
  Object.values(scenario.locations).map(location => [location.id, [...location.connections]]),
))
