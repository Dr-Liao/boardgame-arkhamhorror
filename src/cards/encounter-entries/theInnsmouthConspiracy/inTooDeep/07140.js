import { randomKeyOnReveal, removeBarrierParley } from '../../_shared.js'
export default {
  code: '07140', scope: 'location', implemented: true,
  locationRule: { onReveal: randomKeyOnReveal },
  abilities: [removeBarrierParley({
    label: '谈判：战力(2)或敏捷(2)，成功移除1个屏障',
    cost: { action: 1 },
    test: { skill: ['combat', 'agility'], difficulty: 2 },
  })],
}
