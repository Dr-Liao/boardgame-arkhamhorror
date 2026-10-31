// 神居之所（Where the Gods Dwell · 06286）· 地点摆位（UI 投影用；规则连线只由 definition 的 connections 派生）。
//
// 参考实现地图（WhereTheGodsDwell.hs:52-56）：
//   .               plateauOfLeng  .
//   monasteryOfLeng coldWastes     .
//   .               onyxGates      theOnyxCastle
// 每个地点在印刷格上占一格宽、两格高，所以坐标翻倍。
// 6 座「被遗忘的高塔」由 act 3 背面随机抽 4 座、环绕大礼堂摆放（N/E/S/W）；
// 静态布局给 6 个槽位（4 个主位 + 2 个备用位），运行时方向记在 scenarioFlags.towerCompass。
import { layoutFor } from '../../../../scenario-manifest.js'
import { scenario, FORSAKEN_TOWERS } from './definition.js'

const coordinates = {
  plateauOfLeng: { x: 2, y: 0 },
  monasteryOfLeng: { x: 0, y: 2 },
  coldWastes: { x: 2, y: 2 },
  onyxGates: { x: 2, y: 4 },
  theOnyxCastle: { x: 4, y: 4 },
  // 4 个主位（北 / 东 / 南 / 西）+ 2 个备用位（未被抽中的塔在地图上不显示）。
  [FORSAKEN_TOWERS[0].id]: { x: 4, y: 0 },
  [FORSAKEN_TOWERS[1].id]: { x: 8, y: 4 },
  [FORSAKEN_TOWERS[2].id]: { x: 4, y: 8 },
  [FORSAKEN_TOWERS[3].id]: { x: 0, y: 4 },
  [FORSAKEN_TOWERS[4].id]: { x: 6, y: 0 },
  [FORSAKEN_TOWERS[5].id]: { x: 6, y: 8 },
}

export const layout = layoutFor(scenario, coordinates)
