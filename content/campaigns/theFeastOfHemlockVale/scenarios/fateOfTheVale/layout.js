// 山谷的命运 · 桌面坐标（Haskell#cosmicEmissaryLayout 的坐标投影）。
//
// 6×6 网格：上/右/下/左四个镜巢围成环，宇宙密使占据环内的四个格位（深渊密使在正中），
// 洞穴地点在四角外侧。密使是敌人而不是地点，因此 layout 只投影地点与连线。
import { layoutFor } from '../../../../scenario-manifest.js'
import { scenario, LOCATION_COORDINATES } from './definition.js'

export const layout = layoutFor(scenario, LOCATION_COORDINATES)
