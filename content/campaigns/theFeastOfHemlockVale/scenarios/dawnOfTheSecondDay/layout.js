// 第二日黎明（dawnOfTheSecondDay）· 桌面坐标（The Vale 6×3 双格模板的投影）。
//
// 坐标来自 PreludeDawnOfTheSecondDay.hs / FateOfTheVale/LostSelf.hs 的 scenarioWith 布局：
//   ".     triangle square"      hemlockChapel(1,0) tadsGeneralStore(2,0)
//   "moon  triangle square"      theAtwoodHouse(0,1)
//   "moon  diamond  star"        theCrossroads(1,2) theCommons(2,2)
//   "heart diamond  star"        theOldMill(0,3)
//   "heart circle   spade"       boardingHouse(1,4) valeSchoolhouse(2,4)
//   ".     circle   spade"
// 每张地点卡纵向占 2 格（同一符号出现两次）。layout 只是展示投影；规则连接由
// definition.js 的 LOCATION_CONNECTIONS（印刷图标 ∪ 网格相邻）给出。
import { layoutFor } from '../../../../scenario-manifest.js'
import { scenario, LOCATION_COORDINATES } from './definition.js'

export const layout = layoutFor(scenario, LOCATION_COORDINATES)
export const LAYOUT_CELL_HEIGHT = 2
// 展示层：每张 The Vale 地点卡纵向占 2 格（见文件头模板）。
layout.cellHeight = LAYOUT_CELL_HEIGHT
