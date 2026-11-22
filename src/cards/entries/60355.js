// 60355 举世之重（Weight of the World，André Patel 专属弱点）
// 卡面：显现 - 将举世之重放置入场，位于你的威胁区域。
//       强制 - 举世之重在场时，在你的技能检定失败时，受到 1 点恐惧并将举世之重洗回你的牌库。
import { ownSeat } from '../../engine/matcher.js'

export default {
  code: '60355',
  abilities: [
    {
      kind: 'weakness',
      label: '显现时放入威胁区域',
      weakness: { type: 'threat' },
    },
    {
      kind: 'forced',
      trigger: 'skillTestFailed',
      label: '检定失败：受到 1 点恐惧并洗回牌库',
      criteria: [
        ownSeat(),
        ({ inv, source }) => Boolean(source) && (inv.threat || []).includes(source),
      ],
      resolve: ({ inv, source, api }) => {
        api.horror(inv.seat, 1)
        api.removeThreat(source)
        api.scheduleWeaknessShuffle(inv.seat, '60355')
      },
    },
  ],
}
