import { layoutFor } from '../../../../scenario-manifest.js'
import { scenario } from './definition.js'

// 符号地图：遗迹入口在左，古代石厅/华美石室分列上下，遗迹深处向右，
// 时间石室在最右端（Act 2 的「科学与魔法」会把它们排成一条直线）。
const coordinates = {
  entryway: { x: 0, y: 2 },
  ancientHall: { x: 2, y: 1 },
  grandChamber: { x: 2, y: 3 },
  undergroundRuins: { x: 4, y: 1 },
  burialPit: { x: 4, y: 3 },
  secretPassage: { x: 6, y: 1 },
  chamberOfTime: { x: 8, y: 2 },
}

export const layout = layoutFor(scenario, coordinates)
