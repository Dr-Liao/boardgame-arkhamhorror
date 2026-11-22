// 《时间阴谋》· 桌面坐标（三时代三列：过去/现在/未来；廷达洛斯居中下方）。
import { layoutFor } from '../../../../scenario-manifest.js'
import { scenario } from './definition.js'

export const layout = layoutFor(scenario, {
  arkhamGazette: { x: 0, y: 0 }, miskatonicUniversityPast: { x: 1, y: 0 },
  oMalleysWatchShop: { x: 0, y: 1 }, riverDocksPast: { x: 0, y: 2 }, childhoodHome: { x: 1, y: 3 },
  arkhamAdvertiserPresent: { x: 2, y: 0 }, miskatonicUniversityPresent: { x: 3, y: 0 },
  yeOldeMagickShoppe: { x: 3, y: 3 }, tickTockClubPresent: { x: 2, y: 1 }, riverDocksPresent: { x: 2, y: 2 },
  arkhamAdvertiserFuture: { x: 4, y: 0 }, miskatonicUniversityFuture: { x: 5, y: 0 },
  tickTockClubFuture: { x: 4, y: 1 }, riverDocksFuture: { x: 4, y: 2 }, corriganIndustries: { x: 5, y: 3 },
  tindalos: { x: 2, y: 4 },
})
