// 梦境门外（Beyond the Gates of Sleep · 06039）· 桌面坐标。
//
// 参考 BeyondTheGatesOfSleep.hs:2139-2146 的地图（每格宽 2、高 2）：
//   .               seventySteps      .
//   .               .                 theCavernOfFlame
//   .               sevenHundredSteps .
//   .               .                 baseOfTheSteps
//   enchantedWoods1 theEnchantedPath enchantedWoods2
//   enchantedWoods3 .                enchantedWoods4
//   enchantedWoods5 .                enchantedWoods6
// 7 张「魔幻森林」里随机 6 张入场、1 张移出游戏；地图给 7 张各自固定格（第 7 张放在右下外侧）。
import { layoutFor } from '../../../../scenario-manifest.js'
import { scenario, WOODS } from './definition.js'

const coordinates = {
  seventySteps: { x: 2, y: 0 },
  cavernOfFlame: { x: 4, y: 2 },
  sevenHundredSteps: { x: 2, y: 4 },
  baseOfTheSteps: { x: 4, y: 6 },
  [WOODS[0].id]: { x: 0, y: 8 },
  theEnchantedPath: { x: 2, y: 8 },
  [WOODS[1].id]: { x: 4, y: 8 },
  [WOODS[2].id]: { x: 0, y: 10 },
  [WOODS[3].id]: { x: 4, y: 10 },
  [WOODS[4].id]: { x: 0, y: 12 },
  [WOODS[5].id]: { x: 4, y: 12 },
  [WOODS[6].id]: { x: 6, y: 12 },
}

export const layout = layoutFor(scenario, coordinates)
