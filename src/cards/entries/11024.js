import { ownFirstAction, ownTurn } from '../../engine/matcher.js'

export default {
  code: '11024', trackRoundActionHistory: true,
  playCondition: [ownTurn(), ownFirstAction()],
  abilities: [
    {
      kind: 'played', noOpportunityAttack: true, label: '抽牌（本轮抽过敌人则抽 2 张），然后治愈 1 恐惧',
      resolve: ({ state, inv, api }) => {
        const drewEnemy = inv.roundActionHistory?.round === state.round && inv.roundActionHistory.enemyDraws > 0
        api.drawCards(inv.seat, drewEnemy ? 2 : 1)
        api.healHorror(inv.seat, 1)
      },
    },
  ],
}
