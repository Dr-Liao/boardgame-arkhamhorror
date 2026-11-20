// 黑曜石峡谷 · 桌面坐标（真实坐标在运行期写入剧本网格 mechanicState.grid）。
//
// coordinateSystem:'grid' + adjacency:'orthogonal'：每处地点与上下左右相邻地点/开阔天空相连。
// 幕 1 是 3×4、幕 2 重排为 3×5、幕 3 重排为 4×5（见 definition.ACT_TWO_LAYOUT/ACT_THREE_LAYOUT）；
// 本表只给全部候选地点一个确定性展示槽位，规则连接在 behavior.configureMap/connectGrid 里计算，
// 因此 layout.edges 只含印刷图标连接（本关为空）。
import { layoutFor } from '../../../../scenario-manifest.js'
import { scenario, LOCATION_COORDINATES } from './definition.js'

export const layout = {
  ...layoutFor(scenario, LOCATION_COORDINATES),
  coordinateSystem: 'grid',
  adjacency: 'orthogonal',
  grid: { rows: 3, columns: 4, rebase: 'actRebuild' },
}
