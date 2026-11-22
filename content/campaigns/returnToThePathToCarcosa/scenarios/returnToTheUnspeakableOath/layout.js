// 重返邪秽誓约 · 桌面布局。
//
// 参考 ReturnToTheUnspeakableOath.hs（10 列 × 5 行）：
//   garden 在最上排右侧；病房走廊东西各一（168/169 与 170/171 二选一）；
//   kitchen/messHall/yard 在第三行；四间病人拘禁室排在底层。
import { layoutFor } from '../../../../scenario-manifest.js'
import { scenario } from './definition.js'

export const layout = layoutFor(scenario, {
  garden: { x: 4, y: 0 },
  yard: { x: 4, y: 1 },
  kitchen: { x: 0, y: 2 },
  messHall: { x: 2, y: 2 },
  westernHall168: { x: 4, y: 2 },
  westernHall169: { x: 4, y: 2 },
  easternHall170: { x: 6, y: 2 },
  easternHall171: { x: 6, y: 2 },
  infirmary: { x: 8, y: 2 },
  occupiedCell: { x: 4, y: 3 },
  basementHall: { x: 6, y: 3 },
  drearyCell: { x: 8, y: 3 },
  danielsCell: { x: 5, y: 4 },
  familiarCell: { x: 7, y: 4 },
})
