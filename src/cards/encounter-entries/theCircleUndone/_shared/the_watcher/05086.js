// 05086 幽灵看守人
// 归属：战役共用 · theCircleUndone；遭遇组：the_watcher
// 卡面：警戒。猎手。
// 卡面：强制 - 在幽灵看守人被击败时：不将其弃掉，改为治愈其所有伤害，
//   将其与所有调查员解除交战状态并将其横置。本轮补给阶段期间其不重整。
//
// 引擎在 defeatEnemy 里先把敌人移出 state.enemies，再派发 behavior.enemyDefeated；
// 返回 true 表示「替代击败 / 不进入胜利区或遭遇弃牌堆」，所以这里要把它放回场上。
// 不重整用引擎通用的 enemy.preventReady = { from, rounds }（phases.js 补给阶段读点）。

import { originalOf } from '../../../_shared.js'

export default {
  code: '05086',
  scope: 'enemy',
  implemented: true,
  enemyScript: {
    onDefeated(state, enemy, api) {
      if (originalOf(enemy) !== '05086') return false
      enemy.damageTaken = 0
      enemy.exhausted = true
      // 本轮（含即将到来的补给阶段）不重整：from=当前轮，rounds=1。
      enemy.preventReady = { from: state.round, rounds: 1 }
      const holder = enemy.engagedSeat == null ? null : state.investigators[enemy.engagedSeat]
      if (holder) holder.engaged = (holder.engaged || []).filter(id => id !== enemy.id)
      enemy.engagedSeat = null
      if (!state.enemies.includes(enemy)) state.enemies.push(enemy)
      api.info?.('👁️ 幽灵看守人没有被击败：治愈所有伤害、与所有调查员解除交战、横置，本轮补给阶段不重整。')
      return true
    },
  },
}
