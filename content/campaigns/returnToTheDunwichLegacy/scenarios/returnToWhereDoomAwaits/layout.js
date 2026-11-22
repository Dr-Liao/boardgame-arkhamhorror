import { layoutFor } from '../../../../scenario-manifest.js'
import { scenario } from './definition.js'

// 参考布局：三行——分岔路 / 山脚·山路·哨兵峰 / 迷幻小路。
export const layout = layoutFor(scenario, {
  location02285: { x: 0, y: 0 }, location02286: { x: 1, y: 0 }, location02287: { x: 2, y: 0 },
  location02288: { x: 3, y: 0 }, location51050: { x: 4, y: 0 },
  location02282: { x: 0, y: 1 }, location02283: { x: 1, y: 1 }, location02284: { x: 2, y: 1 },
  location51048: { x: 0, y: 1 }, location51049: { x: 1, y: 1 },
  location02289: { x: 0, y: 2 }, location02290: { x: 1, y: 2 }, location02291: { x: 2, y: 2 },
  location02292: { x: 3, y: 2 }, location51051: { x: 4, y: 2 },
})
