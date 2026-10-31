// 寻觅卡达斯（The Search for Kadath · 06119）· 地点布局。
//
// 来源：Haskell `Scenario/Scenarios/TheDreamEaters/TheSearchForKadath.hs:50-55` 的 5×6 地图文本。
// 每个地点一格；这里把 5 行 × 6 列文本坐标 ×2 转成 UI 坐标。
// 未入场的地点（区域设置才放进来的 14 处）也全部给坐标，保证 layout 覆盖全部地点。
import { layoutFor } from '../../../../scenario-manifest.js'
import { scenario } from './definition.js'

// Haskell 地图（行 × 列）：
//   .             baharna        ulthar    .           serannian  .
//   namelessRuins mtNgranek      skaiRiver dylathLeen  celephais  cityWhichAppearsOnNoMap
//   .             .              sarnath   kadatheron  hazuthKleg templeOfUnattainableDesires
//   .             .              ruinsOfIb .           .          .
//   zulanThek     forbiddenLands ilekVad   .           .          .
const GRID = {
  baharna: { row: 0, column: 1 },
  ulthar: { row: 0, column: 2 },
  serannian: { row: 0, column: 4 },
  namelessRuins: { row: 1, column: 0 },
  mtNgranek: { row: 1, column: 1 },
  skaiRiver: { row: 1, column: 2 },
  dylathLeen: { row: 1, column: 3 },
  celephais: { row: 1, column: 4 },
  cityWhichAppearsOnNoMap: { row: 1, column: 5 },
  sarnath: { row: 2, column: 2 },
  kadatheron: { row: 2, column: 3 },
  hazuthKleg: { row: 2, column: 4 },
  templeOfUnattainableDesires: { row: 2, column: 5 },
  ruinsOfIb: { row: 3, column: 2 },
  zulanThek: { row: 4, column: 0 },
  forbiddenLands: { row: 4, column: 1 },
  ilekVad: { row: 4, column: 2 },
}

const CELL = { width: 2, height: 2 }

const coordinates = Object.fromEntries(Object.entries(GRID).map(([id, cell]) => [
  id, { x: cell.column * CELL.width, y: cell.row * CELL.height },
]))

// 启动时校验 layout 覆盖全部地点（缺地点会在 assertUiLayout 里报错）。
for (const id of Object.keys(scenario.locations)) {
  if (!coordinates[id]) throw new Error(`theSearchForKadath 布局缺少地点坐标：${id}`)
}

export const layout = layoutFor(scenario, coordinates)
