import { layoutFor } from '../../../../scenario-manifest.js'
import { scenario } from './definition.js'

// Haskell 顶部地图（TheSecretName.hs:43-48，5 行 × 8 列）：
//   row0: . . . cityOfElderThings? physicsClassroom siteOfTheSacrifice . strangeGeometry1
//   row1: . walter . cityOfElderThings physicsClassroom siteOfTheSacrifice . strangeGeometry1
//   row2: decrepitDoor1 moldyHalls decrepitDoor2 moldyHallsEarlierTonight keziahsRoom witchHouseRuins
//   row3: . decrepitDoor3 . salemGaol1692 twilightAbyss courtOfTheGreatOldOnes . strangeGeometry2
//   row4: . . . . (未知地点牌库的其余格位)
// 每个地点在印刷格上占一格宽、两格高，所以纵向坐标翻倍；x 保留列序并乘 2 便于读图。
const coordinates = {
  walterGilmansRoom: { x: 2, y: 2 },
  cityOfElderThings: { x: 6, y: 2 },
  physicsClassroom: { x: 8, y: 2 },
  siteOfTheSacrifice: { x: 10, y: 2 },
  strangeGeometry1: { x: 14, y: 2 },
  landlordsQuarters: { x: 0, y: 4 },
  moldyHalls: { x: 2, y: 4 },
  joeMazurewiczsRoom: { x: 4, y: 4 },
  moldyHallsEarlierTonight: { x: 6, y: 4 },
  keziahsRoom: { x: 8, y: 4 },
  witchHouseRuins: { x: 10, y: 4 },
  frankElwoodsRoom: { x: 2, y: 6 },
  salemGaol1692: { x: 6, y: 6 },
  twilightAbyss: { x: 8, y: 6 },
  courtOfTheGreatOldOnes: { x: 10, y: 6 },
  strangeGeometry2: { x: 14, y: 6 },
}

export const layout = layoutFor(scenario, coordinates)
