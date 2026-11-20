// 大秘库 · 桌面坐标（真实坐标在运行期写入剧本网格 mechanicState.grid）。
//
// 4 个固定地点 + 8 张候选秘库房间各给一个确定性展示槽位；7 个腔室槽位按 Haskell
// vaultChamberPositions 排布。卡表没有连接图标数据，规则连接由 behavior 用正交网格复算，
// 因此 layout.edges 为空（展示层不创建规则连接）。
import { layoutFor } from '../../../../scenario-manifest.js'
import { scenario, LOCATION_COORDINATES } from './definition.js'

export const layout = layoutFor(scenario, LOCATION_COORDINATES)
