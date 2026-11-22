// 重返卡城幽影 · 桌面布局。
//
// 参考 ReturnToDimCarcosa.hs（5 列 × 5 行）：
//   .             darkSpires      .
//   .             depthsOfDemhe   recessesOfYourOwnMind
//   dimStreets    palaceOfTheKing ruinsOfCarcosa
//   theThroneRoom bleakPlains     stageOfTheWardTheatre
//   .             shoresOfHali    .
// 三个新地点在场景中途由 52060b 置入；坐标按参考布局预留位置。
import { layoutFor } from '../../../../scenario-manifest.js'
import { scenario } from './definition.js'

export const layout = layoutFor(scenario, {
  darkSpires: { x: 1, y: 0 },
  depthsOfDemhe: { x: 1, y: 1 },
  recessesOfYourOwnMind: { x: 3, y: 1 },
  dimStreets: { x: 0, y: 2 },
  palaceOfTheKing: { x: 1, y: 2 },
  ruinsOfCarcosa: { x: 2, y: 2 },
  theThroneRoom: { x: 0, y: 3 },
  bleakPlains: { x: 1, y: 3 },
  stageOfTheWardTheatre: { x: 2, y: 3 },
  shoresOfHali: { x: 1, y: 4 },
})
