import { layoutFor } from '../../../../scenario-manifest.js'
import { scenario } from './definition.js'

// 印刷地图（HeartOfTheElders.hs 的 part2Locations 网格，6 行 × 4 列）：
//   深藏其下的昆扬之口在左，宽阔步道、漆黑洞窟在中间，崇拜礼堂与深入幽嘶在右，
//   危险峡谷与晶体柱群在上方。
const coordinates = {
  mouthOfKnYan: { x: 0, y: 2 },
  vastPassages: { x: 1, y: 2 },
  darkHollow: { x: 1, y: 4 },
  hallOfIdolatry: { x: 2, y: 3 },
  perilousGulch: { x: 1, y: 0 },
  crystalPillars: { x: 2, y: 1 },
  descentToYoth: { x: 3, y: 2 },
}

export const layout = layoutFor(scenario, coordinates)
