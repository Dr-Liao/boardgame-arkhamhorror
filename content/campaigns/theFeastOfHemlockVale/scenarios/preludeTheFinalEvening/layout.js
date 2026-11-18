// 最终之夜 · 桌面坐标（指南第 6 页 / Haskell#Layout 的 6×3 地图投影）。
//
// 映射来自 MAP_GRID：十字路口(diamond) 居中，旅舍(circle)/学校(spade) 在南，
// 教堂(triangle)/杂货店(square) 在北，阿特伍德宅(moon)/老磨坊(heart) 在西。
// 序曲/使用 The Vale 的关卡「只按印刷图标连接」，因此边只由 LOCATION_CONNECTIONS 生成。
import { layoutFor } from '../../../../scenario-manifest.js'
import { scenario, LOCATION_COORDINATES } from './definition.js'

export const layout = layoutFor(scenario, LOCATION_COORDINATES)
