// 08572 摩艾石像
import { partnerShroud } from './_shared.js'

export default {
  code: '08572', scope: 'location', implemented: true,
  flags: { mirageId: 'moaiStatues', tier: 2 },
  locationRule: {
    shroudModifier: partnerShroud('08594', '08721'),
    surgeAttachedTreachery: 'revelation',
  },
}
