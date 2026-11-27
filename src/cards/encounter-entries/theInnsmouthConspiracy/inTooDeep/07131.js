import { randomKeyOnReveal, removeBarrierParley } from '../../_shared.js'
export default {
  code: '07131', scope: 'location', implemented: true,
  locationRule: { onReveal: randomKeyOnReveal },
  abilities: [removeBarrierParley({
    kind: 'free',
    label: '受到1点伤害并谈判：移除1个屏障',
    cost: { damage: 1 },
  })],
}
