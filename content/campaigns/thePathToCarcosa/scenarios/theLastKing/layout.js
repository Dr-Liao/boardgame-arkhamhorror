import { layoutFor } from '../../../../scenario-manifest.js'
import { scenario } from './definition.js'

export const layout = layoutFor(scenario, {
  diningRoom: { x: 0, y: 0 },
  gallery: { x: 2, y: 0 },
  ballroom: { x: 0, y: 1 },
  courtyard: { x: 1, y: 1 },
  livingRoom: { x: 2, y: 1 },
  foyer: { x: 1, y: 2 },
})
