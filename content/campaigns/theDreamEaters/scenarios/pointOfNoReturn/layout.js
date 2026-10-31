import { layoutFor } from '../../../../scenario-manifest.js'
import { scenario } from './definition.js'

// 展示坐标：参考实现的本章地图（5 列 × 3 行；Haskell PointOfNoReturn.hs 顶部地图字符串）：
//   enchantedWoods   towerOfKoth     seaOfBones   peaksOfThok  seaOfPitch(262)
//   vaultsOfZin      cityOfGugs      valeOfPnath  seaOfPitch(263)
//   plainOfTheGhouls cragOfTheGhouls              seaOfPitch(264) seaOfPitch(265)
// 4 张漆黑之海在「深入」幕背面随机放置并会被「起伏的漩涡」混洗位置，坐标只是展示位置。
const columns = [0, 2, 4, 6, 8]
const rows = [0, 2, 4]
const at = (column, row) => ({ x: columns[column], y: rows[row] })

const coordinates = {
  enchantedWoods: at(0, 0),
  towerOfKoth: at(1, 0),
  seaOfBones: at(2, 0),
  peaksOfThok: at(3, 0),
  seaOfPitch262: at(4, 0),
  vaultsOfZin: at(0, 1),
  cityOfGugs: at(1, 1),
  valeOfPnath: at(2, 1),
  seaOfPitch263: at(3, 1),
  plainOfTheGhouls: at(0, 2),
  cragOfTheGhouls: at(1, 2),
  seaOfPitch264: at(3, 2),
  seaOfPitch265: at(4, 2),
}

export const layout = layoutFor(scenario, coordinates)
