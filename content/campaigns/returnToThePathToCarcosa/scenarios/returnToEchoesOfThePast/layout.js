// 重返往事回声 · 桌面布局。
//
// 参考 ReturnToEchoesOfThePast.hs：
//   thirdFloor1  quietHalls2 thirdFloor2  . .
//   secondFloor1 quietHalls1 secondFloor2 . hiddenLibrary
//   groundFloor1 entryHall   groundFloor2 . .
//   basement1    quietHalls3 basement2    . .
// 地下室三间排在底层，右侧两格留空（隐藏的图书馆在第二层右侧）。
import { layoutFor } from '../../../../scenario-manifest.js'
import { scenario } from './definition.js'

export const layout = layoutFor(scenario, {
  thirdLibrary: { x: 0, y: 0 },
  quietHallsThird: { x: 1, y: 0 },
  peabodysOffice: { x: 2, y: 0 },
  thirdRecordOffice: { x: 3, y: 0 },
  secondMuseum: { x: 0, y: 1 },
  quietHallsSecond: { x: 1, y: 1 },
  secondLibrary: { x: 2, y: 1 },
  readingRoom: { x: 3, y: 1 },
  hiddenLibrary: { x: 4, y: 1 },
  meetingRoom: { x: 0, y: 2 },
  entryHall: { x: 1, y: 2 },
  groundRecordOffice: { x: 2, y: 2 },
  groundMuseum: { x: 3, y: 2 },
  dustyArchives: { x: 0, y: 3 },
  quietHallsBasement: { x: 1, y: 3 },
  museumStorage: { x: 2, y: 3 },
  boilerRoom: { x: 3, y: 3 },
})
