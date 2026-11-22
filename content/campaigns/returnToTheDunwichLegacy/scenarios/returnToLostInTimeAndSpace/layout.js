import { layoutFor } from '../../../../scenario-manifest.js'
import { scenario } from './definition.js'

// 参考布局为 11 列大网格；这里取紧凑版：遭遇地点环绕另一个次元。
export const layout = layoutFor(scenario, {
  location51057: { x: 2, y: 0 },
  location02324: { x: 0, y: 0 }, location02325: { x: 1, y: 0 },
  location51060: { x: 3, y: 0 }, location51059: { x: 4, y: 0 },
  location02320: { x: 2, y: 1 },
  location02326: { x: 0, y: 1 }, location02327: { x: 1, y: 1 },
  location51058: { x: 3, y: 1 }, location02328: { x: 4, y: 1 },
  location02321: { x: 1, y: 2 }, location02322: { x: 3, y: 2 },
})
