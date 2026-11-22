// 重返聚集于此 · 桌面坐标。
//
// 坐标只服务展示：连接关系在 definition.LOCATION_TABLE 里按印刷图标声明。
// 阁楼/地窖的两种版本共用一个格位（Setup 只会有其中一张在场）。
import { layoutFor } from '../../../../scenario-manifest.js'
import { scenario, LOCATION_COORDINATES } from './definition.js'

export const layout = layoutFor(scenario, LOCATION_COORDINATES)

export const CONNECTIONS = Object.freeze(Object.fromEntries(
  Object.values(scenario.locations).map(location => [location.id, [...location.connections]]),
))
