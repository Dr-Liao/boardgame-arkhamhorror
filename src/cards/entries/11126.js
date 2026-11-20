import { shuffleThreatIntoDeck } from './_shared.js'

const code = '11126'

export default {
  code,
  trackRoundActionHistory: true,
  teamActivatable: true,
  abilities: [{
    kind: 'weakness', label: '显现：将本卡放入你的威胁区域',
    weakness: { type: 'threat' },
  }, {
    kind: 'forced', trigger: 'turnEnded',
    label: '你的回合结束且本轮未执行抽牌或资源行动时：受到 1 恐惧并将本卡洗回牌库',
    criteria: ({ state, inv, context }) => {
      if (context.seat !== inv.seat) return false
      const history = inv.roundActionHistory
      return history?.round !== state.round || !history.actions.some(action => action === 'draw' || action === 'resource')
    },
    resolve: context => {
      context.api.horror(context.inv.seat, 1)
      shuffleThreatIntoDeck(context)
    },
  }, {
    kind: 'action',
    cost: { action: true, resources: 3 },
    label: '花费 3 资源：弃掉本卡',
    resolve: ({ api, source }) => api.removeThreat(source),
  }, {
    kind: 'action',
    cost: { action: true, discardHand: 3 },
    label: '选择并弃掉 3 张手牌：弃掉本卡',
    resolve: ({ api, source }) => api.removeThreat(source),
  }],
}
