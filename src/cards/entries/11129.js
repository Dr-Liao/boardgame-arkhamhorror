import { attackableEnemies, shuffleThreatIntoDeck } from './_shared.js'

export default {
  code: '11129',
  trackRoundActionHistory: true,
  teamActivatable: true,
  abilities: [{
    kind: 'weakness', label: '显现：将本卡放入你的威胁区域',
    weakness: { type: 'threat' },
  }, {
    kind: 'forced', trigger: 'turnEnded',
    label: '你的回合结束且本轮未成功攻击敌人时：受到 1 伤害并将本卡洗回牌库',
    criteria: ({ state, inv, context }) => context.seat === inv.seat
      && (inv.roundActionHistory?.round !== state.round || !inv.roundActionHistory.successes.includes('fight')),
    resolve: context => {
      context.api.damage(context.inv.seat, 1)
      shuffleThreatIntoDeck(context)
    },
  }, {
    kind: 'action', countsAs: 'fight', cost: { action: true },
    label: '攻击（技能值 −2）：成功则弃掉本卡',
    target: { kind: 'enemy', query: ({ state, inv, entity }) => attackableEnemies(state, inv).includes(entity) },
    resolve: ({ inv, source, target, api }) => {
      if (api.fight(inv.seat, target.id, { noSpend: true, combatBonus: -2 })?.success) api.removeThreat(source)
    },
  }],
}
