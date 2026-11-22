// 狼人诅咒 · 桌面坐标。
//
// 坐标只服务展示：连接关系在 definition.LOCATIONS 里按参考实现的地点图标集合声明；
// Setup 只放入场堆的 3 张地点，其余地点在幕 1 背面才入场，但提前占位。
import { layoutFor } from '../../../../scenario-manifest.js'
import { scenario, LOCATION_COORDINATES } from './definition.js'

export const layout = layoutFor(scenario, LOCATION_COORDINATES)

// 连接表（对称校验/审计用；manifest 的展示边由 scenario-manifest 从 connections 生成）。
export const CONNECTIONS = Object.freeze(Object.fromEntries(
  Object.values(scenario.locations).map(location => [location.id, [...location.connections]]),
))
