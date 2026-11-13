// 不留痕迹（Without a Trace · 09681）· 桌面坐标。
//
// 参考布局：域外来客之廷在左上角 (0,0)，周围四个空位摆隐匿迷你卡；异界牌库/阴影中的地点没有
// 固定桌面坐标（第一次揭露时才落位），这里给出一份静态展示坐标（牌库侧 2 列），
// 运行期仍以 `mechanicState.grid` 的坐标为准。坐标只为展示；规则连接来自网格正交邻接。
import { layoutFor } from '../../../../scenario-manifest.js'
import { scenario } from './definition.js'

const coordinates = {
  courtOfTheOutsiders: { x: 0, y: 0 },
  // 牌库侧（尚未放入网格时的展示位）。
  outsidersLair: { x: 3, y: 0 },
  cliffsOfInsanityA: { x: 4, y: 0 },
  cliffsOfInsanityB: { x: 5, y: 0 },
  ramblingRouteA: { x: 7, y: 0 },
  ramblingRouteB: { x: 8, y: 0 },
  ramblingRouteC: { x: 9, y: 0 },
  alienFrontierA: { x: 7, y: 2 },
  alienFrontierB: { x: 8, y: 2 },
  wealdOfEffigiesA: { x: 9, y: 2 },
  wealdOfEffigiesB: { x: 10, y: 2 },
}

export const layout = layoutFor(scenario, coordinates)
