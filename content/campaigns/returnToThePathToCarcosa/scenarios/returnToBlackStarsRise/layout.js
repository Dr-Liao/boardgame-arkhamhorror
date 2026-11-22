// 重返黑星升起 · 桌面布局。
//
// 参考 ReturnToBlackStarsRise.hs（5 列 × 8 行）。基础布局已覆盖全部地点 id；
// 回廊/骑士大厅与其余变体共用同一 id 与坐标，这里沿用基础坐标。
import { layoutFor } from '../../../../scenario-manifest.js'
import { scenario } from './definition.js'

export const layout = layoutFor(scenario, {
  porteDeLAvancee: { x: 3, y: 4 },
  grandRue: { x: 3, y: 3 },
  outerWall: { x: 5, y: 2 },
  northTower: { x: 4, y: 1 },
  brokenSteps: { x: 3, y: 2 },
  abbeyChurch: { x: 2, y: 2 },
  choeurGothique: { x: 1, y: 3 },
  cloister: { x: 1, y: 1 },
  knightsHall: { x: 0, y: 2 },
  chapelOfStAubert: { x: 0, y: 3 },
  abbeyTower: { x: 1, y: 4 },
})
