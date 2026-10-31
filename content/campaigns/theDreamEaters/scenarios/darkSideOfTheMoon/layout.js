// 月之暗面 · 地点坐标（Haskell DarkSideOfTheMoon.hs:43-47 的印刷地图 4×4）。
//
//   白船        月之亮面      月下洞穴（亮面）
//   月兽之城    漆黑深坑      黑暗月核
//   月蜥神庙    月之森林      月下洞穴（暗面）
//   .           月兽帆船      .
import { layoutFor } from '../../../../scenario-manifest.js'
import { scenario } from './definition.js'

const coordinates = {
  theWhiteShip: { x: 0, y: 0 },
  lightSideOfTheMoon: { x: 2, y: 0 },
  cavernsBeneathTheMoonLightSide: { x: 4, y: 0 },
  cityOfTheMoonBeasts: { x: 0, y: 2 },
  theDarkCrater: { x: 2, y: 2 },
  theBlackCore: { x: 4, y: 2 },
  templeOfTheMoonLizard: { x: 0, y: 4 },
  moonForest: { x: 2, y: 4 },
  cavernsBeneathTheMoonDarkSide: { x: 4, y: 4 },
  moonBeastGalley: { x: 2, y: 6 },
}

export const layout = layoutFor(scenario, coordinates)
export default layout
