// 08515 疾行谬物：击败者洗入忒咳哩-哩，不能洗入则结算一次攻击。
export default {
  code: '08515', scope: 'enemy', implemented: true,
  abilities: [{
    kind: 'forced', trigger: 'enemyDefeated',
    label: '击败疾行谬物：洗入 1 张忒咳哩-哩，不能则其攻击你',
    criteria: ({ source, context }) => context?.enemy?.id === source?.id && Number.isSafeInteger(context.sourceSeat ?? context.seat),
    resolve: ({ context, api }) => {
      const seat = context.sourceSeat ?? context.seat
      if (!api.mechanics.tekeli.shuffleIn(seat, 1)?.length) {
        api.enemyAttackByCard(context.enemy, '疾行谬物的反扑', seat)
      }
    },
  }],
}
