// 亡命冰原 第 I 部分 · 桌面坐标（Haskell#iceAndDeathLayout 的格子投影）。
import { layoutFor } from '../../../../scenario-manifest.js'
import { scenario, LOCATION_COORDINATES } from './definition.js'

export const layout = layoutFor(scenario, LOCATION_COORDINATES)
