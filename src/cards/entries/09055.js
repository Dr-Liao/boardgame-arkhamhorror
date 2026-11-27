// 09055 媒体通行证（Press Pass）· 探寻者（Seeker）资产 · 2 经验 · 饰品。
//
// 卡面：[reaction] 你花费线索或将线索放到你所在地点后，横置媒体通行证：本回合期间你可以进行额外
//       一次行动（如果现在不是你的回合，则你的下一个回合期间）。
//
// 一卡一文件：这张卡的行为只在这里维护。
//
const CODE = '09055'

export default {
  code: CODE,
  abilities: [
    {
      kind: 'reaction',
      trigger: ['cluesSpent', 'cluesPlaced'],
      cost: { exhaust: true },
      label: '你花费/放置线索后：横置媒体通行证，本回合（非本回合则下个回合）额外一次行动',
      criteria: [({ inv, source, context }) => {
        if (!source || source.exhausted) return false
        return context.seat === inv.seat && context.amount > 0
          && (context.when === 'cluesSpent' || context.location === inv.location)
      }],
      resolve: ({ state, inv, api }) => {
        if (state.phase === 'investigation' && state.currentSeat === inv.seat && !inv.turnEnded) {
          api.gainAction(inv.seat, 1)
          api.info(`📰 「媒体通行证」：${inv.name} 本回合额外执行一次行动。`)
          return
        }
        api.grantActionOnNextTurn(inv.seat, 1)
        api.info(`📰 「媒体通行证」：${inv.name} 的下一个回合额外执行一次行动。`)
      },
    },
  ],
  modifiers: [],
}
