// 疯星乱舞（Dancing Mad · 09591）· 桌面坐标。
//
// 参考布局：六处哈瓦那地点按印刷符号分成两排（北上南下），月下餐厅在最左侧起点。
// 坐标只为展示；规则连接一律来自 `definition.js` 的符号推导（`connections`）。
import { layoutFor } from '../../../../scenario-manifest.js'
import { scenario } from './definition.js'

const coordinates = {
  // 上排：餐厅 → 热带花园 → 大剧院
  cafeLuna: { x: 0, y: 0 },
  jardinesDeLaTropical: { x: 2, y: 0 },
  granTeatroDeLaHabana: { x: 4, y: 0 },
  // 下排：马赛奥大道 → 游艇俱乐部 → 广场酒店
  elMalecon: { x: 1, y: 2 },
  miramarYachtClub: { x: 3, y: 2 },
  plazaHotel: { x: 5, y: 2 },
}

export const layout = layoutFor(scenario, coordinates)
