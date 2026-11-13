// 苦痛之影（Shades of Suffering · 09660）· 桌面坐标。
//
// 参考 `Scenario/Scenarios/TheScarletKeys/ShadesOfSuffering.hs` 的地图字符串：
//   circle .        squiggle .
//   .      triangle diamond   moon
//   square .        star     .
// 圆=雪兰莪俱乐部、方=俱乐部草坪、三角=火车站西翼、菱形=火车站东翼、波浪=美拉提的商店、
// 月=哇扬皮影偶戏剧场、星=锡矿。连接由卡面连接符号决定（definition.LOCATION_SYMBOLS），
// `layoutFor` 从 `location.connections` 派生展示连线，展示连线不会新增规则连接。
import { layoutFor } from '../../../../scenario-manifest.js'
import { scenario } from './definition.js'

export const SCENARIO_LAYOUT_COORDINATES = Object.freeze({
  selangorClub: Object.freeze({ x: 1, y: 0 }),
  melatisShop: Object.freeze({ x: 8, y: 0 }),
  stationWestWing: Object.freeze({ x: 3, y: 3 }),
  stationEastWing: Object.freeze({ x: 5, y: 3 }),
  wayangKulitTheater: Object.freeze({ x: 8, y: 3 }),
  selangorClubPadang: Object.freeze({ x: 1, y: 6 }),
  tinMine: Object.freeze({ x: 3, y: 6 }),
})

export const layout = layoutFor(scenario, SCENARIO_LAYOUT_COORDINATES)
