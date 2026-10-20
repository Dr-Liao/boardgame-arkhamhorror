import { layoutFor } from '../../../../scenario-manifest.js'
import { scenario } from './definition.js'

// 印刷地图是一张 6×5 的符号图：外圈是「＝ / 三角 / 菱形 / 方形 / 水滴 / 波浪 /
// 心形 / 圆形」，中间斜着摆「沙漏 / T 字」。这里按印刷相对位置摆放（x 拉宽一倍，
// 免得连线互相压住），y 轴向上为正。
const coordinates = {
  stepsOfYoth: { x: 0, y: 4 },
  hallOfHeresy: { x: 0, y: 1 },
  cityOfTheSerpents: { x: 2, y: 5 },
  abandonedSite: { x: 2, y: 0 },
  forkedPath: { x: 4, y: 2 },
  crumblingPrecipice: { x: 6, y: 3 },
  cavernsOfYoth: { x: 8, y: 5 },
  brokenPassage: { x: 8, y: 0 },
  bridgeOverNKai: { x: 10, y: 4 },
  brightCanyon: { x: 10, y: 1 },
}

export const layout = layoutFor(scenario, coordinates)
