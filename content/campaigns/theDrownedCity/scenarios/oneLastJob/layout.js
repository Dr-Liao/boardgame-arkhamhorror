// 金盆洗手 · 桌面坐标。
//
// 坐标只服务展示：连接关系在 definition.LOCATIONS 里声明的印刷图标连接给出，
// 两间酒馆（Hibb's Roadhouse / La Bella Luna）在幕 1 推进后才入场，但提前占位。
import { layoutFor } from '../../../../scenario-manifest.js'
import { scenario, LOCATION_COORDINATES } from './definition.js'

export const layout = layoutFor(scenario, LOCATION_COORDINATES)

// 连接表（对称校验用；index.js 的 manifest 由 location.connections 生成）。
export const CONNECTIONS = Object.freeze(Object.fromEntries(
  Object.values(scenario.locations).map(location => [location.id, [...location.connections]]),
))
