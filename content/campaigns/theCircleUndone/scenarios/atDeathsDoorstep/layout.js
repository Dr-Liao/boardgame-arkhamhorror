import { layoutFor } from '../../../../scenario-manifest.js'
import { scenario } from './definition.js'

// 展示坐标：Haskell 顶部地图（每个地点占一列、上下两行）
//   .             .          office        .             .
//   billiardsRoom trophyRoom victorianHalls masterBedroom balcony
//   .             .          entryHall     .             .
// 纵向坐标按「行 × 2」放大，与 TFA 的布局约定一致。
const coordinates = {
  billiardsRoom: { x: 0, y: 4 },
  trophyRoom: { x: 2, y: 4 },
  victorianHalls: { x: 4, y: 4 },
  masterBedroom: { x: 6, y: 4 },
  balcony: { x: 8, y: 4 },
  office: { x: 4, y: 2 },
  entryHall: { x: 4, y: 6 },
}

export const layout = layoutFor(scenario, coordinates)
