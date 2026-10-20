import { layoutFor } from '../../../../scenario-manifest.js'
import { scenario } from './definition.js'

// 印刷地图（HeartOfTheElders.hs heartOfTheEldersLayout）的符号位置：
// 圆形在最上，方形/菱形/月牙一排，三角/心形一排，波浪/沙漏/T 字一排，等号在最下（昆扬之口）。
const coordinates = {
  timeWrackedWoods: { x: 2, y: 0 },
  pathOfThorns: { x: 0, y: 2 },
  riverCanyon: { x: 2, y: 2 },
  ropeBridge: { x: 4, y: 2 },
  serpentsHaven: { x: 1, y: 4 },
  circuitousTrail: { x: 3, y: 4 },
  templeOfTheFang: { x: 0, y: 6 },
  stoneAltar: { x: 2, y: 6 },
  overgrownRuins: { x: 4, y: 6 },
  mouthOfKnyan: { x: 2, y: 8 },
}

export const layout = layoutFor(scenario, coordinates)
