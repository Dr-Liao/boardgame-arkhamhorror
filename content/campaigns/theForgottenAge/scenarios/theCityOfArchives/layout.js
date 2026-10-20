import { layoutFor } from '../../../../scenario-manifest.js'
import { scenario } from './definition.js'

// 符号地图：按场景卡 04237 的 4×5 网格摆放，y 轴向上为负（与荒莽密林一致）。
// 会谈间在右列，纳克特之塔在西端，大图书馆在西南，实验室与解构室在北面。
const coordinates = {
  yithianOrrery: { x: 1, y: 0 },
  laboratory: { x: 2, y: 0 },
  deconstructionRoom: { x: 3, y: 0 },
  hallsNorthern: { x: 2, y: -1 },
  interviewRoom1: { x: 4, y: -1 },
  towersOfPnakotus: { x: 0, y: -2 },
  hallsWestern: { x: 1, y: -2 },
  hallsEastern: { x: 3, y: -2 },
  interviewRoom2: { x: 4, y: -2 },
  greatLibrary: { x: 1, y: -3 },
  interviewRoom3: { x: 4, y: -3 },
}

export const layout = layoutFor(scenario, coordinates)
