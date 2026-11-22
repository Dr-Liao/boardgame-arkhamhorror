import { layoutFor } from '../../../../scenario-manifest.js'
import { scenario } from './definition.js'

// 村庄环：公共空地在中央，5 个地点在外圈；隐藏密室在右侧。
export const layout = layoutFor(scenario, {
  location51033: { x: 2, y: 1 },
  location02202: { x: 0, y: 1 },
  location02204: { x: 1, y: 0 },
  location02206: { x: 3, y: 0 },
  location02208: { x: 4, y: 1 },
  location02210: { x: 1, y: 2 },
  location02212: { x: 3, y: 2 },
  location02214: { x: 5, y: 1 },
})
