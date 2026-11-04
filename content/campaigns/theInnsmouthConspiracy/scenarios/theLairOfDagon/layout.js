// 达贡巢穴（The Lair of Dagon · 07274）· 桌面坐标。
//
// chapter-data.json#theLairOfDagon.setup.layout 是印刷楼层表（3 行 × 3 列，
// 槽位名对应真实楼层：第三层大厅在顶行、第二层走廊居中、一层大厅/大厅/一层偏厅
// 在底行）。固定地点由 initialLocations 给出槽位，两个随机楼层槽位由
// randomInitialSlots 的牌池确定性补齐。地下水道入口与达贡巢穴本体排在楼层下方；
// 潮汐隧道副本用确定性蛇形补全。
//
// `layout.kind` 明确写的是「presentation aliases; not logical grid positions」，
// 因此这里只是展示坐标，不改变任何规则连接。
import { place, finishCoordinates } from '../../layout.js'
import { chapterData } from '../../chapter-definition.js'

const chapterId = 'theLairOfDagon'
const spec = chapterData[chapterId]
const setup = spec.setup
const map = {}
const slots = new Map()
const inventory = new Map(setup.locationInventory.map(item => [item.printedCode, item.physicalIds]))

for (const location of setup.initialLocations) slots.set(location.slot, location.code)
for (const group of setup.randomInitialSlots) {
  const pool = group.pool.flatMap(item => (inventory.get(item.printedCode) || []).slice(0, item.count))
  group.slots.forEach((slot, index) => slots.set(slot, pool[index]))
}
// 楼层表（真实印刷楼层）。
setup.layout.rows.forEach((row, y) => row.forEach((slot, x) => {
  if (slot !== '.') place(map, slots.get(slot), [x, y])
}))
// 地下水道入口 / 达贡巢穴：楼层表下方的深层区域。
const byAlias = new Map(setup.locationDefinitions.map(definition => [definition.alias, definition.printedCode]))
place(map, byAlias.get('doorwayToTheDepths'), [0, 3])
place(map, byAlias.get('lairOfDagon'), [2, 3])

export const coordinates = finishCoordinates(chapterId, map)
