import { enemyInEngagement } from '../../engine/enemy-parts.js'
import { shuffleThreatIntoDeck } from './_shared.js'

export default {
  code: '11128',
  trackRoundActionHistory: true,
  teamActivatable: true,
  abilities: [{
    kind: 'weakness', label: '显现：将本卡放入你的威胁区域',
    weakness: { type: 'threat' },
  }, {
    kind: 'forced', trigger: 'turnEnded',
    label: '你的回合结束且本轮未成功躲避敌人时：受到 1 伤害并将本卡洗回牌库',
    criteria: ({ state, inv, context }) => context.seat === inv.seat
      && (inv.roundActionHistory?.round !== state.round || !inv.roundActionHistory.successes.includes('evade')),
    resolve: context => {
      context.api.damage(context.inv.seat, 1)
      shuffleThreatIntoDeck(context)
    },
  }, {
    kind: 'action', countsAs: 'evade', cost: { action: true },
    label: '躲避（技能值 −2）：成功则弃掉本卡',
    target: { kind: 'enemy', query: ({ state, inv, entity }) => enemyInEngagement(state, entity, inv) },
    resolve: ({ inv, source, target, api }) => {
      if (api.evade(inv.seat, { enemyId: target.id, bonus: -2 })?.success) api.removeThreat(source)
    },
  }],
}
