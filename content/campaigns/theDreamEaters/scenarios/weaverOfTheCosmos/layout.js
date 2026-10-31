// 《编织宇宙》（Weaver of the Cosmos，06333）· 布局
//
// 巨网在参考实现里分两张盘面：
//   幕 1：4 张 The Great Web 纵向一排（theGreatWeb1 顶 → theGreatWeb4 底）；
//   幕 1 背面之后：只保留最下方 1 张，再放 7 张组成 8 段环（theGreatWeb4 顶中，顺时针 5…11）。
// 静态布局把两套位置都画出来（1–3 在环上方一列；4–11 是环）。运行时由 behavior.actLeftPlay
// 移除 1–3 并把 4 移到环顶；引擎不要求布局随台面变化而重排。
import { layoutFor } from '../../../../scenario-manifest.js'
import { scenario } from './definition.js'

const coordinates = {
  // 幕 1 的纵向链（位于环的上方）。
  theGreatWeb1: { x: 0, y: -6 },
  theGreatWeb2: { x: 0, y: -4 },
  theGreatWeb3: { x: 0, y: -2 },
  // 幕 2-3 的 8 段环（顺时针：4 顶中 → 5 → 6 → 7 → 8 → 9 → 10 → 11）。
  theGreatWeb4: { x: 0, y: 0 },
  theGreatWeb5: { x: 2, y: 0 },
  theGreatWeb6: { x: 3, y: 2 },
  theGreatWeb7: { x: 2, y: 4 },
  theGreatWeb8: { x: 0, y: 4 },
  theGreatWeb9: { x: -2, y: 4 },
  theGreatWeb10: { x: -3, y: 2 },
  theGreatWeb11: { x: -2, y: 0 },
}

export const layout = layoutFor(scenario, coordinates)
