// 08679 无名的疯狂（The Nameless Madness）· 深潜组敌人 ×15
// 卡面：Alert. Massive. Retaliate. 不能受到伤害。
// 强制 - 你成功规避或攻击它后：按成功差值每 1 点，重整最近的一份已重整的同名副本。
export default {
  code: '08679',
  scope: 'enemy',
  implemented: true,
  flags: {
    namelessMadness: true,
    cannotTakeDamage: true,
    alert: true,
    massive: true,
    retaliate: true,
    exhaustNearestOnSuccess: true,
  },
  enemyScript: {
    onSpawn(state, enemy, api) {
      api.info?.('👁️ 无名的疯狂：Alert/Massive/Retaliate，且不能受到伤害。')
    },
  },
}
