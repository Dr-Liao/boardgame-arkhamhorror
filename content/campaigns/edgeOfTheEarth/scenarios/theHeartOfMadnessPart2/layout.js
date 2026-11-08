// 疯狂之心 第 II 部分 · 地图：与第 I 部分同一张三环五辐布局（槽位坐标复用 Part I 的 MAP_COORDINATES）。
import { layoutFor } from '../../../../scenario-manifest.js'
import { MAP_COORDINATES } from '../theHeartOfMadnessPart1/layout.js'
import { scenario } from './definition.js'

export const layout = layoutFor(scenario, MAP_COORDINATES)
