import { layoutFor } from '../../../../scenario-manifest.js'
import { scenario, WOODS, ARKHAM_WOODS } from './definition.js'

// Haskell 顶部地图（TheWitchingHour.hs:52-56）：
//   .      .     woods1  .      .
//   .      .     .       .      .
//   woods2 .     circle  .      woods3
//   .      .     .       .      .
//   .      wood4 .       woods5 .
// 每个地点在印刷格上占一格宽、两格高，所以纵向坐标翻倍；未被抽到的 2 张森林给到地图外。
const mapSlots = {
  [WOODS[0].id]: { x: 4, y: 0 },
  [WOODS[1].id]: { x: 0, y: 4 },
  [WOODS[2].id]: { x: 8, y: 4 },
  [WOODS[3].id]: { x: 2, y: 8 },
  [WOODS[4].id]: { x: 6, y: 8 },
  // 可能未入场的 2 张：放在地图右侧，动态重连时也不会与主图重叠。
  [WOODS[5].id]: { x: 11, y: 0 },
  [WOODS[6].id]: { x: 11, y: 4 },
  witchesCircle: { x: 4, y: 4 },
}

// 6 张阿卡姆密林只在 act1 背面被放到调查员面前（presentation 由运行时重排），
// 静态给一条右侧链，保证 layout ↔ connections 一致。
const woodsCoordinates = Object.fromEntries(ARKHAM_WOODS.map((entry, index) => [
  entry.id, { x: 14, y: index * 2 },
]))

const coordinates = { ...mapSlots, ...woodsCoordinates }

export const layout = layoutFor(scenario, coordinates)
