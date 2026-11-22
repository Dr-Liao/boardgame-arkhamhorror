import { ownTurn } from '../../engine/matcher.js'

export default {
  code: '52005',
  abilities: [{
    kind: 'free',
    countsAs: 'evade',
    label: '横置：降低难度进行躲避，成功时不横置敌人',
    criteria: [ownTurn(), ({ inv }) => !inv.turnEnded],
    cost: { exhaust: true },
    effect: { type: 'evade', evadeModifier: -2, noExhaustOnSuccess: true, preventEngageThisTurn: true },
  }],
}
