// 死亡酷暑 · 桌面坐标（Haskell#deadHeatLayout 的坐标投影）。
//
// 两行网格：heart/squiggle/square 与 . /diamond/triangle；废弃版本与普通版本共用同一格
// （同一地点被替换，不会同时在场）。
import { layoutFor } from '../../../../scenario-manifest.js'
import { scenario, LOCATION_COORDINATES } from './definition.js'

export const layout = layoutFor(scenario, LOCATION_COORDINATES)
