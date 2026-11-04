// 暗潮之下（Into the Maelstrom · 07311）· 桌面坐标。
//
// chapter-data.json#intoTheMaelstrom.setup：
//   · initialLocations：通往伊哈·恩斯雷的「门户」07320 起点在 (0,0)；
//   · initialRandomLocations：8 个随机格（-1..1 的环形格）按牌池（两张黑暗深渊
//     07319、两张水下洞窟 07102、两张潮汐水池 07103、两张地下河 07104）确定性放满；
//   · setup.connections 说明真实连接是「上下左右四邻」（正交、不含对角、不走印刷
//     符号），属于运行时地图规则，布局只负责展示位置。
// 其余开局放在一边的地点（圣堂、海德拉/达贡巢穴等）用确定性蛇形补全。
import { place, finishCoordinates } from '../../layout.js'
import { chapterData } from '../../chapter-definition.js'

const chapterId = 'intoTheMaelstrom'
const spec = chapterData[chapterId]
const setup = spec.setup
const map = {}

for (const location of setup.initialLocations) place(map, location.physicalId, [location.position.column, location.position.row])

// 8 个随机格 → 8 张物理地点（同卡多副本按 locationInventory 展开）。
const inventory = new Map(setup.locationInventory.map(item => [item.printedCode, item.physicalIds]))
const randomPool = setup.initialRandomLocations.pool.flatMap(item => (inventory.get(item.printedCode) || []).slice(0, item.count))
setup.initialRandomLocations.slots.forEach((slot, index) => place(map, randomPool[index] || `randomSlot${index}`, slot))

export const coordinates = finishCoordinates(chapterId, map)
