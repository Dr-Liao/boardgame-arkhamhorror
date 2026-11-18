// 最长一夜 · 桌面坐标（Haskell grid 的坐标投影）。
//
// 农庄居中 (0,0)；五处 Atwood Farm 在 (±1,0)/(0,±1) 与 (-2,0)，四处外围农田在
// (-3,0)/(2,0)/(0,-2)/(0,2)。被移除的那张外围农田与其余四张共用同一格位定义
// （它不在场，不会同时出现）。
import { layoutFor } from '../../../../scenario-manifest.js'
import { scenario, LOCATION_COORDINATES } from './definition.js'

export const layout = layoutFor(scenario, LOCATION_COORDINATES)
