// 08566 飞机场
import { partnerShroud } from './_shared.js'

export default {
  code: '08566', scope: 'location', implemented: true,
  flags: { mirageId: 'airfield', tier: 2 },
  locationRule: {
    shroudModifier: partnerShroud('08595', '08722'),
    investigateResourceCost: 1,
  },
}
