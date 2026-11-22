// 60360 奢华戒指（Extravagant Ring，André Patel）
// 卡面：使用（3 声望）。
//       [reaction] 当你将要技能检定成功时，花费 1 声望并横置奢华戒指：你本次检定得到 +2 技能值。
import { ownSeat } from '../../engine/matcher.js'

export default {
  code: '60360',
  uses: 3,
  usesType: 'renown',
  abilities: [{
    kind: 'reaction',
    trigger: 'test.afterCommit',
    label: '即将成功时：花费 1 声望并横置，本次检定 +2',
    cost: { exhaust: true, uses: 1 },
    criteria: [ownSeat(), ({ state }) => Boolean(state.skillTest)],
    resolve: ({ api }) => api.addTestValue(2),
  }],
}
