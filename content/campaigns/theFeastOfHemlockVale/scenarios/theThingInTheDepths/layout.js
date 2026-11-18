import { layoutFor } from '../../../../scenario-manifest.js'
import { scenario, LOCATION_COORDINATES } from './definition.js'

// 深沼之物 · 桌面坐标（参考摆法的 3×3 网格投影，见 definition.js#DEFAULT_SLOT_ASSIGNMENT）。
// 运行时洗牌摆位记在 scenarioFlags.depthsSlots；UI 连线来自 manifest.layout（参考摆法），
// 规则连接由 behavior.setupLocations 按实际槽位重算后写回地点定义。
export const layout = layoutFor(scenario, LOCATION_COORDINATES)
