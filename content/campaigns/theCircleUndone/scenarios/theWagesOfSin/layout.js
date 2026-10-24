import { layoutFor } from '../../../../scenario-manifest.js'
import { scenario } from './definition.js'

// 展示坐标：Haskell 顶部地图
//   .              theGallows    .             chapelAttic     .
//   hereticsGraves hauntedFields .             abandonedChapel chapelCrypt
//   .              .             hangmansBrook .               .
// 每对变体（169/170 等）是同一张地图位置的两种版本，共享坐标；每张卡占一列两行，
// 列宽 ×2、行高 ×2（与 TFA 的布局约定一致）。
const columns = [0, 2, 4, 6, 8]
const rows = [0, 2, 4]
const at = (column, row) => ({ x: columns[column], y: rows[row] })

const coordinates = {
  // 中排
  hereticsGraves171: at(0, 1),
  hereticsGraves172: at(0, 1),
  hauntedFields: at(1, 1),
  abandonedChapel: at(3, 1),
  chapelCrypt173: at(4, 1),
  chapelCrypt174: at(4, 1),
  // 上排
  theGallows169: at(1, 0),
  theGallows170: at(1, 0),
  chapelAttic175: at(3, 0),
  chapelAttic176: at(3, 0),
  // 下排
  hangmansBrook: at(2, 2),
}

export const layout = layoutFor(scenario, coordinates)
