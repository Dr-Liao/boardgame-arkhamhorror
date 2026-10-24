import { layoutFor } from '../../../../scenario-manifest.js'
import { scenario } from './definition.js'

// 参考实现 scenario 的 ASCII 地图（UnionAndDisillusion.hs:52-58）：
//   .              miskatonicRiver .
//   unvisitedIsle3 forbiddingShore unvisitedIsle4
//   unvisitedIsle1 .               unvisitedIsle2
//   unvisitedIsle5 theGeistTrap    unvisitedIsle6
// 每个地点占一格宽、两格高，因此纵向坐标翻倍。
const coordinates = {
  miskatonicRiver: { x: 1, y: 0 },
  forsakenWoods: { x: 0, y: 2 },      // unvisitedIsle3
  forbiddingShore: { x: 1, y: 2 },
  mossCoveredSteps: { x: 2, y: 2 },   // unvisitedIsle4
  standingStones: { x: 0, y: 4 },     // unvisitedIsle1
  mistyClearing: { x: 2, y: 4 },      // unvisitedIsle2
  hauntedSpring: { x: 0, y: 6 },      // unvisitedIsle5
  geistTrap: { x: 1, y: 6 },
  decayedWillow: { x: 2, y: 6 },      // unvisitedIsle6
}

export const layout = layoutFor(scenario, coordinates)
