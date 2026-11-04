// 全速恐惧（Horror in High Gear · 07198）· 桌面坐标。
//
// chapter-data.json#horrorInHighGear.setup.roadDeck 提供真实道路顺序：
//   · allPhysicalRoadIds（15 张物理道路，含起始路面 07203）按牌序铺成一条横向公路；
//   · longWayPool 的 6 张绕行道路（07210 及 5 个副本）开局在一边，排在公路下方。
// 车辆在地图上沿公路从左向右移动；规则连接仍由道路条目在运行时写入。
import { place, finishCoordinates } from '../../layout.js'
import { chapterData } from '../../chapter-definition.js'

const chapterId = 'horrorInHighGear'
const spec = chapterData[chapterId]
const map = {}

// 公路主线：起始路面 07203 在最左端（本章 startLocation 由道路 setup 决定，chapter-data
// 里的 startLocation 为 null；definition 回落到 07203），其余物理道路按印刷牌序依次向右。
const START_LOCATION = '07203'
const road = spec.setup.roadDeck.allPhysicalRoadIds
const order = [START_LOCATION, ...road.filter(code => code !== START_LOCATION)]
order.forEach((printed, index) => place(map, printed, [index, 0]))
// 绕行道路（本局可能不用）：排在公路下方，保持确定性顺序。
spec.setup.longWayPool.physicalIds.forEach((printed, index) => place(map, printed, [index * 2, -2]))

export const coordinates = finishCoordinates(chapterId, map)
