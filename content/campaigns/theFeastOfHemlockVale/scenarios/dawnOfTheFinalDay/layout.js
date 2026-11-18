// 最终日黎明 · 桌面坐标（Haskell#scenarioWith 的页 6 地图投影）。
//
// 地图是 3 列 × 6 行，每张地点卡竖向占两格（同一符号在地图上出现两次）；
// 这里取每张卡的**上格**作坐标。序曲只用图标连接（base.json#locationAdjacency 最后一条），
// 网格相邻不产生规则连接，坐标仅供布局展示。
import { layoutFor } from '../../../../scenario-manifest.js'
import { scenario, LOCATION_COORDINATES } from './definition.js'

export const layout = layoutFor(scenario, LOCATION_COORDINATES)
