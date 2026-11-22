// 《疯狂迷宫》· 桌面坐标（参考 .hs 的 Group B / C / A 布局取并集，展示用）。
import { layoutFor } from '../../../../scenario-manifest.js'
import { scenario } from './definition.js'

export const layout = layoutFor(scenario, {
  chamberOfRain: { x: 1, y: 0 }, chamberOfSecrets: { x: 2, y: 0 }, chamberOfNight: { x: 3, y: 0 },
  chamberOfSorrows: { x: 1, y: 1 }, chamberOfRegret: { x: 3, y: 1 },
  labyrinthineHalls1: { x: 0, y: 2 }, labyrinthineHalls2: { x: 1, y: 2 }, labyrinthineHalls3: { x: 2, y: 2 },
  chamberOfDecay: { x: 0, y: 3 }, chamberOfRot: { x: 1, y: 3 }, chamberOfHunger: { x: 2, y: 3 },
  chamberOfPoison: { x: 1, y: 4 }, abandonedWarehouse: { x: 1, y: 5 },
  chamberOfSecretsMysterious: { x: 2, y: 0 }, chamberOfSecretsEnshrouded: { x: 2, y: 0 },
})
