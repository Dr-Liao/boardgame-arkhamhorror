// 万象无终 · 序章《暮色庄园失踪事件》· 展示布局。
//
// 坐标来自参考实现 Haskell 场景顶部的 ASCII 地图（DisappearanceAtTheTwilightEstate.hs:56-58）：
//   .             .          office         .             .
//   billiardsRoom trophyRoom victorianHalls masterBedroom balcony
//   .             .          entryHall      .             .
// 每个地点占一格；这里与 TFA 一样把格宽放大到 2，避免卡牌在桌面上重叠。
// 只做展示：规则连线由 definition.js 的印刷符号（linkSymbolLocations）决定。
import { layoutFor } from '../../../../scenario-manifest.js'
import { scenario } from './definition.js'

const coordinates = {
  office: { x: 4, y: 0 },
  billiardsRoom: { x: 0, y: 2 },
  trophyRoom: { x: 2, y: 2 },
  victorianHalls: { x: 4, y: 2 },
  masterBedroom: { x: 6, y: 2 },
  balcony: { x: 8, y: 2 },
  entryHall: { x: 4, y: 4 },
}

export const layout = layoutFor(scenario, coordinates)
