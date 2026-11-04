// 艾莲娜·哈珀失踪案（The Vanishing of Elina Harper · 07056）· 桌面坐标。
//
// 真实设置来自 chapter-data.json#theVanishingOfElinaHarper.setup.initialLocations
// （印斯茅斯的七个初始地点，按印刷顺序摆放）；六处藏身处藏在剧情下，开局不在场，
// 用确定性蛇形排在初始地点的下一行，保证注册期每个已声明地点都有有限坐标。
import { place, finishCoordinates } from '../../layout.js'
import { chapterData } from '../../chapter-definition.js'

const chapterId = 'theVanishingOfElinaHarper'
const initial = chapterData[chapterId].setup.initialLocations
const map = {}

initial.forEach((printed, index) => place(map, printed, [index % 4, Math.floor(index / 4)]))

export const coordinates = finishCoordinates(chapterId, map)
