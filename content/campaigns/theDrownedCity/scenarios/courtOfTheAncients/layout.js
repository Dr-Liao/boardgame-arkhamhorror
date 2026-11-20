// 古代议庭 · 桌面坐标（真实坐标在运行期写入剧本网格 mechanicState.grid）。
//
// 竖直 4 层塔：层 = 网格行 + 1。第 1 层 row 0：西侧前厅 (0,0)、大升降机 (1,0)、东侧前厅 (2,0)、
// 古代祭坛 (3,0)；第 4 层 row 3：扭曲栈桥 (0,3) 与一张档案库 (2,3)；其余档案库填 (0,2)/(2,2)/(0,1)/(2,1)。
// 大升降机随路线初始在第 1 层（向西）或第 4 层（向东），运行时由 behavior 移动；展示层固定在 (1,0)。
// 展示连线只含真实规则连接（东侧前厅 ↔ 古代祭坛），升降机动态连接由运行期网格维护、不画展示边。
import { layoutFor } from '../../../../scenario-manifest.js'
import { scenario, LOCATION_COORDINATES } from './definition.js'

export const layout = layoutFor(scenario, LOCATION_COORDINATES)
// 展示层把静态连接合并为双向边（layoutFor 按 location.connections 生成，定义里已是双向）。
export const layoutEdges = layout.edges
