// 魔鬼礁石（Devil Reef · 07163）· 桌面坐标。
//
// 真实设置几何：翻腾水域 07168 是起点 (0,0)；五座岛屿按 mid-chapter setup 的
// 初始锚点 [[0,3],[4,2],[-4,2],[4,-2],[-4,-2]] 环绕摆开（middle-setup.js 的
// `initialIslandPositions` 就是按这些锚点放置随机岛屿）。三对变体地点与潮汐
// 隧道副本（07102:2 等）先放在一边，用确定性蛇形补全到岛屿下方。
import { place, finishCoordinates } from '../../layout.js'
import { chapterData } from '../../chapter-definition.js'

const chapterId = 'devilReef'
const spec = chapterData[chapterId]
const map = {}

// 起始地点：翻腾水域（setup.initialLocations 第一项，initialRevealed）。
place(map, spec.startLocation, [0, 0])
const islandAnchors = [[0, 3], [4, 2], [-4, 2], [4, -2], [-4, -2]]
const islands = spec.setup.initialLocations.filter(location => location.zone === 'randomIslandSlot')
islands.forEach((location, index) => place(map, location.printedCode, islandAnchors[index]))

export const coordinates = finishCoordinates(chapterId, map)
