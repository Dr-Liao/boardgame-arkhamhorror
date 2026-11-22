// 重返地底噬魔 · 桌面坐标。
//
// 参考 ReturnToTheDevourerBelow.hs 的 5×3 网格：mainPath 与 ritualSite 固定在中列，
// 阿卡姆密林分布在两侧列（woods1–woods4 四个格位由 10 张密林候选共用；每局只有 4 张入场）。
// 坐标只服务展示：连接关系在 definition.LOCATION_TABLE 里按印刷文本声明。
import { layoutFor } from '../../../../scenario-manifest.js'
import { scenario, LOCATION_COORDINATES } from './definition.js'

export const layout = layoutFor(scenario, LOCATION_COORDINATES)

export const CONNECTIONS = Object.freeze(Object.fromEntries(
  Object.values(scenario.locations).map(location => [location.id, [...location.connections]]),
))
