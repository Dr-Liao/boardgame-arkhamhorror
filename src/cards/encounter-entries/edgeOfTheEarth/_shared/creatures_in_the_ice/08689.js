// 08689 实体疯狂（Manifest Madness）· 敌人 · creatures_in_the_ice
// 卡面：猎手。强制 - 在实体疯狂攻击你时：将忒咳哩-哩牌库顶的 2 张卡牌洗入你的牌库（每有 1 张
//   卡牌不能洗入你的牌库，实体疯狂该次攻击造成 +1 伤害和 +1 恐惧）。
// 读点：forced + trigger 'enemyAttacked'（enemies.js#enemyAttack 在攻击结算后开窗）。
export default {
  code: '08689', scope: 'enemy', implemented: true,
  abilities: [{
    kind: 'forced', trigger: 'enemyAttacked',
    label: '实体疯狂攻击后：洗入 2 张忒咳哩-哩；每张不能洗入则本次攻击 +1 伤害/+1 恐惧',
    criteria: ({ source, context }) => context?.enemy?.id === source?.id
      && Number.isSafeInteger(context?.seat) && context?.attackCancelled !== true,
    resolve: ({ state, context, api }) => {
      const seat = context.seat
      const size = Number(api.mechanics.tekeli.size())
      const shuffled = size > 0 ? api.mechanics.tekeli.shuffleIn(seat, Math.min(2, size)) : false
      const done = Array.isArray(shuffled) ? shuffled.length : 0
      const missing = 2 - done
      if (missing <= 0) return
      api.info('「实体疯狂」：' + missing + ' 张忒咳哩-哩无法洗入，该次攻击额外 +' + missing + ' 伤害和 +' + missing + ' 恐惧。')
      api.damage(seat, missing)
      api.horror(seat, missing)
    },
  }],
}

