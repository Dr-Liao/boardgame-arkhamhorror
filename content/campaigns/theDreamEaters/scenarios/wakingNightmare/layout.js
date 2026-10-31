// 清醒噩梦（Waking Nightmare · 06063）· 桌面坐标。
//
// 参考 WakingNightmare.hs:53-57 的地图（每个地点在印刷格上占一格宽两格高，纵向坐标翻倍）：
//   .             recordsOffice .                         .
//   .             waitingRoom   .                         .
//   emergencyRoom .             experimentalTherapiesWard .
//   .             basementDoor1 stairwell                 basementDoor3
//   .             .             basementDoor2             .
// 三张「地下室的门」（morgue/operatingRoom/privateRoom）随机落在 basementDoor1–3 的格子；
// 本章静态给它们三个各自固定一个门格，运行时翻面展示不改变坐标。
import { layoutFor } from '../../../../scenario-manifest.js'
import { scenario } from './definition.js'

const coordinates = {
  recordsOffice: { x: 2, y: 0 },
  waitingRoom: { x: 2, y: 2 },
  emergencyRoom: { x: 0, y: 4 },
  experimentalTherapiesWard: { x: 4, y: 4 },
  morgue: { x: 2, y: 6 },
  stairwell: { x: 4, y: 6 },
  privateRoom: { x: 8, y: 6 },
  operatingRoom: { x: 4, y: 8 },
}

export const layout = layoutFor(scenario, coordinates)
