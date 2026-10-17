import { layoutFor } from '../../../../scenario-manifest.js'
import { scenario } from './definition.js'

export const layout = layoutFor(scenario, {
  miskatonicUniversity: { x: -1, y: -1 }, northside: { x: 0, y: -1 }, stMarysHospital: { x: 1, y: -1 },
  yourHouse: { x: -1, y: 0 }, rivertown: { x: 0, y: 0 }, downtown: { x: 1, y: 0 },
  southside: { x: -1, y: 1 }, graveyard: { x: 0, y: 1 }, easttown: { x: 1, y: 1 },
})
