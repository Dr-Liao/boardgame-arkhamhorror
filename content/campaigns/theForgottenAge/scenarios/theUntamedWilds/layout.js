import { layoutFor } from '../../../../scenario-manifest.js'
import { scenario } from './definition.js'

// 符号地图：营地居中，雨林符号按印刷地图的相对位置摆放，遗迹在右侧。
const coordinates = {
  expeditionCamp: { x: 3, y: 2 },
  pathOfThorns: { x: 0, y: 2 },
  riverCanyon: { x: 2, y: 4 },
  ropeBridge: { x: 5, y: 4 },
  serpentsHaven: { x: 0, y: 0 },
  circuitousTrail: { x: 6, y: 0 },
  templeOfTheFang: { x: 1, y: 1 },
  overgrownRuins: { x: 4, y: 0 },
  ruinsOfEztli: { x: 3, y: -1 },
}

export const layout = layoutFor(scenario, coordinates)
