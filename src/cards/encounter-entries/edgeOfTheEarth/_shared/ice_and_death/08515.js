// 08515 疾行谬物（Swift Nonsense）· 敌人 · ice_and_death
// 卡面：猎手。强制 - 在你击败疾行谬物时：将忒咳哩-哩牌库顶的 1 张卡牌洗入你的牌库，不要查看内容
//   （如果你不能这么做，疾行谬物攻击你）。
// 读点：forced + trigger 'enemyDefeated'；被击败后实体已离场，无法再走真实攻击管线，
//   以「按印刷攻击值直接结算伤害/恐惧」近似（注释见 primitive-requests/p7-08515.json）。
export default {
  code: '08515', scope: 'enemy', implemented: true,
  abilities: [{
    kind: 'forced', trigger: 'enemyDefeated',
    label: '击败疾行谬物：洗入 1 张忒咳哩-哩；不能则其攻击你',
    criteria: ({ source, context }) => context?.enemy?.id === source?.id && Number.isSafeInteger(context?.seat)
      && (context.accepted === true || context.seat != null),
    resolve: ({ context, api }) => {
      const seat = context.seat
      const size = Number(api.mechanics.tekeli.size())
      const shuffled = size > 0 ? api.mechanics.tekeli.shuffleIn(seat, 1) : false
      if (Array.isArray(shuffled) && shuffled.length) return
      api.info('「疾行谬物」：无法洗入忒咳哩-哩，它的临死反扑攻击了你（按印刷攻击值结算）。')
      api.damage(seat, 1)
      api.horror(seat, 1)
    },
  }],
  note: '击败瞬间实体已离场，攻击以印刷攻击值 1 伤害/1 恐惧直接结算（primitive-requests/p7-08515.json 登记近似口径）。',
}

