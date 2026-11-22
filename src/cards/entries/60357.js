// 60357 舞台中央（Center Stage，André Patel）
// 卡面：每位调查员仅限 1 张。使用（3 声望）。如果舞台中央上没有声望，将其弃掉。
//       [fast] 技能检定期间，花费 1 声望并横置舞台中央：你本轮每花费过 1 个行动，本次检定得到 +1 技能值
//       （如果本能力在你行动期间触发，也包括本行动）。
import { ownSeat } from '../../engine/matcher.js'

export default {
  code: '60357',
  uses: 3,
  usesType: 'renown',
  discardWhenEmpty: true,
  abilities: [{
    kind: 'free',
    trigger: 'test.afterCommit',
    label: '花费 1 声望并横置：本轮每花费 1 个行动，本次检定 +1 技能值',
    cost: { exhaust: true, uses: 1 },
    criteria: [ownSeat()],
    resolve: ({ state, api }) => {
      api.addTestValue(Math.max(0, Number(state.phaseActionCount || 0)))
    },
  }],
}
