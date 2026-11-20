// 阿卡姆的毁灭 第二部分 · 桌面坐标。
//
// 参考布局 3 行 × 4 列：屋顶在两侧；废墟版本放在一边（只在议程背面交换入场），
// 展示槽位给全部候选一个确定性位置。
import { layoutFor } from '../../../../scenario-manifest.js'
import { scenario, LOCATION_COORDINATES } from './definition.js'

export const layout = layoutFor(scenario, LOCATION_COORDINATES)
