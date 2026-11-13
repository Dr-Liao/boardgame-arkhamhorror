// 血色阴影（Sanguine Shadows · 09545）· 桌面坐标。
//
// 参考 setup：五月大道（09549）居中，其余七张随机移除一张后，六张「环形围绕」五月大道。
// 这里给八个地点固定的环形槽位（中心 + 七角）；运行时移除的那张不 placedLocation，槽位空着，
// 因此六张仍呈环形。连接由卡面连接符号决定（definition.LOCATION_SYMBOLS），
// `layoutFor` 从 `location.connections` 派生展示连线，展示连线不会新增规则连接。
import { layoutFor } from '../../../../scenario-manifest.js'
import { scenario } from './definition.js'

export const SCENARIO_LAYOUT_COORDINATES = Object.freeze({
  avenidaDeMayo: Object.freeze({ x: 6, y: 4 }),
  casaRosada: Object.freeze({ x: 6, y: 0 }),
  catedralMetropolitana: Object.freeze({ x: 10, y: 1 }),
  recoleta: Object.freeze({ x: 11, y: 4 }),
  palacioErrazuriz: Object.freeze({ x: 10, y: 7 }),
  theCabildo: Object.freeze({ x: 6, y: 8 }),
  bancoDeLaProvincia: Object.freeze({ x: 2, y: 7 }),
  teatroColon: Object.freeze({ x: 1, y: 4 }),
})

export const layout = layoutFor(scenario, SCENARIO_LAYOUT_COORDINATES)
