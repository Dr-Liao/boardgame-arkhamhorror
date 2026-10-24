// 《黑色王座》· 宇宙展示坐标（放射状近似：四个枢纽一条主链，12 张宇宙地点环绕）。
// 真正的规则连线由 behavior.placeCosmosLocation 按「宇宙 -」放置指令表动态建立；
// 这里只决定静态地图上卡牌的位置（避免 16 个地点重叠）。
import { layoutFor } from '../../../../scenario-manifest.js'
import { scenario } from './definition.js'

const coordinates = {
  cosmicIngress: { x: 0, y: 0 },
  hideousPalace: { x: 2, y: 0 },
  courtOfTheGreatOldOnes: { x: 4, y: 0 },
  theBlackThrone: { x: 6, y: 0 },
  cosmicGate: { x: 0, y: 2 },
  dancersMist1: { x: 2, y: 2 },
  dancersMist2: { x: 3, y: 2 },
  dancersMist3: { x: 4, y: 2 },
  flightIntoOblivion1: { x: 2, y: -2 },
  flightIntoOblivion2: { x: 3, y: -2 },
  flightIntoOblivion3: { x: 4, y: -2 },
  infinityOfDarkness1: { x: 0, y: -2 },
  infinityOfDarkness2: { x: 1, y: -2 },
  infinityOfDarkness3: { x: 1, y: 2 },
  pathwayIntoVoid1: { x: 5, y: 2 },
  pathwayIntoVoid2: { x: 6, y: 2 },
}

export const layout = layoutFor(scenario, coordinates)
