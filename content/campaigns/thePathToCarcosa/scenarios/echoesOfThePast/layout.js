import { layoutFor } from '../../../../scenario-manifest.js'
import { scenario } from './definition.js'

export const layout = layoutFor(scenario, {
  thirdLibrary: { x: 0, y: 0 },
  quietHallsThird: { x: 1, y: 0 },
  peabodysOffice: { x: 2, y: 0 },
  thirdRecordOffice: { x: 3, y: 0 },
  secondMuseum: { x: 0, y: 1 },
  quietHallsSecond: { x: 1, y: 1 },
  secondLibrary: { x: 2, y: 1 },
  readingRoom: { x: 3, y: 1 },
  hiddenLibrary: { x: 4, y: 1 },
  meetingRoom: { x: 0, y: 2 },
  entryHall: { x: 1, y: 2 },
  groundRecordOffice: { x: 2, y: 2 },
  groundMuseum: { x: 3, y: 2 },
})
