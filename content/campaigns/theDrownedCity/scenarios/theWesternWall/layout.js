// 西墙 · 桌面坐标。
//
// 静态投影按「西线」规范排布（层 2–5 在 y = -1..-4）；运行期东线翻到正 y 行，
// 但展示层不随方向切换（指南以静态示意图为准）。连线来自 definition 的层间连接。
import { layoutFor } from '../../../../scenario-manifest.js'
import { scenario, LOCATION_COORDINATES } from './definition.js'

export const layout = layoutFor(scenario, LOCATION_COORDINATES)

export const CONNECTIONS = Object.freeze(Object.fromEntries(
  Object.values(scenario.locations).map(location => [location.id, [...location.connections]]),
))
