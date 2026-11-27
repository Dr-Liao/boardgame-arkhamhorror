import { randomKeyOnReveal, removeBarrierParley } from '../../_shared.js'
export default {
  code: '07129', scope: 'location', implemented: true,
  locationRule: { onReveal: randomKeyOnReveal },
  abilities: [removeBarrierParley({
    label: '谈判：智力(3)，成功移除1个屏障',
    cost: { action: 2 },
    test: { skill: 'intellect', difficulty: 3 },
  })],
}
