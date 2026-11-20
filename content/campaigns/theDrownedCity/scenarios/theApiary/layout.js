// 养育场 · 桌面坐标。
//
// 真实坐标取 Scenarios/TheDrownedCity/TheApiary/Helpers.hs#apiaryPositions（养育场入口 (0,0)
// 为中心：增生原野在其上、隐藏秘库再上一层；两张血肉道路左右；环位在下方的巢穴/飞地）。
// 东西两套环位变体共用同一格（同一局只会有一套在玩），中央腔室位于环心。
// 规则连接由印刷符号双向匹配（definition.LOCATION_CONNECTIONS）；中央腔室只与
// 「面朝」的环位相连，运行时由 behavior 写入动态连接，因此它的静态 connections 为空。
import { layoutFor } from '../../../../scenario-manifest.js'
import { scenario, LOCATION_COORDINATES } from './definition.js'

export const layout = layoutFor(scenario, LOCATION_COORDINATES)

// 蜂巢思维幕的重排：4 个环位（顺时针：酸性体腔 → 攫噬长廊 → 饥渴长廊 → 养育场入口）。
export const HIVE_MIND_RING = Object.freeze([
  'acidicCoelom', 'graspingCorridor', 'starvingCorridor', 'apiaryEntrance',
])
