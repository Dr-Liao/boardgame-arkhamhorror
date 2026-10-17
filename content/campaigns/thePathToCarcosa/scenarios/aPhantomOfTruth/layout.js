import { layoutFor } from '../../../../scenario-manifest.js'
import { scenario } from './definition.js'

export const layout = layoutFor(scenario, {
  grandGuignol: { x: 0, y: 0 },
  montmartre: { x: 1, y: 0 },
  canalSaintMartin: { x: 2, y: 0 },
  pereLachaiseCemetery: { x: 3, y: 0 },
  operaGarnier: { x: 0, y: 1 },
  leMarais: { x: 2, y: 1 },
  gareDOrsay: { x: 0, y: 2 },
  montparnasse: { x: 1, y: 2 },
  gardensOfLuxembourg: { x: 2, y: 2 },
  notreDame: { x: 3, y: 2 },
})
