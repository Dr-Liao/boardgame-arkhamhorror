import { layoutFor } from '../../../../scenario-manifest.js'
import { scenario } from './definition.js'

// 符号地图（Haskell scenario 的 ASCII 布局）：
//   .      square diamond  .        .         .
//   circle square diamond  squiggle hourglass .
//   circle star   triangle squiggle hourglass .
//   .      star   triangle .        .         .
// 每个地点在印刷格上占一格宽、两格高，所以纵向坐标翻倍，横向保留列序。
const coordinates = {
  entryway: { x: 0, y: 2 },          // circle
  ancientHall: { x: 2, y: 0 },       // square
  grandChamber: { x: 2, y: 4 },      // star
  undergroundRuins: { x: 4, y: 0 },  // diamond
  burialPit: { x: 4, y: 4 },         // triangle
  secretPassage: { x: 6, y: 2 },     // squiggle
  chamberOfTime: { x: 8, y: 2 },     // hourglass
}

export const layout = layoutFor(scenario, coordinates)
