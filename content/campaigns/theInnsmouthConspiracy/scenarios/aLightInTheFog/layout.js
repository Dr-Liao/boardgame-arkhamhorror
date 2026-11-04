// 雾中之光（A Light in the Fog · 07231）· 桌面坐标。
//
// chapter-data.json#aLightInTheFog.setup 提供完整灯塔地图：
//   · initialLocations：五个初始地点各自的 {column,row}；
//   · expandedMap.fixed：沉没洞窟上/中/下三段固定格；
//   · expandedMap.randomSlots：9 个随机格，按 `deal` 把随机池（07247–07251、
//     两张水下洞窟 07102、两张潮汐水池 07103，共 9 张物理卡）一卡一格放满；
//   · holdingCells 07252b 显示在 (5,1)。
// 随机格用确定性顺序填满（真实对局随机，桌面位置只需稳定展示）。
import { place, finishCoordinates } from '../../layout.js'
import { chapterData } from '../../chapter-definition.js'

const chapterId = 'aLightInTheFog'
const spec = chapterData[chapterId]
const setup = spec.setup
const map = {}

for (const location of setup.initialLocations) place(map, location.physicalId, [location.position.column, location.position.row])
for (const location of setup.expandedMap.fixed) place(map, location.physicalId, [location.position.column, location.position.row])
place(map, setup.expandedMap.holdingCells.code, [setup.expandedMap.holdingCells.displayPosition.column, setup.expandedMap.holdingCells.displayPosition.row])

// 随机潮汐隧道牌池 → 物理卡号（含同名副本），按随机格声明顺序一卡一格。
const inventory = new Map(setup.locationInventory.map(item => [item.printedCode, item.physicalIds]))
const randomPool = setup.expandedMap.randomPool.flatMap(item => (inventory.get(item.printedCode) || []).slice(0, item.count))
setup.expandedMap.randomSlots.forEach((slot, index) => place(map, randomPool[index] || `randomPool${index}`, slot))

export const coordinates = finishCoordinates(chapterId, map)
