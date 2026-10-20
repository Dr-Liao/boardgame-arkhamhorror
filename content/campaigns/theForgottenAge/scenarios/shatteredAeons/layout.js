import { layoutFor } from '../../../../scenario-manifest.js'
import { scenario } from './definition.js'

// 符号地图：恩凯联结点居中，三处异界（水滴）在左侧，时间之窗（星星）在中央偏右，
// 六处「破碎」地点（等号）沿右侧排开。
const coordinates = {
  yuggoth: { x: 0, y: 0 },
  shoresOfRlyeh: { x: 0, y: 2 },
  cityOfTheUnseen: { x: 0, y: 4 },
  nexusOfNKai: { x: 2, y: 2 },
  aPocketInTime: { x: 4, y: 2 },
  ruinsOfNewYork: { x: 6, y: 0 },
  mu: { x: 6, y: 4 },
  atlantis: { x: 8, y: 1 },
  pnakotus: { x: 8, y: 3 },
  valusia: { x: 10, y: 0 },
  plateauOfLeng: { x: 10, y: 4 },
}

export const layout = layoutFor(scenario, coordinates)
