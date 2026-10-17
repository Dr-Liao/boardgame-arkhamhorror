import { layoutFor } from '../../../../scenario-manifest.js'
import { scenario } from './definition.js'

export const layout = layoutFor(scenario, {
  darkSpires: { x: 1, y: 0 },
  depthsOfDemhe: { x: 1, y: 1 },
  dimStreets: { x: 0, y: 2 },
  palaceOfTheKing: { x: 1, y: 2 },
  ruinsOfCarcosa: { x: 2, y: 2 },
  bleakPlains: { x: 1, y: 3 },
  shoresOfHali: { x: 1, y: 4 },
})
