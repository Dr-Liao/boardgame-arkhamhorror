import { randomKeyOnReveal, removeBarrierParley } from '../../_shared.js'
export default {
  code: '07134', scope: 'location', implemented: true,
  locationRule: { onReveal: randomKeyOnReveal },
  abilities: [removeBarrierParley({
    label: '无剩余线索时谈判：移除1个屏障',
    cost: { action: 1 },
    requiresNoClues: true,
  })],
}
