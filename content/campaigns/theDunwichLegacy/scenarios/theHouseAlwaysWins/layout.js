import { layoutFor } from '../../../../scenario-manifest.js'
import { scenario } from './definition.js'

export const layout = layoutFor(scenario, {
  laBellaLuna: { x: 0, y: 1 }, cloverClubLounge: { x: 1, y: 1 },
  cloverClubCardroom: { x: 2, y: 0 }, cloverClubBar: { x: 2, y: 2 },
  darkenedHall: { x: 3, y: 1 }, artGallery: { x: 3, y: 0 },
  vipArea: { x: 4, y: 1 }, backAlley: { x: 3, y: 2 },
})
