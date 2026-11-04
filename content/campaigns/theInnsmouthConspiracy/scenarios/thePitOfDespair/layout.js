// 绝望深坑（The Pit of Despair · 07041）· 桌面坐标。
//
// 真实设置几何来自 chapter-data.json#thePitOfDespair.setup：
//   · grid.07047 = [0,0]，起始地点「绝望深坑」固定在场；
//   · adjacentInitialPositions = [[-1,0],[1,0],[0,-1]]，开局随机三条潮汐隧道
//     会落在这三个相邻格；
//   · 其余「退潮后才会展开」的隧道地点用确定性蛇形补全，保证每张物理地点卡
//     都有有限坐标。坐标只在桌面展示层使用，规则连接仍由各章 setup 在运行时写入。
import { place, finishCoordinates } from '../../layout.js'
import { chapterData } from '../../chapter-definition.js'

const chapterId = 'thePitOfDespair'
const spec = chapterData[chapterId]
const map = {}

// 起始地点与三个相邻的随机隧道槽位（真实 setup 几何）。
place(map, spec.startLocation, spec.setup.grid[spec.startLocation] || [0, 0])
const tunnelPool = spec.setup.randomTunnelPhysicalPool
spec.setup.adjacentInitialPositions.forEach((slot, index) => place(map, tunnelPool[index], slot))

export const coordinates = finishCoordinates(chapterId, map)
