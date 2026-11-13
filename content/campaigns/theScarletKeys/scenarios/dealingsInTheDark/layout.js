// 暗中交易 · 地图（参考 Scenarios/TheScarletKeys/DealingsInTheDark.hs 的 PlaceInGrid 坐标）。
//
// 场景 1：四个起始地点按十字排布（加拉塔在左，圣索菲亚在右，方尖碑在上，大学在下），
// 连接由印刷连接符号给出（definition.js 的 connections）；本文件只给展示坐标。
//
//      .   方尖碑  .
//   加拉塔  .   圣索菲亚
//      .   大学    .
//
// 场景 2：七张大巴扎洗混后随机抽 6 张，按「揭示的混乱标记」对应的图形摆进行列（参考 Act 1b 的
// 5 套图形：每个图形的第 1 格是入口、eastGate 是东门）。图形数据在这里，布置由 behavior.js 执行
//（引擎没有「按图形摆放」原语，P8 的桌面投影可直接读 BAZAAR_DIAGRAMS）。
import { scenario } from './definition.js'
import { layoutFor } from '../../../../scenario-manifest.js'

// 场景 1 的展示坐标：x 向右、y 向下。
const coordinates = {
  obeliskOfTheodosius: { x: 1, y: 0 },
  galata: { x: 0, y: 1 },
  hagiaSophia: { x: 2, y: 1 },
  istanbulUniversity: { x: 1, y: 2 },
}

// 场景 2 的 5 套图形（参考实现按 token face 分支）：
//   key: 命中该组标记时使用的图形；positions 的顺序就是放牌顺序（第 1 格 = 入口）；
//   entrance 固定为第 1 格；eastGate 是该图的东门格。
export const BAZAAR_DIAGRAMS = Object.freeze([
  Object.freeze({
    id: 'negativeOdd',
    tokens: Object.freeze(['-1', '-3', '-5', '-7']),
    positions: Object.freeze([{ x: 1, y: 0 }, { x: 2, y: -1 }, { x: 2, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 1 }, { x: 4, y: 0 }]),
    eastGate: Object.freeze({ x: 4, y: 0 }),
  }),
  Object.freeze({
    id: 'skullOrPositive',
    tokens: Object.freeze(['skull', '+1', '0']),
    positions: Object.freeze([{ x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 1 }, { x: 4, y: 0 }, { x: 4, y: 1 }]),
    eastGate: Object.freeze({ x: 4, y: 1 }),
  }),
  Object.freeze({
    id: 'negativeEven',
    tokens: Object.freeze(['-2', '-4', '-6', '-8']),
    positions: Object.freeze([{ x: 1, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 1 }, { x: 3, y: 0 }, { x: 4, y: 0 }, { x: 4, y: -1 }]),
    eastGate: Object.freeze({ x: 4, y: -1 }),
  }),
  Object.freeze({
    id: 'symbol',
    tokens: Object.freeze(['cultist', 'tablet', 'elderthing']),
    positions: Object.freeze([{ x: 1, y: 0 }, { x: 2, y: -1 }, { x: 2, y: 0 }, { x: 3, y: -1 }, { x: 3, y: 0 }, { x: 3, y: 1 }]),
    eastGate: Object.freeze({ x: 3, y: 1 }),
  }),
  Object.freeze({
    id: 'default',
    tokens: Object.freeze([]),
    positions: Object.freeze([{ x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 1 }, { x: 4, y: 2 }]),
    eastGate: Object.freeze({ x: 4, y: 2 }),
  }),
])

/** 按混乱标记取图形；未命中任何一组时用默认图形（参考实现的 otherwise 分支）。 */
export function bazaarDiagramFor(token) {
  const face = String(token ?? '').toLowerCase()
  return BAZAAR_DIAGRAMS.find(diagram => diagram.tokens.includes(face))
    || BAZAAR_DIAGRAMS.find(diagram => diagram.id === 'default')
}

/** 图形里两格是否共边相邻（只共角不算）。 */
export function isSideAdjacent(a, b) {
  if (!a || !b) return false
  return (a.x === b.x && Math.abs(a.y - b.y) === 1) || (a.y === b.y && Math.abs(a.x - b.x) === 1)
}

export const layout = layoutFor(scenario, coordinates)
export const MAP_COORDINATES = Object.freeze(coordinates)
