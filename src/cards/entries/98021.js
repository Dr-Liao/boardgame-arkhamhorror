export default {
  code: '98021',
  abilities: [{
    kind: 'weakness', label: '随机结算一张暗置遭遇牌', weakness: { type: 'custom' },
    resolve: ({ inv, api }) => {
      if (!api.drawStashedEncounter(inv.seat, { peril: true, cannotCancel: true, skillPenalty: 2, enemyAttacks: true })) {
        api.scheduleWeaknessShuffle(inv.seat, '98021')
      }
    },
  }],
}
