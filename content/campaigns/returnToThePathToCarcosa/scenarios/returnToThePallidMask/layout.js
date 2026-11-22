// 重返苍白面具 · 桌面布局（地下墓穴网格由 behavior 动态生成，基础章同样按网格占位）。
import { layoutFor } from '../../../../scenario-manifest.js'
import { scenario } from './definition.js'

export const layout = layoutFor(scenario, Object.fromEntries(
  Object.keys(scenario.locations).map((id, index) => [
    id,
    { x: index % 8, y: Math.floor(index / 8) },
  ]),
))
