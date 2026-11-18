// 消失的姐妹 · 桌面坐标（阿克望海岸洞穴网格的展示投影）。
//
// 真实坐标准则在运行期：Setup 把阿克望放在 (0,0)、岩穴牌库顶 3 张放在 (-1,0)/(0,-1)/(1,0)
// （未揭示），之后行动/幕背面/法典继续把牌库顶放进「与某地点相邻的空格」
// （`grid-map.js#placeGridLocation` + `connectGrid`，坐标存 `scenarioFlags.mechanics.grid`）。
// 所以本文件给每个**可能**入场的地点一个确定性展示槽位（未入场时用于地图预览），
// 并且 `edges` 保持空数组：规则连接全部来自运行期的正交邻接（`CONNECTION_POLICY`），
// 静态声明边会把展示连线变成不存在的规则连接（schema.js#assertUiLayout 的口径）。
// 与 EotE《古老者之城》同一写法（layout.edges = []）。
import { layoutFor } from '../../../../scenario-manifest.js'
import { scenario, LOCATION_COORDINATES, AKWAN_CELL } from './definition.js'

export const SCENARIO_LAYOUT_COORDINATES = Object.freeze({
  ...Object.fromEntries(Object.entries(LOCATION_COORDINATES).map(([id, point]) => [id, { ...point }])),
})

export const INITIAL_GRID = Object.freeze({ akwan: { ...AKWAN_CELL } })

export const layout = layoutFor(scenario, SCENARIO_LAYOUT_COORDINATES)
layout.edges = []
export const edges = layout.edges
