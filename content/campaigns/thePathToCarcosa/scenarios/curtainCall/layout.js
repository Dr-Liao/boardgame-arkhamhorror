import { layoutFor } from '../../../../scenario-manifest.js'
import { scenario } from './definition.js'

export const layout = layoutFor(scenario, {
  lightingBox: { x: 0, y: 0 },
  balcony: { x: 1, y: 0 },
  greenRoom: { x: 2, y: 0 },
  boxOffice: { x: 0, y: 1 },
  lobby: { x: 1, y: 1 },
  theatre: { x: 2, y: 1 },
  backstage: { x: 3, y: 1 },
  dressingRoom: { x: 4, y: 0 },
  rehearsalRoom: { x: 4, y: 1 },
  trapRoom: { x: 4, y: 2 },
})
