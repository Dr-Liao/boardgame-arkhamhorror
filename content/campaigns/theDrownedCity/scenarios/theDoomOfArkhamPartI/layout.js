// 阿卡姆的毁灭 第一部分 · 桌面坐标。
//
// 午夜假面地图按参考布局落在 3 列 × 4 行网格（northside/downtown/easttown 一行，
// miskatonic/rivertown 一行，stMarys/southside 一行）；幽灵商店给出一个确定性展示槽位，
// 实际入场时由 behavior.placeShop 放在被抽出的地点相邻处并动态建连。
import { layoutFor } from '../../../../scenario-manifest.js'
import { scenario, LOCATION_COORDINATES } from './definition.js'

export const layout = layoutFor(scenario, LOCATION_COORDINATES)
