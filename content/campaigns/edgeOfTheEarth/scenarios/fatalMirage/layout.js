// 致命幻景 · 桌面坐标（Haskell#fatalMirageLayout 的坐标投影）。
import { layoutFor } from '../../../../scenario-manifest.js'
import { scenario, LOCATION_COORDINATES } from './definition.js'

export const layout = layoutFor(scenario, LOCATION_COORDINATES)
