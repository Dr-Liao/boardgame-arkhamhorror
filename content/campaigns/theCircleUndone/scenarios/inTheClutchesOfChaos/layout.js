// 《混沌魔掌》· 阿卡姆地图展示坐标（只做摆放，规则连线在 definition 的符号图里）。
// 印刷地图（Haskell scenario 顶部三行）：
//   行 0：商人区、河岸城
//   行 1：绞刑者山丘、住宅区、南区、法兰西山、银暮秘社
//   行 2：南区教堂
import { layoutFor } from '../../../../scenario-manifest.js'
import { scenario } from './definition.js'

const coordinates = {
  // 同名地点两个版本共用坐标：一局只会放其中一个，不重叠。
  merchantDistrictA: { x: 3, y: 0 },
  merchantDistrictB: { x: 3, y: 0 },
  rivertownA: { x: 5, y: 0 },
  rivertownB: { x: 5, y: 0 },
  hangmansHillMusic: { x: 0, y: 1 },
  hangmansHillSecrets: { x: 0, y: 1 },
  uptownA: { x: 2, y: 1 },
  uptownB: { x: 2, y: 1 },
  southsideA: { x: 4, y: 1 },
  southsideB: { x: 4, y: 1 },
  frenchHillA: { x: 6, y: 1 },
  frenchHillB: { x: 6, y: 1 },
  silverTwilightMusic: { x: 8, y: 1 },
  silverTwilightSecrets: { x: 8, y: 1 },
  southChurchA: { x: 4, y: 2 },
  southChurchB: { x: 4, y: 2 },
}

export const layout = layoutFor(scenario, coordinates)
