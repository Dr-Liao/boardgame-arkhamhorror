// 钥匙议会（Congress of the Keys · 09694）· 桌面坐标。
//
// 参考 setup 用两段网格：
//   圣堂/巢穴区（同志会藏身处）：猩红走廊居中，三张同志会圣所在它下方一排（随机顺序）；
//   异界区（幕 1 背面）：万千纠结之塔 → 悖逆重力之阶 → 睥睨众生之巅成一竖列。
// 本文件给 11 张地点固定槽位（圣堂面与巢穴面共用一个槽位：布置时只放其中一面），
// `layoutFor` 从 `location.connections` 派生展示连线；展示连线不新增规则连接。
import { layoutFor } from '../../../../scenario-manifest.js'
import { scenario } from './definition.js'

export const SCENARIO_LAYOUT_COORDINATES = Object.freeze({
  // 藏身处（参考 grid：`coterieSanctuary1 coterieSanctuary2 coterieSanctuary3` / `. scarletHalls .`）
  scarletHallsSanctum: Object.freeze({ x: 1, y: 0 }),
  scarletHallsLair: Object.freeze({ x: 1, y: 0 }),
  congressChamberSanctum: Object.freeze({ x: 0, y: 1 }),
  congressChamberLair: Object.freeze({ x: 0, y: 1 }),
  coterieLibrarySanctum: Object.freeze({ x: 1, y: 1 }),
  coterieLibraryLair: Object.freeze({ x: 1, y: 1 }),
  keyReliquarySanctum: Object.freeze({ x: 2, y: 1 }),
  keyReliquaryLair: Object.freeze({ x: 2, y: 1 }),
  // 异界（竖列：塔底 → 阶梯 → 塔顶）
  knottedTower: Object.freeze({ x: 1, y: 3 }),
  gravityDefyingClimb: Object.freeze({ x: 1, y: 4 }),
  toweringVertex: Object.freeze({ x: 1, y: 5 }),
})

export const layout = layoutFor(scenario, SCENARIO_LAYOUT_COORDINATES)
