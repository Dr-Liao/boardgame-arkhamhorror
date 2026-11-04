// 深陷危局（In Too Deep · 07123）· 桌面坐标。
//
// chapter-data.json#inTooDeep.setup.grid 提供完整城镇棋盘的 [x,y]（15 个地点，
// 铁路 07142 位于 (-4,2)，只与 07135(-4,1) 和 07129(-3,2) 正交相邻，不能直接跳到
// 07130(-4,0)）。这里直接采用该网格；每个地点都有真实坐标，无需补全。
import { place, finishCoordinates } from '../../layout.js'
import { chapterData } from '../../chapter-definition.js'

const chapterId = 'inTooDeep'
const spec = chapterData[chapterId]
const map = {}

for (const [printed, gridPoint] of Object.entries(spec.setup.grid)) place(map, printed, gridPoint)

export const coordinates = finishCoordinates(chapterId, map)
