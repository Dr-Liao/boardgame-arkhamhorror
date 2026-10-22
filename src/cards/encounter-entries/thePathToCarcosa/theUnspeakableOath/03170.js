// 03170 疯人院大厅
// 归属：关卡专用 · theUnspeakableOath（卡尔克萨之路 · 邪秽誓约）
// 遭遇组：the_unspeakable_oath
// 卡面：[action]受到1点恐惧：躲避。自动躲避本地点的一个[[附身]]敌人。(FAQ，v2.0)
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 疯人院大厅（03170）：[行动]受到 1 点恐惧：自动躲避本地点的一个[[附身]]敌人。

import { isLunaticEnemy } from '../../_shared.js'

export default {
  code: '03170', scope: 'location', implemented: true,
  name: '疯人院大厅',
  text: '[行动]受到 1 点恐惧：自动躲避本地点的一个[[附身]]敌人。',
  locationRule: {
    actions({ state, inv, moves }) {
      for (const enemy of state.enemies.filter(candidate =>
        candidate.location === inv.location && isLunaticEnemy(candidate))) {
        moves.push({ action: 'scenarioAction', rule: 'eastHallEvade', enemyId: enemy.id,
          label: `承受 1 恐惧，自动躲避${enemy.name}` })
      }
    },
    performAction(state, inv, move, api) {
      if (move.rule !== 'eastHallEvade') return false
      const enemy = state.enemies.find(candidate => candidate.id === move.enemyId
        && candidate.location === inv.location && isLunaticEnemy(candidate))
      if (!enemy) throw new Error('没有可由东区病房躲避的疯子敌人')
      api.horror(inv.seat, 1)
      api.evadeEnemy(enemy)
      return true
    },
  },
}
