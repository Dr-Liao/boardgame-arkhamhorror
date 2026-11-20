import { shuffleThreatIntoDeck } from './_shared.js'

export default {
  code: '11127',
  trackRoundActionHistory: true,
  teamActivatable: true,
  abilities: [{
    kind: 'weakness', label: '显现：将本卡放入你的威胁区域',
    weakness: { type: 'threat' },
  }, {
    kind: 'forced', trigger: 'turnEnded',
    label: '你的回合结束且本轮未成功调查时：受到 1 恐惧并将本卡洗回牌库',
    criteria: ({ state, inv, context }) => context.seat === inv.seat
      && (inv.roundActionHistory?.round !== state.round || !inv.roundActionHistory.successes.includes('investigate')),
    resolve: context => {
      context.api.horror(context.inv.seat, 1)
      shuffleThreatIntoDeck(context)
    },
  }, {
    kind: 'action', countsAs: 'investigate', cost: { action: true },
    label: '调查（技能值 −2）：成功则弃掉本卡',
    criteria: ({ state, inv }) => state.locations.some(location => location.id === inv.location && !location.locked),
    resolve: ({ inv, source, api }) => {
      if (api.investigate(inv.seat, { bonus: -2 })?.success) api.removeThreat(source)
    },
  }],
}
