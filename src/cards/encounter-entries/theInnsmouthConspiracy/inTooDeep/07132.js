import { randomKeyOnReveal, removeBarrierParley } from '../../_shared.js'
export default {
  code: '07132', scope: 'location', implemented: true,
  locationRule: { onReveal: randomKeyOnReveal },
  abilities: [removeBarrierParley({
    kind: 'free',
    label: '弃掉1张手牌并谈判：移除1个屏障',
    cost: { discardHand: 1 },
  })],
}
