// 02098 匪徒
// 归属：战役共用 · theDunwichLegacy（敦威治遗产）
// 遭遇组：naomis_crew
// 卡面：反击。
// 卡面：强制 - 在匪徒攻击你后：失去1资源。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '02098', scope: 'enemy',
  enemyScript: {
    onAttackResolved(state, enemy, inv) {
      if (enemy.textBlanked && enemy.textBlanked.round === state.round && enemy.textBlanked.phase === state.phase) return
      inv.resources = Math.max(0, inv.resources - 1)
    },
  },
}
