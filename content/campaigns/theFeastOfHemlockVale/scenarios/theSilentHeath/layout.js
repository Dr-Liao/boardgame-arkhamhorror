// 寂静荒野 · 桌面坐标（真实坐标在运行期写入剧本网格 mechanicState.grid）。
//
// 起始三地点：(0,0) 珀尔庄园废墟、(1,-1) 水晶果园、(2,0) 惨白斜坡；
// 幕 1 背面把 3 张岩中恐怖地点放进 (0,-1)/(1,0)/(2,-1)。桌面展示给全部候选地点
// 一个确定性槽位（岩中恐怖 6 张里只有 3 张会入场），连线只用印刷图标边。
import { layoutFor } from '../../../../scenario-manifest.js'
import { scenario, LOCATION_COORDINATES } from './definition.js'

export const layout = layoutFor(scenario, LOCATION_COORDINATES)
