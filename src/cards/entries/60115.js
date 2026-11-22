import { ownSeat } from '../../engine/matcher.js'

export default {
  code: '60115',
  abilities: [{
    kind: 'played', fast: true, trigger: 'defeatEnemy', label: '击败敌人后抽 2 张牌',
    criteria: [ownSeat()],
    effect: { type: 'draw', amount: 2 },
  }],
}
