// 03099 王之特使
// 归属：战役共用 · thePathToCarcosa（卡尔克萨之路）
// 遭遇组：cult_of_the_yellow_sign
// 卡面：猎物 - 线索最多。
// 卡面：猎手。
// 卡面：强制 - 在王之特使攻击你后：将你的1个线索移动到王之特使上。
// 卡面：强制 - 在你击败王之特使时：控制其所有线索。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

import { flipEnemyCluesToDoom } from '../../../_shared.js'

export default {
  code: '03099', implemented: true, scope: 'enemy', enemyRule: { prey: 'mostClues' },
  enemyScript: {
    onAttackResolved(state, enemy, inv, api) {
      if (inv.clues < 1) return
      api.spendClues(inv.seat, 1)
      enemy.clues = (enemy.clues || 0) + 1
      flipEnemyCluesToDoom(state, enemy)
    },
    onDefeated(state, enemy, api) {
      if (!enemy.clues) return false
      const inv = state.investigators[enemy.defeatedBy]
      if (inv) api.gainClues(inv.seat, enemy.clues)
      enemy.clues = 0
      return false
    },
  },
}
