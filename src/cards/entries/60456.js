// 60456 祭品碗（Offering Bowl，Marie Lambeau）
// 卡面：使用（3 祭品）。如果祭品碗上没有祭品，将其弃掉。
//       [fast] 花费 1 祭品并横置祭品碗：受到 1 点伤害并获得 2 资源。
import { ownSeat } from '../../engine/matcher.js'

export default {
  code: '60456',
  uses: 3,
  usesType: 'offerings',
  discardWhenEmpty: true,
  abilities: [{
    kind: 'free',
    label: '花费 1 祭品并横置：受到 1 点伤害，获得 2 资源',
    cost: { exhaust: true, uses: 1 },
    criteria: [ownSeat()],
    resolve: ({ inv, api }) => {
      api.damage(inv.seat, 1)
      api.gainResources(inv.seat, 2)
    },
  }],
}
