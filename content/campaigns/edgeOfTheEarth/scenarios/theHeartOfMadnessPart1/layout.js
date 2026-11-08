// 疯狂之心 第 I/II 部分共用地图（参考 Scenarios/TheHeartOfMadness/Helpers.hs#theHeartOfMadnessLayout）。
//
// 每个设施槽位在印刷格上占一格宽两格高（纵向坐标翻倍），门的中心在 (6,12)：
//   .          .          .          facility1  .          .          .
//   facility2  .          .          facility1  .          .          facility3
//   facility2  .          .          facility4  .          .          facility3
//   .          facility5  .          facility4  .          facility6  .
//   .          facility5  .          facility7  .          facility6  .
//   .          .          facility8  facility7  facility9  .          .
//   .          .          facility8  theGateOfYquaa facility9 .        .
//   .          .          .          theGateOfYquaa .        .        .
//   .          .          facility10 .          facility11 .          .
//   .          .          facility10 .          facility11 .          .
//   .          facility12 .          .          .          facility13 .
//   .          facility12 .          .          .          facility13 .
//   facility14 .          .          .          .          .          facility15
//   facility14 .          .          .          .          .          facility15
//
// 随机布置只改变「哪个卡面落在哪个槽位」，槽位坐标与连接不变（环/辐连接在 definition.js）。
import { layoutFor } from '../../../../scenario-manifest.js'
import { scenario } from './definition.js'

const column = [0, 2, 4, 6, 8, 10, 12]
const row = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26]
const coordinates = {
  facility1: { x: column[3], y: row[0] },
  facility2: { x: column[0], y: row[1] },
  facility3: { x: column[6], y: row[1] },
  facility4: { x: column[3], y: row[2] },
  facility5: { x: column[1], y: row[3] },
  facility6: { x: column[5], y: row[3] },
  facility7: { x: column[3], y: row[4] },
  facility8: { x: column[2], y: row[5] },
  facility9: { x: column[4], y: row[5] },
  theGateOfYquaa: { x: column[3], y: row[6] },
  facility10: { x: column[2], y: row[8] },
  facility11: { x: column[4], y: row[8] },
  facility12: { x: column[1], y: row[10] },
  facility13: { x: column[5], y: row[10] },
  facility14: { x: column[0], y: row[12] },
  facility15: { x: column[6], y: row[12] },
}

export const layout = layoutFor(scenario, coordinates)
export const MAP_COORDINATES = Object.freeze(coordinates)
