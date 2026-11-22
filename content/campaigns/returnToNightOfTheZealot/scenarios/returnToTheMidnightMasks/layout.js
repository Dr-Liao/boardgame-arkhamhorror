// 重返午夜假面 · 桌面坐标（3×3 阿卡姆街区，同基础章节）。
import { layoutFor } from '../../../../scenario-manifest.js'
import { scenario, LOCATION_COORDINATES } from './definition.js'

export const layout = layoutFor(scenario, LOCATION_COORDINATES)

export const CONNECTIONS = Object.freeze(Object.fromEntries(
  Object.values(scenario.locations).map(location => [location.id, [...location.connections]]),
))
