// 万千骇形 · 地点坐标（Haskell AThousandShapesOfHorror.hs:44-49 的印刷地图，每格一地点）。
//
//   stairs1  library  attic    bedroom
//   stairs2  .        hallway  .
//   stairs3  den      porch    parlor
//   stairs4  .        burial   tomb
//   stairs5  .        .        .
//   stairs6  (act1 背面洗混后取 5 张入场，剩 1 张移出游戏)
//
// 阶梯按 verticalIndex 纵列排布（布局只给坐标，连接由 behavior 用 api.verticalChain.link 建立）。
// `layoutFor` 只从 definition 的 connections 派生 edges；阶梯定义 connections 为空（入场的 5 张由链补连接）。
import { layoutFor } from '../../../../scenario-manifest.js'
import { scenario, STAIRS_IDS } from './definition.js'

const coordinates = {
  ...Object.fromEntries(STAIRS_IDS.map((id, index) => [id, { x: 0, y: index * 2 }])),
  library: { x: 2, y: 0 },
  attic: { x: 4, y: 0 },
  bedroom: { x: 6, y: 0 },
  upstairsHallway: { x: 4, y: 2 },
  den: { x: 2, y: 4 },
  frontPorchEntryway: { x: 4, y: 4 },
  parlor: { x: 6, y: 4 },
  burialGround: { x: 4, y: 6 },
  unmarkedTomb: { x: 6, y: 6 },
}

export const layout = layoutFor(scenario, coordinates)
export default layout
