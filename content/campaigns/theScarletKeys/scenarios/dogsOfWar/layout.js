// 战争疮痍（Dogs of War · 09635）· 桌面坐标与展示连线。
//
// 参考实现 `Scenarios/TheScarletKeys/DogsOfWar.hs` 的四行地图（符号即地点卡左下角的连接符号）：
//
//   .        triangle .        equals   .
//   square   triangle star     equals   squiggle
//   square   circle   star     moon     squiggle
//   .        circle   .        moon     .
//
// 每张地点牌占两格高：theBourse=Square（第 0 列 1–2 行）、victoriaCollege=Triangle（第 1 列 0–1 行）、
// windsorPalaceHotel=Circle（第 1 列 2–3 行）、qaitbayCitadel=Star（第 2 列 1–2 行）、
// theCorniche=Equals（第 3 列 0–1 行）、zanEtElSettat=Moon（第 3 列 2–3 行）、
// catacombs=Squiggle（第 4 列 1–2 行）。坐标取每张牌的上半格。
//
// 本文件的 `edges` 只是**展示连线**，必须同时是 manifest 已声明的规则连接
// （`schema.js#assertUiLayout` 的口径）：这里直接由 definition 的印刷连接生成，不额外造边。
import { LOCATION_CONNECTIONS } from './definition.js'

export const SCENARIO_LAYOUT_COORDINATES = Object.freeze({
  theBourse: Object.freeze({ x: 0, y: 1 }),
  victoriaCollege: Object.freeze({ x: 1, y: 0 }),
  windsorPalaceHotel: Object.freeze({ x: 1, y: 2 }),
  qaitbayCitadel: Object.freeze({ x: 2, y: 1 }),
  theCorniche: Object.freeze({ x: 3, y: 0 }),
  zanEtElSettat: Object.freeze({ x: 3, y: 2 }),
  catacombs: Object.freeze({ x: 4, y: 1 }),
})

// 每条规则连接只画一次（按 id 排序去重）。
const edges = []
for (const [from, targets] of Object.entries(LOCATION_CONNECTIONS)) {
  for (const to of targets) {
    const pair = [from, to].sort()
    if (edges.some(edge => edge.from === pair[0] && edge.to === pair[1])) continue
    edges.push({ from: pair[0], to: pair[1] })
  }
}

export const layout = Object.freeze({
  locations: SCENARIO_LAYOUT_COORDINATES,
  edges: Object.freeze(edges.map(edge => Object.freeze({ ...edge }))),
})
