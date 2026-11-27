// 08568 凌乱宿舍
import { partnerShroud } from './_shared.js'

export default {
  code: '08568', scope: 'location', implemented: true,
  flags: { mirageId: 'clutteredDormitory', tier: 2 },
  locationRule: {
    shroudModifier: partnerShroud('08588', '08715'),
    tekeliDestination: 'anyDeck',
  },
}
