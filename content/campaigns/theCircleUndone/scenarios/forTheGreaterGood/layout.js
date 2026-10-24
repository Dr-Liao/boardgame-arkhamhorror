import { layoutFor } from '../../../../scenario-manifest.js'
import { scenario, LOCATIONS } from './definition.js'

// 参考实现 scenario 的 ASCII 地图（ForTheGreaterGood.hs:44-49）：
//   .       .      lodgeGates .              .
//   .       lobby  .          lodgeCellar    .
//   library lounge .          lodgeCatacombs sanctumDoorway1
//   .       vault  .          innerSanctum   sanctumDoorway2
// 每个地点在印刷格上占一格宽、两格高，因此纵向坐标翻倍。
// 「我们一直在等你」版本与「秘社成员方可入内」版本是同一格位的替代版本，共用坐标。
const coordinates = {
  [LOCATIONS.lodgeGatesMembers]: { x: 2, y: 0 },
  [LOCATIONS.lodgeGatesWeve]: { x: 2, y: 0 },
  [LOCATIONS.lobbyMembers]: { x: 1, y: 2 },
  [LOCATIONS.lobbyWeve]: { x: 1, y: 2 },
  [LOCATIONS.lodgeCellarMembers]: { x: 3, y: 2 },
  [LOCATIONS.lodgeCellarWeve]: { x: 3, y: 2 },
  [LOCATIONS.library]: { x: 0, y: 4 },
  [LOCATIONS.lounge]: { x: 1, y: 4 },
  [LOCATIONS.lodgeCatacombs]: { x: 3, y: 4 },
  [LOCATIONS.sanctumDoorwayCeremony]: { x: 4, y: 4 },
  [LOCATIONS.vault]: { x: 1, y: 6 },
  [LOCATIONS.innerSanctum]: { x: 3, y: 6 },
  [LOCATIONS.sanctumDoorwayHolding]: { x: 4, y: 6 },
}

export const layout = layoutFor(scenario, coordinates)
