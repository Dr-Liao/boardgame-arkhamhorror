// 古老者之城（City of the Elder Things · 08621）· 桌面坐标。
//
// 16 张城市景观按参考 implementation 的 setup1Positions 归一化成 5×5 网格（row/column 0 起）；
// 相邻格在运行时由 `grid-map.js#connectGrid`（orthogonal）生成连接。隐秘隧道在地图外。
import { layoutFor } from '../../../../scenario-manifest.js'
import { scenario, CITY_LAYOUTS, HIDDEN_TUNNEL, CITY_LOCATION_IDS } from './definition.js'

const cells = CITY_LAYOUTS.v1
const coordinates = {}
CITY_LOCATION_IDS.forEach((id, index) => {
  const cell = cells[index]
  coordinates[id] = { x: cell.column * 2, y: cell.row * 2 }
})
coordinates[HIDDEN_TUNNEL] = { x: 12, y: 10 }

export const layout = layoutFor(scenario, coordinates)
// 城市景观的邻接是运行时生成的：静态 layout 的边先按 setup1Positions 的 4 邻接算出，
// 方便桌面在未建局时也能预览；建局后 `connectGrid` 会给出权威 connections。
// 城市景观的邻接由运行时 `src/engine/grid-map.js#connectGrid` 生成；
// 静态 layout 不预置边，避免展示连线被注册表当成规则连接。
layout.edges = []
