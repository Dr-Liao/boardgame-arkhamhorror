import { layoutFor } from '../../../../scenario-manifest.js'
import { scenario } from './definition.js'

export const layout = layoutFor(scenario, {
  mainPath: { x: 0, y: 0 }, unhallowedGround: { x: -2, y: 1 },
  twistingPaths: { x: -1, y: 1 }, oldHouse: { x: 0, y: 1 },
  cliffside: { x: 1, y: 1 }, tangledThicket: { x: 2, y: 1 },
  quietGlade: { x: 0, y: 2 }, ritualSite: { x: 0, y: 3 },
})
