// 08687 原初恶魔（Primordial Evil）· 敌人 · agents_of_the_unknown
// 归属：战役共用 · edgeOfTheEarth/_shared。卡面：猎手。反击。
// 强制 - 在你对原初恶魔造成任意数量的伤害时：将忒咳哩-哩牌库顶的 1 张卡牌洗入你的牌库，
//   不要查看内容（如果你不能这么做，原初恶魔攻击你）。
// 读点：abilities 的 forced + trigger 'enemyDamaged'（combat.js 普通攻击与伤害管线都会开窗）；
//   洗入走 P2-E api.mechanics.tekeli.shuffleIn（牌张不足返回 false 即「不能这么做」）。
export default {
  code: '08687', scope: 'enemy', implemented: true,
  abilities: [{
    kind: 'forced', trigger: 'enemyDamaged',
    label: '原初恶魔受到伤害后：洗入 1 张忒咳哩-哩；不能则它攻击你',
    criteria: ({ source, context }) => context?.enemy?.id === source?.id && Number.isSafeInteger(context?.seat),
    resolve: ({ state, source, context, api }) => {
      const seat = context.seat
      const size = Number(api.mechanics.tekeli.size())
      const shuffled = size > 0 ? api.mechanics.tekeli.shuffleIn(seat, 1) : false
      if (Array.isArray(shuffled) && shuffled.length) {
        api.info('「原初恶魔」：1 张忒咳哩-哩洗入牌库（不查看内容）。')
        return
      }
      api.info('「原初恶魔」：没有忒咳哩-哩可洗入，它立刻攻击了调查员。')
      api.scenario.attack(source, state.investigators[seat])
    },
  }],
}

