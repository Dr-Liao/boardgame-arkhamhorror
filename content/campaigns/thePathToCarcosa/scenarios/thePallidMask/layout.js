import { layoutFor } from '../../../../scenario-manifest.js'
import { scenario } from './definition.js'

export const layout = layoutFor(scenario, Object.fromEntries(
  Object.keys(scenario.locations).map((id, index) => [
    id,
    { x: index % 7, y: Math.floor(index / 7) },
  ]),
))
