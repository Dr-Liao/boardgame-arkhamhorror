// 08567 阿拉斯加荒野
import { partnerShroud } from './_shared.js'

export default {
  code: '08567', scope: 'location', implemented: true,
  flags: { mirageId: 'alaskanWilds', tier: 2 },
  locationRule: {
    shroudModifier: partnerShroud('08589', '08716'),
    enterMirageCost: { tekeli: 1, actions: 1 },
  },
}
