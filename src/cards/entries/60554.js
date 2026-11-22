// 60554 饮血者 · 基础弱点（敌人）
// 卡面：猎手。反击。
//       强制 - 饮血者攻击后：治愈其 1 点伤害。
// 读点：enemyScript.onAttackResolved（敌人攻击结算后钩子）。
const CODE = '60554'

export default {
  code: CODE,
  scope: 'enemy',
  implemented: true,
  enemyWeakness: { hunter: true, retaliate: true },
  enemyScript: {
    onAttackResolved(state, enemy, inv, api) {
      if ((enemy.damageTaken || 0) <= 0) return
      api.healEnemy?.(enemy, 1)
      api.info?.(`「饮血者」攻击后治愈 1 点伤害（剩余 ${enemy.damageTaken || 0}）。`)
    },
  },
  abilities: [],
  modifiers: [],
}
