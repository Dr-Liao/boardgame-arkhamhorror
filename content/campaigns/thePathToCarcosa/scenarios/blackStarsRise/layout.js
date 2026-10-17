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
