import { layoutFor } from '../../../../scenario-manifest.js'
import { scenario } from './definition.js'

// 印刷地图（Haskell scenarios threadsOfFate 的 ASCII 布局）：
//   trainTracks townHall arkhamPoliceStation
//   curiositieShoppe northside downtown easttown velmasDiner
//   eztliExhibit miskatonicUniversity rivertown blackCave
const coordinates = {
  trainTracks: { x: 2, y: 0 },
  townHall: { x: 3, y: 0 },
  arkhamPoliceStation: { x: 4, y: 0 },
  curiositieShoppe: { x: 0, y: 1 },
  northside: { x: 1, y: 1 },
  downtown: { x: 2, y: 1 },
  easttown: { x: 3, y: 1 },
  velmasDiner: { x: 4, y: 1 },
  eztliExhibit: { x: 1, y: 2 },
  miskatonicUniversity: { x: 2, y: 2 },
  rivertown: { x: 3, y: 2 },
  blackCave: { x: 4, y: 2 },
}

export const layout = layoutFor(scenario, coordinates)
