// 岩间密语 · 桌面坐标（Location Placement 图的静态投影）。
//
// 规则坐标不在这里：幕 1 的洞穴行与幕间「塌方」之后的轨道段都由 behavior 在运行期写入
// 剧本网格（mechanicState.grid），连接也由 run-time 的 connectGrid 重算（轨道段只连
// 「对齐的轨道图标」）。因此 layout.edges 为空，这里只给前端一个稳定的摆位快照。
import { layoutFor } from '../../../../scenario-manifest.js'
import { scenario, LOCATION_COORDINATES } from './definition.js'

export const layout = layoutFor(scenario, LOCATION_COORDINATES)
