import { layoutFor } from '../../../../scenario-manifest.js'
import { scenario } from './definition.js'

export const layout = layoutFor(scenario, {
  study: { x: 0, y: 0 }, hallway: { x: 0, y: 1 },
  attic: { x: -1, y: 2 }, parlor: { x: 0, y: 2 }, cellar: { x: 1, y: 2 },
})
